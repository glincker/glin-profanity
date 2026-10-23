"""
PII (Personally Identifiable Information) detection patterns.

Pattern attribution:
  - ProtectAI/llm-guard (MIT) — https://github.com/protectai/llm-guard
  - Yelp/detect-secrets (Apache-2.0) — https://github.com/Yelp/detect-secrets

Patterns have been reimplemented in Python — no source was copied verbatim.

Mirrors packages/js/src/scanners/patterns/pii-patterns.ts.

@module scanners/patterns/pii_patterns
"""

import re
from dataclasses import dataclass
from typing import Callable, Literal, Optional

PiiType = Literal[
    "email",
    "phone",
    "ssn",
    "credit_card",
    "iban",
    "ip",
    "mac",
    "postcode",
    "passport",
    "dob",
    "other",
]


@dataclass
class PiiPattern:
    """A single PII detection rule."""

    id: str
    """Unique identifier, e.g. 'PII-EMAIL-001'."""

    type: PiiType
    """Category of PII."""

    pattern: re.Pattern[str]
    """Compiled regular expression for detection."""

    validator: Optional[Callable[[str], bool]] = None
    """
    Optional post-match validator.
    If provided, a match only counts as PII when this returns True.
    """


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------


def luhn_check(value: str) -> bool:
    """
    Luhn algorithm validator for credit card numbers.
    Strips spaces and dashes before checking.
    """
    digits = re.sub(r"[\s\-]", "", value)
    if not re.match(r"^\d+$", digits):
        return False

    total = 0
    should_double = False

    for i in range(len(digits) - 1, -1, -1):
        d = int(digits[i])
        if should_double:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        should_double = not should_double

    return total % 10 == 0


def iban_check(value: str) -> bool:
    """
    Basic IBAN mod-97 structural validator.
    Does NOT check country-specific length rules; validates the mod-97 checksum.
    """
    cleaned = re.sub(r"[\s\-]", "", value).upper()
    if not re.match(r"^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$", cleaned):
        return False

    # Move first 4 chars to end, convert letters to numbers
    rearranged = cleaned[4:] + cleaned[:4]
    numeric_parts: list[str] = []
    for c in rearranged:
        code = ord(c)
        if 65 <= code <= 90:
            numeric_parts.append(str(code - 55))
        else:
            numeric_parts.append(c)
    numeric = "".join(numeric_parts)

    # BigInt mod 97 (IBAN can be >15 digits)
    remainder = 0
    for ch in numeric:
        remainder = (remainder * 10 + int(ch)) % 97

    return remainder == 1


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

_EMAIL_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-EMAIL-001",
        type="email",
        # RFC-5321 compliant enough for practical use
        pattern=re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
    ),
]

# ---------------------------------------------------------------------------
# Phone Numbers
# ---------------------------------------------------------------------------

_PHONE_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-PHONE-001",
        type="phone",
        # E.164 format
        pattern=re.compile(r"\+[1-9][0-9]{6,14}\b"),
    ),
    PiiPattern(
        id="PII-PHONE-002",
        type="phone",
        # US/CA NANP: (XXX) XXX-XXXX or XXX-XXX-XXXX or XXX.XXX.XXXX
        pattern=re.compile(
            r"(?:\+1[\s\-.]?)?\(?[2-9][0-9]{2}\)?[\s\-.]?[2-9][0-9]{2}[\s\-.]?[0-9]{4}\b"
        ),
    ),
    PiiPattern(
        id="PII-PHONE-003",
        type="phone",
        # UK phone: 07xxx xxxxxx or +44 7xxx xxxxxx
        pattern=re.compile(r"(?:\+44|0)[0-9]{2,4}[\s\-]?[0-9]{3,4}[\s\-]?[0-9]{4}\b"),
    ),
]

# ---------------------------------------------------------------------------
# SSN / Tax IDs
# ---------------------------------------------------------------------------

