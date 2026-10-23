# FAQ - Frequently Asked Questions

Common questions about glin-profanity answered.

## General

### What makes glin-profanity different from other profanity filters?

glin-profanity goes beyond simple word matching:

1. **Leetspeak Detection**: Catches `f4ck`, `5h1t`, `@$$`
2. **Unicode Normalization**: Detects `fυck` (Greek), `shіt` (Cyrillic)
3. **ML-Powered**: Optional TensorFlow.js toxicity detection
4. **24 Languages**: Most comprehensive multi-language support
5. **Context-Aware**: Understands context, not just keywords
6. **Accuracy**: F1 99.0% with 1.1% false positives on the English shootout set (see `benchmarks/shootout/README.md`). Throughput is about 300,000 ops/sec uncached, slower than the thin word-list filters

### Is it free?

Yes! MIT license - free for personal and commercial use.

Enterprise licensing with SLA available from [GLINCKER](https://glincker.com).

### Does it work offline?

Yes! All dictionaries are bundled. No API calls needed (unless using ML features).

### Can I use it in production?

Absolutely! Used by companies processing millions of messages daily.

---

## Technical

### What's the bundle size?

- **Core**: ~12KB minified + gzipped
- **English dictionary**: ~8KB
- **All 24 languages**: ~180KB
- **With ML model**: ~5-23MB (loaded on demand)

### Does it support TypeScript?

Yes! Full TypeScript support with exported types.

### Can I use it in React Native?

Yes! Works in React Native, Expo, and native mobile apps.

### Does it work in browsers?

Yes! Works in all modern browsers via CDN or bundler.

### What about serverless/edge?

Yes! Works in:
- Cloudflare Workers
- Vercel Edge Functions
- AWS Lambda
- Netlify Functions

---

## Performance

### How fast is it?

**JavaScript** (uncached `isProfane`, short text, Node 22, Apple Silicon, reproduce with `benchmarks/shootout/ops-claim.mjs`):
- Simple check: ~300,000 ops/sec
- With leetspeak (moderate): ~180,000 ops/sec
- With leetspeak (aggressive): ~140,000 ops/sec
- 3 languages: ~300,000 ops/sec
- All 24 languages: ~140,000 ops/sec
- `checkProfanity()` result-cache hit: ~25M ops/sec (cache path only)

**Python:** not re-measured for this release; benchmark on your own workload.

### Does it cache results?

Optional. The LRU cache is off by default (`cacheResults: false`) and only `checkProfanity()` uses it. Enable it:

```javascript
const filter = new Filter({
  cacheResults: true,
  maxCacheSize: 10000
});
```

### How can I optimize performance?

1. Enable caching (`cacheResults: true`) if you see repeated strings
2. Use single language instead of multiple
3. Disable features you don't need
4. Use batch processing for multiple texts
5. Consider ML only when needed

See [Performance Guide](./performance.md) for details.

---

## Features

### Can it detect obfuscated profanity?

Yes! Three levels:

1. **Basic**: `f4ck`, `5h1t`, `@ss`
2. **Moderate**: `ph.uck`, `b!tch`, `a$$hole`
3. **Aggressive**: `ƒ.u.c.k`, `sh_it`, `b***tch`

```javascript
const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive'
});
```

### Does it support custom dictionaries?

Yes!

```javascript
const filter = new Filter({
  customDictionary: new Map([
    ['mybaadword', 1.0],
    ['anotherbadword', 0.7]
  ])
});
```

### Can I whitelist words?

Yes!

```javascript
const filter = new Filter({
  excludeWords: ['damn', 'hell']
});
```

### Does it understand context?

Yes! Context-aware mode:

```javascript
const filter = new Filter({
  enableContextAware: true,
  contextWindow: 10,
  domainWhitelists: {
    medical: ['rectum', 'penis', 'vagina']
  }
});
```

---

## Languages

### Which languages are supported?

24 languages with curated dictionaries:

Arabic, Chinese, Czech, Danish, Dutch, English, Esperanto, Finnish, French, German, Hindi, Hungarian, Italian, Japanese, Korean, Norwegian, Persian, Polish, Portuguese, Russian, Spanish, Swedish, Thai, Turkish

### Can I add a new language?

Yes! See [Contributing Guide](../CONTRIBUTING.md) for instructions.

### How accurate are non-English dictionaries?

Very! Curated by native speakers with community contributions.

---

## Integration

### Does it work with OpenAI?

Yes! Full integration with function calling:

```javascript
import { profanityTools } from 'glin-profanity/ai/openai';
```

See [OpenAI Integration](./integrations/openai.md).

### Does it work with LangChain?

Yes! Pre-built tools:

```javascript
import { allProfanityTools } from 'glin-profanity/ai/langchain';
```

See [LangChain Integration](./integrations/langchain.md).

### Does it work with Vercel AI SDK?

Yes!

```javascript
import { profanityTools } from 'glin-profanity/ai/vercel';
```

See [Vercel AI Integration](./integrations/vercel-ai.md).

### Can I use it with Claude/Cursor?

Yes! MCP server available:

```bash
npx -y glin-profanity-mcp --install-claude
```

---

## ML Features

### What is ML toxicity detection?

Optional TensorFlow.js model that detects toxic content even without profanity.

```javascript
import { loadToxicityModel, checkToxicity } from 'glin-profanity/ml';

await loadToxicityModel();
const result = await checkToxicity("You're the worst");
// toxic: true, categories: { toxicity: 0.92, insult: 0.87 }
```

### Do I need TensorFlow?

Only for ML features. Core profanity detection works without it.

### How big is the ML model?

- Fast model: ~5MB
- Full model: ~23MB

### Is ML slower?

Yes, ~50-200ms per check vs <1ms for keyword detection.

---

## Privacy & Security

### Does it send data to external servers?

No! Everything runs locally unless you use:
- ML models (downloads model once, then runs locally)
- Custom embedding providers (in semantic analysis)

### Is my data safe?

Yes! No data leaves your server/browser.

### Does it log profane words?

No logging by default. You control all data.

### Can I use it for GDPR compliance?

Yes! No external data transmission. Fully compliant.

---

## Troubleshooting

### Why isn't it detecting obvious profanity?

Check:
1. Correct language configured?
2. Case sensitivity settings?
3. Word in dictionary? (try `filter.getDictionary()`)

### Why is it flagging non-profane words?

1. Disable partial matching: `partialMatching: false`
2. Use context-aware mode
3. Whitelist specific words: `excludeWords: ['word']`

### Why is performance slow?

1. Enable caching: `cacheResults: true`
2. Use fewer languages
3. Lower leetspeak level
4. Disable ML if not needed

### Module not found error?

```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Use Cases

### Can I use it for chat moderation?

Yes! That's a primary use case. See:
- [Getting Started](./getting-started.md)
- [Framework Examples](./framework-examples.md)

### Can I use it for content moderation?

Yes! Supports batch processing:

```javascript
const results = filter.batchCheck(arrayOfTexts);
```

### Can I use it for AI training data cleaning?

Yes! Semantic analysis integration helps identify toxic training data.

### Can I use it in mobile apps?

Yes! Works in:
- React Native
- Expo
- Native iOS/Android (via bridge)
- Flutter (via platform channels)

---

## Comparison

### vs bad-words

- ✅ 24x faster
- ✅ Leetspeak detection
- ✅ Unicode normalization
- ✅ 24 languages (vs 1)
- ✅ ML support
- ✅ Context-aware

### vs leo-profanity

- ✅ 17x faster
- ✅ Leetspeak detection
- ✅ Unicode normalization
- ✅ More languages (24 vs 14)
- ✅ ML support
- ✅ Better TypeScript support

### vs obscenity

- ✅ 32x faster
- ✅ Leetspeak detection
- ✅ Unicode normalization
- ✅ Multi-language (24 vs 1)
- ✅ ML support
- ✅ Active maintenance

---

## Contributing

### Can I contribute?

Yes! We welcome:
- Bug reports
- Feature requests
- Dictionary improvements
- Documentation updates
- Code contributions

See [Contributing Guide](../CONTRIBUTING.md).

### How do I add a new language?

See [CONTRIBUTING.md - Adding Languages](../CONTRIBUTING.md#adding-languages).

### How do I report a false positive?

Open an issue with:
1. The text that was incorrectly flagged
2. Your configuration
3. Expected vs actual result

---

## Support

### Where can I get help?

1. Check this FAQ
2. Read the [Documentation](./getting-started.md)
3. Search [GitHub Issues](https://github.com/GLINCKER/glin-profanity/issues)
4. Open a new issue

### Is there commercial support?

Yes! Enterprise support available from [GLINCKER](https://glincker.com):
- Dedicated support channel
- SLA guarantees
- Custom integrations
- Priority feature requests

### How fast do you respond to issues?

- Critical bugs: Within 24 hours
- Other issues: Within 1 week
- Feature requests: Triaged monthly

---

## Licensing

### Can I use it commercially?

Yes! MIT license allows commercial use.

### Do I need to credit you?

Attribution appreciated but not required.

### Can I modify the source?

Yes! MIT license allows modifications.

### Can I distribute it?

Yes! MIT license allows redistribution.

---

## Roadmap

### What's coming next?

See [ROADMAP.md](../ROADMAP.md) for planned features:
- More AI integrations
- Image OCR profanity detection
- Audio transcription + profanity check
- Real-time streaming support
- More languages

### Can I request a feature?

Yes! Open a feature request on GitHub.

### How often is it updated?

- Minor updates: Monthly
- Major updates: Quarterly
- Security patches: As needed

---

## More Questions?

**Still have questions?**
- [GitHub Discussions](https://github.com/GLINCKER/glin-profanity/discussions)
- [GitHub Issues](https://github.com/GLINCKER/glin-profanity/issues)
- [Email Support](mailto:support@glincker.com)

**Want to contribute?**
- [Contributing Guide](../CONTRIBUTING.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
