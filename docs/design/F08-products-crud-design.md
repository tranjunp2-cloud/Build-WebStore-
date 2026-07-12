# F08 Products CRUD — Design & Wireframe Report

> **Epic:** Product Management
> **Feature Code:** F08
> **Figma Design:** [Link](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30882-5801&t=nJsYvzayVPDFNauW-1)
> **Figma Prototype:** [Link](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=H2flt0KzPPelcSG7-1&preview-route=%2Fproducts)

Tài liệu này cung cấp bản vẽ Wireframe chi tiết cho bộ tính năng Quản lý Sản phẩm (F08), bám sát các luồng đã định nghĩa trong PRD và User Stories. Tất cả giao diện tuân thủ **F18 CMS Global Layout** (Sidebar trái và Topbar giữ nguyên).

---

## 1. Màn Hình Chính: Danh Sách Sản Phẩm (Product Data Grid)

*Màn hình quản lý tổng quan. Điểm nhấn là Thanh Chat AI để tạo hàng loạt ở trên cùng, Hệ thống Tab theo trạng thái (Active/Draft) và Cảnh báo đỏ ở cột Tồn kho (Low/Out of Stock).*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ 📦 Products                              │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌──────────────────────────────────────┐ │
│ ⚙️ Settings  │ │ ✨ AI Chat: Tạo nhanh nhiều sản phẩm │ │
│              │ │ ⌨️ "Nhập áo khoác da 500k, mũ 50k"   │ │
│              │ │                             [ Create ] │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ [ ✅ Active (45) ]  [ 📝 Draft (2) ]     │
│              │ ──────────────────────────────────────── │
│              │ [🔍 Tìm theo Tên/SKU...]  [ Lọc (2) ▼ ]  │
│              │                                          │
│              │ ┌──────────────────────────────────────────────┐ │
│              │ │ IMG │ Name         │ Price │ Stock │ Weight  │ │
│              │ │ ────┴──────────────┴───────┴───────┴─────────│ │
│              │ │ 📦  │ Baju Kurung  │ RM 89 │ 25    │ 0.5 kg  │ │
│              │ │     │ ├ Đỏ - S     │ RM 89 │ 10    │         │ │
│              │ │     │ └ Đỏ - M     │ RM 89 │ 15    │         │ │
│              │ │ ────┼──────────────┼───────┼───────┼─────────│ │
│              │ │ 🖼️  │ Lip Gloss    │ RM 39 │ 0 🔴  │ 0.1 kg  │ │
│              │ │ ────┼──────────────┼───────┼───────┼─────────│ │
│              │ │ 📦  │ Mù Tạt Vàng  │ RM 15 │ 12    │ 1.2 kg  │ │
│              │ └──────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

## 2. Modal: AI Bulk Approval (Xác nhận Tạo Hàng Loạt bằng AI)

*Sau khi người dùng chat vào thanh AI, hệ thống sẽ pop-up 1 bảng Preview (Data Grid) để xem trước cấu trúc dữ liệu AI bóc tách.*

```text
       ┌── ✨ Xác nhận Tạo Sản Phẩm (AI Preview) ─────[X]┐
       │                                                 │
       │ AI đã bóc tách dữ liệu của bạn, vui lòng kiểm   │
       │ tra và sửa trực tiếp trên bảng.                 │
       │                                                 │
       │ ┌─────────────────────────────────────────────┐ │
       │ │ [x] │ Name          │ Price │ Variants      │ │
       │ │ ────┼───────────────┼───────┼───────────────│ │
       │ │ [x] │ Áo khoác da   │ 500   │ Size: M, L    │ │
       │ │ [x] │ Mũ lưỡi trai  │ 50    │               │ │
       │ └─────────────────────────────────────────────┘ │
       │                                                 │
       │ 💡 Các sản phẩm này sẽ được lưu ở nháp (Draft). │
       │ Bạn cần thêm hình ảnh sau khi tạo.              │
       │                                                 │
       │                   [ Hủy bỏ ] [ Lưu 2 Sản Phẩm ] │
       └─────────────────────────────────────────────────┘
```

---

## 3. Form Thêm/Sửa Sản Phẩm (Create / Edit Product)

