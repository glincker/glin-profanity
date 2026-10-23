/**
 * @fileoverview Unicode normalization utilities for profanity detection.
 * Handles homoglyphs, full-width characters, diacritics, and other Unicode tricks.
 * @module utils/unicode
 */

/**
 * Configuration options for Unicode normalization.
 */
export interface UnicodeNormalizationOptions {
  /**
   * Apply NFKD normalization to decompose characters.
   * @default true
   */
  nfkd?: boolean;

  /**
   * Convert homoglyphs (lookalike characters) to ASCII.
   * @default true
   */
  homoglyphs?: boolean;

  /**
   * Convert full-width characters to half-width.
   * @default true
   */
  fullWidth?: boolean;

  /**
   * Remove diacritical marks (accents, umlauts, etc.).
   * @default true
   */
  removeDiacritics?: boolean;

  /**
   * Remove zero-width characters (ZWJ, ZWNJ, etc.).
   * @default true
   */
  removeZeroWidth?: boolean;
}

/**
 * Homoglyph mapping: visually similar Unicode characters to ASCII equivalents.
 * Organized by the ASCII character they resemble.
 */
export const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic homoglyphs (look like Latin)
  'а': 'a', // Cyrillic small a
  'А': 'A', // Cyrillic capital A
  'е': 'e', // Cyrillic small e
  'Е': 'E', // Cyrillic capital E
  'к': 'k', // Cyrillic small ka
  'К': 'K', // Cyrillic capital Ka
  'о': 'o', // Cyrillic small o
  'О': 'O', // Cyrillic capital O
  'р': 'p', // Cyrillic small er
  'Р': 'P', // Cyrillic capital Er
  'с': 'c', // Cyrillic small es
  'С': 'C', // Cyrillic capital Es
  'у': 'u', // Cyrillic small u (map to u, not y)
  'У': 'U', // Cyrillic capital U
  'х': 'x', // Cyrillic small ha
  'Х': 'X', // Cyrillic capital Ha
  'і': 'i', // Cyrillic small i (Ukrainian)
  'І': 'I', // Cyrillic capital I (Ukrainian)
  'ј': 'j', // Cyrillic small je
  'Ј': 'J', // Cyrillic capital Je
  'ѕ': 's', // Cyrillic small dze
  'Ѕ': 'S', // Cyrillic capital Dze

  // Currency and special symbols that look like letters
  '¢': 'c', // Cent sign
  'ƒ': 'f', // Latin small f with hook (florin)

  // Greek homoglyphs
  'α': 'a', // Greek small alpha
  'Α': 'A', // Greek capital Alpha
  'β': 'b', // Greek small beta (sort of)
  'Β': 'B', // Greek capital Beta
  'ε': 'e', // Greek small epsilon
  'Ε': 'E', // Greek capital Epsilon
  'η': 'n', // Greek small eta
  'Η': 'H', // Greek capital Eta
  'ι': 'i', // Greek small iota
  'Ι': 'I', // Greek capital Iota
  'κ': 'k', // Greek small kappa
  'Κ': 'K', // Greek capital Kappa
  'ν': 'v', // Greek small nu (looks like v)
  'Ν': 'N', // Greek capital Nu
  'ο': 'o', // Greek small omicron
  'Ο': 'O', // Greek capital Omicron
  'ρ': 'p', // Greek small rho
  'Ρ': 'P', // Greek capital Rho
  'τ': 't', // Greek small tau
  'Τ': 'T', // Greek capital Tau
  'υ': 'u', // Greek small upsilon
  'Ս': 'U', // Armenian capital seh (looks like U)
  'ս': 'u', // Armenian small seh (looks like u)
  'Υ': 'Y', // Greek capital Upsilon
  'χ': 'x', // Greek small chi
  'Χ': 'X', // Greek capital Chi

  // Mathematical symbols
  'ℂ': 'C', // Double-struck capital C
  'ℍ': 'H', // Double-struck capital H
  'ℕ': 'N', // Double-struck capital N
  'ℙ': 'P', // Double-struck capital P
  'ℚ': 'Q', // Double-struck capital Q
  'ℝ': 'R', // Double-struck capital R
  'ℤ': 'Z', // Double-struck capital Z

  // Subscript/superscript
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
  'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
  'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
  'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
  'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',

  // Small caps
  'ᴀ': 'A', 'ʙ': 'B', 'ᴄ': 'C', 'ᴅ': 'D', 'ᴇ': 'E',
  'ꜰ': 'F', 'ɢ': 'G', 'ʜ': 'H', 'ɪ': 'I', 'ᴊ': 'J',
  'ᴋ': 'K', 'ʟ': 'L', 'ᴍ': 'M', 'ɴ': 'N', 'ᴏ': 'O',
  'ᴘ': 'P', 'ǫ': 'Q', 'ʀ': 'R', 'ꜱ': 'S', 'ᴛ': 'T',
  'ᴜ': 'U', 'ᴠ': 'V', 'ᴡ': 'W', 'ʏ': 'Y', 'ᴢ': 'Z',

  // Other lookalikes
  'ⓐ': 'a', 'ⓑ': 'b', 'ⓒ': 'c', 'ⓓ': 'd', 'ⓔ': 'e',
  'ⓕ': 'f', 'ⓖ': 'g', 'ⓗ': 'h', 'ⓘ': 'i', 'ⓙ': 'j',
  'ⓚ': 'k', 'ⓛ': 'l', 'ⓜ': 'm', 'ⓝ': 'n', 'ⓞ': 'o',
  'ⓟ': 'p', 'ⓠ': 'q', 'ⓡ': 'r', 'ⓢ': 's', 'ⓣ': 't',
  'ⓤ': 'u', 'ⓥ': 'v', 'ⓦ': 'w', 'ⓧ': 'x', 'ⓨ': 'y',
  'ⓩ': 'z',

  // Fancy Unicode letters
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
  'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
  'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
  'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
  'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y',
  'ｚ': 'z',

  // Mirrored/rotated
  'ɐ': 'a', 'ɔ': 'c', 'ǝ': 'e', 'ɟ': 'j', 'ɥ': 'h',
  'ɯ': 'm', 'ɹ': 'r', 'ʇ': 't', 'ʌ': 'v', 'ʍ': 'w',

  // Common lookalikes
  'ł': 'l', 'Ł': 'L',
  'ø': 'o', 'Ø': 'O',
  'đ': 'd', 'Đ': 'D',
  'ħ': 'h', 'Ħ': 'H',
  'ı': 'i', 'İ': 'I',
  'ĸ': 'k',
  'ŀ': 'l', 'Ŀ': 'L',
  'ŋ': 'n', 'Ŋ': 'N',
  'œ': 'oe', 'Œ': 'OE',
  'ſ': 's',
  'ŧ': 't', 'Ŧ': 'T',
};

