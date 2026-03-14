# Architecture: Orders Management (F11)

> **Version:** 1.0 | **PRD:** [F11-orders-management.md](../prd/F11-orders-management.md)  
> **Tech:** Payload CMS 3 + Stripe Webhooks + Resend Email

---

## 1. Order Lifecycle

```
Customer adds to cart → Checkout → Stripe Payment
                                       ↓
                              Stripe Webhook: payment_intent.succeeded
                                       ↓
                              Create Order in Payload CMS
                              Status: NEW
                              Decrement inventory
                              Send email to merchant (Resend)
                              Send confirmation to customer (Resend)
                                       ↓
              ┌────────────────────────────────────────┐
              ↓                ↓              ↓        ↓
          PROCESSING      SHIPPED      DELIVERED    COMPLETED
              │                               │
              └──────── CANCELLED ────────────┘
                              │
                          REFUNDED
```

## 2. Data Model

```typescript
// collections/Orders.ts
const Orders: CollectionConfig = {
  slug: 'orders',
  fields: [
    { name: 'orderNumber', type: 'text', unique: true },  // AUTO: #ECH-001
    { name: 'customer', type: 'group', fields: [
      { name: 'name', type: 'text' },
      { name: 'email', type: 'email' },
      { name: 'phone', type: 'text' },
    ]},
    { name: 'items', type: 'array', fields: [
      { name: 'product', type: 'relationship', relationTo: 'products' },
      { name: 'quantity', type: 'number' },
      { name: 'price', type: 'number' },
      { name: 'variant', type: 'text' },
    ]},
    { name: 'delivery', type: 'group', fields: [
      { name: 'address', type: 'textarea' },
      { name: 'postcode', type: 'text' },
      { name: 'state', type: 'text' },
      { name: 'fee', type: 'number' },
      { name: 'trackingNumber', type: 'text' },
    ]},
    { name: 'payment', type: 'group', fields: [
      { name: 'method', type: 'select', options: ['stripe', 'fpx', 'grabpay'] },
      { name: 'stripePaymentId', type: 'text' },
      { name: 'amount', type: 'number' },
      { name: 'currency', type: 'text', defaultValue: 'MYR' },
    ]},
    { name: 'status', type: 'select', options: [
      'new', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
    ]},
    { name: 'site', type: 'relationship', relationTo: 'sites', required: true },
  ],
}
```

## 3. Component Tree

```
OrdersPage (/dashboard/orders)
├── OrderStats (New: 3 | Processing: 5 | Shipped: 12)
├── OrderFilters (status, date range, payment method)
├── OrdersTable
│   ├── OrderRow × N
│   │   ├── OrderNumber + Date
│   │   ├── Customer name
│   │   ├── Total amount
│   │   ├── Status badge (color-coded)
│   │   └── Quick actions (View, Update status)
│   └── BulkActions (Update status for selected)
└── OrderDetailDrawer (slide-over)
    ├── CustomerInfo
    ├── OrderItems list
    ├── DeliveryInfo + tracking
    ├── PaymentInfo
    └── StatusUpdater (dropdown + confirm)
```

## 4. Webhook Flow (Stripe)

```
POST /api/webhooks/stripe
  ↓
Verify Stripe signature
  ↓
event.type === 'payment_intent.succeeded'
  ↓
Find pending order by stripePaymentId
  ↓
Update status: pending → new
Decrement product stock
  ↓
Send emails via Resend:
  - To merchant: "New order #ECH-001!"
  - To customer: "Order confirmed"
```

## 5. Error Matrix

| Error | Action |
|-------|--------|
| Webhook signature invalid | 400 response, log to Sentry |
| Product out of stock during checkout | Show "Out of stock" before payment |
| Email send failure | Retry 3x via queue, log failure |
| Status update conflict | Optimistic lock via updatedAt check |
