import { SeverityLevel } from '../types/types';
import { ScanHit } from './scanner';

/** Drops repeat hits of the same word and span (original view wins). */
export function uniqueSpans(hits: ScanHit[]): ScanHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.word}|${h.start}|${h.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Folds scanner hits into the legacy words and severity map shape. */
export function summarizeHits(hits: ScanHit[]): { profaneWords: string[]; severityMap: Record<string, SeverityLevel> } {
  const profaneWords: string[] = [];
  const severityMap: Record<string, SeverityLevel> = {};
  for (const hit of hits) {
    // The original view reports the matched text, derived views the dictionary word.
    const key = hit.view === 'orig' ? hit.text : hit.word;
    if (hit.view === 'orig' || !profaneWords.includes(key)) {
      profaneWords.push(key);
      if (severityMap[key] === undefined) severityMap[key] = hit.severity;
    }
  }
  return { profaneWords, severityMap };
}
