import { normalizeLeetspeak } from '../../src/utils/leetspeak';

const aggressive = { level: 'aggressive' as const, maxRepeated: 2 };

describe('exotic leetspeak glyphs', () => {
  it('reads |_| as u before |_ is read as l', () => {
    expect(normalizeLeetspeak('f|_|ck', aggressive)).toBe('fuck');
  });

  it('reads |< as k and ( as c', () => {
    expect(normalizeLeetspeak('f|_|(|<', aggressive)).toBe('fuck');
  });

  it('reads /\\ as a and /\\/\\ as m', () => {
    expect(normalizeLeetspeak('b/\\stard', aggressive)).toBe('bastard');
    expect(normalizeLeetspeak('/\\/\\ad', aggressive)).toBe('mad');
  });

  it('reads >< as x', () => {
    expect(normalizeLeetspeak('se><', aggressive)).toBe('sex');
  });

  it('reads | and 1 as l on request', () => {
    expect(normalizeLeetspeak('ho|e', aggressive)).toBe('hoie');
    expect(normalizeLeetspeak('ho|e', { ...aggressive, ambiguousAsL: true })).toBe('hole');
    expect(normalizeLeetspeak('ho1e', { ...aggressive, ambiguousAsL: true })).toBe('hole');
  });
});
