"""Scanner protocol and built-in scanner implementations."""

from .base import (
    ScanDecision,
    ScanMatch,
    Scanner,
    ScanResult,
    allow_result,
    block_result,
)
from .composite import scan_all, worst_decision
from .patterns.injection_patterns import INJECTION_PATTERNS, InjectionPattern
from .patterns.pii_patterns import PII_PATTERNS, PiiPattern
from .patterns.secret_patterns import SECRET_PATTERNS, SecretPattern
from .pii import PiiOptions, PiiScanner, scan_pii
from .prompt_injection import (
    PromptInjectionScanner,
    check_prompt_injection,
    default_prompt_injection_scanner,
)
from .secrets import SecretsOptions, SecretsScanner, scan_secrets
from .vault import RestoreStrategy, Vault

__all__ = [
    # Base
    "Scanner",
    "ScanDecision",
    "ScanMatch",
    "ScanResult",
    "allow_result",
    "block_result",
    # Patterns
    "INJECTION_PATTERNS",
    "InjectionPattern",
    "PII_PATTERNS",
    "PiiPattern",
    "SECRET_PATTERNS",
    "SecretPattern",
    # Prompt injection scanner
    "PromptInjectionScanner",
    "check_prompt_injection",
    "default_prompt_injection_scanner",
    # Secrets scanner
    "SecretsOptions",
    "SecretsScanner",
    "scan_secrets",
    # PII scanner
    "PiiOptions",
    "PiiScanner",
    "scan_pii",
    # Vault
    "Vault",
    "RestoreStrategy",
    # Composite
    "scan_all",
    "worst_decision",
]
