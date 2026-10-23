"""Exotic leetspeak glyph tests."""

from __future__ import annotations

import pytest

from glin_profanity.utils.leetspeak import normalize_leetspeak

from .helpers import make_filter


def aggressive(value: str, **kwargs: bool) -> str:
    return normalize_leetspeak(value, level="aggressive", max_repeated=2, **kwargs)


class TestExoticGlyphs:
    def test_reads_pipe_underscore_pipe_as_u_before_pipe_underscore_as_l(self) -> None:
        assert aggressive("f|_|ck") == "fuck"

    def test_reads_pipe_angle_as_k_and_paren_as_c(self) -> None:
        assert aggressive("f|_|(|<") == "fuck"

    def test_reads_slash_backslash_as_a_and_double_as_m(self) -> None:
        assert aggressive("b/\\stard") == "bastard"
        assert aggressive("/\\/\\ad") == "mad"

    def test_reads_angle_pair_as_x(self) -> None:
        assert aggressive("se><") == "sex"

    def test_reads_pipe_and_one_as_l_on_request(self) -> None:
        assert aggressive("ho|e") == "hoie"
        assert aggressive("ho|e", ambiguous_as_l=True) == "hole"
        assert aggressive("ho1e", ambiguous_as_l=True) == "hole"


class TestExoticLeetInFilter:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        ["f|_|ck", "f|_|(|<", "@$$ho|e", "@5$ho|e", "b/\\stard", "a$$ho!e", "a$$ho1e"],
    )
    def test_flags(self, value: str) -> None:
        assert self.filter.is_profane(value)

    @pytest.mark.parametrize(
        "value",
        [
            "hello world",
            "Call 555-1234 or visit 1st street!",
            "I|you|we",
            "a/b testing",
            "H|k",
        ],
    )
    def test_keeps_clean(self, value: str) -> None:
        assert not self.filter.is_profane(value)

    def test_needs_ambiguous_leet_for_pipe_and_one_read_as_l(self) -> None:
        off = make_filter(obfuscation={"ambiguous_leet": False})
        assert not off.is_profane("@$$ho|e")
        assert off.is_profane("f|_|ck")

    @pytest.mark.parametrize("level", ["standard", "strict"])
    def test_keeps_pipe_usable_as_l_when_it_is_also_a_separator(
        self, level: str
    ) -> None:
        filter_ = make_filter(obfuscation=level)
        assert filter_.is_profane("@$$ho|e")
        assert filter_.is_profane("@5$ho|e")
