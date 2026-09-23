<div align="center">

<img src="https://dev-to-uploads.s3.amazonaws.com/uploads/articles/66tazty4o06aptvs6m7b.png" alt="openclaw-profanity - Block Profanity, Protect Your AI, Save Money" width="100%" />

# openclaw-profanity

**Content moderation plugin for OpenClaw, Moltbot & Clawdbot AI agents**

[![npm version](https://img.shields.io/npm/v/openclaw-profanity.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/openclaw-profanity)
[![Downloads](https://img.shields.io/npm/dm/openclaw-profanity.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/openclaw-profanity)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![glin-profanity](https://img.shields.io/badge/powered%20by-glin--profanity-blue?style=for-the-badge)](https://www.npmjs.com/package/glin-profanity)

[Installation](#installation) · [Quick Start](#quick-start) · [API Reference](#api-reference) · [Documentation](https://github.com/GLINCKER/glin-profanity/tree/release/packages/openclaw)

</div>

---

## Why openclaw-profanity?

Your AI agent uses GPT, Claude, or Gemini. Why pay for profanity checking?

| | AI-Only Moderation | openclaw-profanity |
|---|---|---|
| **Cost** | $100-300/month | **$0** |
| **Latency** | 200-500ms | **< 1ms** |
| **Rate Limits** | API limits | **None** |
| **Availability** | Depends on API | **Always on** |

**openclaw-profanity** runs locally. No API calls. No costs. Sub-millisecond response.

---

## Features

| Feature | Description |
|---------|-------------|
| **24 Languages** | English, Spanish, French, German, Portuguese, Italian, Dutch, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Turkish, Polish, Vietnamese, Thai, Swedish, Norwegian, Danish, Finnish, Czech, Hungarian, Greek |
| **Evasion Detection** | Catches leetspeak (`f4ck`, `sh1t`), Unicode tricks (`fսck`), character spacing (`f u c k`), symbols (`f*ck`) |
| **Multiple Integrations** | Skills, Hooks, Plugin API, MCP, Direct API |
| **Platform Support** | WhatsApp, Telegram, Discord, Slack, iMessage, Teams, Matrix, Signal |
| **Context-Aware** | Understands appropriate word usage in gaming, quotes, medical contexts |
| **Zero Dependencies** | Only requires `glin-profanity` core library |

---

## Installation

```bash
# npm
npm install openclaw-profanity

# yarn
yarn add openclaw-profanity

# pnpm
pnpm add openclaw-profanity

# OpenClaw CLI
openclaw plugins install openclaw-profanity
```

---

## Quick Start

### Option 1: Profanity Guard Hook (Recommended)

The simplest integration—one hook filters all messages automatically.

```javascript
import { OpenClawAgent } from "openclaw";
import { profanityGuardHook } from "openclaw-profanity/hooks";

const agent = new OpenClawAgent({
  // your config
});

// Add the profanity guard - that's it!
agent.useHook(profanityGuardHook({
  action: "censor",           // "censor" or "block"
  languages: ["en", "es"],    // languages to check
  replacement: "***",         // censorship character
  onViolation: (msg, result) => {
    console.log(`Filtered: ${result.profaneWords.join(", ")}`);
  }
}));

agent.start();
```

**Actions:**
- `action: "censor"` — Replaces profanity with `***` and continues
- `action: "block"` — Stops the message, sends warning to user

### Option 2: Custom Skill

Create a reusable skill your agent can call programmatically.

```javascript
import { defineSkill } from "openclaw";
import { checkProfanity, censorText } from "openclaw-profanity/skills";

export const moderationSkill = defineSkill({
  name: "content-moderation",
  description: "Check and filter profanity from user messages",

  actions: {
    check: {
      description: "Check text for profanity",
      parameters: { text: { type: "string", required: true } },
      handler: async ({ text }) => {
        const result = checkProfanity(text);
        return {
          containsProfanity: result.containsProfanity,
          profaneWords: result.profaneWords,
          confidence: result.confidence
        };
      }
    },

    censor: {
      description: "Censor profanity in text",
      parameters: { text: { type: "string", required: true } },
      handler: async ({ text }) => {
        const result = censorText(text);
        return {
          original: result.originalText,
          censored: result.processedText,
          wordsCensored: result.censoredWords
        };
      }
    }
  }
});

// Register with your agent
agent.useSkill(moderationSkill);
```

### Option 3: Direct Integration

For full control, use the library directly in your message handler.

```javascript
import { checkProfanity, censorText } from "openclaw-profanity";

async function handleIncomingMessage(message, context) {
  const check = checkProfanity(message.text, {
    languages: ["en", "es", "fr"],
    detectLeetspeak: true,
    detectUnicode: true
  });

  if (check.containsProfanity) {
    if (check.confidence > 0.9) {
      return context.reply("Please keep the conversation respectful.");
    }
    const censored = censorText(message.text);
    message.text = censored.processedText;
  }

  return context.next(message);
}
```

### Option 4: MCP (Model Context Protocol)

```json5
// openclaw.config.json5
{
  mcp: {
    servers: {
      "glin-profanity": {
        command: "npx",
        args: ["-y", "glin-profanity-mcp"]
      }
    }
  }
}
```

---

## Platform Examples

### WhatsApp Bot

```javascript
import { WhatsAppAdapter } from "openclaw/adapters/whatsapp";
import { profanityGuardHook } from "openclaw-profanity/hooks";

const agent = new OpenClawAgent({
  adapter: new WhatsAppAdapter({ /* config */ })
});

agent.useHook(profanityGuardHook({
  action: "censor",
  languages: ["en", "es", "pt"]
}));
```

### Telegram Bot

```javascript
import { TelegramAdapter } from "openclaw/adapters/telegram";
import { profanityGuardHook } from "openclaw-profanity/hooks";

const agent = new OpenClawAgent({
  adapter: new TelegramAdapter({
    token: process.env.TELEGRAM_BOT_TOKEN
  })
});

agent.useHook(profanityGuardHook({
  action: "block",
  warningMessage: "Please keep the chat friendly!"
}));
```

### Discord Bot

```javascript
import { DiscordAdapter } from "openclaw/adapters/discord";
import { profanityGuardHook } from "openclaw-profanity/hooks";

const agent = new OpenClawAgent({
  adapter: new DiscordAdapter({
    token: process.env.DISCORD_BOT_TOKEN
  })
});

agent.useHook(profanityGuardHook({
  action: "censor",
  onViolation: async (msg, result, context) => {
    await msg.delete();
    await context.reply(`${msg.author}: ${result.censoredText}`);
  }
}));
```

### Slack Bot

```javascript
import { SlackAdapter } from "openclaw/adapters/slack";
import { profanityGuardHook } from "openclaw-profanity/hooks";

const agent = new OpenClawAgent({
  adapter: new SlackAdapter({
    token: process.env.SLACK_BOT_TOKEN
  })
});

agent.useHook(profanityGuardHook({ action: "censor" }));
```

---

## API Reference

### Available Tools

| Tool | Description |
|------|-------------|
| `check_profanity` | Check text for profanity in 24 languages |
| `censor_text` | Censor profanity with custom replacement |
| `batch_check_profanity` | Check multiple texts at once |
| `analyze_profanity_context` | Context-aware analysis |
| `get_supported_languages` | List all 24 supported languages |

### Skills

| Skill | Description |
|-------|-------------|
| `profanity_check` | Check messages for inappropriate content |
| `censor_message` | Automatically censor profanity |
| `content_guard` | Proactive content moderation |

### Hooks

| Hook | Description |
|------|-------------|
| `profanity-guard` | Auto-moderate all messages |

### Configuration

```javascript
import { Filter } from "openclaw-profanity";

const filter = new Filter({
  languages: ["en", "es", "fr"],      // Languages to check
  detectLeetspeak: true,               // f4ck, sh1t
  detectUnicode: true,                 // Cyrillic/Greek tricks
  detectSpacing: true,                 // f u c k
  replaceWith: "*",                    // Replacement character
  preserveLength: true,                // **** vs ***
  whitelist: ["assistant", "class"],   // Words to ignore
  customWords: ["badword1"]            // Custom words to add
});
```

### Moderation Modes

| Mode | Description |
|------|-------------|
| **Strict** | No tolerance, blocks all profanity |
| **Moderate** | Context-aware, allows appropriate usage |
| **Lenient** | Only flags severe profanity |

---

## Advanced: Hybrid AI + Local Filtering

Use local filtering for speed, escalate edge cases to AI.

```javascript
import { checkProfanity } from "openclaw-profanity";

async function smartModeration(message, agent) {
  const localCheck = checkProfanity(message.text);

  if (!localCheck.containsProfanity) {
    return { action: "allow" };
  }

  if (localCheck.confidence > 0.95) {
    return { action: "block" };
  }

  // Uncertain - ask AI (rare, ~5% of cases)
  const aiAnalysis = await agent.analyze({
    prompt: `Is this message inappropriate? "${message.text}"`,
    format: "json"
  });

  return aiAnalysis.inappropriate
    ? { action: "block" }
    : { action: "allow" };
}
```

**Result:** 95% handled instantly (free, <1ms), 5% escalated to AI, 90%+ cost reduction.

---

## Compatibility

| Framework | Status |
|-----------|--------|
| **OpenClaw** v1.x+ | ✅ Supported |
| **Moltbot** (legacy) | ✅ Supported |
| **Clawdbot** (original) | ✅ Supported |

---

## Part of the glin-profanity Ecosystem

| Package | Description |
|---------|-------------|
| [glin-profanity](https://www.npmjs.com/package/glin-profanity) | Core profanity filter for JavaScript/TypeScript |
| [glin-profanity-mcp](https://www.npmjs.com/package/glin-profanity-mcp) | MCP server for Claude Desktop, Cursor, Windsurf |
| [glin-profanity (Python)](https://pypi.org/project/glin-profanity/) | Python version for Flask/Django |

---

## Links

- **npm**: [openclaw-profanity](https://www.npmjs.com/package/openclaw-profanity)
- **GitHub**: [GLINCKER/glin-profanity](https://github.com/GLINCKER/glin-profanity)
- **Documentation**: [Integration Guide](https://github.com/GLINCKER/glin-profanity/tree/release/packages/openclaw)
- **Live Demo**: [glincker.com/tools/glin-profanity](https://www.glincker.com/tools/glin-profanity)
- **Tutorial**: [OpenClaw Profanity Filter Guide](https://dev.to/glincker/how-to-add-profanity-filtering-to-your-openclawmoltbotclawdbot-agent)

---

## Community

Join the [GLINR Discord](https://discord.gg/Ar5pcaZB99) and drop by the `#glin-profanity` forum for questions and discussion.

<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="Join the GLINR Discord" /></a>

---

## License

MIT

---

<div align="center">

**[Get Started Now](#installation)** · Star on [GitHub](https://github.com/GLINCKER/glin-profanity)

Built with [glin-profanity](https://github.com/GLINCKER/glin-profanity) by [GLINCKER](https://glincker.com)

</div>

<!-- SEO Keywords: openclaw profanity filter, moltbot profanity, clawdbot profanity, moltbot content moderation, clawdbot content moderation, openclaw content moderation, openclaw plugin, moltbot plugin, clawdbot plugin, moltbot skill, clawdbot skill, ai agent content moderation, whatsapp profanity filter, telegram profanity filter, discord profanity filter, slack profanity filter, whatsapp bot moderation, telegram bot moderation, discord bot moderation, best profanity filter npm 2026, chatbot moderation javascript, ai safety, content safety -->
