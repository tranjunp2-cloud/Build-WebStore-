---
owner: QC lead
last_updated: 2026-07-15
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
| App env | `qc-test` (via `APP_ENV`; Vercel deploy target = Preview + branch-filter) |
| URL | `https://ech-prime-web-v2-qc.vercel.app` (stable alias, auto-updates on deploy) |
| Database | Neon project `ech-prime-web-v2-qc-test` (Singapore, Free tier) — direct endpoint `ep-dawn-scene-ao97yus8` (do NOT use `-pooler` variant) |
| Git branch | `qc-test` (protected — push restricted) |
| CI job | `Deploy: Vercel (qc-test)` — routes via Vercel Preview scope + branch-filter (Pro plan permits only 1 custom env slot, already used by staging) |
| Owner | QC lead — **Ngân (Ary)** |
| Backup | Dev owner — phuongltweb (anh Phuong) |

## Common tasks

### Before each test batch

1. **Health check**
   ```bash
   curl https://ech-prime-web-v2-qc.vercel.app/api/health
   ```
   Expect `{"status":"ok",...}`. Anything else → check the latest CI run
   for `Deploy: Vercel (qc-test)`.

2. **Reset + reseed data**
   ```bash
   set -a && . .env.qc-test && set +a
   npm run db:reset-qc && npm run db:seed-qc
   ```
   The `qc-guard` inside those scripts refuses to run unless BOTH
   `APP_ENV=qc-test` AND `DATABASE_URI` hostname is NOT in the hardcoded
   staging/prod denylist (`ep-blue-king-a1qufqjg` etc.). You cannot
   accidentally wipe staging even with a stale env in your shell.
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
   - **Preflight tripwire** — `DATABASE_URI points at staging endpoint` →
     branch-filter env var override missing on Vercel. Fix: Dashboard →
     Environment Variables → add `DATABASE_URI` with scope Preview +
     branch=qc-test pointing to Neon QC connection string
   - **Preflight — Postgres reachable** — Neon DB paused / quota exhausted
   - **`vercel pull` returns empty DATABASE_URI** — env var was added with
     `--sensitive` flag which breaks CLI pull. Remove + re-add without
     `--sensitive`
   - **Payload query fails with "relation X does not exist"** — DATABASE_URI
     points at pooler endpoint (`-pooler` suffix). Switch to direct endpoint
     (see `jmeter-qc-env.md` § "Neon endpoint gotcha")
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

## Test cases (TC-ID registry)

QC-scoped tests. Keep this table in sync when adding new QC-only test files.

| TC-ID | Scenario | Test file |
|-------|----------|-----------|
| TC-QC-OTP-01 | OTP bypass refused when `APP_ENV=production` even if other bypass vars set | `src/__tests__/unit/otp/qc-bypass-guard.test.ts` |
| TC-QC-OTP-02 | OTP bypass requires literal `QC_OTP_BYPASS_ENABLED="true"` — refuses unset / `false` / `1` | `src/__tests__/unit/otp/qc-bypass-guard.test.ts` |
| TC-QC-OTP-03 | OTP bypass restricted to `QC_OTP_BYPASS_DOMAIN` email suffix — rejects real-customer domains | `src/__tests__/unit/otp/qc-bypass-guard.test.ts` |
| TC-QC-OTP-04 | `isValidQcBypass()` accepts matching code for allowed domain, rejects mismatched code / disallowed domain | `src/__tests__/unit/otp/qc-bypass-guard.test.ts` |

## Files referenced

- `scripts/qc-guard.ts` — safety guard
- `scripts/seed-qc-data.ts` — populate dummy fixtures
- `scripts/qc-seed-products.ts` — product + extra-page helpers used by main seed
- `scripts/reset-qc-data.ts` — wipe tenant data
- `src/lib/otp/qc-bypass.ts` — triple-guarded OTP bypass helper
- `src/__tests__/unit/otp/qc-bypass-guard.test.ts` — 18 tests covering TC-QC-OTP-01→04
- `.env.qc-test.example` — env template
- `.jmx-config/qc-test.properties.example` — JMeter template
- `.github/workflows/ci.yml` — `Deploy: Vercel (qc-test)` job
- `.github/branch-protection.md` — branch push rules

