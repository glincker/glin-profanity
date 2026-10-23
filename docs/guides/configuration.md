# Configuration Guide

Complete reference for all configuration options in glin-profanity.

## Table of Contents

- [FilterConfig](#filterconfig)
- [Language Options](#language-options)
- [Detection Options](#detection-options)
- [Performance Options](#performance-options)
- [ML Options](#ml-options)
- [Context-Aware Options](#context-aware-options)
- [Presets](#presets)
- [Environment Variables](#environment-variables)

---

## FilterConfig

Complete TypeScript interface:

```typescript
interface FilterConfig {
  // Language Configuration
  languages?: Language[];                    // Default: ['english']
  
  // Detection Options
  detectLeetspeak?: boolean;                 // Default: true
  leetspeakLevel?: 'basic' | 'moderate' | 'aggressive';  // Default: 'moderate'
  normalizeUnicode?: boolean;                // Default: true
  caseSensitive?: boolean;                   // Default: false
  
  // Replacement Options
  replaceWith?: string;                      // Default: '*'
  preserveLength?: boolean;                  // Default: true
  partialMatching?: boolean;                 // Default: true
  
  // Context-Aware Options
  enableContextAware?: boolean;              // Default: false
  contextWindow?: number;                    // Default: 3
  confidenceThreshold?: number;              // Default: 0.7
  domainWhitelists?: Record<string, string[]>;  // Default: {}
  
  // Performance Options
  cacheResults?: boolean;                    // Default: true
  cacheSize?: number;                        // Default: 1000
  batchSize?: number;                        // Default: 100
  
  // Advanced Options
  severityLevels?: boolean;                  // Default: false
  includeExplanations?: boolean;             // Default: false
  strictMode?: boolean;                      // Default: false
  customDictionary?: Map<string, number>;    // Default: undefined
  excludeWords?: string[];                   // Default: []
}
```

---

## Language Options

### Supported Languages

Configure which languages to check against:

```javascript
const filter = new Filter({
  languages: ['english', 'spanish', 'french']
});
```

**Available Languages** (24 total):

| Code | Language | Dictionary Size |
|------|----------|----------------|
| `arabic` | Arabic (العربية) | ~800 words |
| `chinese` | Chinese (中文) | ~1200 words |
| `czech` | Czech (Čeština) | ~600 words |
| `danish` | Danish (Dansk) | ~500 words |
| `dutch` | Dutch (Nederlands) | ~700 words |
| `english` | English | ~1500 words |
| `esperanto` | Esperanto | ~400 words |
| `finnish` | Finnish (Suomi) | ~550 words |
| `french` | French (Français) | ~900 words |
| `german` | German (Deutsch) | ~800 words |
| `hindi` | Hindi (हिन्दी) | ~700 words |
| `hungarian` | Hungarian (Magyar) | ~600 words |
| `italian` | Italian (Italiano) | ~850 words |
| `japanese` | Japanese (日本語) | ~900 words |
| `korean` | Korean (한국어) | ~750 words |
| `norwegian` | Norwegian (Norsk) | ~500 words |
| `persian` | Persian (فارسی) | ~650 words |
| `polish` | Polish (Polski) | ~700 words |
| `portuguese` | Portuguese (Português) | ~800 words |
| `russian` | Russian (Русский) | ~950 words |
| `spanish` | Spanish (Español) | ~900 words |
| `swedish` | Swedish (Svenska) | ~550 words |
| `thai` | Thai (ไทย) | ~600 words |
| `turkish` | Turkish (Türkçe) | ~650 words |

### Single Language (Fastest)

```javascript
const filter = new Filter({ languages: ['english'] });
```

### Multiple Languages

```javascript
const filter = new Filter({
  languages: ['english', 'spanish', 'french']
});
```

### All Languages (Slower)

```javascript
import { SUPPORTED_LANGUAGES } from 'glin-profanity';

const filter = new Filter({
  languages: SUPPORTED_LANGUAGES  // All 24 languages
});
```

---

## Detection Options

### Leetspeak Detection

Detect obfuscated profanity like `f4ck`, `5h1t`, `@$$`.

```javascript
const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive'  // basic | moderate | aggressive
});

filter.isProfane('f4ck');    // true
filter.isProfane('5h1t');    // true
filter.isProfane('@$$');     // true (aggressive mode)
```

**Leetspeak Levels:**

| Level | Examples | Performance | False Positives |
|-------|----------|-------------|-----------------|
| `basic` | `f4ck`, `5h1t`, `@ss` | Fast | Low |
| `moderate` | + `ph.uck`, `b!tch` | Medium | Medium |
| `aggressive` | + `ƒ.u.c.k`, `sh_it` | Slower | Higher |

### Unicode Normalization

Detect homoglyphs like `fυck` (Greek), `shіt` (Cyrillic).

```javascript
const filter = new Filter({
  normalizeUnicode: true
});

filter.isProfane('fυck');   // true (Greek 'υ' → 'u')
filter.isProfane('shіt');   // true (Cyrillic 'і' → 'i')
filter.isProfane('ƒuck');   // true (Latin 'ƒ' → 'f')
```

**Supported Homoglyphs:**
- Latin Extended (ƒ, ſ, ʃ)
- Cyrillic (а, е, і, о, р, с, у, х)
- Greek (α, ε, ο, ρ)
- Armenian lookalikes are only partly covered (for example 'ս' is not mapped yet)
- And 200+ more

### Case Sensitivity

```javascript
// Case-insensitive (default)
const filter = new Filter({ caseSensitive: false });
filter.isProfane('FUCK');  // true
filter.isProfane('Fuck');  // true
filter.isProfane('fuck');  // true

// Case-sensitive
const strictFilter = new Filter({ caseSensitive: true });
strictFilter.isProfane('FUCK');  // true
strictFilter.isProfane('Fuck');  // false (not in dictionary)
strictFilter.isProfane('fuck');  // true
```

### Partial Matching

```javascript
// Partial matching enabled (default)
const filter = new Filter({ partialMatching: true });
filter.isProfane('unfuckingbelievable');  // true

// Exact matching only
const exactFilter = new Filter({ partialMatching: false });
exactFilter.isProfane('unfuckingbelievable');  // false
exactFilter.isProfane('fuck');                 // true
```

---

## Context-Aware Options

Enable intelligent detection that considers surrounding words.

### Basic Context Awareness

```javascript
const filter = new Filter({
  enableContextAware: true,
  contextWindow: 5,           // Look at 5 words before/after
  confidenceThreshold: 0.7    // 70% confidence required
});

const result = filter.checkProfanity('The damn door is stuck');
// contextScore: 0.4 (low toxicity in context)
// May not flag if threshold is 0.7
```

### Domain Whitelists

Allow certain words in specific contexts:

```javascript
const filter = new Filter({
  enableContextAware: true,
  domainWhitelists: {
    medical: ['rectum', 'penis', 'vagina', 'breast'],
    technical: ['cock' /* valve */, 'screw'],
    gaming: ['kill', 'destroy', 'murder']
  }
});

// With medical context
filter.checkProfanity('The rectum is part of the digestive system', {
  domain: 'medical'
});
// containsProfanity: false (whitelisted in medical context)

// Without context
filter.checkProfanity('The rectum is part of the digestive system');
// containsProfanity: true (not whitelisted)
```

### Context Window Size

```javascript
const filter = new Filter({
  enableContextAware: true,
  contextWindow: 10  // Larger window = more context, slower
});
```

**Recommended Values:**
- `contextWindow: 3` - Fast, basic local context
- `contextWindow: 5` - Balanced (recommended)
- `contextWindow: 10` - Comprehensive, most accurate
- `contextWindow: 20` - Slow, full sentence context

---

## Performance Options

### Result Caching

```javascript
const filter = new Filter({
  cacheResults: true,
  cacheSize: 5000  // LRU cache size
});

// First call: ~0.5ms
filter.isProfane('This is a test message');

// Subsequent calls: ~0.01ms (from cache)
filter.isProfane('This is a test message');
```

**Cache Size Guidelines:**
- `1000` - Small apps (< 10K users)
- `5000` - Medium apps (10K-100K users)
- `10000` - Large apps (100K+ users)
- `50000` - Very large apps (1M+ users)

### Batch Processing

```javascript
const filter = new Filter({
  batchSize: 200  // Process 200 texts at a time
});

const texts = [...];  // 1000 texts
const results = filter.batchCheck(texts);
// Automatically processes in batches of 200
```

---

## Replacement Options

### Custom Replacement Character

```javascript
const filter = new Filter({
  replaceWith: '***'
});

filter.censorText('shit happens');
// Result: '*** happens'
```

### Preserve Length

```javascript
// Preserve length (default)
const filter1 = new Filter({
  replaceWith: '*',
  preserveLength: true
});
filter1.censorText('fuck');  // '****'

// Don't preserve length
const filter2 = new Filter({
  replaceWith: '***',
  preserveLength: false
});
filter2.censorText('fuck');  // '***'
```

---

## ML Options

### Toxicity Detection

```javascript
import { Filter } from 'glin-profanity';
import { loadToxicityModel } from 'glin-profanity/ml';

// Load ML model
await loadToxicityModel({
  threshold: 0.9,  // 90% confidence required
  model: 'toxicity'  // or 'toxicity-fast'
});

// Create filter with ML enabled
const filter = new Filter({
  enableML: true,
  mlThreshold: 0.9
});

const result = await filter.checkProfanityML('You are the worst person ever');
// toxic: true
// categories: { toxicity: 0.95, insult: 0.89, ... }
```

**Available Models:**
- `toxicity` - Full model (23MB, most accurate)
- `toxicity-fast` - Fast model (5MB, good accuracy)

---

## Custom Dictionaries

### Add Custom Words

```javascript
const filter = new Filter({
  customDictionary: new Map([
    ['badword1', 1.0],  // severity 1.0 (highest)
    ['badword2', 0.5],  // severity 0.5 (medium)
    ['badword3', 0.2],  // severity 0.2 (low)
  ])
});

filter.isProfane('badword1');  // true
```

### Exclude Words (Whitelist)

```javascript
const filter = new Filter({
  excludeWords: ['damn', 'hell', 'crap']  // Allow these words
});

filter.isProfane('damn it');  // false (excluded)
filter.isProfane('fuck');     // true (not excluded)
```

---

## Presets

Pre-configured settings for common use cases:

### Strict (Family-Friendly)

```javascript
import { PRESETS } from 'glin-profanity';

const filter = new Filter(PRESETS.STRICT);
// Equivalent to:
// {
//   languages: ['english'],
//   detectLeetspeak: true,
//   leetspeakLevel: 'aggressive',
//   normalizeUnicode: true,
//   partialMatching: true,
//   strictMode: true,
//   severityLevels: true,
//   contextWindow: 10
// }
```

### Moderate (Recommended)

```javascript
const filter = new Filter(PRESETS.MODERATE);
// Balanced settings for most applications
```

### Lenient (Casual)

```javascript
const filter = new Filter(PRESETS.LENIENT);
// Only catches obvious profanity
```

### Custom Preset

```javascript
import { createPreset } from 'glin-profanity';

const myPreset = createPreset({
  base: PRESETS.MODERATE,
  overrides: {
    languages: ['english', 'spanish'],
    excludeWords: ['damn', 'hell']
  }
});

const filter = new Filter(myPreset);
```

---

## Environment Variables

Configure via environment variables:

```bash
# .env
GLIN_PROFANITY_LANGUAGES=english,spanish,french
GLIN_PROFANITY_LEETSPEAK=true
GLIN_PROFANITY_LEETSPEAK_LEVEL=aggressive
GLIN_PROFANITY_UNICODE=true
GLIN_PROFANITY_CACHE=true
GLIN_PROFANITY_CACHE_SIZE=5000
```

**Usage:**
```javascript
import { Filter } from 'glin-profanity';

// Auto-loads from environment variables
const filter = new Filter();
```

---

## Configuration Examples

### Real-Time Chat Application

```javascript
const filter = new Filter({
  languages: ['english'],
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',
  normalizeUnicode: true,
  cacheResults: true,
  cacheSize: 10000,
  severityLevels: true
});
```

### Content Moderation Platform

```javascript
const filter = new Filter({
  languages: SUPPORTED_LANGUAGES,  // All languages
  detectLeetspeak: true,
  enable ContextAware: true,
  contextWindow: 10,
  severityLevels: true,
  includeExplanations: true,
  cacheResults: true,
  cacheSize: 50000
});
```

### Educational Platform (Strict)

```javascript
const filter = new Filter({
  languages: ['english'],
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',
  normalizeUnicode: true,
  partialMatching: true,
  strictMode: true,
  excludeWords: [],  // No exceptions
  severityLevels: true
});
```

### Gaming Platform (Moderate)

```javascript
const filter = new Filter({
  languages: ['english', 'spanish', 'portuguese'],
  detectLeetspeak: true,
  leetspeakLevel: 'moderate',
  excludeWords: ['kill', 'destroy', 'murder'],  // Game terms
  domainWhitelists: {
    gaming: ['kill', 'destroy', 'murder', 'dead', 'die']
  },
  enableContextAware: true,
  contextWindow: 5
});
```

### Medical/Technical Content

```javascript
const filter = new Filter({
  languages: ['english'],
  detectLeetspeak: false,  // Technical terms might trigger
  enableContextAware: true,
  contextWindow: 10,
  domainWhitelists: {
    medical: ['rectum', 'penis', 'vagina', 'breast', 'anal'],
    technical: ['cock', 'screw', 'ballcock']
  },
  confidenceThreshold: 0.9  // High confidence required
});
```

---

## Next Steps

- [Getting Started](./getting-started.md) - Basic usage
- [API Reference](./api-reference.md) - Full API documentation
- [Advanced Features](./advanced-features.md) - ML, context-aware detection
- [Performance Guide](./performance.md) - Optimization tips

---

**Questions?** Check our [FAQ](./faq.md) or open an issue on [GitHub](https://github.com/GLINCKER/glin-profanity/issues).
