# Phase 02 — Media pipeline orchestration

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01 (unsplash-client)
- Blocks: phase-04 (route integration)
- Research: [researcher-02 §1, §4, §5, §7](./research/researcher-02-payload-media-pipeline.md)

## Overview
- Date: 2026-04-14
- Description: Orchestration layer: takes a search query + count + metadata → returns `Media.id[]` ready for Payload block fields. Handles parallel batch, concurrency limit, fallback chain (Unsplash → Pexels stub → hardcoded Unsplash URL → null), and Payload `media` collection upload.
- Priority: P1
- Implementation: pending
- Review: pending

## Key insights
- **Reuse the existing pattern** in `openai-image.ts:64–86` — it already does `fetch → Buffer → payload.create({collection: 'media', file: {...}})`. Generalize into a reusable `uploadBufferToMedia()` helper.
- **Payload auto-generates `imageSizes`** (thumbnail/card/hero/square from `Media.ts`) on upload — do NOT pre-resize Unsplash URLs. Pass full 1600×900 buffer, let Payload Sharp pipeline crop.
- **Batch concurrency:** hero (1) + gallery (6) + team avatars (3) + testimonial avatars (4) + about (1) = ~15 parallel HTTP calls. Without limit → Unsplash 429. Use `p-limit` style manual semaphore with concurrency 3.
- **Partial failure policy:** if hero succeeds but gallery[3] fails, continue with [0, 1, 2] — log warn, don't reject whole gen.
- **Cache by Unsplash photo ID:** add optional `unsplashId` metadata field on Media (followup — not this phase) so re-gens reuse downloaded assets.
- **Tenant scoping:** pass `tenant` field in `data` when creating — matches existing DALL-E pattern. Even though read access is public (noted in research-02 §2), write must tag tenant for ownership.

## Requirements
- **Input:** `{ query: string, count: number, blockContext: 'hero'|'gallery'|'avatar'|'about'|'portfolio', businessName: string, tenantId: string, payload: Payload }`
- **Output:** `Promise<{ mediaIds: number[], photos: UnsplashPhoto[], failures: Error[] }>`
- **Concurrency:** max 3 parallel downloads
- **Fallback chain:** Unsplash search → Pexels (stub for now) → hardcoded Unsplash URL (from openai-image.ts:66) → return empty array

## Architecture

```
src/lib/ai/media-pipeline.ts
├── uploadBufferToMedia(payload, buffer, filename, mimetype, alt, tenantId)  [helper]
├── fetchAndStoreUnsplashPhoto(photo, ctx, payload)  [1 photo → 1 Media ID]
├── batchFetchMedia(query, count, ctx, payload)      [N photos, concurrency 3]
└── getMediaForBlock(blockType, keywords, count, ctx, payload)  [PUBLIC entry]
```

Pseudo-code:
```ts
import { searchPhotos, trackDownload, downloadPhotoBuffer, buildImgixUrl } from './unsplash-client'

const CONCURRENCY = 3

export async function getMediaForBlock(blockType, keywords, count, ctx, payload) {
  const query = keywords.join(' ')
  const orientation = ORIENTATION_BY_BLOCK[blockType] ?? 'landscape'
  try {
    const photos = await searchPhotos(query, count * 2, { orientation, contentFilter: 'high' })
    if (photos.length === 0) return fallbackChain(blockType, ctx, payload)
    const picks = pickRandomN(photos, count)
    return await batchFetchMedia(picks, blockType, ctx, payload)
  } catch (err) {
    console.warn('[Media Pipeline] Unsplash search failed', err.message)
    return fallbackChain(blockType, ctx, payload)
  }
}

async function batchFetchMedia(photos, blockType, ctx, payload) {
  const mediaIds = []
  const failures = []
  const sem = new Semaphore(CONCURRENCY)
  await Promise.all(photos.map(p => sem.run(async () => {
    try {
      const mediaId = await fetchAndStoreUnsplashPhoto(p, { ...ctx, blockType }, payload)
      mediaIds.push(mediaId)
    } catch (e) { failures.push(e) }
  })))
  return { mediaIds, photos, failures }
}

async function fetchAndStoreUnsplashPhoto(photo, ctx, payload) {
  const url = buildImgixUrl(photo.urls.raw, sizePresetFor(ctx.blockType))
  const { buffer, mimetype } = await downloadPhotoBuffer(url)
  trackDownload(photo.links.download_location)  // fire-and-forget
  const alt = photo.alt_description ?? `${ctx.businessName} ${ctx.blockType}`
  return uploadBufferToMedia(payload, buffer, `${ctx.blockType}-${photo.id}-${Date.now()}.jpg`, mimetype, alt, ctx.tenantId)
}

async function uploadBufferToMedia(payload, buffer, filename, mimetype, alt, tenantId) {
  const doc = await payload.create({
    collection: 'media',
    data: { alt, tenant: tenantId },
    file: { data: buffer, mimetype, name: filename, size: buffer.length },
  })
  return doc.id
}

async function fallbackChain(blockType, ctx, payload) {
  // 1. Pexels — stub, returns []
  // 2. Hardcoded Unsplash URL (only if hero)
  // 3. Empty
  if (blockType === 'hero') {
    const HARDCODED = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=900&fit=crop&q=80'
    try {
      const { buffer, mimetype } = await downloadPhotoBuffer(HARDCODED)
      const id = await uploadBufferToMedia(payload, buffer, `hero-fallback-${Date.now()}.jpg`, mimetype, `${ctx.businessName} hero`, ctx.tenantId)
      return { mediaIds: [id], photos: [], failures: [] }
    } catch { return { mediaIds: [], photos: [], failures: [] } }
  }
  return { mediaIds: [], photos: [], failures: [] }
}
```

