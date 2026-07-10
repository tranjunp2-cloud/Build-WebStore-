# Phase 03 — Array-image blocks (per-item overlay)

**Priority:** P1 · **Status:** pending · **Effort:** 4h · **Depends:** P1 · **Parallel with:** P2, P4

## Overview

Per-item overlay using nested array field paths. `BLOCK_FIELD_CHANGED` already resolves `field="images.2.image"` → array index (CONFIRMED PreviewFrame.tsx:674-689). No new infra. ~8 blocks.

## Scope
| Block | File | Array field | Item subfield | field path | UPLOAD_FIELDS? |
|-------|------|-------------|---------------|-----------|----------------|
| gallery | `src/blocks/gallery/index.tsx` | `images` | `image` | `images.${i}.image` | YES (`image`) |
| gallery-masonry | `src/blocks/gallery-masonry/index.tsx` | `images` | `image` | `images.${i}.image` | YES |
| carousel | `src/blocks/carousel/index.tsx` | `items` | `image` | `items.${i}.image` | YES |
| team | `src/blocks/team/index.tsx` | `members` | `image` | `members.${i}.image` | YES |
| testimonials | `src/blocks/testimonials/index.tsx` (+ `decorative.tsx`) | `testimonials` | `avatar` | `testimonials.${i}.avatar` | YES (`avatar`) |
| social-proof | `src/blocks/social-proof/index.tsx` | `reviews` | `avatar` | `reviews.${i}.avatar` | YES |
| portfolio-grid | `src/blocks/portfolio-grid/index.tsx` | `projects` | `image` | `projects.${i}.image` | YES |
| logo-cloud | `src/blocks/logo-cloud/index.tsx` | `logos` | `logo` | `logos.${i}.logo` | YES — **reconcile existing LogoImageOverlay** |

All subfields (`image`, `avatar`, `logo`) are in UPLOAD_FIELDS → save extracts `.id` from nested-array objects (block-normalization.ts:138-153). Send `{id,url,alt}` (`valueShape="media"`). Works with NO normalization change.

## Per-item pattern

```tsx
{images.map((item, i) => (
  <MediaUploadOverlay key={i} field={`images.${i}.image`} altText={item.caption} valueShape="media" buttonPosition="top-right">
    <Image src={item.image?.url} ... />
  </MediaUploadOverlay>
))}
```
- **Each item needs its own `relative` container** (overlay provides via `positionClass` default). Where the map already wraps each item in a positioned card, the overlay nests inside cleanly; otherwise the overlay's wrapper div becomes the positioned container — verify grid/flex layout survives the extra div (use `className`/`positionClass` to match the item's existing classes if the wrapper replaces a slot).
- Drop `data-image-index` reliance for the new path (kept for Path B fallback until P5).

## logo-cloud reconcile (DRY)

logo-cloud already has `LogoImageOverlay` (uses `uploadMediaAction`, hover-above button, no progress bar). Replace it with `MediaUploadOverlay field={`logos.${i}.logo`} valueShape="media" buttonPosition="above"`:
- Gains progress bar (useUploadProgress) for free.
- Delete `src/blocks/logo-cloud/LogoImageOverlay.tsx` (or keep file as re-export shim → prefer delete, update import in logo-cloud/index.tsx).
- Same field path + value shape → no behavior regression on persistence.

## Files
- **Modify (8):** the 8 block index files above; `src/blocks/testimonials/decorative.tsx` if avatar render lives there.
- **Delete:** `src/blocks/logo-cloud/LogoImageOverlay.tsx`
- **Read:** `media-upload-overlay.tsx`; each block's config.ts for exact subfield name + array field name (verify `items` vs `cards` etc.).

## Implementation steps
1. Confirm each block's array field + subfield names from config.ts (don't trust map var names).
2. gallery first (reference, GH-1381 origin) → wrap each slot, `field={`images.${i}.image`}`. Verify lightbox/active-index variants (gallery has multiple render modes, lines 73-563) each get the overlay or at least the grid mode does.
3. Repeat for masonry, carousel, team, social-proof, portfolio-grid.
4. testimonials: avatar may render in shared `decorative.tsx` — wrap there with the passed index.
5. logo-cloud: swap LogoImageOverlay → MediaUploadOverlay; delete old file.
6. Typecheck after each (or batch).

## Acceptance criteria
- [ ] Each block: hovering any item shows its own overlay button; upload swaps only that item in-place; persists after reload at correct index.
- [ ] No cross-item bleed (uploading item 3 doesn't change item 0).
- [ ] logo-cloud: progress bar now shows; logo persists; old LogoImageOverlay deleted; no dangling import.
- [ ] Grid/masonry/carousel layout visually unchanged (no overlay-wrapper layout shift).
- [ ] Typecheck clean.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| Extra wrapper div breaks grid/flex/masonry columns | M×M | match item classes on `positionClass`; visual check each block |
| Wrong subfield/array name → field path mis-resolves → silent no-op | M×H | read config.ts per block; P6 asserts path for ≥3 blocks |
| gallery's multiple render modes — overlay added to only one | M×M | enumerate gallery variants; cover grid (primary); note others |
| logo-cloud dual-path (overlay + Strat 7) during transition double-updates | L×M | both write same field → idempotent; resolved fully at P5 |

## Unresolved questions
- Q3.1: gallery has grid + lightbox + active-index render modes — overlay on all, or grid-edit mode only? (default: grid/primary editable mode)
- Q3.2: carousel array field — `items` (per map) vs config.ts actual name? Confirm.
- Q3.3: testimonials avatar render — in `index.tsx` or `decorative.tsx`? Confirm index propagation.
