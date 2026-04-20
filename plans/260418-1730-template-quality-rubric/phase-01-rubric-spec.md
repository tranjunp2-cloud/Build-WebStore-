# Phase 01 — Rubric Spec + JSON Schema

## Context links
- Parent: [plan.md](plan.md)
- Research: `research/researcher-01-wix-benchmarks.md` (8-dimension rubric), `research/researcher-02-current-inventory-gaps.md` (56-preset baseline)
- Existing: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`

## Overview
Date: 2026-04-18
Description: Chuẩn hóa 8-dimension rubric thành JSON schema machine-scorable + doc MD human-readable. Baseline cho scorer ở Phase 02.
Priority: P1 (blocker cho Phase 02)
Implementation status: pending
Review status: not started

## Key Insights
- Rubric có 8 dimensions với weights (total=66): Visual 10, Typography 9, Social Proof 9, Micro-Interactions 8, Spacing 8, Conversion 8, Content 7, Density 7
- Weighted total = sum(score × weight) / 66 * 10 → normalize về 0-10
- Pass threshold = 7/10 weighted avg
- Mỗi dimension có **criteria checklist** với `boolean | numeric` checks (e.g., `hero.ctaCount >= 1`, `testimonials.withAvatar >= 3`)

## Requirements
- JSON schema định nghĩa rubric: dimensions, weights, criteria per dimension với check type (`presence | count | ratio | enum`)
- Doc MD song song mô tả Wix standard + acceptance criteria cho con người review
- Criteria machine-checkable từ block data (matrix.json) — không cần runtime browser inspection
- Versioning: `schemaVersion: 1` trong rubric JSON để maintain compatibility

## Architecture
```
docs/standards/
  ├── WEBSITE_TEMPLATE_STANDARDS.md     (existing baseline, 328 lines)
  └── TEMPLATE_QUALITY_RUBRIC.md        (NEW — 8-dimension rubric spec)

scripts/test-harness/
  └── rubric/
       ├── rubric.schema.ts             (TypeScript types)
       ├── rubric-v1.json               (NEW — versioned rubric spec)
       └── rubric.md                    (symlink to docs for humans)
```

Rubric JSON shape:
```ts
type Rubric = {
  schemaVersion: 1
  name: 'wix-pro-v1'
  dimensions: Array<{
    id: string                     // 'visual-richness'
    name: string                   // 'Visual Richness'
    weight: number                 // 10
    description: string
    criteria: Array<{
      id: string                   // 'decorative-primitives'
      label: string
      check: Check                 // { type: 'count', field: '...', min: 4 }
      passPoints: number           // 0-10 if pass
      partialPoints?: number       // if partial
    }>
  }>
  thresholds: {
    pass: number                   // 7
    warn: number                   // 5
  }
}

type Check =
  | { type: 'presence', blockType: string }                      // has block
  | { type: 'count', blockType: string, field: string, min: number }  // data count
  | { type: 'ratio', numerator: string, denominator: string, min: number }
  | { type: 'enum', blockType: string, field: string, in: string[] }
  | { type: 'custom', evaluator: string }                        // JS fn name
```

## Related code files
- `.harness-out/matrix.json` (block data input)
- `scripts/test-harness/types.ts` (HarnessResult shape)
- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` (content source)

## Implementation Steps
1. Tạo `scripts/test-harness/rubric/rubric.schema.ts` — TypeScript types (Rubric, Check, Dimension)
2. Tạo `scripts/test-harness/rubric/rubric-v1.json` — hardcoded rubric từ researcher-01 8 dimensions
   - 45+ criteria total (5-7 per dimension)
3. Tạo `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` — human-readable version, explain each dimension + example pass/fail
4. Verify JSON parses + matches schema types (write 1 unit test)
5. Commit

## Todo list
- [ ] Write `rubric.schema.ts`
- [ ] Write `rubric-v1.json` with 8 dimensions
- [ ] Write `TEMPLATE_QUALITY_RUBRIC.md` doc
- [ ] Add type check test
- [ ] Commit

## Success Criteria
- JSON validates against schema (tsc --noEmit pass on test file importing it)
- Doc covers all 8 dimensions với example pass/fail
- 45+ criteria total (mỗi dimension có ≥4 criteria)
- Each criterion có measurable check (not vague "good" language)

## Risk Assessment
- **Low**: Rubric tuning sẽ cần iterate sau baseline run. Version with `schemaVersion` + keep immutable once v1 ships.
- Concern: Some Wix criteria khó measure từ block data (micro-interactions, hover states) → skip hoặc mark as `manual-review` type.

## Security Considerations
- None — rubric JSON is static config, no user input, no secrets.

## Next steps
- Phase 02: Build scorer tool that reads rubric JSON + matrix.json → produces report.