## 300 VU load test handover (2026-07-15)

Snapshot handover cho QA lead sau khi scale seed hoàn tất. Cập nhật khi
cấu hình thay đổi (rotate password, thêm tenants, đổi domain).

### Environment

| Item | Value |
|------|-------|
| Domain | `https://ech-prime-web-v2-qc.vercel.app` |
| Firewall bypass | IP `115.79.143.204` (System Bypass rule, scope QC domain) |
| Rate limit bypass | `QC_RATELIMIT_BYPASS_ENABLED=true` — single-IP không bị throttle |
| Password login endpoint | `POST /api/users/login` — Payload local strategy |
| OTP login endpoint | `POST /api/users/send-otp` → `POST /api/users/verify-otp` |

### Credentials (lấy từ Vercel Env, không paste chat)

- `QC_SEED_PASSWORD` — dùng cho login mọi user seed
- `QC_OTP_BYPASS_CODE` — code cố định cho OTP flow, chỉ nhận email `@primeweb.local`

Reveal: Vercel Dashboard → Project → Settings → Environment Variables → scope `Preview qc-test`.

### Data ranges

| Range | Content level | Test scope |
|-------|--------------|------------|
| `qc-shop-1..10` | Full CMS: payment COD + shipping enabled + 3 customers + 5 orders (mix status) + 2 discount codes | Functional CMS end-to-end: checkout, order fulfillment, discount redeem |
| `qc-shop-11..300` | Site + home + 2 extra pages + ~8 products | Storefront render, CRUD API load, list/detail paths |

Owners: `qc-owner-1@primeweb.local` → `qc-owner-300@primeweb.local`.
Admins: `qc-admin-1..2@primeweb.local`. Staff: `qc-staff-1..3@primeweb.local`.

### Suggested test plan

1. Functional CMS (Ary, manual):
   - Login `qc-owner-1..10` → verify admin có full data setup
   - Flow: storefront checkout COD → admin approve → mark shipped → completed
   - Test discount code `QC{N}PCT10` (10% off), `QC{N}FIX50` (RM 50 off) với N = 1..10

2. 300 VU load (JMeter):
   - Round-robin login `qc-owner-1..300` với `QC_SEED_PASSWORD`, loại
     `qc-owner-5` khỏi VU pool vì account này dành cho suspended-state testing
   - Products sampler dùng `GET /api/dashboard/products`; không dùng Payload native
     `/api/products` vì response/query contract khác Products Dashboard; không truyền
     `depth` vì endpoint canonical đã cố định `depth=1`
   - Dừng batch nếu QC reset/seed trả exit code khác 0 hoặc deployment log không xác nhận
     đủ 8 GH-1432 product indexes
   - Mix workload: 40% list / 30% detail read / 20% create / 10% update
   - 5 min soak per run, xuất report capacity

3. Bug report format:
   - Screenshot response header (`x-vercel-id`, `x-vercel-mitigated`, status)
   - Repro steps + expected vs actual
   - Gửi dev channel — Vercel runtime logs realtime available

### Reseed / rotate

- `npm run qc:seed-scaled` — idempotent, resume nếu dừng giữa chừng
- `npm run qc:reset` + `qc:seed-scaled` — full wipe + reseed (dùng khi rotate `QC_SEED_PASSWORD`)
- `npm run qc:seed-functional` — refresh 10 tenants đầu (functional data)

## Related

- [JMeter QC env doc](./jmeter-qc-env.md)
- [Vercel deploy rule](../../.claude/rules/vercel-deploy.md)
- [Env vars rule](../../.claude/rules/env-vars.md)
- [Open blockers](../tracking/OPEN_BLOCKERS.md)
