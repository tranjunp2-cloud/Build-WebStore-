# Scout Report — Design Quality Rules (Plan B)

**Date:** 2026-04-13
**Worktree:** `.claude/worktrees/template-audit/`
**Branch:** `feat/F01-ai-gen-variety-fix` (Plan A commit beffa9b merged)
**Scope:** theme system, design tokens, 47 blocks, content rules, typography

---

## 1. Theme System (hiện có)

### `src/lib/theme/resolve.ts` (235 lines)
- `resolveTheme()` — merge ThemeConfig + defaults (primaryColor, secondaryColor, accentColor, spacingPreset, borderRadius, shadowPreset)
- `generateThemeCSS()` — outputs `:root` CSS vars cho colors/typography/spacing/radius/shadows
- `CSS_VARS` constant object (camelCase accessors) — **dùng ở 60+ files, 208+ refs**
- Helpers: `hexToHSL()`, `hslToHex()`, `lightenHex()`, `hexToRGB()`
- Exports: `SPACING_PRESETS` (compact/default/relaxed), `RADIUS_PRESETS` (sharp/subtle/rounded/soft/pill), `SHADOW_PRESETS` (none/subtle/medium/dramatic)

### CSS Vars hiện tại (36 vars từ `generateThemeCSS`)
| Category | Vars |
|----------|------|
| Colors | `--brand-primary`, `--brand-secondary`, `--brand-accent`, `--surface`, `--text`, `--muted`, `--background` |
| RGB | `--brand-primary-rgb`, `--brand-secondary-rgb`, `--brand-accent-rgb` |
| Typography | `--font-heading`, `--font-body` |
| Spacing | `--space-xs/sm/md/lg/xl/2xl`, `--section-padding` |
| Shape | `--radius-sm/md/lg/full`, `--shadow-sm/md/lg` |

