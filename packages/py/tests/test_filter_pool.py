"""Tests for the shared Filter instance pool."""

from glin_profanity import Filter
from glin_profanity.core.filter_pool import (
    FILTER_POOL_MAX,
    clear_filter_pool,
    create_filter_config,
    get_pooled_filter,
)


class TestFilterPool:
    def setup_method(self) -> None:
        clear_filter_pool()

    def teardown_method(self) -> None:
        clear_filter_pool()

    def test_returns_same_instance_for_identical_config(self) -> None:
        config = {"languages": ["english"]}
        first = get_pooled_filter(config)
        second = get_pooled_filter(config)
        assert first is second

    def test_language_order_does_not_affect_pool_key(self) -> None:
        first = get_pooled_filter({"languages": ["english", "spanish"]})
        second = get_pooled_filter({"languages": ["spanish", "english"]})
        assert first is second

    def test_different_configs_return_different_instances(self) -> None:
        english = get_pooled_filter({"languages": ["english"]})
        spanish = get_pooled_filter({"languages": ["spanish"]})
        assert english is not spanish

    def test_evicts_oldest_entry_when_pool_is_full(self) -> None:
        configs = [{"languages": ["english"], "custom_words": [f"word{i}"]} for i in range(FILTER_POOL_MAX + 1)]
        instances = [get_pooled_filter(config) for config in configs]
        oldest = instances[0]
        newest = instances[-1]

        assert get_pooled_filter(configs[0]) is not oldest
        assert get_pooled_filter(configs[-1]) is newest

    def test_create_filter_config_merges_global_whitelist(self) -> None:
        config = create_filter_config({"ignore_words": ["customword"]})
        ignore_words = config.get("ignore_words") or []
        assert "customword" in ignore_words
        assert "Class" in ignore_words

    def test_clear_filter_pool(self) -> None:
        first = get_pooled_filter({"languages": ["english"]})
        clear_filter_pool()
        second = get_pooled_filter({"languages": ["english"]})
        assert first is not second

    def test_pooled_filter_behaves_like_direct_filter(self) -> None:
        config = {"languages": ["english"], "enable_context_aware": True}
        pooled = get_pooled_filter(config)
        direct = Filter(create_filter_config(config))
        text = "You are a fucking idiot"
        assert pooled.is_profane(text) == direct.is_profane(text)
        assert pooled.check_profanity(text)["contains_profanity"] == direct.check_profanity(
            text
        )["contains_profanity"]

    def test_premerged_config_shares_same_pool_instance(self) -> None:
        raw = get_pooled_filter({"languages": ["english"], "ignore_words": ["customword"]})
        premerged = get_pooled_filter(
            create_filter_config({"languages": ["english"], "ignore_words": ["customword"]})
        )
        assert raw is premerged

    def test_create_filter_config_is_idempotent(self) -> None:
        once = create_filter_config({"ignore_words": ["customword"]})
        twice = create_filter_config(once)
        assert (once.get("ignore_words") or []) == (twice.get("ignore_words") or [])
