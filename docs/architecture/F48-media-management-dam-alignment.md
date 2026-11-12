# Architecture: F48 ↔ DAM Commerce OS — tương thích migrate (D84–D86)

> **Version:** 1.0 | **Created:** 2026-11-10 | **Owner:** Dev | **Tham chiếu:** staging `5c3e3bdca`, nhánh `rewrite/v1` `6f16d4cc7` (chỉ đọc)
> **Liên quan:** [Arch F48](./F48-media-management.md) · [Overview](../prd/F48-media-management-overview.md) · [PRD S5](../prd/F48-media-management-sprint5.md) · scout `plans/reports/scout-261110-0930-rewrite-v1-dam-vs-f48.md`
> **Quyết định:** D84 (chính sách ảnh SP khớp DAM), D85 (ảnh SKU = chọn từ gallery, tương đương strategy `own`), D86 (tài liệu này). Đường dẫn dưới đây tính từ gốc `rewrite/v1`.

---

## 1. Bối cảnh

- **Epic #1812 (đã đóng):** ECH Commerce OS (`apps/platform-api`) sở hữu toàn bộ ecommerce; Prime Web (PW) chỉ còn CMS + web builder.
- **ech-mig-01 D-04** (`docs/migration/ech-mig-01/product-data-ownership.md:25,125`): ECH sở hữu "Media-reference commerce facts"; `products_images` + `Media` docs **MIGRATE** sang ECH asset links (link theo `assetId`).
- **ech-mig-07 G-08** (`docs/migration/ech-mig-07/README.md:24,79`): binary media **giữ ở Payload Media** (`MEDIA_OWNER_RETAINED`), chỉ ghi mapping `images[]/halalCertImage`; "ingest later if ever".
- **DAM chưa chạy:** worker `dam-rendition`/`dam-maintenance` DORMANT (`docs/migration/ech-mig-03/runtime-activation-matrix.md:48,83-84`). **Chưa có ngày cutover.**
- **Hệ quả:** F48 S0–S4 (media CMS) vẫn thuộc PW. S5 (ảnh SP/SKU) vẫn làm và dữ liệu phải **migrate được 1-1** sang `product_asset_links` khi cutover. Ảnh danh mục US-F48-16 hoãn theo D88.

## 2. DAM đang có gì (trích)

| Thành phần | File:dòng | Ghi chú |
|---|---|---|
| `assets` | `packages/ech-database/src/schemas/dam/tables.schema.ts:54-86` | `folderId`, `libraryScope` (`library`/`usage_only`), `altText`, `mimeType`/`effectiveMimeType`, `mediaReadinessStatus`, `byteSize`, `contentHash` (:76), `width/height`, soft delete. Scope `organizationId` + RLS |
| `asset_folders` | `…/dam/tables.schema.ts:30-52` | cây `parentId` |
| `storage_profiles` | `…/dam/tables.schema.ts:168-190` | `publicBaseUrl`/`publicDomain`, `quotaPolicy` (:181), credential vault |
| `storage_objects` | `…/dam/tables.schema.ts:203-240` | master / rendition / tmp / quarantine |
| `asset_usage_links` | `…/dam/tables.schema.ts:311-338` | `usageContext`, `usageId`, `usageRole`, `sortOrder` |
| `product_asset_links` | `packages/ech-database/src/schemas/product-core/product-asset-links.schema.ts:17-53` | `productId`, `assetId`, `role`, `locale`, `sortOrder`, `isPrimary`; unique 1 primary/SP (:37-39); xoá asset bị `restrict` (:50) |
| Chính sách ảnh SP | `apps/platform-api/src/modules/products/media/application/policies/product-media-policy-provider.ts:17-34` | tối đa 10; `image/jpeg|png|webp`; 3 MB/ảnh; primary bắt buộc khi có ảnh, chỉ `image` |
| Strategy biến thể | `apps/platform-api/src/modules/products/media/domain/effective-product-media.domain.ts:11,26-33,56`; `packages/ech-database/src/schemas/product-core/products.schema.ts:60,79` | biến thể = SP con (`parentProductId`) với `media_strategy ∈ own/inherit/augment/replace`; NULL ⇒ root `own`, con `augment`; ảnh cha **không copy** xuống con |
| Ảnh biến thể theo sàn | `apps/platform-api/src/modules/listings/domain/policies/variant-media-inheritance.policy.ts:5-13` | `effective` / `own` theo marketplace |

