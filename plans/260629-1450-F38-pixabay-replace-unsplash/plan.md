---
title: "Replace Unsplash search API with Pixabay (Option A)"
description: "Swap the live image-search provider from Unsplash to Pixabay. Migrate 6 call sites. Keep the ~400 static curated Unsplash CDN fallback URLs (hotlinked, no key) untouched."
status: pending
priority: P2
effort: 5h
branch: investigate/F38-pixabay-image-provider
tags: [ai-gen, images, pixabay, unsplash-removal, F38]
created: 2026-06-29
---

# F38 — Replace Unsplash Search API with Pixabay (Option A)

## Goal
Make every RUNTIME image **search** use Pixabay instead of Unsplash. Pixabay's
free limit (~100/min ≈ 6000/hr) is ~120× Unsplash demo (50/hr) → far fewer
rate-limit fallbacks. Keep all existing media orchestration / concurrency /
upload / fallback logic unchanged.

## Scope decision (locked)
**Option A — search API only.** The ~400 hardcoded `images.unsplash.com` URLs
across `preview/renderers/images.ts` (336), `blog-thumbnail-images.ts` (43),
`media-pipeline.ts` HERO_FALLBACK (15), etc. are STATIC hotlinks (stable photo
IDs, no API key). They STAY — Pixabay URLs are hash-based + ToS forbids
hotlinking, so 1:1 swapping them is fragile. Only the live search client +
its 6 consumers change.

## CRITICAL: SSRF allowlist must keep Unsplash hosts
The static fallback URLs (hero / blog Tier B / product Tier C) flow through the
SAME `downloadPhotoBuffer` SSRF guard. So the new Pixabay client's download
allowlist = `['pixabay.com', 'cdn.pixabay.com', 'images.unsplash.com', 'plus.unsplash.com']`.
Drop any Unsplash host → all static fallbacks break.

## Pixabay API facts (live-tested 2026-06-29, free tier)
- Endpoint `https://pixabay.com/api/`, auth via `key` query param.
- `largeImageURL` (1280px) **available** in free tier ✅. `fullHDURL`/`imageURL` need full-access approval (null).
- Image host = `pixabay.com/get/...` (NOT cdn.pixabay.com for hits).
- `per_page` min = 3 (clamp count≥3, slice to requested). Rate limit 100/60s via `X-RateLimit-*` headers. `totalHits` capped 500.
- Orientation map: landscape→horizontal, portrait→vertical, squarish→all.
- Fields used: `hit.id`, `hit.webformatURL` (640), `hit.largeImageURL` (1280), `hit.tags` (alt), `hit.user` (photographer), `hit.imageWidth/Height`.

## Phases
| # | Phase | Status | Owner glob |
|---|-------|--------|-----------|
| 01 | [Pixabay client](phase-01-pixabay-client.md) | pending | `src/lib/ai/pixabay-client.ts` |
| 02 | [Migrate 6 call sites + delete unsplash-client](phase-02-migrate-call-sites.md) | pending | `media-pipeline.ts`, `image-pool.ts`, `image-library-seeder.ts`, `generate-sample-products.ts`, `seed-blog-posts.ts`, `upload-media.ts`, del `unsplash-client.ts` |
| 03 | [Env + tests](phase-03-env-and-tests.md) | pending | `.env.*.example`, `scripts/check-env-vars.js`, `src/__tests__/**`, `docs/qa/F38*` |

## Dependencies
- 01 → 02 (call sites import the new client)
- 02 → 03 (tests assert wired behavior; env after code)
- SEQUENTIAL (single-agent, shared symbols).

## Schema / migration
**NO DB change.** Images still flow to Payload `media` unchanged. `db-setup.js`
MIGRATIONS untouched → CI schema gate is a no-op. State in PR.

## Public-surface contract (minimize call-site churn)
`pixabay-client.ts` exports the SAME function names the call sites already use:
`searchPhotos(query, count, opts)`, `downloadPhotoBuffer(url, maxBytes)`,
`PixabayError` (same 9-member `.code` union as UnsplashError → `=== 'RATE_LIMITED'`
keeps working), `PIXABAY_ORIENTATION_BY_BLOCK`. Returned photo is a normalized
`PixabayPhoto { id, url (pre-sized), alt, photographer, width, height }`.
Call sites drop `buildImgixUrl(photo.urls.raw, …)` → use `photo.url`; drop
`trackDownload(photo.links.download_location)` (Pixabay has no tracking).

## Out of scope
- The ~400 static Unsplash fallback URLs (Option A keeps them).
- DALL-E path (`ENABLE_DALLE_HERO`), Pixabay video/illustration types.
- Re-curating fallback pools to Pixabay (that's Option B — deferred).