*Form phức hợp kéo dài dọc xuống, chia làm nhiều Section. Mặc định trạng thái lưu là Draft. Hình ảnh Fallback (Thùng carton) luôn hiện nếu trống.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ < Trở về List          [Draft] [Publish] │
│ 📦 Products  │ ──────────────────────────────────────── │
│ 🛒 Orders    │                                          │
│ ⚙️ Settings  │ ┌─ 1. THÔNG TIN CHUNG ─────────────────┐ │
│              │ │ Tên Sản Phẩm (*)                     │ │
│              │ │ [ Nhập tên...                      ] │ │
│              │ │                                      │ │
│              │ │ Danh Mục (Category)                  │ │
│              │ │ [ Chọn Ngành Hàng ▼ ]                  │ │
│              │ │                                      │ │
│              │ │ 🖼️ Hình Ảnh (Max 5, Dưới 5MB)         │ │
│              │ │ ┌─────┐ ┌───┐ ┌───┐                  │ │
│              │ │ │ 📦  │ │ + │ │ + │                  │ │
│              │ │ └─────┘ └───┘ └───┘                  │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ ┌─ 2. BIẾN THỂ & TỒN KHO ──────────────┐ │
│              │ │ 🔲 Sản phẩm có nhiều Tuỳ chọn/Biến thể│ │
│              │ │                                      │ │
│              │ │ (Nếu KHÔNG Tích checkbox trên)       │ │
│              │ │ Giá bán  : [ RM 0.00 ]               │ │
│              │ │ Tồn Kho  : [ 0       ]               │ │
│              │ │ SKU Code : [         ]               │ │
│              │ │                                      │ │
│              │ │ (Nếu CÓ Tích checkbox)               │ │
│              │ │ Tầng 1 (VD: Màu sắc): [ Đỏ, Xanh ]   │ │
│              │ │ Tầng 2 (VD: Size)   : [ M, L     ]   │ │
│              │ │                                      │ │
│              │ │ ↳ Bảng SKU Matrix tự sinh:           │ │
│              │ │ | Variant  | SKU Code | Price | Stock| │
│              │ │ | Đỏ - M   | [      ] | [   ] | [  ] | │
│              │ │ | Đỏ - L   | [      ] | [   ] | [  ] | │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ ┌─ 3. VẬN CHUYỂN & HALAL (SHIPPING) ───┐ │
│              │ │ Khối lượng (Weight) (*): [ 0.5 ] kg  │ │
│              │ │ Chiều Dài (L) : [ 10 ] cm            │ │
│              │ │ Chiều Rộng (W): [ 10 ] cm            │ │
│              │ │ Chiều Cao (H) : [  5 ] cm            │ │
│              │ │                                      │ │
│              │ │ 🔲 Đạt chứng nhận Halal              │ │
│              │ │    ↳ [📤 Tải lên Chứng nhận]          │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ ┌─ 4. MÔ TẢ & THUỘC TÍNH MỞ RỘNG (SEO) ┐ │
│              │ │ [ ✨ Viết Mô Tả bằng AI ]              │ │
│              │ │ [ B I U Ξ ]                          │ │
│              │ │ [ Rich text description box...     ] │ │
│              │ │                                      │ │
│              │ │ Thuộc Tính (Attributes): [+ Thêm]    │ │
│              │ │ [ Thương hiệu ] : [ OEM            ] │ │
│              │ │ [ Xuất xứ     ] : [ MY             ] │ │
│              │ │                                      │ │
│              │ │ [ ✨ Tối ưu Tìm Kiếm Tự Động (SEO) ]     │ │
│              │ │ Meta Title: [ AI Generated Title ]   │ │
│              │ │ Slug      : [ my-product-slug    ]   │ │
│              │ └──────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

## 4. Mobile Optimized View (Card & Accordion)

*Tự động thu gọn trên màn < 768px. Đưa chuyển List thành Card, đưa Variants Matrix thành Accordion dọc chống vỡ layout ngang.*

