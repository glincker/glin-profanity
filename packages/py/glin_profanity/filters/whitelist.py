"""Interval whitelist: protected spans that let hits fully inside them be dropped."""

from __future__ import annotations

import re
from typing import NamedTuple

from .builtin_whitelist import BUILTIN_WHITELIST, WhitelistEntry
from .pipeline.mapped import MappedText, to_original_span
from .word_matcher import edge_kind

Interval = tuple[int, int]

# Whitespace stays Unicode-aware inside the ASCII-scoped patterns.
_SPACE = r"(?u:\s)"
_ASCII_BOUNDARY = r"(?a:\b)"
_KATAKANA = "\u30a1-\u30fa\u30fc-\u30ff\u31f0-\u31ff\uff66-\uff9f"


class _Compiled(NamedTuple):
    regex: re.Pattern[str]


def within(hit: Interval, span: Interval) -> bool:
    """True when the hit lies fully inside the protected span."""
    return hit[0] >= span[0] and hit[1] <= span[1]


def _edge(char: str, length: int, head: bool) -> str:
    """Lookaround for one end of a user entry; symbols like "+" go native."""
    kind = edge_kind(char, length)
    if kind == "ascii":
        if char.isascii() and (char.isalnum() or char == "_"):
            return _ASCII_BOUNDARY
        kind = "native"
    if kind == "kata":
        return f"(?<![{_KATAKANA}])" if head else f"(?![{_KATAKANA}])"
    if kind == "free":
        return ""
    return r"(?<!\w)" if head else r"(?!\w)"


def _compile_builtin(entry: WhitelistEntry) -> _Compiled:
    body = "".join(
        f"({part.replace(chr(92) + 's', _SPACE)})"
        for part in (entry.before, entry.protect, entry.after)
    )
    scoped = f"{body}" if entry.case_sensitive else f"(?ai:{body})"
    return _Compiled(re.compile(rf"{_ASCII_BOUNDARY}{scoped}{_ASCII_BOUNDARY}"))


def _compile_user(entry: str) -> _Compiled:
    parts = entry.split()
    protect = f"{_SPACE}+".join(re.escape(p) for p in parts)
    head = _edge(entry[0], len(entry), True)
    tail = _edge(entry[-1], len(entry), False)
    flag = "ai" if entry.isascii() else "i"
    return _Compiled(re.compile(rf"{head}()(?{flag}:({protect})){tail}()"))


class Whitelist:
    """Each entry is its own regex: context before, protected word, context after."""

    def __init__(self, user_entries: list[str], use_builtin: bool) -> None:
        compiled: list[_Compiled] = []
        if use_builtin:
            compiled.extend(_compile_builtin(e) for e in BUILTIN_WHITELIST)
        for entry in user_entries:
            stripped = entry.strip()
            if stripped:
                compiled.append(_compile_user(stripped))
        self._compiled = compiled

    @property
    def is_empty(self) -> bool:
        return not self._compiled

    def might_match(self, texts: list[str]) -> bool:
        """Cheap test on plain strings: could any safe span exist at all?"""
        return any(c.regex.search(t) for c in self._compiled for t in texts)

    def intervals(self, view: MappedText) -> list[Interval]:
        """Protected spans of the view, in original-text offsets."""
        found: list[Interval] = []
        for compiled in self._compiled:
            for match in compiled.regex.finditer(view.text):
                start = match.start(2)
                end = match.end(2)
                if end == start:
                    continue
                found.append(to_original_span(view, start, end))
        return found
