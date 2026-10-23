"""
Secrets scanner — detects leaked credentials, API keys, and tokens.

Mirrors packages/js/src/scanners/secrets.ts.

@module scanners/secrets
"""

import math
from typing import Optional, TypedDict

from .base import (
    ScanMatch,
    ScanResult,
    allow_result,
    block_result,
    coerce_scan_input,
)
from .patterns.secret_patterns import SECRET_PATTERNS, SecretPattern
from .vault import Vault

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------


class SecretsOptions(TypedDict, total=False):
    """Configuration options for SecretsScanner.

    Mirrors the TypeScript ``SecretsOptions`` interface in
    ``packages/js/src/scanners/secrets.ts``.
    """

    redact: bool
    """When True, replace detected secrets with vault placeholders."""

    vault: Optional[Vault]
    """Vault instance used to store originals when redact is True."""

    custom_patterns: Optional[list["SecretPattern"]]
    """Extra patterns merged with the built-in set."""

    min_entropy: float
    """Minimum Shannon entropy for entropy-gated patterns (default: 4.0)."""

    block_on_any: bool
    """Block on any match (default True)."""

    block_at: float
    """BLOCK threshold (default 0.8)."""

    hitl_at: float
    """HITL threshold (default 0.5)."""


# ---------------------------------------------------------------------------
# Shannon entropy
# ---------------------------------------------------------------------------


def _shannon_entropy(s: str) -> float:
    """
    Compute Shannon entropy (base-2) of a string.
    Returns a value in [0, log2(alphabet_size)].
    """
    if not s:
        return 0.0
    freq: dict[str, int] = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    entropy = 0.0
    for count in freq.values():
        p = count / len(s)
        entropy -= p * math.log2(p)
    return entropy


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _secret_family(id: str) -> str:
    """
    Derive a short family label from a pattern id.
    e.g. 'SEC-STRIPE-001' -> 'stripe', 'SEC-AWS-001' -> 'aws'
    """
    parts = id.split("-")
    # id format is 'SEC-<FAMILY>-<NUM>' — middle segment(s) form the family
    if len(parts) >= 3:
        return "_".join(parts[1 : len(parts) - 1]).lower()
    return id.lower()


def _deduplicate_matches(matches: list[ScanMatch]) -> list[ScanMatch]:
    """
    Remove overlapping/duplicate match ranges.
    Sorts by start_index ascending, end_index descending (largest span first on tie).
    Keeps the widest non-overlapping match for each region.
    """
    sorted_matches = sorted(matches, key=lambda m: (m.start_index, -m.end_index))
    result: list[ScanMatch] = []
    last_end = -1

    for m in sorted_matches:
        if m.start_index >= last_end:
            result.append(m)
            last_end = m.end_index
        elif m.end_index > last_end and result:
            # Current match extends beyond the last kept match — replace it
            result[-1] = m
            last_end = m.end_index

    return result


# ---------------------------------------------------------------------------
# SecretsScanner
# ---------------------------------------------------------------------------


class SecretsScanner:
    """
    Scanner that detects secrets, API keys, and credentials in text.

    Implements the unified Scanner interface.
    """

    name = "secrets"

    def __init__(
        self,
        redact: bool = False,
        vault: Optional[Vault] = None,
        custom_patterns: Optional[list[SecretPattern]] = None,
        min_entropy: float = 4.0,
        block_on_any: bool = True,
        block_at: float = 0.8,
        hitl_at: float = 0.5,
    ) -> None:
        """
        Initialise the scanner.

        Args:
            redact: When True, replace detected secrets with vault placeholders
                in ScanResult.sanitized. Requires vault to also be provided.
            vault: Vault instance used to store originals when redact is True.
                If redact is True but no vault is provided, each detected secret is
                replaced with the generic string '[REDACTED]' and cannot be restored.
            custom_patterns: Extra patterns merged with the built-in set.
            min_entropy: Minimum Shannon entropy required for patterns with
                entropy_check=True. Default: 4.0.
            block_on_any: When True (default), any detected secret causes a BLOCK
                decision. When False, the scanner will score proportionally.
            block_at: Score threshold for BLOCK decision (default: 0.8).
            hitl_at: Score threshold for HITL decision (default: 0.5).
        """
        self._patterns: list[SecretPattern] = [
            *SECRET_PATTERNS,
            *(custom_patterns or []),
        ]
        self._redact = redact
        self._vault = vault
        self._min_entropy = min_entropy
        self._block_on_any = block_on_any
        self._block_at = block_at
        self._hitl_at = hitl_at

    def scan(self, input: str, ctx: Optional[dict] = None) -> ScanResult:  # noqa: A002
        """
        Evaluate the input string for secrets.

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
                # For patterns with capture groups, prefer group 1 for entropy check
                token = m.group(1) if m.lastindex and m.lastindex >= 1 else m.group(0)

                if entry.entropy_check:
                    entropy = _shannon_entropy(token)
                    if entropy < self._min_entropy:
                        continue

                family = (
                    entry.family
                    if entry.family is not None
                    else _secret_family(entry.id)
                )
                matches.append(
                    ScanMatch(
                        pattern=entry.id,
                        start_index=m.start(),
                        end_index=m.end(),
                        # category carries the pattern family, not severity
                        category=family,
                    )
                )

                if entry.name not in reasons:
                    reasons.append(entry.name)

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
        # block_result sets sanitized to input — override with our redacted version
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
        Deduplicates overlapping ranges and splices from highest end down
        so earlier indices stay valid.
        """
        deduped = _deduplicate_matches(matches)
        # Sort descending by end_index so we splice from end without index drift
        sorted_desc = sorted(deduped, key=lambda m: (-m.end_index, -m.start_index))

        result = input
        for m in sorted_desc:
            original = input[m.start_index : m.end_index]
            type_label = m.category.upper()
            placeholder = (
                self._vault.store(type_label, original)
                if self._vault is not None
                else "[REDACTED]"
            )
            result = result[: m.start_index] + placeholder + result[m.end_index :]

        return result


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------


def scan_secrets(
    input: str,  # noqa: A002
    redact: bool = False,
    vault: Optional[Vault] = None,
    custom_patterns: Optional[list[SecretPattern]] = None,
    min_entropy: float = 4.0,
    block_on_any: bool = True,
    block_at: float = 0.8,
    hitl_at: float = 0.5,
) -> ScanResult:
    """
    Scan a single string for secrets using configurable options.

    Args:
        input: The text to scan.
        redact: Replace detected secrets with placeholders.
        vault: Vault for reversible redaction.
        custom_patterns: Extra patterns to check.
        min_entropy: Minimum entropy for entropy-gated patterns.
        block_on_any: Block on any match (default True).
        block_at: BLOCK threshold (default 0.8).
        hitl_at: HITL threshold (default 0.5).

    Returns:
        A ScanResult with decision, score, and match details.
    """
    return SecretsScanner(
        redact=redact,
        vault=vault,
        custom_patterns=custom_patterns,
        min_entropy=min_entropy,
        block_on_any=block_on_any,
        block_at=block_at,
        hitl_at=hitl_at,
    ).scan(input)


__all__ = ["SecretsOptions", "SecretsScanner", "scan_secrets"]
