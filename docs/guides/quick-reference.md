# Quick Reference

Cheat sheet for glin-profanity - all common tasks in one place.

## Installation

```bash
# JavaScript/TypeScript
npm install glin-profanity

# Python
pip install glin-profanity

# MCP Server (for AI assistants)
npx glin-profanity-mcp --install-claude
```

---

## Basic Usage

### Simple Check

```typescript
import { checkProfanity } from 'glin-profanity';

const result = checkProfanity('test message');
// { containsProfanity: boolean, profaneWords: string[], wordCount: number }
```

### With Filter Instance

```typescript
import { Filter } from 'glin-profanity';

const filter = new Filter({ detectLeetspeak: true });

// Check
const result = filter.checkProfanity('f4ck this');
// { containsProfanity: true, profaneWords: ['fuck'] }

// Boolean
if (filter.isProfane('damn it')) {
  console.log('Contains profanity!');
}

// Censor
const censored = filter.censorText('shit happens');
// { processedText: '**** happens', censoredWords: ['shit'] }
```

---

## Configuration

### Common Configurations

```typescript
// Strict (family-friendly)
const strict = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',
  normalizeUnicode: true,
  partialMatching: true,
  cacheResults: true
});

// Moderate (recommended)
const moderate = new Filter({
  languages: ['english'],
  detectLeetspeak: true,
  leetspeakLevel: 'moderate',
  normalizeUnicode: true,
  cacheResults: true
});

// Lenient (obvious only)
const lenient = new Filter({
  languages: ['english'],
  detectLeetspeak: false,
  partialMatching: false
});

// Medical/Healthcare
const medical = new Filter({
  excludeWords: ['breast', 'anal', 'rectal', 'penis', 'vaginal']
});

// Gaming
const gaming = new Filter({
  excludeWords: ['kill', 'shot', 'headshot', 'noob', 'pwn']
});
```

---

## Detection Features

| Feature | Code | Description |
|---------|------|-------------|
| **Leetspeak** | `detectLeetspeak: true` | Detects f4ck, 5h1t, @ss |
| **Unicode** | `normalizeUnicode: true` | Detects fսck (Cyrillic) |
| **Multi-Language** | `languages: ['english', 'spanish']` | Check multiple languages |
| **Custom Words** | `customDictionary: Map` | Add your own words |
| **Exclusions** | `excludeWords: ['damn']` | Whitelist specific words |
| **Caching** | `cacheResults: true` | 800x faster on repeats |

---

## React

```typescript
import { useProfanityChecker } from 'glin-profanity';

function ChatInput() {
  const { result, checkText } = useProfanityChecker({
    detectLeetspeak: true
  });

  return (
    <>
      <input onChange={(e) => checkText(e.target.value)} />
      {result?.containsProfanity && <span>Clean language please!</span>}
    </>
  );
}
```

---

## Next.js

### API Route (App Router)

```typescript
// app/api/moderate/route.ts
import { Filter } from 'glin-profanity';

const filter = new Filter({ detectLeetspeak: true });

export async function POST(request: Request) {
  const { text } = await request.json();
  const result = filter.checkProfanity(text);
  return Response.json(result);
}
```

### Server Action

```typescript
// app/actions.ts
'use server';
import { Filter } from 'glin-profanity';

const filter = new Filter();

export async function moderateText(text: string) {
  const result = filter.checkProfanity(text);
  return !result.containsProfanity;
}
```

---

## AI Integrations

### OpenAI

```typescript
import { profanityTools } from 'glin-profanity/ai/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: profanityTools
});
```

### LangChain

```typescript
import { allProfanityTools } from 'glin-profanity/ai/langchain';

const agent = createReactAgent({
  llm: model,
  tools: allProfanityTools
});
```

### Vercel AI SDK

```typescript
import { profanityTools } from 'glin-profanity/ai/vercel';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: profanityTools
});
```

### MCP Server

```json
// ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "glin-profanity": {
      "command": "npx",
      "args": ["-y", "glin-profanity-mcp"]
    }
  }
}
```

---

## ML Features

### TensorFlow.js Toxicity

```typescript
import { loadToxicityModel, checkToxicity } from 'glin-profanity/ml';

await loadToxicityModel({ threshold: 0.9 });

const result = await checkToxicity("You're terrible");
// { toxic: true, categories: { toxicity: 0.92, insult: 0.87 } }
```

### Semantic Analysis

```typescript
import { createSemanticAnalyzer } from 'glin-profanity/ai/semantic';

const analyzer = createSemanticAnalyzer({
  embeddingProvider: provider,
  threshold: 0.7
});

const result = await analyzer.analyze('toxic but no profanity');
// { shouldFlag: true, semanticScore: 0.85 }
```

---

## Batch Processing

```typescript
const filter = new Filter();

const messages = ['msg1', 'msg2', 'msg3'];
const results = messages.map(msg => filter.checkProfanity(msg));

// With progress
for (const [i, msg] of messages.entries()) {
  const result = filter.checkProfanity(msg);
  console.log(`${i + 1}/${messages.length} - ${result.containsProfanity ? 'FLAGGED' : 'OK'}`);
}
```

---

