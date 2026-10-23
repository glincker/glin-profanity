/**
 * glin-profanity Competitive Benchmark Shootout
 *
 * Accuracy (precision, recall, F1, FPR) per library, per category and per
 * technique, plus ops/sec and bundle size, across torture-set.json.
 *
 * Run: cd benchmarks/shootout && npm install && npm run build-glin && node harness.mjs
 * Flags: --json   also print results.json to stdout (CI redirects it)
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Bench } from 'tinybench';

const JSON_MODE = process.argv.includes('--json');

// In JSON mode, redirect console.log → stderr so stdout stays clean for JSON
if (JSON_MODE) {
  // eslint-disable-next-line no-global-assign
  console.log = (...args) => console.error(...args);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load torture-set
// ---------------------------------------------------------------------------
const tortureCases = JSON.parse(
  readFileSync(join(__dirname, 'torture-set.json'), 'utf8'),
);

// Non-English cases are scored only for runners that declare language support.
const LANG_DICT = {
  fr: 'french', de: 'german', es: 'spanish', pt: 'portuguese', it: 'italian',
  tr: 'turkish', nl: 'dutch', ru: 'russian', pl: 'polish',
  ar: 'arabic', zh: 'chinese', ja: 'japanese', ko: 'korean',
};

// ---------------------------------------------------------------------------
// Load competitors
// ---------------------------------------------------------------------------

// glin-profanity
import { Filter as GlinFilter } from '../../packages/js/dist/index.js';
const GLIN_OPTS = {
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',
  normalizeUnicode: true,
};
const glinFilters = new Map();
function glinFor(dict) {
  if (!glinFilters.has(dict)) glinFilters.set(dict, new GlinFilter({ ...GLIN_OPTS, languages: [dict] }));
  return glinFilters.get(dict);
}
const glinFilter = glinFor('english');

// obscenity
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from './node_modules/obscenity/dist/index.js';
const obscenityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// bad-words, CJS package, use createRequire
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BadWords = require('bad-words');
const badWordsFilter = new BadWords();

// leo-profanity
const leoProfanity = require('leo-profanity');
leoProfanity.loadDictionary('en');

// @2toad/profanity
const { Profanity: ToadProfanity } = require('@2toad/profanity');
const toadFilter = new ToadProfanity();

// allprofanity, default config; extra languages are opt-in via loadLanguage
import { AllProfanity } from 'allprofanity';
const apFilters = new Map();
function apFor(dict) {
  if (!apFilters.has(dict)) {
    const f = new AllProfanity({ silent: true });
    if (dict !== 'english') f.loadLanguage(dict);
    apFilters.set(dict, f);
  }
  return apFilters.get(dict);
}

// ---------------------------------------------------------------------------
// Runner definitions. check(text, lang) is only called with lang !== 'en'
// when the runner sets multilingual: true.
// ---------------------------------------------------------------------------
const runners = [
  {
    name: 'glin-profanity',
    multilingual: true,
    check: (text, lang = 'en') => glinFor(lang === 'en' ? 'english' : LANG_DICT[lang]).isProfane(text),
  },
  {
    name: 'allprofanity',
    multilingual: true,
    // allprofanity ships english, hindi, french, german, spanish, bengali, tamil, telugu,
    // brazilian and greek. The other languages in the torture-set are unsupported (N/A).
    langs: new Set(['en', 'fr', 'de', 'es', 'pt']),
    check: (text, lang = 'en') => apFor(lang === 'en' ? 'english' : lang === 'pt' ? 'brazilian' : LANG_DICT[lang]).check(text),
  },
  { name: 'obscenity', check: (text) => obscenityMatcher.hasMatch(text) },
  { name: 'bad-words', check: (text) => badWordsFilter.isProfane(text) },
  { name: 'leo-profanity', check: (text) => leoProfanity.check(text) },
  { name: '@2toad/profanity', check: (text) => toadFilter.exists(text) },
];

// ---------------------------------------------------------------------------
// Score every case once per runner; all tables derive from this matrix.
// A thrown error counts as "not flagged" and is tallied separately.
// ---------------------------------------------------------------------------
// Negatives whose verdict depends on context (a name, a medical word, a word the
// dictionary lists on purpose). FPR is reported with and without them.
const CONTEXT_DEPENDENT = new Set(['dictionary-ambiguous', 'person-name', 'medical-technical']);
const isEnglish = (c) => c.language === 'en';
const englishCases = tortureCases.filter(isEnglish);
const foreignCases = tortureCases.filter((c) => !isEnglish(c));

for (const runner of runners) {
  runner.errors = 0;
  runner.flags = new Map();
  for (const c of tortureCases) {
    if (!isEnglish(c) && (!runner.multilingual || (runner.langs && !runner.langs.has(c.language)))) continue;
    let flagged = false;
    try {
      flagged = Boolean(runner.check(c.input, c.language));
    } catch {
      runner.errors++;
    }
    runner.flags.set(c.id, flagged);
  }
}

function tally(runner, cases) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const c of cases) {
    const flagged = runner.flags.get(c.id);
    if (flagged === undefined) continue;
    if (c.shouldFlag) { if (flagged) tp++; else fn++; }
    else if (flagged) fp++; else tn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const strictNeg = cases.filter((c) => !c.shouldFlag && !CONTEXT_DEPENDENT.has(c.technique) && runner.flags.has(c.id));
  const strictFp = strictNeg.filter((c) => runner.flags.get(c.id)).length;
  const fprStrict = strictNeg.length > 0 ? strictFp / strictNeg.length : 0;
  return { tp, fp, fn, tn, precision, recall, f1, fpr, fprStrict, strictFp, strictN: strictNeg.length };
}

function groupBy(cases, keyFn) {
  const m = new Map();
  for (const c of cases) {
    const k = keyFn(c);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return m;
}

const categories = [...groupBy(englishCases, (c) => c.category).keys()];
// Positive-case techniques keep their category prefix so same-named techniques stay distinct.
const techniqueGroups = groupBy(englishCases, (c) => `${c.category}/${c.technique.replace(/^sentence:/, '')}`);
const languages = [...new Set(foreignCases.map((c) => c.language))];

const accuracyResults = runners.map((runner) => {
  const overall = tally(runner, englishCases);
  const byCategory = {};
  for (const [cat, list] of groupBy(englishCases, (c) => c.category)) byCategory[cat] = tally(runner, list);
  const byTechnique = {};
  for (const [key, list] of techniqueGroups) byTechnique[key] = { ...tally(runner, list), n: list.length };
  const multilingual = {};
  if (runner.multilingual) {
    for (const lang of languages) {
      if (runner.langs && !runner.langs.has(lang)) continue;
      multilingual[lang] = tally(runner, foreignCases.filter((c) => c.language === lang));
    }
  }
  const failures = tortureCases
    .filter((c) => runner.flags.has(c.id) && runner.flags.get(c.id) !== c.shouldFlag)
    .map((c) => ({ id: c.id, input: c.input, expected: c.shouldFlag, category: c.category, technique: c.technique, language: c.language }));
  return { name: runner.name, errors: runner.errors, ...overall, byCategory, byTechnique, multilingual, failures };
});

console.log('='.repeat(70));
console.log('glin-profanity Competitive Shootout');
console.log('='.repeat(70));
console.log(`Torture-set: ${tortureCases.length} cases (${englishCases.length} English, ${foreignCases.length} non-English)`);
console.log();
for (const r of accuracyResults) {
  console.log(`[${r.name}] TP=${r.tp} FP=${r.fp} FN=${r.fn} TN=${r.tn} | P=${pct(r.precision)} R=${pct(r.recall)} F1=${pct(r.f1)} FPR=${pct(r.fpr)} FPRtraps=${pct(r.fprStrict)}${r.errors ? ` errors=${r.errors}` : ''}`);
}
console.log();

// ---------------------------------------------------------------------------
// Performance benchmark (ops/sec)
// ---------------------------------------------------------------------------
console.log('Running ops/sec benchmarks (this takes ~30s)...');
console.log();

// Deterministic stride sample of 20 English cases (mix of clean, profane, obfuscated).
const stride = Math.floor(englishCases.length / 20);
const benchSample = Array.from({ length: 20 }, (_, i) => englishCases[i * stride].input);

const bench = new Bench({ time: 500, iterations: 1000 });
for (const runner of runners) {
  bench.add(runner.name, () => {
    for (const text of benchSample) {
      try { runner.check(text); } catch { /* counted in accuracy pass */ }
    }
  });
}
await bench.run();

