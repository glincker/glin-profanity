# Releasing

glin-profanity publishes to **npm** (JS/TS), **PyPI** (Python), and cuts a **GitHub Release** with a signed tag. All three fire automatically from a single merge to `release` via `.github/workflows/auto-release.yml`.

This document covers the one-time setup needed for the automated pipeline to work end-to-end, plus fallback paths when something breaks.

---

## TL;DR

- Merge a conventional-commit PR to `release`, or push a commit whose subject starts with `release: minor`, `release: patch`, etc.
- The workflow detects the bump, builds, publishes to npm + PyPI, and creates a GitHub Release.
- **No tokens in GitHub Secrets.** Trust is established via OIDC.

---

## Why OIDC (and why you don't want NPM_TOKEN)

- No long-lived credentials in the repo → nothing to leak, nothing to rotate.
- Every published tarball carries a **sigstore provenance attestation** — consumers can verify the exact commit + workflow that built it.
- Works with strict package-level 2FA (`Require 2FA: Authorization and writes`).

OIDC issues a short-lived token that names the `repo × workflow × environment` that requested it. npm checks that triple against the package's trusted-publisher list and either accepts or rejects. There's no secret passing through the workflow.

---

## One-time setup (npm side)

This is the step that the automated workflow **cannot** do for you. Do it once per package.

1. Sign in to npm as a package owner.
2. Open: `https://www.npmjs.com/package/glin-profanity/access`
3. Scroll to **Publishing access** → **Add trusted publisher** → **GitHub Actions**
4. Fill in **exactly** these values (all four fields are part of the identity check):

   | Field | Value |
   |---|---|
   | Organization or user | `glincker` |
   | Repository name | `glin-profanity` |
   | Workflow filename | `auto-release.yml` |
   | Environment name | `npm-publish` |

5. Save.

Repeat for `glin-profanity-mcp` and `openclaw-profanity` if you want those on OIDC too (their workflows are `release-mcp.yml` and `release-openclaw.yml`, same org/repo).

### Why the "Environment" field matters

The workflow declares `environment: npm-publish` on the `publish-npm` job. GitHub Actions only mints an OIDC token that claims an environment when a job actually declares one — and npm validates the claim. If you leave the Environment field blank on npm's side, the claim with `environment=npm-publish` will **not** match an unspecified expectation and npm returns 404. Must match character-for-character.

---

## One-time setup (PyPI side)

PyPI supports the same trusted-publisher pattern. If `hatch publish` ever starts 404-ing, the equivalent setup is:

1. `https://pypi.org/manage/project/glin-profanity/settings/publishing/`
2. Add a GitHub publisher: org `glincker`, repo `glin-profanity`, workflow `auto-release.yml`, environment `pypi-publish` (if the workflow adopts one).

PyPI has been working so this is informational only.

---

## Triggering a release

### Automatic on merge

The workflow triggers on every push to `release`. `scripts/sync-versions.js detect` parses the latest commit subject. Patterns that trigger a bump:

| Commit subject starts with | Result |
|---|---|
| `release: patch` | patch bump |
| `release: minor` | minor bump |
| `release: major` | major bump |
| `release: beta-minor` | minor bump on beta channel |
| `release: alpha-patch` | patch bump on alpha channel |

Patterns that explicitly **skip** a release (so merges don't cascade into junk releases):

- `chore(deps): ...` — Dependabot
- `chore: bump version ...` — the workflow's own version-bump commit
- Anything containing `[skip ci]`
- Merge commits from Dependabot PRs

### Manual

```bash
gh workflow run auto-release.yml -f release_type=minor -f channel=stable
```

---

## Diagnosing publish failures

### npm publish returns 404

**Always** means the trusted-publisher config on npm doesn't match the running job's OIDC claim. Compare npm's config (see above) to the currently-running workflow's `repo`, `workflow filename`, and `environment`. Any mismatch → 404.

You will see this in the job log before the 404:

```
npm notice publish Signed provenance statement with source and build information from GitHub Actions
npm notice Provenance statement published to transparency log: https://search.sigstore.dev/...
```

If sigstore writes succeed but the PUT to npm returns 404, the problem is definitively on npm's side (not yours). The workflow has added explicit diagnostic output for this case.

### npm publish returns 403 with "Two-factor authentication is required"

The token is being sent as an automation token but the package's `Require 2FA` setting is the strictest mode. OIDC bypasses this entirely. If you see this error, the workflow is not using OIDC (likely `NPM_TOKEN` was accidentally added to the environment). Check `env:` on the publish step.

### npm publish returns 403 without OTP context

User/token does not own the package. Verify with `npm owner ls glin-profanity`.

### "Version already exists, skipping publish"

An earlier run in the cascade already published this version. Bump the version in source to something unused and merge again.

---

## Fallback: manual publish

If CI is blocked and you need to ship immediately:

```bash
cd packages/js
# ensure version in package.json is the version you want to publish
npm run build
# verify dist/scanners/ exists
ls dist/scanners/
# publish (prompts for OTP)
npm publish --access public
```

This does **not** attach provenance attestation — use only for emergency / one-off fixes.

---

## Adding a new workspace package to the pipeline

1. Create its own `release-<name>.yml` in `.github/workflows/`, modeled on `release-mcp.yml` (trigger on `push` to `release` with path filter `packages/<name>/**`).
2. Add a `publish-npm` job with `environment: npm-publish-<name>` (distinct per package for least-privilege auditability).
3. Register the matching trusted publisher on npm.
