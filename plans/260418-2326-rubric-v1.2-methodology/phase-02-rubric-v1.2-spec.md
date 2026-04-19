# Phase 02 — rubric-v1.2.json Spec

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (methodology doc)
- Research: `research/researcher-01-v1.2-design.md`
- Prior: `rubric-v1.1.json`

## Overview
Date: 2026-04-18
Description: Create `rubric-v1.2.json` — 10 dimensions (8 + Accessibility + Category DNA), ~58 criteria, weight 97.
Priority: P1
Status: pending

## Key Insights
- Clone rubric-v1.1 → v1.2
- Remove 6 ceiling criteria (10 pts recovered)
- Tighten 5 criteria
- Add 2 new dims (a11y 8, category DNA 10)
- Add 4 standalone new criteria

## Requirements
- File: `scripts/test-harness/rubric/rubric-v1.2.json`
- schemaVersion: 1, name: "wix-pro-v1.2"
- 10 dimensions, ~58 criteria
- Total weight: 97
- Thresholds: pass ≥6 (lowered from 7 since rubric stricter), warn ≥4

## Architecture

### Dimension weights
| Dim | v1.2 weight | Change |
|---|---|---|
| 1. Visual Richness | 12 | unchanged |
| 2. Typography | 12 | unchanged |
| 3. Social Proof | 10 | unchanged |
| 4. Micro-Interactions | 9 | unchanged |
| 5. Spacing & Rhythm | 10 | tighten criteria (remove borderRadius/shadow) |
| 6. Conversion Path | 10 | remove 3 ceilings, tighten CTA quality |
| 7. Content Authenticity | 8 | tighten depth 300→500 |
| 8. Information Density | 8 | tighten variety 75→85%, remove min-7 |
| 9. **Accessibility** (NEW) | 8 | 5 criteria |
| 10. **Category DNA** (NEW) | 10 | single criterion với sub-checks |
| **Total** | **97** | |

### Thresholds adjustment
- v1.2 có thêm 10-18 pts hard criteria. Keep threshold ≥7 → expect many fails.
- Option A: lower pass threshold to 6 → more realistic pass rate
- Option B: keep ≥7 → explicit "fail" signal for templates cần fix
- **Recommend: threshold stays 7** (forcing signal matters more than pass rate optics)

## Related code files
- `scripts/test-harness/rubric/rubric-v1.1.json` (clone base)
- `scripts/test-harness/rubric/rubric.schema.ts` (types unchanged)
- `scripts/test-harness/rubric/validate.ts` (update total weight assert)

## Implementation Steps
1. Copy rubric-v1.1.json → rubric-v1.2.json
2. Remove 6 criteria per research doc
3. Tighten 5 criteria (new IDs to avoid collision)
4. Add Accessibility dim (5 criteria)
5. Add Category DNA dim (single composite criterion)
6. Add 4 standalone new criteria into existing dims
7. Update validate.ts to accept v1.2 với total weight 97
8. Typecheck
9. Commit

## Todo list
- [ ] Create rubric-v1.2.json
- [ ] Add a11y dim
- [ ] Add category-dna dim
- [ ] Remove 6 ceilings
- [ ] Tighten 5 criteria
- [ ] Add 4 standalone new
- [ ] validate.ts accept v1.2
- [ ] Typecheck + commit

## Success Criteria
- rubric-v1.2.json parses, totalWeight 97, 10 dims
- v1.1 untouched (zero diff)
- v1.2 references 15+ new evaluator names (for Phase 03)

## Risk Assessment
- Low: spec only

## Security Considerations
- None

## Next steps
- Phase 03: Implement 15+ new evaluators
