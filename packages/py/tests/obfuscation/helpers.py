"""Shared helpers for the obfuscation tests."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from glin_profanity import Filter
from glin_profanity.data.dictionary import dictionary
from glin_profanity.filters.pipeline.dictionary_index import DictionaryIndex


def make_filter(**overrides: Any) -> Filter:
    """Same settings the shootout harness uses for glin-profanity."""
    config: dict[str, Any] = {
        "languages": ["english"],
        "detect_leetspeak": True,
        "leetspeak_level": "aggressive",
        "normalize_unicode": True,
        **overrides,
    }
    return Filter(config)  # type: ignore[arg-type]


def english_index() -> DictionaryIndex:
    return DictionaryIndex(dictionary.get_words("english"), True, "aggressive")


def lcg(seed: int) -> Callable[[], float]:
    """Deterministic pseudo-random generator so fuzz tests are reproducible."""
    state = seed & 0xFFFFFFFF

    def nxt() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 0x100000000

    return nxt
