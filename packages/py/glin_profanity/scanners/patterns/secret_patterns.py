"""
Secret detection patterns for the SecretsScanner.

Pattern attribution:
  - ProtectAI/llm-guard (MIT) — https://github.com/protectai/llm-guard
  - Yelp/detect-secrets (Apache-2.0) — https://github.com/Yelp/detect-secrets

Patterns have been reimplemented in Python — no source was copied verbatim.

Mirrors packages/js/src/scanners/patterns/secret-patterns.ts.

@module scanners/patterns/secret_patterns
"""

import re
from dataclasses import dataclass
from typing import Literal, Optional

SecretSeverity = Literal["low", "medium", "high", "critical"]


@dataclass
class SecretPattern:
    """A single secret detection rule."""

    id: str
    """Unique identifier, e.g. 'SEC-AWS-001'."""

    name: str
    """Human-readable name shown in scan results."""

    pattern: re.Pattern[str]
    """Compiled regular expression for detection."""

    severity: SecretSeverity
    """Severity of exposure if this secret is leaked."""

    family: Optional[str] = None
    """
    Short family label used in ScanMatch.category and redaction placeholders,
    e.g. 'aws', 'stripe', 'github'. When omitted, derived from the id by
    lowercasing the middle segment (e.g. 'SEC-STRIPE-001' -> 'stripe').
    """

    entropy_check: bool = False
    """
    When True, also require Shannon entropy > 4.0 on the matched token
    before flagging. Reduces false-positives on placeholder/example strings.
    """


# ---------------------------------------------------------------------------
# AWS
# ---------------------------------------------------------------------------

_AWS_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-AWS-001",
        name="AWS Access Key ID",
        # AWS access keys are exactly AKIA + 16 uppercase alphanumeric chars.
        # No entropy check: the structural prefix AKIA is sufficient signal.
        pattern=re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-AWS-002",
        name="AWS Secret Access Key",
        pattern=re.compile(
            r"(?:aws[_\-. ]?secret[_\-. ]?(?:access[_\-. ]?)?key"
            r"|aws[_\-. ]?(?:secret|priv))['\"\s:=]+([A-Za-z0-9\/+]{40})\b",
            re.IGNORECASE,
        ),
        severity="critical",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-AWS-003",
        name="AWS Session Token",
        pattern=re.compile(
            r"(?:aws[_\-. ]?session[_\-. ]?token)['\"\s:=]+([A-Za-z0-9\/+=]{100,2048})",
            re.IGNORECASE,
        ),
        severity="critical",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-AWS-004",
        name="AWS MWS Key",
        pattern=re.compile(
            r"amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            re.IGNORECASE,
        ),
        severity="high",
    ),
]

# ---------------------------------------------------------------------------
# GCP
# ---------------------------------------------------------------------------

