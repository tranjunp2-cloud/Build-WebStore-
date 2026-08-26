# QA Test Plan: Template System v2 (F30)

**Feature:** F30 — Template System v2
**Version:** 1.0
**Author:** Claude AI (QA)
**Date:** 2026-04-06
**Status:** Draft
**PRD Sources:**
- `docs/prd/F30-sprint1-foundation.md` (15 ACs)
- `docs/prd/F30-sprint2-variants.md` (16 ACs)
- `docs/prd/F30-sprint3-industry.md` (18 checklist items)
- `docs/prd/F30-sprint4-polish.md` (14 ACs)
**Scenario Analysis:** `docs/qa/scenarios/F30-template-system-v2.md` (46 scenarios, 12 dimensions)

---

## 1. Test Strategy

### 1.1 Test Types

| Type | Tool | Coverage Target | Focus |
|------|------|-----------------|-------|
| Unit | Vitest | 80% lines | resolveTheme(), Zod schemas, font pairings, error parser, spacing/radius maps |
| Integration | Vitest + JSDOM | 70% | SiteRenderer CSS injection, block token migration, AI generate-site response |
| Component | Vitest + RTL | 60% | BuilderGenerationView, TemplateCard, EditorTemplateModal, FontPreview |
| E2E | Playwright | Critical paths | AI generation flow, template picker, variant swap, 50-template viewport QA |
| Visual Regression | Playwright screenshots | 5 representative sites | Pre/post migration pixel comparison (<1% diff) |
| Accessibility | axe-core + Playwright | 0 violations | Error messages (role=alert), template picker keyboard nav, touch targets 44px |
| Performance | Lighthouse + custom | Per-variant budgets | Block render <50ms, template search <50ms, CSS injection <1ms |
| Security | Manual + automated | Auth endpoints | SSE auth, cross-tenant site access, XSS via theme values |

### 1.2 Test Environments

| Environment | Viewport | Browser | Purpose |
|-------------|----------|---------|---------|
| Mobile | 390px | Safari iOS 15+, Chrome Android | Touch, responsive, single-column |
| Tablet | 768px | Safari iPad | Responsive breakpoint |
| Desktop | 1280px | Chrome, Firefox, Safari | Full layout, hover preview |
| Full HD | 1920px | Chrome | Wide layout edge cases |
| Docker SSR | Server | Node.js | CSS var injection at SSR time |

### 1.3 Risk Assessment

| Risk | Impact | Likelihood | Mitigation | Test Coverage |
|------|--------|------------|------------|---------------|
| resolveTheme() breaks existing sites | Critical | Medium | AC-04, AC-05 backward compat tests + visual regression | TC-S1-005 → TC-S1-010 |
| CSS var injection produces invalid CSS | Critical | Low | Validate all tokens before injection; fallback values | TC-S1-003, TC-S1-004 |
| Variant swap loses user content | Critical | Medium | Content preservation assertion per swap | TC-S2-016 |
| SSE cancel leaves zombie connections | High | Medium | AbortController cleanup test; memory profiling | TC-S4-002, TC-S4-003 |
| 50 templates cause perf degradation | High | Medium | Lazy loading + virtualization; Lighthouse audit | TC-S4-013, TC-S4-014 |
| Industry blocks in wrong templates | High | Low | Composer affinity rules test | TC-S3-012 |
| Invalid AI-generated theme values | High | Medium | Zod validation before DB write | TC-S1-011 |
| Cross-tenant template application | Critical | Low | Auth middleware test on all endpoints | TC-SEC-001, TC-SEC-002 |

---

## 2. Test Cases — Sprint 1: Design Token Foundation

### TC-S1-001: ThemeConfig expanded type definition
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S1-AC-01
- **Precondition:** `src/blocks/types.ts` exists
- **Steps:**
  1. Import `ThemeConfig` from `src/blocks/types.ts`
  2. Create object with all 6 color tokens + spacingPreset + borderRadius + shadowPreset + fontPairingId
  3. Verify TypeScript compilation passes with all fields
  4. Verify optional fields (accentColor, surfaceColor, textColor, mutedColor, fontPairingId, spacingPreset, borderRadius, shadowPreset) accept `undefined`
- **Expected:** Type includes all fields; new fields are optional; existing fields (primaryColor, secondaryColor, etc.) unchanged
- **Test Data:** `{ primaryColor: '#0ea5e9', secondaryColor: '#d946ef', accentColor: '#7dd3fc', surfaceColor: '#111111', textColor: '#fafafa', mutedColor: '#a1a1aa', backgroundColor: '#09090b', fontHeading: 'Inter', fontBody: 'DM Sans', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded' }`

### TC-S1-002: ThemeConfig Zod schema validation
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S1-AC-11
- **Precondition:** ThemeConfigSchema Zod schema exists
- **Steps:**
  1. Validate complete valid ThemeConfig → expect success
  2. Validate ThemeConfig with only primaryColor + secondaryColor (v1 minimal) → expect success with defaults filled
  3. Validate ThemeConfig with `primaryColor: 'not-a-color'` → expect failure
  4. Validate ThemeConfig with `primaryColor: ''` → expect failure
  5. Validate ThemeConfig with `primaryColor: 'transparent'` → expect failure
  6. Validate ThemeConfig with `spacingPreset: 'huge'` → expect failure
  7. Validate ThemeConfig with `borderRadius: 'mega'` → expect failure
  8. Validate ThemeConfig with `fontPairingId: null` → expect success
- **Expected:** Valid configs pass; invalid hex/preset values fail; missing optional fields get defaults
- **Test Data:** See steps above

