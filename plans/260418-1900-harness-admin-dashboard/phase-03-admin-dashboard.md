# Phase 03 — Admin Dashboard `/test-harness/admin`

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (scorer-lib)
- Replaces: static `.harness-out/rubric-report.html` (5MB one-file dashboard)

## Overview
Date: 2026-04-18
Description: Build React admin dashboard page tại `/test-harness/admin` — replace static HTML. Interactive filter/sort, drill-down per fixture, link navigate to fixture render.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- Admin reads pre-computed `.harness-out/rubric-report.json` — fast load 390 fixtures
- If JSON missing → show CTA "Run `npm run harness:score` first"
- Stale detection: compare mtime of rubric-report.json vs matrix.json, warn if older
- Client filters: status, category, score range — all client-side (data loaded once)

## Requirements
- Stats bar: total / pass / warn / fail / avg
- Per-dimension average bar (8 dims)
- Filter buttons: status (all/pass/warn/fail), category (14 cats), sort (score desc/asc, id alpha)
- Card grid: 390 fixtures, each card = 1 fixture with:
  - Fixture id + category tag
  - Weighted score big + status tag
  - 8 dimension mini-bars
  - Click fixture id → open `/test-harness/<id>` in new tab
  - Expand criteria → drill details per dim
- Stale warning banner when needed

## Architecture

```
src/app/test-harness/admin/
  ├── page.admin.harness.tsx        (NEW — server component, loads JSON)
  ├── AdminClient.tsx               (NEW — client component with filters + state)
  ├── FixtureCard.tsx               (NEW — per-fixture card)
  └── styles.ts                     (NEW — inline style objects)
```

Next.js App Router consideration:
- Gated by `.harness.tsx` extension → `page.admin.harness.tsx` will match when `ENABLE_HARNESS=1`
- Route literal `/admin` precedes dynamic `[fixtureId]` in Next routing priority → no collision

Server component loads data:
```ts
import { readPrecomputedReport, readMatrixJson } from '@/scripts/.../scorer-lib'
const report = readPrecomputedReport()  // may be null
const matrix = readMatrixJson()
const stale = isStale(report, matrix)  // mtime comparison
```

Client component:
```tsx
'use client'
function AdminClient({ report }: { report: RubricReport }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<'score-desc' | 'score-asc' | 'id'>('score-desc')
  const filtered = useMemo(() => applyFilters(report.fixtures, ...), [...])
  return <>{...layout}</>
}
```

## Related code files
- `src/app/test-harness/page.harness.tsx` (existing index — reference for server component pattern)
- `scripts/test-harness/rubric/scorer-lib.ts` (from Phase 01)
- `scripts/test-harness/rubric/report-html.ts` (existing HTML layout — port to React)

## Implementation Steps
1. Create `admin/page.admin.harness.tsx` — server, load data, handle missing JSON state
2. Create `AdminClient.tsx` client component — filter/sort state, use `useMemo` for derived lists
3. Create `FixtureCard.tsx` — presentational card, collapsible criteria drill
4. Port CSS from report-html.ts as inline style objects (keep dark theme for consistency with harness)
5. Add "Re-run score" button (calls API route to trigger `harness:score`? Or just show command to copy) — v1 just show command
6. Stale warning banner component
7. Verify `/test-harness/admin` renders, filters work, card count matches
8. Commit

## Todo list
- [ ] Create admin server component (page.admin.harness.tsx)
- [ ] Missing-JSON fallback UI
- [ ] AdminClient.tsx with filters + sort
- [ ] FixtureCard.tsx with drill-down
- [ ] Inline styles (dark theme)
- [ ] Stale warning
- [ ] Test filter + sort scenarios
- [ ] Commit

## Success Criteria
- `/test-harness/admin` renders 390 cards in <2s
- Filter buttons work (status, category, sort)
- Click fixture id → opens render in new tab
- Expand criteria detail → shows pass/fail reasons
- Missing-JSON state shows CLI instruction
- Stale warning appears khi matrix mới hơn score JSON
- Mobile responsive (min-width 420px works)

## Risk Assessment
- **Medium**: 390 cards client-side filter may be slow — test với React dev tools. If needed: pagination (50/page) or virtual scroll.
- **Low**: Inline styles verbose but survive theme leakage (same pattern em đã dùng cho index page).
- **Low**: Data loading from disk at request time — fs.readFileSync blocks 1 thread per request. Next dev is fine, production uses edge caching anyway.

## Security Considerations
- Admin route gated by .harness.tsx extension — `ENABLE_HARNESS=1` only. Production never exposes.
- No user input in filters (all client-side filter of static data).

## Next steps
- Phase 04: Integrate score summary into `/test-harness` index page.
