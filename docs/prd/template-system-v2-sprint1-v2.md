# PRD: Template System v2 — Sprint 1: Design Token Foundation

**Feature ID:** F-TMPL-V2-S1
**Version:** 2.0
**Author:** Claude AI (PM)
**Date:** 2026-04-05
**Status:** Draft
**Priority:** P0 — Foundation cho Sprint 2-4
**Effort:** ~5 developer days (3 phases)
**Plan:** [`plans/260405-master-template-system-v2/plan.md`](../../plans/260405-master-template-system-v2/plan.md)

---

## 1. Problem Statement

### Ai bị ảnh hưởng?
End users (Malaysia SMBs) chọn template hoặc AI generate website.

### Vấn đề gì?
Mọi website generated đều trông **giống nhau** — bất kể chọn "Restaurant", "Tech", hay "Beauty". User cảm thấy sản phẩm thiếu chuyên nghiệp, không đáng đầu tư.

### Root Causes (từ codebase analysis):

**1. ThemeConfig chỉ có 2 colors:**
```typescript
// src/blocks/types.ts — hiện tại
type ThemeConfig = {
    primaryColor: string      // '#0ea5e9' — chỉ CÓ 1 màu thật sự
    secondaryColor: string    // '#d946ef' — hiếm khi dùng
    backgroundColor: string   // '#09090b' — luôn đen
    fontHeading: string       // Random pick
    fontBody: string          // Random pick
    colorMode: 'light' | 'dark' // Luôn dark
}
```
→ Website chỉ có 1 màu chủ đạo. Buttons, badges, dividers, backgrounds đều cùng `primaryColor`.

**2. SiteRenderer inject chỉ 4 CSS variables:**
```css
/* src/components/site-renderer/SiteRenderer.tsx — hiện tại */
:root {
    --brand-primary: ${primaryColor};
    --brand-secondary: ${secondaryColor};
    --font-heading: '${fontHeading}';
    --font-body: '${fontBody}';
}
```
→ Blocks phải hardcode colors inline (`${pc}10`, `${pc}30`) thay vì dùng semantic tokens.

**3. Blocks dùng inline color manipulation:**
```tsx
// Ví dụ: src/blocks/hero/index.tsx
style={{ background: `${pc}08` }}           // Hardcoded opacity
style={{ boxShadow: `0 8px 30px ${pc}35` }} // Hardcoded shadow
style={{ border: `2px solid ${pc}50` }}      // Hardcoded border
```
→ Không thể thay đổi color scheme mà không sửa từng block.

**4. Font random — không curated:**
AI random chọn từ list: Outfit, Inter, Playfair Display, DM Sans, Poppins, Raleway, Lato, Open Sans, Nunito.
→ Heading + Body font có thể conflict (VD: Playfair Display heading + Nunito body = lệch style).

**5. Không có spacing/radius presets:**
Mọi block hardcode `py-24`, `rounded-2xl` → Restaurant (ấm, generous) và Tech (clean, compact) cùng spacing.

### Impact
- User satisfaction: ~40% nói template "looks professional"
- Template bounce rate: cao — user thử → thấy giống nhau → bỏ
- Competitive gap: Wix avg 7+ variants/block, chúng ta 2.7

---

## 2. Goals & Success Metrics

| Goal | Metric | Current | Target | Đo bằng |
|------|--------|---------|--------|---------|
| Richer visual identity | Color tokens per theme | 3 (primary, secondary, bg) | 7+ | Code audit |
| Professional typography | Font pairings curated | 0 (random pick) | 20 pairs | Config count |
| Spacing diversity | Configurable presets | 0 (hardcoded) | 3 presets | Config count |
| Design consistency | Blocks using CSS vars (not inline) | ~20% | 100% | Code grep |
| Backward compatibility | Existing sites render correctly | N/A | 100% | Regression tests |
| Template differentiation | Visually distinct templates | 1-2 styles | 5+ styles | Manual QA |

---

## 3. User Stories

### US-01: Diverse Color Palette
**As a** SMB owner chọn template restaurant,
**I want** website có bảng màu ấm (nâu, cam, gold) với accent colors cho badges, buttons, backgrounds,
**so that** website toát lên không khí ấm cúng phù hợp nhà hàng — không phải blue generic.

### US-02: Professional Font Pairing
**As a** user tạo website cho spa,
**I want** heading font thanh lịch (serif) kết hợp body font dễ đọc (sans-serif),
**so that** typography tạo cảm giác luxury, relaxing — không phải techy.

### US-03: Industry-Appropriate Spacing
**As a** gym owner,
**I want** website có layout compact, bold, dense — sections sát nhau, text lớn,
**so that** website toát ra năng lượng, không airy/gentle như spa.

