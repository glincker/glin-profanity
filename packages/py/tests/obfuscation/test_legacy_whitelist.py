"""User whitelist and ignore words on the legacy fuzzy path (word_boundaries off)."""

from __future__ import annotations

from typing import Any

import pytest

from .helpers import make_filter

CONFIGS: list[dict[str, Any]] = [
    {"allow_obfuscated_match": True},
    {"word_boundaries": False},
]


@pytest.mark.parametrize("config", CONFIGS)
def test_user_whitelist_is_honored(config: dict[str, Any]) -> None:
    f = make_filter(**config, whitelist=["shit happens"], replace_with="*")
    assert not f.is_profane("well, shit happens")
    assert not f.check_profanity("well, shit happens")["contains_profanity"]
    assert f.is_profane("this is shit")
    out = f.check_profanity("shit happens, you shit")
    assert out.get("processed_text") == "shit happens, you *"
    words = f.check_profanity("fuck shit happens")["profane_words"]
    assert "fuck" in words
    assert "shit" not in words


def test_context_aware_path() -> None:
    f = make_filter(
        allow_obfuscated_match=True,
        whitelist=["shit happens"],
        enable_context_aware=True,
    )
    assert not f.check_profanity("well, shit happens")["contains_profanity"]
    assert f.check_profanity("this is shit")["contains_profanity"]


def test_ignore_words() -> None:
    base: dict[str, Any] = {
        "allow_obfuscated_match": True,
        "languages": [],
        "custom_words": ["zorp"],
    }
    assert make_filter(**base).is_profane("a zorp here")
    assert not make_filter(**base, ignore_words=["zorp"]).is_profane("a zorp here")
