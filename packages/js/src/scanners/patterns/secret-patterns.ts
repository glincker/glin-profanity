/**
 * Secret detection patterns for the SecretsScanner.
 *
 * Pattern attribution:
 *   - ProtectAI/llm-guard (MIT) — https://github.com/protectai/llm-guard
 *   - Yelp/detect-secrets (Apache-2.0) — https://github.com/Yelp/detect-secrets
 *
 * Patterns have been reimplemented in TypeScript — no source was copied verbatim.
 *
 * @module scanners/patterns/secret-patterns
 */

/** Severity level for a detected secret. */
export type SecretSeverity = 'low' | 'medium' | 'high' | 'critical';

/** A single secret detection rule. */
export interface SecretPattern {
  /** Unique identifier, e.g. "SEC-AWS-001". */
  id: string;
  /** Human-readable name shown in scan results. */
  name: string;
  /** Compiled regular expression for detection. */
  pattern: RegExp;
  /** Severity of exposure if this secret is leaked. */
  severity: SecretSeverity;
  /**
   * Short family label used in `ScanMatch.category` and redaction placeholders,
   * e.g. "aws", "stripe", "github". When omitted, derived from the `id` by
   * lowercasing the middle segment (e.g. "SEC-STRIPE-001" → "stripe").
   */
  family?: string;
  /**
   * When true, also require Shannon entropy > 4.0 on the matched token
   * before flagging. Reduces false-positives on placeholder/example strings.
   */
  entropyCheck?: boolean;
}

// ---------------------------------------------------------------------------
// AWS
// ---------------------------------------------------------------------------

