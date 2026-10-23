/**
 * @fileoverview Tests for leetspeak detection and Unicode normalization.
 */

import { Filter } from '../src/filters/Filter';
import {
  normalizeLeetspeak,
  collapseSpacedCharacters,
  collapseRepeatedCharacters,
  containsLeetspeak,
  normalizeUnicode,
  removeZeroWidthCharacters,
  convertFullWidth,
  convertHomoglyphs,
  containsUnicodeObfuscation,
  detectCharacterSets,
} from '../src/utils';

describe('Leetspeak Detection', () => {
  describe('normalizeLeetspeak', () => {
    it('should convert basic number substitutions', () => {
      expect(normalizeLeetspeak('h3ll0', { level: 'basic' })).toBe('hello');
      expect(normalizeLeetspeak('4ss', { level: 'basic' })).toBe('ass');
      expect(normalizeLeetspeak('sh1t', { level: 'basic' })).toBe('shit');
      expect(normalizeLeetspeak('f4ck', { level: 'basic' })).toBe('fack');
    });

    it('should convert moderate symbol substitutions', () => {
      expect(normalizeLeetspeak('@ss', { level: 'moderate' })).toBe('ass');
      expect(normalizeLeetspeak('$hit', { level: 'moderate' })).toBe('shit');
      expect(normalizeLeetspeak('b!tch', { level: 'moderate' })).toBe('bitch');
      expect(normalizeLeetspeak('f#ck', { level: 'moderate' })).toBe('fhck');
    });

    it('should not treat measurement tokens like 5m as leetspeak', () => {
      expect(normalizeLeetspeak('…5mまで', { level: 'moderate' })).toBe('…5mまで');
      expect(normalizeLeetspeak('stay 10m away', { level: 'moderate' })).toBe('stay 10m away');
      expect(normalizeLeetspeak('f4ck', { level: 'moderate' })).toBe('fack');
      expect(normalizeLeetspeak('5ex', { level: 'moderate' })).toBe('sex');
    });

    it('should handle aggressive substitutions', () => {
      expect(normalizeLeetspeak('ph4t', { level: 'aggressive' })).toBe('fat');
    });
  });

  describe('collapseSpacedCharacters', () => {
    it('should collapse spaced single characters', () => {
      expect(collapseSpacedCharacters('f u c k')).toBe('fuck');
      expect(collapseSpacedCharacters('s h i t')).toBe('shit');
      expect(collapseSpacedCharacters('hello f u c k world')).toBe('hello fuck world');
    });

    it('should not collapse normal text', () => {
      expect(collapseSpacedCharacters('I am here')).toBe('I am here');
      expect(collapseSpacedCharacters('hello world')).toBe('hello world');
    });
  });

  describe('collapseRepeatedCharacters', () => {
    it('should collapse repeated characters', () => {
      expect(collapseRepeatedCharacters('fuuuuck', 1)).toBe('fuck');
      expect(collapseRepeatedCharacters('shiiiit', 1)).toBe('shit');
      expect(collapseRepeatedCharacters('heeello', 2)).toBe('heello');
    });

    it('should preserve normal text', () => {
      expect(collapseRepeatedCharacters('hello', 2)).toBe('hello');
      expect(collapseRepeatedCharacters('book', 2)).toBe('book');
    });
  });

  describe('containsLeetspeak', () => {
    it('should detect leetspeak patterns', () => {
      expect(containsLeetspeak('h3llo')).toBe(true);
      expect(containsLeetspeak('@ss')).toBe(true);
      expect(containsLeetspeak('f u c k')).toBe(true);
      expect(containsLeetspeak('fuuuuck')).toBe(true);
    });

    it('should return false for normal text', () => {
      expect(containsLeetspeak('hello')).toBe(false);
      expect(containsLeetspeak('world')).toBe(false);
    });
  });
});

