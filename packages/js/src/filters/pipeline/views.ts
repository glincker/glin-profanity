import { LeetspeakLevel } from '../../utils/leetspeak';
import { ResolvedObfuscation } from '../obfuscation';
import { DictionaryIndex } from './dictionaryIndex';
import { htmlTransformer } from './html';
import { MappedText, Transformer, fromText, runPipeline } from './mapped';
import { maskingTransformer } from './masking';
import {
  leetTransformer,
  legacyObfuscationTransformer,
  unicodeTransformer,
} from './normalizers';
import { separatorTransformer } from './separators';
import { stretchTransformer } from './stretch';

export interface ViewConfig {
  detectLeetspeak: boolean;
  leetspeakLevel: LeetspeakLevel;
  normalizeUnicode: boolean;
  allowObfuscatedMatch: boolean;
  obfuscation: ResolvedObfuscation;
}

export interface LegacyViews {
  orig: MappedText;
  norm: MappedText;
  aggr: MappedText;
}

const LONG_RUN = /(.)\1\1/u;
const AMBIGUOUS_GLYPH = /[\p{L}@$][|1!]+\p{L}/u;

/**
 * Builds the texts the dictionary is matched against: the three views the
 * filter always used, plus enhanced views that only exist when the text shows
 * a sign of HTML, separators, masks, stretching or `|`/`1`/`!` ambiguity.
 */
export class ViewFactory {
  private readonly prefix: Transformer[];
  private readonly stretch: Transformer | null;

  constructor(private readonly cfg: ViewConfig, index: DictionaryIndex) {
    const obf = cfg.obfuscation;
    this.prefix = [];
    if (obf.html.enabled) this.prefix.push(htmlTransformer(obf.html));
    if (obf.separators.enabled) this.prefix.push(separatorTransformer(index, obf.separators));
    if (obf.masking.enabled) this.prefix.push(maskingTransformer(index, obf.masking));
    this.stretch = obf.stretch ? stretchTransformer(index) : null;
  }

  private normalizeSteps(aggressive: boolean, ambiguousAsL = false): Transformer[] {
    const steps: Transformer[] = [];
    if (this.cfg.normalizeUnicode) steps.push(unicodeTransformer);
    if (this.cfg.detectLeetspeak) {
      steps.push(
        leetTransformer({
          level: this.cfg.leetspeakLevel,
          maxRepeated: aggressive ? 1 : 2,
          ambiguousAsL,
        }),
      );
    } else if (this.cfg.allowObfuscatedMatch) {
      steps.push(legacyObfuscationTransformer);
    }
    return steps;
  }

  legacyViews(text: string): LegacyViews {
    const orig = fromText(text);
    return {
      orig,
      norm: runPipeline(orig, this.normalizeSteps(false)),
      aggr: runPipeline(orig, this.normalizeSteps(true)),
    };
  }

  /** Extra views, empty when the text carries no obfuscation signal. */
  enhancedViews(text: string): MappedText[] {
    const orig = fromText(text);
    const prepared = runPipeline(orig, this.prefix);
    const changed = prepared !== orig;
    const longRun = this.stretch !== null && LONG_RUN.test(prepared.text);
    const ambiguous =
      this.cfg.obfuscation.ambiguousLeet &&
      this.cfg.detectLeetspeak &&
      AMBIGUOUS_GLYPH.test(prepared.text);
    if (!changed && !longRun && !ambiguous) return [];

    const views: MappedText[] = [];
    const tail = this.stretch ? [this.stretch] : [];
    if (changed || longRun) {
      views.push(runPipeline(prepared, [...this.normalizeSteps(false), ...tail]));
    }
    if (ambiguous) {
      views.push(runPipeline(prepared, [...this.normalizeSteps(false, true), ...tail]));
    }
    return views;
  }
}
