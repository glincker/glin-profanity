/**
 * Composite scanner — runs multiple scanners over a single input in one call.
 *
 * Mirrors packages/py/glin_profanity/scanners/composite.py.
 *
 * @module scanners/composite
 */

import type { ScanDecision, ScanResult } from './base';
import { PromptInjectionScanner } from './prompt-injection';
import { SecretsScanner } from './secrets';
import { PiiScanner } from './pii';
import type { Vault } from './vault';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Scanner names supported by scanAll. */
export type CompositeScanner = 'prompt_injection' | 'secrets' | 'pii';

/** Options for scanAll. */
export interface ScanAllOptions {
  /**
   * Subset of scanners to run. Defaults to all three when omitted.
   * Order in the returned array follows the canonical order:
   * prompt_injection → secrets → pii.
   */
  scanners?: CompositeScanner[];
  /**
   * Optional shared Vault instance. When provided, secrets and PII scanners
   * will redact matched values into it (enabling later restoration).
   */
  vault?: Vault;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_SCANNERS: CompositeScanner[] = ['prompt_injection', 'secrets', 'pii'];

const DECISION_RANK: Record<ScanDecision, number> = {
  ALLOW: 0,
  HITL: 1,
  BLOCK: 2,
};

// ---------------------------------------------------------------------------
// scanAll
// ---------------------------------------------------------------------------

/**
 * Run multiple scanners on text, returning one {@link ScanResult} per scanner.
 *
 * @param text - The text to scan.
 * @param options - Optional configuration (scanner subset + shared vault).
 * @returns Array of ScanResult objects in canonical order:
 *          prompt_injection, secrets, pii.
 */
export function scanAll(text: string, options?: ScanAllOptions): ScanResult[] {
  const requested = options?.scanners && options.scanners.length > 0
    ? options.scanners
    : ALL_SCANNERS;

  const unknown = requested.filter((s) => !(ALL_SCANNERS as string[]).includes(s));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown scanner(s): ${unknown.join(', ')}. Valid names: ${ALL_SCANNERS.join(', ')}`,
    );
  }

  const active = new Set(requested);
  const vault = options?.vault;
  // Only redact when a real vault is provided. Treat an explicit null like
  // Python's `vault is not None` (no redaction) rather than redacting with a
  // placeholder.
  const redact = vault !== undefined && vault !== null;
  const results: ScanResult[] = [];

  for (const name of ALL_SCANNERS) {
    if (!active.has(name)) continue;

    if (name === 'prompt_injection') {
      const scanner = new PromptInjectionScanner();
      results.push(scanner.scan(text));
    } else if (name === 'secrets') {
      const scanner = new SecretsScanner({ redact, vault });
      results.push(scanner.scan(text));
    } else if (name === 'pii') {
      const scanner = new PiiScanner({ redact, vault });
      results.push(scanner.scan(text));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// worstDecision
// ---------------------------------------------------------------------------

/**
 * Return the most severe {@link ScanDecision} across a list of results.
 *
 * Order: BLOCK > HITL > ALLOW.
 *
 * @param results - List of scan results (may be empty).
 * @returns The worst decision found, or `'ALLOW'` for an empty list.
 */
export function worstDecision(results: ScanResult[]): ScanDecision {
  if (results.length === 0) return 'ALLOW';
  return results.reduce<ScanDecision>(
    (worst, r) => (DECISION_RANK[r.decision] > DECISION_RANK[worst] ? r.decision : worst),
    'ALLOW',
  );
}