const perfResults = bench.tasks.map((t) => ({
  name: t.name,
  opsPerSec: t.result?.hz ?? 0,
  avgMs: t.result?.mean ?? 0,
}));
console.log('Ops/sec (higher is better, 20 inputs per iteration):');
for (const r of perfResults) {
  console.log(`  ${r.name.padEnd(22)} ${Math.round(r.opsPerSec).toLocaleString()} ops/sec  (avg ${(r.avgMs * 1000).toFixed(1)} us)`);
}

// ---------------------------------------------------------------------------
// Bundle size
// ---------------------------------------------------------------------------
function safeSize(path) {
  try { return statSync(path).size; } catch { return null; }
}
const bundleSizes = {
  'glin-profanity': safeSize(join(__dirname, '../../packages/js/dist/index.js')),
  'allprofanity': safeSize(join(__dirname, 'node_modules/allprofanity/dist/index.js')),
  'obscenity': safeSize(join(__dirname, 'node_modules/obscenity/dist/index.js')),
  'bad-words': safeSize(join(__dirname, 'node_modules/bad-words/lib/badwords.js')),
  'leo-profanity': safeSize(join(__dirname, 'node_modules/leo-profanity/src/index.js')),
  '@2toad/profanity': safeSize(join(__dirname, 'node_modules/@2toad/profanity/dist/profanity.js')),
};

