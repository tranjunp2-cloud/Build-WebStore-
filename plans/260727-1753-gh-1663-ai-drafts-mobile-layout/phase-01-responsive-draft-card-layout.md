# Phase 01 — Implement Responsive Draft-Card Layout

## Context Links

- Parent: [GH-1663 plan](./plan.md)
- Issue: [primeproduction/ech-prime-web-v2#1663](https://github.com/primeproduction/ech-prime-web-v2/issues/1663)
- Component: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/src/components/dashboard/BulkCreateModal.tsx`
- Shared input: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/src/components/ui/input.tsx`
- Existing QA registry: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/docs/qa/F08-product-crud.md`

## Overview

- Date: 2026-07-27
- Priority: P1
- Effort: 2h
- Implementation status: Completed
- Review status: Implementation complete; PR re-review awaiting documentation-fix confirmation
- Goal: replace the compressed mobile row with a single-DOM responsive field grid while
  preserving all data and desktop behavior.

## Key Insights

- Card, labels, and inputs are always horizontal at `BulkCreateModal.tsx:536-589`.
- At 375px, the single horizontal flex row makes fixed thumbnail/remove/Price/Stock controls
  consume nearly all width; Name gets ~15px.
- Variants is explicitly hidden below `md` at lines 545 and 586.
- `updateProduct`, `updateAllVariantsStock`, `removeProduct`, and `handleSave` are correct and
  outside this phase.
- Duplicating mobile/desktop controlled inputs would create duplicate accessible fields and state
  ambiguity; restructure one field tree instead.

## Requirements

### Functional

- Product Name: own full-width mobile row and remain editable.
- Price and Stock: two equal mobile columns; retain current numeric coercion and variant-stock
  semantics.
- Variants: own full-width mobile row, wrap long/multiple names, remain read-only.
- Remove: remain associated with the correct draft and be touch-usable.
- Desktop `md+`: visually preserve Name/Price/Stock/Variants row.

### Non-Functional

- No horizontal scrolling at 375–430px.
- Short viewport: header/footer remain reachable; draft list owns vertical scrolling.
- Use semantic `<label htmlFor>` or equivalent accessible names for all inputs.
- No duplicate input DOM, JS viewport branching, new dependency, or business-state change.

## Architecture

Use a responsive CSS grid inside each draft card:

```text
mobile (<md)
┌ thumbnail / compact header / remove ┐
├ Product name — full width           ┤
├ Price (1/2)       │ Stock (1/2)     ┤
└ Variants — full width, wrapping     ┘

desktop (md+)
thumbnail │ Name flex │ Price │ Stock │ Variants │ remove
```

Keep one wrapper per field (`label + control/value`). Change only ordering, spans, widths, and
visibility classes at breakpoints. Continue reading/writing the same `p` object and handlers.
Retain `min-w-0` on flexible grid items: it is required for long content to shrink inside its
track. The regression is caused by the fixed siblings in the current horizontal row, not by
`min-w-0` itself.

## Related Code Files

### Modify

- `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/src/components/dashboard/BulkCreateModal.tsx`
  — draft-card markup/classes and accessible labels only.

### Create

- None.

### Delete

- None.

## Implementation Steps

1. Continue on the already-created `fix/f08-1663-ai-drafts-mobile-layout` branch from `staging`;
   rebase/resolve pending Category Integrity Phase 09 first if it lands before implementation.
2. Limit the diff to the draft-card render block around lines 536–599.
3. Replace parallel label/input rows with field wrappers in one responsive grid.
4. Make Name span full mobile width. Keep `min-w-0` on its flexible wrapper so long names remain
   bounded by the grid track.
5. Place Price and Stock in two mobile columns; preserve `min`, coercion, tooltip, and handlers.
6. Render Variants on mobile with `min-w-0 whitespace-normal break-words`; preserve read-only
   semantics and never hide overflow to mask a layout defect.
7. Keep desktop column widths/visual alignment from `md`; compare before/after at 768 and 1280px.
8. Give Name/Price/Stock stable accessible labels; retain remove `aria-label`.
9. Review remove control at 44×44px mobile target without enlarging desktop layout unnecessarily.
10. Verify modal body remains the only vertically scrollable region with 5+ drafts.

## Todo List

- [x] Dedicated branch created from current `staging`
- [x] Single responsive field tree implemented
- [x] Name full-width and editable on mobile
- [x] Price/Stock two-column mobile layout
- [x] Variants visible, wrapping, and read-only
- [x] Remove control implemented with a 44×44px mobile target
- [x] Accessible labels added
- [x] Desktop `md` row alignment and horizontal bounds regression-covered at 768px in Phase 02
- [x] No parse/save/category/state code changed

## Implementation Evidence

- Source change is limited to the draft-card presentation block in `BulkCreateModal.tsx`.
- Existing `updateProduct`, `updateAllVariantsStock`, `removeProduct`, parse, category, and save
  behavior is unchanged.
- Targeted validation passed: 56/56 Vitest tests, `npm run typecheck`, and `git diff --check`.
- Focused implementation review approved the change at 9.7/10 with no critical findings.
- On 2026-07-28, authenticated Chromium setup plus TC-F08-04-94..96 passed 4/4 with the strengthened
  usable-width, containment, horizontal-order, and non-intersection assertions. No comparison
  screenshot was retained.

## Success Criteria

- 375px Name input is not compressed and does not intersect Price, Stock, thumbnail, or remove.
- 430px and `md+` layouts have no overflow or unexpected wrapping.
- Long variant list is visible on mobile and grows the card vertically.
- Editing Name/Price/Stock and removing a draft still updates the intended draft.
- Dark/light token styling remains inherited from shared components.

## Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Desktop regression from markup restructure | Medium | Preserve `md` widths; compare 768/1280 screenshots |
| Duplicate controlled inputs | High | One DOM tree; CSS grid only |
| Category Integrity merge conflict | Medium | Rebase first; edit render block only |
| Long variants make cards tall | Low | Expected vertical growth; body already scrolls |
| Mobile keyboard hides footer | Medium | Validate short viewport; keep body scroll and footer outside it |

## Security Considerations

- No auth, API, tenant, or persistence change.
- Continue treating AI text as display/input state; existing sanitization remains in save payload.
- Do not introduce `dangerouslySetInnerHTML`.

## Completion Note

Phase 02 completed the browser regression, QA registry, discovery verification, and staging
allow-list integration. A 1280px screenshot was not retained and is not claimed as completion
evidence.
