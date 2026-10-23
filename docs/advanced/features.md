# Features Overview

Complete overview of all features in glin-profanity and how to use them.

## Table of Contents

- [Core Features](#core-features)
- [Detection Capabilities](#detection-capabilities)
- [Language Support](#language-support)
- [AI & ML Features](#ai--ml-features)
- [Performance Features](#performance-features)
- [Integration Features](#integration-features)
- [Developer Features](#developer-features)
- [Enterprise Features](#enterprise-features)

---

## Core Features

### 1. Basic Profanity Detection

Fast, accurate profanity detection in text.

```typescript
import { checkProfanity } from 'glin-profanity';

const result = checkProfanity('This is a bad word');
// {
//   containsProfanity: boolean,
//   profaneWords: string[],
//   wordCount: number
// }
```

**Performance:** ~300,000 ops/sec uncached on short text (Node 22)  
**Languages:** 24 supported  
**Accuracy:** F1 99.0% on the shootout torture set (893 English cases, authored alongside the engine, so treat as optimistic); see [benchmarks](../../benchmarks/shootout/README.md)  

### 2. Text Censorship

Replace profane words with censorship characters.

```typescript
import { Filter } from 'glin-profanity';

const filter = new Filter({ replaceWith: '***' });
const result = filter.censorText('This shit is bad');
// {
//   originalText: 'This shit is bad',
//   processedText: 'This *** is bad',
//   containsProfanity: true,
//   censoredWords: ['shit']
// }
```

**Options:**
- Custom replacement character
- Preserve length
- Partial word censorship

### 3. Boolean Checks

Quick true/false profanity checks.

```typescript
const filter = new Filter();

if (filter.isProfane('damn it')) {
  console.log('Contains profanity!');
}
```

**Use Case:** FastAPI endpoints, middleware  

### 4. Batch Processing

Check multiple texts efficiently.

```typescript
const filter = new Filter();

const texts = ['text1', 'text2', 'text3'];
const results = filter.batchCheck(texts);
// Array of CheckProfanityResult objects
```

**Performance:** Parallelized processing  
**Use Case:** Comment moderation, bulk content review  

---

## Detection Capabilities

### 1. Leetspeak Detection ⭐

Detect obfuscated profanity with character substitutions.

**Capabilities:**
- Number substitutions: `f4ck`, `5h1t`, `@ss`
- Symbol substitutions: `f*ck`, `sh!t`, `a$$`
- Character spacing: `f u c k`
- Repeated characters: `fuuuuck`
- Complex patterns: `ƒ.u.c.k`

**Three Levels:**

```typescript
const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'basic'  // basic | moderate | aggressive
});

// Basic (fast)
filter.isProfane('f4ck');      // true
filter.isProfane('5h1t');      // true

// Moderate (balanced)
filter.leetspeakLevel = 'moderate';
filter.isProfane('f*ck');      // true
filter.isProfane('@ss');       // true

// Aggressive (comprehensive)
filter.leetspeakLevel = 'aggressive';
filter.isProfane('f.u.c.k');   // true
filter.isProfane('fuuuuуck');  // true
```

**Performance:**
- Moderate: ~180,000 ops/sec
- Aggressive: ~140,000 ops/sec
- (uncached `isProfane`, short text, Node 22)

### 2. Unicode Normalization ⭐

Detect homoglyphs and Unicode lookalikes.

```typescript
const filter = new Filter({ normalizeUnicode: true });

// Cyrillic characters
filter.isProfane('shіt');    // true (Cyrillic 'і' → 'i')

// Greek characters
filter.isProfane('fυck');    // true (Greek 'υ' → 'u')

// Latin variants
filter.isProfane('ƒuck');    // true (Latin 'ƒ' → 'f')

// Full-width characters
filter.isProfane('ｆｕｃｋ');  // true

// Zero-width characters
filter.isProfane('fu​ck');   // true (zero-width space)
```

**Detects:**
- 2,000+ homoglyph variations
- Cyrillic and Greek lookalikes (some Armenian lookalikes, such as 'ս' for 'u', are not mapped yet)
- Full-width characters
- Zero-width characters
- RTL (right-to-left) text

**Performance:** ~300,000 ops/sec uncached on short text (Node 22)

### 3. Partial Word Matching

Detect profanity in compound words.

```typescript
const filter = new Filter({ partialMatching: true });

filter.isProfane('unfuckingbelievable');  // true
filter.isProfane('abso-fucking-lutely');  // true

// Configurable
filter.wordBoundaries = true;  // Only match whole words
filter.isProfane('assassin');  // false (not profanity)
```

**Anti-Scunthorpe Protection:**
- Smart algorithm avoids false positives
- Whitelisted common words
- Context-aware matching

### 4. Case Insensitivity

Case-insensitive matching by default.

```typescript
const filter = new Filter({ caseSensitive: false });

filter.isProfane('FUCK');     // true
filter.isProfane('ShIt');     // true
filter.isProfane('DaMn');     // true

// Or case-sensitive
filter.caseSensitive = true;
filter.isProfane('FUCK');     // false (if dictionary has lowercase)
```

### 5. Severity Levels

Assign severity scores to profane words.

```typescript
const filter = new Filter({ severityLevels: true });

const result = filter.checkProfanity('damn this shit');
// result.severityMap = {
//   'damn': 0.3,  // Mild
//   'shit': 0.7   // Moderate
// }

const maxSeverity = Math.max(...Object.values(result.severityMap));
if (maxSeverity >= 0.8) {
  console.log('Severe profanity detected');
}
```

**Severity Scale:**
- 0.0 - 0.3: Mild (damn, hell)
- 0.4 - 0.7: Moderate (shit, ass)
- 0.8 - 1.0: Severe (fuck, cock)

### 6. Context-Aware Detection

Consider surrounding context to reduce false positives.

```typescript
const filter = new Filter({
  contextAware: true,
  excludeWords: ['breast', 'cock']  // Medical/culinary context
});

// Medical context
filter.isProfane('breast cancer screening');   // false
filter.isProfane('cock the gun');              // false

// But still catches profanity
filter.isProfane('nice breasts');              // true (sexual context)
filter.isProfane('you cock');                  // true (insult)
```

**Domain-Specific Whitelists:**
- Medical: breast, anal, rectal, penis, vaginal
- Gaming: kill, shot, headshot, noob
- Technical: master, slave, abort, execute
- Culinary: breast, thigh, balls, cock

---

## Language Support

### Supported Languages (24)

| Region | Languages |
|--------|-----------|
| **European** | English, French, German, Spanish, Italian, Dutch, Portuguese, Polish, Czech, Danish, Finnish, Hungarian, Norwegian, Swedish, Esperanto |
| **Asian** | Chinese, Japanese, Korean, Thai, Hindi |
| **Middle Eastern** | Arabic, Persian, Turkish |
| **Slavic** | Russian |

### Multi-Language Detection

```typescript
const filter = new Filter({
  languages: ['english', 'spanish', 'french']
});

filter.isProfane('merde');     // true (French)
filter.isProfane('mierda');    // true (Spanish)
filter.isProfane('shit');      // true (English)
```

**Features:**
- Simultaneous multi-language checking
- Language auto-detection (coming soon)
- Cross-language leetspeak support
- Unicode normalization for all languages

### Dictionary Sizes

| Language | Words | Size |
|----------|-------|------|
| English | ~450 | ~8 KB |
| Spanish | ~380 | ~7 KB |
| French | ~360 | ~7 KB |
| German | ~340 | ~6 KB |
| ... | ... | ... |

Total (all 24 languages): ~180 KB

---

## AI & ML Features

### 1. ML Toxicity Detection 🤖

TensorFlow.js-powered toxicity detection.

```typescript
import { loadToxicityModel, checkToxicity } from 'glin-profanity/ml';

// Load model once
await loadToxicityModel({ threshold: 0.9 });

// Check toxicity
const result = await checkToxicity("You're the worst player ever");
// {
//   toxic: true,
//   categories: {
//     toxicity: 0.92,
//     severe_toxicity: 0.45,
//     insult: 0.87,
//     threat: 0.12,
//     identity_attack: 0.08,
//     obscene: 0.34,
//     sexual_explicit: 0.05
//   }
// }
```

**Detects:**
- General toxicity
- Severe toxicity
- Insults
- Threats
- Identity-based attacks
- Obscene content
- Sexual content

**Performance:** 50-200ms per check  
**Model Size:** ~450 KB  

### 2. Semantic Analysis 🧠

Embeddings-based toxicity detection (goes beyond keywords).

```typescript
import { 
  createSemanticAnalyzer,
  createFetchEmbeddingProvider 
} from 'glin-profanity/ai/semantic';

const provider = createFetchEmbeddingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});

const analyzer = createSemanticAnalyzer({
  embeddingProvider: provider,
  threshold: 0.7
});

const result = await analyzer.analyze('You should uninstall life');
// {
//   shouldFlag: true,
//   combinedScore: 0.82,
//   keywordScore: 0.0,    // No profanity keywords
//   semanticScore: 0.95    // But semantically toxic
// }
```

**Catches:**
- Toxic content without profanity
- Veiled threats
- Sarcastic insults
- Context-dependent toxicity

**Supported Providers:**
- OpenAI
- Azure OpenAI
- Cohere
- Local Ollama
- Custom embeddings

### 3. Hybrid Detection

Combine keyword + ML + semantic analysis.

```typescript
import { HybridFilter } from 'glin-profanity/ml';

const hybrid = new HybridFilter({
  enableKeyword: true,
  enableML: true,
  enableSemantic: true,
  threshold: 0.7
});

const result = await hybrid.checkProfanity('Text to analyze');
// {
//   containsProfanity: boolean,
//   keywordDetection: {...},
//   mlDetection: {...},
//   semanticDetection: {...},
//   combinedScore: number
// }
```

**Best Accuracy:** 99.8%+ with all methods  
**Best Performance:** Choose methods based on needs  

### 4. AI Framework Integrations

#### OpenAI Function Calling

```typescript
import { profanityTools } from 'glin-profanity/ai/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: profanityTools
});
```

**Tools Provided:**
- check_profanity
- censor_text
- batch_check_profanity
- analyze_context
- get_supported_languages

#### LangChain Tools

```typescript
import { allProfanityTools } from 'glin-profanity/ai/langchain';

const agent = createReactAgent({
  llm: model,
  tools: allProfanityTools
});
```

#### Vercel AI SDK

```typescript
import { profanityTools } from 'glin-profanity/ai/vercel';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: profanityTools
});
```

### 5. MCP Server 🤖

Model Context Protocol server for AI assistants.

**Features:**
- 19 profanity detection tools
- 20 documentation resources
- 5 guided workflow prompts

**Supported AI Assistants:**
- Claude Desktop
- Cursor
- Windsurf
- Custom MCP clients

See [MCP Guide](./mcp-guide.md) for details.

---

## Performance Features

### 1. Result Caching ⚡

LRU cache for repeated checks (about 80x faster on a hit for short clean text).

```typescript
const filter = new Filter({
  cacheResults: true,
  cacheSize: 5000  // Number of cached results
});

// First check (uncached)
filter.checkProfanity('test');  // ~0.004ms

// Second check (cached)
filter.checkProfanity('test');  // ~0.00004ms
```

**Performance:**
- Cache hit (`checkProfanity` only): ~25,000,000 ops/sec
- Cache miss (`checkProfanity`, clean short text): ~280,000 ops/sec
- Profane or obfuscated text: ~17,000 to 24,000 ops/sec

**Cache Management:**
```typescript
filter.getCacheSize();   // Current cache size
filter.clearCache();     // Clear all cached results
```

### 2. Optimized Dictionaries

Binary search trees for O(log n) lookups.

**Performance:**
- Single language: ~290,000 ops/sec
- 3 languages: ~295,000 ops/sec
- All 24 languages: ~140,000 ops/sec

### 3. Parallel Batch Processing

Process multiple texts in parallel.

```typescript
import pLimit from 'p-limit';

const limit = pLimit(10);  // 10 concurrent processes
const promises = texts.map(text =>
  limit(() => filter.checkProfanity(text))
);

const results = await Promise.all(promises);
```

**Scalability:** Linear scaling up to CPU cores

### 4. Streaming Support

Real-time profanity detection for streams.

```typescript
async function* moderateStream(messages: AsyncIterable<string>) {
  for await (const message of messages) {
    yield filter.checkProfanity(message);
  }
}
```

---

## Integration Features

### 1. React Hook

```typescript
import { useProfanityChecker } from 'glin-profanity';

function ChatInput() {
  const { result, checkText } = useProfanityChecker({
    detectLeetspeak: true
  });

  return (
    <div>
      <input onChange={(e) => checkText(e.target.value)} />
      {result?.containsProfanity && <span>Clean language please!</span>}
    </div>
  );
}
```

### 2. Framework Support

- ✅ React
- ✅ Next.js (App Router & Pages Router)
- ✅ Vue
- ✅ Angular
- ✅ Svelte
- ✅ Express
- ✅ Fastify
- ✅ Hono
- ✅ Flask (Python)
- ✅ Django (Python)

### 3. Serverless Support

Works in all serverless environments:
- ✅ AWS Lambda
- ✅ Google Cloud Functions
- ✅ Azure Functions
- ✅ Vercel Edge Functions
- ✅ Cloudflare Workers
- ✅ Netlify Functions

### 4. TypeScript Support

Full TypeScript definitions included.

```typescript
import { Filter, FilterConfig, CheckProfanityResult } from 'glin-profanity';

const config: FilterConfig = {
  languages: ['english'],
  detectLeetspeak: true
};

const filter = new Filter(config);
const result: CheckProfanityResult = filter.checkProfanity('test');
```

---

## Developer Features

### 1. Custom Dictionaries

Add your own profane words.

```typescript
const customWords = new Map([
  ['badword1', 1.0],  // Severity 1.0 (severe)
  ['badword2', 0.5],  // Severity 0.5 (moderate)
]);

const filter = new Filter({
  customDictionary: customWords
});
```

### 2. Word Exclusions (Whitelist)

Exclude specific words from detection.

```typescript
const filter = new Filter({
  excludeWords: ['damn', 'hell', 'crap']
});

filter.isProfane('damn it');  // false (whitelisted)
filter.isProfane('fuck it');  // true (not whitelisted)
```

### 3. Configuration Export/Import

```typescript
// Export configuration
const config = filter.exportConfig();
fs.writeFileSync('filter-config.json', JSON.stringify(config));

// Import configuration
const loadedConfig = JSON.parse(fs.readFileSync('filter-config.json'));
const newFilter = new Filter(loadedConfig);
```

### 4. Debugging & Logging

```typescript
const filter = new Filter({
  debug: true,  // Enable debug logs
  logLevel: 'verbose'
});

// Get detailed match information
const result = filter.checkProfanity('test', { 
  includeMatches: true 
});

console.log(result.matches);
// [
//   { word: 'fuck', index: 5, severity: 1.0, method: 'leetspeak' }
// ]
```

### 5. Extensibility

```typescript
// Custom normalizer
filter.addNormalizer((text) => {
  return text.replace(/customPattern/g, 'replacement');
});

// Custom detector
filter.addDetector({
  name: 'custom',
  detect: (text) => {
    // Your custom detection logic
    return { matches: [...], confidence: 0.9 };
  }
});
```

---

## Enterprise Features

### 1. User Profiling

Track user moderation history and risk scores.

```typescript
import { createUserProfileManager } from 'glin-profanity/enterprise';

const manager = createUserProfileManager();

// Log violation
await manager.logViolation('user123', {
  content: 'profane text',
  severity: 0.9,
  timestamp: Date.now()
});

// Get user profile
const profile = await manager.getProfile('user123');
// {
//   userId: 'user123',
//   violations: 5,
//   riskScore: 68,  // 0-100
//   lastViolation: Date,
//   status: 'warning'  // normal | warning | restricted | banned
// }
```

### 2. Audit Logging

Complete audit trail for compliance.

```typescript
import { AuditLogger } from 'glin-profanity/enterprise';

const logger = new AuditLogger({
  storage: 'database',  // database | file | cloud
  retention: 90  // days
});

await logger.log({
  userId: 'user123',
  action: 'check_profanity',
  result: 'flagged',
  content: hashContent(text),  // Anonymized
  timestamp: Date.now()
});
```

### 3. Analytics & Reporting

```typescript
import { createAnalytics } from 'glin-profanity/enterprise';

const analytics = createAnalytics();

// Get moderation statistics
const stats = await analytics.getStats({
  period: 'last_30_days'
});

// {
//   totalChecks: 1500000,
//   flaggedContent: 45000,
//   flagRate: 0.03,
//   topViolators: [...],
//   commonWords: [...]
// }
```

### 4. GDPR Compliance

```typescript
import { GDPRCompliance } from 'glin-profanity/enterprise';

const gdpr = new GDPRCompliance();

// Anonymize user data
await gdpr.anonymizeUser('user123');

// Delete user data (right to be forgotten)
await gdpr.deleteUserData('user123');

// Export user data
const userData = await gdpr.exportUserData('user123');
```

### 5. Rate Limiting

```typescript
import { createRateLimiter } from 'glin-profanity/enterprise';

const limiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60000  // 1 minute
});

await limiter.check('user123');  // Throws if exceeded
```

---

## Feature Matrix

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Basic profanity detection | ✅ | ✅ | ✅ |
| Leetspeak detection | ✅ | ✅ | ✅ |
| Unicode normalization | ✅ | ✅ | ✅ |
| 24 languages | ✅ | ✅ | ✅ |
| ML toxicity detection | ✅ | ✅ | ✅ |
| Result caching | ✅ | ✅ | ✅ |
| AI integrations | ✅ | ✅ | ✅ |
| MCP server | ✅ | ✅ | ✅ |
| Semantic analysis | ⚠️ Limited | ✅ | ✅ |
| User profiling | ❌ | ⚠️ Basic | ✅ |
| Audit logging | ❌ | ⚠️ Basic | ✅ |
| Analytics & reporting | ❌ | ⚠️ Basic | ✅ |
| GDPR compliance tools | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅✅ |
| SLA guarantees | ❌ | ❌ | ✅ |

**Note:** All core features are open-source and free. Enterprise features coming soon.

---

## Next Steps

- [Installation](./installation.md) - Get started
- [Configuration](./configuration.md) - Configure features
- [API Reference](./api-reference.md) - Complete API docs
- [MCP Guide](./mcp-guide.md) - MCP server setup
- [Examples](./examples.md) - Code examples

---

**Questions?** See [FAQ](./faq.md) or open an issue on [GitHub](https://github.com/GLINCKER/glin-profanity/issues).
