# Phase 02 — Migrate 6 call sites + delete unsplash-client

**Status:** pending · Needs 01.

Pattern for all: swap import `unsplash-client` → `pixabay-client`; replace
`buildImgixUrl(photo.urls.raw, {w,h})` → `photo.url` (pass `{width: w}` into
`searchPhotos` opts so client size-picks); delete `trackDownload(...)` calls +
import; `UnsplashError` → `PixabayError` (`.code === 'RATE_LIMITED'` unchanged);
field reads `.alt_description`→`.alt`, `.user.name`→`.photographer`,
`.urls.regular`→`.url`. `UNSPLASH_ORIENTATION_BY_BLOCK`→`PIXABAY_ORIENTATION_BY_BLOCK`.

## Per-file
1. **media-pipeline.ts** — searchPhotos L359/366 (pass `width` from SIZE_PRESET); L176 buildImgixUrl→`photo.url`; remove trackDownload L179/206; L389 `UnsplashError`→`PixabayError`; L114 `.alt_description`→`.alt`, L115 `.user.name`→`.photographer`. **HERO_FALLBACK_BY_CATEGORY + heroFallbackChain: LEAVE AS-IS** (static Unsplash hotlink, downloads fine via allowlist). Update alt string "Stock Photo from Unsplash" → keep or "— Stock Photo".
2. **image-pool.ts** — searchPhotos L175/185/198/207 (add `width`); normalize L133-152: `.urls.regular`→`.url`, `.alt_description`→`.alt`, `.user.name`→`.photographer`, `.links.download_location`→drop (PoolPhoto.downloadLocation = `''`).
3. **image-library-seeder.ts** — searchPhotos L188 (add `width: slotDef.imgixW`); L210 buildImgixUrl→`photo.url`; L232 downloadPhotoBuffer import swap; remove trackDownload L234 + `.links.download_location` L211.
4. **generate-sample-products.ts** — searchPhotos L186/194/202 (count 1→clamped to 3 internally, sliced; pass `width:800`); L207 buildImgixUrl→`photo.url`; remove trackDownload L208; L224 `UnsplashError`→`PixabayError`. galleryFallbackUrl/carton STAY. `UNSPLASH_FALLBACK_ONLY` env → rename `PIXABAY_FALLBACK_ONLY` (update .env examples + comment L166/270/337).
5. **seed-blog-posts.ts** — searchPhotos L41 (pass `width:1200`); L44 buildImgixUrl→`photo.url`; remove trackDownload L45; L51 `UnsplashError`→`PixabayError`. getBlogThumbnails STAYS.
6. **upload-media.ts** — L8 import `downloadPhotoBuffer` from `pixabay-client`.

## Delete
- `src/lib/ai/unsplash-client.ts` (after grep confirms zero remaining imports).

## Success
- [ ] `npx tsc --noEmit` passes.
- [ ] `grep -rn "unsplash-client\|UnsplashError\|buildImgixUrl\|trackDownload" src/lib src/app` → zero (tests handled in 03).
- [ ] Static `images.unsplash.com` fallback URLs still present (Option A).
