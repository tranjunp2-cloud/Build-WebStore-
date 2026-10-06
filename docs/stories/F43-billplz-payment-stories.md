# User Stories: Billplz Payment Integration (F43)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md -->

> [!WARNING]
> **Status:** Draft — **dev-researched, pending BA review**
> **Provenance:** Researched + authored by Dev on `research/billplz-payment-method` (no BA involvement yet). Technical foundation: `plans/261005-1427-billplz-payment/` + `research.md`. Product decisions (late-payment policy, refund v1, OAuth deferral) logged as PD-023/PD-024 in `docs/decisions/decisions-log.md` — BA confirms or amends.
> **When BA joins:** business context/scope/metrics → `docs/prd/F43-billplz-payment.md` (skeleton exists); ACs here get BA-accepted → Status: Ready.

> **Feature:** F43 — Billplz Payment Integration (Malaysia hosted checkout: FPX, e-wallet/QR, card, BNPL)
> **Wave:** 8 | **Priority:** P1 | **Plan:** [plans/261005-1427-billplz-payment/](../../plans/261005-1427-billplz-payment/plan.md) | **Research:** [research.md](../../plans/261005-1427-billplz-payment/research.md)
> **Provider:** Billplz — per-merchant keys (API Secret + Collection ID + X Signature), non-custody, platform RM0.
> **Depends on:** F09 Storefront ✅, F10 Order lifecycle ✅, F13 Stripe Connect (pattern reference), F34 Xendit (code reference only — not in prod flow).

> [!IMPORTANT]
> **Guardrails xuyên suốt:**
> - **Units:** internal RM (2dp) ↔ Billplz **sen** — `Math.round(total*100)` at boundary only, never round-trip.
> - **Secrets:** `billplzApiKey`/`billplzXSignatureKey` `access.read:false`, never in client payload/logs.
> - **Webhook trust:** verify X Signature FIRST, then bind `order.billplzBillId === params.id` — `?o=`/`reference_2` are unsigned hints only.
> - **Cancelled is cancelled:** `PAID_AFTER_CANCEL` → alert + manual refund, never auto-revive.
> - **No toggles:** connection = key presence (`!!billplzApiKey && collectionId && xSignatureKey`), mirrors Xendit gating.

---

## US-F43-01: Schema + Billplz client library

