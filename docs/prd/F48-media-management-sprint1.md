# PRD: Media Management — Sprint 1: Pipeline & thư viện (F48-S1)

> **Version:** 1.0 | **Created:** 2026-11-09 | **Agent:** `docs-engineer`
> **Priority:** P0 | **Sprint:** F48 — S1 | **Size:** L (8–10 ngày)
> **Depends on:** F48-S0 (validator, field lock, rate limit) | **Blocks:** F48-S2 (picker), S3 (thư mục), S4 (vòng đời)
> **Overview:** [F48-media-management-overview.md](./F48-media-management-overview.md) · **Stories:** [F48-media-management-stories.md](../stories/F48-media-management-stories.md) · **Architecture:** [F48-media-management.md](../architecture/F48-media-management.md) · **Design:** [F48-media-management-design.md](../design/F48-media-management-design.md) · **QA:** [F48-media-management.md](../qa/F48-media-management.md) · Code tham chiếu: staging `5c3e3bdca`

---

> [!IMPORTANT]
> AC ở Section 11 copy nguyên văn từ [stories](../stories/F48-media-management-stories.md) (Status **Draft**). TC-ID `TC-F48-04-xx`, `TC-F48-05-xx` trong `docs/qa/F48-media-management.md`.

---

## 0. Story Traceability

