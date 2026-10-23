"""
Cross-language API parity tests for Python
Ensures Python and JavaScript packages return identical results
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
JS_ENTRY = REPO_ROOT / "packages" / "js" / "dist" / "index.cjs"
JS_PACKAGE = REPO_ROOT / "packages" / "js"

sys.path.insert(0, str(REPO_ROOT / "packages" / "py"))
from glin_profanity import Filter  # noqa: E402
from glin_profanity.types.types import SeverityLevel  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def ensure_js_dist_built() -> None:
    if JS_ENTRY.exists():
        return
    subprocess.run(
        ["npm", "run", "build"],
        cwd=JS_PACKAGE,
        check=True,
        capture_output=True,
        text=True,
    )
    if not JS_ENTRY.exists():
        pytest.fail("JavaScript dist build did not produce index.cjs")


def python_config_to_js(config: dict[str, Any]) -> dict[str, Any]:
    """Convert snake_case Python config keys to camelCase JS config keys."""
    key_map = {
        "replace_with": "replaceWith",
        "case_sensitive": "caseSensitive",
        "custom_words": "customWords",
        "allow_obfuscated_match": "allowObfuscatedMatch",
        "word_boundaries": "wordBoundaries",
        "fuzzy_tolerance_level": "fuzzyToleranceLevel",
        "severity_levels": "severityLevels",
        "ignore_words": "ignoreWords",
        "all_languages": "allLanguages",
        "enable_context_aware": "enableContextAware",
        "context_window": "contextWindow",
        "confidence_threshold": "confidenceThreshold",
        "detect_leetspeak": "detectLeetspeak",
        "leetspeak_level": "leetspeakLevel",
        "normalize_unicode": "normalizeUnicode",
        "cache_results": "cacheResults",
        "max_cache_size": "maxCacheSize",
        "disable_aho_corasick": "disableAhoCorasick",
        "enable_evasion_normalization": "enableEvasionNormalization",
        "domain_whitelists": "domainWhitelists",
        "log_profanity": "logProfanity",
    }

    js_config: dict[str, Any] = {}
    for key, value in config.items():
        js_config[key_map.get(key, key)] = value
    return js_config


def run_javascript_node(script: str) -> Any:
    result = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        check=True,
        cwd=REPO_ROOT,
    )
    return json.loads(result.stdout.strip())


def run_javascript_check_profanity(text: str, config: dict[str, Any]) -> dict[str, Any]:
    js_config = python_config_to_js(config)
    script = f"""
const {{ Filter }} = require({json.dumps(str(JS_ENTRY))});
const config = {json.dumps(js_config)};
const filter = new Filter(config);
const result = filter.checkProfanity({json.dumps(text)});
console.log(JSON.stringify({{
  contains_profanity: result.containsProfanity,
  profane_words: result.profaneWords,
  processed_text: result.processedText ?? null,
  severity_map: result.severityMap ?? {{}},
  reason: result.reason ?? null,
  context_score: result.contextScore ?? null,
}}));
"""
    return run_javascript_node(script)


def run_javascript_is_profane(text: str, config: dict[str, Any]) -> bool:
    js_config = python_config_to_js(config)
    script = f"""
