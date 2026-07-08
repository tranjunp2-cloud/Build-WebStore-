# Phase 04 — Regen + Re-score + Verify

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01, 02, 03

## Overview
Date: 2026-04-19
Description: Regen matrix, re-score v1.2, verify a11y dim 6.3 → 9.0+.
Priority: P1
Status: pending

## Key Insights
- After 3 fixes, 3 criteria chuyển trạng thái:
  - nav-aria-label: 0% → 100%
  - focus-indicator-defined: 0% → 100%
  - theme-color-contrast: 50% → 90%+
- Each critical = +2 pts earned trong dimension.
  - Before: 4/10 (4 pts) pts earned trên 9 max? → wait 8 max. Let me recompute.
  - Dim weight 8. Criteria: alt 2 + heading 2 + contrast 2 + aria 1 + focus 1 = 8 max pts
  - Before: alt(2) + heading(2) + contrast(1 or 2 half-credit) + 0 + 0 = 5-6/8 pts
  - After: 2+2+2+1+1 = 8/8 → dim score 10/10
- Overall rubric avg boost: a11y dim weight 8 going 6.3→10 = ~0.3 points weighted avg (8.37 → 8.65)

## Requirements
- Regen matrix (capture new aria + focusStyle + adjusted colors)
- Run scorer v1.2
- Write delta report
- Commit final state

## Implementation Steps
1. `npm run harness:gen` (fresh matrix với phase 01/02/03 changes)
2. `npm run harness:score -- --rubric=v1.2`
3. Extract a11y dim + criterion stats
4. Compare to baseline v1.2 (avg 8.37, a11y 6.3)
5. Write `reports/04-a11y-fixed-delta.md`
6. Commit

## Todo list
- [ ] Regen matrix
- [ ] Run scorer
- [ ] Compute delta
- [ ] Delta report
- [ ] Commit

## Success Criteria
- a11y dim avg 9.0+/10 (from 6.3)
- Overall rubric avg 8.6+/10 (from 8.37)
- 3 failed criteria flipped to 90%+ pass rate
- No regressions in other dimensions
- typecheck + tests pass

## Risk Assessment
- Low: data verification only, không code change
- Medium: if a11y dim không jump as expected — investigate specific evaluator logic

## Security Considerations
- None

## Next steps
- Plan complete. Future: runtime a11y testing (axe-core + Playwright) — separate plan.
