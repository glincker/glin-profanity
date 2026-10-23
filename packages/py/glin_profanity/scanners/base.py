"""
Base types and interfaces for the glin-profanity scanner system.

Mirrors the TypeScript base at packages/js/src/scanners/base.ts.

@module scanners/base
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Protocol, runtime_checkable


class ScanDecision(str, Enum):
    """The final decision a scanner makes about an input."""

    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    HITL = "HITL"


@dataclass
class ScanMatch:
    """A match found within the input string."""

    pattern: str
    """The pattern identifier or description that matched."""

    start_index: int
    """Zero-based start index of the match within the input."""

    end_index: int
    """Zero-based end index (exclusive) of the match within the input."""

    category: str
    """The category this match belongs to."""


@dataclass
class ScanResult:
    """The result returned by a scanner after processing an input."""

    sanitized: str
    """The sanitized version of the input (may equal input if no changes)."""

    valid: bool
    """Whether the input is considered safe (True = safe, False = flagged)."""

    score: float
    """Risk score from 0 (safe) to 1 (maximum risk)."""

    decision: ScanDecision
    """The decision the scanner reached."""

    reasons: list[str]
    """Human-readable reasons why the input was flagged."""

    scanner: str
    """The name of the scanner that produced this result, used for telemetry."""

    matches: list[ScanMatch] = field(default_factory=list)
    """Detailed match information, if available."""


@runtime_checkable
class Scanner(Protocol):
    """A content scanner that evaluates an input string."""

    name: str
    """Unique name identifying this scanner."""

    def scan(self, input: str, ctx: Optional[dict] = None) -> ScanResult:
        """Evaluate the input and return a scan result."""
        ...


def coerce_scan_input(value: object) -> str:
    """Coerce scanner input to a string.

    Scanners receive arbitrary runtime values; a non-string input (``None``,
    numbers, dicts) would otherwise blow up inside ``finditer``/``exec``. Treat
    anything that is not a string as empty so scanners never raise on bad input.
    """
    return value if isinstance(value, str) else ""


def allow_result(scanner: str, input: str) -> ScanResult:
    """
    Build an ALLOW result for a scanner that found nothing to flag.

    Args:
        scanner: Name of the scanner producing the result.
        input: The original input string.
    """
    return ScanResult(
        sanitized=input,
        valid=True,
        score=0.0,
        decision=ScanDecision.ALLOW,
        reasons=[],
        scanner=scanner,
        matches=[],
    )


def block_result(
    scanner: str,
    input: str,
    score: float,
    reasons: list[str],
    matches: Optional[list[ScanMatch]] = None,
    block_at: float = 0.8,
    hitl_at: float = 0.5,
) -> ScanResult:
    """
    Build a BLOCK or HITL result for a scanner that detected injection signals.

    Args:
        scanner: Name of the scanner producing the result.
        input: The original input string.
        score: Computed risk score (0..1).
        reasons: List of human-readable flag reasons.
        matches: Optional per-pattern match details.
        block_at: Threshold at or above which the decision is BLOCK (default 0.8).
        hitl_at: Threshold at or above which the decision is HITL (default 0.5).
    """
    if score >= block_at:
        decision = ScanDecision.BLOCK
    elif score >= hitl_at:
        decision = ScanDecision.HITL
    else:
        decision = ScanDecision.ALLOW

    return ScanResult(
        sanitized=input,
        valid=decision == ScanDecision.ALLOW,
        score=score,
        decision=decision,
        reasons=reasons,
        scanner=scanner,
        matches=matches if matches is not None else [],
    )
