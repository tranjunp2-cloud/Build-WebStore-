# Quyết Định Kiểm Thử & Testcase Chi Tiết: F48 - Media Management

> **Phiên bản:** 1.3 (Draft) | **Cập nhật:** 2026-11-09 (review độc lập D55–D67; review lượt 3 D68–D78; D83; DAM D84 — 2026-11-10) | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** [PRD tổng](../prd/F48-media-management-overview.md) · PRD sprint [S0](../prd/F48-media-management-sprint0.md) · [S1](../prd/F48-media-management-sprint1.md) · [S2](../prd/F48-media-management-sprint2.md) · [S3](../prd/F48-media-management-sprint3.md) · [S4](../prd/F48-media-management-sprint4.md) · [S5](../prd/F48-media-management-sprint5.md) · Stories [1](../stories/F48-media-management-stories.md) · [2](../stories/F48-media-management-stories-2.md) · [3](../stories/F48-media-management-stories-3.md) · [4](../stories/F48-media-management-stories-4.md) · [Architecture](../architecture/F48-media-management.md) · [Design](../design/F48-media-management-design.md) · brainstorm F48 2026-11-09 (D1–D67, FR-01..36 + FR con, NFR-01..08, SEC-1..11) + D68–D78 ([PRD tổng](../prd/F48-media-management-overview.md)) · [Microcopy](../design/F48-media-management-microcopy.md)
> **Mã lỗi:** cột Kỳ vọng dùng mã trong bảng lỗi PRD S0–S5 (chuẩn); body lỗi `MediaErrorBody { error, code }`.
> **Kỹ thuật:** BDD (Gherkin), BVA, Equivalence Partitioning (định dạng file), State Transition (tmp → register → used/unused → GC), Concurrency (dedupe, quota, folder lock), Security (IDOR, field tampering, SSRF, polyglot, XSS, CSRF), Property-based (bộ đếm quota, guard prefix), Snapshot bucket (NFR-05)
> **Tổng TCs:** 224 (TC-F48-01-01 → TC-F48-16-05; +13 TC theo D55–D62, +5 TC theo D64–D67, +10 TC theo review lượt 3 D68–D78 + authz route private/usages/quota, +1 TC D83 ETag video, +2 TC D84 policy ảnh SP khớp DAM, +6 TC D87 key phiên bản/durable cleanup, +2 TC P1 exact-key audit exclusion, +2 TC registry publish/Ops metadata), phủ 96/96 AC (NHÓM 16 — 5 TC của US-F48-16 hoãn theo D88, không chạy trong S5) — toàn bộ trong 1 file (không cần tách `-2.md`)
> **Quy ước TC-ID:** `TC-F48-<story>-<nn>`; `nn` = số AC (AC-n ↔ TC-…-0n, khớp DoD từng story). TC bổ sung ngoài AC đánh số tiếp sau AC lớn nhất của story. TC Security/NFR nằm trong story sở hữu, được gom lại ở §6 (Security) và §7 (NFR).

---

## 1. Mục Tiêu

Kiểm thử F48 — hệ thống media thống nhất cho merchant đa tenant, bucket DO Spaces **dùng chung với PW1**:

- **S0 (US-F48-01..03):** khoá field hệ thống + đọc public không lộ dữ liệu nội bộ; cứng hoá mọi đường upload; vận hành key/CDN/listing.
- **S1 (US-F48-04..05):** pipeline client nén → `pw2/tmp/` → `register` (magic, sharp WebP, strip EXIF, 50MP, sha256, dedupe theo tenant); thư viện `/media` phân trang server.
- **S2 (US-F48-06..08):** MediaPicker dùng chung, gắn 18 điểm upload, block mới lưu `{mediaId,url}`, import URL an toàn.
- **S3 (US-F48-09..10):** thư mục ≤ 5 cấp / ≤ 200, quyền `media`.
- **S4 (US-F48-11..13):** "Đang dùng ở đâu", chặn xoá + "Vẫn xoá" (owner), GC dry-run chỉ `pw2/`, quota theo gói.
- **S5 (US-F48-14..15):** gallery SP 10 ảnh, ảnh biến thể; US-F48-16 ảnh danh mục hoãn D88, không là gate S5.

**Bất biến cốt lõi (vi phạm = Blocker):**
- **INV-1 (SEC-1/D15/D22/D55/D58):** client không bao giờ ghi được `filename, prefix, _objectKey, mimeType, filesize, url, width, height, contentHash, tenant, private, createdVia` — REST, GraphQL (user không phải super-admin) và route F48 (schema strict) gửi giá trị **khác bản gốc** → 400 `MEDIA_FIELD_READONLY` (REST/GraphQL của merchant bị collection access chặn 403 trước — INV-3). Local API miễn guard (D70) nhưng field access `update` vẫn giữ nguyên giá trị khi `overrideAccess: false`; Local API mặc định `overrideAccess: true` nên field access không áp — Local API ghi media mang input client phải `overrideAccess: false` hoặc chỉ chép allowlist `alt/caption/displayName/folder` (D82); field hệ thống chỉ khoá `update`, `create` do server sinh (D69). `_objectKey`/`prefix` khoá trong plugin chạy sau `s3Storage` (plugin-cloud-storage ghi đè field).
- **INV-2 (NFR-05/D21):** không thao tác xoá nào (xoá row, xoá nhiều, "Vẫn xoá", GC, regenerate) xoá object ngoài `pw2/`, trừ key phẳng (không `/`) đúng `filename` của chính row PW2 đang xoá. Row PW1 legacy (`filename` null) → chỉ xoá row.
- **INV-3 (M9):** tenant isolation — id của tenant khác/global qua route F48 luôn **404**; ghi qua Payload REST/GraphQL `/api/media` (collection access chỉ super-admin) → **403**. Không đổi dữ liệu trong mọi trường hợp.
- **INV-4 (D24):** luồng thanh toán (biên lai người mua) không bao giờ bị chặn bởi quota merchant.
- **INV-5 (M6):** `tenants.media_bytes_used` khớp `SUM(filesize)` của media non-private, `filename IS NOT NULL` (row PW1 migrate không tính) của tenant: bằng tuyệt đối trong chuỗi thao tác test (13-07); mỗi đường xoá trừ đúng 1 lần (13-11, D67); sau đối soát production lệch ≤ 1% hoặc ≤ 5 MB (dung sai FR-33e).

---

**Trạng thái D87/B1:** các TC dưới đây là test-plan cho triển khai, chưa phải bằng chứng AUTO đã chạy. Integration gọi service thật + Postgres/MinIO với fault/barrier, không re-implement protocol; TC-ID và AAA theo `docs/TEST_CONVENTION.md`.

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Môi trường | Local (Docker Postgres + MinIO) cho U/I; Staging Vercel cho E2E/P/M |
| Trình duyệt | Chrome 130+, Safari iOS 18, Firefox 130+ |
| Thiết bị | Desktop 1280px; Mobile 375px (iPhone SE/14 profile Playwright) |
| Backend | Next.js 16.4.2 + Payload 3.91 + `@payloadcms/storage-s3` 3.91 + sharp 0.35.x + PostgreSQL |
| Object storage (test) | **MinIO** (`minio/minio`, path-style, bucket `f48-test`), chạy như service trong job CI integration (D42), cho mọi TC Security/GC/xoá. **CẤM** chạy TC-F48-01-07..10, 01-13, 12-08, 12-09 trên bucket DO thật |
| DB pooler | Integration TC lock/transaction (04-10, 09-08, 12-07, 13-03, 04-25) chạy thêm qua PgBouncer `pool_mode=transaction` (giả lập Neon `-pooler`, D60) |
| Object storage (ops) | DO Spaces sgp1 staging — TC-F48-03-xx và TC-F48-12-06 dùng prefix thử `pw2/qa-lifecycle/`; riêng TC-F48-12-25 kiểm capability registry trên key metadata QA tách biệt (không dùng registry thật hoặc object media thật). Không mở ngoại lệ cho các TC Security/GC/xoá khác; các TC khai thác vẫn chỉ MinIO |
| Test runner | Vitest 3 (unit + integration), Playwright (E2E), `@axe-core/playwright` (a11y), k6 hoặc script Node `perf_hooks` (P) |
| Auth | 2 tenant, super-admin, owner, staff ± `media`, người mua (xem §9) |
| Locale | Dashboard `en`, `ms`; storefront `en`, `ms` |
| Timezone | Server UTC; hiển thị `Asia/Kuala_Lumpur`; QA chạy từ `Asia/Saigon` (kiểm mốc 30 ngày GC theo UTC) |
| Mạng | Playwright throttling "Slow 3G" + offline toggle cho TC mạng |

**Ký hiệu tầng (cột "Tầng"):**
- **U** — Vitest unit: hàm thuần (`upload-limits`, `image-signature`, guard key, `folder-rules`, SSRF resolver), sharp chạy thật trên file fixture.
- **I** — Vitest integration: gọi route handler thật + Payload Local API (`overrideAccess: false`, `user` thật) + Postgres thật + MinIO. Không mock Payload/S3 cho TC Security/GC.
- **E** — Playwright E2E trên app local hoặc staging.
- **P** — đo hiệu năng có script, ghi số vào PR.
- **M** — manual/ops có bằng chứng (screenshot/CLI output, không lộ secret).

---

## 3. Scope Kiểm Thử

### In Scope
- Collection `media` (field access, hooks, afterDelete guard), `media-folders`, cột mới (`content_hash`, `created_via`, `display_name`, `folder_id`, `unused_since`, `uploaded_by_id`, `tenants.media_bytes_used`, `tenants.media_gc_checked_at`, `products_variants.image_id`, `orders_items.image_url`; `categories.image_id` chỉ khi mở lại US-F48-16, ngoài S5 — D88).
- Route: `/api/media/presign`, `/api/media/register`, `/api/media/library`, `/api/media/library/:id`, `/api/media/library/:id/usages`, `/api/media/library/bulk-delete`, `/api/media/quota`, `/api/media/move`, `/api/media/folders`, `/api/media/import-url`, `/api/media/private/[id]`, `/api/cron/media-gc`, Payload REST `/api/media`, GraphQL, avatar `/api/users/me/avatar`, `/api/orders/[id]/upload-proof-direct`, server action `uploadMediaAction`, `/_next/image`.
- UI: `/media`, MediaPicker, 18 điểm upload, StaffDrawer, sidebar, form SP/biến thể, storefront PDP/giỏ/email; form danh mục hoãn cùng US-F48-16 (D88).
- Ops: xoay key, key riêng PW2, listing bucket, CDN, lifecycle rule.

### Out of Scope (F48)
- Chỉnh ảnh nâng cao, transcode/poster video, ClamAV, Brand, review SP.
- Backfill block cũ sang `{mediaId}`, migrate dữ liệu PW1; 12.232 ảnh SP PW1 trỏ bucket dev.
- "Gán 1 ảnh cho mọi biến thể cùng màu" (D31).

---

## 4. Kịch bản edge-case (nguồn sinh TC bổ sung)

Sinh bằng skill `ak:scenario` (one-shot, 12 chiều) trước khi viết TC. Chỉ giữ kịch bản dẫn tới TC; chiều "Compliance" gộp vào Security (EXIF/GPS = PII).

| # | Chiều | Kịch bản | Mức | TC |
|---|---|---|---|---|
| 1 | Security | Đổi `filename`/`prefix` qua update rồi xoá row ⇒ xoá object tuỳ ý (SEC-1) | Critical | 01-07..10, 01-13 |
| 2 | Security | Key mập mờ: `pw2` không `/`, `PW2/`, `pw2-backup/`, `pw2/../`, `%2F`, `/pw2/` | Critical | 01-13, 12-09 |
| 3 | Dữ liệu cũ | Row PW1 legacy `filename` null; row PW2 trước F48 key phẳng; URL PW1 trong block | High | 01-03, 05-14, 11-09, 12-08 |
| 4 | Đồng thời | 2 register cùng hash cùng tenant; 3 register vượt quota; 20 tạo thư mục khi còn 5 chỗ; move chéo A↔B | Critical | 04-10, 13-03, 09-08, 09-13 |
| 5 | Đồng thời | Xoá khi tab khác vừa gắn ảnh; GC kiểm lại trước xoá | Critical | 11-12, 12-04 |
| 6 | Khôi phục | PutObject cuối OK nhưng INSERT lỗi; S3 lỗi khi xoá trong bulk/GC; register replay | High | 04-12, 04-13, 05-15, 12-07 |
| 7 | Mạng | Presign 60s hết hạn khi upload chậm 3G; mất mạng giữa chừng | High | 04-07, 04-20 |
| 8 | Input | Ảnh alpha/CMYK/16-bit/1×1/EXIF orientation; ICO; WebP động; polyglot; tên file `../` + emoji | High | 04-09, 04-14..16, 04-21 |
| 9 | Input | alt/displayName XSS, emoji đếm ký tự, tìm kiếm với `%`/`_`/`'` | High | 05-12, 05-13, 05-16 |
| 10 | Quyền | 6 vai × endpoint; thu hồi quyền giữa phiên; staff tự cấp quyền; CSRF; cron không secret | Critical | 10-06..08, 05-18, 12-14 |
| 11 | Quyền | Private/public cùng hash (biên lai = ảnh thư viện) | Critical | 04-11 |
| 12 | Tích hợp | SSRF: IPv6-mapped, IP thập phân, DNS rebinding, redirect https→http; stream > 10 MB nói dối Content-Length | Critical | 08-05, 08-06 |
| 13 | Tích hợp | Usage scan theo host CDN vs S3 path-style vs query `?w=`; khớp chuỗi con sai | High | 11-09, 11-14 |
| 14 | Tích hợp | Đơn hàng tham chiếu media (item snapshot, proof) — không bao giờ GC/force | Critical | 11-10, 12-12, 15-06 |
| 15 | Quota | Biên = đúng hạn mức; hạ gói; bộ đếm lệch; dedupe không tăng | High | 13-04, 13-07, 13-09 |
| 16 | i18n | Chuỗi cứng ms; định dạng số; gợi ý lỗi gif/heic | Medium | 05-07, 07-03, 13-08 |
| 17 | Mobile/a11y | 375px bottom sheet, long-press, drag handle vs cuộn; axe + bàn phím | Medium | 05-09, 05-10, 06-06, 06-07, 14-07 |
| 18 | Hiệu năng | register 5 MB, list tenant 5.000 file, usage scan tenant lớn | High | 04-18, 05-08, 11-08 |
| 19 | Thời gian | Mốc 30 ngày `unused_since` sát biên + TZ; cursor ổn định khi có upload mới | Medium | 12-10, 05-11 |
| 20 | Dữ liệu cũ | SP migrate PW1 có 6–8 ảnh vẫn lưu được; ảnh PW1 vẫn hiện sau thu hẹp remotePatterns | High | 14-09, 02-12 |
| 21 | Hạ tầng | PgBouncer transaction mode: advisory lock mức session rò, transaction qua `pool.query` rời (D60) | Critical | 04-10, 12-07, 13-03 |
| 22 | Dữ liệu | `media_filename_idx` unique toàn bảng: 2 tenant / 2 biên lai cùng ảnh (D56, D57) | High | 04-03, 04-25, 04-26 |
| 23 | Hồi quy S0 | Đổi collection access chặn luồng hợp lệ: route xoá, upload `/admin`, carton placeholder, avatar/SSO lặp, QR chọn từ thư viện (D68–D73) | Critical | 01-17..19, 04-31, 04-32, 07-12 |
| 24 | Quyền | Route đọc phụ (private biên lai, usages, quota) với tenant khác/staff thiếu quyền/anonymous | High | 01-16, 11-16, 13-12 |

---

## 5. Unified Test Cases

Cột: **ID | Ref | Loại | Tiêu đề | Bước | Kỳ vọng | Mức độ | Tầng | AUTO**

---

