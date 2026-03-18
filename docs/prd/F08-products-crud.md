# PRD: Products CRUD (F08)
> **Version:** 2.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 4 | **Size:** L
> **Depends on:** Dashboard ✅, Payload CMS Products collection ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 Halal

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| US-F08-01 | Products CRUD + Trạng thái sản phẩm (Active/Draft) | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |
| US-F08-02 | Quản lý Biến thể (Variants) & SKU Tồn kho | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |
| US-F08-03 | Tự động Tối ưu SEO bằng AI | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |
| US-F08-04 | AI Chat Create Product & Hình ảnh mặc định | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |
| US-F08-05 | Quản lý Danh mục Phân cấp (Category 3-Level) | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |
| US-F08-06 | Thuộc tính Mở rộng (Attributes) & Giao diện Storefront | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |

---

## 1. Problem Statement

Site owners need to manage products from the dashboard — create, edit, delete, and organize. Currently product management is a basic table with no form validation, no image upload UI, and no AI-assisted description generation.

---

## 2. Target User

- Site owner có online shop, bán hàng đa kênh.
- Quản lý danh mục hàng trăm sản phẩm đa dạng (VD: Thời trang có màu sắc, kích cỡ).
- Cần công cụ tạo mã hàng (SKU) rành mạch để quản lý tồn kho và đồng bộ.
- Không rành kỹ thuật SEO hay copywriting — muốn mọi thứ về mô tả và meta-tags được tự động hoá bởi AI.

---

## 3. Solution Overview

Trang `/dashboard/products` hỗ trợ người bán quản lý catalog trọn vẹn chuẩn e-commerce. Tính năng xoay quanh: Tạo/sửa sản phẩm, **Tạo biến thể bán hàng (2-tier Variants)**, Quản lý Tồn kho cấp độ **SKU**, Hệ thống **Status (Active/Draft/Archived)**. Hỗ trợ "One-click" **AI sinh nội dung mô tả & thông tin SEO thân thiện**. Phù hợp với thị trường MY (giá RM, chứng nhận Halal).

---

## 4. Scope

### In Scope
- Product list với Tabs (All, Active, Draft, Archived). (US-F08-01)
- Lọc (Filtering) & Sắp xếp (Sorting) nâng cao: Theo Category, Trạng thái Khuyến mãi, Giá (Tăng/giảm), Cũ/Mới nhất. Có Cảnh báo Tồn kho thấp (Low Stock/Out of Stock). (US-F08-01)
- Thanh Tìm kiếm (Search Bar) độc lập: Tìm nhanh sản phẩm theo Tên (Name) hoặc Mã vạch/Mã định danh (SKU ID). (US-F08-01)
- Add/Edit form quy định chặt validation. Các block: Tên, Hình ảnh (Max 5, <=5MB chuẩn toàn hệ thống), Giá bán thực, **Giá Khuyến Mãi (Compare at Price)**, Tồn kho & SKU ID, Tối thiểu 1 Category, **Kích thước đóng gói & Cân nặng (Dimensions & Weight)**, Mô tả. Status tạo mới mặc định **Draft**. (US-F08-01)
- Category Management: Menu quản lý Danh mục riêng biệt, hỗ trợ lồng nhau tối đa 3-levels (Cha - Con - Cháu). Gán SP vào các danh mục này. (US-F08-05)
- Product Attributes (Thuộc tính Mở rộng): Bảng Key-Value động (Ví dụ: Thương hiệu, Chất liệu, Xuất xứ) nằm dưới đáy mỗi sản phẩm để tối ưu thông tin SEO. (US-F08-06)
- Cấu hình Dữ liệu Storefront: Đảm bảo format dữ liệu của F08 tương thích hiển thị ngoài F09. (US-F08-06)
- Tạo sản phẩm Hàng loạt qua AI Chat: User nhập danh sách mô tả, AI parse ra nhiều sản phẩm cùng lúc. Hiển thị Bảng Preview để người dùng Confirm trước khi Save (Trạng thái mặc định Draft). **KHÔNG bao gồm sinh ảnh tự động.** (US-F08-04)
- Placehoder mặc định: Nếu sản phẩm không có ảnh, hệ thống render "thùng hàng carton dễ thương". (US-F08-04)
- Phân loại hàng (Product Variants): Tối đa 2 tầng tuỳ biến tên (VD: Màu, Size), sinh thành Bảng ma trận quản lý. (US-F08-02)
- Quản lý theo SKU: Nhập Giá bán, Tồn kho, Mã SKU riêng cho cấu hình từng biến thể. (US-F08-02)
- Tự động Gợi ý SEO Thông minh: AI tự suy luận viết Tiêu đề chuẩn SEO, mô tả Metadata, và URL Slug thân thiện dựa trên Tên Sản Phẩm. (US-F08-03)
- AI Description generator dựa trên ngành nghề. (US-F08-01)
- Halal certification toggle + cert image upload (thị trường MY).

