/**
 * Text plus an index map back to the original input.
 * Every transformer in the pipeline takes and returns a MappedText so a
 * match found in the final text can be reported against the user's string.
 */
export interface MappedText {
  readonly text: string;
  /** Original offset where each output code unit begins, or null for identity. */
  readonly starts: Int32Array | null;
  /** Original offset where each output code unit ends (exclusive), or null for identity. */
  readonly ends: Int32Array | null;
}

/** A transformer returns its input untouched when it has nothing to do. */
export type Transformer = (input: MappedText) => MappedText;

export interface Edit {
  start: number;
  end: number;
  replacement: string;
}

export function fromText(text: string): MappedText {
  return { text, starts: null, ends: null };
}

export function spanStart(m: MappedText, index: number): number {
  return m.starts ? m.starts[index] : index;
}

export function spanEnd(m: MappedText, index: number): number {
  return m.ends ? m.ends[index] : index + 1;
}

/** Converts a [start, end) range of the transformed text into original offsets. */
export function toOriginalSpan(m: MappedText, start: number, end: number): [number, number] {
  if (end <= start) {
    const at = start < m.text.length ? spanStart(m, start) : spanEnd(m, Math.max(0, m.text.length - 1));
    return [at, at];
  }
  return [spanStart(m, start), spanEnd(m, end - 1)];
}

/** Returns source indices when `repl` can be read off `source` by deleting characters. */
function subsequenceIndices(source: string, repl: string): number[] | null {
  const picked: number[] = [];
  let at = 0;
  for (let i = 0; i < repl.length; i++) {
    const found = source.indexOf(repl[i], at);
    if (found < 0) return null;
    picked.push(found);
    at = found + 1;
  }
  return picked;
}

/**
 * Applies non-overlapping edits sorted by start offset.
 * Characters kept 1:1 or by deletion keep their own span; a rewrite of different
 * shape gives every output character the span of the whole replaced range.
 */
export function applyEdits(m: MappedText, edits: Edit[]): MappedText {
  if (edits.length === 0) return m;
  let out = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let cursor = 0;

  const copy = (from: number, to: number) => {
    out += m.text.slice(from, to);
    for (let i = from; i < to; i++) {
      starts.push(spanStart(m, i));
      ends.push(spanEnd(m, i));
    }
  };

  for (const edit of edits) {
    copy(cursor, edit.start);
    const source = m.text.slice(edit.start, edit.end);
    const repl = edit.replacement;
    if (repl.length > 0) {
      const picked =
        repl.length === source.length
          ? Array.from({ length: repl.length }, (_, i) => i)
          : repl.length < source.length
            ? subsequenceIndices(source, repl)
            : null;
      if (picked) {
        for (const p of picked) {
          starts.push(spanStart(m, edit.start + p));
          ends.push(spanEnd(m, edit.start + p));
        }
      } else {
        const s = spanStart(m, edit.start);
        const e = spanEnd(m, edit.end - 1);
        for (let i = 0; i < repl.length; i++) {
          starts.push(s);
          ends.push(e);
        }
      }
      out += repl;
    }
    cursor = edit.end;
  }
  copy(cursor, m.text.length);
  return { text: out, starts: Int32Array.from(starts), ends: Int32Array.from(ends) };
}

/** Rewrites regex matches; return null from `fn` to keep a match unchanged. */
export function replaceRegex(
  m: MappedText,
  pattern: RegExp,
  fn: (match: RegExpExecArray) => string | null,
): MappedText {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const edits: Edit[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(m.text)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const replacement = fn(match);
    if (replacement !== null && replacement !== match[0]) {
      edits.push({ start: match.index, end: match.index + match[0].length, replacement });
    }
  }
  return applyEdits(m, edits);
}

/** Maps every code unit through `fn`; undefined keeps the character. */
export function mapChars(m: MappedText, fn: (ch: string) => string | undefined): MappedText {
  const edits: Edit[] = [];
  const text = m.text;
  for (let i = 0; i < text.length; i++) {
    const next = fn(text[i]);
    if (next !== undefined && next !== text[i]) {
      edits.push({ start: i, end: i + 1, replacement: next });
    }
  }
  return applyEdits(m, edits);
}

/** Runs transformers left to right. */
export function runPipeline(input: MappedText, steps: Transformer[]): MappedText {
  let current = input;
  for (const step of steps) current = step(current);
  return current;
}
