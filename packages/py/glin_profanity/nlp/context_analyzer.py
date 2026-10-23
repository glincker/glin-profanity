"""Context analysis for distinguishing profanity from false positives."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Language = Literal[
    "arabic",
    "chinese",
    "czech",
    "danish",
    "dutch",
    "english",
    "esperanto",
    "finnish",
    "french",
    "german",
    "hindi",
    "hungarian",
    "italian",
    "japanese",
    "korean",
    "norwegian",
    "persian",
    "polish",
    "portuguese",
    "russian",
    "spanish",
    "swedish",
    "thai",
    "turkish",
]


@dataclass(frozen=True)
class ContextAnalysisResult:
    context_score: float
    reason: str
    is_whitelisted: bool


@dataclass
class ContextConfig:
    context_window: int
    language: Language
    domain_whitelists: list[str] | None = None


POSITIVE_INDICATORS = frozenset(
    {
        "amazing",
        "awesome",
        "excellent",
        "fantastic",
        "great",
        "love",
        "wonderful",
        "brilliant",
        "perfect",
        "incredible",
        "outstanding",
        "superb",
        "magnificent",
        "marvelous",
        "spectacular",
        "phenomenal",
        "terrific",
        "fabulous",
        "divine",
        "best",
        "good",
        "nice",
        "cool",
        "sweet",
        "rad",
        "sick",
        "dope",
        "fire",
        "lit",
        "epic",
        "legendary",
        "godlike",
        "insane",
        "crazy",
        "wild",
        "beast",
        "movie",
        "film",
        "show",
        "song",
        "music",
        "game",
        "book",
        "restaurant",
        "food",
        "dish",
        "meal",
        "place",
        "spot",
        "location",
        "experience",
    }
)

NEGATIVE_INDICATORS = frozenset(
    {
        "hate",
        "terrible",
        "awful",
        "horrible",
        "disgusting",
        "pathetic",
        "stupid",
        "idiot",
        "moron",
        "loser",
        "worthless",
        "useless",
        "garbage",
        "trash",
        "suck",
        "sucks",
        "worst",
        "bad",
        "ugly",
        "gross",
        "nasty",
        "annoying",
        "irritating",
        "frustrating",
        "disappointing",
        "lame",
        "weak",
        "fail",
        "you",
        "your",
        "yourself",
        "u",
        "ur",
        "ure",
        "youre",
    }
)

GAMING_POSITIVE = frozenset(
    {
        "player",
        "gamer",
        "team",
        "squad",
        "clan",
        "guild",
        "match",
        "game",
        "round",
        "level",
        "boss",
        "raid",
        "quest",
        "achievement",
        "skill",
        "build",
        "loadout",
        "strategy",
        "tactic",
        "play",
        "move",
        "combo",
    }
)

GAMING_ACCEPTABLE_WORDS = frozenset(
    {
        "kill",
        "killer",
        "killed",
        "killing",
        "shoot",
        "shot",
        "shooting",
        "die",
        "dying",
        "died",
        "dead",
        "death",
        "badass",
        "sick",
        "insane",
        "crazy",
        "mad",
        "beast",
        "savage",
        "suck",
        "sucks",
        "wtf",
        "omg",
        "hell",
        "damn",
        "crap",
    }
)

POSITIVE_PHRASES: dict[str, float] = {
    "the bomb": 0.9,
    "da bomb": 0.9,
    "bomb.com": 0.9,
    "bomb diggity": 0.9,
    "photo bomb": 0.8,
    "bath bomb": 0.8,
    "bomb squad": 0.7,
}

NEGATIVE_PHRASES: dict[str, float] = {
    "you are": 0.1,
    "ur a": 0.1,
    "such a": 0.2,
    "fucking": 0.1,
    "damn": 0.2,
}


class ContextAnalyzer:
    """Analyzes surrounding text to reduce context-dependent false positives."""

    def __init__(self, config: ContextConfig) -> None:
        self.context_window = config.context_window
        self.language = config.language
        self.domain_whitelists = {
            word.lower() for word in (config.domain_whitelists or [])
        }

    def analyze_context(
        self, text: str, match_word: str, match_index: int
    ) -> ContextAnalysisResult:
        tokens = self._tokenize_with_spans(text)
        match_word_index = self._find_word_index(tokens, match_index)

        if match_word_index == -1:
            return ContextAnalysisResult(
                context_score=0.5,
                reason="Could not locate match in tokenized text",
                is_whitelisted=False,
            )

        start_index = max(0, match_word_index - self.context_window)
        end_index = min(len(tokens), match_word_index + self.context_window + 1)
        context_words = [token["word"] for token in tokens[start_index:end_index]]
        context_text = " ".join(context_words).lower()

        phrase_result = self._check_phrase_context(context_text, match_word)
        if phrase_result is not None:
            return phrase_result

        if self._is_domain_whitelisted(context_words, match_word):
            return ContextAnalysisResult(
                context_score=0.8,
                reason="Domain-specific whitelist match",
                is_whitelisted=True,
            )

        sentiment_score = self._calculate_sentiment_score(
            context_words, match_word_index - start_index
        )
        return ContextAnalysisResult(
            context_score=sentiment_score,
            reason=self._generate_reason(sentiment_score, context_words),
            is_whitelisted=False,
        )

    def update_domain_whitelist(self, new_whitelist: list[str]) -> None:
        self.domain_whitelists = {word.lower() for word in new_whitelist}

    def add_to_domain_whitelist(self, words: list[str]) -> None:
        self.domain_whitelists.update(word.lower() for word in words)

    def _check_phrase_context(
        self, context_text: str, match_word: str
    ) -> ContextAnalysisResult | None:
        for phrase, score in POSITIVE_PHRASES.items():
            if match_word in phrase and phrase in context_text:
                return ContextAnalysisResult(
                    context_score=score,
                    reason=f'Positive phrase detected: "{phrase}"',
                    is_whitelisted=True,
                )

        for phrase, score in NEGATIVE_PHRASES.items():
            if phrase in context_text:
                return ContextAnalysisResult(
                    context_score=score,
                    reason=f'Negative phrase detected: "{phrase}"',
                    is_whitelisted=False,
                )

        return None

    def _is_domain_whitelisted(self, context_words: list[str], match_word: str) -> bool:
        normalized_match_word = match_word.lower()

        for word in context_words:
            if word in self.domain_whitelists:
                return True
            if word in GAMING_POSITIVE and normalized_match_word in GAMING_ACCEPTABLE_WORDS:
                return True

        return False

    def _generate_reason(self, score: float, context_words: list[str]) -> str:
        found_positive = sorted({word for word in context_words if word in POSITIVE_INDICATORS})
        found_negative = sorted({word for word in context_words if word in NEGATIVE_INDICATORS})

        if score >= 0.7:
            details = f" (found: {', '.join(found_positive)})" if found_positive else ""
            return f"Positive context detected{details} - likely not profanity"
        if score <= 0.3:
            details = f" (found: {', '.join(found_negative)})" if found_negative else ""
            return f"Negative context detected{details} - likely profanity"
        return "Neutral context - uncertain classification"

    def _tokenize_with_spans(self, text: str) -> list[dict[str, int | str]]:
        tokens: list[dict[str, int | str]] = []
        for match in re.finditer(r"\S+", text):
            raw = match.group(0)
            normalized = re.sub(r"[^\w]", "", raw.lower(), flags=re.UNICODE)
            if normalized:
                tokens.append(
                    {
                        "word": normalized,
                        "start": match.start(),
                        "end": match.end(),
                    }
                )
        return tokens

    def _find_word_index(
        self, tokens: list[dict[str, int | str]], char_index: int
    ) -> int:
        if not tokens:
            return -1

        for i, token in enumerate(tokens):
            start = int(token["start"])
            end = int(token["end"])
            if char_index >= start and char_index < end:
                return i
            if char_index < start:
                return max(0, i - 1)

        return len(tokens) - 1

    def _tokenize(self, text: str) -> list[str]:
        return [str(token["word"]) for token in self._tokenize_with_spans(text)]

    def _calculate_sentiment_score(
        self, context_words: list[str], match_position: int
    ) -> float:
        positive_count = 0.0
        negative_count = 0.0
        total_words = len(context_words)

        for i, word in enumerate(context_words):
            distance = abs(i - match_position)
            weight = max(0.1, 1 - (distance * 0.2))

            if word in POSITIVE_INDICATORS:
                positive_count += weight
            elif word in NEGATIVE_INDICATORS:
                negative_count += weight

        total_sentiment = positive_count + negative_count
        if total_sentiment == 0:
            return 0.5

        raw_score = positive_count / total_sentiment
        adjusted_score = raw_score

        confidence_multiplier = min(1.0, total_words / 5)
        adjusted_score = 0.5 + (adjusted_score - 0.5) * confidence_multiplier

        if any(word in {"you", "your", "u", "ur"} for word in context_words) and raw_score < 0.7:
            adjusted_score *= 0.7

        if any(
            word in {"movie", "song", "game", "book", "show", "this", "that", "it"}
            for word in context_words
        ) and raw_score > 0.3:
            adjusted_score = min(1.0, adjusted_score * 1.3)

        return max(0.0, min(1.0, adjusted_score))
