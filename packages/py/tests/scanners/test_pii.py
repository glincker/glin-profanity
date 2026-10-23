"""
Tests for PiiScanner — ported from JS pii.test.ts on release.
"""


from glin_profanity.scanners.base import ScanDecision
from glin_profanity.scanners.patterns.pii_patterns import iban_check, luhn_check
from glin_profanity.scanners.pii import PiiScanner, scan_pii
from glin_profanity.scanners.vault import Vault

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------


class TestPiiEmail:
    def test_email_detected(self) -> None:
        result = scan_pii("Contact me at user@example.com please.")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-EMAIL-001" for m in result.matches)
        match = next(m for m in result.matches if m.pattern == "PII-EMAIL-001")
        assert match.category == "email"

    def test_email_match_span(self) -> None:
        text = "Email: test@example.com end"
        result = scan_pii(text)
        m = next(m for m in result.matches if m.pattern == "PII-EMAIL-001")
        assert text[m.start_index : m.end_index] == "test@example.com"

    def test_no_email_allows(self) -> None:
        result = scan_pii("Hello world, no PII here.")
        assert result.decision == ScanDecision.ALLOW


# ---------------------------------------------------------------------------
# Phone
# ---------------------------------------------------------------------------


class TestPiiPhone:
    def test_e164_phone_detected(self) -> None:
        result = scan_pii("Call me at +14155552671.")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-PHONE-001" for m in result.matches)

    def test_us_nanp_phone_detected(self) -> None:
        result = scan_pii("My number is (415) 555-2671.")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-PHONE-002" for m in result.matches)


# ---------------------------------------------------------------------------
# SSN
# ---------------------------------------------------------------------------


class TestPiiSsn:
    def test_ssn_detected(self) -> None:
        result = scan_pii("SSN: 123-45-6789")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-SSN-001" for m in result.matches)
        match = next(m for m in result.matches if m.pattern == "PII-SSN-001")
        assert match.category == "ssn"

    def test_invalid_ssn_group_000_not_detected(self) -> None:
        # SSN starting with 000 is invalid
        result = scan_pii("bad: 000-45-6789")
        ssn_matches = [m for m in result.matches if m.pattern == "PII-SSN-001"]
        assert len(ssn_matches) == 0

    def test_invalid_ssn_area_666_not_detected(self) -> None:
        result = scan_pii("bad: 666-45-6789")
        ssn_matches = [m for m in result.matches if m.pattern == "PII-SSN-001"]
        assert len(ssn_matches) == 0


# ---------------------------------------------------------------------------
# Credit Card (Luhn validation)
# ---------------------------------------------------------------------------


class TestPiiCreditCard:
    def test_valid_visa_detected(self) -> None:
        # Luhn-valid Visa test card
        result = scan_pii("Card: 4111 1111 1111 1111")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.category == "credit_card" for m in result.matches)

    def test_invalid_luhn_not_detected(self) -> None:
        # 4111 1111 1111 1112 — fails Luhn check
        result = scan_pii("Card: 4111 1111 1111 1112")
        cc_matches = [m for m in result.matches if m.category == "credit_card"]
        assert len(cc_matches) == 0

    def test_luhn_check_valid(self) -> None:
        assert luhn_check("4111 1111 1111 1111") is True

    def test_luhn_check_invalid(self) -> None:
        assert luhn_check("4111 1111 1111 1112") is False

    def test_luhn_check_amex(self) -> None:
        # Valid Amex test number
        assert luhn_check("378282246310005") is True

    def test_luhn_check_mastercard(self) -> None:
        # Valid Mastercard test number
        assert luhn_check("5500005555555559") is True

    def test_visa_no_spaces(self) -> None:
        result = scan_pii("4111111111111111")
        assert result.decision == ScanDecision.BLOCK

    def test_visa_with_dashes(self) -> None:
        result = scan_pii("4111-1111-1111-1111")
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# IBAN
# ---------------------------------------------------------------------------


