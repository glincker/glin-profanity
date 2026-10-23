"""Main Filter class for profanity detection and filtering."""

from __future__ import annotations

from typing import Literal

from glin_profanity.data.dictionary import dictionary
from glin_profanity.types.types import (
    CheckProfanityResult,
    FilterConfig,
    Language,
    Match,
    SeverityLevel,
)
from glin_profanity.utils.unicode import normalize_unicode

from .legacy_scan import (
    LegacyScanContext,
    legacy_context_hits,
    legacy_is_profane,
    legacy_scan,
)
from .normalize_text import NormalizeConfig, normalize_for_matching
from .obfuscation import resolve_obfuscation
from .pipeline.views import ViewConfig
from .replacement import replace_spans, replace_words
from .scanner import ScanHit, Scanner, ScannerConfig
from .whitelist import Interval, Whitelist, blank_protected
from .word_matcher import WordMatcher

_ACCENT_ALIAS_MIN_LENGTH = 4


def _with_accent_folded_aliases(words: list[str]) -> list[str]:
    seen = {word.lower() for word in words}
    extra: list[str] = []
    for word in words:
        folded = normalize_unicode(word)
        key = folded.lower()
        if key == word.lower() or key in seen:
            continue
        if len(key.replace(" ", "")) < _ACCENT_ALIAS_MIN_LENGTH:
            continue
        seen.add(key)
        extra.append(folded)
    return words + extra

LeetspeakLevel = Literal["basic", "moderate", "aggressive"]


def _unique_spans(hits: list[ScanHit]) -> list[ScanHit]:
    """Drop repeat hits of the same word and span (original view wins)."""
    seen: set[tuple[str, int, int]] = set()
    unique: list[ScanHit] = []
    for hit in hits:
        key = (hit.word, hit.start, hit.end)
        if key not in seen:
            seen.add(key)
            unique.append(hit)
    return unique


