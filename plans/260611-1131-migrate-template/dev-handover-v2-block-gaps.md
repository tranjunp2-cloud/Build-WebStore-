# 🚨 BLOCKER — Bổ sung cấu hình Block CMS V2 trước khi Migrate 9 Template V1

> **Người tạo:** Product/UI-UX Designer (bàn giao migration F35)
> **Trạng thái:** 🔴 BLOCKER — chặn pipeline "đổ data V1 → V2". Scope đợt này = **Tier 0 (GAP-1, GAP-2) + Tier 1 (GAP-3→7)** (chốt 2026-06-12, xem §Scope). KHÔNG bắt đầu Load data tới khi Tier 0+1 xong.
> **Ngày:** 2026-06-11
> **Companion docs:** `research/v1-model-to-payload-map.md` (data layer), `docs/design/F35-template-block-design.md` (admin UX).

---

## Vì sao đây là Blocker

Đã rà soát config block V2 thực tế (`src/blocks/**`). Phát hiện **2 trường cấu hình cốt lõi** mà 9 template V1 đang dùng nhưng V2 **chưa tái tạo đủ**. Nếu đổ data V1 sang khi V2 còn thiếu, Merchant **không dựng lại được giao diện họ đang có** → gãy UI/UX khi cutover. Phải bổ sung field trước, rồi mới viết transformer/load.

> ⚠️ **Tính năng cần bổ sung:** Hero V2 cần thêm **mục "Add Slide" riêng** để Merchant tự thêm nhiều slide kèm nội dung từng slide. Carousel hiện tại (`slideshow` + `images[]`) mới chạy được ảnh "câm", chưa có chức năng thêm slide với title/subtitle/button/alignment riêng (xem GAP-1).

---

## ⚙️ Kiến trúc Block V2 — Dev cần đụng 4 (→5) chỗ cho mỗi gap

Block V2 **không phải** Payload field native. Mỗi block định nghĩa bằng:

1. **Zod schema** — `src/blocks/{name}/config.ts` (export `configSchema`). ⬅️ thêm field ở đây.
2. **Meta `editableFields`** — cùng file, mảng tên field cho editor hiển thị.
3. **Form control editor** — Studio/builder (`src/app/studio/...`, `block-schema-inspector.tsx`) render field từ schema.
4. **Renderer** — `src/blocks/{name}/index.tsx` + `variants/*` đọc field mới để hiển thị.
5. **Mirror Payload `Pages.ts`** — có field hero song song trong `src/collections/Pages.ts` (xác nhận bởi comment `src/blocks/types.ts:158`). Sync schema + cân nhắc migration `scripts/db-setup.js` nếu lưu cột (nếu block lưu JSON thì bỏ qua — Dev tự xác nhận).

---

## 🔑 Quyết định cần chốt TRƯỚC khi code

| # | Quyết định | Ai chốt | Rủi ro nếu bỏ qua |
|---|---|---|---|
| D1 | Hero `images[]` cũ: đổi tên → `slides[]` hay giữ song song + migration data hero đang có? | Dev | Mất/ghi đè hero data hiện tại |
| D2 | Styling per-slide: giữ V1 hay quy về theme? | PM/Design | ✅ **CHỐT: quy về theme color** — `title/subtitle` dùng typography theme, `button` dùng style theme. Styling V1 (bold/italic/size/color, button default/hover) **KHÔNG migrate** (accepted loss). |
| D3 | Toggle show/hide per-slide (V1 có) — giữ hay bỏ? | PM/Design | ✅ **CHỐT: bỏ toggle.** V2 render element nếu field non-empty. Transformer: V1 `show=false` → xoá trống field; `display=false` → bỏ qua slide. |
| D4 | Max slide = 5 — V1 có store nào >5 slide không? | Dev (tra DB V1) | Truncate = mất slide |
| D5 | GAP-2: `filterConfig` trong `products-grid` hay tách `productListingBlock` mới? | Dev + Design | Ảnh hưởng transformer map V1 |
| D6 | `sortDefault` options đồng bộ `order_by` V1 (gồm "bán chạy"?) | Dev | Sort sai tiêu chí V1 |

### ✅ Decisions đã chốt (2026-06-12 — PM/Design)

- **DEC-A = D2 + D3:** Banner accept-loss. Per-slide chỉ `image/title/subtitle/button{text,url}/alignment`; styling & toggle show/hide **bỏ**, text+nút ăn **Typography + Theme Global**; storefront tự ẩn element nếu field trống.
- **DEC-C (= D5):** `filterConfig` đặt **TRONG `products-grid`**, KHÔNG tách block mới (bộ lọc can thiệp trực tiếp mảng data của grid; tách ra làm khó Merchant sắp xếp thứ tự).
- **DEC-D (lưu trữ):** **Đóng hộp Schema chuẩn** (Payload fields / cột rõ ràng), KHÔNG ném JSON key-value tự do — giữ sức mạnh query/index của Payload, tránh dẫm vết phân mảnh EAV của V1.
- **D4:** Max **5 slide** (Dev tra DB V1 xem có store >5 không).
- **D1/D6:** vẫn để Dev quyết (đổi tên `images→slides` + migration; map `order_by`/sortDefault).

