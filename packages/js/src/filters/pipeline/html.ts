import { MappedText, Transformer, replaceRegex } from './mapped';

export interface HtmlOptions {
  /** Entity decoding passes, so `&amp;#117;` (double encoded) resolves. */
  decodeDepth: number;
}

// Real tags and comments only, so "a < b" and "x <3" are left alone.
// Comments are length-capped so thousands of unclosed "<!--" cannot make the scan quadratic.
const TAG_PATTERN = /<!--[\s\S]{0,2000}?-->|<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g;
const ENTITY_PATTERN = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));/g;
const BLOCK_TAG = /^<\/?(?:p|div|li|ul|ol|tr|td|th|table|h[1-6]|section|article|blockquote|pre|hr)\b/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  shy: '', zwnj: '', zwj: '', lrm: '', rlm: '',
  hellip: '...', ndash: '-', mdash: '-',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', acirc: 'â',
  iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç',
};

const SOFT_HYPHEN = '­';

function decodeCodePoint(code: number): string | null {
  if (!Number.isInteger(code) || code < 1 || code > 0x10ffff) return null;
  if (code >= 0xd800 && code <= 0xdfff) return null;
  const ch = String.fromCodePoint(code);
  return ch === SOFT_HYPHEN ? '' : ch;
}

function decodeEntity(match: RegExpExecArray): string | null {
  if (match[1] !== undefined) return decodeCodePoint(parseInt(match[1], 10));
  if (match[2] !== undefined) return decodeCodePoint(parseInt(match[2], 16));
  const named = NAMED_ENTITIES[match[3]];
  return named === undefined ? null : named;
}

/**
 * Removes tags and comments, then decodes named, numeric and double-encoded
 * entities. Inline tags join the text around them (`s<b>h</b>it`), block tags
 * separate it, so `<p>as</p><p>s</p>` never forms a word.
 */
export function htmlTransformer(options: HtmlOptions): Transformer {
  return (input: MappedText) => {
    const text = input.text;
    if (text.indexOf('<') < 0 && text.indexOf('&') < 0) return input;

    let m = replaceRegex(input, TAG_PATTERN, (match) => (BLOCK_TAG.test(match[0]) ? ' ' : ''));
    for (let pass = 0; pass < options.decodeDepth; pass++) {
      if (m.text.indexOf('&') < 0) break;
      const next = replaceRegex(m, ENTITY_PATTERN, decodeEntity);
      if (next === m) break;
      m = next;
    }
    return m;
  };
}
