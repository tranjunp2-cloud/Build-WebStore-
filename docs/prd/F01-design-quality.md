# PRD: AI Website Generation Design Quality Rules (F01-design-quality)
> **Version:** 1.0 | **Updated:** 2026-04-13 | **Agent:** `documentation-engineer`
> **Priority:** P1 | **Sprint:** Wave 3 — Sprint 3 | **Size:** XL
> **Extends:** [F01 AI Web Builder](./F01-ai-builder.md) | **Companion to:** [F01-variety](./F01-ai-builder-variety.md)
> **Branch:** `feat/F01-ai-gen-variety-fix`

---

> [!IMPORTANT]
> **Plan B — block-level design quality.** Companion PRD cho F01-variety. Trong khi F01-variety sửa **AI chọn gì** (prompt + sanitizer + composer), PRD này sửa **block render thế nào** (tokens + typography + color + content rules). Hai plan chạy chung branch, ship cùng PR.

---

## 0. Story Traceability

| Story ID | Title | Status |
|----------|-------|--------|
| US-F01D-01 | Blocks Render With Consistent Design Tokens | Ready |
| US-F01D-02 | Typography Enforces Font Pairing Contrast | Ready |
| US-F01D-03 | Colors Follow 60-30-10 Semantic System | Ready |
| US-F01D-04 | Content Validation Catches Generic Labels | Ready |

---

## 1. Problem Statement

### 1.1 Tình trạng hiện tại

Dù F01-variety đã fix AI chọn block đa dạng, **block components tự render inconsistent** — mỗi block hardcode padding/text-size/color riêng, không có hệ thống chung. Điều này khiến website generate ra vẫn nhìn "AI slop" dù variant đa dạng.

**Bằng chứng cụ thể (scout 2026-04-13):**

- **131 lần hardcode `container mx-auto px-6`** trong `src/blocks/` — 47 blocks mỗi cái tự wrap section riêng, không có `SectionWrapper` chung. Responsive padding vary arbitrarily (`py-16`, `py-20`, `py-24`, `py-32`).
- **496 usages của `var(--brand-primary)` + RGB variant** trong blocks — chỉ có 3 brand colors (`--brand-primary/secondary/accent`), thiếu semantic roles (`--accent`, `--surface-primary/secondary/card`, `--text-inverse`, `--border`, `--divider`). Không enforce 60-30-10 rule.
- **`CSS_VARS` camelCase object** tại `src/lib/theme/resolve.ts` line 203-235 được import ở 60+ files (208+ refs) — naming `CSS_VARS.primary` ambiguous (primary = accent? surface?).
- **Typography arbitrary:** heading/body font-size vary tự do (`text-3xl`, `text-4xl`, `text-5xl`, `text-sm`, `text-xs`) không theo modular scale. Body text có khi < 16px vi phạm accessibility.
- **FONT_PAIRINGS có 20 pairings nhưng 2 pairing vi phạm contrast axis rule:**
  - `modern-clean`: **Inter + Inter** (same font, no contrast)
  - `humanist`: **DM Sans + DM Sans** (same font, no contrast)
- **9+ fonts thiếu ở AppShell.tsx** — các pair ref Playfair Display, Lora, Space Grotesk, Cormorant Garamond, v.v. nhưng chỉ Inter + Outfit được load qua `next/font`, còn lại fallback system.
- **Không có content validation:** AI/template có thể gen headline 20 từ, CTA "Submit", "Click Here", generic copy "Welcome to our website" mà không bị chặn.
- **Không có contrast checking:** text có thể render `#000000` trên `#0a0a0a` → WCAG fail.

### 1.2 Impact kinh doanh

User sau khi generate site cảm giác "visual template", không phải "designed for me". Kể cả khi AI chọn block đa dạng (F01-variety), **rendering quality** thấp → vẫn mất conversion free → paid. Research đã chỉ rõ: 60-30-10 color, modular typography, 8px grid là baseline của "professional design" — thiếu những thứ này, site sẽ luôn nhìn "AI generated".