_SSN_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-SSN-001",
        type="ssn",
        # US Social Security Number (not 000, not 666, not 900-999)
        pattern=re.compile(
            r"\b(?!000|666|9[0-9][0-9])[0-9]{3}[-\s](?!00)[0-9]{2}[-\s](?!0000)[0-9]{4}\b"
        ),
    ),
    PiiPattern(
        id="PII-ITIN-001",
        type="ssn",
        # US Individual Taxpayer Identification Number (9XX-7X-XXXX or 9XX-8X-XXXX)
        pattern=re.compile(r"\b9[0-9]{2}[-\s](?:7[0-9]|8[0-8])[-\s][0-9]{4}\b"),
    ),
]

# ---------------------------------------------------------------------------
# Credit Cards
# ---------------------------------------------------------------------------

_CREDIT_CARD_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-CC-001",
        type="credit_card",
        # Visa / Mastercard / Amex / Discover — 13-19 digits with optional separators
        pattern=re.compile(
            r"\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6(?:011|5[0-9]{2}))"
            r"[0-9 \-]{8,15}[0-9]\b"
        ),
        validator=luhn_check,
    ),
    PiiPattern(
        id="PII-CC-002",
        type="credit_card",
        # Generic 16-digit card with separators
        pattern=re.compile(
            r"\b[0-9]{4}[\ \-]?[0-9]{4}[\ \-]?[0-9]{4}[\ \-]?[0-9]{4}\b"
        ),
        validator=luhn_check,
    ),
    PiiPattern(
        id="PII-CC-003",
        type="credit_card",
        # Amex: 15-digit, starts with 34 or 37
        pattern=re.compile(r"\b3[47][0-9]{2}[\s\-]?[0-9]{6}[\s\-]?[0-9]{5}\b"),
        validator=luhn_check,
    ),
]

# ---------------------------------------------------------------------------
# IBAN
# ---------------------------------------------------------------------------

_IBAN_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-IBAN-001",
        type="iban",
        # Standard IBAN format: 2-letter country, 2 check digits, up to 30 alphanumeric
        pattern=re.compile(
            r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]{0,16})\b"
        ),
        validator=iban_check,
    ),
    PiiPattern(
        id="PII-IBAN-002",
        type="iban",
        # IBAN with spaces (printed format: groups of 4)
        pattern=re.compile(r"\b[A-Z]{2}[0-9]{2}(?:\s[A-Z0-9]{4}){2,7}\b"),
        validator=iban_check,
    ),
]

# ---------------------------------------------------------------------------
# IP Addresses
# ---------------------------------------------------------------------------

_IP_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-IPV4-001",
        type="ip",
        # IPv4 (non-private ranges included — scanner user decides what to block)
        pattern=re.compile(
            r"\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"
            r"\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"
            r"\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"
            r"\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
        ),
    ),
    PiiPattern(
        id="PII-IPV6-001",
        type="ip",
        # Full IPv6
        pattern=re.compile(r"\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b"),
    ),
    PiiPattern(
        id="PII-IPV6-002",
        type="ip",
        # Compressed IPv6 (e.g. 2001:db8::1)
        pattern=re.compile(
            r"\b(?:[A-Fa-f0-9]{1,4}:){1,7}:\b|\b:[A-Fa-f0-9]{1,4}(?::[A-Fa-f0-9]{1,4}){1,7}\b"
        ),
    ),
]

# ---------------------------------------------------------------------------
# MAC Address
# ---------------------------------------------------------------------------

_MAC_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-MAC-001",
        type="mac",
        # Colon-separated MAC
        pattern=re.compile(r"\b(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b"),
    ),
    PiiPattern(
        id="PII-MAC-002",
        type="mac",
        # Hyphen-separated MAC
        pattern=re.compile(r"\b(?:[0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}\b"),
    ),
]

# ---------------------------------------------------------------------------
# Postcodes
# ---------------------------------------------------------------------------

