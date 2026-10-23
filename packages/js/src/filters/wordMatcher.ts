import { SeverityLevel } from '../types/types';
import { boundedPattern } from './wordEdges';

export interface WordMatcherOptions {
  caseSensitive: boolean;
  wordBoundaries: boolean;
  fuzzyToleranceLevel: number;
}

/**
 * Per-word regex matching with a compiled-regex cache.
 * Shared by the legacy scanner and the obfuscation-aware scanner.
 */
export class WordMatcher {
  private regexCache = new Map<string, RegExp>();

  constructor(private readonly opts: WordMatcherOptions) {}

  get wordBoundaries(): boolean {
    return this.opts.wordBoundaries;
  }

  clear(): void {
    this.regexCache.clear();
  }

  /** Returns a shared global regex for the word with lastIndex reset. */
  getRegex(word: string): RegExp {
    const cached = this.regexCache.get(word);
    if (cached) {
      cached.lastIndex = 0;
      return cached;
    }
    const baseFlags = this.opts.caseSensitive ? 'g' : 'gi';
    let regex: RegExp;
    if (this.opts.wordBoundaries) {
      const { source, unicode } = boundedPattern(word);
      regex = new RegExp(source, unicode ? `${baseFlags}u` : baseFlags);
    } else {
      regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), baseFlags);
    }
    this.regexCache.set(word, regex);
    return regex;
  }

  isFuzzyToleranceMatch(word: string, text: string): boolean {
    const simplifiedText = text.toLowerCase().replace(/[^a-z]/g, '');
    const simplifiedWord = word.toLowerCase();
    let matchCount = 0;
    let index = 0;

    for (let i = 0; i < simplifiedText.length; i++) {
      if (simplifiedText[i] === simplifiedWord[index]) {
        matchCount++;
        index++;
        if (index === simplifiedWord.length) break;
      }
    }

    return matchCount / simplifiedWord.length >= this.opts.fuzzyToleranceLevel;
  }

  evaluateSeverity(word: string, text: string): SeverityLevel | undefined {
    if (this.getRegex(word).test(text)) {
      return SeverityLevel.EXACT;
    }
    // Fuzzy matching only without word boundaries, so "scunthorpe" stays clean.
    if (!this.opts.wordBoundaries && this.isFuzzyToleranceMatch(word, text)) {
      return SeverityLevel.FUZZY;
    }
    return undefined;
  }
}
