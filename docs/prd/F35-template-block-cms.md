# PRD (Lean): Webstore Template Migration — CMS Block Library (F35)

> **Version:** 1.0 | **Created:** 2026-06-11 | **Author:** Product/UX Design
> **Priority:** P1 | **Sprint:** Wave TBD | **Size:** L
> **Type:** Lean PRD (Migration hand-off) — KHÔNG phải PRD sản phẩm mới.
> **Quan hệ:** Bổ trợ **PRD migration pipeline** (ETL/cutover) ở PR #1157 (`docs/prd/F35-webstore-template-v1-v2.md`). PRD này chỉ phủ **tầng CMS block-config / admin-UX** để Merchant tái tạo UI 9 template V1 trên Payload.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F35-01 | Theme & Layout toàn site | [storefront-stories](../stories/F35-template-block-storefront-stories.md) | Draft |
| US-F35-02 | Header / Navigation | [storefront-stories](../stories/F35-template-block-storefront-stories.md) | Draft |
| US-F35-03 | Footer | [storefront-stories](../stories/F35-template-block-storefront-stories.md) | Draft |
| US-F35-04 | Banner block | [storefront-stories](../stories/F35-template-block-storefront-stories.md) | Draft |
| US-F35-05 | Rich Text block | [storefront-stories](../stories/F35-template-block-storefront-stories.md) | Draft |
| US-F35-06 | Product Listing (Filter & Sort) | [commerce-stories](../stories/F35-template-block-commerce-stories.md) | Draft |
| US-F35-07 | Category Listing | [commerce-stories](../stories/F35-template-block-commerce-stories.md) | Draft |
| US-F35-08 | Article Listing & Detail | [commerce-stories](../stories/F35-template-block-commerce-stories.md) | Draft |
| US-F35-09 | Shortlist / Featured | [commerce-stories](../stories/F35-template-block-commerce-stories.md) | Draft |
| US-F35-10 | Cart & Product Detail display | [commerce-stories](../stories/F35-template-block-commerce-stories.md) | Draft |

---

## 1. Problem Statement

Migrate giao diện + nội dung của 9 template V1 (PrimeWeb, Vue3) cho ~1.490 web khách sang ECH Prime Web v2 (Payload CMS). Dev nếu chỉ có Figma sẽ thấy "bề nổi" (UI 9 template) nhưng không suy ra được "phần chìm": **CMS backend phải có Block + cấu hình (toggle/dropdown) nào để Merchant dựng lại đúng UI cũ**. PRD này định nghĩa phần chìm đó.

## 2. Target User

- **Merchant / Admin** vận hành store trên Payload CMS.
- Phi kỹ thuật; thao tác bằng form kéo-thả + toggle/dropdown.
- Thị trường MY; nội dung song ngữ (EN + BM `*_ms`).

## 3. Solution Overview

Một **thư viện Block** trên Payload, mỗi block expose đúng các "quyền năng" cấu hình map 1-1 từ data V1. 9 template share chung 1 bộ block (đã chứng minh **chỉ khác skin** — logic data-binding ở base class đồng nhất); khác biệt giao diện quy về **20 toggle/dropdown**. Skin (màu/font/markup) đi qua Theme + template V2, không phải knob của Merchant.

## 4. Scope

