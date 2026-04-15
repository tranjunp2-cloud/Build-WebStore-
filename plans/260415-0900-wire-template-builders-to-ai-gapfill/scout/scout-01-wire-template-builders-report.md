# Scout Report — Wire Template Builders into AI Gap-Fill

**Date**: 2026-04-15
**Plan**: `plans/260415-0900-wire-template-builders-to-ai-gapfill/`
**Method**: Direct grep/read (scope small, 5-6 files, agent count ≤ 2 → skip parallel spawn per scout skill rules)

---

## Key finding — plumbing ALREADY exists 🎉

Plan phase-01 assumed `InjectionContext` needs new `businessInfo?: BusinessInfoInput` field. **False assumption**. Plan 2249 phase-07 already added `userBiz?: Partial<BusinessSample>` + wired from `openai-generator` → `enforcerCtx` → `content-injection`.

**Impact**: Save ~30min in cook. Skip "extend InjectionContext" + "propagate businessInfo" steps. Use existing `ctx.userBiz` directly trong delegation.

---

## Relevant Files

### Target files (to modify)

- **`src/lib/ai/template-composer.ts`** (line 327/485/618/678/962)
  - Builders currently `function` (module-scope), need to add `export` keyword
  - `buildFeatures(biz: BusinessSample, category: string): Record<string, unknown>` line 327
  - `buildStats(category: string): Record<string, unknown>` line 485
  - `buildPricing(category: string): Record<string, unknown>` line 618
  - `buildTeam(category: string): Record<string, unknown>` line 678
  - `buildServiceCards(biz: BusinessSample, category: string): Record<string, unknown>` line 962

- **`src/lib/ai/content-injection.ts`** (lines 317, 362, 380, 400, 442)
  - 5 switch cases to rewrite:
    - `case 'features'` line 317 — currently Phase 03 shuffle pool + user product injection
    - `case 'stats'` line 362 — generic pool
    - `case 'team'` line 380 — generic pool
    - `case 'service-cards'` line 400 — generic pool
    - `case 'pricing'` line 442 — generic pool
  - `InjectionContext` already has `userBiz?: Partial<BusinessSample>` (line 31) — no extension needed

### Dependency files (read-only, reuse)

- **`src/lib/ai/business-info-mapper.ts`** (line 98)
  - `export function mapBusinessInfo(info: BusinessInfoInput): Partial<BusinessSample>` — already exported

- **`src/lib/ai/content/types.ts`**
  - `BusinessSample` type definition

- **`src/lib/ai/openai-generator.ts`** (lines 236-253, 351-360)
  - `enforcerBizOverride = mapBusinessInfo(businessInfo)` already computed
  - Passed to `enforcerCtx.userBiz` in both multi-page + single-page paths
  - **Zero plumbing changes needed**

- **`src/lib/ai/structure-enforcer.ts`** (lines 148/158/178/198/236/252)
  - 6 call sites to `buildBlockFromLibrary(blockType, category, ctx)` — ctx propagation already correct

### Test files (to extend)

- **`src/__tests__/unit/lib/ai/content-rotation.test.ts`** — existing tests covering content-injection rotation; may need update after delegation
- **`src/__tests__/unit/ai/business-info-mapper.test.ts`** — mapBusinessInfo tests, no changes needed
- **`src/__tests__/unit/lib/ai/content-rules-integration.test.ts`** — integration tests, may need update

### New file

- **`src/__tests__/unit/lib/ai/content-delegation.test.ts`** (NEW) — test delegation pattern specifically

---

## Current features case (line 317-358) — reference for delegation

```ts
case 'features': {
  const pool = [ /* 8 generic items */ ]
  const shuffled = seededShuffle(pool, bizSeed ^ hashString('features'))
  let features = shuffled.slice(0, 4)

  // Plan 07 — user products injection (already reads ctx.userBiz via userProducts)
  if (userProducts.length >= 2) {
    const productCards = userProducts.slice(0, 4).map(...)
    features = productCards.concat(shuffled.slice(4, 4 + needed))
  }

  return {
    blockType: 'features',
    variant: 'grid-3',
    headline: `Why Choose ${name}`,
    features,
  }
}
```

