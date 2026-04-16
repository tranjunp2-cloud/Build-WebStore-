# Component Status Audit

Terse. Polish: 1=stub, 5=Wix-level. Tokens=uses `@/lib/design-tokens` + `CSS_VARS`. Anim=AnimatedSection/framer-motion. Edge=missing data/long text handled.

> **Changelog 2026-04-15** — Navigation block: polish 3 → 4 sau khi fix 11 chỗ hardcode màu (nav bg đen `rgba(9,9,11,0.85)`, dropdown navy `#0F172A`, pill trắng `rgba(255,255,255,0.90)`). Giờ dùng `color-mix(in srgb, var(--background) X%, transparent)` + `var(--text)` → theme-adaptive cho cả light/dark. Theme adaptation score: 1/5 → 5/5. TypeScript sạch. 4 lỗi còn lại tracked ở `nav-bugfix-followup.md`.

## Scorecard

| Block | LOC | Variants | Polish | Tokens | Anim | Resp | Edge | Top issues |
|---|---|---|---|---|---|---|---|---|
| navigation | 924 | 6 (simple/centered/mega-menu/transparent/sidebar/pill) | 4 ✨ | yes | yes | yes | part | ~~dark dropdown bg~~ fixed 2026-04-15. Còn: monolith 924 LOC, CTA URL hardcode `/contact`, không scroll-shrink |
| hero | 36+937 (11 variants) | 11 (centered/split-L/split-R/fullscreen/magazine/minimal/cards-overlay/gradient/parallax/slideshow/split-video/video) | 4 | yes | yes | yes | yes | many variants are thin (49-65 LOC) → samey feel; no layered bg/shapes like Wix; image aspect varies wildly |
| contact | 413 | 6 (form/info-only/split/card-float/map-split/minimal-inline) | 4 | yes | yes | yes | yes | form is visual-only (onSubmit prevent), no validation/state; inputs all same glass style |
| faq | 205 | 3 (accordion/grid/simple) | 4 | yes | yes | yes | yes (early-return empty) | only 3 variants — feels thin; no icon/number/category UI; chevron is raw SVG |
| footer | 478 | 6 (simple/expanded/minimal/centered-stack/mega-footer/dark-gradient) | 4 | yes | no (static) | yes | yes | NO animations at all; newsletter inputs are inert; social icon fallback `<span>` for tiktok |
| features | 356 | 8 (grid-2/3/4/list/icon-top/icon-left/zigzag/carousel) | 4 | yes | yes (Stagger+Hover) | yes | part (no empty state, no image fallback) | every variant uses same GradientBlob+brand-tint — visually mono-tone; icons rendered as emoji string, no proper icon lib |
| testimonials | 746 | 8 (cards/carousel/simple/masonry/spotlight/minimal-quote/avatar-row/video-text) | 5 | yes | yes (Stagger+AnimatePresence+autoplay+reduce-motion) | yes | yes (early-return) | video-text has `md:direction-rtl` bogus class; decorative quote mark looks dated |
| pricing | 789 | 8 (cards/table/horizontal/toggle/tiered/comparison/minimal/slider) | 4 | yes | yes (stagger+motion) | yes | part | giant 789 LOC file — comparison/table variants likely have horizontal overflow on mobile; no "most popular" badge animation |
| cta | 146 | 3 (banner/inline/floating) | 3 | yes | yes (+useReducedMotion) | yes | part | only 3 variants — repetitive across sites; banner uses hard gradient primary→secondary ignores site mood; no image/shape decorative layer |
| about | 238 | 3 (simple/split/story) | 3 | yes | yes | yes | part (falls to industry img) | only 3 variants; "story" timeline undersampled; no stats/values/mission-vision combo like Wix |
| gallery | 531 | 6 (grid/masonry/carousel/lightbox/filmstrip/justified) | 4 | yes | yes | yes | yes (placeholder fallback) | hover overlay gradient generic; no filter/tag/category; justified likely fake (grid with fixed aspect) |
| stats | 204 | 3 (row/grid/highlight) | 4 | yes | yes (CountUp+inView+reduce-motion) | yes | yes ("24/7" fix applied) | only 3 variants; no icon per stat, no comparison/trend arrows, no background variation |
| team | 181 | 2 (grid/list) | 2 | yes | yes (Stagger+Hover) | yes | part (InitialsAvatar fallback) | only 2 variants — extremely thin; socials rendered as TEXT pill not icon; no bio expand, no filter by role |
| newsletter | 230 | 3 (inline/popup/banner) | 3 | yes | yes | yes | yes (has real submit+validate+states) | only 3 variants; popup variant is likely just a styled card not an actual modal; no lead-magnet/incentive UI |

## Details