const AWS_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-AWS-001',
    name: 'AWS Access Key ID',
    // AWS access keys are exactly AKIA + 16 uppercase alphanumeric chars.
    // No entropy check: the structural prefix AKIA is sufficient signal.
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    severity: 'critical',
  },
  {
    id: 'SEC-AWS-002',
    name: 'AWS Secret Access Key',
    pattern: /(?:aws[_\-. ]?secret[_\-. ]?(?:access[_\-. ]?)?key|aws[_\-. ]?(?:secret|priv))['":\s=]+([A-Za-z0-9\/+]{40})\b/i,
    severity: 'critical',
    entropyCheck: true,
  },
  {
    id: 'SEC-AWS-003',
    name: 'AWS Session Token',
    pattern: /(?:aws[_\-. ]?session[_\-. ]?token)['":\s=]+([A-Za-z0-9\/+=]{100,2048})/i,
    severity: 'critical',
    entropyCheck: true,
  },
  {
    id: 'SEC-AWS-004',
    name: 'AWS MWS Key',
    pattern: /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    severity: 'high',
  },
];

// ---------------------------------------------------------------------------
// GCP
// ---------------------------------------------------------------------------

const GCP_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-GCP-001',
    name: 'GCP Service Account Key',
    pattern: /"private_key":\s*"-----BEGIN (RSA )?PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    id: 'SEC-GCP-002',
    name: 'GCP API Key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-GCP-003',
    name: 'Google OAuth Client Secret',
    pattern: /GOCSPX-[0-9A-Za-z\-_]{28}/,
    severity: 'high',
  },
  {
    id: 'SEC-GCP-004',
    name: 'Firebase Server Key',
    pattern: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/,
    severity: 'high',
  },
  {
    id: 'SEC-GCP-005',
    name: 'Firebase Cloud Messaging Key',
    pattern: /(?:firebase|fcm)[_\-. ]?(?:api[_\-. ]?)?key['":\s=]+([A-Za-z0-9_\-]{38,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Azure
// ---------------------------------------------------------------------------

const AZURE_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-AZ-001',
    name: 'Azure Storage Account Key',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+\/=]{88}/,
    severity: 'critical',
  },
  {
    id: 'SEC-AZ-002',
    name: 'Azure Connection String',
    pattern: /(?:azure|az)[_\-. ]?(?:storage)?[_\-. ]?(?:connection[_\-. ]?string|conn[_\-. ]?str)['":\s=]+([^'";\s]{30,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-AZ-003',
    name: 'Azure Subscription Key',
    pattern: /(?:azure|ocp)\-apim\-subscription\-key['":\s]+([a-f0-9]{32})/i,
    severity: 'high',
  },
  {
    id: 'SEC-AZ-004',
    name: 'Azure SAS Token',
    pattern: /sig=[A-Za-z0-9%+\/=]{20,512}(&|$)/,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

const GITHUB_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-GH-001',
    name: 'GitHub Classic Personal Access Token',
    // ghp_ followed by 30-40 alphanumeric chars (real tokens are 36 chars after prefix)
    pattern: /ghp_[0-9A-Za-z]{30,40}/,
    severity: 'critical',
  },
  {
    id: 'SEC-GH-002',
    name: 'GitHub Fine-Grained PAT',
    // github_pat_ followed by 60+ alphanumeric/underscore chars
    pattern: /github_pat_[0-9A-Za-z_]{60,1024}/,
    severity: 'critical',
  },
  {
    id: 'SEC-GH-003',
    name: 'GitHub OAuth Token',
    pattern: /gho_[0-9A-Za-z]{30,40}/,
    severity: 'critical',
  },
  {
    id: 'SEC-GH-004',
    name: 'GitHub App Token',
    pattern: /(?:ghu|ghs)_[0-9A-Za-z]{30,40}/,
    severity: 'critical',
  },
  {
    id: 'SEC-GH-005',
    name: 'GitHub Refresh Token',
    pattern: /ghr_[0-9A-Za-z]{60,1024}/,
    severity: 'high',
  },
  {
    id: 'SEC-GH-006',
    name: 'GitHub Actions Secret',
    pattern: /(?:GITHUB[_\-. ]?TOKEN|GH[_\-. ]?TOKEN)['":\s=]+([A-Za-z0-9_\-]{36,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// GitLab
// ---------------------------------------------------------------------------

const GITLAB_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-GL-001',
    name: 'GitLab Personal Access Token',
    pattern: /glpat-[0-9A-Za-z\-_]{20}/,
    severity: 'critical',
  },
  {
    id: 'SEC-GL-002',
    name: 'GitLab Runner Registration Token',
    pattern: /GR1348941[0-9A-Za-z\-_]{20}/,
    severity: 'high',
  },
  {
    id: 'SEC-GL-003',
    name: 'GitLab Deploy Token',
    pattern: /gldt-[0-9A-Za-z\-_]{20}/,
    severity: 'high',
  },
];

// ---------------------------------------------------------------------------
// Bitbucket
// ---------------------------------------------------------------------------

const BITBUCKET_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-BB-001',
    name: 'Bitbucket App Password',
    pattern: /(?:bitbucket)[_\-. ]?(?:app[_\-. ]?)?(?:password|token|key)['":\s=]+([A-Za-z0-9+\/]{16,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

const SLACK_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-SLACK-001',
    name: 'Slack Bot Token',
    pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{23,25}/,
    severity: 'critical',
  },
  {
    id: 'SEC-SLACK-002',
    name: 'Slack User Token',
    pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{32}/,
    severity: 'critical',
  },
  {
    id: 'SEC-SLACK-003',
    name: 'Slack Workspace Token',
    pattern: /xoxa-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{32}/,
    severity: 'critical',
  },
  {
    id: 'SEC-SLACK-004',
    name: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,10}\/B[0-9A-Z]{8,10}\/[A-Za-z0-9]{24,512}/,
    severity: 'high',
  },
  {
    id: 'SEC-SLACK-005',
    name: 'Slack App Token',
    pattern: /xapp-[0-9]-[A-Z0-9]{10,12}-[0-9]+-[a-f0-9]{64}/,
    severity: 'high',
  },
];

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

