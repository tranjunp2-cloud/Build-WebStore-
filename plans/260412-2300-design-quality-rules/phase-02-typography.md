# Phase 02: Typography Scale

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (design tokens)
- Priority: P0
- Status: pending
- Scout ref: `scout/scout-design-quality-scan.md` section 2

## Mục tiêu
Enforce type scale nhất quán, font pairing có contrast, body text luôn >= 16px.

## Key Insights
- Hiện tại: heading/body font sizes vary arbitrarily (text-3xl, text-5xl, text-sm...)
- Chuẩn: modular scale ratio 1.25 (minor third) → 5 bước rõ ràng
- Impeccable: cấm "reflex fonts" (fonts AI luôn chọn vì training data bias)
- Research: heading + body phải có contrast axis (serif+sans, geometric+humanist)

## Existing Infrastructure (scout findings — KHÔNG tạo lại)
- `src/lib/fonts/pairings.ts` — đã có 15+ font pairings với `FontPairing` type (id, name, category, headingFont, bodyFont, headingWeight, bodyWeight, description)
- `src/lib/ai/openai-generator.ts` lines 88-89 — `ALLOWED_HEADING_FONTS` + `ALLOWED_BODY_FONTS` whitelist
- `src/lib/ai/theme-presets.ts` — 55 industry presets consume pairing IDs
- `src/components/AppShell.tsx` — loads Inter + Outfit qua `next/font`, inject `--font-inter`, `--font-outfit`
- `src/lib/theme/resolve.ts` — `CSS_VARS.fontHeading`, `CSS_VARS.fontBody`

### Gaps cần fix
- **BLOCKED_PAIRINGS validator** chưa có (same-font pairs như Inter+Inter không bị chặn)
- **Google Fonts thiếu ở AppShell**: Playfair Display, Lora, Space Grotesk, DM Sans, Poppins, Raleway, Lato, Open Sans, Nunito — các pair trong `pairings.ts` ref fonts chưa load
- **Contrast axis enforcement** chưa check khi validate pairing

## Implementation Steps

### 2.1 Tạo Typography Scale Constants

```typescript
// src/lib/design-tokens.ts (thêm vào file Phase 01)

// Type scale — modular scale 1.25 (minor third)
export const TYPE_SCALE = {
  // Display — hero headlines only
  display: 'text-4xl md:text-5xl lg:text-6xl',     // 36-60px
  // H1 — page titles
  h1: 'text-3xl md:text-4xl lg:text-5xl',           // 30-48px
  // H2 — section titles
  h2: 'text-2xl md:text-3xl',                        // 24-30px
  // H3 — card titles, subsection
  h3: 'text-xl md:text-2xl',                          // 20-24px
  // H4 — small titles
  h4: 'text-lg md:text-xl',                           // 18-20px
  // Body — paragraphs (NEVER below 16px)
  body: 'text-base',                                   // 16px
  // Body large — emphasis paragraphs
  bodyLg: 'text-lg',                                   // 18px
  // Small — captions, meta
  small: 'text-sm',                                    // 14px
} as const

// Line heights per type level
export const LINE_HEIGHT = {
  display: 'leading-[1.1]',
  heading: 'leading-[1.2]',
  body: 'leading-[1.6]',
  small: 'leading-[1.4]',
} as const

// Font weight
export const FONT_WEIGHT = {
  heading: 'font-bold',      // 700
  subheading: 'font-semibold', // 600
  body: 'font-normal',       // 400
  emphasis: 'font-medium',   // 500
} as const

// Max line width for readability
export const MAX_PROSE = 'max-w-prose' // ~65ch — optimal readability
```

**KHÔNG redefine FONT_PAIRINGS** — dùng `src/lib/fonts/pairings.ts` hiện có (15+ pairings).

### 2.1b Thêm BLOCKED_PAIRINGS validator vào `src/lib/fonts/pairings.ts`

```typescript
// src/lib/fonts/pairings.ts — append

// Cấm same-font pairs (no contrast axis, looks generic)
export const BLOCKED_PAIRINGS: Array<[string, string]> = [
  ['Inter', 'Inter'],
  ['DM Sans', 'DM Sans'],
  ['Poppins', 'Poppins'],
  ['Outfit', 'Outfit'],
]

export function isBlockedPairing(heading: string, body: string): boolean {
  return BLOCKED_PAIRINGS.some(
    ([h, b]) => h.toLowerCase() === heading.toLowerCase() && b.toLowerCase() === body.toLowerCase()
  )
}

export function validateFontPairing(pairing: FontPairing): { valid: boolean; reason?: string } {
  if (isBlockedPairing(pairing.headingFont, pairing.bodyFont)) {
    return { valid: false, reason: `Blocked pair: ${pairing.headingFont} + ${pairing.bodyFont} — no contrast` }
  }
  if (pairing.headingFont === pairing.bodyFont) {
    return { valid: false, reason: `Same font for heading + body — need contrast axis` }
  }
  return { valid: true }
}
```

