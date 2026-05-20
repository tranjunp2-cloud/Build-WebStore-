# Phase 04 — Baseline v1.1 + Docs + Calibration

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01-03

## Overview
Date: 2026-04-18
Description: Run baseline scoring with v1.1, tune any wild thresholds, update docs, write delta report.
Priority: P1
Status: pending

## Key Insights
- Expected: avg drop từ 8.96 → 6.5-7.2 range (per researcher prediction)
- Nếu drop quá mạnh (<5 avg) → rubric over-tightened, tune back
- Nếu drop không đủ (>8) → still too easy, tighten more

## Requirements
- Run `npm run harness:score -- --rubric=v1.1`
- Compute delta vs v1 baseline: per-dim avg shifts, fixtures flipped from pass→warn/fail
- Write delta report `reports/04-v1.1-baseline.md`
- Update `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` với v1.1 spec section
- Tune 1-2 criteria if baseline wildly off-target

## Architecture
No new code. Run + analyze + doc.

Delta report structure:
```
- v1 summary (from prior baseline)
- v1.1 summary (new)
- Per-dim comparison (8 rows: v1 avg, v1.1 avg, delta)
- Flipped fixtures (v1 pass → v1.1 warn/fail): count + sample list
- Top 5 v1.1 (reference templates)
- Bottom 5 v1.1 (fix priorities)
- Calibration notes (if any criterion tuned)
- Recommendations (next wave of fixes, rubric v1.2)
```

## Related code files
- `.harness-out/rubric-report-v1.json`, `rubric-report-v1.1.json` (inputs)
- `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` (update)
- `plans/260418-2000-rubric-v1.1-stricter/reports/04-v1.1-baseline.md` (new)

## Implementation Steps
1. Regen matrix: `npm run harness:gen`
2. Run v1.1: `npm run harness:score -- --rubric=v1.1`
3. Run v1 for delta: `npm run harness:score -- --rubric=v1`
4. Compute delta stats (node script or manual)
5. Sanity check: avg in range 5.5-7.5
   - If <5.5 → loosen 1-2 strictest criteria
   - If >7.5 → tighten further (raise threshold or add stricter check)
6. Write delta report MD
7. Update TEMPLATE_QUALITY_RUBRIC.md:
   - Add v1.1 spec section
   - Version comparison table
   - New criteria list
   - Default version = v1.1 note
8. Commit

## Todo list
- [ ] Regen matrix
- [ ] Run v1.1 baseline
- [ ] Run v1 baseline for delta
- [ ] Compute delta
- [ ] Sanity check avg range
- [ ] Tune if needed (note in report)
- [ ] Write delta report
- [ ] Update TEMPLATE_QUALITY_RUBRIC.md
- [ ] Commit

## Success Criteria
- v1.1 baseline avg in 5.5-7.5 range
- Delta report captures:
  - v1 vs v1.1 per-dim score shift
  - N fixtures flipped pass→warn/fail (expected 40-60%)
  - Top 5 + bottom 5 under v1.1
- Docs updated reflecting v1.1 as default
- Admin dashboard shows v1.1 scores out-of-box

## Risk Assessment
- **Medium**: baseline may surprise — some fixtures may fail hard due to hardcoded content gaps not previously scored. Document as "next fix wave".
- **Low**: doc update mechanical.

## Security Considerations
- None.

## Next steps
- Plan complete. Potential follow-up: Phase 05 "Fix bottom 20 templates" plan if baseline reveals clear targets.
