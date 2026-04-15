# Phase 04 — Visual Diversity Pass

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 01, 02
- Related: [researcher-01 summary](research/researcher-01-component-status.md) (low inter-variant contrast + missing Wix-tier decorative layers)

## Overview
- Date: 2026-04-15
- Description: Diversify decorative vocabulary across variants in features/testimonials/pricing/contact/hero so 8 variants actually LOOK like 8 designs, not 8 shades of brand-tinted gradient blobs.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights
- Root cause per researcher-01: **"every variant uses the SAME linear-gradient rgba(brand-primary) → transparent card bg — 8 variants render as shades of the same look"**. This is THE reason user says "chưa đẹp".
- Missing decorative layers: mesh gradients, noise textures, layered shapes, asymmetric grids, broken-grid, typographic hero, image mask, duotone overlays.
- Wix-tier sites use 3-5 distinct decorative "languages" per page, not one.

## Requirements
- Build shared `src/blocks/_decorative/` library: `{MeshGradient, NoiseTexture, LayeredShapes, AsymmetricGrid, DuotoneOverlay, TypographicMark, GridLines, DiagonalStripe}`.
- Each variant in features/testimonials/pricing/contact/hero MUST use a distinct decorative treatment (enforced via code review checklist).
- Variant card styles: vary between `bordered`, `filled`, `glass`, `shadow`, `neumorphic`, `outlined-accent`, `underline-only`, `stacked-paper`.
- Testimonials video-text variant: remove bogus `md:direction-rtl`, replace with proper `md:flex-row-reverse`.
- Modernize decorative quote mark in testimonials (swap giant serif `"` for geometric SVG or remove).

## Architecture
```
src/blocks/_decorative/
├── mesh-gradient.tsx      # CSS conic/radial gradient mesh
├── noise-texture.tsx      # SVG turbulence filter
├── layered-shapes.tsx     # absolutely-positioned SVG shapes
├── asymmetric-grid.tsx    # CSS grid w/ span variation
├── duotone-overlay.tsx    # blend-mode color duotone
├── typographic-mark.tsx   # large watermark number/letter
├── grid-lines.tsx         # background-image linear gradients
└── diagonal-stripe.tsx    # skewed div bg
```
Each variant imports 1-2 decoratives. Review checklist: no variant may import same decorative as its sibling.

## Related code files
- `src/blocks/features/index.tsx` (356 LOC, 8 variants)
- `src/blocks/testimonials/index.tsx` (746 LOC, video-text rtl bug)
- `src/blocks/pricing/index.tsx` (789 LOC — consider split)
- `src/blocks/contact/index.tsx` (413 LOC, 6 variants)
- `src/blocks/hero/variants/*.tsx` (11 variants)

## Implementation Steps
1. Build 8 decorative primitives under `_decorative/`.
2. Audit features: map each of 8 variants → distinct decorative assignment + card style.
3. Audit testimonials: same mapping; fix video-text rtl bug; modernize quote mark.
4. Audit pricing: split 789 LOC into `variants/` subdir; assign decoratives.
5. Audit contact: vary input styles per variant (solid underline / floating label / outlined / filled / glass / borderless).
6. Audit hero variants: 3 "wow" variants get mesh bg / image mask / typographic treatment.
7. Visual QA: render matrix of all variants in 3 themes → confirm decorative diversity.

## Todo list
- [ ] Build 8 decorative primitives
- [ ] Features: decorative map + card style map
- [ ] Testimonials: rtl fix + quote modernize + decoratives
- [ ] Pricing: split to subdir + decoratives
- [ ] Contact: input style variation
- [ ] Hero: 3 wow-variant upgrades
- [ ] Visual QA matrix

## Success Criteria
- 8 decorative primitives shipped.
- 0 sibling variants share decorative.
- Side-by-side of 8 features variants = 8 distinct looks (QA sign-off).
- Testimonials `md:direction-rtl` removed.

## Risk Assessment
- **Risk**: decoratives add bundle size. **Mitigation**: pure CSS/SVG, no libs, tree-shakeable.
- **Risk**: variant "rebranding" breaks stored sites. **Mitigation**: variant *names* unchanged, only internals differ.
- **Risk**: noise/mesh hurts perf on low-end devices. **Mitigation**: respect prefers-reduced-motion; disable noise on mobile.

## Security Considerations
None — purely visual.

## Next steps
Parallel with 05 and 06.
