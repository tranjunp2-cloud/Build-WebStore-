# Phase 05 — Block Refactor Checklist

> Canonical rules for migrating `src/blocks/*/index.tsx` to consume Phase 01-04
> infrastructure. Apply to every block sequentially. Run tests after each block.

---

## Token imports (copy-paste)

```tsx
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { Heading, Body, Caption } from '@/blocks/shared/Typography'
import {
    TYPE_SCALE,
    ICON_SIZE,
    CARD_PADDING,
    TOUCH_TARGET,
    SHADOW,
} from '@/lib/design-tokens'
import { CSS_VARS } from '@/lib/theme/resolve'
```

---

## BEFORE / AFTER canonical

### BEFORE (hardcoded)

```tsx
export function FeaturesBlock({ data }: Props) {
    return (
        <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-center">
                    {data.headline}
                </h2>
                <p className="text-lg text-gray-600 mb-12 text-center">
                    {data.subheadline}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {data.items.map((item) => (
                        <div
                            key={item.title}
                            className="p-8 rounded-2xl"
                            style={{ background: 'var(--surface)' }}
                        >
                            <div className="w-12 h-12 mb-4">{item.icon}</div>
                            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                            <p className="text-sm text-gray-500">{item.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
```

### AFTER (token-driven)

```tsx
export function FeaturesBlock({ data }: Props) {
    return (
        <SectionWrapper padding="default" container="default">
            <Heading level={2} className="mb-4 text-center">
                {data.headline}
            </Heading>
            <Body size="lg" className="mb-12 text-center" style={{ color: CSS_VARS.textSecondary }}>
                {data.subheadline}
            </Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {data.items.map((item) => (
                    <div
                        key={item.title}
                        className={`${CARD_PADDING.lg} rounded-2xl`}
                        style={{ background: CSS_VARS.surfaceCard }}
                    >
                        <div className={`${ICON_SIZE.lg} mb-4`}>{item.icon}</div>
                        <Heading level={3} className="mb-2">{item.title}</Heading>
                        <Body size="small" style={{ color: CSS_VARS.textMuted }}>
                            {item.description}
                        </Body>
                    </div>
                ))}
            </div>
        </SectionWrapper>
    )
}
```

---

## Per-block acceptance gate (10 items)

Before marking a block done, verify:

1. ☐ Outer `<section>` replaced with `<SectionWrapper padding="..." container="...">`
2. ☐ Raw `<h1>/<h2>/<h3>/<h4>` replaced with `<Heading level={N}>` (or `<Display>` for hero primary)
3. ☐ Raw `<p>` for body copy replaced with `<Body size="...">`
4. ☐ Hardcoded `text-3xl`/`text-xl`/`text-sm` classes removed (Typography components own them)
5. ☐ Colors consume `CSS_VARS.accent / surfacePrimary / surfaceCard / textPrimary / textSecondary / textMuted` (semantic) — legacy `CSS_VARS.primary` OK during transition but prefer semantic
6. ☐ Icons use `ICON_SIZE.{sm,md,lg,xl}` class tokens
7. ☐ Cards use `CARD_PADDING.{sm,md,lg}` class tokens
8. ☐ CTA buttons have `TOUCH_TARGET.min` (44px min) or larger
9. ☐ Variant switch / conditional rendering logic UNCHANGED (structural refactor only)
10. ☐ Existing test file for this block still passes (`pnpm test {block}-variants.test.ts --run`)

---

## Gotchas

### Hero (11 separate variant files)
- Each variant file is standalone — refactor independently
- `<Display>` for hero primary headline (not `<Heading level={1}>`)
- Many hero variants have decorative absolute-positioned elements — use `SectionWrapper innerClassName="relative"` to maintain positioning context
- Keep framer-motion wrappers (`AnimatedSection`, `StaggerGrid`) — they are internal to blocks, not Phase 01 scope

### Inline variants (46 blocks)
- `index.tsx` has a variant switch (e.g., `switch(variant) { case 'grid-3': ... }`)
- Refactor OUTSIDE the switch where possible (shared wrapper)
- Per-variant differences (layout, columns) stay inside switch
- If a variant has drastically different structure (e.g., `carousel` vs `cards`), keep each branch wrapped in `<SectionWrapper>` independently

### Tests that check className
- Existing `*-variants.test.ts` files assert on specific class strings (`py-24`, `text-3xl`, etc.)
- Update assertions to match new token classes (e.g., `py-16 md:py-24` from `SECTION_PADDING.default`)
- Do NOT remove the assertion — just update the expected string
- Add a new assertion verifying `SectionWrapper` is rendered (query for `max-w-6xl` inner div)

---

## Forbidden changes

❌ **DO NOT:**

1. Change block schema (`config.ts`) — Zod shape must stay identical
2. Change block metadata (name, description, variants list in registry)
3. Change variant switch logic — same variants IN/OUT, just different internals
4. Add new variants — that is a separate PRD scope
5. Remove framer-motion animations — block-internal, not Phase 05
6. Rename block component export — breaks registry resolution
7. Remove props — even if unused, keep for backward compat with existing Payload sites
8. Replace `var(--brand-primary)` inside PAYLOAD CMS admin blocks — Phase 05 scope is site-render blocks only

---

## Sequence (low-risk first)

1. **features** (355 lines, 4 variants) — pilot, validates approach
2. **footer** (512 lines, 6 variants) — second pilot, still manageable
3. **navigation** (861 lines, 6 variants) — biggest inline block
4. **testimonials** (677 lines, 6 variants) — complex variants (spotlight, masonry)
5. **hero** (11 separate files) — largest batch, do last when approach is proven

After Batch A: pause for review + decide on Batch B (9 secondary blocks) in a separate session.

---

## Gate per block

```bash
pnpm tsc --noEmit              # 0 errors
pnpm test src/__tests__/unit/blocks/{block}-variants.test.tsx --run   # all pass
# Optional: pnpm build         # only at end of batch
```

Fix errors per-block. Do not move to next block with red tests.
