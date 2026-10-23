---
name: glin-profanity
description: Detect and filter profanity in text across 24 languages, including obfuscated forms like f*ck, f.u.c.k and leetspeak, using the glin-profanity JS or Python package. Use when adding content moderation, chat filtering or input checks to an app.
---

# glin-profanity

Content moderation for JavaScript and Python. 24 languages, obfuscation-aware by default since 4.0.

## Install

```bash
npm install glin-profanity
pip install glin-profanity
```

## Use

```ts
import { Filter } from 'glin-profanity';

const filter = new Filter({ languages: ['english'], replaceWith: '***' });
filter.isProfane('f.u.c.k');            // true
filter.checkProfanity('hello f*ck').processedText; // "hello ***"
```

```python
from glin_profanity import Filter

f = Filter({"languages": ["english"]})
f.is_profane("f.u.c.k")  # True
```

## Options worth knowing

- `obfuscation`: `'off' | 'basic' | 'standard' | 'strict'` (default `standard`). Use `'off'` for the plain word scan.
- `whitelist`: extra safe words or phrases. Each protects only the ambiguous word, so `Fuck Dick` is still flagged.
- `languages` or `allLanguages`: choose dictionaries. Matching native scripts (Russian, Arabic, Chinese, Korean, Thai) works with default word boundaries.
- `enableContextAware`: lowers false positives in phrases like "the bomb".

## Be honest about limits

- It is not the fastest filter; thin word lists are far faster because they skip obfuscation.
- Space-split words (`fu ck`) and words missing from the dictionary are not caught.
- See `docs/MIGRATION-4.0.md` and `benchmarks/shootout/` for measured numbers and how to reproduce them.
