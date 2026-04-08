# Research: Block Variant Inventory

## Summary
51 block types, ~175 variants total. All blocks in `src/blocks/`, each with `index.tsx` + `config.ts`.

## Architecture
- **Registry**: `src/blocks/registry.ts` — maps blockType → { component, schema, meta }
- **Variant Selection**: `src/components/editor/SettingsPanel.tsx:646-660` — button grid UI
- **Rendering**: `src/components/site-renderer/SiteRenderer.tsx` — resolves theme + renders blocks
- **Design Tokens**: `src/lib/theme/resolve.ts` — CSS vars, spacing/radius/shadow presets

## 14 Target Blocks (from task)

| Block | Variants | LOC | Pattern |
|-------|----------|-----|---------|
| hero | 12: centered, split-left, split-right, fullscreen, video, magazine, minimal, cards-overlay, gradient, parallax, slideshow, split-video | 856 | if/else chain |
| features | 8: grid-2, grid-3, grid-4, list, icon-top, icon-left, zigzag, carousel | 316 | conditional |
| testimonials | 8: cards, carousel, simple, masonry, spotlight, minimal-quote, avatar-row, video-text | 509 | conditional |
| pricing | 8: cards, table, horizontal, toggle, tiered, comparison, minimal, slider | 606 | conditional |
| gallery | 6: grid, masonry, carousel, lightbox, filmstrip, justified | 361 | conditional |
| navigation | 6: simple, centered, mega-menu, transparent, sidebar, pill | 523 | conditional |
| contact | 6: form, info-only, split, card-float, map-split, minimal-inline | 359 | conditional |
| footer | 6: simple, expanded, minimal, centered-stack, mega-footer, dark-gradient | 359 | conditional |
| stats | 3: row, grid, highlight | ~140 | separate functions |
| team | 2: grid, list | ~120 | separate functions |
| newsletter | 3: inline, popup, banner | 214 | conditional |
| about | 3: simple, split, story | 221 | separate functions |
| faq | 3: accordion, grid, simple | ~150 | conditional |
| cta | 3: banner, inline, floating | ~120 | switch + separate functions |

## Implementation Patterns

### Pattern A: Separate named functions (GOOD)
- `stats`: RowVariant, GridVariant, HighlightVariant
- `cta`: BannerVariant, InlineVariant, FloatingVariant
- `about`: SimpleVariant, SplitVariant, StoryVariant
- Uses design tokens (CSS_VARS import, var() styles)

### Pattern B: if/else chain in one function (RISKY)
- `hero`: 856 lines, massive if/else blocks
- Risk: variants may share code, later variants may be copypasta

## Key Files
- Config: `src/blocks/{name}/config.ts` — variants array, Zod schema, meta
- Component: `src/blocks/{name}/index.tsx` — renders all variants
- Shared: `src/blocks/shared/animations.tsx`, `decorative.tsx`, `use-count-up.ts`
