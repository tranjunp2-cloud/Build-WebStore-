# Phase 01 — Scorer Library Module

## Context links
- Parent: [plan.md](plan.md)
- Research: `research/researcher-01-scorer-integration.md`
- Prior work: rubric scorer (plan 260418-1730, commits 5e38d6e6 + 327dab66 + d9bb4143)

## Overview
Date: 2026-04-18
Description: Tách scoring logic khỏi CLI entry point, cho server components import + call trực tiếp. Giữ CLI backward-compatible.
Priority: P1 (blocker cho Phase 02/03/04)
Implementation status: pending
Review status: not started

## Key Insights
- Current scorer.ts mix cả logic + CLI (process.argv check, console.log, fs write). Cần split.
- evaluators.ts + rubric.schema.ts đã pure — OK reuse.
- Server components Next support top-level `await` + `fs.readFileSync` → scorer-lib OK.

## Requirements
- Export pure `scoreFixture(fixture, rubric, blocks, theme, allBlocks) → FixtureScore`
- Export `loadRubric() → Rubric` (fs read rubric-v1.json, memoize)
- Export `loadAllFixtureScores() → RubricReport` (reads matrix + rubric, scores all)
- Export `readScoreReport() → RubricReport | null` (reads pre-computed .harness-out/rubric-report.json)
- CLI scorer.ts stays — just imports from scorer-lib + handles process.argv, terminal output, fs write

## Architecture

```
scripts/test-harness/rubric/
  ├── scorer-lib.ts          (NEW — pure logic exports)
  ├── scorer.ts              (MODIFIED — CLI wrapper, imports lib)
  ├── evaluators.ts          (unchanged, pure)
  ├── rubric.schema.ts       (unchanged, types)
  ├── rubric-v1.json         (unchanged, spec)
  └── report-html.ts         (will be removed in Phase 05)
```

Exports in `scorer-lib.ts`:
```ts
export function loadRubric(): Rubric  // memoized fs read
export function scoreFixture(args: { fixtureId, category, blocks, theme, allBlocks?, rubric }): FixtureScore
export function scoreAll(matrix: MatrixReport, rubric?: Rubric): RubricReport
export function readPrecomputedReport(): RubricReport | null  // reads disk cache
export function readMatrixJson(): MatrixReport | null
```

## Related code files
- `scripts/test-harness/rubric/scorer.ts` (split)
- `scripts/test-harness/rubric/evaluators.ts` (reuse)
- `scripts/test-harness/rubric/rubric.schema.ts` (types)
- `.harness-out/matrix.json`, `rubric-report.json` (data)

## Implementation Steps
1. Create `scorer-lib.ts` — copy pure functions from scorer.ts (scoreFixture, evaluateCriterion, helpers)
2. Add loadRubric (memoized), scoreAll (full-matrix scoring), readPrecomputedReport, readMatrixJson
3. Refactor scorer.ts CLI — import from scorer-lib, keep terminal output + fs write
4. Run `npm run harness:score` — verify output identical (diff rubric-report.json before/after)
5. Run `npm run typecheck` — pass
6. Commit

## Todo list
- [ ] Create scorer-lib.ts with 5 exports
- [ ] Refactor scorer.ts to thin CLI wrapper
- [ ] Verify output bit-identical
- [ ] Typecheck + commit

## Success Criteria
- `npm run harness:score` produces same rubric-report.json (byte-level identical ideally)
- scorer-lib.ts importable from server component without CLI side effects
- Zero regression in CLI behavior

## Risk Assessment
- **Low**: mechanical refactor, test với diff báo

## Security Considerations
- scorer-lib reads local JSON files via fs — server-only, no user input path injection risk (hardcoded paths).

## Next steps
- Phase 02: Use scorer-lib to render score badge in fixture render.
