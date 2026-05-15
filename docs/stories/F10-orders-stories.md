# User Stories: Orders Management (F10)

> **Feature:** F10 — Orders Management
> **Wave:** 5 (base) · Wave 6 (US-F10-06, US-F10-07 — Manual Payment Verification per PD-018) | **Priority:** P0 | **Ref PRD:** [F10-orders-management.md](../prd/F10-orders-management.md)
> **Updated:** 2026-05-15
> **Decisions:** [PD-018](../decisions/decisions-log.md#pd-018--manual-payment-bank-transfer-verification-flow) · Issue [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004)

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
WHEN  the order is created (COD => paymentStatus 'unpaid', Bank Transfer => 'awaiting_payment')
THEN  the order appears in my Orders dashboard within 60 seconds
  AND I receive a notification (in-app toast + email to merchant)
  AND customer receives order confirmation email via Resend
  AND if Bank Transfer, customer email includes a magic link to Post-Order Upload page
```

#### AC-1.1: View Order List Empty State (Shared Component)

```gherkin
GIVEN I have no incoming orders
WHEN  I view the Orders dashboard
THEN  I see the shared "No Data" Empty State component
  AND it displays an illustration and a message "Chưa có đơn hàng nào"
```

#### AC-1.2: View Bank Transfer Payment Proof

```gherkin
GIVEN I am viewing an Order Detail of an order paid via Bank Transfer
WHEN  the `paymentMethod` is `bank_transfer` AND paymentProofImage is uploaded
THEN  I can see the uploaded Payment Proof image (large preview)
  AND I can click on the image to view it in full size (Full-Screen Proof Viewer)
  AND I can see the auto-generated paymentReference (BT-XXXXXX) for bank reconciliation
```

#### AC-Bulk-Confirm: Merchant Bulk Confirms Orders

```gherkin
GIVEN I am on the Orders list view
WHEN  I select multiple orders in "Pending" status and apply "Confirm Orders" bulk action
THEN  all selected orders are updated to "Confirmed"
  AND the system sends confirmation emails per order if configured
```

### Additional Criteria

- [ ] Order statuses chuẩn hoá (`orderStatus`): Pending → Confirmed → Ready to Ship → Shipped → Completed (có nhánh Cancelled / Refunded).
- [ ] **[v2.2]** Payment statuses chuẩn hoá (`paymentStatus`): `Unpaid`, `Awaiting_Payment`, `Pending_Verification`, `Paid`, `Cancelled`, `Refunded`. COD khởi tạo `Unpaid`, Bank Transfer khởi tạo `Awaiting_Payment`.
- [ ] COD Workflow: Khi merchant update `orderStatus` lên `Completed`, hệ thống tự động mark `paymentStatus` thành `Paid`.
- [ ] **[v2.2]** Bank Transfer Workflow: `Awaiting_Payment` → buyer upload → `Pending_Verification` → seller Approve → `Paid` (orderStatus auto-promote `pending` → `confirmed`). Seller Reject → revert `Awaiting_Payment`.
- [ ] Cancel/Refund Workflow: Khi order bị `Cancelled`, `paymentStatus` thành `Cancelled`. Khi order bị manual Refund, `paymentStatus` đổi thành `Refunded`.
- [ ] Customer email confirmation được gửi ra tự động khi status là Confirmed, Shipped, Cancelled. **[v2.2]** Bonus: Bank Transfer Approve/Reject email.
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
I want checkout bằng phương thức thanh toán khả dụng (COD, Bank Transfer)
So that tôi thanh toán dễ dàng và hoàn tất đơn hàng
```

### Acceptance Criteria

#### AC-1: Happy Path — Payment Flow (COD)

```gherkin
GIVEN I have items in my cart and proceed to checkout
WHEN  I select COD and complete the checkout form
THEN  my order is created successfully with paymentStatus = 'unpaid'
  AND I am redirected to /sites/[slug]/orders/[id]?token=<JWT> showing order summary
  AND I receive a COD confirmation email
```

#### AC-2: Checkout Error Handling

```gherkin
GIVEN I am at the checkout page
WHEN  the order creation fails (e.g., product out of stock)
THEN  an error toast is displayed
  AND cart preserved so I can retry
```

#### AC-3: Checkout with Bank Transfer (v2.2 — 3-step async)

```gherkin
GIVEN I am at the checkout page
  AND tenant has Bank Transfer enabled with valid QR + bank details (F19 REQ-08.1, REQ-08.2)
WHEN  I select "Bank Transfer" and complete the checkout form
THEN  my order is created with paymentStatus = 'awaiting_payment'
  AND paymentReference is auto-generated (BT-XXXXXX)
  AND paymentExpiresAt = createdAt + 24h
  AND stock is reserved (NOT decremented)
  AND I receive a confirmation email with magic link to Post-Order Upload page
  AND I am redirected to /sites/[slug]/orders/[id]?token=<JWT> (Post-Order Upload page)
  AND NO upload happens at checkout (D-04 PD-018)
```

### Additional Criteria

- [ ] Checkout fully functional on mobile 375px without horizontal scroll
- [ ] Guest checkout allowed — email address required for order confirmation
- [ ] Order summary page shows: items, delivery address, payment method, estimated delivery date
- [ ] **[v2.2]** Bank Transfer post-order upload flow tested end-to-end via magic link

### Market Notes

- Payment via COD and Bank Transfer (manual). Stripe Card/FPX qua F13 (Wave 6).
- **[v2.2]** Bank Transfer drops fast-path upload-at-checkout per D-04 PD-018.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Bank Transfer 3-step flow upload validates file formats (≤2MB, JPG/PNG/PDF)
- [ ] Mobile 375px tested
- [ ] Magic link JWT signed token expiry tested

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

---

## US-F10-06: Seller verifies Manual Payment proof (Approve / Reject)

**Wave 6** | **P0** | **M** | **Status:** Draft (v2.2 — PD-018)

### Story

```
As a   store owner receiving Bank Transfer orders
I want to verify each payment proof and decide Approve or Reject (with reason)
So that I prevent fake order fraud and keep my inventory accurate
```

### Acceptance Criteria

#### AC-1: Approve Bank Transfer payment

```gherkin
GIVEN I open an order with paymentStatus = 'pending_verification'
  AND I see the Manual Payment Verification Block with large proof preview + paymentReference
WHEN  I click "Approve"
THEN  paymentStatus transitions to 'paid'
  AND paymentVerifiedAt = now, paymentVerifiedBy = currentUserId
  AND orderStatus auto-promotes 'pending' → 'confirmed'
  AND stock is committed (decrement)
  AND buyer receives "Payment Confirmed" email
```

#### AC-2: Reject Bank Transfer payment with reason

```gherkin
GIVEN I open an order with paymentStatus = 'pending_verification'
WHEN  I click "Reject"
THEN  a modal asks me to select a reason from enum:
        [Ảnh mờ | Sai số tiền | Trùng đơn | Khác]
  AND if I select "Khác", a freetext field is required (>=10 chars)
WHEN  I submit the reject form
THEN  paymentRejectionReason + paymentRejectionDetail are saved
  AND paymentStatus reverts to 'awaiting_payment'
  AND paymentExpiresAt extends 24h from rejection moment
  AND magicLinkSecret rotates (old link invalidated)
  AND buyer receives "Payment Rejected: <reason>" email with new magic link
  AND buyer can re-upload (kháng cáo)
```

#### AC-3: Awaiting Verification quick-filter

```gherkin
GIVEN I am on the Orders dashboard
WHEN  I click the "Awaiting Verification" filter chip (with count badge)
THEN  the list filters to orders where paymentStatus = 'pending_verification'
  AND the chip is visually distinct (orange/amber)
```

#### AC-4: Audit trail visible

```gherkin
GIVEN an order has paymentStatus = 'paid' via manual verification
WHEN  I view the order detail
THEN  I can see paymentVerifiedAt timestamp and paymentVerifiedBy user
  AND the Manual Payment Verification Block shows historic rejection reasons (if any)
```

### Additional Criteria

- [ ] Approve action requires no extra confirmation modal (1-click decision per D-05 vs Reject which is destructive)
- [ ] Reject reason enum dropdown is single-select (not multi)
- [ ] Bulk Approve defer per D-14 (not in scope v2.2)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Email templates ("Payment Confirmed", "Payment Rejected") wired via send.ts
- [ ] Magic link rotation on Reject verified

---

## US-F10-07: Buyer uploads payment proof post-order via Magic Link

**Wave 6** | **P0** | **M** | **Status:** Draft (v2.2 — PD-018)

### Story

```
As a   buyer who placed a Bank Transfer order
I want to upload my payment receipt anytime within 24h via a link in my email
So that I don't have to upload it at the cramped checkout step and I can pay first then upload
```

### Acceptance Criteria

#### AC-1: Upload proof via magic link (happy path)

```gherkin
GIVEN I have received the order confirmation email with magic link
  AND the order is in paymentStatus 'awaiting_payment'
  AND paymentExpiresAt is in the future
WHEN  I click the magic link → land on /sites/[slug]/orders/[id]?token=<JWT>
  AND I upload a proof image (<=2MB, JPG/PNG/PDF)
THEN  paymentStatus transitions to 'pending_verification'
  AND seller receives notification (toast + email)
  AND I see "Awaiting Seller Verification" headline with expected timeline (1-12h)
  AND I CAN re-upload (replace) before seller decision (FR-18 D-03)
```

#### AC-2: View payment instructions on upload page

```gherkin
GIVEN I open my magic link
WHEN  paymentStatus = 'awaiting_payment'
THEN  the page shows:
  - Order summary (orderNumber, total, expiry countdown)
  - Merchant QR image (DuitNow) - large
  - Bank account details (bankName, bankAccountNumber, bankAccountHolderName) from F19
  - Reference Code BT-XXXXXX with copy button
  - Instruction: "Vui lòng nhập BT-XXXXXX vào ghi chú khi chuyển khoản"
  - Upload Receipt button (large CTA)
```

#### AC-3: Auto-cancel on TTL expiry

```gherkin
GIVEN my Bank Transfer order has paymentStatus IN ('awaiting_payment','pending_verification')
  AND paymentExpiresAt < now
WHEN  the background job runs (cadence <=15 minutes)
THEN  orderStatus is set to 'cancelled'
  AND paymentStatus is set to 'cancelled'
  AND reserved stock is restored
  AND I receive an "Order Expired" email
```

#### AC-4: Magic link expired or invalid token

```gherkin
GIVEN I have a magic link with an expired or tampered JWT token
WHEN  I open the link
THEN  the page shows "Order expired" or "Invalid link" error state
  AND a CTA to contact the seller or create a new order is displayed
  AND NO upload action is possible
```

#### AC-5: Re-upload after Reject (kháng cáo)

```gherkin
GIVEN seller has Rejected my proof with a reason
  AND I receive "Payment Rejected" email with NEW magic link
WHEN  I open the new magic link
THEN  paymentStatus = 'awaiting_payment' again
  AND the page shows the rejection reason as context
  AND I can upload a corrected proof
  AND old magic link is invalidated (rotated magicLinkSecret)
```

### Additional Criteria

- [ ] Page route is `/sites/[slug]/orders/[id]?token=<JWT>` per D-10
- [ ] Token expiry = paymentExpiresAt per BR-Payment-05
- [ ] Email confirmation fires immediately after Place Order per D-07 (fire-and-forget)
- [ ] Email template unified for COD + Bank Transfer (template variant by paymentMethod) per D-09
- [ ] Mobile 375px tested

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] JWT signing/verification utility tested (`src/lib/auth/order-token.ts`)
- [ ] Background expiry job runs in staging (cadence ≤15 min)
- [ ] Email magic link rendered correctly in major clients (Gmail, Outlook, Apple Mail)


