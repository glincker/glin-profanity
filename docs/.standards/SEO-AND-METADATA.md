# Documentation Standards & SEO Guide

Guidelines for maintaining SEO-friendly, AI-parseable documentation for glin-profanity.

## Frontmatter Standards

Every documentation file should include YAML frontmatter with the following fields:

### Required Fields

```yaml
---
title: "Page Title - glin-profanity"
description: "Concise description (150-160 chars for SEO)"
keywords:
  - primary keyword
  - secondary keyword
  - related terms
category: guides|mcp|integrations|advanced|production|reference
type: guide|tutorial|reference|api|setup-guide|example
audience:
  - developers
  - ai-engineers
  - beginners
seo_optimized: true
ai_friendly: true
updated: "YYYY-MM-DD"
---
```

### Optional but Recommended

```yaml
difficulty: beginner|intermediate|advanced|expert
time_to_complete: "10-15 minutes"
prerequisites:
  - Node.js 18+
  - Basic knowledge of X
related_docs:
  - file1.md
  - file2.md
frameworks: [react, next-js, vue, etc.]
platforms: [macOS, Windows, Linux]
version: "3.1.4"
```

---

## SEO Optimization

### 1. Title Optimization

**✅ Good:**
- "MCP Setup Guide - glin-profanity for Claude, Cursor & Windsurf"
- "Profanity Detection API Reference - Complete Guide"
- "Multi-Language Profanity Filter - 24 Languages Supported"

**❌ Bad:**
- "Setup" (too vague)
- "API" (no context)
- "Guide" (not descriptive)

**Rules:**
- Include primary keyword
- Mention product name (glin-profanity)
- Be specific about what's covered
- 50-60 characters ideal
- Front-load important keywords

### 2. Description Optimization

**✅ Good:**
```yaml
description: "Complete guide to setup glin-profanity MCP server with Claude Desktop, Cursor, and Windsurf AI assistants for real-time profanity detection in 24 languages"
```

**❌ Bad:**
```yaml
description: "Setup guide"
```

**Rules:**
- 150-160 characters (Google snippet length)
- Include primary + secondary keywords
- Mention key features/benefits
- Call to action words (complete, comprehensive, step-by-step)
- Specific numbers (24 languages, 19 tools, etc.)

### 3. Keyword Strategy

**Primary Keywords** (1-2 per page):
- profanity filter
- content moderation
- profanity detection
- MCP server
- AI content safety

**Secondary Keywords** (3-5 per page):
- leetspeak detection
- multi-language profanity
- Claude integration
- OpenAI profanity filter
- text moderation API

**Long-Tail Keywords** (5-10 per page):
- profanity detection library JavaScript
- Claude Desktop MCP setup
- multi-language content moderation
- real-time chat profanity filter
- TensorFlow.js toxicity detection

**Competitive Keywords:**
- bad-words alternative
- leo-profanity alternative
- obscenity filter
- better than bad-words

---

## AI-Friendly Structure

### 1. Semantic HTML Headers

```markdown
# Main Title (H1) - Only ONE per page
## Primary Sections (H2)
### Subsections (H3)
#### Details (H4)
```

