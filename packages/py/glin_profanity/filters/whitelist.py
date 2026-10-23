"""Interval whitelist: safe spans that let overlapping dictionary hits be dropped."""

from __future__ import annotations

import re

from .builtin_whitelist import BUILTIN_WHITELIST, WhitelistEntry
from .pipeline.mapped import MappedText, to_original_span

Interval = tuple[int, int]

# Whitespace stays Unicode-aware inside the ASCII-scoped patterns.
_SPACE = r"(?u:\s)"


def _compile(
    entries: list[WhitelistEntry], ignore_case: bool
) -> re.Pattern[str] | None:
    if not entries:
        return None
    body = "|".join(e.pattern for e in entries)
    # ASCII-only folding and boundaries like JS; whitespace stays Unicode-aware.
    scoped = f"(?ai:{body})" if ignore_case else f"(?:{body})"
    return re.compile(rf"(?a:\b){scoped}(?a:\b)")


def overlaps(a: Interval, b: Interval) -> bool:
    return a[0] < b[1] and b[0] < a[1]


class Whitelist:
    """Case-insensitive and case-sensitive entries are compiled into one regex each."""

    def __init__(self, user_entries: list[str], use_builtin: bool) -> None:
        entries: list[WhitelistEntry] = []
        if use_builtin:
            entries = [
                WhitelistEntry(e.pattern.replace(r"\s", _SPACE), e.case_sensitive)
                for e in BUILTIN_WHITELIST
            ]
        for entry in user_entries:
            parts = entry.split()
            if parts:
                entries.append(
                    WhitelistEntry(f"{_SPACE}+".join(re.escape(p) for p in parts))
                )
        self._insensitive = _compile([e for e in entries if not e.case_sensitive], True)
        self._sensitive = _compile([e for e in entries if e.case_sensitive], False)

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
