"""Backward compatibility and hostile input."""

from __future__ import annotations

import time

import pytest

from glin_profanity import Filter

from .helpers import make_filter

CLEAN = [
    "The quick brown fox jumps over the lazy dog.",
    "Meeting at 3.30 p.m., bring the Q3 report (v2.1) and the e.g. slides.",
    "Our class assistant will assess the glass, grass and brass samples.",
    "Use the --force flag, then run: npm run build && npm test | tee out.log",
    "Order #1234 shipped; total $45.00 (50% off!) to Sunset Blvd.",
    'She said "wow!!!" and he replied, "sooooo cool", then left for Scunthorpe.',
    "Hello, World! snake_case_names and kebab-case-names are both fine.",
    "<p>Welcome to <b>our</b> site &amp; blog &copy; 2026</p>",
]


class TestBackwardCompatibility:
    @pytest.mark.parametrize("value", CLEAN)
    def test_leaves_ordinary_text_alone(self, value: str) -> None:
        assert not make_filter().is_profane(value)
        assert not make_filter().check_profanity(value)["contains_profanity"]

    def test_off_behaves_exactly_like_the_plain_scan(self) -> None:
        off = make_filter(obfuscation="off")
        for value in ["f.u.c.k", "f*ck you", "aaaasshole", "f<b>u</b>ck", "cl@ss"]:
            assert off.is_profane(value) == (value in ("cl@ss", "f*ck you"))

    def test_keeps_fuzzy_matching_on_the_legacy_path(self) -> None:
        fuzzy = Filter({"word_boundaries": False, "allow_obfuscated_match": True})
        assert fuzzy.is_profane("f u c k")
        assert not fuzzy.is_profane("hello")

    def test_still_reports_the_matched_text_for_plain_hits(self) -> None:
        result = make_filter(severity_levels=True).check_profanity("You are a Fuck")
        assert result["profane_words"] == ["fuck"]
        assert result["severity_map"] == {"fuck": 1}

    def test_masks_obfuscated_words_with_replace_with(self) -> None:
        result = make_filter(replace_with="***").check_profanity(
            "well f.u.c.k that and sh*t"
        )
        assert result["processed_text"] == "well *** that and ***"

    def test_round_trips_the_new_options_through_get_config(self) -> None:
        config = make_filter(obfuscation="basic", whitelist=["x y"]).get_config()
        assert config["obfuscation"] == "basic"
        assert config["whitelist"] == ["x y"]

    def test_defaults_to_standard_obfuscation(self) -> None:
        assert Filter().is_profane("f.u.c.k")
        assert Filter({"obfuscation": "off"}).is_profane("f.u.c.k") is False

    def test_clean_text_is_not_slower_than_the_plain_scan_by_an_order_of_magnitude(
        self,
    ) -> None:
        fast = make_filter()
        plain = make_filter(obfuscation="off")
        text = " ".join(CLEAN)

        def timed(f: Filter) -> int:
            start = time.perf_counter_ns()
            for _ in range(100):
                f.is_profane(text)
            return time.perf_counter_ns() - start

        timed(fast)
        timed(plain)
        assert timed(fast) < timed(plain) * 2


class TestHostileInputStaysFast:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "<!--" * 25000,
            "a.b." * 25000,
            "ab** " * 20000,
            "a" * 100000,
            "&amp;" * 20000,
        ],
        ids=[
            "unclosed comments",
            "long dotted chain",
            "trailing masks",
            "stretched run",
            "entity soup",
        ],
    )
    def test_finishes_quickly(self, value: str) -> None:
        start = time.perf_counter()
        self.filter.is_profane(value)
        self.filter.check_profanity(value)
        assert time.perf_counter() - start < 3


class TestQuadraticInputIsBounded:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "x." * 40000,
            "x " * 40000,
            "a" + "*" * 80000 + "b",
            "a" + "_" * 80000 + "b",
            "f.u.c.k" + ".x" * 40000,
        ],
        ids=["dots", "spaces", "mask run", "underscore run", "chain after word"],
    )
    def test_finishes_quickly(self, value: str) -> None:
        start = time.perf_counter()
        self.filter.is_profane(value)
        self.filter.check_profanity(value)
        assert time.perf_counter() - start < 3
