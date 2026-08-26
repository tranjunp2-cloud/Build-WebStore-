# F13 Payment Gateway — Architecture

> **Feature:** F13 — Payment Gateway (Malaysia, Wave 6–6.5)
> **Version:** 2.1 | **Updated:** 2026-06-04 | **Owner:** Backend Dev + docs-manager
> **Links:**
> - PRD: [`docs/prd/F13-payment-gateway.md`](../prd/F13-payment-gateway.md)
> - Design: [`docs/design/F13-payment-gateway-design.md`](../design/F13-payment-gateway-design.md)
> - Stories: [`docs/stories/F13-payment-gateway-stories.md`](../stories/F13-payment-gateway-stories.md)
> - QA: [`docs/qa/F13-payment-gateway.md`](../qa/F13-payment-gateway.md)
> - Plan (Wave 6.5 Hardening): [`plans/260527-1410-f13-stripe-flow-hardening/`](../../plans/260527-1410-f13-stripe-flow-hardening/)

---

## 1. Overview

**Architecture:** Stripe Checkout Session HOSTED + Stripe Connect Standard accounts + Direct Charges model.

- Buyer redirect ra `checkout.stripe.com/...` — Stripe-hosted page handle Card/FPX/3D Secure
- Payment vào account merchant (`tenant.stripeAccountId`) qua Direct Charge
- **Wave 6: Zero application_fee** (cross-border limitation: US platform → MY seller prohibits fee on Stripe side)
- **Wave 7+: Revisit 3% platform fee** when destination charges or same-country model available
- Webhook `checkout.session.completed` → order `status='new'` **AND** `paymentStatus='paid'` atomically (v2.0 correction)
- Confirm page polling + cron reconcile for late webhooks (v2.0 addition)

**Decision reference:** Design §8.6 — Checkout Session vs Payment Element → chốt Checkout Session vì code đã implement + KISS.

---

## 2. Data Flow

### 2.1. Buyer checkout (happy path) — Wave 6

```
Buyer (Storefront)
  ↓ Click "Place Order" (Wave 6.5 terminology)
Client POST /api/orders/stripe-checkout
  ├── Cart state: clear cart on API success (before redirect) per BR-04
  ├── Payload: { items, siteId, email, ... }
Backend
  ├── Validate tenant.payment_card OR tenant.payment_fpx (FR-15)
  ├── buildPaymentMethodTypes(tenant) → ['card'] | ['fpx'] | ['card','fpx']
  ├── **[GH-1099]** Check stock + DECREMENT atomically via CAS (prevent-upfront)
  │   ├── UPDATE products SET inventory = inventory - qty
  │   │   WHERE id=? AND inventory >= qty (atomic per-product; WHERE guard makes GREATEST unnecessary)
  │   ├── IF inventory < qty → reject 422 OUT_OF_STOCK, order not created, cart preserved
  │   └── IF inventory >= qty → order created, proceed to Stripe (oversell impossible)
  ├── Create order status='pending'
  ├── createStripeCheckoutSession({
  │     paymentMethodTypes,
  │     stripeAccountId: tenant.stripeAccountId,
  │     // Wave 6: NO application_fee (fee=0)
  │     // Wave 7+: add applicationFeePercent: 3 when cross-border lifted
  │     successUrl, cancelUrl,
  │   })
  ├── Save stripeSessionId on order
  └── Fire orderConfirmationEmail (event='placed', paymentMethod='stripe') fire-and-forget
  ↓ Stripe API (Direct Charge on connected account)
Stripe creates Session
  ↓ Returns { sessionId, url }
Backend returns { url } to client
  ↓ Client: window.location.href = url (cart already cleared client-side)
Stripe Checkout (hosted page)
  ├── Card flow: input card → submit → 3D Secure → return success_url
  └── FPX flow: select bank → redirect bank login → authorize → return success_url

Success path:
  Stripe → success_url → /sites/[slug]/order/[id]/confirm
  ├── Frontend: SSE /api/orders/stream/[orderNumber] subscribes to paymentStatus push
  ├── Optional: POST /api/orders/[id]/payment-status on mount for active-reconcile backup
  ├── Webhook checkout.session.completed → backend reconcileOrderPaid()
  │     (atomic: status='new', paymentStatus='paid', send emails, notifications)
  └── SSE/polling push paymentStatus='paid' → frontend shows success, clearCart() idempotent

Cancel/Back path:
  Stripe → cancel_url → /sites/[slug]/checkout?stripe_cancelled=1
  ├── Browser-back detection also redirects to /order/[id]/confirm?cancelled=1
  ├── Frontend → show Payment Failed state + "Pay Now" CTA
  ├── Order status stays 'pending', paymentStatus='awaiting_payment'
  └── Click "Pay Now" → POST /api/orders/[id]/retry-payment → new Stripe session
```

