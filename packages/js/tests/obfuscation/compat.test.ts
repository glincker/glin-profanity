import { Filter } from '../../src/filters/Filter';
import { makeFilter } from './helpers';

const CLEAN = [
  'The quick brown fox jumps over the lazy dog.',
  'Meeting at 3.30 p.m., bring the Q3 report (v2.1) and the e.g. slides.',
  'Our class assistant will assess the glass, grass and brass samples.',
  'Use the --force flag, then run: npm run build && npm test | tee out.log',
  'Order #1234 shipped; total $45.00 (50% off!) to Sunset Blvd.',
  'She said "wow!!!" and he replied, "sooooo cool", then left for Scunthorpe.',
  'Hello, World! snake_case_names and kebab-case-names are both fine.',
  '<p>Welcome to <b>our</b> site &amp; blog &copy; 2026</p>',
];

describe('backward compatibility', () => {
  it.each(CLEAN)('leaves ordinary text alone: %s', (input) => {
    expect(makeFilter().isProfane(input)).toBe(false);
    expect(makeFilter().checkProfanity(input).containsProfanity).toBe(false);
  });

  it('obfuscation "off" behaves exactly like the plain scan', () => {
    const off = makeFilter({ obfuscation: 'off' });
    for (const input of ['f.u.c.k', 'f*ck you', 'aaaasshole', 'f<b>u</b>ck', 'cl@ss']) {
      expect(off.isProfane(input)).toBe(input === 'cl@ss' || input === 'f*ck you');
    }
  });

  it('keeps fuzzy matching on the legacy path', () => {
    const fuzzy = new Filter({ wordBoundaries: false, allowObfuscatedMatch: true });
    expect(fuzzy.isProfane('f u c k')).toBe(true);
    expect(fuzzy.isProfane('hello')).toBe(false);
  });

  it('still reports the matched text for plain hits', () => {
    const result = makeFilter({ severityLevels: true }).checkProfanity('You are a Fuck');
    expect(result.profaneWords).toEqual(['fuck']);
    expect(result.severityMap).toEqual({ fuck: 1 });
  });

  it('masks obfuscated words with replaceWith', () => {
    const result = makeFilter({ replaceWith: '***' }).checkProfanity('well f.u.c.k that and sh*t');
    expect(result.processedText).toBe('well *** that and ***');
  });

  it('round-trips the new options through getConfig', () => {
    const config = makeFilter({ obfuscation: 'basic', whitelist: ['x y'] }).getConfig();
    expect(config.obfuscation).toBe('basic');
    expect(config.whitelist).toEqual(['x y']);
  });

  it('clean text is not slower than the plain scan by an order of magnitude', () => {
    const fast = makeFilter();
    const plain = makeFilter({ obfuscation: 'off' });
    const text = CLEAN.join(' ');
    const time = (f: Filter) => {
      const start = process.hrtime.bigint();
      for (let i = 0; i < 300; i++) f.isProfane(text);
      return Number(process.hrtime.bigint() - start);
    };
    time(fast);
    time(plain);
    expect(time(fast)).toBeLessThan(time(plain) * 2);
  });
});

describe('hostile input stays fast', () => {
  const filter = makeFilter();
  const timeMs = (input: string) => {
    const start = Date.now();
    filter.isProfane(input);
    filter.checkProfanity(input);
    return Date.now() - start;
  };

  it.each([
    ['unclosed comments', '<!--'.repeat(25000)],
    ['long dotted chain', 'a.b.'.repeat(25000)],
    ['trailing masks', 'ab** '.repeat(20000)],
    ['stretched run', 'a'.repeat(100000)],
    ['entity soup', '&amp;'.repeat(20000)],
  ])('%s', (_name, input) => {
    expect(timeMs(input)).toBeLessThan(3000);
  });
});

describe('quadratic hostile input is bounded', () => {
  const filter = makeFilter();

  it.each([
    ['single letters and dots', 'x.'.repeat(40000)],
    ['spelled-out letters', 'x '.repeat(40000)],
    ['mask run then a letter', 'a' + '*'.repeat(80000) + 'b'],
    ['underscore run then a letter', 'a' + '_'.repeat(80000) + 'b'],
    ['long chain after a word', 'f.u.c.k' + '.x'.repeat(40000)],
  ])('%s', (_name, input) => {
    const start = Date.now();
    filter.isProfane(input);
    filter.checkProfanity(input);
    expect(Date.now() - start).toBeLessThan(1500);
  });
});