DAM **chưa có**: ảnh danh mục, tag, dedupe tự động, GC object vật lý, rendition đa cỡ (chỉ picker 480px), cờ `private` trên `assets` (grep `tables.schema.ts` không thấy).

## 3. Ánh xạ khái niệm Payload Media ↔ DAM

| F48 (Payload, PW) | DAM (ECH) | Mức khớp |
|---|---|---|
| `media` (row) | `assets` (+ `storage_objects` master) | Khớp; id khác kiểu (serial ↔ TypeID) ⇒ cần bảng mapping |
| `media_folders` (S3, D20) | `asset_folders` | Khớp (cây `parent`) |
| Usage scan / registry (S4, `media-reference-sources.ts`) | `asset_usage_links` | Khác cách làm: F48 quét FK lúc cần; DAM ghi link tường minh. Migrate = sinh link từ registry |
| `private` + route `/api/media/private/[id]` (D79) | storage profile riêng / private preview | DAM chưa có cờ private ⇒ biên lai thanh toán **không** migrate qua DAM (thuộc đơn hàng) |
| `content_hash` (sha256 bản WebP, D57) | `assets.contentHash` | Khớp tên; DAM không tự dedupe |
| Quota tenant (S4, D9) | `storage_profiles.quotaPolicy` | Khác đơn vị: F48 theo gói/tenant, DAM theo profile |
| `alt` | `assets.altText` | Khớp |
| `products.images[]` (thứ tự, `images[0]` = chính, D11) | `product_asset_links` `role='gallery'`, `sortOrder` = index, `isPrimary` = (index 0) | Khớp 1-1 (D84) |
| `products.variants[].image` (D10, D85) | SP con `media_strategy='own'` + 1 link `isPrimary=true` trỏ cùng `assetId` | Khớp, không copy binary |
| `products.halalCertImage` (D30) | `product_asset_links` role riêng (vd `certificate`) — **ECH chốt** | Cần ECH xác nhận role |
| `categories.image` (S5, D74 — ⏸ hoãn D88) | **(DAM chưa có)** — cần bổ sung phía ECH | Lệch — câu hỏi §6 |

## 4. Ánh xạ field khi migrate

| Nguồn PW | Đích DAM | Quy tắc |
|---|---|---|
| `media.id` | `assets.metadata.legacyMediaId` + bảng mapping `mediaId → assetId` | id PW không đổi suốt vòng đời (D86) |
| `media.tenant` | `assets.organizationId` | theo mapping tenant → organization của ECH-MIG |
| `storageKey(media)` = join `[prefix, _objectKey, filename]` | `storage_objects` master (object giữ nguyên chỗ cũ, G-08) | D87: lưu nguyên key phiên bản `hash32-uuid32` hoặc key legacy, không suy lại từ contentHash/không rename, không copy bytes khi cutover |
| `media.mimeType`, `filesize`, `width`, `height` | `mimeType`/`effectiveMimeType`, `byteSize`, `width`, `height` | ảnh F48 đều `image/webp` sau chuẩn hoá |
| `media.alt` | `altText` | — |
| `media.content_hash` | `contentHash` | — |
| `media.folder` | `folderId` (mapping `media_folders → asset_folders`) | — |
| `media.created_via` (`upload`/`ai`/`stock`/`seed`/`system`/`import-url`/`proof`, NULL = row cũ) | `sourceType` | `proof` không migrate (biên lai private, D40); NULL/`upload`/`import-url` ⇒ `upload`; `ai`/`stock`/`seed`/`system` map 1-1 nếu DAM có giá trị tương ứng, không có thì `upload` + ghi `metadata.legacyCreatedVia` |
| Row không được tham chiếu bởi SP | `libraryScope='library'` | — |
| `products.images[i].image` | `product_asset_links(productId, assetId, role='gallery', sortOrder=i, isPrimary=(i=0))` | gallery lịch sử > 10 ảnh vẫn migrate đủ (policy ECH quyết hiển thị) |
| `products.images[i].alt` (override) | `product_asset_links.metadata.alt` | chỉ khi khác `media.alt` |
| `variants[j].image` | link SP con, `media_strategy='own'` | null ⇒ không link, `media_strategy` NULL (con `augment` = dùng ảnh cha) |

