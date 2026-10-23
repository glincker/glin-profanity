"""Dictionary scan over the original text and its normalized and enhanced views."""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from glin_profanity.types.types import SeverityLevel

from .pipeline.dictionary_index import DictionaryIndex
from .pipeline.mapped import MappedText, to_original_span
from .pipeline.views import LegacyViews, ViewConfig, ViewFactory
from .whitelist import Interval, Whitelist, within
from .word_matcher import WordMatcher, is_token_word, word_pattern

ViewKind = Literal["orig", "norm", "aggr", "enhanced"]

_ASCII_TOKEN = re.compile(r"[A-Za-z0-9_]+")
_UNICODE_TOKEN = re.compile(r"\w+")


@dataclass
class ScanHit:
    """One dictionary hit, with its span in the original input."""

    word: str
    # Text matched in the view (lowercase).
    text: str
    view: ViewKind
    start: int
    end: int
    severity: SeverityLevel


@dataclass
class ScannerConfig:
    """Everything the scanner needs from the owning Filter."""

    words: list[str]
    ignore_words: set[str]
    matcher: WordMatcher
    view: ViewConfig
    # Plain string normalization, used for the cheap prefilter.
    normalize_text: Callable[[str, bool], str]
    whitelist: list[str]
    case_sensitive: bool


@dataclass
class _LiveView:
    kind: ViewKind
    view: MappedText
    lower: str
    present: set[str]


class Scanner:
    """A combined candidate test answers "anything here?" in one pass.

    Clean text never pays for the per-word loop. Single-token words are looked up
    in a set of the text's tokens, as Python's `re` has no fast many-word alternation.
    """

    def __init__(self, cfg: ScannerConfig) -> None:
        self._cfg = cfg
        self.active_words = [w for w in cfg.words if w.lower() not in cfg.ignore_words]
        self.index = DictionaryIndex(
            self.active_words, cfg.view.detect_leetspeak, cfg.view.leetspeak_level
        )
        self._views = ViewFactory(cfg.view, self.index)
        self._whitelist = Whitelist(
            cfg.whitelist, cfg.view.obfuscation.builtin_whitelist
        )
        # Words made only of ASCII word characters, or only of native-script letters,
        # are found by token lookup; the rest (f*ck, g\u00f6t, "son of") use one regex.
        self._ascii_words = {w for w in self.active_words if _ASCII_TOKEN.fullmatch(w)}
        self._native_words = {
            w
            for w in self.active_words
            if w.isalnum() and not any(c.isascii() for c in w) and is_token_word(w)
        }
        self._pure = self._ascii_words | self._native_words
        self._rest = [w for w in self.active_words if w not in self._pure]
        self._rest_set = set(self._rest)
        self._rest_any = (
            re.compile(
                "|".join(word_pattern(w, not cfg.case_sensitive) for w in self._rest)
            )
            if self._rest
            else None
        )

    def _tokens_present(self, lowered: str) -> set[str]:
        """Dictionary words that occur as whole tokens in the (lowercased) text."""
        found = set(_ASCII_TOKEN.findall(lowered)) & self._ascii_words
        if self._native_words:
            found |= set(_UNICODE_TOKEN.findall(lowered)) & self._native_words
        return found

    def _has_candidate(self, text: str) -> bool:
        if not self.active_words:
            return False
        hay = text if self._cfg.case_sensitive else text.lower()
        if self._pure and self._tokens_present(hay):
            return True
        return self._rest_any is not None and self._rest_any.search(hay) is not None

    def is_profane(self, text: str) -> bool:
        """Clean text exits after one candidate test per view.

        Text with a hit also exits early unless a safe word could overlap it.
        """
        norm = self._cfg.normalize_text(text, False)
        aggr = self._cfg.normalize_text(text, True)
        enhanced = self._views.enhanced_views(text)
        texts = [text, norm, aggr, *(v.text for v in enhanced)]
        if not any(self._has_candidate(t) for t in texts):
            return False
        if not self._whitelist.might_match(texts):
            return True
        return len(self.scan(text)) > 0

    def scan(self, text: str) -> list[ScanHit]:
        """Hits in dictionary order, views in order orig, norm, aggr, enhanced.

        Every path (plain and context-aware) scans the same views.
        """
        enhanced = self._views.enhanced_views(text)
        quick = [
            text.lower(),
            self._cfg.normalize_text(text, False).lower(),
            self._cfg.normalize_text(text, True).lower(),
        ]
        if not any(self._has_candidate(t) for t in quick) and not any(
            self._has_candidate(v.text.lower()) for v in enhanced
        ):
            return []
        legacy = self._views.legacy_views(text)

        candidates: list[tuple[ViewKind, MappedText]] = [
            ("orig", legacy.orig),
            ("norm", legacy.norm),
            ("aggr", legacy.aggr),
        ]
        candidates.extend(("enhanced", view) for view in enhanced)

        live: list[_LiveView] = []
        for kind, view in candidates:
            lowered = view.text.lower()
            lower = lowered if len(lowered) == len(view.text) else view.text
            if self._has_candidate(lower):
                present = self._tokens_present(lower)
                live.append(_LiveView(kind, view, lower, present))

        wanted: set[str] = set(self._rest)
        for item in live:
            wanted |= item.present

        hits: list[ScanHit] = []
        seen: set[tuple[str, int, int]] = set()
        for word in self.active_words:
            if word not in wanted:
                continue
            regex = self._cfg.matcher.get_regex(word)
            is_rest = word in self._rest_set
            for item in live:
                if not is_rest and word not in item.present:
                    continue
                for match in regex.finditer(item.lower):
                    if match.end() == match.start():
                        continue
                    start, end = to_original_span(item.view, match.start(), match.end())
                    key = (word, start, end)
                    if item.kind == "enhanced" and key in seen:
                        continue
                    seen.add(key)
                    hits.append(
                        ScanHit(
                            word,
                            match.group(0),
                            item.kind,
                            start,
                            end,
                            SeverityLevel.EXACT,
                        )
                    )
        return self._drop_whitelisted(hits, legacy, enhanced)

    def _drop_whitelisted(
        self,
        hits: list[ScanHit],
        legacy: LegacyViews,
        enhanced: list[MappedText],
    ) -> list[ScanHit]:
        if not hits or self._whitelist.is_empty:
            return hits
        sources = [legacy.orig, legacy.norm, legacy.aggr, *enhanced]
        safe: list[Interval] = []
        for view in sources:
            safe.extend(self._whitelist.intervals(view))
        if not safe:
            return hits
        return [
            h
            for h in hits
            if not any(within((h.start, h.end), span) for span in safe)
        ]
