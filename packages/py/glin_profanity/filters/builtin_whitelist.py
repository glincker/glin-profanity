"""Built-in safe words and phrases.

A dictionary hit that lies fully inside the protected word is skipped, so the
dictionary stays intact and neighbouring profanity is still reported.
"""

from __future__ import annotations

from typing import NamedTuple


class WhitelistEntry(NamedTuple):
    """Regex sources (no capture groups); only hits inside `protect` are dropped."""

    protect: str
    before: str = ""
    after: str = ""
    # Names need capitalization to tell "Moby Dick" from the insult.
    case_sensitive: bool = False


# Words that, before a capitalized "Dick", make it an insult rather than a name.
_NOT_A_NAME = (
    r"(?!(?:You|Your|Big|Small|Little|Huge|Fat|Stupid|Dumb|Such|What|The|This|That"
    r"|Fucking|Lazy|Ugly|Total|Complete)\s)"
)

BUILTIN_WHITELIST: list[WhitelistEntry] = [
    # Clean words that a leet-decoded or invisible-split view turns into "ass".
    WhitelistEntry(r"(?:cl|gl|gr|m|b|br|l|s|p)ass(?:es)?"),
    WhitelistEntry(
        r"ass(?:ist|istant|istants|istance|ume|umes|umed|ess|essment|assin|assins"
        r"|assinate|embly|emble|ociate|ociation|ignment|ert|et|ets)"
    ),
    # Idioms and nouns where the dictionary word is not an insult.
    WhitelistEntry("cum", before=r"(?:summa |magna )?", after=r"\s+laude"),
    WhitelistEntry("pussy", after=r"\s+willows?"),
    WhitelistEntry("tits?", before=r"(?:great|blue|coal|marsh|willow)\s+"),
    WhitelistEntry("bastard", after=r"\s+files?"),
    WhitelistEntry("jackass", after=r"\s+penguins?"),
    WhitelistEntry("cock(?:ed|ing)?", after=r"\s+the\s+(?:hammer|gun|pistol)"),
    WhitelistEntry("anal", after=r"\s+fissures?"),
    # Place name, also hit by repeated-letter collapsing.
    WhitelistEntry("twatt", after=r",?\s+(?:orkney|shetland)"),
    # Given name: "Moby Dick", "Philip K. Dick", "Dick Van Dyke".
    WhitelistEntry(
        "Dick",
        before=_NOT_A_NAME + r"(?:[A-Z][a-z]+|[A-Z]\.)\s+",
        after=r"(?!\s+(?:Head|Move|Bag|Face)\b)",
        case_sensitive=True,
    ),
    WhitelistEntry(
        "Dick",
        after=r"\s+(?!(?:Head|Move|Bag|Face)\b)[A-Z][a-z]+",
        case_sensitive=True,
    ),
]
