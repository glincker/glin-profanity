import { HOMOGLYPHS, ZERO_WIDTH_CHARS } from '../../utils/unicode';
import {
  getLeetspeakTables,
  SPACED_CHARS_PATTERN,
  LeetspeakLevel,
} from '../../utils/leetspeak';
import { MappedText, Transformer, applyEdits, replaceRegex, mapChars, Edit } from './mapped';

const ZERO_WIDTH_PATTERN = new RegExp(`[${ZERO_WIDTH_CHARS.join('')}]`, 'g');
const NON_ASCII = /[\u0080-\uffff]/;

/**
 * Offset-tracking twin of `normalizeUnicode`. A test pins the output text to
 * the plain function so the two cannot drift.
 */
export const unicodeTransformer: Transformer = (input) => {
  if (!NON_ASCII.test(input.text)) return input;

  let m = replaceRegex(input, ZERO_WIDTH_PATTERN, () => '');
  m = replaceRegex(m, /[！-～]/g, (match) =>
    String.fromCharCode(match[0].charCodeAt(0) - 0xfee0),
  );
  m = mapChars(m, (ch) => HOMOGLYPHS[ch]);
  return decomposeAndStrip(m);
};

function stripMarks(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function decomposeAndStrip(m: MappedText): MappedText {
  const target = stripMarks(m.text);
  if (target === m.text) return m;

  // Per code point keeps spans precise; fall back to one coarse edit if the
  // whole-string form differs (canonical reordering of other marks).
  const edits: Edit[] = [];
  let joined = '';
  let i = 0;
  for (const ch of m.text) {
    const next = ch.length === 1 && ch.charCodeAt(0) < 0x80 ? ch : stripMarks(ch);
    if (next !== ch) edits.push({ start: i, end: i + ch.length, replacement: next });
    joined += next;
    i += ch.length;
  }
  if (joined === target) return applyEdits(m, edits);
  return applyEdits(m, [{ start: 0, end: m.text.length, replacement: target }]);
}

export interface LeetTransformOptions {
  level: LeetspeakLevel;
  maxRepeated: number;
  ambiguousAsL?: boolean;
}

/**
 * Offset-tracking twin of `normalizeLeetspeak` with collapse and spaced-char
 * removal enabled, which is how the filter always calls it.
 */
export function leetTransformer(options: LeetTransformOptions): Transformer {
  const tables = getLeetspeakTables(options.level, options.ambiguousAsL ?? false);
  const repeated = new RegExp(`(.)\\1{${options.maxRepeated},}`, 'gi');

  return (input) => {
    let m = replaceRegex(input, SPACED_CHARS_PATTERN, (match) => match[0].replace(/\s+/g, ''));
    for (const [pattern, replacement] of tables.multi) {
      m = replaceRegex(m, pattern, () => replacement);
    }
    m = mapChars(m, (ch) => tables.single[ch]);
    return replaceRegex(m, repeated, (match) => match[1].repeat(options.maxRepeated));
  };
}

/** Offset-tracking twin of the legacy allowObfuscatedMatch normalization. */
export const legacyObfuscationTransformer: Transformer = (input) => {
  const charMap: Record<string, string> = { '@': 'a', $: 's', '!': 'i', '1': 'i', '*': '' };
  const m = replaceRegex(input, /([a-zA-Z])\1{1,}/g, (match) => match[1] + match[1]);
  return replaceRegex(m, /[@$!1*]/g, (match) => charMap[match[0]] || match[0]);
};