### 2.2. Seller onboarding

```
Seller (Dashboard > Settings > Payments)
  ↓ Click "Connect Stripe →" (toggles Disabled+Lock state)
Client POST /api/stripe/connect/onboard { tenantId }
  ↓ withAuth (verify tenant ownership)
Backend
  ├── IF tenant.stripeAccountId exists → createAccountLink (retry/refresh)
  └── ELSE → createConnectedAccount(email, businessName, country='MY')
        ↓ Stripe API
        Account created (type='standard')
        ├── Save tenant.stripeAccountId + stripeOnboardingComplete=false
        └── createAccountLink (type='account_onboarding')
              ↓ Stripe API
              Returns accountLinkUrl (Stripe-hosted KYC)
Backend returns { onboardingUrl } to client
  ↓ Client: window.location.href = onboardingUrl
Stripe KYC (hosted)
  ↓ Seller complete KYC (NRIC, bank, business info)
Return paths:
  ├── Success: redirect /dashboard/settings/payments?stripe=complete
  │     Frontend handler:
  │       - GET /api/stripe/connect/status?tenantId
  │       - IF chargesEnabled=true → toast success + toggles unlock
  │       - IF chargesEnabled=false → toast "KYC pending"
  │       - router.replace strip query
  └── Refresh/Abandon: redirect /dashboard/settings/payments?stripe=refresh
        Frontend handler: toast warning + retry CTA visible
```

### 2.3. Webhook event processing (v2.0 rewrite)

```
Stripe webhook → POST /api/webhooks/stripe
  ↓ headers: stripe-signature
Backend
  ├── verifyStripeWebhook(body, signature, isConnectWebhook?)
  │     ↓ Uses STRIPE_WEBHOOK_SECRET hoặc STRIPE_CONNECT_WEBHOOK_SECRET
  │     ↓ Stripe SDK validates signature + timestamp (≤ 5 min)
  ├── normalizeStripeEvent(event)
  │     ↓ typeMap:
  │       checkout.session.completed → 'payment_success'
  │       payment_intent.payment_failed → 'payment_failed'
  │       account.updated → 'account_updated'
  │       account.application.deauthorized → 'account_deauthorized'
  │       subscription.updated → 'subscription_updated'
  └── Process event:
        ├── payment_success → reconcileOrderPaid() [see §2.4]
        │   (IDOR check, atomic status+paymentStatus, stock decrement+oversell, emails, notifications)
        ├── payment_failed → find order, set paymentStatus='payment_failed', notify merchant
        ├── account.deauthorized → find tenant, lock stripeOnboardingComplete=false, toggle disable
        ├── account_updated → sync tenant.stripeOnboardingComplete ← account.charges_enabled
        ├── subscription.updated → placeholder (Wave 7+)
        └── Other events (charge.refunded, etc) → graceful skip, log info, return 200
```

### 2.4. Reconcile Shared Artifact (v2.0 — single source of truth)

**File:** `src/lib/payment/reconcile-order.ts`

Called by: webhook (§2.3), Confirm polling (§2.5), cron (§2.7). Atomic operation:

