import dictionary from '../../src/data/dictionary';
import { DictionaryIndex } from '../../src/filters/pipeline/dictionaryIndex';
import { separatorTransformer } from '../../src/filters/pipeline/separators';
import { fromText, toOriginalSpan } from '../../src/filters/pipeline/mapped';
import { makeFilter } from './helpers';

const index = new DictionaryIndex(dictionary.english, { leetspeak: true, leetspeakLevel: 'aggressive' });
const join = separatorTransformer(index, {
  chars: '.,/|_-',
  allowSpace: false,
  minTwoPieceLength: 4,
});
const text = (input: string) => join(fromText(input)).text;

describe('separator transformer', () => {
  it.each(['f.u.c.k', 'f,u,c,k', 'f/u/c/k', 'f|u|c|k', 'f_u_c_k', 'f-u-c-k'])('joins %s', (input) => {
    expect(text(input)).toBe('fuck');
  });

  it('joins single-dot splits and rotating separators', () => {
    expect(text('f.uck')).toBe('fuck');
    expect(text('a.sshole')).toBe('asshole');
    expect(text('f.u_c-k')).toBe('fuck');
  });

  it('joins spaces only inside a chain of other separators', () => {
    expect(text('b.i_t-c h')).toBe('bitch');
    expect(text('s h i t')).toBe('shit');
    expect(text('fu ck')).toBe('fu ck');
  });

  it('joins leet fragments', () => {
    expect(text('5.h.i.t')).toBe('5hit');
  });

  it('keeps sentence boundaries and abbreviations as they were', () => {
    expect(text('the end.fuck')).toBe('the end.fuck');
    expect(text('e.g. a list, i.e. this')).toBe('e.g. a list, i.e. this');
    expect(text('B.S. degree, U.S.A. and p.m.')).toBe('B.S. degree, U.S.A. and p.m.');
    expect(text('well-known snake_case_name')).toBe('well-known snake_case_name');
    expect(text('3.14, 1,000 and v1.2.3')).toBe('3.14, 1,000 and v1.2.3');
  });

  it('keeps a boundary before an underscore neighbour', () => {
    expect(text('x_f_u_c_k')).toBe('x fuck');
  });

  it('maps the joined word back over the separators', () => {
    const mapped = join(fromText('say f.u.c.k now'));
    expect(toOriginalSpan(mapped, 4, 8)).toEqual([4, 11]);
  });
});

describe('separators in the filter', () => {
  const filter = makeFilter();

  it.each([
    'what the f.u.c.k was that',
    'b,i,t,c,h',
    'a|s|s|h|o|l|e',
    'b_a_s_t_a_r_d',
    's-h-i-t',
    'b.itch',
    'f.u_c-k',
    '5.h.i.t',
    'You are such a s h i t and everyone knows it',
  ])('flags %s', (input) => {
    expect(filter.isProfane(input)).toBe(true);
  });

  it.each([
    'The end.Fuel is cheap',
    'Meet me at 5.30 p.m. on Main St.',
    'e.g. apples, i.e. fruit',
    'a.k.a. the boss',
    'Visit www.example.com/class-notes_v2',
    'step-by-step, one-to-one, pass-through',
    'Ph.D. in c.s. from M.I.T.',
  ])('keeps %s clean', (input) => {
    expect(filter.isProfane(input)).toBe(false);
  });

  it('works for other languages', () => {
    const spanish = makeFilter({ languages: ['spanish'] });
    expect(spanish.isProfane('m.i.e.r.d.a')).toBe(true);
    const german = makeFilter({ languages: ['german'] });
    expect(german.isProfane('a.r.s.c.h')).toBe(true);
  });

  it('can be switched off', () => {
    expect(makeFilter({ obfuscation: { separators: false } }).isProfane('f.u.c.k')).toBe(false);
    expect(makeFilter({ obfuscation: 'off' }).isProfane('f.u.c.k')).toBe(false);
  });
});

describe('separator chains join only at a word end', () => {
  const filter = makeFilter({ replaceWith: '*', obfuscation: { builtinWhitelist: false } });

  it.each([
    'a s s i g n m e n t',
    'c.o.c.k.p.i.t',
    'h.e.l.l.o.w.o.r.l.d',
    'c-l-a-s-s-r-o-o-m',
    'a s s e m b l y',
  ])('does not flag %s', (input) => {
    expect(filter.isProfane(input)).toBe(false);
    expect(filter.checkProfanity(input).processedText).toBe(input);
  });

  it.each([
    ['f.u.c.k', '*'],
    ['s h i t', '*'],
    ['f.u.c.k.s.h.i.t', '*'],
    ['you a s s', 'you *'],
    ['f u c k e d', '*'],
    ['f.u.c.k.you', '*you'],
  ])('still flags %s', (input) => {
    expect(filter.isProfane(input)).toBe(true);
  });
});
