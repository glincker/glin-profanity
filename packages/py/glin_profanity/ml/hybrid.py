"""
Hybrid filter combining rule-based and ML-based detection.

This module provides a unified filter that combines:
- Fast rule-based detection for common profanity
- ML-based detection for contextual toxicity

Example:
    >>> from glin_profanity.ml import HybridFilter
    >>>
    >>> filter = HybridFilter({
    ...     "languages": ["english"],
    ...     "detect_leetspeak": True,
    ...     "enable_ml": True,
    ...     "ml_type": "lightweight",  # or "transformer"
    ... })
    >>>
    >>> result = filter.check_profanity_async("some text")
    >>> print(result["is_toxic"])
"""

from __future__ import annotations

from typing import Literal

from glin_profanity.filters.filter import Filter
from glin_profanity.types.types import CheckProfanityResult, FilterConfig

from .lightweight import LightweightDetector
from .toxicity import ToxicityDetector
from .types import CombinationMode, HybridAnalysisResult, MLAnalysisResult


class HybridFilterConfig(FilterConfig, total=False):
    """Configuration for the hybrid filter."""

    enable_ml: bool
    """Enable ML-based detection. Default: False"""

    ml_type: Literal["transformer", "lightweight"]
    """Type of ML model to use. Default: 'lightweight'"""

    ml_threshold: float
    """ML confidence threshold. Default: 0.5"""

    ml_model: Literal["original", "unbiased", "multilingual"]
    """Model type for transformer (detoxify). Default: 'original'"""

    ml_device: Literal["cpu", "cuda", "mps"]
    """Device for ML inference. Default: 'cpu'"""

    preload_ml: bool
    """Preload ML model on initialization. Default: False"""

    combination_mode: CombinationMode
    """How to combine results. Default: 'or'"""

    borderline_threshold: float
    """Threshold for borderline cases in rules-first mode. Default: 0.5"""


