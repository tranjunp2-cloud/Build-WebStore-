# Phase 03: Add Browser Regression and Close Verification

## Context Links

- Plan: [GH-1757 Local Business UI fixes](./plan.md)
- Phase 2: [Local Business UI implementation](./phase-02-implement-local-business-ui-fixes.md)
- Existing F37 browser pattern: [`tests/f37-local-seo-score-checklist.spec.ts`](../../tests/f37-local-seo-score-checklist.spec.ts)
- Playwright projects: [`playwright.config.ts`](../../playwright.config.ts)

## Overview

- **Priority:** P1
- **Status:** completed
- **Effort:** 2.25h
- **Description:** Add a discoverable authenticated manual/local browser gate for Bugs 1–3 plus the narrow Bug 4 modal-theme follow-up, and run focused close verification without CI claims.

## Key Insights

- `tests/*.spec.ts` files are ignored unless an explicit Playwright project/testMatch reaches them.
- The test must reuse the authenticated target allowlist and fail fast on the wrong account/fixture.
- Contrast needs computed browser colors; unit class assertions are insufficient.
- Bug 5 remains a unit regression because reproducing a populated media relation does not require mutating the local browser fixture.
- `TC-F37-10-05` component interaction tests remain authoritative for Bug 4 behavior; browser coverage is limited to the modal's verified theme/readability contract.
- The GH-1757 project is manual/local only and must never be described as CI-enforced.

## Requirements

### Functional

- Browser opens the real Editor Local Business accordion on desktop.
- Enabled/disabled Extract, `Coordinates extracted`, and completed checklist indicators meet planned computed color/contrast contracts in light and dark modes.
- `e`, `E`, `+`, and ordinary alphabetic input do not enter coordinate inputs.
- Out-of-range blur shows inline feedback and sends no Local Business PATCH.
- Opening Hours modal dialog, selected day, Add hours, 20×20px/2px checkbox, 36px Cancel/Save, disabled/enabled Save, and time input remain readable and theme-correct in light/dark mode through real Editor UI theme toggles.
- Manual/local browser tests are discovered by an explicit project with authenticated storage state and exact issue-spec selection.

### Non-functional

- No silent `skip`, `fixme`, conditional assertion, production-origin execution, or `.github/workflows/**` change.
- Require explicit non-empty `BASE_URL`, `TEST_EMAIL`, `TEST_PASSWORD`, and `E2E_TEST_OTP_CODE`; never rely on the Playwright localhost default.
- Preserve successful real `editor-data` responses for every overlay: change only `businessCategory: null` for the checklist state, only latitude/longitude for coordinate success, or only `openingHours: []` for the unset-hours modal. Never PATCH or persist an overlay.

## Architecture

```text
Playwright setup auth
  → assert allowed BASE_URL
  → discover sole active-tenant site
  → stub analytics + install fail-closed Local Business save interception
  → open /editor/{siteId}
  → expand Local Business + manual-coordinate disclosure
  → toggle document theme class only (no persisted theme save)
  → inspect computed colors + keyboard/clipboard/coordinate interaction
  → overlay one incomplete checklist predicate in the browser response only
  → verify real completed + controlled incomplete presentation without persistence
  → for TC-05, overlay openingHours:[] and toggle theme through Editor UI only
  → close modal per theme + restore initial theme; abort every non-read API request
```

Use a small test-only `rgb(...) → hex` adapter, then import the production `checkContrast()` helper for WCAG math. Do not duplicate luminance/contrast logic in the spec.

## Related Code Files

- **Create:** `<worktree-1>/tests/gh-1757-local-business-settings.spec.ts` — real-browser regression.
- **Modify:** `<worktree-1>/playwright.config.ts` — add a clearly commented manual/local-only `gh-1757-local-business` project/testMatch with setup dependency and auth state.
- **Modify:** `<worktree-1>/src/components/editor/local-business/geo-link-input.tsx` — harden coordinate input and contrast states after browser findings.
- **Modify:** `<worktree-1>/src/components/editor/local-business/opening-hours-edit-modal.tsx` and `opening-hours-time-range-row.tsx` — make modal states and native time controls theme-readable.
- **Prohibited:** every path under `<worktree-1>/.github/workflows/`.
- **Create/Delete:** none else.

## Implementation Steps

