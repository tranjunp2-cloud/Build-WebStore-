# Phase 02 — Design Token Adoption in Blocks

## Context
**ThemeConfig DA CO** 6 colors + spacing + radius + shadow:
```ts
// src/blocks/types.ts — ThemeConfig
primaryColor, secondaryColor, accentColor, surfaceColor, textColor, mutedColor
spacingPreset: 'compact' | 'default' | 'relaxed'
borderRadius: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill'
shadowPreset: 'none' | 'subtle' | 'medium' | 'dramatic'
```

**theme-presets.ts DA CO** spacing/radius/shadow per preset (55 presets).

**resolve.ts DA CO** CSS vars:
```ts
// src/lib/theme/resolve.ts
SPACING_PRESETS → --spacing-xs/sm/md/lg/xl/2xl/section
RADIUS_PRESETS → --radius-sm/md/lg/full
SHADOW_PRESETS → --shadow-sm/md/lg
```

**Van de:** 51 blocks hardcode Tailwind values thay vi dung CSS vars.
Vi du: `className="py-20"` thay vi `style={{ padding: 'var(--spacing-section)' }}`
Va: `className="rounded-2xl"` thay vi `style={{ borderRadius: 'var(--radius-lg)' }}`

## Related Code Files
- `src/blocks/types.ts` — ThemeConfig (da co tokens)
- `src/lib/theme/resolve.ts` — CSS var generation (da co presets)
- `src/components/site-renderer/SiteRenderer.tsx` — injects CSS vars vao `<style>`
- `src/blocks/*/index.tsx` — 51 block components can update
- `src/lib/ai/theme-presets.ts` — 55 presets da co spacing/radius/shadow

## Key Insight
KHONG can add tokens moi. Chi can blocks SU DUNG tokens da co. Day la migration work, khong phai architecture work.

## Requirements
1. Top 15 blocks dung CSS vars cho spacing, radius, shadow
2. Tat ca blocks dung `accentColor`, `surfaceColor`, `mutedColor` cho variety
3. Tao utility CSS classes de blocks dung (optional, giam code duplication)

## Implementation Steps

### Step 1: Create shared style helpers
File: `src/blocks/shared/theme-styles.ts` (NEW)

```ts
import type { ThemeConfig } from '../types'

export function sectionStyle(theme: ThemeConfig) {
  return {
    padding: 'var(--spacing-section) 0',
  }
}

export function cardStyle(theme: ThemeConfig) {
  return {
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    backgroundColor: theme.surfaceColor,
  }
}

export function buttonStyle(theme: ThemeConfig, variant: 'primary' | 'outline' | 'ghost' = 'primary') {
  const base = { borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm) var(--spacing-lg)' }
  // ... variant-specific styles
}
```

### Step 2: Update top 15 high-impact blocks

Priority blocks (xuat hien nhieu nhat trong templates):
1. `hero/index.tsx` — section padding, button radius, card shadows
2. `features/index.tsx` — card radius, shadow, spacing between items
3. `testimonials/index.tsx` — quote card radius + shadow
4. `pricing/index.tsx` — plan card radius + shadow + highlighted card
5. `gallery/index.tsx` — image radius, gap spacing
6. `contact/index.tsx` — form field radius, button radius
7. `footer/index.tsx` — section spacing, link gaps
8. `navigation/index.tsx` — nav item spacing, mobile menu radius
9. `about/index.tsx` — section spacing, image radius
10. `faq/index.tsx` — accordion item radius + spacing
11. `cta/index.tsx` — button radius, section padding
12. `stats/index.tsx` — card radius + shadow (Phase 01 already)
13. `team/index.tsx` — member card radius + shadow (Phase 01 already)
14. `newsletter/index.tsx` — input radius, button radius (Phase 01 already)
15. `review-cards/index.tsx` — review card radius + shadow

### Step 3: Color token migration

Thay doi pattern trong moi block:
```tsx
// TRUOC
<p className="text-sm opacity-60">subtitle</p>
<div style={{ borderColor: `${theme.primaryColor}15` }}>

// SAU
<p style={{ color: theme.mutedColor }}>subtitle</p>
<div style={{ borderColor: theme.surfaceColor, backgroundColor: theme.surfaceColor }}>
```

Key color replacements:
- `opacity-60/70` text → `theme.mutedColor`
- Hardcoded white/black backgrounds → `theme.surfaceColor` / `theme.backgroundColor`
- `${theme.primaryColor}15` borders → `theme.surfaceColor` or `theme.mutedColor` with alpha

### Step 4: Verify SiteRenderer CSS injection

`src/components/site-renderer/SiteRenderer.tsx` da inject CSS vars:
```tsx
const themeCSS = generateThemeCSS(theme) // line 60
```

Verify `generateThemeCSS()` trong `resolve.ts` output:
- `--primary`, `--secondary`, `--accent`, `--surface`, `--text`, `--muted`
- `--spacing-xs` through `--spacing-section`
- `--radius-sm/md/lg/full`
- `--shadow-sm/md/lg`
- `--font-heading`, `--font-body`

Neu thieu variable nao → add vao `generateThemeCSS()`.

## Todo
- [ ] Tao `src/blocks/shared/theme-styles.ts` — shared style helpers
- [ ] Update hero block — CSS vars cho spacing + radius + shadows
- [ ] Update features block — card styles dung tokens
- [ ] Update testimonials block — quote card dung tokens
- [ ] Update pricing block — plan card dung tokens
- [ ] Update gallery block — image radius + gap dung tokens
- [ ] Update contact block — form field radius dung tokens
- [ ] Update footer block — spacing dung tokens
- [ ] Update navigation block — spacing + mobile menu radius
- [ ] Update about, faq, cta, review-cards blocks — tokens
- [ ] Color migration: replace `opacity-*` voi `theme.mutedColor` across all blocks
- [ ] Verify `generateThemeCSS()` output co du CSS vars

## Success Criteria
- >20 blocks su dung `var(--spacing-*)`, `var(--radius-*)`, `var(--shadow-*)`
- Template voi `spacingPreset: 'compact'` nhin KHAC BIET voi `spacingPreset: 'relaxed'`
- Template voi `borderRadius: 'sharp'` nhin KHAC BIET voi `borderRadius: 'pill'`
- No TypeScript errors, no visual regression tren existing templates

## Risk Assessment
- MEDIUM: Thay doi CSS cho 15+ blocks co the break visual existing templates
- Mitigation: test tren preview route truoc khi merge, screenshot so sanh
- Pattern: chi thay doi inline styles, KHONG thay doi Tailwind classes co san de giam risk