describe('Unicode Normalization', () => {
  describe('normalizeUnicode', () => {
    it('should normalize diacritics', () => {
      expect(normalizeUnicode('fück')).toBe('fuck');
      expect(normalizeUnicode('café')).toBe('cafe');
      expect(normalizeUnicode('naïve')).toBe('naive');
    });

    it('should convert full-width characters', () => {
      expect(normalizeUnicode('ｆｕｃｋ')).toBe('fuck');
      expect(normalizeUnicode('ＡＢＣ')).toBe('ABC');
    });

    it('should convert homoglyphs', () => {
      // Greek letters that look like Latin
      expect(normalizeUnicode('fυck')).toBe('fuck'); // Greek upsilon
      expect(normalizeUnicode('fосk')).toBe('fock'); // Cyrillic о
      expect(normalizeUnicode('fսck')).toBe('fuck'); // Armenian seh
    });

    it('normalizes the extended homoglyph categories (kept in sync with Python)', () => {
      expect(normalizeUnicode('у')).toBe('u'); // Cyrillic small u -> u (not y)
      expect(normalizeUnicode('к')).toBe('k'); // Cyrillic small ka
      expect(normalizeUnicode('ℝ')).toBe('R'); // double-struck capital R
      expect(normalizeUnicode('ⓐ')).toBe('a'); // circled a
      expect(normalizeUnicode('ʀ')).toBe('R'); // small-cap R
      expect(normalizeUnicode('ɐ')).toBe('a'); // turned a
      expect(normalizeUnicode('¢')).toBe('c'); // cent sign
    });

    it('keeps Japanese dakuten while folding Latin diacritics', () => {
      // ゾ must not collapse to ソ (that made クソ match ゾクゾク); ビ stays ビ.
      expect(normalizeUnicode('ゾクゾク')).toBe('ゾクゾク');
      expect(normalizeUnicode('ビッチ')).toBe('ビッチ');
      expect(normalizeUnicode('クソゲー')).toBe('クソゲー');
      expect(normalizeUnicode('café')).toBe('cafe');
      expect(normalizeUnicode('erección')).toBe('ereccion');
    });
  });

  describe('removeZeroWidthCharacters', () => {
    it('should remove zero-width spaces', () => {
      expect(removeZeroWidthCharacters('f\u200Buck')).toBe('fuck');
      expect(removeZeroWidthCharacters('he\u200Cllo')).toBe('hello');
    });
  });

  describe('convertFullWidth', () => {
    it('should convert full-width to half-width', () => {
      expect(convertFullWidth('ａｂｃ')).toBe('abc');
      expect(convertFullWidth('１２３')).toBe('123');
      expect(convertFullWidth('！＠＃')).toBe('!@#');
    });
  });

  describe('convertHomoglyphs', () => {
    it('should convert cyrillic homoglyphs', () => {
      expect(convertHomoglyphs('Ηello')).toBe('Hello'); // Greek Eta
      expect(convertHomoglyphs('аbс')).toBe('abc'); // Cyrillic а, с
    });
  });

  describe('containsUnicodeObfuscation', () => {
    it('should detect unicode obfuscation', () => {
      expect(containsUnicodeObfuscation('f\u200Buck')).toBe(true);
      expect(containsUnicodeObfuscation('fυck')).toBe(true);
      expect(containsUnicodeObfuscation('ｆｕｃｋ')).toBe(true);
    });

    it('should return false for normal text', () => {
      expect(containsUnicodeObfuscation('hello')).toBe(false);
      expect(containsUnicodeObfuscation('world')).toBe(false);
    });
  });

  describe('detectCharacterSets', () => {
    it('should detect mixed scripts', () => {
      const result = detectCharacterSets('Hеllo'); // Mixed Latin and Cyrillic е
      expect(result.hasLatin).toBe(true);
      expect(result.hasCyrillic).toBe(true);
      expect(result.hasMixed).toBe(true);
    });

    it('should detect single scripts', () => {
      const result = detectCharacterSets('Hello');
      expect(result.hasLatin).toBe(true);
      expect(result.hasCyrillic).toBe(false);
      expect(result.hasMixed).toBe(false);
    });
  });
});

