"""Text replacement helpers for masked output."""

from __future__ import annotations

import re


def replace_words(
    text: str, words: list[str], replace_with: str, word_boundaries: bool
) -> str:
    """Replace every occurrence of the words; whole words with boundaries on."""
    processed = text
    for word in dict.fromkeys(words):
        escaped = re.escape(word)
        pattern = rf"\b{escaped}\b" if word_boundaries else escaped
        processed = re.sub(
            pattern, lambda _: replace_with, processed, flags=re.IGNORECASE
        )
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
