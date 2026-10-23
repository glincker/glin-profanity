"""Offset-tracking twins of the plain Unicode and leetspeak normalizers."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable

from glin_profanity.utils.leetspeak import (
    SPACED_CHARS_PATTERN,
    LeetspeakLevel,
    get_leetspeak_tables,
)
from glin_profanity.utils.unicode import HOMOGLYPHS, ZERO_WIDTH_CHARS

from .mapped import (
    Edit,
    MappedText,
    Transformer,
    apply_edits,
    map_chars,
    replace_regex,
)

_ZERO_WIDTH = re.compile("[" + "".join(re.escape(c) for c in ZERO_WIDTH_CHARS) + "]")
_FULL_WIDTH = re.compile("[！-～]")
_NON_ASCII = re.compile(r"[^\x00-\x7f]")
_MARKS = re.compile("[̀-ͯ]")
_WHITESPACE = re.compile(r"\s+")
_LEGACY_REPEAT = re.compile(r"([a-zA-Z])\1{1,}")
_LEGACY_SYMBOLS = re.compile(r"[@$!1*]")
_LEGACY_MAP = {"@": "a", "$": "s", "!": "i", "1": "i"}


def _strip_marks(value: str) -> str:
    return _MARKS.sub("", unicodedata.normalize("NFKD", value))


def _decompose_and_strip(m: MappedText) -> MappedText:
    target = _strip_marks(m.text)
    if target == m.text:
        return m
    # Per code point keeps spans precise; fall back to one coarse edit if the
    # whole-string form differs (canonical reordering of other marks).
    edits: list[Edit] = []
    joined: list[str] = []
    for i, ch in enumerate(m.text):
        nxt = ch if ord(ch) < 0x80 else _strip_marks(ch)
        if nxt != ch:
            edits.append(Edit(i, i + 1, nxt))
        joined.append(nxt)
    if "".join(joined) == target:
        return apply_edits(m, edits)
    return apply_edits(m, [Edit(0, len(m.text), target)])


def unicode_transformer(inp: MappedText) -> MappedText:
    """Offset-tracking twin of `normalize_unicode`."""
    if not _NON_ASCII.search(inp.text):
        return inp
    m = replace_regex(inp, _ZERO_WIDTH, lambda _: "")
    m = replace_regex(m, _FULL_WIDTH, lambda match: chr(ord(match.group(0)) - 0xFEE0))
    m = map_chars(m, HOMOGLYPHS)
    return _decompose_and_strip(m)


def _constant(value: str) -> Callable[[re.Match[str]], str]:
    return lambda _: value


def leet_transformer(
    level: LeetspeakLevel, max_repeated: int, ambiguous_as_l: bool = False
) -> Transformer:
    """Offset-tracking twin of `normalize_leetspeak` (collapse, spaced removal)."""
    multi, single = get_leetspeak_tables(level, ambiguous_as_l)
    repeated = re.compile(rf"(.)\1{{{max_repeated},}}", re.IGNORECASE)

    def run(inp: MappedText) -> MappedText:
        m = replace_regex(
            inp, SPACED_CHARS_PATTERN, lambda x: _WHITESPACE.sub("", x.group(0))
        )
        for pattern, replacement in multi:
            m = replace_regex(m, pattern, _constant(replacement))
        m = map_chars(m, single)
        return replace_regex(m, repeated, lambda x: x.group(1) * max_repeated)

    return run


def legacy_obfuscation_transformer(inp: MappedText) -> MappedText:
    """Offset-tracking twin of the legacy allow_obfuscated_match normalization."""
    m = replace_regex(inp, _LEGACY_REPEAT, lambda x: x.group(1) + x.group(1))
    # "*" stays as it is, matching the JS package.
    return replace_regex(
        m, _LEGACY_SYMBOLS, lambda x: _LEGACY_MAP.get(x.group(0), x.group(0))
    )
