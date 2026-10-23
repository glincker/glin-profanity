"""Per-word regex matching with a compiled-regex cache."""

from __future__ import annotations

import re
import unicodedata

from glin_profanity.types.types import SeverityLevel

# `(?a:\b)` is the ASCII-only boundary the JS package uses.
_ASCII_BOUNDARY = r"(?a:\b)"

# Katakana: may touch hiragana or Han, but not more katakana ("グロ" vs "グローバル").
_KATAKANA = "\u30a1-\u30fa\u30fc-\u30ff\u31f0-\u31ff\uff66-\uff9f"
_HAN_RANGES = (
    (0x3005, 0x3005),
    (0x3100, 0x312F),
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xF900, 0xFAFF),
    (0x20000, 0x2FA1F),
)


def _is_native_letter(ch: str) -> bool:
    """Non-ASCII letter, digit or combining mark (Cyrillic, CJK, Thai, ...)."""
    return not ch.isascii() and (ch.isalnum() or unicodedata.category(ch)[0] == "M")


def _is_katakana(ch: str) -> bool:
    return re.match(f"[{_KATAKANA}]", ch) is not None


def _is_han(ch: str) -> bool:
    code = ord(ch)
    return any(lo <= code <= hi for lo, hi in _HAN_RANGES)


def edge_kind(ch: str, length: int) -> str:
    """Edge rule for a word's first or last character: ascii, native, free or kata."""
    if not _is_native_letter(ch):
        return "ascii"
    if _is_katakana(ch):
        return "kata"
    return "free" if length >= 2 and _is_han(ch) else "native"


def _edge(ch: str, length: int, head: bool) -> str:
    """Lookaround source for one end of a word, mirroring the JS wordEdges rules."""
    kind = edge_kind(ch, length)
    if kind == "ascii":
        return _ASCII_BOUNDARY
    if kind == "kata":
        return f"(?<![{_KATAKANA}])" if head else f"(?![{_KATAKANA}])"
    if kind == "free":
        return ""
    return r"(?<!\w)" if head else r"(?!\w)"


def is_token_word(word: str) -> bool:
    """True when both edges are plain native-script boundaries (token lookup works)."""
    return bool(word) and edge_kind(word[0], len(word)) == "native" == edge_kind(
        word[-1], len(word)
    )


def word_pattern(word: str, ignore_case: bool = True) -> str:
    """Regex source for a whole-word match, to be run on lowercased text.

    Boundaries are ASCII-only like the JS package, so "\u00e9asshole" is still caught.
    An edge that is a native-script letter gets a Unicode-aware rule instead, because an
    ASCII boundary can never fall next to such a letter. Han words of two or more
    characters may sit inside a longer run (no word spacing), katakana edges only
    refuse more katakana. Case folding is ASCII-only so Python's extra folds cannot
    create matches.
    """
    if not word:
        return ""
    head = _edge(word[0], len(word), True)
    tail = _edge(word[-1], len(word), False)
    body = f"(?ai:{re.escape(word)})" if ignore_case else re.escape(word)
    return f"{head}{body}{tail}"


class WordMatcher:
    """Shared by the legacy scanner and the obfuscation-aware scanner."""

    def __init__(
        self, case_sensitive: bool, word_boundaries: bool, fuzzy_tolerance_level: float
    ) -> None:
        self.case_sensitive = case_sensitive
        self.word_boundaries = word_boundaries
        self.fuzzy_tolerance_level = fuzzy_tolerance_level
        self._cache: dict[str, re.Pattern[str]] = {}

    def clear(self) -> None:
        self._cache.clear()

    def get_regex(self, word: str) -> re.Pattern[str]:
        cached = self._cache.get(word)
        if cached is not None:
            return cached
        ignore_case = not self.case_sensitive
        if self.word_boundaries:
            pattern = word_pattern(word, ignore_case)
        else:
            pattern = f"(?ai:{re.escape(word)})" if ignore_case else re.escape(word)
        regex = re.compile(pattern)
        self._cache[word] = regex
        return regex

    def is_fuzzy_tolerance_match(self, word: str, text: str) -> bool:
        simplified_text = re.sub(r"[^a-z]", "", text.lower())
        simplified_word = word.lower()
        match_count = 0
        index = 0
        for char in simplified_text:
            if index < len(simplified_word) and char == simplified_word[index]:
                match_count += 1
                index += 1
                if index == len(simplified_word):
                    break
        score = match_count / len(simplified_word) if simplified_word else 0.0
        return score >= self.fuzzy_tolerance_level

    def evaluate_severity(self, word: str, text: str) -> SeverityLevel | None:
        haystack = text if self.case_sensitive else text.lower()
        if self.get_regex(word).search(haystack):
            return SeverityLevel.EXACT
        # Fuzzy matching only without word boundaries, so "scunthorpe" stays clean.
        if not self.word_boundaries and self.is_fuzzy_tolerance_match(word, text):
            return SeverityLevel.FUZZY
        return None
