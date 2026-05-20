# Phase 01 — Unsplash client (HTTP wrapper + download-tracking)

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none — standalone HTTP module, no Payload, no AI
- Blocks: phase-02 (media pipeline imports this), phase-04 (route integration)
- Research: [researcher-01 §1, §2, §6, §8](./research/researcher-01-unsplash-api.md)

## Overview
- Date: 2026-04-14
- Description: Pure HTTP wrapper around Unsplash Search API. Exposes `searchPhotos(query, count, opts)`, `trackDownload(downloadLocation)`, `downloadPhotoBuffer(url)`. No Payload, no AI — just fetch + types + retry. Testable with mocked `fetch`.
- Priority: P1 — foundation for every image in every gen
- Implementation: pending
- Review: pending

## Key insights
- **Authorization header format:** `Authorization: Client-ID {ACCESS_KEY}` — NOT Bearer (common mistake).
- **Download tracking is MANDATORY** by Unsplash API ToS: every photo actually used must trigger one `GET {links.download_location}` call, or risk key revocation. Fire-and-forget, don't await in critical path.
- **Rate-limit headers:** read `X-Ratelimit-Remaining` from every response, log when <100, alert when <20. Demo tier 50/hr, Production tier 5000/hr.
- **Use `urls.raw` + Imgix params** instead of fixed `urls.regular`: `{raw}&w=1600&h=900&fit=crop&q=80&auto=format` — one URL template for hero/gallery/avatar.
- **Skip `unsplash-js` SDK** — it ships a node-fetch polyfill we don't need on Node 18+, and bundles ~30 KB. Raw fetch is simpler.
- **429 retry strategy:** retry once after 2s jitter, then fall through to fallback provider. Never block the request chain on Unsplash.

## Requirements
- **Input:**
  - `searchPhotos(query: string, count: number, opts?: { orientation, color, contentFilter })`
  - `trackDownload(downloadLocation: string)` — fire-and-forget
  - `downloadPhotoBuffer(url: string, maxBytes?: number)` — returns `{ buffer, mimetype, size }`
- **Output:** typed `UnsplashPhoto[]` for search, `Buffer` for download
- **Env:** reads `UNSPLASH_ACCESS_KEY` at call-time (not module load, for testability)
- **Errors:** throws `UnsplashError` with `{ code, status, retryable }` discriminants

## Architecture

```
src/lib/ai/unsplash-client.ts
├── types:            UnsplashPhoto, UnsplashSearchResponse, UnsplashError
├── searchPhotos()    → GET /search/photos → [] of UnsplashPhoto
├── trackDownload()   → GET {download_location} (fire-and-forget, swallow errors)
├── downloadPhotoBuffer() → fetch(url) → arrayBuffer → Buffer, cap at 10 MB
├── buildImgixUrl()   → append ?w=&h=&fit=crop&q=80&auto=format to urls.raw
└── retry wrapper     → 429/5xx → retry once 2s jitter → throw
```

Pseudo-code:
```ts
const BASE = 'https://api.unsplash.com'
const CLIENT_ID_HEADER = () => {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new UnsplashError('NO_KEY', 0, false)
  return { Authorization: `Client-ID ${key}` }
}

export async function searchPhotos(query, count, opts = {}) {
  const url = `${BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(count, 30)}&orientation=${opts.orientation ?? 'landscape'}&content_filter=high`
  const res = await fetchWithRetry(url, { headers: CLIENT_ID_HEADER() })
  logRateLimit(res.headers)
  const json = await res.json()
  return json.results as UnsplashPhoto[]
}

export function trackDownload(downloadLocation) {
  // fire-and-forget — no await, no throw
  fetch(downloadLocation, { headers: CLIENT_ID_HEADER() }).catch(() => {})
}

export async function downloadPhotoBuffer(url, maxBytes = 10_000_000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'ech-prime-web-v2/1.0' } })
  if (!res.ok) throw new UnsplashError('DOWNLOAD_FAIL', res.status, res.status >= 500)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) throw new UnsplashError('TOO_LARGE', 413, false)
  return { buffer: buf, mimetype: res.headers.get('content-type') ?? 'image/jpeg', size: buf.length }
}
```

