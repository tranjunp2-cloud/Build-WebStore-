# Phase 03 — Baseline Scoring Run + Gap Report

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 02 (scorer working)

## Overview
Date: 2026-04-18
Description: Run scorer trên 56 blueprint presets, generate baseline report, categorize templates theo score bucket.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- Baseline xác định gap priority — Phase 04 + 05 fix theo data thật, không guess
- Expected outcome: most templates score 4-6 weighted (under Wix-pro 7+ threshold) due to known gaps (Logo Cloud, color, avatars)
- Per-dimension gap = prioritization signal: dimension với avg < 5 across 56 = highest ROI to fix

## Requirements
- Run harness:score trên full matrix
- Generate per-category summary: avg weighted, worst dimension, count pass/warn/fail
- Identify bottom 10 fixtures — candidates for fix focus
- Document findings in `reports/03-baseline-report.md`

## Architecture
No new code. Just run existing scorer + write analysis MD.

Report structure:
```
reports/03-baseline-report.md
├── Overall summary (56 fixtures, avg weighted, pass/warn/fail counts)
├── Per-dimension average (8 rows)
├── Per-category breakdown (14 rows)
├── Bottom 10 fixtures (need most work)
├── Top 10 fixtures (Wix-pro reference)
├── Per-criterion failure rate (what's systematically broken)
└── Recommendations for Phase 04 + 05 priorities
```

## Related code files
- `.harness-out/rubric-report.json` (scorer output)
- `.harness-out/rubric-report.html` (dashboard)

## Implementation Steps
1. `npm run harness:gen` (refresh matrix)
2. `npm run harness:score` → rubric-report.json
3. Analyze JSON: compute aggregate stats
4. Write `reports/03-baseline-report.md` với tables + recommendations
5. Commit report

## Todo list
- [ ] Regen matrix
- [ ] Run scorer
- [ ] Write baseline report MD
- [ ] Commit

## Success Criteria
- Baseline report documents:
  - Weighted avg across 56 fixtures (number)
  - Count pass (≥7) / warn (5-6.99) / fail (<5)
  - Per-dimension avg (8 numbers)
  - Bottom 10 list với main failure reasons
  - Actionable Phase 04/05 recommendations

## Risk Assessment
- **Low**: Just data analysis, no code changes.
- Concern: If many templates already >7 (unlikely based on gaps), rubric too lenient → revise weights in v1.1.

## Security Considerations
- None.

## Next steps
- Phase 04 + 05 execute fixes based on baseline findings (potentially parallel).
