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

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                             [👤 Admin]  │
├──────────────┬──────────────────────────────────────────────┤
│ 🏠 Dashboard │ 📁 Quản Lý Danh Mục                          │
│ 📦 Products  │                                              │
│ 🛒 Orders    │ [🔍 Tìm danh mục...]        [+ Thêm Danh Mục]│
│ ⚙️ Settings  │ ──────────────────────────────────────────── │
│              │                                              │
│              │ 📂 Thời Trang (L1)              [✏️] [🗑️]   │
│              │ ├── 📂 Nữ (L2)                  [✏️] [🗑️]   │
│              │ │   ├── 📄 Áo Khoác (L3)        [✏️] [🗑️]   │
│              │ │   ├── 📄 Váy Đầm (L3)         [✏️] [🗑️]   │
│              │ │   └── [+ Thêm danh mục con]               │
│              │ ├── 📂 Nam (L2)                  [✏️] [🗑️]   │
│              │ │   ├── 📄 Áo Thun (L3)          [✏️] [🗑️]   │
│              │ │   └── [+ Thêm danh mục con]               │
│              │ └── [+ Thêm danh mục con]                   │
│              │                                              │
│              │ 📂 Đồ Ăn & Thức Uống (L1)       [✏️] [🗑️]   │
│              │ ├── 📄 Trà Sữa (L2)              [✏️] [🗑️]   │
│              │ ├── 📄 Cà Phê (L2)               [✏️] [🗑️]   │
│              │ └── [+ Thêm danh mục con]                   │
│              │                                              │
│              │ 📂 Mỹ Phẩm (L1)                  [✏️] [🗑️]   │
│              │ └── [+ Thêm danh mục con]                   │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 6.2 Modal — Thêm / Sửa Danh Mục

*Khi bấm [+ Thêm Danh Mục] hoặc [✏️ Sửa], hệ thống mở Modal nhập liệu.*

```text
       ┌── 📁 Thêm Danh Mục Mới ─────────────────[X]┐
       │                                             │
       │ Tên Danh Mục (*)                            │
       │ [ Nhập tên danh mục...                   ]  │
       │                                             │
       │ Danh Mục Cha (Tuỳ chọn)                    │
       │ [ -- Không (Root Level 1) -- ▼ ]            │
       │   ├ Thời Trang                              │
       │   │  ├ Thời Trang > Nữ                      │
       │   │  └ Thời Trang > Nam                     │
       │   ├ Đồ Ăn & Thức Uống                      │
       │   └ Mỹ Phẩm                                │
       │                                             │
       │ Mô Tả (Tuỳ chọn)                           │
       │ [ Mô tả ngắn cho danh mục...            ]  │
       │                                             │
       │ 🖼️ Ảnh Đại Diện (Tuỳ chọn)                  │
       │ [ 📤 Tải ảnh lên ]                           │
       │                                             │
       │ ⚠️ Lưu ý: Tối đa 3 cấp lồng nhau.          │
       │ Nếu danh mục cha đã ở L2 thì con sẽ là L3. │
       │                                             │
       │                    [ Hủy bỏ ] [ 💾 Lưu ]    │
       └─────────────────────────────────────────────┘
```

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
1. **Tối đa 3 cấp** (L1 → L2 → L3). Nếu danh mục cha đã ở L2, nút [+ Thêm con] sẽ tạo L3. Nếu đã là L3 thì **ẩn** nút thêm con.
2. **Xóa mềm (Soft Delete):** Khi xóa 1 danh mục cha, tất cả danh mục con sẽ được gỡ liên kết (Unlink) khỏi cây, không bị xóa cứng.
3. **Gán nhiều danh mục:** Một sản phẩm có thể thuộc nhiều danh mục cùng lúc (Multi-select tại Form sản phẩm).
4. **Không cho phép trùng tên** cùng cấp dưới cùng 1 danh mục cha.
