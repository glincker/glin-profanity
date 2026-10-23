/**
 * Glin-Profanity MCP Server Core
 *
 * Shared server logic for both STDIO and HTTP transports.
 * Contains all tool, resource, and prompt registrations.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'module';
import { z } from 'zod';
import {
  checkProfanity,
  Filter,
  type Language,
  type FilterConfig,
} from 'glin-profanity';
import {
  checkPromptInjection,
  type PromptInjectionOptions,
  type InjectionPattern,
  SecretsScanner,
  PiiScanner,
  Vault,
  type RestoreStrategy,
} from 'glin-profanity/scanners';

// ============================================================================
// VAULT REGISTRY — in-memory LRU with 50-entry cap
// ============================================================================

/** Maximum number of vault sessions kept in memory. */
const VAULT_REGISTRY_MAX = 50;

interface VaultRegistryEntry {
  vault: Vault;
  accessedAt: number;
}

const vaultRegistry = new Map<string, VaultRegistryEntry>();

function getOrCreateVault(id: string): Vault {
  const existing = vaultRegistry.get(id);
  if (existing) {
    existing.accessedAt = Date.now();
    return existing.vault;
  }
  // Evict LRU entry when at capacity
  if (vaultRegistry.size >= VAULT_REGISTRY_MAX) {
    let lruKey = '';
    let lruTime = Infinity;
    for (const [k, v] of vaultRegistry.entries()) {
      if (v.accessedAt < lruTime) {
        lruTime = v.accessedAt;
        lruKey = k;
      }
    }
    if (lruKey) vaultRegistry.delete(lruKey);
  }
  const vault = new Vault();
  vaultRegistry.set(id, { vault, accessedAt: Date.now() });
  return vault;
}

function generateVaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `vault-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Read version from package.json
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
export const MCP_VERSION: string = packageJson.version;

// ============================================================================
// CONSTANTS AND SCHEMAS
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  'arabic',
  'chinese',
  'czech',
  'danish',
  'dutch',
  'english',
  'esperanto',
  'finnish',
  'french',
  'german',
  'hindi',
  'hungarian',
  'italian',
  'japanese',
  'korean',
  'norwegian',
  'persian',
  'polish',
  'portuguese',
  'russian',
  'spanish',
  'swedish',
  'thai',
  'turkish',
] as const;

const LanguageSchema = z.enum(SUPPORTED_LANGUAGES);

const BaseConfigSchema = z.object({
  languages: z
    .array(LanguageSchema)
    .optional()
    .describe('Languages to check against. Defaults to all languages.'),
  caseSensitive: z
    .boolean()
    .optional()
    .describe('Whether matching should be case-sensitive. Default: false'),
  detectLeetspeak: z
    .boolean()
    .optional()
    .describe("Detect leetspeak obfuscation (e.g., 'f4ck'). Default: false"),
  normalizeUnicode: z
    .boolean()
    .optional()
    .describe('Normalize Unicode homoglyphs. Default: true'),
});

// ============================================================================
// CONVERSATION MEMORY - Track user patterns across messages
// ============================================================================

interface UserProfile {
  userId: string;
  totalMessages: number;
  flaggedMessages: number;
  uniqueViolations: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
  riskScore: number;
  history: Array<{
    timestamp: Date;
    text: string;
    wasFlagged: boolean;
    words: string[];
  }>;
}

// In-memory user profiles (in production, use Redis/database)
const userProfiles: Map<string, UserProfile> = new Map();

function getUserProfile(userId: string): UserProfile {
  if (!userProfiles.has(userId)) {
    userProfiles.set(userId, {
      userId,
      totalMessages: 0,
      flaggedMessages: 0,
      uniqueViolations: new Set(),
      firstSeen: new Date(),
      lastSeen: new Date(),
      riskScore: 0,
      history: [],
    });
  }
  return userProfiles.get(userId)!;
}

function updateUserProfile(
  userId: string,
  text: string,
  result: { containsProfanity: boolean; profaneWords: string[] },
): UserProfile {
  const profile = getUserProfile(userId);
  profile.totalMessages++;
  profile.lastSeen = new Date();

  if (result.containsProfanity) {
    profile.flaggedMessages++;
    result.profaneWords.forEach((w) => profile.uniqueViolations.add(w));
  }

  // Keep last 50 messages in history
  profile.history.push({
    timestamp: new Date(),
    text: text.slice(0, 100),
    wasFlagged: result.containsProfanity,
    words: result.profaneWords,
  });
  if (profile.history.length > 50) {
    profile.history.shift();
  }

  // Calculate risk score (0-100)
  const flagRate = profile.flaggedMessages / profile.totalMessages;
  const recentFlagRate =
    profile.history.slice(-10).filter((h) => h.wasFlagged).length / 10;
  const uniqueViolationPenalty = Math.min(
    profile.uniqueViolations.size * 5,
    30,
  );
  profile.riskScore = Math.min(
    100,
    Math.round(flagRate * 30 + recentFlagRate * 40 + uniqueViolationPenalty),
  );

  return profile;
}

// ============================================================================
// STREAMING SUPPORT - Real-time message queue
// ============================================================================

interface StreamMessage {
  id: string;
  userId?: string;
  text: string;
  timestamp: Date;
}

interface StreamResult {
  id: string;
  containsProfanity: boolean;
  profaneWords: string[];
  processedAt: Date;
  latencyMs: number;
}

const messageQueue: StreamMessage[] = [];
const processedResults: Map<string, StreamResult> = new Map();

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

export function registerAllTools(server: McpServer): void {
  // ========== CORE TOOLS ==========

  server.tool(
    'check_profanity',
    'Check text for profanity and get detailed results including matched words, severity, and positions',
    {
      text: z.string().describe('The text to check for profanity'),
      ...BaseConfigSchema.shape,
      wordBoundaries: z
        .boolean()
        .optional()
        .describe('Only match whole words. Default: true'),
      customWords: z
        .array(z.string())
        .optional()
        .describe('Additional custom words to detect'),
      ignoreWords: z.array(z.string()).optional().describe('Words to ignore'),
    },
    async (args) => {
      const config: FilterConfig = {
        languages: args.languages as Language[],
        caseSensitive: args.caseSensitive,
        wordBoundaries: args.wordBoundaries ?? true,
        detectLeetspeak: args.detectLeetspeak,
        normalizeUnicode: args.normalizeUnicode ?? true,
        customWords: args.customWords,
        ignoreWords: args.ignoreWords,
        severityLevels: true,
      };
      const result = checkProfanity(args.text, config);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                containsProfanity: result.containsProfanity,
                profaneWords: result.profaneWords,
                matches: result.matches,
                severityMap: result.severityMap,
                summary: result.containsProfanity
                  ? `Found ${result.profaneWords.length} profane word(s): ${result.profaneWords.join(', ')}`
                  : 'No profanity detected',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'censor_text',
    'Censor profanity in text by replacing matched words with a replacement character',
    {
      text: z.string().describe('The text to censor'),
      replaceWith: z
        .string()
        .optional()
        .describe("Replacement character. Default: '*'"),
      ...BaseConfigSchema.shape,
      preserveFirstLetter: z
        .boolean()
        .optional()
        .describe("Keep first letter (e.g., 'f***')"),
    },
    async (args) => {
      const replaceChar = args.replaceWith ?? '*';
      const checkConfig: FilterConfig = {
        languages: args.languages as Language[],
        caseSensitive: args.caseSensitive,
        detectLeetspeak: args.detectLeetspeak,
        normalizeUnicode: args.normalizeUnicode ?? true,
        wordBoundaries: true,
        severityLevels: true,
      };
      const filter = new Filter(checkConfig);
      const result = filter.checkProfanity(args.text);
      let censoredText = args.text;

      if (result.containsProfanity && result.profaneWords.length > 0) {
        for (const word of result.profaneWords) {
          const regex = new RegExp(
            `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'gi',
          );
          censoredText = censoredText.replace(regex, (match) => {
            return args.preserveFirstLetter
              ? match[0] + replaceChar.repeat(match.length - 1)
              : replaceChar.repeat(match.length);
          });
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                original: args.text,
                censored: censoredText,
                modified: args.text !== censoredText,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'analyze_context',
    'Analyze text with context awareness - considers domain-specific whitelists',
    {
      text: z.string().describe('The text to analyze'),
      domain: z
        .enum(['medical', 'gaming', 'technical', 'educational', 'general'])
        .optional(),
      contextWindow: z.number().min(1).max(10).optional(),
      confidenceThreshold: z.number().min(0).max(1).optional(),
      ...BaseConfigSchema.shape,
    },
    async (args) => {
      const domainWhitelists: Record<string, string[]> = {
        medical: [
          'breast',
          'anal',
          'rectal',
          'penis',
          'vaginal',
          'nipple',
          'scrotum',
        ],
        gaming: ['kill', 'shot', 'headshot', 'noob', 'pwn', 'owned'],
        technical: ['master', 'slave', 'kill', 'abort', 'execute', 'dummy'],
        educational: [
          'sex',
          'sexual',
          'intercourse',
          'reproduction',
          'anatomy',
        ],
        general: [],
      };

      const domain = args.domain ?? 'general';
      const config: FilterConfig = {
        languages: args.languages as Language[],
        caseSensitive: args.caseSensitive,
        detectLeetspeak: args.detectLeetspeak,
        normalizeUnicode: args.normalizeUnicode ?? true,
        ignoreWords: domainWhitelists[domain],
        enableContextAware: true,
        contextWindow: args.contextWindow ?? 3,
        confidenceThreshold: args.confidenceThreshold ?? 0.7,
        severityLevels: true,
      };

      const result = checkProfanity(args.text, config);
      let contextScore = 1.0;
      if (result.matches && result.matches.length > 0) {
        contextScore =
          result.matches.reduce((sum, m) => sum + (m.contextScore ?? 1), 0) /
          result.matches.length;
      }

      const threshold = args.confidenceThreshold ?? 0.7;
      const isProfane = result.containsProfanity && contextScore >= threshold;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                isProfane,
                confidence: contextScore,
                domain,
                matches: result.matches,
                recommendation: isProfane
                  ? 'Content may need moderation'
                  : 'Content appears safe',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'batch_check',
    'Check multiple texts for profanity in a single operation (max 100)',
    {
      texts: z
        .array(z.string())
        .min(1)
        .max(100)
        .describe('Array of texts to check'),
      ...BaseConfigSchema.shape,
      returnOnlyFlagged: z.boolean().optional(),
    },
    async (args) => {
      const config: FilterConfig = {
        languages: args.languages as Language[],
        caseSensitive: args.caseSensitive,
        detectLeetspeak: args.detectLeetspeak,
        normalizeUnicode: args.normalizeUnicode ?? true,
        severityLevels: true,
      };

      const results = args.texts.map((text, index) => {
        const result = checkProfanity(text, config);
        return {
          index,
          text: text.length > 100 ? text.slice(0, 100) + '...' : text,
          containsProfanity: result.containsProfanity,
          profaneWords: result.profaneWords,
        };
      });

      const filtered = args.returnOnlyFlagged
        ? results.filter((r) => r.containsProfanity)
        : results;
      const flagged = results.filter((r) => r.containsProfanity).length;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                summary: {
                  total: args.texts.length,
                  flagged,
                  clean: args.texts.length - flagged,
                  flagRate:
                    ((flagged / args.texts.length) * 100).toFixed(1) + '%',
                },
                results: filtered,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'get_supported_languages',
    'Get the list of all 24 supported languages',
    {},
    async () => ({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              languages: SUPPORTED_LANGUAGES,
              total: SUPPORTED_LANGUAGES.length,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.tool(
    'validate_content',
    'Validate content with a safety score (0-100) and action recommendation',
    {
      text: z.string().describe('The content to validate'),
      strictness: z.enum(['low', 'medium', 'high']).optional(),
      context: z.string().optional(),
    },
    async (args) => {
      const strictnessConfig: Record<string, FilterConfig> = {
        low: {
          allLanguages: true,
          detectLeetspeak: false,
          normalizeUnicode: true,
          wordBoundaries: true,
        },
        medium: {
          allLanguages: true,
          detectLeetspeak: true,
          normalizeUnicode: true,
          wordBoundaries: true,
          leetspeakLevel: 'moderate',
        },
        high: {
          allLanguages: true,
          detectLeetspeak: true,
          normalizeUnicode: true,
          wordBoundaries: false,
          leetspeakLevel: 'aggressive',
          allowObfuscatedMatch: true,
        },
      };

      const strictness = args.strictness ?? 'medium';
      const result = checkProfanity(args.text, {
        ...strictnessConfig[strictness],
        severityLevels: true,
      });

      let safetyScore = 100;
      if (result.profaneWords.length > 0) {
        const penalty = result.severityMap
          ? Object.values(result.severityMap).reduce(
              (sum, s) => sum + s * 10,
              0,
            )
          : result.profaneWords.length * 15;
        safetyScore = Math.max(0, 100 - penalty);
      }

      let action: string, recommendation: string;
      if (safetyScore >= 90) {
        action = 'approve';
        recommendation = 'Content is safe for publishing';
      } else if (safetyScore >= 70) {
        action = 'review';
        recommendation = 'Content has minor issues, manual review recommended';
      } else if (safetyScore >= 40) {
        action = 'edit';
        recommendation = 'Content has significant issues, editing required';
      } else {
        action = 'reject';
        recommendation = 'Content violates guidelines, should be rejected';
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                safetyScore,
                action,
                recommendation,
                details: {
                  strictness,
                  context: args.context || 'general',
                  profanityFound: result.containsProfanity,
                  issues: result.profaneWords,
                },
                metadata: {
                  checkedAt: new Date().toISOString(),
                  version: MCP_VERSION,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'detect_obfuscation',
    'Detect text obfuscation techniques like leetspeak and Unicode homoglyphs',
    { text: z.string().describe('The text to analyze') },
    async (args) => {
      const withoutDetection = checkProfanity(args.text, {
        detectLeetspeak: false,
        normalizeUnicode: false,
      });
      const withDetection = checkProfanity(args.text, {
        detectLeetspeak: true,
        leetspeakLevel: 'aggressive',
        normalizeUnicode: true,
      });

      const obfuscatedWords = withDetection.profaneWords.filter(
        (w) => !withoutDetection.profaneWords.includes(w),
      );
      const patterns = {
        leetspeak: /[0-9@$!]+/.test(args.text),
        unicodeHomoglyphs: /[^\x00-\x7F]/.test(args.text),
        spacedCharacters:
          /\w\s+\w\s+\w/.test(args.text) &&
          args.text.split(/\s+/).every((p) => p.length <= 2),
        repeatedCharacters: /(.)\1{2,}/.test(args.text),
        zeroWidthChars: /[\u200B-\u200D\uFEFF]/.test(args.text),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                hasObfuscation:
                  obfuscatedWords.length > 0 ||
                  Object.values(patterns).some(Boolean),
                obfuscatedWords,
                patternsDetected: Object.entries(patterns)
                  .filter(([, v]) => v)
                  .map(([k]) => k),
                analysis: {
                  originalMatches: withoutDetection.profaneWords,
                  normalizedMatches: withDetection.profaneWords,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ========== ADVANCED ANALYSIS TOOLS ==========

  server.tool(
    'explain_match',
    'Explain why a word was flagged with detailed reasoning',
    {
      text: z.string().describe('The text containing the flagged content'),
      word: z.string().optional().describe('Specific word to explain'),
    },
    async (args) => {
      const results = {
        basic: checkProfanity(args.text, {
          detectLeetspeak: false,
          normalizeUnicode: false,
        }),
        leetspeak: checkProfanity(args.text, {
          detectLeetspeak: true,
          normalizeUnicode: false,
        }),
        unicode: checkProfanity(args.text, {
          detectLeetspeak: false,
          normalizeUnicode: true,
        }),
        full: checkProfanity(args.text, {
          detectLeetspeak: true,
          normalizeUnicode: true,
          leetspeakLevel: 'aggressive',
        }),
      };

      const wordsToExplain = args.word
        ? [args.word]
        : results.full.profaneWords;
      const explanations = wordsToExplain.map((word) => {
        let detectionMethod = 'unknown',
          reason = '';
        if (results.basic.profaneWords.includes(word)) {
          detectionMethod = 'direct_match';
          reason = `"${word}" directly matches a profanity dictionary entry`;
        } else if (results.unicode.profaneWords.includes(word)) {
          detectionMethod = 'unicode_normalization';
          reason = `"${word}" contains Unicode homoglyphs that normalize to profanity`;
        } else if (results.leetspeak.profaneWords.includes(word)) {
          detectionMethod = 'leetspeak_detection';
          reason = `"${word}" uses leetspeak character substitutions`;
        } else if (results.full.profaneWords.includes(word)) {
          detectionMethod = 'combined_detection';
          reason = `"${word}" detected through combined normalization`;
        }
        return {
          word,
          reason,
          detectionMethod,
          suggestions: [
            'Use a different word',
            'Add to ignoreWords if false positive',
            'Use context-aware analysis',
          ],
        };
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                originalText: args.text,
                totalMatches: results.full.profaneWords.length,
                explanations,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'suggest_alternatives',
    'Suggest clean alternatives for profane content',
    {
      text: z.string().describe('The text containing profanity'),
      tone: z.enum(['formal', 'casual', 'humorous', 'professional']).optional(),
    },
    async (args) => {
      const result = checkProfanity(args.text, {
        allLanguages: true,
        detectLeetspeak: true,
        normalizeUnicode: true,
      });
      const alternatives: Record<string, Record<string, string[]>> = {
        formal: {
          default: ['[removed]', '[inappropriate]', '[redacted]'],
          anger: ['frustrating', 'disappointing', 'unacceptable'],
        },
        casual: {
          default: ['darn', 'shoot', 'oops'],
          anger: ['ugh', 'argh', 'come on'],
        },
        humorous: {
          default: ['fluffernutter', 'sugar honey iced tea', 'fiddlesticks'],
          anger: ['cheese and crackers', 'son of a biscuit', 'what the fudge'],
        },
        professional: {
          default: ['[content removed]', '[filtered]', '***'],
          anger: ['concerning', 'problematic', 'unacceptable'],
        },
      };

      const tone = args.tone ?? 'casual';
      let cleanText = args.text;
      const replacements = result.profaneWords.map((word) => {
        const regex = new RegExp(
          `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'gi',
        );
        cleanText = cleanText.replace(regex, alternatives[tone].default[0]);
        return {
          original: word,
          suggestions: [
            ...alternatives[tone].default,
            ...alternatives[tone].anger,
          ].slice(0, 5),
        };
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                original: args.text,
                cleanVersion: cleanText,
                tone,
                replacements,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'analyze_corpus',
    'Analyze a collection of texts for profanity statistics (max 500)',
    {
      texts: z
        .array(z.string())
        .min(1)
        .max(500)
        .describe('Array of texts to analyze'),
      includeWordFrequency: z.boolean().optional(),
    },
    async (args) => {
      const wordFrequency: Record<string, number> = {};
      let totalProfane = 0,
        totalClean = 0,
        totalWords = 0;
      const severityDistribution = { exact: 0, fuzzy: 0 };

      for (const text of args.texts) {
        totalWords += text.split(/\s+/).length;
        const result = checkProfanity(text, {
          allLanguages: true,
          detectLeetspeak: true,
          normalizeUnicode: true,
          severityLevels: true,
        });
        if (result.containsProfanity) {
          totalProfane++;
          result.profaneWords.forEach((w) => {
            wordFrequency[w] = (wordFrequency[w] || 0) + 1;
          });
          if (result.severityMap) {
            Object.values(result.severityMap).forEach((s) => {
              if (s === 1) severityDistribution.exact++;
              else severityDistribution.fuzzy++;
            });
          }
        } else {
          totalClean++;
        }
      }

      const topWords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count }));
      const recommendations: string[] = [];
      if (totalProfane / args.texts.length > 0.5)
        recommendations.push(
          'High profanity rate - consider stricter content guidelines',
        );
      if (topWords[0]?.count > args.texts.length * 0.1)
        recommendations.push(
          `"${topWords[0].word}" appears frequently - consider auto-censoring`,
        );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                summary: {
                  totalTexts: args.texts.length,
                  textsWithProfanity: totalProfane,
                  cleanTexts: totalClean,
                  profanityRate:
                    ((totalProfane / args.texts.length) * 100).toFixed(2) + '%',
                },
                severityDistribution,
                topProfaneWords: topWords,
                recommendations,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'compare_strictness',
    'Compare detection results across different strictness levels',
    { text: z.string().describe('The text to analyze') },
    async (args) => {
      const levels = {
        minimal: {
          config: {
            languages: ['english'] as Language[],
            detectLeetspeak: false,
            normalizeUnicode: false,
          },
          description: 'Basic English-only',
        },
        low: {
          config: {
            allLanguages: true,
            detectLeetspeak: false,
            normalizeUnicode: true,
            wordBoundaries: true,
          },
          description: 'All languages, Unicode norm',
        },
        medium: {
          config: {
            allLanguages: true,
            detectLeetspeak: true,
            normalizeUnicode: true,
            leetspeakLevel: 'moderate' as const,
          },
          description: 'Moderate leetspeak detection',
        },
        high: {
          config: {
            allLanguages: true,
            detectLeetspeak: true,
            normalizeUnicode: true,
            leetspeakLevel: 'aggressive' as const,
          },
          description: 'Aggressive detection',
        },
        paranoid: {
          config: {
            allLanguages: true,
            detectLeetspeak: true,
            normalizeUnicode: true,
            leetspeakLevel: 'aggressive' as const,
            wordBoundaries: false,
          },
          description: 'Maximum detection',
        },
      };

      const comparison: Record<
        string,
        {
          description: string;
          containsProfanity: boolean;
          profaneWords: string[];
          matchCount: number;
        }
      > = {};
      for (const [level, { config, description }] of Object.entries(levels)) {
        const result = checkProfanity(args.text, config);
        comparison[level] = {
          description,
          containsProfanity: result.containsProfanity,
          profaneWords: result.profaneWords,
          matchCount: result.profaneWords.length,
        };
      }

      const recommended =
        comparison.medium.matchCount === comparison.high.matchCount
          ? 'medium'
          : 'high';
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                text: args.text,
                comparison,
                recommendation: {
                  level: recommended,
                  reason: `"${recommended}" provides best balance`,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'create_regex_pattern',
    'Generate regex patterns for custom profanity detection',
    {
      word: z.string().describe('The base word'),
      includeVariants: z.enum(['basic', 'moderate', 'aggressive']).optional(),
    },
    async (args) => {
      const level = args.includeVariants ?? 'moderate';
      const word = args.word.toLowerCase();
      const substitutions: Record<string, string[]> = {
        a: ['a', '4', '@', '^'],
        b: ['b', '8'],
        c: ['c', '(', '<'],
        e: ['e', '3'],
        f: ['f', 'ph'],
        g: ['g', '9'],
        i: ['i', '1', '!'],
        l: ['l', '1', '|'],
        o: ['o', '0'],
        s: ['s', '5', '$'],
        t: ['t', '7', '+'],
        u: ['u', 'v'],
      };

      let pattern = '';
      for (const char of word) {
        const subs = substitutions[char] || [char];
        const count =
          level === 'basic' ? 2 : level === 'moderate' ? 3 : subs.length;
        const escaped = subs
          .slice(0, count)
          .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        pattern += `[${escaped.join('')}]+`;
        if (level === 'aggressive') pattern += '[\\s._-]*';
      }
      if (level === 'aggressive')
        pattern = pattern.replace(/\[\\s\._-\]\*$/, '');
      const regexPattern = `\\b${pattern}\\b`;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                baseWord: word,
                level,
                pattern: regexPattern,
                javascriptRegex: `/${regexPattern}/gi`,
                pythonRegex: `r"${regexPattern}"`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ========== CONVERSATION MEMORY TOOLS ==========

  server.tool(
    'track_user_message',
    'Track a user message and update their risk profile - enables pattern detection across messages',
    {
      userId: z.string().describe('Unique identifier for the user'),
      text: z.string().describe('The message text to track'),
      ...BaseConfigSchema.shape,
    },
    async (args) => {
      const config: FilterConfig = {
        languages: args.languages as Language[],
        detectLeetspeak: args.detectLeetspeak ?? true,
        normalizeUnicode: args.normalizeUnicode ?? true,
        severityLevels: true,
      };

      const result = checkProfanity(args.text, config);
      const profile = updateUserProfile(args.userId, args.text, result);

      let action = 'allow';
      let reason = 'User has acceptable history';
      if (profile.riskScore >= 80) {
        action = 'ban';
        reason = 'High risk user - consider permanent ban';
      } else if (profile.riskScore >= 60) {
        action = 'timeout';
        reason = 'Elevated risk - consider temporary timeout';
      } else if (profile.riskScore >= 40) {
        action = 'warn';
        reason = 'Moderate risk - issue warning';
      } else if (result.containsProfanity) {
        action = 'flag';
        reason = 'Message flagged but user history is acceptable';
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                messageResult: {
                  containsProfanity: result.containsProfanity,
                  profaneWords: result.profaneWords,
                },
                userProfile: {
                  userId: profile.userId,
                  riskScore: profile.riskScore,
                  totalMessages: profile.totalMessages,
                  flaggedMessages: profile.flaggedMessages,
                  flagRate:
                    (
                      (profile.flaggedMessages / profile.totalMessages) *
                      100
                    ).toFixed(1) + '%',
                  uniqueViolations: Array.from(profile.uniqueViolations),
                  memberSince: profile.firstSeen.toISOString(),
                },
                recommendation: { action, reason },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'get_user_profile',
    "Get a user's moderation profile and risk assessment",
    {
      userId: z.string().describe('The user ID to look up'),
      includeHistory: z
        .boolean()
        .optional()
        .describe('Include recent message history'),
    },
    async (args) => {
      const profile = userProfiles.get(args.userId);

      if (!profile) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  found: false,
                  message: 'User not found in tracking system',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const response: Record<string, unknown> = {
        found: true,
        userId: profile.userId,
        riskScore: profile.riskScore,
        riskLevel:
          profile.riskScore >= 80
            ? 'critical'
            : profile.riskScore >= 60
              ? 'high'
              : profile.riskScore >= 40
                ? 'moderate'
                : profile.riskScore >= 20
                  ? 'low'
                  : 'minimal',
        stats: {
          totalMessages: profile.totalMessages,
          flaggedMessages: profile.flaggedMessages,
          flagRate:
            ((profile.flaggedMessages / profile.totalMessages) * 100).toFixed(
              1,
            ) + '%',
          uniqueViolations: Array.from(profile.uniqueViolations).length,
          topViolations: Array.from(profile.uniqueViolations).slice(0, 5),
        },
        timeline: {
          firstSeen: profile.firstSeen.toISOString(),
          lastSeen: profile.lastSeen.toISOString(),
          accountAge:
            Math.floor(
              (Date.now() - profile.firstSeen.getTime()) /
                (1000 * 60 * 60 * 24),
            ) + ' days',
        },
      };

      if (args.includeHistory) {
        response.recentHistory = profile.history.slice(-10).map((h) => ({
          timestamp: h.timestamp.toISOString(),
          wasFlagged: h.wasFlagged,
          preview: h.text,
          violations: h.words,
        }));
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'get_high_risk_users',
    'Get list of users with high risk scores for review',
    {
      minRiskScore: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe('Minimum risk score threshold. Default: 50'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum users to return. Default: 20'),
    },
    async (args) => {
      const threshold = args.minRiskScore ?? 50;
      const limit = args.limit ?? 20;

      const highRiskUsers = Array.from(userProfiles.values())
        .filter((p) => p.riskScore >= threshold)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, limit)
        .map((p) => ({
          userId: p.userId,
          riskScore: p.riskScore,
          flagRate:
            ((p.flaggedMessages / p.totalMessages) * 100).toFixed(1) + '%',
          totalMessages: p.totalMessages,
          flaggedMessages: p.flaggedMessages,
          topViolations: Array.from(p.uniqueViolations).slice(0, 3),
          lastSeen: p.lastSeen.toISOString(),
        }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                threshold,
                totalTrackedUsers: userProfiles.size,
                highRiskCount: highRiskUsers.length,
                users: highRiskUsers,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'reset_user_profile',
    "Reset a user's moderation profile (use after appeals or timeouts)",
    {
      userId: z.string().describe('The user ID to reset'),
      keepHistory: z
        .boolean()
        .optional()
        .describe('Keep message history but reset risk score'),
    },
    async (args) => {
      const existed = userProfiles.has(args.userId);

      if (args.keepHistory && existed) {
        const profile = userProfiles.get(args.userId)!;
        profile.riskScore = 0;
        profile.flaggedMessages = 0;
        profile.uniqueViolations.clear();
      } else {
        userProfiles.delete(args.userId);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                userId: args.userId,
                existed,
                action: args.keepHistory ? 'risk_reset' : 'full_delete',
                message: existed
                  ? `User profile ${args.keepHistory ? 'risk score reset' : 'deleted'}`
                  : 'User was not being tracked',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ========== STREAMING / REAL-TIME TOOLS ==========

  server.tool(
    'stream_check',
    'Add message to real-time processing queue and get instant result - optimized for chat streams',
    {
      id: z
        .string()
        .optional()
        .describe('Optional message ID (auto-generated if not provided)'),
      userId: z.string().optional().describe('Optional user ID for tracking'),
      text: z.string().describe('The message text to check'),
      ...BaseConfigSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const messageId =
        args.id ||
        `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const config: FilterConfig = {
        languages: args.languages as Language[],
        detectLeetspeak: args.detectLeetspeak ?? true,
        normalizeUnicode: args.normalizeUnicode ?? true,
        cacheResults: true, // Enable caching for performance
      };

      const result = checkProfanity(args.text, config);
      const latencyMs = Date.now() - startTime;

      // Track user if provided
      if (args.userId) {
        updateUserProfile(args.userId, args.text, result);
      }

      // Store result for retrieval
      const streamResult: StreamResult = {
        id: messageId,
        containsProfanity: result.containsProfanity,
        profaneWords: result.profaneWords,
        processedAt: new Date(),
        latencyMs,
      };
      processedResults.set(messageId, streamResult);

      // Cleanup old results (keep last 1000)
      if (processedResults.size > 1000) {
        const oldestKey = processedResults.keys().next().value;
        if (oldestKey) processedResults.delete(oldestKey);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: messageId,
                containsProfanity: result.containsProfanity,
                profaneWords: result.profaneWords,
                action: result.containsProfanity ? 'block' : 'allow',
                latencyMs,
                timestamp: streamResult.processedAt.toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'stream_batch',
    'Process multiple messages in real-time batch mode - for high-throughput scenarios',
    {
      messages: z
        .array(
          z.object({
            id: z.string().optional(),
            userId: z.string().optional(),
            text: z.string(),
          }),
        )
        .min(1)
        .max(100)
        .describe('Array of messages to process'),
      ...BaseConfigSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();

      const config: FilterConfig = {
        languages: args.languages as Language[],
        detectLeetspeak: args.detectLeetspeak ?? true,
        normalizeUnicode: args.normalizeUnicode ?? true,
        cacheResults: true,
      };

      const results = args.messages.map((msg, idx) => {
        const messageId = msg.id || `msg_${Date.now()}_${idx}`;
        const result = checkProfanity(msg.text, config);

        if (msg.userId) {
          updateUserProfile(msg.userId, msg.text, result);
        }

        return {
          id: messageId,
          userId: msg.userId,
          containsProfanity: result.containsProfanity,
          profaneWords: result.profaneWords,
          action: result.containsProfanity ? 'block' : 'allow',
        };
      });

      const totalLatencyMs = Date.now() - startTime;
      const flagged = results.filter((r) => r.containsProfanity);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                summary: {
                  processed: results.length,
                  flagged: flagged.length,
                  allowed: results.length - flagged.length,
                  totalLatencyMs,
                  avgLatencyPerMessage:
                    (totalLatencyMs / results.length).toFixed(2) + 'ms',
                },
                results,
                flaggedIds: flagged.map((r) => r.id),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'get_stream_stats',
    'Get real-time streaming statistics and performance metrics',
    {},
    async () => {
      const recentResults = Array.from(processedResults.values()).slice(-100);
      const avgLatency =
        recentResults.length > 0
          ? recentResults.reduce((sum, r) => sum + r.latencyMs, 0) /
            recentResults.length
          : 0;
      const flagRate =
        recentResults.length > 0
          ? recentResults.filter((r) => r.containsProfanity).length /
            recentResults.length
          : 0;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                streaming: {
                  processedTotal: processedResults.size,
                  trackedUsers: userProfiles.size,
                },
                performance: {
                  recentSampleSize: recentResults.length,
                  avgLatencyMs: avgLatency.toFixed(2),
                  maxLatencyMs:
                    recentResults.length > 0
                      ? Math.max(...recentResults.map((r) => r.latencyMs))
                      : 0,
                  minLatencyMs:
                    recentResults.length > 0
                      ? Math.min(...recentResults.map((r) => r.latencyMs))
                      : 0,
                },
                moderation: {
                  recentFlagRate: (flagRate * 100).toFixed(1) + '%',
                  highRiskUsers: Array.from(userProfiles.values()).filter(
                    (p) => p.riskScore >= 50,
                  ).length,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ========== AI GUARDRAIL TOOLS ==========

  server.tool(
    'check_prompt_injection',
    'Scan text for prompt injection attacks using rule-based pattern matching. Returns a risk score (0-1), a decision (ALLOW / HITL / BLOCK), matched categories, and per-match position details. Custom patterns: max 20 patterns, each regex max 200 chars, 50 ms execution budget per pattern.',
    {
      text: z.string().describe('The text to scan for prompt injection signals'),
      strictness: z
        .enum(['lenient', 'moderate', 'strict'])
        .optional()
        .default('moderate')
        .describe(
          'Detection aggressiveness. lenient = fewer false positives, strict = amplified scoring. Default: moderate',
        ),
      blockAt: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .default(0.8)
        .describe('Score threshold at or above which the decision is BLOCK (0–1, default 0.8)'),
      hitlAt: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .default(0.5)
        .describe(
          'Score threshold at or above which the decision is HITL (human-in-the-loop) (0–1, default 0.5)',
        ),
      customPatterns: z
        .array(
          z.object({
            pattern: z
              .string()
              .max(200, 'Pattern must be 200 characters or fewer')
              .describe('Regex pattern string (max 200 chars)'),
            severity: z
              .enum(['low', 'medium', 'high', 'critical'])
              .describe('Severity of the pattern'),
            category: z
              .enum([
                'instruction_override',
                'jailbreak_persona',
                'system_prompt_leak',
                'delimiter_injection',
                'encoding_bypass',
                'tool_misuse',
              ])
              .describe('Category of the pattern'),
          }),
        )
        .max(20, 'At most 20 custom patterns are allowed')
        .optional()
        .describe('Additional custom patterns (max 20, each regex <= 200 chars, 50 ms budget per pattern)'),
    },
    async (args) => {
      // Validate cross-field constraint: hitlAt must be <= blockAt
      const hitlAt = args.hitlAt ?? 0.5;
      const blockAt = args.blockAt ?? 0.8;
      if (hitlAt > blockAt) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: 'INVALID_THRESHOLDS',
                  message: `hitlAt (${hitlAt}) must be less than or equal to blockAt (${blockAt})`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Safe custom pattern construction: ReDoS heuristic + try/catch + 50 ms timeout
      // Rejects (.+)+, (.*)*, *)+ constructs that cause catastrophic backtracking
      const REDOS_HEURISTIC = /(\.\+\)\+|\.\*\)\*|\*\)\+)/;
      const skippedReasons: string[] = [];

      const testWithTimeout = (
        regex: RegExp,
        text: string,
        timeoutMs: number,
      ): Promise<boolean | 'timeout'> =>
        Promise.race([
          new Promise<boolean>((resolve) => {
            resolve(regex.test(text));
          }),
          new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), timeoutMs),
          ),
        ]);

      const safeCustomPatterns: InjectionPattern[] = [];
      for (const [i, p] of (args.customPatterns ?? []).entries()) {
        const id = `custom-${i}:${p.category}`;

        // Reject patterns containing catastrophic backtracking constructs
        if (REDOS_HEURISTIC.test(p.pattern)) {
          skippedReasons.push(`custom-pattern-invalid:${id}`);
          continue;
        }

        // Wrap RegExp construction to avoid tool-call crash on invalid regex syntax
        let compiled: RegExp;
        try {
          compiled = new RegExp(p.pattern, 'i');
        } catch {
          skippedReasons.push(`custom-pattern-invalid:${id}`);
          continue;
        }

        // Pre-flight test with 50 ms timeout to detect catastrophic backtracking at runtime
        const probeResult = await testWithTimeout(compiled, args.text, 50);
        if (probeResult === 'timeout') {
          skippedReasons.push(`custom-pattern-timeout:${id}`);
          continue;
        }

        safeCustomPatterns.push({
          id,
          pattern: compiled,
          severity: p.severity,
          category: p.category,
          description: `Custom pattern for category ${p.category}`,
        });
      }

      const options: PromptInjectionOptions = {
        strictness: args.strictness,
        blockAt: args.blockAt,
        hitlAt: args.hitlAt,
        customPatterns: safeCustomPatterns.length > 0 ? safeCustomPatterns : undefined,
      };

      const result = checkPromptInjection(args.text, options);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                decision: result.decision,
                score: result.score,
                valid: result.valid,
                reasons: [...result.reasons, ...skippedReasons],
                matches: result.matches,
                scanner: result.scanner,
                summary:
                  result.decision === 'ALLOW'
                    ? 'No prompt injection detected'
                    : `Prompt injection detected — decision: ${result.decision}, score: ${result.score.toFixed(3)}, categories: ${result.reasons.join(', ')}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ========== SECRETS & PII SCANNER TOOLS ==========

  server.tool(
    'scan_secrets',
    'Scan text for leaked credentials, API keys, tokens, and other secrets. Returns a full ScanResult with per-match details including pattern id, family, and character positions.',
    {
      text: z
        .string()
        .max(50_000, 'Text must be 50,000 characters or fewer')
        .describe('The text to scan for secrets'),
      blockOnAny: z
        .boolean()
        .optional()
        .default(true)
        .describe('When true (default), any detected secret causes a BLOCK decision'),
      minEntropy: z
        .number()
        .optional()
        .default(4.0)
        .describe('Minimum Shannon entropy required for high-entropy pattern matches (default: 4.0)'),
    },
    async (args) => {
      try {
        const scanner = new SecretsScanner({
          blockOnAny: args.blockOnAny,
          minEntropy: args.minEntropy,
        });
        const result = scanner.scan(args.text);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  decision: result.decision,
                  score: result.score,
                  valid: result.valid,
                  reasons: result.reasons,
                  matches: result.matches,
                  scanner: result.scanner,
                  summary:
                    result.decision === 'ALLOW'
                      ? 'No secrets detected'
                      : `Secrets detected — decision: ${result.decision}, score: ${result.score.toFixed(3)}, patterns: ${result.reasons.join(', ')}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'SCAN_SECRETS_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
              }),
            },
          ],
        };
      }
    },
  );

  server.tool(
    'scan_pii',
    'Scan text for Personally Identifiable Information (email, phone, SSN, credit card, IBAN, IP, MAC, passport, date of birth, etc). Returns a full ScanResult with per-match details. Use redact_pii for a reversible vault-backed redaction.',
    {
      text: z
        .string()
        .max(50_000, 'Text must be 50,000 characters or fewer')
        .describe('The text to scan for PII'),
      redact: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'When true, returns sanitized text with [REDACTED_<TYPE>] placeholders (no vault — not reversible). For a reversible round-trip call redact_pii instead.',
        ),
    },
    async (args) => {
      try {
        const scanner = new PiiScanner({ redact: args.redact });
        const result = scanner.scan(args.text);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  decision: result.decision,
                  score: result.score,
                  valid: result.valid,
                  reasons: result.reasons,
                  matches: result.matches,
                  scanner: result.scanner,
                  ...(args.redact ? { sanitized: result.sanitized } : {}),
                  summary:
                    result.decision === 'ALLOW'
                      ? 'No PII detected'
                      : `PII detected — decision: ${result.decision}, score: ${result.score.toFixed(3)}, types: ${result.reasons.join(', ')}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'SCAN_PII_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
              }),
            },
          ],
        };
      }
    },
  );

  server.tool(
    'redact_pii',
    'Redact PII from text using a server-side vault for reversible round-trip. Returns sanitized text with [REDACTED_<TYPE>_N] placeholders, a vaultId to use for restoration, and a list of placeholder+type pairs. Original values never leave the server. Call restore_pii with the same vaultId to get originals back.',
    {
      text: z
        .string()
        .max(50_000, 'Text must be 50,000 characters or fewer')
        .describe('The text to redact PII from'),
      vaultId: z
        .string()
        .optional()
        .describe('Caller-chosen vault session identifier for round-trip. Omit to auto-generate.'),
    },
    async (args) => {
      try {
        const vaultId = args.vaultId ?? generateVaultId();
        const vault = getOrCreateVault(vaultId);
        const scanner = new PiiScanner({ redact: true, vault });
        const result = scanner.scan(args.text);
        // Build entries list — placeholders and types only, no originals
        const entries = (result.matches ?? []).map((m) => ({
          placeholder: `[REDACTED_${m.category.toUpperCase()}_*]`,
          type: m.category,
        }));
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  sanitized: result.sanitized,
                  vaultId,
                  entries,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'REDACT_PII_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
              }),
            },
          ],
        };
      }
    },
  );

  server.tool(
    'restore_pii',
    'Restore PII placeholders in text back to their original values using a vault session created by redact_pii. The vault is maintained server-side — originals were never sent to the AI client.',
    {
      sanitized: z
        .string()
        .max(50_000, 'Text must be 50,000 characters or fewer')
        .describe('The sanitized text containing [REDACTED_<TYPE>_N] placeholders'),
      vaultId: z
        .string()
        .describe('The vault session identifier returned by redact_pii'),
      strategy: z
        .enum(['exact', 'caseInsensitive', 'fuzzy', 'combined'])
        .optional()
        .default('combined')
        .describe(
          'Placeholder matching strategy: exact (default), caseInsensitive, fuzzy (Levenshtein ≤ 3), or combined (tries all in order). Default: combined',
        ),
    },
    async (args) => {
      try {
        const entry = vaultRegistry.get(args.vaultId);
        if (!entry) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'VAULT_NOT_FOUND',
                  message: `No vault session found for vaultId: ${args.vaultId}`,
                }),
              },
            ],
          };
        }
        entry.accessedAt = Date.now();
        const strategy = (args.strategy ?? 'combined') as RestoreStrategy;
        const restored = entry.vault.restore(args.sanitized, strategy);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ restored }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'RESTORE_PII_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
              }),
            },
          ],
        };
      }
    },
  );
}

// ============================================================================
// RESOURCE REGISTRATION
// ============================================================================

export function registerAllResources(server: McpServer): void {
  server.resource('languages', 'glin-profanity://languages', async () => ({
    contents: [
      {
        uri: 'glin-profanity://languages',
        mimeType: 'application/json',
        text: JSON.stringify({
          supported: SUPPORTED_LANGUAGES,
          total: SUPPORTED_LANGUAGES.length,
          regions: {
            european: [
              'english',
              'french',
              'german',
              'spanish',
              'italian',
              'dutch',
              'portuguese',
              'polish',
              'czech',
              'danish',
              'finnish',
              'hungarian',
              'norwegian',
              'swedish',
              'esperanto',
            ],
            asian: ['chinese', 'japanese', 'korean', 'thai', 'hindi'],
            middleEastern: ['arabic', 'persian', 'turkish'],
            other: ['russian'],
          },
        }),
      },
    ],
  }));

  server.resource(
    'config-examples',
    'glin-profanity://config-examples',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://config-examples',
          mimeType: 'application/json',
          text: JSON.stringify({
            examples: {
              basicModeration: {
                description: 'Simple English check',
                config: { languages: ['english'], wordBoundaries: true },
              },
              strictModeration: {
                description: 'All features enabled',
                config: {
                  allLanguages: true,
                  detectLeetspeak: true,
                  normalizeUnicode: true,
                  leetspeakLevel: 'aggressive',
                },
              },
              medicalContext: {
                description: 'Medical domain whitelist',
                config: {
                  languages: ['english'],
                  ignoreWords: ['breast', 'anal', 'rectal'],
                  enableContextAware: true,
                },
              },
              gamingPlatform: {
                description: 'Gaming with relaxed rules',
                config: {
                  languages: ['english'],
                  ignoreWords: ['noob', 'pwn', 'owned'],
                },
              },
              realtimeChat: {
                description: 'Optimized for streaming',
                config: {
                  detectLeetspeak: true,
                  normalizeUnicode: true,
                  cacheResults: true,
                },
              },
            },
          }),
        },
      ],
    }),
  );

  server.resource(
    'severity-levels',
    'glin-profanity://severity-levels',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://severity-levels',
          mimeType: 'application/json',
          text: JSON.stringify({
            levels: {
              exact: {
                value: 1,
                description: 'Direct dictionary match',
                falsePositiveRisk: 'Low',
                recommendation: 'Safe to auto-moderate',
              },
              fuzzy: {
                value: 2,
                description: 'Partial or obfuscated match',
                falsePositiveRisk: 'Medium',
                recommendation: 'Consider manual review',
              },
            },
            guidelines: {
              autoBlock: 'Exact matches on severe words',
              flagForReview: 'Fuzzy matches',
              contextAnalysis: 'Domain-specific content',
            },
          }),
        },
      ],
    }),
  );

  server.resource(
    'domain-whitelists',
    'glin-profanity://domain-whitelists',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://domain-whitelists',
          mimeType: 'application/json',
          text: JSON.stringify({
            domains: {
              medical: {
                description: 'Healthcare content',
                whitelistedTerms: [
                  'breast',
                  'anal',
                  'rectal',
                  'penis',
                  'vaginal',
                ],
              },
              gaming: {
                description: 'Video games',
                whitelistedTerms: [
                  'kill',
                  'shot',
                  'headshot',
                  'noob',
                  'pwn',
                  'owned',
                ],
              },
              technical: {
                description: 'Software/IT',
                whitelistedTerms: [
                  'master',
                  'slave',
                  'kill',
                  'abort',
                  'execute',
                  'dummy',
                ],
              },
              educational: {
                description: 'Academic content',
                whitelistedTerms: [
                  'sex',
                  'sexual',
                  'intercourse',
                  'reproduction',
                ],
              },
              culinary: {
                description: 'Food/cooking',
                whitelistedTerms: ['breast', 'thigh', 'balls', 'cock'],
              },
            },
          }),
        },
      ],
    }),
  );

  server.resource(
    'detection-guide',
    'glin-profanity://detection-guide',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://detection-guide',
          mimeType: 'application/json',
          text: JSON.stringify({
            techniques: {
              directMatch: {
                description: 'Dictionary lookup',
                catches: ['fuck', 'shit'],
                performance: 'Fastest',
              },
              leetspeakDetection: {
                description: 'Character substitutions',
                catches: ['f4ck', 'sh1t', '@ss'],
                levels: ['basic', 'moderate', 'aggressive'],
              },
              unicodeNormalization: {
                description: 'Homoglyph detection',
                catches: ['fυck', 'shіt'],
                performance: 'Minimal overhead',
              },
              contextAware: {
                description: 'Surrounding context analysis',
                benefits: ['Reduces false positives', 'Domain whitelisting'],
              },
            },
            recommendedConfigs: {
              chatModeration: {
                detectLeetspeak: true,
                normalizeUnicode: true,
                leetspeakLevel: 'moderate',
              },
              contentPublishing: {
                detectLeetspeak: true,
                normalizeUnicode: true,
                leetspeakLevel: 'aggressive',
                enableContextAware: true,
              },
              realtimeGaming: {
                detectLeetspeak: true,
                normalizeUnicode: true,
                leetspeakLevel: 'basic',
                cacheResults: true,
              },
            },
          }),
        },
      ],
    }),
  );

  // ========== COMPREHENSIVE DOCUMENTATION RESOURCES FOR AI AGENTS ==========
  // These resources expose the complete documentation for LLM/AI consumption

  server.resource('docs-index', 'glin-profanity://docs/index', async () => ({
    contents: [
      {
        uri: 'glin-profanity://docs/index',
        mimeType: 'text/markdown',
        text: `# glin-profanity Documentation Index

This MCP server provides comprehensive documentation resources for AI agents to understand and use glin-profanity.

## Available Documentation Resources

### Getting Started
- \`glin-profanity://docs/installation\` - Installation guide for all platforms
- \`glin-profanity://docs/getting-started\` - Quick start and basic usage
- \`glin-profanity://docs/configuration\` - Complete configuration reference
- \`glin-profanity://docs/faq\` - Frequently asked questions

### Core Documentation
- \`glin-profanity://docs/api-reference\` - Full API documentation
- \`glin-profanity://docs/advanced-features\` - Advanced features guide

### Integration Guides
- \`glin-profanity://docs/integrations/overview\` - AI integrations overview
- \`glin-profanity://docs/integrations/openai\` - OpenAI integration
- \`glin-profanity://docs/integrations/langchain\` - LangChain integration
- \`glin-profanity://docs/integrations/vercel-ai\` - Vercel AI SDK
- \`glin-profanity://docs/integrations/semantic\` - Semantic analysis

### Reference
- \`glin-profanity://languages\` - Supported languages list
- \`glin-profanity://config-examples\` - Configuration examples
- \`glin-profanity://domain-whitelists\` - Domain-specific whitelists
- \`glin-profanity://detection-guide\` - Detection techniques guide

## Usage for AI Agents

To access documentation:
1. List all resources to see available documentation
2. Read specific documentation using the resource URIs above
3. Use the tools (check_profanity, censor_text, etc.) with the documentation guidance
4. Reference FAQ for common questions and troubleshooting

Example:
\`\`\`
// Read installation guide
READ glin-profanity://docs/installation

// Read API reference
READ glin-profanity://docs/api-reference

// Then use tools
USE check_profanity WITH text="example"
\`\`\``,
      },
    ],
  }));

  server.resource(
    'docs-installation',
    'glin-profanity://docs/installation',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/installation',
          mimeType: 'text/markdown',
          text: `# Installation Guide

## JavaScript/TypeScript
\`\`\`bash
npm install glin-profanity
\`\`\`

## Python
\`\`\`bash
pip install glin-profanity
\`\`\`

## Import
\`\`\`javascript
import { Filter, checkProfanity } from 'glin-profanity';
\`\`\`

## Verification
\`\`\`javascript
const filter = new Filter();
console.log(filter.isProfane('test')); // Verify it works
\`\`\`

For complete installation guide including React, Next.js, CDN, and MCP setup, request the full documentation.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-getting-started',
    'glin-profanity://docs/getting-started',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/getting-started',
          mimeType: 'text/markdown',
          text: `# Getting Started with glin-profanity

## Quick Start

\`\`\`javascript
import { checkProfanity, Filter } from 'glin-profanity';

// Simple check
const result = checkProfanity("This is fucking bad");
// { containsProfanity: true, profaneWords: ['fucking'], ... }

// With configuration
const filter = new Filter({
  languages: ['english', 'spanish'],
  detectLeetspeak: true,
  normalizeUnicode: true
});

const result = filter.checkProfanity("f4ck this");
// Detects leetspeak: { containsProfanity: true, profaneWords: ['fuck'], ... }

// Censoring
const censored = filter.censorText("shit happens");
// { processedText: '**** happens', ... }
\`\`\`

## Core Methods

### checkProfanity(text, config?)
Check text for profanity and return detailed results.

### censorText(text, replaceWith?)
Replace profane words with censorship character.

### isProfane(text)
Boolean check - returns true/false.

## Common Configurations

\`\`\`javascript
// Strict (family-friendly)
const strict = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'aggressive',
  normalizeUnicode: true,
  partialMatching: true
});

// Moderate (recommended)
const moderate = new Filter({
  detectLeetspeak: true,
  leetspeakLevel: 'moderate',
  normalizeUnicode: true
});

// Lenient (obvious only)
const lenient = new Filter({
  detectLeetspeak: false,
  partialMatching: false
});
\`\`\`

For complete documentation, see other docs resources.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-configuration',
    'glin-profanity://docs/configuration',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/configuration',
          mimeType: 'text/markdown',
          text: `# Configuration Guide

## FilterConfig Interface

\`\`\`typescript
interface FilterConfig {
  // Languages
  languages?: Language[];                    // Default: ['english']
  
  // Detection
  detectLeetspeak?: boolean;                 // Default: true
  leetspeakLevel?: 'basic' | 'moderate' | 'aggressive';
  normalizeUnicode?: boolean;                // Default: true
  caseSensitive?: boolean;                   // Default: false
  partialMatching?: boolean;                 // Default: true
  
  // Replacement
  replaceWith?: string;                      // Default: '*'
  preserveLength?: boolean;                  // Default: true
  
  // Performance
  cacheResults?: boolean;                    // Default: true
  cacheSize?: number;                        // Default: 1000
  
  // Advanced
  customDictionary?: Map<string, number>;
  excludeWords?: string[];
  severityLevels?: boolean;
}
\`\`\`

## Key Options

### languages
Array of languages to check against. Supports 24 languages.

\`\`\`javascript
new Filter({ languages: ['english', 'spanish', 'french'] })
\`\`\`

### detectLeetspeak
Detect obfuscated profanity (f4ck, 5h1t, @ss).

\`\`\`javascript
new Filter({ detectLeetspeak: true, leetspeakLevel :'aggressive' })
\`\`\`

### normalizeUnicode
Detect homoglyphs (fυck with Greek 'υ', shіt with Cyrillic 'і').

\`\`\`javascript
new Filter({ normalizeUnicode: true })
\`\`\`

### excludeWords
Whitelist specific words.

\`\`\`javascript
new Filter({ excludeWords: ['damn', 'hell'] })
\`\`\`

## Presets

\`\`\`javascript
import { PRESETS } from 'glin-profanity';

const filter = new Filter(PRESETS.STRICT);
// or PRESETS.MODERATE, PRESETS.LENIENT
\`\`\`

## Use Case Examples

See config-examples resource for domain-specific configurations.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-api-reference',
    'glin-profanity://docs/api-reference',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/api-reference',
          mimeType: 'text/markdown',
          text: `# API Reference

## Core Functions

### checkProfanity(text: string, config?: FilterConfig): CheckProfanityResult

Check text for profanity with detailed results.

**Parameters:**
- \`text\`: The text to check
- \`config\`: Optional configuration

**Returns:**
\`\`\`typescript
{
  containsProfanity: boolean;
  profaneWords: string[];
  matches?: Match[];
  severityMap?: Record<string, number>;
  processedText?: string;
  wordCount: number;
}
\`\`\`

**Example:**
\`\`\`javascript
const result = checkProfanity('Hello world');
// { containsProfanity: false, profaneWords: [], wordCount: 2 }
\`\`\`

## Filter Class

### new Filter(config?: FilterConfig)

Create a reusable filter instance.

\`\`\`javascript
const filter = new Filter({
  languages: ['english'],
  detectLeetspeak: true
});
\`\`\`

### filter.checkProfanity(text: string): CheckProfanityResult

Check text using the filter's configuration.

### filter.isProfane(text: string): boolean

Quick boolean check.

### filter.censorText(text: string, replaceWith?: string): CensorResult

Replace profane words with censorship character.

**Returns:**
\`\`\`typescript
{
  originalText: string;
  processedText: string;
  containsProfanity: boolean;
  censoredWords: string[];
}
\`\`\`

### filter.batchCheck(texts: string[]): CheckProfanityResult[]

Check multiple texts efficiently.

## Types

\`\`\`typescript
type Language = 'english' | 'spanish' | ... // 24 total

interface Match {
  word: string;
  index: number;
  severity: number;
  contextScore?: number;
}

interface CheckProfanityResult {
  containsProfanity: boolean;
  profaneWords: string[];
  matches?: Match[];
  severityMap?: Record<string, number>;
  wordCount: number;
}
\`\`\`

## Supported Languages

${SUPPORTED_LANGUAGES.join(', ')}

Total: ${SUPPORTED_LANGUAGES.length} languages`,
        },
      ],
    }),
  );

  server.resource('docs-faq', 'glin-profanity://docs/faq', async () => ({
    contents: [
      {
        uri: 'glin-profanity://docs/faq',
        mimeType: 'text/markdown',
        text: `# FAQ - Frequently Asked Questions

## General

**Q: What makes glin-profanity different?**
A: Leetspeak detection, Unicode normalization, ML toxicity detection, 24 languages, and an obfuscation pipeline (separators, masking, HTML, stretched letters).

**Q: Is it free?**
A: Yes, MIT license. Free for personal and commercial use.

**Q: Does it work offline?**
A: Yes! All dictionaries bundled. No API calls needed.

## Technical

**Q: Bundle size?**
A: Core ~12KB + ~8KB per language dictionary. All 24 languages = ~180KB.

**Q: TypeScript support?**
A: Yes, full TypeScript support with exported types.

**Q: Browser support?**
A: Works in all modern browsers (Chrome 90+, Firefox 88+, Safari 14+).

## Performance

**Q: How fast is it?**
A: JavaScript: about 300,000 ops/sec uncached on short text (about 140,000 with aggressive leetspeak); a checkProfanity result-cache hit is about 25M ops/sec. Measure Python on your own workload.

**Q: Does it cache results?**
A: Yes, LRU cache enabled by default (configurable size).

## Features

**Q: Can it detect obfuscated profanity?**
A: Yes! Three levels: basic (f4ck), moderate (b!tch), aggressive (ƒ.u.c.k).

**Q: Custom dictionaries?**
A: Yes! Use customDictionary config option.

**Q: Whitelist words?**
A: Yes! Use excludeWords config option.

## Integration

**Q: Works with OpenAI?**
A: Yes! Full function calling integration via glin-profanity/ai/openai.

**Q: Works with LangChain?**
A: Yes! Pre-built tools via glin-profanity/ai/langchain.

**Q: Works with Vercel AI SDK?**
A: Yes! Tools via glin-profanity/ai/vercel.

**Q: MCP server for Claude?**
A: Yes! You're using it right now!

## Troubleshooting

**Q: Not detecting obvious profanity?**
A: Check language config, case sensitivity, and that word is in dictionary.

**Q: Flagging non-profane words?**
A: Disable partialMatching or use excludeWords whitelist.

**Q: Performance slow?**
A: Enable caching, use fewer languages, lower leetspeak level.

For more questions, see full FAQ documentation or open GitHub issue.`,
      },
    ],
  }));

  server.resource(
    'docs-integrations-overview',
    'glin-profanity://docs/integrations/overview',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/integrations/overview',
          mimeType: 'text/markdown',
          text: `# AI Integrations Overview

glin-profanity provides native integrations with major AI frameworks.

## Available Integrations

### OpenAI (glin-profanity/ai/openai)
Function calling tools for OpenAI models.

\`\`\`javascript
import { profanityTools } from 'glin-profanity/ai/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: profanityTools
});
\`\`\`

### LangChain (glin-profanity/ai/langchain)
Pre-built tools for LangChain agents.

\`\`\`javascript
import { allProfanityTools } from 'glin-profanity/ai/langchain';

const agent = createReactAgent({
  llm: model,
  tools: allProfanityTools
});
\`\`\`

### Vercel AI SDK (glin-profanity/ai/vercel)
Tools for Next.js, Remix, SvelteKit.

\`\`\`javascript
import { profanityTools } from 'glin-profanity/ai/vercel';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: profanityTools
});
\`\`\`

### Semantic Analysis (glin-profanity/ai/semantic)
Advanced embeddings-based toxicity detection.

\`\`\`javascript
import { createSemanticAnalyzer } from 'glin-profanity/ai/semantic';

const analyzer = createSemanticAnalyzer({
  embeddingProvider: yourProvider
});
\`\`\`

## Choosing an Integration

- **OpenAI**: Direct OpenAI SDK usage
- **LangChain**: Agent-based applications
- **Vercel AI SDK**: Next.js/React applications
- **Semantic**: Advanced toxicity beyond keywords

## Available Tools (All Integrations)

1. check_profanity - Detailed profanity check
2. censor_text - Replace profanity
3. batch_check - Multiple texts
4. analyze_context - Context-aware analysis
5. get_supported_languages - Language list

For detailed integration docs, see specific integration resources.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-integrations-openai',
    'glin-profanity://docs/integrations/openai',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/integrations/openai',
          mimeType: 'text/markdown',
          text: `# OpenAI Integration

Native function calling integration for OpenAI models.

## Installation

\`\`\`bash
npm install glin-profanity openai zod
\`\`\`

## Basic Usage

\`\`\`typescript
import OpenAI from 'openai';
import { profanityTools, executeProfanityTool } from 'glin-profanity/ai/openai';

const client = new OpenAI();

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Check if "damn" is profanity' }],
  tools: profanityTools
});

// Handle tool calls
for (const toolCall of response.choices[0].message.tool_calls || []) {
  const result = await executeProfanityTool(
    toolCall.function.name,
    JSON.parse(toolCall.function.arguments)
  );
  console.log(result);
}
\`\`\`

## Available Tools

1. **check_profanity** - Detailed check with severity
2. **censor_text** - Replace profane words
3. **batch_check_profanity** - Check multiple texts
4. **analyze_context** - Context-aware analysis
5. **get_supported_languages** - Language list

## Automated Execution

\`\`\`typescript
import { createRunnableTools } from 'glin-profanity/ai/openai';

const runner = client.beta.chat.completions.runTools({
  model: 'gpt-4o',
  messages: [...],
  tools: createRunnableTools()
});

runner.on('message', (msg) => console.log(msg));
const result = await runner.finalContent();
\`\`\`

## With Zod Schemas

\`\`\`typescript
import { zodFunction } from 'openai/helpers/zod';
import { profanityToolSchemas } from 'glin-profanity/ai/openai';

const tools = [
  zodFunction({
    name: 'check_profanity',
    parameters: profanityToolSchemas.checkProfanity()
  })
];
\`\`\`

## Streaming Support

\`\`\`typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: profanityTools,
  stream: true
});

for await (const chunk of stream) {
  // Process chunks with tool calls
}
\`\`\`

Compatible with GPT-4o, GPT-4, GPT-3.5-turbo.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-integrations-langchain',
    'glin-profanity://docs/integrations/langchain',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/integrations/langchain',
          mimeType: 'text/markdown',
          text: `# LangChain Integration

Pre-built tools for LangChain.js agents and chains.

## Installation

\`\`\`bash
npm install glin-profanity @langchain/core zod
\`\`\`

## Basic Usage

\`\`\`typescript
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { allProfanityTools } from 'glin-profanity/ai/langchain';

const model = new ChatOpenAI({ modelName: 'gpt-4o' });

const agent = createReactAgent({
  llm: model,
  tools: allProfanityTools
});

const result = await agent.invoke({
  messages: [{ role: 'user', content: 'Moderate this message' }]
});
\`\`\`

## Available Tools

Pre-built tool instances:
- \`profanityCheckTool\`
- \`censorTextTool\`
- \`batchCheckTool\`
- \`contextAnalysisTool\`
- \`supportedLanguagesTool\`
- \`allProfanityTools\` (all bundled)

## With Custom Chains

\`\`\`typescript
import { profanityCheckTool, censorTextTool } from 'glin-profanity/ai/langchain';

const modelWithTools = model.bindTools([
  profanityCheckTool,
  censorTextTool
]);

const chain = prompt.pipe(modelWithTools);
const result = await chain.invoke({ input: 'Check this' });
\`\`\`

## Direct Tool Invocation

\`\`\`typescript
const result = await profanityCheckTool.invoke({
  text: 'Hello world',
  detectLeetspeak: true
});
// { containsProfanity: false, profaneWords: [], wordCount: 2 }
\`\`\`

## With LangGraph

\`\`\`typescript
import { StateGraph } from '@langchain/langgraph';

const workflow = new StateGraph({ ... })
  .addNode('checkProfanity', async (state) => {
    const result = await profanityCheckTool.invoke({
      text: state.message
    });
    return { ...state, moderation: result };
  })
  .addEdge('checkProfanity', 'generateResponse');
\`\`\`

## Custom Configuration

\`\`\`typescript
import { createAllProfanityTools } from 'glin-profanity/ai/langchain';

const customTools = createAllProfanityTools({
  languages: ['english', 'spanish'],
  detectLeetspeak: true
});
\`\`\`

Compatible with LangChain.js and LangGraph.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-integrations-vercel',
    'glin-profanity://docs/integrations/vercel',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/integrations/vercel',
          mimeType: 'text/markdown',
          text: `# Vercel AI SDK Integration

Native tools for Vercel AI SDK - works with Next.js, Remix, SvelteKit.

## Installation

\`\`\`bash
npm install glin-profanity ai @ai-sdk/openai zod
\`\`\`

## Basic Usage

\`\`\`typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { profanityTools } from 'glin-profanity/ai/vercel';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Check this for profanity',
  tools: profanityTools
});

console.log(result.text);
console.log(result.toolResults);
\`\`\`

## Next.js API Route

\`\`\`typescript
// app/api/moderate/route.ts
import { streamText } from 'ai';
import { profanityTools } from 'glin-profanity/ai/vercel';

export async function POST(req: Request) {
  const { message } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    prompt: \`Check: "\${message}"\`,
    tools: profanityTools
  });

  return result.toAIStreamResponse();
}
\`\`\`

## With useChat Hook

\`\`\`typescript
'use client';
import { useChat } from 'ai/react';

export function ChatComponent() {
  const { messages, input, handleSubmit } = useChat({
    api: '/api/chat'
  });

  return (
    <form onSubmit={handleSubmit}>
      <input value={input} />
    </form>
  );
}
\`\`\`

## Middleware Helpers

\`\`\`typescript
import { profanityMiddleware } from 'glin-profanity/ai/vercel';

const check = profanityMiddleware.checkMessage(message);
if (check.blocked) {
  return Response.json({ error: check.reason }, { status: 400 });
}
\`\`\`

## Available Tools Object

\`\`\`typescript
profanityTools = {
  checkProfanity: VercelAITool,
  censorText: VercelAITool,
  batchCheckProfanity: VercelAITool,
  analyzeContext: VercelAITool,
  getSupportedLanguages: VercelAITool
}
\`\`\`

## Edge Runtime Support

Works in Vercel Edge Functions, Cloudflare Workers, and other edge runtimes.

\`\`\`typescript
export const runtime = 'edge';

export async function POST(req: Request) {
  const result = await generateText({
    model: openai('gpt-4o'),
    tools: profanityTools,
    // ...
  });
}
\`\`\`

Compatible with Next.js (App & Pages Router), Remix, SvelteKit.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-integrations-semantic',
    'glin-profanity://docs/integrations/semantic',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/integrations/semantic',
          mimeType: 'text/markdown',
          text: `# Semantic Analysis Integration

Advanced toxicity detection using text embeddings - goes beyond keyword matching.

## Installation

\`\`\`bash
npm install glin-profanity openai  # or your embedding provider
\`\`\`

## Basic Usage

\`\`\`typescript
import { 
  createSemanticAnalyzer,
  createFetchEmbeddingProvider 
} from 'glin-profanity/ai/semantic';

// Create embedding provider
const embeddingProvider = createFetchEmbeddingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});

// Create analyzer
const analyzer = createSemanticAnalyzer({
  embeddingProvider,
  keywordWeight: 0.6,      // 60% keyword detection
  semanticWeight: 0.4,     // 40% semantic similarity
  threshold: 0.5           // Flag if score >= 0.5
});

// Analyze text
const result = await analyzer.analyze('This is toxic content');
console.log(result.shouldFlag);        // true
console.log(result.combinedScore);     // 0.72
console.log(result.keywordScore);      // 0.5
console.log(result.semanticScore);     // 0.9
\`\`\`

## How It Works

Combines two approaches:
1. **Keyword Detection**: Traditional profanity dictionary matching
2. **Semantic Analysis**: Compare embeddings to toxic reference patterns

This catches toxic content that doesn't contain explicit profanity:
- "You should disappear forever"
- "You're as useful as a broken pencil"
- "You should uninstall life"

## Embedding Providers

### OpenAI
\`\`\`typescript
const provider = createFetchEmbeddingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});
\`\`\`

### Azure OpenAI
\`\`\`typescript
const provider = createFetchEmbeddingProvider({
  apiKey: process.env.AZURE_KEY,
  model: 'deployment-name',
  baseUrl: 'https://your-resource.openai.azure.com',
  headers: { 'api-version': '2024-02-01' }
});
\`\`\`

### Local Ollama
\`\`\`typescript
const provider = createFetchEmbeddingProvider({
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434',
  endpoint: '/api/embeddings',
  parseResponse: (data) => data.embedding
});
\`\`\`

## Analyzer Methods

### analyze(text: string)
Analyze single text.

### analyzeBatch(texts: string[])
Analyze multiple texts in parallel.

### addToxicPatterns(patterns: string[])
Add custom toxic reference patterns.

### clearCache()
Clear cached embeddings.

## Hooks

\`\`\`typescript
import { semanticHooks } from 'glin-profanity/ai/semantic';

// Pre-process message
const { shouldBlock, reason } = await semanticHooks.preProcessMessage(
  message,
  analyzer
);

// Post-process AI response
const { isSafe, analysis } = await semanticHooks.postProcessAIResponse(
  aiResponse,
  analyzer
);

// Monitor conversation
const monitor = semanticHooks.createConversationMonitor(analyzer);
await monitor.addMessage('user', 'Hello');
const report = await monitor.getReport();
\`\`\`

## Custom Toxic Patterns

\`\`\`typescript
await analyzer.addToxicPatterns([
  'Your domain-specific toxic pattern',
  'Another harmful phrase'
]);
\`\`\`

Perfect for domain-specific moderation (e-commerce reviews, gaming chat, etc.).`,
        },
      ],
    }),
  );

  server.resource(
    'docs-examples',
    'glin-profanity://docs/examples',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/examples',
          mimeType: 'text/markdown',
          text: `# Examples Library

Quick-reference examples for common use cases.

## Basic Usage

\`\`\`typescript
import { Filter, checkProfanity } from 'glin-profanity';

// Simple check
const result = checkProfanity('test message');
console.log(result.containsProfanity); // false

// With filter
const filter = new Filter({ detectLeetspeak: true });
const result2 = filter.checkProfanity('f4ck');
console.log(result2.containsProfanity); // true

// Censorship
const censored = filter.censorText('shit happens');
console.log(censored.processedText); // "**** happens"
\`\`\`

## React Integration

\`\`\`typescript
import { Filter } from 'glin-profanity';
import { use State } from 'react';

const filter = new Filter({ detectLeetspeak: true });

function ChatInput() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const result = filter.checkProfanity(text);
    if (result.containsProfanity) {
      setError('Inappropriate language detected');
      return;
    }
    // Submit message
  };

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit}>Send</button>
    </div>
  );
}
\`\`\`

## Next.js API Route

\`\`\`typescript
// app/api/moderate/route.ts
import { Filter } from 'glin-profanity';

const filter = new Filter({ detectLeetspeak: true });

export async function POST(request: Request) {
  const { text } = await request.json();
  
  const result = filter.checkProfanity(text);
  
  return Response.json({
    approved: !result.containsProfanity,
    profaneWords: result.profaneWords
  });
}
\`\`\`

## AI Integration

\`\`\`typescript
import { profanityTools } from 'glin-profanity/ai/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: profanityTools
});
\`\`\`

For more examples, see the full examples documentation.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-testing',
    'glin-profanity://docs/testing',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/testing',
          mimeType: 'text/markdown',
          text: `# Testing Guide (Condensed)

## Unit Testing

\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { Filter, checkProfanity } from 'glin-profanity';

describe('Profanity Detection', () => {
  it('should detect profanity', () => {
    const result = checkProfanity('fuck this');
    expect(result.containsProfanity).toBe(true);
  });

  it('should not flag clean text', () => {
    const result = checkProfanity('hello world');
    expect(result.containsProfanity).toBe(false);
  });

  it('should detect leetspeak', () => {
    const filter = new Filter({ detectLeetspeak: true });
    const result = filter.checkProfanity('f4ck');
    expect(result.containsProfanity).toBe(true);
  });
});
\`\`\`

## Mocking

\`\`\`typescript
import { vi } from 'vitest';

vi.mock('glin-profanity', () => ({
  checkProfanity: vi.fn((text) => ({
    containsProfanity: false,
    profaneWords: [],
    wordCount: text.split(' ').length
  }))
}));
\`\`\`

## React Component Testing

\`\`\`typescript
import { render, screen, fireEvent } from '@testing-library/react';

describe('ChatInput', () => {
  it('should show warning for profane input', () => {
    render(<ChatInput />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'shit' } });
    
    expect(screen.getByText('Please use appropriate language')).toBeInTheDocument();
  });
});
\`\`\`

For comprehensive testing guide, see full documentation.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-deployment',
    'glin-profanity://docs/deployment',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/deployment',
          mimeType: 'text/markdown',
          text: `# Deployment Guide (Condensed)

## Environment Variables

\`\`\`bash
GLIN_PROFANITY_LANGUAGES=english,spanish
GLIN_PROFANITY_LEETSPEAK=true
GLIN_PROFANITY_CACHE_SIZE=5000
\`\`\`

## Node.js Production

\`\`\`typescript
import { Filter } from 'glin-profanity';

const filter = new Filter({
  languages: process.env.GLIN_PROFANITY_LANGUAGES?.split(','),
  detectLeetspeak: process.env.GLIN_PROFANITY_LEETSPEAK === 'true',
  cacheResults: true,
  cacheSize: parseInt(process.env.GLIN_PROFANITY_CACHE_SIZE || '5000')
});
\`\`\`

## Serverless (AWS Lambda)

\`\`\`typescript
// Initialize outside handler for reuse
const filter = new Filter({ cacheResults: true });

export const handler = async (event) => {
  const { text } = JSON.parse(event.body);
  const result = filter.checkProfanity(text);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};
\`\`\`

## Edge (Vercel)

\`\`\`typescript
export const config = { runtime: 'edge' };

const filter = new Filter({ detectLeetspeak: true });

export default async function handler(request: Request) {
  const { text } = await request.json();
  const result = filter.checkProfanity(text);
  
  return Response.json(result);
}
\`\`\`

## Docker

\`\`\`dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "dist/server.js"]
\`\`\`

For comprehensive deployment guide, see full documentation.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-security',
    'glin-profanity://docs/security',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/security',
          mimeType: 'text/markdown',
          text: `# Security Guide (Condensed)

## Input Validation

\`\`\`typescript
import { z } from 'zod';

const Schema = z.object({
  text: z.string().min(1).max(10000).trim()
});

const validated = Schema.parse(input);
const result = filter.checkProfanity(validated.text);
\`\`\`

## Rate Limiting

\`\`\`typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit per IP
});

app.use('/api/moderate', limiter);
\`\`\`

## API Key Security

\`\`\`typescript
// ❌ BAD
const apiKey = 'sk-proj-abc123...';

// ✅ GOOD
const apiKey = process.env.OPENAI_API_KEY;
\`\`\`

## Content Sanitization

\`\`\`typescript
function sanitize(text: string): string {
  return text
    .trim()
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control chars
    .replace(/\s+/g, ' '); // Normalize whitespace
}

const result = filter.checkProfanity(sanitize(userInput));
\`\`\`

## GDPR Compliance

\`\`\`typescript
// Don't store full text
await db.store({
  userId: hashUserId(userId), // Anonymized
  textHash: hashText(text), // For deduplication
  containsProfanity: result.containsProfanity,
  timestamp: Date.now()
});
\`\`\`

For comprehensive security guide, see full documentation.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-features',
    'glin-profanity://docs/features',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/features',
          mimeType: 'text/markdown',
          text: `# Features Overview

Complete list of all glin-profanity features.

## Core Detection Features

### Profanity Detection
- 24 languages supported
- About 300,000 ops/sec uncached on short text
- F1 99.0% on the English shootout set (authored alongside the engine, so optimistic)

### Leetspeak Detection ⭐
- Three levels: basic, moderate, aggressive
- Detects: f4ck, 5h1t, @ss, etc.
- About 180,000 ops/sec with moderate level

### Unicode Normalization ⭐
- Detects 2,000+ homoglyph variations
- Cyrillic/Greek lookalikes
- Zero-width and full-width characters

### Context-Aware Detection
- Domain-specific whitelists (medical, gaming, technical)
- Reduces false positives
- Smart Scunthorpe protection

## AI & ML Features

### ML Toxicity Detection
\`\`\`typescript
import { loadToxicityModel, checkToxicity } from 'glin-profanity/ml';

await loadToxicityModel({ threshold: 0.9 });
const result = await checkToxicity(text);
\`\`\`

**Detects:** toxicity, insults, threats, identity attacks, obscene content

### Semantic Analysis 🧠
\`\`\`typescript
import { createSemanticAnalyzer } from 'glin-profanity/ai/semantic';

const analyzer = createSemanticAnalyzer({
  embeddingProvider: provider,
  threshold:  0.7
});

const result = await analyzer.analyze(text);
\`\`\`

**Catches:** Toxic content without profanity keywords

### AI Framework Integrations
- OpenAI function calling
- LangChain tools
- Vercel AI SDK
- MCP server (Claude, Cursor, Windsurf)

## Performance Features

### Result Caching ⚡
\`\`\`typescript
const filter = new Filter({
  cacheResults: true,
  cacheSize: 5000
});
\`\`\`

**Performance:** cache hits skip detection (about 25M ops/sec on a hit)

### Batch Processing
\`\`\`typescript
const results = filter.batchCheck(texts);
\`\`\`

**Scalability:** Parallelized processing

### Streaming Support
\`\`\`typescript
async function* moderateStream(messages) {
  for await (const message of messages) {
    yield filter.checkProfanity(message);
  }
}
\`\`\`

## Integration Features

### Frameworks
- React (hook: useProfanityChecker)
- Next.js (App Router & Pages Router)
- Vue, Angular, Svelte
- Express, Fastify, Hono

### Serverless
- AWS Lambda, Google Cloud Functions
- Vercel Edge, Cloudflare Workers
- All major serverless platforms

### Languages
- JavaScript/TypeScript
- Python (pip install glin-profanity)

## Developer Features

### Custom Dictionaries
\`\`\`typescript
const customWords = new Map([
  ['badword', 1.0],  // severity
]);

const filter = new Filter({ customDictionary: customWords });
\`\`\`

### Word Exclusions
\`\`\`typescript
const filter = new Filter({
  excludeWords: ['damn', 'hell']
});
\`\`\`

### Full TypeScript Support
Complete type definitions included.

For complete features documentation, see the full features guide.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-mcp-guide',
    'glin-profanity://docs/mcp-guide',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/mcp-guide',
          mimeType: 'text/markdown',
          text: `# MCP Server Guide

Model Context Protocol integration for AI assistants.

## What is MCP?

MCP enables AI assistants to access profanity detection tools directly.

**Available:**
- 19 profanity detection tools
- 20 documentation resources
- 5 guided workflow prompts

## Installation

### Claude Desktop

\`\`\`bash
npx glin-profanity-mcp --install-claude
\`\`\`

Or manually edit \`~/Library/Application Support/Claude/claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "glin-profanity": {
      "command": "npx",
      "args": ["-y", "glin-profanity-mcp"]
    }
  }
}
\`\`\`

### Cursor

Edit \`~/.cursor/mcp_settings.json\`:

\`\`\`json
{
  "mcpServers": {
    "glin-profanity": {
      "command": "npx",
      "args": ["-y", "glin-profanity-mcp"]
    }
  }
}
\`\`\`

### Windsurf

Edit \`~/.windsurf/mcp_config.json\`:

\`\`\`json
{
  "glin-profanity": {
    "command": "npx",
    "args": ["-y", "glin-profanity-mcp"]
  }
}
\`\`\`

## Available Tools

### Core Tools
- \`check_profanity\` - Check text for profanity
- \`censor_text\` - Replace profane words
- \`batch_check_profanity\` - Check multiple texts
- \`analyze_context\` - Context-aware analysis
- \`get_supported_languages\` - List languages

### Advanced Tools
- \`validate_content\` - Multi-layer validation
- \`compare_strictness\` - Test strictness levels
- \`suggest_alternatives\` - Get replacements
- \`explain_match\` - Explain why flagged
- \`generate_report\` - Create moderation report

## Available Resources

### Documentation
- \`glin-profanity://docs/index\` - Documentation index
- \`glin-profanity://docs/getting-started\` - Quick start
- \`glin-profanity://docs/installation\` - Installation
- \`glin-profanity://docs/configuration\` - Configuration
- \`glin-profanity://docs/api-reference\` - API docs
- \`glin-profanity://docs/examples\` - Examples
- \`glin-profanity://docs/features\` - Features overview
- \`glin-profanity://docs/mcp-guide\` - This guide

### Integrations
- \`glin-profanity://docs/integrations/openai\` - OpenAI integration
- \`glin-profanity://docs/integrations/langchain\` - LangChain
- \`glin-profanity://docs/integrations/vercel\` - Vercel AI SDK
- \`glin-profanity://docs/integrations/semantic\` - Semantic analysis

### Reference
- \`glin-profanity://languages\` - Supported languages
- \`glin-profanity://config-examples\` - Config examples
- \`glin-profanity://severity-levels\` - Severity guide

## Available Prompts

### content_moderation
Step-by-step moderation workflow.

**Parameters:**
- \`content\` (string) - Content to moderate
- \`platform\` (optional) - Platform type

### content_cleanup
Clean up profane content.

**Parameters:**
- \`content\` (string) - Content to clean
- \`preserveMeaning\` (boolean) - Preserve meaning

### audit_report
Generate comprehensive audit report.

### filter_tuning
Tune filter for your use case.

### user_review
Review user moderation history.

## Usage Examples

### Check Profanity
\`\`\`
User: "Check if this is appropriate: 'f4ck this game'"

Claude:
1. READ glin-profanity://docs/getting-started
2. USE TOOL check_profanity WITH { "text": "f4ck this game", "detectLeetspeak": true }
3. Response: "Contains profanity: 'fuck' (obfuscated as'f4ck')"
\`\`\`

### Get Configuration Help
\`\`\`
User: "How should I configure for medical forum?"

Claude:
1. READ glin-profanity://docs/configuration
2. READ glin-profanity://config-examples
3. Provide medical whitelist configuration
\`\`\`

## Troubleshooting

### Server Not Found
\`\`\`bash
# Verify installation
npx glin-profanity-mcp --version

# Check config file location
# Restart AI assistant
\`\`\`

### Tools Not Working
Check logs:
\`\`\`bash
tail -f ~/Library/Logs/Claude/mcp-server-glin-profanity.log
\`\`\`

For complete MCP guide, see full documentation.`,
        },
      ],
    }),
  );

  server.resource(
    'docs-openclaw',
    'glin-profanity://docs/integrations/openclaw',
    async () => ({
      contents: [
        {
          uri: 'glin-profanity://docs/integrations/openclaw',
          mimeType: 'text/markdown',
          text: `# OpenClaw Integration

Content moderation for multi-platform AI agents.

## What is OpenClaw?

OpenClaw (formerly Moltbot/Clawdbot) powers AI agents across:
- 💬 WhatsApp
- 📱 Telegram
- 💭 Discord
- 💼 Slack
- 📲 iMessage

## Installation

\`\`\`bash
openclaw plugins install @glin/openclaw-profanity
# or
npm install @glin/openclaw-profanity
\`\`\`

## Integration Methods

### 1. Skills (Easy)
Markdown-based profanity detection skills.

\`\`\`typescript
import { generateSkillFiles } from '@glin/openclaw-profanity/skills';
await generateSkillFiles('./skills');
\`\`\`

### 2. Hooks (Auto-Moderation)
Automatically moderate all incoming messages.

\`\`\`typescript
import { createProfanityGuard } from '@glin/openclaw-profanity/hooks';

const guard = createProfanityGuard({
  blockProfanity: true,
  platforms: ['whatsapp', 'telegram', 'discord'],
  detectLeetspeak: true,
  warningMessage: '⚠️ Message blocked - inappropriate language.'
});
\`\`\`

**Modes:**
- Block: Prevent profane messages
- Censor: Replace profanity with ***
- Warn: Allow but notify user

### 3. Plugin (Advanced)
Register profanity tools in OpenClaw.

\`\`\`typescript
import { registerProfanityTools } from '@glin/openclaw-profanity/plugin';

export function activate(api: OpenClawAPI) {
  registerProfanityTools(api);
}
\`\`\`

**Available Tools:**
- check_profanity
- censor_text
- batch_check
- analyze_context

### 4. MCP Server
Use as MCP server in OpenClaw.

\`\`\`json5
// openclaw.config.json5
{
  mcpServers: {
    "glin-profanity": {
      command: "npx",
      args: ["-y", "@glin/openclaw-profanity", "mcp-server"]
    }
  }
}
\`\`\`

## Use Cases

### WhatsApp Group Moderation
\`\`\`typescript
const guard = createProfanityGuard({
  blockProfanity: true,
  platforms: ['whatsapp'],
  trackViolations: true,
  violationThreshold: 3,
  onViolation: async (user, violation) => {
    if (violation.count >= 3) {
      await openclaw.whatsapp.removeFromGroup(user.id);
    }
  }
});
\`\`\`

### Multi-Platform Bot
\`\`\`typescript
const guard = createProfanityGuard({
  platformOverrides: {
    discord: { censorProfanity: true }, // Lenient
    telegram: { blockProfanity: true }, // Strict
    whatsapp: { blockProfanity: true }  // Strict
  }
});
\`\`\`

## Configuration

\`\`\`typescript
const guard = createProfanityGuard({
  // Detection
  detectLeetspeak: true,
  leetspeakLevel: 'moderate',
  languages: ['english', 'spanish'],
  
  // Moderation mode
  blockProfanity: true,    // Block messages
  censorProfanity: false,  // Or censor
  warnOnly: false,         // Or warn only
  
  // Platforms
  platforms: ['whatsapp', 'telegram', 'discord'],
  
  // User tracking
  trackViolations: true,
  violationThreshold: 3,
  timeoutDuration: 3600000,  // 1 hour
  
  // Customization
  warningMessage: 'Your custom message',
  replaceWith: '***',
  excludeWords: ['technical', 'terms']
});
\`\`\`

## Features

- ✅ 24 languages supported
- ✅ Leetspeak detection (f4ck, sh1t, @ss)
- ✅ Auto-moderation with hooks
- ✅ Platform-specific rules
- ✅ User violation tracking
- ✅ Customizable responses
- ✅ 4 integration methods

For complete documentation, see the full OpenClaw guide.`,
        },
      ],
    }),
  );
}