| Story ID | Tiêu đề | File | Status |
|---|---|---|---|
| US-F48-04 | Pipeline upload hợp nhất: client nén → tmp → register xử lý server (D5–D7), quota per-file | [stories](../stories/F48-media-management-stories.md#us-f48-04) | Draft |
| US-F48-05 | Thư viện /media: phân trang server, tìm/lọc/sắp xếp, chi tiết, sửa metadata, xoá nhiều, kéo thả, i18n | [stories](../stories/F48-media-management-stories.md#us-f48-05) | Draft |

### 0.1 Hiện trạng (audit code)

| File | Hiện trạng |
|---|---|
| `src/hooks/use-direct-upload.ts` (157 dòng) | Đường B: `POST /api/media/presign` → POST multipart S3 → `POST /api/media/register`; lỗi CORS/network có log riêng |
| `src/hooks/use-upload-progress.ts` (106 dòng) | Thử B, fallback A (`XMLHttpRequest` tới `/api/media/upload`, tiến trình cap 95%) |
| `src/lib/media/compress-image.ts` | Client: chỉ re-encode khi > 1920px hoặc > 2 MB, WebP q0.85; `processImageFile` (`src/lib/utils/image`) là bản thứ hai |
| `src/lib/media/media-key.ts` | Key phẳng `u{userId}-{slug}-{uuid}.{ext}`. Comment code cho rằng collection không có `prefix` — **sai so với DB**: đã xác minh bảng `media` có cột `prefix`, `_objectkey`, `width`, `height` và unique index `media_filename_idx(filename)` toàn bảng (D56) |
| `src/lib/media/register-media.ts` | `INSERT INTO media (alt, filename, mime_type, filesize, tenant_id, private, …)` trực tiếp vì `payload.create` không nhận doc không file; `url` ảo qua `generateFileURL` |
| `src/app/api/media/register/route.ts` | HeadObject + đọc 12 byte magic; **không** re-encode, không hash, không dedupe; key cuối = key presign |
| `src/lib/media/upload-limits.ts` | `UPLOAD_LIMITS` ảnh 10 MB / video 100 MB / pdf 20 MB; nhưng `ImageUploader` 5 MB, QR 2 MB, `compressImage` 2 MB rải rác |
| `src/lib/media/workspace-media-library.ts` | `MEDIA_LIBRARY_LIMIT = 200`, 2 query (owned + legacy được dùng), sort trong bộ nhớ |
| `src/app/api/media/library/route.ts` | `GET` trả toàn bộ ≤ 200 row + `canDelete`, không tham số |
| `src/app/api/media/library/[id]/route.ts` | `DELETE` từng file (GH-2187) |
| `src/app/(dashboard)/media/page.tsx` (372 dòng) | Upload qua đường A (`fetch('/api/media/upload')`), không phân trang, không sửa alt |
| `src/payload.config.ts:215-235` | `s3Storage({ collections: { media: { disableLocalStorage, disablePayloadAccessControl, generateFileURL: s3PublicUrl(filename, prefix) } }, acl: 'public-read', forcePathStyle: true })` |

---

## 1. Problem Statement

- 4 đường ống, 3 hàm nén khác nhau, giới hạn 2/5/10 MB rải rác → hành vi upload khác nhau giữa các màn hình; file > 4,5 MB qua đường A/C lỗi trên Vercel.
- Server không xử lý lại ảnh: EXIF/GPS (SEC-3) và nội dung polyglot đi thẳng vào bucket; PNG chiếm 74% byte, trung bình ~600 KB/file, 42/472 ảnh mẫu > 2000px.
- Key phẳng theo tên file gốc (đoán được), không theo tenant → GC an toàn theo prefix không thể làm được.
- Không dedupe → cùng ảnh upload lại tạo object mới.
- Thư viện cap 200, không tìm/lọc/sửa alt/xoá nhiều; trang 372 dòng khó bảo trì. PW1: p90 31 file/store, max 298.

---

## 2. Target User

- Chủ shop/staff có quyền `media` (S3) — thao tác chính trên điện thoại, mạng di động không ổn định.
- Hệ thống nội bộ (AI generate, seeder, carton placeholder) — ghi `createdVia`.

---

## 3. Solution Overview

1. **Server pipeline (D87 thay D76):** đọc tmp → magic/sharp/sha256 → BEGIN hash lock tenant + full SHA → SAVEPOINT → dedupe primary. Hit: Head key cũ, không ghi object/quota; missing ⇒ 404 `MEDIA_UPLOAD_MISSING`, không tái tạo key. Miss: cấp UUID mới, allocation intent → Put/Copy key mới → Head → quota/INSERT/DTO → COMMIT. Replay đọc đúng id/key primary dưới lock, không hồi sinh row đã xoá. Xem [arch §3.4](../architecture/F48-media-management.md#34-register-fr-1113-d5d7) và [lifecycle §8.6](../architecture/F48-media-management-lifecycle.md#86-d87--key-phiên-bản-và-cleanup-bền-vững-thay-d76).
2. **Client** một hook `useMediaUpload` + `MediaUploadButton`: nén (≤ 2560px WebP), hàng đợi nhiều file (3 song song), tiến trình từng file, retry từng file.
3. **`uploadToken`** (HMAC) thay regex key: presign cấp token với claims chuẩn `{v, uploadId, key, userId, tenantId, purpose, contentType, maxBytes, exp}` ([arch §3.3](../architecture/F48-media-management.md#33-presign-fr-07-sec-10), D75); register chỉ nhận token hợp lệ.
4. **Thư viện**: API list cursor + search/filter/sort server, PATCH metadata, bulk delete ≤ 100; trang `/media` tách component.

---

## 4. Scope

### In Scope
- FR-10..FR-18 (kèm FR-10a `ingestMediaBuffer` + bảng caller §7.1); migration `content_hash`, `created_via`, `display_name`, `uploaded_by_id`, index.
- Đường A (`/api/media/upload`) và C (`uploadMediaAction`) chuyển nội bộ sang cùng `processMedia()` (fallback khi S3 không cấu hình — local dev). UI mới không gọi A/C.
- Server flows (AI `src/lib/ai/upload-media.ts`, seeder, carton placeholder) ghi `createdVia` (`ai | stock | seed | system`).
- Badge "Legacy" cho row PW1 (`filename` null) trong thư viện (D21).

### Out of Scope
- Picker và tích hợp 18 điểm (S2); thư mục (S3, nhưng API đã nhận tham số `folder` dạng chừa chỗ); usage scan/"Chưa dùng"/quota tenant (S4).
- Re-encode ảnh của luồng D (avatar, proof, feedback, studio, AI attachments) — chỉ dùng validator S0.
- Backfill `content_hash` cho media cũ.

---

## 5. Success Metrics

| Metric | Target | Đo bằng |
|---|---|---|
| Byte TB/ảnh mới (bộ 472 ảnh mẫu) | giảm ≥ 50% (NFR-04) | Script benchmark trước/sau |
| Ảnh mới còn EXIF/GPS | 0% | exiftool trên 50 ảnh điện thoại |
| `register` ảnh 5 MB p95 | < 3 s (NFR-01) | Log thời gian staging, 200 mẫu |
| `GET /api/media/library` 50 item p95 | < 500 ms @ 5.000 file (NFR-02) | k6 staging |
| Upload > 4,5 MB thành công | 100% (không qua body function) | Test e2e 8 MB PNG |
| Hằng số giới hạn ngoài `media-upload-policy.ts` | 0 | grep `1024 \* 1024` trong `src/components`, `src/blocks` |

---

## 6. User Story Summary

```
AS A   chủ shop
I WANT mọi ảnh/video đi qua một đường duy nhất, được nén, xoá metadata và chuẩn hoá trên server
SO THAT upload file lớn không lỗi, ảnh nhẹ hơn, GPS không lộ và không lưu trùng
```
```
AS A   chủ shop
I WANT thư viện xem toàn bộ file, tìm nhanh, sửa alt/chú thích, xoá nhiều
SO THAT tôi tái sử dụng ảnh và giữ thư viện gọn
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|---|---|---|:-:|---|
| FR-10 | Hook `useMediaUpload` + `MediaUploadButton` duy nhất: nhận `accept`, `purpose`, `multiple`, `maxFiles`; input khai `accept` MIME tường minh (`image/jpeg,image/png,image/webp…`, không `image/*` — iOS tự đổi HEIC→JPEG, M7); nén client (cạnh dài ≤ 2560, WebP q0.85, giữ PNG có alpha → WebP alpha; file kết quả mang đúng `blob.type`, M7) — bỏ qua với video/ico; tự chọn nhánh theo `pipeline: 'v1'|'v2'` của presign (M8); hàng đợi 3 song song; tiến trình %/file; retry từng file; huỷ; thông báo `aria-live`. Thay `useDirectUpload`, `useUploadProgress`, `compressImage`, `processImageFile` | US-F48-04 | P0 | Hook cũ giữ wrapper deprecated tới hết S2 |
| FR-10a | **`ingestMediaBuffer` + bảng caller đầy đủ (D59):** mọi đường server tạo media từ buffer (AI, stock, seed, QR, avatar, placeholder, proof) gọi lõi chung `ingestMediaBuffer({ buffer, tenantId, createdVia, … }): Promise<{ doc, deduped }>` (normalize + key §FR-12 + dedupe + SQL insert — architecture §3.6) thay `payload.create({file})`. Mỗi caller ở bảng §7.1 **phải** set `created_via`. **D72:** caller **cấm xoá bù** row trả về khi `deduped = true` (row dùng chung) — sửa các nhánh xoá bù hiện có: `users/me/avatar/route.ts:71`, `apply-avatar-state.ts:88`, `actions/media.ts:62`, `save-product.ts:115` (2 chỗ sau thêm điều kiện `replacedStaleId !== doc.id`); TC "xoá bù không xoá row dedupe" (QA F48). **D71:** `tenantId` NULL (avatar, carton global) → không dedupe, filename `u{userId}-{uuid32}` / `g-{uuid32}` (prefix `pw2/g`), `content_hash` NULL. **D78:** `ingestMediaBuffer` dùng chung flag `MEDIA_PIPELINE_V2_ENABLED` — off ⇒ `payload.create({file})` cũ, trả `deduped: false`. Global mutex `media-create-lock.ts` chỉ bỏ khi TC thay thế pass (TC-F48-04-22, TC-F48-04-23 và **cập nhật TC-GENPERF-W2-07** ở `docs/qa/F01-gen-perf.md` — việc của PR S1, tài liệu F48 chỉ ghi chú). `sharp.concurrency` thấp chỉ đặt trong route register. NFR-08: generate site p95 không tăng > 10% | US-F48-04 | P0 | D59. TC-F48-04-22, -23 |
| FR-11 | `register` xử lý server: GetObject tmp (ảnh ≤ 10 MB) → validator S0 → sharp `rotate()` + strip EXIF/XMP/IPTC + `limitInputPixels 50MP` + resize `inside` 2560 `withoutEnlargement` + WebP q80 — bản lưu > 3 MB ⇒ hạ q70→q60 rồi cạnh 2048→1600 tới ≤ 3 MB, không từ chối (D84, khớp DAM; TC-F48-14-11) (`purpose=favicon`: PNG/JPEG/WebP → PNG ≤ 512px; ICO chỉ nhận với `purpose=favicon`, passthrough, kiểm magic + ≤ 256×256 + ≤ 1 MB — D37; `purpose=payment-qr`: WebP lossless — D36). WebP/PNG động → lấy khung đầu, client cảnh báo "ảnh động sẽ thành ảnh tĩnh" (D38). Ảnh hỏng → 422 `MEDIA_INVALID_FILE`; > 50MP → 422 `MEDIA_TOO_MANY_PIXELS`. SAVEPOINT sau hash lock trước quota/INSERT; SQL exception ⇒ ROLLBACK TO trước mọi SELECT, hoàn quota; allocation intent trước Put bảo đảm cleanup key thử không row sau rollback/mất connection (D39/D87, lifecycle §8.6), không xoá key dedupe. Video: kiểm magic + size, không re-encode; **D83:** giữ `ETag` từ `HeadObject`, `GetObject` (magic + hash) với `IfMatch`, `CopyObject` với `CopySourceIfMatch` — lệch (object tmp bị tráo) ⇒ xoá tmp, 409 `MEDIA_KEY_INVALID`, không row (TC-F48-04-33) | US-F48-04 | P0 | D5, D87 (thay D76), D83. Route `maxDuration` 60 s (`vercel.json` glob `src/app/api/**/*.ts` = 120 — Low review 3); deadline nội bộ 25 s quyết định |
| FR-12 | Key: tmp `pw2/tmp/{uuid}`; cuối `pw2/t/{tenantId}/t{tenantId}-{sha256[0..31]}-{uuid32}.{webp|png|ico|mp4|webm}`; private `pw2/private/t/{tenantId}/…`; avatar (không tenant) `pw2/u/{userId}/…` (D36); media global khác (tenant NULL, vd carton) `pw2/g/…` (D71). Lưu **chỉ** `prefix = 'pw2/t/{tenantId}'`, `_objectKey = NULL` (D64), `filename = 't{tenantId}-{hash32}-{uuid32}.{ext}'` (avatar: `pw2/u/{userId}` + `u{userId}-{uuid32}.webp`; global: `pw2/g` + `g-{uuid32}.{ext}`; private: `pw2/private/t/{tenantId}` + `t{tenantId}-{uuid32}.{ext}` — row tenant NULL và private không dedupe, `content_hash` NULL, D57/D71) vì `media_filename_idx` unique toàn bảng (D56, đã xác minh). Storage key = join phần khác rỗng của `[prefix, _objectKey, filename]` (như plugin `buildPrefixWithObjectKey` + `mediaObjectKeys()`); ghi cùng giá trị vào cả `prefix` và `_objectKey` sẽ thành `pw2/t/1/pw2/t/1/…` ≠ key `PutObject` — URL đọc, xoá, GC đều dùng key ghép này (TC-F48-04-29, TC-F48-04-30, TC-F48-12-18); không dùng `filenameCompoundIndex`; `generateFileURL` dùng host CDN (FR-09) nếu có. Presign cấp `uploadToken` HMAC-SHA256 (khoá dẫn xuất HKDF từ `PAYLOAD_SECRET`, không env mới — D36) với claims chuẩn [arch §3.3](../architecture/F48-media-management.md#33-presign-fr-07-sec-10) `{v, uploadId, key, userId, tenantId, purpose, contentType, maxBytes, exp}` (D75); register từ chối token sai/khác user → 400 `MEDIA_KEY_INVALID`, hết hạn → 400 `MEDIA_UPLOAD_EXPIRED`. Pipeline mới bật bằng env `MEDIA_PIPELINE_V2_ENABLED` (D36); **flag off (M8):** presign/register giữ hợp đồng cũ, presign trả `pipeline: 'v1'` (TC-F48-04-24) | US-F48-04 | P0 | D6, D56, D64. Thay regex key S0 |
| FR-13 | Dedupe `(tenant_id, content_hash)` **chỉ row `private = false`** (D57; private: `content_hash` NULL, không dedupe): hash = sha256 của **byte đã xử lý**. Register lấy `pg_advisory_xact_lock(hashtextextended(tenantId || ':' || fullSha256, 0))` (cùng helper D87) trong transaction (client `pool.connect()`, D60) trước khi kiểm/ghi (M5). **D87:** dedupe trước Put; hit Head key row cũ dưới hash lock, missing ⇒ 404 `MEDIA_UPLOAD_MISSING`, không overwrite/repair. Chỉ miss sinh UUID mới + allocation intent trước Put/Copy rồi quota/INSERT trong tx; key đã cấp không tái sử dụng. Trùng → trả row cũ (`deduped: true`), xoá tmp, không INSERT, không cộng quota; row trùng có `created_via ∈ {ai, stock, seed}` → nâng `created_via = 'upload'`, `unused_since = NULL` (M4). Race: `INSERT … ON CONFLICT DO NOTHING RETURNING *` → nếu rỗng ROLLBACK TO SAVEPOINT hoàn quota rồi đọc row thắng + Head key cũ; allocation thử được dọn qua intent. **DTO đọc lại bằng chính client transaction**, không qua `payload.find/findByID` (staging có `DATABASE_URI_READ_REPLICA` — đọc sau INSERT thô có thể trượt replica, D87). Không dedupe chéo tenant; row tenant NULL không dedupe (D71) | US-F48-04 | P0 | D7, D57. TC-F48-04-25..27 |
| FR-14 | `media-upload-policy.ts` nguồn duy nhất (thay `upload-limits.ts`, re-export tạm — tên theo arch §6, D75): ảnh 10 MB (trước nén), video 100 MB, PDF proof 5 MB, ICO 1 MB; độ dài alt 250, caption 500, displayName 120 (D32); số file/batch 20; export cho client + server | US-F48-04 | P0 | Xoá hằng số rải rác |
| FR-14a | `createdVia` bắt buộc trên mọi row mới: `upload` (merchant), `import-url` (S2), `ai`, `stock`, `seed`, `system` (carton, placeholder, SSO avatar), `proof` (biên lai). Server flows ghi giá trị theo bảng caller §7.1 (FR-10a) | US-F48-04 | P0 | Tiền đề GC S4 |
| FR-15 | `GET /api/media/library`: cursor (opaque base64 `{sortValue,id}`), `limit` 1–100 (mặc định 50), `sort` ∈ `-createdAt|createdAt|displayName|-filesize`, `type` ∈ `image|video|all`, `q` (≤ 100 ký tự, tìm `display_name`/`alt` bằng `ILIKE` không phân biệt hoa thường, escape `%`/`_`; **không dùng `unaccent`** — D62), `folder` (chừa cho S3). Phạm vi: row của tenant + row legacy không tenant mà site/page/SP/blog của tenant đang dùng (giữ hành vi TC-PERF-168); không bao giờ row private | US-F48-05 | P0 | Bỏ cap 200 |
| FR-16 | `PATCH /api/media/library/{id}` chỉ nhận `alt`, `caption`, `displayName` (+`folderId` S3). Validate độ dài D32; field khác → 400 `MEDIA_FIELD_READONLY`; tenant khác/global/private → 404. Staff không có `media` chỉ sửa media `uploaded_by = mình` (D26, áp từ S3) | US-F48-05 | P0 | D15 |
| FR-17 | `POST /api/media/library/bulk-delete` `{ ids: number[] }` 1–100 id; xử lý từng id với cùng luật xoá đơn (quyền, D21 guard); trả `{ deleted, kept: [{id, reason}], cleanupPending: number[] }`; D87: intent trước COMMIT, S3 sau COMMIT. S3 lỗi ⇒ id vẫn `deleted`, thêm `cleanupPending`; DB/intent lỗi trước COMMIT ⇒ item giữ row và `kept` reason `delete_failed`, không trừ quota. Worker retry không được xoá key phiên bản mới. > 100 → 400 `MEDIA_BULK_LIMIT`. Rate limit 10/user + 20/tenant mỗi phút (D32). S4 bổ sung lý do `in_use`. **D34:** nút + route ẩn sau `MEDIA_BULK_DELETE_ENABLED` (mặc định `false`; flag tắt → route trả 404 `MEDIA_NOT_FOUND`); chỉ bật sau khi S4 có usage scan | US-F48-05 | P0 | D28: không bulk force |
| FR-18 | Trang `/media` mới: lưới ảnh (`next/image` thumbnail 256px), "Tải thêm"/cuộn vô hạn, ô tìm, lọc loại, sắp xếp, chọn nhiều (checkbox, Shift+click, long-press mobile), panel chi tiết (preview, px, dung lượng, ngày, `createdVia`, sao chép URL, sửa metadata), kéo thả nhiều file, badge "Legacy", trạng thái rỗng/lỗi/loading, i18n en/ms; mỗi file < 200 dòng | US-F48-05 | P0 | Thay `page.tsx` 372 dòng |

### 7.1 Bảng caller `ingestMediaBuffer` (FR-10a, D59)

| Caller (file) | `created_via` | Private? | Ghi chú |
|---|---|:-:|---|
| `src/lib/ai/generate-site-service.ts` | `ai` | Không | Generate/regenerate site; đo NFR-08 (TC-F48-04-23) |
| `src/lib/ai/media-injector.ts` | `ai` / `stock` | Không | Ảnh chèn vào block khi generate |
| `src/lib/ai/media-pipeline.ts` (`uploadBufferToMedia`) + `src/lib/ai/pool-preupload.ts` | `ai` / `stock` | Không | Đang qua `media-create-lock`; TC-GENPERF-W2-07 (F01) cần cập nhật khi bỏ mutex |
| `src/lib/ai/upload-media.ts` (`uploadImageBuffer`) | `ai` | Không | |
| `src/lib/ai-platform/appliers/picture-ingest.ts` | `ai` | Không | Bổ sung từ grep `media-create-lock` (ngoài danh sách D59) |
| `src/lib/images/image-library-seeder.ts` | `seed` | Không | Giữ dedupe theo `alt` `imglib:s{N}:`; hash là lớp 2 |
| `src/lib/ai/generate-sample-products.ts` | `seed` | Không | |
| `src/lib/ai/seed-blog-posts.ts` | `seed` | Không | |
| `src/lib/products/save-product.ts` | `upload` | Không | Ảnh SP merchant tạo từ buffer khi lưu; xoá `replacedStaleId` (`:115`) chỉ khi `!== doc.id` (D72) |
| `src/app/(dashboard)/settings/payments/actions.ts` (`uploadQrMedia`) | `upload` | Không | Purpose `payment-qr`, WebP lossless; 10/user/giờ. **D73 (vùng payment):** cùng PR đổi kiểm quyền lưu QR (`actions.ts:178`, hiện ``alt === `qr-${tenantId}` ``) sang `media.tenant === tenantId && !media.private && mimeType` `image/*` — dedupe/ảnh thư viện có alt khác sẽ bị từ chối nếu giữ kiểm alt (BR-11) |
| `src/lib/media/carton-placeholder.ts` | `system` | Không | Có tenant → key tenant thường (dedupe; caller kiểm `replacedStaleId !== doc.id` — D72); tenant null → `pw2/g/g-{uuid32}`, không dedupe (D71). Local API truyền `user` không bị guard S0 chặn (D70) |
| `src/lib/sso/avatar-sync/*` (`apply-avatar-state.ts`) | `system` | Không | Avatar: tenant null, `pw2/u/{userId}` + `u{userId}-{uuid32}.webp`, không dedupe (D71); nhánh xoá bù `:88` kiểm `deduped` (D72) |
| `src/app/api/users/me/avatar/route.ts` | `upload` | Không | Avatar user, không tính quota tenant; nhánh xoá bù `:71` kiểm `deduped` (D72) |
| `src/app/api/orders/[id]/upload-proof-direct/route.ts`, `upload-proof/route.ts` | `proof` | **Có** | `content_hash` NULL, không dedupe (D57), không quota (D24) |
| `src/app/api/media/upload/route.ts`, `src/app/(dashboard)/actions/media.ts` | `upload` | Không | Chỉ fallback local-dev (S3 chưa cấu hình) |
| `src/lib/migration/pw1-delta/delta-writer.ts` (+ `pw1-json/writer.ts`, `pw1-batch.ts`) | — | Theo nguồn | **Không upload**, chỉ đọc/ghi row; row PW1 `filename` null không tính quota (M6) |

---

## 8. Business Rules

- **BR-01:** Mọi ảnh merchant mới được lưu dưới dạng đã xử lý; file gốc không bao giờ được giữ lại (tmp xoá ngay sau register, lifecycle 1 ngày cho tmp sót).
- **BR-02:** `content_hash` + `tenant_id` là duy nhất khi `private = false AND content_hash IS NOT NULL` (D57); row cũ và row private (`content_hash` null) không tham gia dedupe.
- **BR-03:** Row trùng trả về giữ nguyên `alt`/`displayName` cũ; alt mới client gửi **không** ghi đè.
- **BR-04:** `filesize` lưu là kích thước sau xử lý; giới hạn per-file áp trên kích thước **trước** nén (client) và kích thước object tmp (server).
- **BR-05:** `displayName` mặc định = tên file gốc đã làm sạch (bỏ đuôi, ≤ 120 ký tự); `alt` mặc định **rỗng** (không còn "Block image"/"Uploaded media"; tên file không phải alt tốt) — UI nhắc nhập alt, storefront tự lùi về ngữ cảnh (tên SP/danh mục) khi alt rỗng. Chốt theo design §9.4.
- **BR-06:** Thư viện không hiển thị row private, row của tenant khác, row global không được tenant dùng.
- **BR-07:** Row PW1 (`filename` null) hiển thị badge "Legacy"; xoá chỉ xoá row (D21); không cho sửa file.
- **BR-08:** Xoá nhiều không bao giờ force; file không đủ quyền hoặc (S4) đang dùng nằm trong `kept`. Trước S4 tính năng tắt (D34).
- **BR-09:** Mỗi upload của `register` trừ rate limit theo D32 (60/user, 120/tenant mỗi phút).
- **BR-10:** `uploaded_by_id` ghi từ session khi register; server flows để null.
- **BR-11 (D73, vùng payment):** lưu QR thanh toán (`updatePaymentSettings`, `actions.ts:178`) chấp nhận media khi `media.tenant === tenantId`, `media.private !== true`, `mimeType` bắt đầu `image/` (đọc `findByID` `overrideAccess: true`); bỏ kiểm `alt === qr-{tenantId}`. Từ chối (D80): media tenant khác / không tồn tại → 404 `MEDIA_NOT_FOUND`; media private hoặc không phải `image/*` → 400 `MEDIA_UNSUPPORTED_TYPE` (mã có sẵn); không đổi QR. TC tenant chéo + private + ảnh từ thư viện (QA F48). Rủi ro R-S1-08.
- **BR-12 (D72):** caller `ingestMediaBuffer` không bao giờ xoá row trả về khi `deduped = true`.

---

## 9. User Flow

### 9.1 Upload (happy path + nhánh)
```
Chọn/kéo file → client kiểm loại + size (media-upload-policy.ts)
  ├── sai → lỗi inline theo file, các file khác tiếp tục
  ↓ nén (ảnh) → POST /api/media/presign {filename, contentType, size, purpose}
  ↓ nhận {url, fields, uploadToken} → POST multipart S3 pw2/tmp/{uuid} (tiến trình %)
  ├── mạng lỗi → file "Lỗi · Thử lại", không row
  ↓ POST /api/media/register {uploadToken, alt?, displayName?}
  ├── 415/413/422 → lỗi theo mã, tmp đã xoá
  ├── trùng hash → {deduped:true} → "Ảnh này đã có trong thư viện"
  └── 200 → ô mới xuất hiện đầu lưới
```

```mermaid
sequenceDiagram
    participant C as useMediaUpload
    participant P as /api/media/presign
    participant S as S3 bucket chung
    participant R as /api/media/register
    participant DB as Postgres
    C->>P: filename, contentType, size, purpose
    P-->>C: url, fields (key pw2/tmp/uuid, ảnh 60s / video 600s), uploadToken
    C->>S: POST multipart
    C->>R: uploadToken, alt, displayName
    R->>R: verify HMAC + user + exp
    R->>S: GetObject tmp
    R->>R: validator → sharp → sha256
    R->>DB: BEGIN; hash lock tenant + full SHA; SAVEPOINT; SELECT dedupe primary
    alt đã có
        R->>S: Head key cũ; missing → 404 (không repair)
        R->>DB: nâng created_via; DTO primary; COMMIT
        R-->>C: row/key cũ, deduped=true
    else mới
        R->>S: allocation intent; PutObject key hash32-uuid32 mới; Head
        R->>DB: quota + INSERT + DTO; COMMIT
        R->>S: ack allocation intent sau đối soát
        R-->>C: row mới
    end
    R->>S: DeleteObject tmp (finally)
```

### 9.2 Thư viện
```
/media → GET library?limit=50 → lưới + skeleton
  ↓ tìm/lọc/sắp xếp → GET mới (debounce 300 ms), reset cursor
  ↓ chọn ô → panel chi tiết → sửa → PATCH → cập nhật ô
  ↓ chọn nhiều → Xoá → dialog xác nhận → bulk-delete → toast "Đã xoá X, giữ lại Y" + danh sách lý do
```

---

## 10. Screen Layout

- **10.1 `/media` (desktop ≥ 1280px):** header (tiêu đề, nút Upload, ô tìm, lọc loại, sắp xếp), lưới 6 cột, thanh hành động khi chọn (số đã chọn, Xoá, Bỏ chọn), panel chi tiết bên phải 360px. Mobile 375px: lưới 2 cột, panel chi tiết dạng bottom sheet, long-press để chọn.
- **10.2 Panel chi tiết:** preview, thông số (px, KB, ngày, nguồn), URL + nút sao chép, form `displayName`/`alt`/`caption` có bộ đếm ký tự, nút Lưu/Xoá; badge Legacy khoá form file.
- **10.3 States:** Empty "No media yet / Belum ada media" + nút Upload; Empty tìm kiếm "No media found / Tiada media ditemui" + "Xoá bộ lọc"; Loading skeleton 12 ô; Error + nút Thử lại; dropzone overlay khi kéo file.
- **Design:** [F48-media-management-design.md](../design/F48-media-management-design.md) (màn S1 Thư viện, S2 Drawer chi tiết, S4 Xoá — ID màn hình, không phải sprint).

---

## 11. Acceptance Criteria (copy từ story — Status Draft)

### AC-01 (US-F48-04 AC-1): Upload ảnh lớn thành công — TC-F48-04-01
```gherkin
GIVEN chủ shop chọn ảnh PNG 8 MB, 4000×3000 px
WHEN  upload
THEN  client nén rồi PUT thẳng lên S3 vào `pw2/tmp/{uuid}`, không đi qua body function Vercel
  AND register trên server: kiểm magic, xoay theo EXIF orientation, resize cạnh dài ≤ 2560, encode WebP q80
  AND object cuối ở `pw2/t/{tenantId}/t{tenantId}-{sha256[0..31]}-{uuid32}.webp`, object tmp bị xoá
  AND row media có contentHash, width, height, filesize (sau xử lý), createdVia = "upload"
```

### AC-02 (US-F48-04 AC-2): Xoá EXIF/GPS — TC-F48-04-02
```gherkin
GIVEN ảnh JPEG chụp điện thoại có GPS, model máy, ngày chụp trong EXIF
WHEN  upload xong
THEN  file lưu trên S3 không còn EXIF/XMP/IPTC (kể cả GPS)
  AND ảnh hiển thị đúng chiều như khi chụp
```

### AC-03 (US-F48-04 AC-3): Trùng nội dung trong cùng tenant — TC-F48-04-03
```gherkin
GIVEN tenant A đã có media còn object có cùng nội dung sau xử lý (cùng contentHash)
WHEN  chủ shop A upload lại cùng ảnh
THEN  register trả về row cũ (hash tính trên byte sau xử lý, D36; chỉ dedupe row không private — D57), không tạo object/row mới, dung lượng đã dùng không tăng
  AND giữ nguyên id/key cũ sau Head dưới hash lock; object mất → 404 MEDIA_UPLOAD_MISSING, không ghi lại key (D87)
  AND UI báo "Ảnh này đã có trong thư viện" / "Imej ini sudah ada dalam pustaka"
GIVEN tenant B upload đúng ảnh đó
THEN  tạo row + object riêng của B (không dedupe chéo tenant)
```
> UI en: "This image is already in your library".

### AC-04 (US-F48-04 AC-4): Giới hạn per-file — TC-F48-04-04
```gherkin
GIVEN giới hạn từ upload-limits.ts: ảnh 10 MB trước nén, video 100 MB, PDF proof 5 MB
WHEN  chọn file vượt giới hạn
THEN  client chặn trước khi upload với thông báo nêu giới hạn
  AND nếu client bị bỏ qua, register/presign vẫn từ chối 413 "MEDIA_TOO_LARGE", xoá tmp
```

### AC-05 (US-F48-04 AC-5): Ảnh bom giải nén / hỏng — TC-F48-04-05
```gherkin
GIVEN ảnh có magic hợp lệ nhưng > 50 megapixel, hoặc dữ liệu hỏng sharp không giải mã được
WHEN  register xử lý
THEN  trả 422 "MEDIA_TOO_MANY_PIXELS" (quá pixel) hoặc "MEDIA_INVALID_FILE" (hỏng) với thông báo i18n, không tạo row, xoá tmp
  AND function không treo quá timeout (limitInputPixels 50MP)
```

### AC-06 (US-F48-04 AC-6): Video không re-encode — TC-F48-04-06
```gherkin
GIVEN chủ shop upload video MP4 60 MB đúng magic
WHEN  register
THEN  chỉ kiểm magic + size, không re-encode, object ở `pw2/t/{tenantId}/t{tenantId}-{hash32}-{uuid32}.mp4`
  AND file .mp4 có nội dung WebM/MKV giả mạo bị từ chối 415 "MEDIA_CONTENT_MISMATCH"
```

### AC-07 (US-F48-04 AC-7): Mất mạng giữa chừng — TC-F48-04-07
```gherkin
GIVEN đang upload 3 file, mạng mất khi file 2 ở 60%
WHEN  mạng trở lại hoặc user bấm "Thử lại"
THEN  file 1 đã xong giữ nguyên, file 2 hiện lỗi + nút thử lại, file 3 tiếp tục/chờ
  AND không tạo row cho file dở; object tmp còn sót bị lifecycle xoá sau ≤ 1 ngày
```
> Phụ thuộc lifecycle rule `pw2/tmp/` (thuộc FR-31) — **phải bật cùng S1** (xem Dependencies).

### AC-08 (US-F48-04 AC-8): Không register được key tmp của người khác — TC-F48-04-08
```gherkin
GIVEN user tenant A biết key tmp do presign cấp cho user tenant B
WHEN  gọi register với key đó
THEN  trả 400 "MEDIA_KEY_INVALID" (uploadToken HMAC không khớp user, D36), không tạo row, object của B không bị đọc/xoá
```

### AC-09 (US-F48-05 AC-1): Phân trang server, bỏ giới hạn 200 — TC-F48-05-01
```gherkin
GIVEN tenant có 350 media
WHEN  mở /media
THEN  trang đầu tải 50 item (sắp xếp mới nhất), cuộn/bấm "Tải thêm" lấy trang tiếp theo bằng cursor
  AND xem được đủ 350 item (không còn cap MEDIA_LIBRARY_LIMIT = 200)
```

### AC-10 (US-F48-05 AC-2): Tìm, lọc, sắp xếp phía server — TC-F48-05-02
```gherkin
GIVEN thư viện có ảnh và video
WHEN  gõ "kuih" vào ô tìm kiếm, lọc "Ảnh", sắp xếp "Dung lượng lớn nhất"
THEN  kết quả lọc theo displayName/alt/filename gốc trên server, chỉ ảnh, sắp xếp đúng
  AND không kết quả → trạng thái rỗng dùng key có sẵn `mediaLibrary.noMatch` "No files match your search" / "Tiada fail sepadan dengan carian anda" + nút xoá bộ lọc
```
> "filename gốc" = `display_name` mặc định lấy từ tên file gốc (BR-05); `filename` lưu trữ là hash nên không tìm theo đó.

### AC-11 (US-F48-05 AC-3): Xem chi tiết và sửa metadata — TC-F48-05-03
```gherkin
GIVEN chủ shop mở chi tiết một ảnh
WHEN  xem panel chi tiết
THEN  thấy preview, kích thước px, dung lượng, ngày tạo, nguồn (createdVia), URL sao chép được
WHEN  sửa alt (≤ 250 ký tự), caption (≤ 500), displayName (≤ 120) rồi lưu
THEN  lưu qua API metadata an toàn (FR-16), hiển thị ngay trong lưới
  AND vượt độ dài → lỗi inline, không lưu
```

### AC-12 (US-F48-05 AC-4): Chọn nhiều + xoá nhiều — TC-F48-05-04
```gherkin
GIVEN chủ shop chọn 30 media (checkbox hoặc Shift+click)
WHEN  bấm "Xoá" và xác nhận
THEN  xoá trong 1 request (≤ 100/lần); media đang dùng đi theo luật US-F48-11 (bị giữ lại + liệt kê lý do)
  AND trước S4, xoá nhiều ẩn sau `MEDIA_BULK_DELETE_ENABLED` (mặc định tắt); chỉ bật khi đã có usage scan (D34)
  AND kết quả báo "Đã xoá 27, giữ lại 3" và lưới cập nhật không cần tải lại trang
GIVEN chọn 101 media
THEN  nút xoá bị vô hiệu với thông báo "Tối đa 100 file mỗi lần"
```
> S1: `kept` gồm lý do `forbidden` / `legacy_shared` / `not_found`; lý do `in_use` có khi S4 (FR-29) xong. Theo D34, xoá nhiều chỉ bật (flag `MEDIA_BULK_DELETE_ENABLED`) sau khi S4 xong usage scan; TC-F48-05-04 chạy với flag bật trong môi trường test.

### AC-13 (US-F48-05 AC-5): Kéo thả nhiều file + tiến trình — TC-F48-05-05
```gherkin
GIVEN chủ shop kéo 5 file vào /media, 1 file là .svg
WHEN  thả
THEN  4 file hợp lệ upload qua pipeline US-F48-04 với tiến trình từng file
  AND file .svg hiện lỗi riêng, không chặn 4 file còn lại
```

### AC-14 (US-F48-05 AC-6): Tenant isolation và media private — TC-F48-05-06
```gherkin
GIVEN user tenant A
WHEN  gọi API list/search/metadata với tham số tenant hoặc id thuộc tenant B
THEN  chỉ thấy media của A; id của B trả 404
  AND media private (biên lai người mua) không xuất hiện trong thư viện
```

### AC-15 (US-F48-05 AC-7): i18n ms — TC-F48-05-07
```gherkin
GIVEN dashboard đặt ngôn ngữ Bahasa Melayu
WHEN  mở /media, panel chi tiết, hộp xác nhận xoá, thông báo lỗi upload
THEN  toàn bộ chuỗi hiển thị bằng BM, không còn chuỗi tiếng Anh/Việt cứng
```

---

## 12. Non-Functional Requirements

| ID | Category | Requirement | Notes |
|---|---|---|---|
| NFR-01 | Performance | `register` ảnh 5 MB p95 **< 3 s** | sharp + 2 lượt S3 + INSERT |
| NFR-02 | Performance | `GET /library` 50 item p95 **< 500 ms** với tenant 5.000 file | Index `(tenant_id, created_at DESC, id)` |
| NFR-04 | Chi phí | Byte TB/ảnh mới giảm **≥ 50%** | Benchmark 472 ảnh mẫu |
| NFR-08 | Performance | Thời gian **generate site** p95 không tăng **> 10%** so với baseline trước F48 (sau khi AI/seed chuyển sang `ingestMediaBuffer`, D59) | TC-F48-04-23; số ghi PR |
| NFR-S1-01 | Performance | `register` video 100 MB p95 **< 25 s** (stream hash + CopyObject) | maxDuration 60 s |
| NFR-S1-02 | Bộ nhớ | Peak RSS function `register` **< 512 MB** với ảnh 50MP | `sharp.concurrency(1)` chỉ trong route register (D59), `limitInputPixels` |
| NFR-S1-03 | UX | Lưới hiển thị skeleton < 100 ms, trang đầu (50 thumbnail) LCP **< 2,5 s** trên 4G | Thumbnail `next/image` w=256 |
| NFR-06 | i18n | 100% chuỗi `/media` + lỗi upload có en/ms | Test manifest |
| NFR-07 | A11y | Lưới: mũi tên, Space chọn, Enter chi tiết, focus rõ, `aria-label` mỗi ô; tương phản ≥ 4.5:1 | axe 0 lỗi nghiêm trọng |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Mô tả |
|---|---|---|
| Chuẩn hoá ảnh | `src/lib/media/normalize-image.ts`, `media-content-hash.ts` | sharp + hash, thuần (buffer in/out) |
| Register | `src/lib/media/register-upload-service.ts` | Bước 1–12 arch §3.4 cho `uploadToken` |
| Ingest nội bộ | `src/lib/media/ingest-media-buffer.ts` | Đường server (FR-10a), trả `{ doc, deduped }` |
| Row repository | `src/lib/media/media-row-repository.ts` | SQL insert/select/dedupe trong tx (thay `register-media.ts`) |
| `uploadToken` | `src/lib/media/media-upload-token.ts` | sign/verify HMAC (HKDF từ `PAYLOAD_SECRET`) |
| Key | `src/lib/media/media-object-key.ts` | build key `pw2/…`, `storageKey(row)` (D64) |
| S3 I/O | `src/lib/media/s3-object-io.ts` | head, readCapped, put, copy, delete (guard `pw2/`) |
| Policy | `src/lib/media/media-upload-policy.ts` | purpose → mime, max bytes, output (FR-14) |
| Thư viện | `src/lib/media/media-library-query.ts`, `media-dto.ts` | Cursor + filter SQL (thay `workspace-media-library.ts`); row → `MediaDTO` |
| Routes | `src/app/api/media/{presign,register}/route.ts`, `library/route.ts`, `library/[id]/route.ts` (+PATCH), `library/bulk-delete/route.ts` | |
| Hook | `src/hooks/use-media-upload.ts` | Queue, nén, presign, POST, register |
| UI | `src/components/media/media-library-page.tsx`, `media-grid.tsx`, `media-grid-item.tsx`, `media-toolbar.tsx`, `media-detail-drawer.tsx`, `media-upload-button.tsx`, `media-upload-queue.tsx` | Mỗi file < 200 dòng |

> Tên file chuẩn: [arch §6](../architecture/F48-media-management.md#6-module--file-layout-đích) (D75). Bảng này chỉ là tập con của S1.


### 13.2 Type definitions — hiện tại (trích code)

```ts
// src/lib/media/register-media.ts
type RegisteredMedia = { id: number | string; url: string; filename: string; mimeType: string; filesize: number }
export async function registerUploadedMedia(payload: BasePayload, args: {
    alt: string; filename: string; mimeType: string; filesize: number; tenantId?: number | string | null
}): Promise<RegisteredMedia>

// src/lib/media/workspace-media-library.ts
export const MEDIA_LIBRARY_LIMIT = 200
export async function listWorkspaceMediaLibrary(cms: Cms, tenantId: string | number, limit?: number): Promise<MediaRow[]>

// src/lib/media/s3-public-url.ts
export const MEDIA_OBJECT_ACL = 'public-read' as const
export function s3PublicUrl(filename: string, prefix?: string): string
```

### 13.3 Type definitions — đích

```ts
// src/lib/media/media-upload-policy.ts (thay upload-limits.ts, re-export tạm)
export const UPLOAD_LIMITS = { image: 10 * MB, video: 100 * MB, pdf: 5 * MB, ico: 1 * MB } as const
export const MEDIA_TEXT_LIMITS = { alt: 250, caption: 500, displayName: 120 } as const
export const MAX_FILES_PER_BATCH = 20
export const IMAGE_MAX_EDGE = 2560
export const IMAGE_MAX_PIXELS = 50_000_000

// src/lib/media/normalize-image.ts
export type MediaCreatedVia = 'upload' | 'import-url' | 'ai' | 'stock' | 'seed' | 'system' | 'proof'
export type MediaUploadPurpose = 'library' | 'favicon' | 'logo' | 'og' | 'product' | 'block' | 'blog' | 'payment-qr' // tập con MediaPurpose (S0)
export interface ProcessedMedia {
    body: Buffer | NodeJS.ReadableStream
    mimeType: 'image/webp' | 'image/png' | 'image/x-icon' | 'video/mp4' | 'video/webm'
    ext: 'webp' | 'png' | 'ico' | 'mp4' | 'webm'
    contentHash: string // sha256 hex, 64 ký tự
    filesize: number
    width?: number
    height?: number
}
export async function processImage(input: Buffer, purpose: MediaUploadPurpose): Promise<ProcessedMedia>

// src/lib/media/media-upload-token.ts — claims chuẩn arch §3.3 (D75)
export interface UploadTokenClaims {
    v: 1; uploadId: string; key: string /* pw2/tmp/{uuid} */; userId: number; tenantId: number
    purpose: MediaUploadPurpose; contentType: AllowedMime; maxBytes: number; exp: number // + orderId cho payment-proof
}
export function signUploadToken(claims: UploadTokenClaims): string
export function verifyUploadToken(token: string, userId: string): UploadTokenClaims | null

// src/lib/media/media-row-repository.ts (dùng bởi register-upload-service.ts + ingest-media-buffer.ts)
export interface StoredMedia {
    id: number; url: string; mimeType: string; filesize: number
    width: number | null; height: number | null
    displayName: string; alt: string; createdVia: MediaCreatedVia; deduped: boolean
}
export async function storeProcessedMedia(payload: BasePayload, args: {
    processed: ProcessedMedia; tenantId: number | null; uploadedBy: number | null
    alt?: string; displayName: string; createdVia: MediaCreatedVia; folderId?: number | null
}): Promise<StoredMedia> // D87: hash lock/dedupe trước Put key phiên bản mới; DTO primary, intent cleanup

// src/lib/media/ingest-media-buffer.ts
export async function ingestMediaBuffer(args: {
    buffer: Buffer; tenantId: number | null; createdVia: MediaCreatedVia; alt?: string; provenance?: Record<string, string>
}): Promise<{ doc: StoredMedia; deduped: boolean }> // D72: caller cấm xoá bù khi deduped; D71: tenantId null → uuid32, không dedupe

// src/hooks/use-media-upload.ts
export type UploadItemState = 'queued' | 'compressing' | 'uploading' | 'processing' | 'done' | 'error'
export interface UploadItem { localId: string; file: File; state: UploadItemState; progress: number; result?: StoredMedia; errorCode?: MediaErrorCode }
export function useMediaUpload(opts: { purpose: MediaUploadPurpose; accept: ('image' | 'video')[]; maxFiles?: number; onDone?: (m: StoredMedia[]) => void }): {
    items: UploadItem[]; add(files: File[]): void; retry(localId: string): void; cancel(localId: string): void
}
```

### 13.4 Sharp pipeline (tham chiếu)

```ts
const image = sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS, failOn: 'error', animated: false })
const out = await image
    .rotate() // áp EXIF orientation rồi bỏ metadata (sharp không giữ metadata nếu không gọi withMetadata)
    .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
```

---

## 14. Dependencies

| Dependency | Status | Action |
|---|---|---|
| S0 (validator, field lock, rate limit, sharp vá) | ⬜ | Merge trước |
| Durable intent + worker retry/orphan độc lập tenant (lifecycle §8.6, D87) | ⬜ | Có từ S1: allocation trước Put, delete intent trước COMMIT; không chờ S4 mới dọn |
| Lifecycle rule `pw2/tmp/` 1 ngày + abort multipart (FR-31d) | ⬜ | **Bật trong S1 (D36)**; ops QA sau 48h trên bucket staging, không chặn release S1 (D45) |
| Env `MEDIA_PIPELINE_V2_ENABLED`, `MEDIA_BULK_DELETE_ENABLED` (D36) | ⬜ | Vercel Dashboard + `.env.staging.example` + `.env.production.example` |
| CORS bucket cho POST `pw2/tmp/*` từ domain dashboard | ✅ (đường B đang chạy) | Kiểm lại với key mới S0 |
| Bản dịch ms rà bởi người bản ngữ (NFR-06) | ⬜ | PO sắp xếp người rà; xong trước release S1 (D88) |
| Host CDN (FR-09) | ⬜ | Nếu chưa có, `generateFileURL` dùng URL S3 path-style hiện tại |
| Cột `media.prefix`, `_objectkey`, `width`, `height`; `media_filename_idx` unique | ✅ | Đã xác minh (D56) |
| DB Neon `-pooler` (PgBouncer transaction mode) | ✅ | Transaction/lock trên `pool.connect()`, chỉ khoá xact (D60/D87), tx có S3 bounded; benchmark pool/p95 |
| Read replica `DATABASE_URI_READ_REPLICA` (có trên staging, `.env.staging.example:39`) | ✅ | Đọc lại sau INSERT bằng client tx primary, không qua `payload.find` (D87) |

---

## 15. API Contract

```
POST /api/media/presign                                   Auth: required · RL 60/user,120/tenant/phút
Request:  { filename: string; contentType: AllowedMime; size: number; purpose: MediaUploadPurpose }
Response: { pipeline: 'v1' | 'v2'; url: string; fields: Record<string, string>; uploadToken?: string; expiresAt: string }   // v1 = hợp đồng cũ khi flag off (M8)
Errors:   401 MEDIA_UNAUTHORIZED | 403 MEDIA_FORBIDDEN | 413 MEDIA_TOO_LARGE | 415 MEDIA_UNSUPPORTED_TYPE | 429 MEDIA_RATE_LIMITED | 503 MEDIA_STORAGE_UNAVAILABLE

POST /api/media/register                                  Auth: required · RL 60/user,120/tenant/phút
Request:  { uploadToken: string; alt?: string; displayName?: string; folderId?: number | null }
Response: { media: MediaDTO; deduped: boolean; warnings?: string[] }   // kiểu chuẩn arch §5.1–5.2
Errors:   400 MEDIA_KEY_INVALID | 400 MEDIA_UPLOAD_EXPIRED | 400 MEDIA_VALIDATION | 404 MEDIA_UPLOAD_MISSING | 409 MEDIA_REGISTER_IN_PROGRESS
          | 413 MEDIA_TOO_LARGE | 413 MEDIA_QUOTA_EXCEEDED (S4) | 415 MEDIA_UNSUPPORTED_TYPE | 415 MEDIA_CONTENT_MISMATCH
          | 422 MEDIA_INVALID_FILE | 422 MEDIA_TOO_MANY_PIXELS | 429 MEDIA_RATE_LIMITED | 500 MEDIA_PROCESSING_FAILED | 504 MEDIA_PROCESSING_TIMEOUT

GET /api/media/library?cursor&limit&sort&type&q&folder    Auth: required
Response: { docs: LibraryItem[]; nextCursor: string | null }
type LibraryItem = StoredMedia & { createdAt: string; canEdit: boolean; canDelete: boolean; legacy: boolean; thumbnailUrl: string }

PATCH /api/media/library/{id}                             Auth: required
Request:  { alt?: string; caption?: string | null; displayName?: string }
Response: LibraryItem
Errors:   400 MEDIA_FIELD_READONLY | 400 MEDIA_VALIDATION | 404 MEDIA_NOT_FOUND

POST /api/media/library/bulk-delete                       Auth: required · RL 10/user,20/tenant/phút
Request:  { ids: number[] }           // 1..100
Response: { deleted: number[]; kept: { id: number; reason: 'forbidden' | 'legacy_shared' | 'not_found' | 'in_use' | 'delete_failed' }[]; freedBytes: number; cleanupPending: number[] }
Errors:   400 MEDIA_BULK_LIMIT | 404 MEDIA_NOT_FOUND (flag tắt, D34) | 429 MEDIA_RATE_LIMITED
```

### 15.1 Mã lỗi mới (bổ sung bảng S0)

| Code | HTTP | en | ms |
|---|:-:|---|---|
| `MEDIA_INVALID_FILE` | 422 | We couldn't read this image. It may be damaged — try another file. | Kami tidak dapat membaca imej ini. Ia mungkin rosak — cuba fail lain. |
| `MEDIA_TOO_MANY_PIXELS` | 422 | This image is too large (over 50 megapixels). Please resize it and try again. | Imej ini terlalu besar (melebihi 50 megapiksel). Sila kecilkan saiznya dan cuba lagi. |
| `MEDIA_PROCESSING_FAILED` | 500 | We couldn't process this file. Please try again. | Kami tidak dapat memproses fail ini. Sila cuba lagi. |
| `MEDIA_UPLOAD_MISSING` | 404 | This file is unavailable. Remove its stale library entry if present, then upload a new version. | Fail ini tidak tersedia. Alih keluar entri pustaka lama jika ada, kemudian muat naik versi baharu. |
| `MEDIA_BULK_LIMIT` | 400 | You can delete up to 100 files at a time. | Anda boleh memadam sehingga 100 fail pada satu masa. |
| `MEDIA_REGISTER_IN_PROGRESS` | 409 | This file is still being processed. Please wait a moment. | Fail ini masih diproses. Sila tunggu sebentar. |
| `MEDIA_PROCESSING_TIMEOUT` | 504 | Processing took too long. Please try a smaller file. | Pemprosesan mengambil masa terlalu lama. Sila cuba fail yang lebih kecil. |
| `MEDIA_VALIDATION` | 400 | Alt text: max 250 characters. Caption: max 500. Name: max 120. | Teks alt: maksimum 250 aksara. Kapsyen: maksimum 500. Nama: maksimum 120. |
| (thông báo, không lỗi) `deduped` | 200 | This image is already in your library | Imej ini sudah ada dalam pustaka |

---

## 16. Data model delta (`scripts/db-setup.js` MIGRATIONS)

Tên entry + SQL chuẩn ở **[arch §4.2](../architecture/F48-media-management.md#42-migrations-scriptsdb-setupjs)** (D75) — PR S1 copy nguyên văn, không đặt tên riêng. Entry thuộc S1:

| Entry (`name`) | Nội dung | `concurrentIndex` |
|---|---|---|
| `f48.media.content_hash` | `content_hash varchar(64)` | — |
| `f48.media.created_via` | `created_via varchar(20)` (không default) | — |
| `f48.media.display_name` | `display_name varchar(120)` | — |
| `f48.media.uploaded_by_id` | FK `users(id) ON DELETE SET NULL` | — |
| `f48.media.width_height` | bảo hiểm (cột đã có — D56) | — |
| `f48.media.tenant_hash_uidx` | `media_tenant_content_hash_uidx` UNIQUE `(tenant_id, content_hash) WHERE private = false AND content_hash IS NOT NULL` (D57) | `CREATE … CONCURRENTLY` |
| `f48.media.library_cursor_idx` | `media_tenant_created_id_idx (tenant_id, created_at DESC, id DESC) WHERE private IS NOT TRUE` | `CREATE … CONCURRENTLY` |

Bước quota trong register (arch §3.4 bước 9) chỉ chạy khi có cột `tenants.media_bytes_used` (entry S4); trước đó bỏ qua — đối soát đầu tiên ở S4 tính lại tổng thật.

- `Media.ts` thêm field `contentHash`, `createdVia` (select), `displayName`, `uploadedBy` (relationship users, `maxDepth: 0`) — tất cả trong `SYSTEM_MEDIA_FIELDS` trừ `displayName`.
- `uploaded_by_id` cần cho D26 (staff không có `media` chỉ sửa media mình upload — S3); thêm từ S1 để row mới có dữ liệu.
- Không backfill `content_hash`/`created_via` cho row cũ (null = không tham gia dedupe/GC).

---

## 17. Risks

| ID | Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|---|---|:-:|:-:|---|
| R-S1-01 | sharp chậm/treo trên Vercel với ảnh lớn (tái diễn #1284) | TB | Cao | Nén client trước; `limitInputPixels`; `sharp.concurrency(1)`; không đưa video vào sharp; đo NFR-01 trước merge |
| R-S1-02 | Đổi định dạng sang WebP làm hỏng nơi cần định dạng gốc (favicon, email client cũ, OG) | TB | TB | `purpose=favicon` → PNG; OG: WebP được Facebook/WhatsApp hỗ trợ — kiểm thử 3 nền tảng; email F32 kiểm hiển thị WebP |
| R-S1-03 | Dedupe theo hash output thay đổi khi nâng sharp → mất dedupe giữa phiên bản | Thấp | Thấp | Chấp nhận (chỉ tốn thêm object); ghi chú trong architecture |
| R-S1-04 | Xoá nhiều trước S4 làm vỡ ảnh đang dùng | Thấp | TB | **Đã chốt D34:** flag `MEDIA_BULK_DELETE_ENABLED` tắt tới khi S4 xong usage scan |
| R-S1-05 | tmp sót tích luỹ nếu lifecycle chưa bật | Thấp | Thấp | **Đã chốt D36/D45:** lifecycle bật trong S1, ops kiểm sau 48h |
| R-S1-06 | Thay hook cũ gây hồi quy ở 15+ điểm dùng `useUploadProgress` | TB | TB | Hook cũ thành wrapper gọi `useMediaUpload` cho tới S2; test hồi quy F05/F08/F17 |
| R-S1-07 | Query thư viện gộp legacy (`referencedMediaIds`) chậm khi tenant nhiều site | TB | TB | Cache danh sách legacy id 5 phút/tenant; đo NFR-02 |
| R-S1-08 | **Vùng payment (D73):** đổi kiểm quyền QR làm lộ/nhận nhầm media không phải QR của tenant, hoặc giữ kiểm `alt` làm merchant không lưu được QR sau dedupe | TB | Cao | BR-11: kiểm `tenant` + `!private` + `image/*`; TC tenant chéo/private/ảnh thư viện; PR riêng có review payment; QR đang bật không force delete (D78, S4) |
| R-S1-09 | Caller xoá bù row dedupe dùng chung (D72) | TB | Cao | `ingestMediaBuffer` trả `deduped`; BR-12; TC xoá bù |
| R-S1-10 | Row tenant NULL theo hash đụng `media_filename_idx` (23505) khi ingest lại cùng ảnh (D71) | Cao (nếu theo hash) | TB | Avatar/global dùng `uuid32`, không dedupe |
| R-S1-11 | Function chết giữa PutObject và COMMIT ⇒ object mồ côi (D87) | Thấp | Thấp | D87: allocation intent trước Put + orphan sweep độc lập tenant có row; retry chỉ key cũ, không reuse |

---

## 18. Test Strategy (tóm tắt)

- **Unit:** `processImage` (EXIF strip kiểm bằng `sharp().metadata()`, orientation, resize, 50MP → lỗi), `upload-token` (sai chữ ký, hết hạn, khác user), cursor encode/decode, validator độ dài D32.
- **Integration (Postgres + MinIO thật cho D87/B1; không mock transaction/object IO):** TC-F48-04-13, 04-34..36, 12-20..22; register happy path, dedupe cùng tenant/khác tenant, race 2 request cùng hash (gồm quota/SQL lỗi với allocation riêng; lượt thắng giữ key cũ, D87), video giả mạo, tmp bị xoá mọi nhánh lỗi, DTO đọc lại đúng khi bật read replica, `ingestMediaBuffer` flag off → `payload.create` (D78), xoá bù không xoá row dedupe (D72), avatar/global ingest 2 lần cùng ảnh → 2 row (D71), QR thanh toán từ thư viện/tenant chéo/private (D73).
- **API:** list phân trang 350 row, filter/sort/search, tenant isolation 404, bulk-delete 101 → 400.
- **E2E (agent-browser):** `/media` kéo 5 file (1 SVG), mất mạng giữa chừng (throttle), en/ms, 375px.
- **Benchmark:** NFR-01/04 với bộ 472 ảnh; ghi số vào PR.
- TC-ID: `TC-F48-04-01..08`, `TC-F48-05-01..07`; bổ sung D57–D59/M4/M7/M8: `TC-F48-04-22..28`.

---

## 19. Open Questions

| # | Câu hỏi | Owner | Status |
|---|---|---|---|
| 1 | Neon có `unaccent`? | — | ✅ Đã chốt D62: không dùng `unaccent`, tìm bằng ILIKE |
| 2 | Có giữ đường A (`/api/media/upload`) cho local dev không có S3? | Dev | Chốt theo đề xuất: giữ cho local dev, gọi `normalize-image` |
| 3 | Key avatar | — | ✅ Đã chốt D36 (`pw2/u/{userId}/`) |
| 4 | Xoá nhiều trước S4 | — | ✅ Đã chốt D34 (flag, mặc định tắt) |

---

## 20. 9-Point Done Checklist

- [ ] Loading — skeleton 12 ô; spinner ô đang xử lý
- [ ] Empty — 2 kiểu (chưa có / không kết quả)
- [ ] Error — lỗi theo file + "Thử lại"; lỗi tải trang + "Thử lại"
- [ ] Form Validation — alt 250 / caption 500 / displayName 120, bộ đếm ký tự
- [ ] Button States — Upload/Lưu/Xoá disabled khi đang chạy; Xoá disabled > 100
- [ ] Toast — upload xong, dedupe, xoá X/giữ Y
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — 2 cột, bottom sheet, long-press
- [ ] TypeScript Clean — `npm run verify`

## 21. Definition of Done

- [ ] FR-10..18 (kèm FR-10a, FR-14a) xong; TC-F48-04-22..28 xanh; NFR-08 đo; lifecycle `pw2/tmp/` (FR-31d) bật; AC-01..15 (TC-F48-04-01..08, TC-F48-05-01..07) xanh
- [ ] Migration có trong MIGRATIONS, `check-migrations` pass
- [ ] Số đo NFR-01, NFR-02, NFR-04, NFR-08 ghi trong PR; TC-GENPERF-W2-07 (F01) được cập nhật trong cùng PR bỏ mutex
- [ ] Screenshot en/ms desktop + 375px
