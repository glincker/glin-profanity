import { normalizeLeetspeak } from '../../src/utils/leetspeak';
import { normalizeUnicode } from '../../src/utils/unicode';
import {
  fromText,
  applyEdits,
  replaceRegex,
  toOriginalSpan,
} from '../../src/filters/pipeline/mapped';
import {
  unicodeTransformer,
  leetTransformer,
  legacyObfuscationTransformer,
} from '../../src/filters/pipeline/normalizers';
import { normalizeForMatching } from '../../src/filters/normalizeText';
import { lcg } from './helpers';

const SAMPLES = [
  'f4ck', 'sh!t', '@$$ho|e', 'f|_|ck', 'f u c k you', 'fuuuuck', 'café naïve',
  'fυck', 'ｆｕｃｋ', 'f​u​c​k', 'ph4t vv0rd', '/\\/\\ad',
  'cl@ss', 'h3ll0 w0rld', 'a b c d e', 'f́uck', 'ass﻿istant', 'ok',
];

function randomText(next: () => number): string {
  const alphabet = 'abcdefghij 0134578@$!|/\\()<>_.-*#éυа​́Ａ';
  let out = '';
  const length = 1 + Math.floor(next() * 24);
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(next() * alphabet.length)];
  return out;
}

describe('mapped normalizers match the plain functions', () => {
  const next = lcg(20260101);
  const corpus = [...SAMPLES, ...Array.from({ length: 400 }, () => randomText(next))];

  it('unicode', () => {
    for (const text of corpus) {
      expect(unicodeTransformer(fromText(text)).text).toBe(normalizeUnicode(text));
    }
  });

  it.each(['basic', 'moderate', 'aggressive'] as const)('leetspeak (%s)', (level) => {
    for (const text of corpus) {
      for (const maxRepeated of [1, 2]) {
        const mapped = leetTransformer({ level, maxRepeated })(fromText(text)).text;
        expect(mapped).toBe(normalizeLeetspeak(text, { level, maxRepeated }));
      }
    }
  });

  it('the full filter normalization chain, in both modes', () => {
    const config = {
      normalizeUnicode: true,
      detectLeetspeak: true,
      leetspeakLevel: 'aggressive' as const,
      allowObfuscatedMatch: false,
    };
    for (const text of corpus) {
      const viaMap = leetTransformer({ level: 'aggressive', maxRepeated: 1 })(
        unicodeTransformer(fromText(text)),
      ).text;
      expect(viaMap).toBe(normalizeForMatching(text, true, config));
    }
  });

  it('legacy obfuscation', () => {
    const config = {
      normalizeUnicode: false,
      detectLeetspeak: false,
      leetspeakLevel: 'moderate' as const,
      allowObfuscatedMatch: true,
    };
    for (const text of corpus) {
      expect(legacyObfuscationTransformer(fromText(text)).text).toBe(
        normalizeForMatching(text, false, config),
      );
    }
  });
});

describe('index maps', () => {
  it('keeps identity spans when nothing changes', () => {
    const m = fromText('hello');
    expect(toOriginalSpan(m, 1, 3)).toEqual([1, 3]);
  });

  it('maps deleted and rewritten characters back to the source', () => {
    const removed = replaceRegex(fromText('a<b>c'), /<b>/g, () => '');
    expect(removed.text).toBe('ac');
    expect(toOriginalSpan(removed, 0, 2)).toEqual([0, 5]);

    const rewritten = replaceRegex(fromText('x/\\y'), /\/\\/g, () => 'a');
    expect(rewritten.text).toBe('xay');
    expect(toOriginalSpan(rewritten, 1, 2)).toEqual([1, 3]);
  });

  it('composes across several edits', () => {
    const step1 = applyEdits(fromText('f.u.c.k'), [
      { start: 1, end: 2, replacement: '' },
      { start: 3, end: 4, replacement: '' },
      { start: 5, end: 6, replacement: '' },
    ]);
    expect(step1.text).toBe('fuck');
    expect(toOriginalSpan(step1, 0, 4)).toEqual([0, 7]);
    expect(toOriginalSpan(step1, 2, 3)).toEqual([4, 5]);
  });
});
