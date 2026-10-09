# Phase 02: Implement Local Business UI Fixes

## Context Links

- Plan: [GH-1757 Local Business UI fixes](./plan.md)
- Phase 1: [QA contract and unit regressions](./phase-01-lock-qa-contract-and-unit-regressions.md)
- Editor tokens: [`src/app/globals.css`](../../src/app/globals.css)

## Overview

- **Priority:** P1
- **Status:** completed
- **Effort:** 1.75h
- **Description:** Apply the minimum production changes for contrast, coordinate input semantics, and incomplete Opening Hours submission protection.

## Key Insights

- `text-blue-300` and `text-green-300` lack light-mode overrides in the Editor shell.
- Whole-control `disabled:opacity-50` recreates the washed-out Extract state even if enabled colors pass.
- `type=number` intentionally remains because it provides browser numeric semantics; exponent/plus entry needs blocking at both keyboard and paste boundaries.
- Existing blur and Zod range validation are authoritative and must stay unchanged.
- Incomplete custom ranges need a submission guard separate from ordering validation so editing stays quiet without allowing destructive Save.

## Requirements

### Functional

- Extract enabled state uses a solid AA-safe foreground/background pair in both themes and does not share its blue/white classes with the disabled branch.
- Extract disabled state uses a mutually exclusive slate foreground/background branch, never retains `bg-blue-600` or `text-white`, exposes native `disabled`, and stays at least 4.5:1 without opacity reduction.
- Coordinate fields prevent unmodified `e`, `E`, `+` from keyboard and exponent/plus paste input; retain digits, `.`, `-`, editing/navigation keys, valid decimal paste, and Ctrl/Meta/Alt shortcuts. Native `type="number"` remains responsible for ordinary alphabetic rejection.
- Latitude exposes `min=-90`, `max=90`; longitude exposes `min=-180`, `max=180`; both expose `step=any` and `inputMode=decimal`.
- Coordinate errors remain associated with inputs through `aria-invalid`/`aria-describedby`.
- Completed checklist badge/icon uses explicit high-contrast light/dark pairs; incomplete state remains neutral.
- Custom Opening Hours Save is disabled when any range lacks `opens` or `closes`, including a non-first split-shift or newly added blank range; valid complete ranges retain existing selected-day overwrite semantics.

### Non-functional

- No `globals.css`, Opening Hours layout/utils, save queue, API, Zod, Payload, DB, env, dependency, or `.github/workflows/**` changes.
- No new shared abstraction; local input guards and modal-derived state are sufficient.
- Preserve dark mode and responsive layout.

## Architecture

```text
GeoLinkInput
├─ visual state: explicit enabled/disabled theme classes
├─ keyboard boundary: local blocked-key handler
└─ persistence boundary: unchanged handleManualBlur → numeric callback only

CompletionChecklist
└─ predicate unchanged → presentation receives explicit complete/incomplete palette

OpeningHoursEditModal
└─ completeness + ordering + selected-days → one shared Save-disabled guard
```

## Related Code Files

- **Modify:** `<worktree-1>/src/components/editor/local-business/geo-link-input.tsx` — Extract palette, input semantics, accessible errors.
- **Modify:** `<worktree-1>/src/components/editor/local-business/completion-checklist.tsx` — completed/incomplete theme palette.
- **Modify:** `<worktree-1>/src/components/editor/local-business/opening-hours-edit-modal.tsx` — prevent incomplete custom ranges from being submitted.
- **Create/Delete:** none.

## Implementation Steps

