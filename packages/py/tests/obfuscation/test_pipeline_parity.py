"""Mapped normalizers must match the plain functions, and index maps must compose."""

from __future__ import annotations

import re
from collections.abc import Callable

import pytest

from glin_profanity.filters.normalize_text import (
    NormalizeConfig,
    normalize_for_matching,
)
from glin_profanity.filters.pipeline.mapped import (
    Edit,
    apply_edits,
    from_text,
    replace_regex,
    to_original_span,
)
from glin_profanity.filters.pipeline.normalizers import (
    leet_transformer,
    legacy_obfuscation_transformer,
    unicode_transformer,
)
from glin_profanity.types.types import LeetspeakLevel
from glin_profanity.utils.leetspeak import normalize_leetspeak
from glin_profanity.utils.unicode import normalize_unicode

from .helpers import lcg

SAMPLES = [
    "f4ck", "sh!t", "@$$ho|e", "f|_|ck", "f u c k you", "fuuuuck", "café naïve",
    "fυck", "ｆｕｃｋ", "f​u​c​k", "ph4t vv0rd", "/\\/\\ad",
    "cl@ss", "h3ll0 w0rld", "a b c d e", "f́uck", "ass﻿istant", "ok",
]  # fmt: skip

ALPHABET = "abcdefghij 0134578@$!|/\\()<>_.-*#éυа​́Ａ"


def random_text(rand: Callable[[], float]) -> str:
    length = 1 + int(rand() * 24)
    return "".join(ALPHABET[int(rand() * len(ALPHABET))] for _ in range(length))


def build_corpus() -> list[str]:
    nxt = lcg(20260101)
    return [*SAMPLES, *(random_text(nxt) for _ in range(400))]


CORPUS = build_corpus()
LEVELS: list[LeetspeakLevel] = ["basic", "moderate", "aggressive"]


class TestMappedNormalizersMatchPlainFunctions:
    def test_unicode(self) -> None:
        for text in CORPUS:
            assert unicode_transformer(from_text(text)).text == normalize_unicode(text)

    @pytest.mark.parametrize("level", LEVELS)
    def test_leetspeak(self, level: LeetspeakLevel) -> None:
        for text in CORPUS:
            for max_repeated in (1, 2):
                mapped = leet_transformer(level, max_repeated)(from_text(text)).text
                assert mapped == normalize_leetspeak(
                    text, level=level, max_repeated=max_repeated
                )

    def test_full_filter_normalization_chain(self) -> None:
        config = NormalizeConfig(True, True, "aggressive", False)
        for text in CORPUS:
            via_map = leet_transformer("aggressive", 1)(
                unicode_transformer(from_text(text))
            ).text
            assert via_map == normalize_for_matching(text, True, config)

    def test_legacy_obfuscation(self) -> None:
        config = NormalizeConfig(False, False, "moderate", True)
        for text in CORPUS:
            assert legacy_obfuscation_transformer(
                from_text(text)
            ).text == normalize_for_matching(text, False, config)


class TestIndexMaps:
    def test_keeps_identity_spans_when_nothing_changes(self) -> None:
        assert to_original_span(from_text("hello"), 1, 3) == (1, 3)

    def test_maps_deleted_and_rewritten_characters_back_to_the_source(self) -> None:
        removed = replace_regex(from_text("a<b>c"), re.compile(r"<b>"), lambda _: "")
        assert removed.text == "ac"
        assert to_original_span(removed, 0, 2) == (0, 5)

        rewritten = replace_regex(from_text("x/\\y"), re.compile(r"/\\"), lambda _: "a")
        assert rewritten.text == "xay"
        assert to_original_span(rewritten, 1, 2) == (1, 3)

    def test_composes_across_several_edits(self) -> None:
        step = apply_edits(
            from_text("f.u.c.k"), [Edit(1, 2, ""), Edit(3, 4, ""), Edit(5, 6, "")]
        )
        assert step.text == "fuck"
        assert to_original_span(step, 0, 4) == (0, 7)
        assert to_original_span(step, 2, 3) == (4, 5)
