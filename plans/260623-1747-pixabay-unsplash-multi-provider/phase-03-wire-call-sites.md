# Phase 03 — Wire call sites + provider-aware alt text

**Priority:** P1 · **Status:** pending · Depends 02 · Blocks 04.
**Single agent, sequential** — these files share the normalized-shape migration; do NOT parallelize.

## Goal
Switch all 6 consumers from `unsplash-client` direct imports to `image-provider`
router. Adapt the 3 sites that touch Unsplash-only fields (`urls.raw`,
`links.download_location`, `buildImgixUrl`). Make alt text reflect actual provider.

## Consumers (full direct-import list)
| File | Current Unsplash coupling | Change |
|------|---------------------------|--------|
| `src/lib/ai/media-pipeline.ts` | `searchPhotos, trackDownload, downloadPhotoBuffer, buildImgixUrl, UnsplashError, UnsplashPhoto, ImgixParams, UNSPLASH_ORIENTATION_BY_BLOCK` | Biggest. See below. |
| `src/lib/ai/image-pool.ts` | `searchPhotos, UnsplashPhoto`; `normalize()` reads `urls.regular`, `links.download_location`, `user.name` | Map normalized shape in `normalize()`. |
| `src/lib/images/image-library-seeder.ts` | `searchPhotos, downloadPhotoBuffer, trackDownload, buildImgixUrl`; reads `photo.urls.raw`, `photo.links.download_location` | Drop buildImgixUrl; use `photo.url`. |
| `src/lib/ai/generate-sample-products.ts` | `searchPhotos, buildImgixUrl, trackDownload, UnsplashError`; `photo.urls.raw`, `photo.links.download_location`, `err.code==='RATE_LIMITED'` | Swap to router + `ProviderError`. |
| `src/lib/ai/seed-blog-posts.ts` | same pattern as sample-products | same. |
| `src/lib/ai/upload-media.ts` | only `downloadPhotoBuffer` | trivial import swap (but URL may now be pixabay host — router handles). |

`src/app/api/ai/generate-site/route.ts` orchestrates the pool-first flow but does not
import `unsplash-client` directly. If touched, update comments/log labels from
"Unsplash media pipeline" to provider-neutral wording only.

## Per-file changes

### media-pipeline.ts
- Import from `./image-provider`: `searchPhotos, trackDownload, downloadPhotoBuffer, ProviderError, type ProviderPhoto`.
- Replace `type UnsplashPhoto` → `ProviderPhoto` in `BatchFetchResult.photos`, `batchFetch()`, `fetchAndStorePhoto()`.
- `fetchAndStorePhoto`: today does `buildImgixUrl(photo.urls.raw, preset)` then download. NEW: `searchPhotos` must receive the size preset so the URL is pre-baked. **Pass `width/height/fit` into `searchPhotos` opts** (Phase 01 `ProviderSearchOptions`). Then `downloadPhotoBuffer(photo.url)` directly. `trackDownload(photo.downloadLocation)` (no-op for pixabay).
  - Move `SIZE_PRESET_BY_BLOCK` lookup to BEFORE search → pass into `searchPhotos(query, n, { orientation, width, height, fit })`.
