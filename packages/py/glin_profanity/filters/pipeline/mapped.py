"""Text plus an index map back to the original input.

Every transformer takes and returns a MappedText so a match found in the final
text can be reported against the user's string.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class MappedText:
    """Transformed text; `starts` and `ends` are None while it is still the identity."""

    text: str
    starts: list[int] | None = None
    ends: list[int] | None = None


Transformer = Callable[[MappedText], MappedText]


@dataclass
class Edit:
    """Replace text[start:end] with `replacement`."""

    start: int
    end: int
    replacement: str


def from_text(text: str) -> MappedText:
    return MappedText(text)


def span_start(m: MappedText, index: int) -> int:
    return m.starts[index] if m.starts is not None else index


def span_end(m: MappedText, index: int) -> int:
    return m.ends[index] if m.ends is not None else index + 1


def to_original_span(m: MappedText, start: int, end: int) -> tuple[int, int]:
    """Convert a [start, end) range of the transformed text into original offsets."""
    if end <= start:
        if start < len(m.text):
            at = span_start(m, start)
        else:
            at = span_end(m, max(0, len(m.text) - 1))
        return at, at
    return span_start(m, start), span_end(m, end - 1)


def _subsequence_indices(source: str, repl: str) -> list[int] | None:
    """Source indices when `repl` can be read off `source` by deleting characters."""
    picked: list[int] = []
    at = 0
    for ch in repl:
        found = source.find(ch, at)
        if found < 0:
            return None
        picked.append(found)
        at = found + 1
    return picked


def apply_edits(m: MappedText, edits: list[Edit]) -> MappedText:
    """Apply non-overlapping edits sorted by start offset.

    Characters kept 1:1 or by deletion keep their own span; a rewrite of a
    different shape gives every output character the span of the replaced range.
    """
    if not edits:
        return m
    out: list[str] = []
    starts: list[int] = []
    ends: list[int] = []
    cursor = 0

    def copy(src: int, dst: int) -> None:
        out.append(m.text[src:dst])
        if m.starts is None or m.ends is None:
            starts.extend(range(src, dst))
            ends.extend(range(src + 1, dst + 1))
        else:
            starts.extend(m.starts[src:dst])
            ends.extend(m.ends[src:dst])

    for edit in edits:
        copy(cursor, edit.start)
        source = m.text[edit.start : edit.end]
        repl = edit.replacement
        if repl:
            picked: list[int] | None
            if len(repl) == len(source):
                picked = list(range(len(repl)))
            elif len(repl) < len(source):
                picked = _subsequence_indices(source, repl)
            else:
                picked = None
            if picked is not None:
                for p in picked:
                    starts.append(span_start(m, edit.start + p))
                    ends.append(span_end(m, edit.start + p))
            else:
                s = span_start(m, edit.start)
                e = span_end(m, edit.end - 1)
                starts.extend([s] * len(repl))
                ends.extend([e] * len(repl))
            out.append(repl)
        cursor = edit.end
    copy(cursor, len(m.text))
    return MappedText("".join(out), starts, ends)


def replace_regex(
    m: MappedText,
    pattern: re.Pattern[str],
    fn: Callable[[re.Match[str]], str | None],
) -> MappedText:
    """Rewrite regex matches; return None from `fn` to keep a match unchanged."""
    edits: list[Edit] = []
    for match in pattern.finditer(m.text):
        if match.end() == match.start():
            continue
        replacement = fn(match)
        if replacement is not None and replacement != match.group(0):
            edits.append(Edit(match.start(), match.end(), replacement))
    return apply_edits(m, edits)


def map_chars(
    m: MappedText, table: dict[str, str], skip: set[int] | None = None
) -> MappedText:
    """Map every character through `table`; characters not in it, or at `skip`, are kept."""
    edits = [
        Edit(i, i + 1, table[ch])
        for i, ch in enumerate(m.text)
        if ch in table and table[ch] != ch and not (skip and i in skip)
    ]
    return apply_edits(m, edits)


def run_pipeline(m: MappedText, steps: list[Transformer]) -> MappedText:
    """Run transformers left to right."""
    current = m
    for step in steps:
        current = step(current)
    return current
