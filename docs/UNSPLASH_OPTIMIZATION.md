# Unsplash API — Tối ưu & Rate Limit

## Tình trạng hiện tại

- App: "ECH Prime Web v2 — AI Site Ge..." — Demo mode, đang In Review cho Production
- Key: `u65JQqw-...` — vẫn valid (test 2026-04-16 → 200 OK)
- Rate limit: **50 req/hour** (Demo). Production: 5000 req/hour
- Mỗi gen F01 tốn ~8-22 API calls → chỉ ~3-6 gen/giờ trước khi 403

## Breakdown API calls per gen

### Counted by Unsplash rate limit (api.unsplash.com)

| Phase | Function | Calls | Ghi chú |
|---|---|---|---|
| Pool search landscape | `buildImagePool()` → `searchPhotos(query, 15, landscape)` | 1 | `image-pool.ts:173` |
| Pool search square | `buildImagePool()` → `searchPhotos(query, 8, squarish)` | 1 | `image-pool.ts:196` |
| Retry relaxed (nếu underfill) | `searchPhotos(relaxedQuery, ...)` | 0-2 | `image-pool.ts:183,205` |
| Track download per photo | `trackDownload(photo.links.download_location)` | 6-14 | `media-pipeline.ts:169` — ToS bắt buộc, KHÔNG thể bỏ |
| Fallback search (pool miss) | `getMediaForBlock()` → `searchPhotos(...)` | 0-6 | `media-pipeline.ts:318,325` |

### NOT counted (CDN, free)

| Phase | Function | Calls |
|---|---|---|
| Photo buffer download | `downloadPhotoBuffer(url)` | 6-14 |

Tải từ `images.unsplash.com` (CDN) → không đếm rate limit.

### Tổng

| Scenario | API calls | Gens/hr (Demo 50) |
|---|---|---|
| Best (pool hit, 6 ảnh) | 8 | ~6 |
| Typical (11 ảnh) | 13 | ~3-4 |
| Worst (underfill + fallback, 14 ảnh) | 22 | ~2 |

## Chiến lược tối ưu

### Phase 1: Hero-only (ĐANG IMPLEMENT — PR #649)

- Chỉ fetch Unsplash cho hero block (1 ảnh)
- Các block khác (gallery, team, testimonials, about) dùng template/placeholder
- **API calls: 1 search + 1 track = 2 calls/gen → ~25 gen/hr trên Demo**
- Trade-off: site gen xong sẽ thiếu ảnh non-hero, user tự add sau trong builder

### Phase 2: Cache image pool (chưa implement)

- Cache pool result per (category + mood) TTL 1 giờ
- Cùng category (restaurant) gen nhiều lần → reuse pool, không search lại
- Giảm 2-4 search calls/gen
- Storage: in-memory Map hoặc Vercel KV (nếu multi-instance)
- Key: `pool:${category}:${moodId}` → value: serialized UnsplashPhoto[]

### Phase 3: Pexels fallback (chưa implement)

- Thêm Pexels API (200 req/hr free, không cần review)
- Khi Unsplash 403 → auto-switch sang Pexels cho phần còn lại
- Pexels API tương tự: `GET /v1/search?query=restaurant&per_page=10`
- License: free for commercial use, attribution không bắt buộc (nhưng nên có)

### Phase 4: Production approval (chờ Unsplash)

- Khi app được approve → 5000/hr → không cần optimize nữa
- Review time: 1-4 tuần
- Tips tăng tốc review: upload demo screenshots, mô tả use case rõ, link staging

## Key files

| File | Vai trò |
|---|---|
| `src/lib/ai/unsplash-client.ts` | HTTP wrapper (search, track, download, SSRF guard) |
| `src/lib/ai/image-pool.ts` | Per-site pool builder (2 search calls) |
| `src/lib/ai/media-pipeline.ts` | Download + upload to Payload Media |
| `src/lib/ai/media-injector.ts` | Plan image needs + fulfill per blockType |
| `src/lib/ai/image-keywords.ts` | vi/ms → en keyword translation |

## Env vars

| Var | Value | Scopes |
|---|---|---|
| `UNSPLASH_ACCESS_KEY` | `u65JQqw-...` (Demo key, valid) | Preview, staging, Development |
| `ENABLE_DALLE_HERO` | `false` (default) | Không set — dùng Unsplash pipeline |

## Lưu ý bảo mật

- Key `u65JQqw-...` đã bị paste plaintext trong chat session 2026-04-15 → nằm trong telemetry. Chưa bị Unsplash revoke (confirmed 2026-04-16). Nên rotate sau khi Production approved để lấy key sạch.
- KHÔNG commit key vào code. Chỉ dùng qua env var.
