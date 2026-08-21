# PRD: Products CRUD (F08)
> **Version:** 2.2 | **Updated:** 2026-07-21 | **Agent:** `project-planner`
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
| US-F08-07 | Mobile Web UX — Product Management on Small Screens | [F08-products-crud-stories.md](../stories/F08-products-crud-stories.md) | Ready |

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

Trang `/products` hỗ trợ người bán quản lý catalog trọn vẹn chuẩn e-commerce. Tính năng xoay quanh: Tạo/sửa sản phẩm, **Tạo biến thể bán hàng (2-tier Variants)**, Quản lý Tồn kho cấp độ **SKU**, Hệ thống **Status (Active/Draft/Archived)**. Hỗ trợ "One-click" **AI sinh nội dung mô tả & thông tin SEO thân thiện**. Phù hợp với thị trường MY (giá RM, chứng nhận Halal).

---

## 4. Scope

### In Scope
- Product list với Tabs (All, Active, Draft, Archived). (US-F08-01)
- Lọc (Filtering) & Sắp xếp (Sorting) nâng cao: Theo Category, Trạng thái Khuyến mãi, Giá (Tăng/giảm), Cũ/Mới nhất. Có Cảnh báo Tồn kho thấp (Low Stock/Out of Stock). (US-F08-01)
- Thanh Tìm kiếm (Search Bar) độc lập: Tìm nhanh sản phẩm theo Tên (Name) hoặc Mã vạch/Mã định danh (SKU ID). (US-F08-01)
- Add/Edit form responsive theo prototype: desktop chia **70/30** (main/sidebar), mobile xếp một cột; 4 sticky tabs **Basic Info / Pricing & Stock / Shipping & Delivery / More Information** và fixed bottom actions. Main chứa toàn bộ nội dung chỉnh sửa; sidebar chỉ có **Content Strength** (5 advisory rules, không phải publish gate) và **Status**. (US-F08-01, US-F08-07)
- Add/Edit form quy định chặt validation. Các block: Tên + compact editable slug preview, Media, Giá bán thực, **Giá Khuyến Mãi (Compare at Price)**, Tồn kho & SKU ID, Category, **Weight / Length / Width / Height**, mô tả plain textarea, Specifications và SEO. Status tạo mới mặc định **Draft**. Các giới hạn media/data tiếp tục dùng cap production hiện hành; redesign không tự đặt cap mới. (US-F08-01)
- Category Management: Menu quản lý Danh mục riêng biệt, hỗ trợ lồng nhau tối đa 3-levels (Cha - Con - Cháu). Gán SP vào các danh mục này. (US-F08-05)
- Product Attributes (Thuộc tính Mở rộng): Bảng Key-Value động (Ví dụ: Thương hiệu, Chất liệu, Xuất xứ) nằm dưới đáy mỗi sản phẩm để tối ưu thông tin SEO. (US-F08-06)
- Cấu hình Dữ liệu Storefront: Đảm bảo format dữ liệu của F08 tương thích hiển thị ngoài F09. (US-F08-06)
- Tạo sản phẩm Hàng loạt qua AI Chat: User nhập danh sách mô tả, AI parse ra nhiều sản phẩm cùng lúc. Hiển thị Bảng Preview để người dùng Confirm trước khi Save (Trạng thái mặc định Draft). **KHÔNG bao gồm sinh ảnh tự động.** (US-F08-04)
- Placehoder mặc định: Nếu sản phẩm không có ảnh, hệ thống render "thùng hàng carton dễ thương". (US-F08-04)
- Phân loại hàng (Product Variants): Tối đa **2 option groups** tuỳ biến tên (VD: Màu, Size), không giới hạn mỗi group ở 2 values. Ma trận là Cartesian product phản ứng theo option; giữ ổn định dữ liệu các row còn tồn tại khi option thay đổi, nhóm theo option 1, hỗ trợ ảnh cho từng option 1 và bulk apply. Tổng số values/rows giữ nguyên production caps hiện hành, không phát minh giới hạn mới trong redesign. (US-F08-02)
- Quản lý theo SKU: Nhập Giá bán, Tồn kho, Mã SKU riêng cho cấu hình từng biến thể. (US-F08-02)
- Gợi ý SEO thông minh: AI đề xuất Tiêu đề chuẩn SEO, mô tả Metadata và URL Slug thân thiện dựa trên Tên Sản Phẩm. User phải chủ động chấp nhận đề xuất slug; AI không tự ghi đè slug đã chỉnh thủ công. (US-F08-03)
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

