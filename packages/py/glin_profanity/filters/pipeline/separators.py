"""Joins letters split by separators (f.u.c.k, f|u|c|k, f.u_c-k, f.uck)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .dictionary_index import DictionaryIndex
from .mapped import Edit, MappedText, Transformer, apply_edits


@dataclass
class _Piece:
    text: str
    start: int
    end: int
    # Separator that follows this piece in the source, if any.
    sep: str


def separator_transformer(
    index: DictionaryIndex, chars: str, allow_space: bool, min_two_piece_length: int
) -> Transformer:
    """Join split fragments when the joined text is a dictionary word.

    Only whole fragments are joined, so "end.fuck" and "e.g." never produce a
    match the plain text did not. `allow_space` lets a space join after one other
    separator (strict); `min_two_piece_length` keeps "b.s." clean.
    """
    sep_class = re.escape(chars)
    chain = re.compile(rf"[^\W_]+(?:[{sep_class} ][^\W_]+)+")
    quick = re.compile(rf"[^\W_][{sep_class}][^\W_]|\b[^\W\d_] [^\W\d_] [^\W\d_]\b")
    sep_set = frozenset(chars)

    def run(inp: MappedText) -> MappedText:
        if not quick.search(inp.text):
            return inp
        edits: list[Edit] = []
        taken: set[int] = set()
        for match in chain.finditer(inp.text):
            pieces = _split_pieces(match.group(0), match.start(), sep_set)
            if len(pieces) < 2:
                continue
            _collect_joins(
                pieces, inp.text, index, allow_space, min_two_piece_length, edits, taken
            )
        edits.sort(key=lambda e: e.start)
        return apply_edits(inp, edits)

    return run


def _split_pieces(chain_text: str, offset: int, seps: frozenset[str]) -> list[_Piece]:
    pieces: list[_Piece] = []
    start = 0
    for i in range(len(chain_text) + 1):
        at_end = i == len(chain_text)
        if at_end or chain_text[i] in seps or chain_text[i] == " ":
            pieces.append(
                _Piece(
                    chain_text[start:i],
                    offset + start,
                    offset + i,
                    "" if at_end else chain_text[i],
                )
            )
            start = i + 1
    return pieces


def _collect_joins(
    pieces: list[_Piece],
    source: str,
    index: DictionaryIndex,
    allow_space: bool,
    min_two_piece_length: int,
    edits: list[Edit],
    taken: set[int],
) -> None:
    i = 0
    while i < len(pieces):
        joined_to = -1
        candidate = ""
        for j in range(i, len(pieces)):
            candidate += pieces[j].text
            if len(candidate) > index.max_word_length:
                break
            if j > i and _accepts_join(
                pieces, i, j, candidate, index, allow_space, min_two_piece_length
            ):
                joined_to = j
        if joined_to < 0:
            i += 1
            continue
        _add_edits(pieces, i, joined_to, source, edits, taken)
        i = joined_to + 1


def _accepts_join(
    pieces: list[_Piece],
    start: int,
    end: int,
    candidate: str,
    index: DictionaryIndex,
    allow_space: bool,
    min_two_piece_length: int,
) -> bool:
    span = pieces[start : end + 1]
    if not any(len(p.text) == 1 for p in span):
        return False
    if len(span) == 2 and len(candidate) < min_two_piece_length:
        return False
    inner = [p.sep for p in span[:-1]]
    spaces = sum(1 for s in inner if s == " ")
    if spaces > 0:
        others = len(inner) - spaces
        # Plain "s h i t": at least three single letters, nothing else.
        spelled_out = (
            others == 0 and len(span) >= 3 and all(len(p.text) == 1 for p in span)
        )
        if not spelled_out and others < (1 if allow_space else 2):
            return False
    return index.is_word(candidate)


def _add_edits(
    pieces: list[_Piece],
    start: int,
    end: int,
    source: str,
    edits: list[Edit],
    taken: set[int],
) -> None:
    def push(edit: Edit) -> None:
        if edit.start not in taken:
            taken.add(edit.start)
            edits.append(edit)

    for k in range(start, end):
        push(Edit(pieces[k].end, pieces[k + 1].start, ""))
    # "_" is a word character, so a neighbouring one would hide the boundary.
    prev = pieces[start].start - 1
    if start > 0 and source[prev] == "_":
        push(Edit(prev, prev + 1, " "))
    nxt = pieces[end].end
    if end + 1 < len(pieces) and source[nxt] == "_":
        push(Edit(nxt, nxt + 1, " "))
