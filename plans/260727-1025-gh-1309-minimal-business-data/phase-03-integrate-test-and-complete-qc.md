# Phase 3 — Pre-integration QC (Provisional)

## Goal

Complete every #1309 verification that is independent of the #1312 runtime score cutover. This phase may run immediately after Phases 1 and 2.

Effort: 4h. Status: Pending.

This is intentionally not final acceptance for AC1/AC2 scoring. Update this phase when #1312 implementation begins.

## Current Scope

```text
US-F37-01 pre-integration QC
├─ Playwright discovery
│  ├─ existing e2e suite remains unchanged
│  └─ F37 tests/*.spec.ts is listed and runnable
├─ pure Business contract
│  ├─ complete fields → 20
│  ├─ name + phone → 12
│  └─ one address part missing → address 0
├─ editor persistence
│  └─ each field → await successful PATCH → next field → reload → same values
├─ invalid phone
│  └─ feedback + immediate revert + no PATCH
├─ side-effect isolation
│  ├─ name/header snapshot restored
│  └─ analytics request intercepted, no analytics row written
└─ viewport 375px
   └─ fields usable with no horizontal overflow
```

## Changes

| File | Change |
|---|---|
| `playwright.config.ts` | Add an authenticated project with `testDir: './tests'`, `testMatch` limited to the F37 spec, and dependency on the existing auth setup; do not activate unrelated dormant specs |
| `tests/f37-minimal-business-data.spec.ts` | Add editor persistence, invalid-phone, and 375px coverage |
| `docs/qa/F37-local-seo.md` | Finalize the provisional automated mappings and clearly mark runtime score/API evidence as deferred |

## Browser Test Guardrails

1. Require a dedicated, tenant-owned `E2E_SITE_ID`; never fall back to the first seller site. Fail clearly if it is missing instead of silently skipping the AC flow.
2. Require the fixture to contain schema-valid Local Business/opening-hours data so the existing save sanitizer cannot irreversibly normalize unrelated legacy rows.
3. Snapshot original `name`, `contactInfo`, `localBusiness`, and the effective pending header block. Restoring only `name` is insufficient because name saves also update `pendingHeaderBlock.logoText`.
4. Restore the snapshot through the authenticated save API in teardown, including `siteName` and `headerBlock`, even when an assertion fails; verify the cleanup response.
5. Intercept `POST /api/analytics/track` and return a success response during this E2E. Local Business saves emit `local_business_data_saved`; analytics persistence is outside this test and must not pollute the fixture tenant.
6. Perform name, structured address, and phone edits sequentially. Wait for each exact successful PATCH before starting the next edit. Contact writes are sparse and commit only after success, but the browser flow must still prove persisted ordering across the complete seller flow.
7. Save a valid phone, reload, and confirm it before trying an invalid value.
8. Assert invalid blur produces no PATCH, shows feedback, and immediately restores the confirmed phone.
9. Use stable selectors added in `SettingsPanel.tsx`, not translated text or CSS classes.
10. Wait for observable network/state completion, never arbitrary sleeps.

## Verification

```bash
npm test -- src/__tests__/unit/seo/local-seo-score.test.ts
npm test -- src/__tests__/unit/lib/validations/misc-validations.test.ts
npm test -- src/__tests__/unit/editor/settings-panel.test.tsx
npm test -- src/__tests__/unit/editor/publish-flow.test.tsx
npm run typecheck
npx playwright test --list
npm run test:e2e -- tests/f37-minimal-business-data.spec.ts
```

## Failure Modes

| Failure | Detection / response |
|---|---|
| Spec exists but runner ignores it | `--list` must show the new TC IDs; zero tests fails this phase |
| Invalid input remains visible | Immediate Playwright value assertion fails |
| Invalid blur sends a save | Assert no matching PATCH occurs |
| Reload happens before save completes | Wait for the exact PATCH response before reload |
| Shared site remains mutated | Teardown restores the captured original values |
| Missing fixture hides coverage | Fail with an actionable environment message; no blanket skip |
| Name cleanup leaves changed navigation text | Snapshot and restore the effective pending header block with `siteName` |
| Local Business saves pollute analytics | Intercept the fire-and-forget analytics endpoint during the E2E |
| Legacy opening-hours rows are normalized | Use only a dedicated schema-valid fixture; never select an arbitrary seller site |
| Rapid saves overwrite a previous field | Await every PATCH before starting the next field edit |

## Provisional Exit Criteria

- [x] Pure Business 7/8/5 tests pass (completed in Phase 1: 15/15 score-suite tests passed).
- [x] Client/server phone validation plus sparse transactional contact component/integration tests pass (completed in Phase 2; included in 107/107 targeted validation and regression tests).
- [ ] Editor values persist after a confirmed save and reload.
- [ ] Invalid phone reports, reverts, and sends no PATCH.
- [ ] Dedicated fixture is restored including pending header state, and no analytics row is created.
- [ ] 375px flow is usable without horizontal overflow.
- [ ] Playwright discovers and runs the F37 spec without a silent skip.
- [x] QA document marks this evidence as pre-integration only.
- [x] Typecheck passes and there is no schema/migration diff.

## Deferred Until #1312

Do not implement or claim these items in the provisional phase:

- Runtime score-route mapping of `Sites.name`, complete structured address, and phone.
- Score API assertions for Business 20, partial 12, and legacy address 0.
- Score-route 401/403 regression evidence.
- Atomic `20/40/20/20` engine and full total 100.
- Final staging QC and completion of issue #1309.

When #1312 starts, update this file with the concrete PR, test paths, commands, failure modes, and final completion gate.
