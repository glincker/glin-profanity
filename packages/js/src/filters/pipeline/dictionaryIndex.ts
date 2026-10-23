import { normalizeLeetspeak, LeetspeakLevel } from '../../utils/leetspeak';
import { escapeRegExp } from '../replacement';

export interface DictionaryIndexOptions {
  /** Normalize candidates with leetspeak rules before lookup. */
  leetspeak: boolean;
  leetspeakLevel: LeetspeakLevel;
}

const NEEDS_NORMALIZING = /[^a-z]|ph|vv|(.)\1\1/;

const LEET_READINGS: Record<string, string> = {
  '0': 'o', '1': 'il', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
};

/** Collapses every run of a repeated character to one (aasshhole -> ashole). */
export function squeeze(value: string): string {
  return value.replace(/(.)\1+/gu, '$1');
}

/**
 * Hash-based lookups over the active dictionary. Built once per Filter so the
 * transformers can ask "could this fragment be a dictionary word?" cheaply.
 */
export class DictionaryIndex {
  readonly maxWordLength: number;
  private readonly exact = new Set<string>();
  private readonly normalized = new Set<string>();
  private readonly byLength = new Map<number, string[]>();
  private readonly squeezed = new Map<string, string[]>();
  private readonly stretchPatterns = new Map<string, RegExp>();

  constructor(words: string[], private readonly options: DictionaryIndexOptions) {
    let longest = 0;
    for (const raw of words) {
      const word = raw.toLowerCase();
      if (/\s/.test(word)) continue;
      this.exact.add(word);
      longest = Math.max(longest, word.length);
      const norm = this.normalize(word);
      this.normalized.add(norm);
      // Letters only: a digit would be re-read as leetspeak after the mask is resolved.
      if (/^\p{L}+$/u.test(word)) {
        const list = this.byLength.get(word.length) ?? [];
        list.push(word);
        this.byLength.set(word.length, list);
      }
      if (/^\p{L}+$/u.test(norm) && norm.length >= 3) {
        const key = squeeze(norm);
        const list = this.squeezed.get(key) ?? [];
        if (!list.includes(norm)) list.push(norm);
        this.squeezed.set(key, list);
      }
    }
    this.maxWordLength = longest;
    this.rankMaskCandidates();
  }

  /**
   * When several words fit a mask, prefer the root other entries build on
   * (fuck over fvck, shit over scat) so reports name the expected word.
   */
  private rankMaskCandidates(): void {
    const roots = new Map<string, number>();
    for (const word of this.exact) {
      for (let len = 3; len < word.length; len++) {
        const prefix = word.slice(0, len);
        roots.set(prefix, (roots.get(prefix) ?? 0) + 1);
      }
    }
    for (const list of this.byLength.values()) {
      list.sort((a, b) => (roots.get(b) ?? 0) - (roots.get(a) ?? 0));
    }
  }

  private normalize(value: string): string {
    if (!this.options.leetspeak) return value;
    return normalizeLeetspeak(value, {
      level: this.options.leetspeakLevel,
      maxRepeated: 2,
      removeSpacedChars: false,
    }).toLowerCase();
  }

  /** True when the fragment is a dictionary word, directly or after leet decoding. */
  isWord(fragment: string): boolean {
    const lower = fragment.toLowerCase();
    if (this.exact.has(lower)) return true;
    // Plain letters without ph, vv or triple repeats normalize to themselves.
    if (!NEEDS_NORMALIZING.test(lower)) return false;
    return this.normalized.has(this.normalize(lower));
  }

  /**
   * Resolves a token with mask characters (f*ck, sh#t) to a dictionary word of
   * the same length where each mask stands for exactly one letter.
   */
  resolveMasked(token: string, masks: ReadonlySet<string>, minVisible: number): string | null {
    const chars = Array.from(token.toLowerCase());
    const length = chars.length;
    const candidates = this.byLength.get(length);
    if (!candidates) return null;

    let visible = 0;
    let maskCount = 0;
    for (const c of chars) {
      if (masks.has(c)) maskCount++;
      else if (/\p{L}/u.test(c)) visible++;
    }
    if (maskCount === 0 || visible < minVisible) return null;
    // A lone visible letter is only trusted as the first letter (f***).
    if (visible === 1 && !(length >= 4 && !masks.has(chars[0]) && /\p{L}/u.test(chars[0]))) {
      return null;
    }
    if (length <= 3 && visible < 2) return null;

    for (const word of candidates) {
      let ok = true;
      let k = 0;
      for (const w of word) {
        const c = chars[k++];
        if (masks.has(c) || c === w) continue;
        if (LEET_READINGS[c]?.includes(w)) continue;
        ok = false;
        break;
      }
      if (ok) return word;
    }
    return null;
  }

  /**
   * Resolves a stretched token (aaaasshole) to its dictionary word. The token
   * must contain the word's own letter runs, only longer, so "as" never
   * becomes "ass" and legitimate double letters still match.
   */
  resolveStretched(token: string): string | null {
    const lower = token.toLowerCase();
    const candidates = this.squeezed.get(squeeze(lower));
    if (!candidates) return null;
    for (const word of candidates) {
      if (lower.length <= word.length) continue;
      if (this.stretchPattern(word).test(lower)) return word;
    }
    return null;
  }

  private stretchPattern(word: string): RegExp {
    let pattern = this.stretchPatterns.get(word);
    if (!pattern) {
      const runs: string[] = word.match(/(.)\1*/gu) ?? [];
      const body = runs
        .map((run) => {
          const ch = escapeRegExp(Array.from(run)[0]);
          const count = Array.from(run).length;
          return count > 1 ? `${ch}{${count},}` : `${ch}+`;
        })
        .join('');
      pattern = new RegExp(`^${body}$`, 'u');
      this.stretchPatterns.set(word, pattern);
    }
    return pattern;
  }
}
