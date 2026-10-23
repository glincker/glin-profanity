# OpenClaw Integration Guide

Complete guide for integrating glin-profanity with OpenClaw (formerly Moltbot/Clawdbot).

## Table of Contents

- [What is OpenClaw?](#what-is-openclaw)
- [Installation](#installation)
- [Integration Methods](#integration-methods)
- [Skills (Recommended for Beginners)](#skills-recommended-for-beginners)
- [Hooks (Auto-Moderation)](#hooks-auto-moderation)
- [Plugin (Advanced)](#plugin-advanced)
- [MCP Server](#mcp-server)
- [Configuration](#configuration)
- [Use Cases](#use-cases)
- [Troubleshooting](#troubleshooting)

---

## What is OpenClaw?

**OpenClaw** (formerly Moltbot/Clawdbot) is a multi-platform AI agent framework that powers intelligent bots across:
- 💬 WhatsApp
- 📱 Telegram
- 💭 Discord
- 💼 Slack
- 📲 iMessage
- And more!

The `@glin/openclaw-profanity` plugin brings powerful 24-language profanity detection to your OpenClaw agents, keeping conversations clean across all platforms.

---

## Installation

### Option 1: OpenClaw Plugin Manager (Recommended)

```bash
openclaw plugins install @glin/openclaw-profanity
```

### Option 2: NPM

```bash
npm install @glin/openclaw-profanity
```

### Option 3: Yarn

```bash
yarn add @glin/openclaw-profanity
```

---

## Integration Methods

OpenClaw profanity supports **4 integration methods**:

| Method | Difficulty | Use Case | Auto-Moderate |
|--------|------------|----------|---------------|
| **Skills** | Easy | Simple profanity checks | ❌ |
| **Hooks** | Easy | Automatic message moderation | ✅ |
| **Plugin** | Advanced | Custom tools & workflows | ❌ |
| **MCP** | Advanced | MCP-compatible clients | Configurable |

**Recommendation:** Start with **Skills** or **Hooks** for simplicity.

---

## Skills (Recommended for Beginners)

Skills are markdown-based instructions that teach OpenClaw when and how to use profanity detection.

### Setup

**Option 1: Auto-Generate (Recommended)**

```typescript
import { generateSkillFiles } from '@glin/openclaw-profanity/skills';

// Generate skills in your OpenClaw project
await generateSkillFiles('./skills');
```

**Option 2: Copy Manually**

```bash
cp -r node_modules/@glin/openclaw-profanity/skills ./skills/
```

### Available Skills

#### 1. `profanity_check` - Check for Profanity

**When to use:** User  asks "Is this appropriate?", "Check this message", etc.

**Example:**

```
User: "Is 'fuck this game' appropriate?"
Agent: Uses profanity_check skill
Result: "No, contains profanity: 'fuck'"
```

**Configuration in `openclaw.config.json5`:**

```json5
{
  skills: {
    profanity_check: {
      enabled: true,
      languages: ['english'],
      detectLeetspeak: true
    }
  }
}
```

#### 2. `censor_message` - Censor Profanity

**When to use:** Clean up content for publication, remove offensive words.

**Example:**

```
User: "Clean this up: 'what the fuck'"
Agent: Uses censor_message skill
Result: "what the ***"
```

#### 3. `content_guard` - Validate Content Safety

**When to use:** Pre-publish checks, content approval workflows.

**Example:**

```
User: "Can I post this comment: 'this is shit'"
Agent: Uses content_guard skill
Result: "Not approved - contains profanity. Suggested edit: 'this is bad'"
```

### Skill Usage Example

```typescript
// In your OpenClaw configuration
export default {
  skills: {
    directory: './skills',
    autoload: true,
    config: {
      profanity_check: {
        languages: ['english', 'spanish', 'french'],
        detectLeetspeak: true,
        leetspeakLevel: 'moderate'
      }
    }
  }
};
```

**OpenClaw will automatically:**
1. Discover skills in `./skills/`
2. Understand when to use them (from SKILL.md)
3. Call profanity detection when appropriate
4. Return results to the user

---

## Hooks (Auto-Moderation)

Hooks provide **automatic message moderation** - every incoming message is checked for profanity.

### Setup

**1. Install Hook:**

```typescript
import { createProfanityGuard } from '@glin/openclaw-profanity/hooks';

const guard = createProfanityGuard({
  // Block messages with profanity
  blockProfanity: true,
  
  // Censor instead of blocking
  censorProfanity: false,
  
  // Languages to check
  languages: ['english'],
  
  // Detect obfuscation (f4ck, sh1t)
  detectLeetspeak: true,
  
  // Custom warning message
  warningMessage: '⚠️ Your message contains inappropriate language and was blocked.',
  
  // Platforms to moderate (or 'all')
  platforms: ['whatsapp', 'telegram', 'discord']
});
```

**2. Register Hook in OpenClaw:**

```typescript
// openclaw.config.ts
export default {
  hooks: {
    'profanity-guard': guard
  }
};
```

### Hook Modes

#### Mode 1: Block Profanity (Strict)

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  warningMessage: '🚫 Message blocked due to inappropriate language.'
});
```

**Result:**
- ✅ Clean messages: Delivered normally
- ❌ Profane messages: Blocked, warning sent to user

#### Mode 2: Censor Profanity (Moderate)

```typescript
const guard = createProfanityGuard({
  censorProfanity: true,
  replaceWith: '***'
});
```

**Result:**
- ✅ Clean messages: Delivered normally
- ⚠️ Profane messages: Censored and delivered

**Example:**
```
User sends: "what the fuck"
Agent delivers: "what the ***"
```

#### Mode 3: Warn Only (Lenient)

```typescript
const guard = createProfanityGuard({
  blockProfanity: false,
  censorProfanity: false,
  warnOnly: true
});
```

**Result:**
- ✅ All messages: Delivered
- ⚠️ Profane messages: Warning sent to user + admin notification

### Platform-Specific Configuration

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  
  // Different settings per platform
  platformOverrides: {
    whatsapp: {
      // Stricter on WhatsApp
      blockProfanity: true,
      detectLeetspeak: true
    },
    discord: {
      // More lenient on Discord
      blockProfanity: false,
      censorProfanity: true
    },
    telegram: {
      // Warn only on Telegram
      warnOnly: true
    }
  }
});
```

### User Tracking & Violations

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  trackViolations: true,
  
  // Auto-timeout after 3 violations
  violationThreshold: 3,
  timeoutDuration: 3600000, // 1 hour in ms
  
  // Escalation
  onViolation: async (user, violation) => {
    console.log(`User ${user.id} violated profanity policy`);
    
    if (violation.count >= 3) {
      // Auto-ban on 3rd violation
      await openclaw.banUser(user.id, '1h');
    }
  }
});
```

---

## Plugin (Advanced)

For advanced use cases, register profanity detection tools directly into OpenClaw's tool system.

### Setup

```typescript
import { registerProfanityTools, profanityTools } from '@glin/openclaw-profanity/plugin';
import type { OpenClawAPI } from '@glin/openclaw-profanity';

export function activate(api: OpenClawAPI) {
  // Option 1: Register all tools
  registerProfanityTools(api);

  // Option 2: Register specific tools
  api.registerTool(profanityTools.checkProfanity);
  api.registerTool(profanityTools.censorText);
  api.registerTool(profanityTools.batchCheck);
  api.registerTool(profanityTools.analyzeContext);
}
```

### Available Tools

#### 1. `check_profanity`

```typescript
const result = await api.callTool('check_profanity', {
  text: 'test message',
  detectLeetspeak: true,
  languages: ['english']
});

// {
//   containsProfanity: boolean,
//   profaneWords: string[],
//   wordCount: number,
//   severityMap: { [word: string]: number }
// }
```

#### 2. `censor_text`

```typescript
const result = await api.callTool('censor_text', {
  text: 'damn this shit',
  replaceWith: '***',
  preserveLength: true
});

// {
//   originalText: 'damn this shit',
//   processedText: '**** this ****',
//   censoredWords: ['damn', 'shit']
// }
```

#### 3. `batch_check`

```typescript
const result = await api.callTool('batch_check', {
  texts: ['message1', 'message2', 'message3'],
  detectLeetspeak: true
});

// {
//   results: [...],
//   summary: { total: 3, flagged: 1, clean: 2 }
// }
```

#### 4. `analyze_context`

```typescript
const result = await api.callTool('analyze_context', {
  text: 'breast cancer screening',
  context: 'medical',
  ignoreWords: ['breast']
});

// {
//   containsProfanity: false,
//   contextAllowed: ['breast'],
//   safetyScore: 100
// }
```

### Custom Tool Workflow

```typescript
export function activate(api: OpenClawAPI) {
  registerProfanityTools(api);

  // Custom moderation workflow
  api.registerTool({
    name: 'moderate_message',
    description: 'Complete message moderation workflow',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        message: { type: 'string' },
        platform: { type: 'string' }
      },
      required: ['userId', 'message']
    },
    execute: async ({ userId, message, platform }) => {
      // 1. Check profanity
      const check = await api.callTool('check_profanity', {
        text: message,
        detectLeetspeak: true
      });

      if (check.containsProfanity) {
        // 2. Log violation
        await logViolation(userId, message, platform);

       // 3. Censor message
        const censored = await api.callTool('censor_text', {
          text: message,
          replaceWith: '***'
        });

        return {
          approved: false,
          censoredMessage: censored.processedText,
          reason: `Contains profanity: ${check.profaneWords.join(', ')}`
        };
      }

      return {
        approved: true,
        message
      };
    }
  });
}
```

---

## MCP Server

Use glin-profanity as an MCP (Model Context Protocol) server within OpenClaw.

### Setup

**Add to `openclaw.config.json5`:**

```json5
{
  mcpServers: {
    "glin-profanity": {
      command: "npx",
      args: ["-y", "@glin/openclaw-profanity", "mcp-server"]
    }
  }
}
```

### Available MCP Tools (19 Total)

1. `check_profanity` - Basic profanity check
2. `censor_text` - Censor profane words
3. `batch_check_profanity` - Check multiple texts
4. `analyze_context` - Context-aware analysis
5. `validate_content` - Multi-layer validation
6. `compare_strictness` - Test different levels
7. `suggest_alternatives` - Get replacements
8. `explain_match` - Explain flagged content
9. `get_supported_languages` - List languages
10-19. Advanced tools (see [MCP Guide](../mcp-guide.md))

### MCP Resources (22 Total)

Access complete documentation via MCP:

```
glin-profanity://docs/getting-started
glin-profanity://docs/features
glin-profanity://languages
... and 19 more
```

See [MCP Guide](../mcp-guide.md) for complete details.

---

## Configuration

### Complete Configuration Example

```typescript
// openclaw.config.ts
import { createProfanityGuard, registerProfanityTools } from '@glin/openclaw-profanity';

export default {
  // Skills configuration
  skills: {
    directory: './skills',
    autoload: true,
    config: {
      profanity_check: {
        languages: ['english', 'spanish'],
        detectLeetspeak: true,
        leetspeakLevel: 'moderate'
      }
    }
  },

  // Hooks configuration
  hooks: {
    'profanity-guard': createProfanityGuard({
      blockProfanity: true,
      detectLeetspeak: true,
      languages: ['english'],
      warningMessage: '⚠️ Your message contains inappropriate language.',
      platforms: ['whatsapp', 'telegram', 'discord'],
      trackViolations: true,
      violationThreshold: 3
    })
  },

  // Plugin configuration
  plugins: {
    profanity: {
      tools: true, // Register all tools
      customConfig: {
        cacheResults: true,
        cacheSize: 5000
      }
    }
  },

  // MCP configuration
  mcpServers: {
    "glin-profanity": {
      command: "npx",
      args: ["-y", "@glin/openclaw-profanity", "mcp-server"]
    }
  }
};
```

### Environment Variables

```bash
# Default languages
GLIN_PROFANITY_LANGUAGES=english,spanish,french

# Detection settings
GLIN_PROFANITY_LEETSPEAK=true
GLIN_PROFANITY_LEETSPEAK_LEVEL=moderate

# Performance
GLIN_PROFANITY_CACHE_SIZE=5000

# Logging
GLIN_PROFANITY_LOG_LEVEL=info
```

---

## Use Cases

### 1. WhatsApp Group Moderation

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  languages: ['english', 'spanish'],
  detectLeetspeak: true,
  platforms: ['whatsapp'],
  warningMessage: '⚠️ Tu mensaje contiene lenguaje inapropiado y fue bloqueado.',
  trackViolations: true,
  violationThreshold: 3,
  
  onViolation: async (user, violation) => {
    if (violation.count >= 3) {
      await openclaw.whatsapp.removeFromGroup(user.id);
      await openclaw.whatsapp.sendMessage(
        user.id,
        'Has sido removido por múltiples violaciones.'
      );
    }
  }
});
```

### 2. Multi-Platform Community Bot

```typescript
const guard = createProfanityGuard({
  // Different rules per platform
  platformOverrides: {
    discord: {
      blockProfanity: false,
      censorProfanity: true, // Discord allows censored
      detectLeetspeak: true
    },
    telegram: {
      blockProfanity: true,  // Telegram is strict
      detectLeetspeak: true
    },
    whatsapp: {
      blockProfanity: true,  // WhatsApp is strict
      detectLeetspeak: true,
      violationThreshold: 2  // Lower threshold
    }
  }
});
```

### 3. Customer Support Bot

```typescript
// Allow technical terms but block profanity
const guard = createProfanityGuard({
  blockProfanity: true,
  context: 'technical',
  excludeWords: ['abort', 'kill', 'execute'], // Technical terms
  detectLeetspeak: true,
  
  // Custom response
  warningMessage: '⚠️ Please keep language professional in support chats.',
  
  // Notify support team
  onViolation: async (user, violation) => {
    await notifySupportTeam({
      user: user.id,
      message: violation.content,
      platform: violation.platform
    });
  }
});
```

### 4. Educational Bot (Child-Safe)

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive', // Maximum detection
  languages: ['english'],
  
  // Very strict - block on first violation
  violationThreshold: 1,
  
  // Parent notification
  onViolation: async (user, violation) => {
    await notifyParent(user.parentId, {
      childId: user.id,
      incident: violation.content,
      timestamp: new Date()
    });
  }
});
```

### 5. Content Review Workflow

```typescript
export function activate(api: OpenClawAPI) {
  registerProfanityTools(api);

  api.registerTool({
    name: 'review_content',
    execute: async ({ content, author }) => {
      // Multi-layer check
      const check = await api.callTool('check_profanity', {
        text: content,
        detectLeetspeak: true
      });

      if (check.containsProfanity) {
        // Get alternatives
        const suggestions = await api.callTool('suggest_alternatives', {
          text: content
        });

        return {
          status: 'NEEDS_REVISION',
          issues: check.profaneWords,
          suggestions: suggestions.replacements,
          message: 'Content flagged for profanity. Please revise.'
        };
      }

      return {
        status: 'APPROVED',
        message: 'Content approved for publication'
      };
    }
  });
}
```

---

## Troubleshooting

### Hook Not Working

**Problem:** Messages not being moderated

**Solution:**

```typescript
// Verify hook is registered
console.log(openclaw.hooks); // Should show 'profanity-guard'

// Check hook priority
const guard = createProfanityGuard({
  blockProfanity: true,
  priority: 100 // Higher = runs first
});

// Enable debug logging
const guard = createProfanityGuard({
  blockProfanity: true,
  debug: true,
  logLevel: 'verbose'
});
```

### Skills Not Discovered

**Problem:** OpenClaw doesn't find profanity skills

**Solution:**

```bash
# Verify skills directory
ls -la ./skills/

# Should show:
# profanity_check/
# censor_message/
# content_guard/

# Check OpenClaw config
{
  skills: {
    directory: './skills',  // Correct path?
    autoload: true          // Enabled?
  }
}
```

### MCP Server Not Starting

**Problem:** MCP server fails to start

**Solution:**

```bash
# Test manually
npx @glin/openclaw-profanity mcp-server

# Check OpenClaw logs
openclaw logs --filter=mcp

# Verify configuration
cat openclaw.config.json5 | grep -A5 mcpServers
```

### False Positives

**Problem:** Legitimate words flagged

**Solution:**

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  
  // Add exceptions
  excludeWords: ['scunthorpe', 'assassin'],
  
  // Use context
  context: 'medical', // or 'gaming', 'technical'
  
  // Reduce leetspeak sensitivity
  leetspeakLevel: 'basic' // instead of 'aggressive'
});
```

---

## Best Practices

### ✅ Do

- Start with Skills or Hooks (simplest)
- Use appropriate strictness per platform
- Track violations for repeat offenders
- Provide clear feedback to users
- Test with real messages before production
- Use context-specific exclusions
- Monitor false positive rates

### ❌ Don't

- Block all messages indiscriminately
- Use same config for all platforms
- Ignore user feedback on false positives
- Forget to handle edge cases
- Skip testing with obfuscated text
- Disable logging in production

---

## Performance

| Operation | Performance | Notes |
|-----------|-------------|-------|
| Simple check (uncached) | ~300,000 ops/sec | Basic profanity detection |
| With leetspeak | ~180,000 ops/sec | Moderate level |
| Hook overhead | < 1ms | Per message |
| Skill invocation | < 5ms | Includes AI parsing |

**Optimization:**

```typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  
  // Enable caching
  cacheResults: true,
  cacheSize: 5000,
  
  // Optimize languages
  languages: ['english'], // Only what you need
  
  // Moderate leetspeak level
  leetspeakLevel: 'moderate'
});
```

---

## Next Steps

- [OpenClaw Documentation](https://openclaw.dev)
- [MCP Guide](../mcp-guide.md)
- [Features Overview](../features.md)
- [Examples](../examples.md)

---

**Questions?** Open an issue on [GitHub](https://github.com/GLINCKER/glin-profanity/issues) or ask in [Discord](https://discord.gg/openclaw).
