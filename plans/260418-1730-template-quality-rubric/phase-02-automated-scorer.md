# Phase 02 — Automated Scorer (harness:score)

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (rubric JSON)
- Reuses: harness infrastructure (`scripts/test-harness/*`)

## Overview
Date: 2026-04-18
Description: Build `harness:score` CLI — reads rubric-v1.json + matrix.json → scores each fixture → HTML report dashboard.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- Reuse matrix.json block data (already stored per fixture), no browser rendering needed
- Score output augments existing `structural-report.json` → `combined-report.json` enhancement
- HTML dashboard: mỗi template = 1 card với weighted score + dimension breakdown bar + pass/fail criteria list
- CLI modes: `--verbose` (per-criterion detail), `--category=tech` (filter), `--threshold=7` (override pass bar)

## Requirements
- Load rubric JSON, evaluate each criterion against block data
- Per dimension: compute score 0-10 = sum(criterion passed points) / max possible × 10
- Weighted total = sum(dimension score × weight) / total weight
- Output 3 artifacts:
  1. `.harness-out/rubric-report.json` — raw data for automation
  2. `.harness-out/rubric-report.html` — dashboard for humans
  3. Terminal summary — top 5 passing, bottom 5 failing

## Architecture
```
scripts/test-harness/
  ├── rubric/
  │    ├── rubric-v1.json            (from Phase 01)
  │    ├── rubric.schema.ts
  │    ├── scorer.ts                 (NEW — evaluate logic)
  │    ├── report-generator.ts       (NEW — HTML dashboard)
  │    └── evaluators/               (NEW — custom check functions)
  │         ├── evaluator-index.ts
  │         ├── visual-richness.ts
  │         └── ...
  └── cli.ts                         (extend with --mode=score)

package.json:
  "harness:score": "tsx scripts/test-harness/cli.ts --mode=score"
```

Scorer algorithm:
```ts
for (const fixture of matrix.results) {
  const dimensionScores = rubric.dimensions.map(dim => {
    const criteriaResults = dim.criteria.map(c => evaluateCriterion(c, fixture))
    const earned = criteriaResults.reduce((s, r) => s + r.points, 0)
    const maxPossible = dim.criteria.reduce((s, c) => s + c.passPoints, 0)
    return { id: dim.id, score: (earned / maxPossible) * 10, breakdown: criteriaResults }
  })
  const weighted = dimensionScores.reduce((s, d) => s + d.score * dim.weight, 0) / totalWeight
  fixtureScores.push({ fixtureId, dimensions: dimensionScores, weighted })
}
```

HTML report: use same pattern as `.harness-out/report.html` (existing `report/generate.ts`).

## Related code files
- `scripts/test-harness/cli.ts` (CLI entry, extend modes)
- `scripts/test-harness/report/generate.ts` (HTML gen pattern to reuse)
- `scripts/test-harness/types.ts` (MatrixReport type)
- `.harness-out/matrix.json` (input data)

## Implementation Steps
1. Create `rubric/evaluators/evaluator-index.ts` — export `evaluateCriterion(criterion, blocks) → {pass, partial, points, reason}`
2. Implement 4 check types: `presence`, `count`, `ratio`, `enum` (skip `custom` for v1)
3. Create `rubric/scorer.ts` — main scoring loop
4. Create `rubric/report-generator.ts` — HTML output (card grid, dimension bars)
5. Extend `cli.ts` with `--mode=score` branch
6. Add `harness:score` to package.json
7. Test run on matrix.json, inspect output quality
8. Commit

## Todo list
- [ ] evaluator-index.ts + 4 check types
- [ ] scorer.ts main loop
- [ ] report-generator.ts HTML
- [ ] cli.ts mode=score
- [ ] package.json script
- [ ] Run + verify output
- [ ] Commit

## Success Criteria
- `npm run harness:score` completes in <5s on 390 fixtures
- Output JSON validates: every fixture has 8 dimension scores + weighted total
- HTML dashboard clickable per fixture card → show criterion detail
- Terminal summary hiển thị top 5 / bottom 5

## Risk Assessment
- **Medium**: Custom evaluators cho subjective criteria (color harmony, visual rhythm) khó viết. V1 skip custom, chỉ do presence/count/ratio.
- **Low**: HTML report file size — với 390 fixtures × 8 dim × 6 criteria = ~18K rows of data. Use pagination or category filter.

## Security Considerations
- None — local CLI, no network, no user input.

## Next steps
- Phase 03: Run baseline + document which templates fail which dimensions.