**Issue:** [#1911](https://github.com/primeproduction/ech-prime-web-v2/issues/1911)

**P0** | **M** | **Branch:** `feat/F43-01-billplz-schema-client`

### Story

```
As a   Developer
I want tenant credential fields, order bill linkage, DB migrations, and a typed Billplz API client
So that downstream phases can store credentials, create/query/delete bills, and verify X Signatures
```

### Acceptance Criteria

#### AC-1: Schema + migrations

```gherkin
GIVEN clean DB
WHEN  db-setup.js migrations run
THEN  tenants has billplz_api_key, billplz_collection_id, billplz_x_signature_key (varchar)
  AND orders has billplz_bill_id varchar + index
  AND enum_orders_payment_method has 'billplz' value
  AND orders.payment_provider accepts 'billplz' (varchar, no enum needed)
  AND check-migrations.js passes
```

#### AC-2: Client correctness

```gherkin
GIVEN billplzFetch with auth {type:'basic', key}
WHEN  any request fires
THEN  Authorization: Basic base64(key + ':') and body is form-urlencoded
  AND non-2xx throws BillplzError with status + parsed message
  AND {type:'bearer', token} arm sends Bearer header (OAuth-ready, unused until P7)
```

#### AC-3: verifyXSignature matches official plugin

```gherkin
GIVEN callback params incl. x_signature
WHEN  verifyBillplzSignature(params, xSigKey)
THEN  whitelist keys only (amount, collection_id, due_at, email, id, mobile, name,
      paid_amount, transaction_id, transaction_status, paid_at, paid, state, url)
  AND drops '', 'null', 'false', null values → sort case-insensitive → join '|'
  AND HMAC-SHA256 → timingSafeEqual compare → tampered/missing sig returns false
```

---

## US-F43-02: Seller connect — manual keys

**Issue:** [#1912](https://github.com/primeproduction/ech-prime-web-v2/issues/1912)

**P0** | **M** | **Branch:** `feat/F43-02-billplz-seller-connect`

### Story

```
As a   SME Owner
I want to paste my Billplz API Secret Key + Collection ID + X Signature Key in Settings → Payments
So that my storefront can accept Billplz payments
```

### Acceptance Criteria

#### AC-1: Validated save

```gherkin
GIVEN tenant on plan with payment_integration, connect modal open
WHEN  saveBillplzKeys(apiKey, collectionId, xSigKey)
THEN  probeApiKey (GET /v4/webhook_rank): 401 → 'billplzInvalidApiKey'
  AND getCollection: 404 → 'billplzCollectionNotFound', 401 → invalid key,
      network error → proceed-with-warn (Billplz outage must not block save)
  AND valid → payload.update tenant keys (overrideAccess) → success
```

#### AC-2: Connected state + disconnect

```gherkin
GIVEN keys saved
WHEN  settings reloads
THEN  BillplzConnectedBar shows masked collection ID + "Manage in Billplz" + Disconnect
  AND keys NEVER appear in any client payload (access.read:false)
WHEN  disconnect → all 3 fields nulled → storefront stops showing Billplz
```

#### AC-3: X Signature key caveat surfaced

```gherkin
GIVEN seller entering keys
THEN  modal copy warns: wrong X Signature Key only detectable on first callback
      (Billplz has no endpoint to validate it at save time)
```

---

## US-F43-03: Checkout flow — create Bill + hosted redirect

**Issue:** [#1913](https://github.com/primeproduction/ech-prime-web-v2/issues/1913)

**P0** | **L** | **Branch:** `feat/F43-03-billplz-checkout`

### Story

```
As a   Buyer
I want to select "Billplz" at checkout and pay on Billplz's hosted page (FPX/wallet/card/BNPL)
So that I can pay a Billplz-connected shop without a card-gateway account on the platform side
```

### Acceptance Criteria

#### AC-1: Bill creation + redirect

```gherkin
GIVEN billplz-connected tenant, buyer cart valid
WHEN  POST /api/orders/billplz-checkout
THEN  plan gate allowing_buyer_making_order → pending order
      (paymentProvider:'billplz', paymentMethod:'billplz', paymentStatus:'awaiting_payment',
       paymentExpiresAt:+24h, magicLinkSecret)
  AND stock decremented via stripe-style dual path (variant + aggregate CAS)
  AND createBill: amount=round(totalSen), reference_2=orderId,
      callback_url=.../api/webhooks/billplz?o={orderId}, redirect_url=.../order/{id}/confirm
  AND billplzBillId persisted INSIDE createBill try-block (no orphan window)
  AND response {type:'redirect', sessionUrl=bill.url} + ct_{orderId} cookie
```

#### AC-2: Discount honored

```gherkin
GIVEN valid discountCode
THEN  bill amount = discounted total (ported applyDiscount + computeOrderTotal)
  AND invalid code → 422 INVALID_DISCOUNT
  AND displayed price === charged price, always
```

#### AC-3: Idempotent resume + rollback

```gherkin
GIVEN retry POST with orderId of pending billplz order
THEN  returns same bill URL (no second bill)
GIVEN createBill fails
THEN  order deleted + stock restored → 502 BILLPLZ_API_ERROR
```

#### AC-4: Storefront gating

```gherkin
GIVEN Billplz-only store (no Stripe/COD/QR)
THEN  hasPaymentMethods includes billplzConnected (page.tsx AND site-by-slug)
  AND Billplz option visible AND auto-selected by default
  AND paymentMethod:'billplz' consumers updated: email-utils label, i18n en+ms,
      OrdersActionBar filter, OrderTrackingClient label, order-confirmation/
      shipped/completed prepaid paths
```

#### AC-5: Notify-owner guard

```gherkin
GIVEN Orders afterChange notify-owner hook
THEN  skips when doc.paymentProvider non-null (suppresses billplz+xendit)
  AND bank_transfer orders still emit ORDER_NEW (regression check)
```

---

## US-F43-04: Webhook — X Signature verify + reconcile

**Issue:** [#1914](https://github.com/primeproduction/ech-prime-web-v2/issues/1914)

**P0** | **M** | **Branch:** `feat/F43-04-billplz-webhook`

### Story

```
As a   Platform
I want to receive Billplz's form-urlencoded payment callback and reconcile orders securely
So that paid orders flip exactly once and forged/replayed callbacks are rejected
```

### Acceptance Criteria

#### AC-1: Signature + binding

```gherkin
GIVEN POST /api/webhooks/billplz?o={orderId} form-urlencoded body
WHEN  order resolved via ?o= → reference_2 → billplzBillId fallback
THEN  tenant X Signature verified BEFORE any write
  AND post-verify binding: order.paymentProvider==='billplz'
      AND order.billplzBillId===params.id → else 401 BILL_ID_MISMATCH
  AND exception: billplzBillId null + resolved via ?o=/reference_2 + sig valid
      → accept + backfill on reconcile win (orphan recovery)
```

#### AC-2: Dispatch + idempotency

```gherkin
GIVEN valid signed callback
WHEN  paid==='true' (dispatch keys on paid alone, NOT conjunct with state)
THEN  amount check vs order total (>1 sen mismatch → error log + skip)
  AND reconcileOrderPaid CAS flips order exactly once; replay = no-op
  AND bankTransactionId ← params.transaction_id (never write to xenditChannelCode)
WHEN  paid==='false' or state==='deleted'
THEN  mark payment_failed only if still awaiting_payment
```

#### AC-3: Status contract + PAID_AFTER_CANCEL

```gherkin
GIVEN callback arrives
THEN  unknown order → 200 ACK + warn (test pings must not retry-storm)
  AND bad signature / missing key / bill-id mismatch → 401 + error marker
  AND paid==='true' on cancelled/terminal order → PAID_AFTER_CANCEL error log
      + seller alert; order STAYS cancelled (policy: manual refund, never revive)
```

---

## US-F43-05: Lifecycle — expiry, reconcile cron, status UX

**Issue:** [#1915](https://github.com/primeproduction/ech-prime-web-v2/issues/1915)

**P1** | **L** | **Branch:** `feat/F43-05-billplz-lifecycle`

### Story

```
As a   Platform
I want expired/cancelled Billplz orders to void their remote bills and missed webhooks to self-heal
So that buyers can't pay dead orders and paid orders never get stuck
```

### Acceptance Criteria

#### AC-1: Void on every cancel path

```gherkin
GIVEN shared voidBillplzBill(order) helper (best-effort deleteBill, warn-only on fail)
THEN  payment-expiry CAS cancel → void
  AND buyer cancel-payment CAS → void
  AND seller pending-cancel CAS → void
  (bills live 30d — any un-voided bill = payable link on cancelled order)
```

#### AC-2: Reconcile cron

```gherkin
GIVEN billplz pass in reconcile-orders cron
THEN  queries paymentProvider='billplz' + awaiting_payment + billplzBillId not null
  AND ≤40 GETs/run earliest-first (shared ~80/5min budget w/ expiry deletes + status polls)
  AND paid bill → reconcileOrderPaid(source:'cron')
```

#### AC-3: Status + retry

```gherkin
GIVEN confirm page polling payment-status
THEN  billplz branch maps paid/state; remote GET throttled ≤1 per 30s per order
GIVEN retry-payment on failed billplz order
THEN  route guard admits 'billplz'; new bill created; OLD bill deleted before
      billplzBillId overwrite (no two payable links)
```

#### AC-4: Provider predicate fixes (Stripe-by-elimination)

```gherkin
GIVEN paid billplz order, tenant WITHOUT Stripe
WHEN  seller cancels
THEN  cancel SUCCEEDS — Stripe predicate excludes paymentProvider='billplz'
      (else falls into Stripe refund branch → STRIPE_NOT_REFUNDABLE forever)
  AND refund route → 422 BILLPLZ_MANUAL_REFUND before Stripe fallthrough
  AND paid billplz + tenant WITH Stripe → still clean manual-refund path
```

#### AC-5: Confirm page + reminder

```gherkin
GIVEN billplz order on confirm page
THEN  confirm/page.tsx passes paymentProvider; ConfirmClient isBillplz branch
      (NOT isStripe catch-all) → online-pending UI + payment-status polling
  AND order-waiting reminder gate includes 'billplz' (abandoned buyers get magic-link email)
```

---

## US-F43-06: Refund via Payment Order API v5 *(stretch)*

**Issue:** [#1916](https://github.com/primeproduction/ech-prime-web-v2/issues/1916)

**P2** | **XL** | **Branch:** `feat/F43-06-billplz-refund`

### Story

```
As a   Seller
I want to refund a paid Billplz order from the dashboard (collecting buyer bank details)
So that buyers get money back without me emailing Billplz support
```

### Acceptance Criteria

```gherkin
GIVEN paid billplz order + seller has pre-funded Payment Order collection
WHEN  refund initiated → buyer bank details collected (bank code, account, holder, ID)
THEN  createPaymentOrder (V5 checksum HMAC-SHA512 + epoch auth) → store billplzPaymentOrderId
  AND insufficient PO limit → explicit seller-facing error (not silent)
  AND PO status via callback/cron → 'completed' → order 'refunded' exactly once
  AND Payment Orders cannot be reversed → bank details re-verified in UI before submit
```

> Pre-req (outside ECH): seller creates + funds PO collection on Billplz dashboard. FPX refunds are disbursements — Billplz never stores payer bank details, so the buyer form is mandatory.

---

## US-F43-07: OAuth Connect *(stretch — blocked on partner access)*

**Issue:** [#1918](https://github.com/primeproduction/ech-prime-web-v2/issues/1918)

**P2** | **L** | **Branch:** `feat/F43-07-billplz-oauth-connect` | **Blocked by:** `client_id/secret` from `team@billplz.com`

### Story

```
As a   SME Owner
I want a "Connect Billplz" button that logs me into Billplz and links my account via OAuth
So that I never manually copy API keys
```

### Acceptance Criteria

#### AC-1: Skeleton (buildable pre-credentials, behind `BILLPLZ_CLIENT_ID` flag)

```gherkin
GIVEN connect/start route
THEN  state = tenantId:nonce:exp + HMAC — nonce stored on tenant, ~10min TTL,
      single-use (consumed at callback) — NOT Stripe's eternal HMAC(tenantId)
      (leaked eternal state + attacker's code = attacker credentials on victim tenant)
  AND callback: verify HMAC+exp+nonce → delete nonce → POST /oauth/token
      (Doorkeeper: Basic client auth first, body-params fallback)
  AND disconnect → POST /oauth/revoke + null billplz* fields
```

#### AC-2: Credentials adapter (only after Billplz answers)

```gherkin
GIVEN confirmed contract (a: Bearer-on-API | b: credentials endpoint | c: token payload)
THEN  fetchMerchantCredentials(accessToken) implements THAT branch only
  AND billplzOauth* tenant fields added only if (a) needs them (no speculative schema)
  AND P1's BillplzAuth union makes (a) a call-site change, not a client rewrite
```

#### AC-3: UX parity with Stripe Connect

```gherkin
GIVEN BILLPLZ_CLIENT_ID configured
THEN  Connect button (new tab + BroadcastChannel + polling status route);
      absent env → UI identical to manual-keys flow
  AND redirect_uri frozen as /api/billplz/connect/callback BEFORE emailing Billplz
```

---

## US-F43-08: Docs + cross-phase hardening

**Issue:** [#1917](https://github.com/primeproduction/ech-prime-web-v2/issues/1917)

**P0** | **M** | **Branch:** `feat/F43-08-billplz-e2e`

### Story

```
As a   QC/Dev
I want a QA TC skeleton, spec-presence audit, and a hardening sweep over the Billplz phases
So that the feature is documented and verified before it ships
```

### Acceptance Criteria

```gherkin
GIVEN P2–P5 merged
THEN  docs/qa/F43.md TC skeleton exists; specs reference TC-IDs
  AND every new route has E2E spec in its owning phase's PR
      (skip-with-reason acceptable when sandbox creds absent — never fake a pass)
  AND hardening checklist green: no secrets in logs, timingSafeEqual,
      bill-id binding, PAID_AFTER_CANCEL marker, Stripe predicates exclude
      'billplz', i18n en+ms complete, env examples, check-migrations pass,
      maxDuration ≤ 60, nodejs runtime where crypto/formData used
  AND CI quality gates pass
```

---

## Dependency order

```
P1 schema+client → P2 connect → P3 checkout → P4 webhook → P5 lifecycle → P8 docs/hardening
P6 refund (stretch, independent) | P7 OAuth (stretch, blocked on Billplz partner)
```
