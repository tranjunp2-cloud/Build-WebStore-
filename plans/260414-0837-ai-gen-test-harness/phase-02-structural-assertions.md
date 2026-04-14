# Phase 02 — Structural Assertions (The Ben-Ben Guard)

## Context links
- Phase 01: `plans/260414-0837-ai-gen-test-harness/phase-01-harness-foundation.md`
- PRD AC-01/02/03/08: `docs/prd/F01-ai-builder-variety.md`
- QA TC-F01-V.08-28: `docs/qa/F01-ai-builder-variety.md`
- Research gap analysis: `plans/260414-0837-ai-gen-test-harness/research/researcher-01-test-coverage-gap.md`

## Overview
Layer chính bắt Ben-Ben bug. Consume `.harness-out/matrix.json`, chạy 6 guards (block count, signature block, no-empty-data, ordering, variant whitelist, variety metrics) trên mỗi fixture, emit `structural-report.json` với status PASS/FAIL/WARN + reason cho từng fixture + aggregate.

## Key Insights
- Ben-Ben bug root-cause candidates: (a) blueprint missing menu-display spec, (b) variant rendered empty do CSS, (c) seed shuffle loại bỏ required block, (d) CATEGORY_DNA.mandatoryHomepageOrder không enforced ở composer. Structural guards bắt được (a)(c)(d); visual guard (Phase 03) bắt (b).
- `enforceMinContent()` đã exist trong openai-generator.ts → import + apply post-compose để simulate render-time check.
- `BROKEN_VARIANTS` set đã exist (hero:animated-gradient, hero:split-right) → import trực tiếp.
- Variety metrics require aggregate across seeds cùng category → assertions chạy theo 2 level: per-fixture + per-category-group.

## Requirements
- 6 guards pure functions, unit-testable, zero I/O ngoài đọc matrix.json
- Each guard returns `{ name, status: 'pass'|'fail'|'warn', reason?, data? }`
- Exit code 1 nếu có bất kỳ FAIL; exit 0 cho all PASS/WARN
- Output `structural-report.json` với schema versioned
- Fail-fast optional (`--fail-fast`) cho CI speed

## Architecture
```
scripts/test-harness/
  assertions/
    index.ts                  // runAllGuards(result) → GuardReport[]
    block-count.ts            // min 6, max 16
    signature-blocks.ts       // CATEGORY_DNA signatureBlocks presence
    no-empty-data.ts          // wraps enforceMinContent
    ordering.ts               // nav-first, footer-last, features-before-stats
    variant-whitelist.ts      // BROKEN_VARIANTS exclusion
    variety-metrics.ts        // cross-fixture aggregate (per category group)
  check.ts                    // CLI: read matrix.json → run guards → write report
```

### Guard logic
**block-count**: `blocks.length >= 6 && <= 16`, else FAIL with `blocks.length < 6` is the Ben-Ben case.

**signature-blocks**: For category's `CATEGORY_DNA.signatureBlocks`, assert each present in `blocks.map(b => b.blockType)`. If missing → FAIL with list of missing blocks.

**no-empty-data**: Import `enforceMinContent` from openai-generator.ts (or copy logic): carousel ≥3 items, grid-4 ≥4 items, masonry ≥4 items, features ≥3 items. Any block failing → FAIL with block type + actual count.

**ordering**: `blocks[0].blockType === 'navigation'`, `blocks.at(-1).blockType === 'footer'`, index(features) < index(stats), index(about) < index(team) if both present. Fail → FAIL with violated rule.

**variant-whitelist**: `blocks.filter(b => BROKEN_VARIANTS.has(\`${b.blockType}:${b.variant}\`))` must be empty. Fail → FAIL with offending block.

**variety-metrics**: Cross-fixture (group by `{category}`), collect `heroVariants = Set`, `featureVariants = Set`. If size < threshold (5/3) → WARN (not FAIL — variety is aspirational).

## Related code files
- `src/lib/ai/openai-generator.ts` (enforceMinContent, BROKEN_VARIANTS)
- `src/lib/ai/template-definitions.ts` (CATEGORY_DNA)
- `src/blocks/registry.ts` (getBlockMeta for variant validation)

## Implementation Steps
1. Extract `enforceMinContent` + `BROKEN_VARIANTS` exports from openai-generator.ts (verify they're exported; if not, re-export or copy constants into harness)
2. Implement 6 guard files with pure functions
3. Implement `assertions/index.ts` orchestrator `runAllGuards(result): GuardReport[]`
4. Implement cross-fixture `variety-metrics.ts` (needs full matrix, not per-fixture)
5. Implement `check.ts` CLI:
   - Read `.harness-out/matrix.json`
   - For each fixture: run per-fixture guards → collect
   - Then run variety-metrics aggregate
   - Write `.harness-out/structural-report.json`
   - Print summary table: `PASS 198 / FAIL 7 / WARN 5`
6. Exit 1 if any FAIL (CI block). WARN does not fail.
7. Add `--fail-fast` flag
8. Unit test each guard in `scripts/test-harness/__tests__/guards.test.ts` với synthetic fixtures (the Ben-Ben case: manually construct a fixture missing menu-display → assert signature-blocks guard FAILs)

## Todo list
- [ ] Verify exports from openai-generator.ts (enforceMinContent, BROKEN_VARIANTS)
- [ ] Implement 6 guard files
- [ ] Implement `runAllGuards()` + `variety-metrics` aggregator
- [ ] Implement `check.ts` CLI with exit codes
- [ ] Write synthetic Ben-Ben fixture test: signature-blocks guard must FAIL
- [ ] Run against real matrix.json from Phase 01 quick mode → verify all PASS or legit FAILs
- [ ] Document each guard's pass criteria in inline JSDoc

## Success Criteria
- Ben-Ben synthetic fixture (manually crafted blocks[] missing menu-display) → signature-blocks guard returns FAIL
- Valid fixture from real composer → all 6 guards return PASS
- Exit code 1 khi có FAIL, 0 khi all PASS
- `structural-report.json` human-readable, có `summary` field + `fixtures[]` field
- Reuse `enforceMinContent` từ source (single source of truth — không duplicate logic)

## Risk Assessment
- **R1 Drift từ source**: enforceMinContent sửa mà harness không đồng bộ. Mitigation: import trực tiếp, fail CI nếu import path break.
- **R2 False-positive variety WARN**: 5 seeds quá ít cho variety metric. Mitigation: WARN-only, không FAIL; doc rõ cần ≥10 seeds cho metric accurate.
- **R3 Ordering guard quá strict**: variety shuffle có thể hợp lệ swap stats/features order. Mitigation: pull rules từ CATEGORY_DNA.mandatoryHomepageOrder thay vì hardcode.

## Security Considerations
- Chỉ đọc JSON, write JSON — không execute user code
- Not exposing structural-report.json via HTTP → safe to leave detail
- No secret in report (dù theme.primaryColor lộ cũng OK vì public)

## Next steps
→ Phase 03: render fixtures qua Playwright để bắt rendering-level holes
