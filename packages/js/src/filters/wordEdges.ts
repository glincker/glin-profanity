/**
 * Word-edge rules for whole-word matching. An ASCII `\b` can never sit next to
 * a non-ASCII letter, so dictionary words that start or end with one (Cyrillic,
 * Arabic, Hangul, Turkish o-umlaut, ...) would never match with boundaries on.
 *
 * ascii:  `\b`, exactly the legacy behaviour (so "easshole" style edges keep working)
 * native: no letter, digit or underscore next to the edge (Unicode aware)
 * free:   no check. Han has no word spacing, so a word of two or more characters
 *         may sit inside a longer run. One-character words stay native.
 * kata:   Katakana edge: may touch hiragana or Han (particles, okurigana) but not
 *         more katakana, so "グロ" is not found inside "グローバル".
 * Hiragana, Hangul and Thai edges are native: those words normally have spaces
 * or punctuation around them and short stems occur inside many clean words.
 */
export type EdgeKind = 'ascii' | 'native' | 'free' | 'kata';

const KATA = '\\u30a1-\\u30fa\\u30fc-\\u30ff\\u31f0-\\u31ff\\uff66-\\uff9f';
const HAN = /^(?:[\u3005\u3100-\u312f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2fa1f}])$/u;
const KATAKANA = new RegExp(`^[${KATA}]$`, 'u');
const NATIVE = /^[\p{L}\p{N}\p{M}]$/u;

function edgeKind(char: string, wordLength: number): EdgeKind {
  if (char.charCodeAt(0) < 128 || !NATIVE.test(char)) return 'ascii';
  if (KATAKANA.test(char)) return 'kata';
  return wordLength >= 2 && HAN.test(char) ? 'free' : 'native';
}

export interface WordEdges {
  head: EdgeKind;
  tail: EdgeKind;
}

export function wordEdges(word: string): WordEdges {
  const chars = Array.from(word);
  if (chars.length === 0) return { head: 'ascii', tail: 'ascii' };
  return {
    head: edgeKind(chars[0], chars.length),
    tail: edgeKind(chars[chars.length - 1], chars.length),
  };
}

const HEAD: Record<EdgeKind, string> = {
  ascii: '\\b',
  native: '(?<![\\p{L}\\p{N}_])',
  free: '',
  kata: `(?<![${KATA}])`,
};
const TAIL: Record<EdgeKind, string> = {
  ascii: '\\b',
  native: '(?![\\p{L}\\p{N}_])',
  free: '',
  kata: `(?![${KATA}])`,
};

export function headSource(kind: EdgeKind): string {
  return HEAD[kind];
}

export function tailSource(kind: EdgeKind): string {
  return TAIL[kind];
}

/** Regex source and flag requirement for one whole-word pattern. */
export function boundedPattern(word: string): { source: string; unicode: boolean } {
  const { head, tail } = wordEdges(word);
  return {
    source: `${HEAD[head]}${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${TAIL[tail]}`,
    unicode: head !== 'ascii' && head !== 'free' || tail !== 'ascii' && tail !== 'free',
  };
}
