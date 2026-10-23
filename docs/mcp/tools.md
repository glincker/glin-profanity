# MCP Tools Reference

Complete reference for all 19 profanity detection tools available via the MCP server.

## Quick Reference

| Tool | Purpose | Latency |
|------|---------|---------|
| `check_profanity` | Basic profanity check | < 1ms |
| `censor_text` | Replace profanity with *** | < 1ms |
| `batch_check_profanity` | Check multiple texts | < 5ms |
| `analyze_context` | Context-aware detection | < 2ms |
| `validate_content` | Multi-layer validation | 100-200ms |
| `check_severity` | Get severity scores | < 1ms |
| `compare_strictness` | Test different levels | < 5ms |
| `suggest_alternatives` | Get replacement words | 50-100ms |
| `analyze_conversation` | Thread analysis | 50-150ms |
| `explain_match` | Explain why flagged | < 1ms |
| `get_supported_languages` | List languages | < 1ms |
| `customize_filter` | Dynamic configuration | < 1ms |
| `moderate_user_content` | User content pipeline | 100-200ms |
| `track_violations` | Violation history | < 1ms |
| `check_username` | Username validation | < 1ms |
| `analyze_sentiment` | Sentiment + profanity | 100-150ms |
| `get_statistics` | Usage statistics | < 1ms |
| `export_config` | Export configuration | < 1ms |
| `health_check` | Server status | < 1ms |

---

## Core Tools

### 1. check_profanity

**Purpose:** Basic profanity detection

**Parameters:**
```typescript
{
  text: string;              // Required: Text to check
  languages?: string[];      // Optional: Languages to check
  detectLeetspeak?: boolean; // Optional: Detect f4ck, sh1t (default: true)
  leetspeakLevel?: 'basic' | 'moderate' | 'aggressive';
}
```

**Returns:**
```typescript
{
  containsProfanity: boolean;
  profaneWords: string[];
  wordCount: number;
  severityMap: { [word: string]: number };
}
```

**Example:**
```
Check this text for profanity: "what the fuck"
→ Returns: { containsProfanity: true, profaneWords: ["fuck"], wordCount: 1 }
```

---

### 2. censor_text

**Purpose:** Replace profane words with asterisks

**Parameters:**
```typescript
{
  text: string;              // Required: Text to censor
  replaceWith?: string;      // Optional: Replacement (default: "***")
  preserveLength?: boolean;  // Optional: Match word length (default: false)
  languages?: string[];
  detectLeetspeak?: boolean;
}
```

**Returns:**
```typescript
{
  originalText: string;
  processedText: string;
  censoredWords: string[];
  changesCount: number;
}
```

**Example:**
```
Censor this text: "damn this shit"
→ Returns: { processedText: "**** this ****", censoredWords: ["damn", "shit"] }
```

---

### 3. batch_check_profanity

**Purpose:** Check multiple texts efficiently

**Parameters:**
```typescript
{
  texts: string[];           // Required: Array of texts
  detectLeetspeak?: boolean;
  languages?: string[];
}
```

**Returns:**
```typescript
{
  results: Array<{
    text: string;
    containsProfanity: boolean;
    profaneWords: string[];
  }>;
  summary: {
    total: number;
    flagged: number;
    clean: number;
    percentage: number;
  };
}
```

**Example:**
```
Check these messages:
1. "hello world"
2. "fuck this"
3. "nice day"

→ Returns: { summary: { total: 3, flagged: 1, clean: 2 } }
```

---

## Advanced Tools

### 4. analyze_context

**Purpose:** Context-aware profanity detection

**Parameters:**
```typescript
{
  text: string;
  context?: 'medical' | 'gaming' | 'educational' | 'business';
  customExclusions?: string[];
}
```

**Example:**
```
Analyze in medical context: "breast cancer screening"
→ Returns: { containsProfanity: false, contextAllowed: ["breast"] }
```

---

### 5. validate_content

**Purpose:** Multi-layer content validation

**Parameters:**
```typescript
{
  text: string;
  enableSemanticAnalysis?: boolean;
  semanticThreshold?: number;
}
```

**Returns:**
```typescript
{
  approved: boolean;
  reasons: string[];
  scores: {
    profanity: number;
    semantic?: number;
    combined: number;
  };
}
```

**Example:**
```
Validate: "You're a terrible person"
→ May flag as toxic even without profanity
```

---

### 6. suggest_alternatives

**Purpose:** Get replacement suggestions for profane words