## 5. Quy tắc phải giữ ở F48 để migrate dễ

1. **D84 — chính sách ảnh SP/SKU khớp DAM:** tối đa 10 (PO đồng ý D11 — D88); đầu vào chỉ jpeg/png/webp; ảnh **lưu** sau chuẩn hoá ≤ 3 MB (pipeline WebP ≤2560 q80, vượt 3 MB thì hạ chất lượng rồi kích thước tới khi ≤ 3 MB — không từ chối); ảnh đầu = ảnh chính, phải là ảnh. Validator server từ chối media gif/avif/svg/> 3 MB khi **thêm mới** vào gallery (ảnh lịch sử giữ nguyên).
2. **D85 — ảnh SKU:** chọn từ gallery của chính SP (D10); không copy ảnh, không upload riêng cho biến thể; SP chỉ lưu media id + thứ tự.
3. **Media id ổn định:** không tái tạo row khi sửa ảnh (crop/thay file = media mới, link cũ giữ id cũ); không đổi kiểu id.
4. **Không nhúng URL vào JSON sản phẩm:** SP chỉ lưu id (`images[].image`, `variants[].image`); URL suy ra lúc đọc. Ngoại lệ có chủ đích: snapshot `orders.items[].imageUrl` (D29, lịch sử đơn).
5. **UI gọi qua adapter `media-source`:** picker / gallery / variant popover đọc qua `src/lib/media/media-source.ts` (interface `list`, `getById`, `resolveUrl`), triển khai hiện tại = Payload. Khi cutover chỉ thêm triển khai DAM (`/api/assets/*` proxy sẵn có), không sửa component.

## 6. Rủi ro

| ID | Rủi ro | Giảm thiểu |
|---|---|---|
| R-D1 | Cutover sớm ⇒ code S5 (gallery editor, variant image, category image) tuổi thọ ngắn | Giữ S5 nhỏ (M); logic validate nằm 1 chỗ; UI qua `media-source`; hỏi ngày cutover trước khi bắt đầu S5 |
| R-D2 | Ảnh danh mục không có đích DAM | Hỏi owner (§7); nếu DAM không thêm, migrate thành `asset_usage_links` `usageContext='category'` |
| R-D3 | Gallery lịch sử vượt policy (> 10 ảnh, gif, > 3 MB) bị DAM từ chối khi import | ECH import bỏ qua policy cho dữ liệu migrate hoặc đánh `readiness` lỗi; F48 không tự xoá |
| R-D4 | `own` vs `augment` cho biến thể hiển thị khác storefront PW | Ghi rõ D85 = `own` (1 ảnh); đổi sang `augment` là quyết định phía ECH |

## 7. Câu hỏi gửi owner migration (`minhprimecommerce`)

1. Ngày cutover rewrite/v1 (hoặc mốc dự kiến)? Có trước khi F48 S5 bắt đầu không?
2. Sau cutover, ai làm ảnh SKU và ảnh danh mục — ECH portal (`packages/commerce-portal/src/modules/dam`) hay PW vẫn giữ?
3. DAM có thêm ảnh danh mục (taxonomy asset link) không? Nếu không, chấp nhận `asset_usage_links` thay thế?
4. Role cho Halal cert trong `product_asset_links`? Biến thể migrate dùng `own` (D85) có đúng ý ECH không?
