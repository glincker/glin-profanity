"""Separator joining tests."""

from __future__ import annotations

import pytest

from glin_profanity.filters.pipeline.mapped import from_text, to_original_span
from glin_profanity.filters.pipeline.separators import separator_transformer

from .helpers import english_index, make_filter

join = separator_transformer(english_index(), ".,/|_-", False, 4)


def text(value: str) -> str:
    return join(from_text(value)).text


class TestSeparatorTransformer:
    @pytest.mark.parametrize(
        "value", ["f.u.c.k", "f,u,c,k", "f/u/c/k", "f|u|c|k", "f_u_c_k", "f-u-c-k"]
    )
    def test_joins(self, value: str) -> None:
        assert text(value) == "fuck"

    def test_joins_single_dot_splits_and_rotating_separators(self) -> None:
        assert text("f.uck") == "fuck"
        assert text("a.sshole") == "asshole"
        assert text("f.u_c-k") == "fuck"

    def test_joins_spaces_only_inside_a_chain_of_other_separators(self) -> None:
        assert text("b.i_t-c h") == "bitch"
        assert text("s h i t") == "shit"
        assert text("fu ck") == "fu ck"

    def test_joins_leet_fragments(self) -> None:
        assert text("5.h.i.t") == "5hit"

    def test_keeps_sentence_boundaries_and_abbreviations_as_they_were(self) -> None:
        assert text("the end.fuck") == "the end.fuck"
        assert text("e.g. a list, i.e. this") == "e.g. a list, i.e. this"
        assert text("B.S. degree, U.S.A. and p.m.") == "B.S. degree, U.S.A. and p.m."
        assert text("well-known snake_case_name") == "well-known snake_case_name"
        assert text("3.14, 1,000 and v1.2.3") == "3.14, 1,000 and v1.2.3"

    def test_keeps_a_boundary_before_an_underscore_neighbour(self) -> None:
        assert text("x_f_u_c_k") == "x fuck"

    def test_maps_the_joined_word_back_over_the_separators(self) -> None:
        mapped = join(from_text("say f.u.c.k now"))
        assert to_original_span(mapped, 4, 8) == (4, 11)


class TestSeparatorsInFilter:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "what the f.u.c.k was that",
            "b,i,t,c,h",
            "a|s|s|h|o|l|e",
            "b_a_s_t_a_r_d",
            "s-h-i-t",
            "b.itch",
            "f.u_c-k",
            "5.h.i.t",
            "You are such a s h i t and everyone knows it",
        ],
    )
    def test_flags(self, value: str) -> None:
        assert self.filter.is_profane(value)

    @pytest.mark.parametrize(
        "value",
        [
            "The end.Fuel is cheap",
            "Meet me at 5.30 p.m. on Main St.",
            "e.g. apples, i.e. fruit",
            "a.k.a. the boss",
            "Visit www.example.com/class-notes_v2",
            "step-by-step, one-to-one, pass-through",
            "Ph.D. in c.s. from M.I.T.",
        ],
    )
    def test_keeps_clean(self, value: str) -> None:
        assert not self.filter.is_profane(value)

    def test_works_for_other_languages(self) -> None:
        assert make_filter(languages=["spanish"]).is_profane("m.i.e.r.d.a")
        assert make_filter(languages=["german"]).is_profane("a.r.s.c.h")

    def test_can_be_switched_off(self) -> None:
        assert not make_filter(obfuscation={"separators": False}).is_profane("f.u.c.k")
        assert not make_filter(obfuscation="off").is_profane("f.u.c.k")

    def test_strict_level_allows_a_space_after_one_other_separator(self) -> None:
        assert make_filter(obfuscation="strict").is_profane("fu.c k")
        assert not make_filter().is_profane("fu.c k")

    def test_min_join_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        assert not make_filter().is_profane("a.ss")
        monkeypatch.setenv("GLIN_SEPARATOR_MIN_JOIN", "3")
        assert make_filter().is_profane("a.ss")


class TestWordEndBoundary:
    """A chain is joined at a dictionary word only where the chain really ends."""

    @pytest.mark.parametrize(
        "text",
        [
            "a s s i g n m e n t",
            "c.o.c.k.p.i.t",
            "h.e.l.l.o.w.o.r.l.d",
            "c-l-a-s-s-r-o-o-m",
            "a s s e m b l y",
        ],
    )
    def test_prefix_of_longer_chain_is_clean(self, text: str) -> None:
        f = make_filter(replace_with="*", obfuscation={"builtin_whitelist": False})
        assert not f.is_profane(text)
        assert f.check_profanity(text).get("processed_text") == text

    @pytest.mark.parametrize(
        "text",
        [
            "f.u.c.k",
            "s h i t",
            "f.u.c.k.s.h.i.t",
            "you a s s",
            "f u c k e d",
            "f.u.c.k.you",
        ],
    )
    def test_real_chains_still_flagged(self, text: str) -> None:
        assert make_filter(replace_with="*").is_profane(text)
