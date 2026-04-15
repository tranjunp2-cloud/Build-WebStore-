# Phase 01 — Wire Template Composer Builders into AI Gap-Fill

## Context links
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: none — standalone fix
- **Primary reference**: `docs/journals/260415-ai-gen-vs-template-composer-research.md`
- **Evidence**: `plans/260414-2253-ai-gen-variety-root-cause/reports/comparison-ai-vs-template.md`

## Overview
- **Date**: 2026-04-15
- **Description**: Export 5 builders (`buildFeatures`, `buildStats`, `buildPricing`, `buildTeam`, `buildServiceCards`) from `template-composer.ts`. Rewrite 5 switch cases in `content-injection.buildBlockFromLibrary` to delegate to template-composer instead of returning hardcoded generic blocks. Reuse existing `mapBusinessInfo()` adapter to convert `BusinessInfoInput → BusinessSample`. ~4h work, 1 PR.
- **Priority**: P0 (ship pre-v1.0 if possible)
- **Implementation status**: ✅ shipped (`6bfa3c12` / PR #618, 2026-04-15)
- **Review status**: pending PR #618 review
- **Effort**: 4h planned / ~1h actual (scout pre-verified plumbing already existed via plan 2249 phase-07 — skipped 2 plumbing steps)

## Key Insights
- **Zero content curation new** — template-composer builders have ~280 curated entries already written + production-proven via template gallery path
- **5 builders cover 95% of content quality gap** — features/stats/pricing/team/service-cards are the 5 block types với measurable AI-vs-template delta (per audit report)
- **Adapter already exists** — `src/lib/ai/business-info-mapper.ts:mapBusinessInfo` converts `BusinessInfoInput → Partial<BusinessSample>`, reuse as-is
- **Risk is low** — Payload schema identical between 2 paths (template flow saves same Block shape), no DB migration needed

## Requirements
- Export 5 builders from `template-composer.ts`:
  - `buildFeatures(biz: BusinessSample, category: string): Record<string, unknown>`
  - `buildStats(category: string): Record<string, unknown>`
  - `buildPricing(category: string): Record<string, unknown>`
  - `buildTeam(category: string): Record<string, unknown>`
  - `buildServiceCards(biz: BusinessSample, category: string): Record<string, unknown>`
- Modify `content-injection.ts:buildBlockFromLibrary` switch cases to delegate:
  - `case 'features'` → `buildFeatures(bizSample, category)`
  - `case 'stats'` → `buildStats(category)`
  - `case 'pricing'` → `buildPricing(category)`
  - `case 'team'` → `buildTeam(category)`
  - `case 'service-cards'` → `buildServiceCards(bizSample, category)`
- Adapter: inside `buildBlockFromLibrary`, call `mapBusinessInfo(ctx)` if `ctx` has `BusinessInfoInput` fields, merge with content library business sample as baseline
- **Fallback preserved**: if template-composer builder throws or returns null, fall through to existing hardcoded literal (defensive)
- Unit tests: verify delegation output contains curated content (e.g. `'Halal Certified'` in restaurant features, not `'Quality Service'`)
- Regression: all 1474+ existing AI unit tests pass

## Architecture

### Current flow (broken)
```ts
// src/lib/ai/content-injection.ts
case 'features':
  return {
    blockType: 'features',
    variant: 'grid-3',
    headline: 'Why Choose Us',
    features: shuffled.slice(0, 4),  // ← generic 8-item pool
  }
```

### Target flow (delegate)
```ts
import {
  buildFeatures as composerBuildFeatures,
  buildStats as composerBuildStats,
  buildPricing as composerBuildPricing,
  buildTeam as composerBuildTeam,
  buildServiceCards as composerBuildServiceCards,
} from './template-composer'
import { mapBusinessInfo } from './business-info-mapper'

// inside buildBlockFromLibrary
const bizSample: BusinessSample = {
  ...biz,  // from content.businesses (library default)
  ...(ctx.businessInfo ? mapBusinessInfo(ctx.businessInfo) : {}),  // user overrides
}

case 'features':
  try {
    return composerBuildFeatures(bizSample, category)
  } catch (err) {
    console.warn('[content-injection] template builder failed, falling back:', err)
    return { /* existing hardcoded fallback */ }
  }
```

### Adapter interface expansion
`InjectionContext` currently has `{ businessName?, industry?, seed? }`. Add optional `businessInfo?: BusinessInfoInput` so caller can pass user data:

```ts
export interface InjectionContext {
    businessName?: string
    industry?: string
    seed?: number
    businessInfo?: BusinessInfoInput  // ← new, optional
}
```

Callers in `structure-enforcer.ts` + `openai-generator.ts` pass `businessInfo` via `enforcerCtx`.

### Data flow diagram
```
openai-generator.generateSiteWithAI
  → validateBlocks → sanitizeBlockData (variant fix)
  → enforceMinimumStructure(blocks, category, enforcerCtx)
                                           ↓
                                     { businessInfo, seed }
                                           ↓
      missing 'features' → buildBlockFromLibrary('features', category, ctx)
                                           ↓
                             mapBusinessInfo(ctx.businessInfo) → BusinessSample
                                           ↓
                             template-composer.buildFeatures(biz, category)
                                           ↓
                             Malaysia-curated features output 🎨
```

## Related code files
- `src/lib/ai/template-composer.ts` — export 5 builders (add `export` keyword)
- `src/lib/ai/content-injection.ts` — rewrite 5 switch cases, add import + adapter call
- `src/lib/ai/business-info-mapper.ts` — reuse `mapBusinessInfo` (no changes)
- `src/lib/ai/structure-enforcer.ts` — pass `businessInfo` through `enforcerCtx`
- `src/lib/ai/openai-generator.ts` — include `businessInfo` trong `enforcerCtx` when calling `enforceMinimumStructure`
- `src/__tests__/unit/lib/ai/content-rotation.test.ts` — expand to cover new delegation
- `src/__tests__/unit/lib/ai/content-delegation.test.ts` — NEW, tests delegation to composer

## Implementation Steps
1. **Export builders** (15min)
   - Add `export` keyword to 5 functions in `template-composer.ts`
   - Verify no name collisions with existing exports
2. **Extend `InjectionContext`** (10min)
   - Add optional `businessInfo?: BusinessInfoInput` field in `content-injection.ts`
   - Keep backward compat (optional)
3. **Delegate `features` case** (30min)
   - Import `buildFeatures` as `composerBuildFeatures` (alias to avoid shadow)
   - Build `bizSample` via `mapBusinessInfo(ctx.businessInfo)` merged over `content.businesses[bizSeed]`
   - Try-catch fallback to existing hardcoded literal
4. **Delegate `stats` case** (20min) — same pattern
5. **Delegate `pricing` case** (20min) — same pattern
6. **Delegate `team` case** (20min) — same pattern
7. **Delegate `service-cards` case** (20min) — same pattern
8. **Propagate `businessInfo`** (30min)
   - `openai-generator.validateBlocks` → include `businessInfo` in `enforcerCtx`
   - Both multi-page and single-page paths
9. **Unit test — content-delegation** (1h)
   - New file `src/__tests__/unit/lib/ai/content-delegation.test.ts`
   - Test cases:
     - `buildBlockFromLibrary('features', 'health', ctx)` returns "Expert Doctors" (template) not "Quality Service"
     - `buildBlockFromLibrary('stats', 'restaurant', ctx)` returns "Menu Items" label (template) not "Happy Customers"
     - `buildBlockFromLibrary('team', 'tech', ctx)` returns "Ahmad Razif" name (template) not "Team Lead"
     - Fallback path: mock composer throwing → legacy hardcoded returns
     - Schema compat: Zod validate each returned block shape against registry
10. **Regression run** (15min)
    - `pnpm vitest run src/__tests__/unit/lib/ai` — expect 1474+ pass
11. **Live smoke test** (15min)
    - Gen "bibi Dental" health business via debug script
    - Verify features/stats/team output matches template content

## Todo list
- [x] Export 5 builders from template-composer.ts
- [x] Extend InjectionContext with businessInfo
- [x] Delegate features case
- [x] Delegate stats case
- [x] Delegate pricing case
- [x] Delegate team case
- [x] Delegate service-cards case
- [x] Propagate businessInfo through enforcerCtx
- [x] Write content-delegation unit tests
- [x] Regression run (1474+ pass)
- [x] Live smoke test
- [x] Commit + push + PR to staging

## Success Criteria
- Unit test `content-delegation.test.ts` passes với 10+ cases covering 5 delegated blocks + fallback
- Regression: 1474+ existing AI unit tests still pass
- Live smoke gen shows curated content:
  - health features contain "Expert Doctors", "Insurance Accepted", "Minimal Wait Time" (NOT "Quality Service")
  - restaurant features contain "Halal Certified", "Fast Delivery" mentioning GrabFood/Foodpanda
  - health team contain "Dr. Tan Wei Ming MBBS (UM)" (NOT "Team Lead")
  - beauty stats contain "Clients Served", "Treatments Available" (NOT "Happy Customers")
- Zero Payload schema validation errors on save
- PR review from anh → approved

## Risk Assessment
- **Template builders may throw unexpected errors** — mitigation: wrap each delegation in try-catch, fall through to existing hardcoded block on failure. Defensive pattern keeps AI gen resilient.
- **BusinessSample schema mismatch** — `mapBusinessInfo` may return partial. Mitigation: merge over library default business sample (`content.businesses[seed]`), ensures complete shape.
- **Pricing builder only covers 7 categories** — other 7 categories fall to `defaultPlans` in composer. No degradation vs current state.
- **Team builder only covers 4 categories** — other 10 fall to `defaultTeam` (already hand-curated to be okay). Still better than AI path's "Team Lead" placeholder.
- **Content validation layer** — `content-rules.ts` validates headlines/CTAs. Template content already passes since used in template gallery path. No new validation failures expected.

## Security Considerations
- N/A — no user input path changes, no auth changes, no DB schema changes
- Template content is static developer-authored code, safe by construction

## Next steps
- After merge, run measurement harness comparing post-fix-v3 vs post-wire gap-fill-v4 → verify content quality improvement
- Update journal với post-fix observations
- Long-term: proceed to rebuild plan `260415-0845-ai-gen-template-first-rebuild/` for strategic Wix-style flow