/**
 * Zero-width and invisible characters to remove.
 */
export const ZERO_WIDTH_CHARS = [
  '\u200B', // Zero-width space
  '\u200C', // Zero-width non-joiner
  '\u200D', // Zero-width joiner
  '\u200E', // Left-to-right mark
  '\u200F', // Right-to-left mark
  '\u2060', // Word joiner
  '\u2061', // Function application
  '\u2062', // Invisible times
  '\u2063', // Invisible separator
  '\u2064', // Invisible plus
  '\uFEFF', // Byte order mark / zero-width no-break space
  '\u00AD', // Soft hyphen
  '\u034F', // Combining grapheme joiner
  '\u061C', // Arabic letter mark
  '\u115F', // Hangul choseong filler
  '\u1160', // Hangul jungseong filler
  '\u17B4', // Khmer vowel inherent Aq
  '\u17B5', // Khmer vowel inherent Aa
  '\u180E', // Mongolian vowel separator
  '\u3164', // Hangul filler
];

// Combining Japanese (han)dakuten. These are nonspacing marks (\p{Mn}) but
// encode a phonemic kana distinction, so they must survive diacritic folding.
const KANA_VOICED_SOUND_MARKS = new Set(['\u3099', '\u309A']);

/**
 * Return true for Basic Latin and Latin Extended letters (not Cyrillic/CJK/etc.).
 */