---

## 2. Target User

Giống F01 gốc — SME owner không có kỹ thuật. User không biết tên "design token" hay "60-30-10 rule" nhưng mắt họ **nhận ra** trang web pro vs non-pro trong < 3 giây. Fix này đảm bảo output vượt qua ngưỡng "look pro" đó.

---

## 3. Solution Overview

Implement closed token layer + enforce rules ở code level, không phụ thuộc AI tuân prompt.

| Phase | Component | File(s) | Impact |
|-------|-----------|---------|--------|
| 01 | Design Tokens | `src/lib/design-tokens.ts` (NEW), `src/blocks/shared/SectionWrapper.tsx` (NEW) | Foundation — 131 hardcoded containers → 1 wrapper |
| 02 | Typography Scale | `src/lib/fonts/pairings.ts` (EDIT), `src/blocks/shared/Typography.tsx` (NEW), `src/components/AppShell.tsx` (EDIT) | Fix 2 bad pairings, load missing fonts, type scale |
| 03 | Color System | `src/lib/theme/resolve.ts` (EDIT), `src/app/globals.css` (EDIT), codemod for 496 usages | Rename + semantic vars + 60-30-10 |
| 04 | Content Validation | `src/lib/ai/content-rules.ts` (NEW), `src/lib/ai/openai-generator.ts` (EDIT line 529), `src/lib/ai/template-composer.ts` (EDIT line 963) | Block blocked CTAs/headlines in both AI + template paths |
| 05 | Block Audit | `src/blocks/**/*.tsx` (47 blocks) | Apply all above to every block — 3 parallel subagents |

Tất cả thay đổi phải **backward-compatible** với site đã generate — fallback CSS vars giữ để sites cũ không break.

---

## 4. Scope

### In Scope

- Tạo `design-tokens.ts` với SPACING (8px grid), RADIUS, SHADOW, ICON_SIZE, SECTION_PADDING, CONTAINER, CARD_PADDING
- Tạo `SectionWrapper` component thay thế 131 hardcoded `container mx-auto px-6`
- Tạo `Typography` components (Heading level={1-4}, Body, Caption)
- Thêm TYPE_SCALE (modular 1.25), LINE_HEIGHT, FONT_WEIGHT tokens
- Thêm `BLOCKED_PAIRINGS` + `validateFontPairing()` vào `src/lib/fonts/pairings.ts`
- Fix 2 invalid pairings: `modern-clean` và `humanist` (change body font)
- Import 9+ Google Fonts vào `AppShell.tsx` (Playfair Display, Lora, Space Grotesk, Cormorant Garamond, Proza Libre, Sora, Work Sans, Merriweather, Source Serif 4, Manrope, Karla, v.v.)
- Rename CSS vars legacy → semantic: `--brand-primary` → `--accent`, `--brand-secondary` → `--surface-secondary`, etc. (codemod 1 phát, update 496+ usages)
- Rename `CSS_VARS` object keys: `CSS_VARS.primary` → `CSS_VARS.accent`, etc.
- Thêm `--text-inverse`, `--divider` semantic vars (mới)
- Tạo `color-utils.ts`: `tintNeutral()`, `checkContrast()` (WCAG AA), `generatePalette()`
- Tạo `content-rules.ts`: CONTENT_RULES, BLOCKED_CONTENT, `validateBlockContent()`, reuse existing VARIANT_MIN_CONTENT từ `openai-generator.ts:532-539`
- Wire content validation vào AI path (`sanitizeBlockData` line 529) + template path (`buildBlockFromSpec` line 963)
- Section ordering validation (AIDA funnel: features→stats, testimonials→pricing)
- Audit 47 blocks: apply SectionWrapper + Typography + semantic vars (hero 11 variant files + 46 blocks inline)

