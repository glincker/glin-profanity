"""
PII scanner — detects Personally Identifiable Information in text.

Mirrors packages/js/src/scanners/pii.ts.

@module scanners/pii
"""

from typing import Optional, TypedDict

from .base import (
    ScanMatch,
    ScanResult,
    allow_result,
    block_result,
    coerce_scan_input,
)
from .patterns.pii_patterns import PII_PATTERNS, PiiPattern
from .vault import Vault

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------


class PiiOptions(TypedDict, total=False):
    """Configuration options for PiiScanner.

    Mirrors the TypeScript ``PiiOptions`` interface in
    ``packages/js/src/scanners/pii.ts``.
    """

    redact: bool
    """When True, replace detected PII with vault placeholders."""

    vault: Optional[Vault]
    """Vault instance used to store originals when redact is True."""

    custom_patterns: Optional[list["PiiPattern"]]
    """Extra patterns merged with the built-in set."""

    block_on_any: bool
    """Block on any match (default True)."""

    block_at: float
    """BLOCK threshold (default 0.8)."""

    hitl_at: float
    """HITL threshold (default 0.5)."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _deduplicate_matches(matches: list[ScanMatch]) -> list[ScanMatch]:
    """
    Remove overlapping/duplicate match ranges.
    When two matches overlap, keep the one with the larger span.
    Sort by start_index ascending; for equal start_index, put larger spans first.
    """
    sorted_matches = sorted(matches, key=lambda m: (m.start_index, -m.end_index))
    result: list[ScanMatch] = []
    last_end = -1

    for m in sorted_matches:
        if m.start_index >= last_end:
            # Non-overlapping: keep this match.
            result.append(m)
            last_end = m.end_index
        elif m.end_index > last_end and result:
            # This match overlaps the previous but extends further — replace it.
            result[-1] = m
            last_end = m.end_index
        # Otherwise the current match is fully contained in the previous — skip it.

    return result


# ---------------------------------------------------------------------------
# PiiScanner
# ---------------------------------------------------------------------------


class PiiScanner:
    """
    Scanner that detects PII (email, phone, SSN, credit card, IBAN, IP, MAC,
    postcodes, passports, and dates of birth) in text.

    Implements the unified Scanner interface.
    """

    name = "pii"

    def __init__(
        self,
        redact: bool = False,
        vault: Optional[Vault] = None,
        custom_patterns: Optional[list[PiiPattern]] = None,
        block_on_any: bool = True,
        block_at: float = 0.8,
        hitl_at: float = 0.5,
    ) -> None:
        """
        Initialise the scanner.

        Args:
            redact: When True, replace detected PII with vault placeholders
                in ScanResult.sanitized. Requires vault to also be provided.
            vault: Vault instance used to store originals when redact is True.
            custom_patterns: Extra patterns merged with the built-in set.
            block_on_any: When True (default), any detected PII causes a BLOCK
                decision. When False, the scanner will score proportionally.
            block_at: Score threshold for BLOCK decision (default: 0.8).
            hitl_at: Score threshold for HITL decision (default: 0.5).
        """
        self._patterns: list[PiiPattern] = [*PII_PATTERNS, *(custom_patterns or [])]
        self._redact = redact
        self._vault = vault
        self._block_on_any = block_on_any
        self._block_at = block_at
        self._hitl_at = hitl_at

    def scan(self, input: str, ctx: Optional[dict] = None) -> ScanResult:  # noqa: A002
        """
        Evaluate the input string for PII.

        Args:
            input: The text to scan.
            ctx: Optional context dict (reserved for future use).

        Returns:
            A ScanResult with decision, score, and match details.
        """
        input = coerce_scan_input(input)
        matches: list[ScanMatch] = []
        reasons: list[str] = []

        for entry in self._patterns:
            for m in entry.pattern.finditer(input):
                matched = m.group(0)

                # Run optional validator (e.g. Luhn, IBAN mod-97)
                if entry.validator is not None and not entry.validator(matched):
                    continue

                matches.append(
                    ScanMatch(
                        pattern=entry.id,
                        start_index=m.start(),
                        end_index=m.end(),
                        category=entry.type,
                    )
                )

                label = f"{entry.type.upper()} ({entry.id})"
                if label not in reasons:
                    reasons.append(label)

        if not matches:
            return allow_result(self.name, input)

        # Redact if requested
        sanitized = input
        if self._redact:
            sanitized = self._redact_input(input, matches)

        score = 1.0 if self._block_on_any else min(1.0, len(matches) / 5)

        result = block_result(
            self.name,
            sanitized,
            score,
            reasons,
            matches,
            self._block_at,
            self._hitl_at,
        )

        return ScanResult(
            sanitized=sanitized,
            valid=result.valid,
            score=result.score,
            decision=result.decision,
            reasons=result.reasons,
            matches=result.matches,
            scanner=result.scanner,
        )

    def _redact_input(self, input: str, matches: list[ScanMatch]) -> str:  # noqa: A002
        """
        Replace matched spans in input with vault placeholders.
        Deduplicates by range then sorts descending so we splice from end.
        """
        deduped = _deduplicate_matches(matches)
        # Sort descending by start_index so we can splice from end without index drift
        sorted_desc = sorted(deduped, key=lambda m: -m.start_index)

        result = input
        for m in sorted_desc:
            original = input[m.start_index : m.end_index]
            type_label = m.category.upper()
            placeholder = (
                self._vault.store(type_label, original)
                if self._vault is not None
                else f"[REDACTED_{type_label}]"
            )
            result = result[: m.start_index] + placeholder + result[m.end_index :]

        return result


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------


def scan_pii(
    input: str,  # noqa: A002
    redact: bool = False,
    vault: Optional[Vault] = None,
    custom_patterns: Optional[list[PiiPattern]] = None,
    block_on_any: bool = True,
    block_at: float = 0.8,
    hitl_at: float = 0.5,
) -> ScanResult:
    """
    Scan a single string for PII using configurable options.

    Args:
        input: The text to scan.
        redact: Replace detected PII with placeholders.
        vault: Vault for reversible redaction.
        custom_patterns: Extra patterns to check.
        block_on_any: Block on any match (default True).
        block_at: BLOCK threshold (default 0.8).
        hitl_at: HITL threshold (default 0.5).

    Returns:
        A ScanResult with decision, score, and match details.
    """
    return PiiScanner(
        redact=redact,
        vault=vault,
        custom_patterns=custom_patterns,
        block_on_any=block_on_any,
        block_at=block_at,
        hitl_at=hitl_at,
    ).scan(input)


__all__ = ["PiiOptions", "PiiScanner", "scan_pii"]
