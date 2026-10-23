"""Tests for context-aware optimization (AC candidate discovery + context filter)."""

from glin_profanity import Filter


class TestContextOptimization:
    def setup_method(self) -> None:
        self.filter = Filter(
            {
                "enable_context_aware": True,
                "languages": ["english"],
            }
        )


    def test_is_profane_applies_context_filtering(self) -> None:
        assert self.filter.is_profane("This movie is the bomb") is False
        assert self.filter.is_profane("The bomb exploded and shit happened") is True
        assert self.filter.is_profane("You are a fucking idiot") is True

    def test_unrelated_positive_phrase_does_not_whitelist_other_profanity(self) -> None:
        text = "The bomb exploded and shit happened"
        result = self.filter.check_profanity(text)

        assert result["contains_profanity"] is True
        assert "shit" in result["profane_words"]

    def test_relevant_positive_phrase_is_whitelisted(self) -> None:
        text = "This movie is the bomb"
        result = self.filter.check_profanity(text)

        assert result["contains_profanity"] is False