### Out of Scope

- OKLCH color space migration (future optimization)
- Lazy font loading (ship all fonts upfront, optimize sau nếu bundle > 500KB)
- Visual regression automation (manual screenshot diff cho MVP)
- Dark mode theme variants (Plan A đã handle)
- Block schema changes
- Rewrite hero 11 variants pattern → apply to 46 blocks inline pattern (scope creep)
- PDF/print stylesheet

---

## 5. Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR-01 | Tạo `src/lib/design-tokens.ts` export SPACING (4-120px, 10 steps), RADIUS (none to full, 7 steps), SHADOW (5 presets), ICON_SIZE (sm/md/lg/xl), SECTION_PADDING (compact/default/relaxed/hero), CONTAINER (narrow/default/wide/full), CARD_PADDING (sm/md/lg) | Must Have |
| FR-02 | Tạo `SectionWrapper` component với props `padding`, `container`, `background` — thay thế 131 hardcoded `container mx-auto px-6`; tự động alternate backgrounds (white/light/white) | Must Have |
| FR-03 | Tạo `Typography` shared components (`<Heading level={1-4}>`, `<Body>`, `<Caption>`) enforce TYPE_SCALE modular 1.25 ratio; body text ≥ 16px (text-base minimum) | Must Have |
| FR-04 | Thêm `BLOCKED_PAIRINGS` + `validateFontPairing()` vào `src/lib/fonts/pairings.ts`; block same-font pairs (Inter+Inter, DM Sans+DM Sans); wire vào `resolveTheme()` | Must Have |
| FR-05 | Fix 2 invalid FONT_PAIRINGS: `modern-clean` (Inter+Inter → **Inter + Lora**, reuse Lora từ editorial pair), `humanist` (DM Sans+DM Sans → DM Sans+Karla); import missing Google Fonts vào `AppShell.tsx` via `next/font/google` với `display: 'swap'` (ship full, monitor Lighthouse post-deploy) | Must Have |
| FR-06 | Rename CSS vars legacy → semantic (`--brand-primary` → `--accent`, `--brand-secondary` → `--surface-secondary`, `--brand-accent` → `--accent-hover`, etc.); rename `CSS_VARS` object keys ở `resolve.ts:203-235`; codemod 496+ usages + 60+ file refs trong 1 commit | Must Have |
| FR-07 | Thêm semantic CSS vars mới: `--surface-primary/secondary/card`, `--text-primary/secondary/inverse`, `--accent`, `--accent-hover`, `--border`, `--divider`; generate trong `generateThemeCSS()` | Must Have |
| FR-08 | Tạo `color-utils.ts` với `checkContrast(fg, bg)` returning `{ratio, passAA, passAALarge}` (WCAG 2.1 — 4.5:1 normal, 3:1 large); `tintNeutral(brandHex, lightness)` tint toward brand hue; `generatePalette(primary, secondary, mode)` returns semantic palette | Must Have |
| FR-09 | Tạo `src/lib/ai/content-rules.ts` export CONTENT_RULES (hero headline 3-10 words, subheadline 5-25 words, CTA 1-5 words, feature description ≤150 chars, testimonial ≤200 chars); BLOCKED_CONTENT array (Welcome to our website, Click Here, Submit, Learn More, Buy Now, Lorem ipsum, Quality service); ORDERING_RULES (features before stats, testimonials before pricing) | Must Have |
| FR-10 | `validateBlockContent(block)` return `{valid, warnings, fixes}`; reuse existing `VARIANT_MIN_CONTENT` từ `openai-generator.ts:532-539` — không re-define | Must Have |
| FR-11 | Wire validation vào AI path: `openai-generator.ts` `sanitizeBlockData()` sau line 529 (after min content guard) — auto-fix + console.warn | Must Have |
| FR-12 | Wire validation vào Template path: `template-composer.ts` `buildBlockFromSpec()` line 963 (centralized — ăn cả 25 builders: 15 core + 10 industry) | Must Have |
| FR-13 | Apply design tokens + typography + color system vào 47 blocks (hero 11 variant files + 46 blocks inline); 3 parallel subagents với shared checklist (Batch A core 5 / B secondary 9 / C industry 33) | Must Have |
| FR-14 | Log warning với prefix `[design-quality]` cho mọi validation violation + fix applied; **prod mode: silent auto-fix**, dev/staging mode: verbose; **never throw** (không block AI pipeline) | Should Have |
| FR-15 | Tạo `docs/standards/DESIGN_TOKENS.md` — reference cho dev sau này | Nice to Have |
| FR-16 | **Multi-language content rules** — `BLOCKED_CTA_BY_LANG: { en: [...], vi: [...], ms: [...] }` trong `content-rules.ts`; `validateBlockContent(block, lang)` nhận language param từ `theme.language` hoặc `businessInfo.language`; Vietnamese blocked: "Gửi", "Nhấn vào đây", "Bấm vào đây"; Malay blocked: "Hantar", "Klik di sini", "Tekan di sini" | Must Have |
| FR-17 | **Migration script** `scripts/migrate-legacy-font-pairings.mjs` — scan Payload DB `themes`/`sites` collections, detect legacy pairing IDs (`modern-clean`, `humanist`) hoặc same-font combo, update sang safe alternatives (`startup-vibe`, `pro-corporate`), log before/after per site, dry-run mode | Must Have |
| FR-18 | Page-level guard: `MIN_BLOCKS_PER_PAGE = 3` (nav + hero + footer mandatory) — nếu sau validation total < 3, fallback skeleton thay vì empty page | Must Have |

