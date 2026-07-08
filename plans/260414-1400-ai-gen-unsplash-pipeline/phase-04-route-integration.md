# Phase 04 — Route integration + un-drop blocks + feature flag

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01, phase-02, phase-03
- Blocks: phase-06 (e2e tests need this wired)
- Research: [researcher-02 §1, §3, §4](./research/researcher-02-payload-media-pipeline.md)

## Overview
- Date: 2026-04-14
- Description: Wire `media-pipeline` into `/api/ai/generate-site` — replace single DALL-E hero call with batched Unsplash calls for hero + gallery + team + testimonial avatars + about. Un-drop `gallery`, `before-after`, `portfolio-grid` from `unsupported-blocks.ts`. Teach sanitizer to NOT strip image URL fields until media-pipeline has intercepted. Gate DALL-E behind `ENABLE_DALLE_HERO=false` default flag.
- Priority: P1
- Implementation: pending
- Review: pending

## Key insights
- **Critical ordering:** media-pipeline must run AFTER AI returns blocks (so we know what blocks exist and which fields they need) but BEFORE `sanitizeBlocksForPayload` strips URL fields at `openai-generator.ts:828–833`.
- **Current DALL-E is parallel-to-AI** (`route.ts:234` → `heroImagePromise`). New Unsplash approach is **sequential-after-AI**: wait for blocks → derive image needs → batch search. Adds ~3–5s serial latency but gives 15 images vs 1.
- **Sanitizer must intercept smarter:** instead of blindly deleting string URLs, we intercept BEFORE sanitization, batch-upload, replace URL with Media ID, let sanitizer pass through.
- **Un-dropping blocks is 2 lines:** remove `gallery`, `before-after`, `portfolio-grid` from `BLOCKS_REQUIRE_MEDIA_PIPELINE` set in `unsupported-blocks.ts`. BUT `before-after` also in `BLOCKS_NOT_IN_PAYLOAD` — leave there unless we add it to `Pages.ts` (out of scope; keep on list).
- **`booking-widget`, `menu-display`, `review-cards`** — still drop. Not image-related, separate schema issue.
- **Feature flag `ENABLE_DALLE_HERO`:** read env in route, default `false`. If `true`, keep old `generateAndUploadHeroImage` path (for backward compat / research). If `false`, use Unsplash pipeline for hero.
- **Testimonial and team avatar fields** are nested in arrays — need to walk `block.testimonials[].avatar`, `block.members[].avatar` and upload each one.

## Requirements
- **Input:** existing `generate-site` route receives the same contract (no API change)
- **Behavior change:** response now has 8–15 Media IDs wired into blocks vs 0–1 today
- **Backward compat:** `ENABLE_DALLE_HERO=true` env restores old flow exactly
- **Tests:** existing 367 AI tests remain green

## Architecture

```
┌─ Current flow ────────────────────────────┐
│ AI blocks → sanitizer (strip URLs)        │
│       DALL-E hero (parallel) → attach     │
└───────────────────────────────────────────┘

┌─ New flow ────────────────────────────────┐
│ AI blocks                                 │
│    ↓                                      │
│ planImageNeeds(blocks) → [{blockRef,field,blockType,count}]│
│    ↓                                      │
│ for each need:                            │
│   deriveKeywords → getMediaForBlock → mediaIds│
│    ↓                                      │
│ injectMediaIds(blocks, plan, results)     │
│    ↓                                      │
│ sanitizeBlocksForPayload (smarter — leaves Media IDs alone)│
│    ↓                                      │
│ Payload save                              │
└───────────────────────────────────────────┘
```

New helper file: `src/lib/ai/media-injector.ts`
```ts
type ImageNeed = {
  blockRef: AIBlock              // mutable pointer
  path: string                   // 'backgroundImage' | 'image' | 'testimonials[0].avatar' | 'members[2].avatar' | 'images[4].image'
  blockType: string
  count: 1                       // (each path is 1 slot; we aggregate outside)
}

export function planImageNeeds(blocks: AIBlock[]): ImageNeed[] { /* walk blocks, collect fields needing images */ }
export async function fulfillImageNeeds(needs: ImageNeed[], ctx, payload): Promise<void> {
  // group by blockType for batched search
  // call media-pipeline.getMediaForBlock
  // mutate blockRef in place — set path to Media ID
}
```

