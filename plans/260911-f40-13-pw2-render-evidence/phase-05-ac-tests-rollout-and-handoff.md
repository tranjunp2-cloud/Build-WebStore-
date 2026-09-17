# Phase 05 — Tests, staged proof và handoff

## Mục tiêu

Prove every issue case against deterministic fixtures and document boundaries so QA cannot certify a store on inference.

## File targets

- **New:** `src/__tests__/unit/qa/f40-migration-render-evidence.test.ts`.
- **New:** `src/__tests__/api/f40-migration-render-evidence.test.ts`.
- **New:** `tests/f40-migration-render-evidence.spec.ts`.
- **Modify:** `docs/qa/F40-qa-control-center.md` — TC table and fixture/runbook.
- **Modify:** `docs/stories/F40-qa-control-center-stories.md` only if story index needs #1838/US-F40-13 trace.

## Test matrix

| TC-ID | Level | Case |
| --- | --- | --- |
| TC-F40-13-01 | Unit | exact `legacy_id` mapping resolves one actual PW2 block; missing/ambiguous is unverified. |
| TC-F40-13-02 | Unit | all truth-table combinations fail closed; only three green layers pass overall. |
| TC-F40-13-03 | Unit | actual block + registry component supported/unsupported/unverified rules. |
| TC-F40-13-04 | E2E | Case B renders PW2 orange placeholder and asserts absent fake preview/content. |
| TC-F40-13-05 | Unit/component | Case A/C/D statuses and prohibited `KHỚP 100%` behavior. |
| TC-F40-13-06 | E2E | accordion toggle, safe evidence, desktop + 375px layout. |
| TC-F40-13-07 | API | unauth/invalid query/body blocked; sanitizer omits secret/PII. |
| TC-F40-13-08 | API/Unit | live runner outcome/timestamp/ref; unavailable or timeout remains unverified. |

## Verification steps

1. Read `docs/TEST_CONVENTION.md`; tests use TC-ID, real imports, AAA, top-level mocks only.
2. Run focused Vitest unit/API suites, `npm run typecheck`, lint/project test commands, and `git diff --check`.
3. Run Playwright auth-boundary test unconditionally; run full Super Admin browser fixture only with QC-only credentials/mapping fixture. Never run against production or customer data.
4. Manually verify one Case A–D on staging with a test tenant: capture only safe evidence link/metadata, test 375px, and demonstrate unavailable live runner remains gray.
5. Review database schema changes, environment additions and PR body. If any collection changed, verify matching non-destructive `scripts/db-setup.js` migration; PR body uses `Relates to #1838` only.

## Rollout / rollback

- Release behind a server-owned capability flag/config only if no mapping contract exists; default view remains unverified and read-only.
- Roll back by disabling the evidence provider/UI entry, not deleting mappings/evidence. No automated migration writes occur in this ticket.

## Definition of done

- All AC cases and test notes have passing automated evidence plus staging proof where dependencies exist.
- QA handoff states mapping version, registry revision, live evidence time and known unverified limits.
