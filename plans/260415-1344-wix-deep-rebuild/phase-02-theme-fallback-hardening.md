# Phase 02 — Theme Fallback Hardening

## Context
- Parent: [plan.md](plan.md)
- Dependencies: none (parallel with 01)
- Related: [researcher-02 F2, F7.1](research/researcher-02-gen-flow-output.md)

## Overview
- Date: 2026-04-15
- Description: Replace dark cyan/magenta fallback in `resolve.ts` with sane light/neutral defaults. Audit `category-theme-picker` to ensure every category writes complete 6-color palette + colorMode + bg.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key Insights
- `src/lib/theme/resolve.ts:72-110` defaults to `colorMode='dark'`, primary `#0ea5e9`, secondary `#d946ef`, bg `#09090b`. Any site with incomplete `site.theme` → ugly dark cyan/magenta.
- If composer writes only 1-2 colors, resolver fills gaps → mismatch (e.g., light primary + dark bg).
- Open Q4: does `category-theme-picker.ts` write FULL palette or only primary/secondary? Must answer before changing resolver (risk of masking composer bug with defaults).
- Fix: (a) resolver defaults light + neutral, (b) colorMode default `'light'`, (c) harden category-theme-picker to always write all 6 fields.

## Requirements
- 0 generated sites rendering with fallback dark theme.
- `category-theme-picker` writes: primary, secondary, accent, background, foreground, muted + colorMode + borderRadius + shadow scale.
- Light mode for service/retail/professional; dark allowed only for entertainment/luxury/tech-premium categories.
- Resolver defaults are light + neutral (never cyan/magenta).

## Architecture
1. Audit `category-theme-picker.ts` output completeness. If incomplete, extend each category preset to full palette.
2. Change resolve.ts line 72+ defaults: `colorMode: 'light'`, `primary: '#111827'`, `secondary: '#374151'`, `bg: '#ffffff'`, `fg: '#0f172a'`, `muted: '#f9fafb'`.
3. Dev-time assertion in resolver: if `site.theme` missing ≥ 2 palette fields, `console.warn` with siteId + missing fields.

## Related code files
- `src/lib/theme/resolve.ts` (lines 72-110)
- `src/lib/ai/category-theme-picker.ts` (entire file)
- `src/lib/ai/template-composer.ts` (site.theme write call)
- `src/components/site-renderer/SiteRenderer.tsx` (lines 81-98)

## Implementation Steps
1. Read `category-theme-picker.ts` → count output fields per category.
2. If incomplete: extend each preset to full 6-color palette + colorMode + borderRadius + shadow.
3. Swap resolve.ts defaults to light neutral.
4. Add warn-on-incomplete assertion.
5. Regen 5 sites × 6 categories; verify all render light + branded (no cyan/magenta fallback).

## Todo list
- [ ] Audit category-theme-picker completeness per category
- [ ] Extend presets to full palette if incomplete
- [ ] Swap resolve.ts defaults to light neutral
- [ ] Add dev warn for incomplete palettes
- [ ] Regen 30 sites, verify no fallback

## Success Criteria
- resolve.ts defaults are light.
- All 15+ categories in picker write full 6-color palette.
- 0 warn logs during batch regen.

## Risk Assessment
- **Risk**: existing dark sites in DB re-render wrong after default flip. **Mitigation**: sites should have colorMode explicitly written; check DB before deploy.
- **Risk**: changing resolver defaults breaks editor preview (designed for dark). **Mitigation**: editor can force colorMode via prop override.

## Security Considerations
None.

## Next steps
Unblocks phase 03 (nav theme-aware dropdown) and 04 (visual variants that assume light mode).
