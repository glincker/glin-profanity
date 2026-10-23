"""Tests for filter pool public exports."""

from glin_profanity import clear_filter_pool, create_filter_config, get_pooled_filter
from glin_profanity.filters.filter import Filter


class TestFilterPoolExport:
    def setup_method(self) -> None:
        clear_filter_pool()

    def teardown_method(self) -> None:
        clear_filter_pool()

    def test_get_pooled_filter_returns_filter(self) -> None:
        config = create_filter_config({"languages": ["english"]})
        assert isinstance(get_pooled_filter(config), Filter)

    def test_reuses_same_instance(self) -> None:
        config = create_filter_config({"languages": ["english"]})
        first = get_pooled_filter(config)
        second = get_pooled_filter(config)
        assert first is second
