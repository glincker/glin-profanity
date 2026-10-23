/**
 * Built-in safe words and phrases. A dictionary hit that overlaps one of these
 * is skipped, so the dictionary itself stays intact.
 */
export interface WhitelistEntry {
  /** Regular expression source, matched on word boundaries. */
  pattern: string;
  /** Names need capitalization to tell "Moby Dick" from the insult. */
  caseSensitive?: boolean;
}

export const BUILTIN_WHITELIST: WhitelistEntry[] = [
  // Clean words that a leet-decoded or invisible-character-split view turns into "ass".
  { pattern: '(?:cl|gl|gr|m|b|br|l|s|p)ass(?:es)?' },
  { pattern: 'ass(?:ist|istant|istants|istance|ume|umes|umed|ess|essment|assin|assins|assinate|embly|emble|ociate|ociation|ignment|ert|et|ets)' },
  // Idioms and nouns where the dictionary word is not an insult.
  { pattern: '(?:summa |magna )?cum\\s+laude' },
  { pattern: 'pussy\\s+willows?' },
  { pattern: '(?:great|blue|coal|marsh|willow)\\s+tits?' },
  { pattern: 'bastard\\s+files?' },
  { pattern: 'jackass\\s+penguins?' },
  { pattern: 'cock(?:ed|ing)?\\s+the\\s+(?:hammer|gun|pistol)' },
  { pattern: 'anal\\s+fissures?' },
  // Place name, also hit by repeated-letter collapsing.
  { pattern: 'twatt,?\\s+(?:orkney|shetland)' },
  // Given name: "Moby Dick", "Philip K. Dick", "Dick Van Dyke".
  { pattern: '(?:[A-Z][a-z]+|[A-Z]\\.)\\s+Dick', caseSensitive: true },
  { pattern: 'Dick\\s+(?!(?:Head|Move|Bag|Face)\\b)[A-Z][a-z]+', caseSensitive: true },
];