### 1. navigation (src/blocks/navigation/index.tsx — 924 LOC) — UPDATED 2026-04-15
**Variants**: 6 — simple, centered, mega-menu, transparent, sidebar, pill. All inline in ONE file (no variants/ subdir).
**State**: works + theme-adaptive sau vòng fix 11 chỗ hardcode màu. Dropdown panel, mobile drawer, sidebar, pill, transparent nav scrolled state — tất cả dùng `color-mix(in srgb, var(--background|surface) X%, transparent)` + `var(--text)`. Hover dropdown + recursive children + 44px touch target + framer motion animations đầy đủ.
**Variant rotation**: ĐÃ HOẠT ĐỘNG qua `rotateStructuralVariants` + `NAV_VARIANT_BY_CATEGORY` (14 categories × 3 variants). Site cùng category được rotate qua các variant khác nhau theo seed.
**Issues còn lại** (tracked ở nav-bugfix-followup.md):
- CTA URL hardcode `/contact` trong buildNavigation → 404 nếu site không có contact page.
- Composer default `variant: 'simple'` — rotate override nhưng kẹt nếu path không qua rotate.
- Logo logic duplicate trong TransparentNav (chưa dùng shared NavLogo).
- Không scroll-shrink cho simple/centered/mega-menu.
- File 924 LOC monolith — chưa split (để Phase 03).
**Fix effort còn lại**: S (3-4h cho 4 lỗi trên). Refactor split-file vẫn L (4-6h, để Phase 03).

### 2. hero (src/blocks/hero/index.tsx 36 LOC dispatcher, 11 variants 49-127 LOC each)
**Variants**: 11 real files — split-left/right share split.tsx. Dispatcher is clean.
**State**: variant files are small (49-110 LOC) suggesting shallow composition — mostly text + image + CTA, relies on decorative/GradientBlob for polish.
**Issues**: (1) Variants feel samey because they share the same decorative vocabulary (gradient blob, brand tint) and only re-arrange text/image — no bold typography, layered shapes, or asymmetric grids that Wix/Framer use. (2) No mesh gradients, no noise texture, no overlapping-image/broken-grid layouts, no scroll-linked parallax beyond `parallax` variant.
**Fix effort**: L — need 3-4 new "wow" variants (broken-grid, image-mask, typographic-hero, mesh-bg) + richer decorative library.

### 3. contact (413 LOC, 6 variants)
**State**: good structural variety (form / info-only / split / card-float / map-split / minimal-inline), uses GlassCard + ContactInfoCard helpers, map variant has real iframe.
**Issues**: (1) Form is decorative — `onSubmit={e.preventDefault()}`, no real state/validation/toast. (2) All inputs use same rgba glass look — no variant-specific style so "6 variants" often look similar.
**Fix effort**: M (hook form state; vary input styles per variant).

### 4. faq (205 LOC, 3 variants)
**State**: accordion has proper ARIA + keyboard nav + framer AnimatePresence; grid + simple are stagger lists. Early-returns empty.
**Issues**: (1) Only 3 variants → every site gets same look. (2) No icons, numbered list, category chips, search, or two-column split layouts.
**Fix effort**: M (add 2-3 variants: numbered, category-tabs, search-filter).

### 5. footer (478 LOC, 6 variants)
**State**: 6 variant breadth (simple, expanded, minimal, centered-stack, mega-footer, dark-gradient), token-driven, good helper extraction (FooterSection/BrandLogo/SocialIconList/LinkColumn).
**Issues**: (1) ZERO animations — no stagger, no reveal on scroll (footer is dead static). (2) Newsletter inputs in mega-footer + expanded are inert (no submit handler), tiktok falls back to `<span>`. No legal-bar + payment-badges + app-store badges variant.
**Fix effort**: S (add reveal anim + wire newsletter to /api/subscribe).

### 6. features (356 LOC, 8 variants)
**State**: broadest variant set (grid-2/3/4/list/icon-top/icon-left/zigzag/carousel), proper StaggerGrid + HoverCard + IconContainer, carousel has scroll-state+arrows.
**Issues**: (1) Every variant uses the SAME `linear-gradient rgba(brand-primary) → transparent` card bg — 8 variants render as shades of the same look. (2) Icons are stored as `feature.icon` string (emoji or single char) — no lucide/heroicons integration, so icon quality is user-dependent.
**Fix effort**: M (diversify card styles per variant: bordered / filled / glass / shadow / neumorphic; plug in lucide icon picker).

### 7. testimonials (746 LOC, 8 variants) — BEST IN CLASS
**State**: 8 variants (cards/carousel/simple/masonry/spotlight/minimal-quote/avatar-row/video-text), auto-rotate w/ reduce-motion, layoutId shared transitions, dot indicators with 44px touch target, star rating helper, AuthorMeta helper.
**Issues**: (1) video-text uses bogus `md:direction-rtl` class (invalid Tailwind). (2) Decorative `&ldquo;` quote mark giant font serif feels 2019.
**Fix effort**: XS (fix class bug, modernize quote).

