# Phase 01 — Nav Rebuild Residual

## Context

- Parent: [plan.md](plan.md)
- Original phase: [`260415-1344-wix-deep-rebuild/phase-03-navigation-rebuild.md`](../260415-1344-wix-deep-rebuild/phase-03-navigation-rebuild.md)
- Dependencies: Phase 01+02 of parent plan (shipped via wave1) ✅

## Overview

- Date: 2026-04-19
- Description: Close navigation residual gaps left after wave1 shipped CTA resolution. Targets: theme-aware dropdown, logo image slot, scroll-shrink, optional file split refactor.
- Priority: P1 (downgraded from P0 — user-facing issues smaller post-wave1)
- Implementation status: pending
- Review status: pending

## Key Insights

- `src/blocks/navigation/index.tsx` = 955 LOC with 5 variant functions inline (TransparentNav, SidebarNav, CenteredNav, MegaMenuNav, PillNav) + 7 helper components.
- `resolveCTA` + `resolveNavCtaUrl(pages)` ALREADY wired → no broken link bug left.
- `buildNavigation` in composer sets `logoText` (string) only; no `logoSrc`. Schema mod required.
- File split is pure tech debt — no user-visible value. Tight scope = skip the split.

## Scope menu

### Tight (1-2h) — user-facing fixes only
- [ ] Grep + replace hardcoded `#0F172A` with theme CSS var (`var(--theme-surface)` or `CSS_VARS.surface`)
- [ ] Add `selectVariantBySeed` call in `buildNavigation` so nav variant rotates per site

### Medium (+2-3h) — visual polish
- [ ] Logo image slot:
  - Add `logoSrc?: string` to `NavigationConfig` Zod + Payload schema (`src/collections/Pages.ts`)
  - Add migration entry in `scripts/db-setup.js` (per project rule)
  - Render `<img src={logoSrc}>` with `logoText` fallback in `NavLogo` component
  - Thread `biz.logo?.url` in composer `buildNavigation`
- [ ] Scroll-shrink hook (`helpers/use-scroll-shrink.ts`) — respects `prefers-reduced-motion`
- [ ] Apply scroll-shrink to `transparent` + `centered` variants

### Full (+4-6h) — file split refactor (tech debt)
- [ ] Extract 5 variants to `navigation/variants/*.tsx` — each ≤ 180 LOC
- [ ] Extract helpers to `navigation/helpers/{logo,mobile-drawer,use-scroll-shrink}.tsx`
- [ ] Dispatcher `navigation/index.tsx` ≤ 40 LOC
- [ ] Mobile drawer focus trap + ESC close + scroll lock

## Requirements

- Zero hardcoded dark colors (`#0F172A`, `#0B1120`, etc.) in nav module
- Variant rotation produces ≥ 3 different variants across 10 seeds for same category
- (Medium+) logo image falls back to text if unset; never renders broken `<img>`
- (Full+) no file in `navigation/` exceeds 180 LOC

## Architecture

### Tight
Surgical edits — no restructure. Grep replace + add seed call.

### Medium
```
src/blocks/navigation/
├── index.tsx                    # existing monolith, add logoSrc rendering
├── helpers/
│   └── use-scroll-shrink.ts    # NEW
└── config.ts                    # add logoSrc?: string
```

### Full (per original plan)
```
src/blocks/navigation/
├── index.tsx                    # dispatcher ≤40 LOC
├── variants/
│   ├── simple.tsx
│   ├── centered.tsx
│   ├── mega-menu.tsx
│   ├── transparent.tsx
│   ├── sidebar.tsx
│   └── pill.tsx
├── helpers/
│   ├── logo.tsx
│   ├── mobile-drawer.tsx
│   └── use-scroll-shrink.ts
```

## Related code files

- `src/blocks/navigation/index.tsx` (955 LOC — monolith)
- `src/blocks/navigation/config.ts`
- `src/lib/ai/template-composer.ts:162-183` (`buildNavigation`)
- `src/collections/Pages.ts` (Payload schema)
- `scripts/db-setup.js` (migration)
- `src/blocks/hero/variants/*.tsx` + `src/blocks/hero/_overlay.tsx` (reference pattern)

## Implementation Steps

### Tight scope
1. `grep -n "#0F172A\|#0B1120" src/blocks/navigation/index.tsx` → map each hit to theme CSS var
2. Replace with `var(--theme-surface)` or equivalent CSS var
3. Verify `src/lib/theme/resolve.ts` exports surface color in CSS_VARS
4. In `buildNavigation` composer, add `variant: selectVariantBySeed(NAV_VARIANTS, seed)` where NAV_VARIANTS is the existing pool table
5. Run `pnpm test`; manual visual spot-check via harness

### Medium scope (on top of tight)
6. Add `logoSrc: z.string().optional()` to `NavigationConfig` in `config.ts`
7. Add Payload field in `Pages.ts` navigation block
8. Add migration to `scripts/db-setup.js` (follow pattern from existing array fields)
9. Render logo image in `NavLogo` with `logoText` fallback
10. Thread `logoSrc: biz.logo?.url` in composer `buildNavigation`
11. Create `src/blocks/navigation/helpers/use-scroll-shrink.ts` with `prefers-reduced-motion` guard
12. Apply hook to `TransparentNav` + `CenteredNav`

### Full scope (on top of medium)
13. Document each inline variant's sections (read + grep)
14. Extract helpers first (`NavLogo`, `NavCTAButton`, `NavMobileMenuDrawer`, etc.)
15. Move each `*Nav` function to `variants/{slug}.tsx`, keep export
16. Rewire dispatcher in `index.tsx` to import from `variants/`
17. Add focus trap to mobile drawer (use existing `focus-trap` util if present)
18. Full visual QA: 3 themes × 6 variants = 18 screenshots

## Todo list (tight-scope default, expand per chosen scope)

- [ ] Tight: grep + replace hardcoded dark colors
- [ ] Tight: add `selectVariantBySeed` in `buildNavigation`
- [ ] Tight: `pnpm test` green
- [ ] Medium: add `logoSrc?` schema + migration
- [ ] Medium: render logo image with fallback
- [ ] Medium: `use-scroll-shrink` hook
- [ ] Full: split to `variants/` + `helpers/`
- [ ] Full: mobile drawer focus trap

## Success Criteria

**Tight**: 0 hardcoded dark colors in nav; variant rotation works per seed.
**Medium**: + logo image renders when set; scroll-shrink works with reduced-motion.
**Full**: + no file > 180 LOC; all 6 variants pass visual QA in light + dark themes.

## Risk Assessment

- **Medium — migration conflict**: adding `logoSrc` requires schema migration. Low risk (additive column) but must follow project migration rules + CI `check-migrations.js`.
- **Low — theme var fallback**: if `--theme-surface` not defined, nav will render with browser default (bad but not broken). Mitigate by adding fallback in `CSS_VARS` if missing.
- **High (full scope) — refactor regression**: 955 → 6+ files is large surface area. Ship behind branch + manual QA for every variant.

## Security Considerations

- Logo image: if `biz.logo?.url` is user-supplied, must validate URL before render. Existing media pipeline likely handles this (Media IDs, not raw URLs). Verify.

## Next steps

- Phase 02 (form polish) runs parallel.
- Post-phase: close parent plan `260415-1344-wix-deep-rebuild` with appropriate status.
