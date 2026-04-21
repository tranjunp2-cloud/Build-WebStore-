---
title: "Wix-Deep Rebuild Residual — Phase 03 (nav) + Phase 07 (form polish) gaps"
description: "5/7 wix-deep-rebuild phases shipped via wave1+wave2. Remaining: nav monolith refactor + theme dropdown + logo slot + scroll-shrink (Phase 03) + footer newsletter wire + font rotation + tiktok icon (Phase 07)."
status: done
priority: P1
effort: 6-14h (scope-dependent)
branch: fix/F01-wave1-completion
tags: [wix, nav, footer, forms, font-rotation, f01]
created: 2026-04-19
---

# Wix-Deep Rebuild Residual

## Context

Parent plan: [`260415-1344-wix-deep-rebuild`](../260415-1344-wix-deep-rebuild/plan.md). 5/7 phases shipped:
- Phase 01 (variant wiring) ✅ wave 1
- Phase 02 (theme fallback) ✅ wave 1
- Phase 04 (visual diversity) ✅ wave 2 PR #697
- Phase 05 (thin block expansion) ✅ wave 2 a5
- Phase 06 (image pool coverage) ✅ wave 1 C2

Remaining:
- Phase 03 (nav rebuild) — partial
- Phase 07 (footer + form polish) — partial

## Current state (2026-04-19, on origin/staging)

### Nav (Phase 03)
| Item | State |
|---|---|
| `resolveCTA` + `resolveNavCtaUrl` helpers | ✅ shipped (composer L143+) |
| `buildNavigation` calls `resolveCTA` | ✅ shipped |
| File split `navigation/variants/*.tsx` | ❌ still 955 LOC monolith |
| Theme-aware dropdown (no hardcoded `#0F172A`) | ❓ verify |
| Logo image slot (`logoSrc?: string`) | ❌ not started |
| Scroll-shrink hook | ❌ not started |
| Mobile drawer focus trap | ❓ verify |
| `selectVariantBySeed` in composer nav | ❌ not done |

### Forms (Phase 07)
| Item | State |
|---|---|
| `useContactForm` hook | ✅ exists |
| `/api/contact-submit` route | ✅ exists |
| Contact block wired to hook | ✅ L171 of contact/index.tsx |
| Footer newsletter wired | ❌ 0 refs to `useNewsletterForm` in footer |
| Footer reveal animations | ⚠️ 4 refs, partial |
| Tiktok SVG (not `<span>`) | ❓ verify |
| `FONT_PAIRING_POOL` + `selectFontPairingBySeed` | ❌ only `resolveFontPairing(id)` exists |
| Hero CTA resolver | ⚠️ `resolveCTA` covers hero but 9 raw `/contact` refs remain (items, pricing, slug defs) |

## Phase Overview

Scope menu — user picks tight/medium/full:

| # | Phase | Priority | Effort | Value |
|---|---|---|---|---|
| [01](phase-01-nav-residual.md) | Nav Rebuild Residual | P1 | 6-10h | Mostly tech debt; user-facing polish = theme dropdown + logo slot + scroll-shrink |
| [02](phase-02-form-polish-residual.md) | Form Polish Residual | P1 | 2-4h | Footer newsletter wire (broken form fix) + font rotation (visual variety) |

**Total**: 8-14h full | **2-4h tight subset** (footer newsletter + font rotation + theme dropdown only)

## Dependency Graph

```
01 (nav) ‖ 02 (forms)  — both independent, can ship parallel or serial
```

No hard dependencies between phases.

## Scope decision framework

**Tight (2-4h, recommended P1)**:
- Footer newsletter form wiring (30-45m) — fixes broken funnel
- `FONT_PAIRING_POOL` + seed rotation (1.5-2h) — aligns with wave2 visual variety goals
- Theme-aware dropdown swap in nav (30m) — kills hardcoded `#0F172A` ugly

**Medium (6-8h, P1+P2)**:
- Tight + nav logo image slot (1h) + scroll-shrink hook (1h) + tiktok SVG (15m)

**Full (12-14h, P1+P2+tech-debt)**:
- Medium + nav file split (4-6h) + mobile drawer polish + contact input variant styles

Recommend **Tight** first, defer larger refactors unless user prioritizes.

## Success Metrics

1. Footer newsletter POST hits `/api/subscribe` from at least 2 footer variants
2. Font pairing rotates ≥ 3 pairs across 10 sites of same category (seeded)
3. 0 hardcoded `#0F172A` in `navigation/index.tsx`
4. Nav file ≤ 180 LOC per variant (if split phase chosen)
5. Hero CTAs: 0 broken links in 10-site regen QA

## Research

- [Researcher state audit](research/researcher-nav-form-state.md) — inline audit in this plan (phase files have details)

## Related Plans

- [`260415-1344-wix-deep-rebuild`](../260415-1344-wix-deep-rebuild/plan.md) — parent (this closes residual)
- [`260417-0817-wave1-wix-detailed-plan`](../260417-0817-wave1-wix-detailed-plan/plan.md) — wave 1 sibling (done)
- [`260418-1740-wave2-continuation-harness-cleanup`](../260418-1740-wave2-continuation-harness-cleanup/plan.md) — wave 2 harness cleanup (pending)

## Open Questions

1. **Phase 03 priority**: Nav file split is tech debt — still P0 post-wave1/wave2, or downgrade to P2?
2. **Logo image slot**: requires schema change (`navigation.logoSrc` field in Zod + Payload + migration). Worth the cost vs keeping text logo?
3. **Font rotation scope**: 14 categories × 3 pairs = 42 combinations — or simpler per-category default + global pool?
4. **Hero CTA cleanup**: 9 raw `/contact` refs include valid anchors (pricing items emit user-facing CTAs). Only 2-3 are actual bugs. Worth full audit or skip?

## Changelog

- **2026-04-19** — Plan created after audit confirmed 5/7 phases shipped via wave1+wave2. Remaining scope scoped with tight/medium/full options.
- **2026-04-19** — **Closed as superseded by staging.** Live verification on `origin/staging` found all 4 Tight-tier items already shipped: (1) `FooterNewsletterForm.tsx` wired into footer at 2 sites; (2) nav dropdown uses `color-mix(in srgb, var(--surface)...)` — `#0F172A` killed; (3) `TikTokIcon` inline SVG in `src/blocks/shared/social-icons.tsx`; (4) font rotation works via `pickCategoryTheme` + `seededShufflePick` over 113 unique `fontPairingId` values (5 presets × 14 categories). Medium tier items (nav logo slot, scroll-shrink, full file split) deferred — pure tech debt, no user-visible gap. No code change needed. Status → done.
