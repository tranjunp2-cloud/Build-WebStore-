---
title: "Rubric v1.2 — methodology doc + 10 dims + a11y + category DNA"
description: "Kill ceilings, add Accessibility + Category DNA dims, bring avg 8.36 → 5.8-6.5"
status: pending
priority: P2
effort: 6h
branch: fix/F01-wave2-wix-detailed
tags: [rubric, quality, a11y, category-dna, f01]
created: 2026-04-18
---

# Rubric v1.2 — Methodology + Stricter + 2 New Dimensions

## Context

Sau v1.1 (avg 8.36, still ceilings ở spacing/conversion/content 9.4-10). User hỏi:
1. **Tiêu chuẩn em dựa vào đâu + cách tính ntn** → methodology doc rõ ràng
2. **Plan v1.2 luôn** → stricter rubric, thêm Accessibility + Category DNA

v1.2 = 10 dims (8 + 2 new), ~58 criteria, weight 97, baseline target **5.8-6.5 avg** (differentiation 3x better).

## Research

- `research/researcher-01-v1.2-design.md` — methodology + sources + v1.2 delta spec + category DNA mapping (14 cats) + a11y checks + unresolved questions

## Phases

| # | Phase | Effort | Status | File |
|---|---|---|---|---|
| 01 | Methodology doc (TEMPLATE_QUALITY_RUBRIC_METHODOLOGY.md — giải thích sources + algorithm) | 1h | pending | [phase-01-methodology-doc.md](phase-01-methodology-doc.md) |
| 02 | rubric-v1.2.json spec (10 dims, ~58 criteria) | 2h | pending | [phase-02-rubric-v1.2-spec.md](phase-02-rubric-v1.2-spec.md) |
| 03 | 15+ new evaluators (a11y, category DNA, tightened versions) | 2h | pending | [phase-03-evaluators-v1.2.md](phase-03-evaluators-v1.2.md) |
| 04 | Baseline + admin/overlay pick default v1.2 + docs | 1h | pending | [phase-04-baseline-ship.md](phase-04-baseline-ship.md) |

Total: **6h**. Critical path linear 01 → 02 → 03 → 04.

## Tiêu chuẩn dựa vào đâu (tóm tắt methodology)

1. **`docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`** (328 lines, baseline của team) — Wix 900+/Envato/Shopify/Unbounce/SEO 2026
2. **Researcher benchmark** plan 260418-1730 (8-dim rubric structure + Wix-professional acceptance criteria)
3. **WCAG 2.1 AA** (cho Accessibility dim v1.2)
4. **Empirical data** — 390 fixtures trong matrix.json để xác nhận criterion discriminates

## Cách tính (scoring algorithm)

```
Per criterion (evaluator → {pass|partial|fail}):
  points = pass→passPoints | partial→partialPoints (or half) | fail→0

Per dimension:
  earnedPts = sum(criteria.points)
  maxPts    = sum(criteria.passPoints)
  dimScore  = (earnedPts / maxPts) × 10           // 0-10

Weighted total:
  weighted = sum(dimScore × weight) / totalWeight  // 0-10

Status: ≥7 pass | 5-6.99 warn | <5 fail
```

## Key Changes v1.1 → v1.2

### Removed (100% pass ceilings — 10 pts recovered)
- `contact-present`, `nav-has-cta`, `hero-cta-pair` (Conversion)
- `block-count-min-7` (Density)
- `themeHasBorderRadius`, `themeHasShadowPreset` (Spacing)
- `no-lorem-strict` → replaced với noLoremBroad (stricter regex)

### Tightened
- `contentDepth300` → `contentDepth500`
- `variety-unique-75` → `variety-unique-85`
- `ctaTextQualitySpecific` (≥1) → `ctaTextQualitySpecific2x` (≥2)
- `hero-headline-length` 15-80 → 25-70 narrow

### NEW Dimension 9 — Accessibility (weight 8)
5 criteria: alt-text-coverage 80%, heading-order, color contrast 4.5:1, nav-aria, focus-indicator

### NEW Dimension 10 — Category DNA (weight 10)
14-category mandatory-blocks check (Restaurant menu+booking, Tech pricing+features ≥4, etc.)

### NEW standalone criteria
- `spacing-rhythm-token-only` (block padding trong preset scale 8/12/16/24/32/48)
- `hero-cta-variety` (primary + secondary style different)
- `testimonial-quote-length` (80-300 chars)
- `nav-links-not-repeat` (no duplicate labels)

## Expected Outcome

| Metric | v1.1 | v1.2 target |
|---|---|---|
| Avg | 8.36 | **5.8-6.5** |
| Pass rate | 100% | 20-30% |
| Std dev | 0.5 | **1.5-2.0** |
| Dimensions | 8 | 10 |
| Criteria | 47 | ~58 |
| Weight | 79 | 97 |

## Open Questions (user review)

1. **Cross-fixture uniqueness** check: detect copy-paste headlines across 390 fixtures. Defer v1.3 hay include v1.2?
2. **Theme contrast computation**: theme không có `contrastRatio` field — compute từ primaryColor vs surface, hay require author set explicit?
3. **SVG placeholder alt text**: harness images đều data:image/svg — alt field có thể empty. Pass (accept placeholder) hay fail (force real alt)?
4. **Heading order via block metadata**: blocks không có level metadata — infer từ block type heuristic (hero=h1, section headers=h2, card titles=h3)?
5. **Category tag accuracy**: 390 fixtures có `fixture.category` rồi — cần audit xem tag đúng không trước khi rely on Category DNA dim?

## Out of Scope

- Rubric v2 với cross-fixture uniqueness, runtime behavior checks (Lighthouse-level) — separate plan
- Auto-fix tooling (suggest rewrites to pass rubric) — future
- Rubric-driven AI prompt injection (tell GPT-4o "must pass v1.2") — separate plan
