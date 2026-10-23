"""
Tests for SecretsScanner — ported from JS secrets.test.ts on release.

IMPORTANT: All test fixtures use obvious-fake placeholder content that matches
regex format but will NOT trip GitHub Push Protection.
"""


from glin_profanity.scanners.base import ScanDecision
from glin_profanity.scanners.secrets import SecretsScanner, scan_secrets
from glin_profanity.scanners.vault import Vault

# ---------------------------------------------------------------------------
# AWS
# ---------------------------------------------------------------------------


class TestSecretsAws:
    def test_aws_access_key_id_blocked(self) -> None:
        # AKIA + 16 uppercase alphanumerics — structurally valid format, fake value
        key = "AKIA" + "A" * 16
        result = scan_secrets(f"My key is {key}")
        assert result.decision == ScanDecision.BLOCK
        assert result.valid is False
        assert any(m.pattern == "SEC-AWS-001" for m in result.matches)

    def test_aws_access_key_category_is_family(self) -> None:
        key = "AKIA" + "B" * 16
        result = scan_secrets(key)
        match = next(m for m in result.matches if m.pattern == "SEC-AWS-001")
        # category carries family, not severity
        assert match.category == "aws"

    def test_clean_text_allows(self) -> None:
        result = scan_secrets("Hello, this is a normal message.")
        assert result.decision == ScanDecision.ALLOW
        assert result.valid is True
        assert result.score == 0.0


# ---------------------------------------------------------------------------
# GitHub
# ---------------------------------------------------------------------------


class TestSecretsGitHub:
    def test_github_pat_classic_blocked(self) -> None:
        # ghp_ + 36 alphanumeric — fake value
        token = "ghp_" + "0" * 36
        result = scan_secrets(token)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-GH-001" for m in result.matches)

    def test_github_fine_grained_pat_blocked(self) -> None:
        token = "github_pat_" + "0" * 60
        result = scan_secrets(token)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-GH-002" for m in result.matches)

    def test_github_oauth_token_blocked(self) -> None:
        token = "gho_" + "0" * 36
        result = scan_secrets(token)
        assert result.decision == ScanDecision.BLOCK

    def test_github_app_token_blocked(self) -> None:
        token = "ghu_" + "0" * 36
        result = scan_secrets(token)
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------


class TestSecretsOpenAi:
    def test_openai_key_blocked(self) -> None:
        # sk- + 20 alphanum + T3BlbkFJ + 20 alphanum — fake structurally valid
        key = "sk-" + "A" * 20 + "T3BlbkFJ" + "B" * 20
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-OPENAI-001" for m in result.matches)

    def test_openai_project_key_blocked(self) -> None:
        key = "sk-proj-" + "A" * 50
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-OPENAI-002" for m in result.matches)


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------


class TestSecretsAnthropic:
    def test_anthropic_key_blocked(self) -> None:
        # sk-ant-api03- + 93 chars — fake structurally valid
        key = "sk-ant-api03-" + "A" * 93
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-ANTHROPIC-001" for m in result.matches)

    def test_anthropic_short_form_blocked(self) -> None:
        key = "sk-ant-" + "A" * 20
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# Stripe
# ---------------------------------------------------------------------------


class TestSecretsStripe:
    def test_stripe_live_key_blocked(self) -> None:
        # sk_live_ + 24 alphanum — fake
        key = "sk_live_" + "0" * 24
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-STRIPE-001" for m in result.matches)
        match = next(m for m in result.matches if m.pattern == "SEC-STRIPE-001")
        assert match.category == "stripe"

    def test_stripe_test_key_blocked(self) -> None:
        key = "sk_test_" + "0" * 24
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-STRIPE-002" for m in result.matches)

    def test_stripe_publishable_key_blocked(self) -> None:
        key = "pk_live_" + "0" * 24
        result = scan_secrets(key)
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# Slack
# ---------------------------------------------------------------------------


class TestSecretsSlack:
    def test_slack_bot_token_blocked(self) -> None:
        # xoxb- + 10 digits - 10 digits - 24 alphanumeric
        token = "xoxb-" + "0" * 10 + "-" + "0" * 10 + "-" + "A" * 24
        result = scan_secrets(token)
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-SLACK-001" for m in result.matches)

    def test_slack_webhook_blocked(self) -> None:
        webhook = "https://hooks.slack.com/services/T" + "A" * 9 + "/B" + "A" * 9 + "/" + "A" * 24
        result = scan_secrets(webhook)
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# Private Key / JWT
# ---------------------------------------------------------------------------


