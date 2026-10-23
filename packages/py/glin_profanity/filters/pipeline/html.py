"""HTML tag and entity transformer."""

from __future__ import annotations

import re

from .mapped import MappedText, Transformer, replace_regex

# Real tags and comments only, so "a < b" and "x <3" are left alone. Comments are
# length-capped so thousands of unclosed "<!--" cannot make the scan quadratic.
TAG_PATTERN = re.compile(
    r"<!--[\s\S]{0,2000}?-->|</?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?/?>"
)
ENTITY_PATTERN = re.compile(
    r"&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));"
)
BLOCK_TAG = re.compile(
    r"</?(?:p|div|li|ul|ol|tr|td|th|table|h[1-6]|section|article|blockquote|pre|hr)\b",
    re.IGNORECASE,
)

NAMED_ENTITIES: dict[str, str] = {
    "amp": "&", "lt": "<", "gt": ">", "quot": '"', "apos": "'",
    "nbsp": " ", "ensp": " ", "emsp": " ", "thinsp": " ",
    "shy": "", "zwnj": "", "zwj": "", "lrm": "", "rlm": "",
    "hellip": "...", "ndash": "-", "mdash": "-",
    "auml": "ä", "ouml": "ö", "uuml": "ü",
    "Auml": "Ä", "Ouml": "Ö", "Uuml": "Ü", "szlig": "ß",
    "eacute": "é", "egrave": "è", "ecirc": "ê",
    "aacute": "á", "agrave": "à", "acirc": "â",
    "iacute": "í", "oacute": "ó", "uacute": "ú",
    "ntilde": "ñ", "ccedil": "ç",
}  # fmt: skip

SOFT_HYPHEN = "­"


def _decode_code_point(code: int) -> str | None:
    if code < 1 or code > 0x10FFFF:
        return None
    if 0xD800 <= code <= 0xDFFF:
        return None
    ch = chr(code)
    return "" if ch == SOFT_HYPHEN else ch


def _decode_entity(match: re.Match[str]) -> str | None:
    if match.group(1) is not None:
        return _decode_code_point(int(match.group(1), 10))
    if match.group(2) is not None:
        return _decode_code_point(int(match.group(2), 16))
    return NAMED_ENTITIES.get(match.group(3))


def html_transformer(decode_depth: int) -> Transformer:
    """Remove tags and comments, then decode named, numeric and double-encoded entities.

    Inline tags join the text around them (`s<b>h</b>it`), block tags separate
    it, so `<p>as</p><p>s</p>` never forms a word.
    """

    def run(inp: MappedText) -> MappedText:
        text = inp.text
        if "<" not in text and "&" not in text:
            return inp
        m = replace_regex(
            inp,
            TAG_PATTERN,
            lambda match: " " if BLOCK_TAG.match(match.group(0)) else "",
        )
        for _ in range(decode_depth):
            if "&" not in m.text:
                break
            nxt = replace_regex(m, ENTITY_PATTERN, _decode_entity)
            if nxt is m:
                break
            m = nxt
        return m

    return run
