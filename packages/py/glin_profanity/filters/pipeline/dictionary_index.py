"""Hash-based lookups over the active dictionary."""

from __future__ import annotations

import re
from itertools import groupby

from glin_profanity.utils.leetspeak import LeetspeakLevel, normalize_leetspeak

_NEEDS_NORMALIZING = re.compile(r"[^a-z]|ph|vv|(.)\1\1")
_REPEAT = re.compile(r"(.)\1+")
_WHITESPACE = re.compile(r"\s")

_LEET_READINGS: dict[str, str] = {
    "0": "o", "1": "il", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
}  # fmt: skip


def squeeze(value: str) -> str:
    """Collapse every run of a repeated character to one (aasshhole -> ashole)."""
    return _REPEAT.sub(r"\1", value)


class DictionaryIndex:
    """Lets the transformers ask "could this fragment be a dictionary word?" cheaply."""

    def __init__(
        self, words: list[str], leetspeak: bool, leetspeak_level: LeetspeakLevel
    ) -> None:
        self._leetspeak = leetspeak
        self._level = leetspeak_level
        self._exact: dict[str, None] = {}
        self._normalized: set[str] = set()
        self._by_length: dict[int, list[str]] = {}
        self._squeezed: dict[str, list[str]] = {}
        self._stretch_patterns: dict[str, re.Pattern[str]] = {}
        longest = 0
        for raw in words:
            word = raw.lower()
            if _WHITESPACE.search(word):
                continue
            self._exact[word] = None
            longest = max(longest, len(word))
            norm = self._normalize(word)
            self._normalized.add(norm)
            # Letters only: a digit would be re-read as leetspeak after unmasking.
            if word.isalpha():
                self._by_length.setdefault(len(word), []).append(word)
            if norm.isalpha() and len(norm) >= 3:
                bucket = self._squeezed.setdefault(squeeze(norm), [])
                if norm not in bucket:
                    bucket.append(norm)
        self.max_word_length = longest
        self._rank_mask_candidates()

    def _rank_mask_candidates(self) -> None:
        """Prefer the root other entries build on (fuck over fvck, shit over scat)."""
        roots: dict[str, int] = {}
        for word in self._exact:
            for length in range(3, len(word)):
                prefix = word[:length]
                roots[prefix] = roots.get(prefix, 0) + 1
        for bucket in self._by_length.values():
            bucket.sort(key=lambda w: -roots.get(w, 0))

    def _normalize(self, value: str) -> str:
        if not self._leetspeak:
            return value
        return normalize_leetspeak(
            value, level=self._level, max_repeated=2, remove_spaced_chars=False
        ).lower()

    def is_word(self, fragment: str) -> bool:
        """True when the fragment is a dictionary word, also after leet decoding."""
        lower = fragment.lower()
        if lower in self._exact:
            return True
        # Plain letters without ph, vv or triple repeats normalize to themselves.
        if not _NEEDS_NORMALIZING.search(lower):
            return False
        return self._normalize(lower) in self._normalized

    def resolve_masked(
        self, token: str, masks: frozenset[str], min_visible: int
    ) -> str | None:
        """Resolve a token with mask characters (f*ck) to a same-length dictionary word.

        Each mask stands for exactly one letter.
        """
        chars = list(token.lower())
        length = len(chars)
        candidates = self._by_length.get(length)
        if not candidates:
            return None
        mask_count = sum(1 for c in chars if c in masks)
        visible = sum(1 for c in chars if c not in masks and c.isalpha())
        if mask_count == 0 or visible < min_visible:
            return None
        # A lone visible letter is only trusted as the first letter (f***).
        if visible == 1 and not (
            length >= 4 and chars[0] not in masks and chars[0].isalpha()
        ):
            return None
        if length <= 3 and visible < 2:
            return None
        for word in candidates:
            if all(
                c in masks or c == w or w in _LEET_READINGS.get(c, "")
                for c, w in zip(chars, word)
            ):
                return word
        return None

    def resolve_stretched(self, token: str) -> str | None:
        """Resolve a stretched token (aaaasshole) to its dictionary word.

        The token must contain the word's own letter runs, only longer, so "as"
        never becomes "ass" and legitimate double letters still match.
        """
        lower = token.lower()
        candidates = self._squeezed.get(squeeze(lower))
        if not candidates:
            return None
        for word in candidates:
            if len(lower) <= len(word):
                continue
            if self._stretch_pattern(word).fullmatch(lower):
                return word
        return None

    def _stretch_pattern(self, word: str) -> re.Pattern[str]:
        pattern = self._stretch_patterns.get(word)
        if pattern is None:
            parts: list[str] = []
            for char, run in groupby(word):
                count = len(list(run))
                ch = re.escape(char)
                parts.append(f"{ch}{{{count},}}" if count > 1 else f"{ch}+")
            pattern = re.compile("".join(parts))
            self._stretch_patterns[word] = pattern
        return pattern
