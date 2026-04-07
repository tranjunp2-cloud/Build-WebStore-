---
phase: 02
title: "Fix Broken/Stub Variants"
effort: ~4h
status: pending
depends_on: phase-01
---

# Phase 02: Fix Broken/Stub Variants

## Context
- Parent plan: [plan.md](./plan.md)
- ~13 variants fall through to default rendering
- User chon variant nhung khong thay su khac biet — UX confusing

## Overview
Implement unique rendering cho moi dead/fallthrough variant. Uu tien theo block importance.

## Requirements
- Moi variant visual output khac biet ro rang
- Giu consistent voi existing design language
- Khong break existing variants
- Prefer switch/case voi extracted component functions

## Architecture

**hero block refactor** (856 LOC → router + variants/):
```
src/blocks/hero/
  index.tsx          — clean switch/case router (< 100 LOC)
  variants/
    centered.tsx, split.tsx, fullscreen.tsx, video.tsx (NEW),
    magazine.tsx, minimal.tsx, cards-overlay.tsx, gradient.tsx,
    parallax.tsx, slideshow.tsx, split-video.tsx
  shared.tsx         — CTAButtons, shared utils
  config.ts          — unchanged
```

## Related Files
- `src/blocks/hero/index.tsx` (856 LOC — refactor priority)
- `src/blocks/gallery/index.tsx` (361 LOC — 2 dead variants)
- `src/blocks/navigation/index.tsx` (523 LOC — 2 dead variants)
- `src/blocks/testimonials/index.tsx` (509 LOC — 2 dead variants)
- `src/blocks/pricing/index.tsx` (606 LOC — 1 dead variant)
- `src/blocks/footer/index.tsx` (359 LOC — 2 dead variants)

## Implementation Steps

### P1: hero block (~1.5h)
1. Tao `variants/` directory, extract moi variant
2. Implement `video` variant — full-bleed background video voi text overlay
3. Update index.tsx → clean switch/case router
4. Test 12 variants

### P2: gallery block (~30min)
1. `masonry` — CSS columns layout voi staggered heights
2. `carousel` — horizontal scroll voi nav arrows

### P3: navigation block (~30min)
1. `centered` — logo centered, links split left/right
2. `mega-menu` — dropdown panels voi multi-column layout

### P4: testimonials block (~30min)
1. `carousel` — auto-rotating single testimonial voi dots
2. `simple` — plain list, no cards, minimal styling

### P5: pricing block (~20min)
1. `table` — HTML table layout voi feature comparison rows

### P6: footer block (~20min)
1. `expanded` — multi-column voi newsletter form
2. `minimal` — single line, copyright + social icons only

## Todo
- [ ] hero: tao variants/ dir, extract components
- [ ] hero: implement `video` variant
- [ ] hero: convert to switch/case router
- [ ] gallery: implement `masonry` + `carousel`
- [ ] navigation: implement `centered` + `mega-menu`
- [ ] testimonials: implement `carousel` + `simple`
- [ ] pricing: implement `table`
- [ ] footer: implement `expanded` + `minimal`
- [ ] Test tat ca 13 fixed variants trong editor

## Success Criteria
- 0 dead/fallthrough variants
- Moi variant visually distinguishable
- No regression tren existing variants
- Hero block index.tsx < 100 LOC (router only)

## Risk Assessment
- **Medium**: Thay doi rendering co the break saved templates
- **Mitigation**: Chi ADD branches, khong modify default behavior
- **Mitigation**: Test voi existing template data truoc merge