**Rules:**
- Only one H1 per document
- Logical hierarchy (don't skip levels)
- Descriptive headers (not generic)
- Keywords in headers

### 2. Structured Data

Use tables for structured information:

```markdown
| Feature | Value | Details |
|---------|-------|---------|
| Languages | 24 | English, Spanish, French, etc. |
| Accuracy | F1 99.0% (English shootout set) | Measured, reproducible harness |
| MCP Tools | 19 | Complete profanity detection |
```

### 3. Code Block Metadata

```typescript
// ✅ Good: Specify language
import { Filter } from 'glin-profanity';
```

```
// ❌ Bad: No language specified
import { Filter } from 'glin-profanity';
```

### 4. Link Structure

**Internal Links:**
```markdown
[Getting Started](./guides/getting-started.md)
[MCP Setup](./mcp/setup.md)
```

**External Links:**
```markdown
[GitHub Repository](https://github.com/GLINCKER/glin-profanity)
[NPM Package](https://www.npmjs.com/package/glin-profanity)
```

---

## Content Organization

### 1. Introduction (First 2 paragraphs)

Include:
- What this document covers
- Who it's for
- Key benefits/outcomes
- Primary keywords

**Example:**
```markdown
Complete guide for integrating glin-profanity with Claude Desktop, Cursor, 
and Windsurf AI assistants using the Model Context Protocol (MCP). This 
setup enables AI assistants to perform real-time profanity detection in 
24 languages with 19 powerful tools.

Perfect for developers, content moderators, and AI engineers who want to 
add content moderation capabilities to AI-powered applications.
```

### 2. Table of Contents

For docs > 500 lines:
```markdown
## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
```

### 3. Quick Start / TL;DR

For technical docs, include quick start:

```markdown
## Quick Start

```bash
npm install glin-profanity
```

```typescript
import { Filter } from 'glin-profanity';
const filter = new Filter();
filter.isProfane('text'); // true/false
```
```

### 4. Examples First

Show working examples before explaining theory:

**✅ Good Order:**
1. Working code example
2. Explanation
3. Configuration options
4. Advanced usage

**❌ Bad Order:**
1. Theory
2. Configuration
3. Maybe an example

---

## Keyword Density

### Target Density: 1-2%

For a 1000-word document:
- Primary keyword: 10-20 times
- Secondary keywords: 5-10 times each
- Long-tail keywords: 2-5 times each

### Natural Integration

**✅ Good:**
```
The glin-profanity library provides fast profanity detection with 
support for 24 languages. Unlike alternatives like bad-words, 
glin-profanity includes leetspeak detection and Unicode normalization 
for comprehensive content moderation.
```

**❌ Bad (keyword stuffing):**
```
glin-profanity profanity filter profanity detection profanity library 
profanity filter library profanity detection library...
```

---

## Cross-Linking Strategy

### Internal Links (5-10 per page)

Link to:
- Related guides
- API reference
- Examples
- Prerequisites
- Next steps

**Example:**
```markdown
For more details, see the [Configuration Guide](./configuration.md).
Learn about [advanced features](../advanced-features.md).
Check out [examples](../reference/examples.md).
```

### External Links (1-3 per page)

Link to:
- GitHub repository
- NPM/PyPI packages
- Official documentation
- Related technologies

---

## AI Parsing Optimization

### 1. Consistent Formatting

**Code blocks:**
```typescript
// Always include language identifier
import { Filter } from 'glin-profanity';
```

**Lists:**
```markdown
- Use consistent bullet points
- Don't mix unordered and ordered
- Keep formatting uniform
```

**Tables:**
```markdown
| Column | Align | Properly |
|--------|-------|----------|
| Data   | Here  | Always   |
```

### 2. Metadata in Content

Include structured data AI can parse:

```markdown
**Supported Platforms:** macOS, Windows, Linux
**Languages:** 24 (English, Spanish, French, German, etc.)
**Accuracy:** F1 99.0%, 1.1% false positives (English shootout set); ~300,000 ops/sec uncached
**MCP Tools:** 19 detection tools
**MCP Resources:** 23 documentation resources
```

### 3. Clear Labels

```markdown
✅ = Supported
❌ = Not supported
⚠️ = Partial support
🆕 = New feature
📌 = Important
```

---

## Image Optimization (If Added)

```markdown
![Alt text with keywords](./images/mcp-setup-claude-desktop.png "Descriptive title")

**Alt text should:**
- Describe the image
- Include keywords
- Be concise (125 chars max)
```

---

## Mobile Friendliness

### Code Block Width

```typescript
// ✅ Good: Fits mobile screens
const filter = new Filter({ 
  languages: ['english'] 
});

// ❌ Bad: Too wide
const filter = new Filter({ languages: ['english'], detectLeetspeak: true, leetspeakLevel: 'aggressive', normalizeUnicode: true });
```

### Table Width

```markdown
| Short | Headers |
|-------|---------|
| Data  | Values  |

# Better than:

| Very Long Header Name | Another Very Long Column | Even More Text Here |
```

---

## Accessibility

### 1. Link Text

**✅ Good:**
- `[Installation guide](./installation.md)`
- `[See MCP setup](./mcp/setup.md)`

**❌ Bad:**
- `[Click here](./installation.md)`
- `[Read more](./mcp/setup.md)`

### 2. Heading Structure

```markdown
# Main Title (H1)
## Introduction (H2)
### Prerequisites (H3)
### Installation (H3)
## Usage (H2)
### Basic Example (H3)
### Advanced Example (H3)
```

---

## Performance

### File Size

- **Target:** < 100KB per markdown file
- **Maximum:** 200KB
- Split large files into smaller focused docs

### Loading Speed

- Minimize images
- Use code blocks efficiently
- Don't repeat large examples

---

## Quality Checklist

Before publishing any documentation:

### SEO
- [ ] Frontmatter with all required fields
- [ ] Title is descriptive and keyword-rich
- [ ] Description is 150-160 characters
- [ ] 8-12 relevant keywords listed
- [ ] Primary keyword in first paragraph
- [ ] Headers include keywords naturally

### AI-Friendly
- [ ] Structured frontmatter metadata
- [ ] Clear hierarchy (H1 → H2 → H3)
- [ ] Code blocks have language specified
- [ ] Tables for structured data
- [ ] Lists are properly formatted
- [ ] Consistent formatting throughout

### Content Quality
- [ ] Introduction explains what/why/who
- [ ] Table of contents (if > 500 lines)
- [ ] Working code examples
- [ ] Clear explanations
- [ ] Troubleshooting section
- [ ] Related docs linked

### Links
- [ ] Internal links are relative
- [ ] External links use HTTPS
- [ ] No broken links
- [ ] Link text is descriptive

### Accessibility
- [ ] Only one H1 per page
- [ ] Logical heading hierarchy
- [ ] Alt text on images
- [ ] Descriptive link text

---

## Tools for Validation

### SEO Validation
```bash
# Check markdown frontmatter
grep -A 20 "^---$" file.md | head -22

# Count word occurrences
grep -o "profanity" file.md | wc -l
```

### Link Validation
```bash
# Find broken internal links
find . -name "*.md" -exec grep -H "\[.*\](.*)" {} \;
```

### Consistency Check
```bash
# Check all files have frontmatter
find docs -name "*.md" -exec sh -c 'head -1 "$1" | grep -q "^---$" || echo "$1"' _ {} \;
```

---

## Examples

### Perfect Documentation File Structure

```markdown
---
title: "Feature X Guide - glin-profanity"
description: "Complete guide to using feature X for multi-language profanity detection with code examples and best practices"
keywords:
  - feature x
  - profanity detection
  - content moderation
  - glin-profanity
category: guides
type: tutorial
difficulty: intermediate
time_to_complete: "20-30 minutes"
audience:
  - developers
  - content-moderators
prerequisites:
  - Basic JavaScript knowledge
  - glin-profanity installed
related_docs:
  - getting-started.md
  - api-reference.md
frameworks: [react, vue, next-js]
seo_optimized: true
ai_friendly: true
updated: "2026-01-31"
---

# Feature X Guide

Learn how to use Feature X for comprehensive profanity detection in your applications.

## What You'll Learn

- ✅ How Feature X works
- ✅ Configuration options
- ✅ Real-world examples
- ✅ Best practices

---

## Quick Start

```typescript
import { Filter } from 'glin-profanity';

const filter = new Filter({
  featureX: true
});

const result = filter.checkProfanity('text');
```

[Rest of content...]

---

## Next Steps

- [Advanced Features](./advanced-features.md)
- [API Reference](../reference/api-reference.md)
- [Examples](../reference/examples.md)
```

---

## Conclusion

Following these standards ensures:
- ✅ Better search engine rankings
- ✅ AI agents can easily parse docs
- ✅ Consistent user experience
- ✅ Easier maintenance
- ✅ Professional documentation

---

**All documentation should follow these standards for maximum SEO and AI-friendliness!** 🚀