## Related code files
- `src/app/api/ai/generate-site/route.ts` lines 232–367 (MODIFY — rewire)
- `src/lib/ai/openai-generator.ts` lines 828–833 (MODIFY — don't strip if value is numeric Media ID)
- `src/lib/ai/unsupported-blocks.ts` lines 20–28 (MODIFY — remove 3 blocks)
- `src/lib/ai/openai-image.ts` (KEEP as-is behind flag)
- `src/lib/ai/media-pipeline.ts` (phase-02)
- `src/lib/ai/image-keywords.ts` (phase-03)
- `src/lib/ai/media-injector.ts` (NEW, this phase)

## Implementation steps

### 4.1 Update unsupported-blocks list
1. Open `src/lib/ai/unsupported-blocks.ts`.
2. Remove `gallery`, `portfolio-grid` from `BLOCKS_REQUIRE_MEDIA_PIPELINE`. Keep `before-after`, `menu-display`, `review-cards`, `booking-widget` (not in Pages.ts schema yet — separate concern).
3. Add comment linking to this plan: `// Re-enabled via plan 260414-1400-ai-gen-unsplash-pipeline`.
4. Update unit test `unsupported-blocks.test.ts` expectations.

### 4.2 Smarter sanitizer
1. Open `src/lib/ai/openai-generator.ts` line 828.
2. Change the strip logic:
```ts
const uploadFields = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']
for (const field of uploadFields) {
  const v = s[field]
  if (typeof v === 'string') {
    // Was URL — should have been replaced by media-injector. If still string, DROP.
    delete s[field]
  } else if (typeof v === 'number') {
    // Media ID already — leave it
  } else if (v && typeof v === 'object' && 'id' in v) {
    // Media object — extract ID
    s[field] = v.id
  }
}
```
3. Also handle nested paths: `testimonials[].avatar`, `members[].avatar`, `images[].image`, `items[].image`, `logos[].logo`. Walk the arrays.
4. Update `openai-generator.test.ts` sanitizer test cases.

### 4.3 Media injector helper
1. Create `src/lib/ai/media-injector.ts`.
2. Implement `planImageNeeds(blocks)` — scan each block, use a config map `BLOCK_IMAGE_FIELDS`:
```ts
const BLOCK_IMAGE_FIELDS = {
  hero:        ['backgroundImage', 'image'],
  about:       ['image'],
  gallery:     ['images[].image'],
  'portfolio-grid': ['items[].image'],
  team:        ['members[].avatar'],
  testimonials:['testimonials[].avatar'],
  'logo-cloud':['logos[].logo'],
}
```
3. Implement `fulfillImageNeeds(needs, ctx, payload)`:
   - group by blockType
   - for each group, call `deriveKeywords(ctx.category, blockType, ctx)` → `getMediaForBlock(blockType, keywords, count, ...)`
   - mutate each `need.blockRef[need.path]` to assigned Media ID
4. Export `setPath(obj, path, value)` utility for nested writes (tested).

### 4.4 Route rewire
1. Open `src/app/api/ai/generate-site/route.ts`.
2. Keep `heroImagePromise` kickoff BEHIND flag:
```ts
const ENABLE_DALLE = process.env.ENABLE_DALLE_HERO === 'true'
const heroImagePromise = ENABLE_DALLE
  ? generateAndUploadHeroImage(businessInfo, String(resolvedTenantId), payload)
  : Promise.resolve(null)
```
3. After `generateSiteWithAI(...)` returns, and BEFORE `sanitizeBlocksForPayload(...)`:
```ts
// --- NEW: Unsplash media pipeline ---
if (!ENABLE_DALLE) {
  const needs = planImageNeeds(result.blocks)
  await fulfillImageNeeds(needs, {
    category: businessInfo.category ?? 'business',
    businessName: businessInfo.businessName,
    industry: businessInfo.industry,
    tenantId: String(resolvedTenantId),
  }, payload)
}
```
4. Keep existing `heroMedia` wire-up for DALL-E flag path — line 355–367 stays behind `if (ENABLE_DALLE && heroMedia)`.
5. Update SSE event `block_complete` data to include Media objects for frontend preview — after injection.

### 4.5 Environment config
1. Add `ENABLE_DALLE_HERO=false` to `.env.example`, `.env.staging.example`, `.env.production.example`.
2. Add `UNSPLASH_ACCESS_KEY=` (placeholder) to all 3 env files.
3. CI env check will auto-validate (per CLAUDE.md §Env vars).

## Todo
- [ ] `unsupported-blocks.ts` updated, tests pass
- [ ] Sanitizer handles number/object/string for upload fields
- [ ] `media-injector.ts` created with `planImageNeeds` + `fulfillImageNeeds`
- [ ] Nested array path injection works (`testimonials[2].avatar`)
- [ ] Route uses feature flag, DALL-E path still works when flag=true
- [ ] Env placeholders added to 3 env.example files
- [ ] Existing 367 AI tests green
- [ ] Hero block always has Media ID post-gen (regardless of flag)
- [ ] Gallery block has ≥4 Media IDs when it appears
- [ ] Team/testimonials avatars wired

## Success criteria
- [ ] `curl -X POST /api/ai/generate-site` with default flag returns page with ≥8 Media IDs in blocks
- [ ] Setting `ENABLE_DALLE_HERO=true` reverts to DALL-E hero + no gallery images
- [ ] `pnpm test` — all AI tests green (367 existing + new from phase-01/02/03)
- [ ] Visual audit: gen 5 categories, eyeball each has real imagery in hero + gallery + team + testimonials
- [ ] No 500 errors when Unsplash rate-limited (fallback chain holds)

## Risk assessment
- **R1 — 15 parallel Payload writes trigger DB lock:** mitigation = media-pipeline concurrency=3, Payload transactional writes serial per request.
- **R2 — Latency regression:** current DALL-E is ~8s parallel to AI (~0 added). Unsplash path is ~5s serial after AI. Net: gen time +5s. Acceptable for 10x imagery.
- **R3 — AI returns unknown block type not in `BLOCK_IMAGE_FIELDS`:** mitigation = fall through, log, no crash.
- **R4 — Sanitizer change breaks existing variant-validation tests:** mitigation = run full suite before+after, fix affected tests.
- **R5 — Cost hidden regression:** if `ENABLE_DALLE_HERO` accidentally defaults to `true` in prod env, $0.04/gen returns. Mitigation = explicit `=== 'true'` check, default `false`; CI asserts.

## Security considerations
- Feature flag read from `process.env` — never from request body (avoid client override).
- `planImageNeeds` walks AI-generated structures — defensive: check path existence before mutating, no prototype pollution.
- Media IDs injected server-side only; never echoed to client before Payload auth-check runs.
- Log Media IDs + counts per gen for audit trail.

## Next steps
→ phase-05 (parallel track — Scope B prompt rewrite) and phase-06 (e2e test matrix).
