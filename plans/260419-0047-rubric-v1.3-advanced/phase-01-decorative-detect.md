# Phase 01 — Decorative-Primitive Detection

## Context links
- Parent: [plan.md](plan.md)

## Overview
Date: 2026-04-19
Description: Adjust `imageCoverage` evaluator (hoặc add `decorative-primitives-present` criterion) để accept decorative elements (gradient-blob, shape-blob, grid-pattern) as valid visual richness signal. Tech/minimal templates intentionally skip photos nhưng use decorative → structurally rich.
Priority: P2
Status: pending

## Key Insights
- 130 fixtures fail image-coverage — predominantly tech/SaaS/minimal themes
- These templates HAVE decorative primitives (blobs, gradients, patterns) — composer seed-templates reference
- Current rubric ignores — only checks `gallery/portfolio/hero backgroundImage` URLs
- Fix: add block-level field `decorativePrimitives` count OR check theme has `decorativeStyle` marker

## Requirements
- Composer output có decorative metadata (per block OR page-level)
- Evaluator: visual-richness criterion `decorative-or-image` = pass if either images OR ≥2 decorative primitives

## Architecture

Option A — new criterion in Visual Richness dim:
```json
{
  "id": "decorative-primitives",
  "label": "≥2 decorative primitive types (blobs/patterns/gradients)",
  "check": { "type": "custom", "evaluator": "decorativePrimitivesCount2" },
  "passPoints": 2
}
```

Option B — relax imageCoverage to accept decorative as alternative

Recommend A (cleaner signal, doesn't mask missing imagery).

## Related code files
- `scripts/test-harness/rubric/rubric-v1.3.json` (new)
- `scripts/test-harness/rubric/evaluators.ts` (add decorativePrimitivesCount2)
- `src/lib/ai/template-composer.ts` (verify composer emits decorative fields — may need addition)
- `src/blocks/*/config.ts` (check which blocks support decorativePrimitives field)

## Implementation Steps
1. Audit composer — check if decorative primitives currently emitted in block data. Wave 2 added 8 decorative primitives (gradient-blob, shape-blob, grid-pattern, grain-overlay, etc.).
2. If missing, composer emits per-block `decorativePrimitives: ['gradient-blob', 'shape-blob']` based on variant
3. Add `decorativePrimitivesCount2` evaluator — count distinct types across blocks, pass if ≥2
4. Add criterion to v1.3 spec under Visual Richness (weight +2)
5. Regen + score

## Success Criteria
- Visual richness avg 7.1 → 8.0+
- Tech templates (intentionally image-less) now score healthy instead của penalized

## Risk Assessment
- Low: additive criterion
- Medium: composer may not currently output decorative metadata — if so, emit from variant → primitive mapping

## Security Considerations
- None

## Next steps
- Phase 02: Uniqueness dim
