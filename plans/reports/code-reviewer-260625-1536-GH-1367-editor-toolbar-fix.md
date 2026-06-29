# Code Review — GH-1367 Editor Toolbar Conflict + Light-Mode Visibility

**Reviewer:** code-reviewer (read-only)
**Branch:** `fix/1367-editor-toolbar-conflict-light-mode` (working-tree, uncommitted)
**Date:** 2026-06-25
**Verdict:** APPROVE_WITH_NITS — score 9.0 / 10

---

## Scope

| File | Change |
|---|---|
| `src/components/editor/PreviewScripts.tsx` | Bug 1: removed `'DIV'` from `validTags`; added `clickLandedOnTextNode(x,y)` helper + guard in `onTextClick` |
| `src/components/editor/BlockActionBar.tsx` | Bug 2: container className → dark pill in light mode, `dark:` variant restores original |
| `src/__tests__/unit/editor/preview-scripts.test.tsx` | +TC-EDIT-01..05 + Firefox/legacy variants + scoped `innerText` polyfill |
| `src/__tests__/unit/editor/block-action-bar.test.tsx` | New file, TC-EDIT-06..09 + 2 variants |
| `docs/qa/F04-block-renderer.md` | TC-EDIT-01..09 mapping table |

**Verification run:** `npx vitest run` on both editor test files → **21/21 pass**. `tsc --noEmit` → **0 errors** in changed files. (Lint blocked by pre-existing worktree `.eslintrc` conflict, unrelated to diff.)

---

## Overall Assessment

Tight, minimal, well-commented fix that matches the plan and respects YAGNI/KISS. Both bugs addressed with low-risk surgical changes. Bug 2 is pure CSS and correct. Bug 1's caret-hit guard is sound in design — it keys off `e.clientX/Y` (geometry), independent of `e.target`, which is exactly right for discriminating a glyph hit from a padding hit. No security, auth, or data-flow concerns. No critical or high findings.

---

## Critical Issues

None.

## High Priority

None.

## Medium Priority

### M1 — whatsapp-button collapsed label may no longer be inline-editable
**File:** `src/blocks/whatsapp-button/index.tsx:56` (interaction with `PreviewScripts.tsx:346`)

The `<span data-text-editable class="... max-w-0 overflow-hidden group-hover:max-w-xs ...">{label}</span>` is **collapsed to 0 width by default** (only expands on `group-hover`). On staging `noTextEditBlockTypes` = `{'cartWidget'}` only — so whatsapp-button label edit is meant to flow through `onTextClick` via the `data-text-editable` opt-in. With the new `clickLandedOnTextNode` guard, a click on the collapsed label area will likely have `caretRangeFromPoint` resolve to the parent element node (text clipped to zero box) → guard returns `false` → editing won't activate.

- **Impact:** Narrow. The label is only visibly hittable while hovered (when it has expanded), and during hover the glyphs are real and the caret API should land on the text node, so the common path still works. But a click on the icon/padding portion that previously fell through to the label via walk-up will now be rejected.
- **Pre-existing vs new:** The editability of this label predates this diff; the diff only changes the gating. This is an edge-case regression risk, not a guaranteed break.
- **Action:** Manual-verify in editor: hover whatsapp-button → click the label text → confirm inline edit still activates. If it regresses, add `whatsapp-button` to a per-block bypass or assert the guard against the resolved `target` rather than raw click point for opt-in `data-text-editable` elements. No code change required if manual check passes.

### M2 — Unit tests mock `caretRangeFromPoint`, so they don't prove real padding→element-node behavior
**File:** `preview-scripts.test.tsx` (TC-EDIT-01/03/04/05)

The "background click → no edit" assertions are driven by a per-test mock that *forces* `caretRangeFromPoint` to return an element node. They verify the guard's branching given that input, not that real browsers actually return an element node for a padding click. That real behavior is the crux of Bug 1.

- **Impact:** Tests are meaningful for the guard logic but cannot catch a real-browser caret-resolution surprise. This is an inherent jsdom limitation (no layout engine).
- **Action:** Accept for unit layer; ensure an e2e/manual TC covers a real padding click on a real block. The QA doc already frames TC-EDIT-01..05 as unit (jsdom) — good. Consider adding one Playwright case to `docs/qa` backlog. Non-blocking.

---

## Low Priority

### L1 — `innerText` polyfill is legitimate but global on the prototype
**File:** `preview-scripts.test.tsx` (new describe block `beforeEach`/`afterEach`)

jsdom genuinely lacks `HTMLElement.prototype.innerText` (returns `undefined`), and `onTextClick` reads `target.innerText` to reject empty elements — so without the polyfill every positive case would false-negative. The polyfill (fall back to `textContent`) is a correct mirror of real browser behavior, NOT a cheat to mask a bug. Cleanup via `afterEach` with the `hadInnerText` guard correctly restores the absent state. Good hygiene.

- Minor: it's defined on `HTMLElement.prototype` (global) inside a scoped `describe`. The `afterEach` restoration prevents leakage, so this is fine. No action needed.

