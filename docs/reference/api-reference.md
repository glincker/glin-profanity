# API Reference

Complete API documentation for glin-profanity.

## Core Functions

| JavaScript | Python | Description |
|------------|--------|-------------|
| `checkProfanity(text, config)` | `check_profanity(text, config)` | Full profanity check with options |
| `isProfane(text)` | `is_profane(text)` | Quick boolean check |
| `checkProfanityAsync(text, config)` | `check_profanity_async(text, config)` | Async version |
| `isWordProfane(word, config)` | `is_word_profane(word, config)` | Check single word |
| `Filter` class | `Filter` class | Low-level filter for advanced use |
| `useProfanityChecker` hook | N/A | React-specific hook |

---

## Configuration Options

### FilterConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `languages` | `string[]` | `['english']` | Languages to check |
| `allLanguages` | `boolean` | `false` | Check all 24 languages |
| `caseSensitive` | `boolean` | `false` | Case-sensitive matching |
| `wordBoundaries` | `boolean` | `true` | Match whole words only |
| `replaceWith` | `string` | `undefined` | Replacement string |
| `severityLevels` | `boolean` | `false` | Enable severity mapping |
| `customWords` | `string[]` | `[]` | Add custom profane words |
| `ignoreWords` | `string[]` | `[]` | Whitelist words |
| `allowObfuscatedMatch` | `boolean` | `false` | Detect `f*ck`, `sh1t` |
| `fuzzyToleranceLevel` | `number` | `0.8` | Fuzzy match threshold (0-1) |
| `minSeverity` | `SeverityLevel` | `FUZZY` | Minimum severity to flag |
| `autoReplace` | `boolean` | `false` | Auto-replace profanity |
| `detectLeetspeak` | `boolean` | `false` | Enable leetspeak detection |
| `leetspeakLevel` | `string` | `'basic'` | `basic`, `moderate`, `aggressive` |
| `normalizeUnicode` | `boolean` | `true` | Normalize Unicode homoglyphs |
| `cacheResults` | `boolean` | `false` | Cache for repeated checks |
| `maxCacheSize` | `number` | `1000` | LRU cache size |

---

## Return Types

### CheckProfanityResult

**JavaScript/TypeScript:**

```typescript
interface ProfanityCheckResult {
  containsProfanity: boolean;
  profaneWords: string[];
  processedText?: string;
  severityMap?: Record<string, SeverityLevel>;
  filteredWords: string[];
  autoReplaced: string;
  matches?: Match[];
  contextScore?: number;
}
```

**Python:**

```python
class CheckProfanityResult(TypedDict):
    contains_profanity: bool
    profane_words: List[str]
    processed_text: Optional[str]
    severity_map: Optional[Dict[str, SeverityLevel]]
    matches: Optional[List[Match]]
    context_score: Optional[float]
    reason: Optional[str]
```

### SeverityLevel

| Level | Value | Description |
|-------|-------|-------------|
| `EXACT` | `1` | Exact dictionary match |
| `FUZZY` | `2` | Fuzzy/obfuscated match |

---

## Filter Class Methods

### Constructor

```typescript
new Filter(config?: FilterConfig)
```

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `isProfane(text)` | `boolean` | Quick profanity check |
| `checkProfanity(text)` | `CheckProfanityResult` | Detailed check |
| `getWordCount()` | `number` | Dictionary word count |
| `getConfig()` | `FilterConfig` | Export current config |
| `getCacheSize()` | `number` | Current cache size |
| `clearCache()` | `void` | Clear result cache |

---

## React Hook

### useProfanityChecker

```typescript
const {
  result,
  checkText,
  checkTextAsync,
  reset,
  isDirty,
  isWordProfane
} = useProfanityChecker(config);
```

| Return | Type | Description |
|--------|------|-------------|
| `result` | `CheckProfanityResult \| null` | Latest result |
| `checkText` | `(text: string) => void` | Check text synchronously |
| `checkTextAsync` | `(text: string) => Promise<void>` | Check text async |
| `reset` | `() => void` | Reset state |
| `isDirty` | `boolean` | Has been checked |
| `isWordProfane` | `(word: string) => boolean` | Check single word |

---

## Supported Languages

24 languages with unified dictionaries:

```
arabic, chinese, czech, danish, dutch, english, esperanto,
finnish, french, german, hindi, hungarian, italian, japanese,
korean, norwegian, persian, polish, portuguese, russian,
spanish, swedish, thai, turkish
```

---

## See Also

- [Getting Started](./getting-started.md)
- [Framework Examples](./framework-examples.md)
- [Advanced Features](./advanced-features.md)
