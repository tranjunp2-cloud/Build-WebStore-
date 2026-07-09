# PRD: F30 — Template System v2 Sprint 2: Block Variant Expansion

| Field | Value |
|---|---|
| **Feature ID** | F30 |
| **Sprint** | Sprint 2 — Visual Variety |
| **Duration** | 5 days |
| **Depends on** | Sprint 1 (Design Tokens) |
| **Author** | PM |
| **Status** | Draft |
| **Created** | 2026-04-06 |
| **Last updated** | 2026-04-06 |

---

## 1. Overview

Sprint 2 expands the visual variety of the block system by increasing variant counts across 8 core block families — from the current **25 total variants** to **67 total variants** (42 new). This gives AI Builder and manual editors significantly more layout options, making every generated site feel unique rather than template-stamped.

### Current State (Sprint 1 baseline)

| Block | Current Variants | Count |
|---|---|---|
| Hero | `centered`, `split-left`, `split-right`, `fullscreen`, `video` | 5 |
| Features | `grid-2`, `grid-3`, `grid-4`, `list` | 4 |
| Testimonials | `cards`, `carousel`, `simple` | 3 |
| Pricing | `cards`, `table` | 2 |
| Gallery | `grid`, `masonry`, `carousel` | 3 |
| Footer | `simple`, `expanded`, `minimal` | 3 |
| Contact | `form`, `info-only`, `split` | 3 |
| Navigation | `simple`, `centered`, `mega-menu` | 3 |
| **Total** | | **26** |

### Target State (end of Sprint 2)

| Block | Target Variants | Count |
|---|---|---|
| Hero | 5 existing + 7 new | **12** |
| Features | 4 existing + 4 new | **8** |
| Testimonials | 3 existing + 5 new | **8** |
| Pricing | 2 existing + 6 new | **8** |
| Gallery | 3 existing + 3 new | **6** |
| Footer | 3 existing + 3 new | **6** |
| Contact | 3 existing + 3 new | **6** |
| Navigation | 3 existing + 3 new | **6** |
| **Total** | | **60** |

**Net new variants: 34**

---

## 2. User Stories

### US-F30-01: AI Builder generates visually distinct sites

> **As a** first-time user running AI Builder,
> **I want** the AI to select from a wide variety of hero and section variants,
> **So that** my generated website feels unique and not like every other site on the platform.

**Acceptance Criteria:** AI Builder prompt context includes all 60 variants; consecutive generations for the same industry produce visually different layouts at least 80% of the time.

### US-F30-02: Editor user swaps variant in the visual editor

> **As a** site owner editing my website,
> **I want** to browse available variants for each block and swap with one click,
> **So that** I can experiment with different visual styles without losing my content.

**Acceptance Criteria:** Variant selector shows thumbnail/name for all variants; swapping preserves all content fields; undo restores the previous variant.

### US-F30-03: Mobile user views a variant-rich site on phone

> **As a** visitor browsing a site on my phone (390px width),
> **I want** every block variant to display correctly with readable text and tap-friendly buttons,
> **So that** I have a good experience regardless of which variant the site owner chose.

**Acceptance Criteria:** All 60 variants pass visual regression at 390px; no horizontal overflow; touch targets >= 44px.

### US-F30-04: Developer adds a new variant to an existing block

> **As a** developer,
> **I want** a clear pattern for adding variants (config type, schema enum, component branch, meta update),
> **So that** I can add new variants consistently without breaking existing ones.

**Acceptance Criteria:** Adding a new variant requires changes in exactly 3 files: `config.ts` (type + schema + meta), `index.tsx` (render branch), and optionally a test file. No registry changes needed.

---

## 3. Variant Naming Convention

All variant names follow **kebab-case** with a **descriptive layout name**:

```
{layout-style}[-modifier]
```

**Rules:**
1. Max 20 characters
2. Kebab-case only (lowercase + hyphens)
3. Name describes the **visual layout**, not the use case
4. No block-type prefix (the block type is already known from context)
5. Existing variants keep their current names (backward compatible)

**Examples:** `magazine`, `cards-overlay`, `gradient`, `split-video`, `minimal-dark`, `horizontal-scroll`

---

## 4. Functional Requirements

### FR-01: Hero Block — 7 New Variants (5 existing + 7 new = 12 total)

The Hero block must support 12 variants total. Each variant renders a distinct above-the-fold layout using the same `HeroConfig` data shape (`headline`, `subheadline`, `ctaButtons`, `image`, `badge`, `overlay`, `overlayOpacity`, `height`).