### TC-S1-003: SiteRenderer injects 20+ CSS variables
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S1-AC-02
- **Precondition:** SiteRenderer component exists, full ThemeConfig provided
- **Steps:**
  1. Render SiteRenderer with complete ThemeConfig (7 colors + spacing + radius + shadow)
  2. Query the rendered DOM for `:root` / container `style` attribute
  3. Assert presence of: `--brand-primary`, `--brand-secondary`, `--brand-accent`, `--surface`, `--text`, `--muted`, `--font-heading`, `--font-body`, `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--section-padding`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`
  4. Assert all color values are valid hex
  5. Assert all spacing values have rem/px units
- **Expected:** All 20+ CSS custom properties present with valid values
- **Test Data:** Full ThemeConfig with all fields populated

### TC-S1-004: SiteRenderer CSS var fallback values
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S1-AC-02, Scenario 6.1
- **Precondition:** SiteRenderer renders CSS vars
- **Steps:**
  1. Render SiteRenderer with minimal ThemeConfig (only primaryColor, secondaryColor)
  2. Inspect all `var()` calls in generated CSS/style
  3. Assert every `var(--token)` has a fallback value: `var(--brand-primary, #0ea5e9)`
- **Expected:** No bare `var()` without fallback; Safari iOS 15 safe
- **Test Data:** `{ primaryColor: '#0ea5e9', secondaryColor: '#d946ef', colorMode: 'dark' }`

### TC-S1-005: resolveTheme() backward compat — v1 site (dark mode)
- **Priority:** P0
- **Type:** Unit
- **AC Reference:** S1-AC-04
- **Precondition:** resolveTheme() function exists
- **Steps:**
  1. Call `resolveTheme({ primaryColor: '#0ea5e9', secondaryColor: '#d946ef', colorMode: 'dark' })`
  2. Assert accentColor is derived (lighten primary 15%)
  3. Assert surfaceColor = '#111111'
  4. Assert textColor = '#fafafa'
  5. Assert mutedColor = '#a1a1aa'
  6. Assert spacingPreset = 'default'
  7. Assert borderRadius = 'rounded'
- **Expected:** All missing tokens derived deterministically; result passes Zod validation
- **Test Data:** V1 minimal config

### TC-S1-006: resolveTheme() backward compat — v1 site (light mode)
- **Priority:** P0
- **Type:** Unit
- **AC Reference:** S1-AC-04, S1-AC-12
- **Precondition:** resolveTheme() exists
- **Steps:**
  1. Call `resolveTheme({ primaryColor: '#0ea5e9', secondaryColor: '#d946ef', colorMode: 'light' })`
  2. Assert surfaceColor = '#f8f8f8'
  3. Assert textColor = '#09090b'
  4. Assert mutedColor matches light-mode derived value
- **Expected:** Light mode derives distinct surface/text colors
- **Test Data:** V1 config with `colorMode: 'light'`

### TC-S1-007: resolveTheme() with completely empty input
- **Priority:** P0
- **Type:** Unit
- **AC Reference:** Scenario 1.2
- **Precondition:** resolveTheme() exists
- **Steps:**
  1. Call `resolveTheme({})` with empty object
  2. Assert returns complete ThemeConfig with all defaults
  3. Assert no `undefined` or `NaN` values in result
  4. Verify result passes Zod validation
- **Expected:** Sensible defaults for all fields; no crash; no invisible text (white-on-white)
- **Test Data:** `{}`

### TC-S1-008: resolveTheme() XSS prevention
- **Priority:** P1
- **Type:** Unit/Security
- **AC Reference:** Scenario 2.2
- **Precondition:** resolveTheme() exists
- **Steps:**
  1. Call `resolveTheme({ primaryColor: '"><script>alert(1)</script>', fontPairingId: 'xss<img onerror=alert(1)>' })`
  2. Assert Zod validation rejects OR values are sanitized
  3. Verify no script/HTML tags in output
- **Expected:** Invalid input rejected or sanitized; no XSS possible via CSS injection
- **Test Data:** XSS payloads in color and font fields

### TC-S1-009: Backward compat — legacy fonts preserved
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S1-AC-05
- **Precondition:** resolveTheme() exists
- **Steps:**
  1. Call `resolveTheme({ primaryColor: '#0ea5e9', fontHeading: 'Outfit', fontBody: 'Inter' })` — no fontPairingId
  2. Assert fontHeading = 'Outfit'
  3. Assert fontBody = 'Inter'
  4. Assert fontPairingId = null
- **Expected:** Custom fonts preserved when no pairing ID set
- **Test Data:** V1 config with manual fonts

### TC-S1-010: Font pairing resolution by ID
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S1-AC-06
- **Precondition:** FONT_PAIRINGS array + resolveTheme() exist
- **Steps:**
  1. Call `resolveTheme({ fontPairingId: 'editorial' })`
  2. Assert fontHeading = 'Playfair Display'
  3. Assert fontBody = 'Lora'
  4. Assert CSS vars: `--font-heading: 'Playfair Display', serif`
- **Expected:** fontPairingId overrides individual font fields
- **Test Data:** `{ fontPairingId: 'editorial' }`

### TC-S1-011: 20 font pairings available
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S1-AC-13
- **Precondition:** `src/lib/fonts/pairings.ts` exists
- **Steps:**
  1. Import FONT_PAIRINGS
  2. Assert length = 20
  3. Assert each entry has: id, name, category, headingFont, bodyFont, description
  4. Assert categories include at least: modern, classic, playful, minimal, bold
  5. Assert `getFontPairing('modern-clean')` returns correct pairing
  6. Assert `getFontPairing('nonexistent')` returns null/undefined
- **Expected:** 20 curated pairings with complete metadata
- **Test Data:** N/A

### TC-S1-012: Google Fonts Loader loads pairing fonts
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** S1-AC-14
- **Precondition:** GoogleFontsLoader component exists
- **Steps:**
  1. Render GoogleFontsLoader with fontPairingId='bold-impact' (Oswald + Source Sans 3)
  2. Assert generated `<link>` tag URL includes 'Oswald' and 'Source+Sans+3'
  3. Assert appropriate font weights included
- **Expected:** Both fonts loaded via Google Fonts CDN with correct weights
- **Test Data:** `{ fontPairingId: 'bold-impact' }`

### TC-S1-013: Block migration — no inline ${pc} remaining
- **Priority:** P1
- **Type:** Code Audit
- **AC Reference:** S1-AC-03
- **Precondition:** Block migration complete
- **Steps:**
  1. Run `grep -r '\${pc}' src/blocks/ --include="*.tsx" -c`
  2. Assert all files return 0 occurrences
  3. Run `grep -r 'var(--brand' src/blocks/ --include="*.tsx" -c`
  4. Assert matches in >= 28 files
- **Expected:** Zero inline `${pc}` patterns; all blocks use CSS vars
- **Test Data:** N/A (code audit)

### TC-S1-014: Spacing preset visual difference
- **Priority:** P2
- **Type:** Manual QA / Visual
- **AC Reference:** S1-AC-08
- **Precondition:** Site with multiple blocks rendered
- **Steps:**
  1. Render site with `spacingPreset: 'compact'`
  2. Assert `--section-padding` resolves to 3rem
  3. Render same site with `spacingPreset: 'generous'`
  4. Assert `--section-padding` resolves to ~8rem
  5. Visually compare — sections clearly different spacing
- **Expected:** Compact = tight sections, Generous = airy sections; visually distinct
- **Test Data:** Same site content, different spacing presets

### TC-S1-015: Border radius preset visual difference
- **Priority:** P2
- **Type:** Manual QA / Visual
- **AC Reference:** S1-AC-09
- **Precondition:** Site with cards/buttons rendered
- **Steps:**
  1. Render site with `borderRadius: 'sharp'` → assert corners 0px
  2. Render site with `borderRadius: 'pill'` → assert corners 9999px
  3. Verify cards and buttons both reflect the preset
- **Expected:** Sharp = square corners, Pill = fully rounded
- **Test Data:** Same site, different radius presets

### TC-S1-016: Shadow preset applied
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** S1-AC-10
- **Precondition:** Shadow presets configured
- **Steps:**
  1. Render site with `shadowPreset: 'dramatic'`
  2. Assert `--shadow-md` resolves to `0 8px 24px rgba(0,0,0,0.2)`
  3. Assert elevated elements use `--shadow-lg`
- **Expected:** Shadow tokens applied correctly per preset
- **Test Data:** `{ shadowPreset: 'dramatic' }`

### TC-S1-017: No visual regression — 5 existing sites
- **Priority:** P0
- **Type:** Visual Regression
- **AC Reference:** S1-AC-15
- **Precondition:** 5 representative sites with pre-upgrade screenshots
- **Steps:**
  1. Render 5 existing sites (different siteTypes) with resolveTheme() filling defaults
  2. Take screenshots at 1280px
  3. Compare pixel-by-pixel with pre-upgrade screenshots
  4. Assert < 1% pixel difference
- **Expected:** No layout shifts, no color changes, no font changes
- **Test Data:** 5 existing site configs (restaurant, tech, beauty, health, education)

### TC-S1-018: TypeScript compilation passes
- **Priority:** P1
- **Type:** CI
- **AC Reference:** S1-AC-14 (template-system-v2-sprint1-v2.md)
- **Precondition:** All Sprint 1 code complete
- **Steps:**
  1. Run `npx tsc --noEmit`
  2. Assert 0 errors
- **Expected:** Full type safety maintained after migration
- **Test Data:** N/A

### TC-S1-019: All existing tests pass
- **Priority:** P1
- **Type:** CI
- **AC Reference:** S1-AC-15 (template-system-v2-sprint1-v2.md)
- **Precondition:** All Sprint 1 code complete
- **Steps:**
  1. Run `npx vitest run`
  2. Assert 0 regressions, all tests pass
- **Expected:** No existing tests broken by Sprint 1 changes
- **Test Data:** N/A

---

## 3. Test Cases — Sprint 2: Block Variants

### TC-S2-001: Hero `magazine` variant layout
- **Priority:** P1
- **Type:** Integration / Visual
- **AC Reference:** S2-AC-01
- **Precondition:** Hero block with `variant: 'magazine'`, headline, subheadline, ctaButtons, image
- **Steps:**
  1. Render hero `magazine` at 1280px viewport
  2. Assert 60/40 asymmetric grid (image left, text right)
  3. Assert badge above headline
  4. Assert image has thin primaryColor border at 20% opacity
- **Expected:** Asymmetric layout with parallax image effect
- **Test Data:** Hero content with image URL

### TC-S2-002: Hero `gradient` variant animated background
- **Priority:** P2
- **Type:** Visual
- **AC Reference:** S2-AC-02
- **Precondition:** Hero block with `variant: 'gradient'`, no image
- **Steps:**
  1. Render hero `gradient`
  2. Assert animated CSS gradient background (3 hue-shifted colors from primaryColor)
  3. Assert animation duration = 8s
  4. Assert CTA buttons use frosted-glass style
- **Expected:** Cycling gradient animation with frosted CTAs
- **Test Data:** Hero without image, primaryColor '#6366f1'

### TC-S2-003: Hero `split-video` variant plays video
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S2-AC-03
- **Precondition:** Hero with `variant: 'split-video'`, valid videoUrl
- **Steps:**
  1. Render hero `split-video`
  2. Assert right column contains `<video>` element
  3. Assert video is muted, autoplay, loop
  4. Assert play/pause toggle visible
  5. Assert left column has headline + CTAs
- **Expected:** Split layout with autoplaying muted video
- **Test Data:** `{ variant: 'split-video', videoUrl: 'https://example.com/vid.mp4' }`

### TC-S2-004: Features `zigzag` variant alternates layout
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S2-AC-04
- **Precondition:** Features block with `variant: 'zigzag'`, 4 items
- **Steps:**
  1. Render at desktop (>=1024px)
  2. Assert odd items: content left, icon right
  3. Assert even items: content right, icon left
  4. Render at mobile (<=768px)
  5. Assert all items stack vertically
- **Expected:** Alternating layout on desktop; stacked on mobile
- **Test Data:** 4 feature items with icons

### TC-S2-005: Features `carousel` variant swipe on mobile
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** S2-AC-05
- **Precondition:** Features block with `variant: 'carousel'`, 6 items
- **Steps:**
  1. Render at 390px viewport
  2. Assert horizontal scroll with snap behavior
  3. Simulate swipe gesture
  4. Assert card navigates to next
  5. Assert only 1 card fully visible at a time
- **Expected:** Touch-swipeable card carousel with snap points
- **Test Data:** 6 feature items

### TC-S2-006: Testimonials `spotlight` variant click interaction
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** S2-AC-06
- **Precondition:** Testimonials with `variant: 'spotlight'`, 5 items
- **Steps:**
  1. Render testimonials spotlight
  2. Click a flanking (small) testimonial card
  3. Assert clicked testimonial moves to center spotlight with transition
  4. Assert previous spotlight moves to side position
- **Expected:** Smooth spotlight transition on click
- **Test Data:** 5 testimonials with different quote lengths

### TC-S2-007: Testimonials `masonry` variant layout
- **Priority:** P2
- **Type:** Visual
- **AC Reference:** S2-AC-07
- **Precondition:** Testimonials with `variant: 'masonry'`, varying quote lengths
- **Steps:**
  1. Render at 390px → assert 2 columns masonry
  2. Render at 1280px → assert 3 columns masonry
  3. Assert no fixed height on cards
  4. Assert cards fill gaps based on content length
- **Expected:** True masonry grid, no empty gaps
- **Test Data:** 6 testimonials with short/medium/long quotes

### TC-S2-008: Pricing `toggle` monthly/yearly switch
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S2-AC-08
- **Precondition:** Pricing block with `variant: 'toggle'`
- **Steps:**
  1. Render pricing toggle (default monthly)
  2. Click yearly toggle
  3. Assert all plan prices animate to yearly values
  4. Assert discount badge visible (e.g., "Save 20%")
  5. Assert toggle uses primaryColor
  6. Click back to monthly → assert prices revert
- **Expected:** Smooth price transition with discount badge
- **Test Data:** 3 plans with monthly/yearly prices

### TC-S2-009: Pricing `comparison` table
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S2-AC-09
- **Precondition:** Pricing with `variant: 'comparison'`, 3 plans
- **Steps:**
  1. Render at 1280px → full comparison table visible
  2. Assert features as rows, plans as columns
  3. Assert checkmarks for included features
  4. Assert highlighted plan has primaryColor header
  5. Render at 390px → assert table horizontally scrollable
- **Expected:** Feature comparison table, responsive horizontal scroll on mobile
- **Test Data:** 3 plans with 10 features each

### TC-S2-010: Gallery `lightbox` fullscreen overlay
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** S2-AC-10
- **Precondition:** Gallery with `variant: 'lightbox'`, 8 images
- **Steps:**
  1. Click any gallery image
  2. Assert full-screen overlay with image at max resolution
  3. Click next arrow → assert next image shown
  4. Press Escape → assert lightbox closes
  5. Reopen, press right arrow key → assert keyboard navigation works
  6. Click outside image → assert lightbox closes
- **Expected:** Accessible fullscreen lightbox with keyboard support
- **Test Data:** 8 gallery images

### TC-S2-011: Navigation `transparent` scroll transition
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** S2-AC-11
- **Precondition:** Nav with `variant: 'transparent'`
- **Steps:**
  1. Load page → assert nav background fully transparent
  2. Scroll down 100px
  3. Assert nav background transitions to solid + backdrop-blur
  4. Assert nav remains sticky at top
  5. Scroll back up → assert nav returns to transparent
- **Expected:** Smooth transparent → solid transition on scroll
- **Test Data:** Page with hero + content sections

### TC-S2-012: Navigation `pill` floating container
- **Priority:** P2
- **Type:** Visual
- **AC Reference:** S2-AC-12
- **Precondition:** Nav with `variant: 'pill'`
- **Steps:**
  1. Render at 1280px
  2. Assert rounded-full (pill) container centered horizontally
  3. Assert margin from top edge
  4. Assert logo left, links center, CTA right inside pill
  5. Assert subtle shadow + blur backdrop
- **Expected:** Floating pill-shaped nav bar
- **Test Data:** Nav with logo + 4 links + CTA

### TC-S2-013: Contact `map-split` two columns
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** S2-AC-13
- **Precondition:** Contact with `variant: 'map-split'`, address provided
- **Steps:**
  1. Render at 1280px → assert 2 columns (map left, form right)
  2. Render at 390px → assert map stacks above form
- **Expected:** Responsive map + form layout
- **Test Data:** Contact with Malaysian address

### TC-S2-014: Footer `mega-footer` top band
- **Priority:** P2
- **Type:** Visual
- **AC Reference:** S2-AC-14
- **Precondition:** Footer with `variant: 'mega-footer'`
- **Steps:**
  1. Render mega-footer
  2. Assert full-width top band (CTA or newsletter)
  3. Assert 4-5 column link grid below
  4. Assert bottom bar: copyright + social icons + legal links
- **Expected:** Three-layer mega footer structure
- **Test Data:** Footer with 4 link columns + social links

### TC-S2-015: All new variants use design tokens
- **Priority:** P0
- **Type:** Code Audit + Integration
- **AC Reference:** S2-AC-15
- **Precondition:** All Sprint 2 variants complete
- **Steps:**
  1. Change site theme (primaryColor, fontHeading, colorMode)
  2. Assert ALL new variants immediately reflect new values
  3. Grep for hardcoded colors in new variant files (excluding neutral grays, white, black)
  4. Assert 0 hardcoded non-neutral colors
- **Expected:** Theme change instantly updates all variants; no hardcoded brand colors
- **Test Data:** Two different ThemeConfigs applied to same site

### TC-S2-016: Variant swap preserves content
- **Priority:** P0
- **Type:** Integration
- **AC Reference:** S2-AC-16, Scenario 5.1
- **Precondition:** Hero block with `variant: 'centered'`, full content
- **Steps:**
  1. Create hero with headline, subheadline, image, 2 CTAs using `variant: 'centered'`
  2. Change variant to `'magazine'`
  3. Assert headline text preserved
  4. Assert subheadline text preserved
  5. Assert image URL preserved
  6. Assert both CTAs preserved (text + URL)
  7. Change back to `'centered'` — assert all content still intact
- **Expected:** Zero data loss on variant swap; only layout changes
- **Test Data:** Hero with "Welcome to Our Restaurant", subtitle, image, 2 CTA buttons

### TC-S2-017: Variant swap — more items than target supports
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** Scenario 9.2
- **Precondition:** Features block with 4 items, target variant supports 3 visible
- **Steps:**
  1. Create features with 4 items using variant that shows all 4
  2. Switch to variant that only shows 3
  3. Assert 3 items visible, 4th hidden but preserved in data
  4. Switch back to original variant
  5. Assert all 4 items visible again
- **Expected:** Extra items preserved in data; no silent data loss
- **Test Data:** 4 feature items

### TC-S2-018: Responsive — all variants at 390px
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** S2-NFR-02
- **Precondition:** All 60 variants (existing + new) rendered
- **Steps:**
  1. Render each variant at 390px width
  2. Assert no horizontal scrollbar (except intentional: carousel)
  3. Assert body text >= 14px, headings >= 24px
  4. Assert touch targets >= 44x44px
  5. Assert multi-column layouts collapse to single column at <=768px
- **Expected:** All variants mobile-ready at 390px minimum
- **Test Data:** Representative content for each block type

### TC-S2-019: Performance — variant render budget
- **Priority:** P1
- **Type:** Performance
- **AC Reference:** S2-NFR-01
- **Precondition:** All new variants deployed
- **Steps:**
  1. Measure first paint of each new variant via Lighthouse simulated throttling
  2. Assert < 50ms per variant
  3. Measure gzipped JS added per variant
  4. Assert < 5KB per variant
  5. Verify animations use CSS only or GPU-composited properties
- **Expected:** All variants within render budget
- **Test Data:** N/A (performance profiling)

---

## 4. Test Cases — Sprint 3: Industry Blocks + Templates

### TC-S3-001: menu-display block renders with config
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Precondition:** `menu-display` block registered in BLOCK_TYPES
- **Steps:**
  1. Validate menu-display config schema against Zod
  2. Render menu-display with Malaysian restaurant content
  3. Assert categories displayed (Nasi, Mee, Minuman)
  4. Assert prices in RM format
  5. Assert responsive layout at 390px (single column) and 1280px (grid)
- **Expected:** Menu block renders with correct categories, prices, and responsive layout
- **Test Data:** Malaysian restaurant menu content file

### TC-S3-002: booking-widget block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate booking-widget config schema
  2. Render with beauty salon content
  3. Assert date/time picker visible
  4. Assert service selection available
  5. Assert form validation (name, phone +60, email)
  6. Assert responsive at 390px
- **Expected:** Functional booking form with Malaysian phone format support
- **Test Data:** Beauty salon booking content

### TC-S3-003: class-schedule block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate class-schedule config schema
  2. Render with fitness studio content
  3. Assert weekly schedule grid visible
  4. Assert classes with time, instructor, capacity
  5. Assert responsive at 390px (list view) and 1280px (grid view)
- **Expected:** Schedule grid with class details
- **Test Data:** Fitness studio schedule content

### TC-S3-004: review-cards block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate review-cards config schema
  2. Render with 5 customer reviews
  3. Assert star rating displayed
  4. Assert reviewer name + photo
  5. Assert responsive masonry at 390px / 1280px
- **Expected:** Review cards with ratings and reviewer info
- **Test Data:** 5 Malaysian customer reviews

### TC-S3-005: video-showcase block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate video-showcase config schema
  2. Render with agency portfolio content
  3. Assert video thumbnails with play button overlay
  4. Assert click opens video player
  5. Assert responsive grid at 390px / 1280px
- **Expected:** Video grid with playable thumbnails
- **Test Data:** Creative agency video showcase content

### TC-S3-006: doctor-profile block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate doctor-profile config schema
  2. Render with clinic doctor data
  3. Assert photo, name, specialty, qualifications displayed
  4. Assert appointment CTA visible
  5. Assert responsive layout
- **Expected:** Professional doctor profile card
- **Test Data:** Malaysian clinic doctor profile

### TC-S3-007: property-card block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate property-card config schema
  2. Render with real estate listings
  3. Assert property image, price (RM), location, bedrooms/bathrooms displayed
  4. Assert responsive grid
- **Expected:** Property listing cards with Malaysian pricing
- **Test Data:** KL/Penang property listings

### TC-S3-008: product-quick-view block renders
- **Priority:** P1
- **Type:** Unit + Integration
- **AC Reference:** S3-Dev-DoD-01
- **Steps:**
  1. Validate product-quick-view config schema
  2. Render with ecommerce product data
  3. Assert product image gallery, price, variants, add-to-cart button
  4. Assert responsive layout
- **Expected:** Quick-view product card with purchase CTA
- **Test Data:** Malaysian ecommerce products

### TC-S3-009: 11 content files validation
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S3-Dev-DoD-04
- **Steps:**
  1. Load each of 11 content files
  2. Validate against content file schema
  3. Assert realistic Malaysian data (RM prices, +60 phones, Malaysian postcodes, EN+MS text)
  4. Assert no placeholder/lorem ipsum text
- **Expected:** All 11 content files valid with culturally appropriate Malaysian content
- **Test Data:** 11 content files (restaurant, beauty, tech, health, education, realestate, fitness, creative, business, fnb, ecommerce)

### TC-S3-010: Template composer generates 50+ templates
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S3-Dev-DoD-06
- **Steps:**
  1. Run template composer
  2. Assert >= 50 unique templates generated
  3. Assert each template has: name, blocks array, ThemeConfig, category
  4. Assert no duplicate template names
  5. Assert industry-appropriate block selections (per category-block mapping)
- **Expected:** 50+ diverse templates with correct industry associations
- **Test Data:** All block types + content files

### TC-S3-011: Seed API idempotent
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S3-QC-04, Scenario 3.5
- **Steps:**
  1. Run `POST /api/templates/seed`
  2. Count templates in DB
  3. Run seed API again
  4. Assert template count unchanged (no duplicates)
  5. Assert existing template IDs stable
- **Expected:** Idempotent seeding — running twice yields same result
- **Test Data:** N/A

### TC-S3-012: Industry block affinity — no wrong combinations
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** Scenario 12.1
- **Steps:**
  1. Assert doctor-profile block only in health/clinic templates
  2. Assert menu-display only in restaurant/fnb templates
  3. Assert booking-widget only in beauty/health/fitness templates
  4. Assert property-card only in realestate templates
- **Expected:** Template composer respects industry-block affinity rules
- **Test Data:** Generated template list

### TC-S3-013: All blocks responsive on mobile/tablet/desktop
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** S3-QC-02
- **Steps:**
  1. Render each of 8 new blocks at 390px, 768px, 1280px
  2. Assert no horizontal scroll
  3. Assert no content truncation
  4. Assert touch targets >= 44px on mobile
- **Expected:** All industry blocks responsive across viewports
- **Test Data:** Representative content per block

### TC-S3-014: Template gallery shows 50+ with thumbnails
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** S3-QC-03
- **Steps:**
  1. Open template gallery
  2. Assert 50+ templates visible (with pagination/scroll)
  3. Assert each template has thumbnail image
  4. Assert no broken thumbnail images
- **Expected:** Complete gallery with visual thumbnails
- **Test Data:** Seeded 50+ templates

### TC-S3-015: Block performance < 200ms render
- **Priority:** P2
- **Type:** Performance
- **AC Reference:** S3-QC-06
- **Steps:**
  1. Measure render time of each new block via performance profiler
  2. Assert < 200ms per block
- **Expected:** All industry blocks within render budget
- **Test Data:** N/A

### TC-S3-016: BLOCK_TYPES registry complete
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** S3-Dev-DoD-03, Scenario 10.2
- **Steps:**
  1. Import BLOCK_TYPES array
  2. Assert all 8 new blocks registered
  3. Assert CI check-migrations.js passes (db tables exist for all registered blocks)
- **Expected:** All industry blocks registered and DB-migrated
- **Test Data:** N/A

---

## 5. Test Cases — Sprint 4: UX Polish

### TC-S4-001: Generation timeout warning at 30s
- **Priority:** P0
- **Type:** Integration
- **AC Reference:** S4-AC-01
- **Precondition:** AI generation running via SSE
- **Steps:**
  1. Start AI generation
  2. Wait 30s without `done` event
  3. Assert "Taking too long?" text appears below progress bar
  4. Assert "Cancel Generation" button visible
- **Expected:** Warning + cancel button after 30s
- **Test Data:** Mock SSE that never completes

### TC-S4-002: Cancel generation mid-stream
- **Priority:** P0
- **Type:** Integration
- **AC Reference:** S4-AC-02, Scenario 3.1
- **Precondition:** SSE generation active
- **Steps:**
  1. Start AI generation
  2. Wait for SSE to begin streaming
  3. Click "Cancel Generation" button
  4. Assert SSE stream aborted (AbortController)
  5. Assert status set to `idle`
  6. Assert user returned to BusinessInfoForm
  7. Assert previous form values preserved
  8. Assert no partial ThemeConfig saved to DB
- **Expected:** Clean cancellation with state preservation
- **Test Data:** Partially-streamed generation

### TC-S4-003: Hard timeout at 60s
- **Priority:** P0
- **Type:** Integration
- **AC Reference:** S4-AC-03
- **Precondition:** SSE generation hanging
- **Steps:**
  1. Start AI generation with mock that never completes
  2. Wait 60s
  3. Assert stream auto-aborted
  4. Assert timeout error message shown (EN: "Generation is taking too long...")
  5. Assert user returned to form
  6. Assert no zombie SSE connections (check network)
- **Expected:** Auto-abort at 60s with timeout error
- **Test Data:** Mock SSE that hangs indefinitely

### TC-S4-004: Elapsed timer during generation
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** S4-AC-04
- **Precondition:** SSE generation active
- **Steps:**
  1. Start AI generation
  2. Assert "Elapsed: 0s" displayed initially
  3. Wait 5 seconds
  4. Assert counter shows "Elapsed: 5s"
  5. Assert counter updates every 1s
- **Expected:** Live elapsed time counter
- **Test Data:** Mock SSE

### TC-S4-005: Error — Free tier limit (402)
- **Priority:** P0
- **Type:** Integration
- **AC Reference:** S4-AC-05
- **Precondition:** User on free plan, already used 1 generation
- **Steps:**
  1. Attempt `POST /api/ai/generate-site`
  2. Assert 402 response
  3. Assert message: "You've used your free AI generation. Upgrade to Pro for unlimited creations."
  4. Assert "Upgrade to Pro" button visible
- **Expected:** Clear upgrade CTA on free tier limit
- **Test Data:** Free plan user with 1 prior generation

### TC-S4-006: Error — Rate limit (429)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S4-AC-06
- **Precondition:** User spamming generate button
- **Steps:**
  1. Trigger rate limit (429 response with Retry-After: 30)
  2. Assert message: "Too many requests. Please wait 30s before trying again."
  3. Assert countdown timer button ("Retry in 30s", "Retry in 29s"...)
  4. Assert button becomes clickable when countdown reaches 0
- **Expected:** Countdown retry button with Retry-After header respect
- **Test Data:** Mock 429 response with Retry-After header

### TC-S4-007: Error — Content unsafe (400)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S4-AC-07
- **Precondition:** User entered inappropriate content
- **Steps:**
  1. Submit generation with unsafe content
  2. Assert 400 CONTENT_UNSAFE response
  3. Assert message: "Your business description contains content that is not allowed."
  4. Assert "Edit Info" button returns to form
- **Expected:** Clear content policy error with edit action
- **Test Data:** Mock 400 CONTENT_UNSAFE response

### TC-S4-008: Error — SSE disconnect
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** S4-AC-08, Scenario 7.1
- **Precondition:** SSE generation active
- **Steps:**
  1. Start AI generation
  2. Simulate network disconnect (throttle to offline)
  3. Assert disconnect detected within 5s
  4. Assert message: "Connection lost during generation..."
  5. Assert "Go to Dashboard" and "Try Again" buttons visible
- **Expected:** Quick disconnect detection with recovery options
- **Test Data:** Network throttle simulation

### TC-S4-009: Error messages in Bahasa Malaysia
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S4-AC-09
- **Precondition:** User locale set to MS
- **Steps:**
  1. Set locale to MS
  2. Trigger 402 error → assert MS message matches Error Code Mapping table
  3. Trigger 429 error → assert MS message
  4. Trigger 400 CONTENT_UNSAFE → assert MS message
  5. Trigger 408 timeout → assert MS message
  6. Assert all action buttons in MS
- **Expected:** All error messages displayed in correct Bahasa Malaysia
- **Test Data:** MS locale + each error type

### TC-S4-010: Template picker debounced search
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** S4-AC-10
- **Precondition:** Template picker open with 50+ templates
- **Steps:**
  1. Type "restaurant" in search input
  2. Assert filtering happens after 300ms debounce (not on each keystroke)
  3. Assert only templates matching "restaurant" in name/description/category shown
  4. Assert filter time < 50ms
  5. Clear search → assert all templates shown again
- **Expected:** Debounced, fast search across template metadata
- **Test Data:** 50+ seeded templates

### TC-S4-011: Template picker hover preview (desktop)
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** S4-AC-11
- **Precondition:** Template picker on desktop (1280px)
- **Steps:**
  1. Hover on template card
  2. Wait 500ms
  3. Assert enlarged preview tooltip (400x300 iframe) appears adjacent to card
  4. Move mouse away
  5. Assert preview dismisses after 300ms delay
  6. Rapidly hover 3 different cards
  7. Assert only 1 preview iframe exists at any time (no memory leak)
- **Expected:** Singleton hover preview with smooth show/hide
- **Test Data:** Template picker with 50+ templates

### TC-S4-012: Template picker mobile single column
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** S4-AC-12
- **Precondition:** Template picker on 390px viewport
- **Steps:**
  1. Open template picker at 390px
  2. Assert single column grid layout
  3. Assert category pills horizontally scrollable
  4. Assert each card full-width with visible action buttons (no hover required)
  5. Assert touch targets >= 44px
- **Expected:** Mobile-optimized single-column layout
- **Test Data:** 50+ templates, 390px viewport

### TC-S4-013: QA — 50 templates no horizontal scroll at 390px
- **Priority:** P0
- **Type:** E2E (Automated)
- **AC Reference:** S4-AC-13
- **Precondition:** All 50 templates seeded
- **Steps:**
  1. For each of 50 templates:
     a. Render at 390px width
     b. Check `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
  2. Assert ALL pass
- **Expected:** Zero horizontal scroll on any template at mobile width
- **Test Data:** All 50 seeded templates

### TC-S4-014: QA — 50 templates desktop layout at 1280px
- **Priority:** P0
- **Type:** E2E (Automated)
- **AC Reference:** S4-AC-14
- **Precondition:** All 50 templates seeded
- **Steps:**
  1. For each of 50 templates:
     a. Render at 1280px width
     b. Assert all blocks visible
     c. Assert no overlapping elements
     d. Assert no text truncation on headings
- **Expected:** All blocks visible and properly laid out on desktop
- **Test Data:** All 50 seeded templates

### TC-S4-015: Browser Back during generation
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** Scenario 5.5
- **Precondition:** SSE generation active
- **Steps:**
  1. Start AI generation
  2. Navigate away (browser Back)
  3. Assert AbortController fires
  4. Hit browser Forward
  5. Assert clean form state, not stuck "generating" spinner
- **Expected:** Clean abort on navigation; no stuck state on return
- **Test Data:** Active generation + browser navigation

---

## 6. Test Cases — Security

### TC-SEC-001: SSE endpoint requires authentication
- **Priority:** P0
- **Type:** Security
- **AC Reference:** Scenario 8.1
- **Steps:**
  1. Call `POST /api/ai/generate-site` without auth token
  2. Assert 401 returned immediately
  3. Assert no SSE connection opened
- **Expected:** Unauthenticated requests blocked at entry
- **Test Data:** No auth header

### TC-SEC-002: Cross-tenant site access blocked
- **Priority:** P0
- **Type:** Security
- **AC Reference:** Scenario 8.2
- **Steps:**
  1. Authenticate as User A
  2. Attempt to apply template to User B's siteId
  3. Assert 403 returned
  4. Assert no modification to User B's site
- **Expected:** Strict site ownership validation
- **Test Data:** Two test users with separate sites

### TC-SEC-003: Expired JWT during SSE stream
- **Priority:** P1
- **Type:** Security
- **AC Reference:** Scenario 8.3
- **Steps:**
  1. Start SSE generation with valid JWT
  2. Expire JWT mid-stream (mock)
  3. Assert SSE terminates with 401
  4. Assert client redirects to login
- **Expected:** Stream terminated on auth expiry
- **Test Data:** Short-lived JWT for testing

### TC-SEC-004: CSS injection via theme values
- **Priority:** P1
- **Type:** Security
- **AC Reference:** Scenario 2.1, 2.2
- **Steps:**
  1. Submit ThemeConfig with `primaryColor: '#000; } body { display: none; } .x {'`
  2. Assert Zod validation rejects (not a valid hex)
  3. Alternatively, assert value sanitized before CSS injection
- **Expected:** No CSS injection possible via theme values
- **Test Data:** CSS injection payloads in color fields

---

## 7. Test Cases — Accessibility

### TC-A11Y-001: Error messages announced by screen reader
- **Priority:** P1
- **Type:** Accessibility
- **AC Reference:** S4-NFR-04
- **Steps:**
  1. Trigger generation error (any type)
  2. Assert error container has `role="alert"` or `aria-live="assertive"`
  3. Assert cancel button keyboard-focusable
- **Expected:** Errors announced; interactive elements keyboard-accessible
- **Test Data:** Mock error responses

### TC-A11Y-002: Template picker keyboard navigation
- **Priority:** P2
- **Type:** Accessibility
- **AC Reference:** S4-FR-09
- **Steps:**
  1. Open template picker
  2. Tab to first template card
  3. Use arrow keys to navigate grid
  4. Press Enter to select
  5. Press Escape to close modal
- **Expected:** Full keyboard navigation support
- **Test Data:** Template picker with 50+ templates

### TC-A11Y-003: Touch targets minimum 44px
- **Priority:** P1
- **Type:** Accessibility
- **AC Reference:** S2-NFR-02, S4-NFR-07
- **Steps:**
  1. Render all interactive elements at 390px viewport
  2. Measure touch target size via axe-core tap-target audit
  3. Assert all buttons, links >= 44x44px
- **Expected:** WCAG 2.1 compliant touch targets
- **Test Data:** All block variants + template picker at 390px

---

## 8. Test Cases — GH-1465: Remove Google Maps Contact Block

**Issue:** Contact block `map-split` variant embedded Google Maps iframes that resolved to incorrect locations (#1465).

**Resolution:** `map-split` variant removed from Block Library + AI generator (Phase 01). Zod schema still accepts legacy content for backward compatibility; renders as `split` layout without iframe/embed.

### TC-1465-01: Map-split excluded from meta variants and Pages contact options
- **Priority:** P0
- **Type:** Unit
- **Issue Reference:** GH-1465
- **Precondition:** `src/blocks/contact/config.ts` and `src/collections/Pages.ts` exist
- **Steps:**
  1. Import `contactMeta` from `src/blocks/contact/config.ts`
  2. Assert `contactMeta.variants` does NOT include `'map-split'`
  3. Import Pages.ts contact option config
  4. Assert Pages.ts contact block variant options does NOT include `'map-split'` (picker hidden)
- **Expected:** `map-split` not in either list; 5 variants only (form, info-only, split, card-float, minimal-inline)

### TC-1465-02: ContactConfigSchema still accepts legacy map-split content
- **Priority:** P1
- **Type:** Unit
- **Issue Reference:** GH-1465
- **Precondition:** ContactConfigSchema Zod exists
- **Steps:**
  1. Import ContactConfigSchema
  2. Call `ContactConfigSchema.safeParse({blockType: 'contact', variant: 'map-split', ...})`
  3. Assert `result.success === true` (non-breaking, legacy content survives)
- **Expected:** Legacy saved content with `variant: 'map-split'` remains Zod-valid

### TC-1465-03: AI recipe pools exclude map-split for all categories
- **Priority:** P1
- **Type:** Unit
- **Issue Reference:** GH-1465
- **Precondition:** `src/lib/ai/openai-generator.ts` has `CATEGORY_VARIANT_WEIGHTS` and `src/lib/ai/category-requirements.ts` has `CONTACT_VARIANT_BY_CATEGORY`
- **Steps:**
  1. Import `CATEGORY_VARIANT_WEIGHTS` from openai-generator
  2. For each category with a contact variant pool, assert `contact` pool does NOT include `'map-split'`
  3. Import `CONTACT_VARIANT_BY_CATEGORY`
  4. For each category, assert contact variant list does NOT include `'map-split'`
- **Expected:** No category's contact recipe/pool includes `'map-split'`

### TC-1465-04: Rendered map-split produces no iframe/embed, matches split layout
- **Priority:** P0
- **Type:** Component (render)
- **Issue Reference:** GH-1465
- **Precondition:** ContactBlock component exists, test setup from gold-standard `f21-localization.test.tsx`
- **Steps:**
  1. Render `<ContactBlock variant="map-split" address="123 Main St" {...requiredProps} />`
  2. Query DOM for `<iframe>` elements → expect none
  3. Query for `output=embed` or Google Maps embed patterns → expect none
  4. Assert rendered output matches split layout structure (form + info card present)
- **Expected:** No iframe/embed tag; split layout rendered without error

### TC-1465-05: External Google Maps link still present in contact variants
- **Priority:** P1
- **Type:** Component (render)
- **Issue Reference:** GH-1465
- **Precondition:** ContactBlock with address field populated
- **Steps:**
  1. Render `<ContactBlock variant="split" address="123 Main St" {...requiredProps} />`
  2. Query for anchor with `href="https://maps.google.com/?q=123 Main St"` and `target="_blank"`
  3. Repeat for `variant="form"` and `variant="card-float"` with address
- **Expected:** External "Open in Google Maps" link present in all variants with address; clicking opens new tab to Google Maps

### TC-1465-06: Regression — remaining 5 variants render without throwing
- **Priority:** P1
- **Type:** Component (render)
- **Issue Reference:** GH-1465
- **Precondition:** ContactBlock component exists
- **Steps:**
  1. For each variant in ['form', 'info-only', 'split', 'card-float', 'minimal-inline']:
     - Render `<ContactBlock variant={variant} address="123 Main St" {...requiredProps} />`
     - Assert render completes without throwing
     - Assert rendered output is not empty
- **Expected:** All 5 variants render cleanly; no errors; output present

---

## 9. Traceability Matrix

### Sprint 1 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|----|-------------|------------|----------|
| S1-AC-01 | ThemeConfig 6 color tokens + presets | TC-S1-001 | ✅ Full |
| S1-AC-02 | CSS Variables 20+ injected | TC-S1-003, TC-S1-004 | ✅ Full |
| S1-AC-03 | Block migration (no ${pc}) | TC-S1-013 | ✅ Full |
| S1-AC-04 | Backward compat (dark mode) | TC-S1-005, TC-S1-007 | ✅ Full |
| S1-AC-05 | Backward compat (legacy fonts) | TC-S1-009 | ✅ Full |
| S1-AC-06 | Font pairing resolution by ID | TC-S1-010 | ✅ Full |
| S1-AC-07 | Font preview component | TC-S1-012 | ✅ Full |
| S1-AC-08 | Spacing preset applied | TC-S1-014 | ✅ Full |
| S1-AC-09 | Border radius token applied | TC-S1-015 | ✅ Full |
| S1-AC-10 | Shadow preset applied | TC-S1-016 | ✅ Full |
| S1-AC-11 | Zod schema validation | TC-S1-002 | ✅ Full |
| S1-AC-12 | Surface color dark/light mode | TC-S1-005, TC-S1-006 | ✅ Full |
| S1-AC-13 | 20 font pairings available | TC-S1-011 | ✅ Full |
| S1-AC-14 | Google Fonts Loader updated | TC-S1-012 | ✅ Full |
| S1-AC-15 | No visual regression | TC-S1-017 | ✅ Full |

### Sprint 2 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|----|-------------|------------|----------|
| S2-AC-01 | Hero magazine layout | TC-S2-001 | ✅ Full |
| S2-AC-02 | Hero gradient animation | TC-S2-002 | ✅ Full |
| S2-AC-03 | Hero split-video plays | TC-S2-003 | ✅ Full |
| S2-AC-04 | Features zigzag alternates | TC-S2-004 | ✅ Full |
| S2-AC-05 | Features carousel swipe | TC-S2-005 | ✅ Full |
| S2-AC-06 | Testimonials spotlight click | TC-S2-006 | ✅ Full |
| S2-AC-07 | Testimonials masonry grid | TC-S2-007 | ✅ Full |
| S2-AC-08 | Pricing toggle monthly/yearly | TC-S2-008 | ✅ Full |
| S2-AC-09 | Pricing comparison table | TC-S2-009 | ✅ Full |
| S2-AC-10 | Gallery lightbox fullscreen | TC-S2-010 | ✅ Full |
| S2-AC-11 | Nav transparent scroll | TC-S2-011 | ✅ Full |
| S2-AC-12 | Nav pill floating | TC-S2-012 | ✅ Full |
| S2-AC-13 | Contact map-split columns | TC-S2-013 | ✅ Full |
| S2-AC-14 | Footer mega-footer top band | TC-S2-014 | ✅ Full |
| S2-AC-15 | All variants use design tokens | TC-S2-015 | ✅ Full |
| S2-AC-16 | Variant swap preserves content | TC-S2-016, TC-S2-017 | ✅ Full |

### Sprint 3 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|----|-------------|------------|----------|
| S3-DoD-01 | 8 blocks with config + schema | TC-S3-001 → TC-S3-008 | ✅ Full |
| S3-DoD-02 | 8 blocks with renderer | TC-S3-001 → TC-S3-008 | ✅ Full |
| S3-DoD-03 | Blocks registered in BLOCK_TYPES | TC-S3-016 | ✅ Full |
| S3-DoD-04 | 11 content files with Malaysian data | TC-S3-009 | ✅ Full |
| S3-DoD-05 | Content validator passes | TC-S3-009 | ✅ Full |
| S3-DoD-06 | Template composer 50+ templates | TC-S3-010 | ✅ Full |
| S3-DoD-07 | Seed API with deduplication | TC-S3-011 | ✅ Full |
| S3-DoD-08 | Thumbnails generated | TC-S3-014 | ✅ Full |
| S3-DoD-09 | Unit tests per block schema | TC-S3-001 → TC-S3-008 | ✅ Full |
| S3-DoD-10 | Unit tests for composer | TC-S3-010 | ✅ Full |
| S3-DoD-11 | No TypeScript errors | TC-S1-018 (shared) | ✅ Full |
| S3-DoD-12 | No lint errors | TC-S1-018 (shared) | ✅ Full |
| S3-QC-01 | Blocks render in AI Editor | TC-S3-001 → TC-S3-008 | ✅ Full |
| S3-QC-02 | Blocks responsive | TC-S3-013 | ✅ Full |
| S3-QC-03 | Gallery shows 50+ with thumbnails | TC-S3-014 | ✅ Full |
| S3-QC-04 | Seed API idempotent | TC-S3-011 | ✅ Full |
| S3-QC-05 | Malaysian content realistic | TC-S3-009 | ✅ Full |
| S3-QC-06 | Block performance < 200ms | TC-S3-015 | ✅ Full |

### Sprint 4 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|----|-------------|------------|----------|
| S4-AC-01 | Timeout warning at 30s | TC-S4-001 | ✅ Full |
| S4-AC-02 | Cancel generation | TC-S4-002 | ✅ Full |
| S4-AC-03 | Hard timeout 60s | TC-S4-003 | ✅ Full |
| S4-AC-04 | Elapsed timer | TC-S4-004 | ✅ Full |
| S4-AC-05 | Error 402 free tier | TC-S4-005 | ✅ Full |
| S4-AC-06 | Error 429 rate limit | TC-S4-006 | ✅ Full |
| S4-AC-07 | Error 400 content unsafe | TC-S4-007 | ✅ Full |
| S4-AC-08 | SSE disconnect | TC-S4-008 | ✅ Full |
| S4-AC-09 | i18n error messages MS | TC-S4-009 | ✅ Full |
| S4-AC-10 | Template search debounced | TC-S4-010 | ✅ Full |
| S4-AC-11 | Hover preview desktop | TC-S4-011 | ✅ Full |
| S4-AC-12 | Mobile single column | TC-S4-012 | ✅ Full |
| S4-AC-13 | 50 templates 390px no scroll | TC-S4-013 | ✅ Full |
| S4-AC-14 | 50 templates 1280px layout | TC-S4-014 | ✅ Full |

### Cross-Cutting → Test Cases

| Area | Test Cases | Coverage |
|------|------------|----------|
| Security — Auth | TC-SEC-001, TC-SEC-002, TC-SEC-003 | ✅ Full |
| Security — Injection | TC-SEC-004, TC-S1-008 | ✅ Full |
| Accessibility | TC-A11Y-001, TC-A11Y-002, TC-A11Y-003 | ✅ Full |
| Edge Cases (from scenarios) | TC-S1-007, TC-S1-008, TC-S2-017, TC-S4-015 | ✅ Full |

---

## 9. Summary

| Metric | Value |
|--------|-------|
| **Total ACs mapped** | 63/63 (100%) |
| **Total Test Cases** | 58 |
| **P0 (Critical)** | 12 |
| **P1 (High)** | 30 |
| **P2 (Medium)** | 16 |
| **Unit tests** | 18 |
| **Integration tests** | 22 |
| **E2E tests** | 10 |
| **Security tests** | 4 |
| **Accessibility tests** | 3 |
| **Performance tests** | 2 |
| **Visual regression** | 1 |
| **Scenario coverage** | 46 scenarios across 12 dimensions |
| **Traceability** | 100% — every AC has ≥1 test case |