const STRIPE_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-STRIPE-001',
    name: 'Stripe Live Secret Key',
    pattern: /sk_live_[0-9A-Za-z]{24,99}/,
    severity: 'critical',
  },
  {
    id: 'SEC-STRIPE-002',
    name: 'Stripe Test Secret Key',
    pattern: /sk_test_[0-9A-Za-z]{24,99}/,
    severity: 'high',
  },
  {
    id: 'SEC-STRIPE-003',
    name: 'Stripe Restricted Key',
    pattern: /rk_(?:live|test)_[0-9A-Za-z]{24,512}/,
    severity: 'high',
  },
  {
    id: 'SEC-STRIPE-004',
    name: 'Stripe Publishable Key',
    pattern: /pk_(?:live|test)_[0-9A-Za-z]{24,512}/,
    severity: 'medium',
  },
];

// ---------------------------------------------------------------------------
// AI Providers
// ---------------------------------------------------------------------------

const AI_PROVIDER_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-OPENAI-001',
    name: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/,
    severity: 'critical',
  },
  {
    id: 'SEC-OPENAI-002',
    name: 'OpenAI Project API Key',
    pattern: /sk-proj-[A-Za-z0-9\-_]{50,512}/,
    severity: 'critical',
  },
  {
    id: 'SEC-ANTHROPIC-001',
    name: 'Anthropic API Key',
    pattern: /sk-ant-(?:api03-)[A-Za-z0-9\-_]{93,1024}/,
    severity: 'critical',
  },
  {
    id: 'SEC-ANTHROPIC-002',
    name: 'Anthropic API Key (short form)',
    pattern: /sk-ant-[A-Za-z0-9\-_]{20,512}/,
    severity: 'critical',
  },
  {
    id: 'SEC-HUGGINGFACE-001',
    name: 'Hugging Face User Access Token',
    pattern: /hf_[A-Za-z0-9]{34,512}/,
    severity: 'high',
  },
  {
    id: 'SEC-COHERE-001',
    name: 'Cohere API Key',
    pattern: /(?:cohere)[_\-. ]?(?:api[_\-. ]?)?key['":\s=]+([A-Za-z0-9]{40,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Payment / Fintech
// ---------------------------------------------------------------------------

const PAYMENT_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-TWILIO-001',
    name: 'Twilio Account SID',
    pattern: /AC[0-9a-f]{32}\b/,
    severity: 'high',
  },
  {
    id: 'SEC-TWILIO-002',
    name: 'Twilio Auth Token',
    pattern: /(?:twilio)[_\-. ]?(?:auth[_\-. ]?)?token['":\s=]+([0-9a-f]{32})/i,
    severity: 'critical',
  },
  {
    id: 'SEC-SG-001',
    name: 'SendGrid API Key',
    // SG. + 20-30 alphanumeric chars + . + 40+ alphanumeric chars
    pattern: /SG\.[0-9A-Za-z\-_]{20,30}\.[0-9A-Za-z\-_]{40,512}/,
    severity: 'critical',
  },
  {
    id: 'SEC-MG-001',
    name: 'Mailgun API Key',
    pattern: /key-[0-9a-z]{32}/,
    severity: 'high',
  },
  {
    id: 'SEC-MG-002',
    name: 'Mailgun Webhook Signing Key',
    pattern: /(?:mailgun)[_\-. ]?(?:webhook[_\-. ]?)?(?:signing[_\-. ]?)?key['":\s=]+([A-Za-z0-9_\-]{32,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-BRAINTREE-001',
    name: 'Braintree Access Token',
    pattern: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/,
    severity: 'critical',
  },
  {
    id: 'SEC-SQUARE-001',
    name: 'Square Access Token',
    pattern: /sq0atp-[0-9A-Za-z\-_]{22}/,
    severity: 'critical',
  },
  {
    id: 'SEC-SQUARE-002',
    name: 'Square OAuth Secret',
    pattern: /sq0csp-[0-9A-Za-z\-_]{43}/,
    severity: 'critical',
  },
];

// ---------------------------------------------------------------------------
// Package Registries
// ---------------------------------------------------------------------------

const REGISTRY_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-NPM-001',
    name: 'npm Access Token',
    pattern: /npm_[A-Za-z0-9]{36}/,
    severity: 'high',
  },
  {
    id: 'SEC-NPM-002',
    name: 'npm Legacy Token',
    pattern: /\/\/registry\.npmjs\.org\/:_authToken=[A-Za-z0-9\-_]{36,512}/,
    severity: 'high',
  },
  {
    id: 'SEC-PYPI-001',
    name: 'PyPI Upload Token',
    pattern: /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,512}/,
    severity: 'high',
  },
];

