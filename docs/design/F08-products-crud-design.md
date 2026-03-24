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
│              │ ┌──────────────────────────────────────┐ │
│              │ │ IMG │ Name         │ Price │ Stock   │ │
│              │ │ ────┴──────────────┴───────┴─────────│ │
│              │ │ 📦  │ Baju Kurung  │ RM 89 │ 25      │ │
│              │ │     │ ├ Đỏ - S     │ RM 89 │ 10      │ │
│              │ │     │ └ Đỏ - M     │ RM 89 │ 15      │ │
│              │ │ ────┼──────────────┼───────┼─────────│ │
│              │ │ 🖼️  │ Lip Gloss    │ RM 39 │ 0 🔴    │ │
│              │ │ ────┼──────────────┼───────┼─────────│ │
│              │ │ 📦  │ Mù Tạt Vàng  │ RM 15 │ 12      │ │
│              │ └──────────────────────────────────────┘ │
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
│              │ │ Giá bán thực : [ RM 0.00 ]           │ │
│              │ │ Giá KM (C.a.P):[ RM 0.00 ]           │ │
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
│              │ ┌─ 2.5. VẬN CHUYỂN & ĐÓNG GÓI ─────────┐ │
│              │ │ Cân nặng (kg) : [        ]           │ │
│              │ │ Kích thước (DxRxC cm): [ ]x[ ]x[ ]   │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ ┌─ 3. MÔ TẢ & THUỘC TÍNH MỞ RỘNG (SEO) ┐ │
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
1. **Empty State:** Dùng component "No Data" chung cho list Products. Hiển thị Illustration khay hàng trống, dòng text "Chưa có sản phẩm nào" và nút CTA "Tạo Sản Phẩm" để mời gọi user.
2. **Low Stock / Out of Stock (🔴):** Nếu tồn kho (Stock) = 0, ô text sẽ highlight chói (Đỏ) trên Dashboard quản trị để thu hút cự chú ý. *Lưu ý: Không tự động chuyển SP thành Draft.*
3. **Missing Validations:** Nếu bấm lưu mà thiếu Tên, Giá, Stock hoặc SKU của Biến thể, Input sẽ viền Đỏ kèm dòng chữ: `Trường này là bắt buộc`.
4. **Draft Fallback:** Tất cả các hành động Create (Thủ công hoặc Bulk AI) sẽ mặc định sinh ra trạng thái **[📝 Draft]**. Nút *Publish* ở Form Edit phải do thao tác ấn chủ động để bật SP lên F09 Storefront.
