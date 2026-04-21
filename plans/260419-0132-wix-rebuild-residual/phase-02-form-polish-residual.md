# Phase 02 — Form Polish Residual

## Context

- Parent: [plan.md](plan.md)
- Original phase: [`260415-1344-wix-deep-rebuild/phase-07-footer-form-polish.md`](../260415-1344-wix-deep-rebuild/phase-07-footer-form-polish.md)
- Dependencies: none (parallel-safe with Phase 01)

## Overview

- Date: 2026-04-19
- Description: Close form/font polish residuals. Half of original Phase 07 shipped (contact hook + API route + wiring). Remaining: footer newsletter wire, font pairing pool + seed rotation, tiktok SVG, hero CTA audit.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights

- Footer `src/blocks/footer/index.tsx` = 551 LOC, 0 refs to `useNewsletterForm` → newsletter inputs in mega-footer + expanded variants are **inert**. Broken funnel.
- Contact block ALREADY wired: `useContactForm` imported + used at `src/blocks/contact/index.tsx:171`. Skip rework.
- Font pairings live at `src/lib/ai/font-pairings.ts` (not `src/lib/theme/` as original plan said). Exports `resolveFontPairing(id)` but NO pool + NO seed selector.
- `resolveCTA` exists for hero. 9 raw `/contact` refs in composer — but most are pricing-card CTAs (user-facing labels) or page slug definitions, not hero bugs.

## Scope menu

### Tight (2h) — real user-visible fixes
- [ ] Footer newsletter wiring (45m)
- [ ] Font pairing pool + seed rotation (1-1.5h)
- [ ] Tiktok SVG icon (15m)

### Medium (+1.5h) — polish
- [ ] Footer reveal-on-scroll stagger animations
- [ ] Hero CTA audit: grep + fix the 2-3 real bugs (not pricing item CTAs)

### Full (+1h) — variant diversity
- [ ] Contact input style variation per variant (underline, floating-label, outlined, filled, glass)

## Requirements

- Footer newsletter POST to `/api/subscribe` from at least mega-footer + expanded variants
- Font pairing rotates ≥ 3 pairs across 10 same-category seeds
- Tiktok SVG renders (not `<span>` fallback)
- (Medium) hero CTAs resolve via `resolveCTA` — no `/contact` href when no contact page exists

## Architecture

### Footer newsletter wiring
Reuse existing `useNewsletterForm` hook from `src/blocks/newsletter/useNewsletterForm.ts`. Import in footer variants that render email input. Wrap `<form>` with `onSubmit={handleSubmit}`. Surface toast via existing pattern.

### Font pairing rotation
```ts
// src/lib/ai/font-pairings.ts (extend existing file)
export const FONT_PAIRING_POOL: Record<string, string[]> = {
  restaurant: ['playfair-inter', 'cormorant-lato', 'librebaskerville-raleway'],
  ecommerce:  ['dmserifdisplay-dmsans', 'outfit-inter', 'spacegrotesk-inter'],
  // ... 14 categories, 3 pairs each
  default:    ['outfit-inter', 'poppins-inter', 'plusjakartasans-inter'],
}

export function selectFontPairingBySeed(category: string, seed: number): string {
  const pool = FONT_PAIRING_POOL[category] ?? FONT_PAIRING_POOL.default
  return pool[seed % pool.length]
}
```

Call from composer theme write (`buildSite` or `pickCategoryTheme`).

### Tiktok SVG
Inline SVG or lucide icon (check if `@lucide/react` has `SiTiktok` from simple-icons).

## Related code files

- `src/blocks/footer/index.tsx` (551 LOC — add newsletter wiring)
- `src/blocks/newsletter/useNewsletterForm.ts` (hook to reuse)
- `src/lib/ai/font-pairings.ts` (extend)
- `src/lib/ai/template-composer.ts` (call font selector in theme write; hero CTA audit)
- `src/app/api/subscribe/route.ts` (already exists)

## Implementation Steps

### Tight scope
1. `grep -n "email\|newsletter" src/blocks/footer/index.tsx` — locate 2-3 newsletter form sites
2. Import `useNewsletterForm` hook
3. Wire each form: extract email state + `handleSubmit` + render error/success states
4. Unit test: mock fetch, assert POST to `/api/subscribe` called on submit
5. Extend `font-pairings.ts` with `FONT_PAIRING_POOL` + `selectFontPairingBySeed`
6. Validate all pool IDs exist in existing `FONT_PAIRINGS` map (Zod assertion or runtime check in unit test)
7. Call `selectFontPairingBySeed(category, seed)` in composer theme assembly
8. Add TC-ID `F01-FONT-ROTATE-01..03` unit tests
9. Replace tiktok `<span>` fallback with SVG (lucide or inline)

### Medium scope (on top of tight)
10. Wrap footer columns in `AnimatedSection` w/ stagger index
11. `grep -n "'/contact'\|\"/contact\"" src/lib/ai/template-composer.ts` → audit each:
    - If inside hero builder → replace with `resolveCTA(mood, category, 'primary')`
    - If inside pricing/service-cards item CTA → leave (valid navigation intent)
    - If inside page slug def → leave (route registration)

### Full scope (on top of medium)
12. Analyze contact block variants: identify existing input style
13. Add 5 style variants (underline, floating-label, outlined, filled, glass)
14. Map variant name → input style via lookup
15. Visual QA: screenshot each contact variant with 3 themes

## Todo list

- [ ] Tight: footer newsletter wiring (2-3 forms)
- [ ] Tight: `FONT_PAIRING_POOL` + `selectFontPairingBySeed`
- [ ] Tight: composer calls font selector
- [ ] Tight: font rotation unit tests (TC-F01-FONT-ROTATE-01..03)
- [ ] Tight: tiktok SVG icon replace
- [ ] Medium: footer reveal stagger animations
- [ ] Medium: hero `/contact` audit + fix real bugs
- [ ] Full: contact input style variants

## Success Criteria

**Tight**: footer newsletter submits; font rotates ≥ 3 pairs same category; tiktok SVG renders.
**Medium**: footer columns animate on scroll; hero has 0 broken `/contact` links in 10-site regen.
**Full**: contact variants visually distinct across 5 input styles.

## Risk Assessment

- **Low — newsletter hook reuse**: pattern proven in existing newsletter block.
- **Medium — font pool validation**: if pool ID doesn't exist in `FONT_PAIRINGS`, composer output invalid font. Mitigate: unit test asserts every pool ID is a valid `FONT_PAIRINGS` key.
- **Low — tiktok icon**: cosmetic, non-blocking.
- **Low — hero audit**: grep + manual review, small diff.

## Security Considerations

- Newsletter already validates email via existing hook. No new surface.
- Contact already wired. No change here.

## Next steps

- Post-phase: optional `/ck:plan:archive` for parent `260415-1344-wix-deep-rebuild`.
- Could fold residual wave 2 items (harness cleanup from `260418-1740`) into a separate sprint.
