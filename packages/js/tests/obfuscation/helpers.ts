import { Filter } from '../../src/filters/Filter';
import type { FilterConfig } from '../../src/types/types';

/** Same settings the shootout harness uses for glin-profanity. */
export function makeFilter(overrides: FilterConfig = {}): Filter {
  return new Filter({
    languages: ['english'],
    detectLeetspeak: true,
    leetspeakLevel: 'aggressive',
    normalizeUnicode: true,
    ...overrides,
  });
}

/** Deterministic pseudo-random generator so fuzz tests are reproducible. */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
