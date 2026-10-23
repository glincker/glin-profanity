/**
 * Secrets scanner — detects leaked credentials, API keys, and tokens.
 *
 * @module scanners/secrets
 */

import type { Scanner, ScanResult, ScanContext, ScanMatch } from './base';
import { allowResult, blockResult, coerceScanInput } from './base';
import { SECRET_PATTERNS, type SecretPattern } from './patterns/secret-patterns';
import type { Vault } from './vault';

// ---------------------------------------------------------------------------
// Shannon entropy
// ---------------------------------------------------------------------------

/**
 * Compute Shannon entropy (base-2) of a string.
 * Returns a value in [0, log2(alphabet_size)].
 */
function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq: Map<string, number> = new Map();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ---------------------------------------------------------------------------
// Options & public types
// ---------------------------------------------------------------------------

/** Configuration for SecretsScanner. */
export interface SecretsOptions {
  /**
   * When true, replace detected secrets with vault placeholders in
   * `ScanResult.sanitized`. Requires `vault` to also be provided.
   */
  redact?: boolean;
  /**
   * Vault instance used to store originals when `redact` is true.
   * A vault must be provided to obtain unique, reversible placeholders.
   * If `redact` is true but no vault is provided, each detected secret is
   * replaced with the generic string `[REDACTED]` and cannot be restored.
   */
  vault?: Vault;
  /** Extra patterns merged with the built-in set. */
  customPatterns?: SecretPattern[];
  /**
   * Minimum Shannon entropy required for patterns with `entropyCheck: true`.
   * Default: 4.0
   */
  minEntropy?: number;
  /**
   * When true (default), any detected secret causes a BLOCK decision.
   * When false, the scanner will score proportionally (useful for HITL workflows).
   */
  blockOnAny?: boolean;
  /** Score threshold for BLOCK decision (default: 0.8). */
  blockAt?: number;
  /** Score threshold for HITL decision (default: 0.5). */
  hitlAt?: number;
}

// ---------------------------------------------------------------------------
// SecretsScanner
// ---------------------------------------------------------------------------

/** A secret pattern with a pre-compiled global RegExp for scanning. */
interface CompiledSecretPattern {
  def: SecretPattern;
  re: RegExp;
}

function compileSecretPattern(entry: SecretPattern): CompiledSecretPattern {
  const flags = entry.pattern.flags.includes('g')
    ? entry.pattern.flags
    : entry.pattern.flags + 'g';
  return {
    def: entry,
    re: new RegExp(entry.pattern.source, flags),
  };
}

/**
 * Scanner that detects secrets, API keys, and credentials in text.
 *
 * Implements the unified `Scanner` interface.
 */
export class SecretsScanner implements Scanner {
  /** @inheritdoc */
  readonly name = 'secrets';

  private readonly compiledPatterns: CompiledSecretPattern[];
  private readonly options: Required<Omit<SecretsOptions, 'vault' | 'customPatterns'>> & {
    vault?: Vault;
  };

  constructor(options: SecretsOptions = {}) {
    const patterns = [...SECRET_PATTERNS, ...(options.customPatterns ?? [])];
    this.compiledPatterns = patterns.map(compileSecretPattern);
    this.options = {
      redact: options.redact ?? false,
      vault: options.vault,
      minEntropy: options.minEntropy ?? 4.0,
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

    for (const { def: entry, re } of this.compiledPatterns) {
      let m: RegExpExecArray | null;
      re.lastIndex = 0;

      while ((m = re.exec(input)) !== null) {
        // For patterns with capture groups, prefer group 1 for entropy check
        const token = m[1] ?? m[0];

        if (entry.entropyCheck) {
          const entropy = shannonEntropy(token);
          if (entropy < this.options.minEntropy) {
            if (m[0].length === 0) break;
            continue;
          }
        }

        matches.push({
          pattern: entry.id,
          startIndex: m.index,
          endIndex: m.index + m[0].length,
          // category carries the pattern family, not severity, so callers can
          // use it for grouping/labelling (e.g. "stripe", "aws") rather than
          // the risk tier.
          category: entry.family ?? secretFamily(entry.id),
        });

        if (!reasons.includes(entry.name)) {
          reasons.push(entry.name);
        }

        if (m[0].length === 0) break;
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

    // blockResult sets sanitized to `input` — override with our redacted version
    return { ...result, sanitized };
  }

  private redactInput(input: string, matches: ScanMatch[]): string {
    // Deduplicate overlapping ranges: sort by startIndex asc, then endIndex desc
    // (larger span first on tie) so we keep the widest match for each region.
    const deduped = deduplicateMatches(matches);
    // Splice from highest endIndex down so earlier indices stay valid.
    const sorted = [...deduped].sort((a, b) => b.endIndex - a.endIndex || b.startIndex - a.startIndex);

    let result = input;
    for (const m of sorted) {
      const original = input.slice(m.startIndex, m.endIndex);
      const typeLabel = m.category.toUpperCase();
      const vault = this.options.vault;
      const placeholder = vault
        ? vault.store(typeLabel, original)
        : '[REDACTED]';
      result = result.slice(0, m.startIndex) + placeholder + result.slice(m.endIndex);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a short family label from a pattern id.
 * e.g. "SEC-STRIPE-001" → "stripe", "SEC-AWS-001" → "aws"
 */
function secretFamily(id: string): string {
  const parts = id.split('-');
  // id format is "SEC-<FAMILY>-<NUM>" — middle segment(s) form the family
  if (parts.length >= 3) {
    return parts.slice(1, parts.length - 1).join('_').toLowerCase();
  }
  return id.toLowerCase();
}

/**
 * Remove overlapping/duplicate match ranges.
 * Sorts by startIndex ascending, endIndex descending (largest span first on tie).
 * Keeps the widest non-overlapping match for each region.
 */
function deduplicateMatches(matches: ScanMatch[]): ScanMatch[] {
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex);
  const result: ScanMatch[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.startIndex >= lastEnd) {
      result.push(m);
      lastEnd = m.endIndex;
    } else if (m.endIndex > lastEnd && result.length > 0) {
      // Current match extends beyond the last kept match — replace it
      result[result.length - 1] = m;
      lastEnd = m.endIndex;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Convenience function
// ---------------------------------------------------------------------------

/**
 * Scan a single string for secrets using configurable options.
 *
 * @param input   - The text to scan.
 * @param options - Optional scanner configuration.
 * @returns A `ScanResult` with decision, score, and match details.
 */
export function scanSecrets(input: string, options?: SecretsOptions): ScanResult {
  return new SecretsScanner(options).scan(input);
}