---

## 6. Non-Functional Requirements

- **Performance:**
  - Bundle size delta < **500KB** (sau thêm 9+ Google Fonts)
  - First Contentful Paint không regress > **100ms** trên sample sites
  - `next build` time không regress > **10%**
  - Codemod script chạy full repo < **30s**

- **Security:**
  - Validation rules run trong build-time (template path) và runtime (AI path) — không leak tới client
  - `checkContrast()` không thực thi arbitrary color strings (validate hex format trước)
  - Codemod không touch `node_modules`, `.next`, `dist`

- **Accessibility:**
  - **WCAG 2.1 AA** compliance: text contrast ≥ 4.5:1, large text ≥ 3:1
  - Body text luôn ≥ 16px (prevents mobile zoom on iOS)
  - CTA touch targets ≥ 44px × 44px
  - Section landmarks qua `SectionWrapper` (implicit `<section>` tag)

- **Backward Compatibility:**
  - Sites đã generate không bị break — fallback CSS vars giữ trong `generateThemeCSS()` catch block (line 185-197)
  - Payload DB schema không thay đổi
  - Block schema/registry giữ nguyên — chỉ refactor render code
  - Content validation chỉ warn (không throw) trong production — auto-fix silent

- **Maintainability:**
  - Single source of truth: `design-tokens.ts` cho tokens, `content-rules.ts` cho validation, `pairings.ts` cho fonts
  - Không duplicate data giữa design-tokens.ts và pairings.ts
  - Shared checklist file cho Phase 05 parallel agents

---

## 7. User Stories

### US-F01D-01: Blocks Render With Consistent Design Tokens
```
As a SME owner generating a website,
I want every section to have consistent spacing, card padding, and responsive behavior,
So that the generated site feels professionally designed, not ad-hoc.
```