### `src/app/globals.css` (366 lines)
- Root vars: `--brand-primary` (#0ea5e9), `--brand-accent` (#d946ef), `--surface-1/#2/#3`, `--border`, `--text-primary/secondary`, `--radius`
- `@layer base` — resets
- `@layer components` — `.btn-primary/secondary/accent`, `.card`, glass effects, gradient utilities
- `@layer utilities` — animations (shimmer, fade-in-up, slide-in-*, float)

### `tailwind.config.js`
- `fontFamily.sans: ['var(--font-inter)']`, `fontFamily.heading: ['var(--font-outfit)']`
- `colors.brand` 11-scale sky palette, `colors.accent` 7-scale magenta palette
- `corePlugins.preflight: false` (custom resets in globals.css)
- Plugin: `@tailwindcss/typography`

### `src/components/AppShell.tsx` — font loader
- Loads Inter (Latin, Vietnamese) → `--font-inter`
- Loads Outfit (Latin, Latin-ext) → `--font-outfit`
- **next/font ở AppShell, KHÔNG ở layout.tsx**

---

## 2. Font System (đã có một phần)

### `src/lib/fonts/pairings.ts`
- `FontPairing` type: `{id, name, category, headingFont, bodyFont, headingWeight, bodyWeight, description}`
- **15+ pairings định sẵn**: Modern Clean, Editorial (Playfair+Lora), Tech Forward (Space Grotesk+Inter), Warm & Friendly, ...

### Whitelist trong `src/lib/ai/openai-generator.ts` (lines 88-89)
- `ALLOWED_HEADING_FONTS`: `Outfit`, `Inter`, `Playfair Display`, `DM Sans`, `Poppins`, `Raleway`
- `ALLOWED_BODY_FONTS`: `Inter`, `DM Sans`, `Lato`, `Open Sans`, `Nunito`

### `src/lib/ai/theme-presets.ts`
- 55 industry presets — `ThemePreset` type với colors + font pairing IDs

**Gap:** Chưa có `BLOCKED_PAIRINGS` (same-font pairs như Inter+Inter). Google Fonts Playfair/Lora/Space Grotesk **chưa import** ở AppShell (dùng fallback CSS).

---

## 3. Block Component System

### `src/blocks/registry.ts`
- Centralized registry: slug → `{component, schema, meta}`
- Public API: `blockRegistry.getComponent()`, `getSchema()`, `getBlockMeta()`, `getBlockTypes()`, `validate()`
- **47 block slugs confirmed**: navigation, hero, features, about, testimonials, faq, contact, gallery, footer, pricing, cta, stats, team, newsletter, video, logo-cloud, blog-list, products-grid, products-featured, custom-html, socialWidget, cartWidget, pricing-table, gallery-masonry, whatsapp-button, google-maps, social-proof, countdown-timer, before-after, feature-comparison, download-cta, video-background, breadcrumb, divider, announcement-bar, client-logos, accordion, step-process, portfolio-grid, menu-food, service-cards, carousel, menu-display, booking-widget, class-schedule, review-cards, video-showcase, doctor-profile, property-card, product-quick-view

### Variant structure
- **Hero only**: 11 variants tách file ở `src/blocks/hero/variants/` (centered, split, fullscreen, video, parallax, gradient, slideshow, magazine, cards-overlay, minimal, split-video)
- **Other 46 blocks**: variants inline trong `index.tsx` (switch/conditional rendering)
- Total ~142 variants

### `src/blocks/shared/`
| File | Purpose |
|------|---------|
| `animations.tsx` | `AnimatedSection`, `StaggerGrid`, `StaggerItem`, `HoverCard` + framer-motion variants |
| `decorative.tsx` | `AvatarRing`, `GradientBlob`, `DotGrid`, `IconContainer`, `SectionLabel` |
| `RichText.tsx` | Rich-text renderer + heading size mapping + HTML sanitization |
| `use-count-up.ts` | Animated counter hook |

**❌ NO `SectionWrapper` exists** — `container mx-auto px-6` hardcoded **131 lần** across blocks.

### Hardcoded patterns (sample analysis)
| Block | Padding | Text sizes | Container | Colors |
|-------|---------|-----------|-----------|--------|
| `hero/variants/centered.tsx` | `min-h-[92vh]`, `px-6` | `text-5xl md:text-7xl`, `text-xl` | `container mx-auto px-6` | ✅ `CSS_VARS.primary` + `rgba(var(--brand-primary-rgb))` |
| `features/index.tsx` | `py-24 px-6` | `text-4xl md:text-5xl`, `text-lg` | `container mx-auto px-6` | ✅ `CSS_VARS.primary` + `var(--surface)` |
| `testimonials/index.tsx` | `py-24 px-6` | `text-4xl md:text-5xl`, `text-lg` | `container mx-auto px-6` | ✅ Heavy CSS var usage |

### Refactor impact
- `var(--brand-primary)` + `var(--brand-primary-rgb)`: **496 occurrences** across blocks
- Inline `style={{}}` props: 473 instances (mostly CSS var bindings)
- `#000000` hardcoded: 0 (✅ clean)
- `text-gray-*`/`bg-gray-*`: 0 blocks (✅ clean — dùng `--muted` / `--text-secondary`)

---

## 4. AI Generator — Content Validation Hook Points

### `src/lib/ai/openai-generator.ts` (847 lines) — Plan A state CONFIRMED
- `generateSiteWithAI()` (line 28) — entry
- `VARIANT_ALIASES` (lines 236-281) ✅ Plan A merged
- `CATEGORY_VARIANT_WEIGHTS` (lines 284-340) ✅ Plan A merged
- `pickWeightedVariant()` ✅ Plan A merged
- `sanitizeBlockData()` (lines 478-557) — fuzzy match variant, strip image strings, min content guard
- `validateBlocks()` (lines 109-126) — post-sanitize validation
- **Plan B phase 04 hook point: sau line 529** (after min content guard, before variant finalization)

### `src/lib/ai/template-composer.ts` — Template path
- `composeFromBlueprint()` (line 1068) — new blueprint path
- `composeTemplate()` (line 1103) — legacy path
- **25 builder functions** (không phải 15 như plan ghi):
  - **Core (15):** buildNavigation (71), buildHero (85), buildFeatures (103), buildTestimonials (187), buildContact (202), buildFooter (220), buildStats (252), buildGallery (329), buildFAQ (345), buildCTA (354), buildAbout (366), buildPricing (376), buildTeam (436), buildNewsletter (479), buildMenuDisplay (492)
  - **Industry (10):** buildBookingWidget (530), buildClassSchedule (567), buildReviewCards (585), buildVideoShowcase (604), buildDoctorProfile (620), buildPropertyCard (634), buildProductQuickView (650), buildPortfolioGrid (668), buildServiceCards (685), buildClientLogos (711)
- **Plan B phase 04 hook point: `buildBlockFromSpec()` (line 963)** — centralized validation, áp dụng 1 chỗ ăn cả 25 builders
- Content source: `getCategoryContent(category)` — reads from `content/*.ts`

### `src/lib/ai/content/` (17 files)
- 14 category files: restaurant, ecommerce, beauty, tech, health, education, realestate, fitness, creative, business, fnb, events, travel, blog
- `types.ts` — `BusinessSample`, `TestimonialSample`, `FAQSample`, `CategoryContent`
- `validator.ts` — `validateCategoryContent()`, `hasRMPricing()` (structural only, không check content rules)
- `index.ts` — `categoryMap: Record<string, CategoryContent>`

### `src/lib/ai/system-prompt.ts`
- Exports: `STYLE_PERSONALITIES` (8), `selectPersonality()`, `CATEGORY_SIGNATURE_BLOCKS`, `buildSystemPrompt()`, `buildUserPrompt()`
- **Note:** `HERO_VARIANTS_BY_CATEGORY` thực tế nằm ở `template-composer.ts` dưới tên `CATEGORY_HERO_VARIANTS` (lines 33-48)

**❌ NO `content-rules.ts` exists** — Plan B phase 04 tạo mới.

---

## 5. Docs đã có

- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` — template standards (section minimums, typography ranges, a11y)
- `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md` — AI pipeline context
- `docs/prd/F01-ai-builder-variety.md` — Plan A PRD
- `docs/qa/F01-ai-builder-variety.md` — Plan A QA test plan

**❌ NO `DESIGN_TOKENS.md`** — Plan B phase 01 tạo mới.

---

## 6. Critical Gaps & Refactor Notes

### Gaps (Plan B sẽ tạo)
1. **`src/lib/design-tokens.ts`** — centralized tokens (scattered across resolve.ts + presets hiện tại)
2. **`src/blocks/shared/SectionWrapper.tsx`** — thay thế 131 `container mx-auto px-6` hardcoded
3. **`src/blocks/shared/Typography.tsx`** — `<Heading level={1-4}>`, `<Body>` components
4. **`src/lib/theme/color-utils.ts`** — `tintNeutral()`, `checkContrast()`, `generatePalette()`
5. **`src/lib/ai/content-rules.ts`** — CONTENT_RULES, BLOCKED_CONTENT, VARIANT_MIN_CONTENT, ORDERING_RULES
6. **BLOCKED font pairings validation** — chưa có (FONT_PAIRINGS đã có whitelist)
7. **Semantic color vars** — `--accent`, `--surface-primary/secondary/card`, `--text-inverse`, `--border`, `--divider` (hiện chỉ có `--brand-primary/secondary/accent`, `--surface-1/2/3`, `--text-primary/secondary`, `--muted`)

### Rename strategy (Phase 03)
**⚠️ CẨN THẬN:** rename không chỉ là CSS var text. Có cả:
- `CSS_VARS` object trong `resolve.ts` (camelCase accessors dùng ở 60+ files)
- `generateThemeCSS()` output (line 203-229) — production CSS gen
- `globals.css` root vars (hardcoded hex values cho fallback)
- 496 inline `var(--brand-primary)` usages trong blocks
- 473 inline `style={{}}` props có thể concat strings

**Approach:** thêm semantic vars mới song song, migrate từng block, **cuối cùng** remove legacy vars. Không rename cùng lúc.

### Block refactor cost (Phase 05)
- **HIGH:** hero (11 files), features (inline 4 variants), testimonials (inline 6 variants), pricing (inline 8 variants)
- **LOW:** Decorative components (đã abstract), RichText (đã semantic)
- **Quick win:** Extract `SectionWrapper` trước → tất cả 47 blocks chỉ cần wrap, Phase 01 value cao nhất

---

## 7. Unresolved Questions

1. **Rename strategy thực tế:** Validation decision ghi "rename cũ, update 192 usages" nhưng actual count là **496** (brand-primary only). Có nên đổi plan → keep alias để giảm diff risk?
2. **`CSS_VARS` object API:** Nếu rename raw CSS vars, có đổi cả camelCase keys (`CSS_VARS.primary` → `CSS_VARS.accent`) không? Đổi key → TypeScript errors widespread, giúp catch miss.
3. **Font pairings existing vs Plan B proposal:** `src/lib/fonts/pairings.ts` đã có 15+ pairings. Plan B phase 02 đề xuất 5 pairings mới — merge hay thay thế?
4. **25 builders vs 15:** Plan B phase 04 nói "15 builder functions" nhưng thực tế có 25 (15 core + 10 industry). `buildBlockFromSpec()` (line 963) hook centralize cho cả 25 — cần update plan.
5. **hero variants/ directory pattern:** Có nên refactor 46 blocks khác theo pattern hero (tách file per variant) để Phase 05 parallel agents dễ làm không? — mở rộng scope.
