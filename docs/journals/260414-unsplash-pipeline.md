---
date: 2026-04-14
branch: feat/F01-ai-gen-variety-fix
pr: '#555'
commits: [0e62c423, 9389b7a9]
tags: [ai, unsplash, media-pipeline, category-dna]
---

# 2026-04-14 — AI gen: Unsplash media pipeline + Category DNA

## Problem

AI-generated sites visual quality ~30%. Symptoms user reported: empty gallery
placeholders, letter-only team avatars, sparse 5-7 block layouts, generic
templates. Root causes diagnosed across 4 layers:

1. **Media pipeline** — DALL-E only generated 1 hero image per gen ($0.04 cost).
   Gallery, team, testimonials, portfolio-grid all dropped via `unsupported-blocks.ts`
   because Payload upload fields require Media IDs but AI only provides URL strings.
2. **Structure** — System prompt had `CATEGORY_SIGNATURE_BLOCKS` but picked 1-2 of 3
   signature blocks. No hard minimum block count. AI defaulted to 5-6 block safe layout.
3. **Content depth** — AI generated 2 testimonials, 2 team members → sparse.
4. **Theme/render** — out of scope this work.

After 10+ commits of sanitizer fixes (fc0020d, 0ffd0eae, 3e7fe8cd), still visually
poor. User asked for strategic review → decided to pivot from patching symptoms
to structural fix.

## Decision

Scope A (Unsplash media pipeline) + Scope B (Category DNA enforcer) combined.
Free Unsplash replaces paid DALL-E as default. DALL-E preserved behind
`ENABLE_DALLE_HERO=false` feature flag for rollback.

Target: Malaysia market (en + ms primary, vi for team QA only).

## Implementation (Plan 260414-1400-ai-gen-unsplash-pipeline, 7 phases)

**Scope A — Media pipeline (4 new modules):**

- `unsplash-client.ts` — HTTP wrapper with `searchPhotos`, `downloadPhotoBuffer`,
  `trackDownload` (fire-and-forget, license-mandatory per Unsplash ToS),
  `buildImgixUrl`. SSRF guard (allowlist `images.unsplash.com`). Retry 429/5xx
  once with 2s jitter. Rate-limit log when <100 remaining.
- `media-pipeline.ts` — Orchestration: search → download → upload via
  `payload.create({collection: 'media', file: {...}})`. Semaphore concurrency
  3 to avoid 429. Partial failure tolerated. Hero fallback chain = search → broadened search → hardcoded URL. Size presets per block type (hero 1920×1080,
  gallery 1200×800, avatar 400×400 faces-crop).
- `image-keywords.ts` — Category × block keyword derivation. `MS_TO_EN_FALLBACKS`
  (30 entries, primary market) + `VN_TO_EN_FALLBACKS` (30 entries, team QA).
  Longest-key-first iteration to avoid prefix matches ("kedai" vs "kedai kopi").
- `media-injector.ts` — `planImageNeeds` walks blocks, identifies image slots
  per `BLOCK_IMAGE_SPEC` config. `fulfillImageNeeds` groups by block type,
  calls pipeline, mutates blocks via assign closures. `cleanupNonNumericImageFields`
  strips failed slots (Payload save would otherwise reject).

**Scope B — Category DNA enforcer (3 new modules):**

- `category-requirements.ts` — 14 categories × `{minBlocks, mandatoryBlocks,
  recommendedBlocks, minItems}` constants. beauty=10 blocks, restaurant=11.
- `content-injection.ts` — `buildBlockFromLibrary(blockType, category, ctx)`
  reads existing `content/{category}.ts` library. Generic fallback to `business`
  content for unknown categories. Handles 17 block types including nav, hero,
  testimonials, faq, cta, contact, footer, features, stats, team, service-cards,
  gallery, newsletter, pricing, logo-cloud.
- `structure-enforcer.ts` — `enforceMinimumStructure` injects missing mandatory
  blocks at smart positions (nav=0, footer=last, cta/contact before footer,
  stats/testimonials after features). `enforceMinItems` pads testimonials,
  team, features, faq from library without creating exact duplicates.

