# F10 Orders Management — Design & Wireframe Report

> **Epic:** Orders Management
> **Feature Code:** F10
> **Figma Design:** [\[Link\] (Updating)](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30955-193&t=uZzasU8b0pQAt0lH-4)
> **Figma Prototype:** [\[Link\] (Updating)](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=lSTYBLQUIJcW42vr-1&preview-route=%2Forders)

Tài liệu này cung cấp bản vẽ Wireframe chi tiết cho bộ tính năng Quản lý Đơn hàng (F10), bám sát các luồng đã định nghĩa trong PRD và User Stories. Tất cả giao diện tuân thủ **F18 CMS Global Layout** (Sidebar trái và Topbar giữ nguyên).

---

## 1. Màn Hình Chính: Danh Sách Đơn Hàng (Orders Dashboard)

*Màn hình quản lý tổng quan. Điểm nhấn là Status Stats Bar ở trên cùng, Hệ thống Tìm kiếm/Lọc và Data Table.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ 🛒 Orders                                │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌─ Status Stats Bar ───────────────────┐ │
│ ⚙️ Settings  │ │ Pending   (3)  | Ready to Ship (10)  │ │
│              │ │ Confirmed (5)  | Shipped       (12)  │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ [🔍 Tìm theo Mã Đơn/KH...] [ Ngày ▼ ]    │
│              │ [ Lọc Trạng thái/TT ▼ ]                  │
│              │                                          │
│              │ [ Bulk Action: Confirm (0) ]             │
│              │                                          │
│              │ ┌──────────────────────────────────────────────┐ │
│              │ │ [x] │ Order # │ Customer │ Total  │ Status   │ │
│              │ │ ────┼─────────┼──────────┼────────┼──────────│ │
│              │ │ [ ] │ P-1001  │ Ali Baba │ RM 120 │ 🟠 Pend  │ │
│              │ │ [ ] │ P-1002  │ Siti N.  │ RM 89  │ 🔵 Conf  │ │
│              │ │ [ ] │ P-1003  │ John Doe │ RM 45  │ 🟢 Ship  │ │
│              │ │ [ ] │ P-1004  │ Abu Bakar│ RM 200 │ 🔴 Canc  │ │
│              │ └──────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

## 2. Drawer Chi Tiết Đơn Hàng (Order Detail Drawer)

*Khi click vào thẻ hoặc dòng đơn hàng, Drawer (Flyout Sidebar) sẽ trượt từ bên phải ra. Drawer bao gồm Status Timeline, nút Thao tác, Thông tin Khách hàng, Thanh toán và Giỏ hàng.*

```text
       ┌── Chi tiết đơn hàng #P-1001 ────────────────[X]┐
       │                                                │
       │ ┌─ Trạng thái & Thao tác ────────────────────┐ │
       │ │ Timeline:                                  │ │
       │ │ 🔵 Pending ── ◯ Confirmed ── ◯ Shipped     │ │
       │ │                                            │ │
       │ │ [ Xác Nhận Đơn ]  [ Huỷ Đơn ]  [ Hoàn Tiền ] │ │
       │ └────────────────────────────────────────────┘ │
       │                                                │
       │ ┌─ Thông tin Khách hàng ─────────────────────┐ │
       │ │ 👤 Ali Baba                                │ │
       │ │ 📞 +60 123456789                           │ │
       │ │ ✉️ ali.baba@email.com                      │ │
       │ │ 📍 123 Jalan Merdeka, Kuala Lumpur         │ │
       │ └────────────────────────────────────────────┘ │
       │                                                │
       │ ┌─ Thông tin Thanh toán (QR Banking) ────────┐ │
       │ │ Phương thức: QR Banking                      │ │
       │ │ Trạng thái: Chưa xác nhận                    │ │
       │ │ Bằng chứng thanh toán (Payment Proof):       │ │
       │ │ 🖼️ [ Ảnh Receipt - Click để xem to ]         │ │
       │ └────────────────────────────────────────────┘ │
       │                                                │
       │ ┌─ Line Items ───────────────────────────────┐ │
       │ │ 📦 Baju Kurung (Đỏ - M)  x1    RM 89.00      │ │
       │ │ 🖼️ Lip Gloss (Cam)       x2    RM 78.00      │ │
       │ │                                            │ │
       │ │ Subtotal:                      RM 167.00     │ │
       │ │ Shipping Fee:                  RM 10.00      │ │
       │ │ SST (6%):                      RM 10.02      │ │
       │ │ ------------------------------------------   │ │
       │ │ Grand Total:                   RM 187.02     │ │
       │ └────────────────────────────────────────────┘ │
       └────────────────────────────────────────────────┘
```

