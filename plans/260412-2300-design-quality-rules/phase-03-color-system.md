# Phase 03: Color System (60-30-10)

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (tokens)
- Priority: P1
- Status: pending

## Mục tiêu
Enforce 60-30-10 color distribution, contrast ratio WCAG AA, never pure black, brand-tinted neutrals.

## Key Insights
- Hiện tại: CSS vars `--brand-primary` + `--brand-secondary` — chỉ 2 colors, thiếu semantic roles
- Impeccable: OKLCH color space, tint neutrals toward brand hue (chroma 0.005-0.015)
- Research: 60% neutral surface / 30% secondary / 10% accent (CTA only)
- Never pure #000000 — luôn tint nhẹ theo brand

## Implementation Steps

### 3.1 Expand CSS variable system

Hiện tại trong `src/lib/theme/resolve.ts`:
```
--brand-primary (accent — 10%)
--brand-secondary (secondary — 30%)
```

Cần thêm semantic color roles:
```css
/* Surface colors (60%) */
--surface-primary: /* white or very light brand tint */
--surface-secondary: /* slightly darker, alternate sections */
--surface-card: /* card backgrounds */

/* Text colors */
--text-primary: /* main text — NEVER pure black */
--text-secondary: /* muted text */
--text-inverse: /* text on dark backgrounds */

/* Accent (10% — CTA only) */
--accent: /* = brand-primary, used SPARINGLY */
--accent-hover: /* darker variant */

/* Utility */
--border: /* subtle border color */
--divider: /* section dividers */
```

### 3.2 Tạo `src/lib/theme/color-utils.ts`

```typescript
// Generate brand-tinted neutrals (not pure gray)
export function tintNeutral(brandHex: string, lightness: number): string {
  // Convert brand to HSL, keep hue, set very low saturation (5-10%), set lightness
}

// Check WCAG AA contrast ratio (min 4.5:1 for text, 3:1 for large text)
export function checkContrast(foreground: string, background: string): {
  ratio: number
  passAA: boolean
  passAALarge: boolean
}

// Generate full color palette from primary + secondary
export function generatePalette(primary: string, secondary: string, mode: 'light' | 'dark'): {
  surface: { primary: string; secondary: string; card: string }
  text: { primary: string; secondary: string; inverse: string }
  accent: string
  accentHover: string
  border: string
}
```

### 3.3 Update `resolve.ts` theme resolver

- Input: primaryColor + secondaryColor + colorMode
- Output: full semantic palette (surface, text, accent, border)
- Neutrals tinted toward brand hue (not pure gray)
- Text color: brand-tinted dark (never #000000)

### 3.4 Anti-pattern validation

```typescript
// Cấm cụ thể
const BLOCKED_COLORS = {
  purpleGradient: ['#7c3aed', '#6366f1'], // AI slop #1
  pureBlack: '#000000',
  pureWhite: '#ffffff', // allow nhưng prefer tinted
}

export function validateThemeColors(theme: ThemeConfig): string[] {
  const warnings: string[] = []
  if (theme.textColor === '#000000') warnings.push('Pure black text — use brand-tinted dark instead')
  // ... more checks
  return warnings
}
```

## Todo
- [ ] Expand CSS variables với semantic roles (surface, text, accent, border)
- [ ] Tạo `color-utils.ts` với tintNeutral, checkContrast, generatePalette
- [ ] Update resolve.ts để generate full palette
- [ ] Thêm color validation (blocked patterns, contrast checks)
- [ ] Audit blocks: thay hardcoded colors bằng semantic CSS vars

## Success Criteria
- [ ] Mỗi block dùng semantic color vars (--surface-*, --text-*, --accent)
- [ ] Text luôn có contrast >= 4.5:1 vs background
- [ ] CTA buttons dùng --accent (10% rule)
- [ ] Không có pure #000000 trong rendered output
- [ ] Neutrals có brand tint nhẹ