```
reconcileOrderPaid(payload, orderId, context='webhook'|'poll'|'cron'):
  ├── IDOR guard: verify connected account owns order's tenant (fail-closed)
  ├── Atomic transition: UPDATE orders SET status='new', payment_status='paid'
  │   WHERE id=? AND status='pending' [only first wins]
  ├── **[GH-1099]** NO stock decrement here — already done at checkout (prevent-upfront)
  │   └── Webhook/polling/cron reconcile operates on already-decremented inventory
  ├── Resolve tenant for emails (shop name, site slug)
  ├── Retrieve PaymentIntent (optional, Wave 6.5+): read from connected account
  │   to get actual method (card vs fpx) — update order.paymentMethod
  ├── Send emails: orderConfirmation (buyer) + newOrderSeller (merchant)
  ├── Fire ORDER_NEW notification (merchant dashboard)
  └── Return success flag

**[GH-1099, SUPERSEDED]** 2.4a. Oversell handling (Wave 6.5 initial — OBSOLETE):
  ├── **PREVIOUS:** Stock decrement at webhook time (post-capture)
  │   └── If qty > available after decrement: flag oversellReview=true + send SYSTEM_ALERT
  │   └── **NOW REMOVED** — oversell is prevented upfront (§2.1, CAS at checkout)
  ├── **CURRENT:** Stock already decremented at order creation (checkout, commit `938406a9`)
  │   └── Oversellreview field deprecated; no post-capture oversell handling
  └── **RATIONALE:** Moving validation from detect-after (risky, manual seller refund) to prevent-upfront
      (atomic, fail-fast, guaranteed inventory safety)
```

### 2.5. Confirm Polling + Live Update (v2.1 — Wave 6.5)

```
Buyer at /sites/[slug]/order/[id]/confirm
  ↓ Page mounted
Frontend (ConfirmClient.tsx)
  ├── PRIMARY: SSE /api/orders/stream/[orderNumber]
  │   └── Subscribe to paymentStatus changes (real-time push when webhook arrives or reconcile succeeds)
  │       └── If paymentStatus='paid': show success, clearCart() once (idempotent ref guard)
  │
  └── SECONDARY (Wave 6.5): Optional POST /api/orders/[id]/payment-status on mount
        (Active-reconcile backup if webhook delayed; reads Stripe session status directly)
        ├── Auth via ct_{orderId} cookie
        ├── Returns { status, paymentStatus, stripeSessionId }
        ├── If paymentStatus='paid' already: skip reconcile
        └── If pending + stripeSessionId set:
            └── Inspect Stripe session payment_status
                ├── If Stripe says 'paid' but DB pending: call reconcileOrderPaid() to heal
                └── Update display if healed

Result:
  ├── If webhook arrives timely: SSE push → success within <5s
  ├── If webhook delayed 5-15min: POST active-reconcile + SSE eventually push → success
  └── If >15 min: show timeout message + manual help link
```

### 2.6. Retry Payment Endpoint (v2.0 — Wave 6.5)

```
Buyer on order detail page (order.status='pending' or 'payment_failed')
  ↓ Click "Pay Now" CTA
Client POST /api/orders/[id]/retry-payment
  ├── Guard: only if status='pending' or 'payment_failed' (locked decision: no order-list page)
  ├── Re-validate stock (hard reject if out)
  ├── Re-validate tenant Stripe readiness (not suspended, still onboarded)
  └── Create NEW Stripe session (don't reuse old, might be expired)
        ├── Generate new stripeSessionId
        ├── Return { sessionUrl } → client redirects
```

### 2.7. Cron Reconcile + Cleanup (v2.0 — Wave 6.5)

```
GET /api/cron/reconcile-orders (called by Vercel cron, auth: CRON_SECRET header)
  ├── Find pending orders > 15 minutes old
  ├── For each:
  │   ├── Look up Stripe session on connected account
  │   ├── If Stripe.status='paid': reconcileOrderPaid('cron') [self-heal]
  │   └── If still 'unpaid' after 15min: mark as 'expired' (buyer must retry)
  ├── Log reconciled count + any errors
  └── Return { reconciled: N, expired: M }
```

---

## 3. Components Map (v2.0)

