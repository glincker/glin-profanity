import dictionary from '../data/dictionary';
import { Language, CheckProfanityResult, SeverityLevel, Match, FilterConfig, LeetspeakLevel } from '../types/types';
import { ContextAnalyzer } from '../nlp/contextAnalyzer';
import { normalizeForMatching } from './normalizeText';
import { normalizeUnicode } from '../utils/unicode';
import { WordMatcher } from './wordMatcher';
import { redactText } from './redact';
import { uniqueSpans, summarizeHits } from './hitSummary';
import { legacyIsProfane, legacyScan, legacyContextHits, LegacyScanContext } from './legacyScan';
import { Scanner, ScanHit } from './scanner';
import { resolveObfuscation, obfuscationEnabled } from './obfuscation';
import { Whitelist, Interval, protectedSpans, blankProtected } from './whitelist';

export type { FilterConfig };

/**
 * Core profanity filter class.
 * Provides comprehensive profanity detection with support for multiple languages,
 * leetspeak detection, Unicode normalization, and context-aware filtering.
 *
 * @example
 * ```typescript
 * const filter = new Filter({
 *   languages: ['english'],
 *   detectLeetspeak: true,
 *   normalizeUnicode: true,
 * });
 *
 * filter.isProfane('f4ck');  // Returns: true
 * filter.isProfane('fυck');  // Returns: true (Greek upsilon)
 * ```
 */
class Filter {
  private words: Map<string, number>;
  private caseSensitive: boolean;
  private wordBoundaries: boolean;
  private replaceWith?: string;
  private severityLevels: boolean;
  private ignoreWords: Set<string>;
  private logProfanity: boolean;
  private allowObfuscatedMatch: boolean;
  private fuzzyToleranceLevel: number;
  // Context-aware filtering properties
  private enableContextAware: boolean;
  private contextWindow: number;
  private confidenceThreshold: number;
  private contextAnalyzer?: ContextAnalyzer;
  private primaryLanguage: Language;
  // Leetspeak and Unicode detection
  private detectLeetspeak: boolean;
  private leetspeakLevel: LeetspeakLevel;
  private normalizeUnicodeEnabled: boolean;
  // Caching
  private cacheResults: boolean;
  private maxCacheSize: number;
  private cache: Map<string, CheckProfanityResult>;
  private matcher: WordMatcher;
  private obfuscationOption: FilterConfig['obfuscation'];
  private whitelistWords: string[];
  private scanner?: Scanner;
  private legacyWhitelist?: Whitelist;

  /**
   * Creates a new Filter instance with the specified configuration.
   *
   * @param config - Filter configuration options
   *
   * @example
   * ```typescript
   * // Basic usage
   * const filter = new Filter({ languages: ['english'] });
   *
   * // With leetspeak detection
   * const filter = new Filter({
   *   languages: ['english'],
   *   detectLeetspeak: true,
   *   leetspeakLevel: 'moderate',
   * });
   *
   * // With all advanced features
   * const filter = new Filter({
   *   languages: ['english', 'spanish'],
   *   detectLeetspeak: true,
   *   normalizeUnicode: true,
   *   cacheResults: true,
   *   enableContextAware: true,
   * });
   * ```
   */
  constructor(config?: FilterConfig) {
    const defaultLanguage: Language = 'english';

    // Context-aware settings
    this.enableContextAware = config?.enableContextAware ?? false;
    this.contextWindow = config?.contextWindow ?? 3;
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.7;
    this.primaryLanguage = config?.languages?.[0] || defaultLanguage;

    if (this.enableContextAware) {
      this.contextAnalyzer = new ContextAnalyzer({
        contextWindow: this.contextWindow,
        language: this.primaryLanguage,
        domainWhitelists: config?.domainWhitelists?.[this.primaryLanguage] || []
      });
    }

    // Basic settings
    this.caseSensitive = config?.caseSensitive ?? false;
    this.allowObfuscatedMatch = config?.allowObfuscatedMatch ?? false;
    this.wordBoundaries = config?.wordBoundaries ?? !this.allowObfuscatedMatch;
    this.replaceWith = config?.replaceWith;
    this.severityLevels = config?.severityLevels ?? false;
    this.ignoreWords = new Set(
      config?.ignoreWords?.map((word) => word.toLowerCase()) || [],
    );
    this.logProfanity = config?.logProfanity ?? false;
    this.fuzzyToleranceLevel = config?.fuzzyToleranceLevel ?? 0.8;

    // Leetspeak and Unicode normalization settings
    this.detectLeetspeak = config?.detectLeetspeak ?? false;
    this.leetspeakLevel = config?.leetspeakLevel ?? 'moderate';
    this.normalizeUnicodeEnabled = config?.normalizeUnicode ?? true;

    // Caching settings
    this.cacheResults = config?.cacheResults ?? false;
    this.maxCacheSize = config?.maxCacheSize ?? 1000;
    this.cache = new Map();
    this.matcher = new WordMatcher({
      caseSensitive: this.caseSensitive,
      wordBoundaries: this.wordBoundaries,
      fuzzyToleranceLevel: this.fuzzyToleranceLevel,
    });

    this.obfuscationOption = config?.obfuscation;
    this.whitelistWords = config?.whitelist ?? [];

    // Build word dictionary
    let words: string[] = [];

    if (config?.allLanguages) {
      for (const lang in dictionary) {
        if (Object.prototype.hasOwnProperty.call(dictionary, lang)) {
          words = [...words, ...dictionary[lang as Language]];
        }
      }
    } else {
      const languages = config?.languages || ['english'];
      const languagesChecks = new Set<Language>(languages);
      languagesChecks.forEach((lang) => {
        words = [...words, ...dictionary[lang]];
      });
    }

    if (config?.customWords) {
      words = [...words, ...config.customWords];
    }

    // Text folds diacritics, so an accented entry needs a folded alias to match
    // "ereccion". Short entries are skipped (año would alias to ano).
    if (this.normalizeUnicodeEnabled) {
      words = Filter.withAccentFoldedAliases(words);
    }

    this.words = new Map(words.map((word) => [word.toLowerCase(), 1]));
    this.scanner = this.createScanner();
    // Fuzzy matching has no scanner; only the user's own safe words apply there.
    this.legacyWhitelist =
      !this.scanner && this.whitelistWords.length > 0 ? new Whitelist(this.whitelistWords, false) : undefined;
  }