**New config fields required:**
- `videoUrl?: string` — for `split-video` and `slideshow` variants
- `gradientPreset?: 'aurora' | 'sunset' | 'ocean' | 'forest'` — for `gradient` variant
- `images?: ImageRef[]` — for `slideshow` variant (multiple images)

#### 4.1 New Hero Variants

| # | Variant Name | Visual Description |
|---|---|---|
| H1 | `magazine` | Asymmetric 2-column grid: large hero image (60% width) on left with subtle parallax, headline + subheadline + CTA stacked on right (40%). Badge floats above headline. Image has a thin border using `primaryColor` at 20% opacity. |
| H2 | `minimal` | Clean single-column, no image. Oversized headline (8xl on desktop) centered, subheadline below in muted text, single CTA button centered. Large whitespace above and below. Background uses a single subtle radial gradient from `primaryColor` at 5% opacity. |
| H3 | `cards-overlay` | Full-width background image with dark overlay (`overlayOpacity`). Content floats in a frosted-glass card (backdrop-blur-xl + white/10 bg) centered on the image. Badge, headline, subheadline, and CTAs inside the card. |
| H4 | `gradient` | No image. Animated CSS gradient background cycling through 3 colors derived from `primaryColor` (base, +30deg hue, +60deg hue). Headline centered in white, subheadline in white/70. CTA buttons use glass style. Animation: 8s ease infinite. |
| H5 | `parallax` | Full-bleed background image with CSS `background-attachment: fixed` (parallax on desktop, static on mobile). Headline and CTA overlay centered vertically. Dark gradient overlay from bottom (0% to 60% opacity). |
| H6 | `slideshow` | Image carousel (auto-advances every 5s) as background, with crossfade transition. Content overlay centered: headline, subheadline, CTAs. Dot indicators at bottom. Uses `images[]` array; falls back to single `image` if array is empty. |
| H7 | `split-video` | 2-column layout like `split-left` but right side is an autoplaying muted looping video (`videoUrl`) in a rounded container. Left side has headline, subheadline, CTAs. Video has a play/pause toggle button overlay. |

### FR-02: Features Block — 4 New Variants (4 existing + 4 new = 8 total)

Each variant renders the same `FeaturesConfig` data shape (`headline`, `subheadline`, `features[]` with `icon`, `title`, `description`).

| # | Variant Name | Visual Description |
|---|---|---|
| F1 | `icon-top` | Each feature in a card with large icon centered above title. Cards have subtle border, hover lifts with shadow. 3-column grid on desktop, 1-column on mobile. |
| F2 | `icon-left` | Horizontal layout per feature: icon on the left (48px circle with `primaryColor` bg at 10%), title + description to the right. Stacked vertically, full-width rows. |
| F3 | `zigzag` | Alternating left-right layout: odd features show icon+text left with illustration right, even features reverse. Each row separated by generous spacing. 2-column on desktop, stacked on mobile. |
| F4 | `carousel` | Horizontal scrollable carousel of feature cards. Each card is a fixed-width (300px) card with icon, title, description. Snap scrolling. Navigation arrows on desktop, swipe on mobile. |

### FR-03: Testimonials Block — 5 New Variants (3 existing + 5 new = 8 total)

Each variant renders `TestimonialsConfig` data shape (`headline`, `testimonials[]` with `quote`, `name`, `title`, `company`, `rating`, `avatar`).

| # | Variant Name | Visual Description |
|---|---|---|
| T1 | `masonry` | Pinterest-style masonry grid (2 cols mobile, 3 cols desktop). Cards have varying heights based on quote length. Each card: quote, star rating, avatar + name + title. |
| T2 | `spotlight` | One large featured testimonial in center (big quote, large avatar, name prominent). Smaller testimonial cards flanking left and right. Click/tap a small card to swap it into spotlight. |
| T3 | `minimal-quote` | Large quotation mark decorative element. Single testimonial shown at a time, full-width. Quote in large italic serif font. Name + title below. Auto-rotates every 6s with fade transition. |
| T4 | `avatar-row` | Row of circular avatars at top. Clicking an avatar reveals that person's testimonial below with a slide-down animation. Active avatar has a `primaryColor` ring border. |
| T5 | `video-text` | Split layout: left side shows a video thumbnail (placeholder image + play icon), right side shows the text quote. If no video URL, falls back to avatar display on left. |

### FR-04: Pricing Block — 6 New Variants (2 existing + 6 new = 8 total)

Each variant renders `PricingConfig` data shape (`headline`, `subheadline`, `plans[]` with `name`, `price`, `period`, `description`, `features`, `ctaLabel`, `ctaUrl`, `highlighted`).

