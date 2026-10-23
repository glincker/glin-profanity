"""Per-word regex matching with a compiled-regex cache."""

from __future__ import annotations

import re

from glin_profanity.types.types import SeverityLevel


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
        flags = 0 if self.case_sensitive else re.IGNORECASE
        escaped = re.escape(word)
        pattern = rf"\b{escaped}\b" if self.word_boundaries else escaped
        regex = re.compile(pattern, flags)
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
        if self.get_regex(word).search(text):
            return SeverityLevel.EXACT
        # Fuzzy matching only without word boundaries, so "scunthorpe" stays clean.
        if not self.word_boundaries and self.is_fuzzy_tolerance_match(word, text):
            return SeverityLevel.FUZZY
        return None
