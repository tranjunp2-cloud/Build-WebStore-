# Phase 01 — C1 Nav Polish (Consolidate)

## Context
- Parent: [plan.md](plan.md)
- Research: [researcher-02-c1-e1-scope](research/researcher-02-c1-e1-scope.md)
- Related: `plans/260415-1344-wix-deep-rebuild/nav-bugfix-followup.md` (4 fixes done)

## Overview
- Date: 2026-04-17
- Description: Trim nav 967 LOC — consolidate 3 copies of `CTA_GRADIENT_STYLE`, extract magic opacity numbers, remove dead `motionWrap` prop. 70% of nav polish đã done trong 260415; phase này close loose ends.
- Priority: P1
- Implementation status: pending

## Key Insights
- Nav file `src/blocks/navigation/index.tsx` = **967 lines, 6 variants** (simple, transparent, sidebar, centered, mega-menu, pill).
- `nav-bugfix-followup.md` đã fix: CTA URL fallback, variant simple default removed, NavLogo shared, useScrollShrink hook.
- **Remaining**: `CTA_GRADIENT_STYLE` duplicated 3 places (L263, 606, 909). Magic numbers `0.800`, `0.188` scattered. `motionWrap` prop at L227 — unused in Pill + Sidebar variants.

## Requirements
- 1 shared `CTA_GRADIENT_STYLE` constant, 3 call sites import.
- Extract magic opacity: `NAV_CTA_OVERLAY_OPACITY = 0.8`, `NAV_CTA_SHADOW_OPACITY = 0.188` as named constants.
- Remove `motionWrap` prop từ `NavCTAButton` signature + 4 call sites không dùng.
- No visual regression — snapshot before + after identical.

## Architecture
**Extract to module top**:
```ts
const CTA_GRADIENT_STYLE = {
  background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), ${NAV_CTA_OVERLAY_OPACITY}), rgba(var(--brand-secondary-rgb), ${NAV_CTA_OVERLAY_OPACITY}))`,
  boxShadow: `0 4px 20px rgba(var(--brand-primary-rgb), ${NAV_CTA_SHADOW_OPACITY})`,
}
const NAV_CTA_OVERLAY_OPACITY = 0.8
const NAV_CTA_SHADOW_OPACITY = 0.188
```

**Remove `motionWrap`** từ `NavCTAButton({ motionWrap }: ...)` + call sites L263/606/909. Chỉ giữ motion wrap logic inline nơi có dùng (Pill ✓, Sidebar ✓ theo research = đã dùng → check kỹ, có thể implement hay skip). Default: remove.

## Related code files
- `src/blocks/navigation/index.tsx` (entire file)

## Implementation Steps
1. Read `navigation/index.tsx` L200-230 full (NavCTAButton + CTA_GRADIENT_STYLE).
2. Verify `motionWrap` usage: grep `motionWrap` across 6 variants. If any variant uses it → implement properly; else remove.
3. Extract constants to top (after imports):
   - `CTA_GRADIENT_STYLE`
   - `NAV_CTA_OVERLAY_OPACITY`
   - `NAV_CTA_SHADOW_OPACITY`
4. Replace 3 duplicate gradient style objects (L263, 606, 909) với `CTA_GRADIENT_STYLE` import.
5. Remove `motionWrap` from prop signature + call sites (if unused).
6. Visual snapshot test: if Playwright setup exists → capture before/after.
7. Unit test: `navigation-cta.test.ts` (if exists) must still pass.

## Todo list
- [ ] Audit `motionWrap` usage per variant
- [ ] Extract `CTA_GRADIENT_STYLE` + opacity constants
- [ ] Replace 3 duplicates
- [ ] Remove dead `motionWrap` prop
- [ ] Run `navigation/*.test.ts` (existing 12-test suite)
- [ ] TSC clean
- [ ] Commit: `fix(f01): C1 nav consolidate — gradient constant + remove dead motionWrap`

## Success Criteria
- Nav LOC ≤ 900.
- 0 duplicated gradient style literals (grep `linear-gradient(135deg` = 1 match in const).
- TypeScript clean.
- 12/12 nav tests pass (no regression).

## Risk Assessment
- **Risk**: `motionWrap` may be implicitly used by Pill's framer-motion wrapper → removal breaks animation. **Mitigation**: grep `whileHover|whileTap` near `motionWrap` calls; if related, keep + document.
- **Risk**: Extract constant changes reference identity → React re-renders. **Mitigation**: use `const` outside component scope, stable reference.

## Security Considerations
None — display-only consolidation.

## Next steps
Phase 02 (E1) can run parallel.
