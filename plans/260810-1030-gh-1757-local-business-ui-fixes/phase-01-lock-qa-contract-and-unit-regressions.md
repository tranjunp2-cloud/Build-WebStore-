# Phase 01: Lock QA Contract and Unit Regressions

## Context Links

- Plan: [GH-1757 Local Business UI fixes](./plan.md)
- Issue: [GitHub #1757](https://github.com/primeproduction/ech-prime-web-v2/issues/1757)
- Test convention: [`docs/TEST_CONVENTION.md`](../../docs/TEST_CONVENTION.md)
- Existing F37 registry: [`docs/qa/F37-local-seo.md`](../../docs/qa/F37-local-seo.md)

## Overview

- **Priority:** P1
- **Status:** completed
- **Effort:** 2.5h
- **Description:** Register issue-specific acceptance cases and create focused component regressions before production edits.

## Key Insights

- Backend bounds already exist; Bug 2 is an input-interaction gap, not a schema gap.
- Existing checklist tests cover completion predicates, not visual contrast.
- `isRangeOrderValid()` intentionally avoids showing an order error while a time range is incomplete, but modal submission has no separate completeness guard and can clear the selected day.
- Bug 5 runtime fix is present at `927c0864b`, but current test covers only `ogImage: null`.
- Tests must use real source imports, AAA sections, top-level mocks, and TC-IDs.

## Requirements

### Functional

- Register `TC-F37-10-01` Extract contrast in light/dark and enabled/disabled states.
- Register `TC-F37-10-02` coordinate keyboard/paste semantics, modifier-shortcut preservation, native alphabetic rejection, bounds, error, and no-save behavior.
- Register `TC-F37-10-03` completed/incomplete checklist contrast and distinction.
- Register `TC-F37-10-04` populated `ogImage` object-to-ID normalization regression.
- Register `TC-F37-10-05` as authoritative component-interaction-only coverage: every incomplete custom range blocks Save/no change, while a valid single-day save preserves untouched days.

### Non-functional

- No duplicated production validation logic inside tests.
- No test without an assert; no conditional assertions or silent skips.
- Keep unit coverage deterministic and browser-independent.

## Architecture

```text
QA TC registry
├─ GeoLinkInput component regression → input semantics + callback contract
├─ OpeningHoursEditor interaction regression → completeness guard + selected-day overwrite
├─ SettingsPanel regression → hydrated Media object normalized to ID
└─ Manual/local browser acceptance (Phase 3) → Bugs 1–3 only
```

## Related Code Files

- **Modify:** `<worktree-1>/docs/qa/F37-local-seo.md` — advance the QA document to v4.9, add a GH-1757 changelog note, and register TC-F37-10-01..05.
- **Create:** `<worktree-1>/src/__tests__/unit/editor/geo-link-input.test.tsx` — coordinate input regression.
- **Modify:** `<worktree-1>/src/__tests__/unit/editor/opening-hours-editor.test.tsx` — modal submission and selected-day render regression.
- **Modify:** `<worktree-1>/src/__tests__/unit/editor/settings-panel.test.tsx` — populated `ogImage` regression.
- **Delete:** none.

## Implementation Steps

1. Add a concise GH-1757 section to the F37 QA matrix. Mark unit-covered cases `[x] AUTO`; label Bugs 1–3 Playwright evidence manual/local and `TC-F37-10-05` component-interaction-only. Do not claim live or CI evidence before execution.
2. Create `geo-link-input.test.tsx` using `GeoLinkInput` directly and source types/constants.
3. Assert latitude/longitude expose `type=number`, `inputMode=decimal`, `step=any`, and exact `min/max` attributes.
4. Assert unmodified `e`, `E`, and `+` keydown events are prevented, while Ctrl/Meta/Alt-modified shortcuts are not canceled. For paste, capture the real component event and assert exponent/plus content is canceled / `defaultPrevented === true`; assert valid decimal/negative paste is not canceled. Do not use unchanged jsdom input value as proof of paste blocking, and reserve ordinary `a`/`abc` native-number rejection for Playwright.
5. Assert invalid/out-of-range blur renders the existing error and does not call `onCoordinatesChange`; assert inclusive boundary/negative decimal values call it with numbers.
6. Parameterize an existing split-shift day so the second range is missing `opens`; assert native Save disabled, attempted submission does not call `onChange`, and the original rows fixture is deeply unchanged.
7. Repeat for a second range missing `closes`.
8. Add a new blank second range with neither endpoint and assert the same no-submit/no-mutation contract.
9. Complete Monday as `09:00–18:00`, save, assert the emitted rows replace only Monday and preserve every untouched day/range exactly; rerender with emitted rows and assert the saved Monday plus untouched-day display.
10. Extend the Search verification test with a narrowly typed hydrated `ogImage: { id, url }` fixture. Assert the callback contains the raw ID plus sanitized token, never the object.
11. Run focused tests before Phase 2; record expected red only for missing coordinate semantics and incomplete-range submission protection.

## Todo

- [x] Register TC-F37-10-01..05 in the F37 QA document.
- [x] Add GeoLinkInput input/validation regression tests.
- [x] Add split-shift missing-opens, missing-closes, newly blank range, and valid selected-day interaction regressions.
- [x] Add populated `ogImage` normalization regression.

## Completion Evidence

- Focused Vitest result: **60/68 passed**.
- Expected-red contract: exactly **8 failures**, split into **5 GeoLinkInput** assertions and **3 Opening Hours** assertions. These failures correspond only to production behavior intentionally deferred to Phase 2.
- `TC-F37-10-04` populated `ogImage` object-to-ID normalization: **passed**.
- Focused reviewer verdict: **APPROVE**.
- Workflow gates: **passed** for both worktree status and `staging...HEAD`; `.github/workflows/**` remains untouched.
- No Phase 2 or Phase 3 work is marked complete by this phase closeout.

## Success Criteria

- Every planned automated assertion maps to a documented TC-ID.
- Bug 5 regression passes on current staging code.
- Bug 2 event-cancellation/modifier preservation and all split-shift Opening Hours guard tests fail only for missing production behavior before Phase 2, then pass afterward; native ordinary-letter rejection is proven in Phase 3.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Test asserts Tailwind implementation details | Brittle refactor failures | Unit tests assert behavior/attributes; computed visual assertions stay in Playwright |
| Synthetic paste does not insert in jsdom | False-green regression | Assert cancellation/default prevention directly; reserve native insertion behavior for Playwright |
| Hydrated media object conflicts with narrow prop type | Test-only type noise | Cast only at the documented Payload hydration boundary; do not weaken API/save schema |
| Component test proves helper output but not modal behavior | Bug 4 edge escapes regression | Interact through the real pencil/modal/Save flow and rerender emitted rows |
| TC-ID collision | QA drift | Use the unused `TC-F37-10-*` namespace and grep before writing |

## Security Considerations

- Invalid coordinates must not invoke save callbacks.
- Bug 5 test uses placeholder token/media metadata only; no real secrets.

## Next Steps

- Phase 2 implements the failing component behavior without changing backend contracts.
