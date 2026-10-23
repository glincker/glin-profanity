"""Shared Filter instance pool (mirrors packages/js/src/core/filterPool.ts)."""

from __future__ import annotations

import json
import threading
import warnings
from collections import OrderedDict
from pathlib import Path
from typing import Any

from glin_profanity.filters.filter import Filter
from glin_profanity.types.types import FilterConfig

FILTER_POOL_MAX = 32
_filter_pool: OrderedDict[str, Filter] = OrderedDict()
_pool_lock = threading.Lock()

_GLOBAL_WHITELIST_PATH = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "dictionaries"
    / "globalWhitelist.json"
)
_global_whitelist_cache: list[str] | None = None


def _get_global_whitelist() -> list[str]:
    """Return the shared global whitelist (loaded once per process)."""
    global _global_whitelist_cache
    if _global_whitelist_cache is None:
        with _GLOBAL_WHITELIST_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        _global_whitelist_cache = list(data.get("whitelist", []))
    return _global_whitelist_cache


def create_filter_config(config: FilterConfig | None = None) -> FilterConfig:
    """Build effective filter config, merging the shared global whitelist."""
    effective: dict[str, Any] = dict(config or {})
    user_ignore = list(effective.get("ignore_words") or [])
    global_words = _get_global_whitelist()
    global_set = set(global_words)
    # Idempotent: calling create_filter_config on an already-merged config must
    # not duplicate global whitelist entries (which would inflate the pool key).
    effective["ignore_words"] = [
        *global_words,
        *[word for word in user_ignore if word not in global_set],
    ]
    effective.setdefault("fuzzy_tolerance_level", 0.8)

    if effective.get("allow_obfuscated_match") and effective.get("word_boundaries", True):
        warnings.warn(
            "[Glin-Profanity] Obfuscated match enabled → wordBoundaries will be ignored internally.",
            stacklevel=2,
        )

    return effective  # type: ignore[return-value]


def _normalize_config_for_key(config: FilterConfig) -> FilterConfig:
    normalized: dict[str, Any] = dict(config)

    languages = normalized.get("languages")
    if languages:
        normalized["languages"] = sorted(languages)

    ignore_words = normalized.get("ignore_words")
    if ignore_words:
        normalized["ignore_words"] = sorted(ignore_words)

    custom_words = normalized.get("custom_words")
    if custom_words:
        normalized["custom_words"] = sorted(custom_words)

    domain_whitelists = normalized.get("domain_whitelists")
    if domain_whitelists:
        normalized["domain_whitelists"] = {
            lang: sorted(domain_whitelists[lang])
            for lang in sorted(domain_whitelists)
        }

    return normalized  # type: ignore[return-value]


def config_cache_key(config: FilterConfig) -> str:
    return json.dumps(_normalize_config_for_key(config), sort_keys=True)


def get_pooled_filter(config: FilterConfig | None = None) -> Filter:
    """Return a shared Filter for the given configuration (FIFO eviction at max size)."""
    effective = create_filter_config(config)
    key = config_cache_key(effective)

    with _pool_lock:
        existing = _filter_pool.get(key)
        if existing is not None:
            _filter_pool.move_to_end(key)
            return existing

        filter_instance = Filter(effective)
        if len(_filter_pool) >= FILTER_POOL_MAX:
            oldest_key = next(iter(_filter_pool))
            del _filter_pool[oldest_key]

        _filter_pool[key] = filter_instance
        return filter_instance


def clear_filter_pool() -> None:
    """Clear all pooled Filter instances (intended for tests)."""
    with _pool_lock:
        _filter_pool.clear()
