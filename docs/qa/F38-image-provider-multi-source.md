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

## 4b. Regression — raw keyword (GH-1185, plan `plans/260702-1607-GH-1185-pixabay-raw-keyword/`)

> Keyword gửi lên Pixabay GIỮ NGUYÊN ngôn ngữ user nhập (không dịch EN); `q` không trộn EN scaffolding (mood/category/modifier) khi có raw keyword. `lang` được auto-detect theo script của query để khớp ngôn ngữ input: VN (ký tự đặc trưng — nếu không Pixabay strip dấu và partial-match rác: "cơm"→"myfirstpug.com", "bò"→bò Scotland), Thai/Kana/Hangul/Han/Cyrillic/Greek → th/ja/ko/zh/ru/el. Không detect được (Latin: EN/MS/DE/…) → fallback default `lang=en`. Relevance gate + VN category fallback chỉ áp cho query tiếng Việt. Thêm `category` filter của Pixabay (map composer→food/health/sports/…) — không tăng match chính xác nhưng giữ ảnh rác/fallback nằm đúng lĩnh vực (miss của "phở bò" là món ăn khác, không phải bò sữa).

| TC-ID | Loại | Mô tả | Kỳ vọng | Status |
|---|---|---|---|---|
| **TC-F38-RAW-01** | `[Positive]` | `buildPoolQuery` với products VN + mood | `q` = `"phở bò gỏi cuốn"` — không adjective EN, không category | [x] |
| **TC-F38-RAW-02** | `[Positive]` | `buildPoolQuery` không products | scaffolding: chứa category (`restaurant`) | [x] |
| **TC-F38-RAW-03** | `[Positive]` | `buildPoolQuery(relaxed=true)` với 2 products | broaden về `"phở bò"` (≠ query chính) | [x] |
| **TC-F38-RAW-04** | `[Positive]` | `deriveKeywords` có englishKeywords (raw) | trả `["phở bò"]` verbatim — không modifier/mood | [x] |
| **TC-F38-RAW-05** | `[Positive]` | `deriveKeywords` không raw keyword | scaffolding: category base + modifier | [x] |
| **TC-F38-RAW-06** | `[Positive]` | Raw VN q verbatim + `lang=vi` auto-detect | pool-level: `q="phở bò"`; client-level: URL có `lang=vi` | [x] |
| **TC-F38-RAW-07** | `[Negative]` | Query EN / loanword é ("café latte") | URL KHÔNG có `lang` param (default en, không misroute) | [x] |
| **TC-F38-RAW-08** | `[Positive]` | `detectQueryLang` pure function (VN/Latin) | VN chars đặc trưng (ơ/ư/ă/đ/hook-above/dot-below) → 'vi'; EN/MS/café → undefined | [x] |
| **TC-F38-RAW-09** | `[Positive]` | `detectQueryLang` script-based đa ngôn ngữ | Thai→'th', Kana→'ja' (kana thắng kanji), Hangul→'ko', Han-only→'zh', Cyrillic→'ru', Greek→'el' | [x] |
| **TC-F38-RAW-10** | `[Positive]` | `searchPhotos` set `lang` khớp input, q raw | Query Thai → URL có `lang=th`, `q` giữ nguyên không dịch | [x] |
| **TC-F38-RAW-11** | `[Positive]` | `searchPhotos` truyền `category` filter | opts.category='food' → URL có `category=food`; không set → không có param | [x] |
| **TC-F38-RAW-12** | `[Positive]` | Map composer→Pixabay category | restaurant/fnb→food, fitness→sports, realestate→buildings; events/ecommerce → không map (không filter) | [x] |
| **TC-F38-RAW-13** | `[Positive]` | Testimonials avatar = ảnh người, không phải pool | `fulfillImageNeeds` route testimonials → `getAvatarMedia` (`category=people`, query "chân dung người việt"/"portrait people"); pool bị bỏ qua; miss → avatar trống (không rơi về ảnh food) | [x] |
| **TC-F38-RAW-14** | `[Positive]` | Team/doctor-profile cũng dùng portrait search | `PEOPLE_BLOCKS` = testimonials/team/doctor-profile → cùng đường `getAvatarMedia`; members[].image = ảnh người | [x] |
| **TC-F38-RAW-15** | `[Positive]` | `opts.lang` override cho curated query không detect được | `VN_CATEGORY_QUERIES.fnb` "quán cà phê" chỉ chứa dấu ambiguous (á/à/ê) → detect miss; override `lang:'vi'` → URL vẫn có `lang=vi` (review fix PR #1481 — A1) | [x] |
| **TC-F38-RAW-16** | `[Positive]` | NFC normalize: input NFD (decomposed) vẫn detect + gate đúng | "phở bò" dạng NFD → `detectQueryLang`='vi'; `photoMatchesQuery` match tag NFC của Pixabay (review fix PR #1481 — M5) | [x] |
| **TC-F38-RAW-17** | `[Negative]` | Tier-3 VN fallback throw (429) không escape catch | `getMediaForBlock`: hero → vẫn resolve với curated hero fallback; non-hero → resolve rỗng + failures, KHÔNG unhandled rejection (review fix PR #1481 — H1 `return await`) | [x] |
| **TC-F38-RAW-18** | `[Positive]` | `extractImageKeywords` returns 2-4 keywords in input language from business info | Mock OpenAI, pass businessName + shortDescription → extract returns 2-4 concrete visual terms (same language, trimmed, < 4 items) | [ ] |
| **TC-F38-RAW-19** | `[Negative]` | no `OPENAI_API_KEY` / timeout / malformed JSON → `[]` (graceful) | Mock OpenAI client missing / throw timeout / return malformed JSON → fn returns `[]`, no throw | [ ] |
| **TC-F38-RAW-20** | `[Positive]` | `mergeKeywords` products-first, case-insensitive dedup, cap 3; empty products → extracted fills | Products ["phở bò", "gỏi"] + extracted ["PHỞ", "cơm"] → ["phở bò", "gỏi", "cơm"] (base first, dedup case-insensitive, capped 3) | [ ] |
| **TC-F38-RAW-21** | `[Positive]` | `planImageNeeds` skips `logo-cloud` even when `PIXABAY_BLOCKS=all` (no image need emitted) | Pass blocks=[{blockType: 'logo-cloud', logos:[...]}], PIXABAY_BLOCKS=all → planImageNeeds returns 0 needs (logo-cloud excluded) | [ ] |
| **TC-F38-RAW-22** | `[Positive]` | `hydrateUrlUploadsToMedia`/`cleanupNonNumericImageFields` still process logo-cloud spec | logo-cloud logos[].logo.url (Media object) → hydrate ingest as real Media; empty {url:''} → cleanup strips | [ ] |
| **TC-F38-RAW-23** | `[Positive]` | Pool tier-3 fallback cho query non-VN zero-hit → EN category base keyword | `buildImagePool`: query Malay ("pen dan pensel...") primary + relaxed đều 0 hit, không detect 'vi' → tier-3 query = `CATEGORY_BASE_KEYWORDS[category][0]` (vd ecommerce → "product photography"); pool không rỗng, `underfill=true` | [ ] |
| **TC-F38-RAW-24** | `[Positive]` | Legacy per-block tier-3 fallback cho query non-VN zero-hit → EN category base keyword | `getMediaForBlock`: keywords Malay zero-hit cả primary + broaden → tier-3 search EN category base keyword, trả media IDs thay vì rỗng (rỗng = URL GPT bịa sống sót qua ingest) | [ ] |

## 5. Kiểm thử thủ công (staging)

1. Thêm `PIXABAY_API_KEY` vào Vercel staging. Gen 1 site.
2. Verify hero, gallery, product, blog thumbnail đều có ảnh; nguồn từ `pixabay.com/get/...`.
3. Tắt key (hoặc key sai) → pipeline không crash, dùng fallback tĩnh (hero/blog/product) + carton placeholder.
4. CI: `check-migrations.js` no-op (không đổi schema), `check-env-vars.js` pass.

## 6. Câu hỏi mở
- Hero dùng `largeImageURL` 1280px upscale lên 1920 — chấp nhận chất lượng? (full-res cần Pixabay full API access).
- **Square/team:** Pixabay không có orientation vuông (`squarish→all`). Client đã prefer near-square (over-fetch + lọc ar 0.8–1.25), nhưng khi query niche ít ảnh vuông sẽ fill bằng ảnh ngang (crop center). QA xem ảnh team/testimonials thật trên staging → đánh giá có cần siết thêm không.
- **Alt text:** giờ build từ tags Pixabay (`"tag1, nature — Photo by user"`) thay vì câu mô tả Unsplash — a11y kém hơn chút, chấp nhận?
