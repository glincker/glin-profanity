import { LeetspeakLevel } from '../types/types';
import { normalizeLeetspeak } from '../utils/leetspeak';
import { normalizeUnicode } from '../utils/unicode';

export interface NormalizeConfig {
  normalizeUnicode: boolean;
  detectLeetspeak: boolean;
  leetspeakLevel: LeetspeakLevel;
  allowObfuscatedMatch: boolean;
}

/** Legacy allowObfuscatedMatch normalization, kept for backward compatibility. */
function normalizeObfuscated(text: string): string {
  const charMap: Record<string, string> = { '@': 'a', $: 's', '!': 'i', '1': 'i', '*': '' };
  return text
    .replace(/([a-zA-Z])\1{1,}/g, '$1$1')
    .replace(/[@$!1*]/g, (m) => charMap[m] || m);
}

/** Plain-string normalization; its offset-tracking twin lives in pipeline/normalizers. */
export function normalizeForMatching(
  text: string,
  aggressive: boolean,
  config: NormalizeConfig,
): string {
  let normalized = text;
  if (config.normalizeUnicode) normalized = normalizeUnicode(normalized);
  if (config.detectLeetspeak) {
    normalized = normalizeLeetspeak(normalized, {
      level: config.leetspeakLevel,
      collapseRepeated: true,
      // Keep double letters like "ss" for the normal check, collapse all when aggressive.
      maxRepeated: aggressive ? 1 : 2,
      removeSpacedChars: true,
    });
  }
  if (config.allowObfuscatedMatch && !config.detectLeetspeak) {
    normalized = normalizeObfuscated(normalized);
  }
  return normalized;
}