### NHÓM 01 — US-F48-01: Khoá field hệ thống + đọc public an toàn (19 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-01-01** | `AC-1 US-F48-01`, `FR-16`, `D15` | `[Positive]` | Sửa alt/caption/displayName/folder thành công | 1. Owner A có media M (seed `m-a-photo`).<br>2. PATCH route metadata với 4 field hợp lệ (folder thuộc A).<br>3. Đọc lại row. | **GIVEN** M thuộc A **WHEN** cập nhật 4 field **THEN** 4 field lưu đúng **AND** 12 field hệ thống (gồm `_objectKey`) giữ nguyên byte-by-byte (so snapshot trước/sau). | Blocker | I | [x] |
| **TC-F48-01-02** | `AC-2 US-F48-01`, `FR-01`, `D22`, `D55`, `D58` | `[Security]` | Từ chối ghi field hệ thống ở mọi đường ghi | Tham số hoá: **12 field** (`filename, prefix, _objectKey, mimeType, filesize, url, width, height, contentHash, tenant, private, createdVia`) × 4 đường (Payload REST `PATCH /api/media/:id` với user có quyền ghi giả lập, GraphQL `updateMedia`, route `/api/media/library/:id`; Local API với `user` A + `overrideAccess:false`). Mỗi lần gửi 1 field hệ thống **giá trị khác bản gốc** + `alt`; lặp lại với giá trị **bằng** bản gốc. | Giá trị khác: REST/GraphQL/route: **THEN** 400 `MEDIA_FIELD_READONLY`, không field nào (kể cả `alt`) thay đổi **AND** log có `userId, tenantId, mediaId, fields[]` — 36/36 tổ hợp pass. Local API (D70 miễn guard): không 400, field hệ thống giữ nguyên nhờ field access `update` (12/12), `alt` lưu. Giá trị bằng bản gốc: không bị chặn bởi guard (D58; REST/GraphQL vẫn 403 theo collection access — INV-3). **Thêm (D65):** update bulk theo `where: { tenant: { equals: A } }` có `filename` (kể cả bằng gốc) qua REST/GraphQL → 400 `MEDIA_FIELD_READONLY` (hoặc 403 collection access), 0 row đổi; qua Local API với `overrideAccess:false` (D70, D82) → 0 row đổi field hệ thống; update theo id đọc `originalDoc` qua `findByID` `overrideAccess` cùng `req` (spy). | Blocker | I | [x] |
| **TC-F48-01-03** | `AC-3 US-F48-01`, `D21`, `NFR-05` | `[Security]` | Xoá row chỉ xoá đúng object của row; row legacy chỉ xoá row | MinIO seed §9.3. 1. Xoá M (key `pw2/t/{A}/…webp`).<br>2. Xoá row PW2 cũ key phẳng `legacy-flat.jpg`.<br>3. Xoá row PW1 legacy (`filename` null).<br>4. List bucket. | (1) chỉ object của M mất. (2) chỉ `legacy-flat.jpg` mất. (3) row mất, 0 object mất, log `skip-foreign-key`. Mọi object khác trong snapshot giữ nguyên ETag. | Blocker | I | [x] |
| **TC-F48-01-04** | `AC-4 US-F48-01`, `INV-3`, `M9` | `[Security]` | Sửa/xoá media tenant B hoặc global → route 404 / REST 403 | 1. User A PATCH/DELETE media của B.<br>2. PATCH/DELETE media global (tenant null: stock, carton placeholder).<br>3. Qua route F48 `/api/media/library/:id` và qua Payload REST/GraphQL `/api/media/:id`. | Route F48 → **404** (body không phân biệt "không tồn tại" và "không có quyền"); Payload REST/GraphQL → **403** (collection access chỉ super-admin). DB không đổi, MinIO 0 DeleteObject (kiểm qua audit log MinIO). | Blocker | I | [x] |
| **TC-F48-01-05** | `AC-5 US-F48-01`, `FR-02`, `SEC-8` | `[Security]` | Đọc public không lộ `aiPrompt`/`sourceUrl`; private chặn | 1. Anonymous GET `/api/media/:id` và list `/api/media?limit=100` duyệt id 1..N.<br>2. Anonymous GET media private.<br>3. Owner A GET qua dashboard. | (1) JSON không có key `aiPrompt`, `sourceUrl` (kể cả `null`). (2) 403/404; chỉ `/api/media/private/[id]` đọc được (ma trận quyền ở 01-16). (3) Owner thấy đủ 2 field. | Critical | I | [x] |
| **TC-F48-01-06** | `AC-6 US-F48-01`, `D22` | `[Security]` | Tạo mới kèm field hệ thống → 400 | 1. REST `POST /api/media` (multipart) kèm `tenant=B`.<br>2. Upload proof kèm `private=false`.<br>3. Register kèm `createdVia=seed`. | (1) merchant → 403 (collection access `media` chỉ super-admin, INV-3), không row; super-admin create xem 01-18 (D69). (2)(3) route schema strict → **THEN** 400 `MEDIA_FIELD_READONLY`, không row, tmp bị xoá. Request hợp lệ (không gửi field hệ thống) → `tenant` theo session, `private`/`createdVia` do server quyết. | Blocker | I | [x] |
| **TC-F48-01-07** | `SEC-1`, `DoD US-F48-01`, `FR-01` | `[Security]` | **Tái hiện SEC-1 ĐỎ TRƯỚC KHI SỬA** — Payload REST update + delete | Trên code staging `1248713`, MinIO: seed object canary `canary/DO-NOT-DELETE.txt` + object PW1 giả. 1. Owner A tạo media M hợp lệ.<br>2. Update M qua `PATCH /api/media/:id` đổi field lưu trữ sang giá trị trỏ object canary (chi tiết payload chỉ trong file test, không ghi ở tài liệu).<br>3. DELETE M.<br>4. HeadObject canary. | **Trước sửa (kỳ vọng ĐỎ):** canary bị xoá → test fail, đính kèm log vào PR. **Sau sửa (XANH):** bước 2 → 400 `MEDIA_FIELD_READONLY`; bước 3 chỉ xoá object gốc của M; canary + object PW1 còn nguyên. | Blocker | I | [x] |
| **TC-F48-01-08** | `SEC-1`, `FR-01`, `FR-16` | `[Security]` | SEC-1 qua route metadata riêng | Như 01-07 nhưng bước 2 qua `PATCH /api/media/library/:id` (body thừa field lưu trữ). | Đỏ trước nếu route chuyển tiếp body thô vào Payload; sau sửa: 400, canary còn. Route chỉ whitelist `alt, caption, displayName, folder`. | Blocker | I | [x] |
| **TC-F48-01-09** | `SEC-1`, `FR-03`, `FR-12` | `[Security]` | SEC-1 ở đường tạo: REST POST / register với key ngoài `pw2/` | 1. `POST /api/media` gửi tên file chứa `/` hoặc tiền tố thư mục.<br>2. `register` với key không khớp regex `pw2/tmp/{uuid}` của chính user.<br>3. Xoá các row (nếu tạo được). | Object cuối luôn ở key server sinh (`pw2/t/{tenant}/t{tenant}-{hash32}-{uuid32}.webp`); không row nào có `prefix/_objectKey/filename` do client chọn; xoá không đụng object ngoài `pw2/`. | Blocker | I | [x] |
| **TC-F48-01-10** | `SEC-1`, `AC-2 US-F48-01` | `[Security]` | SEC-1 qua GraphQL mutation | `updateMedia(id, data: {<field lưu trữ>})` rồi `deleteMedia`. | 400/GraphQL error code `MEDIA_FIELD_READONLY`; canary còn. | Blocker | I | [x] |
| **TC-F48-01-11** | `Additional US-F48-01`, `D58` | `[Security]` | Super-admin trong Payload admin không sửa được `filename/prefix/_objectKey/url` | 1. Login super-admin `/admin` → Media → mở 1 row.<br>2. Kiểm field.<br>3. Thử API với cookie super-admin đổi `filename`, `_objectKey`. | Field read-only trên UI; API: giá trị lưu trữ **giữ nguyên** (field access gỡ thay đổi; super-admin không qua guard D58 nên không 400); xoá row sau đó chỉ xoá object gốc. | Critical | E | [x] |
| **TC-F48-01-12** | `Additional US-F48-01` | `[Positive]` | Luồng nội bộ không vỡ (AI, seeder, `stripOrphanMediaRefs`) | Chạy: AI generate ảnh, seed site, `stripOrphanMediaRefs` qua Local API `overrideAccess` có kiểm soát. | Row tạo đúng `createdVia` (`ai`/`seed`/`system`), không lỗi `MEDIA_FIELD_READONLY`; regression suite F01/F05 pass. | Critical | I | [x] |
| **TC-F48-01-13** | `SEC-1`, `D21`, `INV-2` | `[Security]` | Guard key xoá (defense-in-depth) với key mập mờ | Unit `isDeletableStorageKey(row)` (tên duy nhất ở mọi tài liệu; xét trên key ghép `[prefix, _objectKey, filename]` bỏ rỗng — D64): `prefix=pw2/t/1`, `_objectKey=NULL` + `t1-a.webp` ✓ (key `pw2/t/1/t1-a.webp`); `_objectKey=pw2/t/1` + `t1-a.webp` ✓; `pw2/t/1/a.webp` ✓; `pw2` ✗; `PW2/a` ✗; `pw2-backup/a` ✗; `pw2/../uploads/a` ✗; `pw2/t/1/%2e%2e/x` ✗; `/pw2/a` ✗; `a.jpg` khi row.filename=`a.jpg` ✓; `a.jpg` khi row.filename=`b.jpg` ✗; `uploads/a.jpg` ✗; filename null ✗. Integration: sửa row trực tiếp bằng SQL thành key ngoài `pw2/` rồi DELETE qua API. | Unit: đúng bảng chân trị. Integration: row xoá, object không bị DeleteObject, log `skip-foreign-key`. | Blocker | U+I | [x] |
| **TC-F48-01-14** | `D58`, `FR-01`, `Additional US-F48-01` | `[Positive]` | Super-admin sửa alt trong `/admin` thành công | 1. Login super-admin `/admin` → Media → sửa `alt` → Save (form gửi lại nguyên field hệ thống).<br>2. Owner A gọi route PATCH gửi lại `filename` **bằng** giá trị gốc + `alt` mới.<br>3. Local API hệ thống (không `user`) cập nhật `createdVia`. | (1) 200, `alt` lưu; field hệ thống không đổi; không 400. (2) Route schema strict → 400 `MEDIA_FIELD_READONLY` (key lạ ngoài whitelist); Payload Local API với user A + giá trị bằng gốc → không bị guard chặn. (3) Thành công (guard bỏ qua request không user). | Critical | I+E | [x] |
| **TC-F48-01-15** | `D55`, `FR-01`, `SEC-1` | `[Security]` | `_objectKey`/`prefix` bị khoá sau khi `s3Storage` ghi đè field | Unit đọc sanitized Payload config: thứ tự `plugins` (plugin khoá chạy **sau** `s3Storage`), access `create/update` của field `_objectKey`, `prefix` trên collection `media`; integration: member PATCH `_objectKey` (khác gốc) qua REST/route và Local API user (`overrideAccess:false`) rồi DELETE. | Access khoá đúng (không phải access mặc định của plugin-cloud-storage); REST → 403/400, route → 400 `MEDIA_FIELD_READONLY`; Local API → `_objectKey` giữ nguyên (field access, D70); DELETE chỉ xoá object gốc; đổi thứ tự plugin → test đỏ. | Blocker | U+I | [x] |
| **TC-F48-01-16** | `AC-5 US-F48-01`, `FR-02`, `INV-3`, `D17`, `D79` | `[Security]` | Quyền route private biên lai `/api/media/private/[id]` (D79) | Seed biên lai P (private, tenant A, gắn `ORD-F48-1`). GET `/api/media/private/{P}` lần lượt với: `ownerA`, staff A có `orders`, `sa`; staff A **không** có `orders` (`staffProdA`); `ownerB` (có `orders` ở B); anonymous (không cookie); `ownerA` với id media **non-private** của A. | `ownerA`, staff `orders` A, `sa` → 200 đúng byte (sha256 khớp), `nosniff`, `Cache-Control: no-store`; `staffProdA` → **403** `MEDIA_FORBIDDEN`; `ownerB` → **404** `MEDIA_NOT_FOUND` (body không phân biệt tồn tại/không quyền); anonymous → **401** `MEDIA_UNAUTHORIZED`; id non-private → 404 `MEDIA_NOT_FOUND`. Không request nào nhận URL object S3. | Blocker | I | [x] |
| **TC-F48-01-17** | `D68`, `FR-29a`, `INV-3`, `AC-4 US-F48-01` | `[Security]` | Xoá qua route thư viện sau S0 (`assertCanManageMedia` + `overrideAccess:true`) | Sau khi S0 đổi collection access `media` chỉ super-admin: 1. `ownerA` `DELETE /api/media/library/{M}` (M của A, không dùng).<br>2. Staff A chỉ `orders` xoá M2.<br>3. `ownerA` xoá id media của B.<br>4. `ownerA` gọi Payload REST `DELETE /api/media/{M3}`. Đồng bộ TC-PERF-187/188/191..193 (bộ TC route media cũ). | (1) 200, row + object M mất (đúng 1 `DeleteObject`, INV-2), quota giảm đúng `filesize`. (2) 403 `MEDIA_FORBIDDEN`, M2 còn. (3) 404, B không đổi. (4) 403 (collection access), M3 còn. Không còn lời gọi `overrideAccess:false` trong route xoá (grep). | Blocker | I | [x] |
| **TC-F48-01-18** | `D69`, `FR-01`, `Additional US-F48-01` | `[Positive]` | Super-admin upload trong `/admin` vẫn đủ field hệ thống | 1. Login `sa` → `/admin` → Media → Create, upload `valid.webp`.<br>2. Đọc row.<br>3. `sa` sửa `filename` của row qua API. | (1) 201. (2) `filename`, `mimeType`, `filesize`, `width`, `height` có giá trị (generateFileData chạy, field `create` không khoá). (3) `filename` giữ nguyên (field access `update` khoá, D58/D69). | Critical | I+E | [x] |
| **TC-F48-01-19** | `D70`, `FR-01`, `Additional US-F48-01` | `[Positive]` | Hồi quy: lưu SP không ảnh vẫn tạo carton placeholder | `ownerA` tạo SP mới **không ảnh** (form dashboard + server action), tenant chưa có carton placeholder; lặp lần 2. Đối chứng: gửi cùng `data` field hệ thống qua REST `PATCH /api/media/:id`. | SP lưu 200; carton placeholder tạo qua Local API (`user` + `tenant`) **không** bị guard chặn (không 400 `MEDIA_FIELD_READONLY`), `created_via=system`; lần 2 dùng lại placeholder. Đối chứng REST → 403/400 (guard vẫn áp REST/GraphQL). | Blocker | I | [x] |

---

### NHÓM 02 — US-F48-02: Cứng hoá upload (13 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-02-01** | `AC-1 US-F48-02`, `FR-03`, `D23` | `[Negative]` | Whitelist MIME tường minh (EP) | Ma trận fixture §9.2 × đường A/B/C/D/REST: jpeg, png, webp, ico, mp4, webm (chấp nhận); svg, gif, heic, tiff, avif, txt, html, mov, pdf ngoài proof (từ chối). | Hợp lệ → 200/201 (ico chỉ khi `purpose=favicon`, D37). Bị cấm → 415 `MEDIA_UNSUPPORTED_TYPE`, thông báo en/ms liệt kê định dạng hợp lệ; gif/heic/avif/tiff có gợi ý "đổi sang PNG/WebP/JPEG". | Blocker | U+I | [x] |
| **TC-F48-02-02** | `AC-2 US-F48-02`, `FR-03`, `SEC-5` | `[Security]` | File đổi đuôi `.jpg` chứa HTML/PDF/SVG/ZIP bị chặn mọi đường | Fixture `fake-html.jpg`, `fake-pdf.jpg`, `fake-svg.jpg`, `fake-zip.jpg`, Content-Type `image/jpeg`; gửi qua A, B, C, D (avatar, QR, proof), REST. | 415 `MEDIA_CONTENT_MISMATCH` "File content does not match its type" / "Kandungan fail tidak sepadan dengan jenisnya"; 0 row; object tmp (B) bị xoá (HeadObject 404). | Blocker | I | [x] |
| **TC-F48-02-03** | `AC-3 US-F48-02`, `FR-04`, `SEC-4`, `D32` | `[Security]` | Rate limit 429 + Retry-After, cô lập tenant, người mua theo IP+order | 1. User A gửi register 61 lần/phút.<br>2. Song song tenant B gửi 10.<br>3. Người mua gửi proof 6 lần/đơn/giờ. | (1) request 61 → 429 `MEDIA_RATE_LIMITED`, header `Retry-After` > 0, thông báo i18n. (2) B 100% thành công. (3) lần 6 → 429; đơn khác cùng IP vẫn được tới ngưỡng 20/IP/giờ. | Critical | I | [x] |
| **TC-F48-02-04** | `AC-4 US-F48-02`, `FR-05`, `SEC-2` | `[Security]` | `/_next/image` không là proxy mở | 1. GET `/_next/image?url=https://example.org/a.jpg&w=640&q=75`.<br>2. URL host CDN PW2, host PW1, Pixabay, Wikimedia.<br>3. Kiểm `next.config.ts`. | (1) 400. (2) 200. (3) `formats` không có avif; `dangerouslyAllowSVG` false; `minimumCacheTTL` = 86400 (1 ngày, D62). | Critical | I+E | [x] |
| **TC-F48-02-05** | `AC-5 US-F48-02`, `FR-06`, `SEC-7` | `[Security]` | Header bảo mật trên file media | HEAD object S3 mới + handler local + `/api/media/private/[id]` (ảnh, video, pdf). | `X-Content-Type-Options: nosniff`; Content-Type đúng; `Content-Disposition: inline` cho ảnh/video, `attachment` cho loại khác; `Cache-Control` theo FR-06. | Critical | I | [x] |
| **TC-F48-02-06** | `AC-6 US-F48-02`, `FR-07`, `SEC-10` | `[Security]` | Presign hết hạn (ảnh 60s, video 600s — D35), min 1 byte, key regex | 1. Presign ảnh, chờ 61s, POST; presign video, POST ở 590s và 601s.<br>2. POST file 0 byte.<br>3. Register key `u{id}-x` (mẫu cũ) / key tmp của user khác. | (1) S3 403 hết hạn → client hiện `MEDIA_UPLOAD_EXPIRED`; video 590s OK, 601s hết hạn. (2) S3 từ chối `content-length-range`, **hoặc** nếu DO vẫn nhận object rỗng thì register từ chối vì `ContentLength < 1` (D62), xoá tmp, 0 row. (3) register 400 `MEDIA_KEY_INVALID`; 0 row. | Critical | I | [x] |
| **TC-F48-02-07** | `AC-7 US-F48-02`, `FR-08`, `SEC-11` | `[Security]` | CI gate sharp + `npm audit` | 1. Nhánh thử hạ sharp xuống bản có advisory.<br>2. Chạy job CI. | Job đỏ, log nêu GHSA/CVE; bản 0.35.x mới nhất → xanh. | Critical | M | [ ] |
| **TC-F48-02-08** | `SEC-5`, `DoD US-F48-02` | `[Security]` | **Đỏ trước:** REST POST `/api/media` với PDF/video không kiểm magic; register video không kiểm magic | Trên code hiện tại: gửi `fake-video.mp4` (byte text) qua REST và qua register; gửi PDF ngoài luồng proof qua REST. | Trước sửa: được chấp nhận (ĐỎ). Sau sửa: 415 `MEDIA_CONTENT_MISMATCH`, 0 row. | Blocker | I | [x] |
| **TC-F48-02-09** | `FR-04`, `D32` | `[Edge]` | Ngưỡng rate limit đúng bảng D32 (BVA) | Unit cấu hình + integration bộ đếm: presign 60/120, register 60/120, import-url 10/30, bulk delete 10/20, proof 5/đơn/giờ + 20/IP/giờ, avatar/QR 10/user/giờ. Gửi đúng N và N+1. | N → thành công; N+1 → 429. Ngưỡng tenant áp dụng khi nhiều user cùng tenant. | Major | U+I | [x] |
| **TC-F48-02-10** | `SEC-2`, `FR-05` | `[Security]` | Lách allowlist image optimizer | `url=//example.org/a.jpg`, `url=https://<host-cho-phép>@example.org/a.jpg`, host cho phép nhưng redirect 302 ra ngoài, `url=http://<host-cho-phép>` (http). | Tất cả 400 hoặc không tải nội dung ngoài allowlist. | Critical | I | [x] |
| **TC-F48-02-11** | `Additional US-F48-02`, `NFR-06`, `NFR-07` | `[Positive]` | Thông báo lỗi upload đọc được ở 375px + screen reader | Upload svg ở 375px, locale ms. | Thông báo hiển thị đủ (không cắt), `role="alert"`, chuỗi ms. | Minor | E | [x] |
| **TC-F48-02-12** | `DoD US-F48-02` | `[Positive]` | Ảnh PW1 vẫn hiển thị sau khi thu hẹp remotePatterns | Staging: mở 1 site đã migrate PW1 (PDP, home, blog). | 0 ảnh vỡ; network không có 400 từ `/_next/image`. | Critical | M | [ ] |
| **TC-F48-02-13** | `SEC-6`, `FR-12` | `[Security]` | Key không chứa tên file gốc ở mọi đường | Upload `ho-chi-tiet-ten-that.jpg` qua picker, avatar, QR, proof. | Key dạng `pw2/t/{tenant}/t{tenant}-{hash32}-{uuid32}.webp` / `pw2/private/t/{tenant}/t{tenant}-{uuid32}.…` / avatar `pw2/u/{userId}/u{userId}-{uuid32}.webp` (D36, D56, D87; avatar UUID không hash); `prefix` = thư mục tương ứng, `_objectKey` NULL (D64); không chứa tên gốc. | Major | I | [x] |

---

### NHÓM 03 — US-F48-03: Vận hành key, listing, CDN (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-03-01** | `AC-1 US-F48-03`, `FR-09`, `SEC-9` | `[Security]` | Xoay key bị lộ | 1. Tạo key mới, cập nhật Vercel (staging, prod), redeploy.<br>2. Upload/đọc private/xoá trên staging + prod.<br>3. `aws s3 ls` với key cũ. | (2) OK. (3) `AccessDenied`. Bằng chứng: CLI output đã che key. | Blocker | M | [ ] |
| **TC-F48-03-02** | `AC-2 US-F48-03`, `FR-09` | `[Security]` | PW2 dùng key riêng, phạm vi tối thiểu | Kiểm Vercel env PW2 ≠ key PW1; ghi phạm vi DO hỗ trợ. | Key khác nhau; nếu DO không giới hạn theo prefix → rủi ro ghi PRD + 01-13/12-09 pass (guard code). | Critical | M | [ ] |
| **TC-F48-03-03** | `AC-3 US-F48-03` | `[Security]` | Bucket không cho liệt kê công khai | `curl https://<bucket>.sgp1.digitaloceanspaces.com/` và `?list-type=2` không chữ ký; GET 1 object public. | List → `AccessDenied`; object public → 200. | Critical | M | [ ] |
| **TC-F48-03-04** | `AC-4 US-F48-03`, `FR-06`, `D16` | `[Positive]` | CDN cookieless + Cache-Control immutable | Chỉ chạy khi đã bật CDN (D16, tuỳ chọn); chưa bật → ghi N/A. Upload media mới; xem URL row; `curl -I` URL CDN với cookie dashboard trên trình duyệt. | URL host CDN; `Cache-Control: public, max-age=31536000, immutable`; `nosniff`; request tới domain CDN không mang cookie. | Major | M | [ ] |
| **TC-F48-03-05** | `Additional US-F48-03` | `[Positive]` | Env manifest + không commit secret | `node scripts/check-env-vars.js`; grep `.env.*.example`; secret scan PR. | Biến mới có ở 2 file example; check pass; 0 secret. | Major | I | [x] |
| **TC-F48-03-06** | `Additional US-F48-03` | `[Positive]` | Media cũ (key không hash) giữ URL cũ sau bật CDN | So URL 20 media cũ trước/sau deploy. | URL không đổi, ảnh tải 200. | Major | M | [ ] |
| **TC-F48-03-07** | `DoD US-F48-03` | `[Edge]` | Runbook rollback key | Diễn tập trên staging: key mới sai quyền → áp runbook `docs/runbooks/` quay lại. | Khôi phục < 15 phút, không mất upload (client báo lỗi rõ trong lúc lỗi). | Minor | M | [ ] |