| # | Variant Name | Visual Description |
|---|---|---|
| P1 | `horizontal` | Plans displayed as horizontal rows (full width each). Each row: plan name left, price center, features as inline chips, CTA right. Highlighted plan has `primaryColor` left border. |
| P2 | `toggle` | Standard cards layout with a monthly/yearly toggle switch at top. Price displays switch between monthly and yearly (yearly shows discount badge). Toggle uses `primaryColor`. |
| P3 | `tiered` | Stacked tiers with increasing visual prominence. Basic = minimal card, Pro = slightly elevated + border, Enterprise = largest card with gradient `primaryColor` background. |
| P4 | `comparison` | Full comparison table with features as rows and plans as columns. Checkmarks for included features, dashes for excluded. Highlighted column has `primaryColor` header. |
| P5 | `minimal` | Clean, spacious layout. Plan name, price in large text, short description, single CTA. No feature lists visible by default — expandable accordion reveals features on click. |
| P6 | `slider` | Single plan visible at a time with left/right navigation arrows. Plan shown in a large centered card with all details. Dot indicators for plan count. Swipe on mobile. |

### FR-05: Gallery Block — 3 New Variants (3 existing + 3 new = 6 total)

Each variant renders `GalleryConfig` data shape (`headline`, `images[]` with `image.url`, `image.alt`, `caption`).

| # | Variant Name | Visual Description |
|---|---|---|
| G1 | `lightbox` | Grid layout (like existing `grid`) but clicking an image opens a full-screen lightbox overlay with prev/next navigation, caption display, and close button. Keyboard navigation (arrow keys, Escape). |
| G2 | `filmstrip` | Single large image displayed prominently, with a horizontal scrollable strip of thumbnails below. Clicking a thumbnail swaps the main image with a fade transition. |
| G3 | `justified` | Images arranged in rows with justified alignment (like Flickr). Each row fills the full width; image heights adjust to maintain aspect ratios. No gaps between images; thin 2px gap on hover reveal. |

### FR-06: Footer Block — 3 New Variants (3 existing + 3 new = 6 total)

Each variant renders `FooterConfig` data shape (`logoText`, `logo`, `tagline`, `columns[]`, `copyrightText`, `socials[]`).

| # | Variant Name | Visual Description |
|---|---|---|
| FT1 | `centered-stack` | Everything centered: logo on top, link columns as horizontal lists below, social icons row, copyright at bottom. Clean vertical stack. No multi-column grid. |
| FT2 | `mega-footer` | Large footer with full-width top band (newsletter signup or CTA), then 4-5 column link grid below, then bottom bar with copyright + social icons + legal links. |
| FT3 | `dark-gradient` | Footer with a subtle gradient background from transparent to dark. Logo + tagline left, link columns center, social icons right. Single row layout on desktop, stacked on mobile. |

### FR-07: Contact Block — 3 New Variants (3 existing + 3 new = 6 total)

Each variant renders `ContactConfig` data shape (`headline`, `subtext`, `email`, `phone`, `address`, `formFields[]`).

| # | Variant Name | Visual Description |
|---|---|---|
| C1 | `card-float` | Contact form inside a floating card with shadow, centered on a subtle gradient background. Contact info (email, phone, address) displayed as icon+text chips below the card. |
| C2 | `map-split` | 2-column: left side is a map placeholder (or embedded map if `address` is provided), right side is the contact form. On mobile, map stacks above form. |
| | | > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant. |
| C3 | `minimal-inline` | No card/container. Form fields displayed inline in a single row (name, email, message, submit button). Minimal styling — just bottom borders on inputs. Full-width section. |

### FR-08: Navigation Block — 3 New Variants (3 existing + 3 new = 6 total)

Each variant renders `NavigationConfig` data shape (`logoText`, `logo`, `links[]`, `ctaButton`).

| # | Variant Name | Visual Description |
|---|---|---|
| N1 | `transparent` | Navigation overlays the hero with transparent background. Text is white (assumes dark hero). On scroll, background fades to solid with blur effect (sticky). Logo left, links center, CTA right. |
| N2 | `sidebar` | No top navbar. Instead, a hamburger icon (top-left) opens a full-height sidebar drawer from the left with logo at top, vertical link list, CTA button at bottom. Always hamburger, even on desktop. |
| N3 | `pill` | Floating navigation bar with rounded-full (pill shape) container, centered horizontally with auto-width. Subtle shadow and blur backdrop. Logo left inside pill, links center, CTA right. Margin from top edge. |

### FR-09: Schema & Registry Updates

