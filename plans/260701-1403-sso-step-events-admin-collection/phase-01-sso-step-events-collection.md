# Phase 01 — Create & Register Read-Only `sso-step-events` Collection

## Context links

- Plan overview: [plan.md](plan.md)
- Precedent (read-only log): `src/collections/AiUsageLogs.ts`
- Precedent (`group: 'System'`): `src/collections/SEOMetaJobs.ts`
- Precedent (slug hyphen→table underscore): `src/collections/PlanSubscriptionUsages.ts`
- Write paths (DO NOT TOUCH): `src/lib/sso/sso-api-client.ts:59-73`,
  `src/app/api/cron/process-sso-steps/route.ts:62-80`
- Table def: `scripts/db-setup.js:4794-4813`
- Rule: `.claude/rules/database-schema.md` (COLLECTION_SLUGS + rels sync required)

## Overview

- **Priority:** P2
- **Status:** complete
- **Description:** Add a read-only Payload collection over the existing
  `sso_step_events` table. Observability only for QC/PM on staging.

## Key insights

- **No migration.** Table + indexes already exist. Adding a `MIGRATIONS` entry would
  be redundant (CREATE TABLE IF NOT EXISTS no-ops) — skip it (YAGNI).
- **drizzle push hazard (local dev only).** `payload.config.ts:76-82`
  `push: shouldPushSchema()` enables `push: true` when `NODE_ENV=development`.
  drizzle-kit diffs the collection's implied schema vs the real table. Field types
  MUST match the real columns or drizzle will attempt an unwanted ALTER on this
  shared table locally. Mapping to honor exactly:

  | Real column | Type / constraint | Collection field | Field config |
  |-------------|-------------------|------------------|--------------|
  | `user_id` | `integer NOT NULL` | `user` | `relationship` → `users`, `required: true` |
  | `step` | `integer NOT NULL` | `step` | `number`, `required: true` |
  | `status` | `varchar NOT NULL DEFAULT 'pending'` | `status` | `select`, `required: true`, `defaultValue: 'pending'`, 4 options |
  | `retry_count` | `integer NOT NULL DEFAULT 0` | `retryCount` | `number`, `required: true`, `defaultValue: 0` |
  | `last_error` | `text` (nullable) | `lastError` | `textarea`/`text`, optional |
  | `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | — | `timestamps: true` |

  Note `user` relationship maps to `user_id` column (Payload convention) — matches the
  real `user_id`. `retryCount` field → drizzle column `retry_count` (camel→snake). Good.

- **Access:** read gated to `super-admin`; create/update/delete `() => false`. Even
  though delete could be allowed, keep it `false` — this is an append-only queue table
  and deleting rows would corrupt cron retry state.

## Requirements

**Functional**
- Super-admin can list/filter `sso_step_events` rows in `/admin` under group `System`.
- Default columns show user, step, status, retryCount, lastError, updatedAt.
- Non-super-admin: access denied (collection hidden / 403).

**Non-functional**
- Zero write-path change. Zero new migration. Compiles clean. No local drizzle ALTER.

## Architecture / data flow

```
Write (unchanged):
  shipping-config PATCH ──▶ notifyStepComplete ──(SSO Hub PATCH, 10s timeout)
                                   │ fail
                                   ▼
                          persistStepEvent (raw SQL INSERT) ──▶ sso_step_events
  cron process-sso-steps (raw SQL UPDATE retry_count/status) ──▶ sso_step_events

Read (new, this phase):
  super-admin ──▶ /admin/collections/sso-step-events ──▶ Payload REST/local API
                                                          ──▶ SELECT sso_step_events