**Acceptance Criteria:**
- [ ] **AC-01** — Given tôi generate website bất kỳ category, when trang render, then mọi section dùng padding từ SECTION_PADDING tokens (compact/default/relaxed/hero), không có arbitrary `py-16`, `py-20`, `py-24` mixed
- [ ] **AC-02** — Given tôi inspect 2 blocks bất kỳ cạnh nhau, when compare container width, then cả 2 có cùng `max-width` (narrow/default/wide) từ CONTAINER tokens
- [ ] **AC-03** — Given grep `container mx-auto px-6` trong `src/blocks/`, when run codebase, then return 0 matches (all replaced by SectionWrapper)
- [ ] **AC-04** — Given tôi resize browser xuống 375px, when view bất kỳ block, then padding/gap responsive đúng, không bị crop hoặc overflow

### US-F01D-02: Typography Enforces Font Pairing Contrast
```
As a SME owner,
I want heading and body fonts to have visual contrast,
So that the site looks designed (not generic "AI slop" with same-font everywhere).
```

**Acceptance Criteria:**
- [ ] **AC-05** — Given theme config có `fontHeading: 'Inter'` và `fontBody: 'Inter'`, when `resolveTheme()` chạy, then validator reject pairing + fallback về default (Outfit + Inter) + log warning
- [ ] **AC-06** — Given tôi check `FONT_PAIRINGS` trong `src/lib/fonts/pairings.ts`, when run validator trên tất cả 20 pairings, then 0 pairings vi phạm same-font rule (fixed: `modern-clean`, `humanist`)
- [ ] **AC-07** — Given tôi load site với pairing `editorial` (Playfair Display + Lora), when page render, then fonts load từ Google Fonts qua `next/font`, không fallback system
- [ ] **AC-08** — Given body text trong bất kỳ block, when inspect computed style, then `font-size ≥ 16px`

### US-F01D-03: Colors Follow 60-30-10 Semantic System
```
As a SME owner,
I want the site to follow professional color distribution (60% neutral / 30% secondary / 10% accent on CTAs),
So that CTAs stand out and site doesn't look flat.
```

**Acceptance Criteria:**
- [ ] **AC-09** — Given tôi grep `--brand-primary|--brand-secondary|CSS_VARS\.primary|CSS_VARS\.secondary` trong `src/`, when run, then 0 matches (all renamed to semantic vars)
- [ ] **AC-10** — Given tôi render site với brand color `#0ea5e9` (sky blue), when inspect text elements, then text-primary = brand-tinted dark (NOT pure `#000000`), contrast ratio ≥ 4.5:1
- [ ] **AC-11** — Given CTA button trên hero section, when inspect CSS, then background dùng `var(--accent)` (10% rule), hover dùng `var(--accent-hover)`
- [ ] **AC-12** — Given `pnpm tsc --noEmit` và `pnpm build`, when run after codemod, then cả 2 pass 0 errors

### US-F01D-04: Content Validation Catches Generic Labels
```
As a SME owner,
I want the system to prevent "Submit" buttons, "Welcome to our website" headlines, and carousels with 1 item,
So that my site has professional copy out of the box.
```

**Acceptance Criteria:**
- [ ] **AC-13** — Given AI gen block với `ctaLabel: "Submit"`, when `sanitizeBlockData()` chạy, then warning logged với prefix `[design-quality]`, label auto-replaced (suggest: "Get Started" / "Contact Us")
- [ ] **AC-14** — Given template builder gen testimonials block với variant=`carousel` và `items.length = 1`, when `buildBlockFromSpec()` chạy, then variant fallback sang `simple` (via existing `VARIANT_MIN_CONTENT`)
- [ ] **AC-15** — Given AI gen hero với headline 15 words, when validation chạy, then warning logged, headline truncated/fix
- [ ] **AC-16** — Given page generate có block order `[nav, hero, stats, features, footer]`, when ORDERING_RULES validate, then warning "features must come before stats"
- [ ] **AC-17** — Given AI gen block với `ctaLabel: "Gửi"` và `language: "vi"`, when validation chạy, then reject + suggest alternative từ Vietnamese whitelist (`"Đăng ký ngay"`, `"Liên hệ"`)
- [ ] **AC-18** — Given existing Payload site có `theme.fontPairingId = "modern-clean"` (legacy Inter+Inter), when `scripts/migrate-legacy-font-pairings.mjs --apply` chạy, then pairing update sang `startup-vibe` + log entry created; dry-run mode chỉ in log không update
- [ ] **AC-19** — Given AI return 2 blocks sau validation (dưới MIN_BLOCKS_PER_PAGE=3), when page build, then fallback skeleton thêm nav + footer tự động