## Related code files
- `src/lib/ai/unsplash-client.ts` (from phase-01)
- `src/lib/ai/openai-image.ts` lines 43–86 (prior art — generalize)
- `src/collections/Media.ts` (contract — `data.alt`, `data.tenant`, `file.{data, mimetype, name, size}`)
- `src/lib/ai/media-pipeline.ts` (NEW, this phase)

## Implementation steps
1. Create `src/lib/ai/media-pipeline.ts`; add `import 'server-only'`.
2. Define size presets: `hero = w=1600&h=900`, `gallery = w=800&h=600`, `avatar = w=200&h=200&fit=crop&crop=faces`, `about = w=1200&h=800`, `portfolio = w=600&h=800` (portrait).
3. Define orientation map: `hero|gallery|about|portfolio=landscape`, `avatar=squarish`.
4. Implement `Semaphore` class (or import `p-limit` if already in deps — check `package.json` first).
5. Implement `uploadBufferToMedia` (generalized from openai-image.ts).
6. Implement `fetchAndStoreUnsplashPhoto` — size preset, download, fire-and-forget track, upload.
7. Implement `batchFetchMedia` with semaphore + partial-failure collection.
8. Implement `fallbackChain` — Pexels stub returns empty for now, hardcoded Unsplash hero URL last resort.
9. Implement `getMediaForBlock` as sole public entry — takes block + keywords + count, returns result shape.
10. Add debug logs: `[Media Pipeline] hero: 1/1 uploaded (Media ID 42)` / `[Media Pipeline] gallery: 5/6 uploaded, 1 failed`.
11. Write tests: `src/__tests__/unit/lib/ai/media-pipeline.test.ts`. Mock `unsplash-client` + fake `payload`. Cover: happy 3 images, partial fail 2/3, total fail → fallback, hero fallback chain, concurrency cap respected (use timing assertion), SSRF guard (invalid URL).
12. Integration test: real Payload local instance + mocked unsplash (use `pnpm test:integration` if exists).

## Todo
- [ ] `media-pipeline.ts` module compiles, <300 LOC
- [ ] `uploadBufferToMedia` factored and reused by both paths
- [ ] Semaphore limits real network parallelism (verified in test)
- [ ] Partial failure returns what succeeded, never throws
- [ ] Hero fallback chain ends at hardcoded URL not null
- [ ] `trackDownload` called for every successful fetch
- [ ] Size presets match block type
- [ ] Unit tests cover 8+ cases
- [ ] No direct fetch calls (all via unsplash-client)

## Success criteria
- [ ] 15-image parallel batch completes in <10s on typical dev machine
- [ ] Partial failure logs warnings but gen continues
- [ ] `pnpm test src/__tests__/unit/lib/ai/media-pipeline.test.ts` green
- [ ] Zero new Payload write sites — all media writes go through `uploadBufferToMedia`

## Risk assessment
- **R1 — Payload Sharp pipeline OOM on 10 MB buffers × 15 concurrent:** mitigation = concurrency=3, pre-bounded by Unsplash Imgix `q=80` (~300 KB typical).
- **R2 — Media upload rate collision (two tenants writing simultaneously):** Payload handles; no lock needed.
- **R3 — Pexels stub returning empty makes chain effectively 2-step:** acceptable for MVP; wire real Pexels in followup if Unsplash rate-limit becomes real pain.
- **R4 — Double-download if same photo reused in hero + gallery:** acceptable (rare), dedupe in phase-04 if measured.
- **R5 — Payload tenant field required vs optional:** verify `src/collections/Media.ts` schema — current DALL-E passes tenant, so OK.

## Security considerations
- **SSRF:** `fetchAndStoreUnsplashPhoto` builds URL from Unsplash response — validate `photo.urls.raw` starts with `https://images.unsplash.com/` before calling `downloadPhotoBuffer`. Reject otherwise.
- **Alt text injection:** `alt_description` comes from Unsplash user content. Strip HTML/scripts before passing to `payload.create`. Payload's rich-text would sanitize, but `alt` is plain text — `.replace(/<[^>]*>/g, '')` safer.
- **Tenant authorization:** trust `tenantId` from route (already validated upstream). No access check here.
- **Logging:** don't log full buffer or full photo JSON — just IDs + sizes.

## Next steps
→ phase-03 (keyword strategy — what to pass as `query`) and phase-04 (route integration — who calls `getMediaForBlock` and maps results to block fields).
