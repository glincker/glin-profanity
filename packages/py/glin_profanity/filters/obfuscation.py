"""Resolves the public `obfuscation` option into concrete switches."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

from glin_profanity.types.types import ObfuscationLevel, ObfuscationOptions

DEFAULT_LEVEL: ObfuscationLevel = "standard"
DEFAULT_SEPARATORS = ".,/|_-"
DEFAULT_MASKS = "*#@$%_?!"
_INT_PREFIX = re.compile(r"\s*[+-]?\d+")


@dataclass(frozen=True)
class ResolvedObfuscation:
    """Concrete switches for the obfuscation pipeline."""

    html_enabled: bool
    html_decode_depth: int
    separators_enabled: bool
    separator_chars: str
    separator_allow_space: bool
    separator_min_two_piece: int
    masking_enabled: bool
    mask_chars: str
    mask_min_visible: int
    stretch: bool
    ambiguous_leet: bool
    builtin_whitelist: bool

    @property
    def any_enabled(self) -> bool:
        return (
            self.html_enabled
            or self.separators_enabled
            or self.masking_enabled
            or self.stretch
            or self.ambiguous_leet
            or self.builtin_whitelist
        )


def _env_int(name: str, fallback: int) -> int:
    """Integer override from the environment (parseInt style), else the fallback."""
    raw = os.environ.get(name)
    if raw is None:
        return fallback
    found = _INT_PREFIX.match(raw)
    if found is None:
        return fallback
    value = int(found.group(0))
    return value if value >= 0 else fallback


def _flag(value: object, by_level: bool) -> bool:
    return by_level if value is None else value is not False


def _section(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def resolve_obfuscation(
    option: ObfuscationLevel | ObfuscationOptions | None,
) -> ResolvedObfuscation:
    """Turn the `obfuscation` option (level string or dict) into concrete switches."""
    opts: dict[str, Any] = (
        {"level": option} if isinstance(option, str) else dict(option or {})
    )
    level = opts.get("level") or DEFAULT_LEVEL
    on = level != "off"
    mid = level in ("standard", "strict")
    strict = level == "strict"

    html = _section(opts.get("html"))
    sep = _section(opts.get("separators"))
    mask = _section(opts.get("masking"))

    def pick(section: dict[str, Any], key: str, fallback: Any) -> Any:
        value = section.get(key)
        return fallback if value is None else value

    def flag_option(key: str, default: bool) -> bool:
        value = opts.get(key)
        return default if value is None else bool(value)

    return ResolvedObfuscation(
        html_enabled=_flag(opts.get("html"), on),
        html_decode_depth=pick(
            html, "decode_depth", _env_int("GLIN_HTML_DECODE_DEPTH", 2)
        ),
        separators_enabled=_flag(opts.get("separators"), mid),
        separator_chars=pick(sep, "chars", DEFAULT_SEPARATORS),
        separator_allow_space=pick(sep, "allow_space", strict),
        separator_min_two_piece=pick(
            sep,
            "min_two_piece_length",
            _env_int("GLIN_SEPARATOR_MIN_JOIN", 3 if strict else 4),
        ),
        masking_enabled=_flag(opts.get("masking"), mid),
        mask_chars=pick(mask, "chars", DEFAULT_MASKS),
        mask_min_visible=pick(
            mask, "min_visible", _env_int("GLIN_MASK_MIN_VISIBLE", 1)
        ),
        stretch=flag_option("stretch", on),
        ambiguous_leet=flag_option("ambiguous_leet", mid),
        builtin_whitelist=flag_option("builtin_whitelist", on),
    )
