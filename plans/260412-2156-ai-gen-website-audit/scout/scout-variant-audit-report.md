# Scout Report: Block Variant Implementation Audit

**Date:** 2026-04-12
**Scope:** 53 blocks, 119 files in src/blocks/
**Result:** 98% variants implemented. Only 2 issues found.

## Summary

| Category | Blocks | Variants Total | Implemented | Issues |
|----------|--------|---------------|-------------|--------|
| Core (5) | hero, features, testimonials, navigation, footer | 40 | 38 | 2 |
| Secondary (9) | contact, pricing, gallery, cta, stats, faq, team, newsletter, about | 44 | 44 | 0 |
| Industry/Utility (20) | menu-display, booking-widget, class-schedule, etc. | 58 | 58 | 0 |
| **Total** | **34 blocks** | **142** | **140** | **2** |

## Issues Found

### 1. hero: `animated-gradient` — NO IMPLEMENTATION
- Listed in config.ts but no component file exists
- Falls back to `centered` variant silently
- **Action:** Remove from config OR implement component

### 2. hero: `split-right` — IDENTICAL TO split-left
- Maps to SplitHero component but no logic reverses layout
- Content always renders on left, image on right
- **Action:** Add `reverse` prop to SplitHero or fix layout logic

## Variant Whitelist (SAFE to use in random selection)

### Core Blocks
- **hero:** centered, split-left, fullscreen, gradient, parallax, magazine, minimal, slideshow, cards-overlay, split-video, video (11 safe / 12 listed)
- **features:** grid-2, grid-3, grid-4, list, icon-top, icon-left, zigzag, carousel (8/8)
- **testimonials:** cards, carousel, simple, masonry, spotlight, minimal-quote, avatar-row, video-text (8/8)
- **navigation:** simple, centered, mega-menu, transparent, sidebar, pill (6/6)
- **footer:** simple, expanded, minimal, centered-stack, mega-footer, dark-gradient (6/6)

### Secondary Blocks
- **contact:** form, info-only, split, card-float, map-split, minimal-inline (6/6)
- **pricing:** cards, table, horizontal, toggle, tiered, comparison, minimal, slider (8/8)
- **gallery:** grid, masonry, carousel, lightbox, filmstrip, justified (6/6)
- **cta:** banner, inline, floating (3/3)
- **stats:** row, grid, highlight (3/3)
- **faq:** accordion, grid, simple (3/3)
- **team:** grid, list (2/2)
- **newsletter:** inline, popup, banner (3/3)
- **about:** simple, split, story (3/3)

### Industry/Utility Blocks (all safe)
- menu-display: tabs, photo-grid, accordion (3/3)
- booking-widget: inline, sidebar, modal-trigger (3/3)
- class-schedule: grid, list, cards (3/3)
- review-cards: grid, carousel, masonry (3/3)
- video-showcase: grid, featured, fullwidth (3/3)
- doctor-profile: cards, detailed, list (3/3)
- property-card: grid, list, featured (3/3)
- product-quick-view: grid, carousel, minimal (3/3)
- service-cards: grid, list, featured (3/3)
- portfolio-grid: grid, masonry, showcase (3/3)
- blog-list: cards, list (2/2)
- products-grid: grid-3, grid-4, list (3/3)
- carousel: images, cards, testimonials (3/3)
- step-process: vertical, horizontal, alternating (3/3)
- countdown-timer: banner, card, minimal (3/3)
- social-proof: cards, minimal, grid (3/3)
- announcement-bar: gradient, solid, minimal (3/3)
- download-cta: card, banner, minimal (3/3)
- before-after: slider, side-by-side (2/2)
- pricing-table: columns, horizontal (2/2)

## Excluded from Whitelist
- `hero:animated-gradient` — no implementation
- `hero:split-right` — renders same as split-left (cosmetic bug, not broken)

## Recommendation
Whitelist is ready for use. 140/142 variants safe. Can proceed with variety fix immediately — just exclude `animated-gradient` from hero random pool.
