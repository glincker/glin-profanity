import { escapeCharClass } from '../replacement';
import { DictionaryIndex } from './dictionaryIndex';
import { Edit, Transformer, applyEdits } from './mapped';

export interface SeparatorOptions {
  /** Characters that may sit between the letters of one word. */
  chars: string;
  /**
   * Let a space join fragments after only one other separator (strict).
   * Otherwise two other separators are required (b.i_t-c h).
   */
  allowSpace: boolean;
  /** Two-fragment joins (f.uck) must reach this length to count, so "b.s." stays clean. */
  minTwoPieceLength: number;
}

interface Piece {
  text: string;
  start: number;
  end: number;
  /** Separator that follows this piece in the source, if any. */
  sep: string;
}

/**
 * Joins letters split by separators (f.u.c.k, f|u|c|k, f.u_c-k, f.uck) when the
 * joined fragment is a dictionary word. Only whole fragments are joined, so
 * "end.fuck" and "e.g." never produce a match the plain text did not.
 */
export function separatorTransformer(
  index: DictionaryIndex,
  options: SeparatorOptions,
): Transformer {
  const sepClass = escapeCharClass(options.chars);
  const chain = new RegExp(
    `[\\p{L}\\p{N}]+(?:[${sepClass} ][\\p{L}\\p{N}]+)+`,
    'gu',
  );
  const quick = new RegExp(
    `[\\p{L}\\p{N}][${sepClass}][\\p{L}\\p{N}]|\\b\\p{L} \\p{L} \\p{L}\\b`,
    'u',
  );
  const sepSet = new Set(Array.from(options.chars));

  return (input) => {
    if (!quick.test(input.text)) return input;
    const edits: Edit[] = [];
    // One set for the whole call: rebuilding it per join is quadratic on long chains.
    const taken = new Set<number>();
    chain.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = chain.exec(input.text)) !== null) {
      const pieces = splitPieces(match[0], match.index, sepSet);
      if (pieces.length < 2) continue;
      collectJoins(pieces, input.text, index, options, edits, taken);
    }
    edits.sort((a, b) => a.start - b.start);
    return applyEdits(input, edits);
  };
}

function splitPieces(chainText: string, offset: number, seps: Set<string>): Piece[] {
  const pieces: Piece[] = [];
  let start = 0;
  for (let i = 0; i <= chainText.length; i++) {
    const atEnd = i === chainText.length;
    const isSep = !atEnd && (seps.has(chainText[i]) || chainText[i] === ' ');
    if (atEnd || isSep) {
      pieces.push({
        text: chainText.slice(start, i),
        start: offset + start,
        end: offset + i,
        sep: atEnd ? '' : chainText[i],
      });
      start = i + 1;
    }
  }
  return pieces;
}

function collectJoins(
  pieces: Piece[],
  source: string,
  index: DictionaryIndex,
  options: SeparatorOptions,
  edits: Edit[],
  taken: Set<number>,
): void {
  let i = 0;
  while (i < pieces.length) {
    let joinedTo = -1;
    let candidate = '';
    for (let j = i; j < pieces.length; j++) {
      candidate += pieces[j].text;
      if (candidate.length > index.maxWordLength) break;
      if (j > i && acceptsJoin(pieces, i, j, candidate, index, options)) joinedTo = j;
    }
    if (joinedTo < 0) {
      i++;
      continue;
    }
    addEdits(pieces, i, joinedTo, source, edits, taken);
    i = joinedTo + 1;
  }
}

function acceptsJoin(
  pieces: Piece[],
  from: number,
  to: number,
  candidate: string,
  index: DictionaryIndex,
  options: SeparatorOptions,
): boolean {
  const span = pieces.slice(from, to + 1);
  if (!span.some((p) => p.text.length === 1)) return false;
  if (span.length === 2 && candidate.length < options.minTwoPieceLength) return false;
  const inner = span.slice(0, -1).map((p) => p.sep);
  const spaces = inner.filter((s) => s === ' ').length;
  if (spaces > 0) {
    const others = inner.length - spaces;
    // Plain "s h i t": at least three single letters, nothing else.
    const spelledOut = others === 0 && span.length >= 3 && span.every((p) => p.text.length === 1);
    if (!spelledOut && others < (options.allowSpace ? 1 : 2)) return false;
  }
  return index.isWord(candidate) && endsAtWordEnd(pieces, to, index);
}

/** Inflections that may follow a spelled-out word ("f u c k e d"). */
const SUFFIXES = new Set(['s', 'es', 'ed', 'er', 'ers', 'ing', 'y']);

/**
 * "a s s i g n m e n t" must not join at the dictionary prefix "ass": when single
 * letters keep going with the same separator, the rest has to be a word or an
 * inflection of its own.
 */
function endsAtWordEnd(pieces: Piece[], to: number, index: DictionaryIndex): boolean {
  const sep = pieces[to - 1].sep;
  let rest = '';
  let k = to + 1;
  while (
    k < pieces.length &&
    pieces[k].text.length === 1 &&
    pieces[k - 1].sep === sep &&
    rest.length <= index.maxWordLength
  ) {
    rest += pieces[k].text;
    k++;
  }
  if (rest === '') return true;
  // A run longer than any word cannot be one; the scan above stops there to stay linear.
  return SUFFIXES.has(rest.toLowerCase()) || index.isWord(rest);
}

function addEdits(
  pieces: Piece[],
  from: number,
  to: number,
  source: string,
  edits: Edit[],
  taken: Set<number>,
): void {
  const push = (edit: Edit) => {
    if (!taken.has(edit.start)) {
      taken.add(edit.start);
      edits.push(edit);
    }
  };
  for (let k = from; k < to; k++) {
    push({ start: pieces[k].end, end: pieces[k + 1].start, replacement: '' });
  }
  // "_" is a word character, so a neighbouring one would hide the boundary.
  const prev = pieces[from].start - 1;
  if (from > 0 && source[prev] === '_') push({ start: prev, end: prev + 1, replacement: ' ' });
  const next = pieces[to].end;
  if (to + 1 < pieces.length && source[next] === '_') {
    push({ start: next, end: next + 1, replacement: ' ' });
  }
}
