# F09 Storefront Commerce — Design & Wireframe Report

> **Epic:** Storefront Commerce
> **Feature Code:** F09
> **Figma Design:** [Link](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30905-1342&t=nJsYvzayVPDFNauW-1)

Tài liệu này cung cấp bản vẽ Wireframe chi tiết cho giao diện công khai của cửa hàng (End-user Storefront), dựa trên PRD và User Stories F09. 
*Lưu ý:* Các màn hình Storefront độc lập hoàn toàn với F18 CMS Global Layout (không có Sidebar hay Topbar Admin).

---

## 1. Màn hình Mua Sắm (Product List Page - PLP)

*Giao diện danh sách sản phẩm chuẩn E-commerce. Có bộ lọc bên trái (Desktop), thanh sắp xếp phía trên và lưới sản phẩm 3 cột.*

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]      [🔍 Nhập tên SP...]               [🛒 (2)]   │ ◄── Store Header
├────────┬────────────────────────────────────────────────────┤
│ Home / │ Thời Trang Nữ                                      │
├────────┼────────────────────────────────────────────────────┤
│ BỘ LỌC │ Hiển thị 1-10 trên 45 kết quả    Sắp xếp: [Mới▼]   │
│        │                                                    │
│ DANH MỤC│ ┌────────────────┐ ┌────────────────┐ ┌─────────┐ │
│ 🔲 Áo   │ │ 🖼️ IMG          │ │ 🖼️ IMG          │ │ 🖼️ IMG  │ │
│ 🔲 Quần │ │ [SALE]         │ │                │ │         │ │
│        │ │ Áo Khoác Bò    │ │ Quần Jeans     │ │ Váy Đỏ  │ │
│ GIÁ    │ │ RM 89.00       │ │ RM 45.00       │ │ RM 120  │ │
│ 🔲 <50  │ │ ~RM 120.00~    │ │                │ │         │ │
│ 🔲 50+  │ └────────────────┘ └────────────────┘ └─────────┘ │
│        │                                                    │
│ SIZE   │ ┌────────────────┐ ┌────────────────┐              │
│ 🔲 S    │ │ 🖼️ IMG          │ │ 🖼️ IMG          │              │
│ 🔲 M    │ │ Áo Phông       │ │ Kính Râm       │              │
│        │ │ RM 20.00       │ │ RM 15.00       │              │
│        │ └────────────────┘ └────────────────┘              │
│        │                                                    │
│        │           < [1] [2] [3] [4] [5] >                  │
├────────┴────────────────────────────────────────────────────┤
│ Footer: [🛡️ Chứng nhận SSM] [☪️ Halal] [🏦 Secure Payment] │
│ Lơ lửng góc dưới: [💬 Nhắn tin WhatsApp ngay]              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Trang Chi Tiết Sản Phẩm (Product Detail Page - PDP)

*Trang xem chi tiết và nhặt vào giỏ. Hỗ trợ cuộn ảnh, chọn biến thể (Màu, Size) và xem Rich Text Describe.*

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]      [🔍 Cà phê...]                    [🛒 (2)]   │
├─────────────────────────────────────────────────────────────┤
│ Home / Đồ Uống / Cà phê đen                                 │
├───────────────────────┬─────────────────────────────────────┤
│                       │ Cà Phê Đen Đá (Size Lớn)            │
│  ┌─────────────────┐  │ ⭐⭐⭐⭐⭐ (24 đánh giá)                │
│  │                 │  │                                     │
│  │      ẢNH        │  │ Giá: RM 15.00                       │
│  │     CHÍNH       │  │                                     │
│  │                 │  │ Phân loại:                          │
│  └─────────────────┘  │ 🔘 Đá       🔲 Nóng                  │
│  ┌───┐ ┌───┐ ┌───┐    │                                     │
│  │🖼️ │ │🖼️ │ │🖼️ │    │ Số lượng: [ -   1   + ]             │
│  └───┘ └───┘ └───┘    │                                     │
│                       │ [ 🛒 THÊM VÀO GIỎ HÀNG ]           │
├───────────────────────┴─────────────────────────────────────┤
│ [ MÔ TẢ ] [ THÔNG SỐ ] [ ĐÁNH GIÁ ]                         │
│                                                             │
│ Cà phê đen đậm vị rang mộc nguyên chất 100% Robusta...      │
│ --------------------------------------------------------    │
│ | Thương hiệu | The Coffee Maker                           |│
│ | Chứng nhận  | Halal                                      |│
│ | Xuất xứ     | Malaysia                                   |│
├─────────────────────────────────────────────────────────────┤
│ Footer: SSM ID, Halal Logo, Privacy Policy, Terms           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Ngăn Kéo Giỏ Hàng (Cart Drawer)

*Khi ấn "Add to Cart", giỏ hàng trượt ra từ bên PHẢI đè lên màn hình hiện tại (Overlay). Không cần sang trang web mới.*