_POSTCODE_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-ZIP-001",
        type="postcode",
        # US ZIP code (5 digit or ZIP+4)
        pattern=re.compile(r"\b[0-9]{5}(?:-[0-9]{4})?\b"),
    ),
    PiiPattern(
        id="PII-UKPOST-001",
        type="postcode",
        # UK postcode
        pattern=re.compile(
            r"\b[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}\b", re.IGNORECASE
        ),
    ),
    PiiPattern(
        id="PII-CAPOST-001",
        type="postcode",
        # Canadian postal code: A1A 1A1
        pattern=re.compile(
            r"\b[A-CEGHJKLMNPRSTVXYa-cegjklmnprstvxy][0-9][A-Za-z]\s?[0-9][A-Za-z][0-9]\b"
        ),
    ),
]

# ---------------------------------------------------------------------------
# Canadian SIN
# ---------------------------------------------------------------------------

_SIN_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-SIN-001",
        type="other",
        # Canadian Social Insurance Number: NNN NNN NNN (first digit 1-9, not 0)
        pattern=re.compile(r"\b[1-9][0-9]{2}[\s\-][0-9]{3}[\s\-][0-9]{3}\b"),
    ),
]

# ---------------------------------------------------------------------------
# Passport Numbers
# ---------------------------------------------------------------------------

_PASSPORT_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-PASSPORT-US-001",
        type="passport",
        # US Passport: 9 digits (newer) or letter + 8 digits
        pattern=re.compile(r"\b(?:[A-Z][0-9]{8}|[0-9]{9})\b"),
    ),
    PiiPattern(
        id="PII-PASSPORT-UK-001",
        type="passport",
        # UK Passport: 9 digits
        pattern=re.compile(r"\b[0-9]{9}\b"),
    ),
    PiiPattern(
        id="PII-PASSPORT-GENERIC-001",
        type="passport",
        # Generic MRZ-style: 2 letters + 6 alphanumeric
        pattern=re.compile(r"\b[A-Z]{2}[A-Z0-9]{6,7}\b"),
    ),
]

# ---------------------------------------------------------------------------
# Date of Birth
# ---------------------------------------------------------------------------

_DOB_PATTERNS: list[PiiPattern] = [
    PiiPattern(
        id="PII-DOB-001",
        type="dob",
        # ISO format: YYYY-MM-DD
        pattern=re.compile(
            r"\b(?:19|20)[0-9]{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])\b"
        ),
    ),
    PiiPattern(
        id="PII-DOB-002",
        type="dob",
        # US format: MM/DD/YYYY
        pattern=re.compile(
            r"\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12][0-9]|3[01])\/(?:19|20)[0-9]{2}\b"
        ),
    ),
    PiiPattern(
        id="PII-DOB-003",
        type="dob",
        # EU format: DD.MM.YYYY
        pattern=re.compile(
            r"\b(?:0[1-9]|[12][0-9]|3[01])\.(?:0[1-9]|1[0-2])\.(?:19|20)[0-9]{2}\b"
        ),
    ),
    PiiPattern(
        id="PII-DOB-004",
        type="dob",
        # Written "born on", "date of birth", "dob" keyword patterns
        pattern=re.compile(
            r"(?:born(?:\s+on)?|date\s+of\s+birth|dob)\s*[:\-]?\s*"
            r"(?:0?[1-9]|[12][0-9]|3[01])[\s\/\-](?:0?[1-9]|1[0-2])[\s\/\-](?:19|20)[0-9]{2}",
            re.IGNORECASE,
        ),
    ),
]

# ---------------------------------------------------------------------------
# Aggregate export
# ---------------------------------------------------------------------------

PII_PATTERNS: list[PiiPattern] = [
    *_EMAIL_PATTERNS,
    *_PHONE_PATTERNS,
    *_SSN_PATTERNS,
    *_CREDIT_CARD_PATTERNS,
    *_IBAN_PATTERNS,
    *_IP_PATTERNS,
    *_MAC_PATTERNS,
    *_POSTCODE_PATTERNS,
    *_SIN_PATTERNS,
    *_PASSPORT_PATTERNS,
    *_DOB_PATTERNS,
]
"""All built-in PII detection patterns. 27 patterns covering email, phone, SSN,
credit card, IBAN, IP, MAC, postcodes, passports, and dates of birth."""

__all__ = ["PiiPattern", "PiiType", "PII_PATTERNS", "luhn_check", "iban_check"]