---

### NHÓM 04 — US-F48-04: Pipeline upload hợp nhất (36 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-04-01** | `AC-1 US-F48-04`, `FR-11`, `FR-12` | `[Positive]` | Upload PNG 8 MB 4000×3000 thành công | 1. Upload `large-4000x3000.png` qua `/media`.<br>2. Theo dõi network.<br>3. Kiểm MinIO + row. | Không request body > 4.5 MB tới function; object cuối `pw2/t/{A}/t{A}-{sha256[0..31]}-{uuid32}.webp` (`prefix`=`pw2/t/{A}`, `_objectKey` NULL, `filename`=`t{A}-…`, D56, D64), cạnh dài 2560, WebP; tmp bị xoá; row có `contentHash, width, height, filesize`, `createdVia=upload`. | Blocker | I+E | [x] |
| **TC-F48-04-02** | `AC-2 US-F48-04`, `SEC-3` | `[Security]` | Xoá EXIF/XMP/IPTC kể cả GPS | Upload `exif-gps-orient6.jpg`; tải object, đọc metadata bằng sharp/exiftool. | 0 EXIF/XMP/IPTC/GPS; ảnh đứng đúng chiều (orientation áp vào pixel). | Blocker | I | [x] |
| **TC-F48-04-03** | `AC-3 US-F48-04`, `FR-13`, `D7` | `[Positive]` | Dedupe trong tenant, không chéo tenant | 1. A upload `dup-a.jpg`, rồi `dup-a-copy.jpg` (cùng byte).<br>2. B upload cùng file. | (1) lần 2 trả id cũ, 0 object/row mới, `media_bytes_used` không đổi, UI "Ảnh này đã có trong thư viện"/"Imej ini sudah ada dalam pustaka". (2) B có row + object riêng, `filename` `t{B}-{hash32}-{uuid32}.webp` ≠ của A — không vi phạm `media_filename_idx` (unique toàn bảng, D56). | Critical | I | [x] |
| **TC-F48-04-04** | `AC-4 US-F48-04`, `FR-14` | `[Negative]` | Giới hạn per-file (BVA) | Ảnh 10 MB / 10 MB+1; video 100 MB / +1; PDF proof 5 MB / +1. Client rồi bỏ qua client gọi trực tiếp presign/register. | Client chặn trước với giới hạn từ `upload-limits.ts`; server 413 `MEDIA_TOO_LARGE`, tmp bị xoá. Đúng biên → chấp nhận. | Critical | U+I | [x] |
| **TC-F48-04-05** | `AC-5 US-F48-04`, `FR-11` | `[Negative]` | Ảnh > 50MP / hỏng → 422, không treo | `huge-60mp.png` (magic hợp lệ), `corrupt.jpg`. | 422 `MEDIA_TOO_MANY_PIXELS` (60MP) / `MEDIA_INVALID_FILE` (hỏng), chuỗi i18n, 0 row, tmp xoá, thời gian xử lý < 5s (không chạm timeout). | Blocker | I | [x] |
| **TC-F48-04-06** | `AC-6 US-F48-04` | `[Positive]` | Video MP4 không re-encode; mp4 giả bị chặn | `valid-60mb.mp4`, `fake-webm-as.mp4`. | MP4: object `pw2/t/{A}/t{A}-{hash32}-{uuid32}.mp4`, sha256 object == sha256 file gốc. Giả: 415 `MEDIA_CONTENT_MISMATCH`. | Critical | I | [x] |
| **TC-F48-04-07** | `AC-7 US-F48-04` | `[Edge]` | Mất mạng khi upload 3 file | Playwright: 3 file, offline khi file 2 ~60%, online, bấm "Thử lại". | File 1 giữ; file 2 lỗi + nút thử lại → xong; file 3 tiếp tục; không row cho file dở. | Critical | E | [x] |
| **TC-F48-04-08** | `AC-8 US-F48-04`, `SEC-10` | `[Security]` | Không register được key tmp của người khác | User A gọi register với `uploadToken` cấp cho user B. | 400 `MEDIA_KEY_INVALID`, 0 row; object tmp của B còn nguyên, không bị đọc (MinIO audit không có GetObject từ request A). | Blocker | I | [x] |
| **TC-F48-04-09** | `SEC-5`, `D5` | `[Security]` | Polyglot bị khử khi re-encode | `polyglot-jpeg-html.jpg` (JPEG hợp lệ + payload nối đuôi). | Upload OK; object cuối là WebP sạch, không còn chuỗi payload (grep byte). | Critical | I | [x] |
| **TC-F48-04-10** | `FR-13`, `D7` | `[Edge]` | 2 register cùng hash cùng tenant đồng thời | `Promise.all` 2 register cùng nội dung (2 key tmp); chạy cả qua PgBouncer transaction mode. | Đúng 1 row (unique partial `(tenant_id, content_hash) WHERE private = false`; `pg_advisory_xact_lock` theo tenant+hash — M5), cả 2 response trả cùng id, quota tăng 1 lần, 2 tmp bị xoá, không 500, không lock rò sau transaction. | Critical | I | [x] |
| **TC-F48-04-11** | `D7`, `D17`, `D24` | `[Security]` | Biên lai private trùng hash ảnh thư viện không dedupe chéo | A có ảnh public X; người mua upload biên lai cùng byte. | Biên lai tạo row private riêng dưới `pw2/private/…` với `content_hash` NULL (D57); không trả id X; X không thành private; biên lai không xuất hiện trong thư viện. | Critical | I | [x] |
| **TC-F48-04-12** | `FR-11` | `[Edge]` | Register replay (double-click/retry) | Gọi register 2 lần cùng key tmp (song song và cách nhau > 90 s). | 1 row; lần 2 trả row cũ (`done:{id}` TTL 900 s) hoặc 409 `MEDIA_REGISTER_IN_PROGRESS` (`pending` TTL 90 s — D62) / 409 `MEDIA_KEY_INVALID` (key đã đăng ký) — không 500, không row thứ 2. | Major | I | [x] |
| **TC-F48-04-13** | `FR-11`, `D39`, `D87`, `INV-5` | `[Edge]` | SQL exception thật sau Put và mất connection | Arrange: Postgres + MinIO; folder F có thật, allocation intent/Put key K mới thành công. Act: connection thứ hai xoá F trước INSERT để gây FK 23503; đối chứng UPDATE quota 0 dòng; kill connection sau Put hoặc khi COMMIT chưa biết kết quả; thêm GetObject tmp lỗi. | Assert: SQL exception phải ROLLBACK TO SAVEPOINT trước SELECT, không 25P02; quota 0 dòng → 413 không aborted tx; rollback không row/quota tăng. Intent giữ bền vững; cleanup lấy lại lock + SELECT primary exact key, chỉ xoá K không row, không xoá dedupe key. COMMIT đã thành công dù client mất kết nối ⇒ giữ row/object/quota; chưa commit ⇒ dọn K; không DeleteObject mù. Tmp được xoá best-effort nếu còn budget, timeout do lifecycle dọn. | Critical | I | [x] |
| **TC-F48-04-14** | `FR-11` | `[Edge]` | Ảnh đặc biệt: alpha, CMYK, 16-bit, 1×1, orientation 3/6/8 | Fixture tương ứng. | Alpha giữ; CMYK → sRGB đúng màu (ΔE nhỏ); 16-bit OK; 1×1 OK; mọi orientation hiển thị đúng. | Major | U | [x] |
| **TC-F48-04-15** | `FR-03`, `FR-11`, `D37`, `AC-3 US-F48-06` | `[Edge]` | ICO favicon qua pipeline | Upload `favicon.ico` ở FaviconEditor; PNG/JPEG/WebP cho favicon; ICO với `purpose=library`; ICO 512×512. | ICO ≤ 256×256 giữ nguyên (passthrough, kiểm magic); PNG/JPEG/WebP favicon → PNG; ICO ở purpose khác hoặc > 256×256 → 415 `MEDIA_UNSUPPORTED_TYPE`. | Major | I | [x] |
| **TC-F48-04-16** | `FR-11`, `D38` | `[Edge]` | WebP/PNG động (APNG) | `animated.webp`, `animated.png`. | Lưu khung đầu (ảnh tĩnh); UI hiện cảnh báo `animated_flattened` trước khi xử lý; không lỗi 500. | Minor | U | [x] |
| **TC-F48-04-17** | `Additional US-F48-04`, `FR-10a` | `[Positive]` | `createdVia` cho ảnh nội bộ | Tạo site AI (ai), chọn ảnh stock (stock), seed (seed), placeholder (system). | `createdVia` đúng từng nguồn. | Major | I | [x] |
| **TC-F48-04-18** | `NFR-01` | `[Perf]` | register ảnh 5 MB p95 < 3s | Staging Vercel: 50 lần register ảnh JPEG 5 MB (3 file khác nhau), 5 song song; đo server-timing từ nhận request tới response. | p95 < 3.000 ms, p99 ghi lại; 0 timeout. Số ghi vào PR. | Critical | P | [ ] |
| **TC-F48-04-19** | `NFR-04` | `[Perf]` | Giảm ≥ 50% byte ảnh mới | Bộ benchmark 30 PNG + 20 JPEG local (TB ~600 KB); so tổng byte trước (đường hiện tại) / sau (pipeline). | Tổng sau ≤ 50% tổng trước; báo cáo bảng từng file. | Major | P | [x] |
| **TC-F48-04-20** | `FR-07`, `FR-10` | `[Edge]` | Presign hết hạn khi upload chậm 3G | Slow 3G, ảnh 9 MB không nén được nhiều, upload > 60s. | Client tự xin presign mới hoặc báo `MEDIA_UPLOAD_EXPIRED` + "Thử lại"; không treo vô hạn, không row rác. | Major | E | [x] |
| **TC-F48-04-21** | `FR-12`, `FR-16` | `[Edge]` | Tên file gốc lạ: `../../a.jpg`, emoji, BM có dấu, 255 ký tự | Upload các file. | Key theo hash; `displayName` mặc định được làm sạch (không `/`, cắt ≤ 120); hiển thị đúng unicode. | Major | I | [x] |
| **TC-F48-04-22** | `FR-10a`, `FR-14a`, `D59` | `[Positive]` | Mọi caller `ingestMediaBuffer` set `created_via` | Unit/static: duyệt bảng caller PRD S1 §7.1 — mỗi file gọi `ingestMediaBuffer` truyền `createdVia` (grep + type bắt buộc); integration: chạy từng caller (AI, stock, seed, QR, placeholder, SSO avatar, avatar, proof). Không còn `payload.create({ collection: 'media', file })` ngoài fallback local-dev. | 100% caller có `created_via` đúng bảng; row PW1 delta-writer không upload; proof `private=true`, `content_hash` NULL. | Critical | U+I | [x] |
| **TC-F48-04-23** | `NFR-08`, `FR-10a`, `D59` | `[Perf]` | Generate site không chậm > 10% | Staging: 20 lần generate site (cùng template/prompt) trước (baseline có mutex) và sau F48; đo p95. Cùng PR: cập nhật TC-GENPERF-W2-07 (`docs/qa/F01-gen-perf.md`) thay assert mutex. | p95 sau ≤ 1,10 × baseline; 0 lỗi race (GH-1185); TC-GENPERF-W2-07 bản mới pass trước khi xoá `media-create-lock.ts`. | Critical | P | [ ] |
| **TC-F48-04-24** | `FR-12`, `M8` | `[Edge]` | Flag pipeline tắt giữ hợp đồng cũ | `MEDIA_PIPELINE_V2_ENABLED` thiếu/`false`: presign + register + upload từ `/media`; bật lại `true`. | Flag off: presign trả `pipeline: 'v1'`, key/hợp đồng cũ, client tự đi nhánh cũ, upload thành công; flag on: `pipeline: 'v2'`, `uploadToken`. Không cần build lại client. | Critical | I+E | [x] |
| **TC-F48-04-25** | `D57`, `D24`, `FR-13` | `[Security]` | 2 biên lai giống hệt ở 2 đơn → 2 row | Người mua upload cùng file `proof-4mb.pdf` (và 1 ảnh JPEG) cho `ORD-F48-1` và `ORD-F48-2`. | 2 row private riêng, 2 object `pw2/private/t/{A}/t{A}-{uuid32}.…` khác nhau, `content_hash` NULL; không lỗi unique `media_filename_idx`; mỗi đơn trỏ đúng biên lai của mình. | Critical | I | [x] |
| **TC-F48-04-26** | `D57`, `D7` | `[Security]` | QR merchant trùng ảnh biên lai không lẫn | Owner A upload ảnh QR (purpose `payment-qr`) X; người mua upload biên lai là đúng ảnh X (cùng byte gốc); và ngược lại (biên lai trước, QR sau). | QR là row public `created_via=upload`; biên lai là row private riêng; không trả id chéo; QR không thành private, biên lai không vào thư viện/picker; xoá một bên không ảnh hưởng bên kia. | Critical | I | [x] |
| **TC-F48-04-27** | `M4`, `FR-13` | `[Edge]` | Dedupe trúng media AI/stock/seed khi merchant upload | Tenant A có row `created_via=ai`, `unused_since` = now−20d; owner upload cùng ảnh. | Trả row cũ (`deduped:true`); row thành `created_via='upload'`, `unused_since = NULL`; GC sau 30 ngày không chọn row này. | Major | I | [x] |
| **TC-F48-04-28** | `M7`, `FR-10` | `[Edge]` | Client nén giữ đúng `blob.type`; `accept` tường minh | Unit `compress-image`: PNG/JPEG → WebP, kiểm `file.type` kết quả; DOM: input của `MediaUploadButton`; E2E Safari iOS chọn ảnh HEIC. | `file.type` = `image/webp` khi đã nén (không giữ type gốc); `accept` liệt kê MIME cụ thể (không `image/*`); iOS gửi JPEG → upload thành công. | Major | U+E | [x] |
| **TC-F48-04-29** | `FR-12`, `D64`, `D56` | `[Positive]` | URL đọc lại trỏ đúng key đã `PutObject` (không lặp prefix) | 1. Owner A upload `dup-a.jpg` (public) qua register; avatar user U; người mua upload biên lai (private).<br>2. Ghi lại key `PutObject` từ log MinIO.<br>3. Đọc row (`prefix`, `_objectKey`, `filename`), DTO `url`, `GET` URL công khai / `GET /api/media/private/[id]` (biên lai, quyền owner). | Row: `prefix`=`pw2/t/{A}` (avatar `pw2/u/{U}`, biên lai `pw2/private/t/{A}`), `_objectKey` NULL; join phần khác rỗng `[prefix, _objectKey, filename]` == key `PutObject`; `url` kết thúc bằng đúng key đó, **không** chứa `pw2/t/{A}/pw2/t/{A}/`; GET trả 200 đúng byte (sha256 khớp object). | Blocker | I | [x] |
| **TC-F48-04-30** | `FR-12`, `D64`, `INV-2`, `FR-01` | `[Security]` | Xoá row v2 xoá đúng key đã `PutObject` | 1. Owner A upload ảnh X (public, row v2) và biên lai P (private).<br>2. Xoá X qua route `DELETE /api/media/library/[id]` (Local API) và X' qua force (SQL); super-admin xoá P.<br>3. MinIO ghi lại mọi `DeleteObject`; kèm canary `pw2/t/{A}/pw2/t/{A}/t{A}-<hash>-<uuid32>.webp` (key lặp prefix giả lập). | Mỗi lần xoá đúng **1** `DeleteObject` với key == key `PutObject` của row (HeadObject 404 sau xoá); không `DeleteObject` key lặp prefix; canary còn nguyên; row đã xoá. | Blocker | I | [x] |
| **TC-F48-04-31** | `D71`, `FR-13`, `D56` | `[Edge]` | Row tenant NULL (avatar, SSO) không dedupe, không 500 | 1. User U upload cùng ảnh avatar 2 lần qua `/api/users/me/avatar`.<br>2. Chạy SSO sync avatar 2 lần liên tiếp cùng ảnh nguồn.<br>3. Tạo 2 media global (tenant NULL) cùng byte qua Local API hệ thống. | Mỗi lần → 1 row mới, `filename` dạng `u{U}-{uuid32}.webp` (avatar) / uuid32 (global) khác nhau, `content_hash` không dùng để dedupe; 0 lỗi unique `media_filename_idx` (23505) / 0 response 500; avatar user trỏ row mới nhất. | Critical | I | [x] |
| **TC-F48-04-32** | `D72`, `FR-10a`, `FR-13`, `D39` | `[Edge]` | Caller không xoá bù row dùng chung khi `deduped = true` | Tenant A có media X (public). Caller QR (`payment-qr`) gọi `ingestMediaBuffer` với đúng byte X → nhận `{ media: X, deduped: true }`; tiêm lỗi ở bước sau (lưu cấu hình thanh toán throw). Lặp với ảnh mới (`deduped: false`) + cùng lỗi. | `deduped: true`: row X + object X còn nguyên (ETag không đổi), nơi đang dùng X không vỡ, quota không đổi. `deduped: false`: caller xoá bù đúng row/object vừa tạo, quota trả về như trước. Unit: kiểu trả về có `deduped` bắt buộc. | Critical | I | [x] |
| **TC-F48-04-33** | `D83`, `FR-11`, `SEC-5` | `[Security]` | Video: tráo object tmp giữa kiểm magic/hash và CopyObject bị chặn bằng ETag | 1. Presign video, POST `valid-60mb.mp4` lên `pw2/tmp/{uuid}`.<br>2. Gọi register; hook test chặn sau `HeadObject` (bước 3) rồi POST lại cùng presign với `fake-webm-as.mp4` / file HTML (ETag đổi).<br>3. Lặp: tráo sau bước hash, trước `CopyObject`.<br>4. Đối chứng: không tráo. | (2)(3) **409 `MEDIA_KEY_INVALID`**; MinIO ghi `GetObject`/`CopyObject` có `If-Match`/`x-amz-copy-source-if-match` = ETag bước 3 và nhận 412; 0 row, 0 object `pw2/t/…`, tmp bị xoá. (4) Video đăng ký bình thường, sha256 object cuối == file gốc. | Critical | I | [x] |

| **TC-F48-04-34** | `FR-12`, `FR-13`, `D87`, `AC-3 US-F48-04` | `[Edge]` | Dedupe DB, key phiên bản không reuse | Arrange: fixture thật + tenant A/B; ghi lại Put/Copy/Head MinIO. Act: upload A cùng bytes hai lần, ingest cùng bytes; xoá row A bằng flow hợp lệ rồi upload lại; thử lần tạo mới khác tenant và MIME. | Assert: hit trả nguyên id/key cũ, chỉ Head không Put/Copy/allocation mới, quota +0. Sau xoá tạo id mới/key hash32-uuid32 khác, SHA đầy đủ bằng nhau nhưng key khác; B có row/key riêng. Retry lần Put timeout phải cấp UUID mới, không overwrite key đã cấp. Giữ prefix pw2/t/, _objectKey NULL, guard/URL đọc đúng key version. | Critical | I | [x] |
| **TC-F48-04-35** | `FR-10a`, `FR-13`, `D87` | `[Edge]` | Dedupe missing object không repair/hồi sinh key | Arrange: row X có full hash, quota/refs; xoá object bằng fault fixture. Act: register/ingest cùng bytes; Head trả 503 ở đối chứng; gỡ refs rồi xoá stale row bằng flow có quyền và upload request mới. | Assert: Head 404 → 404 MEDIA_UPLOAD_MISSING có i18n/hướng dẫn; 503 → 5xx, không coi là miss. Không Put/Copy key X, không tự xoá row/refs, không quota tăng; sau xoá stale hợp lệ nhận row/key UUID mới. Ref orders/QR/private vẫn được bảo vệ, thiếu quyền không tự gỡ. | Critical | I | [x] |
| **TC-F48-04-36** | `FR-11`, `D87`, `AC-3 US-F48-04` | `[Edge]` | Replay done đọc primary, không hồi sinh row đã xoá | Arrange: upload X thành công, done cache còn/tmp đã xoá, bật read replica trễ. Act: replay X còn sống; rồi xoá X, upload mới cùng bytes thành Y và replay done:X; nhánh khác row X còn nhưng object mất, delete race ngay sau đọc cache. | Assert: X sống + Head OK → cùng id/key, không row/object/quota mới. X đã xoá hoặc object mất → 404 MEDIA_UPLOAD_MISSING; không trả Y, không INSERT/repair key X. Hash/key lock + re-read primary tránh dùng snapshot cache/replica; delete sau success là thao tác riêng hợp lệ. | Critical | I | [x] |