### 2.2 Tạo `src/blocks/shared/Typography.tsx`

Headings/text components enforce scale:
```typescript
export function Heading({ level, children }: { level: 1|2|3|4; children: React.ReactNode }) {
  const classes = {
    1: `${TYPE_SCALE.h1} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.heading} font-heading`,
    2: `${TYPE_SCALE.h2} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.heading} font-heading`,
    3: `${TYPE_SCALE.h3} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.subheading} font-heading`,
    4: `${TYPE_SCALE.h4} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.subheading} font-heading`,
  }
  const Tag = `h${level}` as const
  return <Tag className={classes[level]}>{children}</Tag>
}
```

### 2.3 Font pairing validation trong theme resolver

Trong `src/lib/theme/resolve.ts`, call `validateFontPairing()` từ `src/lib/fonts/pairings.ts`:
- Nếu pairing invalid → log warn + fallback về default pair (Outfit + Inter)
- Wire vào `resolveTheme()` trước khi generate CSS

### 2.4 Import missing Google Fonts vào AppShell

`src/components/AppShell.tsx` hiện chỉ load Inter + Outfit. Các pair trong `pairings.ts` reference fonts chưa load → fallback về system fonts.

Thêm `next/font/google` imports cho fonts xuất hiện trong `pairings.ts` (20 pairings, ~25 unique fonts sau fix 2 invalid):
- Playfair Display, Lora, Space Grotesk, Nunito, Nunito Sans, Oswald, Source Sans 3, Cormorant Garamond, Proza Libre, DM Sans, Sora, Work Sans, Raleway, Poppins, Open Sans, Archivo Black, DM Mono, Merriweather, Source Serif 4, Varela Round, Manrope, Karla, Rajdhani, Exo 2, Josefin Sans, Quicksand, Montserrat, Hind

Mỗi font → inject thành CSS var (`--font-playfair`, `--font-lora`, etc.). Theme resolver map pairing → CSS var name.

**Bundle strategy (validated 2026-04-13):** Ship full via `next/font/google` với `display: 'swap'`. Không lazy load cho MVP — over-engineering. Post-deploy monitor Lighthouse FCP:
- Gate: FCP delta ≤ 100ms, bundle delta ≤ 500KB
- Nếu vượt → Phase 2 optimize (lazy dynamic import)
- Monitor via CI Lighthouse check

### 2.5 Fix 2 invalid pairings (validated 2026-04-13)

```typescript
// src/lib/fonts/pairings.ts — EDIT existing entries

// BEFORE:
// { id: 'modern-clean', headingFont: 'Inter', bodyFont: 'Inter', ... } // SAME FONT — VIOLATE
// { id: 'humanist', headingFont: 'DM Sans', bodyFont: 'DM Sans', ... } // SAME FONT — VIOLATE

// AFTER:
{ id: 'modern-clean', name: 'Modern Clean', category: 'modern',
  headingFont: 'Inter', bodyFont: 'Lora',  // sans + serif contrast axis
  headingWeight: 700, bodyWeight: 400,
  description: 'Clean sans heading + elegant serif body, versatile for any modern website' },

{ id: 'humanist', name: 'Humanist', category: 'minimal',
  headingFont: 'DM Sans', bodyFont: 'Karla',  // geometric + humanist contrast
  headingWeight: 700, bodyWeight: 400,
  description: 'Warm minimalism with humanist body touches' },
```

**Note:** Lora đã có trong `editorial` pairing → không thêm font mới vào bundle. Karla đã có trong `artisan` pairing → same.

## Todo
- [ ] Thêm TYPE_SCALE, LINE_HEIGHT, FONT_WEIGHT, MAX_PROSE vào `design-tokens.ts`
- [ ] Thêm `BLOCKED_PAIRINGS` + `validateFontPairing()` vào `src/lib/fonts/pairings.ts`
- [ ] Tạo Typography shared components (`Heading`, `Body`, `Caption`) ở `src/blocks/shared/Typography.tsx`
- [ ] Wire `validateFontPairing()` vào `resolveTheme()` trong `resolve.ts`
- [ ] Import missing Google Fonts vào `AppShell.tsx` (9+ fonts)
- [ ] Map font names → CSS vars trong theme resolver
- [ ] Audit block components: thay text-* classes bằng TYPE_SCALE tokens (overlap với Phase 05)

## Success Criteria
- [ ] Mọi heading dùng TYPE_SCALE constants
- [ ] Body text luôn >= 16px (text-base minimum)
- [ ] Font heading !== font body trong generated themes
- [ ] Blocked pairings bị reject trong validation (test: Inter+Inter → invalid)
- [ ] Tất cả 15 pairings trong `pairings.ts` có fonts loaded (no CSS fallback)
- [ ] Bundle size impact < 500KB sau thêm fonts
