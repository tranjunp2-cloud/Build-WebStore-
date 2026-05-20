# Decorative Vocabulary — Wave 2 Phase A4

> Source of truth for which decorative primitive each block variant pins to.
> Goal: 10 sites in the same category should display **≥ 4 distinct decorative
> vocabularies** instead of all sharing one `GradientBlob`.

**Plan**: `plans/260417-1345-wave2-visual-diversity/phase-03-A4-visual-diversity.md`
**Tests**: `src/__tests__/unit/blocks/decorative-primitives.test.tsx`

---

## The 8 primitives

| Primitive | Visual character | Best for | File |
|---|---|---|---|
| `MeshGradient` | Painterly soft mesh from 4 radial blobs + heavy blur | Hero-like CTAs, big "feature" sections | `decorative/MeshGradient.tsx` |
| `NoiseTexture` | SVG fractal-noise grain (per-instance unique filter ID) | Cards, masonry — adds film texture without color | `decorative/NoiseTexture.tsx` |
| `LayeredShapes` | 3 offset blurred shapes (2 circles + 1 rotated square) | Organic, friendly sections (cards, about) | `decorative/LayeredShapes.tsx` |
| `AsymmetricGrid` | 4×3 uneven CSS grid blueprint | Structured sections that already feel asymmetric (zigzag) | `decorative/AsymmetricGrid.tsx` |
| `DuotoneOverlay` | Two-color blend overlay (multiply / overlay / soft-light / screen) | Sections with existing image/gradient that need richer color depth | `decorative/DuotoneOverlay.tsx` |
| `TypographicMark` | Oversized watermark text using `clamp()` font-size | Story / spotlight sections that benefit from a "stamp" | `decorative/TypographicMark.tsx` |
| `GridLines` | Repeating linear-gradient lines (configurable spacing + direction) | Architectural / pricing / form sections | `decorative/GridLines.tsx` |
| `DiagonalStripe` | Single skewed band (configurable angle) | Inline strips, narrow sections needing motion | `decorative/DiagonalStripe.tsx` |

All primitives:
- Are `aria-hidden="true"` (decorative, never in a11y tree).
- Render `absolute inset-0 pointer-events-none` (clicks pass through).
- Use pure CSS / SVG — no JS animation, no media queries needed for mobile.
- Live under `src/blocks/shared/decorative/*.tsx` and re-export from `decorative.tsx`.

---

## Wiring map (block × variant → primitive)

> When 2 sibling variants of the same block need decoration, they MUST get
> different primitives — that is the rule that produces "decorative vocabulary".

### CTA (4 variants, 4 primitives)
| Variant | Primitive | Rationale |
|---|---|---|
| `banner` | `MeshGradient` (primary + secondary, opacity 0.35) | Banner already has linear gradient bg; mesh adds painterly depth on top |
| `inline` | `DiagonalStripe` (primary, opacity 0.06) | Narrow horizontal strip → diagonal motion fits the shape |
| `card` | `NoiseTexture` (opacity 0.06) | Flat surface card → grain lifts the surface texture |
| `floating-sticky` | `LayeredShapes` (primary, opacity 0.08) | Toast container → soft organic shapes peek inside |

### Features (3 variants wired)
| Variant | Primitive | Rationale |
|---|---|---|
| `grid-3` (default) | `GridLines` (primary, spacing 48px, opacity 0.05) | 3-col grid → architectural blueprint backdrop reinforces grid |
| `zigzag` | `AsymmetricGrid` (primary, opacity 0.05) | Already-asymmetric layout → asymmetric grid bg amplifies |
| `carousel` | `DuotoneOverlay` (primary + secondary, soft-light, opacity 0.04) | Horizontal scroll → tone overlay unifies the cards visually |
| `icon-top`, `icon-left`, `list`, `grid-2`, `grid-4` | (default `GradientBlob`) | Out of A4 scope — kept Wave 1 default |

### Testimonials (3 variants wired)
| Variant | Primitive | Rationale |
|---|---|---|
| `cards` (default) | `LayeredShapes` (primary, opacity 0.1) | Friendly testimonial cards → organic shapes feel warm |
| `masonry` | `NoiseTexture` (opacity 0.06) | Editorial masonry → grain reads like print magazine |
| `spotlight` | `TypographicMark` (text `"`, primary, size xl, opacity 0.05) | Featured quote → giant quotation mark watermark |
| `simple`, `minimal-quote`, `avatar-row`, `video-text`, `carousel` | (default / suppressed) | Not in A4 scope |

