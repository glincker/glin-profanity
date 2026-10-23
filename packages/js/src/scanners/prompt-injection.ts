/**
 * Rule-based prompt injection scanner (Phase A).
 *
 * Uses a pattern database to detect common prompt injection techniques.
 * Phase B (ONNX model) is planned and will be composed with this scanner.
 *
 * @module scanners/prompt-injection
 */

import type { Scanner, ScanResult, ScanContext, ScanMatch } from './base';
import { allowResult, blockResult, coerceScanInput } from './base';
import { INJECTION_PATTERNS, type InjectionPattern } from './patterns/injection-patterns';

/** Configuration options for the PromptInjectionScanner. */
export interface PromptInjectionOptions {
  /**
   * How aggressively to score matches.
   * - `lenient`: uses a higher normalizer that divides the raw severity sum more
   *   aggressively, producing lower scores and requiring more evidence to block.
   * - `moderate` (default): balanced normalizer.
   * - `strict`: lowest normalizer, so even a small number of pattern matches can
   *   push the score to BLOCK.
   */
  strictness?: 'lenient' | 'moderate' | 'strict';
  /** Additional custom patterns to check alongside the built-in set. */
  customPatterns?: InjectionPattern[];
  /** Score threshold at or above which the decision is BLOCK (default: 0.8). */
  blockAt?: number;
  /** Score threshold at or above which the decision is HITL (default: 0.5). */
  hitlAt?: number;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

const STRICTNESS_NORMALIZER: Record<string, number> = {
  strict: 1.0,
  moderate: 1.5,
  lenient: 2.5,
};

/** A compiled injection pattern ready for execution. */
interface CompiledPattern {
  def: InjectionPattern;
  re: RegExp;
}

/** Rule-based scanner that detects prompt injection patterns in text. */
export class PromptInjectionScanner implements Scanner {
  /** @inheritdoc */
  readonly name = 'prompt-injection';

  private readonly compiledPatterns: CompiledPattern[];
  private readonly strictness: 'lenient' | 'moderate' | 'strict';
  private readonly blockAt: number;
  private readonly hitlAt: number;

  constructor(options: PromptInjectionOptions = {}) {
    this.strictness = options.strictness ?? 'moderate';
    this.blockAt = options.blockAt ?? 0.8;
    this.hitlAt = options.hitlAt ?? 0.5;
    const allPatterns: InjectionPattern[] = [
      ...INJECTION_PATTERNS,
      ...(options.customPatterns ?? []),
    ];
    this.compiledPatterns = allPatterns.map(def => ({
      def,
      re: new RegExp(
        def.pattern.source,
        def.pattern.flags.includes('g') ? def.pattern.flags : def.pattern.flags + 'g',
      ),
    }));
  }

  /** @inheritdoc */
  scan(input: string, ctx?: ScanContext): ScanResult {
    input = coerceScanInput(input);
    // ctx.strictness overrides constructor option when provided
    const effectiveStrictness = ctx?.strictness ?? this.strictness;
    // Fall back to the moderate normalizer for unknown strictness values so an
    // out-of-range ctx.strictness can never make the score NaN (matches Python).
    const normalizer =
      STRICTNESS_NORMALIZER[effectiveStrictness] ?? STRICTNESS_NORMALIZER.moderate;

    const matchDetails: ScanMatch[] = [];
    const matchedCategories = new Set<string>();
    let rawScore = 0;

    for (const { def, re } of this.compiledPatterns) {
      // Reset lastIndex before each scan so the compiled regex is reusable
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(input)) !== null) {
        const weight = SEVERITY_WEIGHTS[def.severity] ?? 0.5;
        rawScore += weight;
        matchedCategories.add(def.category);
        matchDetails.push({
          pattern: def.id,
          startIndex: m.index,
          endIndex: m.index + m[0].length,
          category: def.category,
        });
        // Avoid infinite loops on zero-length matches
        if (m[0].length === 0) break;
      }
    }

    if (matchDetails.length === 0) {
      return allowResult(this.name, input);
    }

    const score = Math.min(1, rawScore / normalizer);
    const reasons = Array.from(matchedCategories);

    return blockResult(
      this.name,
      input,
      score,
      reasons,
      matchDetails,
      this.blockAt,
      this.hitlAt,
    );
  }
}

/** Convenience singleton using default (moderate) settings. */
export const defaultPromptInjectionScanner: PromptInjectionScanner =
  new PromptInjectionScanner();

/**
 * Scan a single string for prompt injection signals using configurable options.
 *
 * @param input - The text to scan.
 * @param options - Optional scanner configuration.
 * @returns A ScanResult with decision, score, and match details.
 */
export function checkPromptInjection(
  input: string,
  options?: PromptInjectionOptions,
): ScanResult {
  const scanner = options
    ? new PromptInjectionScanner(options)
    : defaultPromptInjectionScanner;
  return scanner.scan(input);
}