### US-04: Consistent Design Across Sections
**As a** user preview website,
**I want** khi tôi đổi primary color, TẤT CẢ sections (hero, features, footer, nav) đều thay đổi ngay,
**so that** website nhìn đồng bộ — không mỗi section 1 kiểu.

### US-05: Backward Compatibility
**As a** existing user đã có website published,
**I want** website cũ (chỉ có 2 colors) vẫn render đúng sau khi hệ thống upgrade,
**so that** tôi không bị break site đã hoạt động.

---

## 4. Functional Requirements

### Phase 1.1: Design Token Expansion (2d)

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| FR-01 | Thêm `accentColor` vào ThemeConfig — dùng cho badges, labels, section accents | Must Have | Fallback: derive from primary (lighten 20%) |
| FR-02 | Thêm `surfaceColor` vào ThemeConfig — dùng cho card backgrounds, input backgrounds | Must Have | Fallback: dark mode `#1e293b`, light mode `#f8fafc` |
| FR-03 | Thêm `mutedColor` vào ThemeConfig — dùng cho subtle text, borders, dividers | Must Have | Fallback: `#94a3b8` |
| FR-04 | Thêm `fontAccent` vào ThemeConfig — 3rd font cho quotes, prices, decorative labels | Should Have | Fallback: same as fontHeading |
| FR-05 | Thêm `spacingPreset` vào ThemeConfig: `'compact'` \| `'default'` \| `'generous'` | Must Have | Maps to: compact=py-12, default=py-20, generous=py-32 |
| FR-06 | Thêm `borderRadius` preset: `'sharp'` \| `'subtle'` \| `'rounded'` \| `'soft'` \| `'pill'` | Must Have | Maps to: 0/4/8/16/9999 px |
| FR-07 | Update ThemeConfigSchema (Zod) — tất cả fields mới PHẢI optional với defaults | Must Have | Backward compat |
| FR-08 | SiteRenderer inject 14 CSS variables thay vì 4 hiện tại | Must Have | See AC-04 for full list |

### Phase 1.2: Font Pairing System (1d)

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| FR-09 | Tạo `src/lib/design/font-pairings.ts` — 20 curated pairings | Must Have | Each: heading + body + accent + mood + best-for |
| FR-10 | Mỗi pairing có metadata: name, mood, best-for industries | Must Have | VD: "Elegant Serif" → Playfair + Inter + Cormorant → spa, restaurant |
| FR-11 | AI system prompt chọn từ 20 pairings thay vì random pick | Must Have | Based on industry → mood → pairing |
| FR-12 | GoogleFontsLoader load 3 fonts (heading + body + accent) thay vì 2 | Must Have | |
| FR-13 | Font pairings có preview function cho UI (nếu cần) | Nice to Have | Return preview text with fonts applied |

### Phase 1.3: Block Token Migration (2d)

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| FR-14 | Migrate 38 blocks: thay tất cả `${pc}` inline → `var(--color-primary)` | Must Have | Regex: `\$\{pc\}` → CSS var |
| FR-15 | Migrate hardcoded opacities: `${pc}10` → `var(--color-surface)` | Must Have | Không dùng hex+opacity hack |
| FR-16 | Migrate hardcoded spacing: `py-24` → `var(--spacing-section)` | Should Have | Or Tailwind class switching by preset |
| FR-17 | Migrate hardcoded border-radius: `rounded-2xl` → `var(--radius)` | Should Have | |
| FR-18 | Tạo shared utility: `getSpacingClass(preset)` → returns Tailwind class | Should Have | compact→'py-12', default→'py-20', generous→'py-32' |
| FR-19 | Update seed-templates.ts: all templates dùng full ThemeConfig mới | Must Have | |
| FR-20 | Update AI generate-site: output ThemeConfig với 7 colors + spacing + radius | Must Have | |

---

## 5. Acceptance Criteria

