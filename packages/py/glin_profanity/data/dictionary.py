"""Dictionary loader for profanity word lists."""

import json
from pathlib import Path

from glin_profanity.types.types import Language


class DictionaryLoader:
    """Loads profanity dictionaries from shared JSON files."""

    LANGUAGE_FILES = {
        "arabic": "arabic.json",
        "chinese": "chinese.json",
        "czech": "czech.json",
        "danish": "danish.json",
        "dutch": "dutch.json",
        "english": "english.json",
        "esperanto": "esperanto.json",
        "finnish": "finnish.json",
        "french": "french.json",
        "german": "german.json",
        "hindi": "hindi.json",
        "hungarian": "hungarian.json",
        "italian": "italian.json",
        "japanese": "japanese.json",
        "korean": "korean.json",
        "norwegian": "norwegian.json",
        "persian": "persian.json",
        "polish": "polish.json",
        "portuguese": "portuguese.json",
        "russian": "russian.json",
        "spanish": "spanish.json",
        "turkish": "turkish.json",
        "swedish": "swedish.json",
        "thai": "thai.json",
    }

    def __init__(self) -> None:
        """Initialize dictionary loader."""
        # Get path to bundled dictionaries (inside the package)
        current_dir = Path(__file__).parent
        self._dict_path = current_dir / "dictionaries"

        # Fallback to shared dictionaries for development
        if not self._dict_path.exists():
            self._dict_path = (
                current_dir.parent.parent.parent.parent / "shared" / "dictionaries"
            )

        self._dictionaries: dict[str, list[str]] = {}

    def _raise_format_error(self, filename: str) -> None:
        """Raise a ValueError for unexpected file format."""
        msg = f"Unexpected format in {filename}"
        raise ValueError(msg)

    def _load_dictionary(self, language: str) -> None:
        """Load a specific dictionary file."""
        if language in self._dictionaries:
            return

        filename = self.LANGUAGE_FILES.get(language)
        if not filename:
            return

        file_path = self._dict_path / filename
        try:
            with file_path.open(encoding="utf-8") as f:
                data = json.load(f)
                # Handle both {"words": [...]} and [...] formats
                if isinstance(data, dict) and "words" in data:
                    raw_words = data["words"]
                elif isinstance(data, list):
                    raw_words = data
                else:
                    self._raise_format_error(filename)
                    return
                # Guard against malformed entries (None/numbers/objects) so the
                # AC build and matching never crash on bad dictionary data.
                self._dictionaries[language] = [
                    word for word in raw_words if isinstance(word, str) and word
                ]
        except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
            print(f"Warning: Could not load {filename}: {e}")  # noqa: T201
            # Do not cache the failure: a later call can retry after the file
            # appears (e.g. misconfigured wheel path during startup).

    def get_words(self, language: Language) -> list[str]:
        """Get words for a specific language."""
        if language not in self._dictionaries:
            if language in self.LANGUAGE_FILES:
                self._load_dictionary(language)
        return self._dictionaries.get(language, [])

    def get_all_words(self) -> list[str]:
        """Get all words from all languages."""
        for language in self.LANGUAGE_FILES:
            self._load_dictionary(language)

        # Same language order as the JS package, duplicates removed in first-seen order,
        # so hits and reports come out in the same order in both.
        all_words: dict[str, None] = {}
        for language in self.LANGUAGE_FILES:
            all_words.update(dict.fromkeys(self._dictionaries.get(language, [])))
        return list(all_words)

    @property
    def available_languages(self) -> list[str]:
        """Get list of available languages."""
        return list(self.LANGUAGE_FILES.keys())


# Global instance
dictionary = DictionaryLoader()