const {{ Filter }} = require({json.dumps(str(JS_ENTRY))});
const filter = new Filter({json.dumps(js_config)});
console.log(filter.isProfane({json.dumps(text)}) ? "true" : "false");
"""
    result = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        check=True,
        cwd=REPO_ROOT,
    )
    return result.stdout.strip() == "true"


class TestCrossLanguageParity:
    """Test API parity between Python and JavaScript implementations."""

    test_cases = [
        {
            "name": "clean text",
            "text": "This is a clean message",
            "config": {"languages": ["english"]},
        },
        {
            "name": "simple profanity",
            "text": "This is damn bad",
            "config": {"languages": ["english"]},
        },
        {
            "name": "multiple languages",
            "text": "Hello damn world",
            "config": {"languages": ["english", "spanish"]},
        },
        {
            "name": "with replacement",
            "text": "This is damn annoying",
            "config": {"languages": ["english"], "replace_with": "***"},
        },
        {
            "name": "case insensitive",
            "text": "This is DAMN bad",
            "config": {"languages": ["english"], "case_sensitive": False},
        },
        {
            "name": "custom words",
            "text": "This contains badword",
            "config": {"languages": ["english"], "custom_words": ["badword"]},
        },
    ]

    edge_case_tests = [
        {
            "name": "obfuscated profanity - asterisks",
            "text": "This is d*mn annoying",
            "config": {"languages": ["english"], "allow_obfuscated_match": True},
        },
        {
            "name": "obfuscated profanity - numbers",
            "text": "This is d4mn bad",
            "config": {"languages": ["english"], "allow_obfuscated_match": True},
        },
        {
            "name": "obfuscated profanity - symbols",
            "text": "This is d@mn terrible",
            "config": {"languages": ["english"], "allow_obfuscated_match": True},
        },
        {
            "name": "repeated characters",
            "text": "This is daaaammmn bad",
            "config": {"languages": ["english"], "allow_obfuscated_match": True},
        },
        {
            "name": "word boundaries disabled",
            "text": "This contains helldamn",
            "config": {"languages": ["english"], "word_boundaries": False},
        },
        {
            "name": "fuzzy matching",
            "text": "This is dmn bad",
            "config": {"languages": ["english"], "fuzzy_tolerance_level": 0.6},
        },
        {
            "name": "severity levels enabled",
            "text": "This is damn bad",
            "config": {"languages": ["english"], "severity_levels": True},
        },
        {
            "name": "ignore words",
            "text": "This is damn good",
            "config": {"languages": ["english"], "ignore_words": ["damn"]},
        },
        {
            "name": "empty text",
            "text": "",
            "config": {"languages": ["english"]},
        },
        {
            "name": "whitespace only",
            "text": "   \n\t  ",
            "config": {"languages": ["english"]},
        },
        {
            "name": "mixed case obfuscation",
            "text": "This is D@MN bad",
            "config": {
                "languages": ["english"],
                "allow_obfuscated_match": True,
                "case_sensitive": False,
            },
        },
    ]

    multi_language_tests = [
        {
            "name": "spanish profanity",
            "text": "Esto es una mierda",
            "config": {"languages": ["spanish"]},
        },
        {
            "name": "french profanity",
            "text": "C'est de la merde",
            "config": {"languages": ["french"]},
        },
        {
            "name": "german profanity",
            "text": "Das ist Scheiße",
            "config": {"languages": ["german"]},
        },
        {
            "name": "mixed language content",
            "text": "Hello mierda damn world",
            "config": {"languages": ["english", "spanish"]},
        },
        {
            "name": "all available languages",
            "text": "This is damn bad",
            "config": {"all_languages": True},
        },
    ]

    context_aware_tests = [
        {
            "name": "context aware - enabled",
            "text": "This is damn good work",
            "config": {
                "languages": ["english"],
                "enable_context_aware": True,
                "confidence_threshold": 0.7,
            },
        },
        {
            "name": "context aware - disabled",
            "text": "This is damn good work",
            "config": {
                "languages": ["english"],
                "enable_context_aware": False,
            },
        },
        {
            "name": "context window variation",
            "text": "The damn good weather today",
            "config": {
                "languages": ["english"],
                "enable_context_aware": True,
                "context_window": 5,
                "confidence_threshold": 0.8,
            },
        },
        {
            "name": "context optimization - whitelisted bomb phrase",
            "text": "This movie is the bomb",
            "config": {
                "languages": ["english"],
                "enable_context_aware": True,
            },
        },
        {
            "name": "context optimization - unrelated positive phrase",
            "text": "The bomb exploded and shit happened",
            "config": {
                "languages": ["english"],
                "enable_context_aware": True,
            },
        },
        {
            "name": "context optimization - negative insult",
            "text": "You are a fucking idiot",
            "config": {
                "languages": ["english"],
                "enable_context_aware": True,
            },
        },
    ]

    cjk_matching_tests = [
        {
            "name": "chinese substring",
            "text": "你他妈的",
            "config": {"languages": ["chinese"]},
        },
        {
            "name": "chinese ascii adjacency",
            "text": "hello他妈的",
            "config": {"languages": ["chinese"]},
        },
        {
            "name": "chinese wrapped in ascii",
            "text": "x乳x",
            "config": {"languages": ["chinese"]},
        },
        {
            "name": "japanese substring",
            "text": "エッチ",
            "config": {"languages": ["japanese"]},
        },
        {
            "name": "japanese ascii wrapped",
            "text": "abcエッチdef",
            "config": {"languages": ["japanese"]},
        },
        {
            "name": "english scunthorpe trap",
            "text": "scunthorpe",
            "config": {"languages": ["english"]},
        },
        {
            "name": "english standalone profanity",
            "text": "hello fuck world",
            "config": {"languages": ["english"]},
        },
        {
            "name": "mixed english and chinese",
            "text": "hello fuck",
            "config": {"languages": ["english", "chinese"]},
        },
    ]

    @staticmethod
    def assert_check_profanity_parity(
        name: str,
        py_result: dict[str, Any],
        js_result: dict[str, Any],
        *,
        compare_processed_text: bool = False,
    ) -> None:
        assert py_result["contains_profanity"] == js_result["contains_profanity"], (
            f"contains_profanity mismatch in {name}"
        )
        assert sorted(py_result["profane_words"]) == sorted(js_result["profane_words"]), (
            f"profane_words mismatch in {name}"
        )
        assert len(py_result["profane_words"]) == len(js_result["profane_words"]), (
            f"word count mismatch in {name}"
        )
        if compare_processed_text:
            assert py_result.get("processed_text") == js_result.get("processed_text"), (
                f"processed_text mismatch in {name}"
            )

    @pytest.mark.parametrize("test_case", test_cases)
    def test_basic_parity_with_javascript(self, test_case: dict[str, Any]) -> None:
        py_result = Filter(test_case["config"]).check_profanity(test_case["text"])
        js_result = run_javascript_check_profanity(test_case["text"], test_case["config"])
        self.assert_check_profanity_parity(
            test_case["name"],
            py_result,
            js_result,
            compare_processed_text=bool(test_case["config"].get("replace_with")),
        )

    @pytest.mark.parametrize("test_case", edge_case_tests)
    def test_edge_case_parity_with_javascript(self, test_case: dict[str, Any]) -> None:
        py_result = Filter(test_case["config"]).check_profanity(test_case["text"])
        js_result = run_javascript_check_profanity(test_case["text"], test_case["config"])
        self.assert_check_profanity_parity(test_case["name"], py_result, js_result)

    @pytest.mark.parametrize("test_case", multi_language_tests)
    def test_multi_language_parity_with_javascript(self, test_case: dict[str, Any]) -> None:
        py_result = Filter(test_case["config"]).check_profanity(test_case["text"])
        js_result = run_javascript_check_profanity(test_case["text"], test_case["config"])
        self.assert_check_profanity_parity(test_case["name"], py_result, js_result)

    @pytest.mark.parametrize("test_case", context_aware_tests)
    def test_context_aware_parity_with_javascript(self, test_case: dict[str, Any]) -> None:
        py_result = Filter(test_case["config"]).check_profanity(test_case["text"])
        js_result = run_javascript_check_profanity(test_case["text"], test_case["config"])
        self.assert_check_profanity_parity(test_case["name"], py_result, js_result)

        if test_case["config"].get("enable_context_aware"):
            assert py_result.get("reason") is not None
            assert js_result.get("reason") is not None

    @pytest.mark.parametrize("test_case", cjk_matching_tests)
    def test_cjk_matching_parity_with_javascript(self, test_case: dict[str, Any]) -> None:
        py_result = Filter(test_case["config"]).check_profanity(test_case["text"])
        js_result = run_javascript_check_profanity(test_case["text"], test_case["config"])
        self.assert_check_profanity_parity(test_case["name"], py_result, js_result)

        py_is_profane = Filter(test_case["config"]).is_profane(test_case["text"])
        js_is_profane = run_javascript_is_profane(test_case["text"], test_case["config"])
        assert py_is_profane == js_is_profane, f"is_profane mismatch in {test_case['name']}"

    def test_api_structure_consistency(self) -> None:
        py_filter = Filter({"languages": ["english"]})
        py_result = py_filter.check_profanity("test damn")

        assert "contains_profanity" in py_result
        assert "profane_words" in py_result
        assert isinstance(py_result["profane_words"], list)
        assert hasattr(py_filter, "check_profanity")
        assert hasattr(py_filter, "is_profane")
        assert hasattr(py_filter, "check_profanity_with_min_severity")

    def test_is_profane_method_parity(self) -> None:
        config = {"languages": ["english"], "allow_obfuscated_match": True}
        for text in ["clean text", "damn bad text", "D@MN obfuscated", ""]:
            py_result = Filter(config).is_profane(text)
            js_result = run_javascript_is_profane(text, config)
            assert py_result == js_result, f"is_profane mismatch for text: {text!r}"

    def test_is_profane_context_aware_parity(self) -> None:
        config = {"languages": ["english"], "enable_context_aware": True}
        cases = [
            "This movie is the bomb",
            "The bomb exploded and shit happened",
            "You are a fucking idiot",
        ]
        for text in cases:
            py_result = Filter(config).is_profane(text)
            js_result = run_javascript_is_profane(text, config)
            assert py_result == js_result, f"context-aware is_profane mismatch for {text!r}"

    def test_check_profanity_with_min_severity_parity(self) -> None:
        py_filter = Filter({"languages": ["english"], "severity_levels": True})
        py_result = py_filter.check_profanity_with_min_severity(
            "damn bad text", SeverityLevel.EXACT
        )

        script = f"""
const {{ Filter }} = require({json.dumps(str(JS_ENTRY))});
const filter = new Filter({{"languages": ["english"], "severityLevels": true}});
const result = filter.checkProfanityWithMinSeverity("damn bad text", 1);
console.log(JSON.stringify({{
  filteredWords: result.filteredWords,
  result: {{
    containsProfanity: result.result.containsProfanity,
    profaneWords: result.result.profaneWords,
  }},
}}));
"""
        js_result = run_javascript_node(script)

        assert sorted(py_result["filtered_words"]) == sorted(js_result["filteredWords"])
        assert py_result["result"]["contains_profanity"] == js_result["result"]["containsProfanity"]
        assert sorted(py_result["result"]["profane_words"]) == sorted(
            js_result["result"]["profaneWords"]
        )
