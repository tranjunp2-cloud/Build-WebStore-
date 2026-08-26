# Phase 04 — Index Page Integration

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (scorer-lib)
- Modifies: `src/app/test-harness/page.harness.tsx`

## Overview
Date: 2026-04-18
Description: Thêm score column + status dot vào 56 fixture buttons trên `/test-harness` index page. Link admin dashboard từ header.
Priority: P2
Implementation status: pending
Review status: not started

## Key Insights
- Index hiện tại: 14 categories × 4 presets buttons. Score thêm inline sẽ crowded → chỉ hiện nhỏ hoặc color-coded dot.
- Per-category avg score in header của section = quick overview
- Link "Open Dashboard →" ở top trang

## Requirements
- Top header: "Open Admin Dashboard →" button (navigate `/test-harness/admin`)
- Per-category section header: `Beauty (4 presets · avg 8.9/10)` với status breakdown pill `3 pass · 1 warn`
- Each fixture button: status dot emoji (🟢 pass / 🟡 warn / 🔴 fail) + score small text inline
- Graceful fallback if no score data: hide dots, show CTA "Run `npm run harness:score` to enable"

## Architecture

Modify existing `src/app/test-harness/page.harness.tsx`:
```tsx
// Server component — load both matrix + score report
const matrix = loadMatrix()
const report = readPrecomputedReport()  // nullable

// Enrich fixture list with score lookup
const byCategory = buildByCategory(matrix, report)
```

Score lookup helper:
```ts
function getFixtureScore(fixtureId: string, report: RubricReport | null): FixtureScore | undefined {
  return report?.fixtures.find(f => f.fixtureId === fixtureId)
}
```

Category summary helper:
```ts
function categoryStats(cat: string, report: RubricReport | null): { avg, pass, warn, fail } | null
```

## Related code files
- `src/app/test-harness/page.harness.tsx` (modify)
- `scripts/test-harness/rubric/scorer-lib.ts` (read helpers)

## Implementation Steps
1. Import scorer-lib helpers in index page
2. Load rubric-report.json alongside matrix.json
3. Compute per-category stats (avg, pass/warn/fail counts)
4. Update category section header to show stats badge
5. Update fixture button layout to include status dot + mini-score
6. Add "Open Admin Dashboard →" link in page header
7. Fallback UI when report null (subtle info banner)
8. Typecheck + visual verify
9. Commit

## Todo list
- [ ] Import scorer-lib + load report
- [ ] categoryStats helper
- [ ] Update category headers
- [ ] Update fixture button layout
- [ ] Admin link in header
- [ ] Fallback UI
- [ ] Visual QA
- [ ] Commit

## Success Criteria
- Index shows per-category avg + status breakdown
- Fixture buttons have status dot + mini-score
- Top header link → admin
- Graceful fallback when scores missing
- Page still loads <1s

## Risk Assessment
- **Low**: read-only server component, no state changes
- **Low**: layout real estate tight — test on narrow viewport, ensure dot + score không overflow

## Security Considerations
- Read-only, no user input impact.

## Next steps
- Phase 05: Polish + cleanup (remove old static HTML, update docs).
