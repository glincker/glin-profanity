"""HTML tag and entity transformer tests."""

from __future__ import annotations

import pytest

from glin_profanity.filters.pipeline.html import html_transformer
from glin_profanity.filters.pipeline.mapped import from_text, to_original_span

from .helpers import make_filter

strip = html_transformer(2)


def text(value: str) -> str:
    return strip(from_text(value)).text


class TestHtmlTransformer:
    def test_inline_tags_join_the_text_around_them(self) -> None:
        assert text("s<b>h</b>it") == "shit"
        assert text("<span>fu</span><span>ck</span>") == "fuck"
        assert text("fu<br>ck") == "fuck"
        assert text("bi<!-- x -->tch") == "bitch"

    def test_block_tags_separate_neighbouring_paragraphs(self) -> None:
        assert "ass" not in text("<p>as</p><p>s</p>")

    def test_decodes_decimal_hex_named_and_double_encoded_entities(self) -> None:
        assert text("f&#117;ck") == "fuck"
        assert text("&#x73;&#x68;&#x69;&#x74;") == "shit"
        assert text("f&amp;#117;ck") == "fuck"
        assert text("a &amp; b") == "a & b"

    def test_drops_soft_hyphen_entities(self) -> None:
        assert text("fu&shy;ck") == "fuck"
        assert text("fu&#173;ck") == "fuck"

    def test_leaves_plain_comparisons_and_unknown_entities_alone(self) -> None:
        assert text("1 < 2 and 3 > 2") == "1 < 2 and 3 > 2"
        assert text("x <3 y") == "x <3 y"
        assert text("AT&T; &bogus; &#0;") == "AT&T; &bogus; &#0;"

    def test_returns_the_same_object_when_there_is_nothing_to_do(self) -> None:
        value = from_text("plain text")
        assert strip(value) is value

    def test_maps_a_match_back_across_the_removed_markup(self) -> None:
        mapped = strip(from_text("<i>f</i><i>u</i><i>c</i><i>k</i>"))
        assert mapped.text == "fuck"
        assert to_original_span(mapped, 0, 4) == (3, 28)

    def test_comment_length_cap_keeps_unclosed_comments_literal(self) -> None:
        long_tail = "<!--" + "x" * 3000 + "-->"
        assert text("a" + long_tail + "b") == "a" + long_tail + "b"


class TestHtmlInFilter:
    filter = make_filter()

    @pytest.mark.parametrize(
        "value",
        [
            "f<b>u</b>ck",
            "fu<br>ck",
            "bas<!-- x -->tard",
            "&#102;&#117;&#99;&#107;",
            "&#x62;&#x69;&#x74;&#x63;&#x68;",
            "b&amp;#105;tch",
            "bas&shy;tard",
            "<span>sh</span><span>it</span>",
        ],
    )
    def test_flags(self, value: str) -> None:
        assert self.filter.is_profane(value)
        assert self.filter.check_profanity(value)["contains_profanity"]

    @pytest.mark.parametrize(
        "value",
        [
            "<p>Hello <b>world</b></p>",
            "Tom &amp; Jerry",
            '<a href="https://example.com/class">class notes</a>',
            "<div>as</div><div>s</div>",
            "&lt;script&gt; is escaped",
        ],
    )
    def test_keeps_clean(self, value: str) -> None:
        assert not self.filter.is_profane(value)

    def test_reports_the_original_span_in_context_aware_matches(self) -> None:
        value = "say <i>f</i><i>u</i><i>c</i><i>k</i> now"
        result = make_filter(enable_context_aware=True).check_profanity(value)
        assert result["matches"][0]["index"] == value.index("f</i>")  # type: ignore[index]

    def test_masks_the_matched_span_with_replace_with(self) -> None:
        result = make_filter(replace_with="***").check_profanity("a <b>s</b>hit here")
        # The span starts at the first matched letter, so the opening tag stays.
        assert result["processed_text"] == "a <b>*** here"

    def test_can_be_switched_off(self) -> None:
        assert not make_filter(obfuscation={"html": False}).is_profane("f<b>u</b>ck")

    def test_decode_depth_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GLIN_HTML_DECODE_DEPTH", "1")
        assert not make_filter().is_profane("f&amp;#117;ck")
        monkeypatch.setenv("GLIN_HTML_DECODE_DEPTH", "2")
        assert make_filter().is_profane("f&amp;#117;ck")