---

## 8. UI/UX Requirements

- **No new user-facing screens** — chỉ thay đổi render quality của block components hiện có.
- **Visual spec:** `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` đã có baseline. PRD này implement các rules từ doc đó.
- **Key visual changes:**
  1. Consistent section padding (no more random `py-16/py-20/py-24`)
  2. Typography scale visible ở hierarchy: display > h1 > h2 > h3 > body > small
  3. CTAs pop out (10% accent rule) vs content (60% neutral)
  4. Font pairs có contrast axis rõ (serif+sans, geometric+humanist)
  5. Min content fallback: carousel với 1 item → simple variant (không còn "carousel trống")

---

## 9. Technical Notes

### API Changes
- **None.** `/api/ai/generate-site` signature giữ nguyên.

### Database Changes
- **None.** Block schema không thay đổi, Payload collections giữ nguyên.

### Code Architecture Changes

**NEW files:**
```
src/lib/design-tokens.ts              # SPACING, RADIUS, SHADOW, ICON_SIZE, etc.
src/lib/theme/color-utils.ts          # tintNeutral, checkContrast, generatePalette
src/lib/ai/content-rules.ts           # CONTENT_RULES, BLOCKED_CONTENT, validateBlockContent
src/blocks/shared/SectionWrapper.tsx  # Replaces 131 hardcoded containers
src/blocks/shared/Typography.tsx      # Heading, Body, Caption components
scripts/codemod-css-vars.mjs          # Rename 496 usages
docs/standards/DESIGN_TOKENS.md       # Reference
```

**EDITED files:**
```
src/lib/theme/resolve.ts              # CSS_VARS rename, semantic vars, font validation
src/lib/fonts/pairings.ts             # BLOCKED_PAIRINGS, validateFontPairing, fix 2 pairings
src/components/AppShell.tsx           # Import 9+ Google Fonts
src/app/globals.css                   # Rename root vars
tailwind.config.js                    # Update brand color refs
src/lib/ai/openai-generator.ts        # Wire validation at line 529
src/lib/ai/template-composer.ts       # Wire validation at buildBlockFromSpec line 963
src/blocks/**/*.tsx                   # 47 blocks (Batch A/B/C parallel)
```

### Type Definitions (reused from scout)

```typescript
// src/lib/design-tokens.ts — NEW
export const SPACING = { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px', '4xl': '80px', '5xl': '96px', '6xl': '120px' } as const
export const RADIUS = { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px', '2xl': '24px', full: '9999px' } as const
export const SECTION_PADDING = { compact: 'py-12 md:py-16', default: 'py-16 md:py-24', relaxed: 'py-20 md:py-32', hero: 'py-24 md:py-32 lg:py-40' } as const
export const CONTAINER = { narrow: 'max-w-3xl', default: 'max-w-6xl', wide: 'max-w-7xl', full: 'max-w-full' } as const

// src/lib/fonts/pairings.ts — APPEND
export const BLOCKED_PAIRINGS: Array<[string, string]> = [['Inter', 'Inter'], ['DM Sans', 'DM Sans'], ['Poppins', 'Poppins'], ['Outfit', 'Outfit']]
export function validateFontPairing(p: FontPairing): { valid: boolean; reason?: string }

// src/lib/ai/content-rules.ts — NEW
export const CONTENT_RULES = {
  hero: { headlineMaxWords: 10, headlineMinWords: 3, subheadlineMaxWords: 25 },
  cta: { labelMaxWords: 5, blockedLabels: ['Submit', 'Click Here', 'Buy Now', 'Learn More'] },
  testimonial: { quoteMaxChars: 200 },
  feature: { descriptionMaxChars: 150, titleMaxWords: 6 },
} as const
export const BLOCKED_CONTENT: string[] = ['Welcome to our website', 'Lorem ipsum', 'Quality service', ...]
export function validateBlockContent(block: Record<string, unknown>): { valid: boolean; warnings: string[]; fixes: Record<string, unknown> }
```

