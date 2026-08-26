---
title: "Master Plan: Template System v2 — Wix-Level Quality"
description: "Unified plan: design tokens + block variants + industry blocks + 50 templates + UX polish"
status: abandoned
priority: P0
effort: 20d (4 sprints × 5 days)
branch: feat/template-system-v2
tags: [templates, blocks, design-system, wix-parity, master-plan]
created: 2026-04-05
---

# Master Plan: Template System v2

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD Overview**: [`docs/prd/F30-template-system-v2.md`](../../docs/prd/F30-template-system-v2.md) — 34 FR, 10 NFR, 17 ACs (overview)
- **PRD Sprint 1**: [`docs/prd/F30-sprint1-foundation.md`](../../docs/prd/F30-sprint1-foundation.md) — 15 FR, 15 ACs, 7 NFR, 5 Risks
- **PRD Sprint 2**: [`docs/prd/F30-sprint2-variants.md`](../../docs/prd/F30-sprint2-variants.md) — 11 FR, 16 ACs, 5 NFR, 34 new variants
- **PRD Sprint 3**: [`docs/prd/F30-sprint3-industry.md`](../../docs/prd/F30-sprint3-industry.md) — 13 FR, 17 ACs, 7 NFR, 8 new blocks
- **PRD Sprint 4**: [`docs/prd/F30-sprint4-polish.md`](../../docs/prd/F30-sprint4-polish.md) — 12 FR, 14 ACs, 7 NFR, UX fixes
- **QA Test Plan**: `docs/testcases/template-system-v2.md` (nếu có)
- **UI Specs**: `docs/ui-specs/template-system-v2.md` (nếu có)

⛔ **Cook PHẢI đọc các docs trên trước khi code. Code phải đúng PRD requirements + QA test cases.**

> **Gom 3 plans cũ thành 1:**
> - ~~`260405-1500-premium-templates`~~ → Sprint 3
> - ~~`260405-1600-wix-level-templates`~~ → Sprint 1-2
> - ~~`260405-1400-builder-ux-polish`~~ → Sprint 4

## Research (đã hoàn tất)
- `../260405-1600-wix-level-templates/research/researcher-01-wix-architecture.md`
- `../260405-1600-wix-level-templates/research/researcher-02-block-design-patterns.md`
- `../260405-1600-wix-level-templates/research/researcher-03-wix-full-research.md`
- `../260405-1500-premium-templates/research/researcher-01-template-sources.md`
- `../260405-1500-premium-templates/scout/scout-01-template-system.md`
- `../260405-1400-builder-ux-polish/scout/scout-01-ux-audit.md`

## Problem

1. Templates trông giống nhau — chỉ khác text/color
2. Block variants quá ít (2.7 avg) → mọi site cùng layout
3. Design tokens thiếu (2 colors) → site đơn điệu
4. Thiếu industry blocks (booking, schedule, review, menu...)
5. UX bugs (footer grid, mobile nav, generation timeout...)

## Strategy: 4 Sprints

```
Sprint 1 (5d) ─── Foundation ──────────── Sprint 2 (5d) ─── Visual Explosion
│ Design tokens (6 colors)              │ Hero: 5 → 12 variants
│ Font pairing system (20 pairs)        │ Features: 4 → 10 variants
│ Spacing presets                       │ Testimonials: 3 → 8 variants
│ Theme upgrade across all blocks       │ Pricing/Gallery/Footer variants
└───────────────────────────────────────└─────────────────────────────────

Sprint 3 (5d) ─── Content & Templates ── Sprint 4 (5d) ─── Polish & Ship
│ 8 industry blocks (NEW components)    │ UX bugs (P1 from audit)
│ Category content (MY/SEA)             │ Generation timeout + cancel
│ Template composer (50+ templates)     │ Template picker upgrade
│ Seed + thumbnails                     │ QA all templates + mobile
└───────────────────────────────────────└─────────────────────────────────
```

## Implementation Phases

