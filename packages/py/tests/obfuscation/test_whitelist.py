"""Interval whitelist tests."""

from __future__ import annotations

import pytest

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