export function isLatinScriptLetter(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined || !/\p{L}/u.test(char)) {
    return false;
  }
  return (code >= 0x41 && code <= 0x24f) || (code >= 0x1e00 && code <= 0x1eff);
}

/**
 * Skip homoglyph and leetspeak normalization when text contains non-Latin letters.
 */
export function textShouldSkipLatinObfuscationNormalization(text: string): boolean {
  let latinLetters = 0;
  let nonLatinLetters = 0;
  for (const char of text) {
    if (!/\p{L}/u.test(char)) {
      continue;
    }
    if (isLatinScriptLetter(char)) {
      latinLetters += 1;
    } else {
      nonLatinLetters += 1;
    }
  }
  if (nonLatinLetters === 0) {
    return false;
  }
  return nonLatinLetters >= latinLetters;
}

/**
 * Normalizes Unicode text for consistent profanity detection.
 * Handles various Unicode tricks used to evade filters.
 *
 * @param text - The input text containing potential Unicode obfuscation
 * @param options - Configuration options for normalization
 * @returns The normalized text
 *
 * @example
 * ```typescript
 * import { normalizeUnicode } from 'glin-profanity';
 *
 * normalizeUnicode('fυck');     // Returns: 'fuck' (Greek upsilon → u)
 * normalizeUnicode('fＵck');    // Returns: 'fuck' (full-width U → u)
 * normalizeUnicode('fück');     // Returns: 'fuck' (ü → u)
 * normalizeUnicode('fùck');     // Returns: 'fuck' (ù → u)
 * normalizeUnicode('f​uck');    // Returns: 'fuck' (removes zero-width space)
 * ```
 */
export function normalizeUnicode(
  text: string,
  options: UnicodeNormalizationOptions = {}
): string {
  const {
    nfkd = true,
    homoglyphs = true,
    fullWidth = true,
    removeDiacritics = true,
    removeZeroWidth = true,
  } = options;

  let normalized = text;

  // Step 1: Remove zero-width characters
  if (removeZeroWidth) {
    normalized = removeZeroWidthCharacters(normalized);
  }

  // Step 2: Convert full-width to half-width
  if (fullWidth) {
    normalized = convertFullWidth(normalized);
  }

  // Step 3: Apply homoglyph conversion
  if (homoglyphs) {
    normalized = convertHomoglyphs(normalized);
  }

  // Step 4: Apply NFKD normalization and remove diacritics
  if (nfkd || removeDiacritics) {
    normalized = normalizeNFKD(normalized, removeDiacritics);
  }

  return normalized;
}

/**
 * Removes zero-width and invisible characters from text.
 *
 * @param text - The input text
 * @returns Text with zero-width characters removed
 */
export function removeZeroWidthCharacters(text: string): string {
  const pattern = new RegExp(`[${ZERO_WIDTH_CHARS.join('')}]`, 'g');
  return text.replace(pattern, '');
}

/**
 * Converts full-width ASCII characters to half-width.
 * Full-width characters (U+FF01 to U+FF5E) are used in CJK text
 * but can also be used to evade filters.
 *
 * @param text - The input text
 * @returns Text with full-width characters converted
 *
 * @example
 * ```typescript
 * convertFullWidth('ＡＢＣ');  // Returns: 'ABC'
 * convertFullWidth('ｆｕｃｋ'); // Returns: 'fuck'
 * ```
 */
