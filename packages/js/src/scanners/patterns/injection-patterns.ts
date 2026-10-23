/**
 * Prompt injection pattern database for the glin-profanity scanner.
 *
 * Sources: PromptGuard categories, OWASP LLM Top-10, public jailbreak corpora
 * (jailbreakbench.github.io, promptinjections.com research, llm-guard open patterns).
 * All patterns are original regex constructions under MIT license — no GPL sources copied.
 *
 * @module scanners/patterns/injection-patterns
 */

/** Categories of prompt injection attack patterns. */
export type InjectionCategory =
  | 'instruction_override'
  | 'jailbreak_persona'
  | 'system_prompt_leak'
  | 'delimiter_injection'
  | 'encoding_bypass'
  | 'tool_misuse';

/** Severity level of a pattern match. */
export type PatternSeverity = 'low' | 'medium' | 'high' | 'critical';

/** A single injection detection pattern entry. */
export interface InjectionPattern {
  /** Stable identifier (e.g. PI-001). */
  id: string;
  /** The regex to match against input text. */
  pattern: RegExp;
  /** Which attack category this pattern belongs to. */
  category: InjectionCategory;
  /** How dangerous a match on this pattern is considered. */
  severity: PatternSeverity;
  /** Short human-readable description of the pattern. */
  description: string;
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  // ─── Instruction Override ────────────────────────────────────────────────────
  {
    id: 'PI-001',
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Classic "ignore previous instructions" override',
  },
  {
    id: 'PI-002',
    pattern: /disregard\s+(any\s+|all\s+)?(previous|prior|above)?\s*(rules?|prompts?|instructions?|constraints?)/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Disregard prior rules or instructions',
  },
  {
    id: 'PI-003',
    pattern: /forget\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|rules?|constraints?|training|context)/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Forget prior instructions or training',
  },
  {
    id: 'PI-004',
    pattern: /override\s+(your\s+)?(instructions?|rules?|safety|guidelines?|constraints?|programming)/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Override safety rules or instructions',
  },
  {
    id: 'PI-005',
    pattern: /new\s+(instruction|directive|rule|order)s?\s*:/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Injecting new instructions via colon notation',
  },
  {
    id: 'PI-006',
    pattern: /your\s+(real|true|actual|original)\s+(instructions?|purpose|goal|task|job)\s+(is|are|was)/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Claiming to reveal the model\'s "true" instructions',
  },
  {
    id: 'PI-007',
    pattern: /from\s+now\s+on\s+(you\s+will|ignore|disregard|act)/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Persistent instruction override using "from now on"',
  },
  {
    id: 'PI-008',
    pattern: /stop\s+(being|acting\s+as|following)\s+(a\s+)?(helpful|safe|restricted|limited|aligned)/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Instructing the model to stop being safe or helpful',
  },
  {
    id: 'PI-009',
    pattern: /do\s+not\s+(follow|obey|adhere\s+to)\s+(your\s+)?(instructions?|rules?|guidelines?|training)/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Explicit command to disobey model guidelines',
  },
  {
    id: 'PI-010',
    pattern: /you\s+(must|should|will|shall)\s+(now\s+)?(ignore|disregard|bypass|override)/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Commanding the model to bypass its instructions',
  },

  // ─── Jailbreak / Persona ─────────────────────────────────────────────────────
  {
    id: 'PI-011',
    pattern: /you\s+are\s+now\s+(DAN|do\s+anything\s+now|jailbroken|unrestricted|unfiltered|uncensored)/i,
    category: 'jailbreak_persona',
    severity: 'critical',
    description: 'DAN and "jailbroken" persona assignment',
  },
  {
    id: 'PI-012',
    pattern: /act\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?(evil|unfiltered|uncensored|admin|root|hacker|rogue)/i,
    category: 'jailbreak_persona',
    severity: 'critical',
    description: 'Harmful persona assignment (evil, uncensored, admin)',
  },
  {
    id: 'PI-013',
    pattern: /pretend\s+(to\s+be|you\s+are|you\s+were|you\'re)\s+(an?\s+)?(AI|assistant|bot|model)?\s*(without|that\s+has\s+no)\s+(restrictions?|limits?|filters?|safety)/i,
    category: 'jailbreak_persona',
    severity: 'critical',
    description: 'Pretend to be an unrestricted AI',
  },
  {
    id: 'PI-014',
    pattern: /pretend\s+(to\s+be|you\s+are|you\'re)/i,
    category: 'jailbreak_persona',
    severity: 'medium',
    description: 'Generic "pretend to be" persona switch',
  },
  {
    id: 'PI-015',
    pattern: /roleplay\s+as\s+(an?\s+)?(evil|unrestricted|uncensored|unfiltered|malicious|hacker)/i,
    category: 'jailbreak_persona',
    severity: 'critical',
    description: 'Roleplay as a harmful persona',
  },
  {
    id: 'PI-016',
    pattern: /\b(jailbreak|jailbroken|jail\s*break)\b/i,
    category: 'jailbreak_persona',
    severity: 'critical',
    description: 'Explicit jailbreak terminology',
  },
  {
    id: 'PI-017',
    pattern: /switch\s+(to|into)\s+(evil|hacker|unrestricted|admin|god)\s+mode/i,
    category: 'jailbreak_persona',
    severity: 'critical',
    description: 'Switch to harmful operating mode',
  },
  {
    id: 'PI-018',
    pattern: /you\s+are\s+(no\s+longer|not)\s+(bound\s+by|restricted\s+by|limited\s+by|subject\s+to)/i,
    category: 'jailbreak_persona',
    severity: 'high',
    description: 'Claiming the model is no longer bound by safety rules',
  },
  {
    id: 'PI-019',
    pattern: /imagine\s+you\s+(have\s+no\s+|are\s+without\s+)(restrictions?|filters?|safety|limits?|guidelines?)/i,
    category: 'jailbreak_persona',
    severity: 'high',
    description: 'Imagining the model without restrictions',
  },
  {
    id: 'PI-020',
    pattern: /your\s+(true\s+|inner\s+|real\s+)?(self|nature)\s+(has\s+no|is\s+without|is\s+free\s+from)\s+(restrictions?|limits?)/i,
    category: 'jailbreak_persona',
    severity: 'high',
    description: '"True self" jailbreak appeal',
  },

  // ─── System Prompt Leak ───────────────────────────────────────────────────────
  {
    id: 'PI-021',
    pattern: /print\s+(the\s+|your\s+)?system\s+prompt/i,
    category: 'system_prompt_leak',
    severity: 'critical',
    description: 'Attempting to print the system prompt',
  },
  {
    id: 'PI-022',
    pattern: /show\s+(me\s+)?(your\s+|the\s+)?(system\s+)?(instructions?|prompt|directives?|rules?|configuration)/i,
    category: 'system_prompt_leak',
    severity: 'high',
    description: 'Requesting to show system instructions or prompt',
  },
  {
    id: 'PI-023',
    pattern: /repeat\s+(your\s+)?(system\s+)?(prompt|instructions?)\s+(verbatim|exactly|word\s+for\s+word)/i,
    category: 'system_prompt_leak',
    severity: 'critical',
    description: 'Asking to repeat system prompt verbatim',
  },
  {
    id: 'PI-024',
    pattern: /what\s+(are|is)\s+(your|the)\s+(system\s+)?(instructions?|prompt|rules?|directives?|constraints?)/i,
    category: 'system_prompt_leak',
    severity: 'medium',
    description: 'Asking about system instructions',
  },
  {
    id: 'PI-025',
    pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|configuration|context)/i,
    category: 'system_prompt_leak',
    severity: 'critical',
    description: 'Asking to reveal system configuration',
  },
  {
    id: 'PI-026',
    pattern: /output\s+(the\s+)?(full|complete|entire)\s+(system\s+)?(prompt|instructions?|context)/i,
    category: 'system_prompt_leak',
    severity: 'critical',
    description: 'Request to output full system prompt',
  },
  {
    id: 'PI-027',
    pattern: /what\s+(was|were)\s+you\s+(told|instructed|programmed|trained)\s+to\s+(do|say|be)/i,
    category: 'system_prompt_leak',
    severity: 'medium',
    description: 'Asking what the model was instructed to do',
  },

  // ─── Delimiter Injection ──────────────────────────────────────────────────────
  {
    id: 'PI-028',
    pattern: /\[SYSTEM\]|\[\/INST\]|\[INST\]/i,
    category: 'delimiter_injection',
    severity: 'critical',
    description: 'Llama/Mistral instruction delimiter injection',
  },
  {
    id: 'PI-029',
    pattern: /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>/i,
    category: 'delimiter_injection',
    severity: 'critical',
    description: 'ChatML / tokenizer special token injection',
  },
  {
    id: 'PI-030',
    pattern: /###\s*(System|Instruction|Human|Assistant|User)\s*:/i,
    category: 'delimiter_injection',
    severity: 'high',
    description: 'Markdown heading role delimiter injection',
  },
  {
    id: 'PI-031',
    pattern: /^(System|Assistant|Human|User)\s*:\s*/im,
    category: 'delimiter_injection',
    severity: 'high',
    description: 'Role prefix delimiter injection',
  },
  {
    id: 'PI-032',
    pattern: /<system>|<\/system>|<prompt>|<\/prompt>|<instructions?>|<\/instructions?>/i,
    category: 'delimiter_injection',
    severity: 'high',
    description: 'XML-style system/prompt tag injection',
  },
  {
    id: 'PI-033',
    pattern: /---\s*(END|BEGIN)\s*(OF\s+)?(SYSTEM|USER|INSTRUCTION|PROMPT)/i,
    category: 'delimiter_injection',
    severity: 'high',
    description: 'Section boundary delimiter injection',
  },
  {
    id: 'PI-034',
    pattern: /\bHUMAN\s*:\s*|ASSISTANT\s*:\s*/i,
    category: 'delimiter_injection',
    severity: 'medium',
    description: 'Anthropic/Claude-style conversation delimiter injection',
  },

  // ─── Encoding / Obfuscation Bypass ───────────────────────────────────────────
  {
    id: 'PI-035',
    pattern: /(?:decode|base64|rot13|hex|url.?decode|interpret)\s+(this|the\s+following|below|it)\s*[:;]/i,
    category: 'encoding_bypass',
    severity: 'high',
    description: 'Asking the model to decode obfuscated content',
  },
  {
    id: 'PI-036',
    // Base64-looking blobs ≥40 chars, bounded to avoid ReDoS on long inputs.
    // Lookbehind/lookahead match span excludes boundary chars (aligned with Python).
    pattern: /(?<![a-zA-Z0-9/._-])([A-Za-z0-9+/]{40,512}={0,2})(?![a-zA-Z0-9/._-])/,
    category: 'encoding_bypass',
    severity: 'low',
    description: 'Possible base64-encoded payload (≥40 chars)',
  },
  {
    id: 'PI-037',
    pattern: /\\u00[0-9a-fA-F]{2}|\\x[0-9a-fA-F]{2}/,
    category: 'encoding_bypass',
    severity: 'medium',
    description: 'Unicode/hex escape sequence injection',
  },
  {
    id: 'PI-038',
    pattern: /translate\s+(the\s+)?(following|this)\s+(to\s+\w+\s+and\s+)?then\s+execute/i,
    category: 'encoding_bypass',
    severity: 'high',
    description: 'Translate then execute encoded instruction',
  },
  {
    id: 'PI-039',
    pattern: /written\s+in\s+(pig\s*latin|morse|l33t|1337|nato\s+alphabet|semaphore)/i,
    category: 'encoding_bypass',
    severity: 'medium',
    description: 'Alternate encoding/alphabet bypass attempt',
  },

  // ─── Privilege Escalation / Mode Switching ────────────────────────────────────
  {
    id: 'PI-040',
    pattern: /developer\s+mode|sudo\s+mode|admin\s+mode|god\s+mode|debug\s+mode/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Requesting elevated privilege mode',
  },
  {
    id: 'PI-041',
    pattern: /enable\s+(dev(eloper)?|debug|admin|unrestricted|unsafe)\s+(mode|access|capabilities?)/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Enabling unrestricted/debug mode',
  },
  {
    id: 'PI-042',
    pattern: /run\s+(in\s+)?(unsafe|unrestricted|unfiltered|debug|raw)\s+mode/i,
    category: 'instruction_override',
    severity: 'critical',
    description: 'Run in unsafe or unfiltered mode',
  },

  // ─── Tool / Function Misuse ──────────────────────────────────────────────────
  {
    id: 'PI-043',
    pattern: /call\s+(the\s+)?(tool|function|api|endpoint)\s+(with|using)\s+(arbitrary|custom|injected)/i,
    category: 'tool_misuse',
    severity: 'high',
    description: 'Attempting to invoke tools with injected parameters',
  },
  {
    id: 'PI-044',
    pattern: /execute\s+(the\s+)?(following\s+)?(code|command|script|function|payload)/i,
    category: 'tool_misuse',
    severity: 'high',
    description: 'Requesting code/command execution via tool',
  },
  {
    id: 'PI-045',
    pattern: /use\s+(your\s+)?(tools?|functions?|capabilities?)\s+to\s+(bypass|circumvent|override|evade)/i,
    category: 'tool_misuse',
    severity: 'critical',
    description: 'Using tools to bypass safety measures',
  },
  {
    id: 'PI-046',
    pattern: /inject\s+(into\s+)?(the\s+)?(tool\s+call|function\s+call|api\s+request|context|memory)/i,
    category: 'tool_misuse',
    severity: 'high',
    description: 'Explicit injection into tool calls or context',
  },

  // ─── Additional Instruction Override Patterns ─────────────────────────────────
  {
    id: 'PI-047',
    pattern: /you\s+will\s+comply\s+with\s+(all|any|my|these)\s+(requests?|instructions?|commands?)/i,
    category: 'instruction_override',
    severity: 'high',
    description: 'Compliance coercion',
  },
  {
    id: 'PI-048',
    pattern: /this\s+is\s+(a\s+)?(test|simulation|red\s+team|authorized|permitted)\s+(and\s+)?(you\s+)?(can|may|should|must)\s+(ignore|bypass|skip)/i,
    category: 'instruction_override',
    severity: 'high',
    description: '"This is a test" bypass justification',
  },
  {
    id: 'PI-049',
    pattern: /for\s+(research|educational|academic|training)\s+purposes?\s*(,\s*)?please\s+(ignore|bypass|reveal)/i,
    category: 'instruction_override',
    severity: 'high',
    description: '"For research purposes" bypass justification',
  },
  {
    id: 'PI-050',
    pattern: /\[BEGIN\s+(UNFILTERED|UNCENSORED|RAW|UNSAFE)\s+(RESPONSE|OUTPUT|MODE)\]/i,
    category: 'delimiter_injection',
    severity: 'critical',
    description: 'Unfiltered/unsafe response delimiter',
  },
];
