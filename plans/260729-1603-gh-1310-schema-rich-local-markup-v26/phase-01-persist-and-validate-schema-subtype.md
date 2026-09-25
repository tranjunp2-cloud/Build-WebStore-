# Phase 01 — Persist and Validate Schema Subtype

**Status:** Completed for implementation and automated verification, including semantic reconciliation with #1708 from staging.

## Objective

Add one compatible `localBusiness.schemaSubtype` through the data, validation, hydration, and Editor paths, using one versioned mapping and an atomic category/subtype save.

## Requirements

- `businessCategory` is broad UI data; `schemaSubtype` is optional and single-valued.
- Empty subtype is valid. Non-empty subtype requires a category and membership in its allowed list.
- Before category selection the subtype select is disabled. One allowed option auto-selects; multiple options require explicit selection.
- Category changes preserve compatible subtype, otherwise auto-select the sole new option or clear.
- Every write path validates the effective `originalDoc + incoming patch`; direct invalid payloads are rejected before write and the previous valid pair remains.
- Sole-option auto-selection occurs only after a seller changes/selects the category. A legacy row with category but null subtype hydrates as unselected, remains generic, and is never mutated on mount.
- Collection schema and SQL migration are one P0 change set.

## Architecture

```text
local-business-constants.ts (versioned map + pure helpers)
   ├─ Sites select options/validation
   ├─ saveSiteSchema superRefine
   └─ SettingsPanel reconciliation ── one merged localBusiness patch
```

## Related files and actions

- `./src/lib/seo/local-business-constants.ts` — add snapshot version, typed category→subtype map, union options, `getCompatibleSchemaSubtypes`, `isCompatibleSchemaSubtype`, and pure preserve/auto-select/clear reconciliation.
- `./src/collections/Sites.ts:378` — insert `schemaSubtype` select after `businessCategory`; reuse the shared option union. Extend the collection validation/hook to validate effective state using `originalDoc + data` for Admin, REST, GraphQL, Local API, hooks, and seeds without weakening the opening-hours hook at `:390`.
- `./scripts/db-setup.js:259` — add `{ name: 'sites.local_business_schema_subtype', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_schema_subtype varchar;' }`; do not touch the compliant array table at `:452`.
- `./src/lib/validations/sites.ts:45` — add optional subtype union and `.superRefine()` pair check. The authorized save path must unconditionally load the tenant-owned existing site, deep-merge defined group semantics, validate the complete resulting pair, and persist that validated group.
- `./src/components/editor/local-business/types.ts:2` — add nullable/optional subtype matching Zod/Payload.
- `./src/components/editor/SettingsPanel.tsx:491` and `:814` — render subtype directly below category and save category plus reconciled subtype in one `handleLocalBusinessChange` call.
- `./src/app/(editor)/editor/[siteId]/page.tsx:749` — verify parent merge/rollback propagates the full pair; preserve #1708 mutex semantics.
- `./src/app/api/sites/[siteId]/save/route.ts:140` — no new route; verify parse/auth/tenant checks precede `payload.update`, and rejected data produces zero writes.
- `./src/i18n/locales/en.json` and `./src/i18n/locales/ms.json` — subtype label, placeholder, disabled hint, and validation feedback.
- `./src/components/editor/local-business/completion-checklist.tsx` — keep broad category completion separate; do not silently require or award subtype here.

## Test files and TC ownership

- `src/__tests__/unit/seo/local-business-constants.test.ts` — TC-F37-02-29/30 mapping, disabled inputs, sole-option auto-selection, multi-option explicit selection, preserve/clear determinism.
- `src/__tests__/unit/editor/settings-panel.test.tsx` — TC-F37-02-29/30 UI state and exactly one atomic save patch; 375px accessibility/label behavior.
- `src/__tests__/unit/validations/sites-local-business.test.ts` — TC-F37-02-31 valid, empty, no-category, and incompatible pairs.
- `src/__tests__/api/sites.test.ts` — TC-F37-02-31 direct invalid request, correct status/error, zero `payload.update`, prior data unchanged.
- Direct Payload Local API/collection tests — category-only, subtype-only, null-clear, full-pair, and admin/server partial writes all enforce the same effective-state invariant.
- Existing migration checks under `src/__tests__/unit/scripts/` and `src/__tests__/unit/migration/` — prove the new group column exists in additive setup SQL.

Follow `docs/TEST_CONVENTION.md`: registered TC IDs, AAA comments, top-level `vi.mock`, source imports, cleanup.

## Todos

- [x] Implement and review the versioned mapping and pure reconciliation helpers.
- [x] Add Payload field and exact idempotent SQL column together.
- [x] Add Zod/Payload save-boundary compatibility validation.
- [x] Propagate type, hydration, translations, Editor select, atomic save, and rollback.
- [x] Implement TC-F37-02-29..31 and migration drift tests.
- [x] Execute the #1708 overlap checklist after it lands: preserve the per-site revisioned/coalescing serializer and integrate persisted-snapshot rollback.
- [x] Cover legacy hydration and revision-aware LocalBusiness saves; TC-F37-02-47 verifies final-batch rollback and preservation of a newer queued revision.

Current state:

- Legacy null-subtype hydration, persisted-snapshot rollback, same-site coalescing, cross-site isolation, and newer-revision preservation are covered after the #1708 staging sync.

## Verification

- Scoped unit/API tests, `npm run typecheck`, migration checker, lint for touched files, and `git diff --check`.
- Manual 375px and desktop verification: keyboard label, disabled explanation, filtered options, auto-select, preserve/clear, pending/error rollback.

## Exit criteria

- Existing rows migrate safely with null subtype.
- UI and direct requests cannot persist an incompatible pair.
- A rejected save keeps the prior pair and emits no analytics success event.
- No new environment variable, route, page, array table, or destructive SQL is introduced.

## Risks and security

- UI filtering is not authorization/validation; the server and emission layer must revalidate.
- Competing category/subtype saves use one merged patch and the LocalBusiness-only request queue.
- Rollback restores the last persisted snapshot only when the failed batch is still the latest revision; a newer optimistic revision remains queued and is persisted next. Server-wide multi-tab optimistic concurrency remains outside US02.
- Tenant isolation/auth/rate-limit behavior in the existing route must remain unchanged.
- Mapping helpers must be pure and dependency-free to avoid client bundle/runtime fetch issues.
- Do not persist a mapping-version field in this story. Freeze v2.6 and require an explicit compatibility/migration decision before removing a previously allowed subtype.
