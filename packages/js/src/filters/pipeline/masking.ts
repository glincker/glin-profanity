import { escapeRegExp } from '../replacement';
import { DictionaryIndex } from './dictionaryIndex';
import { Edit, Transformer, applyEdits } from './mapped';

export interface MaskingOptions {
  /** Characters that can stand in for one hidden letter. */
  chars: string;
  /** Visible letters required before a masked token may resolve. */
  minVisible: number;
}

/** Characters that read as sentence punctuation when they sit at a token edge. */
const EDGE_PUNCTUATION = new Set(['?', '!']);

/** Markdown emphasis markers that wrap a word rather than hide a letter of it. */
const OPENER_WINDOW = 200;
const EMPHASIS_CHARS = new Set(['*', '_']);

/** Splits a token into leading markers, inner text and trailing markers in one pass. */
function splitEmphasis(raw: string): [string, string, string] {
  let lead = 0;
  while (lead < raw.length && EMPHASIS_CHARS.has(raw[lead])) lead++;
  if (lead === raw.length) return [raw, '', ''];
  let end = raw.length;
  while (end > lead && EMPHASIS_CHARS.has(raw[end - 1])) end--;
  return [raw.slice(0, lead), raw.slice(lead, end), raw.slice(end)];
}

/**
 * True for `**bold**`, `__init__` and a closing `bold**` whose opener sits earlier
 * on the line, where the mask characters only wrap the word.
 */
function isEmphasis(raw: string, text: string, tokenStart: number, masks: ReadonlySet<string>): boolean {
  const [lead, inner, trail] = splitEmphasis(raw);
  if (Array.from(inner).some((c) => masks.has(c))) return false;
  if (lead && trail) return true;
  if (!trail) return false;
  // Look back a bounded window so long single-line inputs stay linear.
  const window = text.slice(Math.max(0, tokenStart - OPENER_WINDOW), tokenStart);
  const before = window.slice(window.lastIndexOf('\n') + 1);
  return new RegExp(`(?:^|\\s)${escapeRegExp(trail)}\\S`).test(before);
}

/**
 * Resolves masked words (f*ck, sh#t, b*****d, @sshole) to the dictionary word
 * of the same length, one mask per letter. Tokens that match no dictionary
 * word (p@ssword, ****) are left untouched.
 */
export function maskingTransformer(index: DictionaryIndex, options: MaskingOptions): Transformer {
  const masks = new Set(Array.from(options.chars));
  const maskClass = escapeRegExp(options.chars).replace(/-/g, '\\-');
  const quick = new RegExp(`[${maskClass}]`);
  const token = new RegExp(`[\\p{L}\\p{N}${maskClass}]+`, 'gu');

  return (input) => {
    if (!quick.test(input.text)) return input;
    const edits: Edit[] = [];
    token.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = token.exec(input.text)) !== null) {
      const raw = match[0];
      if (isEmphasis(raw, input.text, match.index, masks)) continue;
      let lo = 0;
      let hi = raw.length;
      while (lo < hi && EDGE_PUNCTUATION.has(raw[lo])) lo++;
      while (hi > lo && EDGE_PUNCTUATION.has(raw[hi - 1])) hi--;
      const core = raw.slice(lo, hi);
      if (core.length < 3) continue;
      const word = index.resolveMasked(core, masks, options.minVisible);
      if (word && word.length === core.length) {
        edits.push({ start: match.index + lo, end: match.index + hi, replacement: word });
      }
    }
    return applyEdits(input, edits);
  };
}
