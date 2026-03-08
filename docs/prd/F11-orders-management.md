# PRD: Orders Management (F11)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 4 | **Size:** M  
> **Depends on:** F10 Storefront Commerce ✅, Payload CMS Orders collection ✅

---

## 1. Problem Statement

When customers place orders through the storefront, site owners need a dashboard to view, manage, and update order statuses. Currently the orders page shows a basic table with no status workflow, no detail view, and no filtering.

## 2. User Story

```
AS A site owner receiving orders
I WANT TO view and manage orders from my dashboard
SO THAT I can fulfill orders on time and track revenue
```

## 3. Screen Layout

```
┌─ /dashboard/orders ────────────────────────────────┐
│  Orders                                              │
│                                                      │
│  ┌─ Stats ───────────────────────────────────────┐  │
│  │ Pending: 3  │ Confirmed: 5  │ Shipped: 12     │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Filter ──────────────────────────────────────┐  │
│  │ [All ▼] [Pending ▼] [Date Range] [🔍 Search]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Order#     │ Customer │ Total    │ Status      │  │
│  │ ORD-A1B2C3 │ Aisha    │ RM 156   │ 🟡 Pending  │  │
│  │ ORD-D4E5F6 │ Kumar    │ RM 89    │ 🟢 Confirmed│  │
│  │ ORD-G7H8I9 │ Wei Lin  │ RM 245   │ 📦 Shipped  │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## 4. Acceptance Criteria

### AC-1: Order List
```gherkin
GIVEN user navigates to /dashboard/orders
WHEN  page loads
THEN  stats bar: count by status (Pending, Confirmed, Shipped, Delivered, Cancelled)
AND   table: order#, customer name, total (RM XX.XX), status badge, date
AND   filter by: status, date range, search by order number or customer
AND   empty state: "No orders yet. Share your store link to start selling!"
```

### AC-2: Order Detail
```gherkin
GIVEN user clicks an order row
WHEN  detail drawer/page opens
THEN  shows: order number, customer info, items list, subtotal, SST, total
AND   shipping address (if provided)
AND   status timeline: Pending → Confirmed → Shipped → Delivered
AND   "Update Status" dropdown
```

### AC-3: Update Order Status
```gherkin
GIVEN user changes status from Pending → Confirmed
WHEN  saved
THEN  order.status updated in DB
AND   toast "Order ORD-XXXXX updated to Confirmed"
AND   (future P1: WhatsApp notification to customer)
```

### AC-4: Cancel Order
```gherkin
GIVEN user clicks "Cancel Order"
WHEN  confirmed
THEN  order.status = 'cancelled'
AND   product inventory restored (items returned to stock)
AND   toast "Order cancelled. Inventory restored."
```

## 5. Status Workflow

```
Pending → Confirmed → Shipped → Delivered
    ↓                      ↓
  Cancelled            Cancelled
```

| Status | Badge | Actions Available |
|--------|-------|-------------------|
| Pending | 🟡 Yellow | Confirm, Cancel |
| Confirmed | 🟢 Green | Ship, Cancel |
| Shipped | 📦 Blue | Mark Delivered |
| Delivered | ✅ Grey | — |
| Cancelled | 🔴 Red | — |

## 6. 9-Point Done Checklist

- [ ] Loading State — Table skeleton
- [ ] Empty State — "No orders yet" + share store link
- [ ] Error State — Toast + retry on status update failure
- [ ] Form Validation — Status transitions only in valid order
- [ ] Button States — "Update Status" loading state
- [ ] Toast Feedback — "Order updated!", "Order cancelled!"
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Cards instead of table, detail as full page
- [ ] TypeScript Clean
