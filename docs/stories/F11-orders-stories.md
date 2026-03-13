# User Stories: Orders Management (F11)

> **Feature:** F11 — Orders Management  
> **PRD:** [F11-orders-management.md](../prd/F11-orders-management.md)  
> **Source:** Adapted from ECH Webstore v2 PRD (US-012→US-013)

---

## US-012 — Order Management & Status Updates

**As a** store owner  
**I want to** view incoming orders and update their status  
**So that** I can manage my fulfilment efficiently from a single dashboard

### Acceptance Criteria

**AC-1: New Order Notification**
```gherkin
GIVEN a new order is placed on my storefront
WHEN  the payment is confirmed (Stripe webhook)
THEN  the order appears in my Orders dashboard within 60 seconds
  AND I receive a notification (in-app toast + email to merchant)
  AND customer receives order confirmation email via Resend
```

### Additional Criteria

- [ ] Order statuses: New → Processing → Shipped → Delivered → Completed / Cancelled / Refunded
- [ ] Each status change sends an automatic customer notification email
- [ ] Order list is filterable by: status, date range, payment method
- [ ] Inventory is automatically decremented when order is placed (reserved) and confirmed on payment
- [ ] Bulk status update: select multiple orders → update to "Processing" in one action

---

## US-013 — Customer Checkout with Stripe

**As a** customer shopping at a PrimeWeb store  
**I want to** check out using card payment (Stripe)  
**So that** I can pay easily and securely

### Acceptance Criteria

**AC-1: Payment Flow**
```gherkin
GIVEN I have items in my cart and proceed to checkout
WHEN  I enter my card details via Stripe Checkout
THEN  payment is processed
  AND I am redirected to /order/{id}/confirm showing order summary
```

**AC-2: Payment Failure**
```gherkin
GIVEN payment fails or times out
WHEN  the session expires
THEN  the order status is set to PAYMENT_FAILED
  AND cart is preserved so customer can retry
  AND inventory reservation is released after 30 minutes
```

### Additional Criteria

- [ ] Checkout is fully functional on mobile 375px without horizontal scroll
- [ ] Guest checkout is allowed — email address required for order confirmation
- [ ] Order summary page shows: items, delivery address, payment method, estimated delivery date

> **Tech note:** Payment via Stripe (PD-010). FPX/GrabPay via Stripe Malaysia in P1.
