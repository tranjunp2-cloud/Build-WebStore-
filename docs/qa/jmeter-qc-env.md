---
owner: QC
last_updated: 2026-07-21
---

# JMeter QC Test Environment

Isolated environment for QC load / functional / E2E / API tests. Runs on a
dedicated Neon project + Vercel Preview scope with branch-filter overrides,
so QC test bursts do not degrade staging or exhaust the shared Neon quota.

**Plan reference:** [`plans/260702-1719-qc-test-env-setup/`](../../plans/260702-1719-qc-test-env-setup/)
**Runbook (day-to-day):** [`qc-test-runbook.md`](./qc-test-runbook.md)

## Environment overview

| Item | Value |
|------|-------|
| Purpose | Load / functional / E2E test isolated from staging |
| App env | `qc-test` (via `APP_ENV` env var; deploy target = `preview`) |
| Database | Neon project `ech-prime-web-v2-qc-test` (Singapore, Free tier) — endpoint `ep-dawn-scene-ao97yus8` |
| Redis | Shared with staging (Upstash) — namespaced by APP_ENV |
| S3 bucket | Shared with staging (`tm-prime-web-dev`) — YAGNI, QC media minimal |
| Git branch | `qc-test` (protected — QC lead + dev owner push) |
| CI job | `Deploy: Vercel (qc-test)` in `.github/workflows/ci.yml` |
| Deploy target | Vercel Preview scope + branch-filter (`--environment=preview --git-branch=qc-test`) |
| Owner | QC lead — TBD (assign at handover) |
| Backup | Dev owner — phuongltweb |

### Why Preview scope, not custom env

Vercel Pro plan permits only **1 custom environment** per project. Slot is
already occupied by `staging`. Instead of upgrading to Enterprise, we route
branch `qc-test` via Preview scope with per-variable branch-filter overrides
— `DATABASE_URI`, `APP_ENV`, `QC_SEED_PASSWORD`, `NEXT_PUBLIC_SERVER_URL`
scoped to `Preview + branch=qc-test` win over base Preview values when
deploying from branch `qc-test`.

## Target URLs

Stable alias auto-updated on every `qc-test` deploy:

| Endpoint | URL |
|----------|-----|
| App root | `https://ech-prime-web-v2-qc.vercel.app` |
| Login | `https://ech-prime-web-v2-qc.vercel.app/login` |
| Dashboard | `https://ech-prime-web-v2-qc.vercel.app/dashboard` |
| Payload admin | `https://ech-prime-web-v2-qc.vercel.app/admin` |
| API health | `https://ech-prime-web-v2-qc.vercel.app/api/health` |
| Payload login API | `POST https://ech-prime-web-v2-qc.vercel.app/api/users/login` |

Custom domain (`qc-test.web-v2.dev.ecommercehub.my`) deferred — Vercel alias
is stable enough for QC batch runs.

## Test accounts

Seeded by `npm run db:seed-qc` (see `scripts/seed-qc-data.ts`).

| Role | Email pattern | Count |
|------|--------------|-------|
| Super admin | `qc-admin-{1,2}@primeweb.local` | 2 |
| Tenant owner | `qc-owner-{1..5}@primeweb.local` | 5 seeded / 4 VU-eligible |
| Editor | `qc-staff-{1,2}@primeweb.local` | 2 |
| Viewer | `qc-staff-3@primeweb.local` | 1 |

Password sourced from `QC_SEED_PASSWORD` env var (set on Vercel + local
`.env.qc-test`). Value stored in **1Password shared vault "PrimeWeb QC"** —
do NOT commit plaintext even for dummy accounts, git history + LLM
telemetry retain leaks longer than account lifetime.

Tenants seeded: 5 tenants covering subscription-status variety
`active / active / trialing / past_due / suspended` for state-transition
tests.

### Dashboard-ready seed invariant

VU-eligible `qc-owner-*` accounts are load-test fixtures, so a fresh `qc:reset` +
`qc:seed` must leave them ready to open `/dashboard` directly. State-transition
fixtures such as the suspended tenant remain seeded but are excluded from the VU pool:

| TC ID | Verification |
|-------|--------------|
| `TC-GH1432-QC-01` | Owner has `has_seen_ai_wizard=true`, tenant has `onboardingCompleted=true`, and its site has `generationStatus=completed`. |
| `TC-GH1432-QC-02` | Every VU-eligible owner belongs to a non-suspended tenant; `qc-owner-5` is reserved for suspended-state testing. |

