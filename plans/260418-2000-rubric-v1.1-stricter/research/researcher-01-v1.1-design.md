# Rubric v1.1 Design — Stricter Differentiation Strategy

## 1. Ceiling Issues in v1 (tại sao avg 8.96 bị thổi phồng)

**Typography (weight 9)** — 100% pass:
- `themeHasHeadingFont` + `themeHasBodyFont` fallback `fontPairingId` → always true
- `sectionHeadlinesCoverage70` threshold 70% quá thấp → 75% pass trivially
- `heroHasSubheadline` chỉ check non-empty — "." 1-char pass

**Spacing & Rhythm (weight 8)** — near ceiling:
- `themeHasSpacingPreset` — always true, zero discrimination
- `blockCount6To16` quá rộng — cả 6-block minimal + 16-block bloated đều pass

**Information Density (weight 7)** — ceiling:
- `varietyHalfUnique` 50% — floor, not ceiling
- Redundant: `blockCountMin7` + `blockCountMax16` trùng với `blockCount6To16`

Citations: `rubric-v1.json:68`, `evaluators.ts:63-78, 94-96, 108-111`

## 2. Stricter Replacements (v1 → v1.1)

| Criterion | v1 | v1.1 | Rationale |
|---|---|---|---|
| theme-heading-body | fontHeading OR bodyFont OR fontPairingId | fontHeading AND bodyFont DISTINCT | Force explicit pairing |
| hero-headline-substantial | ≥10 chars | 15–80 chars ideal, penalty if <10 or >120 | Quality range |
| section-headlines-coverage | ≥70% | ≥85% | Only 1 missing allowed |
| theme-spacing-preset | presence | spacingPreset + borderRadius + shadowPreset all defined | Real polish signal |
| block-count-sweet-spot | 6–16 range pass | 9–14 full pass, 7-8 or 15-16 partial, <7 or >16 fail | Differentiated scoring |
| variety-unique | ≥50% | ≥60% | 12 blocks → need ≥8 types |
| noConsecutiveDuplicates | keep | keep | Still working |

## 3. NEW Criteria (≥10 measurable from block data)

| ID | Label | Check | Pts | Dim |
|---|---|---|---|---|
| hero-headline-length-ideal | Hero h1 15–80 chars | len check | 2 | Typography |
| hero-subheadline-length | Subheadline 30–200 chars | len check | 1 | Typography |
| cta-text-quality-specific | Avoid ALL generic ("Click Here", "Learn More" as only text) | string match | 1 | Conversion |
| nav-links-count-balanced | Nav 3-7 links | count | 1 | Micro-Interactions |
| footer-mega-columns | Mega footer ≥4 link cols | columns count | 2 | Density |
| testimonials-have-ratings | ≥50% testimonials có rating 1-5 | field check | 1 | Social Proof |
| features-have-icons | Icon-variant features ≥70% items có icon | variant + field | 2 | Visual Richness |
| hero-cta-pair | ≥2 CTAs (primary+secondary) | count | 2 | Conversion |
| content-depth | hero copy + section labels total ≥150 chars | total len | 1 | Content |
| image-coverage | Gallery/portfolio present OR hero bg image | check | 2 | Visual Richness |
| no-lorem-strict | Broader match (Lorem, ipsum, dolor sit) | regex | 1 | Content (replaces no-lorem) |

**Total new points: ~16**

## 4. Weight Rebalance

| Dimension | v1 | v1.1 | Delta |
|---|---|---|---|
| Visual Richness | 10 | 12 | +2 (image-coverage, features-icons) |
| Typography | 9 | 12 | +3 (headline-length, subheadline-length) |
| Social Proof | 9 | 10 | +1 (testimonials-ratings) |
| Micro-Interactions | 8 | 9 | +1 (nav-balanced) |
| Spacing & Rhythm | 8 | 10 | +2 (borderRadius, shadowPreset) |
| Conversion | 8 | 10 | +2 (hero-cta-pair, cta-quality) |
| Content | 7 | 8 | +1 (content-depth) |
| Density | 7 | 8 | +1 (footer-mega-columns) |
| **Total** | **66** | **79** | **+13** |

## 5. Expected Outcome

v1 avg: **8.96/10 (100% pass)**

v1.1 predicted distribution:
- 9–10: ~10% (intentional design — hero CTA pair + distinct typography + ≥4 footer cols)
- 7–8: ~40% (good templates missing 1-2 polish)
- 5–6: ~40% (minimal/repetitive — same fonts, 4-block pages, generic CTAs)
- <5: ~10% (broken/placeholder)

**Predicted avg: 6.5–7.2** (25-30% drop forces differentiation)

## 6. Migration

**Recommend: version both**
- Keep `rubric-v1.json` intact (baseline for historical tracking)
- New `rubric-v1.1.json`
- CLI accept `--rubric-version v1|v1.1|both` (default v1.1)
- Report JSON `rubric.schemaVersion` + `rubric.name` identify version
- Admin/overlay use v1.1 by default, v1 viewable for comparison

## 7. Unresolved Questions

1. **Generic CTA list**: đâu là "generic" đủ cứng rắn? Proposed list ["Click Here", "Learn More", "Get Started"] — "Get Started" thường valid cho SaaS. Include or not?
2. **Image coverage via block data only**: hero.backgroundImage có thể SVG placeholder → pass rubric nhưng không "image-rich" visually. Cần evaluator check URL != data:image/svg?
3. **Rubric v1 deprecation timeline**: v1 callable song song bao lâu?
4. **Partial credit scoring**: v1 only has pass/fail + `partialPoints` optional. v1.1 có nên fully support partial (e.g. headline 12 chars → 50% credit)?

## 8. Citations

- `scripts/test-harness/rubric/rubric-v1.json` (current spec)
- `scripts/test-harness/rubric/evaluators.ts` lines 28-118 (evaluator impls)
- `.harness-out/rubric-report.json` (v1 baseline — 390 fixtures 100% pass, avg 8.96)