| Component | File | Role |
|-----------|------|------|
| Stripe client + helpers | `src/lib/payment/stripe.ts` | Singleton client, Connect helpers, Checkout Session, webhook verify |
| Payment types | `src/lib/payment/types.ts` | `CheckoutParams`, `ConnectAccountStatus`, `PaymentWebhookEvent` |
| Method builder | `src/lib/payment/method-builder.ts` | `buildPaymentMethodTypes(tenant)` pure function |
| **Reconcile (shared, v2.0 NEW)** | **`src/lib/payment/reconcile-order.ts`** | **Atomic order-paid transition + stock + emails + oversell handling** |
| Onboard endpoint | `src/app/api/stripe/connect/onboard/route.ts` | POST creates Connect account + returns onboardingUrl |
| Status endpoint | `src/app/api/stripe/connect/status/route.ts` | GET returns chargesEnabled/payoutsEnabled |
| Stripe checkout endpoint | `src/app/api/orders/stripe-checkout/route.ts` | POST creates order + Stripe Checkout Session; clears cart on success |
| **Payment status endpoint (v2.1 NEW)** | **`src/app/api/orders/[id]/payment-status/route.ts`** | **POST auth cookie, return status; optional active reconcile (backup to SSE)** |
| **Retry payment endpoint (v2.0 NEW)** | **`src/app/api/orders/[id]/retry-payment/route.ts`** | **POST re-validate stock + new Stripe session** |
| **Cron reconcile endpoint (v2.0 NEW)** | **`src/app/api/cron/reconcile-orders/route.ts`** | **GET CRON_SECRET auth; reconcile pending >15min + expire stale** |
| Webhook handler | `src/app/api/webhooks/stripe/route.ts` | Process Stripe events + call reconcile |
| Webhook handlers (sub) | `src/app/api/webhooks/stripe/handlers/*.ts` | checkout-completed, payment-failed, account-updated, etc. |
| **Stream endpoint (v2.1)** | **`src/app/api/orders/stream/[orderNumber]/route.ts`** | **GET EventSource SSE; pushes paymentStatus changes in real-time** |
| Settings actions | `src/app/(dashboard)/settings/payments/actions.ts` | `getPaymentSettings`, `updatePaymentSettings` |
| Settings UI | `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx` | Container |
| Stripe toggles wrapper | `src/app/(dashboard)/settings/payments/stripe-payment-toggles.tsx` | Card + FPX toggles + Connect CTA + return handler |
| Tenants schema | `src/collections/Tenants.ts` | `stripeAccountId`, `stripeOnboardingComplete`, `payment_card`, `payment_fpx` |
| Orders schema | `src/collections/Orders.ts` | `status`, `paymentStatus`, `stripeSessionId`, `stripePaymentIntentId`, `paymentMethod`; ~~`oversellReview`~~ (DEPRECATED) |

---

## 4. Schema (v2.0)

### 4.1. Tenant payment fields

```typescript
// src/collections/Tenants.ts
{
  // Stripe Connect (existing — Wave 5)
  stripeAccountId: string | null,          // 'acct_xxx'
  stripeOnboardingComplete: boolean,       // sync via account.updated webhook
  stripeCustomerId: string | null,         // platform-level customer (subscription)
  stripeSubscriptionId: string | null,

  // F13 Wave 6 (Phase 01)
  payment_card: boolean,                   // enable Card via Stripe Checkout
  payment_fpx: boolean,                    // enable FPX via Stripe Checkout

  // F19 Manual Methods (existing)
  payment_cod: boolean,
  payment_qr: boolean,
  qr_image: Media | null,
}
```

### 4.2. Order payment fields (v2.0)

```typescript
// src/collections/Orders.ts
{
  // Existing (Wave 6)
  status: 'pending' | 'new' | 'confirmed' | 'shipped' | 'cancelled' | 'payment_failed',
  paymentMethod: 'stripe' | 'card' | 'fpx' | 'cod' | 'qr' | 'free',

  // NEW Wave 6.5 (Phase 01 + 02 + 07)
  paymentStatus: 'pending' | 'paid' | 'payment_failed' | 'refunded' | null,  // Atomic with status='new'
  stripeSessionId: string | null,          // Stripe checkout session ID (for idempotency)
  stripePaymentIntentId: string | null,    // Stripe payment intent ID (for reconcile)
  
  // **[GH-1099, OBSOLETE]** oversellReview field deprecated (PR #1160)
  // ~~oversellReview: boolean = false,~~  // DEPRECATED — stock decrement moved upfront (prevent-upfront)
  // Kept in DB schema for backward-compat (NEVER-DROP); no longer set or checked in code
}
```