class Filter:
    """
    Main profanity filter class.

    Provides functionality to detect and filter profane language in text
    with support for multiple languages, leetspeak detection, Unicode
    normalization, obfuscation handling (HTML, separators, masks, stretched
    letters), custom configurations, and context-aware filtering.

    Examples:
        >>> filter = Filter({"languages": ["english"], "detect_leetspeak": True})
        >>> filter.is_profane("@ss")
        True
        >>> filter.is_profane("fück")  # Unicode normalization
        True
        >>> filter.is_profane("f.u.c.k")  # Separators (obfuscation "standard")
        True
    """

    def __init__(self, config: FilterConfig | None = None) -> None:
        """
        Initialize the profanity filter.

        Args:
            config: Configuration options for the filter
        """
        config = config or {}

        # Kept so get_config() can round-trip what the caller passed in.
        self._languages: list[Language] = list(config.get("languages") or [])
        self._all_languages = bool(config.get("all_languages", False))
        self._custom_words: list[str] = list(config.get("custom_words") or [])
        self._domain_whitelists = config.get("domain_whitelists")

        # Basic configuration
        self.case_sensitive = config.get("case_sensitive", False)
        self.allow_obfuscated_match = config.get("allow_obfuscated_match", False)
        self.word_boundaries = config.get(
            "word_boundaries", not self.allow_obfuscated_match
        )
        self.replace_with = config.get("replace_with")
        self.severity_levels = config.get("severity_levels", False)
        self.log_profanity = config.get("log_profanity", False)
        self.fuzzy_tolerance_level = config.get("fuzzy_tolerance_level", 0.8)

        # Context-aware configuration
        self.enable_context_aware = config.get("enable_context_aware", False)
        self.context_window = config.get("context_window", 3)
        self.confidence_threshold = config.get("confidence_threshold", 0.7)

        # Leetspeak and Unicode normalization configuration
        self.detect_leetspeak = config.get("detect_leetspeak", False)
        self.leetspeak_level: LeetspeakLevel = config.get("leetspeak_level", "moderate")
        self.normalize_unicode_enabled = config.get("normalize_unicode", True)

        # Caching configuration
        self.cache_results = config.get("cache_results", False)
        self.max_cache_size = config.get("max_cache_size", 1000)
        self._cache: dict[tuple[object, ...], CheckProfanityResult] = {}
        self._matcher = WordMatcher(
            self.case_sensitive, self.word_boundaries, self.fuzzy_tolerance_level
        )

        # Obfuscation pipeline and extra safe words
        self.obfuscation_option = config.get("obfuscation")
        self.whitelist_words: list[str] = list(config.get("whitelist") or [])

        # Initialize word sets
        ignore_words_list = config.get("ignore_words") or []
        self.ignore_words: set[str] = {word.lower() for word in ignore_words_list}

        # Load dictionary words
        self._load_words(config)
        self._scanner = self._create_scanner()
        # Fuzzy matching has no scanner; only the user's own safe words apply there.
        self._legacy_whitelist: Whitelist | None = (
            Whitelist(self.whitelist_words, False)
            if self._scanner is None and self.whitelist_words
            else None
        )

    def _load_words(self, config: FilterConfig) -> None:
        """Load profanity words based on configuration."""
        words: list[str] = []

        if config.get("all_languages", False):
            words = dictionary.get_all_words()
        else:
            languages = config.get("languages") or ["english"]
            for lang in languages:
                words.extend(dictionary.get_words(lang))

        # Add custom words if provided
        custom_words = config.get("custom_words")
        if custom_words:
            words.extend(custom_words)

        # Text folds diacritics, so an accented entry needs a folded alias to match
        # "ereccion". Short entries are skipped (año would alias to ano).
        if self.normalize_unicode_enabled:
            words = _with_accent_folded_aliases(words)

        # Insertion order is kept so hits come out in a stable dictionary order.
        self._word_list: list[str] = list(dict.fromkeys(word.lower() for word in words))
        self.words: set[str] = set(self._word_list)

    def _create_scanner(self) -> Scanner | None:
        """Build the obfuscation-aware scanner.

        It needs word boundaries; fuzzy matching (word_boundaries off) and
        `obfuscation: "off"` without safe words keep the legacy scan.
        """
        obfuscation = resolve_obfuscation(self.obfuscation_option)
        if not self.word_boundaries:
            return None
        if not obfuscation.any_enabled and not self.whitelist_words:
            return None
        return Scanner(
            ScannerConfig(
                words=self._word_list,
                ignore_words=self.ignore_words,
                matcher=self._matcher,
                view=ViewConfig(
                    detect_leetspeak=self.detect_leetspeak,
                    leetspeak_level=self.leetspeak_level,
                    normalize_unicode=self.normalize_unicode_enabled,
                    allow_obfuscated_match=self.allow_obfuscated_match,
                    obfuscation=obfuscation,
                ),
                normalize_text=self._normalize_text,
                whitelist=self.whitelist_words,
                case_sensitive=self.case_sensitive,
            )
        )

    def _debug_log(self, *args: object) -> None:
        """Log debug information if logging is enabled."""
        if self.log_profanity:
            print("[glin-profanity]", *args)  # noqa: T201

    def _normalize_text(self, text: str, aggressive: bool = False) -> str:
        """
        Normalize text with every enabled method (Unicode, leetspeak, legacy).

        Args:
            text: The input text to normalize
            aggressive: Collapse repeated characters to one

        Returns:
            The normalized text
        """
        return normalize_for_matching(
            text,
            aggressive,
            NormalizeConfig(
                normalize_unicode=self.normalize_unicode_enabled,
                detect_leetspeak=self.detect_leetspeak,
                leetspeak_level=self.leetspeak_level,
                allow_obfuscated_match=self.allow_obfuscated_match,
            ),
        )

    def _legacy_safe(self, text: str) -> tuple[list[Interval], str]:
        """Safe spans of the text on the legacy path, and the text with them blanked."""
        if self._legacy_whitelist is None:
            return [], text
        spans = self._legacy_whitelist.protected_spans(text)
        return spans, blank_protected(text, spans) if spans else text

    def _legacy_context(self) -> LegacyScanContext:
        return LegacyScanContext(
            self._word_list, self.ignore_words, self._matcher, self._normalize_text
        )

    def clear_cache(self) -> None:
        """Clear the result cache."""
        self._cache.clear()
        self._matcher.clear()

    def get_cache_size(self) -> int:
        """Get the current cache size."""
        return len(self._cache)

    def get_config(self) -> FilterConfig:
        """
        Export the current filter configuration as a dictionary.

        Useful for saving configuration to files or sharing between environments.

        Returns:
            The current filter configuration

        Examples:
            >>> filter = Filter({
            ...     "languages": ["english", "spanish"],
            ...     "detect_leetspeak": True,
            ...     "leetspeak_level": "aggressive",
            ... })
            >>> config = filter.get_config()
            >>> # Save to file: json.dump(config, open('filter.config.json', 'w'))
            >>> # Later: new_filter = Filter(json.load(open('filter.config.json')))
        """
        config: FilterConfig = {
            "case_sensitive": self.case_sensitive,
            "word_boundaries": self.word_boundaries,
            "replace_with": self.replace_with,
            "severity_levels": self.severity_levels,
            "ignore_words": list(self.ignore_words),
            "log_profanity": self.log_profanity,
            "allow_obfuscated_match": self.allow_obfuscated_match,
            "fuzzy_tolerance_level": self.fuzzy_tolerance_level,
            "enable_context_aware": self.enable_context_aware,
            "context_window": self.context_window,
            "confidence_threshold": self.confidence_threshold,
            "detect_leetspeak": self.detect_leetspeak,
            "leetspeak_level": self.leetspeak_level,
            "normalize_unicode": self.normalize_unicode_enabled,
            "cache_results": self.cache_results,
            "max_cache_size": self.max_cache_size,
            "whitelist": self.whitelist_words,
            "languages": list(self._languages),
            "all_languages": self._all_languages,
            "custom_words": list(self._custom_words),
        }
        if self._domain_whitelists is not None:
            config["domain_whitelists"] = self._domain_whitelists
        if self.obfuscation_option is not None:
            config["obfuscation"] = self.obfuscation_option
        return config

    def get_word_count(self) -> int:
        """
        Return the current word dictionary size.

        Useful for monitoring and debugging.

        Returns:
            Number of words in the dictionary
        """
        return len(self.words)

    def _cache_key(self, text: str) -> tuple[object, ...]:
        # Settings callers can change after construction must not serve stale results.
        return (text, self.replace_with, frozenset(self.ignore_words))

    def _add_to_cache(self, key: tuple[object, ...], result: CheckProfanityResult) -> None:
        """Add a result to the cache, evicting oldest entries if necessary."""
        if not self.cache_results:
            return

        # Simple eviction: remove oldest entry when at capacity
        if len(self._cache) >= self.max_cache_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]

        self._cache[key] = result

    def _get_from_cache(self, key: tuple[object, ...]) -> CheckProfanityResult | None:
        """Get a cached result if available."""
        if not self.cache_results:
            return None
        return self._cache.get(key)

    def _redact(
        self,
        text: str,
        profane_words: list[str],
        hits: list[ScanHit] | None = None,
        safe_spans: list[Interval] | None = None,
    ) -> str:
        """Mask by scan hit offsets so whitelisted spans stay intact.

        Without hits (legacy scan, fuzzy matching) every occurrence of each word
        is masked.
        """
        if not self.replace_with:
            return text
        if hits is not None:
            return replace_spans(
                text, [(h.start, h.end) for h in hits], self.replace_with
            )
        if not profane_words:
            return text
        # Safe spans of the legacy path are left out of the word replacement.
        out: list[str] = []
        cursor = 0
        for start, end in safe_spans or []:
            out.append(
                self._replace_words(
                    text[cursor:start], profane_words, self.replace_with
                )
            )
            out.append(text[start:end])
            cursor = end
        out.append(self._replace_words(text[cursor:], profane_words, self.replace_with))
        return "".join(out)

    def _replace_words(
        self, text: str, profane_words: list[str], replace_with: str
    ) -> str:
        return replace_words(text, profane_words, replace_with, self.word_boundaries)

    def is_profane(self, value: str) -> bool:
        """
        Check if text contains profanity.

        Args:
            value: Text to check

        Returns:
            True if profanity is detected, False otherwise

        Examples:
            >>> filter = Filter({"detect_leetspeak": True})
            >>> filter.is_profane("hello")
            False
            >>> filter.is_profane("@ss")
            True
            >>> filter.is_profane("f u c k")
            True
        """
        if self._scanner is not None:
            return self._scanner.is_profane(value)
        return legacy_is_profane(self._legacy_context(), self._legacy_safe(value)[1])

    def matches(self, word: str) -> bool:
        """
        Check if a single word matches profanity patterns.

        Args:
            word: Word to check

        Returns:
            True if word matches profanity, False otherwise
        """
        return self.is_profane(word)

    def check_profanity(self, text: str) -> CheckProfanityResult:
        """
        Comprehensive profanity check with detailed results.

        Args:
            text: Text to analyze

        Returns:
            Detailed results of profanity analysis

        Examples:
            >>> filter = Filter({"detect_leetspeak": True, "severity_levels": True})
            >>> result = filter.check_profanity("this is @ss")
            >>> result["contains_profanity"]
            True
        """
        cache_key = self._cache_key(text)
        cached_result = self._get_from_cache(cache_key)
        if cached_result is not None:
            self._debug_log("Cache hit for:", text[:50])
            return cached_result

        hits: list[ScanHit] | None = None
        safe_spans, safe_text = self._legacy_safe(text)
        profane_words: list[str] = []
        severity_map: dict[str, SeverityLevel] = {}
        matches: list[Match] = []

        if self._scanner is not None:
            hits = self._scanner.scan(text)
            if self.enable_context_aware:
                # Same views as the plain path; one hit per word and span.
                hits = _unique_spans(hits)
            for hit in hits:
                # Original view: matched text; derived views: dictionary word.
                key = hit.text if hit.view == "orig" else hit.word
                first = self.enable_context_aware or hit.view == "orig"
                if first or key not in profane_words:
                    profane_words.append(key)
                    severity_map.setdefault(key, hit.severity)
                    matches.append(
                        {"word": key, "index": hit.start, "severity": hit.severity}
                    )
        elif self.enable_context_aware:
            for ctx_hit in legacy_context_hits(self._legacy_context(), safe_text):
                matches.append(
                    {
                        "word": ctx_hit.word,
                        "index": ctx_hit.index,
                        "severity": ctx_hit.severity,
                    }
                )
                profane_words.append(ctx_hit.word)
                severity_map.setdefault(ctx_hit.word, ctx_hit.severity)
        else:
            legacy = legacy_scan(self._legacy_context(), safe_text)
            profane_words = legacy.profane_words
            severity_map = legacy.severity_map
            matches = [
                {"word": w, "severity": severity_map[w]}
                for w in dict.fromkeys(profane_words)
            ]

        if profane_words:
            self._debug_log("Detected:", profane_words)

        unique_words = list(dict.fromkeys(profane_words))
        result: CheckProfanityResult = {
            "contains_profanity": len(profane_words) > 0,
            "profane_words": unique_words,
        }
        if self.replace_with:
            result["processed_text"] = self._redact(
                text, profane_words, hits, safe_spans
            )
        if self.severity_levels and severity_map:
            result["severity_map"] = severity_map
        if matches:
            result["matches"] = matches
        result["reason"] = (
            f"Found {len(matches)} potential profanity matches"
            if matches
            else "No profanity detected"
        )

        self._add_to_cache(cache_key, result)
        return result

    def check_profanity_with_min_severity(
        self, text: str, min_severity: SeverityLevel = SeverityLevel.EXACT
    ) -> dict[str, object]:
        """
        Check profanity with minimum severity filtering.

        Args:
            text: Text to analyze
            min_severity: Minimum severity level to include

        Returns:
            Dictionary with filtered words and full result
        """
        result = self.check_profanity(text)

        filtered_words = []
        severity_map = result.get("severity_map")
        profane_words = result.get("profane_words")
        if severity_map and profane_words:
            filtered_words = [
                word
                for word in profane_words
                if severity_map.get(word, 0) >= min_severity
            ]

        return {
            "filtered_words": filtered_words,
            "result": result,
        }
