# Brainstorm brief — F48 Media Management (nguồn chung cho mọi tài liệu F48)

> **Ghi chú lịch sử (2026-11-10):** quyết định user 1B/D87 tại [PRD overview](../../docs/prd/F48-media-management-overview.md) và [lifecycle §8.6](../../docs/architecture/F48-media-management-lifecycle.md#86-d87--key-phiên-bản-và-cleanup-bền-vững-thay-d76) thay phần key/flow/cleanup cũ D6/D16/FR-12/D39/D56/D76 bên dưới: key có UUID không tái sử dụng; dedupe DB dùng row/key cũ, chỉ miss tạo key mới; GC/force COMMIT xoá row/quota trước S3, retry bền vững không giữ row khi S3 lỗi. Báo cáo này giữ nguyên để truy vết, không dùng các đoạn cũ làm contract triển khai.

- Ngày 2026-11-09 · staging `1248713` · user giao "tự quyết hướng tốt nhất" → các quyết định dưới đây là CHỐT (trừ mục ghi "chờ PO").
- Migration PW1→PW2 đã XONG: không đề xuất migrate/backfill dữ liệu PW1. PW1 chỉ là tham chiếu tính năng.
- Báo cáo nền: `plans/reports/scout-261109-1519-media-library-pw1-vs-pw2.md`

## 1. Contract
- **Outcome:** Một hệ thống media thống nhất: 1 pipeline upload an toàn (server xử lý lại ảnh), 1 picker dùng chung cho mọi điểm upload, thư viện có phân trang/thư mục/sửa metadata/xoá nhiều/biết đang dùng ở đâu, vòng đời có dọn rác + quota theo gói, quyền `media` cho staff, ảnh biến thể + ảnh danh mục, gallery SP 10 ảnh có sắp xếp.
- **Constraints:** Payload 3.91 + storage-s3 3.91, Next 16.4.2, sharp 0.35.x, Vercel (giới hạn body function 4.5 MB → file lớn phải đi direct-to-S3), DO Spaces sgp1 path-style, bucket DÙNG CHUNG với PW1 (mọi thao tác xoá/dọn chỉ được đụng prefix của PW2), schema mới qua `scripts/db-setup.js` MIGRATIONS, en+ms i18n, file code < 200 dòng, TC-ID theo `docs/qa/F48-*.md`.
- **Non-goals:** chỉnh ảnh nâng cao (filter, AI edit, xoá nền), xử lý video (transcode/poster), quét virus ClamAV (để sau), collection Brand, review sản phẩm, chuyển dữ liệu block cũ sang id (không backfill), migrate PW1.
- **Acceptance (đợt tài liệu):** stories → PRD (overview + 6 sprint) → architecture → design → QA; FR nào cũng có Story Ref; AC nào cũng có TC-ID; phủ 18 điểm upload, 28 field FK, luồng AI/seed/private; có issue docs.

## 2. Bằng chứng then chốt
### 2.1 PW1 production (snapshot 2026-10-28, 2.919 store live)
- Thư viện `medias`: 245 store dùng (8%); file/store median 7, p90 31, max 298; 130 store dùng folder, max 20 folder/store; độ sâu: cấp0 1090, cấp1 2127, cấp2 620, cấp3 39, ≥4: 25 (max 8). Định dạng: jpg/jpeg 1852, png 1152, webp 398, gif 5, **svg 3, txt 2**, mp4 1.
- Ảnh SP: 37.480 SP live; số ảnh/SP: 1→20.270, 2→5.393, 3→7.841, 4→2.470, 5→755, 6→273, 7→214, 8→16 (max 8). 98,7% ≤5.
- Ảnh SKU: 8.273/43.592 SKU (19%) có ảnh, thuộc 2.267 SP, ~1,08 ảnh/SKU (max 4).
- Ảnh danh mục: 267/50.927 (0,5%).
- 12.232 ảnh SP PW1 trỏ bucket **dev** `tm-prime-web-dev` (ghi nhận rủi ro, không xử lý trong F48).
### 2.2 PW2 hiện trạng (staging)
- 4 đường upload: A `/api/media/upload` (qua server, vướng 4.5 MB Vercel) · B presign+register direct S3 (`use-direct-upload.ts`) · C server action `uploadMediaAction` · D route riêng (avatar, payment proof, QR, feedback→Lark, AI attachments).
- 18 điểm upload (ảnh SP `ImageUploader.tsx`; block overlay `media-upload-overlay.tsx` ~10 block; `BlockImageEditor.tsx`; `ImageToolbar.tsx`; `LogoEditor.tsx`; `FaviconEditor.tsx`; `og-image-editor.tsx`; footer logo `SettingsPanel.tsx:1626`; `RichTextBlockEditor.tsx`; `BlogRichEditor.tsx`; blog cover `BlogEditorPageClient.tsx`; `/media` page; avatar; QR payments `PaymentsFormClient.tsx:911`; payment proof người mua `ConfirmClient.tsx:584`; feedback; studio issue evidence; AI chat attachments). Giới hạn 2/5/10 MB khác nhau, nén 5/11, alt 5 kiểu, i18n lẫn.
- 28 field `upload` FK (Blogs.thumbnail, ContentPacks.coverImage, Orders.paymentProofImage, Products.images[].image + halalCertImage, Sites.ogImage + merchantQrCode, Templates.thumbnail, Tenants.qr_image, Users.avatar, Pages ~17: image/backgroundImage/logo/avatar/posterImage/ogImage) — không field nào có onDelete. Block JSON dùng URL string: gallery, before-after, client-logos, video/hero videoUrl, content-cards, rich text, custom-html.
- `/media` page 372 dòng, cap 200 (`MEDIA_LIBRARY_LIMIT`), không ở sidebar (quyết định 2026-06-11), không permission `media` (`permissions.ts:4`).
- Không imageSizes (gỡ ở #1284 do sharp treo với video). Không cron/hook dọn media; regenerate site giữ media cũ (`generate-site-service.ts:1533`). Không quota.
- Local sample: PNG chiếm 74% byte, trung bình ~600 KB/file; 42/472 ảnh > 2000px.
### 2.3 Bảo mật (đã xác minh trong code)
- **SEC-1 (Cao, cần sửa trước tiên):** `Media.ts` không khoá field `filename`/`prefix`/`mimeType`/`filesize`/`url` khi update. Payload 3.91 `generateFileData` (nhánh update không kèm file) giữ nguyên `data.filename`; `validateUploadFilename` cho phép `/`. `plugin-cloud-storage` afterDelete xoá object theo `doc.prefix + doc.filename`. → user của bất kỳ shop nào có thể đổi filename media của mình rồi xoá row ⇒ xoá object tuỳ ý trong bucket dùng chung (PW1 + object PW2 không có row). Chưa thử runtime; phải có test tái hiện đỏ trước khi sửa.
- SEC-2: `next.config.ts:93` remotePatterns `https://**` → `/_next/image` là proxy mở, đốt chi phí Vercel Image Optimization.
- SEC-3: EXIF/GPS không bị xoá (client chỉ re-encode khi >1920px hoặc >2MB; server không xử lý).
- SEC-4: Thiếu rate limit ở `/api/media/upload`, `/register`, server action, avatar, QR, `upload-proof-direct` (chỉ presign có 60/user). Không quota.
- SEC-5: `mimeTypes: image/*, video/*, application/pdf`; hook chỉ kiểm magic cho ảnh + mp4/webm → video/* khác và PDF qua Payload REST `POST /api/media` không kiểm byte; register không kiểm magic video.
- SEC-6: Key path A/C/avatar/QR dùng tên file gốc (đoán được); public-read không chữ ký; listing bucket chưa xác minh.
- SEC-7: Thiếu `nosniff`/`Content-Disposition` ở handler local và object S3; không header bảo mật toàn cục.
- SEC-8: `GET /api/media/:id` public cho row non-private → lộ `aiPrompt`/`caption`/`sourceUrl` theo id tuần tự.
- SEC-9: Key DO Spaces bị lộ 2026-04-15 chưa xoay (`docs/tracking/OPEN_BLOCKERS.md`); 1 key toàn quyền bucket dùng chung.
- SEC-10: Presign POST tái dùng 300s, `content-length-range` min 0; register chấp nhận mọi key bắt đầu `u{id}-`.
- SEC-11: sharp 0.35 có advisory libvips/libheif (GHSA-f88m-g3jw-g9cj, CVE-2026-84383 — xác minh lại) → nâng bản 0.35.x mới nhất + `npm audit`; không bật AVIF/SVG ở image optimizer.
- Đã ổn: SVG bị chặn qua magic check; private media (payment proof) ACL private + route session + CSP sandbox; tenant isolation list/delete; presign pin Content-Type + key exact.

## 3. Quyết định chốt
| # | Chủ đề | Quyết định | Lý do / bằng chứng |
|---|---|---|---|
| D1 | Phạm vi | 1 feature F48, 6 sprint (S0–S5) | Liên quan chặt; tách file PRD theo sprint |
| D2 | Thư mục | Collection `media-folders` lồng nhau, **tối đa 5 cấp**, ≤ 200 folder/tenant | PW1: 99% ≤ cấp 2, max 8 |
| D3 | Tham chiếu block | Dữ liệu MỚI lưu `{ mediaId, url }`; bộ quét usage đọc cả FK + id + URL; KHÔNG backfill dữ liệu cũ | "không migrate" |
| D4 | Ảnh phái sinh | KHÔNG bật lại Payload imageSizes. Lưu 1 bản chuẩn hoá WebP (cạnh dài ≤ 2560, q80); hiển thị qua `next/image` với remotePatterns hẹp | #1284; tránh x4 object |
| D5 | Pipeline | Mọi upload ảnh/video của merchant: client nén → presign → PUT/POST S3 vào `pw2/tmp/` → `register` server: kiểm magic, sharp re-encode (rotate, strip metadata, `limitInputPixels` 50MP, resize, WebP), sha256, ghi key cuối, xoá tmp. Video: chỉ kiểm magic + size, không re-encode. PDF: chỉ luồng payment proof (private) | Vượt 4.5 MB Vercel; khử polyglot/EXIF |
| D6 | Key | `pw2/t/{tenantId}/{sha256[0..31]}.webp` (ảnh), `.mp4/.webm` (video); `pw2/private/t/{tenantId}/...` cho private; `pw2/tmp/{uuid}` tạm | Không đoán được; GC chỉ đụng `pw2/` |
| D7 | Dedupe | Theo `(tenant, contentHash)`: trùng → trả row cũ, không tạo object mới. Không dedupe chéo tenant | Tránh rò rỉ + coupling xoá |
| D8 | Dọn rác | Merchant thấy nhãn "Chưa dùng" + tự xoá. Cron tuần: tự xoá media `createdVia ∈ {ai, stock, seed}` không dùng > 30 ngày; regenerate site đánh dấu media cũ để GC; lifecycle rule `pw2/tmp/` 1 ngày + abort multipart (test thật trên DO). Dry-run mode bắt buộc trước khi bật xoá | Bucket chung PW1 |
| D9 | Quota | `PlanFeatures.featureCode = media_storage_mb` + `tenants.media_bytes_used` (cập nhật trong transaction khi register/xoá). Số theo gói: **chờ PO** (đề xuất free 500 MB, starter 2 GB, pro 5 GB, business 20 GB). Per-file: ảnh 10 MB trước nén, video 100 MB, PDF proof 5 MB | Không có quota hiện tại |
| D10 | Ảnh biến thể | `variants[].image` = 1 ảnh chọn từ gallery SP (FK media), mặc định ảnh chính | PW1: ~1 ảnh/SKU, 19% SKU |
| D11 | Gallery SP | Nâng cap 5 → **10 (PO đồng ý — D88)**, kéo sắp xếp, ảnh đầu = ảnh chính | PW1 max 8; sửa PRD F08 |
| D12 | Ảnh danh mục | `categories.image` (FK media), ưu tiên P2 | 0,5% dùng |
| D13 | Sidebar | Thêm mục "Media" dưới nhóm nội dung — **PO đồng ý — D88** (đảo quyết định 2026-06-11) | Thư viện có picker thì cần lối vào |
| D14 | Quyền | `PermissionId` thêm `media` (xem + quản lý). Staff không có `media` vẫn dùng picker để chọn/ upload trong màn hình họ có quyền, nhưng không vào `/media`, không xoá/sửa của người khác | Không chặn luồng SP/blog |
| D15 | Ghi field nhạy cảm | Field `filename, prefix, mimeType, filesize, url, width, height, contentHash, tenant, private, createdVia` chỉ server ghi; REST update chỉ cho `alt, caption, displayName, folder`. Cân nhắc tắt Payload REST write cho media, dùng route riêng | SEC-1 |
| D16 | Delivery | Bật DO Spaces CDN + custom domain cookieless (vd `media.<domain>`), `Cache-Control: public, max-age=31536000, immutable` (key theo hash), `nosniff`; remotePatterns chỉ host CDN/S3 PW2 + host PW1 cũ + Pixabay/Wikimedia. CDN tuỳ chọn, không chặn (2026-11-10): chưa có domain thì giữ URL path-style; PW1 cũng chỉ dùng link gốc | SEC-2, chi phí |
| D17 | Private | Giữ route session `/api/media/private/[id]`; thêm rate limit upload proof; key dưới `pw2/private/` | Đã ổn, bổ sung |
| D18 | URL import | Picker có tab URL: server tải về (SSRF guard: https, chặn IP private sau resolve, ≤10 MB, timeout 10s, không theo redirect sang host private) rồi đi chung pipeline D5 | Rich text đã có URL thô |
| D19 | Xoá có kiểm tra | Xoá media đang dùng → cảnh báo danh sách nơi dùng; mặc định chặn, cho "Vẫn xoá" (owner) với FK đặt null + block URL giữ nguyên (ảnh vỡ được báo) | PW1 không kiểm |
| D20 | Xoá thư mục | Chỉ xoá thư mục rỗng, hoặc "chuyển nội dung lên thư mục cha rồi xoá" (không xoá file đệ quy như PW1) | An toàn |

## 4. Sprint + Story ID (dùng ĐÚNG các ID này ở mọi tài liệu)
| Sprint | Story | Tiêu đề | Ưu tiên | Size |
|---|---|---|---|---|
| S0 Bảo mật & nền | US-F48-01 | Khoá field hệ thống của media + chỉ ghi qua API an toàn (SEC-1, SEC-8) | P0 | M |
| S0 | US-F48-02 | Cứng hoá upload: whitelist định dạng, magic check mọi đường, rate limit, header, remotePatterns hẹp, nâng sharp (SEC-2,4,5,7,10,11) | P0 | M |
| S0 | US-F48-03 | Vận hành: xoay key S3, key riêng PW2, kiểm listing bucket, CDN + cache header (SEC-9, D16) | P0 | S |
| S1 Pipeline & thư viện | US-F48-04 | Pipeline upload hợp nhất: client nén → tmp → register xử lý server (D5–D7), quota per-file | P0 | L |
| S1 | US-F48-05 | Thư viện /media: phân trang server, tìm/lọc/sắp xếp, xem chi tiết, sửa alt/caption/tên, chọn nhiều + xoá nhiều, kéo thả + tiến trình, i18n | P0 | L |
| S2 Picker | US-F48-06 | MediaPicker dùng chung (Upload / Thư viện / URL) + chọn 1 hoặc nhiều | P0 | M |
| S2 | US-F48-07 | Gắn picker vào 18 điểm upload theo thứ tự ưu tiên; block mới lưu `{mediaId,url}` | P0 | L |
| S2 | US-F48-08 | Import ảnh từ URL an toàn (D18) | P1 | S |
| S3 Thư mục & quyền | US-F48-09 | Thư mục lồng nhau: tạo/đổi tên/di chuyển/xoá (D2, D20) | P1 | M |
| S3 | US-F48-10 | Quyền `media` cho staff + mục sidebar (D13 ✅ D88, D14) | P1 | S |
| S4 Vòng đời | US-F48-11 | "Đang dùng ở đâu" + chặn/cảnh báo khi xoá (D19) + bộ lọc "Chưa dùng" | P0 | M |
| S4 | US-F48-12 | Dọn rác tự động có dry-run (D8) + dọn khi regenerate | P1 | M |
| S4 | US-F48-13 | Quota dung lượng theo gói + đồng hồ dung lượng (D9) | P1 | M |
| S5 Media sản phẩm | US-F48-14 | Gallery SP 10 ảnh, kéo sắp xếp, ảnh chính (D11) | P1 | S |
| S5 | US-F48-15 | Ảnh cho biến thể chọn từ gallery (D10) + hiển thị storefront khi chọn biến thể | P1 | M |
| S5 | US-F48-16 | Ảnh danh mục (D12) — ⏸ hoãn (D88) | P2 | S |

Stories file: chia 4 file ≤5 story/file theo template: `docs/stories/F48-media-management-stories.md` (01–05, kèm mục lục toàn bộ 16 story), `...-stories-2.md` (06–10), `...-stories-3.md` (11–13), `...-stories-4.md` (14–16).

## 5. FR ID (dùng đúng ở PRD và QA)
- S0: FR-01 khoá field hệ thống (access field-level + beforeChange reject) · FR-02 ẩn `aiPrompt`/`sourceUrl` khỏi read public · FR-03 whitelist MIME tường minh (jpeg/png/webp/ico ảnh; mp4/webm video; pdf chỉ proof) + magic check mọi đường (A/B/C/D, REST) · FR-04 rate limit upload/register/proof/avatar/QR (per user + per tenant) · FR-05 remotePatterns allowlist + `minimumCacheTTL` · FR-06 header `nosniff` + `Content-Disposition` + Cache-Control · FR-07 presign: expiry 60s, content-length-range min 1, key regex chặt · FR-08 nâng sharp + `npm audit` gate · FR-09 xoay key + key riêng PW2 + kiểm listing (ops).
- S1: FR-10 hook/component `useMediaUpload`/`MediaUploadButton` duy nhất · FR-11 register xử lý server (magic, re-encode WebP, strip EXIF, limitInputPixels, resize 2560) · FR-12 key theo hash + prefix `pw2/` · FR-13 dedupe theo (tenant, hash) · FR-14 `upload-limits.ts` nguồn duy nhất · FR-15 API list phân trang cursor/sort/filter/search server · FR-16 API sửa metadata an toàn (alt, caption, displayName, folder) · FR-17 xoá nhiều (≤100/lần) · FR-18 trang /media mới (kéo thả, tiến trình, chi tiết, i18n en/ms).
- S2: FR-19 MediaPicker (tabs, chọn đơn/đa, lọc theo loại/accept) · FR-20 tích hợp 18 điểm (thứ tự: SP, block overlay/BlockImageEditor, blog cover/body, logo/favicon/OG/footer logo, rich text, QR) — avatar/payment proof/feedback/studio/AI attachments giữ luồng riêng nhưng dùng chung validator · FR-21 block mới lưu `{mediaId,url}` · FR-22 import URL an toàn.
- S3: FR-23 collection `media-folders` (tenant, name, parent, depth ≤5, ≤200/tenant, tên duy nhất trong cùng cha) · FR-24 di chuyển file/thư mục, chống vòng lặp · FR-25 xoá thư mục rỗng / chuyển nội dung lên cha · FR-26 permission `media` + StaffDrawer · FR-27 sidebar entry (chờ PO).
- S4: FR-28 `findMediaUsages(mediaId)` quét FK + JSON block + rich text/custom-html theo id & URL · FR-29 cảnh báo/chặn xoá + FK set null · FR-30 bộ lọc "Chưa dùng" · FR-31 cron GC (dry-run, chỉ prefix `pw2/`, ai/stock/seed > 30 ngày, tmp > 1 ngày) · FR-32 regenerate đánh dấu media cũ · FR-33 quota theo gói + `tenants.media_bytes_used` + chặn upload khi vượt + đồng hồ dung lượng.
- S5: FR-34 gallery 10 ảnh + sắp xếp + ảnh chính · FR-35 `variants[].image` + storefront đổi ảnh theo biến thể · FR-36 `categories.image` + hiển thị storefront nơi có danh mục.
- NFR: NFR-01 register ảnh 5 MB p95 < 3s · NFR-02 list 50 item p95 < 500ms · NFR-03 usage scan 1 media p95 < 1,5s · NFR-04 giảm ≥ 50% byte lưu trữ ảnh mới so với hiện tại (benchmark PNG) · NFR-05 0 object ngoài prefix `pw2/` bị xoá bởi GC (test bắt buộc) · NFR-06 i18n 100% en/ms · NFR-07 WCAG AA cho picker/thư viện (bàn phím, focus, aria).

## 6. Schema dự kiến (db-setup MIGRATIONS)
- `media`: + `content_hash varchar(64)` (index unique cùng `tenant_id` khi not null), `created_via varchar` (upload|ai|stock|seed|system|import-url), `folder_id` FK media_folders ON DELETE SET NULL, `display_name varchar(120)`, `unused_since timestamptz`, `width/height` (Payload có sẵn cho ảnh — xác nhận cột).
- `media_folders` (mới): id serial, tenant_id, name varchar(60), parent_id self FK, depth smallint, created_at/updated_at; unique (tenant_id, parent_id, lower(name)).
- `tenants`: + `media_bytes_used bigint default 0`.
- `products_variants`: + `image_id` FK media ON DELETE SET NULL.
- `categories`: + `image_id` FK media ON DELETE SET NULL.
- `plan_features`: thêm bản ghi `media_storage_mb` theo gói (soft launch `UNLIMITED`; PO chốt số sau báo cáo S4 — D88).

## 7. Trade-offs
| Phương án | Giả định chính | Hỏng đầu tiên khi |
|---|---|---|
| **Chọn:** server re-encode trong register (đọc tmp từ S3) | Function Vercel đọc ≤10 MB từ S3 + sharp < 3s | Ảnh cực lớn/nhiều đồng thời → timeout; giảm bằng nén client + limitInputPixels |
| Chỉ nén client, server chỉ kiểm magic | Client đáng tin | Client cũ/độc hại bỏ qua → EXIF + polyglot lọt |
| Bật lại Payload imageSizes | Sharp ổn định với ảnh | Lặp lại #1284; x4 object, x4 chi phí |
| Cloudflare R2/Images thay DO | Chịu đổi nhà cung cấp | Vượt phạm vi, bucket PW1 vẫn ở DO |

Better approaches: so với đề xuất ban đầu "bật thumbnail + picker", hướng "1 bản WebP chuẩn hoá + next/image host hẹp + key theo hash" tốt hơn: giảm object/chi phí, khử EXIF/polyglot, cache immutable, GC an toàn theo prefix.

## 8. Câu hỏi chờ PO / ops
1. Quota từng gói (D9). 2. Gallery 10 ảnh (D11, sửa PRD F08). 3. Sidebar Media (D13). 4. Domain CDN cookieless + quyền tạo key Spaces riêng (D16, SEC-9). 5. Bucket có bật listing công khai không (ops kiểm).

## 9. Quyết định bổ sung (2026-11-09, sau khi viết stories)
- D21 Key cũ ngoài `pw2/`: chỉ xoá object khi (a) key bắt đầu `pw2/`, hoặc (b) key phẳng (không chứa `/`) và đúng `filename` của chính row PW2 đang xoá (row có `filename` not null). Row migrate PW1 (`filename` null, URL trỏ PW1) → xoá row, KHÔNG đụng object; hiển thị badge "Legacy". GC chỉ quét prefix `pw2/` + row PW2 có filename phẳng.
- D22 Client gửi field hệ thống (create/update) → 400 `MEDIA_FIELD_READONLY` (không lặng lẽ bỏ qua).
- D23 GIF/SVG/AVIF/HEIC/TIFF bị từ chối; thông báo gợi ý đổi sang PNG/WebP/JPEG.
- D24 Biên lai thanh toán của người mua (private, `pw2/private/`) KHÔNG tính vào quota merchant; luồng thanh toán không bao giờ bị chặn vì quota.
- D25 Gói chưa cấu hình `media_storage_mb` → dùng hạn mức gói free.
- D26 Staff không có quyền `media`: được sửa alt/caption media do chính họ upload trong màn hình có quyền; không xoá; không vào `/media`.
- D27 Chỉ owner cấp quyền `media`; staff không tự cấp.
- D28 "Vẫn xoá" (force) chỉ owner, từng file (không bulk force).
- D29 Usage scan TÍNH CẢ đơn hàng (ảnh item snapshot nếu là media id/URL PW2 + `Orders.paymentProofImage`): đơn hàng = tham chiếu chỉ-đọc → cảnh báo khi xoá; GC không bao giờ xoá media còn được đơn hàng tham chiếu.
- D30 Halal cert: chỉ ảnh (không PDF) trong F48.
- D31 Ngoài phạm vi F48: "gán 1 ảnh cho mọi biến thể cùng màu". Trong phạm vi S5: giỏ hàng + email/đơn hàng snapshot ảnh biến thể.
- D32 Giới hạn: alt ≤ 250, caption ≤ 500, displayName ≤ 120. Rate limit (per user / per tenant mỗi phút): presign 60/120, register 60/120, import-url 10/30, bulk delete 10/20, upload-proof 5 mỗi đơn/giờ + 20 mỗi IP/giờ, avatar/QR 10/user/giờ.
- D33 Báo cáo GC: cron trả JSON (dry-run/real, số row/object/byte theo tenant) + log có cấu trúc + Sentry message khi lỗi; không tạo bảng mới. Bật xoá thật bằng env `MEDIA_GC_ENABLED=true` (mặc định false = dry-run).
- D34 Xoá nhiều (FR-17) chỉ bật sau khi S4 có usage scan; S1 làm UI sau flag `MEDIA_BULK_DELETE_ENABLED` (mặc định off).
- D35 Hạn presign: ảnh 60s, video 600s (S3/Spaces kiểm policy lúc nhận request).
- D36 Chấp nhận đề xuất của writer: `media.uploaded_by_id` (S1), lifecycle `pw2/tmp/` dời lên S1, mã lỗi 415/422 tách, dedupe theo hash byte đã xử lý, uploadToken HMAC (HKDF từ PAYLOAD_SECRET), key avatar `pw2/u/{userId}/`, favicon chuẩn hoá PNG, QR WebP lossless, AI/seed tính quota nhưng không chặn, env mới `MEDIA_PIPELINE_V2_ENABLED`/`MEDIA_GC_ENABLED`/`NEXT_PUBLIC_MEDIA_CDN_URL`/`MEDIA_BULK_DELETE_ENABLED` (thêm vào `.env.*.example`).
- D37 ICO: chỉ nhận cho purpose `favicon`, lưu nguyên (passthrough, chỉ kiểm magic + kích thước ≤ 256x256); mọi purpose khác từ chối ICO. Favicon PNG/JPEG/WebP chuẩn hoá ra PNG.
- D38 WebP/PNG động: lấy khung đầu (sharp mặc định), UI cảnh báo "ảnh động sẽ thành ảnh tĩnh".
- D39 Object mồ côi `pw2/t/`: register xoá object cuối vừa ghi nếu INSERT lỗi (không xoá khi trúng dedupe); GC quét thêm object `pw2/t/` không có row và cũ > 1 ngày.
- D40 Đóng picker khi đang upload: upload tiếp tục chạy nền vào thư viện, toast báo xong; không gán vào field đang mở.
- D41 Báo cáo GC: JSON private ở `pw2/reports/gc/{yyyy-mm-dd}.json`, giữ 8 bản gần nhất (không tạo bảng).
- D42 Hạ tầng test: MinIO đã có trong docker-compose; S0 thêm MinIO service vào job CI integration — điều kiện tiên quyết cho TC SEC-1 và NFR-05.
- D43 CSRF: mọi route media thay đổi trạng thái kiểm `Origin`/`Sec-Fetch-Site` same-origin + SameSite cookie.
- D44 Media được đơn hàng tham chiếu: KHÔNG cho force xoá (kể cả owner); chỉ hiển thị nơi dùng.
- D45 Lifecycle rule DO: QA ops kiểm sau 48h trên bucket staging, không chặn release S1.
- D46 GC đợt đầu chỉ xoá object `pw2/`; nhánh key phẳng (D21b) chỉ mở sau 4 báo cáo dry-run sạch liên tiếp. Sửa ví dụ US-F48-12 AC-3 cho khớp.
- D47 Lưu báo cáo GC theo D41 (JSON private `pw2/reports/gc/`, 8 bản) — thay cho đề xuất "Sentry làm nơi lưu"; Sentry chỉ để cảnh báo lỗi.
- D48 Usage scan tính bản chính + bản nháp mới nhất (`_pages_v` latest/autosave) của page; các version cũ hơn KHÔNG tính.
- D49 Bổ sung AC-6 cho US-F48-15: snapshot ảnh biến thể ở giỏ hàng, đơn hàng (`orders_items.image_url`), email xác nhận; TC-F48-15-06.
- D50 Storefront: đổi ảnh khi chọn chip biến thể (kể cả biến thể hết hàng qua `onPreview`); ảnh danh mục chỉ hiển thị ở header trang danh sách SP theo danh mục + thẻ danh mục đã có sẵn; không tạo block danh mục mới.
- D51 Chuyển nội dung lên thư mục cha bị trùng tên → tự đổi tên "Tên (2)", "(3)"…
- D52 Role legacy `viewer`: chỉ xem, không có quyền `media`.
- D53 Quota dùng cột mới `tenants.media_bytes_used`; KHÔNG dùng lại `settings.storageUsed/storageLimitBytes` (để nguyên, không xoá). Seed `media_storage_mb = UNLIMITED` khi soft-launch: đếm + hiển thị, chưa chặn, tới khi PO chốt số.
- D54 Dùng collection riêng `media-folders`, không dùng tính năng folders thử nghiệm của Payload.

## 10. Quyết định sau review độc lập (2026-11-09)
Đã xác minh: DB có `CREATE UNIQUE INDEX media_filename_idx ON media(filename)` + `media_tenant_storage_identity_idx (tenant_id, prefix, filename)`; bảng `media` CÓ cột `prefix`, `_objectkey`, `width`, `height`. `DATABASE_URI` dùng host Neon `-pooler` (PgBouncer transaction mode).
- D55 (H1) `_objectKey` bị plugin-cloud-storage ghi đè access → khoá field này trong plugin chạy SAU `s3Storage` (mở rộng `privateMediaAclPlugin` hoặc plugin mới); thêm `_objectKey` vào INV-1, FR-01, TC-F48-01-02.
- D56 (H2) filename unique toàn bảng → `filename = t{tenantId}-{hash32}.{ext}` (tenant) / `u{userId}-{hash32}.{ext}` (avatar); thư mục object qua `_objectKey`/`prefix` = `pw2/t/{tenantId}` / `pw2/u/{userId}`. Không dùng `filenameCompoundIndex`.
- D57 (H3) Không dedupe row private (payment proof): `content_hash` NULL; unique index partial `(tenant_id, content_hash) WHERE private = false AND content_hash IS NOT NULL`.
- D58 (H5) Guard D22 duy nhất ở `beforeOperation` (create/update): chỉ từ chối khi field hệ thống có giá trị KHÁC `originalDoc` (create: có mặt); áp cho mọi request có `req.user` không phải super-admin; Local API hệ thống (không user) đi qua; super-admin sửa alt trong /admin thành công (thêm TC). REST collection access → 403, route F48 → 404 (M9).
- D59 (H6) FR mới S1 "ingestMediaBuffer + bảng caller": generate-site-service, media-injector, media-pipeline/pool-preupload, upload-media, image-library-seeder, generate-sample-products, seed-blog-posts, save-product, settings/payments/actions (QR), carton-placeholder, sso/avatar-sync, users/me/avatar, upload-proof*, pw1-delta/delta-writer (chỉ đọc/ghi row, không upload). Mọi caller set `created_via`. NFR-08: thời gian generate site p95 không tăng > 10%. Bỏ global mutex chỉ khi TC thay thế pass (cập nhật TC-GENPERF-W2-07 trong qa/F01-gen-perf.md). `sharp.concurrency` thấp chỉ trong route register.
- D60 (H7) Pooler → lock GC dùng `pg_try_advisory_xact_lock` trong transaction ngắn hoặc Redis lock TTL; transaction quota/register dùng `pool.connect()` + BEGIN/COMMIT trên primary (không `pool.query` rời).
- D61 (H8) GC chạy HẰNG NGÀY, ngân sách 45s/lượt, xử lý theo tenant (quét usage 1 lần/tenant/lượt), checkpoint `tenants.media_gc_checked_at`; reconcile quota cùng lượt theo lát; circuit breaker theo tỉ lệ (xoá > 50% media của tenant hoặc > 3× trung bình 4 lượt trước) → dừng + Sentry.
- D62 (Medium/Low):
  - M1 usage scan duyệt toàn bộ doc site (gồm `branding_logo/branding_favicon` text URL); dùng tên cột thật (`payments_qr_image_id`…).
  - M2 force delete = 1 transaction SQL (set NULL FK; XOÁ dòng `products_images` thay vì để NULL; gồm `_pages_v` bản mới nhất) rồi xoá row; xoá object SAU commit; thêm index cho cột FK media hay dùng trong scan.
  - M3 `media_folders.parent_id` ON DELETE NO ACTION (DEFERRABLE) hoặc CASCADE theo tenant; không RESTRICT.
  - M4 Dedupe trúng row `created_via ∈ {ai,stock,seed}` khi merchant upload → nâng `created_via='upload'`, xoá `unused_since`.
  - M5 Register khoá `pg_advisory_xact_lock(hash(tenant, content_hash))` trước kiểm tra/ghi.
  - M6 Row PW1 migrate (`filename` null) KHÔNG tính quota (tính toán nội bộ PW2, không migrate); reconcile xong mọi tenant trước khi bật chặn; trừ quota trong `afterDelete` cho mọi đường xoá; INV-5 dùng dung sai như FR-33e.
  - M7 `compress-image.ts` dùng đúng `blob.type`; input `accept` tường minh (iOS tự đổi HEIC→JPEG).
  - M8 Flag off: presign/register trả hợp đồng cũ (luồng hiện tại), client tự phát hiện qua field `pipeline: 'v1'|'v2'`; TC flag-off; đổi `NEXT_PUBLIC_MEDIA_CDN_URL` cần rebuild (ghi rollback).
  - Low: không dựa `content-length-range` min 1 (register kiểm `ContentLength ≥ 1`); Redis `pending` TTL 90s, `done` 900s; tìm kiếm dùng ILIKE (bỏ `unaccent`); thêm `orders_items.image_url` vào arch §4.2; bảng key thêm `.png/.ico`; tên guard thống nhất `isDeletableStorageKey`; trước khi bật xoá chạy query audit row có `filename`/`_objectkey` bất thường (dấu hiệu SEC-1 đã bị dùng); `minimumCacheTTL` 1 ngày (ảnh gỡ không bị giữ lâu).
- D63 Chấp nhận: row private dùng filename `t{tenantId}-{uuid32}.{ext}`, content_hash NULL; bảng caller thêm picture-ingest, pw1-json/writer, pw1-batch.

## 11. Quyết định sau review lần 2 (2026-11-09)
- D64 (N1) Pipeline v2 chỉ ghi `prefix = 'pw2/t/{tenantId}'` (private `pw2/private/t/{tenantId}`, avatar `pw2/u/{userId}`), `_objectKey = NULL`. Storage key chuẩn = join phần khác rỗng của `[prefix, _objectKey, filename]` (như plugin `buildPrefixWithObjectKey`, `mediaObjectKeys()`, route private) — dùng cho URL đọc, xoá, `isDeletableStorageKey`, quét mồ côi GC, `matchKeys`. Ghi cùng giá trị vào cả hai sẽ thành `pw2/t/1/pw2/t/1/…` ≠ key PutObject. Khoá `_objectKey` (D55) giữ. TC-F48-04-29, -04-30, -12-18.
- D65 (H5) `beforeOperation` lấy `originalDoc`: update theo id → `req.payload.findByID({ id, depth: 0, overrideAccess: true, req })`; update bulk theo `where` có field hệ thống → chặn 400 `MEDIA_FIELD_READONLY` (không kiểm từng doc).
- D66 (H8) GC/đối soát: đầu lượt 1 câu SQL chỉ chọn tenant có ứng viên (sweep đến hạn; media `created_via` NOT NULL mới sau checkpoint hoặc checkpoint NULL; `sites.updated_at` > checkpoint có media ai/stock/seed), thứ tự checkpoint cũ nhất; tenant sạch bỏ qua; lệch quota xử lý ở pha đối soát rẻ đầu lượt (SQL so `SUM(filesize)`). Không thêm cột. NFR-S4-05: phủ hết tenant ứng viên ≤ 7 ngày (`oldestPendingDays` trong báo cáo). TC-F48-12-19.
- D67 (M6) Trừ quota khi xoá đúng 1 lần: đường Local API → hook `afterDelete` trừ `tenants.media_bytes_used`; đường SQL trực tiếp (force, GC) → trừ trong cùng transaction, không gọi hook. TC-F48-13-11.

## 12. Quyết định sau review lần 3 (2026-11-09, staging `5c3e3bdca`)
Nguồn: `plans/reports/code-reviewer-261109-1735-F48-docs-final-review.md`. Arch tách GC/vòng đời sang `docs/architecture/F48-media-management-lifecycle.md` (§8).
- D68 (A-H1) S0 sửa `DELETE /api/media/library/[id]` (`route.ts:55` đang `overrideAccess:false`) → `assertCanManageMedia` + kiểm tenant + `overrideAccess:true`; 404 `MEDIA_NOT_FOUND` cho tenant khác/global/private. TC-PERF-187/188/191..193 (`docs/qa/F-security-perf-upgrade.md`) đổi kỳ vọng khi S0 triển khai.
- D69 (A-H2) Field hệ thống chỉ khoá `update`; không đặt `create: false` (Payload `generateFileData` chạy trước `beforeValidate`). REST create bị collection access + guard D70 chặn.
- D70 (A-H3) Guard `rejectSystemFieldWrites` (gồm chặn bulk D65) chỉ áp REST/GraphQL (`req.payloadAPI !== 'local'`); Local API miễn hoàn toàn (carton-placeholder.ts:154,162, save-product, actions/media), được bảo vệ bằng field access `update`. Cần TC hồi quy carton.
- D71 (A-H4, M11) Row tenant NULL không dedupe: avatar `pw2/u/{userId}/u{userId}-{uuid32}.webp`, global khác `pw2/g/g-{uuid32}.{ext}`, `content_hash` NULL (như D57/D63).
- D72 (A-H5) `ingestMediaBuffer` trả `{ doc, deduped }`; caller cấm xoá bù khi `deduped=true` (users/me/avatar/route.ts:71, apply-avatar-state.ts:88, actions/media.ts:62, save-product.ts:115 — 2 chỗ sau thêm `replacedStaleId !== doc.id`).
- D73 (A-H6, payment) Kiểm quyền QR: `media.tenant === tenantId && !private && image/*` thay `alt === qr-{tenantId}` (settings/payments/actions.ts:178); làm ở S1 cùng lúc QR chuyển sang `ingestMediaBuffer`.
- D74 (B-H1, M12) Ảnh danh mục hiển thị ở header block products-grid khi lọc đúng 1 `categoryId` (ảnh 4:1 desktop / 2:1 mobile + tên + mô tả; không ảnh → chỉ chữ). Bỏ "thẻ danh mục có sẵn" và PLP `?category=`. `categories.image` từng bị xoá ở #1587 (02a6b024be, `categories.drop_image_id`, "stored but never rendered") → **⏸ hoãn (D88, PO 2026-11-10)** chờ cutover Commerce OS. Migration mới `f48.categories.image_id` đặt sau entry drop.
- D75 (M1–M3) Arch là nguồn chuẩn duy nhất: tên migration/index (§4.2), claims `uploadToken` `{v, uploadId, key, userId, tenantId, purpose, contentType, maxBytes, exp}` (§3.3), danh sách file (§6), seed `plan_features` (DO $$ … IF NOT EXISTS — chạy được trên cả 2 dạng bảng, không ON CONFLICT).
- D76 (M4, M5, D39) Register: PutObject/CopyObject trước (key theo hash ⇒ idempotent), rồi tx ngắn (xact lock → dedupe → quota → INSERT → đọc DTO bằng client tx; không qua `payload.find` vì `DATABASE_URI_READ_REPLICA`). Lỗi quota/INSERT: xoá object chỉ khi còn giữ lock và không row nào trỏ cùng key; lượt khác sau lock HeadObject, thiếu thì ghi lại.
- D77 (M6) GC: khoá lượt Redis `NX EX 150` (lỗi ⇒ bỏ lượt) + lease theo tenant `UPDATE tenants SET media_gc_checked_at = $runStart WHERE id=$t AND (… IS NULL OR … < $runStart) RETURNING id`.
- D78 (M7–M10) Audit D62 là gate trước deploy S0; id bị cờ không xoá object ở mọi đường xoá (`pw2/reports/audit/flagged-media-ids.json`). `ingestMediaBuffer` dùng chung flag `MEDIA_PIPELINE_V2_ENABLED`. QR thanh toán đang bật không force delete (409 `MEDIA_FORCE_DELETE_FORBIDDEN`). `tenants.media_bytes_used`/`media_gc_checked_at` là cột SQL thuần, không field Payload (`check-migrations.js` chỉ kiểm chiều field→migration nên chấp nhận).
- D79 Route private `/api/media/private/[id]`: owner tenant / super-admin / staff cùng tenant có `orders` → 200; staff không `orders` → 403 `MEDIA_FORBIDDEN`; tenant khác hoặc id không private → 404 `MEDIA_NOT_FOUND`; anonymous → 401 `MEDIA_UNAUTHORIZED`. Đổi code ở S0 (hiện `canReadPrivateMedia` cho mọi thành viên).
- D80 QR bị từ chối (D73): tenant khác → 404 `MEDIA_NOT_FOUND`; private hoặc không phải `image/*` → 400 `MEDIA_UNSUPPORTED_TYPE`. Không thêm mã lỗi mới.
- Low: `MEDIA_NOT_FOUND` vào arch §3.8; `isRestMediaRequest` giữ loại trừ `params.filename`; `vercel.json` glob `src/app/api/**/*.ts` = 120 vs route 60 — chưa xác minh giá trị thắng, thiết kế không phụ thuộc; số dòng: media-pipeline.ts:168, Products.ts:457/609, Sites.ts:534.
- D81 (M7) Danh sách cờ lỗi/thiếu ⇒ fail-closed: không xoá object key phẳng D21(b), chỉ xoá `pw2/`; Sentry `media.flagged_list_unavailable`. Audit chạy lại ngay sau deploy S0; ops chạy, đọc DB/S3 chỉ đọc, chỉ ghi report JSON `pw2/reports/audit/`.
- D82 (N1) Local API mặc định `overrideAccess:true` (field access không áp); tin được vì không đường nào đưa input client vào field hệ thống. Ghi media qua Local API mang input client ⇒ `overrideAccess:false` hoặc allowlist field.
- D83 (N2) Register video: ETag từ HeadObject; GetObject `IfMatch`, CopyObject `CopySourceIfMatch`; lệch ⇒ xoá tmp + 409 `MEDIA_KEY_INVALID` (không mã mới). TC-F48-04-33.
- D84 (DAM) Chính sách ảnh SP/SKU khớp DAM Commerce OS: tối đa 10 (PO đồng ý D11 — D88), đầu vào jpeg/png/webp, bản lưu ≤ 3 MB (hạ q/kích thước tới ≤ 3 MB, không từ chối), ảnh đầu = chính và là ảnh; validator từ chối gif/avif/svg/> 3 MB khi thêm mới → `PRODUCT_IMAGES_INVALID`; ảnh lịch sử giữ.
- D85 (DAM) Ảnh SKU = chọn từ gallery của chính SP (D10) ≈ strategy `own`; không copy ảnh; SP chỉ lưu media id + thứ tự.
- D86 (DAM) Tài liệu `docs/architecture/F48-media-management-dam-alignment.md`: bối cảnh #1812/D-04/G-08, ánh xạ khái niệm + field, quy tắc giữ (id ổn định, không nhúng URL, adapter `media-source`), rủi ro cutover, câu hỏi owner migration `minhprimecommerce`.
- D88 (PO) PO review 2026-11-10 (comment PR #2431): D9 giữ soft launch `UNLIMITED` (D53), chốt số theo gói sau báo cáo dung lượng thực ở S4; D11 đồng ý 10 ảnh; D13 đồng ý (nhóm Online Store, sau Blog); bản dịch ms rà trước release S1, PO sắp xếp người rà; D74 / US-F48-16 (ảnh danh mục) **hoãn** chờ câu 9 (cutover Commerce OS) — không làm trong S5, giữ tài liệu để mở lại.
