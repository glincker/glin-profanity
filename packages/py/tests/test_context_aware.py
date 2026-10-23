"""Tests for context-aware filtering."""

from glin_profanity import Filter, SeverityLevel


class TestContextAwareFiltering:
    def setup_method(self) -> None:
        self.filter = Filter(
            {
                "enable_context_aware": True,
                "context_window": 3,
                "confidence_threshold": 0.7,
                "languages": ["english"],
                "log_profanity": False,
            }
        )


    def test_gaming_terms_with_positive_context(self) -> None:
        gaming_filter = Filter(
            {
                "enable_context_aware": True,
                "context_window": 3,
                "domain_whitelists": {
                    "english": ["player", "gaming", "game"],
                },
                "languages": ["english"],
            }
        )

        test_cases = [
            "You are a badass player!",
            "That was a sick move in the game",
            "Your gaming skills are insane!",
        ]

        for text in test_cases:
            result = gaming_filter.check_profanity(text)
            assert result["contains_profanity"] is False
            matches = result.get("matches")
            if matches:
                assert any(m.get("is_whitelisted") for m in matches)

    def test_negative_context_detection(self) -> None:
        test_cases = [
            "You are a fucking idiot",
            "Such a stupid ass",
            "You piece of shit",
        ]

        for text in test_cases:
            result = self.filter.check_profanity(text)
            assert result["contains_profanity"] is True
            assert len(result["profane_words"]) > 0

            context_score = result.get("context_score")
            if context_score is not None:
                assert context_score < 0.7


    def test_severity_levels_without_context(self) -> None:
        severity_filter = Filter(
            {
                "enable_context_aware": False,
                "severity_levels": True,
                "languages": ["english"],
            }
        )

        result = severity_filter.check_profanity("This is fucking annoying")
        assert result["contains_profanity"] is True
        severity_map = result.get("severity_map")
        assert severity_map is not None
        assert SeverityLevel.EXACT in severity_map.values()


    def test_is_profane_and_check_profanity_agree_with_context(self) -> None:
        result = self.filter.check_profanity("You are a fucking idiot")
        assert (
            self.filter.is_profane("You are a fucking idiot")
            == result["contains_profanity"]
        )
        assert result["contains_profanity"] is True

        clean_result = self.filter.check_profanity("This movie is the bomb")
        assert (
            self.filter.is_profane("This movie is the bomb")
            == clean_result["contains_profanity"]
        )
        assert clean_result["contains_profanity"] is False

    def test_custom_confidence_threshold(self) -> None:
        strict_filter = Filter(
            {
                "enable_context_aware": True,
                "confidence_threshold": 0.9,
                "languages": ["english"],
            }
        )

        result = strict_filter.check_profanity("This movie is fucking awesome")
        assert result is not None
        assert result["reason"] is not None

    def test_custom_context_window(self) -> None:
        narrow_filter = Filter(
            {
                "enable_context_aware": True,
                "context_window": 1,
                "languages": ["english"],
            }
        )

        result = narrow_filter.check_profanity(
            "Amazing! This movie is fucking awesome for sure"
        )
        assert result is not None
        assert result["reason"] is not None

    def test_empty_string(self) -> None:
        result = self.filter.check_profanity("")
        assert result["contains_profanity"] is False
        assert result["profane_words"] == []

    def test_single_word(self) -> None:
        result = self.filter.check_profanity("shit")
        assert result is not None
        assert result["reason"] is not None

    def test_very_long_text(self) -> None:
        long_text = (
            "This is a very long text that goes on and on about how this movie is "
            "absolutely fucking amazing and everyone should watch it because it is "
            "amazing and fantastic and wonderful"
        ) * 5

        result = self.filter.check_profanity(long_text)
        assert result is not None
        assert result["reason"] is not None
