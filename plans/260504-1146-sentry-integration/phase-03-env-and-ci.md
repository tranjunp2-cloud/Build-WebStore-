# Phase 03 — Env Files + CI Source-Map Upload

**Status:** pending
**Effort:** 1h
**Depends on:** Phase 02 (next.config wrap consumes these env vars)
**Blocks:** Phase 04

## Goal

Add Sentry env var placeholders to both `.env.*.example` files (so `scripts/check-env-vars.js` doesn't block PR), expose CI tooling secrets to the deploy jobs, and configure Vercel Dashboard env vars for runtime DSN.

## Files to modify

| File | Change |
|------|--------|
| `.env.staging.example` | Add 5 Sentry placeholders |
| `.env.production.example` | Add 5 Sentry placeholders |
| `.github/workflows/ci.yml` | Inject `SENTRY_*` secrets into `deploy-staging` + `deploy-production` build env |

## Files NOT modified (deliberately)

- `vercel.json` — `git.deploymentEnabled: false` per CRITICAL rule, untouched
- `scripts/check-env-vars.js` — auto-discovers via `.env.*.example`, no script change needed

## Env var inventory

### Runtime (Vercel Dashboard — set by human, NOT GitHub Secrets)

| Var | Scope | Why public/private | Where used |
|-----|-------|--------------------|----- -------|
| `SENTRY_DSN` | Production + Custom: staging | Private (server only) | `sentry.server.config.ts`, `sentry.edge.config.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | Production + Custom: staging | Public (baked into client bundle) | `sentry.client.config.ts` |
| `SENTRY_ENVIRONMENT` | Production=`production`, staging=`staging` | Private | tagging events |

Same DSN value for both vars — convention: `NEXT_PUBLIC_*` used client-side, plain used server-side (allows future rotation of one without other if needed).

### Build-time (GitHub Secrets — CI tooling, per `env-vars.md`)

| Secret | Why GitHub Secrets, not Vercel | Where used |
|--------|-------------------------------|------------|
| `SENTRY_ORG` | Build-only, source-map upload | `vercel build` step in CI |
| `SENTRY_PROJECT` | Build-only | `vercel build` step in CI |
| `SENTRY_AUTH_TOKEN` | Build-only, write-scoped Sentry token | `vercel build` step in CI |

These align with the env-vars rule: "GitHub Secrets only for: CI tooling".

## Implementation steps

### 1. Modify `.env.staging.example`

Append before the closing AI Generation Monitoring section (after `E2E_SETUP_SECRET=...`, before `# ── AI Generation Monitoring`):

```bash
# ── Sentry (Error Monitoring + Tracing) ─────────────────────────────────────
# Set in Vercel Dashboard → Settings → Environment Variables → Custom: staging
# DSN format: https://<key>@o<orgId>.ingest.sentry.io/<projectId>
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=staging
# Build-time only — set as GitHub Secrets, NOT in Vercel Dashboard.
# CI injects these into `vercel build` step for source-map upload.
# SENTRY_ORG=
# SENTRY_PROJECT=
# SENTRY_AUTH_TOKEN=
```

The 3 build-time vars are commented (#) deliberately — `check-env-vars.js` should NOT enforce them in runtime env. They're documented for human operators.

### 2. Modify `.env.production.example`

Append at end of file:

```bash
# ── Sentry (Error Monitoring + Tracing) ─────────────────────────────────────
# Set in Vercel Dashboard → Settings → Environment Variables → Production
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=production
# Build-time only — see .env.staging.example for explanation.
# SENTRY_ORG=
# SENTRY_PROJECT=
# SENTRY_AUTH_TOKEN=
```

### 3. Modify `.github/workflows/ci.yml` — `deploy-staging` job

Add `SENTRY_*` to the job-level `env:` block (currently has `VERCEL_*` only). Locate line ~311-314:

```yaml
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

Change to:

```yaml
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      # Sentry source-map upload (build-time only — see .claude/rules/env-vars.md)
      SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

### 4. Modify `.github/workflows/ci.yml` — `deploy-production` job

Identical addition to the `deploy-production` job's `env:` block (around line ~488-491). Same 3 SENTRY_* lines.

### 5. NO change to `Build --target=staging` or `Build (prod)` step body

Job-level `env:` already cascades to all steps. Sentry's webpack plugin reads `process.env.SENTRY_AUTH_TOKEN` etc directly. No `with:` block needed.

### 6. Provision GitHub Secrets (manual, by repo admin)

```bash
gh secret set SENTRY_ORG --body "<org-slug>"
gh secret set SENTRY_PROJECT --body "<project-slug>"
gh secret set SENTRY_AUTH_TOKEN --body "<token-from-sentry-org-settings>"
```

Token scope: `project:releases` + `org:read` (minimum for source-map upload). NOT `project:admin`.

### 7. Provision Vercel Dashboard env vars (manual, by repo admin)

Per `.claude/rules/env-vars.md`:

- Navigate to `vercel.com/nguyen-phuongs-projects/ech-prime-web-v2/settings/environment-variables`
- For each: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`:
  - Add to scope: `Production` AND `Custom: staging` (NOT Preview — staging is custom env that does NOT inherit)
  - Production scope: `SENTRY_ENVIRONMENT=production`, DSN values for prod project
  - Staging scope: `SENTRY_ENVIRONMENT=staging`, DSN values for staging project (or same DSN with different `environment` tag if single project)

Decision: 1 Sentry project with `environment` tag separating staging/prod (cheaper, simpler dashboards) vs. 2 projects (cleaner quota separation). Default: 1 project + tag. Open Q in plan.md.

## Acceptance criteria

- [ ] `.env.staging.example` has Sentry section with 3 uncommented + 3 commented placeholders
- [ ] `.env.production.example` has matching section
- [ ] `.github/workflows/ci.yml` `deploy-staging.env` has 3 new `SENTRY_*` lines
- [ ] `.github/workflows/ci.yml` `deploy-production.env` has 3 new `SENTRY_*` lines
- [ ] `gh secret list` shows `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- [ ] Vercel Dashboard shows `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` in BOTH `Production` and `Custom: staging` scopes
- [ ] `node scripts/check-env-vars.js` passes locally (no missing keys flagged)
- [ ] `npm run typecheck` + `npm run lint` still pass
- [ ] CI lint job green on draft PR

## Risks specific to this phase

| Risk | Mitigation |
|------|------------|
| Vercel custom env `staging` doesn't inherit Preview vars — Sentry vars missing at staging runtime | Phase 03 step 7 explicitly adds to `Custom: staging` scope; verify with `vercel env ls --token=$VERCEL_TOKEN` |
| `SENTRY_AUTH_TOKEN` leaks via build log | Sentry plugin redacts token by default; CI runner masks GitHub Secrets in logs automatically |
| `check-env-vars.js` flags commented vars as missing | Script reads only uncommented `KEY=` lines; 3 commented vars are comments, won't be flagged |
| Wrong DSN scope (staging DSN deployed to prod) | Different SENTRY_ENVIRONMENT per scope catches misroutes; Sentry dashboard tag filter shows env mismatch |
| Token rotation forgotten | Document expiry in plan.md open Q; suggest adding to existing yearly `VERCEL_TOKEN` rotation reminder (next: 2027-04) |

## Rollback

```bash
git checkout -- .env.staging.example .env.production.example .github/workflows/ci.yml
gh secret delete SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN
# Vercel dashboard: manually delete 3 env vars from each scope
```

No data loss. Sentry events stop flowing within minutes.

## Status update

```bash
ck plan check 03 --start
ck plan check 03
```
