# F13 Payment Gateway — Architecture

> **Feature:** F13 — Payment Gateway (Malaysia, Wave 6 P0)
> **Version:** 1.0 | **Created:** 2026-05-13 | **Owner:** Backend Dev
> **Links:**
> - PRD: [`docs/prd/F13-payment-gateway.md`](../prd/F13-payment-gateway.md)
> - Design: [`docs/design/F13-payment-gateway-design.md`](../design/F13-payment-gateway-design.md)
> - Stories: [`docs/stories/F13-payment-gateway-stories.md`](../stories/F13-payment-gateway-stories.md)
> - QA: [`docs/qa/F13-payment-gateway.md`](../qa/F13-payment-gateway.md)
> - Plan: [`plans/260513-1614-f13-payment-stripe-card-fpx/`](../../plans/260513-1614-f13-payment-stripe-card-fpx/)

---

## 1. Overview

**Architecture:** Stripe Checkout Session HOSTED + Stripe Connect Standard accounts + Direct Charges model.

- Buyer redirect ra `checkout.stripe.com/...` — Stripe-hosted page handle Card/FPX/3D Secure
- Payment vào account merchant (`tenant.stripeAccountId`) qua Direct Charge
- PrimeWeb thu **3% application_fee_amount** (configurable per-checkout-call)
- Webhook `checkout.session.completed` → order status `pending → new`

**Decision reference:** Design §8.6 — Checkout Session vs Payment Element → chốt Checkout Session vì code đã implement + KISS.

---

## 2. Data Flow

### 2.1. Buyer checkout (happy path)

```
Buyer (Storefront)
  ↓ Click "Pay with Stripe" + "Place Order"
Client POST /api/orders/create
  ↓ withAuth=false (guest checkout)
Backend
  ├── Validate tenant.payment_card OR tenant.payment_fpx (FR-15)
  ├── buildPaymentMethodTypes(tenant) → ['card'] | ['fpx'] | ['card','fpx']
  ├── createStripeCheckoutSession({
  │     paymentMethodTypes,
  │     stripeAccountId: tenant.stripeAccountId,
  │     applicationFeePercent: 3,
  │     successUrl, cancelUrl,
  │   })
  ↓ Stripe API (Direct Charge on connected account)
Stripe creates Session
  ↓ Returns { sessionId, url }
Backend returns { url } to client
  ↓ Client: window.location.href = url
Stripe Checkout (hosted page)
  ├── Card flow: input card → submit → 3D Secure → return success_url
  └── FPX flow: select bank → redirect bank login → authorize → return success_url

Success path:
  Stripe → success_url → /sites/[slug]/orders/[id]/confirmation
  Stripe → webhook checkout.session.completed → backend update order pending→new

Cancel path:
  Stripe → cancel_url → /sites/[slug]/checkout?stripe_cancelled=1
  Frontend → toast BM "Pembayaran gagal" + cart preserved
  Order status stays 'pending' (BR-03)
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

### 2.3. Webhook event processing

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
  └── Process event:
        ├── payment_success → find order by client_reference_id → update status 'pending → new'
        ├── payment_failed → log + notify merchant (out of scope handler)
        └── account_updated → sync tenant.stripeOnboardingComplete với account.charges_enabled
```

---

## 3. Components Map

| Component | File | Role |
|-----------|------|------|
| Stripe client + helpers | `src/lib/payment/stripe.ts` | Singleton client, Connect helpers, Checkout Session, webhook verify |
| Payment types | `src/lib/payment/types.ts` | `CheckoutParams`, `ConnectAccountStatus`, `PaymentWebhookEvent` |
| Method builder (NEW Phase 03) | `src/lib/payment/method-builder.ts` | `buildPaymentMethodTypes(tenant)` pure function |
| Onboard endpoint | `src/app/api/stripe/connect/onboard/route.ts` | POST creates Connect account + returns onboardingUrl |
| Status endpoint | `src/app/api/stripe/connect/status/route.ts` | GET returns chargesEnabled/payoutsEnabled |
| Order create | `src/app/api/orders/create/route.ts` | POST creates order + Stripe Checkout Session |
| Webhook handler | `src/app/api/webhooks/stripe/route.ts` | Process Stripe events |
| Settings actions | `src/app/(dashboard)/settings/payments/actions.ts` | `getPaymentSettings`, `updatePaymentSettings` |
| Settings UI (extended Phase 02) | `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx` | Container |
| Stripe toggles wrapper (NEW Phase 02) | `src/app/(dashboard)/settings/payments/stripe-payment-toggles.tsx` | Card + FPX toggles + Connect CTA + return handler |
| Tenants schema | `src/collections/Tenants.ts` | `stripeAccountId`, `stripeOnboardingComplete`, `payment_card`, `payment_fpx`, `payment_cod`, `payment_qr` |

