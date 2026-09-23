# Glin Profanity — AI Guardrail for VS Code

Highlight **profanity**, **PII**, **secrets**, and **prompt-injection** directly in your editor,
powered by the [glin-profanity](https://github.com/glincker/glin-profanity) scanner suite.

## Features

- Red squiggles for secrets (API keys, tokens) and prompt-injection attempts
- Yellow squiggles for profanity and personally identifiable information (PII)
- Scan on save (default) or on every keystroke (opt-in, debounced 500 ms)
- Configurable scanner subset — run only the checks you need
- Three strictness levels: `lenient`, `moderate`, `strict`
- Works offline — no network calls, no telemetry

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `glinProfanity.enableOnSave` | boolean | `true` | Scan whenever a file is saved |
| `glinProfanity.enableOnType` | boolean | `false` | Scan as you type (debounced 500 ms) |
| `glinProfanity.scanners` | string[] | `["profanity","secrets","pii"]` | Active scanners |
| `glinProfanity.strictness` | string | `"moderate"` | Detection aggressiveness |

### Available scanners
- `profanity` — multi-language profanity (24 languages, leetspeak-aware)
- `injection` — prompt-injection and jailbreak patterns
- `secrets` — API keys, tokens, credentials, private keys
- `pii` — emails, phone numbers, SSNs, credit cards, IBANs

## Commands

- **Glin Profanity: Scan Active File** — trigger a manual scan
- **Glin Profanity: Clear Diagnostics** — remove all highlights

## Installation

Once published to the VS Code Marketplace (follow-up sprint):

```
ext install glincker.glin-profanity-vscode
```

## Screenshots

<!-- TODO: add screenshots after first Marketplace publish -->

## Community

Join the [GLINR Discord](https://discord.gg/Ar5pcaZB99) and drop by the `#glin-profanity` forum for questions and discussion.

<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="Join the GLINR Discord" /></a>

## License

MIT — same as the core glin-profanity library.
