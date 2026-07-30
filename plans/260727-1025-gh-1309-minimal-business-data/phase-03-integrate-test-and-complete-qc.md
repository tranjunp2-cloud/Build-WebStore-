# Phase 3 — Pre-integration QC (Provisional)

## Goal

Complete #1309 verification without changing the legacy top-level score formula owned by #1312.

Effort: 4h. Status: Browser spec passes locally (3/3 including auth setup); live staging execution pending.

The additive persisted 7/8/5 runtime contract is implemented; final browser acceptance still requires the manual live-staging run.

## Current Scope

```text
US-F37-01 pre-integration QC
├─ Playwright local execution
│  └─ auth setup + TC-F37-01-26/27 pass against the reserved local account
├─ pure Business contract
│  ├─ complete fields → 20
│  ├─ name + phone → 12
│  └─ one address part missing → address 0
├─ persisted score API
│  └─ additive 20/12 + 401/403; legacy top-level formula unchanged
├─ editor persistence
│  └─ each field → await successful PATCH → next field → reload → same values
├─ invalid phone
│  └─ feedback + immediate revert + no PATCH
├─ side-effect isolation
│  ├─ every touched snapshot field restored and raw-verified
│  └─ analytics request intercepted, no analytics row written
└─ viewport 375px
   └─ fields usable with no horizontal overflow
```

## Changes

| File | Change |
|---|---|
| `src/app/api/sites/[siteId]/local-seo-score/route.ts` | Expose additive persisted `minimalBusinessData` without changing the legacy total |
| `src/__tests__/api/local-seo-score.test.ts` | Cover exact 20, partial 12, 401/403, and legacy-score separation |
| `e2e/f37-minimal-business-data.spec.ts` | Add editor persistence, invalid-phone, runtime 20, safe fixture restoration, and 375px coverage |
| `docs/qa/F37-local-seo.md` | Record API evidence, fixture precondition, and the #1309/#1312 boundary |

The spec is intentionally excluded from the default `e2e-staging` workflow and must be invoked manually while the authenticated test account is reserved exclusively for that run.

## Browser Test Guardrails

1. Resolve sites through the authenticated, tenant-filtered Payload API and require exactly one result. Never silently select the first site when the account has zero or multiple sites, and do not run another browser/spec against that account concurrently.
2. Require the sole reserved fixture to have empty `openingHours`; fail before mutation so F37-01 address saves cannot rewrite F37-02 array-row metadata.
3. Snapshot original `name`, touched contact phone, full `localBusiness`, and raw `pendingHeaderBlock` through tenant-protected APIs. Normalize absent touched fields to explicit `null`, fail before mutation unless the save schema preserves that snapshot exactly, and track the exact state written by each confirmed test save.
4. Before teardown, fetch the raw site and restore only when every tracked field still matches this run's expected state; otherwise fail closed instead of overwriting concurrent edits. After a safe restore, fetch the raw site and verify every touched field exactly. This test-only guard is not atomic CAS, so exclusive use of the fixture account remains a run precondition.
5. Intercept `POST /api/analytics/track` and return a success response during this E2E. Local Business saves emit `local_business_data_saved`; analytics persistence is outside this test and must not pollute the fixture tenant.
6. Perform name, structured address, and phone edits sequentially. Wait for each exact successful PATCH before starting the next edit. Contact writes are sparse and commit only after success, but the browser flow must still prove persisted ordering across the complete seller flow.
7. Save a valid phone, reload, and confirm it before trying an invalid value.
8. Assert invalid blur produces no PATCH, shows feedback, and immediately restores the confirmed phone. Observe a bounded no-request window before reload, then reload to end the old document lifecycle and verify persisted state.
9. Use stable `data-testid` selectors, not translated text or CSS classes.
10. Wait for observable network/state completion, never arbitrary sleeps.

## Verification

```bash
npm test -- src/__tests__/api/local-seo-score.test.ts src/__tests__/unit/seo/local-seo-score.test.ts
npm test -- src/__tests__/unit/lib/validations/misc-validations.test.ts
npm test -- src/__tests__/unit/editor/settings-panel.test.tsx
npm test -- src/__tests__/unit/editor/publish-flow.test.tsx
npm run typecheck
npx playwright test --list
BASE_URL=https://web-v2.dev.ecommercehub.my npm run test:e2e -- e2e/f37-minimal-business-data.spec.ts
```

## Failure Modes

| Failure | Detection / response |
|---|---|
| Spec exists but runner ignores it | `--list` must show the new TC IDs; zero tests fails this phase |
| Invalid input remains visible | Immediate Playwright value assertion fails |
| Invalid blur sends a save | Await a bounded matching-request timeout before reload; any matching PATCH fails the scenario |
| Reload happens before save completes | Wait for the exact PATCH response before reload |
| Another browser/run edits the site during this test | Compare the raw site with this run's tracked expected state and refuse to restore on any mismatch |
| The authenticated account's sole site remains mutated | After a safe compare, teardown restores and raw-verifies every touched original value, including explicit `null` |
| Missing fixture hides coverage | Fail with an actionable environment message; no blanket skip |
| Name cleanup leaves changed navigation text | Snapshot and restore raw `pendingHeaderBlock` with `siteName` |
| Local Business saves pollute analytics | Intercept the fire-and-forget analytics endpoint during the E2E |
| Opening-hours row metadata would be rewritten | Fail before mutation unless the reserved fixture has empty `openingHours` |
| Rapid saves overwrite a previous field | Await every PATCH before starting the next field edit |

## Provisional Exit Criteria

- [x] Pure Business 7/8/5 tests pass (completed in Phase 1: 15/15 score-suite tests passed).
- [x] Persisted API regressions prove Business 20/12, 401/403, and unchanged legacy Business = 35 (19/19 with helper suite).
- [x] Client/server phone validation plus sparse transactional contact component/integration tests pass (completed in Phase 2; included in 107/107 targeted validation and regression tests).
- [x] Editor values persist after a confirmed save and reload in the local browser run.
- [x] Invalid phone reports, reverts, and sends no PATCH in the local browser run.
- [x] Every touched field on the local authenticated test account's sole site is restored and raw-verified, including explicit `null` for originally absent values, and no analytics row is created.
- [x] 375px flow is usable without horizontal overflow in the local browser run.
- [x] Playwright discovery lists TC-F37-01-26 and TC-F37-01-27 from `e2e/f37-minimal-business-data.spec.ts`.
- [ ] Both scenarios pass against the authenticated test account's sole live staging site.
- [x] QA document marks this evidence as pre-integration only.
- [x] Typecheck passes and there is no schema/migration diff.

## Deferred Until #1312

#1312 owns only the adjacent global score/UI work:

- Atomic `20/35/15/30` top-level engine and full total 100.
- Seller-facing dashboard, checklist, and deep links.

#1309 completion does not depend on that cutover; it depends on the manual live-staging browser gate above.