### 4.3. Migration (v2.0 — GH-1099 Corrected)

**Per `.claude/rules/database-schema.md` convention:**

```sql
-- 1. Add Wave 6 columns (if not done Phase 01)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_card BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_fpx BOOLEAN DEFAULT false;

-- 2. Add Wave 6.5 columns (Phase 01 setup)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'pending';  -- 'pending'|'paid'|'payment_failed'|'refunded'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR UNIQUE;  -- Idempotency key
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR;

-- 3. **[GH-1099]** oversell_review column (DEPRECATED, kept for backward-compat)
-- Previously added in Phase 02; UNUSED since stock decrement moved upfront (commit `938406a9`); field removed from collection in PR #1160
ALTER TABLE orders ADD COLUMN IF NOT EXISTS oversell_review BOOLEAN DEFAULT false;
-- Note: Column kept per NEVER-DROP rule. No new code sets this field.

-- 4. Backfill Wave 6 (D-02 — preserve hardcode behavior)
UPDATE tenants
SET payment_card = true
WHERE stripe_onboarding_complete = true AND payment_card = false;
```

**Migration entry:** Add entries to `scripts/db-setup.js` `MIGRATIONS` array per convention.
**Note (GH-1099):** `oversell_review` column kept for backward-compat but NOT referenced in code paths post-PR #1160.

### 4.4. Payload hooks

`beforeChange` validation: auto-disable `payment_card`/`payment_fpx` nếu `stripeOnboardingComplete = false`:

```typescript
hooks: {
  beforeChange: [
    ({ value, siblingData }) => {
      if (value && !siblingData.stripeOnboardingComplete) return false
      return value
    },
  ],
}
```

---

## 5. Environment Variables (v2.0)

| Variable | Used by | Required | Notes |
|----------|---------|----------|-------|
| `STRIPE_SECRET_KEY` | `getStripeClient()` — Stripe API auth | ✅ Required | sk_test_* staging, sk_live_* production |
| `STRIPE_WEBHOOK_SECRET` | `verifyStripeWebhook(body, sig, false)` — main webhook | ✅ Required | Main endpoint: checkout, payment_intent |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `verifyStripeWebhook(body, sig, true)` — Connect events | ✅ Required | Separate endpoint: account.updated, etc. |
| `NEXT_PUBLIC_SERVER_URL` | Onboard route — build success/refresh URLs | ✅ Required | `https://staging-domain.com` |
| **`CRON_SECRET`** (v2.0 NEW) | **`GET /api/cron/reconcile-orders` auth header** | **✅ Required Wave 6.5** | **Vercel cron → bearer token; prevent public abuse** |

**Critical:** 2 webhook secrets riêng cho 2 webhook endpoints khác trong Stripe Dashboard:
- Main webhook: events từ platform (checkout.session.completed, payment_intent.*)
- Connect webhook: events từ connected accounts (account.updated, account.deauthorized)

**Per `.claude/rules/env-vars.md`:** source of truth ở Vercel Dashboard. GitHub Secrets chỉ chứa CI tooling tokens.

---

## 6. Idempotency Strategy

### 6.1. Checkout Session creation

**Current approach (Wave 6):** Dùng `client_reference_id = orderId` làm dedup key.

- Stripe Stripe API tự không detect duplicate `client_reference_id`, nhưng:
- Order status check: nếu order đã `new` (success từ webhook lần đầu), client side fetch order → biết đã paid → KHÔNG gọi lại
- Risk: nếu client retry POST `/api/orders/stripe-checkout` cho cùng `orderId` → tạo 2 Stripe sessions, buyer có thể pay 2 lần