**Parameters:**
```typescript
{
  text: string;
  tone?: 'professional' | 'casual' | 'friendly';
}
```

**Returns:**
```typescript
{
  originalText: string;
  suggestions: Array<{
    original: string;
    alternatives: string[];
    context: string;
  }>;
  revisedText: string;
}
```

**Example:**
```
Suggest alternatives for: "this is shit"
→ Returns: { alternatives: ["bad", "poor", "subpar"] }
```

---

## Utility Tools

### 7. get_supported_languages

**Purpose:** List all supported languages

**Returns:**
```typescript
{
  languages: string[];  // All 24 languages
  totalCount: number;
}
```

**Example:**
```
What languages are supported?
→ Returns: ["arabic", "chinese", "czech", ..., "turkish"]
```

---

### 8. check_username

**Purpose:** Validate usernames for profanity

**Parameters:**
```typescript
{
  username: string;
  strictMode?: boolean;  // Extra strict for usernames
}
```

**Returns:**
```typescript
{
  valid: boolean;
  reason?: string;
  suggestions?: string[];
}
```

**Example:**
```
Validate username: "xxxfuckxxx"
→ Returns: { valid: false, reason: "Contains profanity" }
```

---

### 9. compare_strictness

**Purpose:** See how different strictness levels affect results

**Parameters:**
```typescript
{
  text: string;
  levels: Array<'basic' | 'moderate' | 'aggressive'>;
}
```

**Returns:**
```typescript
{
  text: string;
  results: {
    basic: CheckProfanityResult;
    moderate: CheckProfanityResult;
    aggressive: CheckProfanityResult;
  };
  recommendation: string;
}
```

---

### 10. get_statistics

**Purpose:** Get usage statistics

**Returns:**
```typescript
{
  totalChecks: number;
  flaggedContent: number;
  cacheHitRate: number;
  averageLatency: number;
  topLanguages: string[];
}
```

---

## Monitoring Tools

### 11. health_check

**Purpose:** Check MCP server status

**Returns:**
```typescript
{
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  version: string;
  featuresEnabled: string[];
}
```

---

### 12. export_config

**Purpose:** Export current filter configuration

**Returns:**
```typescript
{
  config: FilterConfig;
  exportedAt: string;
  version: string;
}
```

---

## Usage Examples

### In Claude

```
User: "Hey Claude, can you check if this comment is appropriate: 'what the fuck is this'"

Claude uses: check_profanity
→ Result: Contains profanity (word: "fuck")

Claude responds: "This comment contains profanity (specifically the word 'fuck'). 
It would not be appropriate for most public platforms."
```

### In Cursor

```
User: "Check all my commit messages for profanity"

Cursor uses: batch_check_profanity
→ Analyzes all commit messages

Cursor responds: "Found 2 commits with inappropriate language:
- commit abc123: 'fix this fucking bug'
- commit def456: 'damn it works now'"
```

### In Windsurf

```
User: "Suggest a better way to phrase: 'this code is shit'"

Windsurf uses: suggest_alternatives
→ Gets alternatives

Windsurf responds: "Here are professional alternatives:
- 'this code needs improvement'
- 'this code has issues'
- 'this code could be better'"
```

---

## Performance

| Tool Category | Typical Latency | Best For |
|---------------|----------------|----------|
| **Core Tools** (check, censor) | < 1ms | Real-time validation |
| **Batch Tools** | < 5ms | Processing multiple items |
| **AI-Enhanced** (semantic, alternatives) | 50-200ms | Deep analysis |
| **Utility Tools** | < 1ms | Configuration & info |

---

## Best Practices

### 1. Choose the Right Tool

```
✅ Real-time chat → check_profanity
✅ Display to users → censor_text
✅ Bulk moderation → batch_check_profanity
✅ Medical content → analyze_context
✅ Suggestions needed → suggest_alternatives
```

### 2. Combine Tools

```
Step 1: check_profanity (fast filter)
Step 2: If flagged → suggest_alternatives (help user)
Step 3: If severe → track_violations (monitoring)
```

### 3. Use Caching

The MCP server automatically caches results. Repeated checks hit the cache (about 80x faster on short clean text, more on obfuscated text).

---

## Next Steps

- [MCP Resources](./resources.md) - Access documentation
- [MCP Examples](./examples.md) - Real-world usage
- [MCP Overview](./overview.md) - Complete guide

---

**You now have access to 19 powerful profanity detection tools via MCP!** 🚀
