"""Tests for profane_words collection from normalized tier with fallbacks."""

from glin_profanity import Filter


class TestAccentFoldedAliases:
    def test_accented_entry_matches_diacritic_free_text(self) -> None:
        f = Filter(
            {
                "languages": [],
                "custom_words": ["erección"],
                "normalize_unicode": True,
                "detect_leetspeak": True,
            }
        )
        assert f.check_profanity("le muerdo la ereccion")["contains_profanity"] is True
        assert f.check_profanity("le muerdo la erección")["contains_profanity"] is True

    def test_short_accented_fold_not_aliased(self) -> None:
        # "año" folds to "ano" (length 3 < floor) so no alias is created,
        # preventing año(year) from over-flagging as ano.
        f = Filter(
            {
                "languages": [],
                "custom_words": ["año"],
                "normalize_unicode": True,
                "detect_leetspeak": True,
            }
        )
        assert f.check_profanity("el ano")["contains_profanity"] is False


class TestLegacyPathProfaneWords:
    def test_word_boundaries_disabled_populates_fuzzy_words(self) -> None:
        legacy = Filter(
            {
                "languages": ["english"],
                "word_boundaries": False,
                "fuzzy_tolerance_level": 0.6,
                "disable_aho_corasick": True,
            }
        )
        result = legacy.check_profanity("This movie is the bomb")
        assert result["contains_profanity"] is True
        assert len(result["profane_words"]) > 0
        is_profane = legacy.is_profane("This movie is the bomb")
        assert is_profane == result["contains_profanity"]


