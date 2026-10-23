# Troubleshooting Guide

Common issues and solutions for glin-profanity.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [False Positives/Negatives](#false-positivesnegatives)
- [Integration Issues](#integration-issues)
- [MCP Server Issues](#mcp-server-issues)
- [TypeScript Issues](#typescript-issues)
- [Debugging](#debugging)

---

## Installation Issues

### npm install fails

**Problem:** `npm install glin-profanity` fails

**Solutions:**

```bash
# Clear npm cache
npm cache clean --force

# Try with specific version
npm install glin-profanity@latest

# Use different registry
npm install glin-profanity --registry=https://registry.npmjs.org/

# Check Node.js version (requires 16+)
node --version
```

### Module not found after installation

**Problem:** `Cannot find module 'glin-profanity'`

**Solutions:**

```bash
# Verify installation
npm ls glin-profanity

# Reinstall
npm uninstall glin-profanity
npm install glin-profanity

# Check package.json
cat package.json | grep glin-profanity
```

### Python pip install fails

**Problem:** `pip install glin-profanity` fails

**Solutions:**

```bash
# Upgrade pip
python -m pip install --upgrade pip

# Use specific version
pip install glin-profanity==3.2.0

# Install with verbose output
pip install glin-profanity --verbose
```

---

## Runtime Errors

### "Filter is not a constructor"

**Problem:**
```javascript
const Filter = require('glin-profanity');
const filter = new Filter();  // Error!
```

**Solution:**
```javascript
// CommonJS
const { Filter } = require('glin-profanity');
const filter = new Filter();

// ES6
import { Filter } from 'glin-profanity';
const filter = new Filter();
```

### "checkProfanity is not a function"

**Problem:**
```javascript
import Filter from 'glin-profanity';  // Wrong!
Filter.checkProfanity('test');  // Error!
```

**Solution:**
```javascript
// Correct import
import { Filter, checkProfanity } from 'glin-profanity';

// Use it
checkProfanity('test');
// or
const filter = new Filter();
filter.checkProfanity('test');
```

### "Unsupported language"

**Problem:**
```javascript
const filter = new Filter({ languages: ['klingon'] });  // Error!
```

**Solution:**
```javascript
// Check supported languages
import { getSupportedLanguages } from 'glin-profanity';
console.log(getSupportedLanguages());

// Use supported language
const filter = new Filter({ languages: ['english'] });
```

### Memory/heap errors

**Problem:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Or run with flag
node --max-old-space-size=4096 your-app.js
```

```typescript
// Reduce cache size
const filter = new Filter({
  cacheSize: 1000  // Smaller cache
});

// Clear cache periodically
setInterval(() => filter.clearCache(), 60000);
```

---

## Performance Issues

### Slow detection

**Problem:** Profanity checking is slower than expected

**Solutions:**

```typescript
// 1. Enable caching
const filter = new Filter({
  cacheResults: true,
  cacheSize: 5000
});

// 2. Reduce languages
const filter = new Filter({
  languages: ['english']  // Instead of all 24
});

// 3. Optimize leetspeak level
const filter = new Filter({
  leetspeakLevel: 'moderate'  // Instead of 'aggressive'
});

// 4. Use isProfane() for boolean checks
if (filter.isProfane(text)) {  // Faster
  // ...
}
```

### High memory usage

**Problem:** Application uses too much memory

**Solutions:**

```typescript
// 1. Smaller cache
const filter = new Filter({
  cacheSize: 1000  // Default: 5000
});

// 2. Disable caching
const filter = new Filter({
  cacheResults: false
});

// 3. Clear cache regularly
setInterval(() => {
  if (filter.getCacheSize() > 5000) {
    filter.clearCache();
  }
}, 60000);

// 4. Use minimum languages
const filter = new Filter({
  languages: ['english']  // Not all 24
});
```

### Serverless cold starts

**Problem:** Slow cold starts in AWS Lambda/Vercel

**Solutions:**

```typescript
// 1. Initialize outside handler
const filter = new Filter({
  languages: ['english'],
  cacheResults: true
});

export const handler = async (event) => {
  // Reuse filter
  return filter.checkProfanity(event.text);
};

// 2. Lazy load ML
let mlModel = null;

async function checkWithML(text: string) {
  const result = filter.checkProfanity(text);
  
  if (result.containsProfanity && requiresML) {
    mlModel = mlModel || await loadToxicityModel();
    const mlResult = await mlModel.check(text);
    return { ...result, ml: mlResult };
  }
  
  return result;
}
```

---

## False Positives/Negatives

### False positives (Scunthorpe problem)

**Problem:** Legitimate words flagged as profanity

**Examples:**
- "Scunthorpe" (contains "cunt")
- "assassin" (contains "ass")
- "basement" (contains "semen")

**Solutions:**

```typescript
// 1. Use word boundaries
const filter = new Filter({
  wordBoundaries: true  // Match whole words only
});

// 2. Add to exclusion list
const filter = new Filter({
  excludeWords: ['scunthorpe', 'assassin', 'basement']
});

// 3. Domain-specific whitelist
const filter = new Filter({
  context: 'technical',
  excludeWords: ['abort', 'kill', 'execute']
});
```

### False negatives (missed profanity)

**Problem:** Profanity not detected

**Solutions:**

```typescript
// 1. Enable leetspeak
const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive'
});

// 2. Enable Unicode normalization
const filter = new Filter({
  normalizeUnicode: true
});

// 3. Add custom words
const filter = new Filter({
  customDictionary: new Map([
    ['customBadWord', 1.0]
  ])
});

// 4. Use ML detection
import { HybridFilter } from 'glin-profanity/ml';

const hybrid = new HybridFilter({
  enableKeyword: true,
  enableML: true,
  threshold: 0.7
});
```

### Context-specific issues

**Problem:** Medical/technical terms flagged

**Solution:**

```typescript
// Medical context
const medicalFilter = new Filter({
  context: 'medical',
  excludeWords: [
    'breast', 'anal', 'rectal',
    'penis', 'vaginal', 'sex'
  ]
});

// Gaming context
const gamingFilter = new Filter({
  context: 'gaming',
  excludeWords: [
    'kill', 'shot', 'headshot',
    'noob', 'pwn', 'owned'
  ]
});
```

---

## Integration Issues

### React: Hook not working

**Problem:**
```typescript
import { useProfanityChecker } from 'glin-profanity';
// Error: Cannot find module
```

**Solution:**

```bash
# Ensure React version 16.8+
npm ls react

# Install if needed
npm install react@latest
```

```typescript
// Correct usage
import { useProfanityChecker } from 'glin-profanity';

function Component() {
  const { result, checkText } = useProfanityChecker({
    detectLeetspeak: true
  });

  return (
    <input onChange={(e) => checkText(e.target.value)} />
    {result?.containsProfanity && <span>Error!</span>}
  );
}
```

### Next.js: Module not found

**Problem:** `Module not found: Can't resolve 'glin-profanity'`

**Solution:**

```typescript
// app/api/moderate/route.ts
import { Filter } from 'glin-profanity';

const filter = new Filter();

export async function POST(request: Request) {
  const { text } = await request.json();
  const result = filter.checkProfanity(text);
  return Response.json(result);
}
```

```json
// next.config.js
module.exports = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  }
};
```

### TypeScript: Type errors

**Problem:** TypeScript can't find types

**Solution:**

```bash
# Types are included, ensure TypeScript 4.5+
npm install typescript@latest

# Check tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

---

## MCP Server Issues

### Claude can't find server

**Problem:** Claude Desktop doesn't show glin-profanity tools

**Solution:**

```bash
# 1. Verify installation
npx glin-profanity-mcp --version

# 2. Check config file exists
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 3. Correct format
{
  "mcpServers": {
    "glin-profanity": {
      "command": "npx",
      "args": ["-y", "glin-profanity-mcp"]
    }
  }
}

# 4. Restart Claude Desktop
```

### MCP tools return errors

**Problem:** Tools fail with parameter errors

**Solution:**

```typescript
// ❌ Wrong parameter names
{
  "message": "test"  // Wrong!
}

// ✅ Correct parameter names
{
  "text": "test"  // Correct
}

// Check tool schema
READ glin-profanity://docs/mcp-guide
```

### MCP server crashes

**Problem:** Server process crashes

**Solution:**

```bash
# Check logs
tail -f ~/Library/Logs/Claude/mcp-server-glin-profanity.log

# Reinstall
npm uninstall -g glin-profanity-mcp
npm install -g glin-profanity-mcp@latest

# Test manually
npx glin-profanity-mcp
```

---

## TypeScript Issues

### Type inference not working

**Problem:**
```typescript
const result = filter.checkProfanity('test');
result.containsProfanity  // Type error!
```

**Solution:**

```typescript
import { Filter, CheckProfanityResult } from 'glin-profanity';

const filter = new Filter();
const result: CheckProfanityResult = filter.checkProfanity('test');

// Now type checking works
if (result.containsProfanity) {
  console.log(result.profaneWords);
}
```

### Generic types not inferred

**Solution:**

```typescript
import type {
  FilterConfig,
  CheckProfanityResult,
  CensorTextResult,
  LeetspeakLevel
} from 'glin-profanity';

const config: FilterConfig = {
  languages: ['english'],
  detectLeetspeak: true,
  leetspeakLevel: 'moderate' as LeetspeakLevel
};
```

---

## Debugging

### Enable debug logging

```typescript
const filter = new Filter({
  debug: true,
  logLevel: 'verbose'
});

// Logs will show:
// - What patterns matched
// - Why text was flagged
// - Cache hits/misses
```

### Inspect matches

```typescript
const result = filter.checkProfanity('test shit', {
  includeMatches: true
});

console.log(result.matches);
// [
//   {
//     word: 'shit',
//     index: 5,
//     severity: 0.7,
//     method: 'dictionary'
//   }
// ]
```

### Profile performance

```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
const result = filter.checkProfanity('test message');
const duration = performance.now() - start;

console.log(`Check took ${duration.toFixed(2)}ms`);
```

### Test specific scenarios

```typescript
// Test edge cases
const testCases = [
  { text: 'fuck', expected: true },
  { text: 'f4ck', expected: true },
  { text: 'fυck', expected: true },  // Greek upsilon
  { text: 'hello', expected: false },
  { text: 'Scunthorpe', expected: false }  // Should not flag
];

for (const test of testCases) {
  const result = filter.isProfane(test.text);
  console.assert(
    result === test.expected,
    `Failed: "${test.text}" - got ${result}, expected ${test.expected}`
  );
}
```

---

## Getting Help

### Still having issues?

1. **Check Documentation**
   - [Installation Guide](./installation.md)
   - [Configuration Guide](./configuration.md)
   - [FAQ](./faq.md)

2. **Search Issues**
   - [GitHub Issues](https://github.com/GLINCKER/glin-profanity/issues)
   - [Discussions](https://github.com/GLINCKER/glin-profanity/discussions)

3. **Open New Issue**
   - Minimal reproduction
   - Expected vs actual behavior
   - Node.js/Python version
   - Configuration used

4. **Community**
   - [Discord](https://discord.gg/glincker)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/glin-profanity)

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Filter is not a constructor` | Wrong import | Use `{ Filter }` not default |
| `Unsupported language` | Invalid language | Check `getSupportedLanguages()` |
| `Module not found` | Not installed | Run `npm install glin-profanity` |
| `Out of memory` | Cache too large | Reduce `cacheSize` |
| `TypeError: checkProfanity is not a function` | Wrong import | Import `{ checkProfanity }` |

---

**Next Steps:**
- [FAQ](./faq.md) - Common questions
- [Configuration](./configuration.md) - All options
- [Performance](./performance.md) - Optimization

---

**Still stuck?** Open an issue: https://github.com/GLINCKER/glin-profanity/issues
