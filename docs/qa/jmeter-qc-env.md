---
owner: QC
last_updated: 2026-07-02
---

# JMeter QC Test Environment

Isolated environment for QC load / functional / E2E / API tests. Runs on a
dedicated Neon project + Vercel custom env `qc-test`, so QC test bursts do
not degrade staging or exhaust the shared Neon quota.

**Plan reference:** [`plans/260702-1719-qc-test-env-setup/`](../../plans/260702-1719-qc-test-env-setup/)

## Environment overview

| Item | Value |
|------|-------|
| Purpose | Load / functional / E2E test isolated from staging |
| App env | `qc-test` (Vercel custom environment) |
| Database | Neon project `ech-prime-web-v2-qc-test` (Singapore, Free tier initially) |
| Redis | Shared with staging (Upstash) — namespaced by APP_ENV |
| S3 bucket | `tm-prime-web-qc` (isolated so JMeter uploads don't touch staging media) |
| Git branch | `qc-test` (protected — push restricted to QC lead + dev owner) |
| CI job | `Deploy: Vercel (qc-test)` in `.github/workflows/ci.yml` |
| Owner | QC lead — TBD (assign at handover) |
| Backup | Dev owner — TBD |

## Target URLs

**If custom domain configured** (Phase 02 Step 7 of the plan):

| Endpoint | URL |
|----------|-----|
| App root | `https://qc-test.web-v2.dev.ecommercehub.my` |
| Login | `https://qc-test.web-v2.dev.ecommercehub.my/login` |
| Dashboard | `https://qc-test.web-v2.dev.ecommercehub.my/dashboard` |
| Payload admin | `https://qc-test.web-v2.dev.ecommercehub.my/admin` |
| API health | `https://qc-test.web-v2.dev.ecommercehub.my/api/health` |
| Public tenant example | `https://qc-shop-1.web-v2.dev.ecommercehub.my` |

**Fallback (no custom domain):** use the Vercel-generated URL surfaced by the
`Deploy: Vercel (qc-test)` CI job on the latest push to `qc-test`. Setting a
fixed Vercel alias for the QC env is recommended to keep the URL stable.

## Test accounts

Seeded by `npm run db:seed-qc` (see `scripts/seed-qc-data.ts`).

| Role | Email pattern | Count | Password |
|------|--------------|-------|----------|
| Super admin | `qc-admin-{1,2}@primeweb.local` | 2 | from vault |
| Tenant owner | `qc-owner-{1..5}@primeweb.local` | 5 | from vault |
| Tenant staff | `qc-staff-{1..3}@primeweb.local` | 3 | from vault |

Password stored in **1Password shared vault "PrimeWeb QC"**. Do NOT commit
the plaintext password — even for dummy accounts — since git history and
LLM telemetry retain leaks longer than the account lifetime.

Tenants seeded: `qc-shop-{1..5}` covering subscription states
`active / trial / expired / suspended` for state-transition tests.

## JMeter setup

**Prerequisites:** JMeter 5.6+, git, node 20+ for reset scripts.

```bash
# 1. Clone + check out QC branch
git clone git@github.com:primeproduction/ech-prime-web-v2.git
cd ech-prime-web-v2
git checkout qc-test

# 2. Fetch env template
cp .env.qc-test.example .env.qc-test
# → fill DATABASE_URI + passwords from 1Password vault "PrimeWeb QC"

# 3. Fetch JMeter properties template
cp .jmx-config/qc-test.properties.example .jmx-config/qc-test.properties
# → fill credentials from 1Password vault (never commit)

# 4. Load your .jmx test plans + run
jmeter -n -t your-plan.jmx -p .jmx-config/qc-test.properties -l results.jtl
```

## Before each test batch

1. Health check: `curl https://qc-test.web-v2.dev.ecommercehub.my/api/health`
   → expect `{status:"ok"}`
2. Reset data:
   ```bash
   set -a && . .env.qc-test && set +a
   npm run db:reset-qc && npm run db:seed-qc
   ```
3. Notify Lark `#qc` channel: "Starting QC batch #{N} at {time}"

## After test batch

1. Save `.jtl` results into your QC storage (drive / vault, not git)
2. Log any errors in `docs/qa/qc-test-log.md` (create when first needed)
3. Optional: reset again if you want a clean slate for the next batch

## Credentials management

- **1Password vault: "PrimeWeb QC"** — items:
  - `QC Test Accounts` — all 10 test emails + shared password
  - `Neon QC Connection` — DATABASE_URI (owner-only)
  - `Neon QC Dashboard` — Neon console access
- Rotate the shared password quarterly (add reminder to Lark team calendar)
- Vault members: QC lead, dev owner, backup dev

## Files in the repo

| File | Purpose |
|------|---------|
| `.env.qc-test.example` | Env var reference (placeholder, safe to commit) |
| `.jmx-config/qc-test.properties.example` | JMeter properties template |
| `scripts/qc-guard.ts` | Safety guard preventing seed/reset from touching staging |
| `scripts/seed-qc-data.ts` | Populates QC DB with 10 users + 5 tenants + content |
| `scripts/reset-qc-data.ts` | Wipes tenant-scoped data (schema preserved) |
| `docs/qa/qc-test-runbook.md` | Operational runbook (day-to-day) |
| `.github/workflows/ci.yml` | Job `Deploy: Vercel (qc-test)` |
| `.github/branch-protection.md` | `qc-test` branch push restriction |

## Escalation

1. **QC lead** first responder — walk the runbook first
2. **Dev owner** backup — Lark DM
3. Neon support (paid plan required) — https://neon.tech/support

## Related

- Runbook: [`qc-test-runbook.md`](./qc-test-runbook.md)
- Plan: [`260702-1719-qc-test-env-setup`](../../plans/260702-1719-qc-test-env-setup/)
- Vercel deploy rule: [`.claude/rules/vercel-deploy.md`](../../.claude/rules/vercel-deploy.md)
- Env vars rule: [`.claude/rules/env-vars.md`](../../.claude/rules/env-vars.md)
