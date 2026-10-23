/**
 * Type definitions for glin-profanity JavaScript/TypeScript package.
 * Unified API that mirrors the Python package structure.
 */

/** Severity levels for profanity matches - unified with Python */
export enum SeverityLevel {
  EXACT = 1,
  FUZZY = 2,
}

/** Supported languages - unified list with Python */
export type Language =
  | 'arabic'
  | 'chinese'
  | 'czech'
  | 'danish'
  | 'dutch'
  | 'english'
  | 'esperanto'
  | 'finnish'
  | 'french'
  | 'german'
  | 'hindi'
  | 'hungarian'
  | 'italian'
  | 'japanese'
  | 'korean'
  | 'norwegian'
  | 'persian'
  | 'polish'
  | 'portuguese'
  | 'russian'
  | 'spanish'
  | 'swedish'
  | 'thai'
  | 'turkish';

/** Represents a profanity match in text - unified with Python */
export interface Match {
  word: string;
  index: number;
  severity: SeverityLevel;
  contextScore?: number;
  reason?: string;
  isWhitelisted?: boolean;
}

/** Result of profanity check operation - unified field names */
export interface CheckProfanityResult {
  containsProfanity: boolean;
  profaneWords: string[];
  processedText?: string;
  severityMap?: Record<string, SeverityLevel>;
  matches?: Match[];
  contextScore?: number;
  reason?: string;
}

/** Configuration for context-aware filtering - unified with Python */
export interface ContextAwareConfig {
  enableContextAware?: boolean;
  contextWindow?: number;
  confidenceThreshold?: number;
  domainWhitelists?: Record<string, string[]>;
}

/** Leetspeak detection intensity levels */
export type LeetspeakLevel = 'basic' | 'moderate' | 'aggressive';

/**
 * Shortcut for the obfuscation pipeline.
 * - `off`: plain matching only (the behavior before the pipeline existed)
 * - `basic`: HTML tags and entities, stretched letters, safe-word list
 * - `standard`: basic plus separators (f.u.c.k), masks (f*ck) and `|`/`1`/`!` read as l
 * - `strict`: standard plus looser joins (spaces inside mixed chains, shorter fragments)
 */
export type ObfuscationLevel = 'off' | 'basic' | 'standard' | 'strict';

/** Fine-grained switches for the obfuscation pipeline. Each overrides the level. */
export interface ObfuscationOptions {
  /** Starting point for the switches below. @default 'standard' */
  level?: ObfuscationLevel;
  /** Strip tags and decode entities before matching. `decodeDepth` handles double encoding. */
  html?: boolean | { decodeDepth?: number };
  /** Join letters split by separators such as `f.u.c.k` or `f|u|c|k`. */
  separators?: boolean | {
    chars?: string;
    allowSpace?: boolean;
    minTwoPieceLength?: number;
  };
  /** Resolve masked words such as `f*ck` or `b*****d`. */
  masking?: boolean | { chars?: string; minVisible?: number };
  /** Collapse stretched letters such as `aaaasshole`. */
  stretch?: boolean;
  /** Also read `|`, `1` and `!` as `l` (needs detectLeetspeak). */
  ambiguousLeet?: boolean;
  /** Skip dictionary hits that overlap the built-in safe words and phrases. */
  builtinWhitelist?: boolean;
}

/** Main filter configuration options - unified with Python */
export interface FilterConfig extends ContextAwareConfig {
  languages?: Language[];
  allLanguages?: boolean;
  caseSensitive?: boolean;
  wordBoundaries?: boolean;
  customWords?: string[];
  replaceWith?: string;
  severityLevels?: boolean;
  ignoreWords?: string[];
  logProfanity?: boolean;
  allowObfuscatedMatch?: boolean;
  fuzzyToleranceLevel?: number;

  /**
   * Enable leetspeak detection (e.g., "f4ck" → "fuck").
   * @default false
   */
  detectLeetspeak?: boolean;

  /**
   * Leetspeak detection intensity level.
   * - `basic`: Numbers only (0→o, 1→i, 3→e, 4→a, 5→s)
   * - `moderate`: Basic + symbols (@→a, $→s, !→i)
   * - `aggressive`: All known substitutions
   * @default 'moderate'
   */
  leetspeakLevel?: LeetspeakLevel;

  /**
   * Enable Unicode normalization to detect homoglyphs and obfuscation.
   * @default true
   */
  normalizeUnicode?: boolean;

  /**
   * Obfuscation pipeline: a level shortcut or fine-grained switches.
   * @default 'standard'
   */
  obfuscation?: ObfuscationLevel | ObfuscationOptions;

  /**
   * Extra safe words or phrases. A dictionary hit lying fully inside one is ignored; other words around it are still checked.
   * Matched case-insensitively on word boundaries.
   */
  whitelist?: string[];

  /**
   * Cache profanity check results for repeated strings.
   * @default false
   */
  cacheResults?: boolean;

  /**
   * Maximum cache size when caching is enabled.
   * @default 1000
   */
  maxCacheSize?: number;
}

/** Result with minimum severity filtering */
export interface FilteredProfanityResult {
  result: CheckProfanityResult;
  filteredWords: string[];
}