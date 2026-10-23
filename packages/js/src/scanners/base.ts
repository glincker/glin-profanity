/**
 * Base types and interfaces for the glin-profanity scanner system.
 * Inspired by ProtectAI's llm-guard and Meta's LlamaFirewall scanner interface.
 *
 * @module scanners/base
 */

/** The final decision a scanner makes about an input. */
export type ScanDecision = 'ALLOW' | 'BLOCK' | 'HITL';

/** A match found within the input string. */
export interface ScanMatch {
  /** The pattern identifier or description that matched. */
  pattern: string;
  /** Zero-based start index of the match within the input. */
  startIndex: number;
  /** Zero-based end index (exclusive) of the match within the input. */
  endIndex: number;
  /** The category this match belongs to. */
  category: string;
}

/** The result returned by a scanner after processing an input. */
export interface ScanResult {
  /** The sanitized version of the input (may equal input if no changes). */
  sanitized: string;
  /** Whether the input is considered safe (true = safe, false = flagged). */
  valid: boolean;
  /** Risk score from 0 (safe) to 1 (maximum risk). */
  score: number;
  /** The decision the scanner reached. */
  decision: ScanDecision;
  /** Human-readable reasons why the input was flagged. */
  reasons: string[];
  /** Detailed match information, if available. */
  matches?: ScanMatch[];
  /** The name of the scanner that produced this result, used for telemetry. */
  scanner: string;
}

/** A content scanner that evaluates an input string. */
export interface Scanner {
  /** Unique name identifying this scanner. */
  readonly name: string;
  /** Evaluate the input and return a scan result. */
  scan(input: string, ctx?: ScanContext): Promise<ScanResult> | ScanResult;
}

/** Optional context provided to a scanner to influence its behaviour. */
export interface ScanContext {
  /** The role of the message author in the conversation. */
  role?: 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM' | 'MEMORY';
  /** How aggressively the scanner should flag content. */
  strictness?: 'lenient' | 'moderate' | 'strict';
}

/**
 * Coerce scanner input to a string.
 *
 * Scanners are reached from untyped runtime call sites; a non-string input
 * (`null`, `undefined`, numbers, objects) would otherwise throw inside
 * `RegExp.exec`. Treat anything that is not a string as empty so scanners never
 * raise on bad input. Mirrors Python's `coerce_scan_input`.
 */
export function coerceScanInput(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Build an ALLOW result for a scanner that found nothing to flag.
 *
 * @param scanner - Name of the scanner producing the result.
 * @param input - The original input string.
 */
export function allowResult(scanner: string, input: string): ScanResult {
  return {
    sanitized: input,
    valid: true,
    score: 0,
    decision: 'ALLOW',
    reasons: [],
    matches: [],
    scanner,
  };
}

/**
 * Build a BLOCK, HITL, or ALLOW result based on score thresholds.
 * Returns BLOCK when score ≥ blockAt, HITL when score ≥ hitlAt, and
 * ALLOW when score < hitlAt (even though matches were found).
 *
 * @param scanner - Name of the scanner producing the result.
 * @param input - The original input string.
 * @param score - Computed risk score (0..1).
 * @param reasons - List of human-readable flag reasons.
 * @param matches - Optional per-pattern match details.
 * @param blockAt - Threshold at or above which the decision is BLOCK (default 0.8).
 * @param hitlAt - Threshold at or above which the decision is HITL (default 0.5).
 */
export function blockResult(
  scanner: string,
  input: string,
  score: number,
  reasons: string[],
  matches?: ScanMatch[],
  blockAt = 0.8,
  hitlAt = 0.5,
): ScanResult {
  const decision: ScanDecision = score >= blockAt ? 'BLOCK' : score >= hitlAt ? 'HITL' : 'ALLOW';
  return {
    sanitized: input,
    valid: decision === 'ALLOW',
    score,
    decision,
    reasons,
    matches: matches ?? [],
    scanner,
  };
}
