/**
 * ops-claim.mjs
 *
 * Measures single-call throughput of glin-profanity so the throughput
 * claims in the docs can be checked against a reproducible number.
 * One "op" is one isProfane() call on one short string.
 *
 * Run: node ops-claim.mjs   (requires packages/js built)
 */
import { Bench } from 'tinybench';
import { Filter } from '../../packages/js/dist/index.js';

const CLEAN = 'The quick brown fox jumps over the lazy dog';
const PROFANE = 'This contains some shit and other crap';

const configs = [
  ['default, clean text', {}, CLEAN],
  ['default, profane text', {}, PROFANE],
  ['english only, clean text', { languages: ['english'] }, CLEAN],
  ['english only, profane text', { languages: ['english'] }, PROFANE],
  ['leetspeak moderate, clean', { languages: ['english'], detectLeetspeak: true, leetspeakLevel: 'moderate' }, CLEAN],
  ['leetspeak aggressive, clean', { languages: ['english'], detectLeetspeak: true, leetspeakLevel: 'aggressive' }, CLEAN],
  ['unicode normalization, clean', { languages: ['english'], normalizeUnicode: true }, CLEAN],
  ['3 languages, clean', { languages: ['english', 'french', 'spanish'] }, CLEAN],
  // The result cache is only consulted by checkProfanity(), not isProfane().
  ['checkProfanity, no cache, clean', { languages: ['english'] }, CLEAN, 'checkProfanity'],
  ['checkProfanity, cache hit, clean', { languages: ['english'], cacheResults: true, maxCacheSize: 1000 }, CLEAN, 'checkProfanity'],
];

const bench = new Bench({ time: 500, warmupTime: 200 });
for (const [name, opts, text, method = 'isProfane'] of configs) {
  const filter = new Filter(opts);
  filter[method](text);
  bench.add(name, () => { filter[method](text); });
}
await bench.run();

console.log(`Node ${process.version}, one isProfane() or checkProfanity() call per op`);
for (const t of bench.tasks) {
  console.log(`${t.name.padEnd(32)} ${Math.round(t.result?.hz ?? 0).toLocaleString().padStart(12)} ops/sec`);
}
