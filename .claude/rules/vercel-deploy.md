---
name: vercel-deploy
description: Vercel CI-driven deploy architecture (VERCEL_TOKEN, webhook disabled) since 2026-04-13
paths:
  - "vercel.json"
  - ".github/workflows/ci.yml"
  - ".github/workflows/ai-staging-cron.yml"
  - "services/ai-platform/vercel.json"
  - "scripts/ci/**"
  - ".github/actions/smart-notify/**"
  - "scripts/db-setup.js"
---

# Vercel Deploy Architecture (CI-driven, since 2026-04-13)

> **CRITICAL:** All deploys go through GitHub Actions using `VERCEL_TOKEN`. Vercel's git webhook is **disabled** (`vercel.json` → `git.deploymentEnabled: false`). DO NOT re-enable.

## How it works

```
Push to staging  →  ci.yml: quality-check → test → deploy-staging
Push to main     →  ci.yml: quality-check → test → deploy-production

deploy-staging job:
  vercel pull --environment=staging --token=$VERCEL_TOKEN
  vercel build --target=staging --token=$VERCEL_TOKEN
  vercel deploy --prebuilt --target=staging --archive=tgz --token=$VERCEL_TOKEN
  Verify alias rollover (API check web-v2.dev.ecommercehub.my)
  smart-notify deploy_success
```

```
deploy-production job: same 3 stages with `--environment=production` / `--prod`, plus the
AI env preflight below.

Preflights (`scripts/ci/*.mjs`, node builtins only — run before any `npm ci`): read only the key
they need from the pulled `.vercel/.env.*.local` (never `source` the file — a `$`/backtick in a
secret would run in bash) and never print values. (The prime-web Postgres preflights still source
the file; not changed by the AI release.)
  pg-tcp-check.mjs      AI_PLATFORM_DATABASE_URL reachable (TCP) before the ai-platform build migrates
  ai-env-preflight.mjs  AI_PLATFORM_URL (https) + AI_PLATFORM_CONTEXT_SECRET (32+ chars):
                        production → fails the deploy (Lark deploy_fail); empty secret = warning
                        (Vercel Sensitive vars pull empty); staging → warning only.
                        Repo variable ALLOW_PROD_WITHOUT_AI=true downgrades production to warnings.
                        AI_AGENT_ENABLED is not checked (copilot off on production on purpose).
```

### AI platform (separate Vercel project)

`services/ai-platform` deploys as its own Vercel project (`VERCEL_AI_PLATFORM_PROJECT_ID`, same
`VERCEL_TOKEN` / `VERCEL_ORG_ID`), in parallel with prime-web (no `needs` either way):

```
Push to staging → deploy-ai-platform            (Node 24, --environment=staging / --target=staging)
Push to main    → deploy-ai-platform-production (Node 24, --environment=production / --prod)
  working-directory services/ai-platform (Vercel Root Directory left EMPTY: the CLI builds on the
  runner, where the file: deps in ../../packages exist)
  preflight AI_PLATFORM_DATABASE_URL reachable → vercel build runs `npm run build:vercel`
  (services/ai-platform/vercel.json) = tsup + ai-platform DB migrations → deploy
PR → ai-platform-check (Node 24): npm ci + typecheck + test + build (no migrations)
```

### Staging cron (`.github/workflows/ai-staging-cron.yml`)

Vercel Cron fires on production deployments only; staging deploys with `--target=staging`, so the
`crons` in `vercel.json` / `services/ai-platform/vercel.json` never run there. This workflow calls
them instead: every 10 min `/api/cron/ai-receipts` + ai-platform `/internal/cron/thread-retention`,
daily 01:15 UTC `/api/cron/shop-automations`. Unconfigured → exits 0 with a notice. GitHub runs
`schedule` from the default branch only — it starts once the file is on `main`.

All deploys attributed to `phuongltweb` (token owner) → bypasses Vercel's commit-author access check that blocks non-team-member commits.

## Why this exists

Vercel Pro plan rejects deploys whose commit author isn't on the Vercel team. Team has 1 member (phuongltweb). Without CI deploy, Junkio/Duylinh03/etc commits → "Blocked because the commit author does not have contributing access". CI uses owner's token → all commits land.

## How to check deploy status

1. Wait for GitHub Actions CI to finish (~11 min: 1.5m quality + 4.5m test + 6m deploy)
2. `gh run watch <run-id>` from terminal, or watch in GitHub Actions UI
3. After `Deploy: Vercel (staging)` job passes, alias rollover step verifies via API
4. Vercel dashboard: filter `Source: cli` to see CI deploys (excludes webhook noise from old branches)
5. Lark notify in CI/CD group `[PrimeWeb - V2] — CI/CD` (preview-target events filtered out by prime-bot-assistant since 2026-04-13)

## Required GitHub secrets

- `VERCEL_TOKEN` — project-scoped token from `vercel.com/account/tokens`, scope `Nguyen Phuong's projects`, rotate yearly (next: 2027-04)
- `VERCEL_ORG_ID = team_H3WAlHhz2xqvIFRcxfWevPTs`
- `VERCEL_PROJECT_ID = prj_84DQ47BSv2hBX28w0FzjFScfbuRr`
- `VERCEL_AI_PLATFORM_PROJECT_ID` — the separate ai-platform Vercel project (same token / org)
- `STAGING_CRON_SECRET` — copy of the staging `CRON_SECRET` (prime-web and ai-platform use the same value); `ai-staging-cron.yml` only. Rotate together (see `env-vars.md`)

## Repository variables (`vars.*`)

- `STAGING_APP_URL` — `https://<staging prime-web host>`, no trailing slash (`ai-staging-cron.yml`)
- `STAGING_AI_PLATFORM_URL` — `https://<staging ai-platform host>` (optional; thread-retention skipped when empty)
- `ALLOW_PROD_WITHOUT_AI` — `true` only to ship production deliberately without AI: the AI env preflight then warns instead of failing
- `CI_RUNNER` / `CI_HEAVY_RUNNER` — runner labels (default `ubuntu-latest`)

## Release checklist (staging → main)

- Vercel prime-web **Production**: `AI_PLATFORM_URL` (https) + `AI_PLATFORM_CONTEXT_SECRET` (32+ chars, same value as the ai-platform Production env) — else `deploy-production` fails at the AI env preflight

## CRITICAL rules

- DO NOT re-enable Vercel git webhook (`git.deploymentEnabled` must stay `false`)
- DO NOT remove `--target=staging` from `vercel build` or `vercel deploy` — must match all 3 stages (pull/build/deploy)
- DO NOT change `vercel pull --environment=staging` — file `.vercel/.env.staging.local` has `VERCEL_TARGET_ENV=staging` which the prebuilt check requires
- Old feature branches (created before 2026-04-13) still have outdated `vercel.json` → webhook may fire and ERROR (harmless dashboard noise) until rebased; bot filters these out from Lark notifications

## Plan history

Full rollout documentation: `plans/260413-1126-vercel-deploy-blocked/` (6 PRs: #559, #560, #562, #565, #567, #569)
