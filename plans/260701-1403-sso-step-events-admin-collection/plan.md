---
title: "SSO Step Events — read-only admin collection"
description: "Expose existing sso_step_events raw-SQL table in Payload /admin so QC/PM can inspect SSO step-sync status on staging."
status: complete
priority: P2
effort: 1h
branch: feat/sso-step-events-admin-view
tags: [sso, payload, admin, observability, read-only]
created: 2026-07-01
---

# SSO Step Events — Read-Only Admin Collection

## Goal

Give QC (@Mr-LeeB) / PM `/admin` visibility into the existing `sso_step_events`
retry-queue table on staging. They have no direct DB access. Pure observability —
**no** change to the raw-SQL write paths, **no** new migration (table + columns
already exist since GH-1293).

## Why now (root cause context — NOT fixed here)

SSO Hub onboarding step-2 ("Setup Shipping") counter fails to tick for some users.
`notifyStepComplete` → SSO Hub PATCH times out (10s `SSO_FETCH_TIMEOUT_MS`) →
`pending` row queued in `sso_step_events` → cron retries 5× → `failed` permanently.
This plan only surfaces those rows for inspection. The retry-exhaustion fix is an
open follow-up (see Unresolved Questions).

## Scope

- **In:** 1 new read-only `CollectionConfig`, register it, wire its rels FK columns.
- **Out:** any write-path change, root-cause retry fix, new automated tests, cron edits.

## Phases

| # | Phase | Status | Effort | Blockers |
|---|-------|--------|--------|----------|
| 01 | [Create & register read-only collection](phase-01-sso-step-events-collection.md) | complete | 1h | none |

Single phase — all edits are tightly coupled (collection + 2 registration touch-points)
and must ship atomically per `.claude/rules/orchestration.md` (schema-adjacent files).

## Key dependencies / facts (verified 2026-07-01)

- Table `sso_step_events` exists — `scripts/db-setup.js:4794-4813`. No new migration.
- Slug `'sso-step-events'` → table `sso_step_events` automatically (Payload Postgres
  adapter hyphen→underscore; precedent `plan-subscription-usages`). No `dbName`.
- Write paths untouched: `src/lib/sso/sso-api-client.ts:59-73` (persistStepEvent),
  `src/app/api/cron/process-sso-steps/route.ts:62-80`.
- Precedents: `src/collections/AiUsageLogs.ts` (read-only log collection, super-admin
  gate, create/update/delete `() => false`), `src/collections/SEOMetaJobs.ts` (`group: 'System'`).

## Success criteria (observable)

1. `npm run build` (or `tsc`) compiles with zero new errors.
2. `node scripts/check-migrations.js origin/staging` → no missing migrations.
3. Local: super-admin sees rows at `/admin/collections/sso-step-events`; non-super-admin
   gets access denied. (Optional manual smoke — not a CI gate; read-only scaffolding.)
4. drizzle `push` (local dev) does NOT attempt any ALTER on `sso_step_events`
   (field types must match real columns exactly).

## Branching

Unrelated to current branch `fix/shipping-fee-stripe-xendit`. Cut a separate branch
`feat/sso-step-events-admin-view` off `staging`; own PR. Do NOT bundle into shipping-fee PR.
Per `.claude/rules/git-flow.md`: PR to `staging`, `Relates to #<issue>`, conventional title.

## Unresolved questions

- **Root-cause retry/timeout fix is OUT OF SCOPE.** Decide separately: raise
  `MAX_RETRIES`, add a manual `failed`→`pending` reset action, raise
  `SSO_FETCH_TIMEOUT_MS`, and/or alert on `status='failed'` rows. Flag to user.

## Validation Summary

**Validated:** 2026-07-01
**Questions asked:** 4

### Confirmed Decisions
- **Access role:** User's `/admin` staging account is super-admin — `read` gated to
  `super-admin` only is correct as planned, no access-model change needed.
- **Branching:** Cut separate branch `feat/sso-step-events-admin-view` off `staging`,
  own PR — do not bundle into `fix/shipping-fee-stripe-xendit`.
- **CI tracking:** Add `'SsoStepEvents.ts': 'sso_step_events'` to `TRACKED_COLLECTIONS`
  in `scripts/check-migrations.js` (kept in plan, not dropped).
- **GH issue reference:** PR uses `Relates to #GH-1293` (original SSO step-status sync
  issue this collection gives observability into).

### Action Items
- [ ] None — all 4 decisions confirm the plan as written. Proceed to implementation.
