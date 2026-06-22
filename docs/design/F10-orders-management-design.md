# F10 Orders Management — Design & Wireframe Report

> **Epic:** Orders Management
> **Feature Code:** F10
> **Version:** 2.2 (v2.2 — Manual Payment Verification per PD-018)
> **Updated:** 2026-05-15
> **Figma Design:** [\[Link\]](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30955-193&t=uZzasU8b0pQAt0lH-4)
> **Figma Prototype:** [\[Link\]](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=lSTYBLQUIJcW42vr-1&preview-route=%2Forders)
> **Decisions:** [PD-018](../decisions/decisions-log.md#pd-018--manual-payment-bank-transfer-verification-flow) · Issue [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004)

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

## 1.1. **[v2.2]** Quick Filter Chip — Awaiting Verification

Bên phải Status Stats Bar, thêm distinct chip màu amber/orange (separate visually từ status filter thường):

```text
┌─ Quick Filters (v2.2) ─────────────────────┐
│ [⏳ Awaiting Verification (4)] ← amber chip │
│ Click → list filtered by                    │
│         paymentStatus = pending_verification│
└─────────────────────────────────────────────┘
```

- Position: cạnh phải Status Stats Bar, hoặc dưới một dòng nếu narrow
- Visual: distinct background (amber/orange #F59E0B với 10% opacity) + count badge
- State khi count = 0: hiển thị "Awaiting Verification (0)" với muted color, vẫn clickable để show empty state

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

> **[F36 EasyParcel] Fulfillment trên OrderDetailPanel — INLINE, KHÔNG modal** (nguồn: PRD `docs/prd/F36-easyparcel-delivery.md` §6.C, single-courier). Toàn bộ xử lý đưa thẳng vào panel theo trạng thái. **KHÔNG mở modal · KHÔNG tab toggle EasyParcel/manual · KHÔNG dropdown chọn courier** (courier đã cố định ở Settings → `serviceId ← selectedCourier`, hệ thống tự lấy).

**State 1 — Confirmed (chuẩn bị ship):** chỉ **1 nút** trên panel; bấm → chạy thẳng API (không modal), nút tự chuyển spinner đúng 2 bước:

```text
   [ 📦 Ready to Ship ]                    ◄── 1-click; product đủ số đo → chạy luôn
        │ bấm
        ▼
   [ ⏳ Đang giữ chỗ… ]    (bước 1: EPSubmitOrderBulk — chưa trừ ví)
   [ ⏳ Đang trừ ví… ]     (bước 2: EPPayOrderBulk — trừ ví, sinh AWB)
```

**State 2 — Success:** ẩn/khóa nút Ready to Ship (idempotent — chống trừ ví 2 lần), render card cố định:

```text
       ┌─ 📦 Shipping & Tracking ─────────────────────┐
       │ Courier: J&T Express   AWB: MY123456789 [📋] │ ◄── courier từ Settings (KHÔNG chọn lại)
       │ [ 🖨️ In nhãn (PDF) ]   [ 📅 Đặt pickup ]     │ ◄── labelUrl · collection_date (default ngày làm việc kế)
       │ Tracking: ● Đang trung chuyển · 16/06 18:40  │ ◄── shippingTrackingStatus (cron poll 30–60′)
       │ Trạng thái đơn: Shipped   [ Đánh dấu hoàn tất ]│ ◄── order.status (manual, TÁCH tracking)
       └──────────────────────────────────────────────┘
```

**Error handling — INLINE ngay khu vực nút (không thông báo chung chung):**

```text
⚠️ EASYPARCEL_WALLET_LOW (alert đỏ/vàng dưới nút):
   "Tài khoản EasyParcel không đủ số dư."  [ Nạp tiền ngay ↗ ]  [ Thử lại ]
   → order KHÔNG đổi trạng thái

🚫 COD East MY: nút "Ready to Ship" DISABLED ngay từ đầu + note:
   "EasyParcel chỉ hỗ trợ COD tại khu vực West MY."
```

**Thiếu dữ liệu parcel (weight/dims) — INLINE input, KHÔNG modal (Option A):** đơn chuẩn (product đủ số đo) vẫn **1-click**. Khi product thiếu số đo → bấm Ready to Ship sẽ **chặn lại + xổ box nhập ngay dưới nút** (tái dùng component Weight/Dimensions cũ):

```text
   [ 📦 Ready to Ship ]
   ⚠️ Thiếu thông tin kích thước gói hàng
   Bổ sung để tạo vận đơn EasyParcel:
   ┌──────────────────────────────────────┐
   │ Cân nặng:  [ 600 ] g                 │
   │ Kích thước: [ L ] x [ W ] x [ H ] cm │
   └──────────────────────────────────────┘
   [ Tiếp tục tạo nhãn ]                   ◄── điền xong → chạy tiếp luồng 2 bước
```

> **Refine PRD #1232:** thay vì âm thầm dùng hằng số `DEFAULT_PARCEL` khi thiếu số đo, **ưu tiên prompt merchant nhập inline** (cước chính xác hơn); const chỉ là last-resort nếu merchant bỏ qua. → cần cập nhật PRD §6.C cho khớp.

**Dual-field:** `order.status` (lifecycle, merchant bấm tay — vd "Đánh dấu hoàn tất") **tách biệt** `shippingTrackingStatus` (13 status EasyParcel, cron poll). Delivered → KHÔNG auto-complete; merchant tự bấm.

**Returns / Refund (Phase D):** KHÔNG dựng RMA UI mới — **reuse** `[ Hoàn Tiền ]` + `[ Huỷ Đơn ]` có sẵn (`/refund` + `/cancel`, tự restock, idempotent); refund phân tier theo trạng thái label (chưa mua → full; chưa pickup → hủy trên dashboard EasyParcel; đã pickup → cước mất). **Reverse label cắt khỏi MVP.**

**Non-EP tenant:** hiển thị ô nhập `trackingNumber` **thủ công ngay trên panel chính** (không có nút Ready to Ship EasyParcel, KHÔNG gộp vào modal/tab).

#### User Flow — Tạo vận đơn (Phase C)

```text
Actor: Merchant — tiền đề: order paid + confirmed, tenant EasyParcel ON

1. Merchant → mở OrderDetailPanel → bấm [📦 Ready to Ship]
   System   → check product weight/dims:
              ├─ đủ    → chạy luôn (bước 2)
              └─ thiếu → xổ inline input weight/L×W×H → điền → [Tiếp tục tạo nhãn]
   (COD + buyer East MY → nút DISABLED từ đầu + note "COD chỉ West MY")

2. System   → POST /api/orders/[id]/create-label (2 bước, inline spinner):
   ① EPSubmitOrderBulk → "Đang giữ chỗ…"  (chưa trừ ví)
   ② EPPayOrderBulk    → "Đang trừ ví…"   (trừ ví, sinh AWB)
   ├─ OK       → lưu awbNo + labelUrl; trackingNumber = awbNo; order → ready_to_ship
   └─ ví thiếu → EASYPARCEL_WALLET_LOW (inline) + [Nạp tiền][Thử lại]; order KHÔNG đổi

3. System   → ẩn/khóa nút (idempotent) → render card "Shipping & Tracking"
4. Merchant → [🖨️ In nhãn PDF] + [📅 Đặt pickup] (collection_date, default ngày kế)
              → bấm "Ship Order" (có sẵn) → order → shipped
```

#### User Flow — Theo dõi giao hàng (Tracking)

```text
Actors: System (cron) + Merchant + Buyer

1. Cron     → /api/cron/sync-tracking (30–60′) → EPParcelStatusBulk theo batch tenant
   System   → cập nhật shippingTrackingStatus (13 status) — KHÔNG đụng order.status

2. Merchant → xem tracking trong card "Shipping & Tracking" (drawer)
   Buyer    → xem timeline trang đơn (OrderTrackingClient: OtShippingCard + OtTimeline)

3. shippingTrackingStatus = Delivered
   System   → KHÔNG auto-complete
   Merchant → tự bấm "Đánh dấu hoàn tất" → order → completed
```

#### User Flow — Trả hàng / Hoàn tiền (Phase D)

```text
Actor: Merchant — KHÔNG có RMA UI mới, reuse nút có sẵn

1. Buyer/Merchant → yêu cầu trả/hủy
2. Merchant → bấm [Huỷ Đơn] hoặc [Hoàn Tiền] trên drawer (nút có sẵn)
   System   → /cancel hoặc /refund (idempotent, tự restock)
3. System   → refund phân tier theo trạng thái label:
   ├─ chưa mua label     → refund FULL (hàng + ship) + restock
   ├─ đã mua, chưa pickup → refund tiền hàng; cước: hủy trên dashboard EasyParcel hoàn ví
   └─ đã pickup          → refund tiền hàng; ⚠️ cước mất (ghi rõ)
   (Reverse label: KHÔNG hỗ trợ ở MVP)
```

---

## 2.1. **[v2.2]** Manual Payment Verification Block (Order Detail Drawer)

Hiển thị **CHỈ KHI** `paymentMethod = bank_transfer` AND `paymentStatus = pending_verification`. Block thay thế "Thông tin Thanh toán (QR Banking)" cũ.

```text
       ┌─ ⏳ Manual Payment Verification ───────────┐
       │                                            │
       │ Reference Code:  BT-A3K9P2  [📋 Copy]      │ ← font mono, large
       │ Amount Expected: RM 187.02                 │
       │                                            │
       │ Buyer Note (paymentReference seller-side): │
       │ ┌──────────────────────────────────────┐   │
       │ │ (optional textarea — seller can note │   │
       │ │  actual amount if mismatch, etc.)    │   │
       │ └──────────────────────────────────────┘   │
       │                                            │
       │ ┌─ Proof Image ──────────────────────┐     │
       │ │                                    │     │
       │ │     [LARGE PROOF PREVIEW]          │     │ ← ~400px tall, clickable
       │ │      Click → Full-Screen Viewer    │     │
       │ │                                    │     │
       │ └────────────────────────────────────┘     │
       │                                            │
       │ Buyer Quick Info:                          │
       │ 👤 Ali Baba   📞 +60 123456789  [Call/WA]  │
       │                                            │
       │ ┌──────────────────────────────────────┐   │
       │ │ [✓ APPROVE]            [✗ REJECT]    │   │ ← green + red buttons
       │ └──────────────────────────────────────┘   │
       │     ↑ 1-click           ↑ opens modal      │
       │                                            │
       └────────────────────────────────────────────┘
```

**State khi `paymentStatus = paid`:** Block hiển thị success state — checkmark + `paymentVerifiedAt` + `paymentVerifiedBy` (audit trail).

**State khi `paymentStatus = awaiting_payment` (sau Reject hoặc init):** Block hiển thị "Waiting for buyer to upload proof" + last rejection reason (nếu có).

---

## 2.2. **[v2.2]** Modal: Reject Payment

Mở khi seller bấm Reject button trong Manual Payment Verification Block.

```text
       ┌─ ✗ Reject Payment Proof #P-1001 ─────────[X]┐
       │                                              │
       │ Buyer sẽ nhận email "Payment Rejected"      │
       │ kèm link upload mới (TTL extends 24h).      │
       │                                              │
       │ Lý do từ chối (bắt buộc — single select):   │
       │                                              │
       │   ⦿ Ảnh mờ — không đọc được                  │
       │   ◯ Sai số tiền                              │
       │   ◯ Trùng đơn                                │
       │   ◯ Khác (vui lòng ghi chi tiết)             │
       │                                              │
       │ Chi tiết (chỉ hiện khi chọn "Khác"):         │
       │ ┌────────────────────────────────────────┐   │
       │ │ (textarea — bắt buộc ≥10 chars)        │   │
       │ └────────────────────────────────────────┘   │
       │                                              │
       │                  [ Quay lại ] [ Submit ]     │
       └──────────────────────────────────────────────┘
```

- Single-select radio (D-05 — không multi)
- Submit disabled khi: chưa chọn reason; chọn "Khác" mà freetext <10 chars
- Sau submit: toast green "Payment rejected — buyer notified" + drawer refresh

---

## 2.3. **[v2.2]** Full-Screen Proof Viewer

Click ảnh proof → open full-screen modal:
- Centered image với max-height = 90vh
- Zoom in/out controls (+/- buttons, mouse wheel)
- Rotate 90° button
- Download button
- ESC để close
- Backdrop click để close

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

> **[F36 mobile]** Sticky bottom bar thêm nút **`[ 📦 Ready to Ship ]`** (khi order `paid` + `confirmed`) → mở flow tạo vận đơn như desktop. Card **"📦 Shipping & Tracking"** (AWB + tracking + in nhãn/pickup) stack dọc trong full-page detail. Returns reuse `[ Hoàn Tiền ]`.

---

## 5. UI States & Fallbacks
1. **Empty State:** Hiển thị Illustration dạng "xe giao hàng lủi thủi" + thông điệp: "Bạn chưa có đơn hàng nào. Hãy chia sẻ link store!".
2. **Loading State:** Thay vì trắng màn hình, hiển thị Skeleton Loading Lines (tạo khung viền) cho danh sách đơn để giảm bounce rate.
3. **Notification (Toast):** Gửi Toast Message xanh lá "Order #P-1001 updated successfully!" kèm tiếng PING nhẹ báo hiệu khi đơn hàng từ khách mới được đặt thành công (Real-time).
4. **[v2.2] Verification Toast:** "Payment approved — buyer notified" (green) hoặc "Payment rejected — buyer notified with reason" (amber).
5. **[v2.2] Awaiting Verification Empty State:** Khi filter chip click mà count = 0: hiển thị "Tất cả thanh toán đã được xác minh ✓".

---

## 6. **[v2.2]** Storefront — Post-Order Upload Page

Buyer-facing page tại `/sites/[slug]/orders/[id]?token=<JWT>`. Magic link từ email trỏ đây.

### 6.1. State: `awaiting_payment` (default)

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│             ⏳ Order Received!                          │
│             Awaiting Payment                            │
│                                                         │
│  Đơn hàng #P-1001 của bạn đã được tạo.                  │
│  Vui lòng chuyển khoản và upload bằng chứng để chúng    │
│  tôi xác nhận đơn hàng.                                 │
│                                                         │
│  ⏰ Hết hạn trong: 23h 47m  (countdown live)            │
│                                                         │
│ ┌─ Order Summary ───────────────────────────────────┐   │
│ │ #P-1001  •  Total: RM 187.02  •  Items: 2         │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─ Payment Instructions ────────────────────────────┐   │
│ │                                                   │   │
│ │        ┌─────────────────────┐                    │   │
│ │        │                     │                    │   │
│ │        │  [MERCHANT QR IMG]  │ ← DuitNow QR       │   │
│ │        │  (200x200 px)       │   from tenant      │   │
│ │        │                     │                    │   │
│ │        └─────────────────────┘                    │   │
│ │                                                   │   │
│ │  Bank:           Maybank                          │   │
│ │  Account No:     1234567890                       │   │
│ │  Account Name:   CTY TNHH ABC                     │   │
│ │                                                   │   │
│ │  Reference Code: ┌──────────────┐ [📋 Copy]       │   │
│ │                  │  BT-A3K9P2   │                 │   │
│ │                  └──────────────┘                 │   │
│ │  ⚠ Vui lòng nhập "BT-A3K9P2" vào ghi chú         │   │
│ │     khi chuyển khoản để đối soát nhanh hơn.       │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─ Upload Receipt ──────────────────────────────────┐   │
│ │                                                   │   │
│ │   ┌──────────────────────────────────────────┐    │   │
│ │   │   📤 Drag-drop or Click to Upload         │    │   │
│ │   │   JPG/PNG/PDF, max 2MB                    │    │   │
│ │   └──────────────────────────────────────────┘    │   │
│ │                                                   │   │
│ │   [ UPLOAD RECEIPT ] ← large CTA button          │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2. State: `pending_verification`

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│             ⏳ Awaiting Seller Verification             │
│                                                         │
│  Cảm ơn! Seller sẽ xác minh thanh toán trong 1-12 giờ. │
│  Bạn sẽ nhận email khi đơn được duyệt.                  │
│                                                         │
│ ┌─ Order Summary ───────────────────────────────────┐   │
│ │ #P-1001  •  Total: RM 187.02                      │   │
│ │ Payment proof uploaded ✓ at 14:25                 │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─ Uploaded Proof ──────────────────────────────────┐   │
│ │   [thumbnail of uploaded proof]   [🔄 Replace]    │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.3. State: `paid` (after Approve)

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│             ✓ Payment Confirmed!                        │
│             Order #P-1001 is confirmed                  │
│                                                         │
│  Cảm ơn bạn đã thanh toán. Đơn hàng đang được chuẩn bị. │
│                                                         │
│  [ Continue Shopping ]  [ Track Order ]                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.4. State: `cancelled` (after Reject hoặc TTL expired)

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│             ✗ Order Cancelled                           │
│                                                         │
│  Order #P-1001 đã bị hủy.                               │
│                                                         │
│  Lý do: <paymentRejectionReason or "Quá hạn thanh toán">│
│  Chi tiết: <paymentRejectionDetail nếu có>              │
│                                                         │
│  [ Tạo đơn mới ]  [ Liên hệ shop ]                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.5. State: Invalid / Expired Token

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│             🔒 Link không hợp lệ hoặc đã hết hạn        │
│                                                         │
│  Link bạn đang dùng đã hết hạn hoặc không hợp lệ.       │
│                                                         │
│  [ Liên hệ shop ]  [ Tạo đơn mới ]                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.6. Mobile responsive (< 768px)

- Full-width stack layout
- QR image trung tâm, max 280x280
- Reference Code block sticky-ish (luôn visible)
- Upload button full-width sticky bottom (giống Sticky Bottom Bar pattern F10)
