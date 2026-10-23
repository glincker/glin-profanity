"""Builds the texts the dictionary is matched against."""

from __future__ import annotations

import re
from dataclasses import dataclass

from glin_profanity.utils.leetspeak import LeetspeakLevel

from ..obfuscation import ResolvedObfuscation
from .dictionary_index import DictionaryIndex
from .html import html_transformer
from .mapped import MappedText, Transformer, from_text, run_pipeline
from .masking import masking_transformer
from .normalizers import (
    leet_transformer,
    legacy_obfuscation_transformer,
    unicode_transformer,
)
from .separators import separator_transformer
from .stretch import stretch_transformer

_LONG_RUN = re.compile(r"(.)\1\1")
_AMBIGUOUS_GLYPH = re.compile(r"(?:[^\W\d_]|[@$])[|1!]+[^\W\d_]")


@dataclass(frozen=True)
class ViewConfig:
    """Normalization settings the views depend on."""

    detect_leetspeak: bool
    leetspeak_level: LeetspeakLevel
    normalize_unicode: bool
    allow_obfuscated_match: bool
    obfuscation: ResolvedObfuscation


@dataclass(frozen=True)
class LegacyViews:
    """The three views the filter always used."""

    orig: MappedText
    norm: MappedText
    aggr: MappedText


class ViewFactory:
    """Original, normalized and aggressive views, plus enhanced views on demand.

    Enhanced views only exist when the text shows a sign of HTML, separators,
    masks, stretching or `|`/`1`/`!` ambiguity.
    """

    def __init__(self, cfg: ViewConfig, index: DictionaryIndex) -> None:
        self._cfg = cfg
        obf = cfg.obfuscation
        html: list[Transformer] = (
            [html_transformer(obf.html_decode_depth)] if obf.html_enabled else []
        )
        separators: list[Transformer] = (
            [
                separator_transformer(
                    index,
                    obf.separator_chars,
                    obf.separator_allow_space,
                    obf.separator_min_two_piece,
                )
            ]
            if obf.separators_enabled
            else []
        )
        masking: list[Transformer] = (
            [masking_transformer(index, obf.mask_chars, obf.mask_min_visible)]
            if obf.masking_enabled
            else []
        )
        self._prefix = [*html, *separators, *masking]
        # No separator joining, for glyphs like `|` that are also separators.
        self._prefix_without_separators = [*html, *masking]
        self._stretch: Transformer | None = (
            stretch_transformer(index) if obf.stretch else None
        )

    def _normalize_steps(
        self, aggressive: bool, ambiguous_as_l: bool = False
    ) -> list[Transformer]:
        steps: list[Transformer] = []
        if self._cfg.normalize_unicode:
            steps.append(unicode_transformer)
        if self._cfg.detect_leetspeak:
            steps.append(
                leet_transformer(
                    self._cfg.leetspeak_level, 1 if aggressive else 2, ambiguous_as_l
                )
            )
        elif self._cfg.allow_obfuscated_match:
            steps.append(legacy_obfuscation_transformer)
        return steps

    def legacy_views(self, text: str) -> LegacyViews:
        orig = from_text(text)
        return LegacyViews(
            orig,
            run_pipeline(orig, self._normalize_steps(False)),
            run_pipeline(orig, self._normalize_steps(True)),
        )

    def enhanced_views(self, text: str) -> list[MappedText]:
        """Extra views, empty when the text carries no obfuscation signal."""
        orig = from_text(text)
        prepared = run_pipeline(orig, self._prefix)
        changed = prepared is not orig
        long_run = (
            self._stretch is not None and _LONG_RUN.search(prepared.text) is not None
        )
        ambiguous = (
            self._cfg.obfuscation.ambiguous_leet
            and self._cfg.detect_leetspeak
            and _AMBIGUOUS_GLYPH.search(text) is not None
        )
        if not changed and not long_run and not ambiguous:
            return []

        views: list[MappedText] = []
        tail: list[Transformer] = [self._stretch] if self._stretch else []
        if changed or long_run:
            views.append(run_pipeline(prepared, [*self._normalize_steps(False), *tail]))
        if ambiguous:
            steps = [*self._normalize_steps(False, True), *tail]
            views.append(run_pipeline(prepared, steps))
            if self._cfg.obfuscation.separators_enabled:
                unjoined = run_pipeline(orig, self._prefix_without_separators)
                if unjoined.text != prepared.text:
                    views.append(run_pipeline(unjoined, steps))
        return views
