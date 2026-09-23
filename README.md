<h1 align="center">GLIN PROFANITY</h1>

<p align="center">
  <strong>The Open-Source AI Guardrail. Profanity, PII, Secrets, Soon: Prompt Injection — One Library, One MCP Server, Runs Offline.</strong>
</p>

<!-- Badges Row 1: Package Info -->
<p align="center">
  <a href="https://www.npmjs.com/package/glin-profanity"><img src="https://img.shields.io/npm/v/glin-profanity?style=flat-square&logo=npm&logoColor=white&label=npm" alt="npm version" /></a>
  <a href="https://pypi.org/project/glin-profanity/"><img src="https://img.shields.io/pypi/v/glin-profanity?style=flat-square&logo=pypi&logoColor=white&label=pypi" alt="PyPI version" /></a>
  <a href="https://www.npmjs.com/package/glin-profanity"><img src="https://img.shields.io/npm/dm/glin-profanity?style=flat-square&logo=npm&logoColor=white&label=npm%20downloads" alt="npm downloads" /></a>
  <a href="https://pepy.tech/projects/glin-profanity"><img src="https://img.shields.io/pepy/dt/glin-profanity?style=flat-square&logo=pypi&logoColor=white&label=pypi%20downloads" alt="PyPI downloads" /></a>
</p>

<!-- Badges Row 2: Quality & Status -->
<p align="center">
  <a href="https://github.com/GLINCKER/glin-profanity/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/GLINCKER/glin-profanity/ci.yml?style=flat-square&logo=github&label=CI" alt="CI Status" /></a>
  <a href="https://bundlephobia.com/package/glin-profanity"><img src="https://img.shields.io/bundlephobia/minzip/glin-profanity?style=flat-square&logo=webpack&logoColor=white&label=bundle%20size" alt="Bundle Size" /></a>
  <a href="https://github.com/GLINCKER/glin-profanity/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GLINCKER/glin-profanity?style=flat-square&label=license" alt="License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
</p>

<!-- Badges Row 3: Community -->
<p align="center">
  <a href="https://github.com/GLINCKER/glin-profanity/stargazers"><img src="https://img.shields.io/github/stars/GLINCKER/glin-profanity?style=flat-square&logo=github&label=stars" alt="GitHub Stars" /></a>
  <a href="https://github.com/GLINCKER/glin-profanity/network/members"><img src="https://img.shields.io/github/forks/GLINCKER/glin-profanity?style=flat-square&logo=github&label=forks" alt="GitHub Forks" /></a>
  <a href="https://github.com/GLINCKER/glin-profanity/issues"><img src="https://img.shields.io/github/issues/GLINCKER/glin-profanity?style=flat-square&logo=github&label=issues" alt="GitHub Issues" /></a>
  <a href="https://github.com/GLINCKER/glin-profanity/graphs/contributors"><img src="https://img.shields.io/github/contributors/GLINCKER/glin-profanity?style=flat-square&logo=github&label=contributors" alt="Contributors" /></a>
  <a href="https://discord.gg/Ar5pcaZB99"><img src="https://img.shields.io/discord/829168897080557579?style=flat-square&logo=discord&logoColor=white&label=discord&color=5865F2" alt="Discord" /></a>
</p>

<!-- Hero Image -->
<p align="center">
  <a href="https://www.glincker.com/tools/glin-profanity" target="_blank">
    <img src="./og-image.png" alt="Glin Profanity - ML-Powered Profanity Detection" width="800" />
  </a>
</p>

<p align="center">
  <a href="https://www.glincker.com/tools/glin-profanity"><img src="https://img.shields.io/badge/Try_Live_Demo-online-blue?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
</p>

---

## 📦 Packages

This monorepo maintains the following packages:

