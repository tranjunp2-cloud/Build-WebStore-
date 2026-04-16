# Phase 05 — Thin Block Expansion

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 01, 02
- Related: [researcher-01 §9-13](research/researcher-01-component-status.md)

## Overview
- Date: 2026-04-15
- Description: Grow thin blocks to 5-6 variants each. Upgrade weakest block (team). Replace features.icon string with lucide icon component. Add variants covering common Wix section patterns missing today.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights
- Thin blocks: team=2, cta=3, about=3, stats=3, newsletter=3, faq=3.
- `team` is weakest: 2 variants, social pills as TEXT not icons, no bio-expand, no filter, no horizontal scroll, no org-chart.
- `features.icon` stored as string (emoji/single char) → quality depends on user input. Use lucide `LucideIcon` component picker.
- `cta` banner hardcodes `linear-gradient(135deg, primary, secondary)` → every site identical banner.

## Requirements
- **team**: grid, list, **cards-hover-reveal**, **horizontal-scroll**, **bio-modal**, **compact-row** (6 variants). Swap text pills for lucide icons. Add bio-expand modal w/ focus trap.
- **cta**: banner, inline, floating, **image-bg**, **split-testimonial**, **dark-card**, **mesh-gradient**, **urgency-timer** (8 variants).
- **about**: simple, split, story, **mission-vision-values**, **stats-inline**, **founder-quote**, **timeline-image** (7 variants).
- **stats**: row, grid, highlight, **icon-cards**, **trend-arrows**, **bg-image** (6 variants). Add icon per stat.
- **newsletter**: inline, popup, banner, **lead-magnet**, **social-proof-count**, **multi-step** (6 variants). Verify popup is real `<dialog>` (Open Q1).
- **faq**: accordion, grid, simple, **numbered**, **category-tabs**, **search-filter** (6 variants).
- **features**: replace `icon: string` with `icon: LucideIconName` union; composer migration maps emoji → icon.

## Architecture
- Per block: split into `variants/` subdir if > 300 LOC after expansion.
- Shared icon: `src/blocks/_shared/lucide-icon.tsx` wraps `lucide-react` with fallback.
- Bio modal: `src/blocks/_shared/bio-modal.tsx` (reusable: team, testimonials, about).

## Related code files
- `src/blocks/team/index.tsx` (181 LOC, 2 variants)
- `src/blocks/cta/index.tsx` (146 LOC, 3 variants)
- `src/blocks/about/index.tsx` (238 LOC, 3 variants)
- `src/blocks/stats/index.tsx` (204 LOC, 3 variants)
- `src/blocks/newsletter/index.tsx` (230 LOC, 3 variants)
- `src/blocks/faq/index.tsx` (205 LOC, 3 variants)
- `src/blocks/features/index.tsx` (icon field migration)

## Implementation Steps
1. Build `_shared/lucide-icon.tsx` + `_shared/bio-modal.tsx`.
2. Team: 4 new variants + swap pills for icons + bio modal.
3. CTA: 5 new variants incl. image-bg/mesh/urgency.
4. About: 4 new variants (mission-vision-values, stats-inline, founder-quote, timeline-image).
5. Stats: 3 new variants w/ icon + bg-image.
6. Newsletter: 3 new variants; verify popup modal; wire to `/api/subscribe`.
7. FAQ: 3 new variants (numbered, category-tabs, search-filter).
8. Features: migrate icon string → lucide name; composer migration.
9. Extend CATEGORY_X_VARIANTS tables (Phase 01) with new variant names.

## Todo list
- [ ] Build _shared/lucide-icon + bio-modal
- [ ] Team +4 variants + icon + modal
- [ ] CTA +5 variants
- [ ] About +4 variants
- [ ] Stats +3 variants
- [ ] Newsletter +3 variants + popup verify
- [ ] FAQ +3 variants
- [ ] Features icon lucide migration
- [ ] Update phase-01 variant tables

## Success Criteria
- team ≥ 5, cta ≥ 6, about ≥ 6, stats ≥ 5, newsletter ≥ 5, faq ≥ 5 variants.
- Team social icons are lucide (0 text-pill renders).
- Newsletter popup is real `<dialog>` (focus trap + scroll lock).
- Features icon field is `LucideIconName` union.

## Risk Assessment
- **Risk**: lucide dynamic import increases bundle. **Mitigation**: named imports only, ≤ 20 icons shipped.
- **Risk**: composer migration breaks existing `features.icon: "🚀"`. **Mitigation**: fallback lookup emoji → lucide name; else render emoji as-is.

## Security Considerations
- Bio modal + newsletter popup: focus trap, scroll lock, ESC close.

## Next steps
Parallel with 04 and 06.
