---
title: "Pixabay + Unsplash multi-provider image source"
description: "Add Pixabay as a 2nd stock-image provider with automatic fallback, behind a thin router. Reuse all existing retry/concurrency/upload logic."
status: pending
priority: P2
effort: 5h
branch: staging
tags: [ai-gen, images, pixabay, unsplash, provider-abstraction]
created: 2026-06-23
---

# Pixabay + Unsplash Multi-Provider

## Goal
Add Pixabay as a second stock-image provider alongside Unsplash, with automatic
fallback (primary → secondary on rate-limit / empty results). MINIMAL code, keep
existing media orchestration/concurrency/upload logic, and move provider-specific
retry/download behavior behind the router. Pixabay primary by default.

## Why Pixabay primary
| Provider | Free limit | Attribution | Download-track ToS |
|----------|-----------|-------------|--------------------|
| Pixabay  | ~100/min (≈6000/hr) | none | none |
| Unsplash demo | 50/hr | recommended | MANDATORY |
Pixabay's free limit is ~120× Unsplash demo and has no ToS download-ping → safer
default for high-volume gen. Unsplash stays as fallback (richer search relevance).

## CRITICAL design correction (read before coding)
The brief assumed "mirror Unsplash signatures + import-swap call sites". **This is
NOT clean** — consumers couple to Unsplash-only mechanics that Pixabay lacks:
- `buildImgixUrl(photo.urls.raw, …)` → Unsplash CDN is Imgix; resize via query params. **Pixabay has no Imgix** — it ships fixed sizes (`webformatURL` ~640px, `largeImageURL` ~1280px). No `urls.raw`.
- `photo.links.download_location` → Unsplash-only tracking URL. Pixabay has none.
- `err instanceof UnsplashError && err.code === 'RATE_LIMITED'` → 3 call sites branch on the concrete class.

**Decision:** introduce ONE normalized `ProviderPhoto` shape + `ProviderError`
that BOTH clients return. Router + clients speak the normalized shape; each client
pre-bakes its own resize URL internally (Imgix for Unsplash, size-pick for Pixabay).
Callers stop calling `buildImgixUrl` directly and stop touching `.urls.raw` /
`.links.download_location`. This is more than an import-swap but is the only correct
way; still small: 2 provider modules, 6 direct call-site migrations, env examples,
and focused tests. `generate-site` is orchestration, not a direct provider consumer.

## Phases
| # | Phase | Status | Owner glob |
|---|-------|--------|-----------|
| 01 | [Shared provider types + Pixabay client](phase-01-shared-types-pixabay-client.md) | pending | `src/lib/ai/image-provider-types.ts`, `src/lib/ai/pixabay-client.ts` |
| 02 | [Provider router + fallback](phase-02-router-fallback.md) | pending | `src/lib/ai/image-provider.ts` |
| 03 | [Wire call sites + provider-aware alt text](phase-03-wire-call-sites.md) | pending | `media-pipeline.ts`, `image-pool.ts`, `image-library-seeder.ts`, `generate-sample-products.ts`, `seed-blog-posts.ts`, `upload-media.ts` |
| 04 | [Env vars + tests](phase-04-env-and-tests.md) | pending | `.env.*.example`, `src/__tests__/**` |

## Dependencies
- 01 → 02 (router imports both clients + shared types)
- 02 → 03 (call sites import router)
- 03 → 04 (tests assert wired behavior)
- 01,02,03 are SEQUENTIAL (each builds on prior). 04 partially parallel (env vs tests).

## Schema / migration
**NO DB schema change.** Images already flow to Payload `media` collection
unchanged (same `uploadBufferToMedia`). `scripts/db-setup.js` MIGRATIONS array
untouched. State this explicitly in PR description so the CI schema gate is a no-op.

## Existing flow
Site block imagery is already pool-first: `generate-site` builds one image pool, then
`media-injector` fills deficits per block when the pool underfills. F38 changes the
provider behind that flow; it does not redesign the generation pipeline.

## Caching / idempotency
No new cache layer. Existing idempotency = per-site `media` rows keyed by alt prefix
(seeder) — unchanged. No search-result cache is added (YAGNI).

## Out of scope
- DALL-E path (`ENABLE_DALLE_HERO`) — untouched.
- Pixabay video/illustration types — `image_type=photo` only.
- Per-provider quota dashboards / metrics.
