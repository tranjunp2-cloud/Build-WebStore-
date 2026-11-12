# Scout: quản lý media — toàn miền (PW1 prime-web-api vs PW2 staging)

- Migration PW1→PW2 đã xong (user xác nhận 2026-11-09): PW1 chỉ là tham chiếu tính năng, không đề xuất migrate thêm.
- Ngày 2026-11-09 · PW2 staging `1248713` · PW1 tm-master `adcfd63f` · chỉ đọc, không chạy app
- PW1 frontend + Prime image service: không có repo truy cập được → phía PW1 chỉ dựa API

## 1. PW1 — media là "URL + chữ ký CDN" trên ~20 entity
- Mọi ảnh lưu dạng `url` + `signature` (sig do Prime image service trả), không FK tới bảng file.
- Image service: `auth/token`, `POST image/upload`, `GET image/cdn?url=` (`app/Providers/PrimeServices/UploadImage.php`); CDN thực là DO Spaces `tm-prime-web` (migration 2022_09_*).
- Entity có ảnh: products (`product_images`, có `order`), **SKU (`product_sku_images`)**, **categories**, brands, banners, blog posts/categories, menu lines, partners, ranks, payment methods, delivery providers, store logo/favicon, users, ratings (ảnh người review), order_details (snapshot ảnh SP).
- Thư viện `medias`: cây thư mục (type file/folder, parent_id), CRUD, upload ≤20 file, rename, soft delete, xoá đệ quy; quyền `read/create/update/delete medias` + feature `content_management`. Bug: route ghi chỉ check `read`, xoá nhiều hỏng.
- Import sheet xlsx có ảnh nhúng (logo, favicon, banner) → `UploadSheetImage.php`.
- Video = link YouTube. Không resize/thumbnail/alt/WebP/quota/dedupe ở API.

## 2. PW2 — media là collection Payload có FK, nhưng nhiều tầng chưa đồng bộ
### Lưu trữ
- S3 plugin (`payload.config.ts:215`), public-read, path-style URL, bucket dùng chung PW1, không CDN trong code. Không cấu hình `imageSizes` → **không có thumbnail**, lưới/editor tải ảnh gốc.
- `next.config.ts:93` remotePatterns `https://**` (đã chặn IP nội bộ ở prod, TC-PERF-157) → image optimizer vẫn proxy được mọi host https.
- File riêng tư (biên lai CK, private flag): ACL private + `/api/media/private/[id]` theo session. Ổn.

### Tham chiếu (2 kiểu lẫn lộn)
- FK `upload` (28 field / 9 collection): product images, halal cert, blog thumbnail, site OG/QR, order payment proof, user avatar, tenant QR, template thumbnail, ~17 field trong Pages blocks. Không field nào khai `onDelete`.
- URL string trong JSON: gallery, before-after, client-logos, video/hero videoUrl, rich text, custom-html. → không đếm/quét được "đang dùng" bằng FK; xoá media làm vỡ ảnh im lặng.
- `stripOrphanMediaRefs` chỉ dọn id mồ côi khi save site.

### Ai tạo media
- Merchant (18 điểm upload, xem §3), AI generate (pixabay/wikimedia/AI, mỗi site tạo bản sao riêng, có global mutex `media-create-lock.ts`), seeder image library (dedupe theo alt per site), carton placeholder, blog seed, sample products, PW1 migration (row trỏ object PW1, filename null), payment proof, avatar.
- Row không tenant (legacy, stock, avatar, carton global) cùng tồn tại.

### Vòng đời — điểm yếu lớn nhất
- **Không có dọn dẹp:** không hook xoá, không cron, không cascade. Regenerate site xoá pages nhưng giữ media cũ (`generate-site-service.ts:1533`). Xoá site/product/blog không xoá media.
- **Không quota** theo tenant/gói; chỉ giới hạn mỗi file (ảnh 10MB, video 100MB, pdf 20MB).
- Không dedupe theo nội dung.

