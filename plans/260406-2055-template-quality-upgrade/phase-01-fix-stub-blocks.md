# Phase 01 — Fix Stub Blocks (Stats, Team, Newsletter)

## Context
- Stats: 23 lines, 1 variant render (ignore variant prop), xuat hien 80%+ templates
- Team: 24 lines, 1 variant render, xuat hien trong premium + about pages
- Newsletter: 18 lines, 1 variant render, xuat hien trong premium + blog pages
- So sanh: Hero co 855 lines, 12 variants. Day la target quality level.

## Related Code Files
- `src/blocks/stats/index.tsx` — current stub
- `src/blocks/stats/config.ts` — has variants: `['row', 'grid', 'highlight']` but only `row` rendered
- `src/blocks/team/index.tsx` — current stub
- `src/blocks/team/config.ts` — has variants: `['grid', 'list']` but only `grid` rendered
- `src/blocks/newsletter/index.tsx` — current stub
- `src/blocks/newsletter/config.ts` — has variants: `['inline', 'popup', 'banner']` but only `inline` rendered
- `src/blocks/hero/index.tsx` — reference cho multi-variant pattern

## Key Insight
Config files DA define variants nhung component KHONG render chung. Chi can implement variant rendering logic.

## Requirements
1. Stats: 3 variants (row, grid, highlight) — moi variant >80 lines, responsive, animated counters
2. Team: 3 variants (grid, list, cards) — avatar fallback, social links, hover effects
3. Newsletter: 2 variants (inline, banner) — styled form, background patterns, responsive

## Implementation Steps

### Stats Block (`src/blocks/stats/index.tsx`)

**Variant `row` (default):** Horizontal row, icon cho moi stat, animated number, divider giua stats
```
Layout: 4 stats ngang hang | divider | icon tren value | label duoi
```

**Variant `grid`:** 2x2 grid, cards voi background, icon + value + label + description
```
Layout: 2 cot x 2 hang | card co shadow + border radius | icon ben trai value ben phai
```

**Variant `highlight`:** 1 stat lon o giua, 3 stats nho 2 ben. Gradient background section.
```
Layout: stat chinh (font-size 6xl) | 3 stats phu (3xl) | gradient bg dung primaryColor
```

Code structure — copy pattern tu `src/blocks/hero/index.tsx`:
```tsx
export function StatsBlock({ block, theme }: BlockProps<StatsConfig>) {
  const variant = block.variant ?? 'row'
  switch (variant) {
    case 'grid': return <StatsGrid block={block} theme={theme} />
    case 'highlight': return <StatsHighlight block={block} theme={theme} />
    default: return <StatsRow block={block} theme={theme} />
  }
}
```

Moi variant function: 80-120 lines, su dung:
- `theme.primaryColor`, `theme.accentColor`, `theme.surfaceColor`
- CSS var `--radius-md`, `--shadow-md`, `--spacing-section`
- Responsive: `grid-cols-2 md:grid-cols-4`
- Hover effects: `transition-all hover:scale-105`

### Team Block (`src/blocks/team/index.tsx`)

Update config: add variant `'cards'` vao `src/blocks/team/config.ts`

**Variant `grid` (default):** Nhu hien tai nhung add: avatar fallback (initials), social icons, hover card lift
**Variant `list`:** Horizontal card, avatar trai + info phai, alternating row backgrounds
**Variant `cards`:** Larger cards, full-width image top, overlay gradient, name + role overlay

Code changes:
- `config.ts`: Them `'cards'` vao variants array va teamMeta.variants
- `index.tsx`: Switch statement pattern, 3 sub-components, moi cai 80-120 lines
- Avatar fallback: neu khong co avatar URL, render initials trong circle voi `theme.primaryColor` background

### Newsletter Block (`src/blocks/newsletter/index.tsx`)

**Variant `inline` (default):** Form ngang, input + button cung hang, subtle background pattern
**Variant `banner`:** Full-width section, gradient background (primaryColor → secondaryColor), centered form, decorative elements

Code changes:
- `index.tsx`: 2 sub-components, moi cai 60-100 lines
- Banner: `background: linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`
- Both: proper focus states, validation visual feedback, responsive (stack on mobile)

## Todo
- [ ] Stats: implement `StatsRow` sub-component (~100 lines)
- [ ] Stats: implement `StatsGrid` sub-component (~100 lines)
- [ ] Stats: implement `StatsHighlight` sub-component (~100 lines)
- [ ] Team: update config.ts — add `'cards'` variant
- [ ] Team: implement `TeamGrid` sub-component voi avatar fallback (~100 lines)
- [ ] Team: implement `TeamList` sub-component (~100 lines)
- [ ] Team: implement `TeamCards` sub-component (~100 lines)
- [ ] Newsletter: implement `NewsletterInline` sub-component (~80 lines)
- [ ] Newsletter: implement `NewsletterBanner` sub-component (~80 lines)
- [ ] Update `template-composer.ts` — vary stats/team/newsletter variants per template

## Success Criteria
- Stats block: 3 variants, >250 lines total, responsive, dung 3+ theme tokens
- Team block: 3 variants, >300 lines total, avatar fallback, social links
- Newsletter block: 2 variants, >150 lines total, gradient banner, responsive form
- All blocks: no TypeScript errors, pass lint

## Risk Assessment
- LOW: Day la UI-only changes, khong anh huong DB hay API
- Config schema da define variants — chi can implement render logic
- Test: visual test bang preview route `/api/templates/preview`
