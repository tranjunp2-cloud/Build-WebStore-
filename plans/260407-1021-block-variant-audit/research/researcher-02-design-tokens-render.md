# Research: Design Tokens & Render Pipeline

## Design Token System
**File**: `src/lib/theme/resolve.ts` (236 lines)

### CSS Variables (globals.css:6-17)
- Colors: `--brand-primary`, `--brand-accent`, `--brand-dark`, `--surface-*`, `--text-*`, `--border`
- Spacing: `--space-xs` → `--space-2xl`, `--section-padding`
- Radius: `--radius-sm/md/lg/full`
- Shadows: `--shadow-sm/md/lg`

### Presets in resolve.ts
- **SPACING_PRESETS**: compact, default, relaxed
- **RADIUS_PRESETS**: sharp, subtle, rounded, soft, pill
- **SHADOW_PRESETS**: none, subtle, medium, dramatic

### CSS_VARS Constant (lines 203-235)
- Exported object for blocks to import: `CSS_VARS.primary`, `CSS_VARS.accent`, etc.
- Prevents typos in CSS variable names

## Token Usage in Blocks (Observed)
- **hero**: Uses `CSS_VARS` import + inline var() styles + GradientBlob/DotGrid decoratives
- **stats**: Uses var(--text), var(--surface), var(--brand-primary), var(--font-heading), var(--muted)
- **cta**: Uses var(--brand-primary), var(--radius-md), var(--shadow-lg), var(--brand-secondary)
- **about**: Uses var(--text), var(--background), var(--brand-primary-rgb), var(--radius-lg)
- **newsletter**: Uses var(--brand-primary-rgb), var(--radius-md), var(--text)

**Issue**: Not all blocks use ALL available tokens. Many miss spacing/shadow/radius presets.

## Render Pipeline
1. `SiteRenderer.tsx` calls `resolveTheme()` → generates CSS → injects `<style>` tag
2. Gets `BlockComponent` from `blockRegistry.getComponent(block.blockType)`
3. Passes `{ block, theme, site, page }` props
4. Block reads `block.variant` and renders appropriate layout

## Responsive Strategy
- 100% Tailwind breakpoints (`md:`, `lg:`, `sm:` prefixes)
- Grid responsive: `grid-cols-1 lg:grid-cols-2`
- Flex wrapping: `flex flex-wrap`
- Container: `container mx-auto px-6`
- NO separate media queries, NO container queries

## Variant Selection UI (SettingsPanel.tsx:646-660)
- Shows variant buttons when `variants.length > 1`
- Calls `onBlockFieldChange(currentBlockIndex, 'variant', variantName)` on click
- Active: `bg-blue-500/15 text-blue-400 border border-blue-500/30`
- NO preview thumbnails — text-only buttons

## Risks Found
1. No variant preview images — user can't see what variant looks like before selecting
2. Blocks may have "dead" variants (defined in config but render falls through to default)
3. No automated test for variant rendering
