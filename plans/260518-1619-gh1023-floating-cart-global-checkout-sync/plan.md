---
title: "GH-1023: Floating Cart Global Visibility & Checkout Auto-sync"
description: "Make floating cart/WhatsApp/Social global, fix cart routing, add scope tags to component library"
status: completed
priority: P1
effort: 8h
branch: feat/F09-F10-1023-floating-cart-global-checkout-sync
tags: [frontend, commerce, cart, global-components, component-library]
created: 2026-05-18
completed: 2026-05-18
---

# GH-1023 — Floating Cart Global Visibility & Checkout Flow Auto-sync

## Goal
Auto-detect commerce/floating widgets across all pages and inject them globally via SiteRenderer; repair cart→checkout entry points; surface block scope in Component Library UI. **No DB schema changes needed** — pure auto-detection from pages data.

## Problems → Solutions
| # | Problem | Solution |
|---|---------|----------|
| 1 | FloatingCart only on pages where added | Auto-detect commerce → inject default+theme config globally |
| 2 | WhatsApp/Social per-page limitation | Page-level promote: first found config → inject globally |
| 3 | Cart icon click `#` href, broken checkout link | Audit + fix cart entry points; drawer pattern kept |
| 4 | No scope tags in Component Library | Add `scope` to BlockMeta; render badges + VN tooltips |

## Phases
| # | File | Owner globs | Status | Est |
|---|------|-------------|--------|-----|
| 01 | [phase-01-site-renderer-global-injection.md](./phase-01-site-renderer-global-injection.md) | `src/lib/site-renderer/`, `src/components/site-renderer/SiteRenderer.tsx` | completed | 2.5h |
| 02 | [phase-02-cart-link-fix.md](./phase-02-cart-link-fix.md) | `src/blocks/cart-widget/index.tsx`, `src/blocks/navigation/**`, `src/components/cart/**` | completed | 1.5h |
| 03 | [phase-03-component-library-scope-tags.md](./phase-03-component-library-scope-tags.md) | `src/blocks/types.ts`, `src/blocks/*/config.ts`, BlockLibraryPanel UI | completed | 2h |
| 04 | [phase-04-tests.md](./phase-04-tests.md) | `src/__tests__/**` only | completed | 1h |

## Dependency Graph
```
P1 (SiteRenderer auto-inject) ──► P2 (cart links)  ──► P4 (tests)
                               └► P3 (scope tags)  ──┘
```
P1 first (core logic). P2 + P3 independent after P1 (disjoint globs — safe to parallelize). P4 last.

## Key Architectural Decisions (Validated 2026-05-18)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Floating cart trigger | **Fully auto** (no admin config) | Commerce blocks detected → inject with default+theme |
| Cart UX | **Drawer** (no /cart route) | Existing Zustand drawer; simpler, less code |
| WhatsApp/Social global | **Page-level promote** + first-found-wins | Consistent with cart auto-logic |
| Scope tags | **In this PR** (AC7-9 required) | Issue explicitly demands it |
| Auto cart config | **Site theme styling** | No hardcoded style; inherits theme tokens |
| DB schema | **No changes** | Full auto-detect from pages data |

## Backwards Compatibility
- No DB migration required. All existing sites unaffected until pages data triggers detection.
- `BlockMeta.scope` defaults to `'page'` — existing configs unchanged.
- Cart drawer behavior unchanged for existing checkout flows.

## Rollback
- P1 revert restores per-page-only rendering (single commit).
- P3 scope-tag is additive UI; revert removes badges, no data loss.

## Test Matrix (high-level — detail in P4)
| Surface | Test type | Location |
|---------|-----------|----------|
| `detectCommercePresence` | unit | `src/__tests__/unit/site-renderer/` |
| `extractFirstGlobalBlock` (whatsapp/social) | unit | same |
| `applyGlobalSystemBlocks` extension | unit | same |
| Cart drawer open from all entry points | integration | `src/__tests__/integration/cart/` |
| Checkout link routing | integration | same |

## Validation Summary

**Validated:** 2026-05-18
**Questions asked:** 6

### Confirmed Decisions
- Floating cart trigger: **Fully automatic** (auto-detect commerce, no admin setup)
- Cart UX: **Drawer** (no /cart route needed)
- WhatsApp/Social: **Page-level promote** (first found config → global)
- P4 scope tags: **In this PR**
- Auto cart styling: **Site theme** (not hardcoded)
- WhatsApp conflict: **First found wins** (consistent with cart auto-logic)

### Action Items (Plan Revised)
- [x] Remove Phase 01 DB Schema (no longer needed)
- [x] Rename phases: P2→P1, P3→P2, P4→P3, P5→P4
- [x] P1 logic: auto-inject cart with `detectCommercePresence(pages)` + theme config
- [x] P1 logic: WhatsApp/Social use `extractFirstGlobalBlock(pages, blockType)` → inject
- [x] P1 phase file: update to reflect auto-inject (no site field reads)
- [x] P2 phase file: keep as-is (cart link audit unchanged)

## Completion Summary (2026-05-18)

All phases completed successfully:
- **P1 (SiteRenderer auto-inject):** Created `detect-commerce-presence.ts`, `extract-first-global-block.ts`, `has-header-cart.ts`. Extended `applyGlobalSystemBlocks` with commerce auto-detect + WhatsApp/Social page-level promotion.
- **P2 (Cart link fix):** Audited & fixed cart entry points. CartDrawer checkout button always visible, disabled when cart empty.
- **P3 (Scope tags):** Added `BlockMeta.scope` field. Tagged 5 global blocks. Updated UI with 🌐 badge + VN tooltips.
- **P4 (Tests):** 85 tests across 5 files (TC-F09.205..222) — all passing. QA doc v5.5 updated.

Additional fix: NavPage type updated to include `layout?: unknown[]` + `isHomepage?: boolean` (removes type cast).

**PR ready for staging:** All tests passing, no blockers.