| Package | Version | Description |
|---------|---------|-------------|
| [glin-profanity](https://www.npmjs.com/package/glin-profanity) | [![npm](https://img.shields.io/npm/v/glin-profanity?style=flat-square)](https://www.npmjs.com/package/glin-profanity) | Core profanity filter for JavaScript/TypeScript |
| [glin-profanity](https://pypi.org/project/glin-profanity/) | [![PyPI](https://img.shields.io/pypi/v/glin-profanity?style=flat-square)](https://pypi.org/project/glin-profanity/) | Core profanity filter for Python |
| [glin-profanity-mcp](https://www.npmjs.com/package/glin-profanity-mcp) | [![npm](https://img.shields.io/npm/v/glin-profanity-mcp?style=flat-square)](https://www.npmjs.com/package/glin-profanity-mcp) | MCP server for AI assistants (Claude, Cursor, etc.) |
| [openclaw-profanity](https://www.npmjs.com/package/openclaw-profanity) | [![npm](https://img.shields.io/npm/v/openclaw-profanity?style=flat-square)](https://www.npmjs.com/package/openclaw-profanity) | Plugin for OpenClaw/Moltbot AI agents |

---

## Why Glin Profanity?

Modern AI applications need more than a word list. Users evade filters with `f4ck`, `sh1t`, and `fսck` (Cyrillic `ս` → `u`). LLM pipelines leak PII and secrets into logs. Prompt injection slips through unguarded inboxes. Today's moderation problem is a guardrail problem — and most solutions leave you choosing between a Python-only library, a Llama-licensed model, or a paid cloud API.

Glin Profanity is the **MIT-licensed, Node-native, MCP-first** answer. It runs entirely offline, ships a 12 KB core bundle with no mandatory cloud calls, integrates with Claude/Cursor/Windsurf via 24 MCP tools out of the box, and covers 24 languages with leetspeak and Unicode homoglyph evasion detection built in. Prompt-injection, PII, and secrets scanning are all shipped today.

**vs. Meta PurpleLlama** — Python + Llama Community License, requires downloading weights, no Node support, no MCP server.
**vs. ProtectAI llm-guard** — Python-only, heavy transformer dependencies, no edge/browser runtime.
**vs. Azure Content Safety** — paid cloud API, data leaves your infra, rate-limited.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GLIN PROFANITY v3                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Input Text ──►  Unicode       ──►  Leetspeak    ──►  Dictionary  ──► ML  │
│                   Normalization      Detection         Matching        Check│
│                   (homoglyphs)       (f4ck→fuck)       (24 langs)     (opt) │
│                                                                             │
│   "fսck"     ──►  "fuck"        ──►  "fuck"       ──►  MATCH       ──► ✓   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Benchmarks

From the CI shootout gate (`benchmarks/shootout/results.md`), Node.js v22, 20-input torture-set batches:

| Library | ops/sec | F1 (accuracy) | False-Positive Rate |
|---------|---------|---------------|---------------------|
| glin-profanity | 990 | **80.6%** | **0.0%** |
| obscenity | 5,112 | 79.5% | 5.9% |
| bad-words | 241 | 54.2% | 0.0% |
| leo-profanity | 338,407 | 34.6% | 0.0% |
| @2toad/profanity | 839,796 | 56.7% | 0.0% |

glin-profanity trades raw throughput for zero false positives and the highest F1 in the field. See `benchmarks/shootout/results.md` for the full per-category breakdown.

---

## Feature Comparison

| Feature | glin-profanity | obscenity | Detoxify | PurpleLlama | llm-guard |
|---------|:--------------:|:---------:|:--------:|:-----------:|:---------:|
| MIT license | Yes | Yes | Apache-2.0 | Llama Community | Apache-2.0 |
| Node-native | Yes | Yes | No | No | No |
| Python package | Yes | No | Yes | Yes | Yes |
| MCP server (24 tools) | Yes | No | No | No | No |
| Runs fully offline | Yes | Yes | Yes | Yes (needs weights) | Yes |
| Leetspeak detection | Yes | Partial | No | No | No |
| Unicode homoglyph detection | Yes | No | No | No | No |
| Multi-language support | 24 languages | English only | 6 languages | English only | English only |
| ML toxicity detection | Yes (TensorFlow.js, opt-in) | No | Yes (PyTorch) | Yes (Llama) | Yes (transformers) |
| Edge / browser runtime | Yes | Yes | No | No | No |
| Bundle size (core, minified) | 12 KB | 6 KB | N/A | N/A | N/A |
| Prompt-injection detection | Yes (shipped) | No | No | Yes | Yes |
| PII / secrets scanning | Yes (shipped) | No | No | No | Yes |

---

## Installation

**JavaScript/TypeScript**
```bash
npm install glin-profanity
```

**Python**
```bash
pip install glin-profanity
```

---

## Quick Start

**JavaScript**
```javascript
import { checkProfanity, Filter } from 'glin-profanity';

// Simple check
const result = checkProfanity("This is f4ck1ng bad", {
  detectLeetspeak: true,
  languages: ['english']
});

result.containsProfanity  // true
result.profaneWords       // ['fucking']

// With replacement
const filter = new Filter({
  replaceWith: '***',
  detectLeetspeak: true
});
filter.checkProfanity("sh1t happens").processedText  // "*** happens"
```

**Python**
```python
from glin_profanity import Filter

filter = Filter({"languages": ["english"], "replace_with": "***"})

filter.is_profane("damn this")           # True
filter.check_profanity("damn this")      # Full result object
```

**React**
```tsx
import { useProfanityChecker } from 'glin-profanity';

function ChatInput() {
  const { result, checkText } = useProfanityChecker({
    detectLeetspeak: true
  });

  return (
    <input onChange={(e) => checkText(e.target.value)} />
    {result?.containsProfanity && <span>Clean up your language</span>}
  );
}
```

---

## Architecture

```mermaid
flowchart LR
    subgraph Input
        A[Raw Text]
    end

    subgraph Processing
        B[Unicode Normalizer]
        C[Leetspeak Decoder]
        D[Word Tokenizer]
    end

    subgraph Detection
        E[Dictionary Matcher]
        F[Fuzzy Matcher]
        G[ML Toxicity Model]
    end

    subgraph Output
        H[Result Object]
    end

    A --> B --> C --> D
    D --> E --> H
    D --> F --> H
    D -.->|Optional| G -.-> H
```

---

## Detection Capabilities

### Leetspeak Detection

```javascript
const filter = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive'  // basic | moderate | aggressive
});

filter.isProfane('f4ck');     // true
filter.isProfane('5h1t');     // true
filter.isProfane('@$$');      // true
filter.isProfane('ph.u" "ck'); // true (aggressive mode)
```

### Unicode Homoglyph Detection

```javascript
const filter = new Filter({ normalizeUnicode: true });

filter.isProfane('fսck');   // true (Armenian 'ս' → 'u')
filter.isProfane('shіt');   // true (Cyrillic 'і' → 'i')
filter.isProfane('ƒuck');   // true (Latin 'ƒ' → 'f')
```

### ML-Powered Detection

```javascript
import { loadToxicityModel, checkToxicity } from 'glin-profanity/ml';

await loadToxicityModel({ threshold: 0.9 });

const result = await checkToxicity("You're the worst player ever");
// { toxic: true, categories: { toxicity: 0.92, insult: 0.87, ... } }
```

---

## Supported Languages

24 languages with curated dictionaries:

| | | | |
|---|---|---|---|
| Arabic | Chinese | Czech | Danish |
| Dutch | English | Esperanto | Finnish |
| French | German | Hindi | Hungarian |
| Italian | Japanese | Korean | Norwegian |
| Persian | Polish | Portuguese | Russian |
| Spanish | Swedish | Thai | Turkish |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](./docs/getting-started.md) | Installation and basic usage |
| [API Reference](./docs/api-reference.md) | Complete API documentation |
| [Framework Examples](./docs/framework-examples.md) | React, Vue, Angular, Express, Next.js |
| [Advanced Features](./docs/advanced-features.md) | Leetspeak, Unicode, ML, caching |
| [ML Guide](./docs/ML-GUIDE.md) | TensorFlow.js integration |
| [Changelog](./CHANGELOG.md) | Version history |

---

## Local Testing Interface

Run the interactive playground locally to test profanity detection:

```bash
# Clone the repo
git clone https://github.com/GLINCKER/glin-profanity.git
cd glin-profanity/packages/js

# Install dependencies
npm install

# Start the local testing server
npm run dev:playground
```

Open **http://localhost:4000** to access the testing interface with:
- Real-time profanity detection
- Toggle leetspeak, Unicode normalization, ML detection
- Multi-language selection
- Visual results with severity indicators

---

## Use Cases

| Application | How Glin Profanity Helps |
|-------------|-------------------------|
| Chat platforms | Real-time message filtering with React hook |
| Gaming | Detect obfuscated profanity in player names/chat |
| Social media | Scale moderation with ML-powered detection |
| Education | Maintain safe learning environments |
| Enterprise | Filter internal communications |
| AI/ML pipelines | Clean training data before model ingestion |

---

## MCP Server for AI Assistants

Glin Profanity includes an MCP (Model Context Protocol) server that enables AI assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and other MCP-compatible tools to use profanity detection as a native tool.

### Quick Setup

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "glin-profanity": {
      "command": "npx",
      "args": ["-y", "glin-profanity-mcp"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "glin-profanity": {
      "command": "npx",
      "args": ["-y", "glin-profanity-mcp"]
    }
  }
}
```

### Available Tools (24)

| Tool | Description |
|------|-------------|
| `check_profanity` | Check text for profanity with detailed results |
| `censor_text` | Censor profanity with configurable replacement |
| `analyze_context` | Context-aware analysis with domain whitelists |
| `batch_check` | Check multiple texts in one operation |
| `validate_content` | Content validation with safety scoring (0-100) |
| `detect_obfuscation` | Detect leetspeak and Unicode tricks |
| `get_supported_languages` | List all 24 supported languages |
| `explain_match` | Explain why text was flagged with reasoning |
| `suggest_alternatives` | Suggest clean alternatives for profane content |
| `analyze_corpus` | Analyze up to 500 texts for moderation stats |
| `compare_strictness` | Compare results across strictness levels |
| `create_regex_pattern` | Generate regex patterns for custom detection |
| `track_user_message` | Track user messages for repeat offender detection |
| `get_user_profile` | Get moderation profile for a specific user |
| `get_high_risk_users` | List users with high violation rates |
| `reset_user_profile` | Reset a user's moderation history |
| `stream_check` | Real-time streaming profanity check |
| `stream_batch` | Stream multiple texts with live results |
| `get_stream_stats` | Get streaming session statistics |
| `check_prompt_injection` | Scan text for prompt injection attacks (rule-based, 50 patterns) |
| `scan_secrets` | Detect leaked API keys, tokens, and credentials (110 patterns + entropy) |
| `scan_pii` | Detect PII: email, phone, SSN, credit card, IBAN, passport, and more |
| `redact_pii` | Redact PII into reversible vault-backed placeholders |
| `restore_pii` | Restore PII placeholders to original values via vault session |

**Plus 5 workflow prompts** and **5 reference resources** for guided AI interactions.

### Example Prompts for AI Assistants

```
"Check this user comment for profanity using glin-profanity"
"Validate this blog post content with high strictness"
"Batch check these 50 messages for any inappropriate content"
"Analyze this medical text with the medical domain context"
```

See the full [MCP documentation](./packages/mcp/README.md) for setup instructions and examples.

---

## Shipped AI Guardrails

The scanner layer is live. Import from `glin-profanity/scanners`:

```js
import { PromptInjectionScanner, SecretsScanner, PiiScanner, Vault, scanAll } from 'glin-profanity/scanners';
```

| Scanner | Coverage |
|---------|----------|
| `PromptInjectionScanner` | 50 patterns across 6 attack categories |
| `SecretsScanner` | 110 patterns (AWS, GCP, Azure, GitHub, Stripe, OpenAI, Anthropic, …) + Shannon entropy |
| `PiiScanner` | 27 patterns with Luhn + IBAN mod-97 validation |
| `Vault` | Placeholder-based redact/restore with 4 strategies |
| `scanAll` | Composite scanner — runs all of the above in one call |

## Coming in 2026

The following capabilities are on the active roadmap.

| Feature | ETA | Notes |
|---------|-----|-------|
| **`glincker/glin-guard-small` on HF Hub** | Q3 2026 | Our own distilled toxicity model, MIT weights, designed for edge inference |
| **AI-slop detection** | Q3 2026 | Pattern-based detector for generic AI-generated prose |
| **Bluesky Ozone labeler adapter** | Q4 2026 | Drop-in labeler for AT Protocol moderation pipelines |
| **Compliance presets** | Q4 2026 | Pre-tuned configs for UK OSA, EU DSA, and COPPA requirements |

See [ROADMAP.md](./ROADMAP.md) for the full issue backlog and contribution opportunities.

---

## License

MIT License - free for personal and commercial use.

Enterprise licensing with SLA and support available from [GLINCKER](https://glincker.com).

---

## Community

Join the [GLINR Discord](https://discord.gg/Ar5pcaZB99) to ask questions, share feedback, or talk with other users of Glin Profanity. This project has its own forum channel there, `#glin-profanity`.

<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="Join the GLINR Discord" /></a>

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines. We welcome:

- Bug reports and fixes
- New language dictionaries
- Performance improvements
- Documentation updates

---

## Star History

<a href="https://star-history.com/#GLINCKER/glin-profanity&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=GLINCKER/glin-profanity&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=GLINCKER/glin-profanity&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=GLINCKER/glin-profanity&type=Date" />
 </picture>
</a>

---

<div align="center">

**[Live Demo](https://www.glincker.com/tools/glin-profanity)** · **[NPM](https://www.npmjs.com/package/glin-profanity)** · **[PyPI](https://pypi.org/project/glin-profanity/)** · **[GitHub](https://github.com/GLINCKER/glin-profanity)**

<br />

<a href="https://github.com/GLINCKER/glin-profanity/stargazers">
  <img src="https://img.shields.io/github/stars/GLINCKER/glin-profanity?style=social" alt="Star on GitHub" />
</a>

<br /><br />

<sub>Built by <a href="https://glincker.com">GLINCKER</a> · Part of the <a href="https://github.com/GLINCKER">GLINR</a> ecosystem</sub>

</div>
