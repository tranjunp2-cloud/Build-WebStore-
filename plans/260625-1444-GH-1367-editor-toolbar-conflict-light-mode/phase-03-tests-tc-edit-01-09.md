# Phase 03 — Tests: TC-EDIT-01..09

## Context Links
- Issue #1367 — TC-EDIT-01..09 defined in issue (no editor-toolbar QA doc exists yet).
- Existing tests: `src/__tests__/unit/editor/preview-scripts.test.tsx` (Bug 1 selection logic), `src/__tests__/unit/editor/preview-frame.test.tsx` (parent message handlers). No BlockActionBar test exists.
- QA convention: `.claude/rules/testing.md` — every test needs a TC-ID; `docs/TEST_CONVENTION.md`.
- Closest QA doc: `docs/qa/F04-block-renderer.md` (renderer, not editor toolbar).

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Add regression tests covering both fixes. Map each `it()` to a TC-EDIT-* id from issue #1367. Record TC-IDs in a QA doc so the project's "TC-ID from docs/qa/F*.md" rule is satisfied.

## Key Insights
- TC-EDIT-* are NOT yet in any `docs/qa/F*.md`. Two options (KISS): (a) append a "GH-1367 Editor Toolbar" section to `docs/qa/F04-block-renderer.md`, or (b) create `docs/qa/F04-editor-toolbar-1367.md`. Recommend (a) — single doc per feature family, less sprawl. Tests reference `TC-EDIT-NN (GH-1367)`.
- Bug 1 tests extend `preview-scripts.test.tsx` (jsdom): assert that `onTextClick` does NOT post `TEXT_EDITING_STARTED` on a non-text hit, and DOES on a text hit. Must mock `document.caretRangeFromPoint` since jsdom lacks it.
- Bug 2 tests = new `block-action-bar.test.tsx`: render `BlockActionBar`, assert container className contains `bg-slate-900/95` (light) + `dark:bg-[var(--editor-surface-elevated)]/95`, assert icon color classes present. Contrast (AC3 4.5:1) is asserted by class presence + a documented manual check (jsdom can't compute rendered color contrast).

## Requirements
**Functional** — cover all 9 TC-EDIT cases:
| TC | Maps to | Layer | Where |
|----|---------|-------|-------|
| TC-EDIT-01 | AC1/AC2 background→block | unit (jsdom) | preview-scripts.test.tsx |
| TC-EDIT-02 | AC1 heading text→text toolbar | unit | preview-scripts.test.tsx |
| TC-EDIT-03 | AC1 padding click→block | unit | preview-scripts.test.tsx |
| TC-EDIT-04 | AC2 Logo Cloud empty→block | unit | preview-scripts.test.tsx |
| TC-EDIT-05 | AC1 Newsletter bg vs headline | unit | preview-scripts.test.tsx |
| TC-EDIT-06 | AC3 light toolbar visible | unit | block-action-bar.test.tsx |
| TC-EDIT-07 | AC4 dark no regression | unit | block-action-bar.test.tsx |
| TC-EDIT-08 | AC5 hover both themes | unit | block-action-bar.test.tsx |
| TC-EDIT-09 | drag via grip still works | unit | block-action-bar.test.tsx |

**Non-functional**
- No fake data / no logic re-implementation — import real `PreviewScripts` / `BlockActionBar`.
- 100% pass on new code; do not weaken assertions to pass CI.

## Architecture
- Bug 1: mount `PreviewScripts` in jsdom, build a `[data-block-index]` block with a heading + background wrapper, mock `caretRangeFromPoint(x,y)` to return `{ startContainer: { nodeType: 3 } }` (text hit) or `{ startContainer: divEl }` (element hit), dispatch `click`, spy on `window.parent.postMessage`, assert message `type`.
- Bug 2: React Testing Library render of `BlockActionBar` with minimal props; query the root element; assert `className` tokens. For hover (TC-EDIT-08) assert `ACTION_BTN` includes `hover:bg-white/10`. For drag (TC-EDIT-09) assert grip button present + `onDragStart` wired (fire `pointerDown`, expect handler called).

## Related Code Files
**Create**
- `src/__tests__/unit/editor/block-action-bar.test.tsx` (TC-EDIT-06..09)

**Modify**
- `src/__tests__/unit/editor/preview-scripts.test.tsx` — add TC-EDIT-01..05 cases (caret-hit mocking).
- `docs/qa/F04-block-renderer.md` — append "## GH-1367 Editor Toolbar (TC-EDIT-01..09)" mapping table.

**Delete:** none.

## Implementation Steps
1. Append TC-EDIT-01..09 table + brief Gherkin to `docs/qa/F04-block-renderer.md`.
2. Add `block-action-bar.test.tsx`: TC-EDIT-06 (light bg class), 07 (dark variant class), 08 (hover class), 09 (grip + onDragStart fired).
3. Extend `preview-scripts.test.tsx`: mock `document.caretRangeFromPoint` per case; assert correct postMessage `type` for TC-EDIT-01..05.
4. Run `npm test -- editor` (or the project's vitest invocation) — all pass.
5. If any fail, fix per tester recommendations (do not skip/weaken).

## Todo List
- [ ] 03-1 Append TC-EDIT-01..09 mapping to `docs/qa/F04-block-renderer.md`
- [ ] 03-2 Create `block-action-bar.test.tsx` (TC-EDIT-06..09)
- [ ] 03-3 Extend `preview-scripts.test.tsx` (TC-EDIT-01..05, caret mock)
- [ ] 03-4 `npm test` editor suites — 100% pass
- [ ] 03-5 Confirm each `it()` title references its TC-EDIT id

## Success Criteria
- All 9 TC-EDIT cases have a passing test referencing the TC-ID.
- New tests import real components (no re-implemented logic, no fake data).
- Editor test suites green; no regression in existing `preview-scripts`/`preview-frame` tests.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| jsdom lacks `caretRangeFromPoint` | High (expected) | Med | Mock it per-test; assert the guard branch logic, not the browser API itself. Document that real cross-browser behavior is covered by manual matrix in phase 02. |
| jsdom can't compute color contrast (AC3 4.5:1) | High | Low | Assert class presence (`bg-slate-900`, icon colors) as proxy + record manual contrast check in QA doc. |
| Hover state not observable in jsdom | Med | Low | Assert `hover:` class present in className, not runtime hover paint. |
| Drag (TC-EDIT-09) needs pointer capture | Med | Low | Assert `onDragStart` invoked on `pointerDown`; full drag is an e2e concern, note as out-of-unit-scope. |

## Security Considerations
- Tests assert no `contenteditable` is set on non-text hits (Bug 1) — guards the accidental-edit surface.

## Next Steps
After green: code-reviewer → git-manager (PR to staging, `Relates to #1367`).
Note: per project rule, issues close after QA — use `Relates to #1367`, not `Closes`.