class HybridFilter:
    """
    Hybrid profanity filter combining rule-based and ML detection.

    This filter provides the best of both worlds:
    - Fast rule-based detection for common profanity patterns
    - ML-based detection for contextual and nuanced toxicity

    Example:
        >>> filter = HybridFilter({
        ...     "languages": ["english"],
        ...     "enable_ml": True,
        ...     "ml_type": "lightweight",
        ... })
        >>>
        >>> # Synchronous rule-based check
        >>> is_bad = filter.is_profane("some text")
        >>>
        >>> # Full hybrid check
        >>> result = filter.check_profanity_hybrid("some text")
        >>> print(result["is_toxic"])
        >>> print(result["confidence"])
    """

    def __init__(self, config: HybridFilterConfig | None = None) -> None:
        """
        Initialize the hybrid filter.

        Args:
            config: Configuration options
        """
        config = config or {}

        # Extract ML-specific config
        self.enable_ml = config.get("enable_ml", False)
        self.ml_type = config.get("ml_type", "lightweight")
        self.ml_threshold = config.get("ml_threshold", 0.5)
        self.ml_model = config.get("ml_model", "original")
        self.ml_device = config.get("ml_device", "cpu")
        self.preload_ml = config.get("preload_ml", False)
        self.combination_mode: CombinationMode = config.get("combination_mode", "or")
        self.borderline_threshold = config.get("borderline_threshold", 0.5)

        # Build filter config without ML options
        filter_config: FilterConfig = {
            k: v
            for k, v in config.items()
            if k
            not in {
                "enable_ml",
                "ml_type",
                "ml_threshold",
                "ml_model",
                "ml_device",
                "preload_ml",
                "combination_mode",
                "borderline_threshold",
            }
        }

        # Create rule-based filter
        self.rule_filter = Filter(filter_config)

        # Create ML detector if enabled
        self.ml_detector: ToxicityDetector | LightweightDetector | None = None

        if self.enable_ml:
            if self.ml_type == "transformer":
                self.ml_detector = ToxicityDetector(
                    {
                        "threshold": self.ml_threshold,
                        "model_type": self.ml_model,
                        "device": self.ml_device,
                        "preload_model": self.preload_ml,
                    }
                )
            else:
                self.ml_detector = LightweightDetector(threshold=self.ml_threshold)

    def is_ml_ready(self) -> bool:
        """Check if ML is available and ready."""
        if self.ml_detector is None:
            return False
        return self.ml_detector.check_availability()

    def is_profane(self, text: str) -> bool:
        """
        Synchronous profanity check using only rule-based detection.

        Args:
            text: Text to check

        Returns:
            True if profanity detected
        """
        return self.rule_filter.is_profane(text)

    def check_profanity(self, text: str) -> CheckProfanityResult:
        """
        Synchronous detailed check using only rule-based detection.

        Args:
            text: Text to check

        Returns:
            Detailed profanity check result
        """
        return self.rule_filter.check_profanity(text)

    def check_profanity_hybrid(self, text: str) -> HybridAnalysisResult:
        """
        Full hybrid check using both rule-based and ML detection.

        Args:
            text: Text to check

        Returns:
            Combined analysis result

        Example:
            >>> filter = HybridFilter({"enable_ml": True})
            >>> result = filter.check_profanity_hybrid("some text")
            >>> if result["is_toxic"]:
            ...     print("Reason:", result["reason"])
            ...     print("Confidence:", result["confidence"])
        """
        # Get rule-based result
        rule_result = self.rule_filter.check_profanity(text)

        # Get ML result if enabled
        ml_result: MLAnalysisResult | None = None

        if self.ml_detector is not None:
            try:
                ml_result = self.ml_detector.analyze(text)
            except ImportError:
                pass  # ML not available
            except Exception as e:
                print(f"[glin-profanity] ML analysis failed: {e}")

        # Combine results
        is_toxic, confidence, reason = self._combine_results(rule_result, ml_result)

        return {
            "rule_based_result": {
                "contains_profanity": rule_result.get("contains_profanity", False),
                "profane_words": rule_result.get("profane_words", []),
            },
            "ml_result": ml_result,
            "is_toxic": is_toxic,
            "confidence": confidence,
            "reason": reason,
        }

    def is_toxic_hybrid(self, text: str) -> bool:
        """
        Simple boolean check using hybrid detection.

        Args:
            text: Text to check

        Returns:
            True if toxic
        """
        result = self.check_profanity_hybrid(text)
        return result["is_toxic"]

    def analyze_with_ml(self, text: str) -> MLAnalysisResult | None:
        """
        Analyze text with ML only (if available).

        Args:
            text: Text to analyze

        Returns:
            ML analysis result or None if ML not available
        """
        if self.ml_detector is None:
            return None
        return self.ml_detector.analyze(text)

    def check_profanity_batch_hybrid(
        self, texts: list[str]
    ) -> list[HybridAnalysisResult]:
        """
        Batch analysis for multiple texts.

        Args:
            texts: List of texts to analyze

        Returns:
            List of hybrid analysis results
        """
        # Get rule-based results
        rule_results = [self.rule_filter.check_profanity(text) for text in texts]

        # Get ML results if enabled
        ml_results: list[MLAnalysisResult] | None = None

        if self.ml_detector is not None:
            try:
                ml_results = self.ml_detector.analyze_batch(texts)
            except ImportError:
                pass
            except Exception as e:
                print(f"[glin-profanity] ML batch analysis failed: {e}")

        # Combine results
        results: list[HybridAnalysisResult] = []

        for i, rule_result in enumerate(rule_results):
            ml_result = ml_results[i] if ml_results else None
            is_toxic, confidence, reason = self._combine_results(rule_result, ml_result)

            results.append(
                {
                    "rule_based_result": {
                        "contains_profanity": rule_result.get(
                            "contains_profanity", False
                        ),
                        "profane_words": rule_result.get("profane_words", []),
                    },
                    "ml_result": ml_result,
                    "is_toxic": is_toxic,
                    "confidence": confidence,
                    "reason": reason,
                }
            )

        return results

    def _combine_results(
        self,
        rule_result: CheckProfanityResult,
        ml_result: MLAnalysisResult | None,
    ) -> tuple[bool, float, str]:
        """Combine rule-based and ML results based on combination mode."""
        rule_detected = rule_result.get("contains_profanity", False)
        profane_words = rule_result.get("profane_words", [])
        ml_detected = ml_result["is_toxic"] if ml_result else False
        ml_score = ml_result["overall_score"] if ml_result else 0.0
        ml_categories = ml_result.get("matched_categories", []) if ml_result else []

        if self.combination_mode == "and":
            if ml_result is None:
                return (
                    rule_detected,
                    0.7 if rule_detected else 0.9,
                    (
                        f"Rule-based detection (ML unavailable): {', '.join(profane_words)}"
                        if rule_detected
                        else "No profanity detected (rule-based only)"
                    ),
                )
            return (
                rule_detected and ml_detected,
                min(0.9 if rule_detected else 0.5, ml_score),
                (
                    f"Both detected: {', '.join(profane_words)} (ML: {', '.join(ml_categories)})"
                    if rule_detected and ml_detected
                    else f"Detection disagreement - Rule: {rule_detected}, ML: {ml_detected}"
                ),
            )

        elif self.combination_mode == "ml-override":
            if ml_result is None:
                return (
                    rule_detected,
                    0.7 if rule_detected else 0.8,
                    (
                        f"Rule-based detection: {', '.join(profane_words)}"
                        if rule_detected
                        else "No profanity detected (rule-based)"
                    ),
                )
            return (
                ml_detected,
                ml_score,
                (
                    f"ML detected toxicity: {', '.join(ml_categories)}"
                    if ml_detected
                    else "ML analysis: no toxicity detected"
                ),
            )

        elif self.combination_mode == "rules-first":
            if rule_detected:
                ml_confirmed = " (confirmed by ML)" if ml_detected else ""
                return (
                    True,
                    max(0.8, ml_score) if ml_result else 0.8,
                    f"Rule-based detection: {', '.join(profane_words)}{ml_confirmed}",
                )
            if ml_result and ml_score >= self.borderline_threshold:
                return (
                    ml_detected,
                    ml_score,
                    (
                        f"ML detected (rules missed): {', '.join(ml_categories)}"
                        if ml_detected
                        else "Clean text (verified by ML)"
                    ),
                )
            return (False, 0.85, "No profanity detected (rule-based)")

        else:  # "or" mode (default)
            is_toxic = rule_detected or ml_detected

            if rule_detected and ml_detected:
                return (
                    True,
                    max(0.95, ml_score),
                    f"Both detected: rules ({', '.join(profane_words)}), ML ({', '.join(ml_categories)})",
                )
            elif rule_detected:
                return (True, 0.85, f"Rule-based detection: {', '.join(profane_words)}")
            elif ml_detected:
                return (True, ml_score, f"ML detected: {', '.join(ml_categories)}")
            else:
                return (
                    False,
                    1 - ml_score if ml_result else 0.8,
                    "No toxicity detected",
                )

    def get_rule_filter(self) -> Filter:
        """Get the underlying rule-based filter."""
        return self.rule_filter

    def get_ml_detector(self) -> ToxicityDetector | LightweightDetector | None:
        """Get the underlying ML detector (if enabled)."""
        return self.ml_detector

    def dispose(self) -> None:
        """Dispose of resources (ML model)."""
        if self.ml_detector is not None and hasattr(self.ml_detector, "dispose"):
            self.ml_detector.dispose()
