import { makeFilter } from './helpers';

describe('context-aware path matches the plain path', () => {
  const INPUTS = [
    'what the f.u.c.k was that',
    'fuuuuuck you',
    'f*ck this',
    '&#102;&#117;&#99;&#107; off',
    'you are a sh1t',
    'Moby Dick is great, you dick',
    'plain old fuck',
    'a clean sentence',
  ];

  it.each(INPUTS)('masks the same spans for %s', (input) => {
    const plain = makeFilter({ replaceWith: '*' }).checkProfanity(input);
    const aware = makeFilter({ replaceWith: '*', enableContextAware: true }).checkProfanity(input);
    expect(aware.containsProfanity).toBe(plain.containsProfanity);
    expect(aware.processedText).toBe(plain.processedText);
  });

  it('masks obfuscated matches in processedText', () => {
    const aware = makeFilter({ replaceWith: '*', enableContextAware: true });
    expect(aware.checkProfanity('what the f.u.c.k was that').processedText).toBe('what the * was that');
  });

  it.each([
    { obfuscation: 'off' as const },
    { obfuscation: 'off' as const, detectLeetspeak: true },
    { obfuscation: 'standard' as const },
  ])('detects a superset of the plain path with %j', (overrides) => {
    const plain = makeFilter(overrides);
    const aware = makeFilter({ ...overrides, enableContextAware: true });
    for (const input of INPUTS) {
      if (plain.checkProfanity(input).containsProfanity) {
        expect({ input, flag: aware.checkProfanity(input).containsProfanity }).toEqual({ input, flag: true });
      }
    }
  });

  it('finds a stretched word with leetspeak on and obfuscation off', () => {
    const aware = makeFilter({ obfuscation: 'off', enableContextAware: true });
    expect(aware.checkProfanity('fuuuuuck').containsProfanity).toBe(
      makeFilter({ obfuscation: 'off' }).checkProfanity('fuuuuuck').containsProfanity,
    );
  });
});

describe('redaction follows scan hits, not word patterns', () => {
  it('leaves a whitelisted name alone and masks the insult', () => {
    const filter = makeFilter({ replaceWith: '*' });
    expect(filter.checkProfanity('Moby Dick is great, you dick').processedText).toBe(
      'Moby Dick is great, you *',
    );
  });

  it('masks every occurrence', () => {
    const filter = makeFilter({ replaceWith: '*' });
    expect(filter.checkProfanity('shit and Shit and SHIT').processedText).toBe('* and * and *');
  });

  it('keeps legacy word masking when wordBoundaries is off', () => {
    const filter = makeFilter({ replaceWith: '*', wordBoundaries: false });
    expect(filter.checkProfanity('some shit here').processedText).toBe('some * here');
  });
});