## Related code files
- `src/lib/ai/unsplash-client.ts` (NEW, this phase)
- `src/lib/ai/openai-image.ts` (reference — existing Unsplash fallback pattern, lines 64–86)
- `src/__tests__/unit/lib/ai/openai-image.test.ts` (reference — mocked fetch pattern)

## Implementation steps
1. Create `src/lib/ai/unsplash-client.ts` with types + 3 exported functions + `UnsplashError` class + internal retry helper.
2. Add Imgix URL builder: `buildImgixUrl(raw, { w, h, fit, quality, crop })` → string.
3. Implement `searchPhotos` — URL build, fetch, rate-limit log, JSON parse, return results.
4. Implement `trackDownload` — fire-and-forget, catch+swallow, document "do not await".
5. Implement `downloadPhotoBuffer` — AbortSignal 15s, cap 10 MB, return buffer/mime/size.
6. Implement retry wrapper — `fetchWithRetry(url, init)` retries once on 429/500/503 with 2s + random 0–500ms jitter, then throws.
7. Export const `UNSPLASH_DEFAULT_ORIENTATION_FOR_BLOCK` map: hero=landscape, avatar=squarish, gallery=landscape, portfolio=portrait.
8. Add JSDoc with examples for every exported fn.
9. Write `src/__tests__/unit/lib/ai/unsplash-client.test.ts` — mock global `fetch`, cover: success, 401, 429 retry success, 429 retry fail, 500 retry, timeout, oversize buffer, missing env key, rate-limit log triggered, `trackDownload` never throws.

## Todo
- [ ] File `unsplash-client.ts` compiles with `tsc --noEmit`
- [ ] `UnsplashError` class with discriminated fields
- [ ] `searchPhotos` returns typed array, paginated first page only
- [ ] `trackDownload` is verifiably fire-and-forget (test: throws internally but caller unaffected)
- [ ] `downloadPhotoBuffer` enforces 10 MB cap
- [ ] `buildImgixUrl` produces expected params for hero/gallery/avatar presets
- [ ] Retry helper backs off 2s + jitter, max 1 retry
- [ ] Rate-limit remaining logged when <100
- [ ] Unit tests cover 10+ cases, all green
- [ ] No Payload, no OpenAI, no Zod imports — pure HTTP module

## Success criteria
- [ ] `pnpm test src/__tests__/unit/lib/ai/unsplash-client.test.ts` 100% green
- [ ] Manual smoke: `tsx -e 'import("./src/lib/ai/unsplash-client").then(m => m.searchPhotos("coffee shop", 5).then(console.log))'` returns 5 real photos
- [ ] TypeScript strict mode clean, no `any`
- [ ] Module size <200 LOC (guardrail against scope creep)

## Risk assessment
- **R1 — Unsplash demo-tier 50/hr burn-out during dev:** mitigation = register personal key first for dev, apply for prod tier in parallel (phase-07).
- **R2 — AbortSignal.timeout missing on older Node:** requires Node 18.17+. Check `.nvmrc`/CI. Fallback = `AbortController` + `setTimeout`.
- **R3 — Unsplash responses for non-English queries are weak:** out of scope here (keyword module handles). This phase assumes English input.
- **R4 — `trackDownload` silently failing hides compliance breach:** mitigation = log warn on fetch rejection (not throw). Add counter metric.

## Security considerations
- **Never** log full `Authorization` header — redact in logs.
- **Never** expose `UNSPLASH_ACCESS_KEY` to client bundle — module is server-only; add `import 'server-only'` at top.
- **SSRF:** `downloadPhotoBuffer` accepts arbitrary URL — MUST validate hostname matches `images.unsplash.com` OR trusted CDN allowlist before fetching. Add check.
- **Resource exhaustion:** 10 MB cap + 15s timeout prevent slowloris/bomb.
- Document in JSDoc: "server-only, do not import from client components".

## Next steps
→ phase-02 (media pipeline) imports this client and chains `searchPhotos → trackDownload → downloadPhotoBuffer → payload.create`.
