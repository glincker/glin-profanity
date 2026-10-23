"""
Rule-based prompt injection scanner (Phase A).

Uses a pattern database to detect common prompt injection techniques.
Phase B (ONNX model) is planned and will be composed with this scanner.

Mirrors the TypeScript scanner at packages/js/src/scanners/prompt-injection.ts.

@module scanners/prompt_injection
"""

from typing import Optional

from .base import (
    ScanDecision,
    ScanMatch,
    ScanResult,
    allow_result,
    block_result,
    coerce_scan_input,
)
from .patterns.injection_patterns import INJECTION_PATTERNS, InjectionPattern

SEVERITY_WEIGHTS: dict[str, float] = {
    "critical": 1.0,
    "high": 0.75,
    "medium": 0.5,
    "low": 0.25,
}

STRICTNESS_NORMALIZER: dict[str, float] = {
    "strict": 1.0,
    "moderate": 1.5,
    "lenient": 2.5,
}


class PromptInjectionScanner:
    """Rule-based scanner that detects prompt injection patterns in text."""

    name = "prompt-injection"

    def __init__(
        self,
        strictness: str = "moderate",
        custom_patterns: Optional[list[InjectionPattern]] = None,
        block_at: float = 0.8,
        hitl_at: float = 0.5,
    ) -> None:
        """
        Initialise the scanner.

        Args:
            strictness: How aggressively to score matches.
                - ``lenient``: uses a higher normalizer that divides the raw severity
                  sum more aggressively, producing lower scores and requiring more
                  evidence to block.
                - ``moderate`` (default): balanced.
                - ``strict``: uses a lower normalizer so every match is amplified.
            custom_patterns: Additional custom patterns to check alongside the
                built-in set.
            block_at: Score threshold at or above which the decision is BLOCK
                (default: 0.8).
            hitl_at: Score threshold at or above which the decision is HITL
                (default: 0.5).
        """
        self._strictness = strictness
        self._block_at = block_at
        self._hitl_at = hitl_at
        self._all_patterns: list[InjectionPattern] = [
            *INJECTION_PATTERNS,
            *(custom_patterns or []),
        ]

    def scan(self, input: str, ctx: Optional[dict] = None) -> ScanResult:
        """
        Evaluate the input string for prompt injection signals.

        Args:
            input: The text to scan.
            ctx: Optional context dict. Supports ``strictness`` key to override
                 the constructor-level strictness for this call.

        Returns:
            A :class:`~.base.ScanResult` with decision, score, and match details.
        """
        input = coerce_scan_input(input)
        effective_strictness = (
            ctx.get("strictness", self._strictness) if ctx else self._strictness
        )
        normalizer = STRICTNESS_NORMALIZER.get(effective_strictness, 1.5)

        match_details: list[ScanMatch] = []
        matched_categories: dict[str, None] = {}
        raw_score = 0.0

        for entry in self._all_patterns:
            for m in entry.pattern.finditer(input):
                weight = SEVERITY_WEIGHTS.get(entry.severity, 0.5)
                raw_score += weight
                matched_categories[entry.category] = None
                match_details.append(
                    ScanMatch(
                        pattern=entry.id,
                        start_index=m.start(),
                        end_index=m.end(),
                        category=entry.category,
                    )
                )

        if not match_details:
            return allow_result(self.name, input)

        score = min(1.0, raw_score / normalizer)
        reasons = list(matched_categories.keys())

        return block_result(
            self.name,
            input,
            score,
            reasons,
            match_details,
            self._block_at,
            self._hitl_at,
        )


default_prompt_injection_scanner = PromptInjectionScanner()
"""Convenience singleton using default (moderate) settings."""


def check_prompt_injection(
    input: str,
    strictness: str = "moderate",
    custom_patterns: Optional[list[InjectionPattern]] = None,
    block_at: float = 0.8,
    hitl_at: float = 0.5,
) -> ScanResult:
    """
    Scan a single string for prompt injection signals using configurable options.

    When called with all default arguments and no custom_patterns, delegates to
    the module-level ``default_prompt_injection_scanner`` singleton rather than
    constructing a new scanner on every call.

    Args:
        input: The text to scan.
        strictness: How aggressively to score matches
            (``strict``, ``moderate``, ``lenient``).
        custom_patterns: Additional custom patterns to check.
        block_at: Score threshold for BLOCK decision (default 0.8).
        hitl_at: Score threshold for HITL decision (default 0.5).

    Returns:
        A :class:`~.base.ScanResult` with decision, score, and match details.
    """
    _defaults = (
        strictness == "moderate"
        and custom_patterns is None
        and block_at == 0.8
        and hitl_at == 0.5
    )
    if _defaults:
        return default_prompt_injection_scanner.scan(input)
    scanner = PromptInjectionScanner(
        strictness=strictness,
        custom_patterns=custom_patterns,
        block_at=block_at,
        hitl_at=hitl_at,
    )
    return scanner.scan(input)


__all__ = [
    "PromptInjectionScanner",
    "check_prompt_injection",
    "default_prompt_injection_scanner",
    "ScanDecision",
    "ScanResult",
    "ScanMatch",
]
