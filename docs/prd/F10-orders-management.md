# PRD: Orders Management (F10)
> **Version:** 2.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 5 | **Size:** M
> **Depends on:** F09 Storefront Commerce ✅, Payload CMS Orders collection ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 WhatsApp

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

Dashboard `/orders`: stats bar (by status), table với order list (có search, filter, sort), order detail drawer với status timeline. Hỗ trợ 2 luồng đơn hàng: (1) Manual Flow (COD, QR Banking) cho phép merchant tự chỉnh status; (2) Automated Flow (Stripe) tự chuyển status thông qua API. Tích hợp tính năng Refund, Cancel logic (có lý do & restock), và Bulk Confirm.

---

## 4. Scope

### In Scope
- Giao diện List view: Search, Sort, Filter linh hoạt (US-F10-04)
- 2 luồng trạng thái đơn hàng: Manual (COD, QR Banking) (US-F10-01, US-F10-02)
- Quản lý **Order Status** (Pending, Confirmed, Ready to Ship, Shipped, Completed, Cancelled) tách biệt với **Payment Status** (Unpaid, Paid, Cancelled, Refunded).
- Order detail trực quan với status timeline, cho phép đổi status trên list/detail (US-F10-01)
- Cancel order: Quy định phải có Cancel reason, auto-restock ngoại trừ product bị xoá (US-F10-03)
- Hỗ trợ Refund thủ công khi đơn đang Shipped hoặc Completed (US-F10-01)
- Bulk status update: Thao tác Confirm đồng loạt nhiều đơn Pending (US-F10-01)


### Out of Scope
- WhatsApp Business API (P1 — Wave 7+)
- Đồng bộ webhook tự động từ 3rd Party Logistics API (Phase sau)
- Payment gateway integration (Stripe) (Phase sau - Tạm ẩn)
- Xác nhận thanh toán qua open banking API (Phase sau)

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
| FR-06 | Order Status workflow: Pending → Confirmed → Ready to Ship → Shipped → Completed / Cancelled | US-F10-01 | P0 | Tách biệt với Payment Status |
| FR-07 | Status update → customer notification email auto-sent (áp dụng Confirm, Shipped, Cancelled) | US-F10-01 | P1 | |
| FR-08 | Cancel order: Yêu cầu nhập Cancel Reason & inventory auto-restock | US-F10-03 | P0 | Bỏ qua restock nếu product bị xoá |
| FR-09 | Refund: Chuyển order sang Refund thủ công khi ở trạng thái hợp lệ (Shipped, Completed), tự cập nhật Payment Status -> Refunded | US-F10-01 | P0 | |
| FR-10 | Customer payment flow: COD, QR Banking (Manual). Stripe tạm ẩn. | US-F10-02 | P0 | |
| FR-11 | QR Payment Checkout: Bắt buộc upload ảnh biên lai (<2MB). Trạng thái thanh toán (Payment Status) khởi tạo mặc định là `Paid`. | US-F10-02 | P0 | Lọc file JPG/PNG/PDF. |
| FR-11.1 | Payment Status Sync: Khi đơn hàng được `Cancelled`, `Payment Status` cập nhật thành `Cancelled`. Khi đơn hàng thực hiện thao tác hoàn tiền, `Payment Status` thành `Refunded`. | US-F10-01 | P0 | Đồng bộ state. |
| FR-11.2 | Payment Status Data: Hệ thống hỗ trợ tách bạch Order Status và các Payment Statuses: `Unpaid`, `Paid`, `Cancelled`, `Refunded`. | US-F10-01 | P0 | COD là `Unpaid`. QR là `Paid`. |
| FR-12 | **[Mobile]** Danh sách đơn hàng trên viewport < 768px chuyển đổi từ Bảng (Table) sang dạng Thẻ Card dọc (Stacked Cards). | US-F10-05 | P1 | UX chống cuộn ngang |
| FR-13 | **[Mobile]** Chi tiết đơn hàng mở thành dạng Fullscreen thay vì Drawer, với các nút Action (Update Status, Cancel) sticky ở mép dưới màn hình. | US-F10-05 | P1 | Thumb-friendly |

---

## 8. Business Rules

- **BR-01:** Valid status base transitions: Pending→Confirmed→Ready to Ship→Shipped→Completed.
- **BR-Cancel-01:** Bắt buộc nhập **Lý do huỷ** (Cancel Reason) khi thực hiện Cancel order.
- **BR-Cancel-02:** Với đơn thanh toán kiểu Manual (COD/QR), chỉ cho phép Cancel khi ở trạng thái `Pending` hoặc `Confirmed`. Khi được chuyển sang `Cancelled` thì `Payment Status` cũng tự động được đồng bộ về `Cancelled`.
- **BR-Refund-01:** Chỉ cho phép thực hiện Refund (thủ công) khi đơn đang ở trạng thái `Shipped` (Đang vận chuyển) hoặc `Completed` (Hoàn thành đơn hàng). Lúc này Order Status sẽ tự fallback về Cancelled và `Payment Status` là `Refunded`.
- **BR-Restock-01:** Khi trạng thái Order chuyển sang `Cancelled`, hệ thống tự động cộng lại tồn kho. Bỏ qua logic này nếu sản phẩm đã bị xoá khỏi database.
- **BR-Payment-01 (QR Banking):** Mặc định khi khách đặt hàng và upload thành công biên lai (Payment Proof), hệ thống tự động mark `Payment Status` của họ là `Paid`.
- **BR-Payment-02 (COD):** Khi khách chọn COD, Payment Status khởi tạo bằng `Unpaid`. Admin vẫn tiến hành chuyển trạng thái Order theo luồng giao vận bình thường. Khi Admin update Order Status thành `Completed`, hệ thống **tự động cập nhật** Payment Status thành `Paid`.
- **BR-06:** Order scope theo tenant — không cross-tenant.
- **BR-07:** Inventory reservation released nếu API payment fail sau 30 phút.