// ---------------------------------------------------------------------------
// results.md
// ---------------------------------------------------------------------------
const now = new Date().toISOString().split('T')[0];
const frac = (r, key) => {
  const t = r.byCategory[key];
  const pos = t.tp + t.fn;
  return pos > 0 ? `${t.tp}/${pos}` : (t.fp === 0 ? 'OK' : `${t.fp} FP`);
};

let md = `# Benchmark Results: glin-profanity Shootout\n\n`;
md += `_Generated: ${now}  |  Torture-set: ${tortureCases.length} cases (${englishCases.length} English, ${foreignCases.length} non-English)  |  Node ${process.version}_\n\n`;

md += `## Accuracy (English cases)\n\n`;
md += `| Library | Precision | Recall | F1 | FPR (all) | FPR (traps only) | TP | FP | FN | TN |\n`;
md += `|---------|-----------|--------|----|-----------|------------------|----|----|----|----|\n`;
for (const r of accuracyResults) {
  md += `| ${r.name} | ${pct(r.precision)} | ${pct(r.recall)} | ${pct(r.f1)} | ${pct(r.fpr)} | ${pct(r.fprStrict)} (${r.strictFp}/${r.strictN}) | ${r.tp} | ${r.fp} | ${r.fn} | ${r.tn} |\n`;
}

md += `\n"FPR (traps only)" excludes should-pass techniques whose verdict is context dependent (${[...CONTEXT_DEPENDENT].join(', ')}), where the dictionary lists the word on purpose.\n`;

md += `\n## Recall by Category (English; positives caught / positives)\n\n`;
md += `Cells for all-negative categories show false positives instead.\n\n`;
md += `| Category | ${runners.map((r) => r.name).join(' | ')} |\n`;
md += `|----------|${runners.map(() => '---').join('|')}|\n`;
for (const cat of categories) {
  md += `| ${cat} | ${accuracyResults.map((r) => frac(r, cat)).join(' | ')} |\n`;
}

md += `\n## Recall by Technique (English)\n\n`;
md += `<details><summary>Per-technique recall for should-flag techniques, FP counts for should-pass techniques</summary>\n\n`;
md += `| Category / technique | n | ${runners.map((r) => r.name).join(' | ')} |\n`;
md += `|----------------------|---|${runners.map(() => '---').join('|')}|\n`;
for (const [key, list] of techniqueGroups) {
  const cells = accuracyResults.map((r) => {
    const t = r.byTechnique[key];
    return t.tp + t.fn > 0 ? `${t.tp}/${t.tp + t.fn}` : (t.fp === 0 ? 'OK' : `${t.fp} FP`);
  });
  md += `| ${key} | ${list.length} | ${cells.join(' | ')} |\n`;
}
md += `\n</details>\n`;