  /**
   * The obfuscation-aware scanner needs word boundaries; fuzzy matching
   * (wordBoundaries off) and `obfuscation: 'off'` keep the legacy scan.
   */
  private static readonly ACCENT_ALIAS_MIN_LENGTH = 4;

  private static withAccentFoldedAliases(words: string[]): string[] {
    const seen = new Set(words.map((word) => word.toLowerCase()));
    const extra: string[] = [];
    for (const word of words) {
      const folded = normalizeUnicode(word);
      const key = folded.toLowerCase();
      if (key === word.toLowerCase() || seen.has(key)) continue;
      if (key.replace(/ /g, '').length < Filter.ACCENT_ALIAS_MIN_LENGTH) continue;
      seen.add(key);
      extra.push(folded);
    }
    return extra.length > 0 ? [...words, ...extra] : words;
  }

  private createScanner(): Scanner | undefined {
    const obfuscation = resolveObfuscation(this.obfuscationOption);
    if (!this.wordBoundaries) return undefined;
    if (!obfuscationEnabled(obfuscation) && this.whitelistWords.length === 0) return undefined;
    return new Scanner({
      words: this.words,
      ignoreWords: this.ignoreWords,
      matcher: this.matcher,
      normalizeText: (text, aggressive) => this.normalizeText(text, aggressive),
      detectLeetspeak: this.detectLeetspeak,
      leetspeakLevel: this.leetspeakLevel,
      normalizeUnicode: this.normalizeUnicodeEnabled,
      allowObfuscatedMatch: this.allowObfuscatedMatch,
      obfuscation,
      whitelist: this.whitelistWords,
      caseSensitive: this.caseSensitive,
    });
  }

  private debugLog(...args: unknown[]) {
    if (this.logProfanity) {
      console.log('[glin-profanity]', ...args);
    }
  }

  /**
   * Normalizes text with every enabled method (Unicode, leetspeak, legacy
   * obfuscation). `aggressive` collapses repeated characters to one.
   */
  private normalizeText(text: string, aggressive: boolean = false): string {
    return normalizeForMatching(text, aggressive, {
      normalizeUnicode: this.normalizeUnicodeEnabled,
      detectLeetspeak: this.detectLeetspeak,
      leetspeakLevel: this.leetspeakLevel,
      allowObfuscatedMatch: this.allowObfuscatedMatch,
    });
  }

  /**
   * Clears the result cache.
   * Useful when dictionary or configuration changes.
   */
  public clearCache(): void {
    this.cache.clear();
    this.matcher.clear();
  }