- Each block's `config.ts` must update: TypeScript type union, Zod `z.enum()` array, and `meta.variants` array
- New config fields (e.g., `videoUrl`, `gradientPreset`, `images[]`) must be added as **optional** fields to maintain backward compatibility
- `blockRegistry` in `registry.ts` requires NO changes (it reads from config meta dynamically)
- All existing variant names remain unchanged (zero breaking changes)

### FR-10: AI Builder Prompt Context Update

- The AI prompt that generates site blocks must include all new variant names and brief descriptions
- AI should weight variant selection based on `siteType` (e.g., portfolio sites favor `magazine` hero, SaaS sites favor `gradient` hero)
- AI must never generate a variant name that does not exist in the config schema

### FR-11: Variant Thumbnail Generation

- Each variant must have a representative thumbnail image (400x300px) stored in `public/variant-thumbnails/{blockType}/{variant}.webp`
- Thumbnails are used in the editor variant selector UI
- Thumbnails should be auto-generated via a script or manually designed (out of Sprint 2 scope for generation; placeholder images acceptable)

---

## 5. Acceptance Criteria (GIVEN / WHEN / THEN)

### AC-01: Hero `magazine` variant renders correctly
- **Given** a hero block with `variant: 'magazine'`, `headline`, `subheadline`, `ctaButtons`, and `image`
- **When** rendered on a desktop viewport (>=1024px)
- **Then** the layout shows a 60/40 asymmetric grid with the image on the left (parallax effect) and text content stacked on the right; badge appears above headline; image has a thin `primaryColor` border at 20% opacity

### AC-02: Hero `gradient` variant renders animated background
- **Given** a hero block with `variant: 'gradient'` and no `image` provided
- **When** rendered
- **Then** the background shows an animated CSS gradient cycling through 3 hue-shifted colors derived from `primaryColor`; headline is white; CTA buttons use frosted-glass style; animation duration is 8 seconds

### AC-03: Hero `split-video` variant plays video
- **Given** a hero block with `variant: 'split-video'` and a valid `videoUrl`
- **When** rendered
- **Then** the right column shows a muted autoplaying looping video in a rounded container; a play/pause toggle is visible; left column contains headline, subheadline, and CTAs

### AC-04: Features `zigzag` variant alternates layout
- **Given** a features block with `variant: 'zigzag'` and 4 feature items
- **When** rendered on desktop
- **Then** odd-indexed features show content on the left and icon/illustration on the right; even-indexed features reverse; on mobile (<=768px), all items stack vertically

### AC-05: Features `carousel` variant supports swipe
- **Given** a features block with `variant: 'carousel'` and 6 feature items
- **When** rendered on mobile
- **Then** features display as horizontally scrollable cards with snap behavior; swipe gesture navigates between cards; only 1 card is fully visible at a time

### AC-06: Testimonials `spotlight` variant highlights selected
- **Given** a testimonials block with `variant: 'spotlight'` and 5 testimonials
- **When** a user clicks a small flanking testimonial card
- **Then** that testimonial moves to the center spotlight position with a smooth transition; the previous spotlight testimonial moves to a side position

### AC-07: Testimonials `masonry` variant renders variable-height cards
- **Given** a testimonials block with `variant: 'masonry'` and testimonials of varying quote lengths
- **When** rendered
- **Then** cards arrange in a masonry grid (2 cols mobile, 3 cols desktop) with no fixed height; cards naturally fill gaps based on content length

### AC-08: Pricing `toggle` variant switches monthly/yearly
- **Given** a pricing block with `variant: 'toggle'`
- **When** the user clicks the monthly/yearly toggle
- **Then** all plan prices animate to show the alternate period; yearly prices display a discount badge (e.g., "Save 20%"); toggle uses `primaryColor`

### AC-09: Pricing `comparison` variant renders feature table
- **Given** a pricing block with `variant: 'comparison'` and 3 plans
- **When** rendered on desktop
- **Then** a full comparison table shows with features as rows and plans as columns; included features show checkmarks; the `highlighted` plan column has a `primaryColor` header; table is horizontally scrollable on mobile

### AC-10: Gallery `lightbox` variant opens fullscreen overlay
- **Given** a gallery block with `variant: 'lightbox'` and 8 images
- **When** a user clicks any image
- **Then** a full-screen overlay opens showing the image at maximum resolution; prev/next arrows navigate between images; pressing Escape or clicking outside closes the lightbox; keyboard arrow keys work

### AC-11: Navigation `transparent` variant transitions on scroll
- **Given** a navigation block with `variant: 'transparent'`
- **When** the page loads
- **Then** the nav has a fully transparent background overlaying the hero; after scrolling 100px, the background transitions to a solid color with backdrop-blur; the nav remains sticky at top

