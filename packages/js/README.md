<p align="center">
  <a href="https://www.glincker.com/tools/glin-profanity" target="_blank">
    <img src="../../og-image.png" alt="Glin Profanity - ML-Powered Profanity Detection" width="800" />
  </a>
</p>

<h1 align="center">GLIN PROFANITY - JavaScript/TypeScript</h1>

<p align="center">
  <strong>ML-Powered Profanity Detection for the Modern Web</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/glin-profanity"><img src="https://img.shields.io/npm/v/glin-profanity" alt="NPM" /></a>
  <a href="https://github.com/GLINCKER/glin-profanity/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" /></a>
  <a href="https://www.npmjs.com/package/glin-profanity"><img src="https://img.shields.io/npm/dw/glin-profanity" alt="Downloads" /></a>
  <a href="https://www.glincker.com/tools/glin-profanity"><img src="https://img.shields.io/badge/Live_Demo-online-blue" alt="Demo" /></a>
</p>

---

## Installation

```bash
npm install glin-profanity
```

## Quick Start

```javascript
import { checkProfanity, Filter } from 'glin-profanity';

// Simple check
const result = checkProfanity("This is f4ck1ng bad", {
  detectLeetspeak: true,
  languages: ['english']
});

result.containsProfanity  // true
result.profaneWords       // ['fucking']

// With replacement
const filter = new Filter({
  replaceWith: '***',
  detectLeetspeak: true
});
filter.checkProfanity("sh1t happens").processedText  // "*** happens"
```

## React Hook

```tsx
import { useProfanityChecker } from 'glin-profanity';

function ChatInput() {
  const { result, checkText } = useProfanityChecker({
    detectLeetspeak: true
  });

  return (
    <>
      <input onChange={(e) => checkText(e.target.value)} />
      {result?.containsProfanity && <span>Clean up your language</span>}
    </>
  );
}
```

## Features

| Feature | Description |
|---------|-------------|
| Leetspeak detection | Catches `f4ck`, `sh1t`, `@ss` |
| Unicode normalization | Handles Cyrillic/Greek lookalikes |
| ML toxicity detection | TensorFlow.js integration |
| 24 languages | Arabic to Turkish |
| Result caching | LRU cache for repeated checks |
| React hook | `useProfanityChecker` built-in |

## API

### Core Functions

```typescript
// Full check with options
checkProfanity(text: string, config?: FilterConfig): ProfanityCheckResult

// Quick boolean check
isProfane(text: string): boolean

// Async version
checkProfanityAsync(text: string, config?: FilterConfig): Promise<ProfanityCheckResult>
```

### Filter Class

```typescript
const filter = new Filter({
  languages: ['english', 'spanish'],
  detectLeetspeak: true,
  leetspeakLevel: 'moderate',     // basic | moderate | aggressive
  normalizeUnicode: true,
  cacheResults: true,
  maxCacheSize: 1000,
  replaceWith: '***'
});

filter.isProfane('f4ck');                    // true
filter.checkProfanity('bad word').profaneWords;  // ['bad']
filter.clearCache();
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `languages` | `string[]` | `['english']` | Languages to check |
| `allLanguages` | `boolean` | `false` | Check all 24 languages |
| `detectLeetspeak` | `boolean` | `false` | Enable leetspeak detection |
| `leetspeakLevel` | `string` | `'basic'` | `basic` / `moderate` / `aggressive` |
| `normalizeUnicode` | `boolean` | `true` | Normalize Unicode homoglyphs |
| `cacheResults` | `boolean` | `false` | Cache results for repeated checks |
| `maxCacheSize` | `number` | `1000` | LRU cache limit |
| `replaceWith` | `string` | `undefined` | Replacement string |
| `customWords` | `string[]` | `[]` | Add custom profane words |
| `ignoreWords` | `string[]` | `[]` | Whitelist words |
| `severityLevels` | `boolean` | `false` | Enable severity mapping |

## Documentation

| Resource | Link |
|----------|------|
| Getting Started | [docs/getting-started.md](../../docs/getting-started.md) |
| API Reference | [docs/api-reference.md](../../docs/api-reference.md) |
| Framework Examples | [docs/framework-examples.md](../../docs/framework-examples.md) |
| Advanced Features | [docs/advanced-features.md](../../docs/advanced-features.md) |
| ML Guide | [docs/ML-GUIDE.md](../../docs/ML-GUIDE.md) |
| Main README | [README.md](../../README.md) |

## Community

Join the [GLINR Discord](https://discord.gg/Ar5pcaZB99) and drop by the `#glin-profanity` forum for questions and discussion.

<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="Join the GLINR Discord" /></a>

## License

MIT License - see [LICENSE](../../LICENSE)

---

<div align="center">
<sub>Built by <a href="https://glincker.com">GLINCKER</a></sub>
</div>
