# Phase 01 — Shared provider types + Pixabay client

**Priority:** P1 · **Status:** pending · Blocks 02,03,04.

## Overview
Define ONE normalized photo/error shape both providers satisfy, then add the
Pixabay HTTP client mirroring Unsplash client's PUBLIC surface but returning the
normalized shape. Reuse Unsplash's retry/SSRF/timeout patterns verbatim.

## Files to create
- `src/lib/ai/image-provider-types.ts` — shared types + `ProviderError`.
- `src/lib/ai/pixabay-client.ts` — Pixabay wrapper.

## Files to read for context
- `src/lib/ai/unsplash-client.ts` (retry loop L153-190, SSRF guard L247-255, download L261-293) — copy the patterns, do NOT rewrite.

## THE shared contract (exact — extracted from real code)

Unsplash today returns `UnsplashPhoto` (raw API shape: `urls.raw`, `links.download_location`, `user.name`, `width/height`, `alt_description`). Callers then call `buildImgixUrl(photo.urls.raw, preset)` to get a sized URL. Pixabay cannot do this. So the normalized shape carries a **ready-to-download sized URL the client itself produced**, plus the fields callers actually read.

```ts
// src/lib/ai/image-provider-types.ts
export type ProviderName = 'unsplash' | 'pixabay'
export type ProviderOrientation = 'landscape' | 'portrait' | 'squarish'

/** Normalized photo — BOTH clients return this. Superset of fields the 6 call sites read. */
export interface ProviderPhoto {
  id: string
  provider: ProviderName
  /** Ready-to-download URL, already sized by the client. Pass straight to downloadPhotoBuffer. */
  url: string
  /** Raw description/tags for alt text (pre-sanitize). */
  alt: string | null
  /** Photographer display name for attribution. */
  photographer: string
  width: number
  height: number
  /** Unsplash-only tracking URL; '' for Pixabay (trackDownload no-ops on ''). */
  downloadLocation: string
}

export interface ProviderSearchOptions {
  orientation?: ProviderOrientation
  /** Target render box — client maps to Imgix params (Unsplash) or nearest size (Pixabay). */
  width?: number
  height?: number
  fit?: 'crop' | 'clip'
  page?: number
}

export type ProviderErrorCode =
  | 'NO_KEY' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'SERVER_ERROR'
  | 'DOWNLOAD_FAIL' | 'TOO_LARGE' | 'TIMEOUT' | 'SSRF_BLOCKED' | 'EMPTY_RESULTS'

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly code: ProviderErrorCode,
    public readonly status: number,
    public readonly retryable: boolean,
    message?: string,
  ) {
    super(message ?? `[${provider}] ${code} (status=${status})`)
    this.name = 'ProviderError'
  }
}

export interface DownloadResult { buffer: Buffer; mimetype: string; size: number }

/** Each provider client implements this. */
export interface ImageProviderClient {
  name: ProviderName
  hasKey(): boolean
  searchPhotos(query: string, count: number, opts?: ProviderSearchOptions): Promise<ProviderPhoto[]>
  downloadPhotoBuffer(url: string, maxBytes?: number): Promise<DownloadResult>
  /** Unsplash: pings tracking URL. Pixabay: no-op. */
  trackDownload(downloadLocation: string): void
}
```

> Note: `UnsplashError.code` union currently has the SAME 9 members → `ProviderErrorCode` reuses them 1:1, so the existing `err.code === 'RATE_LIMITED'` branches keep working once they switch to `ProviderError`.

## Pixabay client — implementation steps
1. `const BASE = 'https://pixabay.com/api/'`; `DOWNLOAD_HOST_ALLOWLIST = ['cdn.pixabay.com', 'pixabay.com']` (SSRF guard, mirror Unsplash L247-255).
2. `hasKey()` reads `process.env.PIXABAY_API_KEY` (len ≥ 10). Missing key → `searchPhotos` returns `[]` + warn-once (mirror Unsplash L133-141, L207-210).
3. Map options → params: `key`, `q` (trim), `image_type=photo`, `orientation` map (`landscape→horizontal`, `portrait→vertical`, `squarish→all`), `per_page=clamp(count,3,200)` (Pixabay min is 3 — clamp low side to 3), `safesearch=true`, `page`. Build with `URLSearchParams`; after mapping `hits`, return only the first requested `count` photos.
4. `fetchWithRetry`: COPY Unsplash L153-190 structure (2 attempts, 401/403→UNAUTHORIZED non-retry, 429/5xx→retry once then RATE_LIMITED/SERVER_ERROR, AbortError→TIMEOUT). Pixabay returns 429 with `X-RateLimit-Remaining` header → log when low (mirror L143-151). Throw `ProviderError('pixabay', …)`.
5. Response: `json.hits[]`. Map each hit → `ProviderPhoto`:
   - `id: String(hit.id)`, `provider: 'pixabay'`
   - `url`: pick by requested box — if `width>=1000` use `hit.largeImageURL` else `hit.webformatURL` (Pixabay ships fixed sizes; NO query-param resize). Default `largeImageURL`.
   - `alt`: `hit.tags` (comma list) — used for alt text
   - `photographer: hit.user`
   - `width: hit.imageWidth`, `height: hit.imageHeight`
   - `downloadLocation: ''`
   - Empty `hits` → return `[]` (do NOT throw; callers handle empty).
6. `downloadPhotoBuffer`: COPY Unsplash L261-293 verbatim, only swap allowlist + error provider tag. Same 10MB cap, 15s timeout, content-type sniff.
7. `trackDownload(_: string): void { /* no-op — Pixabay has no download endpoint */ }`.

## Success criteria
- [ ] `pixabay-client.ts` exports `searchPhotos / downloadPhotoBuffer / trackDownload / hasKey`, all returning normalized types.
- [ ] `tsc --noEmit` passes (`npm run typecheck` or `npx tsc --noEmit`).
- [ ] Both files < 200 lines each (split if over).
- [ ] No `urls.raw` / Imgix references in pixabay-client (Pixabay can't resize).

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| `largeImageURL` field absent on some hits | Low×Med | Fallback to `webformatURL` when largeImageURL falsy |
| Pixabay per_page min=3 breaks count=1 callers (sample-products/blog) | Med×Low | Clamp per_page to ≥3, slice results to requested count in router/caller |
| SSRF allowlist wrong host | Low×High | Verify actual `webformatURL`/`largeImageURL` host at impl time (expect `cdn.pixabay.com`/`pixabay.com`); log blocked URL |

## Test note (Phase 04 covers)
TC-IDs to register in `docs/qa/F38-image-provider-multi-source.md`: pixabay search maps hits→ProviderPhoto, orientation mapping, empty key→[], 429→ProviderError RATE_LIMITED, SSRF block non-pixabay host.
