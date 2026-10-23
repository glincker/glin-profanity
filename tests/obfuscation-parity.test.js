/**
 * Obfuscation parity: the same torture cases and probe inputs go through the JS and
 * Python filters, and every verdict must agree. Needs a built packages/js/dist (CommonJS bundle) and
 * python3; the suite is skipped when either is missing.
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distPath = path.join(root, 'packages/js/dist/index.cjs');
const tortureCases = JSON.parse(
  fs.readFileSync(path.join(root, 'benchmarks/shootout/torture-set.json'), 'utf8'),
);

const hasPython = spawnSync('python3', ['--version']).status === 0;
const runnable = fs.existsSync(distPath) && hasPython;
const suite = runnable ? describe : describe.skip;

const LANG_DICT = {
  fr: 'french', de: 'german', es: 'spanish', pt: 'portuguese', it: 'italian',
  tr: 'turkish', nl: 'dutch', ru: 'russian', pl: 'polish',
  ar: 'arabic', zh: 'chinese', ja: 'japanese', ko: 'korean',
};
const BASE = { detectLeetspeak: true, leetspeakLevel: 'aggressive', normalizeUnicode: true };

const PYTHON_RUNNER = `
import json, sys
sys.path.insert(0, sys.argv[1])
from glin_profanity import Filter

def snake(key):
    return ''.join('_' + c.lower() if c.isupper() else c for c in key)

def convert(value):
    if isinstance(value, dict):
        return {snake(k): convert(v) for k, v in value.items()}
    return value

jobs = json.load(sys.stdin)
filters = {}
out = []
for job in jobs:
    key = json.dumps(job['config'], sort_keys=True)
    if key not in filters:
        filters[key] = Filter(convert(job['config']))
    f = filters[key]
    result = f.check_profanity(job['text'])
    out.append({
        'flag': f.is_profane(job['text']),
        'contains': result['contains_profanity'],
        'words': sorted(result['profane_words']),
        'processed': result.get('processed_text'),
    })
print(json.dumps(out))
`;

function runPython(jobs) {
  const stdout = execFileSync('python3', ['-c', PYTHON_RUNNER, path.join(root, 'packages/py')], {
    input: JSON.stringify(jobs),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  return JSON.parse(stdout);
}

/** Precision, recall and false positive rate for a list of [shouldFlag, flagged] pairs. */
function tally(pairs) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const [expected, flagged] of pairs) {
    if (expected) flagged ? tp++ : fn++;
    else flagged ? fp++ : tn++;
  }
  return {
    tp, fp, fn, tn,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
    fpr: fp + tn ? fp / (fp + tn) : 0,
  };
}

