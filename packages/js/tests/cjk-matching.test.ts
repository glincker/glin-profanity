import { Filter } from '../src/filters/Filter';

describe('CJK automatic matching strategy', () => {
  const chineseFilter = new Filter({ languages: ['chinese'] });
  const japaneseFilter = new Filter({ languages: ['japanese'] });
  const koreanFilter = new Filter({ languages: ['korean'] });
  const englishFilter = new Filter({ languages: ['english'] });
  const mixedFilter = new Filter({ languages: ['english', 'chinese'] });

  describe('detects CJK profanity with default wordBoundaries', () => {
    test('Chinese', () => {
      expect(chineseFilter.isProfane('你他妈的')).toBe(true);
      expect(chineseFilter.checkProfanity('他妈的').profaneWords.length).toBeGreaterThan(0);
    });

    test('Japanese', () => {
      expect(japaneseFilter.isProfane('このエッチな話')).toBe(true);
      expect(japaneseFilter.isProfane('エッチ')).toBe(true);
    });

    test('Korean', () => {
      expect(koreanFilter.isProfane('이 병신')).toBe(true);
      expect(koreanFilter.isProfane('병신')).toBe(true);
    });

    test('Japanese ASCII entries still use Latin boundaries', () => {
      expect(japaneseFilter.isProfane('hello xx world')).toBe(true);
      expect(japaneseFilter.isProfane('xxtra')).toBe(false);
    });

    test('detects CJK profanity wrapped in or adjacent to ASCII', () => {
      expect(chineseFilter.isProfane('hello他妈的')).toBe(true);
      // 乳 alone is ambiguous (milk), so it is not flagged between Latin letters.
      expect(chineseFilter.isProfane('x乳x')).toBe(false);
      expect(chineseFilter.isProfane('123他妈的456')).toBe(true);
      expect(japaneseFilter.isProfane('abcエッチdef')).toBe(true);
    });
  });

  describe('preserves English false-positive protection', () => {
    test('does not flag scunthorpe or classic for English words', () => {
      expect(englishFilter.isProfane('scunthorpe')).toBe(false);
      expect(englishFilter.isProfane('classic')).toBe(false);
      expect(englishFilter.isProfane('assassin')).toBe(false);
    });

    test('still detects standalone English profanity', () => {
      expect(englishFilter.isProfane('hello fuck world')).toBe(true);
    });

    test('mixed filter does not false-positive English traps', () => {
      expect(mixedFilter.isProfane('scunthorpe')).toBe(false);
      expect(mixedFilter.isProfane('classic')).toBe(false);
    });
  });

  describe('mixed-language filters', () => {
    test('detects both English and Chinese in one filter', () => {
      expect(mixedFilter.isProfane('hello fuck')).toBe(true);
      expect(mixedFilter.isProfane('你他妈的')).toBe(true);
    });
  });

  describe('replacement with CJK words', () => {
    test('replaces Chinese profanity without requiring \\b', () => {
      const filter = new Filter({
        languages: ['chinese'],
        replaceWith: '***',
      });
      const result = filter.checkProfanity('你他妈的');
      expect(result.processedText).toContain('***');
      expect(result.processedText).not.toContain('他妈的');
    });
  });
});
