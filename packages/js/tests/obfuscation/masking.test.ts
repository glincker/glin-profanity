import dictionary from '../../src/data/dictionary';
import { DictionaryIndex } from '../../src/filters/pipeline/dictionaryIndex';
import { maskingTransformer } from '../../src/filters/pipeline/masking';
import { fromText } from '../../src/filters/pipeline/mapped';
import { makeFilter } from './helpers';

const index = new DictionaryIndex(dictionary.english, { leetspeak: true, leetspeakLevel: 'aggressive' });
const mask = maskingTransformer(index, { chars: '*#@$%_?!', minVisible: 1 });
const text = (input: string) => mask(fromText(input)).text;

describe('masking transformer', () => {
  it.each([
    ['f*ck', 'fuck'],
    ['f#ck', 'fuck'],
    ['f%ck', 'fuck'],
    ['f?ck', 'fuck'],
    ['f_ck', 'fuck'],
    ['f**k', 'fuck'],
    ['s**t', 'shit'],
    ['sh@t', 'shit'],
    ['b*****d', 'bastard'],
    ['b*st*rd', 'bastard'],
    ['@sshole', 'asshole'],
    ['*SSHOLE', 'asshole'],
  ])('resolves %s', (input, expected) => {
    expect(text(input)).toBe(expected);
  });

  it('resolves a lone first letter on longer words', () => {
    expect(text('holy f*** that')).toBe('holy fuck that');
  });

  it('leaves tokens without an unambiguous dictionary match alone', () => {
    for (const input of ['****', 'p@ssword', 'cl@ss', 'gr@ss', '$100', '5*3', 'a*b', 'email me@home', 'C++', 'wow!', 'really?!']) {
      expect(text(input)).toBe(input);
    }
  });

  it('does not read markdown emphasis as masks', () => {
    expect(text('**Hook**')).toBe('**Hook**');
    expect(text('see **React Hook** now')).toBe('see **React Hook** now');
    expect(text('sh**')).toBe('shit');
  });

  it('keeps sentence punctuation at token edges out of the pattern', () => {
    expect(text('what the f*ck?')).toBe('what the fuck?');
    expect(text('f*ck!')).toBe('fuck!');
  });
});

describe('masking in the filter', () => {
  const filter = makeFilter();

  it.each(['f*ck you', 'SH*T', 'you b*tch', 'what a b*stard', 'f#ck', 'sh%t', '@sshole', 'you are an a**hole'])(
    'flags %s',
    (input) => {
      expect(filter.isProfane(input)).toBe(true);
    },
  );

  it.each([
    'p@ssword reset',
    'cl@ss starts at 5',
    'use ** for bold and # for headings',
    'Rate: 50% off $5 items!!',
    'ask me@example.com',
    '5 * 3 = 15 and a*b',
    'The wildcard *.txt matches files',
    '| **React Hook** | yes | no |',
    'a **bold Hook** claim and __init__ plus __dunder__',
  ])('keeps %s clean', (input) => {
    expect(filter.isProfane(input)).toBe(false);
  });

  it('honours custom mask characters', () => {
    const filter = makeFilter({ obfuscation: { masking: { chars: '~' } } });
    expect(filter.isProfane('sh~t')).toBe(true);
    expect(filter.isProfane('sh*t')).toBe(false);
  });

  it('can be switched off', () => {
    expect(makeFilter({ obfuscation: { masking: false } }).isProfane('sh*t')).toBe(false);
  });
});
