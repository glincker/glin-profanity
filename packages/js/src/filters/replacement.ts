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
