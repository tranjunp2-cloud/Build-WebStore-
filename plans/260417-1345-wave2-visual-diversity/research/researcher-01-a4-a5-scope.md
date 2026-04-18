# Wave 2 Phase A4 + A5 Audit Report

## 1. Decorative Inventory
**Status:** Shared file `src/blocks/shared/decorative.tsx` EXISTS (223 lines).
**Current exports:** GradientBlob, DotGrid, WaveDivider, GradientLine, IconContainer, GlassCard, SectionLabel, FloatingCircle, AvatarRing.
- ✓ GradientBlob: soft radial gradient (already used)
- ✓ DotGrid: subtle dot pattern
- ✓ WaveDivider: SVG wave separator
- Missing from A4 target: mesh-gradient, noise-texture, layered-shapes, asymmetric-grid, duotone-overlay, typographic-mark, grid-lines, diagonal-stripe

**Action:** Need implement 8 primitives in decorative.tsx. Current file has 9 components; add 8 more. No import conflicts found across blocks.

## 2. Current Variant Enum Counts

| Block | Current | Target | Gap | Notes |
|-------|---------|--------|-----|-------|
| team | 2 | 6 | +4 | grid, list → +cards-hover-reveal, horizontal-scroll, bio-modal, compact-row |
| cta | 4 | 8 | +4 | banner, inline, card, floating-sticky → +image-bg, split-testimonial, dark-card, mesh-gradient |
| about | 3 | 7 | +4 | simple, split, story → +4 variants (TBD design) |
| stats | 3 | 6 | +3 | row, grid, highlight → +3 variants |
| newsletter | 3 | 6 | +3 | inline, popup, banner → +3 variants |
| faq | 3 | 6 | +3 | accordion, grid, simple → +3 variants |
| hero | 12 | — | — | centered, split-left, split-right, fullscreen, video, magazine, minimal, cards-overlay, gradient, parallax, slideshow, split-video (reference: 12 variants already exist) |

**Observation:** Team/CTA need tightest focus for A5; stats/newsletter/faq need padding; about needs design first.

## 3. Variant Dispatch Pattern (CTA Block)

**File:** `src/blocks/cta/index.tsx:383`
```tsx
const variant = block.variant as string
const normalizedVariant = variant === 'floating' ? 'card' : variant

switch (normalizedVariant) {
    case 'inline':
        return <InlineVariant block={block} siteId={siteId} />
    case 'card':
        return <CardVariant block={block} siteId={siteId} />
    case 'floating-sticky':
        return <FloatingStickyVariant block={block} siteId={siteId} />
    case 'banner':
    default:
        return <BannerVariant block={block} siteId={siteId} />
}
```
**Pattern:** Switch statement + legacy alias handling (floating → card). Clean. A5 should follow same pattern: add cases, create `<VariantName>Variant` component, no refactor needed.

## 4. Pool Table Constraints

**File:** `src/lib/ai/category-requirements.ts`
- Current pools: 14 categories × 3 variants min (team/cta/about/stats/newsletter/faq)
- Example (team): `minItems: { team: 3, ...}`
- When team expands 2→6 (3x), pool table stays same UNLESS enforcer checks enum length dynamically
- **Risk:** If enforcer hardcodes "max 2 variants", A5 breaks. Recommend dynamic: `minVariants = Math.ceil(minItems[block] / 2)`
- **Widen needed:** YES for team/cta. Check `structure-enforcer.ts` before A5 merge.

## 5. Hero Decorative Analysis

**Hero variants:** 12 total (most in codebase).
**GradientBlob grep:** No results in hero/index.tsx. 
**Assumption:** Hero uses different decoratives (likely image-heavy, video, native gradients). A4 should NOT overhaul hero; isolate to team/cta/about/stats/newsletter/faq first.

## 6. A4 Primitive Components (Recommended Locations)

**Add to `src/blocks/shared/decorative.tsx`:**
1. `MeshGradient(colors[], className?) → animated mesh SVG`
2. `NoiseTexture(opacity, scale) → SVG filter-based noise overlay`
3. `LayeredShapes(shapeConfig[]) → nested circles/rectangles w/ offsets`
4. `AsymmetricGrid(cols, rows, skipPattern) → CSS grid with holes`
5. `DuotoneOverlay(color1, color2, blendMode) → fixed/absolute duotone blend`
6. `TypographicMark(char, size, color, opacity) → large background text accent`
7. `GridLines(spacing, color, angle) → diagonal/straight grid pattern`
8. `DiagonalStripe(color1, color2, angle, width) → stripe pattern background`

**Exports:** Update decorative.tsx exports. Create storybook (optional) in `src/components/storybook/Decoratives.tsx` for QA.

## 7. Unresolved Questions

- Q1: Should A4 decoratives be **configurable per variant** or **hardcoded per block**? (E.g., cta/card always uses mesh-gradient, or random from pool?)
- Q2: Do decoratives stack with ImageRef? Priority order?
- Q3: Hero 12 variants: is GradientBlob forbidden? Should hero variants be refreshed too?
- Q4: `structure-enforcer.ts` — does it validate variant count against enum? Needs inspection before A5.
- Q5: Pool table `minItems` — should scale to `ceil(old_count * scale_factor)` or keep fixed 3 per category?

**Recommendations:**
- A4 first: Implement 8 primitives + test on cta (4→8 fastest path).
- A5 then: Extend team/cta/about with pool table validation. Use switch pattern from cta/index.tsx.
- Config design: Create A5 variant names NOW (cards-hover-reveal, etc.); audit UX before implementation.

---
*Generated 2026-04-17. Audit scope: decorative inventory, config Zod enums, dispatch patterns, pool tables, hero decorative state.*