## 3. PW2 — 18 điểm upload, 4 đường ống khác nhau
- Đường ống: A `/api/media/upload` · B presign+register S3 · C server action `uploadMediaAction` · D route riêng (avatar, payment proof, feedback→Lark, AI attachments).
- Điểm upload: ảnh SP, block overlay (~10 block), BlockImageEditor, ImageToolbar iframe, logo, favicon, OG, footer logo, rich text block, blog body, blog cover, trang /media, avatar, QR chuyển khoản, biên lai (người mua), feedback, studio issue evidence, AI chat.
- Không đồng nhất: giới hạn 2/5/10MB tuỳ chỗ; loại file khác nhau (png/jpeg vs +webp/gif vs image/*); nén ở 5 chỗ, không nén ở 6 chỗ; alt 5 kiểu (sửa được / cố định / theo tên file / "Block image" / không có); i18n lẫn tiếng Anh/Việt cứng (BlockImageEditor, ImageUploader toast, trang confirm của người mua, studio).
- Logic input file/dropzone lặp ở ≥15 file; Logo/Favicon/OG editor gần như giống hệt.
- **Không chỗ nào chọn được ảnh có sẵn** → upload lại cùng ảnh cho mỗi SP/block.
- Không crop/focal point; không import URL (trừ rich text); không tìm ảnh stock cho merchant (chỉ AI copilot có).

## 4. Thiếu so với PW1 (tính năng)
| PW1 có | PW2 | Ghi chú |
|---|---|---|
| Ảnh theo SKU/biến thể | Không (`Products.variants` không có ảnh) | Tính năng mới cho PW2 (không backfill dữ liệu PW1) |
| Ảnh danh mục | Không (`Categories.ts` không field ảnh) | Storefront danh mục không có ảnh |
| Gallery SP không giới hạn, có thứ tự | Tối đa 5 ảnh mới (`MAX_PRODUCT_IMAGES`), chưa thấy kéo sắp xếp | |
| Thư mục + rename + xoá nhiều | Không | |
| 4 quyền media cho staff | Không có permission `media` | |
| Brand logo, banner, ảnh người review, payment method/delivery logo | Tuỳ: brand không có collection; review không có | Ngoài phạm vi media, ghi nhận |

## 5. Đề xuất kiến trúc + lộ trình (loại L)
Nguyên tắc: 1 dịch vụ media dùng chung (upload + chọn + metadata) thay vì 4 đường ống; mọi tham chiếu mới dùng media id.

- **P0 Nền tảng (không UI lớn)**
  - Hợp nhất upload về 1 hook/component (`useMediaUpload` dựa B, fallback A), 1 bảng giới hạn trong `upload-limits.ts`, nén ảnh mặc định, alt chuẩn, i18n.
  - Bật `imageSizes` (thumbnail/card) có kiểm soát hoặc dùng next/image loader thay thế → giảm tải.
- **P1 Thư viện + Picker**: API list phân trang/sort/filter server (bỏ cap 200); `MediaPickerDialog` (Upload | Thư viện | URL) gắn vào 18 điểm theo thứ tự giá trị (SP, block, blog, logo/OG); sửa alt/caption/tên; chọn nhiều, xoá nhiều; trang /media tách component.
- **P2 Tham chiếu & an toàn xoá**: hàm `findMediaUsages(mediaId)` quét FK + JSON blocks + rich text; cảnh báo khi xoá; chuyển dần block URL-string sang `{id,url}`.
- **P3 Vòng đời & chi phí**: cron dọn media mồ côi (không tham chiếu, > N ngày, loại AI/seed trước), xoá media cũ khi regenerate; quota dung lượng theo gói + hiển thị usage.
- **P4 Parity PW1 (schema)**: thư mục (`MediaFolders` + `Media.folder`), quyền `media` cho staff, ảnh SKU/biến thể, ảnh danh mục, bỏ giới hạn 5 ảnh + kéo sắp xếp.
- **P5 Tuỳ chọn**: crop/focal point, stock search cho merchant, CDN trước S3, thu hẹp remotePatterns.

## Câu hỏi chưa rõ
- S3 adapter có xoá object khi xoá row không (chưa xác minh)? Bucket dùng chung PW1 → dọn dẹp phải chỉ đụng object PW2.
- /media lên sidebar trái quyết định 2026-06-11 → PO.