// ============================================================================
// PROMPT REGISTRATION
// ============================================================================

export function registerAllPrompts(server: McpServer): void {
  server.prompt(
    'content_moderation',
    'Step-by-step content moderation workflow',
    {
      content: z.string().describe('The content to moderate'),
      platform: z
        .enum([
          'social_media',
          'gaming',
          'education',
          'professional',
          'general',
        ])
        .optional(),
    },
    async (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `You are a content moderator. Analyze this content:\n\n**Content:** ${args.content}\n**Platform:** ${args.platform || 'general'}\n\n1. Use \`check_profanity\` to scan\n2. Use \`explain_match\` for flagged words\n3. Use \`validate_content\` for final scoring\n4. Recommend: APPROVE, FLAG_FOR_REVIEW, EDIT_REQUIRED, or REJECT`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'content_cleanup',
    'Clean up content containing profanity',
    {
      content: z.string().describe('The content to clean up'),
      preserveMeaning: z.boolean().optional(),
    },
    async (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Clean up this content for safe publishing:\n\n**Content:** ${args.content}\n\n1. Use \`check_profanity\` to identify issues\n2. Use \`suggest_alternatives\` for replacements\n3. ${args.preserveMeaning ? 'Preserve the original meaning' : 'Make completely safe'}\n4. Provide cleaned version`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'audit_report',
    'Generate a comprehensive audit report',
    {
      description: z.string().describe('Description of content being audited'),
    },
    async (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Generate a content moderation audit report.\n\n**Description:** ${args.description}\n\n1. Use \`batch_check\` on the content\n2. Use \`analyze_corpus\` for statistics\n3. Generate summary with compliance rate, common violations, and recommendations`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'filter_tuning',
    'Tune filter settings for your use case',
    {
      useCase: z.string().describe("Your use case (e.g., 'gaming chat')"),
      sampleContent: z.string().optional(),
    },
    async (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Help tune profanity filter settings.\n\n**Use Case:** ${args.useCase}${args.sampleContent ? `\n**Sample:** ${args.sampleContent}` : ''}\n\n1. Use \`compare_strictness\` to test levels\n2. Identify false positives\n3. Recommend optimal configuration`,
          },
        },
      ],
    }),
  );

  server.prompt(
    'user_review',
    "Review a user's moderation history and risk profile",
    { userId: z.string().describe('The user ID to review') },
    async (args) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Review this user's moderation profile:\n\n**User ID:** ${args.userId}\n\n1. Use \`get_user_profile\` with includeHistory=true\n2. Analyze their violation patterns\n3. Recommend action: no_action, warning, timeout, or ban\n4. Consider appeals if risk score seems disproportionate`,
          },
        },
      ],
    }),
  );
}
