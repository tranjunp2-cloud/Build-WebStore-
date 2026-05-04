# Phase 03 — A4 Visual Diversity (8 Decorative Primitives)

## Context
- Parent: [plan.md](plan.md)
- Research: [researcher-01-a4-a5-scope](research/researcher-01-a4-a5-scope.md)
- Dependencies: Phase 01, 02 ship first (unrelated files, no merge risk)

## Overview
- Date: 2026-04-17
- Description: Build 8 new decorative primitives trong `src/blocks/shared/decorative.tsx`, wire each variant (CTA/features/testimonials/pricing/about/stats/newsletter/faq) import 1-2 DIFFERENT decoratives. Giết "8 shades of same gradient blob" vấn đề.
- Priority: P1
- Implementation status: pending

## Key Insights
- `src/blocks/shared/decorative.tsx` = 223 LOC, 9 existing exports (`GradientBlob`, `DotGrid`, `WaveDivider`, `GradientLine`, `IconContainer`, `GlassCard`, `SectionLabel`, `FloatingCircle`, `AvatarRing`).
- All variants currently import `GradientBlob` + primary tint → tạo "8 shades of same thing".
- Target 8 new primitives: `MeshGradient`, `NoiseTexture`, `LayeredShapes`, `AsymmetricGrid`, `DuotoneOverlay`, `TypographicMark`, `GridLines`, `DiagonalStripe`.
- Hero 12 variants đã có image/video decorative riêng → **skip hero**, focus 6 non-hero blocks.

## Requirements
- 8 new React components exported từ `decorative.tsx`:
  - `MeshGradient` — conic/radial gradient mesh (3-4 colors)
  - `NoiseTexture` — SVG turbulence filter overlay
  - `LayeredShapes` — absolutely-positioned SVG circles/rects
  - `AsymmetricGrid` — CSS grid with uneven spans
  - `DuotoneOverlay` — blend-mode color overlay
  - `TypographicMark` — large background number/letter watermark
  - `GridLines` — background-image linear gradients
  - `DiagonalStripe` — skewed div background
- Each component ≤ 60 LOC, pure CSS/SVG (no JS animation), TypeScript strict.
- Each primitive tested trong storybook OR Chromatic screenshot.
- Wire map: each variant of 6 blocks (cta/features/testimonials/pricing/about/stats/newsletter/faq) imports 1-2 primitives. NO variant shares same primitive with sibling.
- Zero breaking change to existing blocks' GradientBlob usage.

## Architecture

**File structure**:
```
src/blocks/shared/
├── decorative.tsx (existing, extend — keep 9 exports)
└── decorative/
    ├── MeshGradient.tsx (new)
    ├── NoiseTexture.tsx (new)
    ├── LayeredShapes.tsx (new)
    ├── AsymmetricGrid.tsx (new)
    ├── DuotoneOverlay.tsx (new)
    ├── TypographicMark.tsx (new)
    ├── GridLines.tsx (new)
    └── DiagonalStripe.tsx (new)
```

Split into sub-dir vì 8 primitives add 400+ LOC — keep `decorative.tsx` manageable. Re-export from `decorative.tsx`:
```ts
export { MeshGradient } from './decorative/MeshGradient'
// ... 7 more
```

**Decorative wiring map** (suggested — review before A5):
| Block | Variant | Decorative |
|---|---|---|
| cta | banner | MeshGradient |
| cta | inline | DiagonalStripe |
| cta | card | NoiseTexture |
| cta | floating-sticky | LayeredShapes |
| features | grid-3 | GridLines |
| features | zigzag | AsymmetricGrid |
| features | carousel | DuotoneOverlay |
| testimonials | cards | LayeredShapes |
| testimonials | masonry | NoiseTexture |
| testimonials | spotlight | TypographicMark |
| pricing | cards | GridLines |
| pricing | table | — (structural) |
| about | simple | DiagonalStripe |
| about | split | LayeredShapes |
| about | story | TypographicMark |
| stats | highlight | MeshGradient |
| stats | row | DiagonalStripe |
| newsletter | inline | GridLines |
| newsletter | banner | DuotoneOverlay |
| faq | accordion | — (structural) |
| faq | grid | NoiseTexture |

**Constraint**: no variant re-uses primitive of its sibling variants in the same block.