class TestSecretsCrypto:
    def test_rsa_private_key_blocked(self) -> None:
        result = scan_secrets("-----BEGIN RSA PRIVATE KEY-----\nFAKEDATA\n-----END RSA PRIVATE KEY-----")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-KEY-001" for m in result.matches)

    def test_openssh_private_key_blocked(self) -> None:
        result = scan_secrets("-----BEGIN OPENSSH PRIVATE KEY-----\nFAKEDATA")
        assert result.decision == ScanDecision.BLOCK

    def test_jwt_with_high_entropy_blocked(self) -> None:
        # Structurally valid JWT-like token with high entropy
        header = "eyJhbGciOiJIUzI1NiJ9"
        payload = "eyJzdWIiOiJ0ZXN0dXNlciJ9"
        sig = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        jwt = f"{header}.{payload}.{sig}"
        result = scan_secrets(jwt)
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# Entropy gating
# ---------------------------------------------------------------------------


class TestSecretsEntropyGating:
    def test_low_entropy_base64_not_blocked(self) -> None:
        # A repeated Base64 string near keyword — low entropy, should not block
        text = "key = " + "A" * 32
        result = scan_secrets(text)
        # Low entropy patterns with entropyCheck should not fire on repeated chars
        # The generic SEC-GEN-004 pattern has entropyCheck, so 'AAAA...' should not fire
        assert result.decision == ScanDecision.ALLOW

    def test_high_entropy_base64_near_keyword_blocked(self) -> None:
        # A high-entropy Base64 string near a secret keyword
        text = 'secret = "dGhpcyBpcyBhIHJlYWxseSBsb25nIHNlY3JldCBrZXkgd2l0aCBoaWdoIGVudHJvcHk="'
        result = scan_secrets(text)
        assert result.decision == ScanDecision.BLOCK


# ---------------------------------------------------------------------------
# Vault redact + restore roundtrip
# ---------------------------------------------------------------------------


class TestSecretsVaultRoundtrip:
    def test_redact_and_restore_roundtrip(self) -> None:
        vault = Vault()
        key = "AKIA" + "C" * 16
        original_text = f"My AWS key is {key} please keep it safe."

        scanner = SecretsScanner(redact=True, vault=vault)
        result = scanner.scan(original_text)

        assert result.decision == ScanDecision.BLOCK
        assert key not in result.sanitized
        assert "[REDACTED_" in result.sanitized

        restored = vault.restore(result.sanitized)
        assert restored == original_text

    def test_redact_without_vault_uses_generic_placeholder(self) -> None:
        key = "AKIA" + "D" * 16
        scanner = SecretsScanner(redact=True)
        result = scanner.scan(f"key={key}")
        assert "[REDACTED]" in result.sanitized

    def test_multiple_secrets_get_distinct_placeholders(self) -> None:
        vault = Vault()
        key1 = "AKIA" + "E" * 16
        key2 = "AKIA" + "F" * 16
        scanner = SecretsScanner(redact=True, vault=vault)
        result = scanner.scan(f"{key1} and {key2}")
        assert "[REDACTED_AWS_1]" in result.sanitized
        assert "[REDACTED_AWS_2]" in result.sanitized

    def test_vault_restore_case_insensitive(self) -> None:
        vault = Vault()
        key = "AKIA" + "G" * 16
        scanner = SecretsScanner(redact=True, vault=vault)
        result = scanner.scan(key)
        placeholder = result.sanitized
        # Force case change
        upper = placeholder.upper()
        restored = vault.restore(upper, strategy="case_insensitive")
        assert restored == key


# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------


class TestSecretsOptions:
    def test_block_on_any_false_uses_proportional_score(self) -> None:
        key = "AKIA" + "H" * 16
        result = scan_secrets(key, block_on_any=False)
        assert result.score < 1.0

    def test_scanner_name_is_secrets(self) -> None:
        scanner = SecretsScanner()
        assert scanner.name == "secrets"

    def test_result_scanner_field_matches_name(self) -> None:
        scanner = SecretsScanner()
        result = scanner.scan("hello world")
        assert result.scanner == "secrets"

    def test_allow_result_shape(self) -> None:
        result = scan_secrets("nothing sensitive here")
        assert result.valid is True
        assert result.score == 0.0
        assert result.matches == []

    def test_matches_contain_required_fields(self) -> None:
        key = "AKIA" + "I" * 16
        result = scan_secrets(key)
        assert result.matches
        m = result.matches[0]
        assert isinstance(m.pattern, str)
        assert isinstance(m.start_index, int)
        assert isinstance(m.end_index, int)
        assert isinstance(m.category, str)

    def test_custom_pattern_merges_with_builtins(self) -> None:
        import re

        from glin_profanity.scanners.patterns.secret_patterns import SecretPattern

        custom = SecretPattern(
            id="SEC-CUSTOM-001",
            name="Custom Test Pattern",
            pattern=re.compile(r"FAKESECRET_[A-Z]{10}"),
            severity="high",
            family="custom_test",
        )
        scanner = SecretsScanner(custom_patterns=[custom])
        result = scanner.scan("token: FAKESECRET_ABCDEFGHIJ")
        assert result.decision == ScanDecision.BLOCK
        assert any(m.pattern == "SEC-CUSTOM-001" for m in result.matches)
        match = next(m for m in result.matches if m.pattern == "SEC-CUSTOM-001")
        assert match.category == "custom_test"
