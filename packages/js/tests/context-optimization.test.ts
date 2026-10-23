import { Filter } from '../src/filters/Filter';

describe('Context Optimization', () => {
  let filter: Filter;

  beforeEach(() => {
    filter = new Filter({
      enableContextAware: true,
      languages: ['english'],
    });
  });

  it('isProfane applies context filtering', () => {
    expect(filter.isProfane('This movie is the bomb')).toBe(false);
    expect(filter.isProfane('The bomb exploded and shit happened')).toBe(true);
    expect(filter.isProfane('You are a fucking idiot')).toBe(true);
  });

  it('should NOT whitelist profanity based on unrelated positive phrases', () => {
    // "the bomb" is a positive phrase for "bomb".
    // "shit" is a profanity.
    // If "the bomb" is present, it shouldn't whitelist "shit".
    const text = 'The bomb exploded and shit happened';

    const result = filter.checkProfanity(text);

    // Should be flagged because "shit" is profanity and "the bomb" is irrelevant to "shit"
    expect(result.containsProfanity).toBe(true);
    expect(result.profaneWords).toContain('shit');
  });

  it('should still whitelist relevant positive phrases', () => {
    const text = 'This movie is the bomb';
    const result = filter.checkProfanity(text);

    // Should NOT be flagged because "the bomb" is a whitelisted phrase for "bomb"
    expect(result.containsProfanity).toBe(false);
  });
});
