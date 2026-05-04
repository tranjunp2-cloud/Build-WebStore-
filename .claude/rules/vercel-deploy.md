---
name: vercel-deploy
description: Vercel CI-driven deploy architecture (VERCEL_TOKEN, webhook disabled) since 2026-04-13
paths:
  - "vercel.json"
  - ".github/workflows/ci.yml"
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

## CRITICAL rules

- DO NOT re-enable Vercel git webhook (`git.deploymentEnabled` must stay `false`)
- DO NOT remove `--target=staging` from `vercel build` or `vercel deploy` — must match all 3 stages (pull/build/deploy)
- DO NOT change `vercel pull --environment=staging` — file `.vercel/.env.staging.local` has `VERCEL_TARGET_ENV=staging` which the prebuilt check requires
- Old feature branches (created before 2026-04-13) still have outdated `vercel.json` → webhook may fire and ERROR (harmless dashboard noise) until rebased; bot filters these out from Lark notifications

## Plan history

Full rollout documentation: `plans/260413-1126-vercel-deploy-blocked/` (6 PRs: #559, #560, #562, #565, #567, #569)