### AC-12: Navigation `pill` variant renders floating container
- **Given** a navigation block with `variant: 'pill'`
- **When** rendered
- **Then** the nav is a rounded-full (pill-shaped) container centered horizontally with margin from the top edge; it has a subtle shadow and blur backdrop; logo on left, links center, CTA right inside the pill

### AC-13: Contact `map-split` variant renders two columns
- **Given** a contact block with `variant: 'map-split'` and an `address` provided
- **When** rendered on desktop
- **Then** the left column shows a map placeholder with the address; the right column shows the contact form; on mobile (<=768px), the map stacks above the form

> ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant.

### AC-14: Footer `mega-footer` variant renders with top band
- **Given** a footer block with `variant: 'mega-footer'`
- **When** rendered
- **Then** a full-width top band is visible (CTA or newsletter area); below it, a 4-5 column link grid; at the bottom, a bar with copyright, social icons, and legal links

### AC-15: All new variants use theme design tokens
- **Given** any new variant from Sprint 2
- **When** the site theme changes (`primaryColor`, `fontHeading`, `fontBody`, `colorMode`)
- **Then** the variant immediately reflects the new theme values; no hardcoded colors exist outside of neutral grays and white/black

### AC-16: Variant swap preserves content
- **Given** a hero block with `variant: 'centered'` containing a headline, subheadline, image, and 2 CTAs
- **When** the user changes the variant to `magazine` in the editor
- **Then** all content (headline, subheadline, image, CTAs) is preserved in the new variant layout; no data is lost

---

## 6. Non-Functional Requirements

### NFR-01: Performance — Render Budget per Variant

- Each variant must render its first paint in **< 50ms** on a mid-range device (Lighthouse simulated throttling)
- No variant should add more than **5KB gzipped** to the block's JavaScript bundle
- Variants that use animations (gradient, parallax, slideshow) must use CSS animations or `will-change` / GPU-composited properties only — no JavaScript `requestAnimationFrame` loops for visual effects
- Slideshow variant: image preloading limited to current + next image only

### NFR-02: Responsive Design — 390px Minimum

- All 60 variants must render correctly at **390px width** (iPhone 14 / SE baseline)
- No horizontal scrollbar on any variant (except intentional horizontal scroll like `carousel`)
- Text remains readable: body >= 14px, headings >= 24px on mobile
- Touch targets (buttons, links, interactive elements) >= **44x44px**
- Multi-column layouts (2-col, 3-col, grid) must collapse to single column at <=768px
- Parallax effect must degrade to static image on mobile (no `background-attachment: fixed` on touch devices)

### NFR-03: Accessibility — WCAG 2.1 AA

- All variants must maintain **color contrast ratio >= 4.5:1** for text against backgrounds
- Interactive elements (carousels, toggles, lightbox) must be keyboard navigable
- Carousel/slideshow variants must have pause controls and respect `prefers-reduced-motion`
- All images must have `alt` text (from `ImageRef.alt` or fallback to headline)
- Lightbox must trap focus while open and restore focus on close
- Pricing toggle must use `role="switch"` with `aria-checked`

### NFR-04: Bundle Size — Code Splitting

- Each block's variant code must be in a single file (`index.tsx`) — no per-variant file splitting (keeps the current pattern)
- However, heavy dependencies (e.g., a lightbox library) must be **dynamically imported** (`next/dynamic` or `React.lazy`)
- Total bundle size increase for all 34 new variants combined must not exceed **40KB gzipped**
- No new npm dependencies for visual variants — use Tailwind CSS, Framer Motion (already installed), and native CSS only

### NFR-05: Theme Token Compliance

- Every new variant must use design tokens from `ThemeConfig` (`primaryColor`, `secondaryColor`, `backgroundColor`, `fontHeading`, `fontBody`, `colorMode`)
- Zero hardcoded brand colors — only neutral palette (gray/white/black) and theme tokens
- Dark mode (`colorMode: 'dark'`) and light mode (`colorMode: 'light'`) must both render correctly for every variant
- Gradient variant must derive all gradient stops from `primaryColor` using HSL hue shifts

---

## 7. Complete Variant Catalog (34 New Variants)