**Mitigation (recommended Wave 6):**
- Frontend: disable "Place Order" button sau click + full-page overlay → prevent double-click
- Backend: check if order already has `stripeSessionId` → return existing session URL thay vì tạo mới

**Future (Wave 7+):** Add Stripe `idempotency_key` API parameter:
```typescript
stripe.checkout.sessions.create(params, {
  stripeAccount: tenant.stripeAccountId,
  idempotencyKey: `order_${orderId}_v1`,  // Stripe dedup 24h
})
```

### 6.2. Webhook event processing (v2.0 — Implemented)

**Wave 6.5 approach:** Atomic `UPDATE WHERE status='pending'` (IMPLEMENTED, not recommended but DONE).

```sql
-- Handler: reconcileOrderPaid() in webhook checkout-completed
UPDATE orders SET status='new', payment_status='paid'
WHERE id=? AND status='pending'
RETURNING id
```

- Atomic operation: only the first webhook wins (UPDATE returns 1 row)
- Subsequent retries: WHERE clause fails (status already 'new'), no updates, handler logs skip
- Stock decrement, emails, notifications only fire once (guarded by return count)
- Stripe retries webhook delivery up to 3 days với exponential backoff → idempotency essential

**Tradeoff:** Raw SQL bypasses Payload hooks. Verify no product/order hook side-effect is lost (e.g., low-stock alerts) per `.claude/rules/database-schema.md` constraint.

**Test coverage:** QA TC-F13.83 (critical — webhook DB outage), TC-F13.85 (concurrent/out-of-order events), TC-F13.143 (reconcile idempotency).

---

## 7. Application Fee Model (v2.0 Corrected)

**Wave 6:** Zero application fee (0%). Cross-border limitation: US platform + MY connected account prohibit `application_fee_amount` on Stripe side.

**Wave 7+:** Revisit 3% platform fee when:
- Destination charges enabled (same account type)
- Same-country model available (US seller → US platform)
- Stripe policy update

```typescript
// Wave 6 (current):
// NO application_fee_amount in payment_intent_data
payment_intent_data: { metadata: { orderId } }

// Wave 7+ (future):
// const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
// const applicationFeeAmount = Math.round(totalAmount * (feePercent / 100))  // 3%
// - Rounding: Math.round() (banker's rounding NOT used; Stripe accepts integer)
// - Edge case: RM 33.33 (3333 sen) × 3% = 99.99 → round 100 sen; merchant nets 3233 sen
```

**Reference:** Plan §3 — Platform Fee Deferred to Wave 7+. Not in scope Wave 6.5.

---

## 8. Vercel Cron Configuration (v2.0 — Wave 6.5)

**Endpoint:** `GET /api/cron/reconcile-orders` (§2.7)

**Configuration in `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile-orders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Security:**
- Auth via `CRON_SECRET` header (bearer token)
- Endpoint validates `Authorization: Bearer ${CRON_SECRET}`
- Reject 401 if missing or invalid

**Per `.claude/rules/vercel-deploy.md`:**
- Do NOT change `git.deploymentEnabled` (must remain false)
- Editing `crons[]` is safe (does not require disabling deployments)
- Test schedule on staging with `vercel cron list` before production

---

## 9. Connected Account State Machine

```
[null]
  ↓ createConnectedAccount('MY', email, businessName)
'created' (stripeAccountId set, stripeOnboardingComplete=false)
  ↓ createAccountLink → seller open URL
'onboarding'
  ↓ Seller completes KYC + bank info on Stripe-hosted page
'kyc_pending' (Stripe processes, may take seconds to days)
  ↓ Stripe webhook account.updated → charges_enabled=true
'active' (stripeOnboardingComplete=true)
  ↓ (optional) account suspended/disabled by Stripe
'suspended' (charges_enabled=false)
  ↓ Connect retry → new Account Link