### Out of Scope
- Bulk import CSV (chuyển sang Wave 5+)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Product appears on storefront after create | Immediate | Manual test |
| AI description used rate | > 40% | PostHog |

---

## 6. User Story Summary

```
AS A   site owner
I WANT thêm, sửa, xóa sản phẩm và AI viết description
SO THAT sản phẩm có mô tả đẹp mà không mất thời gian
```

> Source: [US-F08-01](../stories/F08-products-crud-stories.md#us-f09-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Product list: Status Tabs (Active, Draft, Archived). Cột: Thumbnail, Name, Category, Price (RM), Total Stock. | US-F08-01 | P0 | |
| FR-02 | Search Bar & Advanced List Actions: Ô Search độc lập (theo Name, SKU). Sắp xếp theo Tên, Giá, Mới nhất, Stock. Lọc theo Category, Trạng thái Sale. | US-F08-01 | P1 | Power User UX |
| FR-02.1| Low/Out of Stock Alerts: Đánh dấu (Badge/Đổi màu đỏ) cột Stock nếu = 0. Có nút filter "Hiển thị sản phẩm Hết/Sắp hết hàng". | US-F08-01 | P0 | |
| FR-03 | Product Status Toggle: Chuyển đổi Active/Draft/Archived. **Mặc định khi tạo mới luôn là Draft.** Cần user manual gạt sang Active để hiện lên web. | US-F08-01 | P0 | Draft by Default |
| FR-04 | Product Variants (2 Tầng): Nút "Thêm biến thể". User điền Tên Phân Loại 1 (VD: Màu sắc) -> Điền các Option (Đỏ, Xanh). User điền Tên Phân Loại 2 (VD: Kích cỡ) -> Option (S, M, L). | US-F08-02 | P0 | Max 2 tiers |
| FR-05 | SKU Matrix Generator: Bảng tự sinh các dòng kết hợp. Mỗi dòng có ô nhập bắt buộc [SKU ID], [Bán], [Compare at Price (Tuỳ chọn)], [Stock]. | US-F08-02 | P0 | Required if variants exist |
| FR-06 | AI SEO Optimization: Nút "✨ Tối ưu Tìm kiếm". Tự động điền Title thân thiện, Meta Description, và URL Slug dựa vào Ngành và Tên SP. Không dùng từ kỹ thuật phức tạp. | US-F08-03 | P0 | |
| FR-07 | Form Validation Rules: Bắt buộc điền Name (>3 ký tự), Description (AI/Manual), Category (>=1), Giá gốc (>0), Cân nặng (Weight >0 để tính phí Ship), SKU ID, Stock (>=0). Nếu thiếu báo Text đỏ. | US-F08-01 | P0 | Strict save barrier |
| FR-08 | AI Description: Nút "✨ AI Viết Description" chèn rich text mô tả chi tiết sản phẩm. | US-F08-01 | P0 | BM hoặc EN |
| FR-09 | Product Image Upload: Kéo thả, max 5 ảnh. Khối lượng <= 5MB/ảnh tuân thủ chuẩn Editor. Format JPG/PNG/WEBP. AI auto scale/compress. | US-F08-01 | P0 | |
| FR-10 | Bulk AI Create (Tạo hàng loạt): Nhập 1 list item -> AI parse ra Name, Price, Category, Variants. Hiển thị Bảng Preview để Edit ngang hàng (Data Grid). Khi duyệt xong lưu thành Draft, bỏ qua hình ảnh. | US-F08-04 | P0 | NLP Array parser |
| FR-11 | Default product image: Khi không có ảnh, hiển thị placeholder hình "Thùng hàng carton dễ thương". | US-F08-04 | P1 | Fallback UI |
| FR-12 | Category Management: CRUD danh mục. Hỗ trợ Parent-Child tree (Tối đa 3 level sâu: L1 > L2 > L3). Gán n-Category cho 1 Product. | US-F08-05 | P0 | Nested Set Model / ParentID |
| FR-13 | Dynamic Attributes: Ô thêm/xóa Key-Value tùy biến (VD: "Chất liệu": "Cotton"). Gen thành SEO Rich Snippets ngoài storefront. | US-F08-06 | P0 | Key-Value Array / JSON |
| FR-14 | Storefront PLP Layout: View danh sách Grid/List, Sidebar Filters (Menu theo Category 3-Level, Khoảng Giá, Attributes). | US-F08-06 | P0 | F09 Dependency |
| FR-15 | Storefront PDP Layout: Breadcrumbs (L1 > L2), Gallery ảnh (Trái), Thông tin (Phải). Khối Attributes Table ở nửa dưới trang. | US-F08-06 | P0 | F09 Dependency |

---

## 8. Business Rules

- **BR-01:** Sản phẩm scope theo tenant — không cross-tenant
- **BR-02:** Soft delete only — không hard delete
- **BR-03:** Duplicate product name cho phép (slug auto-increments)
- **BR-04:** Price = 0 allowed (free products)
- **BR-05:** Halal badge chỉ hiện trên storefront khi cert được upload
- **BR-06 (Out-of-Stock UX):** Nếu Stock = 0, TUYỆT ĐỐI KHÔNG tự động chuyển Status sang Draft/Archived (giữ nguyên Active để bảo tồn Link SEO). Thay vào đó, ngoài Storefront F09 hiển thị nhãn `[Hết hàng]` và vô hiệu hóa nút Add to Cart. Trên Dashboard F08, đưa ra Cảnh báo Đỏ tại cột Stock. Thể tích (Dimensions) và Cân nặng là bắt buộc để liên kết với Module tính phí Vận Chuyển F14 sau này.

---

## 9. User Flow

```
/dashboard/products
  ↓
[+ Add Product] HOẶC [✨ Tạo hàng loạt bằng AI Chat]
  ├── (Chat): "Nhập kho 2 mặt hàng: Áo khoác da size M L giá 500k và Mù tạt lọ 10k"
  │
 ↙ (AI Xử lý NLP trả về Preview Array)
[ AI Product Bulk Approval Grid ]
| Tick | Name         | Price | Category | Variants | Status|
| [x]  | Áo khoác da  | 500K  | Fashion  | Size:M,L | Draft |
| [x]  | Mù tạt lọ    | 10K   | F&B      |          | Draft |
  ↓ [Xác nhận Lưu 2 Products] → Vào thẳng DB danh sách Draft, chờ User Click sửa để Up Hình.
  
(Hoặc Lên Form Chi tiết cho 1 Sản Phẩm)
[Section 1: Basic Info]
Name, Hierarchy Category (Dropdown tree 3-level), Images (Crate Carton), Default Price/Stock.
  ↓
[Section 2: Variants & SKU (Optional)]
Turn on Variants:
├── Setup Tier 1: Màu sắc (Đỏ, Xanh)
├── Setup Tier 2: Kích cỡ (S, M, L)
└── Bảng Matrix tự sinh → User điền [Mã SKU], [Giá bán], [Kho] cho từng mục.
  ↓
[Section 2.5: Shipping Dimensions]
Cân nặng (Weight: kg/g), Chiều Dài (L), Rộng (W), Cao (H) (cm) -> Để chuẩn bị tính Shipping Rate F14.
  ↓
[Section 3: Content & Attributes SEO]
├── Click "✨ AI Viết Description" → HTML Rich text
├── Dynamic Attributes: [+ Add Field] -> (Key: Origin, Value: VN)
└── Click "✨ Tối ưu Tìm Kiếm" → generate SEO (Title, Description, Link)
  ↓
[ Save (Trạng thái Mặc định: MỚI TẠO LÀ DRAFT) ] 
  ↓ (User Manual Toggle)
[ Publish Active lên Storefront ]
```

---

## 10. Screen Layout

```
┌─ /dashboard/products ─────────────────────────────────┐
│  Products                          [+ Add Product]     │
│  [✨ Chat: Tạo "Móc khóa cute giá 5k, màu xanh đỏ"...] │
│  ───────────────────────────────────────────────────── │
│  [✅ Active (45)] [📝 Draft (2)] [📦 Archvied (5)]    │
│  ───────────────────────────────────────────────────── │
│  [🔍 Bắt đầu nhập tên SP hoặc mã SKU để tìm nhanh... ] │ 
│  [Category ▼] [Sort: Giá ▼] [⚠️ Lọc Kho Cạn]           │
│                                                         │
│  IMG │ Name          │ Category │  Price  │ Stock      │
│  ──  │ ────────────  │ ──────── │ ─────── │ ─────      │
│  📦  │ Baju Kurung   │ Fashion  │ RM 89   │ 25         │
│      │ ├── Đỏ - S    │   (SKU: BJ-RED-S)  │ 10         │
│      │ └── Đỏ - M    │   (SKU: BJ-RED-M)  │ 15         │
│  📷  │ Kuih Raya     │ F&B      │ RM 29   │ 100        │
│  📦  │ Lip Gloss     │ Beauty   │ RM 39   │ 0 🔴        │
│                                                         │
│ * Ghi chú ảnh: 📦 là Thùng Carton mặc định, 📷 là User Up  │
│ Mobile: cards with expanding accordion for variants    │
└────────────────────────────────────────────────────────┘
```

### 10.2 Giao diện Hiển thị Storefront (PLP & PDP)

> 📌 **Lưu ý:** Giao diện hiển thị phía End-user (Storefront) đã được chuyển giao cho **PRD: F09-storefront-commerce.md**. Vui lòng sang tài liệu F09 để xem mockups chi tiết cho màn hình Danh sách Sản phẩm (Shop) và Chi tiết Sản phẩm (Product View).

---

## 11. Acceptance Criteria

> AC được copy từ `F08-products-crud-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Add Product Form
> 📌 Source: [US-F08-01](../stories/F08-products-crud-stories.md) — AC-1

```gherkin
GIVEN user ở /dashboard/products
WHEN  click "Thêm sản phẩm"
THEN  form hiện: tên, giá (RM), category, mô tả, ảnh (max 5, max 5MB/ảnh), stock
```

### AC-2: AI Data Generators (SEO & Description)
> 📌 Source: [US-F08-03](../stories/F08-products-crud-stories.md) — AC-AI

```gherkin
GIVEN user điền tên sản phẩm (VD: "Trà Đào Cam Sả") và chọn ngành F&B
WHEN  click "✨ Tối ưu Tìm Kiếm"
THEN  AI sinh ra Tiêu đề bán hàng (SEO Title), Mô tả cho MXH (SEO Description) và tạo tự động Link thân thiện `tra-dao-cam-sa`.
WHEN  click "✨ AI Viết Description"
THEN  sinh ra văn bản mô tả giàu cảm xúc, chèn vào ô Rich Text.
```

### AC-3: Variant & SKU Matrix Generation
> 📌 Source: [US-F08-02](../stories/F08-products-crud-stories.md) — AC-1 & AC-2

```gherkin
GIVEN user đang ở trang Tạo Sản Phẩm
WHEN  gạt cờ bật "Sản phẩm có nhiều tuỳ chọn (Phân loại)"
THEN  hiện 2 box: Tầng 1 và Tầng 2
WHEN  user điền Level 1: "Màu sắc" (Trắng, Đen) và Level 2: "Kích cỡ" (M, L)
THEN  một bảng tự sinh xuất hiện bên dưới gồm 4 dòng (Trắng-M, Trắng-L, Đen-M, Đen-L)
  AND mỗi dòng yêu cầu nhập ô Mã Hàng Hóa [SKU Code], [Giá Bán riêng], [Số lượng kho riêng]
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Product list load < 2s | |
| **Security** | Tenant-scoped — không cross-tenant | |
| **Device support** | Mobile 375px — cards instead of table | |
| **Data** | Images stored in Payload media, max 5 per product | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `ProductsPage` | `app/(dashboard)/products/page.tsx` | List + filter |
| `ProductForm` | `components/dashboard/ProductForm.tsx` | Add/Edit form |
| `AIDescriptionButton` | `components/dashboard/AIDescriptionButton.tsx` | AI description generator |

### 13.2 API Endpoints

```
GET /api/products?where[tenant][equals]={id}  → list
POST /api/products                              → create
PATCH /api/products/:id                        → update
DELETE /api/products/:id (soft)               → { deletedAt: now }
POST /api/ai/product-description               → AI generate description
Auth: required, tenant-scoped
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| Payload CMS products collection | ✅ Exists | Add halal + weight fields |
| OpenAI API | ⬜ | For AI description |
| Payload media | ✅ Exists | — |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Table skeleton during fetch
- [ ] Empty State — "No products yet" + CTA
- [ ] Error State — Toast + retry on save failure
- [ ] Form Validation — Name*, price*, stock* required; Zod inline
- [ ] Button States — Save disabled during API call
- [ ] Toast Feedback — "Product saved!", "Deleted. Undo?"
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Cards instead of table
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] Payload products collection has halal + weight fields
- [ ] OpenAI API configured

---

## 19. Definition of Done

- [ ] All FR implemented
- [ ] All AC pass
- [ ] Product visible on storefront after create
- [ ] AI description works in BM và EN
- [ ] Soft delete + undo works
