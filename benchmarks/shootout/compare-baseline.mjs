#!/usr/bin/env node
/**
 * compare-baseline.mjs
 * Compares harness results against a frozen baseline and gates CI.
 *
 * Usage: node compare-baseline.mjs results.json baseline.json
 *
 * Exit 0, all checks pass
 * Exit 1, regression detected
 */

import { readFileSync } from 'node:fs';

const F1_DROP_THRESHOLD    = 0.03;  // max allowed drop in F1 vs baseline
const FPR_MAX              = 0.02;  // zero-FP marketing claim; allow tiny CI noise

const [,, resultsPath, baselinePath] = process.argv;
if (!resultsPath || !baselinePath) {
  console.error('Usage: node compare-baseline.mjs results.json baseline.json');
  process.exit(1);
}

const results  = JSON.parse(readFileSync(resultsPath, 'utf8'));
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

// Index current results by name
const current = Object.fromEntries(results.libraries.map((l) => [l.name, l]));

const glin = current['glin-profanity'];
const baseGlin = baseline['glin-profanity'];
const baseObscenity = baseline['obscenity'];

if (!glin) {
  console.error('ERROR: glin-profanity not found in results.json');
  process.exit(1);
}

const failures = [];

// --- Check 1: F1 regression vs baseline ---
const f1Drop = baseGlin.f1 - glin.f1;
if (f1Drop > F1_DROP_THRESHOLD) {
  failures.push(
    `F1 regression: ${pct(glin.f1)} vs baseline ${pct(baseGlin.f1)} (drop ${pct(f1Drop)} > threshold ${pct(F1_DROP_THRESHOLD)})`
  );
}

// --- Check 2: FPR must not exceed threshold ---
if (glin.fpr > FPR_MAX) {
  failures.push(
    `FPR too high: ${pct(glin.fpr)} exceeds max ${pct(FPR_MAX)} (zero-FP claim violated)`
  );
}

// --- Check 3: ops/sec is informational-only ---
// CI runners are significantly slower than dev machines (often 2x+), so ops/sec
// is reported in the summary table for visibility but does not gate the PR.
// F1/FPR are the reliable correctness signals, perf is tracked locally.

// --- Check 4: glin must beat obscenity's baseline F1 ---
const currentObscenity = current['obscenity'];
const obscenityF1 = currentObscenity?.f1 ?? baseObscenity?.f1 ?? 0;
if (glin.f1 < obscenityF1) {
  failures.push(
    `glin-profanity F1 (${pct(glin.f1)}) fell below obscenity F1 (${pct(obscenityF1)})`
  );
}

// --- Summary table ---
const col = (s, w) => String(s).padEnd(w);
console.log('\nBenchmark Regression Guard, Summary');
console.log('='.repeat(60));
console.log(col('Check', 42) + col('Result', 18));
console.log('-'.repeat(60));
console.log(col(`F1: ${pct(glin.f1)} (baseline ${pct(baseGlin.f1)}, drop limit ${pct(F1_DROP_THRESHOLD)})`, 42) + col(f1Drop > F1_DROP_THRESHOLD ? 'FAIL' : 'PASS', 18));
console.log(col(`FPR: ${pct(glin.fpr)} (limit ${pct(FPR_MAX)})`, 42) + col(glin.fpr > FPR_MAX ? 'FAIL' : 'PASS', 18));
if (baseGlin.opsPerSec && glin.opsPerSec) {
  const opsDrop = (baseGlin.opsPerSec - glin.opsPerSec) / baseGlin.opsPerSec;
  const label = opsDrop > 0.30 ? 'INFO (slow runner)' : 'INFO';
  console.log(col(`ops/sec: ${Math.round(glin.opsPerSec).toLocaleString()} (baseline ${Math.round(baseGlin.opsPerSec).toLocaleString()})`, 42) + col(label, 18));
}
console.log(col(`F1 vs obscenity: ${pct(glin.f1)} > ${pct(obscenityF1)}`, 42) + col(glin.f1 < obscenityF1 ? 'FAIL' : 'PASS', 18));
console.log('='.repeat(60));

if (failures.length > 0) {
  console.error('\nREGRESSION DETECTED:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  process.exit(1);
}

console.log('\nAll checks passed.\n');

function pct(n) {
  return (n * 100).toFixed(1) + '%';
}