```text
📱 Mobile View (Products List)
┌─────────────────────────────┐
│ ☰  Products                 │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ ✨ Chat AI tạo sản phẩm │ │
│ └─────────────────────────┘ │
│ [ 🔍 Tìm Tên / SKU...    ]  │
│                             │
│ ┌─ 📦 Baju Kurung ────────┐ │
│ │ RM 89 • Stock: 25   [⋮]│ │
│ │ ├ Đỏ - S (Qty: 10)      │ │
│ │ └ Đỏ - M (Qty: 15)      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─ 🖼️ Lip Gloss ─────────┐ │
│ │ RM 39 • Stock: 0 🔴 [⋮]│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘

📱 Mobile View (Variant Matrix Accordion in Form)
┌─────────────────────────────┐
│ ☰  Edit Product         [✓] │
├─────────────────────────────┤
│ 🛍 TỒN KHO & BIẾN THỂ       │
│                             │
│ ┌─ Đỏ - M             [▼] ┐ │ ◄── Bấm xổ xuống (Accordion)
│ │ SKU Code: [ RD-M-01 ]   │ │
│ │ Price:    [ RM 89   ]   │ │
│ │ Stock:    [ 10      ]   │ │
│ └─────────────────────────┘ │
│ ┌─ Đỏ - L             [▶] ┐ │
│ └─────────────────────────┘ │
│ ┌─ Xanh - M           [▶] ┐ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## 5. UI States & Cảnh Báo
1. **Low Stock / Out of Stock (🔴):** Nếu tồn kho (Stock) = 0, ô text sẽ highlight chói (Đỏ) trên Dashboard quản trị để thu hút cự chú ý. *Lưu ý: Không tự động chuyển SP thành Draft.*
2. **Missing Validations:** Nếu bấm lưu mà thiếu Tên, Giá, Stock hoặc SKU của Biến thể, Input sẽ viền Đỏ kèm dòng chữ: `Trường này là bắt buộc`.
3. **Draft Fallback:** Tất cả các hành động Create (Thủ công hoặc Bulk AI) sẽ mặc định sinh ra trạng thái **[📝 Draft]**. Nút *Publish* ở Form Edit phải do thao tác ấn chủ động để bật SP lên F09 Storefront.

---

## 6. Quản Lý Danh Mục (Category Management — 3 Cấp)

*Truy cập bằng nút [📁 Quản lý Danh mục] trên Toolbar của màn hình Product List. Mở ra một trang/modal riêng biệt hiển thị cây danh mục lồng nhau tối đa 3 cấp (L1 > L2 > L3). Hỗ trợ CRUD đầy đủ cho từng node.*

### 6.1 Desktop — Trang Quản lý Danh Mục

*Header: nút back-arrow (←) về `/products`, H1 "Category Management", subtitle "Manage product categories (up to 3 levels deep)", nút [+ Add Category] (primary) góc phải. Bảng cây có header cột: **Category Name | LEVEL | PRODUCTS | ACTIONS**. Mỗi node: chevron expand (chỉ khi có con), icon folder/file, tên, badge **L{level}**, **{n} products** (productCount), actions **[+ Add sub]** (ẩn khi node ở L3) · **[✏️ Edit]** · **[🗑️ Delete]**. Thụt lề L2 ~52px, L3 ~84px. Pagination (10/25/50/100) ở cuối bảng.*

```text
┌─────────────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                                 [👤 Admin]  │
├──────────────┬──────────────────────────────────────────────────┤
│ 🏠 Dashboard │ ←  Category Management                            │
│ 📦 Products  │    Manage product categories (up to 3 levels)     │
│ 🛒 Orders    │                                    [+ Add Category]│
│ ⚙️ Settings  │ [🔍 Search categories...]                         │
│              │ ────────────────────────────────────────────────  │
│              │ CATEGORY NAME              │ LEVEL │ PRODUCTS │ ACTIONS       │
│              │ ───────────────────────────┼───────┼──────────┼────────────── │
│              │ ▼ 📂 Thời Trang            │  L1   │ 24 prod  │ [+][✏️][🗑️]  │
│              │   ▼ 📂 Nữ                  │  L2   │ 15 prod  │ [+][✏️][🗑️]  │
│              │       📄 Áo Khoác          │  L3   │  8 prod  │    [✏️][🗑️]  │
│              │       📄 Váy Đầm           │  L3   │  5 prod  │    [✏️][🗑️]  │
│              │     [+ Add subcategory]                                       │
│              │   ▶ 📂 Nam                 │  L2   │  9 prod  │ [+][✏️][🗑️]  │
│              │   [+ Add subcategory]                                         │
│              │ ▶ 📂 Đồ Ăn & Thức Uống     │  L1   │ 18 prod  │ [+][✏️][🗑️]  │
│              │ ▶ 📂 Mỹ Phẩm              │  L1   │ 12 prod  │ [+][✏️][🗑️]  │
│              │ ────────────────────────────────────────────────  │
│              │ Rows: [10 ▼]              ‹ 1 2 3 ›   1–10 of 24   │
└──────────────┴──────────────────────────────────────────────────┘
```
> Node ở L3 **ẩn** nút [+ Add sub] (đã đạt cấp sâu nhất). Dòng inline `[+ Add subcategory]` hiện dưới node đang mở, cũng ẩn ở L3.

### 6.2 Modal — Thêm / Sửa Danh Mục

*Modal (max ~448px). **Tiêu đề contextual** theo ngữ cảnh mở:*
- *Toolbar [+ Add Category] → **"Add New Category"***
- *Nút [+] trên 1 node (add con) → **"Add Subcategory"***
- *Nút [✏️ Edit] → **"Edit Category"***

*Field theo THỨ TỰ code thật: **Name*** → **Parent Category** → **Description (Optional)** → **URL Slug**. Footer: [Cancel] [Save Category].*

> **Bỏ field `Category Image` (2026-07-12, YAGNI):** ảnh danh mục hiện được lưu nhưng KHÔNG được hiển thị ở đâu (không storefront, không tree). PR-1 gỡ field `image` khỏi `Categories.ts` + migration drop cột `image_id`. Nếu sau này storefront cần thumbnail danh mục thì thêm lại kèm nơi tiêu thụ rõ ràng.

```text
       ┌── Add New Category ──────────────────────[X]┐
       │                                             │
       │ Category Name (*)                           │
       │ [ Enter category name...                 ]  │
       │   ↳ tạo mới: tự sinh URL Slug khi gõ tên    │
       │                                             │
       │ Parent Category                             │
       │ [ --None-- ▼ ]                              │
       │   ├ Thời Trang                    (L1)      │
       │   │  ├ Thời Trang > Nữ            (L2)      │
       │   │  │  └ … > Áo Khoác            (L3) 🚫   │ ← L3 disabled (không làm cha)
       │   │  └ Thời Trang > Nam           (L2)      │
       │   ├ Đồ Ăn & Thức Uống            (L1)      │
       │   └ Mỹ Phẩm                      (L1)      │
       │                                             │
       │ Description (Optional)                      │
       │ [ Short description for SEO...          ]  │
       │                                             │
       │ URL Slug                                    │
       │ [ category-url                          ]  │
       │                                             │
       │                 [ Cancel ] [ Save Category ]│
       └─────────────────────────────────────────────┘
