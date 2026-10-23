import { SeverityLevel } from '../types/types';
import { ResolvedObfuscation } from './obfuscation';
import { DictionaryIndex } from './pipeline/dictionaryIndex';
import { MappedText, toOriginalSpan } from './pipeline/mapped';
import { ViewFactory, ViewConfig, LegacyViews } from './pipeline/views';
import { WordMatcher } from './wordMatcher';
import { Whitelist, overlaps, Interval } from './whitelist';
import { escapeRegExp } from './replacement';

export type ViewKind = 'orig' | 'norm' | 'aggr' | 'enhanced';

export interface ScanHit {
  /** Dictionary word that matched. */
  word: string;
  /** Text matched in the view (lowercase). */
  text: string;
  view: ViewKind;
  /** Span in the original input. */
  start: number;
  end: number;
  severity: SeverityLevel;
}

export interface ScannerConfig extends ViewConfig {
  words: Map<string, number>;
  /** Plain string normalization, used for the cheap prefilter. */
  normalizeText: (text: string, aggressive?: boolean) => string;
  ignoreWords: Set<string>;
  matcher: WordMatcher;
  obfuscation: ResolvedObfuscation;
  whitelist: string[];
  caseSensitive: boolean;
}

/**
 * Dictionary scan over the original text and its normalized and enhanced views.
 * A combined regex per view answers "anything here?" in one pass, so clean text
 * never pays for the per-word loop.
 */
export class Scanner {
  readonly index: DictionaryIndex;
  private readonly views: ViewFactory;
  private readonly activeWords: string[];
  private readonly any: RegExp | null;
  private readonly whitelist: Whitelist;

  constructor(private readonly cfg: ScannerConfig) {
    this.activeWords = Array.from(cfg.words.keys()).filter(
      (word) => !cfg.ignoreWords.has(word.toLowerCase()),
    );
    this.index = new DictionaryIndex(this.activeWords, {
      leetspeak: cfg.detectLeetspeak,
      leetspeakLevel: cfg.leetspeakLevel,
    });
    this.views = new ViewFactory(cfg, this.index);
    this.whitelist = new Whitelist(cfg.whitelist, cfg.obfuscation.builtinWhitelist);
    this.any =
      this.activeWords.length === 0
        ? null
        : new RegExp(
            `\\b(?:${this.activeWords.map(escapeRegExp).join('|')})\\b`,
            cfg.caseSensitive ? '' : 'i',
          );
  }

  private hasCandidate(text: string): boolean {
    return this.any !== null && this.any.test(text);
  }

  /**
   * Boolean check. Clean text exits after one regex test per view; text with a
   * hit also exits early unless a safe word could overlap it.
   */
  isProfane(text: string): boolean {
    const norm = this.cfg.normalizeText(text);
    const aggr = this.cfg.normalizeText(text, true);
    const enhanced = this.views.enhancedViews(text);
    const candidate =
      this.hasCandidate(text) ||
      this.hasCandidate(norm) ||
      this.hasCandidate(aggr) ||
      enhanced.some((view) => this.hasCandidate(view.text));
    if (!candidate) return false;
    if (!this.whitelist.mightMatch([text, norm, aggr, ...enhanced.map((v) => v.text)])) return true;
    return this.scan(text, 'full').length > 0;
  }

  /**
   * Returns hits in dictionary order, views in order orig, norm, aggr, enhanced.
   * `context` mode skips the original and aggressive views, as the
   * context-aware path always did.
   */
  scan(text: string, mode: 'full' | 'context'): ScanHit[] {
    const enhanced = this.views.enhancedViews(text);
    const quick = [
      text.toLowerCase(),
      this.cfg.normalizeText(text).toLowerCase(),
      this.cfg.normalizeText(text, true).toLowerCase(),
    ];
    if (!quick.some((t) => this.hasCandidate(t)) && !enhanced.some((v) => this.hasCandidate(v.text.toLowerCase()))) {
      return [];
    }
    const legacy = this.views.legacyViews(text);

    const views: Array<{ kind: ViewKind; view: MappedText; lower: string }> = [];
    const add = (kind: ViewKind, view: MappedText) => {
      const lowered = view.text.toLowerCase();
      views.push({ kind, view, lower: lowered.length === view.text.length ? lowered : view.text });
    };
    if (mode === 'full') add('orig', legacy.orig);
    add('norm', legacy.norm);
    if (mode === 'full') add('aggr', legacy.aggr);
    for (const view of enhanced) add('enhanced', view);

    const live = views.filter((v) => this.hasCandidate(v.lower));
    const hits: ScanHit[] = [];
    const seen = new Set<string>();
    for (const word of this.activeWords) {
      for (const { kind, view, lower } of live) {
        const regex = this.cfg.matcher.getRegex(word);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(lower)) !== null) {
          if (match[0].length === 0) {
            regex.lastIndex++;
            continue;
          }
          const [start, end] = toOriginalSpan(view, match.index, match.index + match[0].length);
          const key = `${word}|${start}|${end}`;
          if (kind !== 'orig' && mode === 'context' && seen.has(key)) continue;
          if (kind === 'enhanced' && seen.has(key)) continue;
          seen.add(key);
          hits.push({
            word,
            text: match[0],
            view: kind,
            start,
            end,
            severity: SeverityLevel.EXACT,
          });
        }
      }
    }
    return this.dropWhitelisted(hits, legacy, enhanced, mode);
  }

  private dropWhitelisted(
    hits: ScanHit[],
    legacy: LegacyViews,
    enhanced: MappedText[],
    mode: 'full' | 'context',
  ): ScanHit[] {
    if (hits.length === 0 || this.whitelist.isEmpty) return hits;
    const safe: Interval[] = [];
    const sources = [legacy.orig, legacy.norm, ...(mode === 'full' ? [legacy.aggr] : []), ...enhanced];
    for (const view of sources) safe.push(...this.whitelist.intervals(view));
    if (safe.length === 0) return hits;
    return hits.filter((hit) => !safe.some((span) => overlaps([hit.start, hit.end], span)));
  }
}
