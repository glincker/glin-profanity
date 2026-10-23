"""Native-script word edges: dictionary words match with default word boundaries."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from glin_profanity import Filter
from glin_profanity.filters.word_matcher import edge_kind

DICT_DIR = Path(__file__).resolve().parents[4] / "shared" / "dictionaries"
LANGUAGES = [
    "arabic", "chinese", "czech", "esperanto", "finnish", "french", "italian",
    "japanese", "korean", "persian", "polish", "portuguese", "russian", "swedish",
    "thai", "turkish",
]  # fmt: skip


def native_edge_words(name: str) -> list[str]:
    words = json.loads((DICT_DIR / f"{name}.json").read_text(encoding="utf8"))["words"]
    return [
        w
        for w in words
        if (not w[0].isascii() or not w[-1].isascii())
        and w[0].isalnum()
        and w[-1].isalnum()
    ]


@pytest.mark.parametrize("name", LANGUAGES)
def test_native_edge_words_match(name: str) -> None:
    f = Filter({"languages": [name]})
    words = native_edge_words(name)
    assert words
    assert [w for w in words if not f.is_profane(w)] == []
    assert [w for w in words if not f.is_profane(f'He said "{w}", then left.')] == []


def test_spaced_script_boundaries() -> None:
    ru = Filter({"languages": ["russian"]})
    assert ru.is_profane("блядство")
    assert ru.is_profane("бугор")
    assert not ru.is_profane("На поле небольшой бугорок")
    assert not ru.is_profane("небугор")
    assert Filter({"languages": ["english"]}).is_profane("éasshole")


def test_unspaced_scripts() -> None:
    zh = Filter({"languages": ["chinese"]})
    ja = Filter({"languages": ["japanese"]})
    assert zh.is_profane("他说你傻逼然后走了")
    assert zh.is_profane("乳")
    assert not zh.is_profane("豆乳和牛乳有什么不同")
    assert ja.is_profane("彼は変態だと言った")
    assert ja.is_profane("グロ")
    assert not ja.is_profane("グローバル化が進んでいます")
    assert not ja.is_profane("なめこの味噌汁を作りました")


def test_word_boundaries_off_unchanged() -> None:
    assert Filter({"languages": ["russian"], "word_boundaries": False}).is_profane(
        "бугорок"
    )
    assert Filter({"languages": ["japanese"], "word_boundaries": False}).is_profane(
        "グローバル"
    )


def test_replacement_with_boundaries() -> None:
    f = Filter({"languages": ["russian"], "replace_with": "*"})
    assert (
        f.check_profanity("Это дерьмо и бугорок")["processed_text"] == "Это * и бугорок"
    )


def test_edge_kinds() -> None:
    assert edge_kind("傻", 2) == "free"
    assert edge_kind("乳", 1) == "native"
    assert edge_kind("グ", 2) == "kata"
    assert edge_kind("д", 6) == "native"
    assert edge_kind("s", 4) == "ascii"
