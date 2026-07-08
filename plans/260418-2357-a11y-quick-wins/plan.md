---
title: "A11y quick wins — nav ariaLabel + theme focusStyle + contrast audit"
description: "Fix 3 a11y gaps to push rubric v1.2 accessibility dim 6.3 → 9.0+"
status: pending
priority: P1
effort: 4h
branch: fix/F01-wave2-wix-detailed
tags: [a11y, rubric, nav, theme, f01]
created: 2026-04-18
---

# A11y Quick Wins

## Context

Rubric v1.2 baseline (2026-04-18) accessibility dimension = **6.3/10**. Per-criterion pass rate:

| Criterion | Pass rate | Status |
|---|---|---|
| alt-text-coverage-80 | **100%** | ✓ đã OK — gallery + testimonial images có alt (BuildGallery `alt: biz.name photo N`) — user's original concern đã resolved trước |
| heading-order-no-skip | 100% | ✓ OK |
| theme-color-contrast | 50% | ⚠️ half fail (190/390 templates) |
| nav-aria-label | **0%** | ❌ real gap — `ariaLabel` field không exist trong NavigationConfig schema |
| focus-indicator-defined | **0%** | ❌ real gap — `focusStyle` field không exist trong ThemePreset |

User's 3 fixes:
1. ~~Alt field cho testimonial avatars + gallery~~ → **already done** (skip)
2. **focusStyle token** → real fix needed
3. **ariaLabel cho navigation** → real fix needed

Bonus: `theme-color-contrast` 50% pass — audit which half fails + remediate specific presets.

## Research

Skip — scope tight + codebase contexts đã biết qua planning previous session:
- `src/blocks/navigation/config.ts` — NavigationConfig + NavigationConfigSchema
- `src/lib/ai/theme-presets.ts` — 112 ThemePreset entries (14 cat × 8 presets) với fixed shape
- `src/lib/ai/template-composer.ts:166` — buildNavigation() composer fn
- `scripts/test-harness/rubric/evaluators.ts` — navAriaLabel, focusIndicatorDefined, themeColorContrast checks

## Phases

| # | Phase | Effort | Status | File |
|---|---|---|---|---|
| 01 | Nav ariaLabel field + composer emit | 1h | pending | [phase-01-nav-aria-label.md](phase-01-nav-aria-label.md) |
| 02 | Theme focusStyle token + apply 112 presets | 1.5h | pending | [phase-02-theme-focus-style.md](phase-02-theme-focus-style.md) |
| 03 | Theme contrast audit + fix failing primary colors | 1h | pending | [phase-03-theme-contrast.md](phase-03-theme-contrast.md) |
| 04 | Regen matrix + re-score + verify dim 6.3→9.0 | 0.5h | pending | [phase-04-verify.md](phase-04-verify.md) |

Total: **4h**. Critical path 01 → 02 → 03 → 04.

## Goal

Rubric v1.2 accessibility dim: **6.3 → 9.0+**
- nav-aria-label: 0% → 100%
- focus-indicator-defined: 0% → 100%
- theme-color-contrast: 50% → 90%+

Overall rubric avg: **8.37 → 8.7-8.9**

Real UX win: **WCAG 2.1 AA compliance** — screen readers announce nav context properly, keyboard users see focus rings.

## Architecture Decisions

1. **NavigationConfig extension**: add `ariaLabel?: string` (optional, default = "Main navigation"). Composer emits category-specific (e.g., "Restaurant navigation").
2. **NavLink.title?: string**: optional tooltip/ARIA description per link.
3. **ThemePreset extension**: add `focusStyle: string` (required, default = `'ring-2 ring-offset-2'` — Tailwind class applied to `:focus-visible`).
4. **Theme contrast**: audit 195 failing templates → change specific presets' primary/secondary to meet 4.5:1. Document which changed.

## Out of Scope

- v1.3 new a11y criteria (skip-link, tab order, ARIA landmarks beyond nav) — separate plan
- Runtime a11y testing (axe-core, Lighthouse) — separate plan
- Screen reader manual testing — QA workflow
