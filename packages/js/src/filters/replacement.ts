/** Escapes a string for literal use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replaces every occurrence of the given words in the text.
 * Whole-word replacement when wordBoundaries is set.
 */
export function replaceWords(
  text: string,
  words: string[],
  replaceWith: string,
  wordBoundaries: boolean,
): string {
  let processed = text;
  for (const word of new Set(words)) {
    const escaped = escapeRegExp(word);
    const pattern = wordBoundaries
      ? new RegExp(`\\b${escaped}\\b`, 'gi')
      : new RegExp(escaped, 'gi');
    processed = processed.replace(pattern, replaceWith);
  }
  return processed;
}

/** Replaces [start, end) spans of the text; overlapping spans are merged. */
export function replaceSpans(text: string, spans: Array<[number, number]>, replaceWith: string): string {
  if (spans.length === 0) return text;
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([span[0], span[1]]);
  }
  let out = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    out += text.slice(cursor, start) + replaceWith;
    cursor = end;
  }
  return out + text.slice(cursor);
}
