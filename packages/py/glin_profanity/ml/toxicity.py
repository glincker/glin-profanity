"""
ML-based toxicity detection using detoxify.

This module provides optional ML-based profanity/toxicity detection
using the detoxify library built on Hugging Face Transformers.

IMPORTANT: This requires optional dependencies:
- detoxify
- torch

Install with: pip install glin-profanity[ml]
Or: pip install detoxify torch

Example:
    >>> from glin_profanity.ml import ToxicityDetector
    >>>
    >>> detector = ToxicityDetector()
    >>> result = detector.analyze("some text to check")
    >>> print(result["is_toxic"])
"""

from __future__ import annotations

import time
from typing import Literal

from .types import MLAnalysisResult, MLDetectorConfig

# Model type alias
ModelType = Literal["original", "unbiased", "multilingual"]

# Default labels for each model type
MODEL_LABELS: dict[ModelType, list[str]] = {
    "original": [
        "toxic",
        "severe_toxic",
        "obscene",
        "threat",
        "insult",
        "identity_hate",
    ],
    "unbiased": [
        "toxicity",
        "severe_toxicity",
        "obscene",
        "threat",
        "insult",
        "identity_attack",
        "sexual_explicit",
    ],
    "multilingual": [
        "toxicity",
        "severe_toxicity",
        "obscene",
        "threat",
        "insult",
        "identity_attack",
        "sexual_explicit",
    ],
}


class ToxicityDetector:
    """
    ML-based toxicity detector using detoxify.

    This class provides BERT-based toxicity detection that can
    identify various types of harmful content including insults, threats,
    identity attacks, and obscenity.

    The model is loaded lazily on first use and cached for subsequent calls.

    Example:
        >>> detector = ToxicityDetector(model_type="original")
        >>> result = detector.analyze("you are terrible")
        >>> print(result["is_toxic"])  # True
        >>> print(result["predictions"]["insult"])  # 0.92
    """

    def __init__(self, config: MLDetectorConfig | None = None) -> None:
        """
        Initialize the toxicity detector.

        Args:
            config: Configuration options for the detector
        """
        config = config or {}

        self.threshold = config.get("threshold", 0.5)
        self.model_type: ModelType = config.get("model_type", "original")
        self.device = config.get("device", "cpu")
        self.preload_model = config.get("preload_model", False)

        self._model: object | None = None
        self._is_available: bool | None = None

        if self.preload_model:
            try:
                self.load_model()
            except ImportError:
                pass  # Will error on first use

    def check_availability(self) -> bool:
        """
        Check if detoxify and torch are available.

        Returns:
            True if ML dependencies are available
        """
        if self._is_available is not None:
            return self._is_available

        try:
            import detoxify  # noqa: F401
            import torch  # noqa: F401

            self._is_available = True
        except ImportError:
            self._is_available = False

        return self._is_available

    def load_model(self) -> object:
        """
        Load the toxicity model.

        Returns:
            The loaded Detoxify model

        Raises:
            ImportError: If detoxify is not installed
        """
        if self._model is not None:
            return self._model

        try:
            from detoxify import Detoxify

            self._model = Detoxify(self.model_type, device=self.device)
            return self._model
        except ImportError as e:
            raise ImportError(
                "Detoxify not installed. Install with: pip install detoxify torch"
            ) from e

    def analyze(self, text: str) -> MLAnalysisResult:
        """
        Analyze text for toxicity using the ML model.

        Args:
            text: Text to analyze

        Returns:
            Analysis result with predictions and scores

        Example:
            >>> detector = ToxicityDetector()
            >>> result = detector.analyze("you are stupid")
            >>> print(result["is_toxic"])  # True
            >>> print(result["matched_categories"])  # ["insult", "toxicity"]
        """
        start_time = time.perf_counter()

        # Ensure model is loaded
        model = self.load_model()

        # Get predictions
        predictions = model.predict(text)  # type: ignore[union-attr]

        # Convert to dict if needed
        if hasattr(predictions, "items"):
            pred_dict: dict[str, float] = dict(predictions)
        else:
            pred_dict = predictions

        # Find matched categories (above threshold)
        matched_categories = [
            label for label, score in pred_dict.items() if score >= self.threshold
        ]

        # Calculate overall score (max)
        overall_score = max(pred_dict.values()) if pred_dict else 0.0

        processing_time_ms = (time.perf_counter() - start_time) * 1000

        return {
            "is_toxic": len(matched_categories) > 0,
            "overall_score": overall_score,
            "predictions": pred_dict,
            "matched_categories": matched_categories,
            "processing_time_ms": processing_time_ms,
            "model_type": self.model_type,
        }

    def analyze_batch(self, texts: list[str]) -> list[MLAnalysisResult]:
        """
        Analyze multiple texts in a batch.

        Args:
            texts: List of texts to analyze

        Returns:
            List of analysis results

        Example:
            >>> detector = ToxicityDetector()
            >>> results = detector.analyze_batch(["hello", "you suck", "great!"])
            >>> for r in results:
            ...     print(r["is_toxic"])
        """
        if not texts:
            return []

        start_time = time.perf_counter()
        model = self.load_model()

        # Detoxify supports batch prediction
        predictions_list = model.predict(texts)  # type: ignore[union-attr]

        total_time_ms = (time.perf_counter() - start_time) * 1000
        per_text_time_ms = total_time_ms / len(texts)

        results: list[MLAnalysisResult] = []

        # Process each prediction
        for i in range(len(texts)):
            pred_dict: dict[str, float] = {}

            # Handle batch output format
            for label in predictions_list:
                score = predictions_list[label]
                if isinstance(score, (list, tuple)):
                    pred_dict[label] = float(score[i])
                else:
                    pred_dict[label] = float(score)

            matched_categories = [
                label for label, score in pred_dict.items() if score >= self.threshold
            ]
            overall_score = max(pred_dict.values()) if pred_dict else 0.0

            results.append(
                {
                    "is_toxic": len(matched_categories) > 0,
                    "overall_score": overall_score,
                    "predictions": pred_dict,
                    "matched_categories": matched_categories,
                    "processing_time_ms": per_text_time_ms,
                    "model_type": self.model_type,
                }
            )

        return results

    def is_toxic(self, text: str) -> bool:
        """
        Simple boolean check for toxicity.

        Args:
            text: Text to check

        Returns:
            True if text is detected as toxic
        """
        result = self.analyze(text)
        return result["is_toxic"]

    def get_score(self, text: str) -> float:
        """
        Get the toxicity score for text (0-1).

        Args:
            text: Text to score

        Returns:
            Toxicity score from 0 (clean) to 1 (highly toxic)
        """
        result = self.analyze(text)
        return result["overall_score"]

    def dispose(self) -> None:
        """Dispose of the model to free memory."""
        self._model = None

    def is_model_loaded(self) -> bool:
        """Check if the model is currently loaded."""
        return self._model is not None

    def get_config(self) -> MLDetectorConfig:
        """Get the current configuration."""
        return {
            "threshold": self.threshold,
            "model_type": self.model_type,
            "device": self.device,
            "preload_model": self.preload_model,
        }