| ID | Criteria | Type |
|----|----------|------|
| AC-01 | `ThemeConfig` type trong `src/blocks/types.ts` có 7 color fields: primaryColor, secondaryColor, accentColor, surfaceColor, surfaceDarkColor (nếu cần), mutedColor, backgroundColor | Unit |
| AC-02 | `ThemeConfig` có `spacingPreset`: `'compact'` \| `'default'` \| `'generous'` với default `'default'` | Unit |
| AC-03 | `ThemeConfig` có `borderRadius`: `'sharp'` \| `'subtle'` \| `'rounded'` \| `'soft'` \| `'pill'` với default `'rounded'` | Unit |
| AC-04 | `SiteRenderer` inject 14 CSS variables: `--color-primary`, `--color-secondary`, `--color-accent`, `--color-surface`, `--color-muted`, `--color-bg`, `--font-heading`, `--font-body`, `--font-accent`, `--radius`, `--spacing-section`, `--spacing-gap`, `--spacing-block`, `--color-text` | Integration |
| AC-05 | Existing site với chỉ `{primaryColor: '#0ea5e9', secondaryColor: '#d946ef'}` render đúng — SiteRenderer auto-derive: accentColor=lighten(primary,20%), surfaceColor='#1e293b', mutedColor='#94a3b8' | Integration |
| AC-06 | `src/lib/design/font-pairings.ts` export array 20+ pairings, mỗi cái có: id, name, heading, body, accent, mood, bestFor[] | Unit |
| AC-07 | AI generate-site trả response với ThemeConfig chứa 7 colors + fontAccent + spacingPreset + borderRadius | Integration |
| AC-08 | AI system prompt chọn font từ pairings list (không free-form random) | Integration |
| AC-09 | Grep `\$\{pc\}` trong src/blocks/ trả 0 matches (tất cả migrated sang CSS vars) | Code audit |
| AC-10 | Grep `\$\{theme\.primaryColor\}` trong src/blocks/ trả 0 matches | Code audit |
| AC-11 | Template "Restaurant" có colors warm (#8B4513 primary, #D4A76A accent) — visually different từ "Tech" (#0ea5e9 primary, #6366f1 accent) | Manual QA |
| AC-12 | Spacing preset `compact` → section padding ~3rem. `generous` → section padding ~8rem. Visually different. | Manual QA |
| AC-13 | BorderRadius `sharp` → corners 0px. `pill` → corners 9999px. Cards/buttons reflect correctly. | Manual QA |
| AC-14 | `npx tsc --noEmit` — 0 errors sau migration | CI |
| AC-15 | `npx vitest run` — 0 regressions, all existing tests pass | CI |
| AC-16 | GoogleFontsLoader loads 3 fonts (heading + body + accent) khi fontAccent khác fontHeading | Integration |
| AC-17 | Seed templates API (`POST /api/templates/seed`) tạo templates với full ThemeConfig mới | Integration |

---

## 6. Non-Functional Requirements

| ID | Requirement | Target | Đo bằng |
|----|------------|--------|---------|
| NFR-01 | Backward compat — existing sites không break | 100% | Regression tests + manual QA published sites |
| NFR-02 | CSS variable injection time | < 1ms | Performance profiling |
| NFR-03 | Block render time | No regression (< 50ms per block) | Lighthouse |
| NFR-04 | Bundle size impact | < 5KB increase | `next build` size comparison |
| NFR-05 | Font loading | No FOUT, lazy load below-fold fonts | Manual QA |
| NFR-06 | TypeScript strict | 0 errors, no `any` type added | `tsc --noEmit` |
| NFR-07 | Token naming convention | Consistent `--color-*`, `--font-*`, `--spacing-*`, `--radius` | Code review |

---

## 7. Out of Scope (Sprint 1)

| Item | Thuộc Sprint | Lý do defer |
|------|-------------|------------|
| New block variants (hero 12, features 10...) | Sprint 2 | Cần foundation tokens trước |
| Industry-specific blocks (booking, schedule, menu) | Sprint 3 | Cần tokens + variants trước |
| Template composer + 50 templates | Sprint 3 | Cần blocks ready trước |
| UX bugs (generation timeout, error messages) | Sprint 4 | Không block template quality |
| Template picker redesign | Sprint 4 | UI change, không block foundation |
| Light mode support | Future v3 | Scope quá lớn, dark mode priority |
| Theme editor UI (color picker cho 6 colors) | Future | Nice-to-have, AI auto-pick first |
| CSS-in-JS migration (Tailwind → CSS Modules) | Never | Tailwind works fine |

---

## 8. Data Model Changes

### ThemeConfig (src/blocks/types.ts)

```typescript
// ─── BEFORE ──────────────────────────────────
export type ThemeConfig = {
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    fontHeading: string
    fontBody: string
    colorMode: 'light' | 'dark'
}

// ─── AFTER ───────────────────────────────────
export type ThemeConfig = {
    // Colors — 7 tokens (4 new, all optional for backward compat)
    primaryColor: string           // Main brand — buttons, links, accents
    secondaryColor: string         // Gradient pair — hover states, gradients
    backgroundColor: string        // Page background
    accentColor?: string           // NEW — Badges, labels, decorative highlights
    surfaceColor?: string          // NEW — Card/section backgrounds
    mutedColor?: string            // NEW — Subtle text, borders, dividers

    // Typography — 3 fonts (1 new)
    fontHeading: string            // Headings (h1-h4)
    fontBody: string               // Body text, paragraphs
    fontAccent?: string            // NEW — Quotes, prices, section labels

    // Layout — 2 new presets
    colorMode: 'light' | 'dark'
    spacingPreset?: 'compact' | 'default' | 'generous'  // NEW
    borderRadius?: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill' // NEW
}
```

### CSS Variables (SiteRenderer injection)

```css
/* ─── BEFORE (4 vars) ─── */
:root {
    --brand-primary: ${primaryColor};
    --brand-secondary: ${secondaryColor};
    --font-heading: '${fontHeading}';
    --font-body: '${fontBody}';
}

/* ─── AFTER (14 vars) ─── */
:root {
    /* Colors */
    --color-primary: ${primaryColor};
    --color-secondary: ${secondaryColor};
    --color-accent: ${accentColor ?? deriveAccent(primaryColor)};
    --color-surface: ${surfaceColor ?? (dark ? '#1e293b' : '#f8fafc')};
    --color-muted: ${mutedColor ?? '#94a3b8'};
    --color-bg: ${backgroundColor};
    --color-text: ${dark ? '#fafafa' : '#09090b'};

    /* Typography */
    --font-heading: '${fontHeading}', sans-serif;
    --font-body: '${fontBody}', sans-serif;
    --font-accent: '${fontAccent ?? fontHeading}', serif;

    /* Layout */
    --radius: ${radiusMap[borderRadius ?? 'rounded']}px;
    --spacing-section: ${spacingMap[spacingPreset ?? 'default']};
    --spacing-gap: ${gapMap[spacingPreset ?? 'default']};
    --spacing-block: ${blockMap[spacingPreset ?? 'default']};
}
```

### Database: NO migration needed
- Sites.theme is JSON field — new optional fields merge automatically
- Templates.defaultTheme same — JSON field
- Payload CMS handles JSON fields dynamically

### Font Pairings (NEW file)

```typescript
// src/lib/design/font-pairings.ts
export type FontPairing = {
    id: string
    name: string            // "Elegant Serif"
    heading: string         // "Playfair Display"
    body: string            // "Inter"
    accent: string          // "Cormorant Garamond"
    mood: string            // "elegant, luxurious, classic"
    bestFor: string[]       // ["restaurant", "beauty", "realestate"]
    weights: {
        heading: number[]   // [400, 700]
        body: number[]      // [400, 500]
        accent: number[]    // [400, 600]
    }
}

export const FONT_PAIRINGS: FontPairing[] = [
    // 20 pairings...
]
```

---

## 9. Dependencies

### Blocked by
- Nothing — Sprint 1 has no blockers

### Blocks
- **Sprint 2** (block variants) — needs design tokens as foundation
- **Sprint 3** (industry blocks + templates) — needs tokens + font pairings

### External
- Google Fonts API (existing, no changes)
- OpenAI API (existing, prompt update only)

---

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ThemeConfig                               │
│  { primaryColor, secondaryColor, accentColor, surfaceColor,     │
│    mutedColor, backgroundColor, fontHeading, fontBody,          │
│    fontAccent, colorMode, spacingPreset, borderRadius }         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
            ┌─────────────▼──────────────┐
            │       SiteRenderer          │
            │  Derives missing tokens:    │
            │  accent = lighten(primary)  │
            │  surface = dark ? #1e293b   │
            │  muted = #94a3b8           │
            │                             │
            │  Injects 14 CSS variables   │
            │  into <div style="...">     │
            └─────────────┬──────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   ┌─────────┐     ┌──────────┐     ┌──────────┐
   │ Block A  │     │ Block B   │     │ Block C   │
   │ uses:    │     │ uses:     │     │ uses:     │
   │ var(--   │     │ var(--    │     │ var(--    │
   │ color-   │     │ color-    │     │ spacing-  │
   │ primary) │     │ accent)   │     │ section)  │
   └─────────┘     └──────────┘     └──────────┘

   ALL 38 blocks use CSS variables
   NO inline ${pc} or hardcoded values
```

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token migration breaks existing blocks | Medium | High | AC-14, AC-15: typecheck + test suite |
| Existing published sites look different | Medium | Critical | AC-05: fallback derive missing tokens |
| AI generates invalid color values | Low | Medium | Zod validation + hex regex |
| Font accent loading delays page | Low | Low | Lazy load, font-display: swap |
| 38 blocks × manual migration = tedious | High | Low | Regex batch + incremental commits |