class TestPiiIban:
    def test_valid_iban_detected(self) -> None:
        # Valid German IBAN (mod-97 checksum is correct)
        iban = "DE89370400440532013000"
        result = scan_pii(f"IBAN: {iban}")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.category == "iban" for m in result.matches)

    def test_invalid_iban_checksum_not_detected(self) -> None:
        # Wrong check digits
        result = scan_pii("IBAN: DE00370400440532013000")
        iban_matches = [m for m in result.matches if m.category == "iban"]
        assert len(iban_matches) == 0

    def test_iban_check_valid_de(self) -> None:
        assert iban_check("DE89370400440532013000") is True

    def test_iban_check_valid_gb(self) -> None:
        # Valid UK IBAN
        assert iban_check("GB29NWBK60161331926819") is True

    def test_iban_check_invalid_checksum(self) -> None:
        assert iban_check("DE00370400440532013000") is False

    def test_iban_check_with_spaces(self) -> None:
        # IBAN in printed format
        assert iban_check("DE89 3704 0044 0532 0130 00") is True


# ---------------------------------------------------------------------------
# IP Addresses
# ---------------------------------------------------------------------------


class TestPiiIp:
    def test_ipv4_detected(self) -> None:
        result = scan_pii("Server at 192.168.1.1 is up.")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-IPV4-001" for m in result.matches)
        match = next(m for m in result.matches if m.pattern == "PII-IPV4-001")
        assert match.category == "ip"

    def test_ipv4_public_detected(self) -> None:
        result = scan_pii("IP: 8.8.8.8")
        assert result.decision == ScanDecision.BLOCK

    def test_ipv6_full_detected(self) -> None:
        result = scan_pii("IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-IPV6-001" for m in result.matches)


# ---------------------------------------------------------------------------
# Redaction with Vault
# ---------------------------------------------------------------------------


class TestPiiRedaction:
    def test_redact_email_with_vault(self) -> None:
        vault = Vault()
        scanner = PiiScanner(redact=True, vault=vault)
        text = "Email me at test@example.com"
        result = scanner.scan(text)
        assert "test@example.com" not in result.sanitized
        assert "[REDACTED_EMAIL_1]" in result.sanitized
        restored = vault.restore(result.sanitized)
        assert restored == text

    def test_redact_without_vault_uses_type_placeholder(self) -> None:
        scanner = PiiScanner(redact=True)
        result = scanner.scan("Email: test@example.com")
        assert "[REDACTED_EMAIL]" in result.sanitized

    def test_multiple_pii_get_distinct_placeholders(self) -> None:
        vault = Vault()
        scanner = PiiScanner(redact=True, vault=vault)
        result = scanner.scan("Emails: a@example.com and b@example.com")
        assert "[REDACTED_EMAIL_1]" in result.sanitized
        assert "[REDACTED_EMAIL_2]" in result.sanitized


# ---------------------------------------------------------------------------
# Scanner interface contract
# ---------------------------------------------------------------------------


class TestPiiScannerContract:
    def test_scanner_name(self) -> None:
        scanner = PiiScanner()
        assert scanner.name == "pii"

    def test_result_scanner_field(self) -> None:
        scanner = PiiScanner()
        result = scanner.scan("hello")
        assert result.scanner == "pii"

    def test_allow_result_is_valid(self) -> None:
        result = scan_pii("no pii here")
        assert result.valid is True
        assert result.score == 0.0
        assert result.decision == ScanDecision.ALLOW

    def test_block_result_is_invalid(self) -> None:
        result = scan_pii("user@example.com")
        assert result.valid is False
        assert result.decision == ScanDecision.BLOCK

    def test_matches_have_required_fields(self) -> None:
        result = scan_pii("user@example.com")
        assert result.matches
        m = result.matches[0]
        assert isinstance(m.pattern, str)
        assert isinstance(m.start_index, int)
        assert isinstance(m.end_index, int)
        assert isinstance(m.category, str)

    def test_reasons_include_type_and_id(self) -> None:
        result = scan_pii("user@example.com")
        # Reason format: "<TYPE> (<ID>)"
        assert any("EMAIL" in r for r in result.reasons)

    def test_block_on_any_false_scores_proportionally(self) -> None:
        result = scan_pii("user@example.com", block_on_any=False)
        assert result.score < 1.0

    def test_custom_pattern_merges_with_builtins(self) -> None:
        import re

        from glin_profanity.scanners.patterns.pii_patterns import PiiPattern

        custom = PiiPattern(
            id="PII-CUSTOM-001",
            type="other",
            pattern=re.compile(r"FAKE_ID_[0-9]{6}"),
        )
        scanner = PiiScanner(custom_patterns=[custom])
        result = scanner.scan("Your ID is FAKE_ID_123456")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "PII-CUSTOM-001" for m in result.matches)