```text
               ┌───────────────────────[ Đóng X]┐
               │ 🛒 Giỏ hàng của bạn (2)        │
               │ ────────────────────────────── │
               │ ┌───┐ Áo khoác Bò              │
               │ │ 🖼️ │ Phân loại: Xanh, Size M    │
               │ └───┘ RM 89.00                 │
               │       [ -  1  + ]        [🗑️]  │
               │ ────────────────────────────── │
               │ ┌───┐ Cà phê đen đá            │
               │ │ 🖼️ │ Phân loại: Đá            │
               │ └───┘ RM 15.00                 │
               │       [ -  2  + ]        [🗑️]  │
               │                                │
               │                                │
               │ Tạm tính (Subtotal):           │
               │ RM 119.00                      │
               │ ────────────────────────────── │
               │ Chú ý: Chưa gồm phí vận chuyển │
               │ và SST (6%).                   │
               │                                │
               │ [ THANH TOÁN (CHECKOUT) ]      │
               └────────────────────────────────┘
```

---

## 4. Giao diện Thanh Toán (Guest Checkout)

*Khách vãng lai (Guest) có thể mua không cần Login. Cung cấp Dropdown chọn Tiểu bang Malaysia (State).*

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]  Bảo Mật Thanh Toán 🔒                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Thông Tin Liên Hệ                                        │
│ Họ và tên: [ Nhập đầy đủ... ]                               │
│ Email:     [ Nhập email để nhận mã đơn ]                    │
│ Phone:     [ +60 XXXXXXXX ]                                 │
│                                                             │
│ 2. Địa Chỉ Giao Hàng                                        │
│ Address 1: [ Số nhà, Múkin... ]                             │
│ Address 2: [ (Tuỳ chọn) ]                                   │
│ Thành phố: [ City ]                                         │
│ Postcode:  [ 40000 ]                                        │
│ Bang (State): [ Chọn ▼ Selangor, Johor... ]                 │
│                                                             │
│ 3. Phương Thức Thanh Toán                                   │
│ 🔘 Nhận hàng trả tiền (COD)                                       │
│ 🔲 Chuyển khoản (Bank/DuitNow QR)                           │
│    └─ Cần tải hình [📤 Biên lai (Tối đa 2MB)]              │
├─────────────────────────────────────────────────────────────┤
│ TỔNG KẾT ĐƠN HÀNG                                           │
│ Subtotal (2 items)  : RM 119.00                             │
│ SST (6%)            : RM   7.14                             │
│ Shipping (West MY)  : RM   8.00                             │
│ ────────────────────────────────────────────────────────ـــ │
│ TỔNG CỘNG           : RM 134.14                             │
│                                                             │
│ [ 🚀 XÁC NHẬN ĐẶT HÀNG (PLACE ORDER) ]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Mobile Optimized UX (Giao diện 375px)

*Tối ưu tỷ lệ ngón tay cái (App-feel).*

```text
📱 Mobile PLP (Lưới 1 Cột)        📱 Mobile PDP (Chi tiết)
┌───────────────────────────┐     ┌───────────────────────────┐
│ ☰  [Logo]              🛒 │     │ <   Sản Phẩm Chi Tiết     │
├───────────────────────────┤     ├───────────────────────────┤
│ [🔍 Tìm kiếm...          ] │     │ ┌───────────────────────┐ │
│ ───────────────────────── │     │ │       ẢNH TO          │ │
│ [ 📑 Lọc & Sắp xếp ▼ ]    │     │ └───────────────────────┘ │
│                           │     │ Áo Khoác Bò             │
│ ┌───────────────────────┐ │     │ RM 89.00                │
│ │ 🖼️ Ảnh bự tràn ngang │ │     │ ───────────────────────── │
│ └───────────────────────┘ │     │ Phân loại: [ Màu ▼ ]    │
│ Áo Khoác Bò               │     │ Kích cỡ  : [ Size ▼ ]   │
│ RM 89.00                  │     │ SL: [- 1 +]             │
│ ───────────────────────── │     │                         │
│ ┌───────────────────────┐ │     │ Mô tả sản phẩm...       │
│ │ 🖼️ Ảnh bự tràn ngang │ │     ├───────────────────────────┤
│ └───────────────────────┘ │     │   [ THÊM VÀO GIỎ HÀNG ]   │ ◄── Nút Sticky cố định
└───────────────────────────┘     └───────────────────────────┘

📱 Bottom Sheet (Thay cho Menu Filter)
[ Màn hình đang tối mờ (Overlay) ]
┌───────────────────────────┐ ◄── Vuốt xuống sẽ tắt bảng này đi
│       [ Kéo xuống _ ]     │
│ Sắp xếp theo:             │
│ 🔘 Mới nhất               │
│ 🔲 Giá tăng dần           │
│ ───────────────────────── │
│ Lọc theo Ngành:           │
│ 🔲 Thời Trang             │
│ 🔲 Đồ Uống                │
└───────────────────────────┘
```
