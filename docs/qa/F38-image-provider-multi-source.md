# Tài liệu Kiểm thử: F38 — Image Provider (Pixabay)

> **Phiên bản:** 1.0 | **Cập nhật:** 2026-06-29 | **Thực hiện:** Dev (unit) + QA (staging)
> **Nguồn:** PRD F38 `docs/prd/F38-image-provider-multi-source.md`, plan `plans/260629-1450-F38-pixabay-replace-unsplash/`
> **Scope:** Option A — thay client tìm kiếm Unsplash bằng Pixabay. Giữ ~400 URL Unsplash tĩnh làm fallback hotlink.

---

## 1. Mục tiêu

Xác minh `src/lib/ai/pixabay-client.ts` thay thế đúng Unsplash search ở 6 call site, KHÔNG đổi DB schema, và SSRF allowlist vẫn cho phép host Unsplash tĩnh (fallback hero/blog/product).

## 2. Môi trường

| Thông số | Yêu cầu |
|---|---|
| Unit | Vitest, mock global `fetch` |
| Env | `PIXABAY_API_KEY` (Vercel staging + production), optional `PIXABAY_BLOCKS=all`, `PIXABAY_FALLBACK_ONLY` |
| Staging | Gen 1 site → kiểm hero/gallery/product/blog đều có ảnh từ Pixabay |

## 3. Ma trận Test Case — Pixabay client (unit)

| ID | Loại | Tiêu đề | Kết quả mong đợi | AUTO |
|:---|:---|:---|:---|:---:|
| **TC-F38-PIXABAY-01** | `[Positive]` | `searchPhotos` map `hits[]` → `PixabayPhoto` | `id=String(hit.id)`, `url`, `alt=hit.tags`, `photographer=hit.user`, `width/height` đúng | [x] |
| **TC-F38-PIXABAY-02** | `[Positive]` | Orientation mapping | landscape→horizontal, portrait→vertical, squarish→all (kiểm query param) | [x] |
| **TC-F38-PIXABAY-03** | `[Negative]` | Thiếu `PIXABAY_API_KEY` | trả `[]`, KHÔNG gọi fetch (graceful skip) | [x] |
| **TC-F38-PIXABAY-04** | `[BVA]` | `per_page` clamp + slice | count=1 vẫn request per_page≥3, kết quả slice về đúng count | [x] |
| **TC-F38-PIXABAY-05** | `[Positive]` | Size pick theo width | width≥700 (hoặc undefined)→`largeImageURL`; width<700→`webformatURL` | [x] |
| **TC-F38-PIXABAY-06** | `[Error]` | 429 → `PixabayError` | retry 1 lần rồi throw `PixabayError` code `RATE_LIMITED` | [x] |
| **TC-F38-PIXABAY-07** | `[Security]` | SSRF chặn host lạ | `https://evil.com/x.jpg` → `PixabayError` code `SSRF_BLOCKED` | [x] |
| **TC-F38-PIXABAY-08** | `[Security]` | SSRF cho phép Unsplash tĩnh | `https://images.unsplash.com/x.jpg` qua guard (fallback hotlink vẫn tải được) | [x] |
| **TC-F38-PIXABAY-09** | `[Quality]` | squarish prefer near-square | over-fetch (per_page=count×3), ảnh gần vuông (0.8≤ar≤1.25) lên đầu, fill phần thiếu từ ảnh còn lại | [x] |
| **TC-F38-PIXABAY-10** | `[Error]` | 401 → `UNAUTHORIZED` | non-retryable, fail ngay, 1 fetch | [x] |
| **TC-F38-PIXABAY-11** | `[Error]` | buffer > maxBytes → `TOO_LARGE` | download vượt cap → `PixabayError` code `TOO_LARGE` | [x] |

## 4. Regression — call site (đã có test, cập nhật mock sang Pixabay)

| File | Phủ |
|---|---|
| `image-pool.test.ts` | pool shape, underfill backoff, seeded determinism (26 tests) |
| `sample-products-image-fallback.test.ts` | 4-tier fallback, RATE_LIMITED, `PIXABAY_FALLBACK_ONLY=1` |
| `seed-blog-posts.test.ts` | 3-tier fallback, imageKeyword, RATE_LIMITED |
| `image-library-seeder.test.ts` | 17-slot upload, idempotency, alt key |
| `media-injector.test.ts` | `PIXABAY_BLOCKS` gating (hero-only default vs all) |

## 5. Kiểm thử thủ công (staging)

1. Thêm `PIXABAY_API_KEY` vào Vercel staging. Gen 1 site.
2. Verify hero, gallery, product, blog thumbnail đều có ảnh; nguồn từ `pixabay.com/get/...`.
3. Tắt key (hoặc key sai) → pipeline không crash, dùng fallback tĩnh (hero/blog/product) + carton placeholder.
4. CI: `check-migrations.js` no-op (không đổi schema), `check-env-vars.js` pass.

## 6. Câu hỏi mở
- Hero dùng `largeImageURL` 1280px upscale lên 1920 — chấp nhận chất lượng? (full-res cần Pixabay full API access).
- **Square/team:** Pixabay không có orientation vuông (`squarish→all`). Client đã prefer near-square (over-fetch + lọc ar 0.8–1.25), nhưng khi query niche ít ảnh vuông sẽ fill bằng ảnh ngang (crop center). QA xem ảnh team/testimonials thật trên staging → đánh giá có cần siết thêm không.
- **Alt text:** giờ build từ tags Pixabay (`"tag1, nature — Photo by user"`) thay vì câu mô tả Unsplash — a11y kém hơn chút, chấp nhận?
