---
title: "AI Gen Rebuild — Wix Template-First Approach"
description: "Flip ech-prime AI gen từ LLM-creates-everything → designer-curated-templates + AI-matching. Multi-phase rebuild targeting Wix ADI quality."
status: pending
priority: P1
effort: "10-14 weeks (see phase breakdown)"
branch: feat/F01-ai-gen-template-first
tags: [ai-gen, template-first, rebuild, wix, strategic, post-v1.0]
created: 2026-04-15
---

## Problem statement

Post plan 2253 + R1 skeleton fix (PR #603/#615/#617), ech-prime AI gen path fixes distribution (variant/skeleton/theme diversity) but **content quality ceiling remains at GPT-4o training-data median** ("Quality Service / Fast Response"). Template composer has ~280 hand-curated Malaysia-specific entries (JAKIM, FPX, MBBS UM, RM pricing, GrabFood) — AI gen path doesn't reuse them.

User report (anh Nhan): "template mẫu đẹp hơn AI gen bây giờ". Evidence confirmed via measurement + code audit. Root cause: **AI-first philosophy** (LLM writes everything) vs **Wix template-first philosophy** (designer writes, AI matches).

Reference: `docs/journals/260415-ai-gen-vs-template-composer-research.md` — full research + evidence.

## Goal

Flip architecture to template-first. Output: AI gen for health clinic outputs `Dr. Tan Wei Ming MBBS UM` not `Team Lead — Passionate about delivering great experiences`. Measurable: content quality subjective QA rates new flow ≥7/10 vs current ≤4/10 on same test inputs.

## Non-goals

- **NOT a full rebuild of editor** — editor UI stays, only gen/builder path changes
- **NOT a replacement** for AI gen — AI gen path persists as fallback + power-user mode
- **NOT delivered pre-v1.0** (deadline 2026-04-15) — this plan is post-v1.0 sprint
- **NOT migrating existing user sites** — old sites stay as-is, no retrofit
- **NOT localization beyond MY+EN** — VN/ID/TH defer to later plan

## 3 scope options (anh pick before cook)

| Option | Scope | Effort | Risk |
|---|---|---|---|
| **A. Thin wrapper** | Wire `template-composer.build*()` vào AI gap-fill only. No UI changes. | 3-4h (1 PR) | Low |
| **B. Hybrid progressive** (this plan default) | Expand template lib 30→100, add template picker UI alongside AI form, wizard Phase 03. | 10-14 weeks | Medium |
| **C. Full Wix-style rewrite** | 500+ curated templates, replace AI form entirely with wizard picker, hire designers. | 3-6 months | High (designer budget) |

This plan scopes **Option B** (balanced middle path). Option A is the short-term fix (separate PR pre-v1.0). Option C would extend this plan with Phase 04+ enlarged.

## Phase overview

| # | Phase | Effort | Status | Dependencies |
|---|-------|--------|--------|-------------|
| [01](./phase-01-research-architecture.md) | Research + architecture + template taxonomy | 1 week | pending | — |
| [02](./phase-02-template-authoring-tool.md) | Admin UI for template CRUD + preview | 2 weeks | pending | 01 |
| [03](./phase-03-template-library-v1.md) | Author 100 templates cho 5 hottest categories | 4 weeks | pending | 02 (tool ready) |
| [04](./phase-04-wizard-picker-ui.md) | `/builder/new-v2` wizard (5 steps) | 1 week | pending | 01 (data model) |
| [05](./phase-05-matching-engine.md) | Rank templates by user answers + top-3 preview | 3-5 days | pending | 03 (lib populated) |
| [06](./phase-06-personalization-layer.md) | Business name injection + Unsplash + SEO | 3-5 days | pending | 05 |
| [07](./phase-07-rollout-metrics.md) | Feature flag coexist old/new + metrics harness | 1 week | pending | 06 |

**Critical path**: 01 → 02 → (03 ∥ 04) → 05 → 06 → 07 = ~10 weeks minimum
**Full scope with buffer**: 12-14 weeks

## Decision matrix cần anh quyết trước cook

| Decision | Options | Default | Cần anh confirm |
|---|---|---|---|
| **Template library target** | 50 / 100 / 500 | 100/category × 5 categories = 500 total | ✅ |
| **Categories v1** | 5 hottest / 10 balanced / all 14 | 5 hottest (beauty, restaurant, health, tech, business) | ✅ |
| **Designer resource** | Em + anh / hire 1 / hire team | Em + anh for POC, hire if B validates | ✅ |
| **Wizard vs keep form** | Replace / coexist / A-B test | Coexist (feature flag) | ✅ |
| **Timeline start** | Immediate / post-v1.0 / v1.1 | Post-v1.0 (2026-05-01+) | ✅ |
| **Sub-niche taxonomy** | 14 cats / 40 sub-niches / 60+ | 40 sub-niches (dental ≠ spa ≠ pharmacy) | ✅ |

## Success metrics

1. **Content quality (subjective)**: 5 same-input gens via new flow vs old → human QA rates new ≥7/10, old ≤4/10
2. **Variety metrics** (reuse plan 2253 harness): skeleton distinct ≥3/10, variant share ≤35%, theme combos ≥6 per 10 gens
3. **User satisfaction**: post-gen survey 4+ stars on 10 beta users
4. **Adoption**: 50%+ users on new flow pick "use template" over "use AI form" within 2 weeks of launch
5. **Technical**: 1474+ AI unit tests still pass, zero regression in existing AI gen path (kept as fallback)
6. **Bundle**: new wizard UI +30KB gzipped max, preview render <2s

## Related docs

- **Journal (primary context)**: `docs/journals/260415-ai-gen-vs-template-composer-research.md`
- **Comparison report**: `plans/260414-2253-ai-gen-variety-root-cause/reports/comparison-ai-vs-template.md`
- **Audit report**: `plans/260414-2253-ai-gen-variety-root-cause/reports/audit-unused-code.md`
- **Variety measurement**: `plans/260414-2253-ai-gen-variety-root-cause/reports/variety-delta.md`
- **Plan 2253 (distribution fix)**: `plans/260414-2253-ai-gen-variety-root-cause/plan.md`
- **Plan 2249 (Wix-parity strategic)**: `plans/260414-2249-ai-gen-wix-level-optimize/plan.md`

## Reference plans + code already shipped

- PR #603 — Plan 2253 tactical variety fix (merged)
- PR #615 — R1 skeleton variants wire (merged)
- PR #617 — cleanup unused + force variant re-pick (open/merging)
- `src/lib/ai/template-composer.ts` (1772 lines) — ~280 hand-curated builders, ready to consume
- `src/lib/ai/seed-templates.ts` (1162 lines) — 25 pre-built SEED_TEMPLATES
- `src/lib/ai/category-recipes.ts` — 42 recipes (plan 2249 phase 04)