md += `\n## Multilingual (non-English cases)\n\n`;
md += `Only libraries with non-English dictionaries are scored; the rest are English-only. Each case is run with that language's dictionary loaded.\n\n`;
const mlRunners = accuracyResults.filter((r) => Object.keys(r.multilingual).length > 0);
md += `| Language | Cases | ${mlRunners.map((r) => `${r.name} recall | ${r.name} FP`).join(' | ')} |\n`;
md += `|----------|-------|${mlRunners.map(() => '---|---').join('|')}|\n`;
for (const lang of languages) {
  const n = foreignCases.filter((c) => c.language === lang).length;
  const cells = mlRunners.map((r) => {
    const t = r.multilingual[lang];
    if (!t) return 'N/A | N/A';
    return `${t.tp}/${t.tp + t.fn} | ${t.fp}/${t.fp + t.tn}`;
  });
  md += `| ${lang} | ${n} | ${cells.join(' | ')} |\n`;
}

md += `\n## Performance (ops/sec, 20 inputs per iteration)\n\n`;
md += `| Library | ops/sec | avg latency |\n`;
md += `|---------|---------|-------------|\n`;
const maxOps = Math.max(...perfResults.map((r) => r.opsPerSec));
for (const r of perfResults) {
  const mark = r.opsPerSec === maxOps ? ' (fastest)' : '';
  md += `| ${r.name}${mark} | ${Math.round(r.opsPerSec).toLocaleString()} | ${(r.avgMs * 1000).toFixed(1)} us |\n`;
}

md += `\n## Bundle Size (unminified JS dist)\n\n`;
md += `| Library | Size |\n`;
md += `|---------|------|\n`;
for (const [lib, size] of Object.entries(bundleSizes)) {
  md += `| ${lib} | ${size ? (size / 1024).toFixed(1) + ' KB' : 'N/A'} |\n`;
}

md += `\n## Notes\n\n`;
md += `- **glin-profanity** configured with \`detectLeetspeak: true, leetspeakLevel: 'aggressive', normalizeUnicode: true\`; one filter per language for non-English cases\n`;
md += `- **allprofanity** and all other libraries run with default settings; allprofanity loads extra languages with \`loadLanguage\`\n`;
md += `- Headline accuracy uses English cases only so English-only libraries are not penalised for languages they do not claim\n`;
md += `- Torture-set is generated by \`generate-torture.mjs\`; see README for the schema and methodology\n`;
md += `- Performance measured with [tinybench](https://github.com/tinylibs/tinybench), 20 stride-sampled English inputs per iteration\n`;
md += `- Bundle sizes are unminified source files; minified + gzipped sizes will be smaller\n`;

writeFileSync(join(__dirname, 'results.md'), md, 'utf8');

// ---------------------------------------------------------------------------
// results.json (same file CI produces via --json > results.json)
// ---------------------------------------------------------------------------
const perfMap = Object.fromEntries(perfResults.map((r) => [r.name, r]));
const round = (n) => parseFloat(n.toFixed(4));
const slim = (t) => ({ tp: t.tp, fp: t.fp, fn: t.fn, tn: t.tn, precision: round(t.precision), recall: round(t.recall), f1: round(t.f1), fpr: round(t.fpr), fprStrict: round(t.fprStrict) });
const libraries = accuracyResults.map((r) => ({
  name: r.name,
  precision: round(r.precision),
  recall: round(r.recall),
  f1: round(r.f1),
  fpr: round(r.fpr),
  fprStrict: round(r.fprStrict),
  opsPerSec: Math.round(perfMap[r.name]?.opsPerSec ?? 0),
  counts: { tp: r.tp, fp: r.fp, fn: r.fn, tn: r.tn },
  errors: r.errors,
  byCategory: Object.fromEntries(Object.entries(r.byCategory).map(([k, v]) => [k, slim(v)])),
  byTechnique: Object.fromEntries(Object.entries(r.byTechnique).map(([k, v]) => [k, { ...slim(v), n: v.n }])),
  multilingual: Object.fromEntries(Object.entries(r.multilingual).map(([k, v]) => [k, slim(v)])),
  failures: r.failures,
}));
const output = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  cases: { total: tortureCases.length, english: englishCases.length, nonEnglish: foreignCases.length },
  libraries,
};
const json = JSON.stringify(output, null, 2) + '\n';
writeFileSync(join(__dirname, 'results.json'), json, 'utf8');
console.error('\nResults written to benchmarks/shootout/results.md and results.json');
if (JSON_MODE) process.stdout.write(json);

function pct(n) {
  return (n * 100).toFixed(1) + '%';
}
