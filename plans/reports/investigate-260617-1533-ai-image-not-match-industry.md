# Investigation Report — GH-1185: AI gen images không khớp ngành hàng

**Branch:** `investigate/1185-ai-image-not-match-industry`  
**Date:** 2026-06-17  
**Issue:** [#1185](https://github.com/primeproduction/ech-prime-web-v2/issues/1185)

---

## Symptom

Banner hero của "PrimeStack Solutions" (SaaS / CRM / AI Chatbot) hiển thị ảnh **hành lang văn phòng + tủ bếp/tủ lạnh** — hoàn toàn không liên quan ngành. Blog article thumbnails cũng random, không match topic/ngành.

---

## Root Cause

### RC-1 (PRIMARY, confirmed) — Hardcoded hero fallback không phân biệt ngành

**File:** `src/lib/ai/media-pipeline.ts:278`

```ts
const HARDCODED = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop&q=80'
```

Đây là URL **duy nhất, cố định** được dùng làm fallback hero cho **mọi ngành hàng** khi Unsplash search thất bại hoàn toàn. Photo này là hành lang văn phòng trống + khu bếp — đúng với mô tả trong issue.

Fallback chain kích hoạt khi (bất kỳ điều kiện nào):
1. Image pool trả về 0 kết quả cho block `hero`
2. Legacy Unsplash search với keywords → 0 kết quả
3. Broadened search (keyword đầu tiên) → 0 kết quả
4. Unsplash ném exception (network, rate limit, missing key)

**Kết luận:** Mọi business bị hit fallback đều nhận CÙNG ảnh văn phòng, bất kể ngành (SaaS, F&B, Beauty, hay bất cứ thứ gì).

---

### RC-2 (CONTRIBUTING) — LLM Translation timeout 3 giây quá chặt

**File:** `src/lib/ai/dynamic-translator.ts:33`

```ts
const timeoutId = setTimeout(() => controller.abort(), 3000)
```

`translateToEnglishKeywords()` chỉ có **3 giây** để gọi GPT-4o-mini. Trong khi đó, `generate-site` route đang chạy song song: OpenAI content gen + sampleProducts gen + nhiều thứ khác. Dưới tải cao, 3s là đủ để timeout.

Khi timeout:
- `englishKeywords` = `[translateProductTerm(topProduct)]` hoặc `[]`
- `buildImagePool` dùng fallback từ `parsedProducts.map(translateProductTerm)` → với "SaaS bán hàng đa kênh" không có entry trong product-translator → empty hoặc generic
- Pool query degraded xuống chỉ còn category ("tech") → vẫn có thể tìm được ảnh nhưng quality kém

Đây không trực tiếp gây ra ảnh văn phòng, nhưng là nguyên nhân pool/search trả về kết quả nghèo → tăng khả năng hit fallback.

---

### RC-3 (SECONDARY) — Blog thumbnails: Tier B fallback dùng ảnh curated cố định

**File:** `src/lib/ai/seed-blog-posts.ts:40-64`  
**File:** `src/lib/images/blog-thumbnail-images.ts`

Blog thumbnail pipeline:
- **Tier A:** `searchPhotos(seed.imageKeyword, 1)` — keyword do GPT gen (industry-aware, 30s timeout)
- **Tier B:** `blogThumbnails[i % 3]` — 3 URLs cố định per-category (tech: space/circuit board/dashboard)
- **Tier C:** carton placeholder

Khi Unsplash rate-limited (cùng key với hero pipeline), Tier A fail → Tier B kích hoạt. Tier B tech = `['photo-1451187580459-43490279c0fa (tech/space)', 'photo-1518770660439 (circuit board)', 'photo-1460925895917 (data dashboard)']`.

Những ảnh này **đúng ngành tech** nhưng **không liên quan đến topic bài viết** ("CRM best practices", "AI Chatbot ROI"...) → trông như "random".

---

## Pipeline đầy đủ (để hiểu context)

```
generate-site route
│
├─ translateToEnglishKeywords() [3s timeout]
│   └─ if timeout → translateProductTerm(topProduct) [dict fallback]
│
├─ buildImagePool(category: "tech", products: englishKeywords or parsedProducts)
│   └─ searchPhotos(query, 12) [landscape] + searchPhotos(query, 6) [square]
│
└─ fulfillImageNeeds(needs, ctx, payload)
    └─ hero block:
        ├─ pool.landscape.length > 0 → batchFetchFromPool() [OK]
        └─ pool empty → getMediaForBlock()
            ├─ Unsplash search (keywords) → 0 results
            ├─ Broadened search (first keyword) → 0 results
            └─ heroFallbackChain() → HARDCODED office hallway ← ĐÂY LÀ BUG

(post-response)
└─ seedBlogPosts()
    └─ fetchBlogThumbnail()
        ├─ Tier A: searchPhotos(imageKeyword) [rate limited]
        └─ Tier B: blogThumbnails[i % 3] ← generic per-category
```

---

## Đề xuất fix

### Fix 1 (HIGH PRIORITY) — Replace hardcoded fallback bằng per-category fallbacks

**File:** `src/lib/ai/media-pipeline.ts`

Thay `heroFallbackChain()` dùng 1 URL cố định → dùng map category → danh sách URL (tương tự `BLOG_THUMBNAILS_BY_CATEGORY`):

```ts
const HERO_FALLBACKS_BY_CATEGORY: Record<string, string[]> = {
    tech: ['photo-1518770660439-4636190af475', ...], // circuit board, dashboard
    restaurant: ['photo-1414235077428-338989a2e8c0', ...],
    beauty: ['photo-1522335789203-aabd1fc54bc9', ...],
    // ...
    business: ['photo-1553877522-43269d4ea984', ...], // generic fallback
}
```

`heroFallbackChain(ctx, payload)` nhận thêm `category?: string` → pick từ đúng bucket.

### Fix 2 (MEDIUM) — Tăng LLM translation timeout

**File:** `src/lib/ai/dynamic-translator.ts:33`

Tăng từ `3000ms` → `8000ms`. Gen site đã có `maxDuration = 300s`, 8s là acceptable.

### Fix 3 (LOW) — Blog: Pass `imageKeyword` context từ industry

Khi Tier B fallback kích hoạt, có thể chọn URL dựa trên `seed.imageKeyword` thay vì `i % 3` round-robin.

---

## Scope fix

- Chủ yếu `src/lib/ai/media-pipeline.ts` (heroFallbackChain) + `dynamic-translator.ts` timeout
- Không cần migration DB
- Không ảnh hưởng API contract
- Cần thêm test: verify hero nhận đúng category fallback khi Unsplash fail

---

## Unresolved questions

1. **Unsplash key có bị rate-limit thật ở production ngày 2026-06-11 không?** — Cần kiểm tra Vercel logs tại thời điểm đó để xác nhận mức độ fail của Unsplash call.
2. **UNSPLASH_BLOCKS env var trên production có set là `all` hay chỉ `hero` (default)?** — Nếu `hero` only, blog `blog-posts` block không fetch từ Unsplash, chỉ dùng seed blog thumbnail pipeline riêng.
3. **`translateProductTerm("SaaS bán hàng đa kênh")` trả về gì?** — Chưa trace `product-translator.ts` để verify fall behavior.
