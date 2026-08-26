# Researcher 01 — Unsplash API Integration

> Source: Unsplash docs (https://unsplash.com/documentation), Unsplash License (https://unsplash.com/license), `unsplash-js` GitHub. Knowledge cutoff May 2025; Unsplash API has been stable since 2019.

## 1. Endpoints

Base URL: `https://api.unsplash.com`

### Search photos
```
GET /search/photos?query=coffee+shop&per_page=10&page=1&orientation=landscape&content_filter=high
```
Response shape (truncated):
```json
{
  "total": 1234,
  "total_pages": 124,
  "results": [
    {
      "id": "abc123",
      "width": 4000, "height": 3000,
      "color": "#26261c",
      "blur_hash": "LFC$yHwc8^$y...",
      "description": "A latte on a wooden table",
      "alt_description": "white ceramic mug on table",
      "urls": {
        "raw":     "https://images.unsplash.com/photo-...",
        "full":    "https://images.unsplash.com/photo-...&q=85&fm=jpg",
        "regular": "https://images.unsplash.com/photo-...&w=1080",
        "small":   "https://images.unsplash.com/photo-...&w=400",
        "thumb":   "https://images.unsplash.com/photo-...&w=200"
      },
      "links": {
        "self":     "https://api.unsplash.com/photos/abc123",
        "html":     "https://unsplash.com/photos/abc123",
        "download": "https://api.unsplash.com/photos/abc123/download",
        "download_location": "https://api.unsplash.com/photos/abc123/download?ixid=..."
      },
      "user": { "name": "Jane Doe", "username": "janedoe", "links": { "html": "..." } }
    }
  ]
}
```

### Download tracking (REQUIRED by Unsplash guidelines)
```
GET {photo.links.download_location}
Authorization: Client-ID {ACCESS_KEY}
```
- MUST be triggered when an app actually uses/downloads a photo (not on every search hit).
- Returns `{ "url": "https://images.unsplash.com/..." }` — you can use that URL OR your own `urls.full`. The call itself is the trigger.
- Failing to call this violates API terms and risks key revocation.

### Random photo
```
GET /photos/random?query=cafe&orientation=landscape&count=5&content_filter=high
```
Returns a single object (or array if `count` set). Useful for "give me one hero" without pagination.

## 2. Auth + rate limits

- Header: `Authorization: Client-ID {UNSPLASH_ACCESS_KEY}` (NOT Bearer).
- **No key**: 50 req/hour shared IP — unusable.
- **Demo tier (default after register)**: **50 req/hour** per app. Fine for dev.
- **Production tier**: **5000 req/hour** — must apply via dashboard, demo a working app to Unsplash team, then they flip a switch (1–3 days). Free.
- Rate-limit headers in every response: `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`.
- Register: https://unsplash.com/oauth/applications → "New Application" → accept API guidelines → get Access Key + Secret Key. Only Access Key needed for read endpoints.

## 3. Image URL sizes (and Imgix params)

| Field | Default size | Use case |
|---|---|---|
| `urls.raw` | original (no params) | **Best for us** — append Imgix params yourself |
| `urls.full` | original w/ `q=85` JPG | Hero full-bleed |
| `urls.regular` | `w=1080` | Hero, gallery card |
| `urls.small` | `w=400` | Avatar, thumbnail |
| `urls.thumb` | `w=200` | List item icon |

`raw` accepts Imgix params:
```
{urls.raw}&w=1600&h=900&fit=crop&crop=entropy&q=80&fm=jpg&auto=format
```
- `fit=crop` + `crop=entropy` = smart crop on busiest area (great for hero).
- `auto=format` returns WebP/AVIF where supported.
- `q=80` good balance for stock photos.
- Hero: `w=1600&h=900&fit=crop&q=80`. Gallery: `w=800&h=600&fit=crop&q=80`. Avatar: `w=200&h=200&fit=crop&crop=faces&q=80`.

## 4. License compliance (Unsplash License)

- ✅ Commercial use: **yes**, free, worldwide.
- ✅ Modify, edit, composite: yes.
- ❌ Attribution: **not required**, but Unsplash strongly recommends crediting `photographer + "on Unsplash"` with backlinks. For our use (auto site gen), recommended to inject credit somewhere (footer or alt text) for goodwill — many teams skip and aren't pursued.
- ❌ Cannot **redistribute photos as-is on a competing service** (e.g. cannot re-host them as another stock-photo bank). Wrapping in a generated website is fine.
- ❌ Cannot use to train ML/AI models (added 2023 ToS).
- ✅ Hot-linking from `images.unsplash.com` allowed, but for our pipeline we WILL download → store in Payload Media → serve from our S3 (better perf, doesn't depend on Unsplash CDN being up).
- ⚠️ **API guideline**: must hit `download_location` when image is actually used + must show "Unsplash" + photographer somewhere if you display the photo (technically required by API ToS even though Unsplash License says optional). Practically: most prod apps add a small caption or alt attribution.

## 5. Search keyword strategy

- `query` is plain text, space-separated. Quotes do NOT work.
- Multi-word queries like `coffee shop interior` are AND-ed loosely (Unsplash does fuzzy match).
- `orientation`: `landscape` | `portrait` | `squarish` — for hero use `landscape`, avatar `squarish`.
- `color`: `black_and_white` | `black` | `white` | `yellow` | `orange` | `red` | `purple` | `magenta` | `green` | `teal` | `blue` — useful for brand alignment but narrows results aggressively.
- `content_filter`: `low` (default) | `high` — set to `high` for SFW user-facing gen.
- `order_by`: `relevant` (default) | `latest` — use `relevant`.
- **Gotchas**:
  - Generic queries (`business`, `food`) return clichéd stock — prefer specific (`vietnamese pho noodles`, `dental clinic reception`).
  - Non-English queries work poorly. Translate to EN before query.
  - Always call with `per_page=15–20` and pick top-N randomly to avoid every site looking the same.
  - Empty results: fall back to broader category (e.g. `pho` → `vietnamese food` → `food`).

## 6. Node.js download pattern (Node 18+, native `fetch`)

```ts
// src/lib/unsplash/download.ts
import type { Payload } from 'payload'

export async function downloadImageToBuffer(url: string): Promise<{
  buffer: Buffer
  mimetype: string
  size: number
}> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000), // Node 18.17+
    headers: { 'User-Agent': 'ech-prime-web-v2/1.0' },
  })
  if (!res.ok) throw new Error(`Download failed ${res.status}`)
  const mimetype = res.headers.get('content-type') ?? 'image/jpeg'
  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  if (buffer.length > 10 * 1024 * 1024) throw new Error('Image > 10MB')
  return { buffer, mimetype, size: buffer.length }
}

export async function uploadToPayloadMedia(
  payload: Payload,
  buffer: Buffer,
  filename: string,
  mimetype: string,
  alt: string,
) {
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    file: { data: buffer, mimetype, name: filename, size: buffer.length },
  })
  return doc.id
}
```
- Native `fetch` is fine — no need for `undici` directly (Node 18 ships undici under the hood).
- Use `arrayBuffer()` not streams — Payload's `create` wants a full buffer anyway.
- Set `AbortSignal.timeout` to avoid hanging on slow Unsplash CDN.
- Cap at 10 MB to avoid huge originals; Imgix `?q=80&w=1600` keeps files ~150–400 KB.

## 7. TypeScript SDK: `unsplash-js`

- Repo: https://github.com/unsplash/unsplash-js — official, MIT.
- Latest stable: `7.0.19` (Q1 2024). Maintenance is slow but functional; no breaking issues.
- ESM + CJS, tree-shakeable, bundles `node-fetch` polyfill (annoying — drops ~30 KB).
- Verdict: **use raw fetch.** The API is tiny (3 endpoints), the SDK adds a dependency + a fetch polyfill we don't need on Node 18+, and the type safety is easy to write ourselves.

```ts
type UnsplashSearchResponse = {
  total: number
  total_pages: number
  results: Array<{
    id: string
    urls: { raw: string; full: string; regular: string; small: string; thumb: string }
    links: { download_location: string; html: string }
    alt_description: string | null
    user: { name: string; username: string; links: { html: string } }
    width: number; height: number; color: string; blur_hash: string
  }>
}
```

## 8. Error modes + retry

| Status | Meaning | Strategy |
|---|---|---|
| 200 | OK | — |
| 401 | Bad/missing Client-ID | Hard fail, alert |
| 403 | Demo tier exceeded / disabled key | Hard fail, fall through to Pexels |
| 404 | Photo deleted | Skip + pick next from results |
| 422 | Bad params | Hard fail (dev bug) |
| 429 | Rate limit | Retry after 60s with jitter, max 2 retries → fall through |
| 500/503 | Unsplash down | Retry once after 2s → fall through |
| Timeout | CDN slow | Retry once → skip |

Use `p-retry` or hand-rolled retry. Always log `X-Ratelimit-Remaining` so we can pre-warn before hitting cap.

## 9. Backup APIs

| API | Free rate limit | License | Quality | Notes |
|---|---|---|---|---|
| **Pexels** | 200/hr, 20k/mo | Pexels License (similar to Unsplash, free commercial, no attribution) | High, slightly more "stock-y" | `https://api.pexels.com/v1/search?query=X` header `Authorization: {KEY}` |
| **Pixabay** | 100/min (=6000/hr) | Pixabay License (free commercial, no attribution) | Mixed, more illustrations | `https://pixabay.com/api/?key=X&q=Y` — no auth header, key in query |

Recommended fallback chain: **Unsplash → Pexels → Pixabay → DALL-E (last resort)**. All three free APIs cover the $0/gen target. Wrap in a `getStockImage(query, opts)` provider interface so swapping is one-line.

## 10. Effort estimate (senior dev)

For 5 blocks (search → pick → download → upload → return Media ID):

- Register Unsplash app + add `UNSPLASH_ACCESS_KEY` to Vercel env: **15 min**
- `src/lib/unsplash/client.ts` (search + download_location call + types): **1 h**
- `src/lib/unsplash/download.ts` (fetch → buffer → Payload Media create): **1 h**
- `src/lib/stock-images/index.ts` provider interface + Pexels fallback: **1.5 h**
- Wire into existing AI gen pipeline (replace DALL-E call site, map block→query): **1.5 h**
- Keyword strategy per block type (hero / gallery / about / team / product): **1 h**
- Unit tests (mocked fetch) + 1 integration test on real API: **1.5 h**
- Apply for Production tier (form + 1-line app description): **15 min** + 1–3 day wait
- Dev/QA on staging, attribution UI, error handling polish: **1.5 h**

**Total: ~9–10 hours of focused work.** First working PR within a day; production tier approval is the only async dependency.

## Unresolved questions

- Does Payload Media collection auto-generate the alt-text from `data.alt`, or do we need to pass it through? (Need to check `src/collections/Media.ts`.)
- Where to surface photographer attribution in generated sites — footer block, image caption, or alt text only? PM call.
- Should we cache `photo.id` → Media ID mapping to avoid re-downloading the same Unsplash photo across regenerations? (Recommend: yes, add an `unsplashId` index field on Media.)
- Production tier application: who owns the Unsplash dev account (anh hay team)?