### 8. pricing (789 LOC, 8 variants)
**State**: largest block — 8 variants cards/table/horizontal/toggle/tiered/comparison/minimal/slider. PriceDisplay+PlanCTA helpers, `useState` for toggle.
**Issues**: (1) File is 789 LOC single file — hard to maintain, probably duplicates. (2) `comparison`/`table` variants on mobile likely overflow — no obvious mobile fallback pattern seen in first 80 LOC. (3) No animated "most popular" badge, no annual-discount pill anim.
**Fix effort**: M (split into variants/ subdir, verify mobile for table/comparison).

### 9. cta (146 LOC, 3 variants)
**State**: thin — banner/inline/floating. Uses useReducedMotion, trackEvent analytics, proper TOUCH_TARGET.
**Issues**: (1) Only 3 variants, repetitive across a generated site. (2) Banner hard-codes `linear-gradient(135deg, primary, secondary)` — every site gets the same look; no image/shape/testimonial-embedded CTA.
**Fix effort**: M (add: image-bg, split-testimonial, dark-card, gradient-mesh, urgency-timer variants).

### 10. about (238 LOC, 3 variants)
**State**: simple/split/story — uses AboutSection helper, fetches industry image fallback.
**Issues**: (1) Only 3 variants, undersampled for such a critical block. (2) No mission/vision/values grid, no stats-inline, no timeline w/ imagery, no founder-quote.
**Fix effort**: M-L (add 3-4 variants).

### 11. gallery (531 LOC, 6 variants)
**State**: grid/masonry/carousel/lightbox/filmstrip/justified, has real lightbox with keyboard nav imports (X, ChevronLeft/Right), placeholder fallback, hover caption overlay.
**Issues**: (1) No filter-by-tag/category UI (Wix ships this). (2) `justified` variant is suspect — without measuring image dimensions you can't do true justified; likely just a fixed-aspect grid.
**Fix effort**: M (add filter chips, verify justified implementation).

### 12. stats (204 LOC, 3 variants)
**State**: row/grid/highlight, CountUp with useInView + reduce-motion, recent fix for "24/7" multi-digit values.
**Issues**: (1) Only 3 variants. (2) No icon-per-stat, no trend arrows (↑+12%), no comparison/before-after, no background image/pattern variants.
**Fix effort**: S (add 2 variants w/ icons + bg-image).

### 13. team (181 LOC, 2 variants) — WEAKEST
**State**: grid/list only. MemberAvatar w/ InitialsAvatar fallback. SocialLinks renders platform name as TEXT pill (`{s.platform}`), not icon.
**Issues**: (1) Only 2 variants — fewer than any other critical block. (2) Social links are text-pills, not icons — looks amateur. No bio-expand modal, no filter-by-role, no cards-with-hover-reveal, no horizontal scroll, no org-chart.
**Fix effort**: M (add 3 variants + swap social pills for lucide icons + bio modal).

### 14. newsletter (230 LOC, 3 variants)
**State**: inline/popup/banner, useNewsletterForm hook with real POST /api/subscribe + validation + states (idle/loading/success/error).
**Issues**: (1) "popup" variant likely just a styled card block (not an actual `<dialog>` modal with scroll lock) — needs verification. (2) No lead-magnet variant (free PDF/discount code), no multi-step, no social proof count ("10k subscribers").
**Fix effort**: S (verify popup modal; add lead-magnet variant).

## Summary (updated 2026-04-15 sau nav hardcode color fix)
- Blocks ready (polish >=4): **9** — navigation ✨, hero, contact, faq, footer, features, testimonials, pricing, gallery
- Blocks need polish (polish 3): **4** — cta, about, stats, newsletter
- Blocks broken/stub (polish <=2): **1** — team
- Zero "true stubs" remain. Prior plan cleanup DID work — tokens + animations + ARIA are everywhere. The actual gap is **variant breadth + visual differentiation**: too many blocks share the same `GradientBlob + rgba(brand-primary) card tint` visual vocabulary, so an 8-variant block can still render as "8 shades of the same thing". User's "chưa đẹp" feeling = low inter-variant contrast + missing Wix-tier decorative layers (mesh gradients, layered shapes, broken grids, noise, asymmetric imagery), NOT missing blocks.
- Total fix effort estimate: **~40-60h** — 1 L (navigation rewrite), 1 L (hero wow variants), 4 M (features/pricing/about/team/cta variant expansion), rest S/XS.

## Unresolved questions
- Q1: Is the "popup" newsletter variant actually a real modal (focus trap, scroll lock, esc) or a styled card? (Need to read 80-230.)
- Q2: Does `pricing` comparison/table variant work on mobile 375px, or does it horizontal-scroll/break? (Need visual test.)
- Q3: Does navigation `transparent` variant become solid on scroll, or is it always transparent? (Only read first 80 LOC.)
- Q4: Is the "samey across variants" issue because the AI gen always picks the same variant name, or because the variants themselves look alike? (Need to check AI gen variant distribution logs + render screenshots.)
