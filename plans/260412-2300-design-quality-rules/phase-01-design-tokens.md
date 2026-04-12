# Phase 01: Design Token System

## Context
- Parent: [plan.md](plan.md)
- Priority: P0 — foundation cho tất cả phases sau
- Status: pending

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
- [ ] Tạo `src/lib/design-tokens.ts` với all token constants
- [ ] Tạo `src/blocks/shared/SectionWrapper.tsx`
- [ ] Update `tailwind.config.ts` extend spacing
- [ ] Document tokens trong `docs/standards/DESIGN_TOKENS.md`

## Success Criteria
- [ ] Tất cả spacing values có token constant
- [ ] SectionWrapper available cho block components
- [ ] Token file exportable cho cả code và docs
