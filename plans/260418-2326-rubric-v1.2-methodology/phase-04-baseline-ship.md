# Phase 04 — Baseline v1.2 + Ship Default

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01-03

## Overview
Date: 2026-04-18
Description: Run baseline v1.2 scoring, update scorer-lib DEFAULT_RUBRIC_VERSION='v1.2', update admin/overlay to show v1.2 default, write delta report, update docs.
Priority: P1
Status: pending

## Key Insights
- Target avg 5.8-6.5 — verify meeting
- Differentiation std dev should triple (0.5 → 1.5)
- DEFAULT_RUBRIC_VERSION switch = admin + overlay default view change
- v1 + v1.1 still callable via `--rubric=v1|v1.1` (backward compat)

## Requirements
- Regen matrix (nếu có template changes)
- Run `npm run harness:score -- --rubric=v1.2`
- Compute delta vs v1.1
- Update DEFAULT_RUBRIC_VERSION trong scorer-lib
- Admin server component reads default v1.2 report
- Score overlay badge text → "Rubric wix-pro-v1.2"
- Write `reports/04-v1.2-baseline.md` với delta analysis
- Update TEMPLATE_QUALITY_RUBRIC.md + methodology doc với v1.2 info

## Architecture
No new files. Modifications:
- `scripts/test-harness/rubric/scorer-lib.ts`: DEFAULT_RUBRIC_VERSION = 'v1.2'
- `src/app/test-harness/_components/score-overlay.tsx`: footer label displays current version
- `docs/standards/TEMPLATE_QUALITY_RUBRIC.md`: add v1.2 section
- `docs/standards/TEMPLATE_QUALITY_RUBRIC_METHODOLOGY.md`: update version evolution table

## Related code files
- `.harness-out/rubric-report-v1.1.json` (for delta comparison)
- `.harness-out/rubric-report-v1.2.json` (new output)
- `scripts/test-harness/rubric/scorer-lib.ts` (default version)
- `src/app/test-harness/_components/score-overlay.tsx` (badge text)
- `src/app/test-harness/admin/page.harness.tsx` (picks default)
- `src/app/test-harness/page.harness.tsx` (picks default)

## Implementation Steps
1. `npm run harness:gen` (regen matrix fresh)
2. `npm run harness:score -- --rubric=both` (v1 + v1.1 reference) then `-- --rubric=v1.2`
3. Verify baseline avg in target range 5.8-6.5
   - If avg <5 → loosen 2-3 strictest criteria (note in report)
   - If avg >6.5 → tighten 1-2 (e.g., contentDepth500 → 700)
4. Switch `DEFAULT_RUBRIC_VERSION` → 'v1.2' in scorer-lib
5. Verify admin + overlay now show v1.2 by default
6. Write delta report (v1.1 vs v1.2, per-dim shifts, flipped fixtures, top 10 / bottom 10)
7. Update TEMPLATE_QUALITY_RUBRIC.md Versioning section
8. Commit all

## Todo list
- [ ] Regen matrix
- [ ] Baseline v1.2
- [ ] Sanity check avg range
- [ ] Calibrate if out-of-range
- [ ] DEFAULT_RUBRIC_VERSION=v1.2
- [ ] Admin + overlay verify
- [ ] Delta report
- [ ] Docs update
- [ ] Commit + push

## Success Criteria
- v1.2 avg 5.8-6.5 (differentiation achieved)
- Admin `/test-harness/admin` defaults to v1.2 cards
- Score overlay badge labels "wix-pro-v1.2"
- v1 + v1.1 still callable via query `?v=v1.1`
- Delta report documents:
  - 8 dim avg shifts (v1.1 → v1.2)
  - Count fixtures flipped pass→warn/fail
  - Category DNA failure distribution per category
  - Accessibility dim average (gauge for future a11y push)
- Dev server + typecheck pass

## Risk Assessment
- **Medium**: if avg <5 → rubric too punishing, users see 80% fail, may disengage. Have calibration plan: loosen 2 criteria.
- **Low**: backward compat broken if admin forgets ?v=v1 → test query routing.
- **Medium**: Category DNA dim fails template if fixture.category mismatches block set. Audit data first.

## Security Considerations
- None.

## Next steps
- Plan complete. Future: v1.3 cross-fixture uniqueness, Lighthouse-level runtime checks.