  /**
   * Gets the current cache size.
   * @returns Number of cached results
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Exports the current filter configuration as a JSON-serializable object.
   * Useful for saving configuration to files or sharing between environments.
   *
   * @returns The current filter configuration
   *
   * @example
   * ```typescript
   * const filter = new Filter({
   *   languages: ['english', 'spanish'],
   *   detectLeetspeak: true,
   *   leetspeakLevel: 'aggressive',
   * });
   *
   * const config = filter.getConfig();
   * // Save to file: fs.writeFileSync('filter.config.json', JSON.stringify(config));
   *
   * // Later, restore:
   * // const saved = JSON.parse(fs.readFileSync('filter.config.json'));
   * // const restored = new Filter(saved);
   * ```
   */
  public getConfig(): FilterConfig {
    return {
      languages: [this.primaryLanguage],
      caseSensitive: this.caseSensitive,
      wordBoundaries: this.wordBoundaries,
      replaceWith: this.replaceWith,
      severityLevels: this.severityLevels,
      ignoreWords: Array.from(this.ignoreWords),
      logProfanity: this.logProfanity,
      allowObfuscatedMatch: this.allowObfuscatedMatch,
      fuzzyToleranceLevel: this.fuzzyToleranceLevel,
      enableContextAware: this.enableContextAware,
      contextWindow: this.contextWindow,
      confidenceThreshold: this.confidenceThreshold,
      detectLeetspeak: this.detectLeetspeak,
      leetspeakLevel: this.leetspeakLevel,
      normalizeUnicode: this.normalizeUnicodeEnabled,
      cacheResults: this.cacheResults,
      maxCacheSize: this.maxCacheSize,
      obfuscation: this.obfuscationOption,
      whitelist: this.whitelistWords,
    };
  }

  /**
   * Returns the current word dictionary size.
   * Useful for monitoring and debugging.
   *
   * @returns Number of words in the dictionary
   */
  public getWordCount(): number {
    return this.words.size;
  }

