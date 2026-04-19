# Phase 01 — Rubric v1.1 Spec

## Context links
- Parent: [plan.md](plan.md)
- Research: `research/researcher-01-v1.1-design.md`
- Prior: `scripts/test-harness/rubric/rubric-v1.json`

## Overview
Date: 2026-04-18
Description: Create `rubric-v1.1.json` — add 10 new criteria, tighten 4 existing, rebalance weights (66 → 79).
Priority: P1
Status: pending

## Key Insights
- Additive strategy: keep v1 unchanged, clone to v1.1 + modify
- Schema unchanged (same `rubric.schema.ts` types handle both)
- 10 new criteria fit existing check types (count/presence/enum + 3 new custom evaluators)

## Requirements
- File: `scripts/test-harness/rubric/rubric-v1.1.json`
- 45+ criteria total (vs 35 in v1)
- Total weight 79
- Updated thresholds: pass ≥7, warn ≥5 (unchanged — compare apples-to-apples)
- schemaVersion: 1 (same), name: "wix-pro-v1.1"

## Architecture

### Criteria per dimension (v1.1)

**Visual Richness (weight 12):** v1's 5 + 2 new
- (keep) hero-variant-diverse 2, gallery-present 2, stats-present 2, logo-cloud-present 2, block-variety 2
- + image-coverage 2 (gallery/portfolio OR hero bg image non-SVG)
- + features-have-icons 2 (icon-variant features ≥70% have icon field)

**Typography (weight 12):** v1's 6 tightened + 2 new
- (tighten) theme-heading-body-distinct 2 (was OR now AND + distinct)
- (tighten) sectionHeadlinesCoverage85 2 (was 70% now 85%)
- (keep) hero-headline-present 2, single-hero 2, theme-body-font 1, hero-subheadline 1
- + hero-headline-length-ideal 2 (15-80 chars)
- + hero-subheadline-length 1 (30-200 chars)

**Social Proof (weight 10):** v1's 5 + 1 new
- (keep all 5 from v1)
- + testimonials-have-ratings 1 (≥50% have rating field)

**Micro-Interactions (weight 9):** v1's 4 + 1 new
- (keep all 4)
- + nav-links-balanced 1 (3-7 links)

**Spacing & Rhythm (weight 10):** v1's 3 rebalanced + 2 new
- (remove) themeHasSpacingPreset (moved into combined check)
- (tighten) block-count-sweet-spot 3 (9-14 full, 7-8/15-16 partial, else fail)
- (keep) no-consecutive-duplicates 2
- + theme-has-border-radius 1
- + theme-has-shadow-preset 2

**Conversion Path (weight 10):** v1's 5 + 2 new
- (keep all 5)
- + hero-cta-pair 2 (≥2 CTAs)
- + cta-text-quality-specific 1 (avoid all-generic CTAs)

**Content Authenticity (weight 8):** v1's 4 + 1 new
- (tighten) no-lorem regex broader
- + content-depth 1 (hero copy + labels total ≥150 chars)

**Information Density (weight 8):** v1's 3 tightened + 1 new
- (tighten) variety-60-unique 3 (was 50%)
- (keep) block-count-max-16 2, block-count-min-7 — remove (redundant với sweet-spot)
- + footer-mega-columns 2 (mega variant ≥4 link cols)

## Related code files
- `scripts/test-harness/rubric/rubric-v1.json` (source to clone)
- `scripts/test-harness/rubric/rubric.schema.ts` (types, unchanged)
- `scripts/test-harness/rubric/validate.ts` (adjust total weight assert)

## Implementation Steps
1. Copy rubric-v1.json → rubric-v1.1.json
2. Edit spec per architecture above — tighten + add criteria
3. Update validate.ts (or add validate-v1.1.ts) — assert totalWeight 79, dimensions 8
4. Typecheck pass
5. Commit

## Todo list
- [ ] Create rubric-v1.1.json
- [ ] Update or duplicate validate script
- [ ] Typecheck
- [ ] Commit

## Success Criteria
- rubric-v1.1.json parses against Rubric schema
- totalWeight === 79, dimensions.length === 8, criteria count 45+
- v1 file untouched (zero git diff)

## Risk Assessment
- Low: spec-only, no logic changes
- Concern: new criteria IDs must be unique across versions to avoid collisions if merged later

## Security Considerations
- None (static config)

## Next steps
- Phase 02: Implement new/updated evaluator functions
