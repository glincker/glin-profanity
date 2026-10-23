import { BUILTIN_WHITELIST, WhitelistEntry } from './builtinWhitelist';
import { escapeRegExp } from './replacement';
import { MappedText, fromText, toOriginalSpan } from './pipeline/mapped';
import { EdgeKind, headSource, tailSource, wordEdges } from './wordEdges';

export type Interval = [number, number];

interface CompiledEntry {
  regex: RegExp;
}

const ASCII_WORD = /^[A-Za-z0-9_]$/;

/** Symbol edges ("c++") have no ASCII word boundary, so they use the native rule. */
function edgeFor(kind: EdgeKind, char: string): EdgeKind {
  return kind === 'ascii' && !ASCII_WORD.test(char) ? 'native' : kind;
}

/**
 * Finds safe spans in a view so dictionary hits fully inside a protected word can
 * be dropped. Each entry is its own regex with three groups: context before, the
 * protected word, context after.
 */
export class Whitelist {
  private readonly compiled: CompiledEntry[];

  constructor(userEntries: string[], useBuiltin: boolean) {
    const compiled: CompiledEntry[] = [];
    if (useBuiltin) {
      for (const entry of BUILTIN_WHITELIST) compiled.push(compileBuiltin(entry));
    }
    for (const raw of userEntries) {
      const entry = raw.trim();
      if (entry.length > 0) compiled.push(compileUser(entry));
    }
    this.compiled = compiled;
  }

  get isEmpty(): boolean {
    return this.compiled.length === 0;
  }

  /** Cheap test on plain strings: could any safe span exist at all? */
  mightMatch(texts: string[]): boolean {
    for (const { regex } of this.compiled) {
      for (const text of texts) {
        regex.lastIndex = 0;
        if (regex.test(text)) return true;
      }
    }
    return false;
  }

  /** Protected spans of the view, in original-text offsets. */
  intervals(view: MappedText): Interval[] {
    const found: Interval[] = [];
    for (const { regex } of this.compiled) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(view.text)) !== null) {
        const start = match.index + match[1].length;
        const end = start + match[2].length;
        if (end === start) {
          regex.lastIndex++;
          continue;
        }
        found.push(toOriginalSpan(view, start, end));
      }
    }
    return found;
  }
}

/** Merged protected spans of a plain string, sorted by start. */
export function protectedSpans(whitelist: Whitelist, text: string): Interval[] {
  const spans = whitelist.intervals(fromText(text)).sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([span[0], span[1]]);
  }
  return merged;
}

/** Same text with protected spans blanked, so offsets stay valid. */
export function blankProtected(text: string, spans: Interval[]): string {
  let out = '';
  let cursor = 0;
  for (const [start, end] of spans) {
    out += text.slice(cursor, start) + ' '.repeat(end - start);
    cursor = end;
  }
  return out + text.slice(cursor);
}

function compileBuiltin(entry: WhitelistEntry): CompiledEntry {
  const body = `(${entry.before ?? ''})(${entry.protect})(${entry.after ?? ''})`;
  return { regex: new RegExp(`\\b${body}\\b`, entry.caseSensitive ? 'g' : 'gi') };
}

function compileUser(entry: string): CompiledEntry {
  const chars = Array.from(entry);
  const edges = wordEdges(entry);
  const head = edgeFor(edges.head, chars[0]);
  const tail = edgeFor(edges.tail, chars[chars.length - 1]);
  const protect = escapeRegExp(entry).replace(/\s+/g, '\\s+');
  const source = `${headSource(head)}()(${protect})()${tailSource(tail)}`;
  const unicode = [head, tail].some((kind) => kind !== 'ascii');
  return { regex: new RegExp(source, unicode ? 'giu' : 'gi') };
}

/** True when the hit lies fully inside the protected span. */
export function within(hit: Interval, span: Interval): boolean {
  return hit[0] >= span[0] && hit[1] <= span[1];
}