1. Add a Playwright project named `gh-1757-local-business`, scoped only to the new spec, using `./e2e/.auth/user.json` and depending on `setup`; comment it as manual/local-only and do not edit workflow files or claim CI coverage.
2. Before navigation, require explicit non-empty target/auth environment values, call `assertAllowedAuthenticatedE2ETarget(BASE_URL)`, require exact user-email match, exactly one active tenant, and exactly one site whose tenant relationship ID equals that active tenant ID.
3. Before risky UI interaction, install one broad `**/api/**` guard. Fulfill analytics tracking with 204, allow only GET/HEAD/OPTIONS, and record plus abort every other API request. Self-probe the guard with a safe nonexistent POST, then require zero later mutation attempts. Define `NO_MUTATION_SETTLE_MS = 1_000`.
4. Open the real Editor and Local Business accordion; enter a harmless Maps URL without clicking Extract so the enabled state is testable without network mutation.
5. For light and dark document classes, inspect both enabled and disabled Extract. Convert computed CSS RGB to hex and call source `checkContrast`; require ratio ≥4.5 for all four state/theme pairs, require enabled not disabled, and require disabled native `disabled === true`.
6. Click the `Enter coordinates manually (advanced)` disclosure and require both labelled latitude/longitude inputs to be visible before interaction. Cover keyboard `e`, `E`, `+`, and ordinary letters; grant clipboard permission, write exponent/plus and `abc` payloads, paste with `Control+V` into both selected fields, and assert values stay unchanged. Enter out-of-range values, blur, wait `NO_MUTATION_SETTLE_MS`, assert inline errors and zero API mutation attempts.
7. Assert one real completed checklist indicator is green/high contrast. For a deterministic incomplete state, intercept the successful authenticated `editor-data` GET, preserve the response, and overlay only `localBusiness.businessCategory: null` in browser memory. Verify the neutral palette and icon/dot distinction without claiming backend-state coverage or sending a save.
8. Run `setup` explicitly with the same explicit `BASE_URL` to create auth state before any `--no-deps` command.
9. Add TC-05 browser coverage with `openingHours: []` overlaid only in the successful GET response. Toggle themes through the real Editor menu; assert exact AA palettes, time-input `color-scheme`, checkbox 20×20px, 36px Cancel/Save, disabled Save opacity 1, and distinct action states. Use one computed-border helper to require solid style, exact width, and exact theme color for selected day, Add hours, checkbox, Cancel, disabled Save, and enabled Save. Fill `09:00–18:00` only to expose enabled styling; never click Save. Cancel, restore the initial theme, and keep the broad API mutation guard active.
10. Write exact spec/project discovery from `--list --no-deps` to a temporary file, require separate exact matches for `TC-F37-10-01`, `02`, `03`, and `05`, then run the exact spec/project with `--no-deps` so setup cannot mask a missing issue test.
11. Run focused Vitest, typecheck, lint, `git diff --check`, both workflow-prohibition gates, and the manual/local issue project. Record actual evidence in the QA document without any CI claim.

## Todo

- [x] Add discoverable manual/local-only `gh-1757-local-business` Playwright project without workflow changes.
- [x] Add light/dark enabled/disabled computed contrast and native-disabled browser assertions.
- [x] Add coordinate keyboard, real clipboard paste, range, and fail-closed no-save browser assertions.
- [x] Validate deterministic completed/incomplete checklist presentation without persistent mutation.
- [x] Validate the real Opening Hours modal through UI theme toggles and restore the initial theme without persistent mutation.
- [x] Run targeted and static verification gates.
- [x] Update QA evidence with actual results only.

## Completion Evidence

- Authenticated setup on exact `http://localhost:3000`: **passed**; the spec rejects every other origin before fixture discovery.
- Exact `--no-deps` discovery: **4/4** issue tests, with separate matches for `TC-F37-10-01`, `02`, `03`, and `05`.
- Exact manual/local browser suite: **4/4 passed**. This is not CI or staging evidence.
- TC-01 first exposed a transient Extract contrast ratio of **4.106** while `transition-colors` was active, then follow-up review exposed `Coordinates extracted` at **1.62:1**. Removing the Extract transition and applying exact coordinate-success palettes light `#166534`/`#dcfce7`, dark `#86efac`/`#052e16` made all tested states pass AA. A deterministic `editor-data` GET overlay changes only latitude/longitude to expose the success message; it never persists. The final review also locks the oracle itself: translucent RGBA must be rejected instead of having alpha discarded.
- TC-02 passed real keyboard/clipboard rejection, both range alerts, and zero API mutation attempts. A screenshot follow-up then exposed an empty-value-only false positive: Chromium could display `e`/`1e` while reporting `value === ''` and `validity.badInput === true`. The production guard covers `beforeinput` plus an `input` fallback; a per-element snapshot restores prior valid text for non-cancelable IME. Final review proved that snapshot was still empty on the first interaction with a server-provided value, so focus now seeds it before composition. Browser regressions require `badInput === false` after `keyboard.insertText()` and preserve GET-overlay latitude `3.139` through immediate CDP IME composition, without an earlier fill/input seed. Final-review regressions also require malformed `1-2` and `--` to surface associated native `badInput` errors on blur; the broad API guard self-probes a nonexistent POST and requires zero later mutation attempts in every issue test.
- TC-03 passed exact green/neutral computed palettes and AA contrast in both themes. The incomplete state is a controlled GET-response overlay of only `businessCategory: null` in browser memory; no backend-state or persistence result is claimed.
- TC-05 passed against the real authenticated modal through the Editor theme controls, with no `evaluate()`/class forcing. Screenshot red evidence measured the checkbox at 16px; the first 20px attempt exposed a 0px computed border because Preflight is disabled and the global button reset wins. Local `border-solid` fixes the root cause. A shared regression helper now checks computed `border-style: solid`, width, and exact theme color at six call sites: selected day, Add hours, checkbox, Cancel, disabled Save, and enabled Save. This prevents class-only false positives across every bordered modal control; isolated TC05 and the final **4/4** exact suite are green. Existing size/palette/AA/no-save and GET-only overlay guarantees remain unchanged.
- Final-review red proof: native `badInput` with an empty serialized value produced no associated error before the blur validation fix.
- Bug 2 follow-up red proof: the new unit regression failed before the fix because `1e2` was accepted as `100`.
- Focused Vitest after the final Bug 2 follow-up: **73/73 passed**. Typecheck passed. Lint passed with **0 errors** and repository baseline warnings.
- Debugger and independent code reviewer: **APPROVE**. `git diff --check`, staged-state, and both workflow protection gates passed.

