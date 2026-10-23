import { makeFilter } from './helpers';

describe('whitelist on the legacy fuzzy path (wordBoundaries off)', () => {
  const configs = [
    { allowObfuscatedMatch: true },
    { wordBoundaries: false },
  ];

  it.each(configs)('honors user whitelist with %j', (config) => {
    const filter = makeFilter({ ...config, whitelist: ['shit happens'], replaceWith: '*' });
    expect(filter.isProfane('well, shit happens')).toBe(false);
    expect(filter.checkProfanity('well, shit happens').containsProfanity).toBe(false);
    expect(filter.isProfane('this is shit')).toBe(true);
    expect(filter.checkProfanity('shit happens, you shit').processedText).toBe('shit happens, you *');
    const words = filter.checkProfanity('fuck shit happens').profaneWords;
    expect(words).toContain('fuck');
    expect(words).not.toContain('shit');
  });

  it('applies to the context-aware path too', () => {
    const filter = makeFilter({ allowObfuscatedMatch: true, whitelist: ['shit happens'], enableContextAware: true });
    expect(filter.checkProfanity('well, shit happens').containsProfanity).toBe(false);
    expect(filter.checkProfanity('this is shit').containsProfanity).toBe(true);
  });

  it('honors ignoreWords', () => {
    const plain = makeFilter({ allowObfuscatedMatch: true, languages: [], customWords: ['zorp'] });
    const filter = makeFilter({ allowObfuscatedMatch: true, languages: [], customWords: ['zorp'], ignoreWords: ['zorp'] });
    expect(plain.isProfane('a zorp here')).toBe(true);
    expect(filter.isProfane('a zorp here')).toBe(false);
  });
});
