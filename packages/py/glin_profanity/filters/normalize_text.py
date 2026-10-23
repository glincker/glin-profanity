"""Plain-string normalization (offset-tracking twin: pipeline/normalizers)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from glin_profanity.utils.leetspeak import LeetspeakLevel, normalize_leetspeak
from glin_profanity.utils.unicode import normalize_unicode

_REPEATED_LETTERS = re.compile(r"([a-zA-Z])\1{1,}")
_LEGACY_SYMBOLS = re.compile(r"[@$!1*]")
_LEGACY_MAP = {"@": "a", "$": "s", "!": "i", "1": "i"}


@dataclass(frozen=True)
class NormalizeConfig:
    """Which normalization steps the filter runs."""

    normalize_unicode: bool
    detect_leetspeak: bool
    leetspeak_level: LeetspeakLevel
    allow_obfuscated_match: bool


def normalize_obfuscated(text: str) -> str:
    """Legacy allow_obfuscated_match normalization, kept for backward compatibility."""
    squeezed = _REPEATED_LETTERS.sub(lambda m: m.group(1) * 2, text)
    # "*" stays as it is, matching the JS package.
    return _LEGACY_SYMBOLS.sub(
        lambda m: _LEGACY_MAP.get(m.group(0), m.group(0)), squeezed
    )


def normalize_for_matching(text: str, aggressive: bool, config: NormalizeConfig) -> str:
    """Apply Unicode, leetspeak and legacy obfuscation steps.

    `aggressive` collapses every repeated character to one.
    """
    normalized = text
    if config.normalize_unicode:
        normalized = normalize_unicode(normalized)
    if config.detect_leetspeak:
        normalized = normalize_leetspeak(
            normalized,
            level=config.leetspeak_level,
            collapse_repeated=True,
            # Keep double letters like "ss" normally, collapse all when aggressive.
            max_repeated=1 if aggressive else 2,
            remove_spaced_chars=True,
        )
    if config.allow_obfuscated_match and not config.detect_leetspeak:
        normalized = normalize_obfuscated(normalized)
    return normalized
