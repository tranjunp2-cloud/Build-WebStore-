# PRD: Orders Management (F10)
> **Version:** 2.2 | **Updated:** 2026-05-15 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 6 (v2.2 manual payment verification) · Wave 5 (v2.1 base)
> **Depends on:** F09 Storefront Commerce ✅, Payload CMS Orders collection ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 WhatsApp
> **Decisions Log:** [PD-018](../decisions/decisions-log.md#pd-018--manual-payment-bank-transfer-verification-flow) · Issue [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F10-01 | Order Management & Status Updates | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Ready |
| US-F10-02 | Customer Checkout | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Ready |
| US-F10-03 | Order Cancellation & Inventory Restock | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Ready |
| US-F10-04 | Order List Advanced Sorting & Filtering | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Ready |
| US-F10-05 | Mobile Web UX — Order Management on the Go | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Ready |
| US-F10-06 | Seller verifies Manual Payment proof (Approve / Reject) | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Draft (v2.2) |
| US-F10-07 | Buyer uploads payment proof post-order via Magic Link | [F10-orders-stories.md](../stories/F10-orders-stories.md) | Draft (v2.2) |

---

## 1. Problem Statement

When customers place orders through the storefront, site owners need a dashboard to view, manage, and update order statuses. Currently the orders page shows a basic table with no status workflow, no detail view, and no filtering.

---

## 2. Target User

- Site owner nhận đơn hàng
- Quản lý fulfilment từ mobile hoặc desktop
- Cần biết khi có đơn mới ngay lập tức

---

## 3. Solution Overview

Dashboard `/orders`: stats bar (by status), table với order list (có search, filter, sort), order detail drawer với status timeline. Hỗ trợ 2 luồng đơn hàng: (1) Manual Flow (COD, Bank Transfer) cho phép merchant tự chỉnh status; (2) Automated Flow (Stripe) tự chuyển status thông qua API. Tích hợp tính năng Refund, Cancel logic (có lý do & restock), và Bulk Confirm.

### 3.1 Bank Transfer 3-step async verification (v2.2 — PD-018)

PRD v2.1 cho phép Bank Transfer auto-mark `Paid` khi buyer upload proof → tạo lỗ hổng đơn ảo (ảnh đen / meme / hóa đơn cũ vẫn pass). v2.2 đổi thành **3-step async** với verification gate:

```
Step 1: Buyer Place Order (không cần upload proof)
        → Order tạo với paymentStatus = awaiting_payment
        → Stock reservation 24h
        → Email gửi magic link upload (JWT signed, TTL 24h)
        ↓
Step 2: Buyer mở magic link → upload proof
        → paymentStatus = pending_verification
        ↓
Step 3: Seller xem proof trên CMS
        → Approve → paymentStatus = paid → orderStatus = confirmed
        → Reject (kèm reason) → paymentStatus = awaiting_payment (re-open upload)
        ↓
Timeout (24h) không upload hoặc không verify → auto-cancel + restock
```

COD giữ nguyên logic — không cần upload proof (physical handover).

---

## 4. Scope

### In Scope
- Giao diện List view: Search, Sort, Filter linh hoạt (US-F10-04)
- 2 luồng trạng thái đơn hàng: Manual (COD, Bank Transfer) (US-F10-01, US-F10-02)
- Quản lý **Order Status** (Pending, Confirmed, Ready to Ship, Shipped, Completed, Cancelled) tách biệt với **Payment Status** (Unpaid, Awaiting Payment, Pending Verification, Paid, Cancelled, Refunded).
- Order detail trực quan với status timeline, cho phép đổi status trên list/detail (US-F10-01)
- Cancel order: Quy định phải có Cancel reason, auto-restock ngoại trừ product bị xoá (US-F10-03)
- Hỗ trợ Refund thủ công khi đơn đang Shipped hoặc Completed (US-F10-01)
- Bulk status update: Thao tác Confirm đồng loạt nhiều đơn Pending (US-F10-01)
- **[v2.2] Bank Transfer 3-step async verification:** Awaiting Payment → Pending Verification → Paid/Cancelled (US-F10-06, US-F10-07)
- **[v2.2] Seller verification UI:** Awaiting Verification filter chip, large proof preview, Approve/Reject với reason picker (US-F10-06)
- **[v2.2] Buyer post-order upload via Magic Link:** JWT signed token TTL 24h, gửi qua email confirmation (US-F10-07)
- **[v2.2] Stock reservation TTL 24h** với auto-cancel + restock job (US-F10-07)
- **[v2.2] Auto-generated 6-char Reference Code** đính kèm mỗi Bank Transfer order

### Out of Scope
- WhatsApp Business API (P1 — Wave 7+)
- Đồng bộ webhook tự động từ 3rd Party Logistics API (Phase sau)
- Stripe Card / FPX (F13 owns — Wave 6)
- Bulk Approve cho `pending_verification` orders (defer — D-14, revisit sau seller dashboard ship)

### Roadmap Wave 8+ (decided D-13 — 2026-05-15)

- **Auto-verify via Open Banking API**: Match `paymentReference` với bank transaction history → auto-set `paymentStatus = paid` + `verificationSource = auto` + lưu `bankTransactionId`. Schema Wave 6 **đã pre-build** 3 fields dự phòng (`autoVerifiedAt`, `bankTransactionId`, `verificationSource`) — backward-compat zero migration sau khi Open Banking integration ship.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| New order notification after payment | < 60s | Order creation timing |
| Order status update success | > 99% | API |

---

## 6. User Story Summary

```
AS A   store owner receiving orders
I WANT view và manage orders từ một dashboard
SO THAT tôi quản lý fulfilment hiệu quả
```

> Source: [US-F10-01](../stories/F10-orders-stories.md#us-f11-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Order list: table với order#, customer, total, status, payment type, date | US-F10-01 | P0 | |
| FR-02 | Filter & Search: date range, status, payment method; search by order# hoặc customer name; sort linh hoạt | US-F10-04 | P0 | Tương tự list product |
| FR-03 | Bulk Action: Chọn nhiều đơn "Pending" -> Update thành "Confirmed" | US-F10-01 | P0 | Áp dụng cho manual flow |
| FR-04 | New order notification: in-app toast + email to merchant trong < 60s | US-F10-01 | P0 | |
| FR-05 | Order detail: customer info, items, subtotal, SST, shipping, total, payment proof (đối với QR Banking) | US-F10-01 | P0 | Cho phép đổi status ở list/drawer |
| FR-06 | Order Status workflow: Pending → Confirmed → Ready to Ship → Shipped → Completed / Cancelled. **[Wave 7]** For EasyParcel tenants, "Ready to Ship" button opens a label-creation modal (weight, dims, pickup date); non-EP tenants flip status as before. | US-F10-01 | P0 | Tách biệt với Payment Status; modular per-tenant |
| FR-07 | Status update → customer notification email auto-sent (áp dụng Confirm, Shipped, Cancelled) | US-F10-01 | P1 | |
| FR-08 | Cancel order: Yêu cầu nhập Cancel Reason & inventory auto-restock | US-F10-03 | P0 | Bỏ qua restock nếu product bị xoá |
| FR-09 | Refund: Chuyển order sang Refund thủ công khi ở trạng thái hợp lệ (Shipped, Completed), tự cập nhật Payment Status -> Refunded | US-F10-01 | P0 | |
| FR-10 | Customer payment flow: COD, Bank Transfer (Manual). Stripe Card + FPX qua F13. | US-F10-02 | P0 | |
| ~~FR-11~~ | ~~QR Payment Checkout: Bắt buộc upload ảnh biên lai (<2MB). Trạng thái thanh toán (Payment Status) khởi tạo mặc định là `Paid`.~~ | ~~US-F10-02~~ | ~~P0~~ | **DEPRECATED v2.2 — replaced by FR-14 → FR-22.** Auto-Paid pattern tạo lỗ hổng fake orders. |
| FR-11.1 | Payment Status Sync: Khi đơn hàng được `Cancelled`, `Payment Status` cập nhật thành `Cancelled`. Khi đơn hàng thực hiện thao tác hoàn tiền, `Payment Status` thành `Refunded`. | US-F10-01 | P0 | Đồng bộ state. |
| FR-11.2 | Payment Status Data: Hệ thống hỗ trợ tách bạch Order Status và 6 Payment Statuses: `Unpaid` (COD chưa giao), `Awaiting Payment` (BT chưa upload proof), `Pending Verification` (BT đã upload, chờ seller), `Paid`, `Cancelled`, `Refunded`. | US-F10-01, US-F10-06 | P0 | **[v2.2]** Enum mở rộng. COD = `Unpaid`. BT lifecycle: `Awaiting Payment` → `Pending Verification` → `Paid` hoặc `Cancelled`. |
| FR-12 | **[Mobile]** Danh sách đơn hàng trên viewport < 768px chuyển đổi từ Bảng (Table) sang dạng Thẻ Card dọc (Stacked Cards). | US-F10-05 | P1 | UX chống cuộn ngang |
| FR-13 | **[Mobile]** Chi tiết đơn hàng mở thành dạng Fullscreen thay vì Drawer, với các nút Action (Update Status, Cancel) sticky ở mép dưới màn hình. | US-F10-05 | P1 | Thumb-friendly |
| **FR-14** | **Bank Transfer Place Order:** Buyer chọn Bank Transfer + bấm Place Order **KHÔNG cần upload proof tại checkout** → order tạo với `paymentStatus = awaiting_payment`, `paymentExpiresAt = now + 24h`, auto-generated 6-char `paymentReference` (e.g. `BT-A3K9P2`). | US-F10-02, US-F10-07 | P0 | **[v2.2 D-04 D-08 D-11]** Drop fast-path upload-at-checkout. |
| **FR-15** | **Magic Link Email:** Sau Place Order, hệ thống gửi email confirmation kèm magic link `/sites/[slug]/orders/[id]?token=<JWT>` (signed JWT, expiry = `paymentExpiresAt`). Email content cho cả Bank Transfer + COD đồng nhất template. | US-F10-07 | P0 | **[v2.2 D-01 D-07 D-09 D-10]** Fire-and-forget pattern. |
| **FR-16** | **Post-Order Upload Page:** Magic link mở persistent route hiển thị: order summary, QR/STK merchant, **6-char Reference Code instruction** ("Vui lòng nhập `BT-XXXXXX` vào ghi chú khi chuyển khoản"), Upload Receipt button. | US-F10-07 | P0 | **[v2.2 D-01 D-08 D-10]** Route bookmark được + sharable. |
| **FR-17** | **Upload Proof → Pending Verification:** Khi buyer upload proof thành công (file ≤2MB, JPG/PNG/PDF) → `paymentStatus = pending_verification`. **KHÔNG auto-mark Paid** (đảo BR-Payment-01 cũ). | US-F10-07 | P0 | **[v2.2 D-11]** Verification gate. |
| **FR-18** | **Re-upload Behavior:** Buyer được phép replace proof khi `paymentStatus IN (awaiting_payment, pending_verification)`. Khi seller Reject, status quay về `awaiting_payment` → buyer có thể re-upload (kháng cáo). | US-F10-07 | P0 | **[v2.2 D-03]** Tránh deadlock UX. |
| **FR-19** | **Seller Verify Drawer:** Order detail Bank Transfer hiển thị: large proof preview (click → full-screen modal), `paymentReference` rõ ràng để seller đối soát app bank, 2 nút **Approve** + **Reject**. | US-F10-06 | P0 | **[v2.2]** Replace Image Viewer cũ. |
| **FR-20** | **Approve Flow:** Seller bấm Approve → `paymentStatus = paid`, `paymentVerifiedAt = now`, `paymentVerifiedBy = currentUserId`. Order Status auto-promote `pending` → `confirmed`. Trigger email "Payment Confirmed". | US-F10-06 | P0 | **[v2.2]** |
| **FR-21** | **Reject Flow:** Seller bấm Reject → modal yêu cầu chọn **reason** từ enum: `Ảnh mờ`, `Sai số tiền`, `Trùng đơn`, `Khác (kèm freetext bắt buộc ≥10 chars)`. Sau submit → `paymentRejectionReason` + `paymentRejectionDetail` lưu, status về `awaiting_payment`, gửi email "Payment Rejected — please re-upload" kèm magic link mới. | US-F10-06 | P0 | **[v2.2 D-05]** Single-select enum + Khác freetext. |
| **FR-22** | **Stock Reservation TTL + Auto-Cancel:** Bank Transfer order **reserve stock** (KHÔNG decrement immediate). Background job quét order có `paymentStatus IN (awaiting_payment, pending_verification)` AND `paymentExpiresAt < now` → auto-cancel + restock + gửi email "Order expired". | US-F10-07 | P0 | **[v2.2 D-02]** TTL 24h. Job tần suất ≤ 15 phút. |
| **FR-23** | **Awaiting Verification Filter Chip:** Orders Dashboard hiển thị quick-filter chip "Awaiting Verification" (count badge) bên cạnh Status Stats Bar. Click → list lọc orders có `paymentStatus = pending_verification`. | US-F10-06 | P0 | **[v2.2]** Seller daily workflow. |
| ~~**FR-24**~~ | ~~Anti-Fraud Warning Copy~~ | ~~US-F10-07~~ | ~~P0~~ | **[v2.2 D-06 DROPPED 2026-05-15]** PM chốt bỏ — trust signal đến từ reference code + verification gate. |

---

## 8. Business Rules

- **BR-01:** Valid status base transitions: Pending→Confirmed→Ready to Ship→Shipped→Completed.
- **BR-Cancel-01:** Bắt buộc nhập **Lý do huỷ** (Cancel Reason) khi thực hiện Cancel order.
- **BR-Cancel-02:** Với đơn thanh toán kiểu Manual (COD/Bank Transfer), chỉ cho phép Cancel khi ở trạng thái `Pending` hoặc `Confirmed`. Khi được chuyển sang `Cancelled` thì `Payment Status` cũng tự động được đồng bộ về `Cancelled`.
- **BR-Refund-01:** Chỉ cho phép thực hiện Refund (thủ công) khi đơn đang ở trạng thái `Shipped` (Đang vận chuyển) hoặc `Completed` (Hoàn thành đơn hàng). Lúc này Order Status sẽ tự fallback về Cancelled và `Payment Status` là `Refunded`.
- **BR-Restock-01:** Khi trạng thái Order chuyển sang `Cancelled`, hệ thống tự động cộng lại tồn kho. Bỏ qua logic này nếu sản phẩm đã bị xoá khỏi database.
- ~~**BR-Payment-01 (QR Banking):** Mặc định khi khách đặt hàng và upload thành công biên lai (Payment Proof), hệ thống tự động mark `Payment Status` của họ là `Paid`.~~ **[DEPRECATED v2.2 — replaced by BR-Payment-03 → BR-Payment-08.]** Pattern auto-Paid tạo lỗ hổng fake orders. PD-018 chốt verification gate.
- **BR-Payment-02 (COD):** Khi khách chọn COD, Payment Status khởi tạo bằng `Unpaid`. Admin vẫn tiến hành chuyển trạng thái Order theo luồng giao vận bình thường. Khi Admin update Order Status thành `Completed`, hệ thống **tự động cập nhật** Payment Status thành `Paid`. **(COD parity confirmed D-12 — không thay đổi.)**
- **BR-Payment-03 (Bank Transfer Lifecycle):** Bank Transfer order lifecycle `paymentStatus`: `awaiting_payment` (post-Place-Order, chưa upload) → `pending_verification` (đã upload proof, chờ seller) → `paid` (Approved) hoặc `cancelled` (Rejected / TTL expired). KHÔNG có path nào auto-promote sang `paid` mà thiếu seller Approve.
- **BR-Payment-04 (Stock Reservation TTL):** Bank Transfer order **reserve stock** ngay khi Place Order (không decrement). TTL = 24h tính từ `createdAt`. Background job auto-cancel + restock orders quá hạn. Tần suất job ≤ 15 phút để đảm bảo SLA.
- **BR-Payment-05 (Magic Link Expiry):** JWT magic link expiry = `paymentExpiresAt`. Buyer mở link sau expiry → page hiển thị "Order expired" + CTA tạo đơn mới. Seller có thể issue magic link mới khi Reject (resets `paymentExpiresAt` thêm 24h từ thời điểm Reject).
- **BR-Payment-06 (Re-upload Allowed):** Buyer được phép replace proof khi `paymentStatus IN (awaiting_payment, pending_verification)`. Sau Reject, status revert `awaiting_payment` → re-upload mở lại. KHÔNG cho phép upload sau khi Approve hoặc Cancel.
- **BR-Payment-07 (Reject Reason Mandatory):** Seller Reject **bắt buộc** chọn reason. Enum: `Ảnh mờ` | `Sai số tiền` | `Trùng đơn` | `Khác`. Khi chọn `Khác` → field freetext bắt buộc ≥10 chars. Lưu vào `paymentRejectionReason` + `paymentRejectionDetail`.
- **BR-Payment-08 (Reference Code Generation):** Mỗi Bank Transfer order tạo auto `paymentReference` format `BT-XXXXXX` (6 chars alphanumeric uppercase, exclude ambiguous `0/O/I/1`). Unique per tenant. Buyer instruction yêu cầu nhập code này vào ghi chú chuyển khoản.
- **BR-06:** Order scope theo tenant — không cross-tenant.
- **BR-07:** Inventory reservation released nếu API payment fail sau 30 phút **(Stripe automated flow only — Bank Transfer dùng BR-Payment-04 TTL 24h)**.

---

## 9. User Flow

### 9.1 COD Flow (unchanged from v2.1)

```
New COD order placed (Storefront) → Order created 'pending', paymentStatus=unpaid
  → Merchant notification (toast + email)
  → Customer confirmation email
  ↓
/orders
  Order appears in list
  Click → detail drawer
  Change status: Pending → Confirmed → ... → Completed
  → Customer notification (email / WhatsApp P1)
  → On Completed: paymentStatus auto-set 'paid' (BR-Payment-02)
```

### 9.2 Bank Transfer 3-step async flow (v2.2 — PD-018)

```
[STEP 1] Storefront Checkout
  Buyer chọn Bank Transfer + Place Order
    → Order tạo: orderStatus='pending', paymentStatus='awaiting_payment'
    → Stock reservation (KHÔNG decrement) + paymentExpiresAt = now + 24h
    → Auto-generate paymentReference = "BT-XXXXXX"
    → Send email confirmation kèm magic link (JWT signed, TTL 24h)
    → Buyer redirect → /sites/[slug]/orders/[id]?token=<JWT>
                                                          ↓
[STEP 2] Post-Order Upload page (persistent route)
  Buyer xem QR/STK merchant + reference code instruction + Upload Receipt button
    → Buyer upload proof (≤2MB, JPG/PNG/PDF)
    → paymentStatus → 'pending_verification'
    → Notify seller (toast + email)
                                                          ↓
[STEP 3] Seller verifies on Orders Dashboard
  Click "Awaiting Verification" filter chip → list
  Open order detail → large proof preview
  Đối soát số tiền + paymentReference với app bank
    │
    ├─ Approve → paymentStatus='paid', paymentVerifiedAt=now
    │           → orderStatus auto-promote 'pending' → 'confirmed'
    │           → Email buyer "Payment Confirmed"
    │           → Stock commit (decrement)
    │
    └─ Reject (modal chọn reason)
                → paymentRejectionReason + paymentRejectionDetail saved
                → paymentStatus revert 'awaiting_payment'
                → Email buyer "Payment Rejected: <reason>" + new magic link
                → Buyer có thể re-upload (kháng cáo)

[TIMEOUT] Background job (≤15min cadence)
  WHERE paymentStatus IN ('awaiting_payment','pending_verification')
    AND paymentExpiresAt < NOW()
  → orderStatus='cancelled', paymentStatus='cancelled'
  → Stock restock
  → Email buyer "Order Expired"
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Mọi nội dung của tính năng này bắt buộc phải hiển thị bên trong Main Content Area của hệ thống CMS, tuân thủ chặt chẽ kiến trúc Global Header và Sidebar Navigation được định nghĩa trong F18 CMS Layout.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (Orders Dashboard / List)
- **Mô tả:** Trung tâm quản lý toàn bộ đơn hàng của nhà bán.
- **Components chính:**
  - Status Stats Bar: Thanh ngang (Hoặc Widget KPIs) trên cùng tóm tắt số liệu đơn theo trạng thái (vd: Pending: 3, Confirmed: 5, Shipped: 12).
  - **[v2.2]** Quick Filter Chip **"Awaiting Verification"** (count badge) — preset filter `paymentStatus=pending_verification`. Vị trí: ngay cạnh Status Stats Bar, distinct color (orange/amber) để seller nhận diện workload.
  - Search & Filter Bar: Tìm theo Mã Đơn/KH; Lọc theo Ngày/Tháng; Khối thao tác Bulk Action "Confirm x Orders".
  - Data Table: Cột Mã Đơn (Clickable), Tên Khách, Tổng tiền (RM), Status Badge (đổi màu theo state — `awaiting_payment`=gray, `pending_verification`=amber, `paid`=green), **[v2.2]** Payment Reference (BT-XXXXXX), Loại thanh toán, Thời gian.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Màn hình Chi tiết (Order Detail / Info Drawer)
- **Mô tả:** Màn hình chi tiết của 1 đơn hàng cụ thể, thường được thiết kế dưới dạng Flyout Sidebar trượt từ phải ra (hoặc Page riêng độc lập).
- **Components chính:**
  - Status Timeline (Progress Flow): Biểu đồ các mốc trạng thái từ Pending -> Confirmed -> Shipped... để user theo dõi tiến trình.
  - Nút thao tác Status Actions: [Mark as Shipped], [Cancel Order], [Refund].
  - **[v2.2] Manual Payment Verification Block (chỉ hiện cho Bank Transfer khi `paymentStatus=pending_verification`):**
    - Reference code prominently displayed: `BT-XXXXXX` (font mono, large, copyable)
    - Large proof preview (clickable → full-screen modal)
    - Amount expected vs (placeholder cho phép seller note actual amount nếu khác)
    - Buyer info quick view (name + phone — để liên hệ nếu cần)
    - 2 primary buttons: **[Approve]** (green) + **[Reject]** (red — opens Reject Modal)
  - Customer Block: Tên, SDT, Địa chỉ giao hàng, Địa chỉ email.
  - Payment Detail: Loại hình (COD/Bank Transfer). Nếu Bank Transfer + đã verify → hiển thị `paymentVerifiedAt` + `paymentVerifiedBy` (audit trail).
  - Line Items list: Danh sách các SKU khách đặt mua kèm Cân nặng, Giá tiền. Summary khối tính tổng: Subtotal, Shipping fee, SST 6%, Grand Total.
- **Design / Wireframe (Order Detail Drawer):**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Mobile View (Order Cards & Full-page Detail)
- **Mô tả:** Thay vì bảng Data Table khó xem trên mobile, danh sách đơn hàng biến thành các Blocks. Tương tác vuốt (Swipe) thẻ để thực hiện thao tác nhanh. Khi click vào chi tiết, Drawer chuyển thành một màn hình dọc toàn phần (Full-page modal) thay vì Sidebar móp méo bên phải.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.4. **[v2.2] Storefront — Post-Order Upload Page** (`/sites/[slug]/orders/[id]?token=...`)
- **Mô tả:** Persistent route cho buyer upload proof sau Place Order. Magic link từ email → page này.
- **States:**
  - **`awaiting_payment` (default):**
    - Headline: "Order Received! Awaiting Payment"
    - Subtext: "Đơn hàng `<orderNumber>` đã được tạo. Vui lòng chuyển khoản và upload bằng chứng để chúng tôi xác nhận."
    - Order summary block: order#, total, expiry timer ("Còn lại 23h 45m")
    - **Payment Instructions Block:**
      - Merchant QR image (DuitNow) — large
      - Bank account details (tên ngân hàng, STK, tên TK)
      - **Reference Code** `BT-XXXXXX` (highlighted, copy button)
      - Instruction copy: "Vui lòng nhập `BT-XXXXXX` vào ghi chú khi chuyển khoản để chúng tôi đối soát nhanh hơn."
    - Upload Receipt button (large CTA) + drag-drop zone
    - **Anti-fraud warning** (FR-24): "Cố ý gửi bằng chứng giả mạo có thể dẫn đến việc hủy đơn hoặc khóa quyền mua hàng vĩnh viễn."
  - **`pending_verification`:** Headline "Awaiting Seller Verification" + "Seller sẽ xác minh trong 1–12 giờ". Cho phép re-upload (replace).
  - **`paid`:** Headline "Payment Confirmed ✓" + CTA "Continue Shopping" / "Track Order".
  - **`cancelled` (Rejected hoặc TTL expired):** Headline "Order Cancelled" + lý do (nếu Rejected) + CTA tạo đơn mới.
  - **Token invalid / expired:** Error page + CTA contact support hoặc tạo đơn mới.

### 10.5. **[v2.2] Modals**
- **Reject Payment Modal:** Single-select radio reason (`Ảnh mờ` | `Sai số tiền` | `Trùng đơn` | `Khác`). Khi chọn `Khác` → textarea bắt buộc ≥10 chars. Submit → confirmation toast.
- **Full-Screen Proof Viewer:** Click proof preview → full-screen image với zoom/rotate. ESC để đóng.

### 10.6. Các trạng thái UI (UI States) & Modals (legacy)
- **Empty State:** Hình xe giao hàng lủi thủi + "Bạn chưa có đơn hàng nào. Hãy chia sẻ link store!".
- **Loading State:** Bảng Table Skeleton lines loading. Nút Update Status show Spinner.
- **Error State / Edge Cases:** Toast đỏ báo lỗi không thể update status.
- **Modals:** Modal Cancel Order buộc nhập Text Reason. Modal Image Viewer (legacy — v2.2 dùng Full-Screen Proof Viewer ở §10.5).

---


## 11. Acceptance Criteria

> AC được copy từ `F10-orders-stories.md`. Không tự thêm AC không có trong story.

### AC-1: New Order Notification
> 📌 Source: [US-F10-01](../stories/F10-orders-stories.md) — AC-1

```gherkin
GIVEN a new order is placed on my storefront
WHEN  the order is created (COD = paymentStatus 'unpaid', Bank Transfer = 'awaiting_payment')
THEN  the order appears in my Orders dashboard within 60 seconds
  AND I receive a notification (in-app toast + email to merchant)
```

### AC-2: Merchant Bulk Confirms Orders
> 📌 Source: [US-F10-01](../stories/F10-orders-stories.md) — AC-Bulk-Confirm

```gherkin
GIVEN I am on the Orders list view
WHEN  I select multiple orders in "Pending" status and apply "Confirm Orders" bulk action
THEN  all selected orders are updated to "Confirmed"
  AND the system sends confirmation emails per order if configured
```

### AC-3: Cancel Order Logic and Restock
> 📌 Source: [US-F10-03](../stories/F10-orders-stories.md) — AC-1

```gherkin
GIVEN I am viewing a COD order in "Pending" or "Confirmed" status
WHEN  I change the status to "Cancelled"
THEN  the system prompts me to enter a "Cancel Reason"
  AND upon submission, the status is updated
  AND the reserved inventory is restored (unless the original product is deleted)
```

### AC-4: Checkout with Bank Transfer (3-step async — v2.2)
> 📌 Source: [US-F10-02](../stories/F10-orders-stories.md) — AC-3 (v2.2 rewrite)

```gherkin
GIVEN I am at the checkout page
WHEN  I select "Bank Transfer" as my payment method and click Place Order
THEN  the order is created with paymentStatus = 'awaiting_payment'
  AND paymentReference is auto-generated (format BT-XXXXXX)
  AND paymentExpiresAt = createdAt + 24h
  AND stock is reserved (NOT decremented)
  AND I receive an email with magic link to the Post-Order Upload page
  AND I am redirected to /sites/[slug]/orders/[id]?token=<JWT>
  AND the upload page shows QR/STK + reference code instruction + Upload Receipt button
  AND no upload happens at checkout (FR-14 D-04)
```

### AC-5: Buyer uploads payment proof (post-order)
> 📌 Source: [US-F10-07](../stories/F10-orders-stories.md) — AC-1 (v2.2)

```gherkin
GIVEN I open the magic link from order confirmation email
  AND the order is in paymentStatus 'awaiting_payment' AND paymentExpiresAt is in the future
WHEN  I upload a proof image (≤2MB, JPG/PNG/PDF)
THEN  paymentStatus transitions to 'pending_verification'
  AND seller receives notification (toast + email)
  AND I see "Awaiting Seller Verification" headline
  AND I CAN re-upload (replace) before seller decision (FR-18 D-03)
```

### AC-6: Seller approves Bank Transfer payment
> 📌 Source: [US-F10-06](../stories/F10-orders-stories.md) — AC-1 (v2.2)

```gherkin
GIVEN I am viewing a Bank Transfer order with paymentStatus 'pending_verification'
WHEN  I click "Approve" in the Manual Payment Verification Block
THEN  paymentStatus transitions to 'paid'
  AND paymentVerifiedAt = now, paymentVerifiedBy = currentUserId
  AND orderStatus auto-promotes 'pending' → 'confirmed'
  AND stock is committed (decrement)
  AND buyer receives "Payment Confirmed" email
```

### AC-7: Seller rejects Bank Transfer payment with reason
> 📌 Source: [US-F10-06](../stories/F10-orders-stories.md) — AC-2 (v2.2)

```gherkin
GIVEN I am viewing a Bank Transfer order with paymentStatus 'pending_verification'
WHEN  I click "Reject"
THEN  a modal asks me to select a reason from enum [Ảnh mờ, Sai số tiền, Trùng đơn, Khác]
  AND if I select "Khác", a freetext field is required (≥10 chars)
  AND upon submit, paymentRejectionReason + paymentRejectionDetail are saved
  AND paymentStatus reverts to 'awaiting_payment'
  AND paymentExpiresAt extends by 24h from rejection moment
  AND buyer receives "Payment Rejected: <reason>" email with new magic link
  AND buyer can re-upload (kháng cáo)
```

### AC-8: Auto-cancel on TTL expiry
> 📌 Source: [US-F10-07](../stories/F10-orders-stories.md) — AC-3 (v2.2)

```gherkin
GIVEN a Bank Transfer order with paymentStatus IN ('awaiting_payment','pending_verification')
  AND paymentExpiresAt < now
WHEN  the background job runs (cadence ≤15 minutes)
THEN  orderStatus is set to 'cancelled'
  AND paymentStatus is set to 'cancelled'
  AND reserved stock is restored
  AND buyer receives "Order Expired" email
```

### AC-9: Magic link expiry / invalid token
> 📌 Source: [US-F10-07](../stories/F10-orders-stories.md) — AC-4 (v2.2)

```gherkin
GIVEN I have a magic link with an expired or tampered JWT token
WHEN  I open the link
THEN  the upload page shows "Order expired" or "Invalid link" error
  AND CTA to contact seller or create a new order is displayed
  AND NO upload action is possible
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | New order visible < 60s | Order creation |
| **Security** | Dashboard auth required, tenant-scoped | |
| **Device** | Mobile 375px — cards instead of table | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `OrdersPage` | `app/(dashboard)/orders/page.tsx` | List + stats + **[v2.2] Awaiting Verification filter chip** |
| `OrderDetailDrawer` | `components/dashboard/OrderDetailDrawer.tsx` | Detail + status + **[v2.2] ManualPaymentVerificationBlock** |
| `StatusTimeline` | `components/dashboard/StatusTimeline.tsx` | Progress steps |
| **[v2.2]** `ManualPaymentVerificationBlock` | `components/dashboard/ManualPaymentVerificationBlock.tsx` | Approve/Reject buttons + large proof preview + reference code display |
| **[v2.2]** `RejectPaymentModal` | `components/dashboard/RejectPaymentModal.tsx` | Reason picker (enum + Khác freetext) |
| **[v2.2]** `PostOrderUploadPage` | `app/sites/[slug]/orders/[id]/page.tsx` | Persistent route — buyer upload flow |
| **[v2.2]** `magicLinkVerify` | `lib/auth/order-token.ts` | JWT sign/verify cho magic link |
| **[v2.2]** `paymentExpiryJob` | `lib/jobs/payment-expiry.ts` | Background cron auto-cancel + restock |

### 13.2 Data Models & Structure
Order Collection (Payload CMS) cần lưu rõ các Fields:

| Field | Type | Notes |
|-------|------|-------|
| `orderStatus` | enum | `pending` \| `confirmed` \| `ready_to_ship` \| `shipped` \| `completed` \| `cancelled` |
| `paymentMethod` | enum | `cod` \| `bank_transfer` (v2.2 rename khỏi `qr_banking`) — `card` \| `fpx` qua F13 |
| `paymentStatus` | enum | **[v2.2 D-11]** `unpaid` \| `awaiting_payment` \| `pending_verification` \| `paid` \| `cancelled` \| `refunded` |
| `paymentReference` | varchar(10) | **[v2.2 D-08]** Auto `BT-XXXXXX` (6 chars alphanum exclude `0/O/I/1`). Unique per tenant. |
| `paymentExpiresAt` | timestamp | **[v2.2 D-02]** `createdAt + 24h` cho Bank Transfer. Background job dùng để cancel. |
| `paymentProofImage` | upload → media | Already exists (v2.1). v2.2 cho phép replace khi `paymentStatus IN (awaiting_payment, pending_verification)`. |
| `paymentRejectionReason` | enum | **[v2.2 D-05]** `null` \| `image_blurry` \| `wrong_amount` \| `duplicate_order` \| `other` |
| `paymentRejectionDetail` | text | **[v2.2]** Freetext ≥10 chars nếu `paymentRejectionReason='other'`. |
| `paymentVerifiedAt` | timestamp | **[v2.2]** Set khi seller Approve hoặc auto-verify match. |
| `paymentVerifiedBy` | relation → users | **[v2.2]** Audit trail. NULL khi `verificationSource = auto`. |
| `magicLinkSecret` | varchar | **[v2.2]** Per-order JWT signing salt. Rotated khi Reject (invalidate old link). |
| **`verificationSource`** | enum | **[v2.2 D-13]** `manual` (default) \| `auto`. Phân biệt seller manual verify vs Open Banking auto-match. Wave 6 chỉ `manual`. |
| **`autoVerifiedAt`** | timestamp | **[v2.2 D-13]** Pre-build cho Wave 8+. Set khi Open Banking API match reference code. NULL ở Wave 6. |
| **`bankTransactionId`** | varchar | **[v2.2 D-13]** Pre-build cho Wave 8+. External bank transaction reference từ Open Banking API. NULL ở Wave 6. |
| `paymentDetails` | group/json | Legacy field — thumbnail URL + transaction notes. |

### 13.3 **[v2.2]** Schema migration plan (separate issue post-PRD-merge)

- **Migration 1**: enum extension `paymentStatus` add `awaiting_payment`, `pending_verification`
- **Migration 2**: add columns `paymentReference`, `paymentExpiresAt`, `paymentRejectionReason`, `paymentRejectionDetail`, `paymentVerifiedAt`, `paymentVerifiedBy`, `magicLinkSecret`
- **Migration 3**: enum rename `paymentMethod` từ `qr_banking` → `bank_transfer` + data backfill
- **Migration 4** (D-13 Wave 8+ pre-build): add columns `verificationSource` (enum default `manual`), `autoVerifiedAt`, `bankTransactionId`
- All migrations follow `.claude/rules/database-schema.md` — `ALTER TABLE ... IF NOT EXISTS`, no `DROP TABLE`

### 13.3 API Endpoints

```
GET /api/orders?where[site][equals]={id}  → list (tenant-scoped)
PATCH /api/orders/:id                      → update status (order_status hoặc payment_status)
POST /api/orders/:id/cancel                → cancel + inventory restore
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F09 Storefront | ✅ | — |
| Resend (customer emails) | ✅ | Template setup |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Table skeleton
- [ ] Empty State — "No orders yet. Share store link!"
- [ ] Error State — Toast + retry on status update fail
- [ ] Form Validation — Status transitions only valid paths
- [ ] Button States — Update Status loading state
- [ ] Toast Feedback — "Order updated!", "Order cancelled!"
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Cards instead of table
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] F09 Storefront done

---

## 19. Definition of Done

- [ ] All FR implemented
- [ ] All AC pass
- [ ] New order visible < 60s after payment
- [ ] Cancel + inventory restore atomic

---

## 20. EasyParcel Fulfillment & Returns (Wave 7)

### EasyParcel — Fulfillment (Label / Pickup / Tracking)

**Scope:** Real-time label creation with pickup-aware date selection and tracking sync cron. Applies to tenants with `easyParcelIntegration.enabled=true`.

**Stories:** US-F36-06 (label from within order detail), US-F36-07 (cut-off-aware pickup), US-F36-09 (buyer tracking).

**User Flow (shortened):**
```
1. Merchant clicks "Ready to Ship" (EP tenant) → modal: weight (prefilled + editable), dims (W/L/H cm, prefilled from DEFAULT_PARCEL), pickup date (cut-off-aware).
2. POST /api/orders/[id]/create-label → EPSubmitOrderBulk + EPPayOrderBulk (merchant API key, serviceId).
3. OK → trừ ví merchant → lưu awb_no, label_url, easy_parcel_order_no, tracking_number=awb_no; order → ready_to_ship.
4. Cron /api/cron/sync-tracking polls EPParcelStatusBulk q30-60min → updates shipping_tracking_status (display-only, no auto-complete).
5. Buyer xem tracking trên trang đơn (OtShippingCard + timeline).
```

**Functional Requirements:**

| FR | Mô tả | Story |
|---|---|---|
| **C-1** | "Ready to Ship" (EP) → POST /api/orders/[id]/create-label gọi EPSubmitOrderBulk + EPPayOrderBulk; lưu awb_no, label_url, easy_parcel_order_no, tracking_number=awb_no; order → ready_to_ship. KHÔNG màn riêng. | US-F36-06 |
| **C-2** | Idempotent: order đã có awbNo → KHÔNG tạo lần 2 (chống double-charge). | US-F36-06 |
| **C-3** | Ví hết → error `EASYPARCEL_WALLET_LOW` + nạp link; order giữ nguyên; merchant retry được. | US-F36-06 |
| **C-4** | Pickup/dropoff chọn được; `collection_date` passed in EPSubmitOrderBulk. **Cut-off-aware:** min = HÔM NAY nếu T2–T6 & MYT < cut-off; ngược lại min = ngày làm việc kế; disable quá khứ + T7/CN. Default = min. Public holiday để API tự bump. Server validate + clamp lên earliest nếu client drift. | US-F36-07 |
| **C-4b** | Weight (prefill order.parcelWeight, kg, editable, 0.1–50 required); dims W/L/H (cm int, optional to change, prefill DEFAULT_PARCEL, always sent). | US-F36-06 |
| **C-5** | Modal "Ready to Ship": KHÔNG hiển thị courier (đã khoá 1 courier). Fields: weight + dims. Nút disable until weight valid. Non-EP: ShipOrderModal hiện tại (free-text tracking) giữ NGUYÊN. | US-F36-06 |
| **C-7** | GET /api/cron/sync-tracking (cron secret) poll EPParcelStatusBulk batch/tenant → update shippingTrackingStatus (13 enum chuẩn EP). | US-F36-09 |
| **C-8** | Tracking nhúng order detail (buyer = OtShippingCard + timeline + linking tracking URL; merchant = badge). KHÔNG màn riêng. | US-F36-09 |
| **C-8a** | Reuse F14 email hook: "Shipped" đã hỗ trợ trackingUrl (F14 BR-09) → F36 truyền vào email có sẵn; buyer có "Theo dõi" link. | US-F36-09 |
| **C-9** | shipped → completed CHỈ manual (merchant bấm). Cron delivered chỉ update shippingTrackingStatus, KHÔNG auto-complete. | US-F36-09 |

**Acceptance Criteria:**

1. GIVEN order paid/confirmed WHEN merchant "Ready to Ship" (EP) THEN trừ ví, AWB + label PDF, tracking_number=awb_no, order → ready_to_ship.
2. GIVEN order đã có awb_no WHEN tạo label lần 2 THEN blocked (idempotent).
3. GIVEN ví hết WHEN tạo label THEN error `EASYPARCEL_WALLET_LOW` + link nạp; order unchanged.
4. GIVEN order shipped awb_no WHEN cron runs THEN shipping_tracking_status updated; buyer xem được.
5. GIVEN delivered THEN only tracking update; order completed do merchant bấm (manual).

**Order Schema (new columns):**

| Field | Type | Notes |
|---|---|---|
| `awb_no` | varchar | EasyParcel AWB (unique per order, non-null after label). |
| `label_url` | varchar | PDF URL to download label. |
| `easy_parcel_order_no` | varchar | EP internal order ref. |
| `shipping_tracking_status` | varchar | One of 13 EP status enum; display-only, KHÔNG lifecycle. |
| `tracking_number` | varchar | = awb_no (when EP); free-text (when manual). |

---

### EasyParcel — COD (order runtime)

**Scope:** Cash-on-Delivery runtime tracking on order. **Eligibility gating + fee disclosure live in F19-store-configuration (Phase F).**

**Stories:** US-F36-08 (buyer COD choice; merchant label with COD flag).

**COD per-courier reference (source of truth for UI/UX gating + settlement expectation):**

> Read LIVE from `POST /shipment/quotations` endpoint: COD fields = `features[].cod.available`, `min_cod_amount`, `max_cod_amount`, fee (internal response = `codAvailable` + `codMaxSen`). **Do NOT hardcode courier list.** Table below = indicative design baseline; actual COD couriers + min/max limits are live per account and must be read from API (sandbox returned 7 COD-capable; Flash may vary by account). Sandbox-verify per F36 overview §9 item #1. **Decision & handoff:** [decision-260702-1503-GH-1333-cod-handoff.md](../../plans/reports/decision-260702-1503-GH-1333-cod-handoff.md) (GH-1333).

| Courier | COD? | COD fee | COD min–max (collected) | Settlement → merchant | UI/UX note |
|---|---|---|---|---|---|
| **Flash Express** | ✅ | RM5 / 4% (higher) | ~RM5.01 – RM7,000¹ | **T+1–3 days** | ⭐ Recommended default for COD shops: fastest payout, highest cap |
| **DHL eCommerce** | ✅ | RM6 / 4% | read from API | T+1–3 days | Fast payout; cap not public → use `min_cod_amount` + `max_cod_amount` |
| **J&T Express** | ✅ | RM7 / 4% | ~RM7.01 – RM1,000¹ | T+7–12 days | ⚠️ COD cap only RM1,000 (differs from Flash); slower payout; low-value orders |
| **Aramex** | ✅ | RM10 / 4% | read from API | **~T+30 days** | ⚠️ Holds cash ~1 month → warn seller; do NOT default |
| Pos Laju · Ninja Van · City-Link · SkyNet · SPX · Best · Redbox · Teleport · Lalamove | ❌ | — | — | — | No COD path via EasyParcel API |

¹ **Indicative baseline only.** Live limits vary by merchant account; read from `min_cod_amount` + `max_cod_amount` per courier in API response. Sandbox set = 7 COD-capable couriers (Aramex, DHL eCommerce, J&T, Lazada, Pos Malaysia/Melplus, Poslaju, SPX); Flash was NOT returned on the sandbox account — courier availability varies per account.

**Shared COD constraints (per R1–R5 rules):** COD eligibility determined **PER-ROUTE, LIVE from quotation response** — NO hardcoded region block. Courier `cod.available`, `min_cod_amount`, `max_cod_amount` are live signals; region correctness is emergent (unsupported routes return no COD couriers). COD payout prerequisite (seller): eKYC + bank account verification before first withdrawal; manual withdraw on EP dashboard (Pending → To Release → Released); no API/webhook settlement → Prime stores `codStatus` display-only. COD fee deducted from collected cash (merchant nets remainder); failed delivery → sender (merchant) bears return cost.

**Critical Validation Note:** EasyParcel `submit_orders` endpoint does **NOT validate** COD eligibility (accepts under-min, over-max, non-COD couriers, any destination). **Prime enforces all COD validation server-side (R1–R5)** + picker filters non-COD couriers client-side to prevent invalid orders. See [F36 PRD §8](./F36-easyparcel-delivery.md#8-key-api-contract-decisions-v2026-03-spec) for rule details + evidence.

**Consequence:** COD max differs per courier → gating (F19 C-6a) must use per-courier `max_cod_amount` from the `quotations` API response, NOT a shared constant. Source: `plans/reports/researcher-260622-1500-easyparcel-cod-courier-support.md`.

**Runtime Flow (shortened):**
```
1. Buyer chọn COD → order: paymentMethod='cod', codAmount=snapshot grand total (sen), codStatus='pending'.
2. Merchant tạo label cờ cod_enabled=true + cod_amount (RM) → EasyParcel.
3. Courier thu tiền mặt → EasyParcel settle về merchant (T+X per-courier; Flash T+1–3, J&T T+7–12, Aramex ~T+30).
4. Merchant withdraw từ dashboard EP (manual); platform RM0, KHÔNG đụng.
```

**Functional Requirements (runtime only):**

| FR | Mô tả | Story |
|---|---|---|
| **C-6b** | `codAmount` snapshot: = grand total (sen) lúc checkout; KHÔNG recalc sau. Cột MỚI `cod_amount` (number, sen) trên orders (entry `scripts/db-setup.js` MIGRATIONS per NFR-9). | US-F36-08 |
| **C-6c** | `codStatus` field (display-only): pending → collected → settled. Cột scalar `cod_status` varchar (entry MIGRATIONS). KHÔNG API đối soát; merchant tự check dashboard EP. | US-F36-08 |
| **C-6e** | Label COD: send cod_enabled=true + cod_amount (RM) trong EPSubmitOrderBulk. Param name verified in sandbox. | US-F36-08 |
| **C-6f** | `codStatus` (giao vận layer, courier thu + settle) vs `paymentStatus` (order lifecycle, COD = unpaid → paid on Completed). Độc lập: 1 đơn có thể codStatus='collected' mà paymentStatus='unpaid'. F36 THÊM codStatus, KHÔNG ghi đè payment logic. Tenant EP OFF → KHÔNG có codStatus. | US-F36-08 |

**Acceptance Criteria:**

1. GIVEN order COD courier COD-enabled (R3: cod.available=true) total∈[min,max] (R1–R2) WHEN label created THEN cod_enabled=true, cod_amount (RM); codStatus='pending'.
2. GIVEN buyer submits with COD pero isCodEligible=false (R1–R5 violation) WHEN server processes THEN rejects order; hard-gates validation (see F36 PRD §8 + stories AC-4b).
3. GIVEN order COD shipped, buyer refused WHEN cron Returned THEN shipping_tracking_status='Returned'; cod_status='pending' (chưa thu).
4. GIVEN courierStatus='Returned' WHEN merchant Refund THEN F10 /refund reused; goods refunded, inventory restocked; COD không thu.

**Cross-ref:** COD eligibility gating (West MY, per-courier min/max validation) + fee disclosure (informational, merchant-borne) → **F19-store-configuration (Phase F).** Prime hard-gates all COD validation (server) + picker filters non-COD couriers (UI) to compensate for EP's lack of validation.

**Order Schema (new columns):**

| Field | Type | Values | Notes |
|---|---|---|---|
| `cod_amount` | number | sen | Snapshot grand total; KHÔNG null khi paymentMethod='cod'. |
| `cod_status` | varchar | pending \| collected \| settled | Default pending. Display-only. |

---

### EasyParcel — Returns & Cancel

**Scope:** Return logistics (auto-return case + manual buyer-return with fee tracking) + cancel order (pre-label and post-label). Reuses F10 `/refund` and `/cancel` local refund/restock logic after the EasyParcel cancel gate — no new stock/payment logic.

**Stories:** US-F36-10 (courier auto-return), US-F36-11 (cancel), US-F36-12 (manual buyer-return RMA).

**Case A — Courier Auto-Return:**
```
Delivery fails (no-show, COD refusal, undeliverable) → courier auto-returns to sender.
Cron receives shippingTrackingStatus='Returned' → merchant inspects → clicks Refund (F10 endpoint).
→ goods refunded + restock; shipping fee lost (merchant-borne per courier policy).
```

> ⚠️ **OPEN — auto-return status detection (flag + suggest; dev team verify in sandbox & finalize).**
>
> **No webhook. Detection = polling cron `EPParcelStatusBulk` every ~30–60 min → not real-time** (lag ≤ 1 cron cycle). Seller learns while the parcel is on its return leg, NOT only on physical arrival — but bounded by polling lag.
>
> **3 statuses involved in an auto-return** (from EasyParcel's 13 normalized `ship_status` values — EP hides per-courier raw statuses):
> | Status | Role in return | When it appears |
> |---|---|---|
> | `Delivery On Hold` | early warning (temp hold: bad address, missing docs, customs) | optional, before failure |
> | `Exception` | early warning (delivery failed, refusal, bad address) | optional, before return |
> | `Returned` | **definitive** — parcel returning/returned to merchant | triggers Case A banner |
>
> **Limitation:** EP collapses the entire return leg into a SINGLE `Returned` status — no sub-states (`returning-in-transit` vs `returned-to-warehouse`). Exact flip moment (return initiated vs delivered-back) is unconfirmed.
>
> **Suggested solutions (NOT final — for dev to evaluate):**
> 1. **(current)** Fire Case A banner on `Returned` only. Simplest; seller acts on inspection.
> 2. **(suggest)** Surface `Exception` / `Delivery On Hold` as an amber pre-alert so seller reacts earlier than the `Returned` flip.
> 3. **(suggest)** If faster signal needed, shorten cron interval (cost/rate-limit tradeoff — see F36 NFR-5/NFR-6).
> 4. **(verify)** Confirm in sandbox: exact moment `Returned` is set, and whether any intermediate return scans surface, before finalizing UX.
>
> **Source docs (official EasyParcel — verify here):** Developer API hub https://developers.easyparcel.com/ · MY Individual API doc (PDF, contains `EPParcelStatusBulk` + `ship_status`) https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.0.0.0 · Help Centre API folder https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192728 · internal: `plans/reports/researcher-260617-1406-easyparcel-status-mapping.md` (13-status taxonomy).

**Case B — Manual Buyer-Return (RMA):**
```
Buyer contacts merchant out-of-band → merchant approves, records return (free-text tracking code, optional fee/payer).
Buyer ships back via ANY courier (not necessarily EP) → return_status: requested → in_transit → received.
Merchant receives goods → clicks Refund (F10 endpoint) → return_status='refunded'.
Return fee + payer recorded informationally (seller dashboard only, NOT in OrderSummary, NOT in revenue reports).
```

**Cancel by Label State:**
```
No label yet → POST /api/orders/[id]/cancel (F10): full refund (goods + shipping) + restock + discount release + existing email behavior.
Label bought, pre-pickup → POST /api/orders/[id]/cancel (F10): refresh EP tracking, call EP POST /shipment/cancel, then local cancel/restock/refund/email only after EP item success.
Label bought, picked up or later → cancel blocked; merchant must use Refund/Return after return/inspection. Freight lost — courier processing.
```

**Functional Requirements:**

| FR | Mô tả | Story |
|---|---|---|
| **D-1** | **Case A — auto-return:** Cron receives 'Returned' → set shippingTrackingStatus='Returned'. No EP API call. Merchant clicks Refund (F10 /refund) → goods refund + restock; outbound fee lost. | US-F36-10 |
| **D-2** | **Case B — manual return record:** Merchant records return (shipped/completed status) with return_tracking_code (required), return_tracking_url (optional), return_reason (optional), return_fee_payer (buyer\|seller), return_shipping_fee (sen), return_status (requested→in_transit→received). No EP API. | US-F36-12 |
| **D-3** | **Refund + restock reuse F10:** `/api/orders/[id]/refund` and the local cancel path keep existing payment reversal + restock behavior. EasyParcel only gates pre-pickup label cancellation before local cancel runs. | US-F36-10 |
| **D-4** | **Cancel, no label:** POST /api/orders/[id]/cancel (F10): full refund (goods + shipping) + restock + discount release + existing email behavior. | US-F36-11 |
| **D-5** | **Cancel, label bought but pre-pickup:** Backend refreshes EasyParcel tracking first, then calls `POST /shipment/cancel` with `cancel_list[{ shipment_number: easyParcelOrderNo, remark }]`. Only EP item success allows local `/cancel` behavior to continue (full cancel/restock/refund/email). EP item error blocks local cancel. | US-F36-11 |
| **D-5b** | **Cancel, picked up or later:** Cancel order is blocked. Merchant uses Refund/Return after return/inspection; outbound freight is lost. | US-F36-11 |
| **D-6** | **Refund via existing provider:** Refund money Stripe (live), manual (COD/BT), or Xendit (F34). NOT via EasyParcel. | US-F36-11 |
| **D-7** | **Capture return fee + payer (informational):** On Case B, merchant records return_shipping_fee (sen) + return_fee_payer (buyer\|seller). Both nullable. Displayed seller dashboard (return block), NOT in OrderSummary, NOT in revenue (record-only per PM). All 6 return fields seller-only per NFR-10 — NEVER in `/api/orders/track/[orderNumber]`, `/api/orders/stream/[orderNumber]`, or buyer OrderTrackingClient. | US-F36-12 |

**Acceptance Criteria:**

1. GIVEN delivery fails, buyer refuses WHEN cron polls 'Returned' THEN shipping_tracking_status='Returned'; no EP API call; no reverse label; cod_status='pending' (unpaid).
2. GIVEN 'Returned' WHEN merchant Refund THEN F10 /refund called; goods refunded; inventory restocked; outbound freight NOT refunded (lost).
3. GIVEN shipped/completed order WHEN merchant records return (tracking code, fee, payer) THEN all 6 fields persisted; return_status transitions none→requested→in_transit; no EP API; return_fee informational only.
4. GIVEN merchant receives goods (return_status='received') WHEN click Refund THEN F10 /refund executes; return_status='refunded'; inventory restocked.
5. GIVEN no label WHEN cancel THEN /api/orders/[id]/cancel (F10): full refund + restock + discount release + existing email behavior.
6. GIVEN label pre-pickup WHEN cancel THEN backend refreshes EP tracking, calls `POST /shipment/cancel`, and only after EP item success runs local cancel/restock/refund/email.
7. GIVEN label pre-pickup WHEN EP cancel returns item-level error THEN local cancel/restock/refund/email do NOT run; seller sees recoverable error.
8. GIVEN final EP tracking refresh returns `picked_up` or later WHEN cancel THEN cancel is blocked; seller uses Refund/Return; freight is lost.
9. GIVEN return fields populated WHEN buyer endpoint (track, stream, OrderTrackingClient) THEN none of return_status, return_tracking_code, return_tracking_url, return_shipping_fee, return_fee_payer, return_reason appear.

**Order Schema (new columns):**

| Field | Type | Values / Default | Notes |
|---|---|---|---|
| `return_status` | varchar | none (default) → requested → in_transit → received → refunded | State transitions merchant-driven. |
| `return_tracking_code` | varchar | free-text, nullable | Any courier AWB (not EP-validated). |
| `return_tracking_url` | varchar | optional URL, nullable | Deep link to tracking page. |
| `return_shipping_fee` | number | sen, default 0 | Stored for reference; NOT in OrderSummary. |
| `return_fee_payer` | varchar | buyer \| seller, nullable | Who paid return postage. |
| `return_reason` | text | free-text, nullable | Optional reason text. |

**Cross-ref & Reuse:** No new DB field required. Existing `shippingTrackingStatus` drives cancel button disable. `/api/orders/[id]/cancel` owns the pre-pickup EP cancel gate, then reuses existing F10 local cancel behavior. `/api/orders/[id]/refund` remains the Refund/Return path after pickup/return. Tracking cron `/api/cron/sync-tracking` = shared with Phase C fulfillment.

---

## Appendix: Column Mappings (Snake Case for DB)

All new EasyParcel columns use snake_case in database schema (per codebase convention):
- Phase C: `awb_no`, `label_url`, `easy_parcel_order_no`, `shipping_tracking_status`, `tracking_number`
- COD runtime: `cod_amount`, `cod_status`
- Phase D: `return_status`, `return_tracking_code`, `return_tracking_url`, `return_shipping_fee`, `return_fee_payer`, `return_reason`

Each requires an entry in `scripts/db-setup.js` MIGRATIONS array per NFR-9.