suite('obfuscation parity between JS and Python', () => {
  const { Filter } = runnable ? require(distPath) : {};
  const jsFilters = new Map();
  const jsFor = (config) => {
    const key = JSON.stringify(config);
    if (!jsFilters.has(key)) jsFilters.set(key, new Filter(config));
    return jsFilters.get(key);
  };

  test('torture set: shouldFlag agrees on every case', () => {
    const jobs = tortureCases.map((c) => ({
      text: c.input,
      config: { ...BASE, languages: [c.language === 'en' ? 'english' : LANG_DICT[c.language]] },
    }));
    const py = runPython(jobs);

    const disagreements = [];
    const jsPairs = [];
    const pyPairs = [];
    tortureCases.forEach((c, i) => {
      const jsFlag = jsFor(jobs[i].config).isProfane(c.input);
      if (jsFlag !== py[i].flag) {
        disagreements.push({ id: c.id, input: c.input, technique: c.technique, js: jsFlag, py: py[i].flag });
      }
      if (c.language === 'en') {
        jsPairs.push([c.shouldFlag, jsFlag]);
        pyPairs.push([c.shouldFlag, py[i].flag]);
      }
    });

    expect(disagreements).toEqual([]);
    const js = tally(jsPairs);
    const pyScore = tally(pyPairs);
    expect(pyScore.precision).toBeCloseTo(js.precision, 10);
    expect(pyScore.recall).toBeCloseTo(js.recall, 10);
    expect(pyScore.fpr).toBeCloseTo(js.fpr, 10);
  });

  const LEVELS = ['off', 'basic', 'standard', 'strict'];
  const PROBES = [
    'what the f.u.c.k was that', 'f*ck you', 'sh#t happens', 'aaaasshole', 'f<b>u</b>ck',
    '&#102;&#117;&#99;&#107;', 'b&amp;#105;tch', 'cl@ss starts at 5', 'Moby Dick is a novel',
    'you are a dick', '@$$ho|e', 'f|_|ck', 'b/\\stard', 'You are such a s h i t', 'fu.c k',
    'ass​istant', 'f​u​c​k', 'ｆｕｃｋ', 'p@ssword reset',
    '| **React Hook** | yes | no |',
    'Fuck Dick', 'Dick Fuck', 'You Dick', 'what a Big Dick', 'Fuck Moby Dick', 'Twatt, Orkney',
    'Moby Dick is great, you dick', 'The end.Fuel is cheap', 'Hello, World!', '',
  ];

  test.each(LEVELS)('probe inputs agree at obfuscation level %s', (level) => {
    const jobs = PROBES.map((text) => ({
      text,
      config: { ...BASE, languages: ['english'], obfuscation: level, replaceWith: '*' },
    }));
    const py = runPython(jobs);
    const f = jsFor(jobs[0].config);
    PROBES.forEach((text, i) => {
      const result = f.checkProfanity(text);
      expect({ text, flag: f.isProfane(text) }).toEqual({ text, flag: py[i].flag });
      expect({ text, words: [...result.profaneWords].sort() }).toEqual({ text, words: py[i].words });
      expect({ text, processed: result.processedText }).toEqual({ text, processed: py[i].processed });
    });
  });

  test('fine-grained options and extra safe words agree', () => {
    const configs = [
      { ...BASE, languages: ['english'], obfuscation: { separators: false } },
      { ...BASE, languages: ['english'], obfuscation: { masking: { chars: '~' } } },
      { ...BASE, languages: ['english'], obfuscation: { builtinWhitelist: false } },
      { ...BASE, languages: ['english'], whitelist: ['shit happens'] },
    ];
    const inputs = ['sh~t', 'sh*t', 'f.u.c.k', 'cl@ss', 'well, shit happens', 'this is shit'];
    const jobs = configs.flatMap((config) => inputs.map((text) => ({ text, config })));
    const py = runPython(jobs);
    jobs.forEach((job, i) => {
      expect({ job, flag: jsFor(job.config).isProfane(job.text) }).toEqual({ job, flag: py[i].flag });
    });
  });

  test('dictionary words in every script agree: alone, in a sentence, glued to CJK text', () => {
    const dictDir = path.join(root, 'shared/dictionaries');
    const names = fs.readdirSync(dictDir)
      .filter((f) => f.endsWith('.json') && f !== 'globalWhitelist.json')
      .map((f) => f.slice(0, -5).toLowerCase());
    const forms = [
      (w) => w,
      (w) => `He said "${w}", then left.`,
      (w) => `他说${w}然后走了`,
    ];
    const jobs = [];
    for (const name of names) {
      const file = fs.existsSync(path.join(dictDir, `${name}.json`)) ? name : 'Norwegian';
      const words = JSON.parse(fs.readFileSync(path.join(dictDir, `${file}.json`), 'utf8')).words;
      const config = { languages: [name], replaceWith: '*' };
      for (const w of words) for (const form of forms) jobs.push({ text: form(w), config });
    }
    const py = runPython(jobs);
    const disagreements = [];
    jobs.forEach((job, i) => {
      const f = jsFor(job.config);
      const result = f.checkProfanity(job.text);
      const js = { flag: f.isProfane(job.text), words: [...result.profaneWords].sort(), processed: result.processedText };
      if (js.flag !== py[i].flag || JSON.stringify(js.words) !== JSON.stringify(py[i].words) || js.processed !== py[i].processed) {
        disagreements.push({ text: job.text, lang: job.config.languages[0], js, py: py[i] });
      }
    });
    expect(disagreements.slice(0, 5)).toEqual([]);
    expect(disagreements).toHaveLength(0);
  });
});