---

## 4. Schema

### 4.1. Tenant payment fields

```typescript
// src/collections/Tenants.ts
{
  // Stripe Connect (existing — Wave 5)
  stripeAccountId: string | null,          // 'acct_xxx'
  stripeOnboardingComplete: boolean,       // sync via account.updated webhook
  stripeCustomerId: string | null,         // platform-level customer (subscription)
  stripeSubscriptionId: string | null,

  // F13 NEW (Phase 01)
  payment_card: boolean,                   // enable Card via Stripe Checkout
  payment_fpx: boolean,                    // enable FPX via Stripe Checkout

  // F19 Manual Methods (existing)
  payment_cod: boolean,
  payment_qr: boolean,
  qr_image: Media | null,
}
```

### 4.2. Migration (Phase 01)

```sql
-- 1. Add columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_card BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_fpx BOOLEAN DEFAULT false;

-- 2. Backfill (D-02 — preserve hardcode behavior)
UPDATE tenants
SET payment_card = true
WHERE stripe_onboarding_complete = true AND payment_card = false;
```

### 4.3. Payload hooks

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

## 5. Environment Variables

| Variable | Used by | Required |
|----------|---------|----------|
| `STRIPE_SECRET_KEY` | `getStripeClient()` — Stripe API auth | ✅ Required (sk_test_* on staging, sk_live_* on production) |
| `STRIPE_WEBHOOK_SECRET` | `verifyStripeWebhook(body, sig, false)` — main webhook | ✅ Required cho main webhook endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `verifyStripeWebhook(body, sig, true)` — Connect events | ✅ Required cho Connect webhook endpoint (separate) |
| `NEXT_PUBLIC_SERVER_URL` | Onboard route — build success/refresh URLs | ✅ Required (`https://staging-domain.com`) |

**Critical:** 2 webhook secrets riêng cho 2 webhook endpoints khác trong Stripe Dashboard:
- Main webhook: events từ platform (checkout.session.completed, payment_intent.*)
- Connect webhook: events từ connected accounts (account.updated)

Per `.claude/rules/env-vars.md` — source of truth ở Vercel Dashboard. GitHub Secrets chỉ chứa CI tooling tokens.

---

## 6. Idempotency Strategy

### 6.1. Checkout Session creation

**Current approach (Wave 6):** Dùng `client_reference_id = orderId` làm dedup key.

- Stripe Stripe API tự không detect duplicate `client_reference_id`, nhưng:
- Order status check: nếu order đã `new` (success từ webhook lần đầu), client side fetch order → biết đã paid → KHÔNG gọi lại
- Risk: nếu client retry POST `/api/orders/create` cho cùng `orderId` → tạo 2 Stripe sessions, buyer có thể pay 2 lần

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

### 6.2. Webhook event processing

**Current approach:** Order status check (state machine guard).

- Webhook handler: load order → if order.status === 'new' → SKIP (đã processed lần trước)
- IF order.status === 'pending' → update → 'new'
- Stripe automatically retries webhook delivery up to 3 days với exponential backoff → idempotency cần thiết

**Risk:** Race condition khi 2 webhook events arrive concurrently (rare nhưng possible với retry storm).

**Mitigation (recommended):**
- Wrap update trong transaction với `UPDATE WHERE status = 'pending'` (atomic check-and-update)
- Log Stripe event ID → check Redis/DB dedup table (defer Wave 7+ nếu volume thấp)

**Reference TC:** QA TC-F13.14 (Idempotent webhook processing) — currently `[ ]` not run; verify với `stripe listen` retry simulation.

---

## 7. Application Fee Calculation

```typescript
// src/lib/payment/stripe.ts:117
const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
const applicationFeeAmount = Math.round(totalAmount * (feePercent / 100))
```

- `totalAmount`: integer sen (RM × 100)
- `feePercent`: default 3 (configurable via `params.applicationFeePercent`)
- Rounding: `Math.round()` — banker's rounding NOT used (Stripe accepts integer)
- Edge case: tổng RM 33.33 (3333 sen) × 3% = 99.99 → round 100 sen (RM 1.00); merchant nhận 3233 sen (RM 32.33)

**Test coverage:** QA TC-F13.03, TC-F13.20.

---

## 8. Connected Account State Machine

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

## 9. Stripe API Version Pin

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

## 10. Error Handling Matrix

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

## 11. Security Considerations

