"""Resolves masked words (f*ck, sh#t, b*****d, @sshole) to dictionary words."""

from __future__ import annotations

import re

from .dictionary_index import DictionaryIndex
from .mapped import Edit, MappedText, Transformer, apply_edits

# Characters that read as sentence punctuation when they sit at a token edge.
_EDGE_PUNCTUATION = frozenset("?!")
_OPENER_WINDOW = 200
# Markdown emphasis markers wrap a word rather than hide a letter of it.
_EMPHASIS_CHARS = frozenset("*_")


def _split_emphasis(raw: str) -> tuple[str, str, str]:
    """Leading markers, inner text and trailing markers, found in one pass."""
    lead = 0
    while lead < len(raw) and raw[lead] in _EMPHASIS_CHARS:
        lead += 1
    if lead == len(raw):
        return raw, "", ""
    end = len(raw)
    while end > lead and raw[end - 1] in _EMPHASIS_CHARS:
        end -= 1
    return raw[:lead], raw[lead:end], raw[end:]


def _is_emphasis(raw: str, text: str, token_start: int, masks: frozenset[str]) -> bool:
    """True for `**bold**`, `__init__` and a closing `bold**` with an earlier opener."""
    lead, inner, trail = _split_emphasis(raw)
    if any(c in masks for c in inner):
        return False
    if lead and trail:
        return True
    if not trail:
        return False
    # Look back a bounded window so long single-line inputs stay linear.
    window = text[max(0, token_start - _OPENER_WINDOW) : token_start]
    before = window[window.rfind("\n") + 1 :]
    return re.search(rf"(?:^|\s){re.escape(trail)}\S", before) is not None


def masking_transformer(
    index: DictionaryIndex, chars: str, min_visible: int
) -> Transformer:
    """Tokens that match no dictionary word (p@ssword, ****) are left untouched."""
    masks = frozenset(chars)
    mask_class = re.escape(chars)
    quick = re.compile(f"[{mask_class}]")
    token = re.compile(rf"(?:[^\W_]|[{mask_class}])+")

    def run(inp: MappedText) -> MappedText:
        if not quick.search(inp.text):
            return inp
        edits: list[Edit] = []
        resolved: dict[str, str | None] = {}
        for match in token.finditer(inp.text):
            raw = match.group(0)
            if _is_emphasis(raw, inp.text, match.start(), masks):
                continue
            lo = 0
            hi = len(raw)
            while lo < hi and raw[lo] in _EDGE_PUNCTUATION:
                lo += 1
            while hi > lo and raw[hi - 1] in _EDGE_PUNCTUATION:
                hi -= 1
            core = raw[lo:hi]
            if len(core) < 3:
                continue
            if core not in resolved:
                resolved[core] = index.resolve_masked(core, masks, min_visible)
            word = resolved[core]
            if word and len(word) == len(core):
                edits.append(Edit(match.start() + lo, match.start() + hi, word))
        return apply_edits(inp, edits)

    return run
