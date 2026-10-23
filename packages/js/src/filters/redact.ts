import { replaceSpans, replaceWords } from './replacement';
import { ScanHit } from './scanner';
import { Interval } from './whitelist';

/**
 * Masks by scan hit offsets, so whitelisted spans stay intact. Without hits
 * (legacy scan, fuzzy matching) every occurrence of each word is masked, except
 * inside the safe spans of the legacy whitelist.
 */
export function redactText(
  text: string,
  profaneWords: string[],
  replaceWith: string,
  wordBoundaries: boolean,
  hits: ScanHit[] | undefined,
  safeSpans: Interval[],
): string {
  if (hits) {
    return replaceSpans(text, hits.map((h): Interval => [h.start, h.end]), replaceWith);
  }
  if (profaneWords.length === 0) return text;
  const mask = (part: string) => replaceWords(part, profaneWords, replaceWith, wordBoundaries);
  let out = '';
  let cursor = 0;
  for (const [start, end] of safeSpans) {
    out += mask(text.slice(cursor, start)) + text.slice(start, end);
    cursor = end;
  }
  return out + mask(text.slice(cursor));
}