### Migration / Rename Strategy

Codemod `scripts/codemod-css-vars.mjs` — regex replace với order matters (longest match first):

```
--brand-primary-rgb      → --accent-rgb
--brand-primary          → --accent
--brand-secondary-rgb    → --surface-secondary-rgb
--brand-secondary        → --surface-secondary
--brand-accent-rgb       → --accent-hover-rgb
--brand-accent           → --accent-hover
CSS_VARS.primaryRgb      → CSS_VARS.accentRgb
CSS_VARS.primary         → CSS_VARS.accent
CSS_VARS.secondary       → CSS_VARS.surfaceSecondary
...
```

**Verification gates:**
1. `rg "brand-primary|brand-secondary" src/` = 0 matches
2. `pnpm tsc --noEmit` pass
3. `pnpm build` pass
4. Visual diff 5 sample sites (manual screenshot)

---

## 10. Dependencies

- **Blocked by:** F01-variety Phase 02 + 03 (system prompt + sanitizer) — ✅ merged at commit `beffa9b`
- **Blocks:** None — F01-variety Phase 04 + 05 (fallback + composer variety) có thể ship independently
- **Depends on packages:**
  - `next/font/google` (already installed) — load 9+ missing fonts
  - No new npm packages
- **Codebase dependencies:**
  - Plan A merged state (branch `feat/F01-ai-gen-variety-fix`) — content validation wires vào sanitizer Plan A đã refactor

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **R1: Codemod miss dynamic CSS var concat strings** — 473 inline `style={{}}` props có thể concat strings (`` `var(${name})` ``), regex không match | High | High | (1) Extensive regex patterns cover `` `var(--brand-`, `"var(--brand-`, `'var(--brand-`; (2) TypeScript errors catch CSS_VARS object miss; (3) Manual grep verification gate; (4) Visual diff 5 sample sites; (5) Rollback plan: revert codemod commit riêng |
| **R2: Parallel Phase 05 agents tạo inconsistency** — 3 subagents refactor 47 blocks, mỗi agent diễn giải shared checklist khác nhau | Medium | High | (1) Shared `phase-05-checklist.md` với BEFORE/AFTER canonical example; (2) Main agent cross-review pass sau 3 batches; (3) Pre-commit lint check enforce SectionWrapper usage; (4) Visual regression 142 variants |
| **R3: 9+ Google Fonts bundle bloat** — load hết 20 pairings fonts làm FCP chậm | Medium | Medium | (1) `display: 'swap'` cho tất cả; (2) Bundle size gate ≤ 500KB delta; (3) Fallback: lazy dynamic import theo pairing chọn nếu vượt threshold; (4) Monitor FCP với Lighthouse CI |
| **R4: Content validation auto-fix phá vỡ block schema** — warning + auto-fix có thể set field về undefined/empty | Low | High | (1) `fixes` chỉ replace value, không delete field; (2) Fixes qua Zod schema validation sau; (3) Test suite cover: blocked CTA → valid replacement; (4) Production chỉ log warning, không throw |
| **R5: Backward compat break** — sites đã generate dùng raw `--brand-primary` trong saved HTML/CSS | Low | Medium | (1) Fallback CSS vars trong `generateThemeCSS()` catch block giữ legacy names alongside semantic; (2) Test: load 3 existing production sites sau migration |

---

## 12. Testing Strategy (link to QA)

Full test plan: `docs/qa/F01-design-quality.md` (to be generated)

