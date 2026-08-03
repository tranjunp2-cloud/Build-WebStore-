---
date: 2026-07-22
session: gh-1627-phase-2-dashboard-widget
---

# Journal: 2026-07-22 — GH-1627 Phase 2 Dashboard Widget

## Context

Phase 2 connected the Pending Orders dashboard block to the secure loader from Phase 1 and replaced its placeholder UI with real tenant-scoped data.

## What Happened

- Added the four server-side load gates and suppressed both the query and widget for unauthorized users.
- Isolated Pending Orders loader failures into a localized unavailable state so other dashboard blocks continue rendering.
- Implemented the real accessible, responsive Pending Orders UI with counts, rows, order links, empty state, and unavailable state.
- Added matching English and Malay translations.
- Kept Orders disabled by default in dashboard preferences and removed its `Soon` treatment.
- Updated one stale `dashboard-blocks` assertion to match the now-available Orders block.
- Verified the dashboard suite at 1051/1051 tests, loader regression suite at 27/27 tests, and TypeScript typecheck.
- Code review scored 9.8/10 with zero critical findings and zero warnings.

## Reflection

The implementation stayed within the reduced scope: permission enforcement remains local to Pending Orders, failures degrade only this optional block, and no global authorization or customization behavior changed. The focused change to the stale assertion kept the test suite aligned without broad test churn.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Require all four server gates before loading | Avoid unnecessary queries and unauthorized data exposure | Unauthorized users receive neither the query nor widget |
| Represent loader failure as unavailable | Optional data must not take down the dashboard | Other blocks remain usable during Orders failures |
| Keep Orders off by default without `Soon` | Preserve opt-in behavior while marking the block as implemented | Existing users are not opted in automatically |
| Defer browser matrix and final QA mapping to Phase 3 | Phase 2 established implementation and unit-level confidence | Phase 3 owns acceptance coverage and viewport validation |

## Next Steps

- Complete the Phase 3 QA case mappings and resolve direct TC-ID conflicts.
- Add the planned component/page coverage for ready, empty, unavailable, authorization, and failure-isolation paths.
- Validate browser behavior at the planned 375px, 768px, and 1280px viewport matrix.
