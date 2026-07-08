# Research: Template & Block System

## Three Generation Paths

| Path | Entry | Variety Potential | Actual Variety |
|------|-------|-------------------|----------------|
| AI (GPT-4o) | `generateSiteWithAI()` | HIGH | LOW (prompt doesn't instruct variety) |
| Fallback | `generateBlocks()` | ZERO | ZERO (100% deterministic) |
| Template | `composeTemplate()` | LOW | LOW (only hero varies) |

## Block Registry: 47 blocks total

- Core (14): navigation, hero, features, about, testimonials, faq, contact, gallery, footer, pricing, cta, stats, team, newsletter
- Utility (8): video, logo-cloud, blog-list, products-grid, products-featured, custom-html, social-widget, cart-widget
- v1.1 (15): pricing-table, gallery-masonry, whatsapp-button, google-maps, social-proof, countdown-timer, before-after, feature-comparison, etc.
- v2.0 industry (8): menu-display, booking-widget, class-schedule, review-cards, video-showcase, doctor-profile, property-card, product-quick-view

## Hardcoded Variants in Template Composer

**14 out of 15 builder functions always produce the same variant.** Only hero varies.

| Builder | Hardcoded Variant | Available Variants |
|---------|------------------|--------------------|
| buildNavigation | 'simple' | simple, centered, mega-menu, transparent, sidebar, pill |
| buildFeatures | 'grid-3' | grid-2, grid-3, grid-4, list, icon-top, icon-left, zigzag, carousel |
| buildTestimonials | 'cards' | cards, carousel, simple, masonry, spotlight, minimal-quote, avatar-row, video-text |
| buildContact | 'split' | form, info-only, split, card-float, map-split, minimal-inline |
| buildFooter | 'expanded' | simple, expanded, minimal, centered-stack, mega-footer, dark-gradient |
| buildStats | 'row' | row, grid, highlight |
| buildGallery | 'grid' | grid, masonry, carousel, lightbox, filmstrip, justified |
| buildFAQ | 'accordion' | accordion, grid, simple |
| buildCTA | 'banner' | banner, inline, floating |
| buildAbout | 'split' | simple, split, story |
| buildPricing | 'cards' | cards, table, horizontal, toggle, tiered, comparison, minimal, slider |
| buildTeam | 'grid' | grid, list |
| buildNewsletter | 'inline' | inline, popup, banner |

## Template Definitions

- **Old**: 48 `ComposerInputLegacy` — vary only businessIndex + themePreset, NOT block structure
- **New**: 56 `TemplatePreset` blueprints with explicit `PageBlueprint[]` / `BlockSpec[]`, but many leave variant undefined
- **Category DNA**: defines signatureBlocks + mandatoryHomepageOrder per category — but order is FIXED

## Content System (16 files in `src/lib/ai/content/`)
- One per category, 4-5 business samples each
- Rich, Malaysia-localized content
- But only one content SET per category per business sample
