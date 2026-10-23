# Advanced Features

Deep dive into glin-profanity's advanced detection capabilities.

---

## Leetspeak Detection

Detect obfuscated profanity using character substitutions.

### Configuration

```typescript
import { Filter } from 'glin-profanity';

const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'moderate' // 'basic' | 'moderate' | 'aggressive'
});

filter.isProfane('f4ck');    // true
filter.isProfane('sh1t');    // true
filter.isProfane('a$$');     // true
```

### Leetspeak Levels

| Level | Detects | Examples |
|-------|---------|----------|
| `basic` | Common substitutions | `4→a`, `3→e`, `1→i`, `0→o` |
| `moderate` | Extended patterns | `@→a`, `$→s`, `!→i`, `7→t` |
| `aggressive` | Complex obfuscation | `ph→f`, `><→x`, visual lookalikes |

---

## Unicode Normalization

Handle Unicode homoglyphs and lookalike characters.

### Configuration

```typescript
const filter = new Filter({
  normalizeUnicode: true
});

// Detects Cyrillic/Greek lookalikes
filter.isProfane('fսck');  // true (Armenian 'ս')
filter.isProfane('shіt');  // true (Cyrillic 'і')
```

### Normalization Process

```
Input: "fսck" (with Armenian 'ս')
  ↓ Unicode Normalization
Normalized: "fuck"
  ↓ Dictionary Lookup
Result: Profanity detected
```

---

## ML-Powered Toxicity Detection

TensorFlow.js integration for context-aware detection.

### Setup

```bash
npm install @tensorflow/tfjs @tensorflow-models/toxicity
```

### Usage

```typescript
import { loadToxicityModel, checkToxicity } from 'glin-profanity/ml';

// Load model (one-time)
await loadToxicityModel({ threshold: 0.9 });

// Check text
const result = await checkToxicity("You're terrible at this game");

console.log(result);
// {
//   toxic: true,
//   categories: {
//     toxicity: 0.92,
//     insult: 0.85,
//     identity_attack: 0.12,
//     threat: 0.08,
//     obscene: 0.15,
//     sexual_explicit: 0.03
//   }
// }
```

### Hybrid Approach

Combine dictionary + ML for comprehensive detection:

```typescript
import { Filter } from 'glin-profanity';
import { checkToxicity, loadToxicityModel } from 'glin-profanity/ml';

await loadToxicityModel();

async function moderateContent(text: string) {
  const filter = new Filter({ languages: ['english'] });

  // Fast dictionary check first
  const dictResult = filter.checkProfanity(text);

  if (dictResult.containsProfanity) {
    return { flagged: true, source: 'dictionary', ...dictResult };
  }

  // ML check for edge cases
  const mlResult = await checkToxicity(text);

  if (mlResult.toxic) {
    return { flagged: true, source: 'ml', ...mlResult };
  }

  return { flagged: false };
}
```

---

## Result Caching

LRU cache for high-throughput applications.

### Configuration

```typescript
const filter = new Filter({
  cacheResults: true,
  maxCacheSize: 1000  // LRU cache limit
});

// First call: computed
filter.checkProfanity("hello world");  // ~0.5ms

// Subsequent calls: cached
filter.checkProfanity("hello world");  // ~0.01ms
```

### Cache Management

```typescript
// Check cache size
console.log(filter.getCacheSize());  // 1

// Clear cache
filter.clearCache();
console.log(filter.getCacheSize());  // 0
```

---

## Severity Levels

Categorize matches by detection confidence.

### Configuration

```typescript
import { Filter, SeverityLevel } from 'glin-profanity';

const filter = new Filter({
  severityLevels: true,
  minSeverity: SeverityLevel.EXACT  // Only exact matches
});

const result = filter.checkProfanity("This is sh1t");

console.log(result.severityMap);
// { "sh1t": SeverityLevel.FUZZY }
```

### Severity Filtering

| Level | Value | Use Case |
|-------|-------|----------|
| `EXACT` | 1 | Strict moderation, zero tolerance |
| `FUZZY` | 2 | Balanced detection, allows some edge cases |

---

## Custom Word Lists

Extend or restrict the dictionary.

### Adding Custom Words

```typescript
const filter = new Filter({
  customWords: ['brandname', 'competitor', 'secretproject']
});

filter.isProfane('brandname');  // true
```

### Whitelisting Words

```typescript
const filter = new Filter({
  ignoreWords: ['damn', 'hell']  // Allow these words
});

filter.isProfane('damn');  // false
filter.isProfane('hell');  // false
```

### Dynamic Updates

```typescript
// Runtime modifications
filter.addWord('newbadword');
filter.removeWord('allowedword');
```

---

## Multi-Language Detection

Check text across multiple language dictionaries simultaneously.

### Specific Languages

```typescript
const filter = new Filter({
  languages: ['english', 'spanish', 'french']
});
```

### All Languages

```typescript
const filter = new Filter({
  allLanguages: true  // Check all 23 supported languages
});
```

### Performance Considerations

| Config | Speed (uncached `isProfane`, short text, Node 22) |
|--------|-------|
| Single language | ~290,000 ops/sec |
| 3 languages | ~295,000 ops/sec |
| All languages | ~140,000 ops/sec |

Reproduce with `benchmarks/shootout/ops-claim.mjs`.

---

## See Also

- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [ML Guide](./ML-GUIDE.md)
