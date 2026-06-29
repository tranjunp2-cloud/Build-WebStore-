# Phase 02 — Provider router + automatic fallback

**Priority:** P1 · **Status:** pending · Depends 01. Blocks 03.

## Overview
Thin router exposing the SAME `ImageProviderClient` surface (`searchPhotos`,
`downloadPhotoBuffer`, `trackDownload`). Picks primary provider, falls back to the
other on rate-limit OR empty results. This is the ONLY module call sites import.

## Files to create
- `src/lib/ai/image-provider.ts`

## Files to read for context
- `src/lib/ai/image-provider-types.ts` (Phase 01 shapes)
- `src/lib/ai/unsplash-client.ts` (needs a thin normalizing wrapper — see below)
- `src/lib/ai/pixabay-client.ts`

## Unsplash must also speak the normalized shape
Unsplash client currently returns raw `UnsplashPhoto`. Two clean options — pick (a):

**(a) Add a normalizing adapter inside `image-provider.ts`** (KISS — don't touch unsplash-client public API, lowest blast radius):
```ts
function unsplashToProvider(p: UnsplashPhoto, opts: ProviderSearchOptions): ProviderPhoto {
  const url = buildImgixUrl(p.urls.raw, { w: opts.width, h: opts.height, fit: opts.fit ?? 'crop' })
  return {
    id: p.id, provider: 'unsplash', url,
    alt: p.alt_description ?? p.description,
    photographer: p.user?.name ?? p.user?.username ?? 'Unknown',
    width: p.width, height: p.height,
    downloadLocation: p.links.download_location,
  }
}
```
The Unsplash branch in the router calls existing `searchPhotos`/`buildImgixUrl` from `unsplash-client` then maps. Pixabay client already returns `ProviderPhoto` directly.

> Adapter keeps Imgix sizing where it belongs (only Unsplash supports it) — `opts.width/height` is how the size preset reaches the client now that callers no longer call `buildImgixUrl` themselves.

## Router logic
```ts
const ORDER: ProviderName[] = primaryFromEnv() === 'unsplash'
  ? ['unsplash', 'pixabay'] : ['pixabay', 'unsplash']

export async function searchPhotos(query, count, opts = {}): Promise<ProviderPhoto[]> {
  for (const name of ORDER) {
    const client = clientFor(name)
    if (!client.hasKey()) continue              // skip unconfigured provider
    try {
      const photos = await client.searchPhotos(query, count, opts)
      if (photos.length > 0) return photos       // success
      // empty → fall through to next provider
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : 'SERVER_ERROR'
      if (code === 'RATE_LIMITED' || code === 'SERVER_ERROR' || code === 'TIMEOUT') {
        console.warn(`[image-provider] ${name} ${code} → falling back`)
        continue                                 // try next provider
      }
      throw err                                  // UNAUTHORIZED/SSRF → don't mask
    }
  }
  return []                                      // both exhausted → empty (callers handle)
}
```
- `downloadPhotoBuffer(url, max?)`: route by URL host (pixabay host → pixabay client, else unsplash). Each client's SSRF guard rejects foreign hosts. Simplest: try host match; default unsplash.
- `trackDownload(loc)`: if `loc` is non-empty assume Unsplash (Pixabay always passes `''`), delegate to unsplash client. One-liner.
- `primaryFromEnv()`: read `IMAGE_PROVIDER_PRIMARY` (`'pixabay'|'unsplash'`), default `'pixabay'`. Invalid value → default + warn-once.

## Data flow
```
caller → router.searchPhotos(q,n,{orientation,width,height})
        → [primary].searchPhotos → ProviderPhoto[] (sized url baked in)
           ├ ok+nonempty → return
           ├ empty       → [secondary].searchPhotos
           └ 429/5xx/timeout → [secondary].searchPhotos
caller → router.downloadPhotoBuffer(photo.url) → routed by host → Buffer
caller → router.trackDownload(photo.downloadLocation) → unsplash ping or no-op
```

## Success criteria
- [ ] Router exports `searchPhotos / downloadPhotoBuffer / trackDownload` with `ProviderPhoto`/`DownloadResult` signatures (drop-in for call sites).
- [ ] Primary respects `IMAGE_PROVIDER_PRIMARY`; defaults pixabay.
- [ ] Fallback triggers on RATE_LIMITED + empty results.
- [ ] Unconfigured provider skipped (no key) without throwing.
- [ ] UNAUTHORIZED and SSRF errors from a configured provider are not masked.
- [ ] `tsc --noEmit` passes. File < 200 lines.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Infinite fallback if both error | Low×Med | Loop is finite (2 providers); returns [] after both |
| Double API spend (both called every gen) | Med×Med | Only fall back on failure/empty, not always; primary success short-circuits |
| download host routing picks wrong client | Low×Med | Host-based switch + each client's SSRF guard is the backstop |

## Test note
TC-IDs: primary=pixabay default order; fallback on 429; fallback on empty; no-key provider skipped; UNAUTHORIZED not masked; env override flips order.
