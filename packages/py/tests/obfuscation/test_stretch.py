"""Stretched letter collapsing tests."""

from __future__ import annotations

import pytest

from glin_profanity.filters.pipeline.mapped import from_text
from glin_profanity.filters.pipeline.stretch import stretch_transformer

from .helpers import english_index, make_filter

stretch = stretch_transformer(english_index())


def text(value: str) -> str:
    return stretch(from_text(value)).text


class TestStretchTransformer:
    @pytest.mark.parametrize(
        "value",
        [
            "aaaasshole",
            "assholeeee",
            "aaaaasshole",
            "aaaaaaaaaaaaaaasshole",
            "aasssshhoollee",
            "aaasssssshhhooollleee",
        ],
    )
    def test_collapses_to_the_dictionary_word(self, value: str) -> None:
        assert text(value) == "asshole"

    def test_keeps_legitimate_double_letters_in_the_target_word(self) -> None:
        assert text("bitttch") == "bitch"
        assert text("shiiiit") == "shit"

    @pytest.mark.parametrize(
        "value",
        ["ashole", "assume", "asset", "hello", "bookkeeper", "coooool", "asshole"],
    )
    def test_does_not_touch_words_that_are_not_a_stretched_dictionary_word(
        self, value: str
    ) -> None:
        assert text(value) == value

    def test_never_turns_a_shorter_word_into_a_longer_one(self) -> None:
        assert text("as") == "as"
        assert text("ass") == "ass"


class TestStretchInFilter:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "aaaasshole",
            "assholeeee",
            "aasssshhoollee",
            "You are such a aaaaasshole and everyone knows it",
            "@@@sshole",
            "fuuuuck",
            "shiiiit",
            "biiiitch",
            "baaaastard",
        ],
    )
    def test_flags(self, value: str) -> None:
        assert self.filter.is_profane(value)

    @pytest.mark.parametrize(
        "value",
        [
            "coooool",
            "sooooo good",
            "hellooooo everyone",
            "yesssss",
            "Mississippi",
            "assess the assets",
        ],
    )
    def test_keeps_clean(self, value: str) -> None:
        assert not self.filter.is_profane(value)

    def test_works_for_other_languages(self) -> None:
        assert make_filter(languages=["french"]).is_profane("coooonnard")
        assert make_filter(languages=["italian"]).is_profane("caaaazzo")

    def test_can_be_switched_off(self) -> None:
        assert not make_filter(obfuscation={"stretch": False}).is_profane("aaaasshole")