## Related code files
- `src/blocks/shared/decorative.tsx` (extend exports)
- `src/blocks/shared/decorative/*.tsx` (8 NEW)
- `src/blocks/cta/index.tsx` (wire 4 variants)
- `src/blocks/features/index.tsx` (wire variants)
- `src/blocks/testimonials/index.tsx` (wire variants)
- `src/blocks/pricing/index.tsx` (wire)
- `src/blocks/about/index.tsx` (wire)
- `src/blocks/stats/index.tsx` (wire)
- `src/blocks/newsletter/index.tsx` (wire)
- `src/blocks/faq/index.tsx` (wire)
- NEW: `src/__tests__/unit/blocks/decorative-primitives.test.tsx`
- NEW: `docs/design/decorative-vocabulary.md` (wiring map doc)

## Implementation Steps

1. **Scaffold sub-dir** (15min): create `decorative/` + 8 empty files + re-exports.
2. **Build 8 primitives** (4-5h, ~30-40min each):
   - MeshGradient — CSS `background: conic-gradient(...)` + transform
   - NoiseTexture — `<svg><filter id="noise"><feTurbulence .../></filter><rect filter="url(#noise)"/></svg>`
   - LayeredShapes — 3-5 absolutely positioned circles/rects with offsets
   - AsymmetricGrid — CSS grid 12-col with `grid-template-areas`
   - DuotoneOverlay — `mix-blend-mode: multiply` on gradient
   - TypographicMark — `position: absolute; font-size: 12rem; opacity: 0.05;`
   - GridLines — `background-image: linear-gradient()` repeating
   - DiagonalStripe — `transform: skewY(-6deg)` on absolutely positioned div
3. **Test each primitive** (1h): unit test each renders + accepts props + no runtime errors.
4. **Wire variant decorative map** (4-5h): import + render primitive inside each variant component. Remove GradientBlob where duplicated.
5. **Visual QA** (1-2h): generate 10 sites × 3 categories, screenshot grid, confirm 4+ distinct decorative vocabularies visible.
6. **Doc** (30min): write `docs/design/decorative-vocabulary.md` with wiring map table.

## Todo list
- [ ] Scaffold decorative/ sub-dir + 8 empty stubs
- [ ] Build MeshGradient
- [ ] Build NoiseTexture
- [ ] Build LayeredShapes
- [ ] Build AsymmetricGrid
- [ ] Build DuotoneOverlay
- [ ] Build TypographicMark
- [ ] Build GridLines
- [ ] Build DiagonalStripe
- [ ] Unit test all 8 primitives
- [ ] Wire CTA variants (4)
- [ ] Wire features variants (8)
- [ ] Wire testimonials variants (6 effective)
- [ ] Wire pricing + about + stats + newsletter + faq
- [ ] Visual QA screenshot grid
- [ ] Doc: decorative-vocabulary.md
- [ ] Commit: `feat(f01): A4 visual diversity — 8 decorative primitives + wiring`

## Success Criteria
- 8 new primitives exported (`grep "export .* from './decorative/" src/blocks/shared/decorative.tsx` = 8).
- 0 tsc errors.
- 20 unit tests pass (8 primitives × 2-3 tests each).
- Visual QA grid: ≥ 4 distinct decorative vocabularies visible across 30 blocks.
- Bundle size impact ≤ 8KB gzipped.

## Risk Assessment
- **Risk**: NoiseTexture SVG filter heavy on mobile → FPS drop. **Mitigation**: `will-change: transform` avoid; use `backdrop-filter` sparingly; test on mid-tier Android.
- **Risk**: TypographicMark with font-size 12rem overflow container. **Mitigation**: `overflow: hidden` on parent; clamp font-size responsive.
- **Risk**: Wiring 20+ variants breaks existing visual snapshots. **Mitigation**: snapshot update PR separate; Storybook review.
- **Risk**: AsymmetricGrid complex grid may conflict with existing features grid-2/3/4. **Mitigation**: scope asymmetric to "zigzag" variant only; default grid variants unchanged.

## Security Considerations
None — pure presentational SVG/CSS. SVG uses static filter IDs, no user input.

## Next steps
Phase 04 (A5) depends — A5's 4 new team variants + 4 cta variants use A4 primitives.
