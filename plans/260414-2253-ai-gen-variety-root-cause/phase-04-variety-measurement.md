# Phase 04 — E2E Variety Measurement Harness

## Context links
- **Parent**: [plan.md](./plan.md)
- **Fixes**: none — verification + regression guard for all previous phases
- **Dependencies**: none — runs against whatever state is in branch
- **Research**: all of researcher-01 + researcher-02 (baseline question)

## Overview
- **Date**: 2026-04-14
- **Description**: Tạo E2E harness generate 20 sites across 5 categories (4 each) với 20 distinct business names, measure similarity metrics per category, emit report. Run before phase 01 (baseline) và after each subsequent phase (delta). Provides quantitative answer to "gen website vẫn giống template không?"
- **Priority**: P1 (verification critical)
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 1.5h

## Key Insights
- Without measurement, "giống template" là subjective → không xác định fix work được hay chưa
- 20 gens × 5 categories = 100 sites, đủ signal để detect distribution collapse
- Metrics cần computable offline từ generated JSON, không cần render screenshot diff

## Requirements
- Script `scripts/measure-variety.ts` generate 20 sites (dev OTP bypass), save to `plans/260414-2253-ai-gen-variety-root-cause/reports/variety-{timestamp}.json`
- Compute metrics:
  1. **Variant share**: per category, top variant share per block type (target: ≤35%)
  2. **Skeleton entropy**: distinct block sequences (target: ≥3 per 20 gens)
  3. **Content collision**: testimonial text overlap, team names reuse (target: <20%)
  4. **Theme distribution**: distinct `(primaryColor, fontPairingId)` pairs (target: ≥6)
  5. **Image uniqueness**: distinct Unsplash photo IDs per hero (target: ≥12 per 20 gens)
- Markdown report: `reports/variety-{timestamp}.md` with metrics table + delta vs previous baseline
- CI-runnable: `pnpm run measure:variety` (dev only, not in production pipeline)

## Architecture

### Decisions
- **Generation method**: Use E2E ensure-test-user endpoint (dev only, bypasses auth) + call `/api/ai/generate-site?stream=true` 20 times per category batch. Parse SSE events, extract final `done` payload.
- **Business name pool**: Hardcode 20 distinct names per category trong script (e.g. beauty: "Rose Petal Spa", "Blossom Nails", ...). Use real Vietnamese + English names for realism.
- **Metric computation**: Post-process JSON arrays. Variant share = mode frequency per (category, blockType). Skeleton entropy = `Set(serialized sequences).size`. Content collision = Jaccard over testimonial text tokens.
- **Report format**: Markdown table per category + summary at top. Save JSON alongside for diff tooling.
- **Baseline storage**: `plans/260414-2253-ai-gen-variety-root-cause/reports/baseline.json` — committed, referenced by subsequent runs.

### Trade-offs
- **Pro**: Quantitative, repeatable, CI-able
- **Con**: 100 gens × $0.01 each = $1/run (Unsplash + OpenAI). Acceptable for dev. Optional: mock OpenAI with cached responses for free reruns.
- **Con**: 100 gens takes ~20 min wall clock. Acceptable as 1x/phase measurement.

## Related code files
- `scripts/measure-variety.ts` (NEW)
- `scripts/fixtures/variety-business-names.json` (NEW — 100 hardcoded names)
- `src/app/api/e2e/ensure-test-user/route.ts` (existing dev endpoint)
- `plans/260414-2253-ai-gen-variety-root-cause/reports/` (output dir)

## Implementation Steps
1. Create `scripts/fixtures/variety-business-names.json` — 20 names × 5 categories (beauty, restaurant, tech, realestate, fitness)
2. Create `scripts/measure-variety.ts` — iterate names, call generation API, collect results
3. Implement metric functions: `computeVariantShare`, `computeSkeletonEntropy`, `computeContentCollision`, `computeThemeDistribution`, `computeImageUniqueness`
4. Emit JSON + Markdown reports with timestamp
5. Add npm script: `"measure:variety": "tsx scripts/measure-variety.ts"` trong `package.json`
6. Run baseline (before Phase 01 ships) — save to `reports/baseline.json` + `baseline.md`
7. Re-run after each phase ships, compare delta, commit reports

## Todo list
- [ ] Create business names fixture (100 entries)
- [ ] Write measure-variety.ts script
- [ ] Implement 5 metric functions
- [ ] Emit JSON + Markdown report
- [ ] Add package.json npm script
- [ ] Run baseline measurement
- [ ] Commit baseline + verify numbers match research hypotheses

## Success Criteria
- Script runs end-to-end without errors, completes within 25 minutes
- Baseline report shows expected collapse (variant share >50% for ≥2 categories, matching research claims)
- Post-phase reports show measurable delta: variant share drops, skeleton entropy rises, content collision drops
- Reports committed for historical diff tracking

## Risk Assessment
- **OpenAI quota**: 100 gens fail if rate-limited. Mitigation: add retry + delay between batches.
- **Unsplash rate limit**: Demo tier 50/hr insufficient for 100 gens. Mitigation: split run over 2 hours or use cached media from prior gen.
- **Dev server flakiness**: Dev server may crash mid-run. Mitigation: checkpoint after each gen, resume from last success.
- **Business name bias**: Hardcoded names may happen to hash-collide. Mitigation: use names with known-distinct djb2 hashes (pre-verify).

## Security Considerations
- Dev-only script — requires `ALLOW_E2E_TEST_UTILS=true` + test bearer token
- Not to be run against production
- Reports may contain test user data — don't commit unscrubbed payloads

## Next steps
- After phase 01-03 ship (plan này) + sibling plan 2249 phase 01-06 ship, run final measurement → publish `reports/final-delta.md`
- If metrics don't hit targets → iterate on specific phase (tactical in 2253, strategic in 2249)
- Long-term: promote metrics to CI gate (block PR if variant share >50% regression)
