# Phase 06 — Re-score + Acceptance

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 04 + Phase 05 complete

## Overview
Date: 2026-04-18
Description: Re-run scorer, compare baseline vs post-fix, confirm goal ≥80% templates score ≥7 weighted. Document acceptance.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- Final validation gate — if fail, iterate on Phase 04/05 targeted at worst dimensions
- Side-by-side baseline (Phase 03) vs current = data-driven progress narrative for stakeholders

## Requirements
- Regen matrix (latest block data)
- Run `npm run harness:score`
- Generate delta report: baseline (Phase 03) vs current
- Acceptance criteria sign-off

## Architecture
No new code. Analysis + doc only.

Delta report structure (`reports/06-acceptance-report.md`):
```
- Executive summary (N/56 pass threshold, delta vs baseline)
- Per-dimension score delta (8 rows, baseline → current)
- Per-category score delta (14 rows)
- Before-after visual snapshots (2-3 fixtures)
- Outstanding gaps (templates still failing)
- Recommendations for next wave
```

## Related code files
- `.harness-out/rubric-report.json` (post-fix scorer output)
- `plans/260418-1730-template-quality-rubric/reports/03-baseline-report.md` (comparison base)

## Implementation Steps
1. Regen matrix after Phase 04 + 05 merges
2. Run `npm run harness:score`
3. Compute delta vs baseline report
4. Take 2-3 before/after screenshots (same fixture, before Phase 04 vs after)
5. Write acceptance report
6. If ≥80% pass → mark plan complete. Else → Phase 07 remediation (create new phase).

## Todo list
- [ ] Regen matrix
- [ ] Run scorer
- [ ] Compute delta
- [ ] Screenshots comparison
- [ ] Write acceptance report
- [ ] Plan status update (pending → done or identify Phase 07)

## Success Criteria
- Overall weighted avg improvement: baseline → current (+X points)
- ≥80% templates score ≥7/10 (44/56 pass)
- Every dimension avg score improved (no regressions)
- Visual richness + Social Proof dimensions moved significantly (main Phase 04/05 targets)
- Report doc ready for stakeholder review

## Risk Assessment
- **Low**: Scorer determinism — same input should yield same score. If flaky, investigate non-determinism in rubric.
- **Medium**: If <80% pass, need triage — weight rubric lenient or do more fix work?
  - Guideline: if most templates at 6.5-6.9, tune rubric weights slightly (post-hoc rationalization OK for v1, document).
  - If templates at 5 or below, more fix work needed.

## Security Considerations
- None — reporting only.

## Next steps
- If pass: archive plan, merge fixes into staging.
- If fail: create Phase 07 for remaining gaps, re-run.
- Long-term: rubric v2 with additional dimensions (a11y, performance, i18n coverage).
