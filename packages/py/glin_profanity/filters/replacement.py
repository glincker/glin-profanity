"""Text replacement helpers for masked output."""

from __future__ import annotations

import re

from .word_matcher import word_pattern


def replace_words(
    text: str, words: list[str], replace_with: str, word_boundaries: bool
) -> str:
    """Replace every occurrence of the words; whole words with boundaries on."""
    processed = text
    for word in dict.fromkeys(words):
        regex = re.compile(
            word_pattern(word) if word_boundaries else f"(?ai:{re.escape(word)})"
        )
        lowered = processed.lower()
        # Search the lowercased copy when offsets line up, so non-ASCII capitals match too.
        haystack = lowered if len(lowered) == len(processed) else processed
        out: list[str] = []
        cursor = 0
        for m in regex.finditer(haystack):
            if m.end() > m.start():
                out.append(processed[cursor : m.start()])
                out.append(replace_with)
                cursor = m.end()
        out.append(processed[cursor:])
        processed = "".join(out)
    return processed


def replace_spans(text: str, spans: list[tuple[int, int]], replace_with: str) -> str:
    """Replace [start, end) spans of the text; overlapping spans are merged."""
    if not spans:
        return text
    merged: list[list[int]] = []
    for start, end in sorted(spans):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    out: list[str] = []
    cursor = 0
    for start, end in merged:
        out.append(text[cursor:start])
        out.append(replace_with)
        cursor = end
    out.append(text[cursor:])
    return "".join(out)
