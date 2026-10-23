"""
Prompt injection pattern database for the glin-profanity scanner.

Sources: PromptGuard categories, OWASP LLM Top-10, public jailbreak corpora
(jailbreakbench.github.io, promptinjections.com research, llm-guard open patterns).
All patterns are original regex constructions under MIT license - no GPL sources
copied.

Mirrors the TypeScript patterns at:
packages/js/src/scanners/patterns/injection-patterns.ts

@module scanners/patterns/injection_patterns
"""

import re
from dataclasses import dataclass
from typing import Literal

InjectionCategory = Literal[
    "instruction_override",
    "jailbreak_persona",
    "system_prompt_leak",
    "delimiter_injection",
    "encoding_bypass",
    "tool_misuse",
]

PatternSeverity = Literal["low", "medium", "high", "critical"]

_I = re.IGNORECASE


@dataclass
class InjectionPattern:
    """A single injection detection pattern entry."""

    id: str
    """Stable identifier (e.g. PI-001)."""

    pattern: re.Pattern[str]
    """The compiled regex to match against input text."""

    category: InjectionCategory
    """Which attack category this pattern belongs to."""

    severity: PatternSeverity
    """How dangerous a match on this pattern is considered."""

    description: str
    """Short human-readable description of the pattern."""


INJECTION_PATTERNS: list[InjectionPattern] = [
    # ── Instruction Override ──────────────────────────────────────────────────
    InjectionPattern(
        id="PI-001",
        pattern=re.compile(
            r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description='Classic "ignore previous instructions" override',
    ),
    InjectionPattern(
        id="PI-002",
        pattern=re.compile(
            r"disregard\s+(any\s+|all\s+)?(previous|prior|above)?\s*"
            r"(rules?|prompts?|instructions?|constraints?)",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description="Disregard prior rules or instructions",
    ),
    InjectionPattern(
        id="PI-003",
        pattern=re.compile(
            r"forget\s+(all\s+)?(previous|prior|above|your)\s+"
            r"(instructions?|rules?|constraints?|training|context)",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description="Forget prior instructions or training",
    ),
    InjectionPattern(
        id="PI-004",
        pattern=re.compile(
            r"override\s+(your\s+)?"
            r"(instructions?|rules?|safety|guidelines?|constraints?|programming)",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description="Override safety rules or instructions",
    ),
    InjectionPattern(
        id="PI-005",
        pattern=re.compile(
            r"new\s+(instruction|directive|rule|order)s?\s*:",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description="Injecting new instructions via colon notation",
    ),
    InjectionPattern(
        id="PI-006",
        pattern=re.compile(
            r"your\s+(real|true|actual|original)\s+"
            r"(instructions?|purpose|goal|task|job)\s+(is|are|was)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description='Claiming to reveal the model\'s "true" instructions',
    ),
    InjectionPattern(
        id="PI-007",
        pattern=re.compile(
            r"from\s+now\s+on\s+(you\s+will|ignore|disregard|act)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description='Persistent instruction override using "from now on"',
    ),
    InjectionPattern(
        id="PI-008",
        pattern=re.compile(
            r"stop\s+(being|acting\s+as|following)\s+(a\s+)?"
            r"(helpful|safe|restricted|limited|aligned)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description="Instructing the model to stop being safe or helpful",
    ),
    InjectionPattern(
        id="PI-009",
        pattern=re.compile(
            r"do\s+not\s+(follow|obey|adhere\s+to)\s+(your\s+)?"
            r"(instructions?|rules?|guidelines?|training)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description="Explicit command to disobey model guidelines",
    ),
    InjectionPattern(
        id="PI-010",
        pattern=re.compile(
            r"you\s+(must|should|will|shall)\s+(now\s+)?"
            r"(ignore|disregard|bypass|override)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description="Commanding the model to bypass its instructions",
    ),
    # ── Jailbreak / Persona ───────────────────────────────────────────────────
    InjectionPattern(
        id="PI-011",
        pattern=re.compile(
            r"you\s+are\s+now\s+"
            r"(DAN|do\s+anything\s+now|jailbroken|unrestricted|unfiltered|uncensored)",
            _I,
        ),
        category="jailbreak_persona",
        severity="critical",
        description='DAN and "jailbroken" persona assignment',
    ),
    InjectionPattern(
        id="PI-012",
        pattern=re.compile(
            r"act\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?"
            r"(evil|unfiltered|uncensored|admin|root|hacker|rogue)",
            _I,
        ),
        category="jailbreak_persona",
        severity="critical",
        description="Harmful persona assignment (evil, uncensored, admin)",
    ),
    InjectionPattern(
        id="PI-013",
        pattern=re.compile(
            r"pretend\s+(to\s+be|you\s+are|you\s+were|you're)\s+(an?\s+)?"
            r"(AI|assistant|bot|model)?\s*(without|that\s+has\s+no)\s+"
            r"(restrictions?|limits?|filters?|safety)",
            _I,
        ),
        category="jailbreak_persona",
        severity="critical",
        description="Pretend to be an unrestricted AI",
    ),
    InjectionPattern(
        id="PI-014",
        pattern=re.compile(
            r"pretend\s+(to\s+be|you\s+are|you're)",
            _I,
        ),
        category="jailbreak_persona",
        severity="medium",
        description='Generic "pretend to be" persona switch',
    ),
    InjectionPattern(
        id="PI-015",
        pattern=re.compile(
            r"roleplay\s+as\s+(an?\s+)?"
            r"(evil|unrestricted|uncensored|unfiltered|malicious|hacker)",
            _I,
        ),
        category="jailbreak_persona",
        severity="critical",
        description="Roleplay as a harmful persona",
    ),
    InjectionPattern(
        id="PI-016",
        pattern=re.compile(r"\b(jailbreak|jailbroken|jail\s*break)\b", _I),
        category="jailbreak_persona",
        severity="critical",
        description="Explicit jailbreak terminology",
    ),
    InjectionPattern(
        id="PI-017",
        pattern=re.compile(
            r"switch\s+(to|into)\s+(evil|hacker|unrestricted|admin|god)\s+mode",
            _I,
        ),
        category="jailbreak_persona",
        severity="critical",
        description="Switch to harmful operating mode",
    ),
    InjectionPattern(
        id="PI-018",
        pattern=re.compile(
            r"you\s+are\s+(no\s+longer|not)\s+"
            r"(bound\s+by|restricted\s+by|limited\s+by|subject\s+to)",
            _I,
        ),
        category="jailbreak_persona",
        severity="high",
        description="Claiming the model is no longer bound by safety rules",
    ),
    InjectionPattern(
        id="PI-019",
        pattern=re.compile(
            r"imagine\s+you\s+(have\s+no\s+|are\s+without\s+)"
            r"(restrictions?|filters?|safety|limits?|guidelines?)",
            _I,
        ),
        category="jailbreak_persona",
        severity="high",
        description="Imagining the model without restrictions",
    ),
    InjectionPattern(
        id="PI-020",
        pattern=re.compile(
            r"your\s+(true\s+|inner\s+|real\s+)?(self|nature)\s+"
            r"(has\s+no|is\s+without|is\s+free\s+from)\s+(restrictions?|limits?)",
            _I,
        ),
        category="jailbreak_persona",
        severity="high",
        description='"True self" jailbreak appeal',
    ),
    # ── System Prompt Leak ────────────────────────────────────────────────────
    InjectionPattern(
        id="PI-021",
        pattern=re.compile(r"print\s+(the\s+|your\s+)?system\s+prompt", _I),
        category="system_prompt_leak",
        severity="critical",
        description="Attempting to print the system prompt",
    ),
    InjectionPattern(
        id="PI-022",
        pattern=re.compile(
            r"show\s+(me\s+)?(your\s+|the\s+)?(system\s+)?"
            r"(instructions?|prompt|directives?|rules?|configuration)",
            _I,
        ),
        category="system_prompt_leak",
        severity="high",
        description="Requesting to show system instructions or prompt",
    ),
    InjectionPattern(
        id="PI-023",
        pattern=re.compile(
            r"repeat\s+(your\s+)?(system\s+)?(prompt|instructions?)\s+"
            r"(verbatim|exactly|word\s+for\s+word)",
            _I,
        ),
        category="system_prompt_leak",
        severity="critical",
        description="Asking to repeat system prompt verbatim",
    ),
    InjectionPattern(
        id="PI-024",
        pattern=re.compile(
            r"what\s+(are|is)\s+(your|the)\s+(system\s+)?"
            r"(instructions?|prompt|rules?|directives?|constraints?)",
            _I,
        ),
        category="system_prompt_leak",
        severity="medium",
        description="Asking about system instructions",
    ),
    InjectionPattern(
        id="PI-025",
        pattern=re.compile(
            r"reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|configuration|context)",
            _I,
        ),
        category="system_prompt_leak",
        severity="critical",
        description="Asking to reveal system configuration",
    ),
    InjectionPattern(
        id="PI-026",
        pattern=re.compile(
            r"output\s+(the\s+)?(full|complete|entire)\s+(system\s+)?"
            r"(prompt|instructions?|context)",
            _I,
        ),
        category="system_prompt_leak",
        severity="critical",
        description="Request to output full system prompt",
    ),
    InjectionPattern(
        id="PI-027",
        pattern=re.compile(
            r"what\s+(was|were)\s+you\s+(told|instructed|programmed|trained)\s+to\s+(do|say|be)",
            _I,
        ),
        category="system_prompt_leak",
        severity="medium",
        description="Asking what the model was instructed to do",
    ),
    # ── Delimiter Injection ───────────────────────────────────────────────────
    InjectionPattern(
        id="PI-028",
        pattern=re.compile(r"\[SYSTEM\]|\[/INST\]|\[INST\]", _I),
        category="delimiter_injection",
        severity="critical",
        description="Llama/Mistral instruction delimiter injection",
    ),
    InjectionPattern(
        id="PI-029",
        pattern=re.compile(
            r"<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>",
            _I,
        ),
        category="delimiter_injection",
        severity="critical",
        description="ChatML / tokenizer special token injection",
    ),
    InjectionPattern(
        id="PI-030",
        pattern=re.compile(
            r"###\s*(System|Instruction|Human|Assistant|User)\s*:",
            _I,
        ),
        category="delimiter_injection",
        severity="high",
        description="Markdown heading role delimiter injection",
    ),
    InjectionPattern(
        id="PI-031",
        pattern=re.compile(
            r"^(System|Assistant|Human|User)\s*:\s*",
            _I | re.MULTILINE,
        ),
        category="delimiter_injection",
        severity="high",
        description="Role prefix delimiter injection",
    ),
    InjectionPattern(
        id="PI-032",
        pattern=re.compile(
            r"<system>|</system>|<prompt>|</prompt>|<instructions?>|</instructions?>",
            _I,
        ),
        category="delimiter_injection",
        severity="high",
        description="XML-style system/prompt tag injection",
    ),
    InjectionPattern(
        id="PI-033",
        pattern=re.compile(
            r"---\s*(END|BEGIN)\s*(OF\s+)?(SYSTEM|USER|INSTRUCTION|PROMPT)",
            _I,
        ),
        category="delimiter_injection",
        severity="high",
        description="Section boundary delimiter injection",
    ),
    InjectionPattern(
        id="PI-034",
        pattern=re.compile(r"\bHUMAN\s*:\s*|ASSISTANT\s*:\s*", _I),
        category="delimiter_injection",
        severity="medium",
        description="Anthropic/Claude-style conversation delimiter injection",
    ),
    # ── Encoding / Obfuscation Bypass ─────────────────────────────────────────
    InjectionPattern(
        id="PI-035",
        pattern=re.compile(
            r"(?:decode|base64|rot13|hex|url.?decode|interpret)\s+"
            r"(this|the\s+following|below|it)\s*[:;]",
            _I,
        ),
        category="encoding_bypass",
        severity="high",
        description="Asking the model to decode obfuscated content",
    ),
    InjectionPattern(
        id="PI-036",
        # Base64-looking blobs ≥40 chars, bounded to avoid ReDoS on long inputs.
        pattern=re.compile(
            r"(?<![a-zA-Z0-9/._-])([A-Za-z0-9+/]{40,512}={0,2})(?![a-zA-Z0-9/._-])"
        ),
        category="encoding_bypass",
        severity="low",
        description="Possible base64-encoded payload (>=40 chars)",
    ),
    InjectionPattern(
        id="PI-037",
        pattern=re.compile(r"\\u00[0-9a-fA-F]{2}|\\x[0-9a-fA-F]{2}"),
        category="encoding_bypass",
        severity="medium",
        description="Unicode/hex escape sequence injection",
    ),
    InjectionPattern(
        id="PI-038",
        pattern=re.compile(
            r"translate\s+(the\s+)?(following|this)\s+(to\s+\w+\s+and\s+)?then\s+execute",
            _I,
        ),
        category="encoding_bypass",
        severity="high",
        description="Translate then execute encoded instruction",
    ),
    InjectionPattern(
        id="PI-039",
        pattern=re.compile(
            r"written\s+in\s+(pig\s*latin|morse|l33t|1337|nato\s+alphabet|semaphore)",
            _I,
        ),
        category="encoding_bypass",
        severity="medium",
        description="Alternate encoding/alphabet bypass attempt",
    ),
    # ── Privilege Escalation / Mode Switching ─────────────────────────────────
    InjectionPattern(
        id="PI-040",
        pattern=re.compile(
            r"developer\s+mode|sudo\s+mode|admin\s+mode|god\s+mode|debug\s+mode",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description="Requesting elevated privilege mode",
    ),
    InjectionPattern(
        id="PI-041",
        pattern=re.compile(
            r"enable\s+(dev(eloper)?|debug|admin|unrestricted|unsafe)\s+"
            r"(mode|access|capabilities?)",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description="Enabling unrestricted/debug mode",
    ),
    InjectionPattern(
        id="PI-042",
        pattern=re.compile(
            r"run\s+(in\s+)?(unsafe|unrestricted|unfiltered|debug|raw)\s+mode",
            _I,
        ),
        category="instruction_override",
        severity="critical",
        description="Run in unsafe or unfiltered mode",
    ),
    # ── Tool / Function Misuse ────────────────────────────────────────────────
    InjectionPattern(
        id="PI-043",
        pattern=re.compile(
            r"call\s+(the\s+)?(tool|function|api|endpoint)\s+(with|using)\s+"
            r"(arbitrary|custom|injected)",
            _I,
        ),
        category="tool_misuse",
        severity="high",
        description="Attempting to invoke tools with injected parameters",
    ),
    InjectionPattern(
        id="PI-044",
        pattern=re.compile(
            r"execute\s+(the\s+)?(following\s+)?(code|command|script|function|payload)",
            _I,
        ),
        category="tool_misuse",
        severity="high",
        description="Requesting code/command execution via tool",
    ),
    InjectionPattern(
        id="PI-045",
        pattern=re.compile(
            r"use\s+(your\s+)?(tools?|functions?|capabilities?)\s+to\s+"
            r"(bypass|circumvent|override|evade)",
            _I,
        ),
        category="tool_misuse",
        severity="critical",
        description="Using tools to bypass safety measures",
    ),
    InjectionPattern(
        id="PI-046",
        pattern=re.compile(
            r"inject\s+(into\s+)?(the\s+)?"
            r"(tool\s+call|function\s+call|api\s+request|context|memory)",
            _I,
        ),
        category="tool_misuse",
        severity="high",
        description="Explicit injection into tool calls or context",
    ),
    # ── Additional Instruction Override Patterns ──────────────────────────────
    InjectionPattern(
        id="PI-047",
        pattern=re.compile(
            r"you\s+will\s+comply\s+with\s+(all|any|my|these)\s+"
            r"(requests?|instructions?|commands?)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description="Compliance coercion",
    ),
    InjectionPattern(
        id="PI-048",
        pattern=re.compile(
            r"this\s+is\s+(a\s+)?(test|simulation|red\s+team|authorized|permitted)\s+"
            r"(and\s+)?(you\s+)?(can|may|should|must)\s+(ignore|bypass|skip)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description='"This is a test" bypass justification',
    ),
    InjectionPattern(
        id="PI-049",
        pattern=re.compile(
            r"for\s+(research|educational|academic|training)\s+purposes?\s*(,\s*)?"
            r"please\s+(ignore|bypass|reveal)",
            _I,
        ),
        category="instruction_override",
        severity="high",
        description='"For research purposes" bypass justification',
    ),
    InjectionPattern(
        id="PI-050",
        pattern=re.compile(
            r"\[BEGIN\s+(UNFILTERED|UNCENSORED|RAW|UNSAFE)\s+(RESPONSE|OUTPUT|MODE)\]",
            _I,
        ),
        category="delimiter_injection",
        severity="critical",
        description="Unfiltered/unsafe response delimiter",
    ),
]
