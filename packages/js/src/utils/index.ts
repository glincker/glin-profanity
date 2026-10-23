/**
 * @fileoverview Utility functions for glin-profanity.
 * @module utils
 */

export {
  normalizeLeetspeak,
  collapseSpacedCharacters,
  collapseRepeatedCharacters,
  containsLeetspeak,
  generateLeetspeakVariants,
  type LeetspeakLevel,
  type LeetspeakOptions,
} from './leetspeak';

export {
  normalizeUnicode,
  removeZeroWidthCharacters,
  convertFullWidth,
  convertHomoglyphs,
  normalizeNFKD,
  containsUnicodeObfuscation,
  detectCharacterSets,
  type UnicodeNormalizationOptions,
} from './unicode';
