"""Masked word resolution tests."""

from __future__ import annotations

import pytest

from glin_profanity.filters.pipeline.mapped import from_text
from glin_profanity.filters.pipeline.masking import masking_transformer

from .helpers import english_index, make_filter

mask = masking_transformer(english_index(), "*#@$%_?!", 1)


def text(value: str) -> str:
    return mask(from_text(value)).text


class TestMaskingTransformer:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("f*ck", "fuck"),
            ("f#ck", "fuck"),
            ("f%ck", "fuck"),
            ("f?ck", "fuck"),
            ("f_ck", "fuck"),
            ("f**k", "fuck"),
            ("s**t", "shit"),
            ("sh@t", "shit"),
            ("b*****d", "bastard"),
            ("b*st*rd", "bastard"),
            ("@sshole", "asshole"),
            ("*SSHOLE", "asshole"),
        ],
    )
    def test_resolves(self, value: str, expected: str) -> None:
        assert text(value) == expected

    def test_resolves_a_lone_first_letter_on_longer_words(self) -> None:
        assert text("holy f*** that") == "holy fuck that"

    @pytest.mark.parametrize(
        "value",
        [
            "****", "p@ssword", "cl@ss", "gr@ss", "$100", "5*3", "a*b",
            "email me@home", "C++", "wow!", "really?!",
        ],
    )  # fmt: skip
    def test_leaves_tokens_without_an_unambiguous_match_alone(self, value: str) -> None:
        assert text(value) == value

    def test_does_not_read_markdown_emphasis_as_masks(self) -> None:
        assert text("**Hook**") == "**Hook**"
        assert text("see **React Hook** now") == "see **React Hook** now"
        assert text("sh**") == "shit"

    def test_keeps_sentence_punctuation_at_token_edges_out_of_the_pattern(self) -> None:
        assert text("what the f*ck?") == "what the fuck?"
        assert text("f*ck!") == "fuck!"


class TestMaskingInFilter:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "f*ck you", "SH*T", "you b*tch", "what a b*stard", "f#ck", "sh%t",
            "@sshole", "you are an a**hole",
        ],
    )  # fmt: skip
    def test_flags(self, value: str) -> None:
        assert self.filter.is_profane(value)

    @pytest.mark.parametrize(
        "value",
        [
            "p@ssword reset",
            "cl@ss starts at 5",
            "use ** for bold and # for headings",
            "Rate: 50% off $5 items!!",
            "ask me@example.com",
            "5 * 3 = 15 and a*b",
            "The wildcard *.txt matches files",
            "| **React Hook** | yes | no |",
            "a **bold Hook** claim and __init__ plus __dunder__",
        ],
    )
    def test_keeps_clean(self, value: str) -> None:
        assert not self.filter.is_profane(value)

    def test_honours_custom_mask_characters(self) -> None:
        custom = make_filter(obfuscation={"masking": {"chars": "~"}})
        assert custom.is_profane("sh~t")
        assert not custom.is_profane("sh*t")

    def test_can_be_switched_off(self) -> None:
        assert not make_filter(obfuscation={"masking": False}).is_profane("sh*t")

    def test_min_visible_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GLIN_MASK_MIN_VISIBLE", "2")
        assert not make_filter().is_profane("holy f*** that")
        assert make_filter().is_profane("f*ck")