---

### NHÓM 05 — US-F48-05: Thư viện /media (18 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-05-01** | `AC-1 US-F48-05`, `FR-15` | `[Positive]` | Phân trang cursor, xem đủ 350 | Tenant seed 350 media; mở `/media`; tải thêm tới hết. | Trang đầu 50 (mới nhất); 7 trang; tổng 350, không trùng/thiếu; không còn cap 200. | Blocker | I+E | [x] |
| **TC-F48-05-02** | `AC-2 US-F48-05`, `FR-15` | `[Positive]` | Tìm "kuih" + lọc Ảnh + sắp xếp dung lượng | Thao tác UI; kiểm query server. | Lọc trên server theo displayName/alt/tên gốc, chỉ ảnh, sắp xếp giảm dần; rỗng → key có sẵn `mediaLibrary.noMatch` "No files match your search"/"Tiada fail sepadan dengan carian anda" + nút "Clear filters" (`mediaLibrary.clearFilters`). | Critical | I+E | [x] |
| **TC-F48-05-03** | `AC-3 US-F48-05`, `FR-16`, `D32` | `[Positive]` | Chi tiết + sửa metadata (BVA) | Mở chi tiết; sửa alt 250/251, caption 500/501, displayName 120/121. | Panel có preview, px, dung lượng, ngày, nguồn, nút sao chép URL; đúng biên → lưu, lưới cập nhật; vượt → lỗi inline, không gọi API. | Critical | I+E | [x] |
| **TC-F48-05-04** | `AC-4 US-F48-05`, `FR-17` | `[Positive]` | Chọn 30 + xoá nhiều; 101 bị chặn | Chọn 30 (3 đang dùng) bằng checkbox + Shift+click → Xoá; chọn 101. | Flag `MEDIA_BULK_DELETE_ENABLED` bật (D34): 1 request `POST /api/media/library/bulk-delete`; "Đã xoá 27, giữ lại 3" + lý do (`kept[].reason = in_use`); lưới cập nhật không reload. 101 → nút vô hiệu "Tối đa 100 file mỗi lần"; API với 101 id → 400 `MEDIA_BULK_LIMIT`. Flag tắt → không có nút, route 404 `MEDIA_NOT_FOUND`. | Critical | I+E | [x] |
| **TC-F48-05-05** | `AC-5 US-F48-05`, `FR-18` | `[Positive]` | Kéo thả 5 file, 1 svg | Kéo 4 ảnh hợp lệ + `logo.svg`. | 4 file có tiến trình riêng → xong; svg lỗi riêng; không chặn file khác. | Critical | E | [x] |
| **TC-F48-05-06** | `AC-6 US-F48-05`, `INV-3` | `[Security]` | Tenant isolation list/search/metadata; private không hiện | Gọi list với `tenant=B`, `where[tenant][equals]=B`; GET metadata id của B; kiểm biên lai. | Chỉ media A; id B → 404; biên lai không có trong list/search. | Blocker | I | [x] |
| **TC-F48-05-07** | `AC-7 US-F48-05`, `NFR-06` | `[Positive]` | i18n ms toàn trang | Locale ms: `/media`, chi tiết, xác nhận xoá, lỗi upload. Script so khoá `en` vs `ms`. | 100% chuỗi BM; 0 khoá thiếu; 0 chuỗi Anh/Việt cứng (scan DOM). | Major | U+E | [x] |
| **TC-F48-05-08** | `NFR-02` | `[Perf]` | List 50 item p95 < 500 ms | Tenant 5.000 media; 200 request list (lọc/tìm/sắp xếp lẫn) trên staging; `EXPLAIN ANALYZE` query chính. | p95 < 500 ms; dùng index (tenant, created_at) — không Seq Scan trên `media`. | Critical | P | [ ] |
| **TC-F48-05-09** | `NFR-07`, `Additional US-F48-05` | `[A11y]` | axe + bàn phím lưới thư viện | axe trên `/media` (en, ms); phím mũi tên, Space, Enter, Tab. | 0 vi phạm serious/critical; mũi tên di chuyển, Space chọn (`aria-selected`), Enter mở chi tiết, focus thấy rõ, mỗi ô có `aria-label`; tương phản ≥ 4.5:1. | Major | E | [x] |
| **TC-F48-05-10** | `Additional US-F48-05` | `[Positive]` | 375px: 3 cột, Sheet chi tiết full-screen, nhấn giữ để chọn | Playwright mobile (design S1/S2). | Lưới 3 cột, ô ≥ 104 px; chạm thẻ mở chi tiết dạng Sheet full-screen (header ← Back); nhấn giữ 500 ms hoặc "Select" trong menu `⋯` bật chọn nhiều; bulk bar cố định đáy (safe-area); không cuộn ngang. | Major | E | [x] |
| **TC-F48-05-11** | `FR-15` | `[Edge]` | Cursor ổn định khi có upload mới giữa các trang | Tải trang 1; tạo 5 media mới; tải trang 2. | Trang 2 không trùng/thiếu item cũ (cursor theo `(created_at,id)`). | Major | I | [x] |
| **TC-F48-05-12** | `FR-15`, `D62` | `[Edge]` | Tìm không phân biệt hoa thường; ký tự đặc biệt | Tìm `KUIH`, `kuih`, `%`, `_`, `'`, `\`. | `ILIKE` khớp "kuih-raya-2026.jpg" không phân biệt hoa thường (không dùng `unaccent` — D62, `kuíh` không bắt buộc khớp); `%`/`_` hiểu theo nghĩa đen; không lỗi 500/SQL. | Major | I | [x] |
| **TC-F48-05-13** | `NFR-07`, `FR-16` | `[Security]` | XSS qua alt/caption/displayName | Đặt displayName/alt là chuỗi HTML/script; xem lưới, chi tiết, picker, storefront (alt). | Hiển thị dạng text; không thực thi script; alt storefront được escape. | Critical | E | [x] |
| **TC-F48-05-14** | `D21` | `[Edge]` | Row PW1 legacy trong thư viện | Seed row legacy (`filename` null, URL host PW1). | Hiện badge "Legacy"; preview tải từ host PW1; xoá → chỉ row (đối chiếu 01-03). | Major | E | [x] |
| **TC-F48-05-15** | `FR-17`, `D87` | `[Edge]` | Bulk delete lỗi S3/intent một phần | Postgres + MinIO: 10 item hợp lệ; tiêm DeleteObject 503 cho 1 item; lần khác tiêm lỗi ghi intent trước COMMIT. | S3 503: 10 row xoá, quota giảm 10 item; id lỗi nằm cả deleted và cleanupPending, intent retry dọn object sau, không trừ quota lần hai. Lỗi intent: item đó còn row/quota, kept reason delete_failed; không DeleteObject. Các item khác tiếp tục; guard/quyền không đổi. | Major | I | [x] |
| **TC-F48-05-16** | `D32` | `[Edge]` | Đếm độ dài theo ký tự unicode | alt = 250 emoji/ký tự BM có dấu; 251. | 250 → lưu (client + server cùng cách đếm); 251 → lỗi. | Minor | U | [x] |
| **TC-F48-05-17** | `INV-3` | `[Edge]` | User thuộc 2 tenant đổi workspace | Đổi active workspace A → B; mở `/media`. | Lưới và cache theo B; không hiện item A; thao tác xoá áp vào B. | Major | E | [x] |
| **TC-F48-05-18** | `FR-04a`, `FR-16`, `FR-17`, `D43` | `[Security]` | CSRF trên route media đổi trạng thái | Từ origin khác gửi POST/PATCH/DELETE (presign, register, metadata, bulk-delete, folders, move) kèm cookie phiên; thiếu `Origin` + `Sec-Fetch-Site: cross-site`. | 403 `MEDIA_FORBIDDEN`, dữ liệu không đổi; request same-origin vẫn OK. | Critical | I | [x] |

---

### NHÓM 06 — US-F48-06: MediaPicker (11 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-06-01** | `AC-1 US-F48-06`, `FR-19` | `[Positive]` | Chọn 1 ảnh từ thư viện | Blog cover → picker → Thư viện → chọn → "Chọn". | Field nhận `{mediaId,url}`; 0 request presign/register; tab dùng API của US-F48-05. | Blocker | E | [x] |
| **TC-F48-06-02** | `AC-2 US-F48-06` | `[Positive]` | Đa chọn tối đa N, giữ thứ tự | Picker max 3; chọn ảnh 5, 2, 9. | Ô còn lại vô hiệu, "Đã chọn 3/3"; trả về [5,2,9]. | Critical | U+E | [x] |
| **TC-F48-06-03** | `AC-3 US-F48-06` | `[Positive]` | Lọc theo accept (ảnh/video/favicon) | Mở từ logo, video block, favicon. | Thư viện + Upload chỉ loại phù hợp; favicon nhận PNG/JPEG/WebP (→ PNG) và ICO ≤ 256×256 (D37); loại không hợp → `MEDIA_PICKER_TYPE`. | Critical | U+E | [x] |
| **TC-F48-06-04** | `AC-4 US-F48-06`, `AC-3 US-F48-04`, `FR-33` | `[Positive]` | Upload trong picker, trùng hash, vượt quota | Tab Upload: ảnh mới; ảnh trùng; tenant đầy quota. | Ảnh mới tự chọn; trùng → chọn media có sẵn + "Đã dùng ảnh có trong thư viện"; quota → 413 `MEDIA_QUOTA_EXCEEDED` + liên kết dung lượng, picker không đóng. | Critical | E | [x] |
| **TC-F48-06-05** | `AC-5 US-F48-06`, `D14`, `D26` | `[Security]` | Staff không `media` dùng picker; không có quyền màn hình → 403 | Staff `products` only: mở picker ở SP, chọn/upload; sửa alt media của mình và của owner tại popover "Edit alt text" của gallery SP và field alt `MediaFieldControl` (blog cover); gọi API metadata trực tiếp cho media của owner; staff `orders` only gọi API picker. | Chọn/upload OK; không nút xoá, không link "Manage library"; sửa alt của mình OK; media của người khác: field/menu alt disabled + tooltip `mediaLibrary.forbiddenEditOther`, API → 403 `MEDIA_FORBIDDEN`; staff `orders` → 403 `MEDIA_FORBIDDEN`. | Blocker | I+E | [x] |
| **TC-F48-06-06** | `AC-6 US-F48-06`, `NFR-07` | `[A11y]` | Bàn phím + mobile | Tab/Shift+Tab, mũi tên, Space, Enter, Esc; viewport 375px. | Focus trap; đóng trả focus về nút mở; `aria-label` mỗi ảnh; 375px: bottom sheet 92dvh có tay nắm, tabs full-width, lưới 3 cột, footer cố định (safe-area) với "Select (n)" luôn thấy kể cả khi bàn phím ảo mở (design S3). | Critical | E | [x] |
| **TC-F48-06-07** | `NFR-07`, `DoD US-F48-06` | `[A11y]` | axe dialog + aria-live | axe trên picker (3 tab, en/ms); upload xong. | 0 serious/critical; `aria-selected` đúng; `aria-live` báo "upload xong"; tương phản trạng thái chọn ≥ 3:1 (non-text). | Major | E | [x] |
| **TC-F48-06-08** | `Additional US-F48-06` | `[Edge]` | Tab URL ẩn khi US-F48-08 chưa bật | Tắt feature flag/không deploy route import. | Không có tab URL; không tab hỏng. | Minor | U | [x] |
| **TC-F48-06-09** | `Additional US-F48-06` | `[Perf]` | Lưới picker tải thumbnail | Mở picker 50 ảnh, xem network. | Ảnh qua `/_next/image` với `w` ≤ 384; không tải ảnh gốc; lazy-load ngoài viewport. | Minor | E | [x] |
| **TC-F48-06-10** | `FR-19` | `[Edge]` | Trạng thái rỗng + lỗi tải thư viện | Tenant 0 media; tiêm 500 cho API list. | Rỗng: gợi ý upload; lỗi: thông báo + "Thử lại", không treo spinner. | Major | E | [x] |
| **TC-F48-06-11** | `FR-19b`, `D40` | `[Edge]` | Đóng picker khi đang upload | Bắt đầu upload rồi Esc. | Upload tiếp tục vào thư viện + toast `upload_continues`; không gán vào field; không lỗi console, không gán nhầm. | Major | E | [x] |

---

### NHÓM 07 — US-F48-07: Gắn picker vào 18 điểm upload (12 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-07-01** | `AC-1 US-F48-07`, `FR-20` | `[Positive]` | Ảnh SP chọn từ thư viện | SP → thêm ảnh → chọn "baju-kurung-merah.webp" → lưu; mở storefront. | `Products.images[]` FK tới media có sẵn; số row media không đổi; PDP hiện ảnh. | Blocker | I+E | [x] |
| **TC-F48-07-02** | `AC-2 US-F48-07`, `FR-21`, `D3` | `[Positive]` | Block mới lưu `{mediaId,url}`, block cũ vẫn chạy | Gallery/hero/client-logos/before-after/content-cards: chọn ảnh, lưu; mở page seed block cũ (URL string); sửa 1 ảnh của block cũ. | Block mới: JSON `{mediaId,url}`. Block cũ render + mở editor bình thường, dữ liệu không bị đổi khi chỉ mở; ảnh vừa sửa lưu dạng mới. | Blocker | I+E | [x] |
| **TC-F48-07-03** | `AC-3 US-F48-07`, `FR-14`, `NFR-06` | `[Positive]` | 1 bộ giới hạn, 1 ngôn ngữ | Ở từng điểm: file 11 MB + svg; locale ms. Unit: grep hằng số MB ngoài `upload-limits.ts`. | Thông báo + giới hạn giống nhau, chuỗi BM (BlockImageEditor, toast ImageUploader, confirm người mua, studio); grep 0 kết quả. | Critical | U+E | [x] |
| **TC-F48-07-04** | `AC-4 US-F48-07`, `D17`, `D24` | `[Positive]` | Biên lai người mua: private + validator chung | Storefront confirm: PDF 4 MB, JPEG; PDF 5 MB+1; `fake-pdf.jpg`; 6 lần/đơn/giờ; locale ms. | Lưu `pw2/private/t/{A}/…`, đọc qua `/api/media/private/[id]`; trường hợp xấu bị chặn với chuỗi ms; biên lai không trong picker/thư viện. | Blocker | I+E | [x] |
| **TC-F48-07-05** | `AC-5 US-F48-07`, `INV-3` | `[Security]` | mediaId tenant khác khi lưu SP/trang/site | A lưu SP/page/site với mediaId của B (FK + block `{mediaId}` + ogImage). | 400 `MEDIA_INVALID_REFERENCE` "Invalid media reference"; dữ liệu không đổi. | Blocker | I | [x] |
| **TC-F48-07-06** | `AC-6 US-F48-07` | `[Positive]` | Logo/Favicon/OG/footer logo cùng component; gỡ chỉ gỡ tham chiếu | Đổi + gỡ từng loại. | Cùng component/hành vi (xem trước, thay, gỡ, alt); gỡ → media vẫn còn trong thư viện. | Critical | E | [x] |
| **TC-F48-07-07** | `AC-7 US-F48-07` | `[Positive]` | Đổi ảnh từ ImageToolbar trong iframe | Click ảnh trong preview → "Đổi ảnh". | Picker mở ở cửa sổ cha; chọn xong preview cập nhật không reload. | Critical | E | [x] |
| **TC-F48-07-08** | `FR-20`, `DoD US-F48-07` | `[Positive]` | Smoke 18 điểm upload | Playwright tham số hoá 18 điểm (bảng US-F48-07): mở → upload/chọn → lưu → reload → kiểm. | 18/18 pass; điểm 14–18 dùng route riêng nhưng validator chung (gửi `fake-html.jpg` → 415). | Critical | E | [x] |
| **TC-F48-07-09** | `DoD US-F48-07`, `FR-10` | `[Edge]` | Không còn import đường A/C ở UI | Test tĩnh quét `src/components/**`, `src/app/**` tìm import `/api/media/upload` / `uploadMediaAction`. | 0 kết quả ngoài fallback nội bộ được PRD cho phép. | Minor | U | [x] |
| **TC-F48-07-10** | `FR-21`, `FR-29` | `[Edge]` | Block `{mediaId,url}` khi media bị "Vẫn xoá" | Owner force-delete media đang trong block gallery; mở storefront + editor. | Storefront không crash (ảnh vỡ hiển thị fallback/alt); editor báo "Ảnh không còn" và cho thay. | Major | E | [x] |
| **TC-F48-07-11** | `D30`, `Market Notes US-F48-07` | `[Negative]` | Halal cert chỉ nhận ảnh | Chọn PDF cho halalCertImage qua picker + API. | Picker không cho PDF/video; API 400 `HALAL_CERT_IMAGE_ONLY`. | Major | I | [x] |
| **TC-F48-07-12** | `D73`, `D80`, `FR-20`, `INV-3`, `D17` | `[Security]` | QR thanh toán chọn từ thư viện (vùng payment) | 1. `ownerA` ở Payments chọn QR là ảnh có sẵn trong thư viện A (alt bất kỳ, không `qr-{tenantId}`) → lưu.<br>2. Upload QR trùng byte ảnh có sẵn (dedupe).<br>3. Gửi API lưu QR với mediaId tenant B.<br>4. Gửi mediaId biên lai private của A.<br>5. Gửi mediaId video của A. | (1)(2) lưu thành công, QR hiển thị ở checkout. (3) 404 `MEDIA_NOT_FOUND` (không lộ tồn tại); (4)(5) 400 `MEDIA_UNSUPPORTED_TYPE` (D80); cấu hình thanh toán không đổi. Server kiểm `tenant === tenantId && !private && image/*` (không còn so `alt`). | Blocker | I+E | [x] |

---

### NHÓM 08 — US-F48-08: Import ảnh từ URL (8 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-08-01** | `AC-1 US-F48-08`, `FR-22`, `D18` | `[Positive]` | Import JPEG 3 MB | Server test HTTPS nội bộ phục vụ `exif-gps.jpg`; dán URL, "Nhập". | Đi qua pipeline (WebP, strip EXIF, hash); `createdVia=import-url`; `sourceUrl` lưu nội bộ (không lộ public, xem 01-05); tự chọn. | Critical | I+E | [x] |
| **TC-F48-08-02** | `AC-2 US-F48-08` | `[Negative]` | URL không hợp lệ | `http://`, `file:`, `data:`, `ftp:`; đích trả HTML/PDF; > 10 MB; chậm > 10s. | Lỗi cụ thể theo locale: `MEDIA_URL_INVALID` (scheme), `MEDIA_UNSUPPORTED_TYPE` (HTML/PDF), `MEDIA_TOO_LARGE` (> 10 MB), `MEDIA_URL_TIMEOUT` (> 10s), `MEDIA_URL_FETCH_FAILED` (tải lỗi); 0 media. | Critical | I | [x] |
| **TC-F48-08-03** | `AC-3 US-F48-08` | `[Security]` | Chặn SSRF cơ bản | Hostname phân giải 10.0.0.5, 127.0.0.1, 169.254.169.254; redirect từ host công khai sang 127.0.0.1. | Chặn trước khi kết nối (socket log không có kết nối tới IP cấm); lỗi chung 400 `MEDIA_URL_BLOCKED` "This link cannot be imported"; không trả header/body/timing đích. | Blocker | I | [x] |
| **TC-F48-08-04** | `AC-4 US-F48-08`, `D32` | `[Edge]` | Rate limit, quota, trùng ảnh | 11 lần/phút; tenant hết quota; URL ảnh trùng hash. | Lần 11 → 429 `MEDIA_RATE_LIMITED`; quota → 413 `MEDIA_QUOTA_EXCEEDED`; trùng → trả media có sẵn. | Major | I | [x] |
| **TC-F48-08-05** | `AC-3 US-F48-08`, `DoD US-F48-08` | `[Security]` | Ma trận SSRF mở rộng | Unit resolver + integration DNS stub: 0.0.0.0, 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 100.64/10, 169.254/16, ::1, fc00::/7, fe80::/10, ::ffff:127.0.0.1, IP thập phân/bát phân/hex, DNS rebinding (lần 1 public, lần 2 private), > 3 redirect, redirect https→http. | Tất cả bị chặn; IP được kiểm ở thời điểm kết nối (pin IP sau resolve); rebinding không lọt. | Blocker | U+I | [x] |
| **TC-F48-08-06** | `AC-2 US-F48-08` | `[Security]` | Stream vượt 10 MB / Content-Length nói dối | Đích trả `Content-Length: 1000` nhưng stream 50 MB; chunked không giới hạn. | Ngắt ở 10 MB; bộ nhớ function không tăng tuyến tính; 0 media. | Critical | I | [x] |
| **TC-F48-08-07** | `Market Notes US-F48-08` | `[Edge]` | Site chặn hotlink (403) | Đích trả 403. | Gợi ý "tải ảnh về rồi upload" en/ms, không lộ mã kỹ thuật. | Minor | I | [x] |
| **TC-F48-08-08** | `Additional US-F48-08`, `NFR-07` | `[A11y]` | Label, aria-describedby, 375px | Ô URL ở 375px, bàn phím ảo; lỗi. | Có label; lỗi gắn `aria-describedby`; nút "Nhập" không bị che. | Minor | E | [x] |

---

### NHÓM 09 — US-F48-09: Thư mục lồng nhau (14 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-09-01** | `AC-1 US-F48-09`, `FR-23` | `[Positive]` | Tạo/đổi tên/duyệt cây | Tạo "Raya 2026" → "Baju" → đổi "Baju Kurung"; mở picker. | Breadcrumb "Media / Raya 2026 / Baju Kurung"; picker duyệt cùng cây. | Critical | I+E | [x] |
| **TC-F48-09-02** | `AC-2 US-F48-09`, `BR-02`, `BR-03` S3 | `[Negative]` | Giới hạn 5 cấp, 200 thư mục | Tạo con ở cấp 5; tenant có 200 tạo thêm. | 422 `MEDIA_FOLDER_DEPTH_EXCEEDED` / `MEDIA_FOLDER_LIMIT_REACHED`, chuỗi en/ms theo PRD S3 §15.2. | Critical | U+I | [x] |
| **TC-F48-09-03** | `AC-3 US-F48-09`, `BR-04` S3 | `[Negative]` | Tên trùng hoa thường, rỗng, > 60 | Cùng cha có "Promo": tạo "promo", " Promo ", "", 61 ký tự; khác cha tạo "Promo". | 409 `MEDIA_FOLDER_NAME_TAKEN` / 422 `MEDIA_FOLDER_NAME_INVALID` inline; khác cha → OK. | Major | U+I | [x] |
| **TC-F48-09-04** | `AC-4 US-F48-09`, `FR-24` | `[Positive]` | Di chuyển file/thư mục, chống vòng lặp, vượt cấp | Move 10 file + "Baju Kurung"; move thư mục vào chính nó/con; move cây cao 3 vào cấp 4. | URL media không đổi, nơi dùng không ảnh hưởng; vòng lặp → 422 `MEDIA_FOLDER_CYCLE`; vượt cấp → `MEDIA_FOLDER_DEPTH_EXCEEDED`; không thay đổi gì. | Critical | U+I | [x] |
| **TC-F48-09-05** | `AC-5 US-F48-09`, `FR-25`, `BR-05` S3 | `[Positive]` | Xoá thư mục rỗng / chuyển nội dung lên cha | Xoá rỗng; xoá có nội dung (`mode=empty` → 409); chọn "Chuyển lên cha rồi xoá". | 409 `MEDIA_FOLDER_NOT_EMPTY` kèm `mediaCount, childCount`; move-up: số media trước/sau bằng nhau, 0 media bị xoá, 0 DeleteObject. | Blocker | I+E | [x] |
| **TC-F48-09-06** | `AC-6 US-F48-09`, `BR-01` S3 | `[Security]` | Tenant isolation thư mục | A tạo/move với parent/folder id của B. | 404 `MEDIA_FOLDER_NOT_FOUND`; A và B không đổi. | Blocker | I | [x] |
| **TC-F48-09-07** | `AC-12 PRD S3`, `Additional US-F48-09` | `[Positive]` | 375px: breadcrumb + danh sách thư mục con | Playwright mobile. | Cây thu thành breadcrumb + danh sách con; thao tác move qua menu. | Minor | E | [x] |
| **TC-F48-09-08** | `NFR-S3-04`, `BR-10` S3 | `[Edge]` | 20 tạo đồng thời khi có 195 | `Promise.all` 20 request. | Đúng 5 thành công, 15 `MEDIA_FOLDER_LIMIT_REACHED`; count = 200. | Critical | I | [x] |
| **TC-F48-09-09** | `FR-23` | `[Negative]` | Ký tự cấm và unicode | Tên chứa `/ \ < >`; tên BM/emoji hợp lệ. | Ký tự cấm → `MEDIA_FOLDER_NAME_INVALID`; unicode hợp lệ lưu đúng. | Minor | U | [x] |
| **TC-F48-09-10** | `FR-25b`, `D51` | `[Edge]` | Move-up gặp tên trùng ở cha | Cha có "Promo" và "Promo (2)"; thư mục con bị xoá cũng có "Promo". | Thư mục chuyển lên được đổi thành "Promo (3)" + toast liệt kê thư mục đã đổi; không mất dữ liệu. | Major | I | [x] |
| **TC-F48-09-11** | `Additional US-F48-09`, `NFR-07` | `[A11y]` | "Di chuyển tới…" bằng bàn phím; `role="tree"` | Bàn phím thuần; axe. | Move được không cần chuột; cây `role="tree"`/`treeitem`, `aria-expanded`. | Major | E | [x] |
| **TC-F48-09-12** | `FR-24` | `[Negative]` | Move > 100 item | API move 101 id. | 422 `MEDIA_MOVE_TOO_MANY`. | Minor | I | [x] |
| **TC-F48-09-13** | `BR-10` S3, `FR-24` | `[Edge]` | Move chéo đồng thời A→B và B→A | 2 request song song. | Đúng 1 thành công, 1 `MEDIA_FOLDER_CYCLE`; query toàn vẹn PRD S3 §13.4 trả 0 dòng (không chu trình, depth đúng). | Critical | I | [x] |
| **TC-F48-09-14** | `M3`, `FR-25` | `[Edge]` | Xoá tenant có cây thư mục 5 cấp | Postgres thật: tenant có cây 5 cấp + media trong thư mục; xoá tenant (CASCADE); xoá thư mục cha có con qua route `mode=empty`. | Xoá tenant thành công, không lỗi FK (`parent_id` NO ACTION DEFERRABLE, không RESTRICT); route `mode=empty` vẫn 409 `MEDIA_FOLDER_NOT_EMPTY`. | Major | I | [x] |

---

### NHÓM 10 — US-F48-10: Quyền `media` + sidebar (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-10-01** | `AC-1 US-F48-10`, `FR-26` | `[Positive]` | Owner cấp `media` | StaffDrawer bật "Media" cho S; gửi thêm permission lạ `media_admin`. | S vào `/media`, sửa metadata, quản thư mục, xoá media không đang dùng; "Vẫn xoá" không có; giá trị lạ bị loại. | Critical | I+E | [x] |
| **TC-F48-10-02** | `AC-2 US-F48-10`, `D26` | `[Security]` | Staff không `media` | S (`products`) mở `/media` bằng URL; xem sidebar; dùng picker ở SP. | Trang "Bạn không có quyền" (không lộ dữ liệu, không request list); không mục Media (cả Online Store lẫn Settings); picker: chọn/upload; sửa alt media của mình ở gallery SP / `MediaFieldControl`, của người khác disabled + tooltip. | Critical | E | [x] |
| **TC-F48-10-03** | `AC-3 US-F48-10`, `BR-08` S3 | `[Security]` | **Đỏ trước:** chặn ở server | Staff `custom` chỉ `orders` gọi `DELETE /api/media/library/:id`, bulk delete, PATCH metadata của người khác, tạo/xoá thư mục. | Trước sửa: 200 (ĐỎ, theo PRD S3 §17). Sau: 403 `MEDIA_FORBIDDEN`, dữ liệu không đổi. | Blocker | I | [x] |
| **TC-F48-10-04** | `AC-4 US-F48-10`, `FR-27`, `D13` | `[Positive]` | Mục sidebar "Media" (PO đồng ý, D88) | Owner + staff `media`, locale en/ms; D13 đã chốt D88. | Mục trong nhóm **Online Store** ngay sau Blog (`src/config/sidebar-nav.ts`, label inline `{en:'Media', ms:'Media'}`, `permissionId: 'media'`), active ở `/media`; không còn mục Settings. Link "Manage library" ở footer picker vẫn tới `/media`; staff không `media` không thấy mục Media hoặc link quản lý thư viện. | Minor | E | [x] |
| **TC-F48-10-05** | `AC-5 US-F48-10` | `[Positive]` | Staff cũ không tự được cấp | Seed staff trước migration; chạy db-setup; kiểm quyền. | Staff cũ không có `media`; owner luôn đủ quyền. | Critical | I | [x] |
| **TC-F48-10-06** | `FR-26b`, `D52`, `PRD S3 §17` | `[Security]` | Ma trận 6 vai × endpoint | super-admin, owner, admin, editor, viewer, custom±media × {list, metadata, delete, bulk, move, folders} + id tenant khác. | Khớp bảng PRD S3; `viewer` chỉ xem, không có `media` (D52) → ghi 403 `MEDIA_FORBIDDEN`; id tenant khác → 404 cho mọi vai trừ super-admin. | Critical | U+I | [x] |
| **TC-F48-10-07** | `FR-26` | `[Security]` | Thu hồi quyền giữa phiên | S đang mở `/media`; owner tắt `media`; S bấm xoá. | 403 ở request kế tiếp (không cache quyền cũ). | Major | I | [x] |
| **TC-F48-10-08** | `D27`, `BR-07` S3 | `[Security]` | Staff tự cấp/cấp cho người khác | Staff (kể cả admin) PATCH permissions bản thân/người khác thêm `media`. | 403 hoặc field bị loại; quyền không đổi. | Critical | I | [x] |
| **TC-F48-10-09** | `Additional US-F48-10`, `NFR-06/07` | `[A11y]` | Toggle StaffDrawer bàn phím + mô tả en/ms; sidebar 375px | Bàn phím, locale ms, mobile drawer. | Toggle bằng Space; có mô tả phạm vi quyền; mục Media đúng thứ tự trên drawer mobile. | Minor | E | [x] |

---

### NHÓM 11 — US-F48-11: "Đang dùng ở đâu" + chặn xoá + "Chưa dùng" (16 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-11-01** | `AC-1 US-F48-11`, `FR-28` | `[Positive]` | Xem 3 nơi dùng | Seed M = ảnh SP "Tudung Bawal" + cover blog "Promo Raya" + block gallery Home; mở chi tiết. | "Đang dùng ở" 3 dòng có loại + liên kết mở đúng màn sửa. | Critical | E | [x] |
| **TC-F48-11-02** | `AC-2 US-F48-11`, `FR-28`, `D3`, `D48` | `[Positive]` | Quét đủ FK + `{mediaId}` + URL string + đơn hàng + nháp | Fixture: 28 field FK (tham số hoá, theo tên cột thật — M1), block `{mediaId}`, URL trong block cũ, rich text, custom-html, `sites.branding_logo`/`branding_favicon` (text URL — M1), đơn hàng (D29); page có bản nháp mới nhất dùng M và 1 version cũ hơn dùng N; 1 trang tenant B chứa cùng URL. | Trả đủ, không trùng; M có dòng "nháp"; N không tính (version cũ, D48); không trả kết quả tenant B. | Blocker | I | [x] |
| **TC-F48-11-03** | `AC-3 US-F48-11`, `FR-29`, `D28` | `[Security]` | Xoá media đang dùng bị chặn mặc định | Staff `media` và owner bấm xoá M; staff gọi API `force=true`. | Xoá thường → 409 `MEDIA_IN_USE` kèm nơi dùng; hộp thoại liệt kê nơi dùng, focus "Huỷ"; chỉ owner có "Vẫn xoá" (từng file); API force của staff → 403 `MEDIA_FORCE_DELETE_OWNER_ONLY`. | Blocker | I+E | [x] |
| **TC-F48-11-04** | `AC-4 US-F48-11`, `FR-29`, `M2` | `[Positive]` | Owner "Vẫn xoá": FK null, URL giữ, object theo luật prefix | Owner force M (gallery SP + variant + category + page draft mới nhất `_pages_v` + URL trong block); tiêm lỗi S3 khi xoá object. | Trong 1 transaction: FK → null, dòng `products_images` trỏ M **bị xoá** (không còn `image_id` NULL), `_pages_v` bản mới nhất set NULL; block/rich text không đổi; deletion intent ghi bền vững trước COMMIT; object xoá **sau commit** theo `INV-2`/D87 (503/timeout không rollback DB, cleanupPending=true và intent để retry exact key cũ); `media_bytes_used` giảm đúng `filesize`; thông báo liệt kê nơi sẽ vỡ ảnh. | Blocker | I | [x] |
| **TC-F48-11-05** | `AC-5 US-F48-11`, `FR-30` | `[Positive]` | Lọc "Chưa dùng" | 40 media, 12 không dùng; bật lọc (en/ms); chọn tất cả → xoá. | Đúng 12, nhãn "Chưa dùng"/"Tidak digunakan"; xoá không qua hộp thoại cảnh báo. | Critical | I+E | [x] |
| **TC-F48-11-06** | `AC-6 US-F48-11`, `D28` | `[Positive]` | Xoá nhiều có 4 media đang dùng | Chọn 20 (4 đang dùng), xoá. | 16 xoá; 4 giữ trong `kept[]` reason `in_use`; không có "Vẫn xoá" hàng loạt (route bulk-delete không nhận `force`; gửi kèm cũng không xoá item đang dùng). | Critical | I+E | [x] |
| **TC-F48-11-07** | `AC-7 US-F48-11`, `D29`, `D44` | `[Security]` | Media global / biên lai / media đơn hàng không xoá được | Merchant xoá media global; owner force biên lai gắn đơn và ảnh item snapshot của đơn (API + UI). | Global → 404; biên lai + media đơn hàng → 409 `MEDIA_FORCE_DELETE_FORBIDDEN` kể cả owner; UI không có "Vẫn xoá". | Blocker | I | [x] |
| **TC-F48-11-08** | `NFR-03` | `[Perf]` | Usage scan p95 < 1,5s | Tenant 20 site / 500 page / 2.000 SP; 100 lần `findMediaUsages` trên media ngẫu nhiên. | p95 < 1.500 ms; ghi query plan. | Critical | P | [ ] |
| **TC-F48-11-09** | `FR-28`, `D21` | `[Edge]` | URL biến thể cùng object + URL PW1 | Cùng key qua host CDN, S3 path-style, virtual-host, có `?w=640`, percent-encode; media legacy URL PW1. | Tất cả nhận là cùng 1 media; legacy khớp theo URL đầy đủ. | Critical | U+I | [x] |
| **TC-F48-11-10** | `FR-28c`, `D29`, `D44` | `[Edge]` | Đơn hàng tham chiếu media | Media là ảnh item snapshot của đơn + `paymentProofImage`; mở chi tiết, xoá. | "Đang dùng ở" có đơn hàng (`readOnly`); xoá bị chặn, không force được (D44); GC không chọn (xem 12-12). | Critical | I | [x] |
| **TC-F48-11-11** | `FR-30` | `[Edge]` | `unused_since` nhất quán khi gắn/gỡ | Gỡ M khỏi SP cuối cùng → `unused_since` set; gắn lại → null. `EXPLAIN` lọc "Chưa dùng". | Cột cập nhật đúng; lọc không quét JSON toàn bộ (dùng cột/index). | Major | I | [x] |
| **TC-F48-11-12** | `FR-29` | `[Edge]` | Race: xoá trong khi tab khác vừa gắn | Tab 1 mở hộp xoá (M chưa dùng); tab 2 gắn M vào SP; tab 1 xác nhận. | Server kiểm lại → chặn như media đang dùng; không xoá. | Critical | I | [x] |
| **TC-F48-11-13** | `Additional US-F48-11`, `NFR-07` | `[A11y]` | Hộp thoại cảnh báo bàn phím + 375px | Bàn phím; mobile. | Focus mặc định "Huỷ"; Esc đóng; 375px bottom sheet cuộn được. | Minor | E | [x] |
| **TC-F48-11-14** | `FR-28` | `[Edge]` | Không khớp nhầm chuỗi con | Media `…/abc.webp`; trang chứa `…/xabc.webp` và `…/abc.webp.bak`. | Không tính là nơi dùng. | Major | U | [x] |
| **TC-F48-11-15** | `D78`, `FR-29b`, `D44` | `[Security]` | Không force delete media là QR thanh toán đang bật | Media Q là QR của phương thức chuyển khoản **đang bật**; `ownerA` gọi `DELETE /api/media/library/{Q}?force=1` + thao tác UI S2. Đối chứng: tắt phương thức rồi force. | Đang bật → 409 `MEDIA_FORCE_DELETE_FORBIDDEN`, QR giữ nguyên (không set NULL), object còn; UI không có "Delete anyway", tooltip `mediaLibrary.deletePaymentQrLocked`. Đã tắt → force theo luồng thường (FK null, object xoá sau commit). | Blocker | I+E | [x] |
| **TC-F48-11-16** | `FR-28d`, `INV-3`, `D14` | `[Security]` | Quyền `GET /api/media/library/:id/usages` | 1. `ownerA` gọi usages id media của B.<br>2. Staff A chỉ `orders` (không quyền mở picker) gọi usages media A.<br>3. Staff A `products` (không `media`) gọi usages media A.<br>4. Anonymous. | (1) 404 (không lộ tồn tại). (2) 403 `MEDIA_FORBIDDEN`. (3) 200 (quyền picker). (4) 401 `MEDIA_UNAUTHORIZED`. Không response nào chứa nơi dùng của tenant khác. | Critical | I | [x] |

---

### NHÓM 12 — US-F48-12: GC dry-run + regenerate (26 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-12-01** | `AC-1 US-F48-12`, `FR-31`, `D33`, `D87` | `[Positive]` | Dry-run pha GC khác full dryRun=1 | Arrange: flag thiếu/false; seed row ứng viên GC + object riêng không row có pending allocation/merchant/gc/orphan intent và allocation watch; snapshot media/quota/object/intent/cursor. Act: cron không query; reset fixture rồi dryRun=1 với cả flag false và true; đối chứng flag true không query. | Assert: không query + flag off → mode=gc-dry-run, row/quota không bị xoá/trừ và object gc/orphan giữ nguyên; allocation/merchant/watch được dọn đúng key không row. dryRun=1 → mode=dry-run toàn worker, media/quota không đổi, 0 DeleteObject/ack intent/tiến cursor thật dù flag bật. flag true không query → mode=enabled. Mọi chế độ có báo cáo JSON private (D41), không dùng snapshot object toàn bucket bất biến để assert pha GC dry-run. | Blocker | I | [x] |
| **TC-F48-12-02** | `AC-2 US-F48-12` | `[Positive]` | Tiêu chí ứng viên | Seed ai/stock/seed không dùng 31 ngày; upload/import-url/system không dùng 90 ngày; bật xoá thật. | Chỉ nhóm ai/stock/seed bị xoá (row + object); quota giảm; nhóm còn lại nguyên. | Blocker | I | [x] |
| **TC-F48-12-03** | `AC-3 US-F48-12`, `NFR-05`, `D46` | `[Security]` | Ứng viên key ngoài `pw2/` | Row ai trước F48 key phẳng (kể cả khớp filename); row trỏ object PW1. | Đợt đầu chỉ xoá object `pw2/` (D46): key phẳng → không DeleteObject, báo cáo ghi nhánh `flatKeyBranch` (bật sau 4 dry-run sạch); key ngoài → `skipped-foreign-prefix`. | Blocker | I | [x] |
| **TC-F48-12-04** | `AC-4 US-F48-12` | `[Edge]` | Kiểm lại ngay trước xoá | Hook test: sau bước quét, gắn X vào SP; rồi bước xoá. | X bỏ qua, `unused_since` = null. | Critical | I | [x] |
| **TC-F48-12-05** | `AC-5 US-F48-12`, `FR-32` | `[Positive]` | Regenerate đánh dấu media cũ | Regenerate site có media ai/stock + media merchant upload. | ai/stock/seed không còn dùng: `unused_since` = thời điểm regenerate; media merchant chỉ nhãn "Chưa dùng", không vào ứng viên GC. | Critical | I | [x] |
| **TC-F48-12-06** | `AC-6 US-F48-12`, `FR-31d`, `D45` | `[Positive]` | Lifecycle `pw2/tmp/` + abort multipart trên DO | Staging DO: tạo object `pw2/tmp/qa-…` + multipart dở + object đối chứng `pw2/qa-lifecycle/keep`; chờ ≥ 24–48h. | tmp + multipart bị xoá/abort; đối chứng còn; bằng chứng `s3api get-bucket-lifecycle-configuration` + list trước/sau. Rule tạo từ S1 (D36); kiểm sau 48h, không chặn release S1 (D45). | Critical | M | [ ] |
| **TC-F48-12-07** | `AC-7 US-F48-12`, `D33`, `D60`, `D77`, `D87` | `[Edge]` | Lock chạy chồng + lỗi S3 sau COMMIT | 2 cron song song qua PgBouncer transaction mode; Redis tắt ở lần 3; 2 worker nhận cùng tenant; tiêm DeleteObject 503 sau COMMIT. Đối chứng intent write lỗi trước COMMIT; grep không có session advisory lock. | Khoá Redis/lease tenant loại lượt chồng; Redis lỗi bỏ lượt. Mỗi row vẫn dùng cùng hash/key xact lock với dedupe rồi đọc lại eligibility. S3 503: row đã xoá/quota giảm đúng một lần, intent pending được retry; không giữ/hồi sinh row. Intent lỗi trước COMMIT: giữ row/quota. Không lock rò; báo cáo tách deleted/bytesFreed theo DB và objectsDeleted/pendingObjectDeletes theo S3, Sentry chỉ cảnh báo. | Critical | I | [x] |
| **TC-F48-12-08** | `NFR-05`, `D21`, `INV-2` | `[Security]` | **Bắt buộc:** GC không đụng object ngoài `pw2/` và row PW1 legacy | MinIO seed §9.3 (PW1 + PW2 lẫn lộn + canary); chụp snapshot (key, ETag, size) + bảng `media`. Chạy mọi nhánh: dry-run, real, ứng viên hợp lệ, ứng viên foreign, regenerate rồi GC, lỗi S3 giữa chừng, batch nhiều lần. | Diff snapshot: object bị xoá ⊆ tập ứng viên hợp lệ dưới `pw2/` (hoặc key phẳng đúng filename row PW2); **0** object ngoài `pw2/` mất/đổi; row PW1 legacy (`filename` null) không bị xoá/sửa. | Blocker | I | [x] |
| **TC-F48-12-09** | `NFR-05`, `SEC-1` | `[Security]` | Key mập mờ trong luồng GC | Row/object: `pw2`, `pw2-backup/x`, `PW2/x`, `pw2/../uploads/x`, `/pw2/x`, `pw2%2F..%2Fx`, row filename `uploads/pw1.jpg`. | Không object nào bị xoá; báo cáo `skipped-foreign-prefix`. | Blocker | U+I | [x] |
| **TC-F48-12-10** | `FR-31` | `[Edge]` | Biên 30 ngày + múi giờ | `unused_since` = now−30d+1m và now−30d−1m (UTC); chạy job với TZ máy Asia/Saigon. | Chỉ bản −30d−1m là ứng viên; kết quả không phụ thuộc TZ máy. | Major | U | [x] |
| **TC-F48-12-11** | `Additional US-F48-12`, `FR-31a`, `D61` | `[Edge]` | Ngân sách thời gian + checkpoint theo tenant | 30 tenant, tổng 500 ứng viên; giả lập chậm để 1 lượt chỉ đủ ~10 tenant (cron hằng ngày, ngân sách 45 s, maxDuration 60 s). | Mỗi lượt dừng nhận tenant mới khi vượt 45 s, kết thúc < 60 s; mỗi tenant quét usage đúng 1 lần/lượt; `media_gc_checked_at` cập nhật cho tenant đã xong; lượt sau tiếp tenant ứng viên chưa xử lý (NULLS FIRST, D66 — cả 30 tenant đều có ứng viên); sau ~3 lượt xong hết; chạy lại idempotent. | Major | I | [x] |
| **TC-F48-12-12** | `D29` | `[Security]` | Media đơn hàng tham chiếu không bao giờ bị GC | Media ai không dùng ở page nhưng là ảnh item snapshot của đơn. | Không bị chọn; báo cáo ghi lý do. | Critical | I | [x] |
| **TC-F48-12-13** | `D33`, `D41`, `D47`, `Additional US-F48-12` | `[Positive]` | Báo cáo + bật xoá thật bằng env | `MEDIA_GC_ENABLED=true` vs thiếu/`"1"`/`"TRUE "`; chạy 10 lần (ngày giả lập khác nhau). | Chỉ đúng `true` bật xoá thật; báo cáo JSON private `pw2/reports/gc/` có tenant, số row/object/byte; giữ đúng 8 bản mới nhất; anonymous không đọc được. | Major | I | [x] |
| **TC-F48-12-14** | `FR-31` | `[Security]` | Cron yêu cầu xác thực | Gọi `/api/cron/media-gc` không secret, sai secret, bằng cookie merchant/super-admin. | 401 `MEDIA_UNAUTHORIZED` trừ secret cron đúng; merchant/super-admin bằng cookie không kích hoạt được. | Critical | I | [x] |
| **TC-F48-12-15** | `FR-31e`, `D39`, `D46`, `INV-2` | `[Edge]` | GC dọn object mồ côi `pw2/t/` | MinIO: object `pw2/t/{A}/t{A}-<hash>-<uuid32>.webp` không có row, tuổi 2 ngày và 2 giờ; object PW1 + canary §9.3; bật xoá thật. | Chỉ object không row cũ > 1 ngày dưới `pw2/t/` bị xoá; object 2 giờ còn; 0 object ngoài `pw2/` bị đụng; báo cáo có mục `orphans`. | Critical | I | [x] |
| **TC-F48-12-16** | `FR-31b`, `D61` | `[Edge]` | Circuit breaker theo tỉ lệ | (a) Tenant 40 media, 25 là ứng viên (> 50%). (b) 4 báo cáo trước trung bình 10 xoá/lượt, lượt này 35 (> 3×). (c) 15/40 và 25 xoá/lượt (dưới ngưỡng). | (a)(b) dừng xoá cả lượt, Sentry `error`, báo cáo `breakerTripped` có `tenantId` + lý do, 0 object bị xoá sau điểm dừng; (c) xoá bình thường. | Critical | I | [x] |
| **TC-F48-12-17** | `FR-01a`, `FR-31b`, `D62`, `SEC-1` | `[Security]` | Audit key bất thường trước khi bật xoá thật | Seed row có `filename` chứa `/` hoặc `..`, `_objectkey` ngoài `pw2/`, key phẳng không khớp mẫu; chạy `scripts/media-audit-suspicious-keys.ts` (đọc media, ghi metadata audit) trên staging + production trước khi đặt `MEDIA_GC_ENABLED=true`. | Script liệt kê đủ row bất thường (CSV), chỉ ghi metadata audit/registry private, không sửa/xoá row/object media; bootstrap exact-key registry complete và giữ entry cũ theo D87 §8.7. Checklist có bằng chứng audit/coverage trước bật đường xoá; 12-23/-24 kiểm giữ object và lỗi metadata. | Critical | U+M | [x] |
| **TC-F48-12-18** | `FR-31e`, `D64`, `D39`, `INV-2` | `[Security]` | GC không coi object đang có row là mồ côi | MinIO + DB: tenant A có 3 row v2 (`prefix`=`pw2/t/{A}`, `_objectKey` NULL), 1 row cũ (`_objectKey`=`pw2/t/{A}`, `prefix` NULL), 1 object `pw2/t/{A}/t{A}-<hash>-<uuid32>.webp` không row; mọi object cũ > 1 ngày; chạy GC enabled và dry-run. | Chỉ object không row bị liệt kê/xoá (so theo key ghép `[prefix, _objectKey, filename]` bỏ rỗng); 4 object có row còn nguyên (ETag không đổi); báo cáo `orphans` = 1; unit: đổi helper sang `_objectKey + '/' + filename` → test đỏ. | Blocker | I | [x] |
| **TC-F48-12-19** | `FR-31a`, `D66`, `NFR-S4-05` | `[Perf]` | Chỉ chọn tenant có ứng viên; phủ hết ≤ 7 ngày | Seed 3.000 tenant: 2.700 sạch (chỉ row `created_via` NULL hoặc đã kiểm, không đổi), 300 có ứng viên chia đều 3 loại (sweep đến hạn; media mới sau checkpoint / checkpoint NULL; `sites.updated_at` > checkpoint có media `ai`); thêm 5 tenant sạch nhưng lệch quota. Giả lập 45 tenant/lượt; chạy 7 lượt (ngày giả lập); `EXPLAIN ANALYZE` câu chọn tenant. | Câu chọn < 1 s, chỉ trả 300 tenant ứng viên; 0 tenant sạch bị quét usage (đếm lời gọi `collectTenantMediaReferences`); sau 7 lượt 100% tenant ứng viên có `media_gc_checked_at` mới; `oldestPendingDays` ≤ 7 mọi lượt, `tenantsRemaining` giảm dần về 0; 5 tenant lệch quota được đối soát ở pha đầu lượt 1 dù không có ứng viên GC. | Major | I+P | [x] |

| **TC-F48-12-20** | `D87`, `FR-29b`, `FR-31b/e` | `[Edge]` | Delayed DeleteObject cũ không xoá phiên bản mới | Arrange: Postgres + MinIO/proxy, row R1/key K1 hash H. Act: tham số hoá GC/force/Local API/admin/bulk/caller compensation; barrier sau COMMIT xoá R1/quota trước DeleteObject K1, upload/ingest cùng bytes H → R2/K2; thả S3 completion. Lặp timeout client rồi S3 xử lý trễ, và barrier trước COMMIT để register chờ lock/re-read. | Assert: R2 thành công với K2 ≠ K1, Head đúng bytes sau DeleteObject K1; quota đúng SUM, không chờ Ops. Dedupe không trả R1 đã xoá; trước COMMIT GC đọc lại created_via/usage nên bỏ row đã được merchant nâng upload. Bản hash-only cũ làm K2=K1 và mất object ⇒ test đỏ. | Critical | I | [x] |
| **TC-F48-12-21** | `D87`, `AC-7 US-F48-12`, `FR-29b`, `D67` | `[Edge]` | Durable intent và crash ở ranh giới COMMIT/S3 | Arrange: ứng viên GC/force, snapshot quota, fault intent write/DeleteObject. Act: intent write lỗi hoặc timeout không xác nhận; kill sau ghi intent trước DB COMMIT (rollback); kill sau DB COMMIT trước DeleteObject; DeleteObject 503/timeout rồi restart worker retry thành công, lặp retry cùng intent. | Assert: lỗi trước COMMIT giữ row/quota, không S3 delete; orphan intent của rollback có row thì được bỏ qua/ack dưới lock. Sau COMMIT row không quay lại, quota giảm đúng 1 lần; intent còn dù process chết, worker tìm được dù tenant 0 row; 503/timeout retry exact K1, không INSERT/cộng lại quota. Retry thành công ack riêng operationId, không xoá intent khác; metrics DB và S3 tách biệt. | Critical | I | [x] |
| **TC-F48-12-22** | `D87`, `D39`, `FR-31e` | `[Edge]` | Late Put mọi prefix và allocation watch khi GC off | Arrange: Postgres + MinIO/proxy; allocation source=allocation không row ở pw2/t/, pw2/private/t/, pw2/u/, pw2/g/ (tham số hoá), GC flag=false, tenant 0 media/global. Act: Put/Copy timeout → rollback → worker Head/DeleteObject trả 404 hoặc OK → cho Put hoàn tất trễ → worker chạy lại; thêm restart/cursor write lỗi, LIST cũ rồi INSERT còn giữ lock/Head tuổi mới và dryRun=1. | Assert: allocation intent không bị ack sau 404/cleanup, metadata/watch vẫn còn, source không đổi thành orphan/gc; worker ≤7 ngày kiểm lại exact key và dọn late object mọi prefix dù GC off, không chờ Ops/reuse key. Có row exact key đã COMMIT thì giữ object/ack allocation hợp lệ; SELECT primary + cùng lock/Head tuổi mới ngăn xoá row đang sống. Watch key vắng không tính pending object/lỗi; retry trang idempotent, không quota thay đổi; lỗi cursor/watch quá hạn có cảnh báo; dryRun=1 không xoá/ack/tiến cursor thật (12-01). | Critical | I | [x] |

| **TC-F48-12-23** | `FR-01a`, `FR-31b/e`, `D78`, `D87`, `AC-3 US-F48-01/12` | `[Security]` | Flagged exact key sống qua row cuối, nhiều sweep/restart | Arrange: Postgres + MinIO; tenant chỉ row M bị audit flag, key K hợp cú pháp pw2/t/ tuổi 2 ngày, không allocation/delete intent; tham số hoá key legacy hash-only/key version, các prefix allocation và row private/global qua luồng xoá có quyền. Seed control orphan C không flagged. Act: audit bootstrap, xoá M, chạy 10 sweep enabled qua nhiều ngày/retention báo cáo, restart worker sau mỗi lượt; tham số hoá merchant/force/admin/bulk/GC/compensation, retry/watch/orphan không row hoặc mất snapshot intent. | Assert: exclusion exact K + mediaId/reason được ghi/đọc xác nhận durable trước row/quota COMMIT; K không có DeleteObject, ETag/bytes không đổi dù tenant 0 row/intent và qua retention/restart; mọi đường cleanup vẫn chặn K, không chỉ log/idlist. C được dọn khi guard/tuổi hợp lệ; exclusion không trừ quota lại, không chặn upload cùng bytes thành key UUID mới. Bản trước D87 P1 mất K ở orphan sweep ⇒ test đỏ. | Blocker | I | [x] |
| **TC-F48-12-24** | `FR-01a`, `D81`, `D87`, `FR-31b/e` | `[Security]` | Bootstrap/metadata fail-closed và Ops clearance exact key | Arrange: flagged M/K + control C, legacy idlist không registry, rồi complete registry; tiêm registry read/write lỗi, missing/corrupt/incomplete/revision mismatch, durable ack timeout trước xoá last row; worker mất mediaId/intent snapshot, cached allow cũ. Act: delete/retry/watch/orphan, nhiều restart; audit rerun bỏ row M khỏi idlist; thử clearance thiếu opsId/reason hoặc write fail, rồi explicit clearance K có revision mới; cuối cùng metadata phục hồi. | Assert: bootstrap chưa complete/ghi exclusion chưa xác nhận ⇒ row/quota giữ, 0 DeleteObject cả key pw2/ lẫn key phẳng; không mất ánh xạ cuối cùng. Worker đã không row vẫn blocked/unknown ⇒ giữ K/intent/watch, báo audit-metadata-unavailable, không dùng cached absence; read lỗi C cũng tạm không xoá. TTL/row/idlist/intent biến mất hay audit rerun không clear K. Chỉ clearance exact K có opsId/at/reason durable mới cho retry/sweep K không row và guard hợp lệ; C dọn sau metadata phục hồi. Không reuse key, không phục hồi row, upload UUID mới vẫn được phép. | Blocker | I | [x] |

| **TC-F48-12-25** | `D87`, `FR-01a`, `FR-31b/e`, `§8.8` | `[Security]` | Concurrent conditional registry writes/clearance và late PUT | Arrange: publisher thật + MinIO/fault proxy; cùng test trên Spaces staging với registry QA riêng (không object media), body+ETag E0, hai writer block K1/K2; Ops clearance cho blockRevision B. Act: hai PUT If-Match E0, delayed PUT sau timeout/connection loss/SDK retry; clearance B cạnh re-block B2; replay mutationId, conditional bootstrap và mô phỏng storage bỏ qua header. | Assert: đúng1 writer E0 thắng, loser412/409 reload/merge giữ cảK1/K2; delayed E0 không overwrite revision mới, SDK giữ conditional header, UUID revision/ETag khôngABA; appliedMutationIds giữ retry block/clear cũ là no-op sau B2. Clearance cũ không clear B2/key khác; timeout không blind PUT/rollback; If-None-Match * không overwrite existing registry. Không chứng minh CAS atomic ⇒ capability gate FAIL, failclosed mọi đường xoá nhưng uploadUUID mới vẫn chạy; chưa có runtime evidence thì không coi gatePASS. | Blocker | I+M | [x] |
| **TC-F48-12-26** | `D87`, `FR-31c`, `§8.9` | `[Edge]` | Ops thấy metadata outage, backlog và check bị đứng | Arrange: service/MinIO thật, Sentry/metrics test sink + clock controllable; pending cleanup không protected, watch key vắng và protected control. Act: registry lỗi đọc/ghi/validation, early return/Redis down, outage >30 phút, backlog >1/>7 ngày, heartbeat/last-success vắng >26 giờ; chạy worker chồng/response cũ rồi recovery. | Assert: sự kiện Sentry đầu ngay stage/reason, dedupe10phút không hoãn escalation/watchdog ngoài cron; report/counters và lastSuccessfulCheckAt/PublishAt chỉ tăng sau GET body+ETag verify/CAS, lỗi không null-reset checkpoint hoặc tạo false healthy; không đọc được health/backlog report unknown/null không 0. Key protected/watch vắng không inflates blocked backlog; recovery có notification và cleanup tiếp tục sau metadata hợp lệ, không reuse key/chặn uploadOps. | Critical | I+M | [x] |

---

### NHÓM 13 — US-F48-13: Quota theo gói (12 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-13-01** | `AC-1 US-F48-13`, `FR-33` | `[Positive]` | Đồng hồ dung lượng 3 ngưỡng | Gói 2048 MB; used 1,2 GB / 1,7 GB (≥ 80%) / 2 GB. | en "1.2 of 2 GB used", ms "1.2 daripada 2 GB digunakan" (`mediaLibrary.storageUsed`, design S6) + thanh; ≥ 80% màu cảnh báo + gợi ý "Chưa dùng"; ≥ 100% trạng thái đầy + liên kết nâng gói. UNLIMITED (D53): "{used} used", không thanh. | Major | E | [x] |
| **TC-F48-13-02** | `AC-2 US-F48-13` | `[Negative]` | Chặn upload khi vượt; AI/seed không bị chặn | Còn 3 MB, ảnh sau xử lý 4 MB; bỏ qua client; AI generate + seed khi đầy. | 413 `MEDIA_QUOTA_EXCEEDED` "Storage full"/"Storan penuh"; AI/seed vẫn tạo được và được cộng vào bộ đếm (D36); tmp xoá; 0 row; client chặn sớm khi chắc chắn vượt. | Critical | I+E | [x] |
| **TC-F48-13-03** | `AC-3 US-F48-13`, `D53`, `D60` | `[Edge]` | 3 register đồng thời còn 5 MB | Postgres thật (trực tiếp + qua PgBouncer transaction mode), 3 × 2 MB song song. | Tối đa 2 thành công; bộ đếm cập nhật cùng transaction trên 1 client `pool.connect()`; trùng hash không tăng; tính theo byte sau xử lý. | Blocker | I | [x] |
| **TC-F48-13-04** | `AC-4 US-F48-13` | `[Positive]` | Hạ gói khi đang vượt | 3 GB used, hạ 5 GB → 2 GB. | 0 media bị xoá; upload mới bị chặn tới khi < hạn mức; storefront hiển thị bình thường. | Critical | I | [x] |
| **TC-F48-13-05** | `AC-5 US-F48-13`, `D24`, `INV-4` | `[Positive]` | Biên lai khi đầy quota | Tenant 100%; người mua upload biên lai. | Thành công; `media_bytes_used` không đổi. | Blocker | I+E | [x] |
| **TC-F48-13-06** | `AC-6 US-F48-13`, `D25` | `[Positive]` | Sửa PlanFeatures, gói chưa cấu hình, đối soát | Super-admin đổi `media_storage_mb`; gói không có bản ghi; làm lệch bộ đếm rồi chạy đối soát. | Áp dụng ngay; gói thiếu → hạn mức free (D25); seed mặc định `UNLIMITED` không chặn (D53); đối soát tính lại `tenants.media_bytes_used` = SUM(filesize) row non-private, `filename IS NOT NULL` (M6). | Critical | I | [x] |
| **TC-F48-13-07** | `INV-5`, `FR-33` | `[Edge]` | Bất biến bộ đếm (property-based) | Chuỗi ngẫu nhiên 200 thao tác: upload, dedupe, xoá, xoá nhiều, force, register lỗi, GC. | Sau mỗi bước `media_bytes_used == SUM(filesize)` non-private; không bao giờ âm. | Critical | I | [x] |
| **TC-F48-13-08** | `Additional US-F48-13`, `NFR-06/07` | `[A11y]` | Progressbar aria + định dạng số theo locale | en/ms, 375px. | Một role duy nhất `role="progressbar"` (không `meter`) + `aria-valuenow/min/max`; dung lượng thập phân 1 chữ số, dấu chấm ở cả en/ms ("1.6 of 2 GB used" / "1.6 daripada 2 GB digunakan", thống nhất F21); gọn trên đầu thư viện ở 375px. | Minor | E | [x] |
| **TC-F48-13-09** | `FR-33` | `[Edge]` | Biên quota chính xác (BVA) | used + size == limit; == limit + 1 byte. | Bằng → cho phép; +1 → `MEDIA_QUOTA_EXCEEDED`. | Major | U+I | [x] |
| **TC-F48-13-10** | `M6`, `FR-33b`, `FR-33e`, `INV-5` | `[Edge]` | Row PW1 không tính quota; trừ quota ở mọi đường xoá | Tenant có 10 row PW1 migrate (`filename` null, filesize lớn) + 5 row PW2; chạy đối soát; xoá qua route, bulk, force, GC, Payload admin (super-admin), `account/reset`. | Đối soát chỉ cộng 5 row PW2; mỗi đường xoá trừ đúng `filesize` (Local API qua `afterDelete`; force/GC trong transaction SQL — D67), xoá row PW1 trừ 0; không âm; checklist bật chặn yêu cầu đối soát xong mọi tenant. | Major | I | [x] |
| **TC-F48-13-11** | `D67`, `FR-33b`, `INV-5`, `M6` | `[Edge]` | Không trừ quota hai lần khi xoá | Tenant A `media_bytes_used` = SUM thật; xoá lần lượt: route không force (Local API), bulk-delete, Payload admin (super-admin), force delete (SQL), GC sweep (SQL); spy hook `afterDelete` + đếm câu `UPDATE tenants SET media_bytes_used`. Thêm: service gọi Local API với `context.mediaQuotaHandled = true`. | Mỗi lần xoá `media_bytes_used` giảm đúng `filesize` của row (không 2×, không âm); đường SQL (force, GC): hook `afterDelete` **không** chạy, trừ trong cùng transaction (rollback ⇒ không trừ); đường Local API: trừ đúng 1 lần trong hook; `mediaQuotaHandled` ⇒ hook bỏ qua; sau chuỗi `media_bytes_used == SUM(filesize)` non-private. | Critical | I | [x] |
| **TC-F48-13-12** | `FR-33d`, `INV-3`, `D14` | `[Security]` | Quyền `GET /api/media/quota` | 1. `ownerA` gọi quota kèm `?tenant=B` / header tenant B.<br>2. Staff A chỉ `orders`.<br>3. Staff A `products`.<br>4. Anonymous. | (1) trả số của **A** (tenant theo session; tham số bị bỏ qua), không lộ số của B. (2) 403 `MEDIA_FORBIDDEN`. (3) 200. (4) 401 `MEDIA_UNAUTHORIZED`. | Major | I | [x] |

---

### NHÓM 14 — US-F48-14: Gallery SP 10 ảnh (11 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-14-01** | `AC-1 US-F48-14`, `FR-34`, `D11` | `[Positive]` | Thêm tới N ảnh (N = `MAX_PRODUCT_IMAGES` = 10, PO đồng ý D11 — D88) | SP có N − 3 ảnh → picker. Test đọc N từ `MAX_PRODUCT_IMAGES`, không hard-code. | "Đã chọn 3/3"; đủ N → nút "Thêm ảnh" vô hiệu "Tối đa N ảnh mỗi sản phẩm". | Critical | E | [x] |
| **TC-F48-14-02** | `AC-2 US-F48-14` | `[Positive]` | Kéo sắp xếp; ảnh đầu = ảnh chính | Kéo ảnh 4 lên đầu (chuột, cảm ứng, bàn phím "Đưa lên"); lưu; xem storefront thẻ SP, PDP, giỏ, OG. | Thứ tự lưu đúng; nhãn "Ảnh chính"/"Imej utama"; 4 nơi dùng ảnh đầu. | Critical | E | [x] |
| **TC-F48-14-03** | `AC-3 US-F48-14` | `[Positive]` | "Đặt làm ảnh chính" | Ảnh 3 → đặt chính. | Thứ tự [3,1,2,4,5]. | Major | U+E | [x] |
| **TC-F48-14-04** | `AC-4 US-F48-14` | `[Positive]` | Gỡ ảnh đang dùng cho biến thể | Gỡ G (ảnh của "Merah / M"). | Cảnh báo "…biến thể sẽ dùng ảnh chính"; sau lưu G chỉ gỡ tham chiếu, còn trong thư viện; biến thể `image` = null. | Critical | I+E | [x] |
| **TC-F48-14-05** | `AC-5 US-F48-14`, `INV-3` | `[Security]` | Validate server | API lưu SP: 11 ảnh; ảnh trùng; mediaId tenant khác; video. | 400 `PRODUCT_IMAGES_TOO_MANY` / `PRODUCT_IMAGES_DUPLICATE` / `PRODUCT_IMAGES_INVALID` (tenant khác, video); SP không đổi. | Blocker | I | [x] |
| **TC-F48-14-06** | `AC-6 US-F48-14` | `[Positive]` | Halal cert tách riêng | SP 10 ảnh + halalCertImage; thử đặt Halal làm ảnh chính; gửi video/PDF cho Halal. | Không tính vào 10; không thể đặt làm ảnh chính; video/PDF → 400 `HALAL_CERT_IMAGE_ONLY` (D30). | Major | I+E | [x] |
| **TC-F48-14-07** | `Additional US-F48-14`, `NFR-07` | `[A11y]` | Bàn phím + aria-live + 375px handle | Sắp xếp bằng bàn phím; mobile kéo bằng handle khi cuộn. | `aria-live` báo vị trí mới; lưới 3 cột; kéo không xung đột cuộn. | Major | E | [x] |
| **TC-F48-14-08** | `Additional US-F48-14` | `[Edge]` | Một nguồn hằng số `image-limit.ts` | Unit: `maxRows` collection == hằng số UI. | Bằng nhau; không literal 5/10 rải rác. | Minor | U | [x] |
| **TC-F48-14-09** | `Market Notes US-F48-14` | `[Edge]` | SP migrate PW1 có 6–8 ảnh | Mở + lưu SP seed 8 ảnh. | Lưu thành công, thứ tự giữ, không mất ảnh. | Major | I | [x] |
| **TC-F48-14-10** | `AC-5 US-F48-14`, `FR-34d`, `D84` | `[Security]` | Validator từ chối định dạng/kích thước ngoài policy DAM khi thêm mới | Seed media tenant A: `legacy.gif`, `legacy.avif`, `legacy.svg` (row PW1, `mimeType` gốc), `big-legacy.jpg` `filesize` 3,5 MB. API lưu SP: thêm từng media vào gallery; lặp với `variants[].image` trỏ các media đó. Đối chứng: SP seed đã có sẵn `legacy.gif` trong gallery → sửa giá, lưu. | 400 `PRODUCT_IMAGES_INVALID` với `reason` `type` (gif/avif/svg) / `size` (3,5 MB); SP không đổi. Đối chứng: lưu thành công, `legacy.gif` giữ nguyên vị trí. Picker (`accept = product-image`) hiện các media này mờ, không chọn được, tooltip "Product images must be JPG, PNG or WebP up to 3 MB". | Critical | I+E | [x] |
| **TC-F48-14-11** | `Additional US-F48-14`, `D84`, `FR-11` | `[Edge]` | Ảnh lớn được hạ xuống ≤ 3 MB, không bị từ chối | Upload purpose `product` `noise-6000x4000.png` (nhiễu hạt, WebP q80 ≤2560 > 3 MB) và `photo-2560.jpg` (q80 < 3 MB). | Cả hai 201; bản lưu `image/webp` `filesize ≤ 3 145 728`; ảnh nhiễu có q < 80 hoặc cạnh dài < 2560 (ghi trong log debug), ảnh thường giữ q80/2560; ảnh nhiễu thêm vào gallery thành công. | Major | U+I | [x] |

---

### NHÓM 15 — US-F48-15: Ảnh biến thể (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-15-01** | `AC-1 US-F48-15`, `FR-35`, `D10` | `[Positive]` | Chọn ảnh biến thể từ gallery | SP 4 ảnh, 6 biến thể; bấm ô ảnh "Merah / M". | Chỉ hiện 4 ảnh gallery; chọn xong thumbnail; biến thể khác "Dùng ảnh chính". | Critical | E | [x] |
| **TC-F48-15-02** | `AC-2 US-F48-15` | `[Positive]` | Storefront đổi ảnh theo biến thể | Chọn Merah (có G2), Biru (không ảnh), biến thể hết hàng. | Merah → G2 + thumbnail đánh dấu; Biru → ảnh chính, không vỡ, CLS ≈ 0; hết hàng vẫn đổi (qua `onPreview`, D50). | Critical | E | [x] |
| **TC-F48-15-03** | `AC-3 US-F48-15`, `INV-3` | `[Security]` | Chỉ nhận ảnh thuộc gallery SP | API `variants[].image` = media ngoài gallery / tenant khác / video. | 400 `VARIANT_IMAGE_NOT_IN_GALLERY`; dữ liệu không đổi. | Blocker | I | [x] |
| **TC-F48-15-04** | `AC-4 US-F48-15` | `[Positive]` | Ảnh biến thể bị gỡ/force-delete | Trên Postgres/MinIO thật áp dụng migration S5 nhưng **không có `categories.image_id`** (D88), gọi service thật: (1) gỡ G2 khỏi gallery; reset fixture (2) gọi usages G2 trước force-delete (owner); (3) GC media ai không dùng đủ tuổi; (4) seed media khác có snapshot order rồi thử force/GC. | Usage/delete/GC không lỗi undefined-column, SQL registry không tham chiếu category; 29 nguồn FK + snapshot order hoạt động, order read-only vẫn chặn force/GC. `image_id` null (FK ON DELETE SET NULL, Postgres thật); storefront ảnh chính; "Đang dùng ở" liệt kê biến thể trước khi xoá. | Critical | I | [x] |
| **TC-F48-15-05** | `AC-5 US-F48-15` | `[Positive]` | Không đổi hành vi SP không biến thể / không ảnh biến thể | Snapshot PDP trước/sau F48. | Hành vi gallery như cũ (visual diff ≤ ngưỡng). | Major | E | [x] |
| **TC-F48-15-06** | `AC-6 US-F48-15`, `FR-35e`, `FR-35f`, `D49` | `[Positive]` | Giỏ hàng + email/đơn snapshot ảnh biến thể | Thêm "Merah / M" vào giỏ, đặt đơn, xem email + chi tiết đơn; sau đó đổi ảnh biến thể. | Giỏ/email/đơn hiện G2 (`orders_items.image_url`); đơn cũ giữ snapshot cũ sau khi đổi. | Critical | I+E | [x] |
| **TC-F48-15-07** | `Additional US-F48-15`, `NFR-07` | `[A11y]` | aria-label, ô ≥ 44px, không reload, preload | Bàn phím; 375px; network khi hover/focus lựa chọn. | `aria-label` "Ảnh cho biến thể Merah / M"; ô ≥ 44×44; không reload; preload ảnh biến thể. | Minor | E | [x] |

---

### NHÓM 16 — US-F48-16: Ảnh danh mục (5 TCs) — ⏸ Hoãn (D88)

> Không chạy trong S5; giữ để mở lại khi có ngày cutover Commerce OS.

| ID | Ref | Loại | Tiêu Đề | Các Bước | Kết Quả Mong Đợi | Mức Độ | Tầng | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-F48-16-01** | `AC-1 US-F48-16`, `FR-36`, `D12` | `[Positive]` | Chọn/gỡ ảnh danh mục | Owner + staff `products` sửa "Kuih Raya". | `categories.image` FK; preview; gỡ chỉ gỡ tham chiếu. | Major | E | [x] |
| **TC-F48-16-02** | `AC-2 US-F48-16`, `D74` | `[Positive]` | Header block `products-grid` khi lọc 1 danh mục + alt fallback (⏸ hoãn, D88) | Trang có block `products-grid`: `?categoryId=<Kuih Raya>` (có ảnh, alt trống, locale ms) ở 1280px và 375px; danh mục không ảnh; URL không `categoryId`; URL 2 `categoryId`. | Lọc 1 danh mục có ảnh: header trên lưới = ảnh `next/image` (4:1 desktop, 2:1 ở 375px, CLS ≈ 0) + tên + mô tả theo locale, alt = tên danh mục ms khi alt trống. Không ảnh → header chỉ chữ, không ô vỡ. 0 hoặc ≥ 2 `categoryId` → không có header (như hiện tại). | Major | E | [x] |
| **TC-F48-16-03** | `AC-3 US-F48-16`, `INV-3` | `[Security]` | Tenant khác / video | API lưu `categories.image`. | 400 `CATEGORY_IMAGE_INVALID`; danh mục không đổi. | Critical | I | [x] |
| **TC-F48-16-04** | `AC-4 US-F48-16`, `FR-28` | `[Positive]` | Vòng đời với ảnh danh mục | Mở chi tiết M (ảnh danh mục); owner force. | "Đang dùng ở" có danh mục; force → `image_id` null; header `products-grid` về dạng chỉ chữ. | Major | I | [x] |
| **TC-F48-16-05** | `Additional US-F48-16`, `NFR-06/07` | `[A11y]` | i18n + 375px + bàn phím | Locale ms; mobile. | "Imej kategori"; form dùng được bằng bàn phím ở 375px. | Minor | E | [x] |

---

## 6. Nhóm Security (SEC-1..11 → TC)

Cột "TC `[Security]`" chỉ liệt kê TC có Loại `[Security]` ở §5; TC loại khác cùng phủ rủi ro ghi ở cột "TC hỗ trợ". Mỗi TC `[Security]` xuất hiện đúng 1 dòng.

| SEC | Mô tả ngắn | TC `[Security]` | TC hỗ trợ (loại khác) | Ghi chú |
|---|---|---|---|---|
| SEC-1 | Đổi field lưu trữ rồi xoá row ⇒ xoá object tuỳ ý | **01-07 (đỏ trước)**, 01-02 (+ bulk D65), 01-03, 01-06, 01-08, 01-09, 01-10, 01-11, 01-13, 01-15 (`_objectKey`, D55), 04-30 (key ghép D64), 12-03, 12-08 (NFR-05), 12-09, 12-17 (audit), 12-18 (mồ côi D64), 12-23/12-24 (exclusion exact-key D87), 12-25 (publish race) | 01-14, 01-18 (D69), 01-19 (D70) | Các TC khai thác chỉ MinIO; riêng TC12-25 chạy MinIO và Spaces staging với key metadata QA riêng, không object media; payload khai thác chỉ nằm trong file test, không ghi ở tài liệu/PR description |
| SEC-2 | `/_next/image` proxy mở | 02-04, 02-10 | — | |
| SEC-3 | EXIF/GPS không xoá | 04-02 | 08-01 | |
| SEC-4 | Thiếu rate limit / quota | 02-03 | 02-09, 08-04, 13-02 | |
| SEC-5 | MIME rộng, REST/PDF/video không kiểm magic | 02-02, **02-08 (đỏ trước)**, 04-09, 04-33 (tráo tmp video, D83), 14-10 (gif/avif/svg, > 3 MB vào gallery SP, D84) | 02-01, 04-06 | |
| SEC-6 | Key đoán được, listing | 02-13, 03-03 | 04-01 | |
| SEC-7 | Thiếu `nosniff`/`Content-Disposition` | 02-05 | 03-04 | |
| SEC-8 | Lộ `aiPrompt`/`sourceUrl`, đọc private sai quyền | 01-05, 01-16 (route private biên lai) | — | |
| SEC-9 | Key lộ chưa xoay, key chung | 03-01, 03-02 | — | Manual/ops |
| SEC-10 | Presign 300s, min 0, key lỏng | 02-06, 04-08 | — | Sau sửa: ảnh 60s / video 600s (D35) |
| SEC-11 | sharp advisory | 02-07 | — | |
| IDOR / tenant | id tenant khác, global | 01-04, 05-06, 07-05, 09-06, 14-05, 15-03, 16-03 | 05-17 | |
| Authz | quyền theo vai, staff, route | 01-17 (D68), 06-05, 10-02, 10-03, 10-06, 10-07, 10-08, 11-03, 11-16 (usages), 13-12 (quota) | 10-01, 10-05 | |
| Thanh toán / đơn hàng | QR, biên lai, media đơn hàng | 04-11, 04-25, 04-26, 07-12 (QR D73), 11-07, 11-15 (QR D78), 12-12 | 11-10, 13-05 | INV-4 |
| SSRF | import URL | 08-03, 08-05, 08-06 | 08-02 | |
| XSS / CSRF / cron | | 05-13, 05-18 (D43), 12-14 | — | |

**Tổng TC Security (loại `[Security]`):** 68 (đếm bằng grep cột Loại ở §5; khớp tổng các ô cột "TC `[Security]`").

---

## 7. NFR → TC (ngưỡng + cách đo)

| NFR | Ngưỡng | TC | Cách đo |
|---|---|---|---|
| NFR-01 | register ảnh 5 MB p95 < 3s | 04-18 | 50 mẫu, 5 song song trên staging Vercel; `Server-Timing` header; ghi p50/p95/p99 vào PR |
| NFR-02 | list 50 item p95 < 500 ms (tenant 5.000) | 05-08 | 200 request k6 trộn lọc/tìm/sắp xếp + `EXPLAIN ANALYZE` |
| NFR-03 | usage scan p95 < 1,5s (20 site/500 page/2.000 SP) | 11-08 | Script Node `perf_hooks` gọi `findMediaUsages` 100 lần |
| NFR-04 | ≥ 50% giảm byte | 04-19 | Bộ benchmark 50 ảnh, so tổng byte |
| NFR-05 | 0 object ngoài `pw2/` bị xoá | **12-08**, 12-03, 12-09, 01-03, 01-13, 04-30, 12-18 | Snapshot MinIO (key+ETag) trước/sau mọi nhánh |
| NFR-06 | 100% en/ms | 05-07, 07-03, 02-11, 10-09, 13-08, 16-05 | Script so khoá en/ms + scan DOM chuỗi cứng ở locale ms |
| NFR-07 | WCAG 2.1 AA | 05-09, 06-06, 06-07, 08-08, 09-11, 11-13, 14-07, 15-07 | `@axe-core/playwright` (0 serious/critical) + kịch bản bàn phím thuần + tương phản |
| NFR-S4-05 | Tenant có ứng viên GC được xử lý ≤ 7 ngày (D66) | 12-19 | Seed 3.000 tenant (300 ứng viên), 7 lượt giả lập; `oldestPendingDays` trong báo cáo + `EXPLAIN ANALYZE` câu chọn tenant |
| NFR-08 | generate site p95 ≤ +10% (D59) | 04-23 | 20 lần generate trước/sau trên staging; cập nhật TC-GENPERF-W2-07 (`docs/qa/F01-gen-perf.md`) |

---

## 8. Kịch bản E2E UAT

### E2E 1 — Owner: upload → thư viện → picker → SP (S1–S2, S5)
1. Login owner A (en) → `/media` → kéo 5 file (1 svg) → 4 xong, svg lỗi riêng.
2. Upload `exif-gps.jpg` → tải object → không còn GPS.
3. Upload lại cùng ảnh → "Ảnh này đã có trong thư viện", đồng hồ dung lượng không đổi.
4. Sửa SP → picker → chọn 3 ảnh thư viện → kéo sắp xếp → lưu → PDP hiện ảnh chính đúng.
5. Gắn ảnh biến thể "Merah / M" → storefront chọn Merah đổi ảnh → thêm giỏ → đặt đơn → email có ảnh biến thể.
6. Đổi locale ms → lặp bước 1 → 100% BM.

### E2E 2 — Vòng đời: dùng ở đâu → chặn xoá → force → GC (S4)
1. Mở chi tiết ảnh dùng ở SP + blog + gallery → 3 nơi.
2. Staff `media` xoá → bị chặn, không có "Vẫn xoá".
3. Owner "Vẫn xoá" → FK null, block giữ URL, cảnh báo nơi vỡ ảnh, dung lượng giảm.
4. Regenerate site → media AI cũ có `unused_since`.
5. Chạy cron (dry-run) → báo cáo; bật `MEDIA_GC_ENABLED=true` trên môi trường test (MinIO) với `unused_since` lùi 31 ngày → xoá đúng ứng viên; snapshot PW1 nguyên vẹn.

### E2E 3 — Quyền & thư mục (S3)
1. Owner tạo "Raya 2026 / Baju" → move 10 file → xoá "Baju" (chuyển lên cha).
2. Staff `products` mở `/media` → không quyền; picker ở SP vẫn chọn/upload.
3. Owner bật `media` cho staff → staff vào `/media`, tạo thư mục; owner tắt → request kế 403.

### E2E 4 — Người mua & bảo mật
1. Người mua upload biên lai PDF 4 MB khi tenant đầy quota → thành công.
2. Biên lai không xuất hiện trong thư viện/picker; anonymous GET → 403/404.
3. `/_next/image?url=` host lạ → 400; site đã migrate PW1 → 0 ảnh vỡ.

---

## 9. Test Data Seed Reference

**File đề xuất:** `scripts/seed-f48-test-fixtures.ts` (seed DB + MinIO) và `src/__tests__/fixtures/media/` (file mẫu). Mọi email `@yopmail.com`. Không dùng ảnh cá nhân thật — ảnh sinh bằng sharp, EXIF chèn bằng `exiftool` từ giá trị giả.

### 9.1 Người dùng & tenant
| Key | Vai | Tenant | Gói | Quyền |
|---|---|---|---|---|
| `sa` | super-admin | — | — | toàn quyền |
| `ownerA` (`f48-owner-a@yopmail.com`) | owner | tA | starter (2048 MB) | — |
| `staffMediaA` | staff | tA | | `media`, `products` |
| `staffProdA` | staff | tA | | `products` (không `media`) |
| `staffOrdersA` | staff custom | tA | | `orders` only |
| `staffLegacyA` | staff tạo trước migration | tA | | `products`, `blog` |
| `ownerB` | owner | tB | free (500 MB) | — |
| `multiTenantUser` | admin ở cả tA + tB | tA, tB | | |
| `buyerA` | người mua | storefront tA | | có đơn `ORD-F48-1` chờ biên lai |
| tenant `tFull` | owner | tFull | free, `media_bytes_used` = 100% | |
| tenant `tLarge` | owner | tLarge | business | 5.000 media, 20 site, 500 page, 2.000 SP (perf) |

### 9.2 File mẫu
| Fixture | Mô tả | Dùng ở |
|---|---|---|
| `exif-gps-orient6.jpg` | JPEG 3000×4000, EXIF GPS + Model + DateTime giả, Orientation 6 | 04-02, 08-01 |
| `large-4000x4000.png` / `large-4000x3000.png` | PNG ~8 MB | 04-01, 04-19 |
| `valid.webp`, `alpha.png`, `cmyk.jpg`, `16bit.png`, `1x1.png`, `animated.webp` | định dạng biên | 02-01, 04-14, 04-16 |
| `fake-html.jpg`, `fake-pdf.jpg`, `fake-svg.jpg`, `fake-zip.jpg` | đổi đuôi `.jpg`, nội dung khác | 02-02, 07-08 |
| `polyglot-jpeg-html.jpg` | JPEG hợp lệ + payload nối đuôi | 04-09 |
| `logo.svg`, `anim.gif`, `photo.heic`, `scan.tiff`, `photo.avif`, `note.txt` | định dạng bị cấm | 02-01, 05-05 |
| `proof-4mb.pdf`, `proof-5mb-plus1.pdf` | PDF biên lai | 04-04, 07-04 |
| `valid-60mb.mp4`, `valid.webm` | video hợp lệ | 04-06 |
| `fake-webm-as.mp4`, `fake-video.mp4` | mp4 giả (WebM/MKV/text) | 02-08, 04-06 |
| `huge-60mp.png` | 60 MP (magic hợp lệ, nén cao) | 04-05 |
| `corrupt.jpg` | header JPEG + byte rác | 04-05 |
| `dup-a.jpg` + `dup-a-copy.jpg` | cùng byte, tên khác | 04-03, 04-10, 04-11 |
| `favicon.ico` | ICO 32×32 | 04-15 |
| `size-10mb.jpg` / `size-10mb-plus1.jpg` | BVA per-file | 04-04 |

### 9.3 Object & row giả lập PW1 trong MinIO (`f48-test`)
```text
# PW1 (KHÔNG được đụng)
uploads/2024/05/kuih-raya.jpg          # object PW1, có row legacy (filename null, url host PW1)
medias/123/banner.png                  # object PW1, không row
pw1-flat-no-row.jpg                    # key phẳng, không row PW2 nào
canary/DO-NOT-DELETE.txt               # canary SEC-1 / NFR-05
pw2-backup/x.jpg   PW2/x.jpg   pw2     # key mập mờ (12-09, 01-13)
# PW2
pw2/t/{tA}/t{tA}-<hash32>-<uuid32>.webp               # media upload thường
pw2/t/{tA}/t{tA}-<hash32>-<uuid32>.webp (ai, unused_since -31d), (stock -31d), (seed -29d)
pw2/t/{tB}/t{tB}-<hash32>-<uuid32>.webp               # tenant B
pw2/private/t/{tA}/t{tA}-<uuid32>.pdf  # biên lai ORD-F48-1 (+ bản giống hệt cho ORD-F48-2, 04-25)
pw2/tmp/<uuid>                         # tmp còn sót
legacy-flat.jpg                        # row PW2 trước F48, filename = 'legacy-flat.jpg'
```
Row `media`: 1 row legacy PW1 (`filename` null, `url` host PW1; 10 row cho 13-10), 1 row PW2 key phẳng, ≥ 1 row ai/stock/seed/upload/import-url/system mỗi loại; 350 media cho tA (05-01); 40 media (12 không dùng) cho 11-05. Tham chiếu: 28 field FK (1 bản ghi mỗi field), block `{mediaId}`, block URL string (host CDN + S3 path-style), rich text, custom-html, đơn hàng item snapshot.

---

## 10. Quality Gates

| Nhóm | Trạng thái | Ghi chú |
|---|---|---|
| **1. S0 Bảo mật** (NHÓM 01–03) | [ ] 0/39 | **Blocker:** 01-07 đỏ→xanh, 01-02, 01-03, 01-13, 01-15, 01-16 (route private), 01-17 (xoá qua route sau S0, D68), 01-19 (carton placeholder, D70), 02-08 đỏ→xanh. Merge S0 trước mọi sprint khác |
| **2. Pipeline** (NHÓM 04) | [ ] 0/36 | 04-02 (EXIF), 04-05 (50MP), 04-08, 04-10, 04-22..26, 04-29/04-30 (key ghép D64), 04-31 (tenant NULL, D71), 04-32 (`deduped`, D72), 04-33 (ETag video, D83), 04-13/04-34..36 (D87/B1); 04-23 (NFR-08) trước khi bỏ `media-create-lock` |
| **3. Thư viện + picker + 18 điểm** (05–08) | [ ] 0/49 | 07-08 smoke 18/18; 07-12 QR thanh toán (D73, vùng payment); 08-05 SSRF |
| **4. Thư mục + quyền** (09–10) | [ ] 0/23 | 10-03 đỏ→xanh; 09-08/09-13 đồng thời |
| **5. Vòng đời + GC + quota** (11–13) | [ ] 0/54 | 11-15 (QR đang bật, D78), 11-16/13-12 (authz usages/quota); 12-07 lease GC (D77); **12-08 (NFR-05) + 12-17 (audit key) + 12-18 (mồ côi theo key ghép) bắt buộc PASS trước khi bật `MEDIA_GC_ENABLED`**; 13-10, 13-11 + đối soát mọi tenant trước khi bật chặn quota; 12-19 (phủ ≤ 7 ngày), 12-20..26 (D87 cleanup/audit/publish/Ops) trước khi bật cron production; ≥ 2 dry-run staging được rà; nhánh key phẳng chỉ mở sau 4 báo cáo dry-run sạch (D46) |
| **6. Media sản phẩm S5** (14–15) | [ ] 0/18 | 15-04 DB không có cột category; 15-06 snapshot đơn; 14-10/14-11 policy ảnh khớp DAM (D84). Nhóm 16: 5 TC hoãn D88, không là gate S5 |
| **7. NFR hiệu năng** | [ ] Not Run | 04-18, 05-08, 11-08, 04-19, 04-23 (NFR-08), 12-19 (NFR-S4-05) — số đo ghi PR |
| **8. a11y + i18n** | [ ] Not Run | axe 0 serious/critical; 0 khoá ms thiếu |
| **9. E2E UAT** | [ ] Not Run | 4 kịch bản §8 |

> **Khuyến nghị release:** chặn release nếu bất kỳ TC Blocker fail. Không chạy TC xoá/GC/SEC-1 trên bucket DO thật. Không bật xoá thật GC trên production trước khi 12-08 pass trên MinIO và có ≥ 2 báo cáo dry-run staging; xoá key phẳng cần thêm 4 báo cáo dry-run sạch liên tiếp (D46).

---

## 11. Traceability Matrix

### 11.1 Story → AC → TC

| Story | AC → TC (1-1) | TC bổ sung | Tổng |
|---|---|---|---|
| US-F48-01 | AC-1..6 → 01-01..06 | 01-07..19 | 19 |
| US-F48-02 | AC-1..7 → 02-01..07 | 02-08..13 | 13 |
| US-F48-03 | AC-1..4 → 03-01..04 | 03-05..07 | 7 |
| US-F48-04 | AC-1..8 → 04-01..08 | 04-09..36 | 36 |
| US-F48-05 | AC-1..7 → 05-01..07 | 05-08..18 | 18 |
| US-F48-06 | AC-1..6 → 06-01..06 | 06-07..11 | 11 |
| US-F48-07 | AC-1..7 → 07-01..07 | 07-08..12 | 12 |
| US-F48-08 | AC-1..4 → 08-01..04 | 08-05..08 | 8 |
| US-F48-09 | AC-1..6 → 09-01..06 | 09-07 (= AC-12 PRD S3), 09-08..14 | 14 |
| US-F48-10 | AC-1..5 → 10-01..05 | 10-06..09 | 9 |
| US-F48-11 | AC-1..7 → 11-01..07 | 11-08..16 | 16 |
| US-F48-12 | AC-1..7 → 12-01..07 | 12-08..26 | 26 |
| US-F48-13 | AC-1..6 → 13-01..06 | 13-07..12 | 12 |
| US-F48-14 | AC-1..6 → 14-01..06 | 14-07..11 | 11 |
| US-F48-15 | AC-1..6 → 15-01..06 | 15-07 | 7 |
| US-F48-16 | AC-1..4 → 16-01..04 | 16-05 | 5 |
| **TỔNG** | **96/96 AC (100%)** | 128 | **224** |

### 11.2 FR → TC

> Gom theo FR gốc; FR con (vd FR-04a, FR-31e) ghi kèm ở dòng FR gốc.

| FR | TC |
|---|---|
| FR-01 / FR-01a | 01-02, 01-06..10, 01-13..15, 01-18, 01-19 / 12-17, 12-23..25 |
| FR-02 | 01-05, 01-16 |
| FR-03 | 02-01, 02-02, 02-08, 04-15 |
| FR-04 / FR-04a | 02-03, 02-09 / 05-18 (CSRF, D43) |
| FR-05 | 02-04, 02-10 |
| FR-06 | 02-05, 03-04 |
| FR-07 | 02-06, 04-20 |
| FR-08 | 02-07 |
| FR-09 | 03-01..03 |
| FR-10 / FR-10a | 04-20, 07-09, 04-28 / 04-22, 04-23, 04-17, 04-32 |
| FR-11 | 04-01, 04-05, 04-12..16, 04-33 |
| FR-12 | 04-01, 01-09, 02-13, 04-21, 04-24, 04-29, 04-30, 12-18, 04-34..36, 12-20 |
| FR-13 | 04-03, 04-10, 04-25..27, 04-31, 04-32, 04-34..36, 12-20 |
| FR-14 | 04-04, 07-03 |
| FR-15 | 05-01, 05-02, 05-11, 05-12 |
| FR-16 | 01-01, 05-03, 05-13, 05-18 |
| FR-17 | 05-04, 05-15, 05-18 |
| FR-18 | 05-05 |
| FR-19 | 06-01, 06-10, 06-11 |
| FR-20 | 07-01, 07-08, 07-12 |
| FR-21 | 07-02, 07-10 |
| FR-22 | 08-01..08 |
| FR-23 | 09-01, 09-09 |
| FR-24 | 09-04, 09-12, 09-13 |
| FR-25 | 09-05, 09-10, 09-14 |
| FR-26 | 10-01, 10-06, 10-07 |
| FR-27 | 10-04 |
| FR-28 | 11-01, 11-02, 11-09, 11-14, 11-16, 16-04 |
| FR-29 | 12-20, 12-21, 11-03, 11-04, 11-12, 11-15, 07-10, 01-17 |
| FR-30 | 11-05, 11-11 |
| FR-31 (a–e) | 12-01..04, 12-06..26 (FR-31a/D66: 12-19; FR-31e: 12-15, 12-18, 04-13) |
| FR-32 | 12-05 |
| FR-33 | 13-01..12, 06-04 |
| FR-34 | 14-01..11 |
| FR-35 (a–f) | 15-01..07 (FR-35e/f: 15-06) |
| FR-36 | 16-01..05 |

36/36 FR gốc (FR-01..FR-36) có ≥ 1 TC — kiểm bằng bảng trên (mỗi dòng FR gốc có ≥ 1 TC). FR con chỉ ghi kèm khi có TC riêng, không khẳng định phủ đủ mọi FR con.

---

## 12. Câu hỏi mở / Điểm mơ hồ cần BA & Dev chốt

| # | Câu hỏi | TC ảnh hưởng | Owner | Trạng thái |
|---|---|---|---|---|
| Q1 | Số quota từng gói (D9) — soft launch `UNLIMITED` (D53) | 13-01..04, 13-09 | PO | ✅ Soft launch `UNLIMITED`, số chốt sau S4 (D88) — TC chạy với số giả trong fixture (`starter 2048 MB`, `free 500 MB`) |
| Q2 | Gallery 10 ảnh (D11) | 14-01, 14-08 | PO | ✅ 10 (D88) — TC đọc `MAX_PRODUCT_IMAGES`, không hard-code |
| Q3 | Mục sidebar "Media" (D13) | 10-04 | PO | ✅ Đồng ý (D88) — TC chỉ còn nhánh có mục sidebar |
| Q4 | Key Spaces riêng, bucket listing; domain CDN (tuỳ chọn, D16) | 03-01..04 | Ops | ⬜ Open |
| Q5 | Bản dịch ms do người bản ngữ rà | 05-07, 02-11, 16-05 | PO/Content | ⬜ Open |
| Q6 | Spike `@payloadcms/storage-s3` 3.91 (cơ chế bỏ qua xoá object, `generateFileURL` với prefix) — unique `filename` + cột `prefix`/`_objectkey` đã xác minh (D56) | 01-03, 01-07, 01-13 | Dev (S0) | ⬜ Open |
| Q7 | Khôi phục ảnh danh mục ở header `products-grid` (D74, đảo #1587) | 16-01..05 | PO | ⏸ Hoãn (D88) — NHÓM 16 không chạy tới khi mở lại |

**Đã chốt (bản trước Q1–Q12):** ICO favicon → D37 (04-15, 06-03) · ảnh động → D38 (04-16) · object mồ côi khi INSERT lỗi → D39 (04-13, 12-15) · đóng picker khi upload → D40 (06-11) · lưu báo cáo GC → D41/D47 (12-13) · MinIO trong CI → D42 (§2) · key phẳng chỉ đúng `filename` → D21 · AC-6 US-F48-01 từ chối 400 → D22 (stories đã sửa) · mã lỗi → bảng lỗi PRD S0–S5 (cột Kỳ vọng đã ghi mã) · CSRF → D43 (05-18) · media đơn hàng không force → D44 (11-07, 11-10) · lifecycle DO kiểm sau 48h, không chặn release S1 → D45 (12-06) · review độc lập: `_objectKey` → D55 (01-02, 01-15) · filename unique/prefix → D56 (02-13, 04-01, 04-03) · không dedupe private → D57 (04-25, 04-26) · guard so `originalDoc` + REST 403/route 404 → D58 (01-04, 01-11, 01-14) · ingest + NFR-08 → D59 (04-22, 04-23) · pooler/xact lock → D60 (04-10, 12-07, 13-03) · GC hằng ngày 45 s + breaker → D61 (12-11, 12-16) · M1–M8 + Low → D62 · review 2: key ghép `[prefix, _objectKey, filename]`, v2 `_objectKey` NULL → D64 (04-29, 04-30, 12-18) · `originalDoc` + chặn bulk update → D65 (01-02) · GC chỉ tenant có ứng viên, phủ ≤ 7 ngày → D66 (12-19, 12-11) · trừ quota đúng 1 lần → D67 (13-11, 13-10) · **review lượt 3:** xoá qua route `assertCanManageMedia` + `overrideAccess:true` → D68 (01-17) · chỉ khoá update → D69 (01-18) · guard chỉ REST/GraphQL → D70 (01-19, 01-02) · tenant NULL không dedupe, uuid32 → D71 (04-31) · `{deduped}` không xoá bù → D72 (04-32) · QR kiểm tenant/private/image → D73 (07-12) · ảnh danh mục ở header `products-grid` → D74 **Chờ PO** (16-02, 16-04) · GC lease → D77 (12-07) · QR đang bật không force → D78 (11-15) · authz route private/usages/quota (01-16, 11-16, 13-12) · quyền route private → D79 (01-16) · mã lỗi QR → D80 (07-12).

---

**End of Test Plan F48**
