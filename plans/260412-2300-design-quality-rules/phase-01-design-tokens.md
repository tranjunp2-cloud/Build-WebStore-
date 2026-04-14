# Phase 01: Design Token System

## Context
- Parent: [plan.md](plan.md)
- Priority: P0 — foundation cho tất cả phases sau
- Status: **done** (2026-04-13, commit `5a1a699`)

## Mục tiêu
Tạo closed token layer — tất cả spacing, radius, shadow values đi qua tokens. Block components không hardcode pixel values.

## Key Insights
- Hiện tại mỗi block tự hardcode padding/margin (px-4, py-16, gap-8...) → inconsistent
- v0 Vercel approach: design token registry → AI/components chỉ chọn từ set cố định
- Impeccable: 4pt base grid (4, 8, 12, 16, 24, 32, 48, 64, 96px)

## Implementation Steps

### 1.1 Tạo `src/lib/design-tokens.ts`

```typescript
// Spacing scale (8px base grid — industry standard)
export const SPACING = {
  xs: '4px',    // 0.25rem — tight internal
  sm: '8px',    // 0.5rem — internal padding
  md: '16px',   // 1rem — card padding
  lg: '24px',   // 1.5rem — section internal
  xl: '32px',   // 2rem — component gap
  '2xl': '48px', // 3rem — section gap
  '3xl': '64px', // 4rem — section padding desktop
  '4xl': '80px', // 5rem — large section padding
  '5xl': '96px', // 6rem — hero padding
  '6xl': '120px', // 7.5rem — max section padding
} as const

// Border radius
export const RADIUS = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const

// Shadow presets
export const SHADOW = {
  none: 'none',
  subtle: '0 1px 3px rgba(0,0,0,0.08)',
  medium: '0 4px 12px rgba(0,0,0,0.1)',
  strong: '0 8px 24px rgba(0,0,0,0.12)',
  dramatic: '0 16px 48px rgba(0,0,0,0.16)',
} as const

// Icon sizes (standardized across all blocks)
export const ICON_SIZE = {
  sm: 'w-5 h-5',    // 20px — inline
  md: 'w-8 h-8',    // 32px — feature cards
  lg: 'w-12 h-12',  // 48px — hero icons
  xl: 'w-16 h-16',  // 64px — standalone
} as const

// Section padding (responsive)
export const SECTION_PADDING = {
  compact: 'py-12 md:py-16',      // 48-64px
  default: 'py-16 md:py-24',      // 64-96px
  relaxed: 'py-20 md:py-32',      // 80-128px
  hero: 'py-24 md:py-32 lg:py-40', // 96-160px
} as const

// Container widths
export const CONTAINER = {
  narrow: 'max-w-3xl',    // 768px — blog, text-heavy
  default: 'max-w-6xl',   // 1152px — standard
  wide: 'max-w-7xl',      // 1280px — full layouts
  full: 'max-w-full',     // edge-to-edge
} as const

// Card padding (always less than section spacing)
export const CARD_PADDING = {
  sm: 'p-4',     // 16px
  md: 'p-6',     // 24px
  lg: 'p-8',     // 32px
} as const
```

### 1.2 Tạo Tailwind plugin hoặc extend `tailwind.config.ts`

Thêm custom spacing scale vào Tailwind config để block components dùng class names thay vì hardcoded values.

### 1.3 Tạo `src/blocks/shared/SectionWrapper.tsx`

Wrapper component cho mọi block section:
```typescript
type SectionWrapperProps = {
  padding?: keyof typeof SECTION_PADDING
  container?: keyof typeof CONTAINER
  background?: 'default' | 'alternate' | 'accent' | 'dark'
  children: React.ReactNode
}
```

- Tự động alternate background (white → light gray → white)
- Enforce consistent container width
- Apply responsive padding

## Todo
- [x] Tạo `src/lib/design-tokens.ts` với all token constants
- [x] Tạo `src/blocks/shared/SectionWrapper.tsx`
- [ ] ~~Update `tailwind.config.ts` extend spacing~~ — **SKIPPED**, SectionWrapper dùng existing Tailwind classes đủ cho Phase 05 refactor. Có thể add sau nếu cần.
- [x] Document tokens trong `docs/standards/DESIGN_TOKENS.md`
- [x] Unit tests (25 tests pass, vượt kế hoạch 4 TCs)

## Success Criteria
- [x] Tất cả spacing values có token constant
- [x] SectionWrapper available cho block components
- [x] Token file exportable cho cả code và docs

## Implementation Notes (2026-04-13)

**Commit:** `5a1a699` — `feat(f01): add design tokens and section wrapper (plan b phase 01)`

**Extras vượt kế hoạch gốc:**
- `TOUCH_TARGET` token — WCAG 2.5.5 minimum (44/48/56px) cho CTA buttons
- `INNER_PADDING` — responsive horizontal gutter `px-6 md:px-8 lg:px-12` (fix self-review: px-6 hardcoded không responsive)
- `SECTION_BACKGROUND.transparent` — cho hero blocks với decorative backgrounds
- TypeScript types: `SpacingToken`, `RadiusToken`, `ShadowToken`, etc. cho autocomplete
- `id` prop forward qua HTML attrs spread — hỗ trợ anchor links
- `as` polymorphic prop — hỗ trợ `<header>`/`<footer>` wrapper

**Self-review fixes (pre-commit):**
1. `SECTION_BACKGROUND` fallback chain đơn giản hóa (dùng legacy `--surface-1/2/3`, Phase 03 rename sau)
2. `SHADOW` convert từ raw CSS string → Tailwind arbitrary value classes (`shadow-[0_1px_3px_rgba(0,0,0,0.08)]`) — consistent với `ICON_SIZE`
3. `px-6` hardcoded → `INNER_PADDING` responsive token
4. Test coverage: 15 → 25 tests (thêm accent/transparent bg, innerClassName, hero padding, as=header, id forward, token invariants)

**Không thay đổi:**
- 47 block components (Phase 05 refactor)
- `tailwind.config.js` (không cần vì dùng Tailwind classes có sẵn)
- Existing `globals.css` (Phase 03 rename sau)

**Test results:**
- Unit: 25/25 pass
- Plan A regression: 41/41 pass
- TypeScript: 0 errors
