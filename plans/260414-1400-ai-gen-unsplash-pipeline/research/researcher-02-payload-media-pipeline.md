# Research #02 — Payload Media + Current DALL-E Pipeline

> Created: 2026-04-14
> For: plan 260414-1400-ai-gen-unsplash-pipeline

## 1. Current DALL-E Flow

**File:** `src/app/api/ai/generate-site/route.ts` lines 232-367

- **Parallel kick-off (line 234):** `heroImagePromise = generateAndUploadHeroImage(businessInfo, tenantId, payload)` — runs BEFORE GPT-4 site gen to minimize latency.
- **DALL-E 3 call** (`src/lib/ai/openai-image.ts:22-28`): model=`dall-e-3`, size=`1792x1024`, quality=`standard`. Prompt = business context (industry + name + products).
- **Buffer → Media pipeline** (`openai-image.ts:43-55`):
```ts
payload.create({
    collection: 'media',
    data: { alt: "${businessName} hero banner", tenant: tenantId },
    file: {
        data: buffer,
        mimetype: imgRes.headers.get('content-type'),
        name: `hero-${Date.now()}.png`,
        size: buffer.length
    }
})
```
- **Media ID injection** (route.ts:355-367): finds hero block → sets `heroBlock.backgroundImage = heroMedia.id` → also updates SSE event preview with full media object.
- **Existing Unsplash fallback** (`openai-image.ts:64-86`): when DALL-E fails, downloads hardcoded Unsplash URL + uploads same way. **This is useful prior art to reuse!**

## 2. Payload Media Collection (`src/collections/Media.ts`)

- **Static dir:** `public/media`
- **Image sizes configured:** thumbnail 400×300, card 768×512, hero 1920×1080, square 600×600 — Payload auto-generates these sizes on upload
- **MIME types:** `image/*`, `video/*`, `application/pdf`
- **Required fields:** `alt` (text, required), `aiGenerated` (checkbox), `aiPrompt` (conditional), `caption` (optional)
- **API signature:**
```ts
payload.create({
    collection: 'media',
    data: { alt, caption?, aiGenerated?, aiPrompt?, tenant? },
    file: { data: Buffer, mimetype: string, name: string, size: number }
})
```
- **Access control:** `read: () => true` (public), `create/update/delete: authed only`
- ⚠️ **No tenant scoping on read** — user A can read Media created by user B. Out of scope for this plan, but flag for security review.

## 3. Block Image Fields (Pages.ts)

**Currently supported (upload → Media ID):**
- `hero.image`, `hero.backgroundImage`
- `about.image`
- `logo-cloud.logos[].logo`
- `team.members[].avatar`
- `testimonials.testimonials[].avatar` (likely — need verify)

**Currently DROPPED (need media pipeline to re-enable):**
- `gallery.images[].image` — array of uploads
- `before-after.beforeImage`, `afterImage` — dual upload
- `portfolio-grid.items[].image` — array (drop reason: same)

## 4. Zod vs Payload Schema Mismatch

- **Zod schemas** (AI-facing): `image: { url: string, alt: string }` — AI-friendly
- **Payload Pages**: `image: upload` → expects Media ID number
- **Current sanitizer strip** (`openai-generator.ts:828-833`):
```ts
const uploadFields = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']
for (const field of uploadFields) {
    if (s[field] && typeof s[field] === 'string') delete s[field]
}
```
- **Reconciliation approach:** intercept BEFORE sanitization → batch-upload via media-pipeline → replace URL strings with Media IDs → let sanitizer pass through.

## 5. Fallback Path Media Handling

- `fallback-adapter.ts` uses `composeFromBlueprint` which doesn't call DALL-E. Composer output has image fields as `{url, alt}` objects but no actual Media IDs.
- If fallback runs, current behavior = no hero image (falls through to placeholder).
- **Opportunity:** apply Unsplash pipeline to BOTH happy path AND fallback path uniformly.

## 6. Test Infrastructure Found

- `src/__tests__/unit/lib/ai/openai-image.test.ts` — DALL-E + Media upload (mockable pattern exists)
- `src/__tests__/unit/lib/ai/openai-generator.test.ts` — sanitizer tests
- `src/__tests__/unit/lib/ai/fallback-adapter.test.ts` — fallback behavior
- `src/__tests__/unit/lib/ai/unsupported-blocks.test.ts` — drop list

Mock pattern for Payload + HTTP already established — can reuse for unsplash-client tests.

## 7. Critical Insights for New Pipeline

1. **Don't reinvent** — `generateAndUploadHeroImage()` in openai-image.ts already handles DALL-E → Buffer → Media upload. Mirror the pattern for Unsplash.
2. **Existing Unsplash fallback URL** — currently hardcoded 1 URL in openai-image.ts:64-86 as DALL-E-fail safety net. Generalize this into proper Unsplash client.
3. **Batch upload parallelism** — don't bottleneck. Spawn N Media.create calls in parallel via `Promise.all` for gallery (5-6 imgs).
4. **Payload auto-generates thumbnails** — don't pre-resize Unsplash URL, let Payload `imageSizes` handle it.
5. **Tenant scoping is loose** — don't over-engineer multi-tenant isolation in this plan. Flag as follow-up.

## Unresolved Questions

1. **Batch vs sequential upload** — for 5-6 gallery images, parallel Promise.all or sequential? Parallel faster but risks rate limit spikes on Unsplash side. Decision: parallel with 3-concurrent limit via `p-limit` or similar.
2. **Rollback on partial failure** — if hero uploads but gallery fails, continue with partial or fail entire gen? Decision: continue, log warning, frontend shows what was saved.
3. **Image relevance** — Unsplash search "spa" may return hotel bathroom, not massage. Need keyword strategy + maybe filter by `orientation` + `content_filter=high`.
4. **Pre-existing Unsplash URL in openai-image.ts** — delete or keep as LAST-RESORT fallback after both DALL-E + Unsplash search fail?
5. **fallback-adapter integration** — apply Unsplash pipeline in composer output too, or leave fallback path image-less? Decision: apply, so both paths have visual parity.
