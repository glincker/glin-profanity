"""Built-in safe words and phrases.

A dictionary hit that overlaps one of these is skipped, so the dictionary itself
stays intact.
"""

from __future__ import annotations

from typing import NamedTuple


class WhitelistEntry(NamedTuple):
    """Regex source matched on word boundaries; names need case to tell them apart."""

    pattern: str
    case_sensitive: bool = False


BUILTIN_WHITELIST: list[WhitelistEntry] = [
    # Clean words that a leet-decoded or invisible-split view turns into "ass".
    WhitelistEntry(r"(?:cl|gl|gr|m|b|br|l|s|p)ass(?:es)?"),
    WhitelistEntry(
        r"ass(?:ist|istant|istants|istance|ume|umes|umed|ess|essment|assin|assins"
        r"|assinate|embly|emble|ociate|ociation|ignment|ert|et|ets)"
    ),
    # Idioms and nouns where the dictionary word is not an insult.
    WhitelistEntry(r"(?:summa |magna )?cum\s+laude"),
    WhitelistEntry(r"pussy\s+willows?"),
    WhitelistEntry(r"(?:great|blue|coal|marsh|willow)\s+tits?"),
    WhitelistEntry(r"bastard\s+files?"),
    WhitelistEntry(r"jackass\s+penguins?"),
    WhitelistEntry(r"cock(?:ed|ing)?\s+the\s+(?:hammer|gun|pistol)"),
    WhitelistEntry(r"anal\s+fissures?"),
    # Place name, also hit by repeated-letter collapsing.
    WhitelistEntry(r"twatt,?\s+(?:orkney|shetland)"),
    # Given name: "Moby Dick", "Philip K. Dick", "Dick Van Dyke".
    WhitelistEntry(r"(?:[A-Z][a-z]+|[A-Z]\.)\s+Dick", True),
    WhitelistEntry(r"Dick\s+(?!(?:Head|Move|Bag|Face)\b)[A-Z][a-z]+", True),
]
