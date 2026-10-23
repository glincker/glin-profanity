import dictionary from '../../src/data/dictionary';
import { DictionaryIndex } from '../../src/filters/pipeline/dictionaryIndex';
import { stretchTransformer } from '../../src/filters/pipeline/stretch';
import { fromText } from '../../src/filters/pipeline/mapped';
import { makeFilter } from './helpers';

const index = new DictionaryIndex(dictionary.english, { leetspeak: true, leetspeakLevel: 'aggressive' });
const stretch = stretchTransformer(index);
const text = (input: string) => stretch(fromText(input)).text;

describe('stretch transformer', () => {
  it.each([
    'aaaasshole',
    'assholeeee',
    'aaaaasshole',
    'aaaaaaaaaaaaaaasshole',
    'aasssshhoollee',
    'aaasssssshhhooollleee',
  ])('collapses %s to the dictionary word', (input) => {
    expect(text(input)).toBe('asshole');
  });

  it('keeps legitimate double letters in the target word', () => {
    expect(text('bitttch')).toBe('bitch');
    expect(text('shiiiit')).toBe('shit');
  });

  it('does not touch words that are not a stretched dictionary word', () => {
    for (const input of ['ashole', 'assume', 'asset', 'hello', 'bookkeeper', 'coooool', 'asshole']) {
      expect(text(input)).toBe(input);
    }
  });

  it('never turns a shorter word into a longer one', () => {
    expect(text('as')).toBe('as');
    expect(text('ass')).toBe('ass');
  });
});

describe('stretched letters in the filter', () => {
  const filter = makeFilter();

  it.each([
    'aaaasshole', 'assholeeee', 'aasssshhoollee', 'You are such a aaaaasshole and everyone knows it',
    '@@@sshole', 'fuuuuck', 'shiiiit', 'biiiitch', 'baaaastard',
  ])('flags %s', (input) => {
    expect(filter.isProfane(input)).toBe(true);
  });

  it.each(['coooool', 'sooooo good', 'hellooooo everyone', 'yesssss', 'Mississippi', 'assess the assets'])(
    'keeps %s clean',
    (input) => {
      expect(filter.isProfane(input)).toBe(false);
    },
  );

  it('works for other languages', () => {
    expect(makeFilter({ languages: ['french'] }).isProfane('coooonnard')).toBe(true);
    expect(makeFilter({ languages: ['italian'] }).isProfane('caaaazzo')).toBe(true);
  });

  it('can be switched off', () => {
    expect(makeFilter({ obfuscation: { stretch: false } }).isProfane('aaaasshole')).toBe(false);
  });
});
