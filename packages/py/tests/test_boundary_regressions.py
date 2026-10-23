"""Regression tests for boundary and normalization fixes (P0/P1/P2)."""

from glin_profanity import Filter


class TestLatinUnicodeBoundaries:
    @classmethod
    def setup_class(cls) -> None:
        cls.filter = Filter(
            {
                "languages": ["spanish"],
                "detect_leetspeak": True,
                "normalize_unicode": True,
            }
        )
        cls.portuguese_filter = Filter(
            {
                "languages": ["portuguese"],
                "detect_leetspeak": True,
                "normalize_unicode": True,
            }
        )

    def test_spanish_cu_ad_del_not_flagged(self) -> None:
        cases = [
            "Ok cuántos quieres tener",
            "No,porque ni siquiera te conozco no gracias*se acaba la cena*uy por fin adiós*me voy*",
            "Aggg deberíamos de haber quedado de un modo en el que no viera tu estúpida cara",
            "Te gusta? Cuánto? *Me acerco tomando sus manos*",
        ]
        for text in cases:
            result = self.filter.check_profanity(text)
            assert result["contains_profanity"] is False, text

        result = self.portuguese_filter.check_profanity(
            "haaaa delícia disse gozando"
        )
        assert result["contains_profanity"] is False




class TestCjkMinLengthBoundary:
    @classmethod
    def setup_class(cls) -> None:
        cls.filter = Filter(
            {
                "languages": ["japanese"],
                "detect_leetspeak": True,
                "normalize_unicode": True,
            }
        )

    def test_single_cjk_char_in_compound_not_flagged(self) -> None:
        text = "はい、女として見てました。綺麗な顔立ちにそのスタイル、おまけに明るい性格で"
        result = self.filter.check_profanity(text)
        assert "性" not in result["profane_words"]
        assert result["contains_profanity"] is False

    def test_standalone_cjk_profanity_still_detected(self) -> None:
        chinese = Filter({"languages": ["chinese"]})
        assert chinese.is_profane("你他妈的") is True
        # 乳 alone is ambiguous (milk), so Latin neighbours do not make it a hit.
        assert chinese.is_profane("x乳x") is False


class TestMeasurementLeetspeakFalsePositive:
    @classmethod
    def setup_class(cls) -> None:
        cls.filter = Filter(
            {
                "languages": ["japanese"],
                "detect_leetspeak": True,
                "normalize_unicode": True,
            }
        )

    def test_distance_5m_not_flagged_as_sm(self) -> None:
        text = "おい近づくな…5mまでだ"
        result = self.filter.check_profanity(text)
        assert result["contains_profanity"] is False
        assert result["profane_words"] == []

    def test_leetspeak_still_normalizes_embedded_digits(self) -> None:
        from glin_profanity.utils.leetspeak import normalize_leetspeak

        assert normalize_leetspeak("f4ck") == "fack"
        assert normalize_leetspeak("…5mまで") == "…5mまで"
        assert normalize_leetspeak("5ex") == "sex"