**IN:** thiết kế block + field/toggle/dropdown (admin-UX); danh mục block; acceptance criteria UI/UX per block; data-mapping & gaps.
**OUT (→ khác):** ETL pipeline Extract→Load→Cutover (PR #1157); checkout/order-tracking (native V2); skin/CSS per template (Dev + Figma); transformer code (HTML→Lexical, ráp EAV, ID-map đa hình).

**Scope build (chốt 2026-06-12 — đối chiếu code V2, xem [`blocker-vs-spec-reconciliation.md`](../../plans/260611-1131-migrate-template/blocker-vs-spec-reconciliation.md)):**
- **Tier 0 + Tier 1 = scope đợt này** (BẮT BUỘC): Tier 0 = hero per-slide + products filterConfig/brand (Load-blocking); Tier 1 = store-info/typography/mega-menu/footer/header-toggle (brand-identity).
- **Tier 2 = HOÃN** (backlog V2.1/V2.2): các toggle chi tiết (SKU/badge/related/scroll-top…) — storefront V2 **default BẬT**, Merchant tắt sau.
- **Banner accept-loss (DEC-A):** styling per-slide không migrate, ăn Theme/Typography.
- **DEC-C:** `filterConfig` trong `products-grid`. **DEC-D:** schema chuẩn, không JSON tự do.

---

## 5. Block Inventory + Acceptance Criteria (Lean — Business Rules UI/UX)

> AC chi tiết (Gherkin) nằm trong stories. Dưới đây là **business rules** chốt cho từng block.

### 5.1 Site / Theme (US-F35-01)
- Có Theme: Màu chính/nền/chữ-tiêu-đề/chữ-nền + Typography per cấp (H1..H6, đoạn văn: cỡ+đậm) + font toàn site.
- Nhận diện: logo, favicon, tên, mô tả, hotline[], social[], địa chỉ[], email, quốc gia, tiền tệ.
- Toggle "Hiện nút cuộn-lên-đầu" (4/9 template không có).

### 5.2 Header (US-F35-02)
- Trình dựng menu đa cấp; mega-menu link con kèm ảnh + cỡ.
- Toggle: Hiện Cart icon, Hiện Search (map HeaderConfig).
- Toggle: Sticky Header (c102/f102 = off).

### 5.3 Footer (US-F35-03)
- Repeater cột → repeater dòng; mỗi dòng Dropdown kiểu: Link nội bộ / Link ngoài / Link icon / Chữ thường (FooterType 1-4).
- "Link icon" → repeater (ảnh + link).
- Toggle "Hiện bản quyền" + text.
- Block phải phủ cả bố cục 4-cột-text lẫn 1-dòng-copyright+social (đã verify flexible).

### 5.4 Banner (US-F35-04)
- Dropdown Kích thước: **Hero** (toàn màn) / **Small** (băng rôn nhỏ).
- Dropdown Hiệu ứng: Thủ công / Tự chạy (+ Thời gian). **Mặc định Static nếu Merchant không chọn.**
- Repeater slide; mỗi slide: ảnh, link, căn lề; Tiêu đề/Phụ đề (toggle hiện + đậm/nghiêng/gạch + cỡ + màu); Nút (nhãn + màu thường/hover + toggle hiện).
- Dropdown Điều hướng: Dots / Arrows / Cả hai.
- Số slide tối đa: theo data V1 mảng phẳng (Dev chốt ngưỡng).

### 5.5 Rich Text (US-F35-05)
- WYSIWYG; giữ nguyên format nội dung tự viết V1.

### 5.6 Product Listing (US-F35-06)
- Dropdown Nguồn: Tất cả / Tự chọn (picker) / Ngẫu nhiên; Số SP/trang.
- Nhóm `filterConfig`: toggle Sắp xếp + toggle Lọc Thương hiệu/Danh mục/Giá/Biến thể (gom trong block, ngay trên list).
- Dropdown CTA card: Thêm-giỏ / Chỉ-Xem-chi-tiết / Thêm-giỏ+QuickView.
- Toggle Quick View **— conditional:** chỉ hiện khi CTA card có Quick View (`admin.condition`).
- Toggle Grid/List; Dropdown phân trang: Tải-thêm / Số-trang.

### 5.7 Category Listing (US-F35-07)
- Tiêu đề + picker danh mục.
- Dropdown Hiệu ứng: Thủ công / Tự chạy / Tĩnh.
- Dropdown Kiểu hiển thị: Grid / Carousel (đổi per_page + luồng vuốt).

### 5.8 Article Listing & Detail (US-F35-08)
- Dropdown Layout: Grid / List; Nguồn (all/fixed/random); Số bài/trang; Dropdown phân trang.
- Toggle: Hiện excerpt / "Đọc thêm" / category badge.
- Detail: Toggle Bài liên quan (+ Số lượng), Toggle Tags.

### 5.9 Shortlist / Featured (US-F35-09)
- 1 block đa hình; Tiêu đề + nhãn CTA; repeater item, mỗi item pick 1: Sản phẩm/Danh mục/Thương hiệu/Bài viết/Danh mục blog (relationship đa hình `relationTo: ['products','categories','posts','brands']`).

### 5.10 Cart & Product Detail (US-F35-10)
- Cart: tiêu đề; Toggle "Xóa tất cả" (chỉ fn102); Toggle "Hiện tồn kho".
- Product Detail: Toggle SKU / link Danh mục / badge %giảm / tồn kho / Quick View.

---

## 6. Data Mapping & Gaps

> Bản đồ dữ liệu đầy đủ + matrix Feature×Template + bẫy EAV: data map `plans/260611-1131-migrate-template/research/v1-model-to-payload-map.md` + design spec [`docs/design/F35-template-block-design.md`](../design/F35-template-block-design.md). Tóm tắt cho Dev:

- **Mọi `*Setting` interface V1 = hình EAV-đã-giải-mã** → map Payload field vào shape typed, KHÔNG vào key/value tự do.
- **3 bẫy flat-array EAV** (`items.<i>.<field>`): Banner slides · Header mega-menu · Footer icon → transform PHẢI ráp lại mảng.
- **Logic ẩn cấp template** (đã quy về toggle): nút "Xóa tất cả" (fn102), gom Filter+Sort vào Product Listing, scroll-to-top, sticky header, các show/hide element. KHÔNG có template nào bóc data khác kiểu.
- **i18n**: cặp `*` + `*_ms` (EN/BM) toàn bộ entity.
- **Media**: mọi ảnh kèm `signature` → re-upload → `media.id`.

---

## 7. Open Questions → giao Dev (cần cred DB V1 để chốt)

> **Team Dev cần làm rõ các Enum/quan hệ dưới Database V1 để map cho đúng:**

1. **`Promotion.discount_type`** (số 1/2/3…) = loại giảm giá gì? → tra seed/DB V1.
2. **Shortlist "Danh mục blog"** (loại thứ 5) lưu ở collection Payload nào?
3. **`order_by`** (listing) vs tiêu chí Sort — trùng hay khác chiều? xác nhận tham số API.
4. **Số slide banner tối đa** (mảng phẳng `items.N`) — ngưỡng kỹ thuật khi ráp.
5. Cơ chế **HTML thô → Lexical RichText**; **ID-map đa hình** Shortlist; **convert FooterType/animation enum** — Dev viết transformer.
6. Localization Payload cho cặp `*_ms` (1 field localized vs 2 field).

---

## 8. Dependencies & References

- Data map (Dev): `plans/260611-1131-migrate-template/research/v1-model-to-payload-map.md`
- Design spec (Admin UX): [`docs/design/F35-template-block-design.md`](../design/F35-template-block-design.md)
- Migration pipeline PRD + architecture: PR #1157 (`docs/prd/F35-webstore-template-v1-v2.md`, `docs/architecture/F35-webstore-template-v1-v2.md`)
- V1 source (read-only): `~/Desktop/primeweb-v1-source/`
- Số thật prod: `fb101=436 · pa101=207 · f102=198 · c101=170 · fn102=142 · fn104=121 · fn103=94 · fn101=69 · c102=53` (∑1.490)