## Performance

| Operation | Performance | When to Use |
|-----------|-------------|-------------|
| Simple check (uncached) | ~300,000 ops/sec | Basic detection |
| With leetspeak (moderate) | ~180,000 ops/sec | Real-world |
| `checkProfanity()` cache hit | ~25M ops/sec | Repeated identical strings |
| ML detection | 50-200ms | Advanced detection |

### Optimization

```typescript
// Fast
const fast = new Filter({
  languages: ['english'],  // One language
  detectLeetspeak: false,  // Disable if not needed
  cacheResults: true       // Enable caching
});

// Slowest (most thorough)
const thorough = new Filter({
  languages: ['english', 'spanish', 'french'],
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',
  normalizeUnicode: true,
  severityLevels: true
});
```

---

## Common Patterns

### Chat Moderation

```typescript
const filter = new Filter({ detectLeetspeak: true });

function moderateChat(userId: string, message: string) {
  const result = filter.checkProfanity(message);
  
  if (result.containsProfanity) {
    logViolation(userId, result.profaneWords);
    return {
      allowed: false,
      reason: `Inappropriate language: ${result.profaneWords.join(', ')}`
    };
  }
  
  return { allowed: true };
}
```

### Comment System

```typescript
async function submitComment(text: string) {
  const result = filter.checkProfanity(text);
  
  if (result.containsProfanity) {
    throw new Error('Comment contains inappropriate language');
  }
  
  await db.comments.create({ text, approved: true });
}
```

### Search Query Sanitization

```typescript
function sanitizeQuery(query: string): string {
  const censored = filter.censorText(query);
  return censored.processedText;
}
```

---

## TypeScript Types

```typescript
import type {
  Filter,
  FilterConfig,
  CheckProfanityResult,
  CensorTextResult,
  LeetspeakLevel,
  SupportedLanguage
} from 'glin-profanity';

const config: FilterConfig = {
  languages: ['english'],
  detectLeetspeak: true,
  leetspeakLevel: 'moderate'
};

const filter: Filter = new Filter(config);
const result: CheckProfanityResult = filter.checkProfanity('test');
```

---

## Environment Variables

```bash
# Default languages
GLIN_PROFANITY_LANGUAGES=english,spanish

# Enable leetspeak
GLIN_PROFANITY_LEETSPEAK=true

# Cache size
GLIN_PROFANITY_CACHE_SIZE=5000

# Log level
GLIN_PROFANITY_LOG_LEVEL=info
```

---

## Common Tasks

| Task | Code |
|------|------|
| Check if text has profanity | `filter.isProfane(text)` |
| Get profane words | `filter.checkProfanity(text).profaneWords` |
| Censor text | `filter.censorText(text).processedText` |
| Check multiple texts | `texts.map(t => filter.checkProfanity(t))` |
| Clear cache | `filter.clearCache()` |
| Get cache size | `filter.getCacheSize()` |
| Export config | `filter.exportConfig()` |
| Check supported languages | `import { getSupportedLanguages }` |

---

## Error Handling

```typescript
try {
  const result = filter.checkProfanity(text);
  
  if (result.containsProfanity) {
    // Handle profanity
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { Filter } from 'glin-profanity';

describe('Profanity Detection', () => {
  it('should detect profanity', () => {
    const filter = new Filter();
    const result = filter.checkProfanity('fuck');
    expect(result.containsProfanity).toBe(true);
  });

  it('should not flag clean text', () => {
    const filter = new Filter();
    const result = filter.checkProfanity('hello');
    expect(result.containsProfanity).toBe(false);
  });
});
```

---

## Debugging

```typescript
// Enable debug mode
const filter = new Filter({
  debug: true,
  logLevel: 'verbose'
});

// Get detailed match info
const result = filter.checkProfanity('test', {
  includeMatches: true
});

console.log(result.matches);
// [{ word: 'shit', index: 5, severity: 0.7, method: 'dictionary' }]
```

---

## Python Quick Reference

```python
from glin_profanity import Filter

# Basic usage
filter = Filter({"languages": ["english"]})

# Check profanity
result = filter.check_profanity("test message")
print(result["contains_profanity"])

# Boolean check
is_bad = filter.is_profane("damn it")

# Censor
censored = filter.censor_text("shit happens")
print(censored["processed_text"])  # "**** happens"
```

---

## Links

- **Docs**: [docs/README.md](./README.md)
- **API**: [docs/api-reference.md](./api-reference.md)
- **Examples**: [docs/examples.md](./examples.md)
- **FAQ**: [docs/faq.md](./faq.md)
- **MCP Guide**: [docs/mcp-guide.md](./mcp-guide.md)
- **GitHub**: https://github.com/GLINCKER/glin-profanity
- **NPM**: https://www.npmjs.com/package/glin-profanity

---

## Supported Languages (24)

Arabic, Chinese, Czech, Danish, Dutch, English, Esperanto, Finnish, French, German, Hindi, Hungarian, Italian, Japanese, Korean, Norwegian, Persian, Polish, Portuguese, Russian, Spanish, Swedish, Thai, Turkish

---

**Need more details?** See the [complete documentation](./README.md).