export function convertFullWidth(text: string): string {
  return text.replace(/[\uFF01-\uFF5E]/g, (char) => {
    // Full-width ASCII starts at U+FF01 and maps to U+0021 (!)
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * Converts homoglyph characters to their ASCII equivalents.
 *
 * @param text - The input text
 * @returns Text with homoglyphs converted
 */
export function homoglyphToAscii(char: string): string {
  return HOMOGLYPHS[char] ?? char;
}

export function convertHomoglyphs(text: string): string {
  return text
    .split('')
    .map((char) => homoglyphToAscii(char))
    .join('');
}

/**
 * Applies NFKD normalization and optionally removes diacritical marks.
 * NFKD decomposes characters into base characters and combining marks.
 *
 * @param text - The input text
 * @param removeDiacritics - Whether to remove diacritical marks
 * @returns Normalized text
 *
 * @example
 * ```typescript
 * normalizeNFKD('fück', true);   // Returns: 'fuck'
 * normalizeNFKD('café', true);   // Returns: 'cafe'
 * normalizeNFKD('naïve', true);  // Returns: 'naive'
 * ```
 */
export function normalizeNFKD(
  text: string,
  removeDiacritics: boolean = true
): string {
  // NFKD = Normalization Form Compatibility Decomposition
  let normalized = text.normalize('NFKD');

  if (removeDiacritics) {
    // Remove nonspacing combining marks, but keep Japanese voiced/semi-voiced
    // sound marks: ソ vs ゾ (and ハ/バ/パ) is a phonemic kana distinction, not a
    // foldable diacritic. Dropping it makes クソ match ゾクゾク (ゾ→ソ) and ビッチ
    // collapse to ヒッチ. Recompose with NFC afterwards so the kept marks fold
    // back into precomposed kana (ソ + ゙ -> ゾ).
    normalized = normalized.replace(
      /\p{Mn}/gu,
      (mark) => (KANA_VOICED_SOUND_MARKS.has(mark) ? mark : '')
    );
    normalized = normalized.normalize('NFC');
  }

  return normalized;
}

/**
 * Detects if text contains potential Unicode obfuscation.
 * Useful for deciding whether to apply Unicode normalization.
 *
 * @param text - The input text to analyze
 * @returns True if Unicode obfuscation patterns are detected
 *
 * @example
 * ```typescript
 * containsUnicodeObfuscation('hello');     // Returns: false
 * containsUnicodeObfuscation('fυck');      // Returns: true (Greek letter)
 * containsUnicodeObfuscation('f​uck');     // Returns: true (zero-width)
 * ```
 */
export function containsUnicodeObfuscation(text: string): boolean {
  // Check for zero-width characters
  const zeroWidthPattern = new RegExp(`[${ZERO_WIDTH_CHARS.join('')}]`);
  if (zeroWidthPattern.test(text)) return true;

  // Check for full-width characters
  if (/[\uFF01-\uFF5E]/.test(text)) return true;

  // Check for homoglyphs (non-ASCII that looks like ASCII)
  for (const char of text) {
    if (HOMOGLYPHS[char]) return true;
  }

  // Check for combining characters
  if (/[\u0300-\u036f]/.test(text)) return true;

  // Check if NFKD normalization would change the text
  if (text !== text.normalize('NFKD')) return true;

  return false;
}

/**
 * Gets the character set being used in text.
 * Helps identify mixed-script attacks (e.g., mixing Latin and Cyrillic).
 *
 * @param text - The input text
 * @returns Object with detected character set information
 */
export function detectCharacterSets(text: string): {
  hasLatin: boolean;
  hasCyrillic: boolean;
  hasGreek: boolean;
  hasFullWidth: boolean;
  hasMixed: boolean;
} {
  const hasLatin = /[a-zA-Z]/.test(text);
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasGreek = /[\u0370-\u03FF]/.test(text);
  const hasFullWidth = /[\uFF01-\uFF5E]/.test(text);

  const scriptCount = [hasLatin, hasCyrillic, hasGreek, hasFullWidth].filter(Boolean).length;

  return {
    hasLatin,
    hasCyrillic,
    hasGreek,
    hasFullWidth,
    hasMixed: scriptCount > 1,
  };
}