> Source: [US-F08-01](../stories/F08-products-crud-stories.md#us-f08-01-products-crud--trạng-thái-sản-phẩm-activedraft)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Product list: Status Tabs (Active, Draft, Archived). Cột: Thumbnail, Name, SKU, Category, Price (RM), Total Stock, Cân nặng, Trạng thái (Toggle). Bổ sung thao tác Edit/Delete trên mỗi hàng. | US-F08-01 | P0 | Detailed Grid |
| FR-02 | Search Bar & Advanced List Actions: Ô Search độc lập (theo Name, SKU). Sắp xếp theo Tên, Giá, Mới nhất, Stock. Lọc theo Category, Trạng thái Sale. | US-F08-01 | P1 | Power User UX |
| FR-02.1| Low/Out of Stock Alerts: Đánh dấu (Badge/Đổi màu đỏ) cột Stock nếu = 0. Có nút filter "Hiển thị sản phẩm Hết/Sắp hết hàng". | US-F08-01 | P0 | |
| FR-03 | Product list/filter tiếp tục nhận diện Active/Draft/Archived. Trong Add/Edit redesign, Status selector chỉ cho chọn Draft/Active và sản phẩm mới mặc định Draft. Trước implementation phải xác minh safe handling cho record Archived theo một trong hai hướng: giữ nguyên khi status untouched hoặc chặn edit/transition với hướng dẫn rõ; tuyệt đối không silent-coerce sang Draft/Active. | US-F08-01 | P0 | Archived preserve-or-block spike |
| FR-04 | Product Variants (2 Tầng): Nút "Thêm biến thể". User điền Tên Phân Loại 1 (VD: Màu sắc) -> Điền các Option (Đỏ, Xanh). User điền Tên Phân Loại 2 (VD: Kích cỡ) -> Option (S, M, L). | US-F08-02 | P0 | Max 2 tiers |
| FR-05 | SKU Matrix Generator: Bảng tự sinh các dòng kết hợp. Mỗi dòng có ô nhập bắt buộc [SKU ID], [Bán], [Compare at Price (Tuỳ chọn)], [Stock]. | US-F08-02 | P0 | Required if variants exist |
| FR-06 | AI SEO Optimization: Nút "✨ Tối ưu Tìm kiếm" đề xuất Title, Meta Description và URL Slug dựa vào Ngành và Tên SP. Title/Description có thể điền vào trường tương ứng; slug proposal chỉ được áp dụng sau hành động chấp nhận rõ ràng và không ghi đè slug manual. | US-F08-03 | P0 | Explicit slug acceptance |
| FR-07 | Form Validation Rules: Bắt buộc điền Name (>3 ký tự), Description (AI/Manual), Category (>=1), Giá gốc (>0), Cân nặng (Weight >0 để tính phí Ship), SKU ID, Stock (>=0). Nếu thiếu báo Text đỏ. | US-F08-01 | P0 | Strict save barrier |
| FR-08 | AI Description: Nút "✨ AI Viết Description" chèn nội dung vào plain textarea có character counter; user vẫn có thể chỉnh sửa trước khi lưu. | US-F08-01 | P0 | BM hoặc EN |
| FR-09 | Product Image Upload: Kéo thả, max 5 ảnh. Khối lượng <= 5MB/ảnh tuân thủ chuẩn Editor. Format JPG/PNG/WEBP. AI auto scale/compress. | US-F08-01 | P0 | |
| FR-10 | Bulk AI Create (Tạo hàng loạt): AI parse Name, Price, Variants và `categoryId` lấy từ danh mục hiện có của tenant hoặc `null`; không tự tạo Category. Preview cho phép merchant chọn đúng 1 Category hiện có cho item chưa khớp và khóa Approve cho đến khi mọi item có Category. Luồng Add/Edit Product manual vẫn giữ validation Category bắt buộc khi Save. | US-F08-04 | P0 | Tenant-scoped NLP parser |
| FR-11 | Default product image: Khi không có ảnh, hiển thị placeholder hình "Thùng hàng carton dễ thương". | US-F08-04 | P1 | Fallback UI |
| FR-12 | Category Management: CRUD danh mục. Hỗ trợ Parent-Child tree (Tối đa 3 level sâu: L1 > L2 > L3). Gán 1 danh mục cho 1 Product (single-select). Bố trí nút/menu Direct "Quản lý Danh mục" bên cạnh nút "Add Product". Hard-block delete nếu danh mục có SP gán trực tiếp; con trực tiếp được đẩy lên top-level. | US-F08-05 | P0 | Nested Set Model / ParentID |
| FR-13 | Dynamic Attributes: Ô thêm/xóa Key-Value tùy biến (VD: "Chất liệu": "Cotton"). Gen thành SEO Rich Snippets ngoài storefront. | US-F08-06 | P0 | Key-Value Array / JSON |
| FR-14 | Storefront PLP Layout: View danh sách Grid/List, Sidebar Filters (Menu theo Category 3-Level, Khoảng Giá, Attributes). | US-F08-06 | P0 | F09 Dependency |
| FR-15 | Storefront PDP Layout: Breadcrumbs (L1 > L2), Gallery ảnh (Trái), Thông tin (Phải). Khối Attributes Table ở nửa dưới trang. | US-F08-06 | P0 | F09 Dependency |
| FR-16 | **[Mobile]** Danh sách quản lý sản phẩm trên màn hình < 768px chuyển từ cấu trúc Bảng (Data Table) sang dạng Thẻ Card xổ dọc (Stacked Cards Layout). | US-F08-07 | P1 | Chống scroll ngang |
| FR-17 | **[Mobile]** Bảng cấu hình SKU Matrix (Variants) trên điện thoại chuyển thành nhóm Accordion xếp dọc. | US-F08-07 | P1 | Tối ưu touch target |
| FR-18 | Product editor dùng responsive 70/30 trên desktop và một cột trên mobile; 4 sticky tabs: Basic Info, Pricing & Stock, Shipping & Delivery, More Information; fixed bottom actions luôn truy cập được và không che field cuối. | US-F08-01, US-F08-07 | P0 | Presentation redesign |
| FR-19 | Sidebar desktop chỉ gồm Content Strength và Status. Content Strength đánh giá 5 advisory rules, không chặn Save/Publish và không thay thế validation/publish gate hiện hành. | US-F08-01 | P0 | Advisory only |
| FR-20 | Dưới Product Name có compact editable slug preview. Slug tự đồng bộ theo tên cho đến lần đầu user sửa thủ công; sau đó không tự overwrite. Unique/format validation hiện hành vẫn áp dụng. | US-F08-03 | P0 | Auto-until-manual |
| FR-21 | Basic Info đặt Media trước các field nội dung. ALT text nằm trong disclosure theo từng ảnh, tối đa 125 ký tự. Giới hạn số lượng/kích thước ảnh giữ production caps hiện hành. | US-F08-01 | P0 | Progressive disclosure |
| FR-22 | Category mở searchable picker với ba cột hierarchy hiển thị đồng thời (L1 → L2 → L3), selected breadcrumb, Cancel và Confirm; chỉ leaf node được chọn. Microcopy chính xác cho leaf-only/pending state phải được product/design xác nhận trước implementation; không tự suy diễn thay đổi schema. | US-F08-05 | P0 | Wording pending explicit approval |
| FR-23 | Description dùng plain textarea với character counter và AI action; không yêu cầu rich-text editor trong presentation redesign. | US-F08-01 | P0 | Preserve stored schema contract |
| FR-24 | Variant matrix sinh reactive Cartesian product từ tối đa 2 option groups; giữ dữ liệu row có identity còn hợp lệ, nhóm row theo option 1, hỗ trợ image per option 1 và bulk apply các field phù hợp. Không áp đặt max values/rows mới; giữ production caps. | US-F08-02 | P0 | Stable row retention |
| FR-25 | Shipping & Delivery có đúng 4 field trình bày: Weight, Length, Width, Height. More Information chứa Specifications và SEO. | US-F08-01, US-F08-06 | P0 | Presentation grouping |

### 7.5. Prototype Redesign vs Data Contract

- Đây là **presentation/interaction redesign** của product editor; không mặc định thay đổi Payload schema, API contract, validation server-side hay publish gate hiện hành.
- Content Strength có đúng 5 advisory checks, mỗi check đóng góp 20 điểm: ít nhất 3 ảnh; Product Name dài 25–100 ký tự sau khi trim; Description dài ít nhất 100 ký tự sau khi trim; đã chọn Category; và cả Weight, Length, Width, Height đều là số hữu hạn lớn hơn 0. Checklist chỉ hướng dẫn và không được dùng làm điều kiện Publish.
- Các required field và điều kiện Active/Draft tiếp tục theo production behavior cho đến khi có quyết định schema/publish riêng được approve.
- Với category leaf-only, wording cho trạng thái parent không thể chọn và trạng thái chưa có leaf đang **pending explicit wording**; implementation không tự viết microcopy mang tính policy.
- Không quy định mới max option values hay max Cartesian rows. Hệ thống phải preserve production caps hiện hành và hiển thị lỗi/cảnh báo hiện hành khi vượt cap.

### 7.6. Data Validation Rules (Quy tắc Xác thực Dữ liệu)

Để đảm bảo tính toàn vẹn dữ liệu cho F08, hệ thống áp dụng bộ Validation Rules cụ thể sau tại Form Tạo/Sửa Sản Phẩm:

| Field Name | Lĩnh vực (Type/Rule) | Error Message |
|------------|-----------------------|---------------|
| **Product Name** | `string` (Min 3, Max 120 chars). Không chèn mã HTML. | "Product name must be between 3 and 120 characters." |
| **Price** | `number` (>= 0). Không nhận ký tự chữ. | "Price must be greater than or equal to 0." |
| **Compare At Price**| `number` (> `Price`). Tùy chọn, có thể bỏ trống. | "Compare at price must be greater than the regular price." |
| **SKU** | `string` (Max 50 chars). Chỉ nhận Alpha-numeric. Unique. | "SKU already exists or is invalid." |
| **Stock** | `integer` (>= 0). Không điền số thập phân. | "Stock cannot be negative." |
| **Category** | `single-select` (Exactly 1 danh mục bắt buộc). | "Product must belong to exactly one category." |
| **Weight** | `number` (> 0). Bắt buộc để tính phí Vận chuyển (F14). | "Weight must be greater than 0."|
| **Length (L)** | `number` (>= 0). Đơn vị cm. | "Length must be greater than or equal to 0." |
| **Width (W)** | `number` (>= 0). Đơn vị cm. | "Width must be greater than or equal to 0." |
| **Height (H)** | `number` (>= 0). Đơn vị cm. | "Height must be greater than or equal to 0." |
| **Images** | `array of files` (Max 5 items). Max 5MB/ảnh. | "Maximum 5 images allowed, up to 5MB each." |
| **SEO Title** | `string` (Max 70 chars). Hỗ trợ gen bằng AI. | "SEO Title should not exceed 70 characters." |
| **SEO Description**| `string` (Max 160 chars). Hỗ trợ gen bằng AI. | "SEO description should not exceed 160 characters." |
| **URL Slug** | `string`. Only lowercase, numbers, and hyphens. Unique. | "Slug must be lowercase alphanumeric with hyphens, and unique." |

---

## 8. Business Rules

- **BR-01:** Sản phẩm scope theo tenant — không cross-tenant
- **BR-02:** Soft delete only — không hard delete
- **BR-03:** Duplicate product name cho phép (slug auto-increments)
- **BR-04:** Price = 0 allowed (free products)
- **BR-05:** Halal badge chỉ hiện trên storefront khi cert được upload
- **BR-06 (Out-of-Stock UX):** Nếu Stock = 0, TUYỆT ĐỐI KHÔNG tự động chuyển Status sang Draft/Archived (giữ nguyên Active để bảo tồn Link SEO). Thay vào đó, ngoài Storefront F09 hiển thị nhãn `[Hết hàng]` và vô hiệu hóa nút Add to Cart. Trên Dashboard F08, đưa ra Cảnh báo Đỏ tại cột Stock. Thể tích (Dimensions) và Cân nặng là bắt buộc để liên kết với Module tính phí Vận Chuyển F14 sau này.
- **BR-07 (Category: 1–1 Product):** Mỗi sản phẩm thuộc đúng 1 danh mục (single-select). **Intentional Design Trade-off:** Dữ liệu DB vẫn sử dụng `hasMany: true` ở trên `products_rels` (chi tiết lưu trữ); UI + validation bảo đảm đúng 1 danh mục được gán. Flipping to `hasMany: false` would require data migration for zero functional gain since UI already enforces exactly one. This trade-off is documented to prevent future "fix" attempts that would create unnecessary schema churn.
- **BR-08 (Category Delete Integrity):** Hard-block xóa danh mục nếu có SP gán TRỰC TIẾP (direct-only, không đệ quy). Nếu xóa được phép: danh mục con trực tiếp được đẩy lên top-level (`parent = null`), rồi soft-delete danh mục đó.
- **BR-09 (Category Cycle Prevention):** Không cho đặt `parent` là chính nó hoặc bất kỳ descendant của nó (chặn vòng lặp cây).
- **BR-10 (Category Dedup per Tenant):** Slug unique theo tenant (không unique global). Tên danh mục unique trong phạm vi `(parent, tenant)`, so sánh case-insensitive + trim.

---

## 9. User Flow

```
/products
  ↓
[+ Add Product] HOẶC [✨ Tạo hàng loạt bằng AI Chat] HOẶC [📁 Quản lý Danh mục]
  ├── (Chat): "Nhập kho 2 mặt hàng: Áo khoác da size M L giá 500k và Mù tạt lọ 10k"
  │
 ↙ (AI Xử lý NLP trả về Preview Array)
[ AI Product Bulk Approval Grid ]
| Tick | Name         | Price | Category | Variants | Status|
| [x]  | Áo khoác da  | 500K  | Fashion  | Size:M,L | Draft |
| [x]  | Mù tạt lọ    | 10K   | F&B      |          | Draft |
  ↓ [Xác nhận Lưu 2 Products] → Vào thẳng DB danh sách Draft, chờ User Click sửa để Up Hình.
  
(Hoặc Lên Form Chi tiết cho 1 Sản Phẩm)
[Sticky Tab 1: Basic Info]
Media first (ALT disclosure <=125), Name + compact editable slug preview, searchable Category tree 3-level (leaf-only), plain Description textarea + counter/AI.
  ↓
[Sticky Tab 2: Pricing & Stock]
Turn on Variants:
├── Setup Tier 1: Màu sắc (Đỏ, Xanh)
├── Setup Tier 2: Kích cỡ (S, M, L)
└── Reactive Cartesian matrix → stable rows, group theo option 1, image per option 1, bulk apply.
  ↓
[Sticky Tab 3: Shipping & Delivery]
Weight, Length, Width, Height -> Để chuẩn bị tính Shipping Rate F14.
  ↓
[Sticky Tab 4: More Information]
├── Specifications: [+ Add Field] -> (Key: Origin, Value: VN)
└── SEO (Title, Description, Link)
  ↓
[Fixed Bottom Actions: Save Draft / Publish theo production gate hiện hành]
  ↓ (User Manual Toggle)
[ Publish Active lên Storefront ]
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Đối với các tính năng quản trị, yêu cầu bắt buộc phải render bên trong Main Content Area của F18 CMS Layout (ngoại trừ các tính năng đặc thù cần Full-screen Editor).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (Products Data Grid / List)
- **Mô tả:** Danh sách quản lý tất cả các sản phẩm thuộc tài khoản cửa hàng.
- **Components chính:**
  - Top Toolbar: Nút [+ Add Product], Nút [✨ Tạo Hàng Loạt Bằng AI], Nút [📁 Quản lý Danh mục] (Direct Link sang trang cấu hình Danh Mục).
  - Tabs Header: Active, Draft, Archived có kèm badged counter.
  - Search & Filters: Search bar (theo tên/SKU), bộ lọc Dropdowns (Category, Sort by Price).
  - Data Table: Bản nâng cấp hiển thị cột Ảnh đại diện, Tên Sản Phẩm, SKU, Danh Mục, Giá, Cân Nặng (Weight), Kho (Stock - Cảnh báo Đỏ nếu =0), Cột Switch Toggle nhanh Trạng thái (Publish/Hidden), Thao tác (Sửa/Xóa).
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Màn hình Chi tiết (Create / Edit Product Form)
- **Mô tả:** Trang Form nhập đa lớp để khởi tạo 1 sản phẩm mới.
- **Components chính:**
  - Responsive shell: desktop 70% main content / 30% sidebar; mobile stack một cột.
  - Sticky tab navigation: Basic Info / Pricing & Stock / Shipping & Delivery / More Information.
  - Basic Info: Media nằm đầu tiên; mỗi ảnh có ALT disclosure (counter tối đa 125). Product Name có compact editable slug preview ngay bên dưới; category searchable tree 3 level, leaf-only; description là plain textarea có counter và AI action.
  - Pricing & Stock: Default price/SKU/stock hoặc variant matrix reactive Cartesian. Tối đa 2 option groups, không đồng nghĩa tối đa 2 values; row còn hợp lệ giữ dữ liệu khi matrix đổi; row được group theo option 1, có image per option 1 và bulk apply.
  - Shipping & Delivery: đúng 4 input Weight, Length, Width, Height.
  - More Information: Specifications key-value và SEO metadata.
  - Sidebar: chỉ Content Strength (5 advisory rules) và Status.
  - Fixed bottom actions: Save draft / Publish-Active theo production permissions và publish gate hiện hành; Delete khi edit; content có bottom padding để action bar không che field cuối.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Mobile View (Products List & Stacked Form)
- **Mô tả:** Danh sách sản phẩm thu gọn cột dư thừa thành các Card hoặc Swipeable Rows. Form tạo sản phẩm đổ dọc (Stack) với Accordion cho phần hiển thị biến thể.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.4. Các trạng thái UI (UI States) & Modals
- **Empty State:** Icon khay hàng trống + CTA "Hãy tạo sản phẩm đầu tiên".
- **Loading State:** Skeleton table trong Data list. Spin icon trong các Nút Save và các Button AI Generate.
- **Error State / Edge Cases:** Highlight đỏ đường kẻ viền TextInput nếu Submit form mà Name trống / Price < 0. Nếu Stock = 0, Cột list nổi bật đỏ (High Attention).
- **Modals (nếu có):** 
  - Delete Confirmation: "Bạn có chắc muốn xóa mềm phẩm này? Hành động này có thể hồi phục từ Archive."
  - Delete Category: Hard-block với thông báo "Cannot delete this category. There are X products still assigned to it. Please reassign your products first." nếu có SP gán trực tiếp.
  - Bulk AI Modal (Bảng Preview Table) sinh ra sau khi gọi tính năng Bulk Create Chat AI để user xác nhận trước DB Commit.
  - **Add Category Modal (Issue GH-1587):** 
    - **Contextual Title:** "Add New Category" (từ toolbar); "Add Subcategory" (từ nút + trên dòng danh mục); "Edit Category" khi sửa.
    - **Parent Field:** Auto-filled khi mở từ nút + trên dòng; disabled/locked trong subcategory mode. Editable khi tạo từ toolbar hoặc edit category.
    - **Subcategory Guidance:** Khi mở từ nút + trên dòng, hiển thị `Adding a subcategory under {parentName} (L{currentLevel}) → new category will be Level {newLevel}.` và helper `Locked — you are adding under this category.` bên dưới Parent Field. Không hiển thị hai nội dung này trong luồng toolbar Add Category hoặc Edit Category.
    - **Parent Dropdown:** Thụt lề theo level (L1→L2→L3, visual hierarchy); L3 node hiển thị nhưng disabled (không thể chọn làm parent, max 3 levels); loại trừ self + toàn bộ descendants (cycle prevention).
    - **Single Add-Subcategory Affordance:** Chỉ có 1 nút "+" icon per row (ẩn ở L3). Không còn duplicate "+ Add subcategory" inline.
    - **Level Badges:** 3 màu riêng biệt — L1 teal, L2 blue, L3 violet.
    - **Category Image Field:** REMOVED (unused, never rendered anywhere). Modal chỉ còn 4 fields: Name*, Parent, Description, URL Slug.

---
### 10.5. Giao diện Hiển thị Storefront (PLP & PDP)

> 📌 **Lưu ý:** Giao diện hiển thị phía End-user (Storefront) đã được chuyển giao cho **PRD: F09-storefront-commerce.md**. Vui lòng sang tài liệu F09 để xem mockups chi tiết cho màn hình Danh sách Sản phẩm (Shop) và Chi tiết Sản phẩm (Product View).

---


## 11. Acceptance Criteria

> AC được copy từ `F08-products-crud-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Add Product Form
> 📌 Source: [US-F08-01](../stories/F08-products-crud-stories.md) — AC-1

```gherkin
GIVEN user ở /products
WHEN  click "Thêm sản phẩm"
THEN  form hiện: tên, giá (RM), category (single-select, đúng 1), mô tả, ảnh (max 5, max 5MB/ảnh), stock
```

### AC-2: AI Data Generators (SEO & Description)
> 📌 Source: [US-F08-03](../stories/F08-products-crud-stories.md) — AC-AI

```gherkin
GIVEN user điền tên sản phẩm (VD: "Trà Đào Cam Sả") và chọn ngành F&B
WHEN  click "✨ Tối ưu Tìm Kiếm"
THEN  AI sinh ra Tiêu đề bán hàng (SEO Title), Mô tả cho MXH (SEO Description) và đề xuất Link thân thiện `tra-dao-cam-sa`.
WHEN  click "✨ AI Viết Description"
THEN  sinh ra văn bản mô tả giàu cảm xúc, chèn vào plain textarea có character counter.
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
| `ProductsPage` | `src/app/(dashboard)/products/page.tsx` | List + filter |
| `ProductForm` | `src/components/dashboard/product-form/ProductForm.tsx` | Shared Add/Edit form orchestration |
| `DescriptionSeoSection` | `src/components/dashboard/product-form/DescriptionSeoSection.tsx` | Current Description and SEO AI actions; ownership will be split only during implementation |

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
| Payload CMS products collection | ✅ Exists | Reuse current schema; redesign adds no field or migration by default |
| OpenAI API | ⬜ | For AI description |
| Payload media | ✅ Exists | — |

---

## 15. 9-Point Done Checklist

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

## 16. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] Current Products schema and form serialization verified; any persistence gap is scoped and approved separately from the UI redesign
- [ ] OpenAI API configured

---

## 17. Definition of Done

- [ ] All FR implemented
- [ ] All AC pass
- [ ] Product visible on storefront after create
- [ ] AI description works in BM và EN
- [ ] Soft delete + undo works