```

**Ghi chú hành vi modal:**
- **Auto-slug:** ở chế độ **tạo mới**, gõ Name sẽ tự sinh URL Slug (bỏ dấu, lowercase, gạch nối). Ở chế độ **sửa**, slug giữ nguyên trừ khi user sửa tay.
- **Parent khi mở từ [+] (add con):** tự điền danh mục đó vào Parent và **khóa (disabled)** — không cho đổi cha.
- **Parent dropdown:** option **thụt lề theo cấp** (L1→L2→L3) hiển thị breadcrumb; **node L3 bị disable** (đã sâu nhất, không thể làm cha); **loại trừ chính nó + toàn bộ con/cháu** (chống vòng lặp). Depth kết quả luôn ≤ 3.

### 6.3 Mobile — Danh Mục dạng Accordion

```text
📱 Mobile View (Category Management)
┌───────────────────────────────┐
│ ☰  Quản Lý Danh Mục      [+] │
├───────────────────────────────┤
│ [🔍 Tìm danh mục...        ] │
│                               │
│ ┌─ 📂 Thời Trang        [▼] ┐│ ◄── Bấm mở ra con
│ │ ┌─ 📂 Nữ              [▼]││
│ │ │  📄 Áo Khoác    [✏️][🗑️]││
│ │ │  📄 Váy Đầm     [✏️][🗑️]││
│ │ │  [+ Thêm con]           ││
│ │ └─────────────────────────┘│
│ │ ┌─ 📂 Nam              [▶]││
│ │ └─────────────────────────┘│
│ └────────────────────────────┘│
│                               │
│ ┌─ 📂 Đồ Ăn & TU        [▶] ┐│
│ └────────────────────────────┘│
└───────────────────────────────┘
```

### 6.4 Quy tắc Nghiệp vụ Danh Mục
1. **Tối đa 3 cấp** (L1 → L2 → L3). Nếu danh mục cha đã ở L2, nút [+ Add sub] sẽ tạo L3. Nếu đã là L3 thì **ẩn** nút thêm con.
2. **Xóa danh mục:**
   - **(a) Hard-block khi còn sản phẩm gán trực tiếp** (productCount > 0): chặn xóa, hiện thông báo *"Cannot delete this category. There are X products still assigned to it. Please reassign your products first."* → user phải chuyển sản phẩm sang danh mục khác trước.
   - **(b) Nếu xóa được** (không còn SP gán trực tiếp): các danh mục **con trực tiếp được đẩy lên top-level** (`parent = null`), sau đó danh mục bị **soft-delete**. *(KHÔNG "gỡ liên kết khỏi cây" — con vẫn tồn tại, chỉ chuyển thành node gốc.)*
3. **Sản phẩm ↔ Danh mục = 1–n (single-select):** mỗi sản phẩm chỉ thuộc **đúng 1 danh mục**. Form sản phẩm dùng **1 dropdown chọn danh mục** (không multi-select, không giới hạn "tối đa N").
4. **Chống trùng lặp (dedup) — theo tenant:**
   - **Slug** unique **per tenant** (không đụng tenant khác).
   - **Tên** unique trong phạm vi **(cùng parent, cùng tenant)**, so sánh **case-insensitive + trim** — nên `"Áo"`, `"áo"`, `" Áo "` bị coi là trùng.
5. **Chống vòng lặp (cycle prevention):** không cho đặt parent = **chính nó** hoặc **bất kỳ con/cháu** của nó; dropdown Parent đã loại các option này. Depth kết quả vẫn phải ≤ 3.