_GCP_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-GCP-001",
        name="GCP Service Account Key",
        pattern=re.compile(r'"private_key":\s*"-----BEGIN (RSA )?PRIVATE KEY-----'),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-GCP-002",
        name="GCP API Key",
        pattern=re.compile(r"AIza[0-9A-Za-z\-_]{35}"),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GCP-003",
        name="Google OAuth Client Secret",
        pattern=re.compile(r"GOCSPX-[0-9A-Za-z\-_]{28}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-GCP-004",
        name="Firebase Server Key",
        pattern=re.compile(r"AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-GCP-005",
        name="Firebase Cloud Messaging Key",
        pattern=re.compile(
            r"(?:firebase|fcm)[_\-. ]?(?:api[_\-. ]?)?key"
            r"['\"\s:=]+([A-Za-z0-9_\-]{38,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Azure
# ---------------------------------------------------------------------------

_AZURE_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-AZ-001",
        name="Azure Storage Account Key",
        pattern=re.compile(
            r"DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+\/=]{88}"
        ),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-AZ-002",
        name="Azure Connection String",
        pattern=re.compile(
            r"(?:azure|az)[_\-. ]?(?:storage)?[_\-. ]?"
            r"(?:connection[_\-. ]?string|conn[_\-. ]?str)"
            r"['\"\s:=]+([^'\";\s]{30,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-AZ-003",
        name="Azure Subscription Key",
        pattern=re.compile(
            r"(?:azure|ocp)\-apim\-subscription\-key['\"\s:]+([a-f0-9]{32})",
            re.IGNORECASE,
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-AZ-004",
        name="Azure SAS Token",
        pattern=re.compile(r"sig=[A-Za-z0-9%+\/=]{20,512}(&|$)"),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# GitHub
# ---------------------------------------------------------------------------

_GITHUB_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-GH-001",
        name="GitHub Classic Personal Access Token",
        # ghp_ followed by 30-40 alphanumeric chars (36 chars after prefix)
        pattern=re.compile(r"ghp_[0-9A-Za-z]{30,40}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-GH-002",
        name="GitHub Fine-Grained PAT",
        # github_pat_ followed by 60+ alphanumeric/underscore chars
        pattern=re.compile(r"github_pat_[0-9A-Za-z_]{60,1024}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-GH-003",
        name="GitHub OAuth Token",
        pattern=re.compile(r"gho_[0-9A-Za-z]{30,40}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-GH-004",
        name="GitHub App Token",
        pattern=re.compile(r"(?:ghu|ghs)_[0-9A-Za-z]{30,40}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-GH-005",
        name="GitHub Refresh Token",
        pattern=re.compile(r"ghr_[0-9A-Za-z]{60,1024}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-GH-006",
        name="GitHub Actions Secret",
        pattern=re.compile(
            r"(?:GITHUB[_\-. ]?TOKEN|GH[_\-. ]?TOKEN)['\"\s:=]+([A-Za-z0-9_\-]{36,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# GitLab
# ---------------------------------------------------------------------------

_GITLAB_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-GL-001",
        name="GitLab Personal Access Token",
        pattern=re.compile(r"glpat-[0-9A-Za-z\-_]{20}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-GL-002",
        name="GitLab Runner Registration Token",
        pattern=re.compile(r"GR1348941[0-9A-Za-z\-_]{20}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-GL-003",
        name="GitLab Deploy Token",
        pattern=re.compile(r"gldt-[0-9A-Za-z\-_]{20}"),
        severity="high",
    ),
]

# ---------------------------------------------------------------------------
# Bitbucket
# ---------------------------------------------------------------------------

_BITBUCKET_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-BB-001",
        name="Bitbucket App Password",
        pattern=re.compile(
            r"(?:bitbucket)[_\-. ]?(?:app[_\-. ]?)?(?:password|token|key)"
            r"['\"\s:=]+([A-Za-z0-9+\/]{16,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Slack
# ---------------------------------------------------------------------------

_SLACK_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-SLACK-001",
        name="Slack Bot Token",
        pattern=re.compile(r"xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{23,25}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SLACK-002",
        name="Slack User Token",
        pattern=re.compile(r"xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{32}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SLACK-003",
        name="Slack Workspace Token",
        pattern=re.compile(r"xoxa-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{32}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SLACK-004",
        name="Slack Webhook URL",
        pattern=re.compile(
            r"https://hooks\.slack\.com/services/T[0-9A-Z]{8,10}/B[0-9A-Z]{8,10}/[A-Za-z0-9]{24,512}"
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-SLACK-005",
        name="Slack App Token",
        pattern=re.compile(r"xapp-[0-9]-[A-Z0-9]{10,12}-[0-9]+-[a-f0-9]{64}"),
        severity="high",
    ),
]

# ---------------------------------------------------------------------------
# Stripe
# ---------------------------------------------------------------------------

_STRIPE_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-STRIPE-001",
        name="Stripe Live Secret Key",
        pattern=re.compile(r"sk_live_[0-9A-Za-z]{24,99}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-STRIPE-002",
        name="Stripe Test Secret Key",
        pattern=re.compile(r"sk_test_[0-9A-Za-z]{24,99}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-STRIPE-003",
        name="Stripe Restricted Key",
        pattern=re.compile(r"rk_(?:live|test)_[0-9A-Za-z]{24,512}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-STRIPE-004",
        name="Stripe Publishable Key",
        pattern=re.compile(r"pk_(?:live|test)_[0-9A-Za-z]{24,512}"),
        severity="medium",
    ),
]

# ---------------------------------------------------------------------------
# AI Providers
# ---------------------------------------------------------------------------

_AI_PROVIDER_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-OPENAI-001",
        name="OpenAI API Key",
        pattern=re.compile(r"sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-OPENAI-002",
        name="OpenAI Project API Key",
        pattern=re.compile(r"sk-proj-[A-Za-z0-9\-_]{50,512}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-ANTHROPIC-001",
        name="Anthropic API Key",
        pattern=re.compile(r"sk-ant-(?:api03-)[A-Za-z0-9\-_]{93,1024}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-ANTHROPIC-002",
        name="Anthropic API Key (short form)",
        pattern=re.compile(r"sk-ant-[A-Za-z0-9\-_]{20,512}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-HUGGINGFACE-001",
        name="Hugging Face User Access Token",
        pattern=re.compile(r"hf_[A-Za-z0-9]{34,512}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-COHERE-001",
        name="Cohere API Key",
        pattern=re.compile(
            r"(?:cohere)[_\-. ]?(?:api[_\-. ]?)?key['\"\s:=]+([A-Za-z0-9]{40,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Payment / Fintech
# ---------------------------------------------------------------------------

_PAYMENT_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-TWILIO-001",
        name="Twilio Account SID",
        pattern=re.compile(r"AC[0-9a-f]{32}\b"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-TWILIO-002",
        name="Twilio Auth Token",
        pattern=re.compile(
            r"(?:twilio)[_\-. ]?(?:auth[_\-. ]?)?token['\"\s:=]+([0-9a-f]{32})",
            re.IGNORECASE,
        ),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SG-001",
        name="SendGrid API Key",
        # SG. + 20-30 alphanumeric chars + . + 40+ alphanumeric chars
        pattern=re.compile(r"SG\.[0-9A-Za-z\-_]{20,30}\.[0-9A-Za-z\-_]{40,512}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-MG-001",
        name="Mailgun API Key",
        pattern=re.compile(r"key-[0-9a-z]{32}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-MG-002",
        name="Mailgun Webhook Signing Key",
        pattern=re.compile(
            r"(?:mailgun)[_\-. ]?(?:webhook[_\-. ]?)?(?:signing[_\-. ]?)?key"
            r"['\"\s:=]+([A-Za-z0-9_\-]{32,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-BRAINTREE-001",
        name="Braintree Access Token",
        pattern=re.compile(r"access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SQUARE-001",
        name="Square Access Token",
        pattern=re.compile(r"sq0atp-[0-9A-Za-z\-_]{22}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SQUARE-002",
        name="Square OAuth Secret",
        pattern=re.compile(r"sq0csp-[0-9A-Za-z\-_]{43}"),
        severity="critical",
    ),
]

# ---------------------------------------------------------------------------
# Package Registries
# ---------------------------------------------------------------------------

_REGISTRY_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-NPM-001",
        name="npm Access Token",
        pattern=re.compile(r"npm_[A-Za-z0-9]{36}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-NPM-002",
        name="npm Legacy Token",
        pattern=re.compile(r"//registry\.npmjs\.org/:_authToken=[A-Za-z0-9\-_]{36,512}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-PYPI-001",
        name="PyPI Upload Token",
        pattern=re.compile(r"pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,512}"),
        severity="high",
    ),
]

# ---------------------------------------------------------------------------
# Cryptographic Keys & Certificates
# ---------------------------------------------------------------------------

_CRYPTO_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-KEY-001",
        name="RSA Private Key",
        pattern=re.compile(r"-----BEGIN RSA PRIVATE KEY-----"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-KEY-002",
        name="EC Private Key",
        pattern=re.compile(r"-----BEGIN EC PRIVATE KEY-----"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-KEY-003",
        name="OpenSSH Private Key",
        pattern=re.compile(r"-----BEGIN OPENSSH PRIVATE KEY-----"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-KEY-004",
        name="PGP Private Key Block",
        pattern=re.compile(r"-----BEGIN PGP PRIVATE KEY BLOCK-----"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-KEY-005",
        name="Generic PKCS8 Private Key",
        pattern=re.compile(r"-----BEGIN PRIVATE KEY-----"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-JWT-001",
        name="JSON Web Token",
        pattern=re.compile(r"eyJ[A-Za-z0-9\-_=]{10,512}\.eyJ[A-Za-z0-9\-_=]{10,512}\.[A-Za-z0-9\-_=]{10,512}"),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Infrastructure / Cloud Platforms
# ---------------------------------------------------------------------------

_INFRA_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-HEROKU-001",
        name="Heroku API Key",
        pattern=re.compile(
            r"(?:heroku)[_\-. ]?(?:api[_\-. ]?)?key['\"\s:=]+"
            r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
            re.IGNORECASE,
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-DO-001",
        name="DigitalOcean Personal Access Token",
        pattern=re.compile(r"dop_v1_[a-f0-9]{64}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-DO-002",
        name="DigitalOcean OAuth Token",
        pattern=re.compile(r"doo_v1_[a-f0-9]{64}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-DO-003",
        name="DigitalOcean Spaces Key",
        pattern=re.compile(
            r"(?:digitalocean|do)[_\-. ]?spaces[_\-. ]?(?:secret|key)"
            r"['\"\s:=]+([A-Za-z0-9+\/=]{40,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-SUPABASE-001",
        name="Supabase Service Role Key",
        pattern=re.compile(
            r"eyJ[A-Za-z0-9\-_=]{1,2048}\.eyJ[A-Za-z0-9\-_=]{1,4096}"
            r"\.[A-Za-z0-9\-_.+\/=]{1,4096}(?=.{0,4096}supabase)",
            re.IGNORECASE,
        ),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-SUPABASE-002",
        name="Supabase Connection String",
        pattern=re.compile(
            r"postgresql://postgres:[A-Za-z0-9!@#$%^&*()_+\-=]{8,512}@[a-z0-9.]+\.supabase\.co",  # NOSONAR detection pattern, not a credential
            re.IGNORECASE,
        ),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-FIREBASE-001",
        name="Firebase Admin SDK Credential",
        pattern=re.compile(
            r'"type":\s*"service_account"[^}]{0,4096}"project_id"', re.DOTALL
        ),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-NETLIFY-001",
        name="Netlify Access Token",
        pattern=re.compile(
            r"(?:netlify)[_\-. ]?(?:access[_\-. ]?)?token"
            r"['\"\s:=]+([A-Za-z0-9_\-]{40,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-VERCEL-001",
        name="Vercel Token",
        pattern=re.compile(
            r"(?:vercel)[_\-. ]?token['\"\s:=]+([A-Za-z0-9_\-]{24,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-RAILWAY-001",
        name="Railway Token",
        pattern=re.compile(
            r"(?:railway)[_\-. ]?token['\"\s:=]+([A-Za-z0-9_\-]{24,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Databases
# ---------------------------------------------------------------------------

_DATABASE_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-DB-001",
        name="Generic Database Connection String (with credentials)",
        pattern=re.compile(
            r"(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://"
            r"[^:@\s]{1,256}:[^@\s]{8,256}@[^\s'\"]{1,512}",
            re.IGNORECASE,
        ),
        severity="critical",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-DB-002",
        name="MongoDB Atlas Connection String",
        pattern=re.compile(
            r"mongodb\+srv://[A-Za-z0-9]+:[A-Za-z0-9!@#$%^&*()_+\-=]{8,512}@cluster",
            re.IGNORECASE,
        ),
        severity="critical",
    ),
]

# ---------------------------------------------------------------------------
# Developer Tools & CI/CD
# ---------------------------------------------------------------------------

_DEVTOOLS_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-SENTRY-001",
        name="Sentry Auth Token",
        pattern=re.compile(
            r"(?:sentry)[_\-. ]?(?:auth[_\-. ]?)?token['\"\s:=]+([A-Za-z0-9_\-]{64})",
            re.IGNORECASE,
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-DD-001",
        name="Datadog API Key",
        pattern=re.compile(
            r"(?:datadog|dd)[_\-. ]?(?:api[_\-. ]?)?key['\"\s:=]+([a-f0-9]{32})",
            re.IGNORECASE,
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-NEWRELIC-001",
        name="New Relic License Key",
        pattern=re.compile(
            r"(?:new.?relic)[_\-. ]?(?:license[_\-. ]?)?key['\"\s:=]+([A-Za-z0-9]{40})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-JIRA-001",
        name="Atlassian / Jira API Token",
        pattern=re.compile(
            r"(?:atlassian|jira)[_\-. ]?(?:api[_\-. ]?)?token"
            r"['\"\s:=]+([A-Za-z0-9+\/=]{24,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-VAULT-001",
        name="HashiCorp Vault Token",
        pattern=re.compile(r"hvs\.[A-Za-z0-9_\-]{24,512}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-VAULT-002",
        name="HashiCorp Vault Token (legacy)",
        pattern=re.compile(r"s\.[A-Za-z0-9]{24,512}\b"),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-CIRCLECI-001",
        name="CircleCI Personal API Token",
        pattern=re.compile(
            r"(?:circleci)[_\-. ]?(?:api[_\-. ]?)?token['\"\s:=]+([A-Za-z0-9_]{40})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Social / Messaging
# ---------------------------------------------------------------------------

_SOCIAL_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-DISCORD-001",
        name="Discord Bot Token",
        pattern=re.compile(r"[MN][A-Za-z0-9]{23,25}\.[A-Za-z0-9\-_]{6,7}\.[A-Za-z0-9\-_]{27,40}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-DISCORD-002",
        name="Discord Webhook",
        pattern=re.compile(
            r"https://discord(?:app)?\.com/api/webhooks/[0-9]{17,20}/[A-Za-z0-9\-_]{60,1024}"
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-TELEGRAM-001",
        name="Telegram Bot API Token",
        pattern=re.compile(r"[0-9]{8,10}:AA[A-Za-z0-9\-_]{33}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-TWITTER-001",
        name="Twitter / X Bearer Token",
        pattern=re.compile(r"AAAAAAAAAAAAAAAA[A-Za-z0-9%]{40,512}"),
        severity="high",
    ),
]

# ---------------------------------------------------------------------------
# Search & CMS
# ---------------------------------------------------------------------------

_SEARCH_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-ALGOLIA-001",
        name="Algolia API Key",
        pattern=re.compile(
            r"(?:algolia)[_\-. ]?(?:api[_\-. ]?)?key['\"\s:=]+([a-f0-9]{32})",
            re.IGNORECASE,
        ),
        severity="high",
    ),
    SecretPattern(
        id="SEC-CONTENTFUL-001",
        name="Contentful Delivery API Token",
        pattern=re.compile(
            r"(?:contentful)[_\-. ]?(?:access|delivery|preview)[_\-. ]?token"
            r"['\"\s:=]+([A-Za-z0-9_\-]{43,512})",
            re.IGNORECASE,
        ),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-SHOPIFY-001",
        name="Shopify Private App Password",
        pattern=re.compile(r"shppa_[A-Za-z0-9]{32}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-SHOPIFY-002",
        name="Shopify Shared Secret",
        pattern=re.compile(r"shpss_[A-Za-z0-9]{32}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-SHOPIFY-003",
        name="Shopify Access Token",
        pattern=re.compile(r"shpat_[A-Za-z0-9]{32}"),
        severity="critical",
    ),
]

# ---------------------------------------------------------------------------
# Docker / Container Registries
# ---------------------------------------------------------------------------

_CONTAINER_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-DOCKER-001",
        name="Docker Hub Password (Basic Auth)",
        pattern=re.compile(
            r"(?:docker)[_\-. ]?(?:password|token|secret)['\"\s:=]+([^\s'\"]{12,512})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GHCR-001",
        name="GitHub Container Registry Auth",
        pattern=re.compile(r"ghcr\.io[^\s:]{0,256}:[^\s]{20,512}"),
        severity="high",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# High-entropy generic patterns (entropy check required)
# ---------------------------------------------------------------------------

_GENERIC_ENTROPY_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-GEN-001",
        name="Generic Password Assignment",
        pattern=re.compile(
            r"(?:password|passwd|pwd)\s*[:=]\s*['\"]?([A-Za-z0-9!@#$%^&*()_+\-=]{16,512})['\"]?",
            re.IGNORECASE,
        ),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GEN-002",
        name="Generic Token Assignment",
        pattern=re.compile(
            r"(?:token|api.?key|api.?token|access.?token|auth.?token)\s*[:=]\s*['\"]?([A-Za-z0-9+\/\-_]{24,512})['\"]?",
            re.IGNORECASE,
        ),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GEN-003",
        name="Generic Secret Assignment",
        pattern=re.compile(
            r"(?:secret|client.?secret|app.?secret)\s*[:=]\s*['\"]?([A-Za-z0-9+\/\-_]{24,512})['\"]?",
            re.IGNORECASE,
        ),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GEN-004",
        name="High-Entropy Base64 (near secret keyword)",
        pattern=re.compile(
            r"(?:key|secret|token|password)['\"\s:=]+([A-Za-z0-9+\/]{32,512}={0,2})",
            re.IGNORECASE,
        ),
        severity="low",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GEN-005",
        name="High-Entropy Hex String (near secret keyword)",
        pattern=re.compile(
            r"(?:key|secret|token|password)['\"\s:=]+([a-f0-9]{40,512})\b",
            re.IGNORECASE,
        ),
        severity="low",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GEN-006",
        name="Authorization Bearer Token in Header",
        pattern=re.compile(
            r"Authorization:\s*Bearer\s+([A-Za-z0-9\-_=.]{20,512})",
            re.IGNORECASE,
        ),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-GEN-007",
        name="Authorization Basic Header",
        pattern=re.compile(
            r"Authorization:\s*Basic\s+([A-Za-z0-9+\/=]{12,512})",
            re.IGNORECASE,
        ),
        severity="medium",
        entropy_check=True,
    ),
]

# ---------------------------------------------------------------------------
# Additional Providers (Miscellaneous)
# ---------------------------------------------------------------------------

_MISC_PATTERNS: list[SecretPattern] = [
    SecretPattern(
        id="SEC-PLANETSCALE-001",
        name="PlanetScale Service Token",
        pattern=re.compile(r"pscale_tkn_[A-Za-z0-9]{32}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-PLANETSCALE-002",
        name="PlanetScale OAuth Token",
        pattern=re.compile(r"pscale_oauth_[A-Za-z0-9]{32}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-LINEAR-001",
        name="Linear API Key",
        pattern=re.compile(r"lin_api_[A-Za-z0-9]{40}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-AIRTABLE-001",
        name="Airtable API Key (legacy)",
        pattern=re.compile(r"key[A-Za-z0-9]{14}\b"),
        severity="medium",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-AIRTABLE-002",
        name="Airtable Personal Access Token",
        pattern=re.compile(r"pat[A-Za-z0-9]{14}\.[A-Za-z0-9]{64}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-MAPBOX-001",
        name="Mapbox Access Token",
        pattern=re.compile(r"pk\.eyJ1[A-Za-z0-9\-_=.]+"),
        severity="medium",
    ),
    SecretPattern(
        id="SEC-MAPBOX-002",
        name="Mapbox Secret Token",
        pattern=re.compile(r"sk\.eyJ1[A-Za-z0-9\-_=.]+"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-DOPPLER-001",
        name="Doppler Service Token",
        pattern=re.compile(r"dp\.st\.[A-Za-z0-9_\-]{43}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-DOPPLER-002",
        name="Doppler Personal Token",
        pattern=re.compile(r"dp\.pt\.[A-Za-z0-9_\-]{43}"),
        severity="critical",
    ),
    SecretPattern(
        id="SEC-LAUNCHDARKLY-001",
        name="LaunchDarkly SDK Key",
        pattern=re.compile(r"sdk-[A-Za-z0-9\-_]{40}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-POSTMAN-001",
        name="Postman API Key",
        pattern=re.compile(r"PMAK-[0-9a-f]{24}-[0-9a-f]{34}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-OKTA-001",
        name="Okta API Token",
        pattern=re.compile(r"00[A-Za-z0-9\-_]{40}"),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-ZENDESK-001",
        name="Zendesk Secret Key",
        pattern=re.compile(
            r"(?:zendesk)[_\-. ]?(?:secret|token|key)['\"\s:=]+([A-Za-z0-9]{40})",
            re.IGNORECASE,
        ),
        severity="high",
        entropy_check=True,
    ),
    SecretPattern(
        id="SEC-TYPEFORM-001",
        name="Typeform Personal Access Token",
        pattern=re.compile(r"tfp_[A-Za-z0-9_\-]{40,512}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-GRAFANA-001",
        name="Grafana API Key",
        pattern=re.compile(r"eyJrIjoi[A-Za-z0-9\-_=]{40,512}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-PULUMI-001",
        name="Pulumi Access Token",
        pattern=re.compile(r"pul-[A-Za-z0-9]{40}"),
        severity="high",
    ),
    SecretPattern(
        id="SEC-CODECOV-001",
        name="Codecov Upload Token",
        pattern=re.compile(
            r"(?:codecov)[_\-. ]?token['\"\s:=]+([a-f0-9]{32})",
            re.IGNORECASE,
        ),
        severity="medium",
    ),
    SecretPattern(
        id="SEC-SNYK-001",
        name="Snyk API Token",
        pattern=re.compile(
            r"(?:snyk)[_\-. ]?(?:api[_\-. ]?)?token['\"\s:=]+([a-f0-9-]{36})",
            re.IGNORECASE,
        ),
        severity="high",
    ),
]

# ---------------------------------------------------------------------------
# Aggregate export
# ---------------------------------------------------------------------------

SECRET_PATTERNS: list[SecretPattern] = [
    *_AWS_PATTERNS,
    *_GCP_PATTERNS,
    *_AZURE_PATTERNS,
    *_GITHUB_PATTERNS,
    *_GITLAB_PATTERNS,
    *_BITBUCKET_PATTERNS,
    *_SLACK_PATTERNS,
    *_STRIPE_PATTERNS,
    *_AI_PROVIDER_PATTERNS,
    *_PAYMENT_PATTERNS,
    *_REGISTRY_PATTERNS,
    *_CRYPTO_PATTERNS,
    *_INFRA_PATTERNS,
    *_DATABASE_PATTERNS,
    *_DEVTOOLS_PATTERNS,
    *_SOCIAL_PATTERNS,
    *_SEARCH_PATTERNS,
    *_CONTAINER_PATTERNS,
    *_GENERIC_ENTROPY_PATTERNS,
    *_MISC_PATTERNS,
]
"""All built-in secret detection patterns.

110 patterns covering major cloud/SaaS providers.
"""

__all__ = ["SecretPattern", "SecretSeverity", "SECRET_PATTERNS"]
