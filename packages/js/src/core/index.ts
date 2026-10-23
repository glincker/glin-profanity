import { ProfanityCheckerConfig, ProfanityCheckResult } from './types';
import { getPooledFilter } from './filterPool';

export { clearFilterPool, createFilterConfig } from './filterPool';

export function checkProfanity(text: string, config?: ProfanityCheckerConfig): ProfanityCheckResult {
  const filter = getPooledFilter(config);
  const checkResult = filter.checkProfanity(text);

  // Filter based on minSeverity (if provided)
  const filteredWords =
    config?.minSeverity && checkResult.severityMap
      ? checkResult.profaneWords.filter(
          (word) =>
            checkResult.severityMap &&
            checkResult.severityMap[word] >= config.minSeverity!,
        )
      : checkResult.profaneWords;

  // Optional auto-replace
  const autoReplaced =
    config?.autoReplace && checkResult.processedText
      ? checkResult.processedText
      : text;

  // Custom actions
  config?.customActions?.(checkResult);

  return {
    ...checkResult,
    filteredWords,
    autoReplaced,
  };
}

export async function checkProfanityAsync(text: string, config?: ProfanityCheckerConfig): Promise<ProfanityCheckResult> {
  return Promise.resolve(checkProfanity(text, config));
}

export function isWordProfane(word: string, config?: ProfanityCheckerConfig): boolean {
  return getPooledFilter(config).isProfane(word);
}