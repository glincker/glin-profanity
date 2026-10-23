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
    max_len = index.max_word_length
    min_others = 1 if allow_space else 2
    while i < len(pieces):
        joined_to = -1
        candidate = ""
        # Separator counters over pieces[i..j-1], kept incrementally for O(1) steps.
        spaces = others = 0
        has_single = False
        all_single = True
        for j in range(i, len(pieces)):
            piece = pieces[j]
            candidate += piece.text
            if len(candidate) > max_len:
                break
            if len(piece.text) == 1:
                has_single = True
            else:
                all_single = False
            if (
                j > i
                and has_single
                and _span_allowed(
                    j - i + 1,
                    len(candidate),
                    spaces,
                    others,
                    all_single,
                    min_two_piece_length,
                    min_others,
                )
            ):
                if index.is_word(candidate):
                    joined_to = j
            if piece.sep == " ":
                spaces += 1
            else:
                others += 1
        if joined_to < 0:
            i += 1
            continue
        _add_edits(pieces, i, joined_to, source, edits, taken)
        i = joined_to + 1


def _span_allowed(
    span_len: int,
    candidate_len: int,
    spaces: int,
    others: int,
    all_single: bool,
    min_two_piece_length: int,
    min_others: int,
) -> bool:
    """Separator and length rules for joining a span of pieces."""
    if span_len == 2 and candidate_len < min_two_piece_length:
        return False
    if spaces > 0:
        # Plain "s h i t": at least three single letters, nothing else.
        spelled_out = others == 0 and span_len >= 3 and all_single
        if not spelled_out and others < min_others:
            return False
    return True


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