'onboarding' (back to retry)
```

**State transitions handled by:**
- Frontend: query param `?stripe=complete/refresh` + fetch status
- Backend webhook: `account.updated` event syncs `stripeOnboardingComplete`

---

## 10. Stripe API Version Pin

**Current:** Code uses Stripe SDK default API version.

**Recommendation (add to `getStripeClient()`):**
```typescript
new Stripe(key, {
  apiVersion: '2025-09-30.basil',  // Pin to specific version
  typescript: true,
})
```

**Rationale:** Stripe rolls out breaking changes via API version. Pin ensures behavior stable across SDK upgrades. Review version quarterly + run regression tests trước bump.

---

## 11. Error Handling Matrix

| Scenario | Backend response | Frontend UX |
|----------|------------------|-------------|
| `STRIPE_SECRET_KEY` not set | 500 generic "Payment service unavailable" | Toast destructive + retry CTA |
| Tenant không có `stripeAccountId` | 422 `STRIPE_NOT_CONNECTED` | Toast "Seller has not connected Stripe yet" |
| Tenant `stripeOnboardingComplete = false` | 422 `STRIPE_NOT_READY` | Toast "Payment temporarily unavailable" |
| Cả `payment_card` + `payment_fpx` = false (FR-15) | 422 `NO_PAYMENT_METHODS` | Toast "Seller has not enabled Card or FPX" + fallback to COD/QR |
| Stripe API timeout / 5xx | 502 `STRIPE_API_ERROR` | Toast "Payment service is busy. Please try again." + Retry button |
| Webhook signature invalid | 400 (per Stripe spec) | N/A (server-server) |
| Webhook unknown event type | 200 acknowledged + log warning (per Stripe best practice) | N/A |
| Webhook event for completed order (duplicate) | 200 + skip (idempotency check) | N/A |

---

## 12. Security Considerations

- **PCI-DSS SAQ A**: Zero card data server-side (Stripe Checkout hosted) — QA TC-F13.38
- **CSRF**: Next.js App Router default CSRF protection (Same-Origin policy on POST). Verify `/api/orders/stripe-checkout` không có CORS wildcard.
- **Tenant ownership**: `/api/stripe/connect/onboard` verifies user owns tenantId (line 33-41 onboard route). Same pattern required cho future endpoints (retry-payment, payment-status).
- **IDOR guard (webhook)**: `handleCheckoutCompleted` calls `verifyConnectedAccountOwnership()` before any DB writes (fail-closed).
- **Webhook secret rotation**: Document rotation procedure (rotate via Stripe Dashboard → update Vercel env → redeploy). Test với `stripe listen` on staging trước rotate production.
- **3D Secure**: Stripe Checkout enables 3DS automatically theo card BIN. Không cần config.
- **Replay attack protection**: Stripe SDK validates timestamp (≤ 5 minutes default). KHÔNG cần custom check.

---

## 13. Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Order create API → Stripe URL response | < 1s p95 | Vercel logs + Stripe response time |
| Stripe Checkout page load (Stripe-hosted) | < 2s p95 | Out of our control (Stripe SLA) |
| Webhook handler processing | < 500ms p95 | Vercel function duration |
| End-to-end checkout (click "Place Order" → confirmation) | < 30s typical (Card), < 60s (FPX with bank redirect) | E2E test timing |

---

## 14. Dependencies

| Dependency | Version | Status | Notes |
|-----------|---------|--------|-------|
| `stripe` (Node SDK) | latest | ✅ Installed | Checkout + Connect support |
| `@stripe/stripe-js` (client SDK) | — | ❌ NOT needed | Checkout Session hosted, no inline |
| Stripe MY account | Standard accounts enabled | ✅ Done | Direct Charges, FPX enabled |
| F09 Storefront checkout | Phase 04 modifies | ⏳ Wave 6.5 dep | Cart preserved, Confirm page |
| F19 Settings > Payments | Phase 02 extends | ✅ Existing | Card/FPX toggles, Connect CTA |
| F02 Auth (`withAuth`) | Onboard route uses | ✅ Existing | Tenant ownership verify |
| F10 Orders confirmation | Receives `success_url` callback | ✅ Existing | Polling + self-heal (Wave 6.5 new) |
| Vercel Cron | `reconcile-orders` job | ✅ Configurable | 10min schedule (Wave 6.5) |

---

## 15. Testing Strategy

### 15.1. Unit tests (Phase 01–03, 06)
- `buildPaymentMethodTypes` (4 cases)
- `reconcileOrderPaid` (idempotency, oversell flag, stock decrement)
- `createStripeCheckoutSession` với dynamic methods (3 cases)
- `updatePaymentSettings` hooks (auto-disable nếu not onboarded)
- StripePaymentToggles component (7 cases)
- Retry payment validation (state guard, stock check)

### 15.2. Integration tests (Phase 01–03, 05–07)
- `/api/orders/stripe-checkout` với tenant card-only / fpx-only / both-off
- Webhook handler `checkout.session.completed` → reconcile → order + stock + notifications
- Webhook `payment_intent.payment_failed` → order paymentStatus='payment_failed'
- Webhook `account.application.deauthorized` → lock toggles
- Confirm polling `/api/orders/[id]/payment-status` → active reconcile
- Retry payment `/api/orders/[id]/retry-payment` → new session, stock re-validate
- Cron reconcile `/api/cron/reconcile-orders` → heal late webhooks

### 15.3. E2E tests (Phase 04 + 05 + post-merge)
- Stripe sandbox happy path: Card 4242 → success → Confirm polls → cleared
- Stripe sandbox happy path: FPX test bank → success → emails sent
- Cancel cycle: cart preserved + BM toast, "Try Again" creates new session
- Payment failed: Confirm shows retry state, "Pay Now" button works
- Connect cycle: onboard → return complete → toggles unlock
- Race: webhook arrives before browser redirect → Confirm sees paid immediately

### 15.4. Manual QA (sandbox)
- Full TC suite từ `docs/qa/F13-payment-gateway.md` v1.6 (157 TCs)
- Stripe Dashboard verify: no application_fee_amount (Wave 6), charge on connected account
- Bank Reconciliation: merchant receives full amount (no platform fee Wave 6)

---

## 16. Rollout Strategy

### Phase A (Sprint 1 — Blocker fixes, ~10-13h)
1. Phase 01: Fix paymentStatus + extract `reconcileOrderPaid()`
2. Phase 02: Atomic stock + oversell flag + seller notify
3. Phase 03: Accurate payment method detection
4. Phase 04: Cart handling + cancel toast
5. Deploy staging → preliminary QC test

### Phase B (Sprint 2 — UX + Reconciliation)
6. Phase 05: Confirm polling + self-heal
7. Phase 06: "Pay Now" retry endpoint
8. Phase 07: Cron reconcile + cleanup
9. Full E2E sandbox test
10. Production rollout pilot (1-2 tenants)
11. Monitor 1 tuần → general availability

---

## 17. Known Limitations & Wave 7+ Work

| Item | Wave | Reason |
|------|------|--------|
| 3% Platform Fee | Wave 7+ | Cross-border (US → MY) Stripe limitation in Wave 6 |
| Inline Payment Element | Wave 7+ | Checkout Session hosted sufficient for Wave 6 |
| Stripe Idempotency Key | Wave 7+ | Atomic status='pending' guard sufficient Wave 6 volume |
| TnG, GrabPay, Boost | Wave 7+ | Not yet GA on Stripe MY |
| Saved cards / Re-purchase | Wave 7+ | Requires buyer accounts (no-auth model conflict) |
| **[OBSOLETE GH-1099]** Refund UI on oversell | ~~Wave 7+~~ | **Superseded by prevent-upfront (PR #1160)** — oversell no longer possible |
| Express/Custom Connect | Wave 8+ | Standard accounts sufficient |
| Multi-currency | Wave 8+ | Malaysia focus, MYR-only |

---

## 18. References

- Stripe Connect Direct Charges: https://stripe.com/docs/connect/direct-charges
- Stripe Checkout Sessions: https://stripe.com/docs/api/checkout/sessions
- Stripe Webhook signing: https://stripe.com/docs/webhooks/signatures
- FPX Malaysia: https://stripe.com/docs/payments/fpx
- Payload CMS hooks: https://payloadcms.com/docs/hooks/overview
