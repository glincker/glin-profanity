"""Tests for CJK automatic matching strategy."""



from glin_profanity import Filter
from glin_profanity.types.types import FilterConfig


class TestCjkAutomaticMatchingStrategy:
    @classmethod
    def setup_class(cls) -> None:
        cls.chinese_filter = Filter({"languages": ["chinese"]})
        cls.japanese_filter = Filter({"languages": ["japanese"]})
        cls.korean_filter = Filter({"languages": ["korean"]})
        cls.english_filter = Filter({"languages": ["english"]})
        cls.mixed_filter = Filter({"languages": ["english", "chinese"]})

    def test_chinese_detection_with_default_word_boundaries(self) -> None:
        assert self.chinese_filter.is_profane("你他妈的") is True
        assert len(self.chinese_filter.check_profanity("他妈的")["profane_words"]) > 0

    def test_unambiguous_single_char_detected_in_cjk_context(self) -> None:
        assert self.chinese_filter.is_profane("挨肏") is True
        assert self.chinese_filter.is_profane("肏她") is True
        assert self.chinese_filter.check_profanity("肏她")["profane_words"] == ["肏"]
        # Ambiguous single chars must not false-positive inside normal words.
        assert self.chinese_filter.is_profane("受到骚扰") is False
        assert self.chinese_filter.is_profane("性格很好") is False

    def test_japanese_detection_with_default_word_boundaries(self) -> None:
        assert self.japanese_filter.is_profane("このエッチな話") is True
        assert self.japanese_filter.is_profane("エッチ") is True

    def test_korean_detection_with_default_word_boundaries(self) -> None:
        assert self.korean_filter.is_profane("이 병신") is True
        assert self.korean_filter.is_profane("병신") is True

    def test_japanese_ascii_entries_still_use_latin_boundaries(self) -> None:
        assert self.japanese_filter.is_profane("hello xx world") is True
        assert self.japanese_filter.is_profane("xxtra") is False

    def test_latin_abbrev_in_cjk_context_detected(self) -> None:
        f = Filter(
            {
                "languages": [],
                "custom_words": ["jb"],
                "normalize_unicode": True,
                "detect_leetspeak": True,
            }
        )
        assert f.is_profane("我的jb大不大") is True
        # Must not over-flag a Latin substring inside a Latin word.
        ass = Filter(
            {
                "languages": [],
                "custom_words": ["ass"],
                "normalize_unicode": True,
                "detect_leetspeak": True,
            }
        )
        assert ass.is_profane("passion fruit") is False

    def test_detects_cjk_profanity_wrapped_in_or_adjacent_to_ascii(self) -> None:
        assert self.chinese_filter.is_profane("hello他妈的") is True
        assert self.chinese_filter.is_profane("123他妈的456") is True
        assert self.japanese_filter.is_profane("abcエッチdef") is True

    def test_does_not_flag_scunthorpe_or_classic_for_english_words(self) -> None:
        assert self.english_filter.is_profane("scunthorpe") is False
        assert self.english_filter.is_profane("classic") is False
        assert self.english_filter.is_profane("assassin") is False

    def test_still_detects_standalone_english_profanity(self) -> None:
        assert self.english_filter.is_profane("hello fuck world") is True

    def test_mixed_filter_does_not_false_positive_english_traps(self) -> None:
        assert self.mixed_filter.is_profane("scunthorpe") is False
        assert self.mixed_filter.is_profane("classic") is False

    def test_detects_both_english_and_chinese_in_one_filter(self) -> None:
        assert self.mixed_filter.is_profane("hello fuck") is True
        assert self.mixed_filter.is_profane("你他妈的") is True

    def test_replaces_chinese_profanity_without_requiring_b(self) -> None:
        filter_instance = Filter(
            {"languages": ["chinese"], "replace_with": "***"}
        )
        result = filter_instance.check_profanity("你他妈的")
        assert result["processed_text"] is not None
        assert "***" in result["processed_text"]
        assert "他妈的" not in result["processed_text"]


class TestCjkAhoCorasickParity:
    CASES = [
        "你他妈的",
        "他妈的",
        "エッチ",
        "병신",
        "hello fuck",
        "scunthorpe",
        "hello他妈的",
        "x乳x",
        "abcエッチdef",
    ]
    CONFIGS: list[FilterConfig] = [
        {"languages": ["chinese"]},
        {"languages": ["japanese"]},
        {"languages": ["korean"]},
        {"languages": ["english", "chinese"]},
    ]

