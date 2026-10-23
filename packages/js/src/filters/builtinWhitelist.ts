/**
 * Built-in safe words and phrases. A dictionary hit that lies fully inside the
 * protected word is skipped, so the dictionary stays intact and neighbouring
 * profanity is still reported.
 */
export interface WhitelistEntry {
  /** Context required before the protected word (regex source, no capture groups). */
  before?: string;
  /** The ambiguous word itself: only hits inside it are dropped. */
  protect: string;
  /** Context required after the protected word (regex source, no capture groups). */
  after?: string;
  /** Names need capitalization to tell "Moby Dick" from the insult. */
  caseSensitive?: boolean;
}

/** Words that, before a capitalized "Dick", make it an insult rather than a name. */
const NOT_A_NAME =
  '(?!(?:You|Your|Big|Small|Little|Huge|Fat|Stupid|Dumb|Such|What|The|This|That|Fucking|Lazy|Ugly|Total|Complete)\\s)';

export const BUILTIN_WHITELIST: WhitelistEntry[] = [
  // Clean words that a leet-decoded or invisible-character-split view turns into "ass".
  { protect: '(?:cl|gl|gr|m|b|br|l|s|p)ass(?:es)?' },
  { protect: 'ass(?:ist|istant|istants|istance|ume|umes|umed|ess|essment|assin|assins|assinate|embly|emble|ociate|ociation|ignment|ert|et|ets)' },
  // Idioms and nouns where the dictionary word is not an insult.
  { before: '(?:summa |magna )?', protect: 'cum', after: '\\s+laude' },
  { protect: 'pussy', after: '\\s+willows?' },
  { before: '(?:great|blue|coal|marsh|willow)\\s+', protect: 'tits?' },
  { protect: 'bastard', after: '\\s+files?' },
  { protect: 'jackass', after: '\\s+penguins?' },
  { protect: 'cock(?:ed|ing)?', after: '\\s+the\\s+(?:hammer|gun|pistol)' },
  { protect: 'anal', after: '\\s+fissures?' },
  // Place name, also hit by repeated-letter collapsing.
  { protect: 'twatt', after: ',?\\s+(?:orkney|shetland)' },
  // Given name: "Moby Dick", "Philip K. Dick", "Dick Van Dyke".
  {
    before: `${NOT_A_NAME}(?:[A-Z][a-z]+|[A-Z]\\.)\\s+`,
    protect: 'Dick',
    after: '(?!\\s+(?:Head|Move|Bag|Face)\\b)',
    caseSensitive: true,
  },
  { protect: 'Dick', after: '\\s+(?!(?:Head|Move|Bag|Face)\\b)[A-Z][a-z]+', caseSensitive: true },
];
