"""Interval whitelist: safe spans that let overlapping dictionary hits be dropped."""

from __future__ import annotations

import re

from .builtin_whitelist import BUILTIN_WHITELIST, WhitelistEntry
from .pipeline.mapped import MappedText, to_original_span

Interval = tuple[int, int]


def _compile(entries: list[WhitelistEntry], flags: int) -> re.Pattern[str] | None:
    if not entries:
        return None
    body = "|".join(e.pattern for e in entries)
    return re.compile(rf"\b(?:{body})\b", flags)


def overlaps(a: Interval, b: Interval) -> bool:
    return a[0] < b[1] and b[0] < a[1]


class Whitelist:
    """Case-insensitive and case-sensitive entries are compiled into one regex each."""

    def __init__(self, user_entries: list[str], use_builtin: bool) -> None:
        entries: list[WhitelistEntry] = list(BUILTIN_WHITELIST) if use_builtin else []
        for entry in user_entries:
            parts = entry.split()
            if parts:
                entries.append(WhitelistEntry(r"\s+".join(re.escape(p) for p in parts)))
        self._insensitive = _compile(
            [e for e in entries if not e.case_sensitive], re.IGNORECASE
        )
        self._sensitive = _compile([e for e in entries if e.case_sensitive], 0)

    @property
    def is_empty(self) -> bool:
        return self._insensitive is None and self._sensitive is None

    def might_match(self, texts: list[str]) -> bool:
        """Cheap test on plain strings: could any safe span exist at all?"""
        for regex in (self._insensitive, self._sensitive):
            if regex is None:
                continue
            if any(regex.search(text) for text in texts):
                return True
        return False

    def intervals(self, view: MappedText) -> list[Interval]:
        """Safe spans of the view, in original-text offsets."""
        found: list[Interval] = []
        for regex in (self._insensitive, self._sensitive):
            if regex is None:
                continue
            for match in regex.finditer(view.text):
                if match.end() == match.start():
                    continue
                found.append(to_original_span(view, match.start(), match.end()))
        return found