### Pricing (1 variant wired)
| Variant | Primitive | Rationale |
|---|---|---|
| `cards` (default) | `GridLines` (primary, spacing 56px, opacity 0.04) | Plan cards in grid → grid lines reinforce comparison structure |
| `horizontal`, `toggle`, `tiered`, `comparison`, `table`, `minimal`, `slider` | (default `GradientBlob`) | Out of A4 scope; `table` flagged structural in plan |

### About (3 variants — full coverage)
| Variant | Primitive | Rationale |
|---|---|---|
| `simple` | `DiagonalStripe` (primary, opacity 0.06) | Centered text-only → stripe adds motion behind static content |
| `split` | `LayeredShapes` (primary, opacity 0.1) | Image + text split → organic shapes bridge the two columns |
| `story` | `TypographicMark` (text "STORY", primary, opacity 0.04) | Timeline/story → "STORY" watermark sets editorial tone |

### Stats (2 variants wired)
| Variant | Primitive | Rationale |
|---|---|---|
| `row` | `DiagonalStripe` (primary, opacity 0.06) | Horizontal row of numbers → stripe sweeps left-to-right |
| `highlight` | `MeshGradient` (primary + secondary, opacity 0.2) | Featured % bars → mesh gradient elevates the section |
| `grid` | (default — none) | Out of A4 scope |

### Newsletter (2 variants — full coverage)
| Variant | Primitive | Rationale |
|---|---|---|
| `inline` | `GridLines` (primary, spacing 48px, opacity 0.05) | Form-like inline → gridlines feel form/architectural |
| `banner` | `DuotoneOverlay` (primary + secondary, overlay blend, opacity 0.3) | Big colored banner → duotone overlay deepens the gradient |
| `popup` | (no decorative — modal context) | N/A |

### FAQ (1 variant wired)
| Variant | Primitive | Rationale |
|---|---|---|
| `grid` | `NoiseTexture` (opacity 0.05) | Card grid → grain matches the card-based visual language |
| `accordion`, `simple` | (default / suppressed) | `accordion` flagged structural in plan |

---

## Coverage summary

| Block | Variants wired | Variants total | Coverage |
|---|---|---|---|
| cta | 4 | 4 | 100% |
| features | 3 | 8 | 38% (only A4-target variants) |
| testimonials | 3 | 8 | 38% (only A4-target variants) |
| pricing | 1 | 8 | 13% (default cards only) |
| about | 3 | 3 | 100% |
| stats | 2 | 3 | 67% |
| newsletter | 2 | 3 | 67% |
| faq | 1 | 3 | 33% |
| **Total** | **19 variants** | 40+ | — |

Every variant *not* listed in the wired tables falls back to the existing
`GradientBlob` (or no decorative if the variant suppressed it). Backward compat:
all old sites render identically; only newly wired variants change.

---

## Mechanical pattern (how the wiring works)

Each block's shared `*Section` helper accepts an optional `decorative?: ReactNode`
prop. When present:

1. The outer Tag gets `relative overflow-hidden` so absolute children are constrained.
2. The decorative is rendered as a sibling **before** the inner content.
3. Inner content is wrapped with `relative z-10` to stack above the decorative.
4. When `decorative` is not provided, the helper falls back to `GradientBlob`
   (or whatever the block previously rendered) so unwired variants don't change.

Example skeleton:

```tsx
function FooSection({ children, decorative }: Props) {
    return (
        <AnimatedSection className={decorative ? 'relative overflow-hidden' : ''}>
            {decorative ?? <GradientBlob ... />}
            <SectionWrapper innerClassName={decorative ? 'relative z-10' : ''}>
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}
```

---

## When to add a new variant → primitive mapping

1. Pick a primitive whose **visual character** (table above) suits the variant's mood.
2. Pick a primitive that no **sibling variant of the same block** already uses
   (otherwise users see "two flavors of the same thing" instead of vocabulary).
3. Use sensible opacity:
   - Light themes: `opacity 0.04 – 0.08`
   - Dark / colored themes: `opacity 0.1 – 0.3`
   - Mesh/duotone overlays on existing gradients: `opacity 0.2 – 0.35`
4. Update this doc in the matching block table.
5. Re-run `pnpm vitest run blocks` to verify no render regression.

---

## Visual QA (manual, on staging)

The decorative effect is visual — automated tests verify render/props but cannot
verify "does it look distinct?". Manual QA after merge:

1. Generate 10 sites for **same category** (e.g. "Beauty Salon").
2. For each site, scroll through CTA + features + testimonials + about + stats.
3. Confirm: across the 10 sites, you see ≥ 4 different decorative vocabularies
   visible (not all "same gradient blob").
4. Repeat for 2 more categories (e.g. "Tech Startup", "F&B").

Pass criteria: ≥ 4 distinct vocabularies × ≥ 3 categories. Any "all same" cluster
indicates the variant rotation pool needs expanding (Wave 2 Phase A5).
