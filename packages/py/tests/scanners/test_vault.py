"""
Tests for Vault — ported from JS vault.test.ts on release.
"""


from glin_profanity.scanners.vault import Vault

# ---------------------------------------------------------------------------
# Basic store / restore
# ---------------------------------------------------------------------------


class TestVaultBasic:
    def test_store_returns_placeholder(self) -> None:
        vault = Vault()
        placeholder = vault.store("email", "user@example.com")
        assert placeholder == "[REDACTED_EMAIL_1]"

    def test_store_increments_counter(self) -> None:
        vault = Vault()
        p1 = vault.store("email", "a@example.com")
        p2 = vault.store("email", "b@example.com")
        assert p1 == "[REDACTED_EMAIL_1]"
        assert p2 == "[REDACTED_EMAIL_2]"

    def test_distinct_types_have_independent_counters(self) -> None:
        vault = Vault()
        e1 = vault.store("email", "a@example.com")
        p1 = vault.store("phone", "+12025551234")
        e2 = vault.store("email", "b@example.com")
        assert e1 == "[REDACTED_EMAIL_1]"
        assert p1 == "[REDACTED_PHONE_1]"
        assert e2 == "[REDACTED_EMAIL_2]"

    def test_type_is_normalized_to_upper(self) -> None:
        vault = Vault()
        placeholder = vault.store("Credit Card", "4111 1111 1111 1111")
        assert placeholder == "[REDACTED_CREDIT_CARD_1]"

    def test_size_reflects_stored_entries(self) -> None:
        vault = Vault()
        assert vault.size() == 0
        vault.store("email", "x@example.com")
        assert vault.size() == 1
        vault.store("phone", "+12025551234")
        assert vault.size() == 2

    def test_clear_resets_entries_and_counters(self) -> None:
        vault = Vault()
        vault.store("email", "x@example.com")
        vault.clear()
        assert vault.size() == 0
        placeholder = vault.store("email", "y@example.com")
        # Counter reset — should be _1 again
        assert placeholder == "[REDACTED_EMAIL_1]"

    def test_get_entries_returns_snapshot(self) -> None:
        vault = Vault()
        vault.store("email", "test@example.com")
        entries = vault.get_entries()
        assert len(entries) == 1
        assert entries[0]["placeholder"] == "[REDACTED_EMAIL_1]"
        assert entries[0]["original"] == "test@example.com"


# ---------------------------------------------------------------------------
# Restore strategy: exact
# ---------------------------------------------------------------------------


class TestVaultRestoreExact:
    def test_exact_restore_replaces_placeholder(self) -> None:
        vault = Vault()
        original = "user@example.com"
        placeholder = vault.store("email", original)
        text = f"Contact: {placeholder} for info."
        restored = vault.restore(text, strategy="exact")
        assert restored == f"Contact: {original} for info."

    def test_exact_restore_multiple_entries(self) -> None:
        vault = Vault()
        p1 = vault.store("email", "alice@example.com")
        p2 = vault.store("email", "bob@example.com")
        text = f"{p1} and {p2}"
        restored = vault.restore(text)
        assert restored == "alice@example.com and bob@example.com"

    def test_exact_restore_unchanged_if_no_placeholder(self) -> None:
        vault = Vault()
        vault.store("email", "test@example.com")
        text = "No placeholders here."
        assert vault.restore(text) == text

    def test_exact_restore_case_sensitive(self) -> None:
        vault = Vault()
        # Use lowercase type so the placeholder has mixed case when uppercased
        p = vault.store("apikey", "test_secret_value")
        # p = "[REDACTED_APIKEY_1]" — already uppercase, so mutate one bracket
        mutated = p.replace("[", "(").replace("]", ")")
        # Mutated form should NOT be restored by exact match
        assert vault.restore(mutated, strategy="exact") == mutated


# ---------------------------------------------------------------------------
# Restore strategy: case_insensitive
# ---------------------------------------------------------------------------


