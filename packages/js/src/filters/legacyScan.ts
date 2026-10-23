import { SeverityLevel } from '../types/types';
import { WordMatcher } from './wordMatcher';

/** Inputs the legacy scanners need from the owning Filter. */
export interface LegacyScanContext {
  words: Map<string, number>;
  ignoreWords: Set<string>;
  matcher: WordMatcher;
  normalizeText: (text: string, aggressive?: boolean) => string;
}

export interface LegacyScanResult {
  profaneWords: string[];
  severityMap: Record<string, SeverityLevel>;
}

export interface LegacyContextHit {
  word: string;
  index: number;
  severity: SeverityLevel;
}

/** Boolean check across the original, normalized and aggressive views. */
export function legacyIsProfane(ctx: LegacyScanContext, value: string): boolean {
  const normalizedInput = ctx.normalizeText(value);
  const aggressiveInput = ctx.normalizeText(value, true);

  for (const word of ctx.words.keys()) {
    if (ctx.ignoreWords.has(word.toLowerCase())) continue;
    if (ctx.matcher.evaluateSeverity(word, value) !== undefined) return true;
    if (ctx.matcher.evaluateSeverity(word, normalizedInput) !== undefined) return true;
    if (ctx.matcher.evaluateSeverity(word, aggressiveInput) !== undefined) return true;
  }
  return false;
}

/** Full scan used when the obfuscation pipeline is off or fuzzy matching is on. */
export function legacyScan(ctx: LegacyScanContext, text: string): LegacyScanResult {
  const originalInput = text.toLowerCase();
  const normalizedInput = ctx.normalizeText(text).toLowerCase();
  const aggressiveInput = ctx.normalizeText(text, true).toLowerCase();

  const profaneWords: string[] = [];
  const severityMap: Record<string, SeverityLevel> = {};
  const record = (word: string, severity: SeverityLevel) => {
    if (severityMap[word] === undefined) severityMap[word] = severity;
  };

  for (const dictWord of ctx.words.keys()) {
    if (ctx.ignoreWords.has(dictWord.toLowerCase())) continue;

    let severity = ctx.matcher.evaluateSeverity(dictWord, originalInput);
    if (severity !== undefined) {
      const regex = ctx.matcher.getRegex(dictWord);
      let match;
      while ((match = regex.exec(originalInput)) !== null) {
        profaneWords.push(match[0]);
        record(match[0], severity);
      }
    }

    severity = ctx.matcher.evaluateSeverity(dictWord, normalizedInput);
    if (severity !== undefined) {
      const regex = ctx.matcher.getRegex(dictWord);
      while (regex.exec(normalizedInput) !== null) {
        if (!profaneWords.includes(dictWord)) {
          profaneWords.push(dictWord);
          record(dictWord, severity);
        }
      }
    }

    severity = ctx.matcher.evaluateSeverity(dictWord, aggressiveInput);
    if (severity !== undefined && !profaneWords.includes(dictWord)) {
      profaneWords.push(dictWord);
      record(dictWord, severity);
    }
  }
  return { profaneWords, severityMap };
}

/**
 * Occurrence list for the context-aware path. It covers the same views as
 * `legacyScan` (original, normalized, aggressive), so it never finds less.
 */
export function legacyContextHits(ctx: LegacyScanContext, text: string): LegacyContextHit[] {
  const views = [
    text.toLowerCase(),
    ctx.normalizeText(text).toLowerCase(),
    ctx.normalizeText(text, true).toLowerCase(),
  ];
  const hits: LegacyContextHit[] = [];
  for (const dictWord of ctx.words.keys()) {
    if (ctx.ignoreWords.has(dictWord.toLowerCase())) continue;
    let found = false;
    for (let v = 0; v < views.length && !found; v++) {
      const severity = ctx.matcher.evaluateSeverity(dictWord, views[v]);
      if (severity === undefined) continue;
      const regex = ctx.matcher.getRegex(dictWord);
      let match;
      while ((match = regex.exec(views[v])) !== null) {
        hits.push({ word: match[0], index: match.index, severity });
        found = true;
      }
      // Fuzzy matches have no regex occurrence; the aggressive view reports them.
      if (!found && v === views.length - 1) hits.push({ word: dictWord, index: 0, severity });
    }
  }
  return hits;
}
