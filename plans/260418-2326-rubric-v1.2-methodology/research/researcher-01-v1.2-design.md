# Rubric v1.2 Methodology + Design

## Methodology

### Sources
1. **WEBSITE_TEMPLATE_STANDARDS.md** (328 lines) — tổng hợp Wix 900+, Envato, Shopify, Unbounce, SEO 2026
   - § 1.1 homepage order, § 1.2 sub-pages → block presence criteria
   - § 2 design tokens → typography/spacing criteria
   - § 3.2 heading hierarchy, § 3.4 image SEO → accessibility
   - § 4.1 category map → Category DNA (14 cat × 2-3 mandatory blocks)
2. **Wix 900+ templates** benchmark (researcher-01 plan 260418-1730)
3. **WCAG 2.1 AA** → accessibility thresholds
4. **Empirical v1.1 data** → identify ceiling criteria (100% pass = no signal)

### Algorithm (unchanged from v1)
```
Per criterion: evaluator → {pass|partial|fail}
  points = passPoints | partialPoints | 0

Per dimension:
  dimScore = (earnedPts / maxPts) × 10   // 0-10

Weighted total:
  weighted = sum(dimScore × weight) / totalWeight   // 0-10

Status: ≥7 pass | 5-6.99 warn | <5 fail
```

### Ceiling-beating strategy (3 approaches)
1. **Remove**: drop criteria 100% pass rate (no discrimination)
2. **Tighten**: raise threshold (300→500, 75%→85%)
3. **Replace**: swap with stricter version

## v1.2 Delta

| Aspect | v1 | v1.1 | v1.2 |
|---|---|---|---|
| Dimensions | 8 | 8 | **10** |
| Criteria | 35 | 47 | **~58** |
| Total weight | 66 | 79 | **~97** |
| Avg baseline | 8.96 | 8.36 | **target 5.8-6.5** |
| Ceiling criteria | 5 | 6 | **0** |

## NEW Dimension 9 — Accessibility (weight 8)

| Criterion | Check | Pts |
|---|---|---|
| alt-text-coverage-80 | ≥80% images có alt field | 2 |
| heading-order-no-skip | H1→H2→H3 progression via sectionLabel levels | 2 |
| theme-color-contrast | theme.contrastRatio ≥4.5 OR computed primary vs surface ≥4.5 | 2 |
| nav-aria-label | navigation block có ariaLabel hoặc links có title | 1 |
| focus-indicator-defined | theme defines focusStyle/focusRing | 1 |

**Source:** WCAG 2.1 AA, WEBSITE_TEMPLATE_STANDARDS §3.2-3.4

## NEW Dimension 10 — Category DNA (weight 10)

Mandatory blocks per 14 categories (WEBSITE_TEMPLATE_STANDARDS §4.1):

| Category | Mandatory blocks | Points each met |
|---|---|---|
| Restaurant | menu-display OR booking-widget + gallery | 4 |
| E-commerce | product-grid + pricing | 4 |
| Beauty | gallery + service-cards + (before-after optional +1) | 4 |
| Tech | features (≥4 items) + pricing | 4 |
| Health | doctor-profile + faq | 4 |
| Education | class-schedule + pricing | 4 |
| RealEstate | property-card + gallery | 4 |
| Fitness | class-schedule + pricing | 4 |
| Creative | gallery + portfolio-grid | 4 |
| Business | team + case-studies | 4 |
| Blog | blog-list + newsletter | 4 |
| Events | booking-widget + gallery | 4 |
| FnB | menu-display + gallery | 4 |
| Travel | gallery + feature/tour-list | 4 |

Scoring: custom evaluator `categoryDnaCompliance` reads fixture.category + checks mandatory blocks. 4 pts per category hit (2 sub-checks × 2 pts each). Partial if 1/2 blocks present.

**Single criterion with conditional logic** — dimension weight 10 split into:
- presence-of-required-blocks (6 pts)
- min-items-in-industry-block (2 pts)
- category-tag-consistency (2 pts — does fixture.category align với block mix?)

## Criteria Removed (100% pass ceiling)

| Removed | Was in dim | Weight recovered |
|---|---|---|
| contact-present | Conversion | 2 |
| nav-has-cta | Conversion | 1 |
| hero-cta-pair | Conversion | 1 |
| block-count-min-7 | Density | 1 |
| block-count-max-16 (keep, but lower weight) | Density | - |
| themeHasBorderRadius | Spacing | 1 |
| themeHasShadowPreset | Spacing | 2 |
| no-lorem-strict (replace) | Content | 2 |

Total recovered: 10 pts → redistributed to new dims.

## Criteria Tightened

| v1.1 | v1.2 | Change |
|---|---|---|
| contentDepth300 | contentDepth500 | 300 → 500 chars |
| variety-unique-75 | variety-unique-85 | 75% → 85% |
| ctaTextQualitySpecific (≥1) | ctaTextQualitySpecific2x (≥2) | 1 → 2 non-generic |
| noLoremStrict | noLoremBroad | regex broader: lorem/ipsum/dolor/sit amet/adipiscing/consectetur |
| hero-headline-length-ideal | hero-headline-length-strict | 15-80 → 25-70 (narrower ideal) |

## NEW Tightening-Specific Criteria

| ID | Check | Dim | Pts |
|---|---|---|---|
| spacing-rhythm-token-only | all block padding uses 8/12/16/24/32/48px — no random px | Spacing | 3 |
| hero-cta-variety | ctaButtons có ít nhất 1 primary + 1 secondary variant (style khác nhau) | Conversion | 2 |
| testimonial-quote-length | quote 80-300 chars (not too short/long) | Content | 1 |
| nav-links-not-repeat | nav.links no duplicate labels | Density | 1 |

## Expected Outcome

Baseline v1.2 prediction:
- avg **5.8-6.5/10** (from 8.36 → drop ~25%)
- Pass rate: 20-30% (from 100%)
- Warn rate: 50-60%
- Fail rate: 10-20%

Differentiation (std dev):
- v1.1: ~0.5 (tightly clustered around 8.3)
- v1.2: ~1.5-2.0 (spread across 4-9 range)

## Unresolved Questions

1. **Cross-fixture uniqueness**: detect copy-paste headlines across 390 fixtures — requires scorer access to all fixtures simultaneously. Defer to v1.3?
2. **Category tagging**: `fixture.category` already present in matrix. Verify all 390 tagged correctly.
3. **Contrast verification**: theme.contrastRatio không có trong current schema. Compute from primaryColor vs surfaceColor? Or require theme author to set?
4. **Alt text for SVG placeholders**: harness media = SVG data URLs, alt field có thể empty. Pass hay fail?
5. **Heading order check**: blocks không có level metadata — infer từ block order + type heuristics?

## Citations

- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` §1.1, 1.2, 3.2-3.4, 4.1
- `scripts/test-harness/rubric/rubric-v1.1.json` (baseline spec)
- `scripts/test-harness/rubric/evaluators.ts` (existing implementations)
- `.harness-out/rubric-report-v1.1.json` (ceiling identification)
- WCAG 2.1 AA guidelines (a11y thresholds)
