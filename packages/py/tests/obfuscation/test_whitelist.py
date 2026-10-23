"""Interval whitelist tests."""

from __future__ import annotations

import pytest

from glin_profanity.filters.builtin_whitelist import BUILTIN_WHITELIST

from .helpers import make_filter


class TestWhitelist:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "cl@ss starts at 5",
            "gl@ss of water",
            "gr@ss is green",
            "m@ss transit",
            "b@ss guitar",
            "ass﻿istant",
            "my ass​istant called",
            "summa cum laude",
            "He graduated magna cum laude",
            "Twatt, Orkney",
            "pussy willow",
            "a great tit sat on the feeder",
            "blue tit nest box",
            "cock the hammer back",
        ],
    )
    def test_does_not_flag(self, value: str) -> None:
        assert not self.filter.is_profane(value)
        assert not self.filter.check_profanity(value)["contains_profanity"]

    @pytest.mark.parametrize(
        "value",
        [
            "Dick Van Dyke",
            "Dick Tracy",
            "Moby Dick is a novel",
            "Philip K. Dick",
            "Dick Grayson is Robin",
            "Rick Astley and Dick Clark",
        ],
    )
    def test_treats_the_name_as_a_name(self, value: str) -> None:
        assert not self.filter.is_profane(value)

    @pytest.mark.parametrize(
        "value",
        [
            "you are a dick",
            "dick",
            "What a dick move",
            "Shut up, you Dick Head",
            "stop being a dick, Dave",
            "you cum on my face",
            "ass",
            "you ass​hole",
            "a$$ and @ss",
        ],
    )
    def test_still_flags(self, value: str) -> None:
        assert self.filter.is_profane(value)

    def test_only_drops_the_overlapping_hit_not_others_in_the_same_text(self) -> None:
        result = self.filter.check_profanity("Moby Dick and a real shit")
        assert result["profane_words"] == ["shit"]

    def test_keeps_the_dictionary_itself_intact(self) -> None:
        assert self.filter.get_word_count() > 400
        assert self.filter.is_profane("dick")

    def test_accepts_extra_safe_phrases(self) -> None:
        custom = make_filter(whitelist=["shit happens", "Bastard Coffee"])
        assert not custom.is_profane("well, shit happens")
        assert not custom.is_profane("Bastard Coffee opens at nine")
        assert custom.is_profane("this is shit")

    def test_can_drop_the_built_in_list(self) -> None:
        strict = make_filter(obfuscation={"builtin_whitelist": False})
        assert strict.is_profane("cl@ss starts at 5")

    def test_applies_to_the_context_aware_path_too(self) -> None:
        aware = make_filter(enable_context_aware=True)
        assert not aware.check_profanity("cl@ss starts at 5")["contains_profanity"]


class TestProtectedRange:
    """A whitelist entry protects only its ambiguous word, never its neighbours."""

    @pytest.mark.parametrize(
        ("text", "words"),
        [
            ("Fuck Dick", ["fuck"]),
            ("Dick Fuck", ["fuck"]),
            ("Asshole Dick", ["asshole"]),
            ("Fuck Moby Dick", ["fuck"]),
            ("Moby Dick is great, fuck it", ["fuck"]),
            ("well cum laude shit", ["shit"]),
        ],
    )
    def test_other_word_still_flagged(self, text: str, words: list[str]) -> None:
        assert make_filter().check_profanity(text)["profane_words"] == words

    @pytest.mark.parametrize("text", ["You Dick", "what a Big Dick", "Hey Dick Head"])
    def test_insult_context_flagged(self, text: str) -> None:
        assert make_filter().is_profane(text)

    @pytest.mark.parametrize(
        "text",
        [
            "Moby Dick",
            "Dick Van Dyke",
            "Twatt, Orkney",
            "cum laude",
            "pussy willow",
            "cock the hammer back",
        ],
    )
    def test_names_stay_clean(self, text: str) -> None:
        assert not make_filter().is_profane(text)

    SAMPLES = (
        "class",
        "assistant",
        "summa cum laude",
        "pussy willow",
        "great tit",
        "bastard file",
        "jackass penguin",
        "cock the hammer",
        "anal fissure",
        "Twatt, Orkney",
        "Moby Dick",
        "Dick Van Dyke",
    )

    def test_every_entry_has_a_sample(self) -> None:
        import re

        for entry in BUILTIN_WHITELIST:
            source = f"{entry.before}{entry.protect}{entry.after}"
            flags = 0 if entry.case_sensitive else re.IGNORECASE
            regex = re.compile(rf"\b(?:{source})\b", flags)
            assert any(regex.search(s) for s in self.SAMPLES), entry

    @pytest.mark.parametrize("sample", SAMPLES)
    def test_surrounding_profanity_flagged(self, sample: str) -> None:
        f = make_filter()
        for text in (f"fuck {sample}", f"{sample} fuck", f"shit {sample} asshole"):
            words = f.check_profanity(text)["profane_words"]
            assert "fuck" in words or "shit" in words, text

    def test_user_entries_protect_own_span_only(self) -> None:
        f = make_filter(whitelist=["shit happens"])
        assert f.check_profanity("fuck shit happens")["profane_words"] == ["fuck"]
        assert f.check_profanity("shit happens fuck")["profane_words"] == ["fuck"]


class TestUserWhitelistEdges:
    """User entries use the same word edge rules as dictionary words."""

    @pytest.mark.parametrize(
        ("entry", "text", "upper"),
        [
            ("über", "das ist über gut", "ÜBER"),
            ("тест", "это тест системы", "ТЕСТ"),
            ("اختبار", "هذا اختبار جيد", "اختبار"),
            ("c++", "c++ is fun", "C++"),
        ],
    )
    def test_entry_matches(self, entry: str, text: str, upper: str) -> None:
        word = "c" if entry == "c++" else entry
        assert make_filter(custom_words=[word]).is_profane(text)
        safe = make_filter(custom_words=[word], whitelist=[entry])
        assert not safe.is_profane(text)
        assert not safe.check_profanity(text)["contains_profanity"]
        if entry != "اختبار":
            assert not safe.is_profane(text.replace(entry, upper))

    def test_no_match_inside_longer_word(self) -> None:
        safe = make_filter(custom_words=["тест"], whitelist=["тест"])
        assert not safe.is_profane("это контест системы")
        other = make_filter(custom_words=["тест"], whitelist=["тес"])
        assert other.is_profane("это тест системы")