### 7.1 Hero Block (7 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 1 | `magazine` | Asymmetric grid, large image left | `primaryColor` for image border accent |
| 2 | `minimal` | No image, oversized typography | `primaryColor` for subtle radial gradient |
| 3 | `cards-overlay` | Frosted glass card over background image | `primaryColor` for card border glow |
| 4 | `gradient` | Animated gradient background, no image | `primaryColor` + hue shifts for gradient |
| 5 | `parallax` | Fixed background image, content overlay | `primaryColor` for CTA buttons only |
| 6 | `slideshow` | Auto-advancing image carousel background | `primaryColor` for dot indicators |
| 7 | `split-video` | Video on right, content on left | `primaryColor` for play button accent |

### 7.2 Features Block (4 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 8 | `icon-top` | Centered icon above text in cards | `primaryColor` for icon background circle |
| 9 | `icon-left` | Horizontal icon + text rows | `primaryColor` for icon circle bg at 10% |
| 10 | `zigzag` | Alternating left/right sections | `primaryColor` for section divider accents |
| 11 | `carousel` | Horizontal scrollable cards | `primaryColor` for navigation arrows |

### 7.3 Testimonials Block (5 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 12 | `masonry` | Variable-height masonry grid | `primaryColor` for star ratings |
| 13 | `spotlight` | Large center + small flanking cards | `primaryColor` for spotlight card border |
| 14 | `minimal-quote` | Large decorative quotation mark | `primaryColor` for quote mark color |
| 15 | `avatar-row` | Clickable avatar row, expandable | `primaryColor` for active avatar ring |
| 16 | `video-text` | Video thumbnail + text quote split | `primaryColor` for play icon accent |

### 7.4 Pricing Block (6 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 17 | `horizontal` | Full-width plan rows | `primaryColor` for highlighted plan border |
| 18 | `toggle` | Monthly/yearly toggle switch | `primaryColor` for toggle track |
| 19 | `tiered` | Stacked tiers, increasing prominence | `primaryColor` gradient on top tier |
| 20 | `comparison` | Feature comparison table | `primaryColor` for highlighted column header |
| 21 | `minimal` | Spacious, accordion features | `primaryColor` for CTA buttons |
| 22 | `slider` | Single plan carousel navigation | `primaryColor` for nav arrows + dots |

### 7.5 Gallery Block (3 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 23 | `lightbox` | Fullscreen overlay on click | `primaryColor` for close button accent |
| 24 | `filmstrip` | Large main image + thumbnail strip | `primaryColor` for active thumbnail border |
| 25 | `justified` | Flickr-style justified row layout | `primaryColor` for hover overlay tint |

### 7.6 Footer Block (3 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 26 | `centered-stack` | All elements centered vertically | `primaryColor` for social icon hover |
| 27 | `mega-footer` | Top CTA band + multi-column links | `primaryColor` for CTA band background |
| 28 | `dark-gradient` | Gradient background footer | `primaryColor` for gradient accent tint |

### 7.7 Contact Block (3 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 29 | `card-float` | Floating card with shadow on gradient | `primaryColor` for submit button + card border |
| 30 | `map-split` | Map placeholder + form side by side | `primaryColor` for map pin marker |
| | | > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant. | |
| 31 | `minimal-inline` | Single-row inline form fields | `primaryColor` for input focus border |

### 7.8 Navigation Block (3 new)

| # | Variant | Key Visual Element | Theme Token Usage |
|---|---|---|---|
| 32 | `transparent` | Transparent → solid on scroll | `primaryColor` for CTA button |
| 33 | `sidebar` | Full-height drawer navigation | `primaryColor` for active link indicator |
| 34 | `pill` | Floating pill-shaped container | `primaryColor` for CTA button inside pill |

---

## 8. Config Schema Changes

### 8.1 Hero Config Updates

```typescript
// config.ts — updated type
export type HeroConfig = {
    blockType: 'hero'
    variant?: 'centered' | 'split-left' | 'split-right' | 'fullscreen' | 'video'
        | 'magazine' | 'minimal' | 'cards-overlay' | 'gradient' | 'parallax' | 'slideshow' | 'split-video'
    headline: string
    subheadline?: string
    ctaButtons?: CTAButton[]
    image?: ImageRef
    badge?: { show: boolean; text: string }
    overlay?: boolean
    overlayOpacity?: number
    height?: string
    // New optional fields
    videoUrl?: string          // for split-video
    gradientPreset?: 'aurora' | 'sunset' | 'ocean' | 'forest'  // for gradient
    images?: ImageRef[]        // for slideshow
}

// Schema — updated z.enum
variant: z.enum([
    'centered', 'split-left', 'split-right', 'fullscreen', 'video',
    'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax', 'slideshow', 'split-video',
]).default('centered'),

// Meta — updated variants array
variants: [
    'centered', 'split-left', 'split-right', 'fullscreen', 'video',
    'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax', 'slideshow', 'split-video',
],
```

