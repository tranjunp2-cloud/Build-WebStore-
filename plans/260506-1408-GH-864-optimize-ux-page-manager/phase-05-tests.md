# Phase 05 — Tests (unit + RTL)

**Status:** pending
**Effort:** 0.75h
**Owns:** `src/__tests__/unit/editor/*` (test-only; never edits src code)

## Overview

Cover all logic changed in P1–P4 with TC-IDs from `docs/qa/F05-ai-editor-testcases.md`. Use existing patterns: AAA, `vi.mock` top-level, no fakes that hide regressions.

## Files to create

- `src/__tests__/unit/editor/menu-page-links.test.ts` — pure helper
- `src/__tests__/unit/editor/editor-coach-marks.test.tsx` — RTL behaviour

## Files to modify

- `src/__tests__/unit/editor/page-manager.test.tsx` — update title assertion, add tooltip + menu-link assertions
- `src/__tests__/unit/editor/f05-save-and-nav.test.ts` — sync local mirror of `getStatusBadge` (file already self-flags this in its comment, see `:409-410`)

## Test cases (with TC-IDs to be added to QA doc in P6)

### `menu-page-links.test.ts` — pure unit (no React)

Maps to **TC-F05-02-13** (new):

```ts
describe('collectMenuPageIds', () => {
    it('returns empty set when no links', () => { ... })
    it('treats homepage page as always linked', () => { ... })
    it('matches page by slug regardless of leading slash', () => {
        // link.url='/about', page.slug='about' → matched
    })
    it('walks nested children', () => { ... })
    it('skips external link types even with same slug', () => { ... })
    it('handles mixed case + whitespace via normalizeSlug', () => { ... })
    it('returns ID set keyed by string (matches PageData.id)', () => { ... })
})
```

### `page-manager.test.tsx` updates

Maps to **TC-F05-02-14** (new):

- Update existing render assertions: panel title text now `"Page Library"` (or i18n value).
- Assert micro-copy text present.
- Assert no `<input>` with placeholder containing "Search".
- Add cases:
  - given page in menu + published + site published → badge label = "Live", tooltip on hover shows tooltipLive copy
  - given page published but not in menu → badge = "Draft", tooltip = tooltipDraft
  - given page in menu but page.status='draft' → badge = "Draft"
  - given page in menu but siteStatus='draft' → badge = "Draft"

Use `userEvent.hover(badge)` then `await screen.findByText(/đã được add/)` for tooltip assertion.

### `f05-save-and-nav.test.ts` mirror update

Section 3 of this file (`:384-460`) contains a *deliberate local mirror* of `getStatusBadge`. Update the mirror to take `menuPageIds: Set<string>` and re-derive `inMenu`. Comment already warns "Must stay in sync" — this is the sync.

Add new TC-F05-02-15 assertions:
- mirror Live ↔ Draft transitions match the production component for the new menu-link condition

### `editor-coach-marks.test.tsx`

Maps to **TC-F05-02-16** (new):

```tsx
describe('EditorCoachMarks', () => {
    beforeEach(() => { localStorage.clear() })

    it('renders nothing when localStorage flag is set', () => { ... })
    it('renders step 1 popover after mountDelayMs when flag absent', async () => { ... })
    it('clicking next calls onEnterStep2 and shows step 2', async () => { ... })
    it('clicking finish writes localStorage flag and unmounts UI', async () => { ... })
    it('skip at step 1 also writes flag', async () => { ... })
    it('handles missing anchor gracefully (returns null)', () => { ... })
})
```

Mock `[data-coach=...]` anchors by rendering them in the test wrapper.

## Implementation steps

1. Run `npm test src/__tests__/unit/editor/page-manager.test.tsx` — observe failures from rename.
2. Update assertions to expect new copy.
3. Add menu-link tests with mocked `menuPageIds` prop.
4. Create `menu-page-links.test.ts` — copy patterns from existing pure-function tests in `src/__tests__/unit/`.
5. Create `editor-coach-marks.test.tsx` — set up DOM with anchor divs, render, advance fake timer, assert Popover content.
6. Update `f05-save-and-nav.test.ts` mirror to match new `getStatusBadge` signature.
7. Run full suite: `npm test`. Fix until 100% green for new + edited files.

## Acceptance criteria

- [ ] All new tests pass on first green run
- [ ] No skipped/`.todo` tests
- [ ] No mocking of `PageManagerPanel` internals — only props + DOM
- [ ] `f05-save-and-nav.test.ts` mirror still matches source (manually diff after sync)
- [ ] No reduction in coverage on `PageManagerPanel.tsx` (Vitest coverage report)

## Risk

| Risk | Mitigation |
|------|-----------|
| RTL `userEvent.hover` flaky for tooltip in jsdom | Use Radix Tooltip's `delayDuration={0}` in test wrapper, await `findByText` |
| `localStorage` global access in jsdom | Vitest provides it natively; `beforeEach` clears |
| Fake-timer mismatch with `setTimeout` mount delay | Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)` |
