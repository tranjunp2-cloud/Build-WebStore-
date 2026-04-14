# Phase 06 — Fallback Path → Composer Unify

> Parent: [plan.md](./plan.md) (Plan A — AI Variety Audit)
> Status: **done** (2026-04-14) | Priority: P1 | Effort: 8-11h | Created: 2026-04-14
> 7 sub-steps: [06-1](./phase-06-step-1-break-circular-dep.md) ✅ · [06-2](./phase-06-step-2-font-pairing-resolver.md) ✅ · [06-3](./phase-06-step-3-category-translator.md) ✅ · [06-4](./phase-06-step-4-shape-adapter.md) ✅ · [06-5](./phase-06-step-5-fallback-rewire.md) ✅ · [06-6](./phase-06-step-6-test-e2e-verify.md) ✅ · [06-7](./phase-06-step-7-cleanup-deprecation.md) ✅

## Known follow-ups (not in scope)
- **Double `done` SSE event**: route.ts:478 emits its own `done` after generator `done`. Pre-existing, frontend tolerates it.
- **Multi-page fallback**: currently `variant='starter'` (home only). Bump to `professional` once downstream actually consumes `GenerationResult.pages[]`.
- **Restaurant preset richness**: TEMPLATE_PRESETS for restaurant don't always include `menu-display`/`booking-widget`. Addressed by plan-2156 phase-07 (dynamic content from form input).
- **Vietnamese keyword expansion** in `composer-category-resolver.ts` — baseline included, but can be expanded after real-world user prompts.
- **Pre-existing test failures**: `sanitize-block-data.test.ts` stats suffix stripping (2 tests) — not rewire-related.

## Goal

Rewire `generateWithFallback()` in `src/lib/ai/openai-generator.ts` so the AI failure path calls `composeFromBlueprint()` from `template-composer.ts` instead of the bare `generateBlocks(prompt)`. After refactor, the fallback uses the same rich content layer as the happy path: 14 industry categories, real `BusinessSample`s, Phase 04 content validation, industry-aware block builders, and full theme presets.

## Why

Today the fallback returns a generic 6-block skeleton from `generate-blocks.ts` with placeholder content. This is the path users hit whenever OpenAI errors out, so it must match the quality bar of the happy path. Unifying on the composer also removes drift: one content engine, one validation pass, one set of block variants.

## Current state

- `generateWithFallback` (openai-generator.ts:249-266) calls `generateBlocks(prompt, Date.now())` → thin 5-category mapper, no industry content, no Phase 04 validation.
- Composer is pure, sync, no side effects (researcher-04 Q5) and already invokes `enforceMinContent` + `applyContentValidation` internally (template-composer.ts:1249-1255).
- Route handler (`api/ai/generate-site/route.ts:247`) is shape-agnostic: both paths must return `{ result: GenerationResult; events: SSEEvent[] }`.
- Circular import risk: composer already imports `enforceMinContent` from openai-generator. Reverse import would create a cycle.

## Target state

- `generateWithFallback` builds `{ category, businessIndex, themePreset, variant: 'starter' }` from the prompt, deep-clones the selected `BusinessSample`, overrides `biz.name` + `biz.tagline`, calls `composeFromBlueprint`, adapts `TemplateSeed` → `GenerationResult`, emits synthetic `step` events, wraps everything in try/catch with a second-tier fallback to the legacy `generateBlocks` call.
- `enforceMinContent` + `VARIANT_MIN_CONTENT` live in a neutral `variant-validation.ts` to break the cycle.
- Adapter is a pure, fully unit-tested function in a new `fallback-adapter.ts`.

## Phases

| # | Phase | Effort | Status | Key deliverable |
|---|---|---|---|---|
| 01 | Break circular dep | 30min | pending | `src/lib/ai/variant-validation.ts` with `enforceMinContent` + `VARIANT_MIN_CONTENT` |
| 02 | Font pairing resolver | 1-2h | pending | `src/lib/ai/font-pairings.ts` mapping 20 pairing ids → `{fontHeading, fontBody}` |
| 03 | Category translator (5→14) | 1-2h | pending | Extend `TYPE_KEYWORDS` + new `resolveComposerCategory(prompt)` helper |
| 04 | Shape adapter | 2-3h | pending | `src/lib/ai/fallback-adapter.ts` + unit tests |
| 05 | Fallback rewire | 1h | pending | New `generateWithFallback` using composer, try/catch, synthetic step events |
| 06 | Test + e2e verify | 2h | pending | All affected tests passing, manual regen for 5 categories |
| 07 | Cleanup + deprecation note | 30min | pending | `generate-blocks.ts` marked legacy safety net, progress trackers updated |

Total: 8-11h.

## Related docs

- Research: `./research/researcher-03-fallback-shape-adapter.md` (shape diff, category mapping, biz override)
- Research: `./research/researcher-04-fallback-streaming-tests.md` (SSE sequence, route contract, circular dep, test impact)
- Upstream plan: `plans/260407-0040-template-visual-diversity/` (Phase 04 validation lives here)
- Downstream: `plans/260406-2055-template-blueprints/` (blueprint system the composer consumes)
