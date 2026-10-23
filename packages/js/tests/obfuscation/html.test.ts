import { htmlTransformer } from '../../src/filters/pipeline/html';
import { fromText, toOriginalSpan } from '../../src/filters/pipeline/mapped';
import { makeFilter } from './helpers';

const strip = htmlTransformer({ decodeDepth: 2 });
const text = (input: string) => strip(fromText(input)).text;

describe('html transformer', () => {
  it('removes inline tags and joins the text around them', () => {
    expect(text('s<b>h</b>it')).toBe('shit');
    expect(text('<span>fu</span><span>ck</span>')).toBe('fuck');
    expect(text('fu<br>ck')).toBe('fuck');
    expect(text('bi<!-- x -->tch')).toBe('bitch');
  });

  it('separates block-level tags so neighbouring paragraphs never merge', () => {
    expect(text('<p>as</p><p>s</p>')).not.toContain('ass');
  });

  it('decodes decimal, hex, named and double-encoded entities', () => {
    expect(text('f&#117;ck')).toBe('fuck');
    expect(text('&#x73;&#x68;&#x69;&#x74;')).toBe('shit');
    expect(text('f&amp;#117;ck')).toBe('fuck');
    expect(text('a &amp; b')).toBe('a & b');
  });

  it('drops soft hyphen entities', () => {
    expect(text('fu&shy;ck')).toBe('fuck');
    expect(text('fu&#173;ck')).toBe('fuck');
  });

  it('leaves plain comparisons and unknown entities alone', () => {
    expect(text('1 < 2 and 3 > 2')).toBe('1 < 2 and 3 > 2');
    expect(text('x <3 y')).toBe('x <3 y');
    expect(text('AT&T; &bogus; &#0;')).toBe('AT&T; &bogus; &#0;');
  });

  it('returns the same object when there is nothing to do', () => {
    const input = fromText('plain text');
    expect(strip(input)).toBe(input);
  });

  it('maps a match back across the removed markup', () => {
    const mapped = strip(fromText('<i>f</i><i>u</i><i>c</i><i>k</i>'));
    expect(mapped.text).toBe('fuck');
    expect(toOriginalSpan(mapped, 0, 4)).toEqual([3, 28]);
  });
});

describe('html in the filter', () => {
  const filter = makeFilter();

  it.each([
    'f<b>u</b>ck',
    'fu<br>ck',
    'bas<!-- x -->tard',
    '&#102;&#117;&#99;&#107;',
    '&#x62;&#x69;&#x74;&#x63;&#x68;',
    'b&amp;#105;tch',
    'bas&shy;tard',
    '<span>sh</span><span>it</span>',
  ])('flags %s', (input) => {
    expect(filter.isProfane(input)).toBe(true);
    expect(filter.checkProfanity(input).containsProfanity).toBe(true);
  });

  it.each([
    '<p>Hello <b>world</b></p>',
    'Tom &amp; Jerry',
    '<a href="https://example.com/class">class notes</a>',
    '<div>as</div><div>s</div>',
    '&lt;script&gt; is escaped',
  ])('keeps %s clean', (input) => {
    expect(filter.isProfane(input)).toBe(false);
  });

  it('reports the original span, tags included, in context-aware matches', () => {
    const input = 'say <i>f</i><i>u</i><i>c</i><i>k</i> now';
    const result = makeFilter({ enableContextAware: true, confidenceThreshold: 1 }).checkProfanity(input);
    expect(result.matches?.[0].index).toBe(input.indexOf('f</i>'));
  });

  it('masks the matched span with replaceWith', () => {
    const result = makeFilter({ replaceWith: '***' }).checkProfanity('a <b>s</b>hit here');
    // The span starts at the first matched letter, so the opening tag stays.
    expect(result.processedText).toBe('a <b>*** here');
  });

  it('can be switched off', () => {
    const filter = makeFilter({ obfuscation: { html: false } });
    expect(filter.isProfane('f<b>u</b>ck')).toBe(false);
  });
});
