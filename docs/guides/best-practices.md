# Best Practices

Production-ready best practices for implementing glin-profanity in your applications.

## Table of Contents

- [Architecture](#architecture)
- [Configuration](#configuration)
- [Performance](#performance)
- [Security](#security)
- [User Experience](#user-experience)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Compliance](#compliance)

---

## Architecture

### 1. Single Instance Pattern

**✅ DO:** Reuse a single filter instance

```typescript
// ✅ GOOD: Create once, reuse everywhere
const filter = new Filter({
  languages: ['english'],
  detectLeetspeak: true,
  cacheResults: true,
  cacheSize: 5000
});

export default filter;

// Use across your app
import filter from './profanity-filter';
app.post('/comment', (req, res) => {
  const result = filter.checkProfanity(req.body.text);
  // ...
});
```

**❌ DON'T:** Create new instances per request

```typescript
// ❌ BAD: Memory leak + slow
app.post('/comment', (req, res) => {
  const filter = new Filter();  // Creates new instance every time!
  const result = filter.checkProfanity(req.body.text);
});
```

### 2. Layer Your Defenses

Use multiple validation layers for robust moderation:

```typescript
async function moderateContent(text: string) {
  // Layer 1: Fast keyword check (< 0.1ms)
  const quickCheck = filter.checkProfanity(text);
  if (quickCheck.containsProfanity && quickCheck.profaneWords.length > 2) {
    return { approved: false, reason: 'Multiple profane words', confidence: 'high' };
  }

  // Layer 2: Semantic analysis for subtle toxicity (100-200ms)
  if (quickCheck.containsProfanity || requiresDeepCheck(text)) {
    const semantic = await semanticAnalyzer.analyze(text);
    if (semantic.shouldFlag) {
      return { approved: false, reason: 'Toxic content', confidence: 'medium' };
    }
  }

  // Layer 3: Manual review queue for edge cases
  if (quickCheck.wordCount > 0 || semantic?.combinedScore > 0.5) {
    await addToReviewQueue(text);
  }

  return { approved: true, confidence: 'high' };
}
```

### 3. Microservice Pattern (Large Scale)

For high-traffic applications:

```typescript
// moderation-service/server.ts
import express from 'express';
import { Filter } from 'glin-profanity';

const app = express();
const filter = new Filter({
  languages: ['english', 'spanish'],
  detectLeetspeak: true,
  cacheResults: true,
  cacheSize: 10000
});

app.post('/moderate', (req, res) => {
  const { text, options } = req.body;
  const result = filter.checkProfanity(text, options);
  
  res.json({
    approved: !result.containsProfanity,
    profaneWords: result.containsProfanity ? result.profaneWords : undefined,
    timestamp: Date.now()
  });
});

app.listen(3001);
```

---

## Configuration

### 1. Environment-Specific Settings

```typescript
// config/profanity.ts
const config = {
  development: {
    detectLeetspeak: true,
    leetspeakLevel: 'basic' as const,
    cacheResults: false,  // Easier debugging
    debug: true
  },
  staging: {
    detectLeetspeak: true,
    leetspeakLevel: 'moderate' as const,
    cacheResults: true,
    cacheSize: 5000
  },
  production: {
    detectLeetspeak: true,
    leetspeakLevel: 'moderate' as const,
    cacheResults: true,
    cacheSize: 10000,
    normalizeUnicode: true
  }
};

export const filter = new Filter(config[process.env.NODE_ENV || 'development']);
```

### 2. Use Case-Specific Configuration

```typescript
// Different configs for different use cases
const configs = {
  // Family-friendly app
  strict: {
    detectLeetspeak: true,
    leetspeakLevel: 'aggressive',
    normalizeUnicode: true,
    severityThreshold: 0.3  // Flag even mild profanity
  },
  
  // Professional environment
  moderate: {
    detectLeetspeak: true,
    leetspeakLevel: 'moderate',
    excludeWords: ['damn', 'hell'],  // Allow mild words
    severityThreshold: 0.6
  },
  
  // Adult community (still need moderation)
  lenient: {
    detectLeetspeak: true,
    leetspeakLevel: 'basic',
    excludeWords: ['damn', 'hell', 'ass'],
    severityThreshold: 0.8  // Only severe profanity
  },
  
  // Medical/healthcare
  medical: {
    detectLeetspeak: true,
    context: 'medical',
    excludeWords: ['breast', 'anal', 'rectal', 'penis', 'vaginal']
  }
};

// Create filter based on app type
const filter = new Filter(configs[APP_TYPE]);
```

### 3. Dynamic Configuration

```typescript
class AdaptiveFilter {
  private filter: Filter;
  private config: FilterConfig;

  constructor(baseConfig: FilterConfig) {
    this.config = baseConfig;
    this.filter = new Filter(baseConfig);
  }

  // Adjust based on time of day (stricter during school hours)
  checkProfanity(text: string) {
    const hour = new Date().getHours();
    const isSchoolHours = hour >= 8 && hour <= 15;

    if (isSchoolHours && this.config.leetspeakLevel !== 'aggressive') {
      this.filter = new Filter({
        ...this.config,
        leetspeakLevel: 'aggressive'
      });
    }

    return this.filter.checkProfanity(text);
  }

  // Adjust based on user trust score
  checkForUser(text: string, user: User) {
    if (user.trustScore < 50) {
      // Stricter for low-trust users
      return this.filter.checkProfanity(text);
    } else if (user.trustScore > 90) {
      // More lenient for trusted users
      const lenientFilter = new Filter({
        ...this.config,
        excludeWords: [...(this.config.excludeWords || []), 'damn', 'hell']
      });
      return lenientFilter.checkProfanity(text);
    }

    return this.filter.checkProfanity(text);
  }
}
```

---

## Performance

### 1. Enable Caching

```typescript
// ✅ GOOD: Cache for repeated content
const filter = new Filter({
  cacheResults: true,
  cacheSize: 10000  // Adjust based on memory
});

// First check: ~0.05ms
filter.checkProfanity('test message');

// Subsequent checks: ~0.00004ms
filter.checkProfanity('test message');
```

### 2. Optimize Language Selection

```typescript
// ❌ BAD: All languages when only using English
const filter = new Filter({
  languages: ['english', 'spanish', 'french', /* ...24 languages */]
});

// ✅ GOOD: Only languages you need
const filter = new Filter({
  languages: ['english']  // 40% faster
});
```

### 3. Batch Processing

```typescript
// ✅ GOOD: Process in batches
async function moderateComments(comments: string[]) {
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);
    const batchResults = batch.map(comment => filter.checkProfanity(comment));
    results.push(...batchResults);

    // Optional: Add small delay to prevent CPU spike
    if (i + BATCH_SIZE < comments.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return results;
}
```

### 4. Async Moderation

```typescript
// For non-blocking moderation
async function moderateAsync(text: string) {
  return new Promise((resolve) => {
    setImmediate(() => {
      const result = filter.checkProfanity(text);
      resolve(result);
    });
  });
}

// Use in Express
app.post('/comment', async (req, res) => {
  const result = await moderateAsync(req.body.text);
  
  if (result.containsProfanity) {
    return res.status(400).json({ error: 'Inappropriate content' });
  }
  
  // Save comment
  res.json({ success: true });
});
```

---

## Security

### 1. Input Validation

```typescript
// ✅ GOOD: Validate before checking
function moderateUserInput(text: unknown) {
  // Validate input
  if (typeof text !== 'string') {
    throw new Error('Invalid input: must be string');
  }

  if (text.length > 10000) {
    throw new Error('Input too long');
  }

  if (text.length === 0) {
    return { approved: true, empty: true };
  }

  // Check profanity
  const result = filter.checkProfanity(text);
  return { approved: !result.containsProfanity };
}
```

### 2. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Prevent abuse
const moderationLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,  // 100 requests per minute
  message: 'Too many moderation requests'
});

app.post('/moderate', moderationLimiter, (req, res) => {
  const result = filter.checkProfanity(req.body.text);
  res.json(result);
});
```

### 3. Sanitize Output

```typescript
// ✅ GOOD: Don't expose internal details
function moderatePublicAPI(text: string) {
  const result = filter.checkProfanity(text);

  // Only return what's necessary
  return {
    approved: !result.containsProfanity,
    // Don't expose exact words in production
    reason: result.containsProfanity ? 'Contains inappropriate language' : undefined
  };
}

// For admin/logs (internal only)
function moderateWithDetails(text: string) {
  const result = filter.checkProfanity(text);

  return {
    approved: !result.containsProfanity,
    profaneWords: result.profaneWords,  // OK for internal use
    severity: result.severityMap,
    timestamp: Date.now()
  };
}
```

### 4. Prevent Bypass Attempts

```typescript
const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',  // Catch f4ck, 5h1t, @ss
  normalizeUnicode: true,         // Catch fսck (Cyrillic)
  partialMatching: true           // Catch profanity in compound words
});

// Additional: Check for spacing tricks
function checkWithSpacingDefense(text: string) {
  // Check original
  const result1 = filter.checkProfanity(text);
  
  // Check without spaces (catches "f u c k")
  const noSpaces = text.replace(/\s+/g, '');
  const result2 = filter.checkProfanity(noSpaces);

  return result1.containsProfanity || result2.containsProfanity;
}
```

---

## User Experience

### 1. Provide Helpful Feedback

```typescript
// ❌ BAD: Vague error
if (result.containsProfanity) {
  return res.status(400).json({ error: 'Invalid content' });
}

// ✅ GOOD: Specific, helpful feedback
if (result.containsProfanity) {
  return res.status(400).json({
    error: 'Your message contains inappropriate language',
    suggestions: [
      'Please remove offensive words',
      'Try rephrasing your message',
      'Maintain a respectful tone'
    ],
    // Optional: Suggest alternatives (don't expose exact words)
    hint: 'Check your message for inappropriate terms'
  });
}
```

### 2. Progressive Enforcement

```typescript
interface UserViolations {
  count: number;
  lastViolation: Date;
}

const violations = new Map<string, UserViolations>();

function handleViolation(userId: string, text: string) {
  const userViolations = violations.get(userId) || { count: 0, lastViolation: new Date() };
  userViolations.count++;
  userViolations.lastViolation = new Date();
  violations.set(userId, userViolations);

  // Progressive enforcement
  if (userViolations.count === 1) {
    return {
      action: 'warning',
      message: '⚠️ Please keep language appropriate. This is your first warning.'
    };
  } else if (userViolations.count === 2) {
    return {
      action: 'timeout',
      duration: 3600000,  // 1 hour
      message: '🚫 Second violation. You are timed out for 1 hour.'
    };
  } else if (userViolations.count >= 3) {
    return {
      action: 'ban',
      message: '🔨 Multiple violations. You have been banned.'
    };
  }
}
```

### 3. Allow User Appeals

```typescript
interface AppealSystem {
  submitAppeal(userId: string, messageId: string, reason: string): Promise<void>;
  reviewAppeal(appealId: string, approved: boolean): Promise<void>;
}

// Let users contest false positives
app.post('/appeal', async (req, res) => {
  const { messageId, reason } = req.body;
  
  await appealSystem.submitAppeal(req.user.id, messageId, reason);
  
  res.json({
    success: true,
    message: 'Your appeal has been submitted and will be reviewed.',
    appealId: crypto.randomUUID()
  });
});
```

---

## Testing

### 1. Comprehensive Test Cases

```typescript
describe('Profanity Filter', () => {
  const filter = new Filter({ detectLeetspeak: true, normalizeUnicode: true });

  describe('Basic detection', () => {
    it('should detect explicit profanity', () => {
      expect(filter.isProfane('fuck')).toBe(true);
      expect(filter.isProfane('shit')).toBe(true);
    });

    it('should not flag clean text', () => {
      expect(filter.isProfane('hello world')).toBe(false);
      expect(filter.isProfane('nice day')).toBe(false);
    });
  });

  describe('Evasion techniques', () => {
    it('should detect leetspeak', () => {
      expect(filter.isProfane('f4ck')).toBe(true);
      expect(filter.isProfane('5h1t')).toBe(true);
      expect(filter.isProfane('@$$')).toBe(true);
    });

    it('should detect Unicode homoglyphs', () => {
      expect(filter.isProfane('fυck')).toBe(true);  // Greek upsilon
      expect(filter.isProfane('shіt')).toBe(true);  // Cyrillic i
    });

    it('should detect spacing tricks', () => {
      const text = 'f u c k';
      const noSpaces = text.replace(/\s+/g, '');
      expect(filter.isProfane(noSpaces)).toBe(true);
    });
  });

  describe('False positives', () => {
    it('should not flag Scunthorpe', () => {
      expect(filter.isProfane('Scunthorpe')).toBe(false);
    });

    it('should not flag assassin', () => {
      expect(filter.isProfane('assassin')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty strings', () => {
      expect(filter.isProfane('')).toBe(false);
    });

    it('should handle very long strings', () => {
      const longText = 'hello '.repeat(10000);
      expect(() => filter.isProfane(longText)).not.toThrow();
    });

    it('should handle special characters', () => {
      expect(filter.isProfane('!@#$%^&*()')).toBe(false);
    });
  });
});
```

### 2. Performance Testing

```typescript
import { performance } from 'perf_hooks';

describe('Performance', () => {
  const filter = new Filter({ cacheResults: true });

  it('should process 10,000 messages in under 1 second', () => {
    const messages = Array(10000).fill('test message');
    
    const start = performance.now();
    messages.forEach(msg => filter.checkProfanity(msg));
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000);  // < 1 second
  });

  it('should benefit from caching', () => {
    const text = 'repeated message';

    // First check (uncached)
    const start1 = performance.now();
    filter.checkProfanity(text);
    const uncached = performance.now() - start1;

    // Second check (cached)
    const start2 = performance.now();
    filter.checkProfanity(text);
    const cached = performance.now() - start2;

    expect(cached).toBeLessThan(uncached);
  });
});
```

---

## Monitoring

### 1. Metrics Collection

```typescript
import { Counter, Histogram } from 'prom-client';

const profanityChecks = new Counter({
  name: 'profanity_checks_total',
  help: 'Total profanity checks',
  labelNames: ['result']  // 'clean' or 'flagged'
});

const profanityLatency = new Histogram({
  name: 'profanity_check_duration_seconds',
  help: 'Profanity check duration',
  buckets: [0.001, 0.01, 0.1, 1]
});

function moderateWithMetrics(text: string) {
  const end = profanityLatency.startTimer();
  const result = filter.checkProfanity(text);
  end();

  profanityChecks.inc({
    result: result.containsProfanity ? 'flagged' : 'clean'
  });

  return result;
}
```

### 2. Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'profanity.log' })
  ]
});

function moderateWithLogging(text: string, userId: string) {
  const result = filter.checkProfanity(text);

  if (result.containsProfanity) {
    logger.warn('Profanity detected', {
      userId,
      textHash: crypto.createHash('sha256').update(text).digest('hex'),
      profaneWords: result.profaneWords,
      severity: result.severityMap,
      timestamp: new Date().toISOString()
    });
  }

  return result;
}
```

### 3. Alerting

```typescript
// Alert on high violation rates
const violationRate = new Map<string, number>();

function checkViolationRate(timeWindow = 60000) {
  const now = Date.now();
  const recent = Array.from(violationRate.entries())
    .filter(([timestamp]) => now - parseInt(timestamp) < timeWindow);

  const rate = recent.length / (timeWindow / 1000);  // violations per second

  if (rate > 10) {  // More than 10 violations/sec
    alert('High profanity violation rate detected!', { rate });
  }
}
```

---

## Compliance

### 1. GDPR/Privacy

```typescript
// ✅ GOOD: Hash sensitive content
function moderateGDPRCompliant(text: string, userId: string) {
  const result = filter.checkProfanity(text);

  // Log without storing actual content
  if (result.containsProfanity) {
    await db.violations.create({
      userId,
      textHash: crypto.createHash('sha256').update(text).digest('hex'),
      containsProfanity: result.containsProfanity,
      wordCount: result.wordCount,
      timestamp: Date.now(),
      // Don't store actual text or profane words
    });
  }

  return result;
}
```

### 2. Audit Trails

```typescript
interface AuditLog {
  id: string;
  action: 'check' | 'censor' | 'approve' | 'reject';
  userId: string;
  contentHash: string;
  result: boolean;
  timestamp: Date;
}

async function moderateWithAudit(text: string, userId: string) {
  const result = filter.checkProfanity(text);

  await db.auditLogs.create({
    id: crypto.randomUUID(),
    action: 'check',
    userId,
    contentHash: hashContent(text),
    result: !result.containsProfanity,
    timestamp: new Date()
  });

  return result;
}
```

---

## Anti-Patterns to Avoid

### ❌ DON'T

1. **Create filter instances per request** → Use singleton
2. **Check profanity on every keystroke** → Debounce checks
3. **Expose profane words in error messages** → Generic messages
4. **Disable all optimizations** → Enable caching, optimize languages
5. **Skip input validation** → Always validate
6. **Use only keyword matching** → Layer defenses
7. **Forget to handle edge cases** → Test thoroughly
8. **Log full content** → Hash sensitive data
9. **Block without explanation** → Provide feedback
10. **Ignore false positives** → Allow appeals

---

## Next Steps

- [Performance Guide](./performance.md) - Optimization strategies
- [Security Guide](./security.md) - Security best practices
- [Testing Guide](./testing.md) - Comprehensive testing
- [Examples](./examples.md) - Real-world examples

---

**Follow these best practices for a production-ready profanity detection system!** 🚀
