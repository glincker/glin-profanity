"""Plain scans used when the obfuscation pipeline is off or fuzzy matching is on."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from glin_profanity.types.types import SeverityLevel

from .word_matcher import WordMatcher


@dataclass
class LegacyScanContext:
    """Inputs the legacy scanners need from the owning Filter."""

    words: list[str]
    ignore_words: set[str]
    matcher: WordMatcher
    normalize_text: Callable[[str, bool], str]


@dataclass
class LegacyScanResult:
    profane_words: list[str]
    severity_map: dict[str, SeverityLevel]


@dataclass
class LegacyContextHit:
    word: str
    index: int
    severity: SeverityLevel


def legacy_is_profane(ctx: LegacyScanContext, value: str) -> bool:
    """Boolean check across the original, normalized and aggressive views."""
    normalized = ctx.normalize_text(value, False)
    aggressive = ctx.normalize_text(value, True)
    for word in ctx.words:
        if word.lower() in ctx.ignore_words:
            continue
        for view in (value, normalized, aggressive):
            if ctx.matcher.evaluate_severity(word, view) is not None:
                return True
    return False


def legacy_scan(ctx: LegacyScanContext, text: str) -> LegacyScanResult:
    """Full scan over the original, normalized and aggressive views."""
    original = text.lower()
    normalized = ctx.normalize_text(text, False).lower()
    aggressive = ctx.normalize_text(text, True).lower()

    profane: list[str] = []
    severity_map: dict[str, SeverityLevel] = {}

    def record(word: str, severity: SeverityLevel) -> None:
        severity_map.setdefault(word, severity)

    for dict_word in ctx.words:
        if dict_word.lower() in ctx.ignore_words:
            continue
        severity = ctx.matcher.evaluate_severity(dict_word, original)
        if severity is not None:
            for match in ctx.matcher.get_regex(dict_word).finditer(original):
                profane.append(match.group(0))
                record(match.group(0), severity)

        severity = ctx.matcher.evaluate_severity(dict_word, normalized)
        if severity is not None and ctx.matcher.get_regex(dict_word).search(normalized):
            if dict_word not in profane:
                profane.append(dict_word)
                record(dict_word, severity)

        severity = ctx.matcher.evaluate_severity(dict_word, aggressive)
        if severity is not None and dict_word not in profane:
            profane.append(dict_word)
            record(dict_word, severity)
    return LegacyScanResult(profane, severity_map)


def legacy_context_hits(ctx: LegacyScanContext, text: str) -> list[LegacyContextHit]:
    """Occurrence list for the context-aware path.

    It covers the same views as `legacy_scan` (original, normalized, aggressive),
    so it never finds less.
    """
    views = [
        text.lower(),
        ctx.normalize_text(text, False).lower(),
        ctx.normalize_text(text, True).lower(),
    ]
    hits: list[LegacyContextHit] = []
    for dict_word in ctx.words:
        if dict_word.lower() in ctx.ignore_words:
            continue
        found = False
        for number, view in enumerate(views):
            severity = ctx.matcher.evaluate_severity(dict_word, view)
            if severity is None:
                continue
            for match in ctx.matcher.get_regex(dict_word).finditer(view):
                hits.append(LegacyContextHit(match.group(0), match.start(), severity))
                found = True
            # Fuzzy matches have no regex occurrence; the aggressive view reports them.
            if not found and number == len(views) - 1:
                hits.append(LegacyContextHit(dict_word, 0, severity))
            if found:
                break
    return hits