### L2 — `caretPositionFromPoint` type is hand-narrowed
**File:** `PreviewScripts.tsx:317-318`

`{ offsetNode: Node | null }` is a minimal local shape rather than the lib DOM `CaretPosition`. Reasonable since TS lib coverage for `caretPositionFromPoint` is inconsistent across targets. Null-safety via `?.` and `!!pos` is correct. No action.

---

## Nits

- **N1** `PreviewScripts.tsx:330` — the `return true` legacy fallback default is the correct choice (preserves pre-fix behavior for ultra-rare no-caret-API browsers; better to allow editing than to silently break it). Comment explains the rationale well.
- **N2** TC-EDIT-07 queries the delete icon by `svg.text-red-400` because the button uses a Tooltip (no `title`). The inline comment explains this — good, prevents a future reader "fixing" it to `getByTitle`.
- **N3** Test titles all carry `TC-EDIT-0X (GH-1367)` prefixes and map 1:1 to the QA table. Compliant with `.claude/rules/testing.md`.

---

## Behavioral Checklist

- Concurrency: N/A (synchronous DOM event handlers, no shared async state introduced).
- Error boundaries: caret API calls are guarded with `typeof === 'function'` + null checks; no throw paths added.
- API contracts: `clickLandedOnTextNode` returns strict `boolean`; callers handle both branches. Casts are narrow and null-safe.
- Backwards compat: no exported interface or schema change. `validTags` is module-local. `BlockActionBar` props unchanged.
- Input validation: N/A (no external input; runs in trusted injected iframe script).
- Auth/authz: N/A.
- N+1 / queries: N/A.
- Data leaks: none. `postMessage` payloads unchanged.
- SSR concern: `clickLandedOnTextNode` runs only inside event handlers within the injected iframe script where `document` is always defined. The whole block is inside a `useEffect`-equivalent client effect. Safe.

---

## Acceptance Criteria (issue #1367)

| AC | Status | Note |
|---|---|---|
| **AC1** text-node click → text toolbar; block bg click → block toolbar | SATISFIED (with M1/M2 caveat) | Guard keys off click geometry, correct design. Unit-verified via mock; recommend one e2e for real caret. |
| **AC2** empty blocks (Logo Cloud, Gallery, Spacer, Divider) → any click → block toolbar | SATISFIED | `DIV` removal + caret guard both prevent fall-through; TC-EDIT-04 covers Logo Cloud. |
| **AC3** light-mode toolbar visible, icon-vs-bg contrast ≥ 4.5:1 | SATISFIED | Dark pill `bg-slate-900/95`: slate-300 ≈10.9:1, slate-400 ≈6.8:1, red-400 ≈5.5:1, amber-300 high — all pass AA. |
| **AC4** dark mode no regression (AI amber, delete red) | SATISFIED | `dark:bg-[var(--editor-surface-elevated)]/95` restores original surface; icon colors untouched. TC-EDIT-07 asserts amber-300 + red-400. |
| **AC5** hover states both themes | SATISFIED | `ACTION_BTN` uses `hover:bg-white/10` (theme-agnostic, white overlay works on both dark pills). TC-EDIT-08 asserts presence. |

---

## Positive Observations

- `DIV` removal from `validTags` is the root-cause fix; the caret guard is defense-in-depth for nested-text DIVs that other valid tags could still wrap. Both layers reinforce each other.
- Footer field edit (`onClick` / `data-footer-field` channel) and image-replace (`data-image-index` in `onClick`) are in a **separate** handler from `onTextClick` — confirmed the new guard does not touch them. No regression to those entry points.
- Bug 2 `dark:` discriminator is correct: `BlockActionBar` renders in the parent document under `ThemeProvider` which toggles `.dark` on `documentElement` (verified via plan + class-based theme).
- Comments cite GH-1367 and explain *why*, not just *what* — aids future readers.

---

## Recommended Actions (prioritized)

1. **M1** — Manually verify whatsapp-button label inline-edit still works (hover → click label). Only path that could regress.
2. **M2** — Add (or backlog) one Playwright e2e covering a real padding click → block toolbar, since unit tests mock the caret API.
3. Proceed to commit. No code changes required to land.

---

## Unresolved Questions

- Has anyone manually confirmed whatsapp-button label inline-edit post-fix? (M1)
- Is there an existing e2e suite for the editor where a real-caret padding-click test could live, or is jsdom-unit the only layer today? (M2)

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Bug 1 + Bug 2 fixes are correct, minimal, and well-tested (21/21 pass, 0 type errors); all 5 ACs satisfied. Verdict APPROVE_WITH_NITS (9.0/10). Two non-blocking Medium items: a narrow whatsapp-button collapsed-label edge case (M1) and unit tests mocking the caret API rather than exercising real browser caret resolution (M2).
**Concerns/Blockers:** M1 (whatsapp-button collapsed `data-text-editable` label may not activate under the caret guard — manual check) and M2 (recommend one e2e for real padding-click). Neither blocks merge.

Report path: `plans/reports/code-reviewer-260625-1536-GH-1367-editor-toolbar-fix.md`