---

## 🎯 Scope đợt Migration (chốt 2026-06-12): Tier 0 + Tier 1

**Tier 0 — Load-blocking (data pipeline gãy nếu thiếu):** GAP-1 (hero per-slide) · GAP-2 (filterConfig + brand model + API filter).

**Tier 1 — Brand-identity (Merchant mất danh tính → churn cao):** BẮT BUỘC gom vào đợt này.

| GAP | Thiếu gì (vs spec) | V2 location (Dev verify) | Target |
|---|---|---|---|
| **GAP-3** Store info | thiếu `hotline`, `country`, `currency` | `Sites.ts:289-317` | thêm field |
| **GAP-4** Typography per-cấp | mới có chọn font; thiếu size/weight per H1..paragraph | `Sites.ts:157-179` | thêm group typography |
| **GAP-5** Mega-menu | nesting có; thiếu `image` + `size` cho link con | `navigation/config.ts:5-77` | thêm field submenu |
| **GAP-6** Footer | thiếu line-type `icon` + toggle copyright | `footer/config.ts` | thêm type + toggle |
| **GAP-7** Header toggle | thiếu toggle Hiện Cart icon / Hiện Search | `navigation/config.ts` | thêm 2 toggle |

**Tier 2 — HOÃN (Post-Migration Backlog V2.1/V2.2):** scroll-to-top · CTA card style · Grid/List runtime · pagination style · Category Listing block · Article excerpt/read-more/badge/related/tags · Shortlist polymorphic · Cart delete-all/stock toggle · Product Detail toggles (SKU/cat-link/badge/stock).
> **Default Tier-2 = BẬT (true)** ở tầng code storefront V2 khi đổ data, để khách thấy đủ thông tin nhất. Merchant được cấp quyền TẮT sau ở V2.1/V2.2. → **không** chặn migration đợt này.

---

## GAP-1 — `hero` block: thêm tính năng "Add Slide" với nội dung per-slide

### Hiện trạng (verified)
- `src/blocks/hero/config.ts:36` — có `images?: ImageRef[]`; variant `slideshow` (`:26`).
- `src/blocks/hero/variants/slideshow.tsx:22` — carousel chạy từ `images[]`, auto-rotate **interval hardcode**.
- `ImageRef` (`src/blocks/types.ts:179`) chỉ `{ url, alt, width, height }`.
- `headline / subheadline / ctaButtons` là field **cấp block, dùng chung cho mọi slide** (`config.ts:10-13`).

### Vấn đề
Chưa có chức năng **"Add Slide"** cho phép Merchant thêm từng slide với nội dung riêng. V1 `Banner[]` mỗi slide có **header / subheader / button(default+hover) / alignment / url riêng**. V2 hiện chỉ chạy được carousel ảnh "câm" với 1 bộ text+CTA chung → mất nội dung từng slide.

### Yêu cầu cho Dev
Nâng `images: ImageRef[]` → **`slides: Slide[]`** (giữ `images` cũ cho backward-compat hoặc viết migration đổi tên — Dev chọn). Mỗi `Slide` là group:

| Field con | Type | Map V1 |
|---|---|---|
| `image` | ImageRef (Media) | Banner.image |
| `title` | Text (optional) | Banner.header |
| `subtitle` | Text (optional) | Banner.subheader |
| `button` | Group `{ text: Text, url: Text }` (optional) | Banner.button |
| `alignment` | Select `left \| center \| right` | Banner.alignment |

Cấu hình cấp block thêm:
| Field | Type | Map V1 |
|---|---|---|
| `autoRotate` | Boolean (Toggle) | BannerAnimation `auto/manual` |
| `rotateInterval` | Number (giây, hiện khi `autoRotate` bật) | timing_animation |

### UX Form mong muốn
Repeater **`+ Add Slide`** (max **5** slide). Mỗi slide expand các ô con ở trên. Toggle "Tự động chuyển slide" → hiện ô "Thời gian (giây)".

### Acceptance Criteria
- [ ] `configSchema` của hero có `slides: array<{image,title?,subtitle?,button?,alignment}>` + `autoRotate` + `rotateInterval`.
- [ ] `heroMeta.editableFields` cập nhật.
- [ ] Editor có nút **"+ Add Slide"** (repeater) để thêm/xoá/sắp xếp slide.
- [ ] `slideshow.tsx` (và các variant liên quan) render `title/subtitle/button/alignment` **per-slide**; auto-rotate đọc `rotateInterval`.
- [ ] `Pages.ts` mirror field hero sync; migration `db-setup.js` nếu cần.
- [ ] Repeater giới hạn 5 slide trong editor.