**Observation**: existing code ALREADY reads `ctx.userBiz` (as `userProducts`, `name`). Delegation needs to preserve this user-product behavior OR override with template content. Decision: **use template content as baseline, merge user products over if provided** (best of both worlds).

---

## Proposed new features case (delegation pattern)

```ts
import { buildFeatures as composerBuildFeatures } from './template-composer'

case 'features': {
  // Merge library default biz with user overrides
  const bizSample: BusinessSample = {
    ...biz,                    // default from content.businesses[seed]
    ...(ctx.userBiz ?? {}),    // user overrides (name, tagline, products, phone...)
  }

  try {
    return composerBuildFeatures(bizSample, category)
  } catch (err) {
    console.warn('[content-injection] composerBuildFeatures failed, falling back:', err)
    // Existing hardcoded fallback preserved
    // ... (keep 40 lines of Phase 03 pool + user product injection)
  }
}
```

**Notes**:
- `composerBuildFeatures` reads `biz.products` (same field user data flows through) so user products still honored
- Fallback path preserves current behavior — defensive
- No change to headline construction (composer already generates `Why Choose ${biz.name}`)

---

## Plan phase-01 updates needed

Based on scout findings, plan phase-01 can skip:
- ~~Step 2: Extend `InjectionContext`~~ (already has `userBiz`)
- ~~Step 8: Propagate `businessInfo` through `enforcerCtx`~~ (already passing `userBiz`)

**Revised effort**: ~3h (was 4h, save 1h on plumbing).

Remaining steps:
1. Export 5 builders (15min)
2. Delegate 5 cases (features/stats/pricing/team/service-cards) — ~20-30min each = ~2h
3. Unit test content-delegation (1h)
4. Regression + smoke (30min)

---

## Unresolved Questions

1. **Header construction collision**: current features case constructs `headline: \`Why Choose ${name}\``. Template composer `buildFeatures` also sets headline. Which wins? → Template wins on delegation path (consistent with quality goal). If anh prefers user-name headline, override post-call.

2. **User product injection logic**: current case has product-derived cards (lines 333-347). Template composer `buildFeatures` reads `biz.products` too (line 356-359) and does same thing with `featuresFromProducts(userProducts, category, canned.length)`. **Already covered** — no logic loss.

3. **Pricing coverage**: template `buildPricing` only covers 7 categories (tech/education/fitness/beauty/health/business/creative). Other 7 fall to `defaultPlans`. Compared to current generic pool: still better (composer `defaultPlans` has real RM prices + feature lists). No regression.

4. **Team coverage**: template `buildTeam` only covers 4 categories (health/tech/creative/business). Other 10 fall to composer `defaultTeam`. Still better than AI generic "Team Lead" placeholder.

5. **Stats coverage**: template `buildStats` covers 11 categories. 3 missing — `defaultStats` fallback applies.

6. **Backward compat for tests**: existing `content-rotation.test.ts` may assert generic pool content ("Quality Service"). After delegation, assertions break. Need to update test expectations OR skip delegation when test context (detected via env var or injection) — simpler: update tests to accept either generic OR template content.

---

## Scale estimate

| Metric | Value |
|---|---|
| Files to modify | 2 (template-composer.ts, content-injection.ts) |
| Files to extend (tests) | 2 (content-rotation.test.ts, new content-delegation.test.ts) |
| Lines of code changed | ~80-100 (delegation + imports + try-catch) |
| New exports | 5 |
| Schema changes | 0 |
| DB migrations | 0 |
| Effort | 3h (revised down from 4h) |
| Risk | Low (fallback preserved, no plumbing changes) |
