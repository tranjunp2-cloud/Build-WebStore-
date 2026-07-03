---
owner: QC lead
last_updated: 2026-07-02
---

# QC Test Environment Runbook

Day-to-day operations for the isolated QC environment. Purpose-built so the
QC team can self-serve: reset data, kick off deploys, react to alerts. Dev
owner is escalation, not day-one support.

**Companion doc:** [`jmeter-qc-env.md`](./jmeter-qc-env.md) — JMeter setup + URLs + credentials
**Plan:** [`plans/260702-1719-qc-test-env-setup/`](../../plans/260702-1719-qc-test-env-setup/)

## Overview

| Item | Value |
|------|-------|
| Environment | `qc-test` (Vercel custom env) |
| URL | `https://qc-test.web-v2.dev.ecommercehub.my` (or Vercel-generated) |
| Database | Neon project `ech-prime-web-v2-qc-test` (Singapore, Free tier) |
| Git branch | `qc-test` (protected — push restricted) |
| CI job | `Deploy: Vercel (qc-test)` |
| Owner | QC lead — TBD |
| Backup | Dev owner — TBD |

## Common tasks

### Before each test batch

1. **Health check**
   ```bash
   curl https://qc-test.web-v2.dev.ecommercehub.my/api/health
   ```
   Expect `{status:"ok"}`. Anything else → check the latest CI run for
   `Deploy: Vercel (qc-test)`.

2. **Reset + reseed data**
   ```bash
   set -a && . .env.qc-test && set +a
   npm run db:reset-qc && npm run db:seed-qc
   ```
   The `qc-guard` inside those scripts refuses to run unless BOTH
   `APP_ENV=qc-test` AND `DATABASE_URI` points at the QC Neon host — you
   cannot accidentally wipe staging even with a stale env in your shell.
   The seed also requires `QC_SEED_PASSWORD` set (from the 1Password vault);
   it hard-fails if missing rather than defaulting to a well-known value.

3. **Announce** in Lark `#qc` channel:
   `Starting QC batch #{N} at {time}. ETA {duration}.`

### Deploying new code to `qc-test`

Sync from staging when you want QC to test the latest merged features:

```bash
git checkout qc-test
git fetch origin
git merge origin/staging          # or `git cherry-pick <commit>` for a subset
git push origin qc-test
```

CI runs `Deploy: Vercel (qc-test)` (~6–10 min). Success / failure lands in
Lark `[PrimeWeb - V2] — CI/CD` group. Do NOT push code that has not landed
on `staging` first — the QC lane is downstream of QA, not a bypass.

### Neon quota approaches limit

1. Alert arrives from Neon (email) OR spotted during weekly cost review
2. Open the QC project dashboard:
   `https://console.neon.tech/app/projects/ech-prime-web-v2-qc-test`
3. Choose one:
   - **Wait for reset** — Neon Free tier resets on the 1st of the month
   - **Upgrade to Launch** — $15/mo, near-instant, revert next cycle if
     one-off event driven
   - **Ask dev owner** to profile the queries burning the quota (usually a
     JMeter loop hitting an unindexed path)

### Deploy job fails

1. Open the failed run under **GitHub → Actions → Deploy: Vercel (qc-test)**
2. Common failure modes:
   - **Preflight — Postgres reachable** — Neon DB paused / quota exhausted
   - **`vercel pull`** — env var missing on `qc-test` scope in Vercel Dashboard
   - **Build error** — same as staging, check the CLI output
3. Fix in `qc-test` branch (or merge a fix from `staging`) and push again

### Rotate the shared test password

Quarterly cadence (Sep 2026, Dec 2026, ...):

1. Generate a new password in 1Password vault "PrimeWeb QC"
2. Update the `QC_SEED_PASSWORD` env var on Vercel (`qc-test` scope) AND
   in each dev's local `.env.qc-test`
3. Reset + reseed to apply:
   ```bash
   set -a && . .env.qc-test && set +a
   npm run db:reset-qc && npm run db:seed-qc
   ```
4. Broadcast to QC team via Lark + updated 1Password item

## Weekly review (Monday 9am, dev owner)

1. **Neon dashboard** — check QC project transfer + storage usage
2. **Vercel dashboard** — filter `Environment: qc-test`, spot any silent
   deploy failures
3. **Upstash dashboard** — check QC namespace hasn't blown Redis quota
4. Post short summary in Lark `[PrimeWeb - V2] — CI/CD` group

Duration target: <5 minutes.

## Alerts

| Signal | Channel | Owner |
|--------|---------|-------|
| Deploy fail | Lark `[PrimeWeb - V2] — CI/CD` (via `smart-notify`) | QC lead → dev owner |
| Neon >80% quota | Neon email + weekly review | Dev owner |
| Long test batch running | Manual heads-up in Lark `#qc` | QC lead |

Automated Neon quota polling (Vercel Cron → Neon API → Lark webhook) is
**deferred** — YAGNI until manual weekly checks feel too infrequent.

## Escalation path

1. **QC lead** first responder — walk this runbook first
2. **Dev owner** — Lark DM for infrastructure / migration issues
3. **PM** — for scope conflicts (event timing, staging/QC contention)
4. **Neon support** — https://neon.tech/support (paid plans only; QC starts on Free)

## Boundaries — what NOT to do here

- Do NOT push production credentials into `qc-test` env vars
- Do NOT copy real customer data into the QC database
- Do NOT run destructive migrations on QC that haven't landed on staging
- Do NOT keep long-lived JMeter runs against QC (>1 hour) without warning
  dev owner — Neon Free tier throttles transfer

## Files referenced

- `scripts/qc-guard.ts` — safety guard
- `scripts/seed-qc-data.ts` — populate dummy fixtures
- `scripts/reset-qc-data.ts` — wipe tenant data
- `.env.qc-test.example` — env template
- `.jmx-config/qc-test.properties.example` — JMeter template
- `.github/workflows/ci.yml` — `Deploy: Vercel (qc-test)` job
- `.github/branch-protection.md` — branch push rules

## Related

- [JMeter QC env doc](./jmeter-qc-env.md)
- [Vercel deploy rule](../../.claude/rules/vercel-deploy.md)
- [Env vars rule](../../.claude/rules/env-vars.md)
- [Open blockers](../tracking/OPEN_BLOCKERS.md)