---

## GAP-2 — `products-grid` block: tích hợp Filter & Sort

### Hiện trạng (verified)
- `src/blocks/products-grid/config.ts:5-11` — chỉ `variant / headline / subheadline / limit / category(1 chuỗi)`. **Không** filter, **không** sort, **không** `list_type`.
- `src/blocks/products-featured/config.ts` — chỉ `productIds[]` (pick tay). Cũng không filter/sort.
- **Không tồn tại** `productListingBlock`.

### 🚧 Backend scope (BẮT BUỘC — verified)
- `src/app/api/storefront/products/route.ts` — `where` **chỉ filter theo `site`** (dòng 45). Không có param filter category/brand/price-range/variant.
- Sort: chỉ `ALLOWED_SORT = -createdAt/createdAt/-price/price/-name/name` (dòng 6). **Không có "bán chạy"**.
- **`Products.ts` KHÔNG có field `brand`** → toggle "Lọc Thương hiệu" không có data model. Phải tạo `brand` (field/collection) + import V1 `brand_id`.
- → GAP-2 phải làm **cả 3 lớp**: CMS config + API filter params + brand data model. Bật toggle mà API không lọc = vô dụng.

### Vấn đề
V1 cho Merchant bật/tắt lọc theo Brand / Category / Price / Variant và bật Sort ngay tại khối danh sách. V2 chưa có → không tái tạo được trải nghiệm duyệt sản phẩm của template cũ.

### Yêu cầu cho Dev
Thêm **group field `filterConfig`** vào `products-grid` (chọn `products-grid` vì đây là khối "listing" gần nhất; nếu Dev muốn tách `productListingBlock` riêng thì thống nhất trước):

| Field | Type | Mô tả |
|---|---|---|
| `filterConfig.enableFilter` | Boolean (Toggle) | Bật/tắt khu vực bộ lọc trên storefront |
| `filterConfig.filterBrand` | Boolean (Checkbox) | Lọc theo Thương hiệu |
| `filterConfig.filterCategory` | Boolean (Checkbox) | Lọc theo Danh mục |
| `filterConfig.filterPrice` | Boolean (Checkbox) | Lọc theo Khoảng giá |
| `filterConfig.filterVariant` | Boolean (Checkbox) | Lọc theo Biến thể/Thuộc tính |
| `filterConfig.enableSort` | Boolean (Toggle) | Bật nút sắp xếp |
| `filterConfig.sortDefault` | Select (optional) | Tiêu chí mặc định (giá / mới nhất / bán chạy) |

> Các checkbox `filterBrand/Category/Price/Variant` chỉ hiện khi `enableFilter` bật. `sortDefault` chỉ hiện khi `enableSort` bật.

### UX Form mong muốn
Nhóm gập "Bộ lọc & Sắp xếp" ngay trong panel cấu hình `products-grid`. Toggle master `enableFilter` → lộ 4 checkbox loại lọc. Toggle `enableSort` → lộ dropdown tiêu chí mặc định.

### Acceptance Criteria
- [ ] `ProductsGridConfigSchema` có group `filterConfig` với 7 field trên.
- [ ] `productsGridMeta.editableFields` cập nhật.
- [ ] Editor render nhóm filter/sort với conditional visibility.
- [ ] Renderer `products-grid/index.tsx` đọc `filterConfig` → render UI lọc/sort + gọi query API tương ứng.
- [ ] `Pages.ts` mirror nếu products-grid có field song song; migration nếu cần.

---

## Điều kiện gỡ Blocker
**Tier 0 (GAP-1, GAP-2) + Tier 1 (GAP-3→7)** merge vào staging và verify trên editor → đổi trạng thái doc này sang ✅, mở khoá bước **Transform/Load** của migration pipeline. Tier 2 KHÔNG chặn (default ON, làm sau).

## Câu hỏi mở cho Dev (còn lại sau khi đã chốt DEC-A/C/D)
- ✅ ~~GAP-2 filterConfig trong products-grid hay tách block~~ → **DEC-C: trong `products-grid`**.
- ✅ ~~Block lưu JSON hay cột DB~~ → **DEC-D: schema chuẩn (fields/cột)**, cân nhắc entry `scripts/db-setup.js` nếu lưu cột.
- ⏳ `sortDefault` options đồng bộ `order_by` V1 thế nào (gồm "bán chạy"?) — Dev tra DB V1 (§9 `v1-model-to-payload-map.md`).
- ⏳ D1: đổi tên `images→slides` + migration data hero hiện có — Dev chọn cách an toàn.
