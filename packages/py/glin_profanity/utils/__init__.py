"""
Utility functions for glin-profanity.

This module provides utilities for text normalization including
leetspeak detection and Unicode normalization.
"""

from .leetspeak import (
    LeetspeakLevel,
    collapse_repeated_characters,
    collapse_spaced_characters,
    contains_leetspeak,
    generate_leetspeak_variants,
    normalize_leetspeak,
)
from .unicode import (
    CharacterSetsResult,
    contains_unicode_obfuscation,
    convert_full_width,
    convert_homoglyphs,
    detect_character_sets,
    normalize_nfkd,
    normalize_unicode,
    remove_zero_width_characters,
)

__all__ = [
    # Leetspeak utilities
    "LeetspeakLevel",
    "normalize_leetspeak",
    "collapse_spaced_characters",
    "collapse_repeated_characters",
    "contains_leetspeak",
    "generate_leetspeak_variants",
    # Unicode utilities
    "CharacterSetsResult",
    "normalize_unicode",
    "remove_zero_width_characters",
    "convert_full_width",
    "convert_homoglyphs",
    "normalize_nfkd",
    "contains_unicode_obfuscation",
    "detect_character_sets",
]