describe('Filter with Leetspeak and Unicode', () => {
  describe('Leetspeak Detection', () => {
    const filter = new Filter({
      languages: ['english'],
      detectLeetspeak: true,
      leetspeakLevel: 'moderate',
      fuzzyToleranceLevel: 0.7, // Lower threshold to catch more leetspeak variants
      wordBoundaries: true,     // Require word boundaries to avoid false positives
    });

    it('should detect common leetspeak profanity', () => {
      // These work because the normalized forms closely match dictionary words
      expect(filter.isProfane('@ss')).toBe(true);   // @ss → ass
      expect(filter.isProfane('a$$')).toBe(true);   // a$$ → ass
      expect(filter.isProfane('sh!t')).toBe(true);  // sh!t → shit
      expect(filter.isProfane('b!tch')).toBe(true); // b!tch → bitch
    });

    it('should detect spaced profanity', () => {
      expect(filter.isProfane('f u c k')).toBe(true);
      expect(filter.isProfane('s h i t')).toBe(true);
      expect(filter.isProfane('a s s')).toBe(true);
    });

    it('should detect repeated character profanity', () => {
      expect(filter.isProfane('fuuuuck')).toBe(true);
      expect(filter.isProfane('shiiiit')).toBe(true);
      expect(filter.isProfane('asssss')).toBe(true);
    });

    it('should not flag clean text', () => {
      // Use a filter with default fuzzy tolerance for clean text tests
      const strictFilter = new Filter({
        languages: ['english'],
        detectLeetspeak: true,
        wordBoundaries: true,
      });
      expect(strictFilter.isProfane('hello')).toBe(false);
      expect(strictFilter.isProfane('h3llo')).toBe(false);    // Not profanity
      expect(strictFilter.isProfane('world')).toBe(false);    // Clean text
      expect(strictFilter.isProfane('good morning')).toBe(false);
    });
  });

  describe('Unicode Normalization', () => {
    const filter = new Filter({
      languages: ['english'],
      normalizeUnicode: true,
    });

    it('should detect unicode obfuscated profanity', () => {
      expect(filter.isProfane('fück')).toBe(true);
      expect(filter.isProfane('fυck')).toBe(true); // Greek upsilon
      expect(filter.isProfane('ｆｕｃｋ')).toBe(true); // Full-width
    });

    it('should detect zero-width character obfuscation', () => {
      expect(filter.isProfane('f\u200Buck')).toBe(true);
    });
  });

  describe('Measurement false positives', () => {
    const filter = new Filter({
      languages: ['japanese'],
      detectLeetspeak: true,
      normalizeUnicode: true,
    });

    it('should not flag distance 5m as Japanese sm', () => {
      const result = filter.checkProfanity('おい近づくな…5mまでだ');
      expect(result.containsProfanity).toBe(false);
      expect(result.profaneWords).toEqual([]);
    });
  });

  describe('Combined Leetspeak and Unicode', () => {
    const filter = new Filter({
      languages: ['english'],
      detectLeetspeak: true,
      leetspeakLevel: 'aggressive',
      normalizeUnicode: true,
      fuzzyToleranceLevel: 0.7,
    });

    it('should detect combined obfuscation', () => {
      expect(filter.isProfane('@ss')).toBe(true);
      expect(filter.isProfane('fück')).toBe(true);
      expect(filter.isProfane('f\u200Buck')).toBe(true); // zero-width in "fuck"
      expect(filter.isProfane('sh!t')).toBe(true);
    });

    it('should detect shootout evasion categories', () => {
      const cases = [
        'shi7e',
        'f.u.c.k',
        'a<br>ss',
        'sh&#105;t',
        'This is f*cking ridiculous',
        'holy f*** that was amazing',
        'what a f@cking mess',
        'fսck',
      ];
      for (const text of cases) {
        expect(filter.isProfane(text)).toBe(true);
      }
    });
  });

  describe('Caching', () => {
    const filter = new Filter({
      languages: ['english'],
      cacheResults: true,
      maxCacheSize: 100,
    });

    it('should cache results', () => {
      const result1 = filter.checkProfanity('test text');
      const result2 = filter.checkProfanity('test text');
      expect(result1).toEqual(result2);
      expect(filter.getCacheSize()).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      filter.checkProfanity('some text');
      expect(filter.getCacheSize()).toBeGreaterThan(0);
      filter.clearCache();
      expect(filter.getCacheSize()).toBe(0);
    });
  });
});

describe('checkProfanity with new options', () => {
  it('should return correct result structure', () => {
    const filter = new Filter({
      languages: ['english'],
      detectLeetspeak: true,
      severityLevels: true,
      fuzzyToleranceLevel: 0.7,
    });

    const result = filter.checkProfanity('this is @ss');
    expect(result.containsProfanity).toBe(true);
    expect(result.profaneWords.length).toBeGreaterThan(0);
    expect(result.severityMap).toBeDefined();
  });

  it('should handle replacement with leetspeak', () => {
    const filter = new Filter({
      languages: ['english'],
      detectLeetspeak: true,
      replaceWith: '***',
      fuzzyToleranceLevel: 0.7,
    });

    const result = filter.checkProfanity('this is sh!t');
    expect(result.containsProfanity).toBe(true);
    expect(result.processedText).toBeDefined();
  });

  it('should handle unicode normalization in checkProfanity', () => {
    const filter = new Filter({
      languages: ['english'],
      normalizeUnicode: true,
    });

    const result = filter.checkProfanity('fück this');
    expect(result.containsProfanity).toBe(true);
    expect(result.profaneWords.length).toBeGreaterThan(0);
  });
});

describe('Accent-folded aliases', () => {
  it('matches an accented entry even when the user drops diacritics', () => {
    const filter = new Filter({
      languages: [],
      customWords: ['erección'],
      normalizeUnicode: true,
      detectLeetspeak: true,
    });
    expect(filter.checkProfanity('le muerdo la ereccion').containsProfanity).toBe(true);
    expect(filter.checkProfanity('le muerdo la erección').containsProfanity).toBe(true);
  });

  it('does not alias short accented words (año -> ano)', () => {
    const filter = new Filter({
      languages: [],
      customWords: ['año'],
      normalizeUnicode: true,
      detectLeetspeak: true,
    });
    expect(filter.checkProfanity('el ano').containsProfanity).toBe(false);
  });
});