class TestVaultRestoreCaseInsensitive:
    def test_case_insensitive_restores_upper_placeholder(self) -> None:
        vault = Vault()
        original = "user@example.com"
        placeholder = vault.store("email", original)
        text = placeholder.upper()
        restored = vault.restore(text, strategy="case_insensitive")
        assert restored == original

    def test_case_insensitive_restores_mixed_case(self) -> None:
        vault = Vault()
        original = "secret_value"
        placeholder = vault.store("token", original)
        mixed = placeholder.lower()
        restored = vault.restore(mixed, strategy="case_insensitive")
        assert restored == original

    def test_case_insensitive_handles_no_match(self) -> None:
        vault = Vault()
        vault.store("email", "test@example.com")
        text = "nothing to match"
        assert vault.restore(text, strategy="case_insensitive") == text


# ---------------------------------------------------------------------------
# Restore strategy: fuzzy
# ---------------------------------------------------------------------------


class TestVaultRestoreFuzzy:
    def test_fuzzy_restores_exact_match(self) -> None:
        vault = Vault()
        original = "secret123"
        placeholder = vault.store("token", original)
        restored = vault.restore(placeholder, strategy="fuzzy")
        assert restored == original

    def test_fuzzy_tolerates_single_typo(self) -> None:
        vault = Vault()
        original = "user@example.com"
        placeholder = vault.store("email", original)
        # Introduce a one-character typo in the placeholder
        typo = placeholder[:5] + "X" + placeholder[6:]
        # fuzzy with tolerance 3 should still restore
        restored = vault.restore(typo, strategy="fuzzy")
        assert restored == original

    def test_fuzzy_tolerates_two_typos(self) -> None:
        vault = Vault()
        original = "test_value"
        placeholder = vault.store("secret", original)
        # Introduce two character changes
        typo = placeholder[:4] + "XY" + placeholder[6:]
        restored = vault.restore(typo, strategy="fuzzy")
        assert restored == original

    def test_fuzzy_does_not_restore_wildly_different_string(self) -> None:
        vault = Vault()
        vault.store("email", "test@example.com")
        text = "completely_different_string_that_should_not_match"
        # Should not corrupt the text
        restored = vault.restore(text, strategy="fuzzy")
        assert restored == text


# ---------------------------------------------------------------------------
# Restore strategy: combined
# ---------------------------------------------------------------------------


class TestVaultRestoreCombined:
    def test_combined_prefers_exact(self) -> None:
        vault = Vault()
        original = "secret_value"
        placeholder = vault.store("token", original)
        restored = vault.restore(placeholder, strategy="combined")
        assert restored == original

    def test_combined_falls_back_to_case_insensitive(self) -> None:
        vault = Vault()
        original = "secret_value"
        placeholder = vault.store("token", original)
        upper = placeholder.upper()
        restored = vault.restore(upper, strategy="combined")
        assert restored == original

    def test_combined_falls_back_to_fuzzy(self) -> None:
        vault = Vault()
        original = "user@example.com"
        placeholder = vault.store("email", original)
        # Use a typo that's not simply a case change
        typo = placeholder[:4] + "X" + placeholder[5:]
        restored = vault.restore(typo, strategy="combined")
        assert restored == original

    def test_combined_unchanged_if_no_match(self) -> None:
        vault = Vault()
        vault.store("email", "test@example.com")
        text = "nothing_remotely_similar"
        assert vault.restore(text, strategy="combined") == text


# ---------------------------------------------------------------------------
# Integration with SecretsScanner
# ---------------------------------------------------------------------------


class TestVaultIntegrationWithSecrets:
    def test_secrets_redact_and_vault_restore(self) -> None:
        from glin_profanity.scanners.secrets import SecretsScanner

        vault = Vault()
        key = "AKIA" + "Z" * 16
        text = f"AWS key: {key}"
        scanner = SecretsScanner(redact=True, vault=vault)
        result = scanner.scan(text)
        assert key not in result.sanitized
        assert vault.size() == 1
        restored = vault.restore(result.sanitized)
        assert restored == text

    def test_pii_redact_and_vault_restore(self) -> None:
        from glin_profanity.scanners.pii import PiiScanner

        vault = Vault()
        scanner = PiiScanner(redact=True, vault=vault)
        text = "Email: admin@example.com, IP: 10.0.0.1"
        result = scanner.scan(text)
        assert "admin@example.com" not in result.sanitized
        restored = vault.restore(result.sanitized)
        assert "admin@example.com" in restored
