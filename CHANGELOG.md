# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Obfuscation pipeline (`obfuscation`: off | basic | standard | strict) and `whitelist` option; see docs/MIGRATION-4.0.md
- Unified Scanner interface for pluggable detectors (`Scanner`, `ScanResult`, `ScanDecision`)
- `PromptInjectionScanner` — 50 patterns across 6 attack categories, decision-based output (ALLOW / HITL / BLOCK)
- `SecretsScanner` — 110 patterns across AWS, GCP, Azure, GitHub, Slack, Stripe, OpenAI, Anthropic, and more; Shannon entropy detection for high-entropy tokens
- `PiiScanner` — 27 patterns with Luhn credit-card validation and IBAN mod-97 check
- `Vault` — placeholder-based redact/restore with 4 strategies (exact, caseInsensitive, fuzzy, combined)
- `scanAll` / `scan_all` composite scanner (JS + Python) — runs all scanners in one call
- 4 new MCP tools: `check_prompt_injection`, `scan_secrets`, `scan_pii`, `redact_pii`, `restore_pii` (total MCP tool count: 24)
- Python parity for all new scanners (`PromptInjectionScanner`, `SecretsScanner`, `PiiScanner`, `Vault`, `scan_all`)
- VS Code extension scaffold (`packages/vscode-extension`, v0.1.0)
- Gradio Hugging Face Space (`packages/huggingface-space`) — 5-tab multi-scanner demo
- Benchmark shootout CI gate (`benchmarks/shootout/`) — F1 regression guard vs obscenity, bad-words, leo-profanity, @2toad/profanity
- Aho-Corasick dictionary matcher (JS + Python) with legacy regex fallback via `disableAhoCorasick` / `disable_aho_corasick`
- CJK automatic matching by word script — Latin terms use `\b` boundaries; CJK terms match as substrings (including ASCII adjacency)
- Context-aware profanity filtering (`ContextAnalyzer`) with positive/negative context scoring, phrase whitelists, and gaming domain whitelists (JS + Python parity)
- Python filter instance pool (`get_pooled_filter`, `create_filter_config`, `clear_filter_pool`) mirroring JS `filterPool`
- Expanded cross-language parity tests covering CJK matching, context-aware optimization, and `is_profane` agreement
- Evasion normalization pipeline (`normalizeEvasion`) — HTML tag/entity decoding, separator collapse (`f.u.c.k`), asterisk masking (`f*cking`, `f***`), abbreviated insults (`go f yourself`)
- Armenian homoglyph support (`ս` → `u`) and aggressive leetspeak `@` → `u` variant for patterns like `f@cking`
- Added `shite` to English dictionary (covers `shi7e` leetspeak variant)

### Changed
- Documentation throughput claims replaced with reproducible figures (uncached about 300,000 ops/sec; result-cache hit about 25M ops/sec)
- Default scan now catches separators, masks, stretched letters and HTML-encoded words; `matches[].index` refers to the original input
- Scanner implementations live at `glin-profanity/scanners` subpath export to keep core bundle unchanged; root entry exports types only
- `ScanMatch.category` now carries pattern family (e.g. `"stripe"`, `"aws_access_key"`) instead of severity
- Context-aware mode enables Aho-Corasick candidate discovery even when `wordBoundaries` / `word_boundaries` is `false`
- `isProfane` / `is_profane` apply context filtering when `enableContextAware` / `enable_context_aware` is enabled
- Filter instance pools use LRU touch-on-access eviction (JS Map reorder + Python `OrderedDict.move_to_end`)
- Evasion normalization can be disabled via `enableEvasionNormalization` / `enable_evasion_normalization` (default: on)

### Fixed
- Word-boundary matching no longer uses an ASCII-only `\b` for dictionary words that start or end with a non-ASCII letter. Russian, Arabic, Chinese, Korean, Japanese, Thai, Persian and edge letters in Turkish, Finnish, Polish and others now match with the default `wordBoundaries: true` (JS and Python); see docs/MIGRATION-4.0.md
- PI-034 missing `/i` flag (only matched ALL-CAPS variants)
- PI-036 removed negative lookbehind for broader runtime support (Safari, older Node)
- Overlapping match range deduplication in secrets redaction
- Python legacy fuzzy matching restricted to `word_boundaries=false` (aligned with JS)
- Latin word-boundary checks use correct start/end positions (fixes Scunthorpe/classic false positives)
- Korean NFKD normalization gaps — original/normalized/aggressive three-variant matching in both JS and Python
- Normalized-variant matches map spans back to original text for context analysis and `replaceWith`
- Context-aware recording analyzes context once per match (no duplicate `analyzeContext` calls)
- `checkProfanity` AC path records original matched substrings instead of dictionary keys for normalized variants
- `hasAnyMatch` early-exits on first hit instead of collecting all matches (JS + Python)
- Case-sensitive mode builds Aho-Corasick automaton from original-case dictionary entries
- JS `allowObfuscatedMatch` skipped when `detectLeetspeak` is enabled (parity with Python)
- Python `clear_cache` now clears compiled regex cache
- Python package exports `get_pooled_filter`, `create_filter_config`, and `clear_filter_pool` from top level
- Variant span mapping handles homoglyphs, mask chars, and lowercased checkProfanity tiers
- Context-aware mode supplements AC with legacy fuzzy matching when `wordBoundaries` is disabled
- ContextAnalyzer locates match tokens by character span instead of estimated offsets
- Nested profanity dedupe uses word-boundary checks (avoids `ass` inside `classic`)
- `getConfig()` exports `enableEvasionNormalization` / `enable_evasion_normalization`

## [3.1.0] - 2025-12-30

### Changed
- Removed legacy release workflow in favor of streamlined CI/CD
- Version bump for npm publishing improvements

## [3.0.0] - 2025-12-30

### Added

#### Leetspeak Detection
- New `detectLeetspeak` option to catch obfuscated profanity like `f4ck`, `@ss`, `$h!t`
- Three intensity levels: `basic`, `moderate`, `aggressive`
- Detects spaced characters (`f u c k`) and repeated characters (`fuuuuck`)

#### Unicode Normalization
- New `normalizeUnicode` option (enabled by default)
- Detects Cyrillic/Greek lookalikes (e.g., `fυck` with Greek upsilon)
- Handles zero-width characters, full-width characters, and homoglyphs
- Two-pass normalization to prevent Scunthorpe problem (false positives)

#### Result Caching
- New `cacheResults` option for 800x performance improvement on repeated checks
- LRU eviction with configurable `maxCacheSize` (default: 1000)
- Cache management methods: `getCacheSize()`, `clearCache()`

#### ML Integration (Optional)
- TensorFlow.js-powered toxicity detection via `glin-profanity/ml` module
- `ToxicityDetector` class for standalone ML analysis
- `HybridFilter` class combining rule-based and ML detection
- Detects: toxicity, insults, threats, identity attacks, obscene content, severe toxicity
- Configurable threshold and combination modes

#### New Languages
- Added Dutch language support
- Fixed Turkish dictionary

### Changed
- Improved Filter class with configuration export/import
- Enhanced performance benchmarks
- Better TypeScript type definitions

### Fixed
- Scunthorpe problem (false positives like "Scunthorpe", "assassin")
- Repeated character handling in edge cases
- User ignoreWords now properly merge with global whitelist

## [2.3.7] - Previous Release

See git history for changes prior to v3.0.0.