## Verification Commands

```bash
npm test -- src/__tests__/unit/editor/geo-link-input.test.tsx src/__tests__/unit/editor/settings-panel.test.tsx src/__tests__/unit/editor/completion-checklist.test.tsx src/__tests__/unit/editor/opening-hours-editor.test.tsx
npm run typecheck
npm run lint
BASE_URL=http://localhost:3000 npx playwright test --project=setup
BASE_URL=http://localhost:3000 npx playwright test tests/gh-1757-local-business-settings.spec.ts --project=gh-1757-local-business --list --no-deps > /tmp/gh-1757-playwright-list.txt
for tc in 01 02 03 05; do rg -q "\[TC-F37-10-${tc}\]" /tmp/gh-1757-playwright-list.txt || exit 1; done
BASE_URL=http://localhost:3000 npx playwright test tests/gh-1757-local-business-settings.spec.ts --project=gh-1757-local-business --no-deps
git diff --check
test -z "$(git status --porcelain=v1 -- .github/workflows)"
git diff --quiet staging...HEAD -- .github/workflows
```

## Success Criteria

- Manual/local exact-spec discovery finds all four browser TC-IDs (`01`, `02`, `03`, `05`) with `--no-deps`; setup cannot mask a missing issue test.
- Computed enabled/disabled Extract, coordinate-success, and completed-check contrast are ≥4.5 in both themes; native disabled state is correct.
- Manual coordinate inputs are explicitly revealed before interaction; exponent/plus and ordinary alphabetic keyboard/real-paste paths are rejected; empty `insertText`/IME-style insertion leaves neither a value nor native `badInput`, while non-cancelable IME restores prior valid text; invalid range yields inline errors and zero API mutation attempts after the bounded settle window.
- Opening Hours modal exact palettes pass AA in light/dark; all six bordered controls expose computed solid style, exact width/color, checkbox is exactly 20×20px with a 2px border, Cancel/Save are 36px, action states remain distinct, and the UI flow restores the initial theme without clicking Save.
- Worktree-status and `staging...HEAD` checks both prove `.github/workflows/**` is untouched.
- The browser regression performs no persistent fixture mutation.
- Unit/static/manual-browser gates pass, or environmental blockers are reported without false pass or CI claims.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Manual project is mistaken for CI coverage | False assurance after merge | Label project/evidence manual-local only and prohibit workflow claims or changes |
| Discovery misses one of four planned browser TC-IDs | Issue coverage false-passes | Require separate exact matches for TC-F37-10-01, 02, 03, and 05 |
| Save interception is installed too late or matches loosely | Local fixture mutation | Install the broad fail-closed API guard before navigation; self-probe it, then abort every non-read API request and assert zero later attempts |
| Coordinate inputs remain hidden behind the manual disclosure | Browser test times out before exercising validation | Open the disclosure and assert both labelled inputs are visible first |
| Dedicated fixture lacks a completed checklist row | Visual assertion cannot run | Fail fast for the real completed state; create only the incomplete presentation through the documented response-only overlay |
| Browser theme verification leaves UI state changed | Follow-up affects later tests or the local session | TC-01/03 use document-class isolation; TC-05 uses the real Editor control, closes each modal, and restores the initial theme |
| Local credentials/server/port unavailable | Local browser gate blocked | Keep deterministic unit/static evidence; report blocker, never mark a browser pass |

## Security Considerations

- Explicit `BASE_URL` and auth variables are required; target allowlist and exact email/tenant/site binding run before navigation.
- Exact Local Business save attempts are recorded and aborted before they can reach local persistence.
- Worktree and branch-diff gates fail if any tracked, staged, unstaged, untracked, or committed workflow path changes.
- No secret values in source, fixtures, logs, screenshots, or QA documentation.
- No production origin and no cross-tenant site mutation.

## Performance Considerations

- One serial issue-specific browser spec; no new runtime bundle or network path.

## Next Steps

- If all gates pass, implementer may prepare a conventional PR title such as `fix(F37): [GH-1757] harden Local Business UI validation` and use `Relates to #1757` in the description.
