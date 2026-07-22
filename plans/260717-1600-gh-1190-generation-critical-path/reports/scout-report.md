# Scout Report - GH-1190 Generation Flow

## Current Flow

1. Builder client POSTs `/api/ai/generate-site?stream=true`, warns at 60s, aborts at 300s.
2. Route performs body parsing, auth, rate limit, optional translation, tenant/subscription, and template lookup before returning the SSE response.
3. Image pool, pre-upload, sample products, and page AI begin with partial overlap.
4. AI-first generation runs home, About+Services, and Contact+Blog calls in parallel. Failed subpage batches retry once on the main model, then use composer fallback.
5. Page media is fulfilled, site/pages are written, products are awaited and written, blog waits up to 15s, site completes, slug sync runs, then SSE `done` is sent.
6. On disconnect, backend continues, but client may retry the entire POST up to three times.

## Bottleneck Ranking

| Rank | Bottleneck | Evidence | Impact |
|---|---|---|---|
| P0 | Sample products and six sequential images | `sampleProductsPromise` starts after pool and is awaited before completion; three manual AI retries plus SDK retries | Hidden/unbounded tail |
| P0 | Site AI split long pole | Three large calls; SDK default timeout/retry; one batch may add full main-model retry | JP/VN p95 over 60s |
| P1 | Blog gate and fixed grace | Thumbnail phase waits products; route can wait another 15s | Tail amplification |
| P1 | Serial DB loops | Old-page delete, five-page create, six-product create, three-blog create | Measurable but lower risk after network work |
| P1 | Pre-stream work | Translation can take 8s; capture writes before generator events | Threatens first-event <= 5s |
| P1 | SSE reconnect semantics | Client retries full POST while backend continues | Duplicate cost/data risk |

## Timing Blind Spots

- `ai` includes capture writes/post-processing, not only model calls.
- `media` excludes image pool construction, pre-upload wait, and verification.
- `db` excludes site CRUD before page loop and products/blog/site completion after it.
- Products, blog, capture, and slug sync collapse into `other`.
- `timeMs` is computed before slug sync even though the client waits for it.

## Safe Optimization Boundaries

- Reuse `trackPhase`, composer fallbacks, `after()`, media-create lock, and existing TC-GENPERF tests.
- Keep page/block media required before `done`.
- Isolate product/blog optional thumbnails from page image ownership.
- Do not parallelize Payload media creates.
- Do not replace the image provider or introduce a durable queue in GH-1190.

## Source Anchors

- `src/app/(builder)/builder/new/AIBuilderPageClient.tsx:548` - SSE start; warning/abort/retry.
- `src/app/api/ai/generate-site/route.ts:467` - image pool.
- `src/app/api/ai/generate-site/route.ts:596` - sample products.
- `src/app/api/ai/generate-site/route.ts:621` - blog preparation.
- `src/app/api/ai/generate-site/route.ts:1035` - sequential page persistence region.
- `src/app/api/ai/generate-site/route.ts:1335` - awaited sample products.
- `src/app/api/ai/generate-site/route.ts:1503` - blog grace.
- `src/app/api/ai/generate-site/route.ts:1578` - duration computed before slug sync.
- `src/lib/ai/gen-page-split.ts:294` - parallel split.
- `src/lib/ai/gen-page-split.ts:360` - batch retry.
- `src/lib/ai/generate-sample-products.ts:319` - manual AI retries.
- `src/lib/ai/generate-sample-products.ts:382` - sequential image loop.
- `src/lib/ai/seed-blog-posts.ts:181` - sequential thumbnail loop.
- `src/lib/ai/seed-blog-posts.ts:217` - sequential blog persistence.

## Existing Evidence

- Local Wave 2 improved EN 97.3s -> 50.0s, JP 117.5s -> 64.6s, VN 121.9s -> 63.2s.
- Latest issue QA marks mechanics/completeness checks mostly passing but AC2/AC3/AC4 unresolved or failed because staging p50/p95 was not measured and JP/VN local results exceed 60s.
- Earlier async optimization produced incomplete preview; a later product/image optimization was reverted after image fallback regression. Completion and ownership need explicit tests.
