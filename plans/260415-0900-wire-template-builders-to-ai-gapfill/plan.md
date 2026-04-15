---
title: "Wire Template Composer Builders into AI Gap-Fill"
description: "Short-term fix to delegate AI gen gap-fill content to template-composer hand-curated builders. Unlock template-quality content for AI path without rebuild."
status: shipped
priority: P0
effort: 4h planned / ~1h actual (1 phase, 1 PR)
branch: feat/F01-ai-gen-wire-template-builders
pr: '#618'
commit: 6bfa3c12
shipped_at: 2026-04-15
tags: [ai-gen, template-composer, quick-win, content-quality]
created: 2026-04-15
---

## Problem statement

Anh Nhan thấy "template mẫu đẹp hơn AI gen". Root cause (documented trong journal): **template-composer có ~280 hand-curated Malaysia-specific content entries** (JAKIM halal, FPX, MBBS UM credentials, RM pricing, GrabFood) mà **AI gen path không reuse** — fall through generic 8-item global pool ("Quality Service / Fast Response / Premium Experience").

Reference: `docs/journals/260415-ai-gen-vs-template-composer-research.md`

## Goal

Wire `template-composer.buildFeatures/buildStats/buildPricing/buildTeam/buildServiceCards` vào `content-injection.buildBlockFromLibrary` switch cases. Zero content curation mới — code đã có sẵn, chỉ thiếu wiring. **AI gen output cho health business trả về `Dr. Tan Wei Ming MBBS UM` thay vì `Team Lead — Passionate about delivering great experiences`.**

Parallel short-term fix cho team chạy trước v1.0, không block rebuild plan (`plans/260415-0845-ai-gen-template-first-rebuild/`).

## Non-goals

- **Không rebuild flow** — only gap-fill wiring, UI không đổi
- **Không author new templates** — reuse existing curated content
- **Không touch variant/theme fix** — Plan 2253 đã ship
- **Không migrate existing user sites** — only new AI gens benefit
- **Không full unit test coverage của template-composer** — chỉ test delegation pattern

## Phase overview

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| [01](./phase-01-wire-builders.md) | Export builders + delegate gap-fill + tests | 4h planned / ~1h actual | ✅ shipped (`6bfa3c12` / PR #618) |

Single-phase plan. No research/scout phases — scope fully specified by journal + comparison report.

## Success metrics

1. **Gen test — health business**: `features[0].title = 'Expert Doctors'` (template) thay vì `'Quality Service'` (old generic)
2. **Gen test — beauty business**: `features[0].title = 'Premium Products'` (template Korea/Japan phrasing) thay vì `'Quality Service'`
3. **Measurement harness**: run `measure-variety-offline` against 5 categories × 5 gens → service-cards/features/stats/team first-item diversity ≥50%
4. **Regression gate**: all 1474+ existing AI unit tests pass
5. **Schema compat**: new gap-fill blocks pass Payload block validation (no 500s on save)

## Timeline

- **Today** — plan review (this document)
- **Tomorrow** — cook phase 01 (4h)
- **Tomorrow +1** — QA + PR review
- **Target ship**: pre-v1.0 deadline (2026-04-15 if possible, otherwise early v1.0 patch)

## Related docs

- **Primary context**: `docs/journals/260415-ai-gen-vs-template-composer-research.md`
- **Comparison evidence**: `plans/260414-2253-ai-gen-variety-root-cause/reports/comparison-ai-vs-template.md`
- **Long-term rebuild plan**: `plans/260415-0845-ai-gen-template-first-rebuild/plan.md` (parallel, post-v1.0)
- **Plan 2253 (distribution fix)**: `plans/260414-2253-ai-gen-variety-root-cause/plan.md`

## Reference code

- `src/lib/ai/template-composer.ts` — 1772 lines, 28 `build*()` hand-curated functions
- `src/lib/ai/content-injection.ts` — AI gap-fill path (wire target)
- `src/lib/ai/business-info-mapper.ts:mapBusinessInfo` — `BusinessInfoInput → Partial<BusinessSample>` adapter (reuse)
- `src/lib/ai/content/types.ts` — BusinessSample + CategoryContent types

---

## Shipping log

**2026-04-15** — phase 01 shipped via PR #618 (`6bfa3c12`)

### Diff summary
- 3 files changed: `template-composer.ts` (+5 exports), `content-injection.ts` (+60/-19 delegation), `content-delegation.test.ts` (+180 new, 15 tests)
- Net: +240 / −19 lines

### Test results
- **15/15** new `content-delegation.test.ts` cases pass
- **1518/1518** full AI unit test suite pass (baseline 1474 + 15 new + 29 other plan additions)
- Zero regression in `content-rotation.test.ts` (8/8) + `structure-enforcer.test.ts` (11/11)

### Live smoke test — bibi Dental (`userBiz.products = ['Teeth Whitening', 'Dental Implants']`)

| Block | Before (generic gap-fill) | After (template-composer delegation) |
|---|---|---|
| `features[0].title` | ⭐ Quality Service | 🦷 Teeth Whitening Service |
| `features[1].title` | 🚀 Fast Response | Expert Dental Implants |
| `stats` labels | Happy Customers / Years / Rating | Years Experience / Patients Treated / Specialist Doctors / Patient Rating |
| `team[0]` | Team Lead — Founder | **Dr. Tan Wei Ming — General Practitioner** (MBBS UM) |
| `pricing` plans | Starter / Pro / Enterprise | Basic Check-up / Comprehensive / Executive |
| `service-cards[0]` | ⭐ Premium Service | Teeth Whitening Service (product-derived) |

### Scope realized vs planned
- ✅ Export 5 builders
- ✅ Delegate 5 switch cases (with try-catch fallback)
- ✅ 15 new unit tests covering delegation + determinism + shape compat
- ✅ Zero schema changes, no plumbing changes (scout found `ctx.userBiz` already wired via plan 2249 phase-07)
- ✅ **Time saved**: 4h planned → ~1h actual (scout pre-verification cut plumbing work)

### Next steps
- Post-merge: re-run `measure-variety-offline` harness to quantify content diversity delta
- Long-term: rebuild plan `260415-0845-ai-gen-template-first-rebuild/` (post-v1.0)