**Wired in:**

- `openai-generator.ts` — Call enforcers after `validateBlocks` on homepage
  (multi-page + single-page paths).
- `generate-site/route.ts` — Feature flag `ENABLE_DALLE_HERO` default false.
  Call `planImageNeeds` + `fulfillImageNeeds` + `cleanupNonNumericImageFields`
  after `result.blocks`. Hero media injection for DALL-E path stays gated
  behind `ENABLE_DALLE_HERO=true`.
- `unsupported-blocks.ts` — Removed `gallery` + `portfolio-grid` from drop list.
  `before-after`, `menu-display`, `review-cards`, `booking-widget` still dropped.

## Validation (4 decisions, 2026-04-14)

1. **Attribution UI**: alt-text only. Format
   `${alt_description} — Photo by ${user.name} on Unsplash`. Invisible to user,
   satisfies Unsplash ToS. 0 min impl (auto from API fields).
2. **Few-shot examples**: MS + EN for MY market, skip VN. Deferred to followup —
   gap-filler already solves sparse layout.
3. **`before-after` block**: keep dropped. Payload schema migration out of scope.
4. **Pexels fallback**: stub only. Promote to real impl if Unsplash rate-limit
   pain in QA.

## Impact (verified e2e, "Bo Bo Spa V5" gen)

| Metric | Before | After |
|---|---|---|
| Blocks per page | 5-7 | **10** |
| Real images | 1 (hero DALL-E) | **11** (hero + gallery 6 + testimonials 3 + about) |
| Cost per gen | $0.04 | **$0.00** |
| Latency | ~30s | ~43s |
| Structure enforcer | N/A | Injected 2 blocks (service-cards, cta), padded 3 (features 4→6, testimonials 2→3, about) |
| Unsplash quota | N/A | 15 req/gen (30% of 50 demo tier) |
| Errors | variable | **0** |

Server log verified: `[Media Injector] fulfilled 11/11 image slots across 4 block type(s)`

## Tests

444/444 AI unit tests pass (was 367, +77 new). 4 new test files:
- `unsplash-client.test.ts` (13 cases: auth, retry, SSRF, size cap, Imgix builder)
- `image-keywords.test.ts` (20 cases: 14 category coverage, MS/VN fallback priority)
- `media-injector.test.ts` (13 cases: plan needs, padding, cleanup)
- `structure-enforcer.test.ts` (11 cases: injection, padding, 14 category coverage)

## Gotchas encountered

- **`typeof` mismatch in planImageNeeds gallery**: gallery items from AI had
  `image: {url, alt}` object (from existing sanitizer wrap) — my planner didn't
  skip them. Fixed by accepting numbers only, letting `cleanupNonNumericImageFields`
  strip objects post-fulfillment.
- **Longest-key-first iteration**: `VN_TO_EN_FALLBACKS` had `kedai` entry before
  `kedai kopi`. Word boundary regex matched `kedai` first → wrong result.
  Fixed by sorting entries by key length descending.
- **Content injection for unknown categories**: `buildBlockFromLibrary` early-returned
  null when no category content existed. Fixed by falling back to `business`
  category content (generic).
- **Payload `BasePayload` type mismatch**: route couldn't pass `payload` directly
  to media injector. Cast via `Parameters<typeof fulfillImageNeeds>[2]`.

## Skipped from plan (defer)

- Few-shot examples (14 × EN + MS) — Phase 05 sub-step 5.4
- Content depth rules in system prompt text (hero subheadline word count etc)
- Unsplash production tier application (manual, 1-3 day async)
- Pexels real implementation
- `before-after` Payload schema migration

## Followup plans

- `plans/260414-1400-ai-gen-unsplash-pipeline/` — this work (shipped)
- Future: Phase 08 theme category library (spa=earth tones, tech=cool, etc)
- Future: Pre-curated Media library for Unsplash-independent fallback
- Future: Tenant scoping on Media read (researcher-02 security flag)