The seed command validates this invariant before reporting success. Fixtures
intended for onboarding must use `dashboardReady=false`; the content phase skips
their site creation so they do not enter the contradictory "incomplete flags but
usable site exists" state.

### Product-list performance invariants

| TC ID | Verification |
|-------|--------------|
| `TC-GH1432-PERF-01` | Dashboard product list and `GET /api/dashboard/products` use the same explicit field allowlist, `depth=1`, and no pagination count query. |
| `TC-GH1432-PERF-02` | Product list and product array tables have idempotent indexes matching tenant/newest filtering and `_parent_id`/`_order` hydration. |
| `TC-GH1432-PERF-03` | Authenticated `GET /api/dashboard/products` returns the canonical Products Dashboard workload for load testing. |

**Required JMeter updates for GH-1432 after deployment:**

1. Remove the stale `/api/dashboard/summary` sampler. The endpoint had no application
   caller and has been removed; the existing `/dashboard` RSC sampler already exercises
   the real Dashboard data flow.
2. Change the Products sampler from `/api/products?limit=20` to
   `/api/dashboard/products`. This authenticated endpoint calls the same query helper as
   the Products UI, so field selection, relationship depth, sorting, tenant access, and
   pagination behavior cannot drift between the application and the load test.
3. Exclude `qc-owner-5@primeweb.local` from VU credentials because its tenant is
   intentionally suspended for state-transition testing and login correctly returns 403.

The source repository does not contain the original `.jmx` referenced by GH-1432. QC
owns these test-plan edits; Dev owns the endpoint and fixture contract above.

## JMeter setup

**Prerequisites:** JMeter 5.6+, git, Node 20+ for reset scripts,
PostgreSQL 17 client for pg_dump-based DB bootstrap (only needed for
first-time setup after schema drift).

```bash
# 1. Clone + check out QC branch
git clone git@github.com:primeproduction/ech-prime-web-v2.git
cd ech-prime-web-v2
git checkout qc-test

# 2. Fetch env template
cp .env.qc-test.example .env.qc-test
# → fill DATABASE_URI + QC_SEED_PASSWORD from 1Password vault "PrimeWeb QC"

# 3. Fetch JMeter properties template
cp .jmx-config/qc-test.properties.example .jmx-config/qc-test.properties
# → fill credentials from 1Password vault (never commit)

# 4. Load .jmx test plans + run
jmeter -n -t your-plan.jmx -p .jmx-config/qc-test.properties -l results.jtl
```

## Neon endpoint gotcha — use direct, not pooler

