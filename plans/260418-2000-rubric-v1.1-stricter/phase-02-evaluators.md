# Phase 02 — Evaluators Implementation

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (rubric-v1.1.json)
- Modifies: `scripts/test-harness/rubric/evaluators.ts`

## Overview
Date: 2026-04-18
Description: Add 10 new custom evaluators + tighten 4 existing. All pure, reuse existing EvalContext.
Priority: P1
Status: pending

## Key Insights
- Extend existing `CUSTOM_EVALUATORS` registry — no new files
- Evaluators read from block data + theme (existing ctx shape)
- Names must differ from v1 to allow both versions callable (e.g. `themeHeadingBodyDistinct` vs `themeHasHeadingFont`)

## Requirements

### New evaluator implementations

```ts
// Typography
heroHeadlineLengthIdeal: len 15-80 pass, 10-14 or 81-120 partial, else fail
heroSubheadlineLength: len 30-200 pass, 20-29 or 201-300 partial
themeHeadingBodyDistinct: theme.fontHeading && theme.fontBody && both differ (case-insensitive)
sectionHeadlinesCoverage85: raise from 70% → 85%

// Visual Richness
imageCoverage: gallery/portfolio block OR hero.backgroundImage startsWith non-svg
featuresHaveIcons: if features.variant matches icon-* → ≥70% items have icon field

// Spacing
blockCountSweetSpot: 9-14 full, 7-8 or 15-16 partial (50% credit), else fail
themeHasBorderRadius: theme.borderRadius defined
themeHasShadowPreset: theme.shadowPreset defined
varietyUnique60: distinct types / total ≥ 60%

// Social Proof
testimonialsHaveRatings: ≥50% of testimonials have rating field (1-5)

// Conversion
heroCtaPair: hero has ≥2 CTAs (ctaButtons.length ≥2 OR primaryCta + secondaryCta both set)
ctaTextQualitySpecific: at least 1 cta button label not in generic list

// Content
contentDepth: hero.headline + hero.subheadline + sum(section labels) ≥150 chars
noLoremStrict: regex /\b(lorem|ipsum|dolor sit|consectetur)\b/i test all string fields

// Micro-Interactions
navLinksBalanced: navigation.links.length 3-7

// Density
footerMegaColumns: footer.variant === 'mega' AND column count ≥4 (check links structure)
```

### Generic CTA blacklist (for ctaTextQualitySpecific)
Stored as constant in evaluators.ts:
```ts
const GENERIC_CTA_LABELS = new Set(['click here', 'learn more', 'read more', 'view more'])
// "Get Started" NOT in list — too common valid use
```

## Architecture
Extend `scripts/test-harness/rubric/evaluators.ts`:
- Add 13 new evaluator entries to `CUSTOM_EVALUATORS` (10 from requirements + 3 supporting helpers)
- Add `GENERIC_CTA_LABELS` constant
- Existing evaluators remain untouched (v1 still works)

## Related code files
- `scripts/test-harness/rubric/evaluators.ts` (extend)
- `scripts/test-harness/rubric/rubric-v1.1.json` (references evaluator names)
- `scripts/test-harness/types.ts` (HarnessBlock shape — unchanged)

## Implementation Steps
1. Add `GENERIC_CTA_LABELS` constant top of evaluators.ts
2. Add 10-13 new evaluator entries in `CUSTOM_EVALUATORS`
3. Unit-ish test: run scorer với rubric-v1.1 → verify no "missing evaluator" errors
4. Typecheck
5. Commit

## Todo list
- [ ] GENERIC_CTA_LABELS constant
- [ ] heroHeadlineLengthIdeal + heroSubheadlineLength
- [ ] themeHeadingBodyDistinct
- [ ] sectionHeadlinesCoverage85 (copy + tweak threshold)
- [ ] imageCoverage
- [ ] featuresHaveIcons
- [ ] blockCountSweetSpot với partial credit
- [ ] themeHasBorderRadius + themeHasShadowPreset
- [ ] varietyUnique60
- [ ] testimonialsHaveRatings
- [ ] heroCtaPair + ctaTextQualitySpecific
- [ ] contentDepth
- [ ] noLoremStrict
- [ ] navLinksBalanced
- [ ] footerMegaColumns
- [ ] Typecheck + commit

## Success Criteria
- All 13 new evaluators registered in CUSTOM_EVALUATORS
- Running scorer v1.1 doesn't throw "missing evaluator"
- Existing v1 scorer output unchanged (byte-identical except timestamp)
- typecheck pass

## Risk Assessment
- Medium: partial credit for blockCountSweetSpot requires support in evaluator return shape. Check if existing `{pass, partial}` shape enough — `partial: true` triggers `partialPoints` from criterion definition.
- Low: generic CTA blacklist may reject false positives. Keep list small, iterate in v1.2 if needed.

## Security Considerations
- Regex for Lorem detection — use `\b` word boundaries to avoid matching "foLOREMn" etc.
- String length checks safe (no unbounded loops).

## Next steps
- Phase 03: Versioning — CLI flag, admin toggle.
