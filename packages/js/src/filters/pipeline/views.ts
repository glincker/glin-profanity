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
  /** Same steps without separator joining, for glyphs like `|` that are also separators. */
  private readonly prefixWithoutSeparators: Transformer[];
  private readonly stretch: Transformer | null;

  constructor(private readonly cfg: ViewConfig, index: DictionaryIndex) {
    const obf = cfg.obfuscation;
    const html = obf.html.enabled ? [htmlTransformer(obf.html)] : [];
    const separators = obf.separators.enabled ? [separatorTransformer(index, obf.separators)] : [];
    const masking = obf.masking.enabled ? [maskingTransformer(index, obf.masking)] : [];
    this.prefix = [...html, ...separators, ...masking];
    this.prefixWithoutSeparators = [...html, ...masking];
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
      AMBIGUOUS_GLYPH.test(text);
    if (!changed && !longRun && !ambiguous) return [];

    const views: MappedText[] = [];
    const tail = this.stretch ? [this.stretch] : [];
    if (changed || longRun) {
      views.push(runPipeline(prepared, [...this.normalizeSteps(false), ...tail]));
    }
    if (ambiguous) {
      const steps = [...this.normalizeSteps(false, true), ...tail];
      views.push(runPipeline(prepared, steps));
      if (this.cfg.obfuscation.separators.enabled) {
        const unjoined = runPipeline(orig, this.prefixWithoutSeparators);
        if (unjoined.text !== prepared.text) views.push(runPipeline(unjoined, steps));
      }
    }
    return views;
  }
}
