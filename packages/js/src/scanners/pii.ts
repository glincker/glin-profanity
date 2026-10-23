/**
 * PII scanner — detects Personally Identifiable Information in text.
 *
 * @module scanners/pii
 */

import type { Scanner, ScanResult, ScanContext, ScanMatch } from './base';
import { allowResult, blockResult, coerceScanInput } from './base';
import { PII_PATTERNS, type PiiPattern } from './patterns/pii-patterns';
import type { Vault } from './vault';

// ---------------------------------------------------------------------------
// Options & public types
// ---------------------------------------------------------------------------

/** Configuration for PiiScanner. */
export interface PiiOptions {
  /**
   * When true, replace detected PII with vault placeholders in
   * `ScanResult.sanitized`. Requires `vault` to also be provided.
   */
  redact?: boolean;
  /**
   * Vault instance used to store originals when `redact` is true.
   */
  vault?: Vault;
  /** Extra patterns merged with the built-in set. */
  customPatterns?: PiiPattern[];
  /**
   * When true (default), any detected PII causes a BLOCK decision.
   * When false, the scanner will score proportionally.
   */
  blockOnAny?: boolean;
  /** Score threshold for BLOCK decision (default: 0.8). */
  blockAt?: number;
  /** Score threshold for HITL decision (default: 0.5). */
  hitlAt?: number;
}

// ---------------------------------------------------------------------------
// PiiScanner
// ---------------------------------------------------------------------------

/**
 * Scanner that detects PII (email, phone, SSN, credit card, IBAN, IP, MAC,
 * postcodes, passports, and dates of birth) in text.
 *
 * Implements the unified `Scanner` interface.
 */
export class PiiScanner implements Scanner {
  /** @inheritdoc */
  readonly name = 'pii';

  private readonly patterns: PiiPattern[];
  private readonly options: Required<Omit<PiiOptions, 'vault' | 'customPatterns'>> & {
    vault?: Vault;
  };

  constructor(options: PiiOptions = {}) {
    this.patterns = [...PII_PATTERNS, ...(options.customPatterns ?? [])];
    this.options = {
      redact: options.redact ?? false,
      vault: options.vault,
      blockOnAny: options.blockOnAny ?? true,
      blockAt: options.blockAt ?? 0.8,
      hitlAt: options.hitlAt ?? 0.5,
    };
  }

  /** @inheritdoc */
  scan(input: string, _ctx?: ScanContext): ScanResult {
    input = coerceScanInput(input);
    const matches: ScanMatch[] = [];
    const reasons: string[] = [];
    let sanitized = input;

    for (const entry of this.patterns) {
      const flags = entry.pattern.flags.includes('g')
        ? entry.pattern.flags
        : entry.pattern.flags + 'g';
      const re = new RegExp(entry.pattern.source, flags);
      let m: RegExpExecArray | null;

      while ((m = re.exec(input)) !== null) {
        const matched = m[0];

        // Run optional validator (e.g. Luhn, IBAN mod-97)
        if (entry.validator && !entry.validator(matched)) {
          if (matched.length === 0) break;
          continue;
        }

        matches.push({
          pattern: entry.id,
          startIndex: m.index,
          endIndex: m.index + matched.length,
          category: entry.type,
        });

        const label = `${entry.type.toUpperCase()} (${entry.id})`;
        if (!reasons.includes(label)) {
          reasons.push(label);
        }

        if (matched.length === 0) break;
      }
    }

    if (matches.length === 0) {
      return allowResult(this.name, input);
    }

    // Redact if requested
    if (this.options.redact) {
      sanitized = this.redactInput(input, matches);
    }

    const score = this.options.blockOnAny ? 1.0 : Math.min(1, matches.length / 5);

    const result = blockResult(
      this.name,
      sanitized,
      score,
      reasons,
      matches,
      this.options.blockAt,
      this.options.hitlAt,
    );

    return { ...result, sanitized };
  }

  private redactInput(input: string, matches: ScanMatch[]): string {
    // Deduplicate by range (multiple patterns may match the same span)
    const deduped = deduplicateMatches(matches);
    // Sort descending so we can splice from end without index drift
    const sorted = [...deduped].sort((a, b) => b.startIndex - a.startIndex);

    let result = input;
    for (const m of sorted) {
      const original = input.slice(m.startIndex, m.endIndex);
      const typeLabel = m.category.toUpperCase();
      const vault = this.options.vault;
      const placeholder = vault
        ? vault.store(typeLabel, original)
        : `[REDACTED_${typeLabel}]`;
      result = result.slice(0, m.startIndex) + placeholder + result.slice(m.endIndex);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove overlapping/duplicate match ranges.
 * When two matches overlap, keep the one with the larger span.
 */
function deduplicateMatches(matches: ScanMatch[]): ScanMatch[] {
  // Sort by startIndex ascending; for equal startIndex, put larger spans first.
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex);
  const result: ScanMatch[] = [];

  let lastEnd = -1;
  for (const m of sorted) {
    if (m.startIndex >= lastEnd) {
      // Non-overlapping: keep this match.
      result.push(m);
      lastEnd = m.endIndex;
    } else if (m.endIndex > lastEnd && result.length > 0) {
      // This match overlaps the previous but extends further — it is larger overall.
      // Replace the last kept match with this one so we keep the widest span.
      result[result.length - 1] = m;
      lastEnd = m.endIndex;
    }
    // Otherwise the current match is fully contained in the previous — skip it.
  }
  return result;
}

// ---------------------------------------------------------------------------
// Convenience function
// ---------------------------------------------------------------------------

/**
 * Scan a single string for PII using configurable options.
 *
 * @param input   - The text to scan.
 * @param options - Optional scanner configuration.
 * @returns A `ScanResult` with decision, score, and match details.
 */
export function scanPii(input: string, options?: PiiOptions): ScanResult {
  return new PiiScanner(options).scan(input);
}
