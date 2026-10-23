import { Filter, FilterConfig } from '../filters/Filter';
import type { Language } from '../types/types';
import type { ProfanityCheckerConfig } from './types';
import globalWhitelistData from '@shared/dictionaries/globalWhitelist.json';

const FILTER_POOL_MAX = 32;
const filterPool = new Map<string, Filter>();

const GLOBAL_WHITELIST = (globalWhitelistData as { whitelist: string[] }).whitelist;
const GLOBAL_WHITELIST_SET = new Set(GLOBAL_WHITELIST);

export function createFilterConfig(config?: ProfanityCheckerConfig): FilterConfig {
  const userIgnore = config?.ignoreWords ?? [];
  const effective: FilterConfig = {
    ...(config ?? {}),
    // Idempotent: pre-merged configs must not duplicate global whitelist entries.
    ignoreWords: [
      ...GLOBAL_WHITELIST,
      ...userIgnore.filter((word) => !GLOBAL_WHITELIST_SET.has(word)),
    ],
    fuzzyToleranceLevel: config?.fuzzyToleranceLevel ?? 0.8,
  };

  if (effective.allowObfuscatedMatch && effective.wordBoundaries) {
    console.warn(
      '[Glin-Profanity] Obfuscated match enabled → wordBoundaries will be ignored internally.',
    );
  }

  return effective;
}

function normalizeConfigForKey(config: FilterConfig): FilterConfig {
  const normalized: FilterConfig = { ...config };

  if (normalized.languages) {
    normalized.languages = [...normalized.languages].sort((a, b) => a.localeCompare(b));
  }
  if (normalized.ignoreWords) {
    normalized.ignoreWords = [...normalized.ignoreWords].sort((a, b) => a.localeCompare(b));
  }
  if (normalized.customWords) {
    normalized.customWords = [...normalized.customWords].sort((a, b) => a.localeCompare(b));
  }
  if (normalized.domainWhitelists) {
    const source = normalized.domainWhitelists;
    normalized.domainWhitelists = Object.keys(source)
      .sort((a, b) => a.localeCompare(b))
      .reduce(
        (acc, lang) => {
          acc[lang as Language] = [...(source[lang as Language] ?? [])].sort((a, b) => a.localeCompare(b));
          return acc;
        },
        {} as typeof source,
      );
  }

  return normalized;
}

function configCacheKey(config: FilterConfig): string {
  const normalized = normalizeConfigForKey(config);
  // Stable key regardless of object insertion order (matches Python sort_keys=True).
  const sortedEntries = Object.keys(normalized)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => [key, normalized[key as keyof FilterConfig]] as const);
  return JSON.stringify(Object.fromEntries(sortedEntries));
}

/**
 * Returns a shared Filter instance for the given configuration.
 * Instances are evicted in FIFO order when the pool exceeds FILTER_POOL_MAX.
 */
export function getPooledFilter(config?: ProfanityCheckerConfig): Filter {
  const effective = createFilterConfig(config);
  const key = configCacheKey(effective);
  const existing = filterPool.get(key);
  if (existing) {
    filterPool.delete(key);
    filterPool.set(key, existing);
    return existing;
  }

  const filter = new Filter(effective);
  if (filterPool.size >= FILTER_POOL_MAX) {
    const oldestKey = filterPool.keys().next().value;
    if (oldestKey) {
      filterPool.delete(oldestKey);
    }
  }
  filterPool.set(key, filter);
  return filter;
}

/** Clears all pooled Filter instances (intended for tests). */
export function clearFilterPool(): void {
  filterPool.clear();
}