  /**
   * Adds a result to the cache, evicting oldest entries if necessary.
   */
  private addToCache(key: string, result: CheckProfanityResult): void {
    if (!this.cacheResults) return;

    // Simple LRU-like eviction: remove oldest entries when at capacity
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, result);
  }

  /**
   * Gets a cached result if available.
   */
  private getFromCache(key: string): CheckProfanityResult | undefined {
    if (!this.cacheResults) return undefined;
    return this.cache.get(key);
  }

  private redact(text: string, profaneWords: string[], hits?: ScanHit[], safeSpans: Interval[] = []): string {
    if (!this.replaceWith) return text;
    return redactText(text, profaneWords, this.replaceWith, this.wordBoundaries, hits, safeSpans);
  }

  /** Safe spans of the text on the legacy path, and the text with them blanked. */
  private legacySafe(text: string): { spans: Interval[]; text: string } {
    if (!this.legacyWhitelist) return { spans: [], text };
    const spans = protectedSpans(this.legacyWhitelist, text);
    return { spans, text: spans.length > 0 ? blankProtected(text, spans) : text };
  }

  private legacyContext(): LegacyScanContext {
    return {
      words: this.words,
      ignoreWords: this.ignoreWords,
      matcher: this.matcher,
      normalizeText: (text, aggressive) => this.normalizeText(text, aggressive),
    };
  }

  /**
   * Checks if the given text contains profanity.
   *
   * @param value - The text to check
   * @returns True if the text contains profanity
   *
   * @example
   * ```typescript
   * const filter = new Filter({ detectLeetspeak: true });
   *
   * filter.isProfane('hello');     // false
   * filter.isProfane('fuck');      // true
   * filter.isProfane('f4ck');      // true (leetspeak)
   * filter.isProfane('fυck');      // true (Unicode homoglyph)
   * ```
   */
  isProfane(value: string): boolean {
    if (this.scanner) return this.scanner.isProfane(value);
    return legacyIsProfane(this.legacyContext(), this.legacySafe(value).text);
  }

  matches(word: string): boolean {
    return this.isProfane(word);
  }

  /**
   * Performs a comprehensive profanity check on the given text.
   *
   * @param text - The text to check for profanity
   * @returns Result object containing detected profanity information
   *
   * @example
   * ```typescript
   * const filter = new Filter({
   *   languages: ['english'],
   *   detectLeetspeak: true,
   *   normalizeUnicode: true,
   * });
   *
   * const result = filter.checkProfanity('This is f4ck!ng bad');
   * console.log(result.containsProfanity);  // true
   * console.log(result.profaneWords);       // ['fuck']
   *
   * // With caching for repeated checks
   * const filter2 = new Filter({ cacheResults: true });
   * filter2.checkProfanity('same text');  // Computed
   * filter2.checkProfanity('same text');  // Retrieved from cache
   * ```
   */
  checkProfanity(text: string): CheckProfanityResult {
    // Check cache first
    const cacheKey = text;
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      this.debugLog('Cache hit for:', text.substring(0, 50));
      return cachedResult;
    }

    // Backward compatibility: if not context-aware, run old logic
    if (!this.enableContextAware) {
      const hits = this.scanner ? this.scanner.scan(text) : undefined;
      const safe = this.legacySafe(text);
      const { profaneWords, severityMap } = hits
        ? summarizeHits(hits)
        : legacyScan(this.legacyContext(), safe.text);
      const result: CheckProfanityResult = {
        containsProfanity: profaneWords.length > 0,
        profaneWords: Array.from(new Set(profaneWords)),
        processedText: this.replaceWith ? this.redact(text, profaneWords, hits, safe.spans) : undefined,
        severityMap:
          this.severityLevels && Object.keys(severityMap).length > 0
            ? severityMap
            : undefined,
      };
      this.addToCache(cacheKey, result);
      return result;
    }

    // Context-aware path
    const originalText = text;
    const profaneWords: string[] = [];
    const severityMap: Record<string, SeverityLevel> = {};
    const matches: Match[] = [];

    const safe = this.legacySafe(text);
    const legacySafeText = safe.text;
    // Same views as the plain path; the original-view hit and a derived-view hit
    // of one span are reported once.
    const scanHits = this.scanner ? uniqueSpans(this.scanner.scan(text)) : undefined;
    const contextHits = scanHits
      ? scanHits.map((h) => ({
          word: h.view === 'orig' ? h.text : h.word,
          index: h.start,
          severity: h.severity,
          scan: h,
        }))
      : legacyContextHits(this.legacyContext(), legacySafeText).map((h) => ({ ...h, scan: undefined }));
    const keptHits: ScanHit[] = [];
    for (const hit of contextHits) {
      const matchObj: Match = { word: hit.word, index: hit.index, severity: hit.severity };
      if (this.contextAnalyzer) {
        const contextResult = this.contextAnalyzer.analyzeContext(
          originalText,
          hit.word,
          hit.index,
        );
        matchObj.contextScore = contextResult.contextScore;
        matchObj.reason = contextResult.reason;
        matchObj.isWhitelisted = contextResult.isWhitelisted;
        if (contextResult.isWhitelisted || contextResult.contextScore > this.confidenceThreshold) {
          continue;
        }
      }
      profaneWords.push(hit.word);
      if (hit.scan) keptHits.push(hit.scan);
      if (severityMap[hit.word] === undefined) severityMap[hit.word] = hit.severity;
      matches.push(matchObj);
    }
    if (profaneWords.length > 0) {
      this.debugLog('Detected:', profaneWords);
    }
    const processedText = this.redact(text, profaneWords, scanHits ? keptHits : undefined, safe.spans);
    let contextScore: number | undefined;
    if (this.enableContextAware && matches.length > 0) {
      const totalScore = matches.reduce((sum, match) =>
        sum + (match.contextScore || 0.5), 0);
      contextScore = totalScore / matches.length;
    }
    const result: CheckProfanityResult = {
      containsProfanity: profaneWords.length > 0,
      profaneWords: Array.from(new Set(profaneWords)),
      processedText: this.replaceWith ? processedText : undefined,
      severityMap: this.severityLevels && Object.keys(severityMap).length > 0 ? severityMap : undefined,
      matches: matches.length > 0 ? matches : undefined,
      contextScore,
      reason: matches.length > 0 ?
        `Found ${matches.length} potential profanity matches` :
        'No profanity detected'
    };

    // Cache the result
    this.addToCache(cacheKey, result);
    return result;
  }

  /**
   * Checks profanity with minimum severity filtering.
   *
   * @param text - The text to check
   * @param minSeverity - Minimum severity level to include in results
   * @returns Object with filtered words and full result
   */
  checkProfanityWithMinSeverity(
    text: string,
    minSeverity: SeverityLevel = SeverityLevel.EXACT,
  ): { filteredWords: string[]; result: CheckProfanityResult } {
    const result = this.checkProfanity(text);
    const filteredWords =
      result.severityMap && result.profaneWords.length > 0
        ? result.profaneWords.filter((word) => {
            const severity = result.severityMap?.[word];
            return typeof severity === 'number' && severity >= minSeverity;
          })
        : [];

    return { filteredWords, result };
  }
}

export { Filter };
