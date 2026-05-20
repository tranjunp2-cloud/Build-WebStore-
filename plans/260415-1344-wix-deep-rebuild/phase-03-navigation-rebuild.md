# Phase 03 — Navigation Rebuild

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 01 (variant wiring), Phase 02 (theme defaults)
- Related: [researcher-01 §1](research/researcher-01-component-status.md), [researcher-02 F4](research/researcher-02-gen-flow-output.md)

## Overview
- Date: 2026-04-15
- Description: Split 924-LOC `navigation/index.tsx` monolith into `variants/` subdir (hero pattern). Add 4 real variants, logo image support, theme-aware dropdown, real page-slug CTA resolution, scroll-shrink, transparent-over-hero.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key Insights
- Current nav is 924 LOC in one file w/ 6 variants all inline. Hardcodes `bg-[#0F172A]/95` dropdown regardless of theme.
- Composer `buildNavigation` (template-composer.ts:142-159) only sets `logoText` (string), no logo image, hardcoded variant `simple`, CTA hardcoded `/contact` even when no contact page exists.
- `applyGlobalSystemBlocks` in SiteRenderer.tsx:52-78 silently overwrites page nav with stored `headerBlock` — hides regen issues. Needs doc comment.
- Must answer research Q5 (is headerBlock always pre-populated?) before touching.

## Requirements
- Split into `src/blocks/navigation/variants/{simple,centered,mega-menu,transparent,sidebar,pill}.tsx` + dispatcher `index.tsx`.
- Each variant ≤ 180 LOC.
- Theme-aware dropdown (`bg-[color:var(--theme-surface)]` not hardcoded `#0F172A`).
- Logo image slot (`logoSrc?: string`) with fallback to `logoText`.
- Scroll-shrink + blur-on-scroll for `transparent` variant.
- CTA resolves to real page slug: only emit `/contact` if `pages.some(p => p.slug === 'contact')`, else first CTA page or `/#contact` anchor.
- Mobile drawer: focus trap, scroll lock, ESC close.
- Composer threads `logoSrc` from site.logo field if present.

## Architecture
```
src/blocks/navigation/
├── index.tsx           # dispatcher (≤40 LOC)
├── variants/
│   ├── simple.tsx
│   ├── centered.tsx
│   ├── mega-menu.tsx
│   ├── transparent.tsx
│   ├── sidebar.tsx
│   └── pill.tsx
├── helpers/
│   ├── use-scroll-shrink.ts
│   ├── mobile-drawer.tsx
│   └── logo.tsx
```

## Related code files
- `src/blocks/navigation/index.tsx` (924 LOC — split)
- `src/lib/ai/template-composer.ts:142-159`
- `src/components/site-renderer/SiteRenderer.tsx:52-78`
- `src/blocks/hero/index.tsx` + `src/blocks/hero/variants/*` (reference pattern)

## Implementation Steps
1. Read current navigation/index.tsx, document each variant's sections.
2. Extract helpers (logo, mobile-drawer, use-scroll-shrink).
3. Move each variant into `variants/*.tsx`, rewire dispatcher.
4. Replace hardcoded `bg-[#0F172A]/95` with theme CSS var.
5. Add `logoSrc` prop with Image component + fallback chain.
6. Implement scroll-shrink hook (respects prefers-reduced-motion).
7. Update `buildNavigation` to thread `logoSrc: biz.logo?.url`, resolve CTA via `findPage('contact') ?? firstCtaPage`, use `selectVariantBySeed`.
8. Answer research Q5 by reading `applyGlobalSystemBlocks` behavior; add doc comment if gotcha confirmed.
9. Verify all 6 variants render with 3 themes (light, dark, brand-colored).

## Todo list
- [ ] Read + document current nav monolith
- [ ] Extract helpers
- [ ] Move variants to subdir
- [ ] Theme-aware dropdown
- [ ] Logo image slot + composer thread
- [ ] Scroll-shrink hook
- [ ] Real page slug CTA resolution
- [ ] Mobile drawer focus trap
- [ ] Variant rotation via selectVariantBySeed
- [ ] Document headerBlock gotcha

## Success Criteria
- No file > 180 LOC in navigation/.
- All 6 variants pass visual QA in light + dark themes.
- 0 hardcoded dark bg colors remain.
- Composer threads logo image + real CTA slug.
- Mobile drawer passes axe accessibility audit.

## Risk Assessment
- **Risk**: splitting monolith breaks existing stored pages that reference nav props. **Mitigation**: preserve prop interface exactly; only internal structure changes.
- **Risk**: `applyGlobalSystemBlocks` silently reverts changes during regen. **Mitigation**: document + optionally add regen flag that respects new nav.

## Security Considerations
- Mobile drawer focus trap to prevent focus escape.
- Sanitize `logoSrc` URL (allow only cdn/trusted domains).

## Next steps
Most-visible block done. Phases 04-06 can run in parallel.