// ---------------------------------------------------------------------------
// Cryptographic Keys & Certificates
// ---------------------------------------------------------------------------

const CRYPTO_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-KEY-001',
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    id: 'SEC-KEY-002',
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    id: 'SEC-KEY-003',
    name: 'OpenSSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    id: 'SEC-KEY-004',
    name: 'PGP Private Key Block',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    severity: 'critical',
  },
  {
    id: 'SEC-KEY-005',
    name: 'Generic PKCS8 Private Key',
    pattern: /-----BEGIN PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    id: 'SEC-JWT-001',
    name: 'JSON Web Token',
    pattern: /eyJ[A-Za-z0-9\-_=]{10,512}\.eyJ[A-Za-z0-9\-_=]{10,512}\.[A-Za-z0-9\-_=]{10,512}/,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Infrastructure / Cloud Platforms
// ---------------------------------------------------------------------------

const INFRA_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-HEROKU-001',
    name: 'Heroku API Key',
    pattern: /(?:heroku)[_\-. ]?(?:api[_\-. ]?)?key['":\s=]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    severity: 'high',
  },
  {
    id: 'SEC-DO-001',
    name: 'DigitalOcean Personal Access Token',
    pattern: /dop_v1_[a-f0-9]{64}/,
    severity: 'critical',
  },
  {
    id: 'SEC-DO-002',
    name: 'DigitalOcean OAuth Token',
    pattern: /doo_v1_[a-f0-9]{64}/,
    severity: 'critical',
  },
  {
    id: 'SEC-DO-003',
    name: 'DigitalOcean Spaces Key',
    pattern: /(?:digitalocean|do)[_\-. ]?spaces[_\-. ]?(?:secret|key)['":\s=]+([A-Za-z0-9+\/=]{40,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-SUPABASE-001',
    name: 'Supabase Service Role Key',
    pattern: /eyJ[A-Za-z0-9\-_=]{1,2048}\.eyJ[A-Za-z0-9\-_=]{1,4096}\.[A-Za-z0-9\-_.+\/=]{1,4096}(?=.{0,4096}supabase)/i,
    severity: 'critical',
  },
  {
    id: 'SEC-SUPABASE-002',
    name: 'Supabase Connection String',
    pattern: /postgresql:\/\/postgres:[A-Za-z0-9!@#$%^&*()_+\-=]{8,512}@[a-z0-9.]+\.supabase\.co/i,
    severity: 'critical',
  },
  {
    id: 'SEC-FIREBASE-001',
    name: 'Firebase Admin SDK Credential',
    pattern: /"type":\s*"service_account"[^}]{0,4096}"project_id"/s,
    severity: 'critical',
  },
  {
    id: 'SEC-NETLIFY-001',
    name: 'Netlify Access Token',
    pattern: /(?:netlify)[_\-. ]?(?:access[_\-. ]?)?token['":\s=]+([A-Za-z0-9_\-]{40,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-VERCEL-001',
    name: 'Vercel Token',
    pattern: /(?:vercel)[_\-. ]?token['":\s=]+([A-Za-z0-9_\-]{24,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-RAILWAY-001',
    name: 'Railway Token',
    pattern: /(?:railway)[_\-. ]?token['":\s=]+([A-Za-z0-9_\-]{24,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Databases
// ---------------------------------------------------------------------------

const DATABASE_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-DB-001',
    name: 'Generic Database Connection String (with credentials)',
    pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:@\s]{1,256}:[^@\s]{8,256}@[^\s'"]{1,512}/i,
    severity: 'critical',
    entropyCheck: true,
  },
  {
    id: 'SEC-DB-002',
    name: 'MongoDB Atlas Connection String',
    pattern: /mongodb\+srv:\/\/[A-Za-z0-9]+:[A-Za-z0-9!@#$%^&*()_+\-=]{8,512}@cluster/i,
    severity: 'critical',
  },
];

// ---------------------------------------------------------------------------
// Developer Tools & CI/CD
// ---------------------------------------------------------------------------

const DEVTOOLS_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-SENTRY-001',
    name: 'Sentry Auth Token',
    pattern: /(?:sentry)[_\-. ]?(?:auth[_\-. ]?)?token['":\s=]+([A-Za-z0-9_\-]{64})/i,
    severity: 'high',
  },
  {
    id: 'SEC-DD-001',
    name: 'Datadog API Key',
    pattern: /(?:datadog|dd)[_\-. ]?(?:api[_\-. ]?)?key['":\s=]+([a-f0-9]{32})/i,
    severity: 'high',
  },
  {
    id: 'SEC-NEWRELIC-001',
    name: 'New Relic License Key',
    pattern: /(?:new.?relic)[_\-. ]?(?:license[_\-. ]?)?key['":\s=]+([A-Za-z0-9]{40})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-JIRA-001',
    name: 'Atlassian / Jira API Token',
    pattern: /(?:atlassian|jira)[_\-. ]?(?:api[_\-. ]?)?token['":\s=]+([A-Za-z0-9+\/=]{24,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-VAULT-001',
    name: 'HashiCorp Vault Token',
    pattern: /hvs\.[A-Za-z0-9_\-]{24,512}/,
    severity: 'critical',
  },
  {
    id: 'SEC-VAULT-002',
    name: 'HashiCorp Vault Token (legacy)',
    pattern: /s\.[A-Za-z0-9]{24,512}\b/,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-CIRCLECI-001',
    name: 'CircleCI Personal API Token',
    pattern: /(?:circleci)[_\-. ]?(?:api[_\-. ]?)?token['":\s=]+([A-Za-z0-9_]{40})/i,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Social / Messaging
// ---------------------------------------------------------------------------

const SOCIAL_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-DISCORD-001',
    name: 'Discord Bot Token',
    pattern: /[MN][A-Za-z0-9]{23,25}\.[A-Za-z0-9\-_]{6,7}\.[A-Za-z0-9\-_]{27,40}/,
    severity: 'high',
  },
  {
    id: 'SEC-DISCORD-002',
    name: 'Discord Webhook',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{17,20}\/[A-Za-z0-9\-_]{60,1024}/,
    severity: 'high',
  },
  {
    id: 'SEC-TELEGRAM-001',
    name: 'Telegram Bot API Token',
    pattern: /[0-9]{8,10}:AA[A-Za-z0-9\-_]{33}/,
    severity: 'high',
  },
  {
    id: 'SEC-TWITTER-001',
    name: 'Twitter / X Bearer Token',
    pattern: /AAAAAAAAAAAAAAAA[A-Za-z0-9%]{40,512}/,
    severity: 'high',
  },
];

// ---------------------------------------------------------------------------
// Search & CMS
// ---------------------------------------------------------------------------

const SEARCH_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-ALGOLIA-001',
    name: 'Algolia API Key',
    pattern: /(?:algolia)[_\-. ]?(?:api[_\-. ]?)?key['":\s=]+([a-f0-9]{32})/i,
    severity: 'high',
  },
  {
    id: 'SEC-CONTENTFUL-001',
    name: 'Contentful Delivery API Token',
    pattern: /(?:contentful)[_\-. ]?(?:access|delivery|preview)[_\-. ]?token['":\s=]+([A-Za-z0-9_\-]{43,512})/i,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-SHOPIFY-001',
    name: 'Shopify Private App Password',
    pattern: /shppa_[A-Za-z0-9]{32}/,
    severity: 'high',
  },
  {
    id: 'SEC-SHOPIFY-002',
    name: 'Shopify Shared Secret',
    pattern: /shpss_[A-Za-z0-9]{32}/,
    severity: 'high',
  },
  {
    id: 'SEC-SHOPIFY-003',
    name: 'Shopify Access Token',
    pattern: /shpat_[A-Za-z0-9]{32}/,
    severity: 'critical',
  },
];

// ---------------------------------------------------------------------------
// Docker / Container Registries
// ---------------------------------------------------------------------------

const CONTAINER_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-DOCKER-001',
    name: 'Docker Hub Password (Basic Auth)',
    pattern: /(?:docker)[_\-. ]?(?:password|token|secret)['":\s=]+([^\s'"]{12,512})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-GHCR-001',
    name: 'GitHub Container Registry Auth',
    pattern: /ghcr\.io[^\s:]{0,256}:[^\s]{20,512}/,
    severity: 'high',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// High-entropy generic patterns (entropy check required)
// ---------------------------------------------------------------------------

const GENERIC_ENTROPY_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-GEN-001',
    name: 'Generic Password Assignment',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([A-Za-z0-9!@#$%^&*()_+\-=]{16,512})['"]?/i,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-GEN-002',
    name: 'Generic Token Assignment',
    pattern: /(?:token|api.?key|api.?token|access.?token|auth.?token)\s*[:=]\s*['"]?([A-Za-z0-9+\/\-_]{24,512})['"]?/i,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-GEN-003',
    name: 'Generic Secret Assignment',
    pattern: /(?:secret|client.?secret|app.?secret)\s*[:=]\s*['"]?([A-Za-z0-9+\/\-_]{24,512})['"]?/i,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-GEN-004',
    name: 'High-Entropy Base64 (near secret keyword)',
    pattern: /(?:key|secret|token|password)['":\s=]+([A-Za-z0-9+\/]{32,512}={0,2})/i,
    severity: 'low',
    entropyCheck: true,
  },
  {
    id: 'SEC-GEN-005',
    name: 'High-Entropy Hex String (near secret keyword)',
    pattern: /(?:key|secret|token|password)['":\s=]+([a-f0-9]{40,512})\b/i,
    severity: 'low',
    entropyCheck: true,
  },
  {
    id: 'SEC-GEN-006',
    name: 'Authorization Bearer Token in Header',
    pattern: /Authorization:\s*Bearer\s+([A-Za-z0-9\-_=.]{20,512})/i,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-GEN-007',
    name: 'Authorization Basic Header',
    pattern: /Authorization:\s*Basic\s+([A-Za-z0-9+\/=]{12,512})/i,
    severity: 'medium',
    entropyCheck: true,
  },
];

// ---------------------------------------------------------------------------
// Additional Providers (Miscellaneous)
// ---------------------------------------------------------------------------

const MISC_PATTERNS: SecretPattern[] = [
  {
    id: 'SEC-PLANETSCALE-001',
    name: 'PlanetScale Service Token',
    pattern: /pscale_tkn_[A-Za-z0-9]{32}/,
    severity: 'high',
  },
  {
    id: 'SEC-PLANETSCALE-002',
    name: 'PlanetScale OAuth Token',
    pattern: /pscale_oauth_[A-Za-z0-9]{32}/,
    severity: 'high',
  },
  {
    id: 'SEC-LINEAR-001',
    name: 'Linear API Key',
    pattern: /lin_api_[A-Za-z0-9]{40}/,
    severity: 'high',
  },
  {
    id: 'SEC-AIRTABLE-001',
    name: 'Airtable API Key (legacy)',
    pattern: /key[A-Za-z0-9]{14}\b/,
    severity: 'medium',
    entropyCheck: true,
  },
  {
    id: 'SEC-AIRTABLE-002',
    name: 'Airtable Personal Access Token',
    pattern: /pat[A-Za-z0-9]{14}\.[A-Za-z0-9]{64}/,
    severity: 'high',
  },
  {
    id: 'SEC-MAPBOX-001',
    name: 'Mapbox Access Token',
    pattern: /pk\.eyJ1[A-Za-z0-9\-_=.]+/,
    severity: 'medium',
  },
  {
    id: 'SEC-MAPBOX-002',
    name: 'Mapbox Secret Token',
    pattern: /sk\.eyJ1[A-Za-z0-9\-_=.]+/,
    severity: 'high',
  },
  {
    id: 'SEC-DOPPLER-001',
    name: 'Doppler Service Token',
    pattern: /dp\.st\.[A-Za-z0-9_\-]{43}/,
    severity: 'high',
  },
  {
    id: 'SEC-DOPPLER-002',
    name: 'Doppler Personal Token',
    pattern: /dp\.pt\.[A-Za-z0-9_\-]{43}/,
    severity: 'critical',
  },
  {
    id: 'SEC-LAUNCHDARKLY-001',
    name: 'LaunchDarkly SDK Key',
    pattern: /sdk-[A-Za-z0-9\-_]{40}/,
    severity: 'high',
  },
  {
    id: 'SEC-POSTMAN-001',
    name: 'Postman API Key',
    pattern: /PMAK-[0-9a-f]{24}-[0-9a-f]{34}/,
    severity: 'high',
  },
  {
    id: 'SEC-OKTA-001',
    name: 'Okta API Token',
    pattern: /00[A-Za-z0-9\-_]{40}/,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-ZENDESK-001',
    name: 'Zendesk Secret Key',
    pattern: /(?:zendesk)[_\-. ]?(?:secret|token|key)['":\s=]+([A-Za-z0-9]{40})/i,
    severity: 'high',
    entropyCheck: true,
  },
  {
    id: 'SEC-TYPEFORM-001',
    name: 'Typeform Personal Access Token',
    pattern: /tfp_[A-Za-z0-9_\-]{40,512}/,
    severity: 'high',
  },
  {
    id: 'SEC-GRAFANA-001',
    name: 'Grafana API Key',
    pattern: /eyJrIjoi[A-Za-z0-9\-_=]{40,512}/,
    severity: 'high',
  },
  {
    id: 'SEC-PULUMI-001',
    name: 'Pulumi Access Token',
    pattern: /pul-[A-Za-z0-9]{40}/,
    severity: 'high',
  },
  {
    id: 'SEC-CODECOV-001',
    name: 'Codecov Upload Token',
    pattern: /(?:codecov)[_\-. ]?token['":\s=]+([a-f0-9]{32})/i,
    severity: 'medium',
  },
  {
    id: 'SEC-SNYK-001',
    name: 'Snyk API Token',
    pattern: /(?:snyk)[_\-. ]?(?:api[_\-. ]?)?token['":\s=]+([a-f0-9-]{36})/i,
    severity: 'high',
  },
];

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------

/**
 * All built-in secret detection patterns.
 * Total: ≥100 patterns covering major cloud/SaaS providers.
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  ...AWS_PATTERNS,
  ...GCP_PATTERNS,
  ...AZURE_PATTERNS,
  ...GITHUB_PATTERNS,
  ...GITLAB_PATTERNS,
  ...BITBUCKET_PATTERNS,
  ...SLACK_PATTERNS,
  ...STRIPE_PATTERNS,
  ...AI_PROVIDER_PATTERNS,
  ...PAYMENT_PATTERNS,
  ...REGISTRY_PATTERNS,
  ...CRYPTO_PATTERNS,
  ...INFRA_PATTERNS,
  ...DATABASE_PATTERNS,
  ...DEVTOOLS_PATTERNS,
  ...SOCIAL_PATTERNS,
  ...SEARCH_PATTERNS,
  ...CONTAINER_PATTERNS,
  ...GENERIC_ENTROPY_PATTERNS,
  ...MISC_PATTERNS,
];
