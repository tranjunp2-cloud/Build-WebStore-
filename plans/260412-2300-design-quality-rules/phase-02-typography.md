# Phase 02: Typography Scale

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (design tokens)
- Priority: P0
- Status: pending

## Mục tiêu
Enforce type scale nhất quán, font pairing có contrast, body text luôn >= 16px.

## Key Insights
- Hiện tại: heading/body font sizes vary arbitrarily (text-3xl, text-5xl, text-sm...)
- Chuẩn: modular scale ratio 1.25 (minor third) → 5 bước rõ ràng
- Impeccable: cấm "reflex fonts" (fonts AI luôn chọn vì training data bias)
- Research: heading + body phải có contrast axis (serif+sans, geometric+humanist)

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

// Approved font pairings (high contrast axis)
export const FONT_PAIRINGS = [
  { heading: 'Playfair Display', body: 'Lato', contrast: 'serif + sans' },
  { heading: 'Outfit', body: 'Inter', contrast: 'geometric + neutral' },
  { heading: 'Raleway', body: 'Open Sans', contrast: 'elegant + humanist' },
  { heading: 'DM Sans', body: 'Nunito', contrast: 'geometric + rounded' },
  { heading: 'Poppins', body: 'Inter', contrast: 'geometric + neutral' },
] as const

// BLOCKED font pairings (AI reflex — too common, looks generic)
export const BLOCKED_PAIRINGS = [
  'Inter + Inter',       // same font both → no contrast
  'DM Sans + DM Sans',
  'Poppins + Poppins',
]
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

Trong `src/lib/theme/resolve.ts`, kiểm tra:
- heading !== body (không cùng font)
- Pair không nằm trong BLOCKED_PAIRINGS

## Todo
- [ ] Thêm TYPE_SCALE, LINE_HEIGHT, FONT_WEIGHT vào design-tokens.ts
- [ ] Thêm FONT_PAIRINGS, BLOCKED_PAIRINGS
- [ ] Tạo Typography shared components (Heading, Body, Caption)
- [ ] Validate font pairs trong theme resolver
- [ ] Audit block components: thay text-* classes bằng TYPE_SCALE tokens

## Success Criteria
- [ ] Mọi heading dùng TYPE_SCALE constants
- [ ] Body text luôn >= 16px (text-base minimum)
- [ ] Font heading !== font body trong generated themes
- [ ] Blocked pairings bị reject trong validation
