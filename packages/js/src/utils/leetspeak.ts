/**
 * @fileoverview Leetspeak detection and normalization utilities.
 * Converts leetspeak/1337 speak text back to standard characters for profanity detection.
 * @module utils/leetspeak
 */

/**
 * Leetspeak detection intensity levels.
 * - `basic`: Common substitutions only (0→o, 1→i, 3→e, 4→a, 5→s)
 * - `moderate`: Basic + symbols (@→a, $→s, !→i) and repeated chars
 * - `aggressive`: All known substitutions including multi-char patterns
 */
export type LeetspeakLevel = 'basic' | 'moderate' | 'aggressive';

/**
 * Configuration options for leetspeak normalization.
 */
export interface LeetspeakOptions {
  /**
   * Detection intensity level.
   * @default 'moderate'
   */
  level?: LeetspeakLevel;

  /**
   * Whether to collapse repeated characters (e.g., "fuuuuck" → "fuck").
   * @default true
   */
  collapseRepeated?: boolean;

  /**
   * Maximum allowed consecutive repeated characters before collapsing.
   * @default 2
   */
  maxRepeated?: number;

  /**
   * Whether to remove spaces between single characters (e.g., "f u c k" → "fuck").
   * @default true
   */
  removeSpacedChars?: boolean;

  /**
   * Read the ambiguous glyphs `|`, `1` and `!` as `l` instead of `i`
   * (for example `a$$ho|e`). Used to build an alternate view of the text.
   * @default false
   */
  ambiguousAsL?: boolean;
}

/**
 * Basic character substitution map (numbers only).
 * Most common leetspeak substitutions that are unlikely to cause false positives.
 */
const BASIC_SUBSTITUTIONS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
};

/**
 * Moderate character substitution map (numbers + common symbols).
 * Includes symbol substitutions that are commonly used in profanity evasion.
 */
export const MODERATE_SUBSTITUTIONS: Record<string, string> = {
  ...BASIC_SUBSTITUTIONS,
  '@': 'a',
  '$': 's',
  '!': 'i',
  '(': 'c',
  '<': 'c',
  '{': 'c',
  '[': 'c',
  '+': 't',
  '€': 'e',
  '&': 'e',
  '#': 'h',
  '¥': 'y',
  '§': 's',
  '†': 't',
  '®': 'r',
  '©': 'c',
  '²': '2',
  '³': '3',
};

/**
 * Aggressive multi-character substitution patterns.
 * These patterns are replaced before single-character substitutions.
 */