### 8.2 Features Config Updates

```typescript
variant: z.enum([
    'grid-2', 'grid-3', 'grid-4', 'list',
    'icon-top', 'icon-left', 'zigzag', 'carousel',
]).default('grid-3'),

variants: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel'],
```

### 8.3 Testimonials Config Updates

```typescript
variant: z.enum([
    'cards', 'carousel', 'simple',
    'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text',
]).default('cards'),

variants: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text'],
```

### 8.4 Pricing Config Updates

```typescript
// New optional fields
yearlyDiscount?: number  // for toggle variant, e.g., 0.2 = 20% off

variant: z.enum([
    'cards', 'table',
    'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider',
]).default('cards'),

variants: ['cards', 'table', 'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider'],
```

### 8.5 Gallery Config Updates

```typescript
variant: z.enum([
    'grid', 'masonry', 'carousel',
    'lightbox', 'filmstrip', 'justified',
]).default('grid'),

variants: ['grid', 'masonry', 'carousel', 'lightbox', 'filmstrip', 'justified'],
```

### 8.6 Footer Config Updates

```typescript
variant: z.enum([
    'simple', 'expanded', 'minimal',
    'centered-stack', 'mega-footer', 'dark-gradient',
]).default('simple'),

variants: ['simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient'],
```

### 8.7 Contact Config Updates

```typescript
variant: z.enum([
    'form', 'info-only', 'split',
    'card-float', 'map-split', 'minimal-inline',
]).default('form'),

variants: ['form', 'info-only', 'split', 'card-float', 'map-split', 'minimal-inline'],
```

> ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant.

### 8.8 Navigation Config Updates

```typescript
variant: z.enum([
    'simple', 'centered', 'mega-menu',
    'transparent', 'sidebar', 'pill',
]).default('simple'),

variants: ['simple', 'centered', 'mega-menu', 'transparent', 'sidebar', 'pill'],
```

---

## 9. Implementation Phases

### Phase 2.1: Hero Block Expansion (2 days)

**Day 1:**
- Update `hero/config.ts` with new variant names, new optional fields (`videoUrl`, `gradientPreset`, `images[]`)
- Implement `magazine`, `minimal`, `cards-overlay`, `gradient` variants in `hero/index.tsx`

**Day 2:**
- Implement `parallax`, `slideshow`, `split-video` variants
- Test all 12 hero variants across 3 viewports (390px, 768px, 1440px)
- Verify theme token usage for all new variants

### Phase 2.2: Features + Testimonials + Pricing (2 days)

**Day 3:**
- Update `features/config.ts`, implement 4 new variants in `features/index.tsx`
- Update `testimonials/config.ts`, implement 5 new variants in `testimonials/index.tsx`

**Day 4:**
- Update `pricing/config.ts` (add `yearlyDiscount` field), implement 6 new variants in `pricing/index.tsx`
- Test all new variants for Features, Testimonials, Pricing

### Phase 2.3: Gallery + Footer + Contact + Nav (1 day)

**Day 5:**
- Update configs and implement 3 new variants each for Gallery, Footer, Contact, Navigation
- Full cross-browser testing for all 34 new variants
- Update AI Builder prompt context with new variant catalog

---

## 10. Risks & Mitigations

### Risk 1: Bundle Size Bloat

**Severity:** High
**Description:** Adding 34 variant render paths across 8 block components could significantly increase the JavaScript bundle, especially with animation code for gradient, parallax, and slideshow variants.
**Mitigation:**
- All variants stay in their block's `index.tsx` (tree-shaking at block level, not variant level)
- Heavy features (lightbox overlay, video player controls) use `React.lazy` / `next/dynamic`
- CI quality metrics gate: fail build if any single block's gzipped size exceeds 15KB
- Audit after Day 2 and Day 4 to catch size regressions early

### Risk 2: Mobile Responsiveness Gaps

**Severity:** High
**Description:** Complex desktop layouts (magazine asymmetric grid, comparison table, sidebar nav) may break or look awkward on 390px screens.
**Mitigation:**
- Every variant must be designed mobile-first; desktop layout is the progressive enhancement
- Mandatory visual regression test at 390px for every PR
- Parallax degrades gracefully to static on touch devices
- Comparison table uses horizontal scroll with sticky first column on mobile

### Risk 3: Animation Performance on Low-End Devices

