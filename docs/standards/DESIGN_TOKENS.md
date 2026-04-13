# Design Tokens

> Closed token layer for block-level design quality. All spacing, radius, shadow, icon sizing, container widths, and section padding flow through `src/lib/design-tokens.ts`.
>
> **Reference:** plans/260412-2300-design-quality-rules/ | **PRD:** docs/prd/F01-design-quality.md

## Why Tokens

Before tokens: each block hardcoded `py-16 px-4`, `max-w-6xl`, `rounded-2xl`, pixel-exact shadows. 131 hardcoded `container mx-auto px-6` and 496+ raw CSS var usages across 47 blocks made consistency impossible.

After tokens: block components import from `@/lib/design-tokens` — changing one token updates every block.

## Token Families

### SPACING (8px grid)

```ts
import { SPACING } from '@/lib/design-tokens'
```

| Key | Value | When to use |
|-----|-------|-------------|
| `xs` | 4px | Tight internal spacing |
| `sm` | 8px | Internal padding |
| `md` | 16px | Card padding |
| `lg` | 24px | Section internal gap |
| `xl` | 32px | Component gap |
| `2xl` | 48px | Section gap |
| `3xl` | 64px | Section padding (desktop) |
| `4xl` | 80px | Large section padding |
| `5xl` | 96px | Hero padding |
| `6xl` | 120px | Maximum section padding |

**Rule:** Card padding MUST be smaller than the parent section gap. Violating this collapses the visual hierarchy.

### RADIUS

| Key | Value | When to use |
|-----|-------|-------------|
| `none` | 0 | Sharp-edged brand |
| `sm` | 4px | Inputs, chips |
| `md` | 8px | Buttons, small cards |
| `lg` | 12px | Default cards |
| `xl` | 16px | Feature cards |
| `2xl` | 24px | Hero cards, modals |
| `full` | 9999px | Avatars, pill buttons |

### SHADOW (Tailwind classes)

All shadow tokens are Tailwind arbitrary value classes — consume via `className`, not inline style.

```tsx
<div className={SHADOW.medium}>card</div>
```

| Key | When to use |
|-----|-------------|
| `none` | Flat brand aesthetic (`shadow-none`) |
| `subtle` | Subtle elevation (hover states, cards on colored backgrounds) |
| `medium` | Default cards |
| `strong` | Featured/highlighted cards |
| `dramatic` | Modals, floating CTAs |

### ICON_SIZE (Tailwind classes)

| Key | Size | Context |
|-----|------|---------|
| `sm` | 20px (`w-5 h-5`) | Inline with text |
| `md` | 32px (`w-8 h-8`) | Feature card icons |
| `lg` | 48px (`w-12 h-12`) | Hero icons |
| `xl` | 64px (`w-16 h-16`) | Standalone decorative |

### SECTION_PADDING (responsive)

| Key | Mobile | Desktop | Context |
|-----|--------|---------|---------|
| `compact` | 48px | 64px | Tight sections (CTAs, divider) |
| `default` | 64px | 96px | Standard content sections |
| `relaxed` | 80px | 128px | Editorial breathing room |
| `hero` | 96px | 160px | Hero blocks only |

### CONTAINER

| Key | Max width | Context |
|-----|-----------|---------|
| `narrow` | 768px | Blog posts, text-heavy |
| `default` | 1152px | Standard pages |
| `wide` | 1280px | Dashboard, gallery |
| `full` | 100% | Edge-to-edge hero |

### CARD_PADDING

| Key | Padding | Context |
|-----|---------|---------|
| `sm` | 16px | Compact cards (list items) |
| `md` | 24px | Default cards |
| `lg` | 32px | Feature cards |

### TOUCH_TARGET

WCAG 2.5.5 minimum for interactive controls.

| Key | Min height | Context |
|-----|------------|---------|
| `min` | 44px | Baseline (WCAG AA) |
| `comfortable` | 48px | Default buttons |
| `large` | 56px | Primary CTAs |

## SectionWrapper

Every block MUST wrap its root `<section>` in `SectionWrapper`.

```tsx
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'

export function MyBlock({ data }: Props) {
    return (
        <SectionWrapper padding="default" container="default" background="default">
            {/* block contents */}
        </SectionWrapper>
    )
}
```

### Props

- `padding` — one of `SECTION_PADDING` keys. Default: `'default'`.
- `container` — one of `CONTAINER` keys. Default: `'default'`.
- `background` — one of `SECTION_BACKGROUND` keys. Default: `'default'`.
- `as` — root element tag. Default: `'section'`.
- `innerClassName` — extra classes for the inner container div.
- `className` — extra classes for the outer section.

### Alternating Backgrounds

Let the page renderer decide backgrounds, not the block. A common pattern:

```tsx
sections.map((section, idx) => (
    <SectionWrapper
        key={section.id}
        background={idx % 2 === 0 ? 'default' : 'alternate'}
    >
        <BlockRenderer block={section} />
    </SectionWrapper>
))
```

### Background Variants

| Key | CSS Var | Visual |
|-----|---------|--------|
| `default` | `--surface-1` | Primary background (60% — neutral surface) |
| `alternate` | `--surface-2` | Alternate row background (30%) |
| `accent` | `--surface-3` | Subtle accent background (elevated cards) |
| `transparent` | `bg-transparent` | Hero + decorative sections |

> During Phase 01-02, tokens reference legacy `--surface-1/2/3` from `globals.css`. Phase 03 codemod renames to semantic `--surface-primary/secondary/card` — the token API stays the same, block code doesn't change.

### Inner Container Padding

`SectionWrapper` applies responsive horizontal padding from `INNER_PADDING = 'px-6 md:px-8 lg:px-12'` — 24px mobile → 32px tablet → 48px desktop. Do NOT override unless you need edge-to-edge; use `innerClassName` for additional positioning (relative, z-index, etc.).

### Anchor Links

`<section>` `id` attribute is forwarded for in-page navigation:

```tsx
<SectionWrapper id="features">
    <Features data={data} />
</SectionWrapper>
```

## Forbidden Patterns

Phase 05 block audit removes every instance of these.

| ❌ Forbidden | ✅ Use instead |
|-------------|----------------|
| `<section className="py-16 px-4">` | `<SectionWrapper padding="default">` |
| `className="container mx-auto px-6"` | Use `CONTAINER` token or `SectionWrapper` |
| `className="rounded-2xl"` | `style={{ borderRadius: RADIUS['2xl'] }}` or token class |
| `style={{ padding: '24px' }}` | `className={CARD_PADDING.md}` |
| Hardcoded `shadow-lg` with arbitrary values | `SHADOW.strong` |

## Migration Status

| Phase | Scope |
|-------|-------|
| Phase 01 | ✅ Tokens + SectionWrapper created |
| Phase 02 | Typography tokens (TYPE_SCALE, LINE_HEIGHT, FONT_WEIGHT) appended |
| Phase 03 | Color semantic vars replace `--brand-*` legacy |
| Phase 05 | 47 blocks refactored to consume tokens (3 batches) |