- **PCI-DSS SAQ A**: Zero card data server-side (Stripe Checkout hosted) — QA TC-F13.23
- **CSRF**: Next.js App Router default CSRF protection (Same-Origin policy on POST). Verify `/api/orders/create` không có CORS wildcard.
- **Tenant ownership**: `/api/stripe/connect/onboard` verifies user owns tenantId (line 33-41 onboard route). Same pattern required cho future endpoints.
- **Webhook secret rotation**: Document rotation procedure (rotate via Stripe Dashboard → update Vercel env → redeploy). Test với `stripe listen` on staging trước rotate production.
- **3D Secure**: Stripe Checkout enables 3DS automatically theo card BIN. Không cần config.
- **Replay attack protection**: Stripe SDK validates timestamp (≤ 5 minutes default). KHÔNG cần custom check.

---

## 12. Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Order create API → Stripe URL response | < 1s p95 | Vercel logs + Stripe response time |
| Stripe Checkout page load (Stripe-hosted) | < 2s p95 | Out of our control (Stripe SLA) |
| Webhook handler processing | < 500ms p95 | Vercel function duration |
| End-to-end checkout (click "Place Order" → confirmation) | < 30s typical (Card), < 60s (FPX with bank redirect) | E2E test timing |

---

## 13. Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| `stripe` (Node SDK) | latest | ✅ Installed |
| `@stripe/stripe-js` (client SDK) | — | ❌ NOT needed (Checkout Session hosted, no client SDK) |
| Stripe MY account | Standard accounts enabled | ✅ Done |
| F09 Storefront checkout page | Phase 04 modifies | ⏳ Dependency cho Phase 04 |
| F19 Settings > Payments page | Phase 02 extends | ✅ Existing |
| F02 Auth (`withAuth`) | Onboard route uses | ✅ Existing |
| F10 Orders confirmation page | Receives `success_url` callback | ✅ Existing (verify session_id parsing) |

---

## 14. Testing Strategy

### 14.1. Unit tests (Phase 02 + 03)
- `buildPaymentMethodTypes` (4 cases)
- `createStripeCheckoutSession` với dynamic methods (3 cases)
- `updatePaymentSettings` hooks (auto-disable nếu not onboarded)
- StripePaymentToggles component (7 cases)

### 14.2. Integration tests (Phase 03)
- `/api/orders/create` với tenant card-only / fpx-only / both-off
- Webhook handler `checkout.session.completed` → order update

### 14.3. E2E tests (Phase 04 + post-merge)
- Stripe sandbox happy path: Card 4242 → success
- Stripe sandbox happy path: FPX test bank → success
- Cancel cycle: cart preserved + BM toast
- Connect cycle: onboard → return complete → toggles unlock

### 14.4. Manual QA (sandbox)
- Full TC suite từ `docs/qa/F13-payment-gateway.md` v1.1
- Stripe Dashboard verify: application fee 3% appears
- Bank Reconciliation: merchant receives net amount

---

## 15. Rollout Strategy

### Phase A (this week — ~10-13h)
1. Phase 01: schema + migrations
2. Phase 02 + 03: parallel — Settings UI + Checkout API
3. Deploy staging → QC test với sandbox

### Phase B (HOLD)
4. Phase 04: storefront integration (sau COD/QR merge)
5. E2E sandbox test
6. Production rollout pilot (1-2 tenants)
7. Monitor 1 tuần → general availability

---

## 16. Known limitations + Future work

| Item | Wave | Reason |
|------|------|--------|
| Inline Payment Element | Wave 7+ | KISS — Checkout Session hosted handle UI |
| Stripe Idempotency Key API param | Wave 7+ | Order status check đủ cho volume Wave 6 |
| TnG, GrabPay, Boost | Wave 7+ | Stripe MY chưa GA TnG/GrabPay |
| Saved cards / tokenized re-purchase | Wave 7+ | Requires buyer accounts |
| Refund UI | Wave 7+ (F10 scope) | Use Stripe Dashboard manual for now |
| Stripe Connect Express/Custom | Wave 8+ | Standard accounts đủ cho marketplace launch |
| Multi-currency support | Wave 8+ | MY focus, MYR-only Wave 6 |

---

## 17. References

- Stripe Connect Direct Charges: https://stripe.com/docs/connect/direct-charges
- Stripe Checkout Sessions: https://stripe.com/docs/api/checkout/sessions
- Stripe Webhook signing: https://stripe.com/docs/webhooks/signatures
- FPX Malaysia: https://stripe.com/docs/payments/fpx
- Payload CMS hooks: https://payloadcms.com/docs/hooks/overview