**Severity:** Medium
**Description:** CSS gradient animation, parallax scrolling, and slideshow transitions could cause jank on low-end Android devices.
**Mitigation:**
- All animations use CSS-only (GPU composited) — no JS animation loops
- Respect `prefers-reduced-motion: reduce` — disable all animations when set
- Slideshow uses CSS `opacity` transitions (composited) rather than `transform` slide
- Test on Chrome DevTools "Low-end mobile" throttling profile

### Risk 4: Backward Compatibility for Existing Sites

**Severity:** Medium
**Description:** Existing sites using current variants must not be affected. Schema changes must be additive only.
**Mitigation:**
- All new variant names are **appended** to `z.enum()` — existing values untouched
- New config fields (`videoUrl`, `gradientPreset`, `images[]`, `yearlyDiscount`) are all **optional** with no defaults that change behavior
- Default variants remain unchanged (`centered`, `grid-3`, `cards`, etc.)
- Integration test: existing site fixtures must render identically before and after changes

### Risk 5: AI Builder Variant Selection Quality

**Severity:** Medium
**Description:** With 60 variants available, AI might select inappropriate variants (e.g., `split-video` without a video URL, `slideshow` with only 1 image).
**Mitigation:**
- AI prompt includes variant prerequisites (e.g., "split-video requires videoUrl")
- Schema validation catches missing required data — block falls back to `defaultVariant` if validation fails
- AI prompt includes industry-variant mapping recommendations

---

## 11. Testing Strategy

### Unit Tests

- Each new variant render path must have at least 1 snapshot test
- Theme token tests: render each variant with 2 different `primaryColor` values, assert no hardcoded colors in output
- Schema validation tests: each new variant name accepted by Zod schema

### Visual Regression Tests

- Storybook stories for each of the 34 new variants at 3 viewports (390px, 768px, 1440px)
- Screenshot comparison using Playwright — baseline established on merge

### Accessibility Tests

- axe-core scan on each new variant
- Keyboard navigation test for interactive variants (carousel, lightbox, toggle, spotlight, sidebar)
- `prefers-reduced-motion` test for animated variants

### Integration Tests

- AI Builder generates a site → all variant names in output are valid
- Editor variant swap → content preserved → undo restores previous variant
- Existing site fixtures → render identically (backward compatibility)

---

## 12. Out of Scope

- Variant thumbnail auto-generation (placeholder images acceptable for Sprint 2)
- Per-variant analytics (tracking which variants are most popular)
- User-created custom variants
- Drag-and-drop variant reordering within a block
- A/B testing between variants
- Ecommerce-specific block variants (products-grid, cart — separate sprint)

---

## 13. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Total variant count | 60 | Count of unique variants across 8 blocks |
| Bundle size increase | < 40KB gzipped total | Webpack bundle analyzer |
| Mobile compatibility | 100% variants pass at 390px | Playwright visual tests |
| Accessibility | 0 axe-core violations | Automated scan |
| AI uniqueness | >= 80% visually different consecutive generations | Manual QA |
| Backward compatibility | 0 regressions on existing sites | Integration test suite |

---

## 14. Appendix: Files to Modify

| File | Changes |
|---|---|
| `src/blocks/hero/config.ts` | Add 7 variants to type, schema, meta; add `videoUrl`, `gradientPreset`, `images[]` fields |
| `src/blocks/hero/index.tsx` | Add 7 new variant render branches |
| `src/blocks/features/config.ts` | Add 4 variants to type, schema, meta |
| `src/blocks/features/index.tsx` | Add 4 new variant render branches |
| `src/blocks/testimonials/config.ts` | Add 5 variants to type, schema, meta |
| `src/blocks/testimonials/index.tsx` | Add 5 new variant render branches |
| `src/blocks/pricing/config.ts` | Add 6 variants to type, schema, meta; add `yearlyDiscount` field |
| `src/blocks/pricing/index.tsx` | Add 6 new variant render branches |
| `src/blocks/gallery/config.ts` | Add 3 variants to type, schema, meta |
| `src/blocks/gallery/index.tsx` | Add 3 new variant render branches |
| `src/blocks/footer/config.ts` | Add 3 variants to type, schema, meta |
| `src/blocks/footer/index.tsx` | Add 3 new variant render branches |
| `src/blocks/contact/config.ts` | Add 3 variants to type, schema, meta |
| `src/blocks/contact/index.tsx` | Add 3 new variant render branches |
| `src/blocks/navigation/config.ts` | Add 3 variants to type, schema, meta |
| `src/blocks/navigation/index.tsx` | Add 3 new variant render branches |
| `src/blocks/registry.ts` | No changes needed (reads meta dynamically) |
| AI Builder prompt file | Update variant catalog in prompt context |
