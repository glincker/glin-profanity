<p align="center">
  <a href="https://www.glincker.com/tools/glin-profanity" target="_blank">
    <img src="../../og-image.png" alt="Glin Profanity - ML-Powered Profanity Detection" width="800" />
  </a>
</p>

<h1 align="center">GLIN PROFANITY - Python</h1>

<p align="center">
  <strong>ML-Powered Profanity Detection for the Modern Web</strong>
</p>

<p align="center">
  <a href="https://pypi.org/project/glin-profanity/"><img src="https://img.shields.io/pypi/v/glin-profanity" alt="PyPI" /></a>
  <a href="https://github.com/GLINCKER/glin-profanity/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" /></a>
  <a href="https://pepy.tech/projects/glin-profanity"><img src="https://static.pepy.tech/personalized-badge/glin-profanity?period=total&units=international_system&left_color=black&right_color=green&left_text=Downloads" alt="Downloads" /></a>
  <a href="https://www.glincker.com/tools/glin-profanity"><img src="https://img.shields.io/badge/Live_Demo-online-blue" alt="Demo" /></a>
</p>

---

## Installation

```bash
pip install glin-profanity
```

## Quick Start

```python
from glin_profanity import Filter

# Basic usage
filter = Filter()

# Quick check
if filter.is_profane("This is a damn example"):
    print("Profanity detected!")

# Detailed results
result = filter.check_profanity("This is a damn example")
print(result["profane_words"])       # ['damn']
print(result["contains_profanity"])  # True
```

## Configuration

```python
from glin_profanity import Filter, SeverityLevel

filter = Filter({
    "languages": ["english", "spanish"],
    "case_sensitive": False,
    "word_boundaries": True,
    "replace_with": "***",
    "severity_levels": True,
    "custom_words": ["badword"],
    "ignore_words": ["exception"],
    "allow_obfuscated_match": True,
    "fuzzy_tolerance_level": 0.8,
})

result = filter.check_profanity("bad content here")
```

## Features

| Feature | Description |
|---------|-------------|
| Multi-language | 24 languages supported |
| Context-aware | Reduces false positives |
| Configurable | Custom word lists, severity levels |
| High performance | Optimized for speed |
| TypeScript parity | Same API as JS package |

## API Reference

### Filter Class

```python
class Filter:
    def __init__(self, config: Optional[FilterConfig] = None)
    def is_profane(self, text: str) -> bool
    def check_profanity(self, text: str) -> CheckProfanityResult
    def matches(self, word: str) -> bool
    def check_profanity_with_min_severity(self, text: str, min_severity: SeverityLevel) -> dict
```

### Return Type

```python
{
    "contains_profanity": bool,
    "profane_words": List[str],
    "processed_text": Optional[str],      # If replace_with is set
    "severity_map": Optional[Dict],       # If severity_levels is True
    "matches": Optional[List[Match]],
    "context_score": Optional[float],
    "reason": Optional[str]
}
```

### SeverityLevel

```python
SeverityLevel.EXACT  # Exact word match
SeverityLevel.FUZZY  # Fuzzy/approximate match
```

## Supported Languages

24 languages: Arabic, Chinese, Czech, Danish, Dutch, English, Esperanto, Finnish, French, German, Hindi, Hungarian, Italian, Japanese, Korean, Norwegian, Persian, Polish, Portuguese, Russian, Spanish, Swedish, Thai, Turkish

## Documentation

| Resource | Link |
|----------|------|
| Getting Started | [docs/getting-started.md](../../docs/getting-started.md) |
| API Reference | [docs/api-reference.md](../../docs/api-reference.md) |
| Advanced Features | [docs/advanced-features.md](../../docs/advanced-features.md) |
| Main README | [README.md](../../README.md) |

## Development

```bash
# Clone and setup
git clone https://github.com/GLINCKER/glin-profanity
cd glin-profanity/packages/py
pip install -e ".[dev]"

# Testing
pytest
pytest --cov=glin_profanity

# Code quality
black glin_profanity tests
isort glin_profanity tests
mypy glin_profanity
ruff check glin_profanity tests
```

## Community

Join the [GLINR Discord](https://discord.gg/Ar5pcaZB99) and drop by the `#glin-profanity` forum for questions and discussion.

<a href="https://discord.gg/Ar5pcaZB99"><img src="https://discord.com/api/guilds/829168897080557579/widget.png?style=banner2" alt="Join the GLINR Discord" /></a>

## License

MIT License - see [LICENSE](../../LICENSE)

---

<div align="center">
<sub>Built by <a href="https://glincker.com">GLINCKER</a></sub>
</div>
