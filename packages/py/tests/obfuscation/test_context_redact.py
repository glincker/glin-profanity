"""Context-aware parity with the plain path, and hit-based redaction."""

from __future__ import annotations

from typing import Any

import pytest

from .helpers import make_filter

INPUTS = [
    "what the f.u.c.k was that",
    "fuuuuuck you",
    "f*ck this",
    "&#102;&#117;&#99;&#107; off",
    "you are a sh1t",
    "Moby Dick is great, you dick",
    "plain old fuck",
    "a clean sentence",
]


@pytest.mark.parametrize("text", INPUTS)
def test_same_masking_as_plain_path(text: str) -> None:
    plain = make_filter(replace_with="*").check_profanity(text)
    aware_filter = make_filter(replace_with="*", enable_context_aware=True)
    aware = aware_filter.check_profanity(text)
    assert aware["contains_profanity"] == plain["contains_profanity"]
    assert aware.get("processed_text") == plain.get("processed_text")


def test_obfuscated_match_is_masked() -> None:
    aware = make_filter(replace_with="*", enable_context_aware=True)
    result = aware.check_profanity("what the f.u.c.k was that")
    assert result.get("processed_text") == "what the * was that"


@pytest.mark.parametrize(
    "overrides",
    [
        {"obfuscation": "off"},
        {"obfuscation": "off", "detect_leetspeak": True},
        {"obfuscation": "standard"},
    ],
)
def test_superset_of_plain_path(overrides: dict[str, Any]) -> None:
    plain = make_filter(**overrides)
    aware = make_filter(**overrides, enable_context_aware=True)
    for text in INPUTS:
        if plain.check_profanity(text)["contains_profanity"]:
            assert aware.check_profanity(text)["contains_profanity"], text


def test_stretched_word_found_with_obfuscation_off() -> None:
    plain = make_filter(obfuscation="off").check_profanity("fuuuuuck")
    aware = make_filter(obfuscation="off", enable_context_aware=True).check_profanity(
        "fuuuuuck"
    )
    assert aware["contains_profanity"] == plain["contains_profanity"]


def test_redaction_skips_whitelisted_name() -> None:
    f = make_filter(replace_with="*")
    result = f.check_profanity("Moby Dick is great, you dick")
    assert result.get("processed_text") == "Moby Dick is great, you *"


def test_masks_every_occurrence() -> None:
    f = make_filter(replace_with="*")
    result = f.check_profanity("shit and Shit and SHIT")
    assert result.get("processed_text") == "* and * and *"


def test_legacy_word_masking_without_boundaries() -> None:
    f = make_filter(replace_with="*", word_boundaries=False)
    assert f.check_profanity("some shit here").get("processed_text") == "some * here"