const AGGRESSIVE_MULTI_CHAR: Array<[RegExp, string]> = [
  // Letter A patterns
  [/\/\\/g, 'a'],
  [/\/-\\/g, 'a'],
  [/\^/g, 'a'],
  // Letter B patterns
  [/\|3/g, 'b'],
  [/13/g, 'b'],
  [/ß/g, 'b'],
  // Letter D patterns
  [/\|\)/g, 'd'],
  [/\|>/g, 'd'],
  [/\[\)/g, 'd'],
  // Letter F patterns
  [/\|=/g, 'f'],
  [/ph/gi, 'f'],
  // Letter H patterns
  [/\|-\|/g, 'h'],
  [/\}\{/g, 'h'],
  // Letter K patterns
  [/\|</g, 'k'],
  [/\|\{/g, 'k'],
  // Letter L patterns
  [/\|_/g, 'l'],
  // Letter M patterns
  [/\/\\\/\\/g, 'm'],
  [/\|V\|/g, 'm'],
  [/\[V\]/g, 'm'],
  // Letter N patterns
  [/\/\\\//g, 'n'],
  [/\|\\\|/g, 'n'],
  // Letter P patterns
  [/\|\*/g, 'p'],
  [/\|o/g, 'p'],
  // Letter R patterns
  [/\|2/g, 'r'],
  [/\|\?/g, 'r'],
  // Letter U patterns
  [/\|_\|/g, 'u'],
  [/\\_\\/g, 'u'],
  [/\/_\//g, 'u'],
  // Letter V patterns
  [/\\\//g, 'v'],
  // Letter W patterns
  [/\\\/\\\//g, 'w'],
  [/vv/gi, 'w'],
  // Letter X patterns
  [/></g, 'x'],
  // Letter Y patterns
  [/'\//g, 'y'],
  // Letter Z patterns
  [/7_/g, 'z'],
];

// Longest pattern first so `|_|` (u) is not eaten by `|_` (l) and `/\/\` (m) by `/\` (a).
AGGRESSIVE_MULTI_CHAR.sort((a, b) => b[0].source.length - a[0].source.length);

/**
 * Aggressive single-character substitutions.
 * Includes less common substitutions that may cause some false positives.
 */
export const AGGRESSIVE_SUBSTITUTIONS: Record<string, string> = {
  ...MODERATE_SUBSTITUTIONS,
  '|': 'i',
  '6': 'g',
  '2': 'z',
  '%': 'z',
};

/** Glyphs that can stand for either `i` or `l`. */
const AMBIGUOUS_AS_L: Record<string, string> = { '|': 'l', '1': 'l', '!': 'l' };

/** Matches 3+ single characters separated by whitespace (f u c k). */
export const SPACED_CHARS_PATTERN =
  /\b([a-zA-Z0-9@$!#])\s+([a-zA-Z0-9@$!#])(\s+[a-zA-Z0-9@$!#])+\b/g;

/** Digit + one Latin letter ("5m") is a measurement, so its digits must not turn into letters. */
const MEASUREMENT_LIKE = /(?<![A-Za-z])\d+[A-Za-z](?![A-Za-z])/g;

/** Indices of digits that belong to a measurement-like token such as `5m`. */
export function measurementDigitIndices(text: string): Set<number> {
  const keep = new Set<number>();
  for (const match of text.matchAll(MEASUREMENT_LIKE)) {
    const start = match.index ?? 0;
    for (let i = start; i < start + match[0].length; i++) {
      if (text[i] >= '0' && text[i] <= '9') keep.add(i);
    }
  }
  return keep;
}

/** Tables the mapped (offset-tracking) normalizer shares with this module. */
export function getLeetspeakTables(
  level: LeetspeakLevel,
  ambiguousAsL: boolean = false,
): { multi: Array<[RegExp, string]>; single: Record<string, string> } {
  return {
    multi: level === 'aggressive' ? AGGRESSIVE_MULTI_CHAR : [],
    single: getSubstitutionMap(level, ambiguousAsL),
  };
}

/**
 * Normalizes leetspeak text to standard characters.
 *
 * @param text - The input text containing potential leetspeak
 * @param options - Configuration options for normalization
 * @returns The normalized text with leetspeak characters replaced
 *
 * @example
 * ```typescript
 * import { normalizeLeetspeak } from 'glin-profanity';
 *
 * normalizeLeetspeak('f4ck');     // Returns: 'fack'
 * normalizeLeetspeak('sh!t');     // Returns: 'shit'
 * normalizeLeetspeak('b1tch');    // Returns: 'bitch'
 * normalizeLeetspeak('@ss');      // Returns: 'ass'
 * normalizeLeetspeak('f u c k');  // Returns: 'fuck'
 * normalizeLeetspeak('fuuuuck');  // Returns: 'fuck'
 * ```
 */
export function normalizeLeetspeak(
  text: string,
  options: LeetspeakOptions = {}
): string {
  const {
    level = 'moderate',
    collapseRepeated = true,
    maxRepeated = 2,
    removeSpacedChars = true,
    ambiguousAsL = false,
  } = options;

  let normalized = text;

  // Step 1: Handle spaced characters (f u c k → fuck)
  if (removeSpacedChars) {
    normalized = collapseSpacedCharacters(normalized);
  }

  // Step 2: Apply multi-character patterns first (aggressive only)
  if (level === 'aggressive') {
    for (const [pattern, replacement] of AGGRESSIVE_MULTI_CHAR) {
      normalized = normalized.replace(pattern, replacement);
    }
  }

  // Step 3: Apply single-character substitutions
  const substitutions = getSubstitutionMap(level, ambiguousAsL);
  const keepDigits = measurementDigitIndices(normalized);
  normalized = normalized
    .split('')
    .map((char, index) => (keepDigits.has(index) ? char : substitutions[char] || char))
    .join('');

  // Step 4: Collapse repeated characters (fuuuuck → fuck)
  if (collapseRepeated) {
    normalized = collapseRepeatedCharacters(normalized, maxRepeated);
  }

  return normalized;
}

/**
 * Gets the appropriate substitution map based on the detection level.
 *
 * @param level - The leetspeak detection level
 * @returns The character substitution map
 */
function getSubstitutionMap(
  level: LeetspeakLevel,
  ambiguousAsL: boolean = false,
): Record<string, string> {
  if (ambiguousAsL) return { ...getSubstitutionMap(level), ...AMBIGUOUS_AS_L };
  switch (level) {
    case 'basic':
      return BASIC_SUBSTITUTIONS;
    case 'moderate':
      return MODERATE_SUBSTITUTIONS;
    case 'aggressive':
      return AGGRESSIVE_SUBSTITUTIONS;
    default:
      return MODERATE_SUBSTITUTIONS;
  }
}

/**
 * Collapses sequences of spaced single characters into words.
 * Handles patterns like "f u c k" → "fuck" and "s h i t" → "shit".
 *
 * @param text - The input text
 * @returns Text with spaced characters collapsed
 *
 * @example
 * ```typescript
 * collapseSpacedCharacters('f u c k you');  // Returns: 'fuck you'
 * collapseSpacedCharacters('this is s h i t'); // Returns: 'this is shit'
 * ```
 */
export function collapseSpacedCharacters(text: string): string {
  // Match sequences of single characters separated by spaces
  // At least 3 characters to avoid false positives with "I a m" etc.
  return text.replace(SPACED_CHARS_PATTERN, (match) => {
    // Remove all spaces between characters
    return match.replace(/\s+/g, '');
  });
}

/**
 * Collapses repeated consecutive characters beyond a threshold.
 * Handles patterns like "fuuuuck" → "fuck" and "shiiiit" → "shit".
 *
 * @param text - The input text
 * @param maxRepeated - Maximum allowed consecutive repeated characters
 * @returns Text with repeated characters collapsed
 *
 * @example
 * ```typescript
 * collapseRepeatedCharacters('fuuuuck', 2);  // Returns: 'fuuck'
 * collapseRepeatedCharacters('fuuuuck', 1);  // Returns: 'fuck'
 * ```
 */
export function collapseRepeatedCharacters(
  text: string,
  maxRepeated: number = 2
): string {
  // Create regex that matches any character repeated more than maxRepeated times
  const pattern = new RegExp(`(.)\\1{${maxRepeated},}`, 'gi');
  return text.replace(pattern, (match, char) => char.repeat(maxRepeated));
}

/**
 * Detects if text contains potential leetspeak patterns.
 * Useful for deciding whether to apply leetspeak normalization.
 *
 * @param text - The input text to analyze
 * @returns True if leetspeak patterns are detected
 *
 * @example
 * ```typescript
 * containsLeetspeak('hello');     // Returns: false
 * containsLeetspeak('h3ll0');     // Returns: true
 * containsLeetspeak('f4ck');      // Returns: true
 * containsLeetspeak('@ss');       // Returns: true
 * ```
 */
export function containsLeetspeak(text: string): boolean {
  // Check for common leetspeak patterns
  const leetspeakPatterns = [
    /[0-9]/, // Contains numbers (potential leetspeak)
    /[@$!#]/, // Contains common leetspeak symbols
    /(.)\1{3,}/, // Excessive character repetition
    /\b[a-zA-Z]\s+[a-zA-Z]\s+[a-zA-Z]\b/, // Spaced characters
  ];

  return leetspeakPatterns.some((pattern) => pattern.test(text));
}

/**
 * Creates a normalized variant generator for a word.
 * Generates all possible leetspeak variants of a dictionary word.
 *
 * @param word - The base word to generate variants for
 * @param level - The leetspeak level to use for variant generation
 * @returns Array of possible leetspeak variants
 *
 * @example
 * ```typescript
 * generateLeetspeakVariants('ass');
 * // Returns: ['ass', '@ss', 'a$$', '@$$', '4ss', '4$$', ...]
 * ```
 */
export function generateLeetspeakVariants(
  word: string,
  level: LeetspeakLevel = 'moderate'
): string[] {
  const variants = new Set<string>([word.toLowerCase()]);
  const substitutions = getSubstitutionMap(level);

  // Create reverse mapping (a → ['4', '@'], etc.)
  const reverseMap: Record<string, string[]> = {};
  for (const [leet, normal] of Object.entries(substitutions)) {
    if (!reverseMap[normal]) {
      reverseMap[normal] = [];
    }
    reverseMap[normal].push(leet);
  }

  // Generate variants by substituting each character
  function generateVariants(current: string, index: number): void {
    if (index >= word.length) {
      variants.add(current);
      return;
    }

    const char = word[index].toLowerCase();
    generateVariants(current + char, index + 1);

    // Add leetspeak variants for this character
    if (reverseMap[char]) {
      for (const leetChar of reverseMap[char]) {
        generateVariants(current + leetChar, index + 1);
      }
    }
  }

  // Only generate a reasonable number of variants to avoid explosion
  // For words longer than 6 chars, limit to basic substitutions
  if (word.length <= 6) {
    generateVariants('', 0);
  }

  return Array.from(variants);
}