---

## 9. User Flow

```
New order placed (Storefront) → Order created 'pending'
  → Merchant notification (toast + email)
  → Customer confirmation email
  ↓
/orders
  Order appears in list
  Click → detail drawer
  Change status: Pending → Confirmed
  → Customer notification (email / WhatsApp P1)
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
  - Search & Filter Bar: Tìm theo Mã Đơn/KH; Lọc theo Ngày/Tháng; Khối thao tác Bulk Action "Confirm x Orders".
  - Data Table: Cột Mã Đơn (Clickable), Tên Khách, Tổng tiền (RM), Status Badge (đổi màu theo state), Loại thanh toán, Thời gian.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Màn hình Chi tiết (Order Detail / Info Drawer)
- **Mô tả:** Màn hình chi tiết của 1 đơn hàng cụ thể, thường được thiết kế dưới dạng Flyout Sidebar trượt từ phải ra (hoặc Page riêng độc lập).
- **Components chính:**
  - Status Timeline (Progress Flow): Biểu đồ các mốc trạng thái từ Pending -> Confirmed -> Shipped... để user theo dõi tiến trình.
  - Nút thao tác Status Actions: [Mark as Shipped], [Cancel Order], [Refund].
  - Customer Block: Tên, SDT, Địa chỉ giao hàng, Địa chỉ email.
  - Payment Detail: Loại hình (COD/QR), Nếu là QR thì hiển thị ảnh receipt do khách upload kèm nút [Mở To Ảnh].
  - Line Items list: Danh sách các SKU khách đặt mua kèm Cân nặng, Giá tiền. Summary khối tính tổng: Subtotal, Shipping fee, SST 6%, Grand Total.
- **Design / Wireframe (Order Detail Drawer):**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Mobile View (Order Cards & Full-page Detail)
- **Mô tả:** Thay vì bảng Data Table khó xem trên mobile, danh sách đơn hàng biến thành các Blocks. Tương tác vuốt (Swipe) thẻ để thực hiện thao tác nhanh. Khi click vào chi tiết, Drawer chuyển thành một màn hình dọc toàn phần (Full-page modal) thay vì Sidebar móp méo bên phải.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.4. Các trạng thái UI (UI States) & Modals
- **Empty State:** Hình xe giao hàng lủi thủi + "Bạn chưa có đơn hàng nào. Hãy chia sẻ link store!".
- **Loading State:** Bảng Table Skeleton lines loading. Nút Update Status show Spinner.
- **Error State / Edge Cases:** Toast đỏ báo lỗi không thể update status.
- **Modals:** Modal Cancel Order buộc nhập Text Reason. Modal Image Viewer (khi click vào ảnh receipt QR Payment Proof).

---


## 11. Acceptance Criteria

> AC được copy từ `F10-orders-stories.md`. Không tự thêm AC không có trong story.

### AC-1: New Order Notification
> 📌 Source: [US-F10-01](../stories/F10-orders-stories.md) — AC-1

```gherkin
GIVEN a new order is placed on my storefront
WHEN  the payment is confirmed (QR/COD)
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

### AC-4: Checkout with QR Banking (Proof Upload)
> 📌 Source: [US-F10-02](../stories/F10-orders-stories.md) — AC-3

```gherkin
GIVEN I am at the checkout page
WHEN  I select "QR Banking" as my payment method
THEN  the system displays the Merchant's QR Code image
  AND the "Proceed/Confirm Order" button is disabled until I upload a Payment Proof Image
  AND upon success, order `paymentStatus` is set to `Paid`
  AND if I upload an image > 2MB or invalid format, an error is shown
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
| `OrdersPage` | `app/(dashboard)/orders/page.tsx` | List + stats |
| `OrderDetailDrawer` | `components/dashboard/OrderDetailDrawer.tsx` | Detail + status |
| `StatusTimeline` | `components/dashboard/StatusTimeline.tsx` | Progress steps |

### 13.2 Data Models & Structure
Order Collection (Payload CMS) cần lưu rõ các Fields:
- `orderStatus`: `pending` | `confirmed` | `ready_to_ship` | `shipped` | `completed` | `cancelled`
- `paymentMethod`: `cod` | `qr_banking`
- `paymentStatus`: `unpaid` | `paid` | `cancelled` | `refunded`
- `paymentDetails`: Group field (hoặc JSON object) chứa `proofThumbnailUrl` và transaction info liên quan.

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
