---
title: "Wave 2 — Visual Diversity + Thin Block Expansion + Nav/Footer Polish"
description: "24-35h plan để giết 'chưa đẹp' layer 2 sau Wave 1: 8 decorative primitives, team/cta/about/stats/newsletter/faq expand, consolidate nav, polish footer+form."
status: pending
priority: P1
effort: 24-35h
branch: fix/F01-wave2-wix-detailed
tags: [wave2, wix, visual-diversity, decorative, variants, nav, footer]
created: 2026-04-17
---

# Wave 2 — Visual Diversity + Thin Block Expansion

## Problem

Wave 1 đã ship variant rotation (14 pools) + light theme + image pool coverage 15 blocks. Gen site giờ ổn nhưng vẫn có 3 layer vấn đề:

1. **"8 shades of same gradient blob"** — tất cả variant dùng cùng `GradientBlob` + primary tint. 10 site cùng category nhìn khác variant nhưng **feel same visual language**. (A4 fix)
2. **Thin variant pools** — team=2, cta=4, about=3, stats/newsletter/faq=3. Pool rotation không đủ unique combinations. (A5 fix)
3. **Nav 967-LOC + Footer 526-LOC monolith** — hardcoded opacity/color scattered, responsive gap inconsistent, dead code `motionWrap` prop. (C1+E1 fix)

## Current state (2026-04-17 after Wave 1 merge)

- ✅ 14 variant pool tables + validation + rotation stability
- ✅ Light neutral theme fallback (was dark cyan/magenta)
- ✅ BLOCK_IMAGE_SPEC 15 blocks, 0 placehold.co emissions
- ✅ BROKEN_VARIANTS filter testimonials grid/single
- ✅ `dedupSectionLabel` helper
- ❌ Decorative primitives: 9 shared (GradientBlob/DotGrid/WaveDivider/...) — **8 new needed** (mesh/noise/layered/asymmetric-grid/duotone/typographic-mark/grid-lines/diagonal-stripe)
- ❌ 6 blocks thin variants
- ❌ Nav still monolithic 967L, 3 copies of CTA_GRADIENT_STYLE
- ❌ Footer 6 variants có opacity/gap inconsistent

## Phase Overview

| # | Phase | Priority | Effort | Status | Depends |
|---|---|---|---|---|---|
| [01](phase-01-C1-nav-polish.md) | C1 Nav Polish (consolidate) | P1 | 1-2h | pending | — |
| [02](phase-02-E1-footer-form-polish.md) | E1 Footer + Form Polish | P1 | 3-5h | pending | — |
| [03](phase-03-A4-visual-diversity.md) | A4 Visual Diversity — 8 primitives | P1 | 10-14h | pending | after 01 |
| [04](phase-04-A5-thin-block-expansion.md) | A5 Thin Block Expansion | P1 | 10-14h | pending | after 03 |

**Total**: 24-35h (~1.5 tuần solo)

## Dependency Graph

```
01 (C1 nav polish)   ──┐
02 (E1 footer polish) ─┼─> 03 (A4 decoratives) ──> 04 (A5 variants)
                       │
```

01 + 02 song song (khác file). 03 (A4) ship trước 04 (A5) vì new variants dùng A4 primitives.

## Ship order

- **Day 1 (1-2h)**: Phase 01 (C1) — smallest, consolidate nav gradient constants
- **Day 1-2 (3-5h)**: Phase 02 (E1) — extract footer constants, polish contact form
- **Day 3-4 (10-14h)**: Phase 03 (A4) — 8 decorative primitives + storybook, wire 6 blocks
- **Day 5-7 (10-14h)**: Phase 04 (A5) — expand team 2→6, cta 4→8, about/stats/newsletter/faq +3-4 each

## Success Metrics

1. **Visual diversity**: 10 site cùng category × 5 page scroll → ≥ 4 distinct "decorative vocabularies" visible (mesh vs noise vs layered vs stripe). Manual QA grid.
2. **Variant coverage**: team ≥ 6, cta ≥ 8, about ≥ 7, stats/newsletter/faq ≥ 6 — Zod enum + dispatch + pool entries match.
3. **Nav LOC**: 967 → ≤ 900 after consolidation, 1 constant gradient style.
4. **Footer consistency**: 0 magic opacity/color numbers, shared `FooterSectionTitle` component.
5. **Contact form UX**: button hover/loading/disabled states verified, a11y `aria-*` attrs complete.

## Research

- [Researcher 01 — A4+A5 Scope](research/researcher-01-a4-a5-scope.md)
- [Researcher 02 — C1+E1 Scope](research/researcher-02-c1-e1-scope.md)

## Related Plans

- [260417-0817-wave1-wix-detailed-plan](../260417-0817-wave1-wix-detailed-plan/) — SHIPPED (PR #690 merged 2026-04-17)
- [260415-1344-wix-deep-rebuild](../260415-1344-wix-deep-rebuild/plan.md) — parent 7-phase plan
- [260414-2249-ai-gen-wix-level-optimize](../260414-2249-ai-gen-wix-level-optimize/) — prerequisites (image pool, theme moods)

## Open Questions

1. A4 decoratives: **configurable per variant** (variant picks random decorative from pool) hay **hardcoded per variant** (cta/card always mesh-gradient)? → **Default: hardcoded per variant** for deterministic QA.
2. A5 new variant names: implement exact spec in research report (cards-hover-reveal, horizontal-scroll, bio-modal, compact-row for team)? → confirm UX before code.
3. Pool tables widen: team expand 2→6 means pool per category có thể pick từ 4-6 variants thay vì 2. Cần update pool entries hoặc chỉ enum?
4. Hero 12 variants: A4 có áp dụng không? → **skip hero**, hero đã có image/video decorative riêng.
5. Nav `motionWrap` prop: dead code remove hay implement trong Pill/Sidebar? → **default: remove** (YAGNI).

## Changelog

- **2026-04-17** — Plan tách từ parent 260415 + revised scope sau Wave 1 merge. C1 scope giảm 4-6h → 1-2h (most work done). E1 giảm 4-6h → 3-5h (endpoint existed).
