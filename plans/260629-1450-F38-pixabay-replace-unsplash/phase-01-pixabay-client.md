# Phase 01 — Pixabay client

**Status:** pending · Blocks 02, 03.

## Create `src/lib/ai/pixabay-client.ts`
Mirror `unsplash-client.ts` PUBLIC surface so call-site churn is minimal. Copy
the retry / SSRF / timeout patterns verbatim (don't reinvent).

### Exports
- `PixabayPhoto` — `{ id: string; url: string; alt: string | null; photographer: string; width: number; height: number }`. `url` is pre-sized (Pixabay ships fixed sizes; no Imgix).
- `PixabaySearchOptions` — `{ orientation?: 'landscape'|'portrait'|'squarish'; width?: number; page?: number }`. (`contentFilter` accepted+ignored for call-site compat OR callers drop it — prefer dropping.)
- `PixabayError` — class, SAME 9-member `.code` union as `UnsplashError` (`NO_KEY|UNAUTHORIZED|RATE_LIMITED|SERVER_ERROR|DOWNLOAD_FAIL|TOO_LARGE|TIMEOUT|SSRF_BLOCKED|EMPTY_RESULTS`), `.status`, `.retryable`.
- `searchPhotos(query, count, opts?) : Promise<PixabayPhoto[]>`.
- `downloadPhotoBuffer(url, maxBytes?) : Promise<{buffer, mimetype, size}>`.
- `PIXABAY_ORIENTATION_BY_BLOCK: Record<string, orientation>` — copy values from `UNSPLASH_ORIENTATION_BY_BLOCK`.

### Implementation
1. `BASE='https://pixabay.com/api/'`. `DOWNLOAD_HOST_ALLOWLIST=['pixabay.com','cdn.pixabay.com','images.unsplash.com','plus.unsplash.com']` — **MUST keep Unsplash hosts** (static fallbacks download through here).
2. `hasKey()` reads `process.env.PIXABAY_API_KEY` (len≥10). Missing → `searchPhotos` returns `[]` + warn-once.
3. Params: `key`, `q=query.trim()` (≤100 chars), `image_type=photo`, `orientation` (map landscape→horizontal, portrait→vertical, squarish→all), `per_page=clamp(count,3,200)`, `safesearch=true`, `page`. After mapping `hits`, `slice(0, count)`.
4. `fetchWithRetry`: copy Unsplash L153-190 (2 attempts; 401/403→UNAUTHORIZED; 429/5xx→retry once then RATE_LIMITED/SERVER_ERROR; AbortError→TIMEOUT). Log when `x-ratelimit-remaining` low. Throw `PixabayError`.
5. Map `hit`→`PixabayPhoto`: `id=String(hit.id)`; `url`= `opts.width>=900 ? hit.largeImageURL : hit.webformatURL` (fallback to webformatURL if largeImageURL falsy; default largeImageURL); `alt=hit.tags`; `photographer=hit.user`; `width=hit.imageWidth`; `height=hit.imageHeight`. Empty `hits`→`[]` (don't throw).
6. `downloadPhotoBuffer`: copy Unsplash L261-293 verbatim; swap error tag to `'pixabay'`. Same 10MB cap, 15s timeout, content-type sniff, SSRF guard against the allowlist above.

## Success
- [ ] `npx tsc --noEmit` passes.
- [ ] File < 200 lines (split helpers if needed).
- [ ] Allowlist includes both Pixabay + Unsplash static hosts.
- [ ] No `urls.raw` / Imgix anywhere.
