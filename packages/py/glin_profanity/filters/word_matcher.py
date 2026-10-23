"""Per-word regex matching with a compiled-regex cache."""

from __future__ import annotations

import re

from glin_profanity.types.types import SeverityLevel

# `(?a:\b)` is the ASCII-only boundary the JS package uses.
_ASCII_BOUNDARY = r"(?a:\b)"


def _is_native_letter(ch: str) -> bool:
    """Non-ASCII letter or digit (Cyrillic, CJK, Arabic, ...)."""
    return not ch.isascii() and ch.isalnum()


def word_pattern(word: str, ignore_case: bool = True) -> str:
    """Regex source for a whole-word match, to be run on lowercased text.

    Boundaries are ASCII-only like the JS package, so "\u00e9asshole" is still caught.
    A word that starts or ends with a native-script letter gets a Unicode-aware edge
    instead, because an ASCII boundary can never fall next to such a letter and JS
    therefore never matches native-script dictionary words. Case folding is
    ASCII-only so Python's extra folds ("\u0131" with "i") cannot create matches.
    """
    if not word:
        return ""
    head = r"(?<!\w)" if _is_native_letter(word[0]) else _ASCII_BOUNDARY
    tail = r"(?!\w)" if _is_native_letter(word[-1]) else _ASCII_BOUNDARY
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
