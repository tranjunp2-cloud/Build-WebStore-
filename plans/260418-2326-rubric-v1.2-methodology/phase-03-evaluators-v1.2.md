# Phase 03 — v1.2 Evaluators

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 02 (rubric-v1.2.json)
- Modifies: `scripts/test-harness/rubric/evaluators.ts`

## Overview
Date: 2026-04-18
Description: Add 15+ new evaluator implementations (5 a11y + 1 category-DNA-composite + 4 standalone new + 5 tightened).
Priority: P1
Status: pending

## Key Insights
- Extend `CUSTOM_EVALUATORS` registry
- New keys (avoid collision với v1/v1.1): `altTextCoverage80`, `headingOrderNoSkip`, `themeColorContrast`, `navAriaLabel`, `focusIndicatorDefined`, `categoryDnaCompliance`, `spacingRhythmTokenOnly`, `heroCtaVariety`, `testimonialQuoteLength`, `navLinksNotRepeat`, `contentDepth500`, `varietyUnique85`, `ctaTextQualitySpecific2x`, `noLoremBroad`, `heroHeadlineLengthStrict`
- Category DNA evaluator requires access to `fixture.category` — extend EvalContext

## Requirements

### EvalContext extension
```ts
export interface EvalContext {
    blocks: HarnessBlock[]
    theme: Record<string, unknown>
    allBlocks?: HarnessBlock[]
    category?: string     // NEW — needed for categoryDnaCompliance
    fixtureId?: string    // NEW — debug + future uniqueness check
}
```

### New evaluators

**Accessibility (5):**
- `altTextCoverage80`: collect all image/gallery blocks, count items with non-empty alt, ≥80% pass
- `headingOrderNoSkip`: infer block types → expected h-level (hero=h1, section headers=h2, cards=h3). Fail if h1 skipped or h2→h4 jump
- `themeColorContrast`: if theme.contrastRatio defined ≥4.5 pass; else compute from primaryColor vs theme.surfaceColor (WCAG formula)
- `navAriaLabel`: navigation block có `ariaLabel` field OR links có `title`
- `focusIndicatorDefined`: theme has `focusStyle`/`focusRing`/`focusOutlineColor` field

**Category DNA (1 composite):**
- `categoryDnaCompliance`: map per category → required blocks. Return pass if ALL mandatory present, partial if 50%+, fail if <50%

**Standalone new (4):**
- `spacingRhythmTokenOnly`: scan block padding/margin fields (nếu present) — check values in {8,12,16,24,32,48,64,80} px
- `heroCtaVariety`: ctaButtons[0].variant !== ctaButtons[1].variant (primary + secondary visually different)
- `testimonialQuoteLength`: ≥80% testimonials có quote 80-300 chars
- `navLinksNotRepeat`: no duplicate labels (case-insensitive)

**Tightened (5):**
- `contentDepth500`: total ≥500 chars (was 300)
- `varietyUnique85`: ratio ≥0.85 (was 0.75)
- `ctaTextQualitySpecific2x`: ≥2 non-generic CTA labels (was ≥1)
- `noLoremBroad`: regex `/\b(lorem|ipsum|dolor sit|adipiscing|consectetur|eiusmod)\b/i`
- `heroHeadlineLengthStrict`: 25-70 chars full pass, 15-24 or 71-90 partial

## Architecture

Extend `scripts/test-harness/rubric/evaluators.ts`:
- Update `EvalContext` type with `category` + `fixtureId`
- Update `scorer-lib.ts` → `scoreFixture` passes fixture.category into context
- Add 15 new evaluators
- Add `CATEGORY_DNA_MAP` constant (14 categories × required blocks)
- Reuse `collectCtaLabels` helper

## Related code files
- `scripts/test-harness/rubric/evaluators.ts` (extend)
- `scripts/test-harness/rubric/scorer-lib.ts` (pass category to ctx)
- `scripts/test-harness/rubric/rubric-v1.2.json` (references evaluator names)

## Implementation Steps
1. Extend `EvalContext` type
2. Update `scoreFixture` in scorer-lib → add `category` to ctx
3. Add `CATEGORY_DNA_MAP` constant
4. Implement 15 new evaluators
5. Typecheck — all referenced evaluators resolve
6. Run scorer v1.2 — verify no "missing evaluator" errors
7. Commit

## Todo list
- [ ] EvalContext extension
- [ ] scoreFixture category wire
- [ ] CATEGORY_DNA_MAP
- [ ] 5 a11y evaluators
- [ ] categoryDnaCompliance composite
- [ ] 4 standalone new
- [ ] 5 tightened versions
- [ ] Smoke test v1.2 runs
- [ ] Commit

## Success Criteria
- All 15 new evaluators registered
- `npm run harness:score -- --rubric=v1.2` runs, no missing evaluator
- v1 + v1.1 scorer still identical output (backward compat)
- typecheck pass

## Risk Assessment
- Medium: heading order inference từ block types là heuristic — có thể false negative. Document rule in evaluator comment.
- Low: contrast ratio WCAG formula implementation (relative luminance). Test với known pairs (black/white = 21, black/black = 1).
- Medium: category DNA map accuracy depends on fixture.category correctness. Audit first.

## Security Considerations
- Regex for lorem — use word boundaries to avoid false matches
- No user input in evaluators, all pure functions

## Next steps
- Phase 04: Baseline + ship