Neon assigns two endpoints per branch:
- `ep-dawn-scene-ao97yus8.c-2.ap-southeast-1.aws.neon.tech` — **direct** (use this)
- `ep-dawn-scene-ao97yus8-pooler.c-2.ap-southeast-1.aws.neon.tech` — pooler (blocks Payload's `information_schema` queries)

Payload's Drizzle driver issues session-level catalog queries that PgBouncer
in session-pooling mode drops. Use the direct endpoint for seed/reset
scripts AND for the Vercel `DATABASE_URI` env var. Pooler endpoint OK for
raw JMeter HTTP hits since traffic goes through app code.

## First-time DB bootstrap (only if schema empty)

QC Neon project starts empty. `next dev` Payload push takes 15+ minutes on
cold Neon compute and often stalls. Faster: dump staging schema, restore
into QC:

```bash
PG17=/opt/homebrew/opt/postgresql@17/bin
STAGING_URI="<from 1Password vault>"
QC_URI="<from 1Password vault>"

# 1. Dump schema-only from staging (~30s, 448 KB)
$PG17/pg_dump --schema-only --no-owner --no-acl --no-security-labels \
  "$STAGING_URI" > /tmp/qc-schema.sql

# 2. Wipe QC public schema clean (in case partial migrations ran)
$PG17/psql "$QC_URI" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO neondb_owner;"

# 3. Restore schema
$PG17/psql "$QC_URI" -v ON_ERROR_STOP=0 -f /tmp/qc-schema.sql

# 4. Verify 250+ tables
$PG17/psql "$QC_URI" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# 5. Seed dummy data
npm run db:seed-qc
```

QC PG 17 client on macOS: `brew install postgresql@17`.

## Before each test batch

1. Health check: `curl https://ech-prime-web-v2-qc.vercel.app/api/health`
   → expect `{"status":"ok",...}`
2. Reset data:
   ```bash
   set -a && . .env.qc-test && set +a
   npm run db:reset-qc && npm run db:seed-qc
   ```
   The `qc-guard` inside those scripts refuses to run unless BOTH
   `APP_ENV=qc-test` AND `DATABASE_URI` hostname is NOT in the staging/prod
   denylist — you cannot accidentally wipe staging even with a stale env in
   your shell.
3. Notify Lark `#qc` channel: "Starting QC batch #{N} at {time}"

## After test batch

1. Save `.jtl` results into QC storage (drive / vault, not git)
2. Log any errors in `docs/qa/qc-test-log.md` (create when first needed)
3. Optional: reset again if you want a clean slate for the next batch

## OTP bypass on QC lane

Two-Step Verification is enforced globally, but the QC lane skips real
email delivery so QA can iterate without polling a fake `@primeweb.local`
mailbox. The bypass is **triple-guarded** in `src/lib/otp/qc-bypass.ts`
and only activates when ALL of the following hold:

1. `APP_ENV === 'qc-test'` (Vercel scope stamp — set on Preview + branch=qc-test)
2. `QC_OTP_BYPASS_ENABLED === 'true'` (explicit opt-in per env)
3. Email ends with `QC_OTP_BYPASS_DOMAIN` (default `@primeweb.local`)

Any real customer email domain is refused even if bypass is misconfigured
on the wrong scope. Unit tests: `src/__tests__/unit/otp/qc-bypass-guard.test.ts`
(TC-QC-OTP-01 → 04).

### For QA / JMeter runs

- Use any seeded account: `qc-{admin,owner,staff}-N@primeweb.local`
- When the OTP screen appears, enter **`123456`** (value of `QC_OTP_BYPASS_CODE`)
- No email polling required — dev tab logs `[QC OTP] Domain bypass active`

### Legacy fallback (deprecated)

Before this PR the QC OTP was populated via direct SQL update on the
`users.otp_hash` column, valid only 24 h. That hack is superseded — do not
run it any more. If for some reason the env-driven bypass is off, request
dev owner (anh Phuong) to re-enable rather than SQL-inject.

## Credentials management

- **1Password vault: "PrimeWeb QC"** — items:
  - `QC Test Accounts` — 10 test emails + shared password (`QC_SEED_PASSWORD`)
  - `Neon QC Connection` — DATABASE_URI (direct endpoint, no `-pooler`)
  - `Neon QC Dashboard` — Neon console access
- Rotate the shared password quarterly (add reminder to Lark team calendar)
- Vault members: QC lead, dev owner, backup dev

## Files in the repo

| File | Purpose |
|------|---------|
| `.env.qc-test.example` | Env var reference (placeholder, safe to commit) |
| `.jmx-config/qc-test.properties.example` | JMeter properties template |
| `scripts/qc-guard.ts` | Safety guard preventing seed/reset from touching staging |
| `scripts/seed-qc-data.ts` | Populates QC DB with 10 users + 5 tenants + 40 products + pages |
| `scripts/qc-seed-products.ts` | Product + extra-page helpers used by the main seed |
| `scripts/reset-qc-data.ts` | Wipes tenant-scoped data (schema preserved) |
| `src/lib/otp/qc-bypass.ts` | Triple-guarded OTP bypass helper (envs + domain gate) |
| `docs/qa/qc-test-runbook.md` | Operational runbook (day-to-day) |
| `.github/workflows/ci.yml` | Job `Deploy: Vercel (qc-test)` |
| `.github/branch-protection.md` | `qc-test` branch push restriction |

## Escalation

1. **QC lead** first responder — walk the runbook first
2. **Dev owner** (phuongltweb) backup — Lark DM
3. Neon support (paid plan required) — https://neon.tech/support

## Related

- Runbook: [`qc-test-runbook.md`](./qc-test-runbook.md)
- Plan: [`260702-1719-qc-test-env-setup`](../../plans/260702-1719-qc-test-env-setup/)
- Vercel deploy rule: [`.claude/rules/vercel-deploy.md`](../../.claude/rules/vercel-deploy.md)
- Env vars rule: [`.claude/rules/env-vars.md`](../../.claude/rules/env-vars.md)