**High-level coverage:**
- **Unit tests:**
  - `validateFontPairing()` — same-font, blocked, valid cases (~5 TCs)
  - `checkContrast()` — WCAG AA/AAA boundary (~6 TCs)
  - `validateBlockContent()` — headline length, blocked CTAs, min content (~10 TCs)
  - `tintNeutral()` — color math correctness (~3 TCs)
- **Integration tests:**
  - AI path: `generateSiteWithAI()` → validated content in output (~5 TCs)
  - Template path: `composeFromBlueprint()` → validated content in output (~5 TCs)
- **Visual regression:**
  - Screenshot 142 variants BEFORE/AFTER refactor
  - Diff tolerance ≤ 2% per variant
- **Accessibility:**
  - Axe-core scan 5 sample sites (hero, features, testimonials, contact, footer)
  - WCAG AA contrast pass rate 100%

---

## 13. Timeline

| Milestone | Owner | ETA |
|-----------|-------|-----|
| PRD approved | PM | 2026-04-13 |
| Phase 01 (tokens + SectionWrapper) | Dev | 2026-04-14 |
| Phase 02 (typography + fonts) | Dev | 2026-04-15 |
| Phase 03 (color rename codemod) | Dev | 2026-04-16 |
| Phase 04 (content validation) | Dev | 2026-04-17 |
| Phase 05 (47 blocks parallel) | Dev | 2026-04-19 |
| QC complete | QC | 2026-04-20 |
| Merge staging | DevOps | 2026-04-21 |

---

## 14. Open Questions (Resolved 2026-04-13)

| Question | Owner | Answer |
|----------|-------|--------|
| Bundle size threshold | Dev + PM | **Ship full via `next/font display: swap`, monitor Lighthouse post-deploy.** Không over-engineer. Nếu FCP regress > 100ms → optimize sau (Phase 2) |
| Fix `modern-clean` pairing | Design + PM | **Inter + Lora** (sans heading + serif body, contrast axis preserved). Lora đã có trong `editorial` pairing — không thêm font mới vào bundle |
| Visual regression tool | QC | **Playwright + pixelmatch** — self-hosted, free, git-tracked baselines, 2% tolerance. Dùng sẵn Playwright trong repo, thêm `pixelmatch` npm (~5KB) |
| Content validation error mode | Dev + PM | **Log warning + auto-fix silent trong prod.** Dev/staging: verbose log. Không bao giờ throw — tránh block AI generation pipeline |

---

## 15. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-13 | PM | Initial draft — companion to F01-variety |

---

## Appendix: Story Traceability Matrix

| Story | FRs | ACs | Risks |
|-------|-----|-----|-------|
| US-F01D-01 (Tokens) | FR-01, FR-02, FR-13 | AC-01, AC-02, AC-03, AC-04 | R2 |
| US-F01D-02 (Typography) | FR-03, FR-04, FR-05, FR-17 | AC-05, AC-06, AC-07, AC-08, AC-18 | R3 |
| US-F01D-03 (Color) | FR-06, FR-07, FR-08 | AC-09, AC-10, AC-11, AC-12 | R1, R5 |
| US-F01D-04 (Content) | FR-09, FR-10, FR-11, FR-12, FR-16, FR-18 | AC-13, AC-14, AC-15, AC-16, AC-17, AC-19 | R4 |

## Appendix: Scenario Coverage

Tham khảo `plans/260412-2300-design-quality-rules/reports/scenario-content-visual.md` — 55 scenarios across 8 dimensions (6 Critical / 20 High / 21 Medium / 8 Low). 5 scenarios cần test gap coverage bổ sung:
- Grapheme count edge cases (#55)
- RichText sanitizer + content-rules pipeline order (#10)
- Dark mode semantic var swap (#26)
- Vietnamese font rendering với dấu (#32)
- Idempotency: block validated 2 lần (#22)