- `UNSPLASH_ORIENTATION_BY_BLOCK`: keep the map but rename import or re-export from provider as `ORIENTATION_BY_BLOCK` (DRY — it's provider-neutral data). Simplest: leave it in unsplash-client and keep importing it; OR copy into image-provider-types. **Decision: re-export from `image-provider` as `ORIENTATION_BY_BLOCK`** to fully decouple call sites from unsplash-client.
- `buildAttributedAlt(photo)`: change hardcoded `on Unsplash` → provider-aware:
  `const src = photo.provider === 'pixabay' ? 'Pixabay' : 'Unsplash'` → `…— Photo by ${photographer} on ${src}`. Pixabay requires no attribution but crediting is harmless + truthful.
- `heroFallbackChain` alt L319 `Stock Photo from Unsplash`: this uses hardcoded Unsplash photo IDs (`images.unsplash.com/photo-…`) → it is intrinsically Unsplash. LEAVE as Unsplash (it bypasses search; the IDs are Unsplash-specific). Document: hero hardcoded-fallback stays Unsplash-only by design.
- `UnsplashError` import → `ProviderError`; `err instanceof UnsplashError ? err.code` → `err instanceof ProviderError ? err.code`.

### image-pool.ts
- Import `searchPhotos, type ProviderPhoto` from `./image-provider`.
- `normalize(photo: ProviderPhoto, role)`: now reads `photo.url` (already sized), `photo.alt`, `photo.photographer`, `photo.downloadLocation`, `photo.width/height`. Remove `urls.regular` / `user.name` references.
- `buildImagePool` search calls: pass orientation as today (no size needed — pool stores `url` for later download). For pixabay, `searchPhotos` should default `url` to `largeImageURL` when no width given.

### image-library-seeder.ts
- Import `searchPhotos, downloadPhotoBuffer, trackDownload, type ProviderPhoto` from `@/lib/ai/image-provider`.
- `searchPhotos(query, 10, { orientation, width: slot.imgixW, height: slot.imgixH, fit: 'crop' })` — pass size so `photo.url` is pre-baked.
- Replace `buildImgixUrl(photo.urls.raw, …)` (L210) → `photo.url`. Replace `photo.links.download_location` (L211, L234) → `photo.downloadLocation`.
- `photosByKey` type `Awaited<ReturnType<typeof searchPhotos>>` still works (now `ProviderPhoto[]`).

### generate-sample-products.ts & seed-blog-posts.ts
- Import `searchPhotos, trackDownload, ProviderError, type ProviderPhoto` from `./image-provider`.
- `searchPhotos(kw, 1, { orientation, width, height, fit:'crop' })` — pass size; **note Pixabay min per_page=3** → router/client requests ≥3 internally and slices to 1 (Phase 01 clamp). Caller still gets 1.
- `photo.urls.raw` + `buildImgixUrl` → `photo.url`. `photo.links.download_location` → `photo.downloadLocation`.
- `err instanceof UnsplashError && err.code === 'RATE_LIMITED'` → `err instanceof ProviderError && err.code === 'RATE_LIMITED'`.

### upload-media.ts
- `import { downloadPhotoBuffer } from './image-provider'`. No other change (router host-routes the URL).

## Success criteria
- [ ] `grep -rn "unsplash-client" src/lib src/app` → only `image-provider.ts` (adapter) remains. Tests may still ref it.
- [ ] No `buildImgixUrl` / `urls.raw` / `links.download_location` / `UnsplashError` outside `unsplash-client.ts` + `image-provider.ts`.
- [ ] `tsc --noEmit` + `npm run lint` pass.
- [ ] Alt text shows `on Pixabay` when pixabay served the photo.
- [ ] New provider files stay small; avoid expanding existing large files beyond the mechanical migration.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| media-pipeline size-preset reorder breaks fallback chain | Med×High | Keep `getMediaForBlock` control flow identical; only swap fetch internals. Existing tests guard it |
| Pixabay fixed sizes < requested box → upscaled/blurry hero | Med×Med | `largeImageURL` ~1280px ok for 1200px presets; hero 1920px will downscale-from-largest. Acceptable for MVP; note as known limitation |
| count=1 callers get 3 fetched, waste quota | Low×Low | Pixabay free 6000/hr — negligible |

## Rollback
Revert imports to `unsplash-client` per-file (each change is mechanical). No schema/data impact.

## Test note
Update existing `image-pool.test.ts`, `image-library-seeder.test.ts`, `sample-products-image-fallback.test.ts` mocks: they `vi.mock('./unsplash-client')` → must now `vi.mock('@/lib/ai/image-provider')` returning ProviderPhoto shape. Phase 04 owns this.
