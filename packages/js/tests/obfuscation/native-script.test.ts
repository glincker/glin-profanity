import * as fs from 'fs';
import * as path from 'path';
import { Filter } from '../../src/filters/Filter';
import type { Language } from '../../src/types/types';
import { wordEdges } from '../../src/filters/wordEdges';

const DICT_DIR = path.resolve(__dirname, '../../../../shared/dictionaries');

function loadWords(dict: string): string[] {
  const file = fs.existsSync(path.join(DICT_DIR, `${dict}.json`)) ? dict : 'Norwegian';
  return JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${file}.json`), 'utf8')).words as string[];
}

/** Words whose first or last character is not ASCII: the ones the old `\b` could never match. */
function nativeEdgeWords(dict: string): string[] {
  return loadWords(dict).filter((w) => {
    const chars = Array.from(w);
    return chars[0].charCodeAt(0) > 127 || chars[chars.length - 1].charCodeAt(0) > 127;
  });
}

const LANGUAGES: Language[] = [
  'arabic', 'chinese', 'czech', 'esperanto', 'finnish', 'french', 'italian', 'japanese',
  'korean', 'persian', 'polish', 'portuguese', 'russian', 'swedish', 'thai', 'turkish',
];

describe('native-script dictionary words match with default word boundaries', () => {
  describe.each(LANGUAGES)('%s', (dict) => {
    const filter = new Filter({ languages: [dict] });
    // Entries made only of punctuation-like characters have no letter edge to anchor on.
    const words = nativeEdgeWords(dict).filter((w) => /[\p{L}\p{N}]$/u.test(w) && /^[\p{L}\p{N}]/u.test(w));

    it('has native-edge words to test', () => {
      expect(words.length).toBeGreaterThan(0);
    });

    it('matches every word standing alone', () => {
      const misses = words.filter((w) => !filter.isProfane(w));
      expect(misses).toEqual([]);
    });

    it('matches every word inside a sentence with punctuation', () => {
      const misses = words.filter((w) => !filter.isProfane(`He said "${w}", then left.`));
      expect(misses).toEqual([]);
    });

    it('reports the matched word in checkProfanity', () => {
      const result = filter.checkProfanity(`Well ${words[0]}! really`);
      expect(result.containsProfanity).toBe(true);
      expect(result.profaneWords.length).toBeGreaterThan(0);
    });
  });
});

describe('word boundary rules for spaced scripts', () => {
  const ru = new Filter({ languages: ['russian'] });

  it('matches the motivating example', () => {
    expect(ru.isProfane('блядство')).toBe(true);
  });

  it('flags a word between spaces and punctuation', () => {
    expect(ru.isProfane('Это полное дерьмо, правда')).toBe(true);
  });

  it('does not flag a word glued into a longer unrelated word', () => {
    // "бугор" is listed; "бугорок" (a small hill) is an ordinary word.
    expect(ru.isProfane('бугор')).toBe(true);
    expect(ru.isProfane('На поле небольшой бугорок')).toBe(false);
    expect(ru.isProfane('небугор')).toBe(false);
  });

  it('keeps ASCII edge behaviour: a native letter before an ASCII word still matches', () => {
    const en = new Filter({ languages: ['english'] });
    expect(en.isProfane('éasshole')).toBe(true);
  });

  it('replaces native-script words with word boundaries on', () => {
    const filter = new Filter({ languages: ['russian'], replaceWith: '*' });
    expect(filter.checkProfanity('Это дерьмо и бугорок').processedText).toBe('Это * и бугорок');
  });
});

describe('unspaced scripts', () => {
  const zh = new Filter({ languages: ['chinese'] });
  const ja = new Filter({ languages: ['japanese'] });

  it('matches multi-character Han words glued to other text', () => {
    expect(zh.isProfane('他说你傻逼然后走了')).toBe(true);
    expect(ja.isProfane('彼は変態だと言った')).toBe(true);
  });

  it('keeps one-character Han words to standalone use', () => {
    expect(zh.isProfane('乳')).toBe(true);
    expect(zh.isProfane('豆乳和牛乳有什么不同')).toBe(false);
  });

  it('does not find a katakana word inside a longer katakana run', () => {
    expect(ja.isProfane('グロ')).toBe(true);
    expect(ja.isProfane('グローバル化が進んでいます')).toBe(false);
    expect(ja.isProfane('ホモジナイズ処理をした牛乳')).toBe(false);
  });

  it('keeps hiragana-only stems standalone', () => {
    expect(ja.isProfane('なめこの味噌汁を作りました')).toBe(false);
  });

  it('classifies edges as documented', () => {
    expect(wordEdges('傻逼')).toEqual({ head: 'free', tail: 'free' });
    expect(wordEdges('乳')).toEqual({ head: 'native', tail: 'native' });
    expect(wordEdges('グロ')).toEqual({ head: 'kata', tail: 'kata' });
    expect(wordEdges('дерьмо')).toEqual({ head: 'native', tail: 'native' });
    expect(wordEdges('shit')).toEqual({ head: 'ascii', tail: 'ascii' });
    expect(wordEdges('卖B')).toEqual({ head: 'free', tail: 'ascii' });
    expect(wordEdges('')).toEqual({ head: 'ascii', tail: 'ascii' });
  });
});

describe('wordBoundaries: false is unchanged', () => {
  it('still matches substrings in every script', () => {
    const ru = new Filter({ languages: ['russian'], wordBoundaries: false });
    expect(ru.isProfane('бугорок')).toBe(true);
    const ja = new Filter({ languages: ['japanese'], wordBoundaries: false });
    expect(ja.isProfane('グローバル')).toBe(true);
    const en = new Filter({ languages: ['english'], wordBoundaries: false });
    expect(en.isProfane('xxshitxx')).toBe(true);
  });
});

describe('clean native text', () => {
  it.each<[Language, string]>([
    ['russian', 'Сегодня очень хорошая погода'],
    ['arabic', 'الطقس جميل اليوم'],
    ['chinese', '今天天气很好，我们去公园散步'],
    ['japanese', '今日は天気がいいので公園へ行きましょう'],
    ['korean', '오늘은 날씨가 정말 좋아요'],
    ['turkish', 'Bugün hava çok güzel'],
  ])('%s sentence is not flagged', (dict, text) => {
    expect(new Filter({ languages: [dict] }).isProfane(text)).toBe(false);
  });
});
