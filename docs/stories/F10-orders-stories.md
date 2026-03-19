# User Stories: Orders Management (F10)

> **Feature:** F10 — Orders Management
> **Wave:** 5 | **Priority:** P0 | **Ref PRD:** [F10-orders-management.md](../prd/F10-orders-management.md)

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## US-F10-01: Order Management & Status Updates

**Wave 5** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner
I want view incoming orders và cập nhật trạng thái
So that tôi quản lý fulfilment hiệu quả từ một dashboard duy nhất
```

### Acceptance Criteria

#### AC-1: Happy Path — New Order Notification

```gherkin
GIVEN a new order is placed on my storefront
WHEN  the payment is confirmed (QR Banking/COD)
THEN  the order appears in my Orders dashboard within 60 seconds
  AND I receive a notification (in-app toast + email to merchant)
  AND customer receives order confirmation email via Resend
```

#### AC-1.1: View Order List Empty State (Shared Component)

```gherkin
GIVEN I have no incoming orders
WHEN  I view the Orders dashboard
THEN  I see the shared "No Data" Empty State component
  AND it displays an illustration and a message "Chưa có đơn hàng nào"
```

#### AC-1.2: View QR Payment Proof

```gherkin
GIVEN I am viewing an Order Detail
WHEN  the order was paid via QR Banking
THEN  I can see the uploaded Payment Proof image
  AND I can click on the image to view it in full size (lightbox) without breaking the layout
```

#### AC-Bulk-Confirm: Merchant Bulk Confirms Orders

```gherkin
GIVEN I am on the Orders list view
WHEN  I select multiple orders in "Pending" status and apply "Confirm Orders" bulk action
THEN  all selected orders are updated to "Confirmed"
  AND the system sends confirmation emails per order if configured
```

### Additional Criteria

- [ ] Order statuses chuẩn hoá: Pending → Confirmed → Ready to Ship → Shipped → Completed (có nhánh Cancelled / Refunded).
- [ ] Customer email confirmation được gửi ra tự động khi status là Confirmed, Shipped, Cancelled.
- [ ] Khả năng xử lý Refund thủ công khi đơn hàng ở trạng thái Shipped hoặc Completed.
- [ ] Có thể thay đổi trạng thái đơn hàng (đơn manual) từ cả List page và Details view.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Order notification < 60 giây sau payment / sau checkout COD
- [ ] Đủ các order statuses

---

## US-F10-02: Customer Checkout

**Wave 5** | **P0** | **L** | **Status:** Ready

### Story

```
As a   customer shopping at a PrimeWeb store
I want checkout bằng phương thức thanh toán khả dụng (COD, QR Banking)
So that tôi thanh toán dễ dàng và hoàn tất đơn hàng
```

### Acceptance Criteria

#### AC-1: Happy Path — Payment Flow (COD / QR Banking)

```gherkin
GIVEN I have items in my cart and proceed to checkout
WHEN  I select COD or QR Banking and complete the checkout form
THEN  my order is created successfully
  AND I am redirected to /order/{id}/confirm showing order summary
```

#### AC-2: Checkout Error Handling

```gherkin
GIVEN I am at the checkout page
WHEN  the order creation fails (e.g., product out of stock)
THEN  an error toast is displayed
  AND cart preserved so I can retry
```

#### AC-3: Checkout with QR Banking (Proof Upload)

```gherkin
GIVEN I am at the checkout page
WHEN  I select "QR Banking" as my payment method
THEN  the system displays the Merchant's QR Code image
  AND the "Proceed/Confirm Order" button is disabled until I upload a Payment Proof Image
  AND if I upload an image > 2MB or invalid format, an error is shown
```

### Additional Criteria

- [ ] Checkout fully functional on mobile 375px without horizontal scroll
- [ ] Guest checkout allowed — email address required for order confirmation
- [ ] Order summary page shows: items, delivery address, payment method, estimated delivery date

### Market Notes

- Payment via COD and QR Banking. Stripe/FPX/GrabPay in a later phase.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] QR Proof upload block/validate correct file formats
- [ ] Mobile 375px tested

---

## US-F10-03: Order Cancellation & Inventory Restock

**Wave 5** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want to cancel an order and automatically restock inventory
So that I can effectively manage false orders or returns without messing up my product stock
```

### Acceptance Criteria

#### AC-1: Cancel Order with Reason

```gherkin
GIVEN I am viewing a COD/QR order in "Pending" or "Confirmed" status
WHEN  I change the status to "Cancelled"
THEN  the system prompts me to enter a "Cancel Reason"
  AND upon submission, the status is updated to Cancelled
  AND the system auto-sends a cancellation email to the customer
```

#### AC-2: Auto Inventory Restock

```gherkin
GIVEN an order contains 2 items of Product A
WHEN  the order is marked as "Cancelled"
THEN  the system automatically increases the inventory of Product A by 2
  AND if Product A has already been deleted from the database, the restock is safely skipped without errors
```

### Additional Criteria

- [ ] Manual orders (COD/QR) có thể bị huỷ khi ở trạng thái `Pending` hoặc `Confirmed`.

---

## US-F10-04: Order List Advanced Sorting & Filtering

**Wave 5** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want to search, filter, and sort my list of orders
So that I can quickly find specific transactions, such as filtering only COD orders or searching for a customer
```

### Acceptance Criteria

#### AC-1: Search and Filter

```gherkin
GIVEN I am on the Orders list view
WHEN  I type an Order ID or Customer Name into the search bar
  AND I select "COD" in the payment method filter
THEN  the list re-renders to match the criteria
```

#### AC-2: Flexible Sorting

```gherkin
GIVEN I am on the Orders list view
WHEN  I click on the sorting dropdown
THEN  I can sort orders by Date (Newest/Oldest), Total amount (High/Low)
```

---

## US-F10-05: Mobile Web UX — Order Management on the Go

**Wave 5** | **P1** | **M** | **Status:** Ready

### Story

```
As a   mobile user (Store Owner)
I want the complex Orders table and detail drawer to be optimized for my phone
So that I can quickly check new orders and update fulfillment status anywhere
```

### Acceptance Criteria

#### AC-1: List to Cards Transformation

```gherkin
GIVEN the user is on the /orders view on a mobile device (< 768px)
WHEN  the order list renders
THEN  it does NOT use a scrollable horizontal table
  AND instead renders each order as a stacked Card (Order #, Status, Customer, Total)
```

#### AC-2: Full-Screen Detail View

```gherkin
GIVEN the user taps an order card on mobile
WHEN  the Order Detail opens
THEN  it transforms from a side-drawer into a Full-Screen View
  AND the Status Action buttons (Confirm, Ship, Cancel) are pinned as a Sticky Bottom Bar for easy thumb access
```

### Definition of Done

- [ ] 9-Point Checklist pass.
