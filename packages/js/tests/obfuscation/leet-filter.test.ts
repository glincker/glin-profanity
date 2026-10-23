import { makeFilter } from './helpers';

describe('exotic leetspeak in the filter', () => {
  const filter = makeFilter();

  it.each(['f|_|ck', 'f|_|(|<', '@$$ho|e', '@5$ho|e', 'b/\\stard', 'a$$ho!e', 'a$$ho1e'])(
    'flags %s',
    (input) => {
      expect(filter.isProfane(input)).toBe(true);
    },
  );

  it.each(['hello world', 'Call 555-1234 or visit 1st street!', 'I|you|we', 'a/b testing', 'H|k'])(
    'keeps %s clean',
    (input) => {
      expect(filter.isProfane(input)).toBe(false);
    },
  );

  it('needs ambiguousLeet for | and 1 read as l', () => {
    const off = makeFilter({ obfuscation: { ambiguousLeet: false } });
    expect(off.isProfane('@$$ho|e')).toBe(false);
    expect(off.isProfane('f|_|ck')).toBe(true);
  });
});
