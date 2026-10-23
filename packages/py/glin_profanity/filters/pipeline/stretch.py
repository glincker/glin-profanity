"""Collapses stretched words (aaaasshole, assholeeee) to their dictionary word."""

from __future__ import annotations

import re

from .dictionary_index import DictionaryIndex
from .mapped import Edit, MappedText, Transformer, apply_edits

_TOKEN = re.compile(r"[^\W_]+")
_HAS_REPEAT = re.compile(r"(.)\1")


def stretch_transformer(index: DictionaryIndex) -> Transformer:
    """Run on already leet-normalized text."""

    def run(inp: MappedText) -> MappedText:
        if not _HAS_REPEAT.search(inp.text):
            return inp
        edits: list[Edit] = []
        for match in _TOKEN.finditer(inp.text):
            if len(match.group(0)) < 4:
                continue
            word = index.resolve_stretched(match.group(0))
            if word:
                edits.append(Edit(match.start(), match.end(), word))
        return apply_edits(inp, edits)

    return run