```

New collection is a read-only lens over the same table — no new state, no new writer.

## Related code files

**Create**
- `src/collections/SsoStepEvents.ts` — the `CollectionConfig` (below).

**Modify**
- `src/payload.config.ts` — add `import { SsoStepEvents } from './collections/SsoStepEvents'`
  (near line 43, after `DiscountUsageHistory` import) and add `SsoStepEvents,` to the
  `collections: [...]` array (near line 156, after `DiscountUsageHistory`).
- `scripts/db-setup.js` — add `'sso-step-events',` to `COLLECTION_SLUGS` (~line 4876,
  after `'discount_usage_history'`). REQUIRED so `syncPayloadRelsTables()` adds
  `sso_step_events_id` FK columns to `payload_locked_documents_rels` +
  `payload_preferences_rels`.
- `scripts/check-migrations.js` — (optional, nice-to-have) add
  `'SsoStepEvents.ts': 'sso_step_events',` to `TRACKED_COLLECTIONS` (~line 69) so future
  field additions get CI-gated. Drop for minimal diff if preferred.

**Delete:** none.

## Implementation steps

1. Create `src/collections/SsoStepEvents.ts`:
   - `slug: 'sso-step-events'` (no `dbName` — auto-maps to `sso_step_events`).
   - Doc-comment: purpose (QC/PM observability), write path is raw SQL in
     `sso-api-client.ts` + `process-sso-steps/route.ts` (NOT the admin API), and step
     legend **1 = Pick Template, 2 = Setup Shipping, 3 = Add Product**.
   - `access`: `read: ({ req }) => req.user?.roles?.includes('super-admin') || false`;
     `create/update/delete: () => false`.
   - `admin`: `group: 'System'`, `useAsTitle` (e.g. `status` or omit),
     `defaultColumns: ['user', 'step', 'status', 'retryCount', 'lastError', 'updatedAt']`,
     a `description`.
   - `fields` per the mapping table above. `status` options:
     `pending | processing | completed | failed`.
   - `timestamps: true`.
2. Register in `src/payload.config.ts` (import + array entry near `DiscountUsageHistory`).
3. Add slug to `COLLECTION_SLUGS` in `scripts/db-setup.js`.
4. (Optional) Add to `TRACKED_COLLECTIONS` in `scripts/check-migrations.js`.
5. Compile check (see Success criteria).

## Todo list

- [x] Create `src/collections/SsoStepEvents.ts` (read-only, fields match real columns)
- [x] Import + register in `src/payload.config.ts`
- [x] Add `'sso-step-events'` to `COLLECTION_SLUGS` in `scripts/db-setup.js`
- [x] (Optional, reverted) `TRACKED_COLLECTIONS` in `scripts/check-migrations.js` — added then
  removed after adversarial review found it makes `check-migrations.js` diff-check misdetect
  this collection's 7 fields as "missing migrations" (the check only recognizes `ALTER TABLE
  ADD COLUMN` migrations, not the `CREATE TABLE` this collection actually uses) — CI-blocking
  false positive. Left out; schema is fully covered by the existing `CREATE TABLE IF NOT
  EXISTS sso_step_events` migration.
- [x] `npm run build` / tsc — zero new errors
- [x] `node scripts/check-migrations.js origin/staging` — no missing migrations
- [ ] (Optional manual) super-admin sees rows; non-super-admin denied; no local drizzle ALTER

## Success criteria (definition of done)

- Collection appears in `/admin` under `System`, read-only, super-admin only.
- Build compiles; check-migrations passes.
- No diff to any write path or cron file.
- Field types exactly match real columns (no drizzle ALTER attempt in local dev).

## Test matrix

| Level | What | Gate? |
|-------|------|-------|
| Compile | `npm run build` / tsc | Yes |
| Migration | `check-migrations.js origin/staging` | Yes |
| Manual smoke | super-admin list + non-super-admin denied (local) | No (optional) |
| Unit/e2e | none — no new business logic (read-only passthrough) | N/A per `.claude/rules/testing.md` judgment |

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Field types mismatch → drizzle ALTERs shared table in local dev | Med | High | Match mapping table exactly; verify no ALTER logged on local `next dev` startup |
| Forget `COLLECTION_SLUGS` → missing rels FK cols → Payload admin errors on the collection | Med | High | Explicit step 3; `.claude/rules/database-schema.md` mandates it |
| Someone edits/deletes a row via admin, corrupting cron retry state | Low | High | `create/update/delete: () => false` — read-only enforced |
| Slug→table mismatch (needs `dbName`) | Low | Med | Precedent `plan-subscription-usages` confirms auto-map; no `dbName` |
| Non-super-admin sees sensitive user data | Low | Med | `read` gated to `super-admin` only |

## Rollback plan

Fully reversible, no data migration: revert the 3–4 file edits (remove collection file,
remove import + array entry, remove `COLLECTION_SLUGS` entry, remove optional
`TRACKED_COLLECTIONS` entry). Underlying `sso_step_events` table untouched throughout —
nothing to un-migrate. The auto-added `sso_step_events_id` rels columns are harmless if
left (nullable, unused) but drop via revert path re-run of db-setup is not needed.

## Security considerations

- Read access limited to `super-admin` role (matches `AiUsageLogs` precedent — this data
  includes `user_id` and error strings that may be operationally sensitive).
- No mutation surface exposed (all writes `() => false`).
- `lastError` is a stored `text` from SSO API failures — display only; no injection risk
  in admin render.

## Next steps / follow-ups

- Open decision: root-cause retry/timeout fix (raise `MAX_RETRIES`, manual
  `failed`→`pending` reset, raise `SSO_FETCH_TIMEOUT_MS`, alert on `failed` rows) — OUT
  OF SCOPE here, flag to user.
- After merge: docs impact minor — optionally note the new System collection in
  `docs/CODEBASE_SUMMARY.md`. Not blocking.