1. Derive one `isExtractDisabled` value and compose mutually exclusive class branches. Enabled owns an AA-safe solid pair such as `bg-blue-600 text-white hover:bg-blue-700`; disabled owns only its slate foreground/background pair. Shared/base classes must contain neither blue/white nor slate state colors.
2. Bind `disabled={isExtractDisabled}` directly. Do not rely on `disabled:text-*` to override `.editor-shell .bg-blue-600.text-white { color: #fff !important; }`; ensure disabled DOM classes contain neither `bg-blue-600` nor `text-white`.
3. Add small local keyboard and paste guards that reject only unmodified `e`, `E`, or `+` input/content. Return without cancellation when Ctrl, Meta, or Alt is pressed so browser/assistive shortcuts such as zoom remain available. Do not block minus, decimal point, valid numeric paste, Tab, arrows, Delete, or Backspace; do not duplicate native ordinary-letter filtering.
4. Add stable IDs/`htmlFor`, `inputMode="decimal"`, `min`, `max`, `step="any"`, `aria-invalid`, and error description IDs to both manual fields.
5. Keep `handleManualBlur` unchanged except for any typing needed to associate error state; it remains the only client conversion/range gate.
6. Replace completed checklist badge/icon classes with explicit pairs such as `bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300`, verified at ≥4.5:1. Use `text-[var(--editor-text)]` for completed labels and `text-[var(--editor-text-muted)]` for incomplete labels.
7. Derive `hasIncompleteRange` only for `mode === 'custom'`; keep existing ordering validation separate, and combine no selected days/incomplete/invalid order into one `isSaveDisabled` value.
8. Reuse `isSaveDisabled` in both `handleSave()` and the Save button. Do not show the closing-order error merely because a field is empty.
9. Do not change `isRangeOrderValid()`, `applyBatchSave()`, batch-action layout, or parent save queue.
10. Run Phase 1 unit tests, then inspect both themes at sidebar and full-width breakpoints.

## Todo

- [x] Fix enabled/disabled Extract contrast.
- [x] Add coordinate keyboard, bounds, and accessibility semantics.
- [x] Fix completed checklist contrast and state distinction.
- [x] Block incomplete custom Opening Hours submission without changing valid save semantics.
- [x] Pass focused unit regressions.

## Completion Evidence

- Focused Vitest: **68/68 passed**; all 8 Phase 1 expected-red assertions turned green.
- Typecheck: **passed** with no diagnostics.
- Lint: **passed** with 0 errors and 142 baseline warnings.
- Debugger and independent code reviewer: **APPROVE**.
- `git diff --check` and both workflow gates: **passed**.
- Phase 3 browser evidence remains pending; no CI or browser pass is claimed.

## Success Criteria

- Extract computed contrast is at least 4.5:1 for light-enabled, light-disabled, dark-enabled, and dark-disabled; disabled state also has native `disabled === true`.
- Invalid exponent/plus keyboard or paste input and native ordinary alphabetic input never reach the field value or save callback; Ctrl/Meta/Alt shortcuts remain available.
- Boundary coordinates and negative decimals still save as numbers.
- Completed versus incomplete checklist states are distinguishable by color and icon/dot, not color alone.
- Incomplete first/non-first split-shift rows and newly blank rows cannot call `onSave`; valid Monday `09:00–18:00` updates only Monday and rerenders correctly.
- Existing Local Business, Maps extraction, and dark-mode behaviors remain unchanged.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Blocking too many keys harms accessibility | Users cannot edit values or use browser zoom/assistive shortcuts | Deny only unmodified `e/E/+`; bypass Ctrl/Meta/Alt and unit-test allowed control keys, modifiers, and valid characters |
| Disabled Extract still fails contrast | Original light-mode bug remains | Use mutually exclusive state classes, explicit disabled colors, no opacity, and computed browser assertions |
| Global `text-white !important` defeats disabled text | Disabled button becomes white-on-light | Never retain `bg-blue-600 text-white` in the disabled branch; inspect final DOM classes and computed colors |
| Global editor remap overrides chosen classes | Computed colors differ | Use explicit `dark:` pairs and verify computed browser colors in Phase 3 |
| Completeness guard changes order-error UX | Partial input shows a misleading error | Keep completeness in Save eligibility only; preserve existing order-error predicate |

## Security Considerations

- Client filtering is UX only. Strict numeric/range validation remains server-side.
- No auth, tenant, URL resolver, or request-body contract changes.

## Performance Considerations

- Constant-time keyboard check and class changes only; no render/query/network impact.

## Next Steps

- Phase 3 validates computed styles and the real Editor input flow in Playwright.
