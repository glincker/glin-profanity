import { BUILTIN_WHITELIST, WhitelistEntry } from './builtinWhitelist';
import { escapeRegExp } from './replacement';
import { MappedText, toOriginalSpan } from './pipeline/mapped';

export type Interval = [number, number];

/**
 * Finds safe spans in a view so overlapping dictionary hits can be dropped.
 * Case-insensitive and case-sensitive entries are compiled into one regex each.
 */
export class Whitelist {
  private readonly insensitive: RegExp | null;
  private readonly sensitive: RegExp | null;

  constructor(userEntries: string[], useBuiltin: boolean) {
    const entries: WhitelistEntry[] = [
      ...(useBuiltin ? BUILTIN_WHITELIST : []),
      ...userEntries
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => ({ pattern: escapeRegExp(entry).replace(/\s+/g, '\\s+') })),
    ];
    this.insensitive = compile(entries.filter((e) => !e.caseSensitive), 'gi');
    this.sensitive = compile(entries.filter((e) => e.caseSensitive), 'g');
  }

  get isEmpty(): boolean {
    return this.insensitive === null && this.sensitive === null;
  }

  /** Cheap test on plain strings: could any safe span exist at all? */
  mightMatch(texts: string[]): boolean {
    for (const regex of [this.insensitive, this.sensitive]) {
      if (!regex) continue;
      for (const text of texts) {
        regex.lastIndex = 0;
        if (regex.test(text)) return true;
      }
    }
    return false;
  }

  /** Safe spans of the view, in original-text offsets. */
  intervals(view: MappedText): Interval[] {
    const found: Interval[] = [];
    for (const regex of [this.insensitive, this.sensitive]) {
      if (!regex) continue;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(view.text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        found.push(toOriginalSpan(view, match.index, match.index + match[0].length));
      }
    }
    return found;
  }
}

function compile(entries: WhitelistEntry[], flags: string): RegExp | null {
  if (entries.length === 0) return null;
  return new RegExp(`\\b(?:${entries.map((e) => e.pattern).join('|')})\\b`, flags);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