---

## 3. Modal: Cảnh báo Huỷ Đơn (Cancel Order Modal)

*Bắt buộc hiển thị khi Merchant nhấn nút Huỷ đơn. Đảm bảo theo Business Rule BR-Cancel-01 phải nhập lý do.*

```text
       ┌── ⚠️ Xác nhận Huỷ Đơn #P-1001 ──────────────[X]┐
       │                                                │
       │ Bạn có chắc chắn muốn huỷ đơn hàng này?        │
       │ Khách hàng sẽ nhận được Email thông báo huỷ.   │
       │                                                │
       │ Lý do huỷ đơn (Bắt buộc)                       │
       │ ┌────────────────────────────────────────────┐ │
       │ │ Khách đặt trùng đơn...                     │ │
       │ └────────────────────────────────────────────┘ │
       │                                                │
       │ 💡 Tồn kho của các sản phẩm trong đơn sẽ tự    │
       │ động được cộng lại vào hệ thống.               │
       │                                                │
       │                   [ Quay lại ] [ Xác nhận Huỷ ]│
       └────────────────────────────────────────────────┘
```

---

## 4. Mobile Optimized View (Card & Full-page Detail)

*Trên màn hình < 768px, Bảng dữ liệu (Data Table) chuyển thành dạng Card chống cuộn ngang. Order Detail mở màn hình toàn phần (Full-page Modal) với các nút Action ghim cố định ở đáy.*

```text
📱 Mobile View (Orders List)
┌─────────────────────────────┐
│ ☰  Orders                   │
├─────────────────────────────┤
│ ┌─ Status Stats ──────────┐ │
│ │ Pen: 3 | Con: 5 | Shi: 2│ │
│ └─────────────────────────┘ │
│ [ Search...       ] [ Lọc ▼]│
│                             │
│ ┌─ P-1001 ───────── [ 🟠 ]┐ │
│ │ Ali Baba                  │ │
│ │ RM 120 • QR Banking       │ │
│ │ 2 phút trước           [>]│ │
│ └─────────────────────────┘ │
│                             │
│ ┌─ P-1002 ───────── [ 🔵 ]┐ │
│ │ Siti Nurhaliza            │ │
│ │ RM 89 • COD               │ │
│ │ Hôm qua                [>]│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘

📱 Mobile View (Order Detail - Full page)
┌─────────────────────────────┐
│ <  Chi tiết đơn #P-1001     │
├─────────────────────────────┤
│ Timeline: 🟠 Pending ── ◯   │
│                             │
│ 👤 Khách hàng               │
│ Ali Baba                    │
│ +60 123456789               │
│ 123 Jalan Merdeka, KL       │
│                             │
│ 💳 Thanh toán               │
│ QR Banking                  │
│ 🖼️ [ Xem Receipt ]          │
│                             │
│ 📦 Giỏ hàng                 │
│ Baju Kurung (Đỏ) x1  RM 89  │
│                             │
│ Tổng cộng: RM 187.02        │
│                             │
├─────────────────────────────┤
│ [ Huỷ ]      [ XÁC NHẬN ĐƠN]│ ◄── Nút ghim đáy (Sticky Bottom Bar)
└─────────────────────────────┘
```

---

## 5. UI States & Fallbacks
1. **Empty State:** Hiển thị Illustration dạng "xe giao hàng lủi thủi" + thông điệp: "Bạn chưa có đơn hàng nào. Hãy chia sẻ link store!".
2. **Loading State:** Thay vì trắng màn hình, hiển thị Skeleton Loading Lines (tạo khung viền) cho danh sách đơn để giảm bounce rate.
3. **Notification (Toast):** Gửi Toast Message xanh lá "Order #P-1001 updated successfully!" kèm tiếng PING nhẹ báo hiệu khi đơn hàng từ khách mới được đặt thành công (Real-time).
