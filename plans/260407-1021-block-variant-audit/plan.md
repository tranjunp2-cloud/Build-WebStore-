---
title: "Block Variant Audit & Fix — 14 Priority Blocks"
description: "Audit 77 variants across 14 blocks for rendering correctness, design token compliance, responsive behavior. Fix all dead/stub variants."
status: completed
priority: P1
effort: ~20h
branch: feat/F31-template-blueprints
tags: [blocks, variants, audit, design-tokens, quality]
created: 2026-04-07
---

# Block Variant Audit & Fix

## Overview

Audit va fix tat ca ~175 variants trong 51 blocks cua editor. Moi variant phai render uniquely, dung design tokens, responsive, va accessible.

**Scope change (validated):** Full audit 51 blocks, khong chi 14 priority.

## Ket qua Audit So bo

- **~13/77 variants** la dead/fallthrough (render giong default)
- **6/14 blocks** khong import `CSS_VARS` (about, faq, newsletter, stats, team, cta)
- **hero block** = 856 LOC, can refactor sang variants/ directory
- **0 automated tests** cho variant rendering

## Dead Variants (confirmed)

| Block | Dead Variants | Issue |
|-------|--------------|-------|
| hero | `video` | No branch, falls to centered |
| gallery | `masonry`, `carousel` | Same as grid default |
| navigation | `centered`, `mega-menu` | Same as simple default |
| testimonials | `carousel`, `simple` | Same as cards default |
| pricing | `table` | Same as cards default |
| footer | `expanded`, `minimal` | Same as simple default |

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Code Audit](./phase-01-code-audit.md) | ~2h | completed |
| 2 | [Fix Broken/Stub Variants](./phase-02-fix-variants.md) | ~4h | completed |
| 3 | [Design Token Compliance](./phase-03-design-tokens.md) | ~2h | completed |
| 4 | [Responsive QA](./phase-04-responsive-qa.md) | ~1h | completed |
| 5 | [Verification Script](./phase-05-verification.md) | ~1h | completed |

## Validation Summary

**Validated:** 2026-04-07
**Questions asked:** 4

### Confirmed Decisions
- **Hero refactor**: Full refactor — tach ra variants/ directory + clean router
- **CSS_VARS compliance**: Lam luon trong plan nay (Phase 03 giu nguyen)
- **Scope**: Full audit 51 blocks (~175 variants), khong chi 14 priority
- **CI integration**: Script local only — chay tay `pnpm verify:variants`

### Action Items
- [ ] Update Phase 01: audit 51 blocks thay vi 14
- [ ] Update Phase 02: fix dead variants cho tat ca 51 blocks (khong chi 14)
- [ ] Update Phase 03: CSS_VARS compliance cho 51 blocks
- [ ] Phase 05: script local only, khong add CI step
- [ ] Update effort estimate (~10h → ~20h)

## Related Docs (PHAI DOC truoc khi implement)
- **PRD**: `docs/prd/F31-block-variant-audit.md` — variant spec tables cho 51 blocks, 175 variants
- **QA Test Plan**: _(chua tao — chay `/docs-project:qa` sau)_
- **Existing PRD**: `docs/prd/F04-block-renderer.md` — original block renderer architecture

> Cook PHAI doc PRD truoc khi code. PRD co variant spec table chi tiet cho tung block.

## Key Files

| File | Purpose |
|------|---------|
| `src/blocks/*/index.tsx` | Block rendering (14 files) |
| `src/blocks/*/config.ts` | Variant definitions (14 files) |
| `src/lib/theme/resolve.ts` | CSS_VARS + design tokens |
| `src/blocks/registry.ts` | Block registry |
| `src/components/editor/SettingsPanel.tsx:646-660` | Variant selector UI |
| `src/blocks/shared/` | Shared animations + decoratives |