### Sprint 1: Foundation (5d)
| Phase | Description | Effort |
|-------|-------------|--------|
| [1.1](phase-01-design-tokens.md) | Expand ThemeConfig: 2→6 colors, spacing presets, border radius | 2d |
| [1.2](phase-02-font-system.md) | 20 curated font pairings + font preview system | 1d |
| [1.3](phase-03-theme-migration.md) | Update all 38 blocks to use new design tokens | 2d |

### Sprint 2: Visual Variety (5d)
| Phase | Description | Effort |
|-------|-------------|--------|
| [2.1](phase-04-hero-variants.md) | Hero block: 5→12 variants (video, magazine, parallax, gradient...) | 2d |
| [2.2](phase-05-core-variants.md) | Features + Testimonials + Pricing: 3→8 variants each | 2d |
| [2.3](phase-06-secondary-variants.md) | Gallery + Footer + Contact + Nav: 3→6 variants each | 1d |

### Sprint 3: Industry & Templates (5d)
| Phase | Description | Effort |
|-------|-------------|--------|
| [3.1](phase-07-industry-blocks.md) | 8 NEW blocks: menu, booking, schedule, review, video-showcase, doctor, property, product-quick | 3d |
| [3.2](phase-08-template-content.md) | Category content files (11 categories × MY content) | 1d |
| [3.3](phase-09-template-composer.md) | Template composer + seed 50 templates + thumbnails | 1d |

### Sprint 4: Polish & Ship (5d)
| Phase | Description | Effort |
|-------|-------------|--------|
| [4.1](phase-10-ux-fixes.md) | P1 UX bugs: generation timeout, error messages, SSE failures | 2d |
| [4.2](phase-11-template-picker.md) | Template picker redesign: search, filter, live preview | 1d |
| [4.3](phase-12-qa-ship.md) | QA 50 templates (mobile + desktop) + final fixes + ship | 2d |

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Variants per block (avg) | 2.7 | 8+ |
| Design tokens | 5 | 12+ |
| Distinct templates | ~5 (look same) | 50+ |
| Industry blocks | 2 | 10+ |
| Font pairings | free-form | 20 curated |
| User "template looks pro" | ~40% | ~75% |

## Dependency Graph

```
Sprint 1 (foundation) ─────→ Sprint 2 (variants)
                                    │
Sprint 1 (foundation) ─────→ Sprint 3 (industry + templates)
                                    │
Sprint 2 + Sprint 3 ───────→ Sprint 4 (polish + QA)
```

Sprint 1 PHẢI xong trước Sprint 2 và 3 (vì design tokens là foundation).
Sprint 2 và 3 CÓ THỂ chạy song song nếu có 2 devs.
Sprint 4 chạy cuối cùng.

## Validation Summary

**Validated:** 2026-04-06
**Questions asked:** 6

### Confirmed Decisions

| # | Decision | User Choice |
|---|----------|-------------|
| 1 | S1 Migration approach | **Batch regex** — replace 28 files cùng lúc, review kỹ edge cases |
| 2 | Opacity hack `${pc}10` | **RGB pattern** — inject `--color-primary-rgb` → `rgba(var(--color-primary-rgb), 0.1)` |
| 3 | S2 Variant scope | **Full 34 variants** — build tất cả, không MVP subset |
| 4 | S3 Industry blocks | **All 8 blocks** — menu, booking, schedule, review, video, doctor, property, product |
| 5 | Thumbnails | **Auto-screenshot** — Playwright render → 1280x720 screenshot |
| 6 | Schedule | **Liên tục 4 sprints** — S1→S2→S3→S4 không break |

### Action Items
- [ ] S1: Implement RGB pattern for opacity tokens (`--color-primary-rgb: R, G, B`)
- [ ] S2: Build all 34 variants (not MVP 15) — may need 6-7 days instead of 5
- [ ] S3: Build all 8 industry blocks (not MVP 4) — may need 6-7 days instead of 5
- [ ] Add Playwright dependency for thumbnail generation in Sprint 3
