"""Tests for ML-based profanity detection.

Note: These tests verify the module structure and error handling.
Actual ML inference tests require installing optional dependencies
(detoxify, torch, profanity-check).
"""



class TestMLModuleImports:
    """Test that ML module can be imported without ML dependencies."""

    def test_import_types(self) -> None:
        """Should import type definitions without dependencies."""
        from glin_profanity.ml.types import (
            ToxicityLabel,
        )

        # Verify enum values
        assert ToxicityLabel.TOXIC.value == "toxic"
        assert ToxicityLabel.INSULT.value == "insult"

    def test_import_toxicity_detector(self) -> None:
        """Should import ToxicityDetector class."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        assert ToxicityDetector is not None

    def test_import_lightweight_detector(self) -> None:
        """Should import LightweightDetector class."""
        from glin_profanity.ml.lightweight import LightweightDetector

        assert LightweightDetector is not None

    def test_import_hybrid_filter(self) -> None:
        """Should import HybridFilter class."""
        from glin_profanity.ml.hybrid import HybridFilter

        assert HybridFilter is not None

    def test_import_from_ml_module(self) -> None:
        """Should import all exports from ml module."""
        from glin_profanity.ml import (
            HybridFilter,
            LightweightDetector,
            ToxicityDetector,
        )

        assert ToxicityDetector is not None
        assert LightweightDetector is not None
        assert HybridFilter is not None


class TestToxicityDetector:
    """Test ToxicityDetector class."""

    def test_create_instance(self) -> None:
        """Should create instance with default config."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        detector = ToxicityDetector()
        assert detector.threshold == 0.5
        assert detector.model_type == "original"

    def test_create_instance_with_config(self) -> None:
        """Should create instance with custom config."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        detector = ToxicityDetector(
            {"threshold": 0.8, "model_type": "multilingual", "device": "cpu"}
        )
        assert detector.threshold == 0.8
        assert detector.model_type == "multilingual"

    def test_check_availability_without_deps(self) -> None:
        """Should return False if detoxify not installed."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        detector = ToxicityDetector()
        # This will be False unless detoxify is installed
        available = detector.check_availability()
        assert isinstance(available, bool)

    def test_get_config(self) -> None:
        """Should return current config."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        detector = ToxicityDetector({"threshold": 0.9})
        config = detector.get_config()
        assert config["threshold"] == 0.9

    def test_is_model_loaded(self) -> None:
        """Should return False before loading."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        detector = ToxicityDetector()
        assert detector.is_model_loaded() is False

    def test_dispose(self) -> None:
        """Should dispose without error."""
        from glin_profanity.ml.toxicity import ToxicityDetector

        detector = ToxicityDetector()
        detector.dispose()
        assert detector.is_model_loaded() is False


class TestLightweightDetector:
    """Test LightweightDetector class."""

    def test_create_instance(self) -> None:
        """Should create instance with default threshold."""
        from glin_profanity.ml.lightweight import LightweightDetector

        detector = LightweightDetector()
        assert detector.threshold == 0.5

    def test_create_instance_with_threshold(self) -> None:
        """Should create instance with custom threshold."""
        from glin_profanity.ml.lightweight import LightweightDetector

        detector = LightweightDetector(threshold=0.8)
        assert detector.threshold == 0.8

    def test_check_availability_without_deps(self) -> None:
        """Should return False if profanity-check not installed."""
        from glin_profanity.ml.lightweight import LightweightDetector

        detector = LightweightDetector()
        available = detector.check_availability()
        assert isinstance(available, bool)


class TestHybridFilter:
    """Test HybridFilter class."""

    def test_create_instance_without_ml(self) -> None:
        """Should create instance with ML disabled."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter({"languages": ["english"], "enable_ml": False})
        assert filter_obj.ml_detector is None

    def test_create_instance_with_ml_lightweight(self) -> None:
        """Should create instance with lightweight ML."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {"languages": ["english"], "enable_ml": True, "ml_type": "lightweight"}
        )
        assert filter_obj.ml_detector is not None

    def test_create_instance_with_ml_transformer(self) -> None:
        """Should create instance with transformer ML."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {"languages": ["english"], "enable_ml": True, "ml_type": "transformer"}
        )
        assert filter_obj.ml_detector is not None

    def test_is_ml_ready_without_deps(self) -> None:
        """Should return False if ML deps not installed."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter({"enable_ml": True})
        # This checks if dependencies are available
        ready = filter_obj.is_ml_ready()
        assert isinstance(ready, bool)

    def test_is_profane_sync(self) -> None:
        """Should perform synchronous rule-based check."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {"languages": ["english"], "custom_words": ["badword"], "enable_ml": False}
        )
        assert filter_obj.is_profane("hello world") is False
        assert filter_obj.is_profane("badword") is True

    def test_check_profanity_sync(self) -> None:
        """Should perform synchronous detailed check."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {"languages": ["english"], "custom_words": ["badword"], "enable_ml": False}
        )
        result = filter_obj.check_profanity("this is badword bad")
        assert result["contains_profanity"] is True
        assert "badword" in result["profane_words"]

    def test_check_profanity_hybrid(self) -> None:
        """Should perform hybrid check without ML."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {"languages": ["english"], "custom_words": ["badword"], "enable_ml": False}
        )
        result = filter_obj.check_profanity_hybrid("this is badword bad")
        assert result["is_toxic"] is True
        assert result["ml_result"] is None
        assert result["rule_based_result"]["contains_profanity"] is True

    def test_get_rule_filter(self) -> None:
        """Should return underlying rule filter."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {"languages": ["english"], "custom_words": ["testword"]}
        )
        rule_filter = filter_obj.get_rule_filter()
        assert rule_filter.is_profane("testword") is True

    def test_get_ml_detector(self) -> None:
        """Should return ML detector or None."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_without_ml = HybridFilter({"enable_ml": False})
        assert filter_without_ml.get_ml_detector() is None

        filter_with_ml = HybridFilter({"enable_ml": True})
        assert filter_with_ml.get_ml_detector() is not None

    def test_dispose(self) -> None:
        """Should dispose without error."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter({"enable_ml": True})
        filter_obj.dispose()
        # Should not raise


class TestCombinationModes:
    """Test different combination modes for hybrid filter."""

    def test_or_mode(self) -> None:
        """Test 'or' combination mode."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {
                "languages": ["english"],
                "custom_words": ["badword"],
                "enable_ml": False,
                "combination_mode": "or",
            }
        )
        result = filter_obj.check_profanity_hybrid("badword")
        assert result["is_toxic"] is True

    def test_and_mode_rules_only(self) -> None:
        """Test 'and' combination mode with rules only."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {
                "languages": ["english"],
                "custom_words": ["badword"],
                "enable_ml": False,
                "combination_mode": "and",
            }
        )
        result = filter_obj.check_profanity_hybrid("badword")
        # With ML unavailable, should use rule-based result
        assert result["is_toxic"] is True

    def test_rules_first_mode(self) -> None:
        """Test 'rules-first' combination mode."""
        from glin_profanity.ml.hybrid import HybridFilter

        filter_obj = HybridFilter(
            {
                "languages": ["english"],
                "custom_words": ["badword"],
                "enable_ml": False,
                "combination_mode": "rules-first",
            }
        )
        result = filter_obj.check_profanity_hybrid("badword")
        assert result["is_toxic"] is True
        assert "Rule-based detection" in result["reason"]
