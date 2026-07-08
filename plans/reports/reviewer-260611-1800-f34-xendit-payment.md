# Code Review: F34 Xendit Payment Integration

**Branch:** `feat/f34-xendit-payment`
**Reviewer:** code-reviewer
**Date:** 2026-06-11
**Score: 7.5 / 10**

---

## Overall Assessment

The core payment plumbing — xenditFetch, createPaymentRequest, reconcileOrderPaid CAS, webhook verification, DB migrations — is well-structured and correct. Critical NFRs (MYR unit, idempotency, Stripe backwards compat) are all addressed. One **blocking UI bug** prevents the feature from working in production at all: the connect button always shows an error due to a response-shape mismatch in the client component.

---

## Critical Issues (blocking merge)

### 1. XenditConnectBlock: response parsing mismatch breaks the connect button entirely

**File:** `src/app/(dashboard)/settings/payments/XenditConnectBlock.tsx` lines 69–76

The connect API returns `{ success: true, data: { xenditAccountId, status, onboardingUrl } }` but the client reads `data.onboardingUrl` directly (where `data` is the full response body, not the nested `data` object).

```ts
// Current (broken):
const data = await res.json()
if (!res.ok || !data?.onboardingUrl)   // data.onboardingUrl is always undefined
    setConnectError(...)               // ← always triggers
    return                             // ← window.open never called

// Fix:
const body = await res.json()
if (!res.ok || !body?.data?.onboardingUrl) {
    setConnectError(body?.error?.message ?? body?.error ?? 'Không thể khởi tạo kết nối Xendit.')
    return
}
setOnboardingUrl(body.data.onboardingUrl)
window.open(body.data.onboardingUrl, '_blank')
onConnected?.(body.data.xenditAccountId ?? '', 'INVITED')
```

Same fix needed in `handleResend` (lines 93–96): `data.onboardingUrl` → `body.data.onboardingUrl`.

**Impact:** Clicking "Kết nối Payment" always shows error "Không thể khởi tạo kết nối Xendit." even when the API succeeds and the Xendit account was created. The merchant cannot proceed with onboarding from the UI.

---

## High Priority Issues (non-blocking, should fix before GA)

### 2. Concurrent POST /api/xendit/connect — race creates duplicate Xendit sub-accounts

**File:** `src/app/api/xendit/connect/route.ts` lines 37–88

Two concurrent requests for the same `tenantId` both read `tenant.xenditAccountId = null`, both call `createManagedAccount()`, and both receive a Xendit account. The second `payload.update()` overwrites the first. The first Xendit account is now orphaned (costs Xendit slot, no reachable credentials).

The window is narrow in production but the Tenants collection has no `unique` constraint on `xenditAccountId`, and there is no `UPDATE WHERE xenditAccountId IS NULL` guard.

**Fix:** Add `unique: true` to the `xenditAccountId` field in `Tenants.ts` and a corresponding migration `ALTER TABLE tenants ADD CONSTRAINT tenants_xendit_account_id_unique UNIQUE (xendit_account_id);`. The second concurrent call will then fail at the DB level and the first write wins cleanly.

Alternatively, add a unique constraint only via migration (no Payload schema change needed for field-level enforcement).

### 3. SHOPEEPAY and CARDS channels: schema/DB/UI gap — can never be enabled

**Files:**
- `src/app/api/orders/xendit-checkout/build-enabled-channels.ts` lines 8–9, 20–21
- `src/lib/validations/orders.ts` line 35
- `src/collections/Tenants.ts` (missing `xendit_shopeepay`, `xendit_cards` fields)
- `scripts/db-setup.js` (missing migrations for these columns)

`buildEnabledChannels()` references `payments.xendit_shopeepay` and `payments.xendit_cards`, and the checkout validation schema allows `channelCode: 'SHOPEEPAY' | 'CARDS'`. But neither field exists in the Tenants collection definition nor in `db-setup.js`, so they can never be set to `true`. Any checkout attempt with those channels will always return `CHANNEL_DISABLED`.

This is dead code that will be confusing when someone tries to add ShopeePay or Cards support later. If these are intentionally deferred (out of F34 scope), remove the references and narrow the `channelCode` enum to the four enabled channels. If in-scope, add the fields + migrations + UI toggles.

### 4. No test coverage for Xendit flows

All Stripe routes have dedicated unit tests (`stripe-checkout.test.ts`, `stripe-webhook.test.ts`, `stripe-refund.test.ts`, etc.). F34 introduces equivalent complexity — checkout, webhook, retry, refund, reconcile cron — with zero corresponding tests.

Minimum required coverage before GA:
- `xendit-checkout`: happy path (redirect), happy path (QR), stock compensation on Xendit API failure, XENDIT_NOT_READY guard
- `webhooks/xendit`: valid vs invalid token, `payment.capture` reconcile, `payment.failure` status update, `account.activated` status sync
- `retry-payment-xendit`: Xendit path dispatched correctly, new PR id persisted
- `reconcile-orders` Xendit pass: SUCCEEDED triggers reconcile, non-SUCCEEDED is skipped

### 5. reconcile-orders: shared deadline between Stripe and Xendit passes

**File:** `src/lib/jobs/reconcile-orders.ts`

The 50-second deadline is set once before the Stripe loop and shared with the Xendit loop. Under a Stripe backlog of 50 slow orders (each with a 1–2s Stripe API call), the Xendit loop may time out before processing any orders. This is recoverable (next cron run handles the tail), but the Xendit summary `timedOut` flag is not surfaced separately — it's the same shared `timedOut` variable.

Consider setting a separate deadline per provider or initialising `deadline` immediately before each loop.

---

## Minor Issues (informational)

### M1. Refund: missing stock restock on Xendit API failure

**File:** `src/app/api/orders/[id]/refund/route.ts` lines 220–227

The Stripe refund path does a DB rollback on API failure (restoring `status` and `paymentStatus`). The Xendit refund path correctly commits CAS first, but on Xendit API failure it returns `502` without restocking inventory. The order is DB-refunded but stock is not returned.

This is documented ("ops manual reconcile") and the comment is clear. Acceptable for v1, but the ops runbook should explicitly call out the restock step.

### M2. XENDIT_NO_ACTION path: order left in DB vs. other failure paths that delete

**File:** `src/app/api/orders/xendit-checkout/route.ts` lines 193–195

When Xendit returns no usable action (no `PRESENT_TO_CUSTOMER` or `REDIRECT`), stock is restocked and `paymentStatus` is set to `payment_failed`, but the order is NOT deleted (unlike the stock-OOS and Xendit-API-error paths that call `payload.delete()`). The order stays as `status=pending, paymentStatus=payment_failed`.

This is fine because `payment-expiry` cron picks it up (`paymentStatus=payment_failed` is in the expiry set). However the inconsistency between failure paths (some delete, some don't) may cause confusion. Consider marking it `status=cancelled` immediately instead of waiting for the cron.

### M3. XenditConnectBlock polling: no refresh=1 — staleness window = webhook latency

**File:** `src/app/(dashboard)/settings/payments/XenditConnectBlock.tsx` line 38

The status poll hits `/api/xendit/connect/status` without `?refresh=1`, so it reads the DB-cached status. Status transitions only on webhook delivery (which Xendit guarantees but may lag). This is intentional and documented. However if a merchant's webhook is misconfigured and Xendit events are not received, the UI will stay stuck in a pending state indefinitely with no user-facing hint. A "Refresh now" button that appends `?refresh=1` (already supported by the API) would help.

### M4. Free order: `paymentProvider='xendit'` is semantically misleading

**File:** `src/app/api/orders/xendit-checkout/route.ts` line 106

A 100% discounted "free" order set `paymentProvider='xendit'` even though no Xendit API call was made. This is safe operationally (status='paid', cron won't touch it, refund route handles free orders via bank_transfer/cod fallback). But it may produce confusing dashboard analytics and the refund path would try to read `xenditPaymentRequestId` (which is null) before the `XENDIT_NOT_REFUNDABLE` guard fires. Consider `paymentProvider: null` or a `free` provider value.

### M5. connect/route.ts: `businessName` uses `tenant.name` which may be undefined

**File:** `src/app/api/xendit/connect/route.ts` line 80

`tenant.name as string` — if `tenant.name` is null/undefined in the DB (the field is `required: true` in schema but `as string` bypasses type checking), Xendit would receive an empty business name. Low probability but worth adding `tenant.name || 'Unknown'`.

---

## Positive Findings

1. **MYR unit handling** — Consistently correct throughout. Every touch point has a comment explaining RM major unit. `Math.round(p.amount * 100) / 100` for 2dp rounding is correct and applied uniformly.

2. **Timing-safe token comparison** — `verifyXenditCallbackToken` correctly handles length mismatch before `timingSafeEqual` (required to avoid panics). This is implemented properly.

3. **IDOR guards** — Both connect routes check `userTenantIds.includes(String(tenantId))` before acting. The refund route does the same.

4. **CAS idempotency** — `reconcileOrderPaid` uses `WHERE status='pending' RETURNING id` correctly as the single-winner. The Xendit refund path uses the same pattern. No double-processing under concurrent webhook + cron + poll.

5. **Webhook always-200** — `payment-updated.ts` catches all handler errors and always returns 200 with correct comment explaining retry-storm prevention.

6. **Stock compensation** — Correctly compensated in checkout on both Xendit API failure and OOS failure. The two-phase pattern (decrement → attempt Xendit → on failure restock + delete) is clean.

7. **DB migrations** — All four core Xendit columns (`xenditAccountId`, `xenditAccountStatus`, `xenditOnboardingComplete`, index) and all three tenant payment toggles (`xendit_tng/grabpay/duitnow/fpx`) and both order columns (`xenditPaymentRequestId`, `xenditChannelCode`, `paymentProvider`) are present in `db-setup.js` as additive `ALTER TABLE ADD COLUMN IF NOT EXISTS`.

8. **Backwards compat** — `ReconcileContext.session?`, `connectedAccountId?` made optional. Stripe flow untouched (confirmed by existing test suite). `payment-expiry` includes `ewallet` paymentMethod for Xendit TNG/GrabPay/DuitNow cleanup.

9. **Shared `reconcileOrderPaid`** — Xendit webhook, retry, and cron all funnel through the same idempotent function. Single source of truth for order→paid transition.

10. **File sizes** — All new files are under 200 lines (xendit-checkout/route.ts is exactly 201 but functionally one unit).

---

## Recommended Actions

| Priority | Action | File |
|---|---|---|
| CRITICAL | Fix `data.onboardingUrl` → `body.data.onboardingUrl` in handleConnect + handleResend | `XenditConnectBlock.tsx` |
| HIGH | Add `unique` constraint on `tenants.xendit_account_id` to prevent concurrent-connect orphan | `Tenants.ts` + `db-setup.js` |
| HIGH | Remove dead SHOPEEPAY/CARDS code or add full schema + migration + UI for them | `build-enabled-channels.ts`, `Tenants.ts`, `db-setup.js` |
| HIGH | Add xendit-specific unit tests (checkout, webhook, retry, reconcile) | `src/__tests__/api/` |
| LOW | Separate deadline per provider in `reconcile-orders` | `reconcile-orders.ts` |
| LOW | Mark XENDIT_NO_ACTION order as `cancelled` instead of leaving `status=pending` | `xendit-checkout/route.ts` |

---

## Unresolved Questions

1. Are SHOPEEPAY and CARDS intentionally deferred (F34 Phase 2) or accidentally incomplete? If deferred, narrow the `channelCode` enum and remove dead toggles in `buildEnabledChannels`.
2. Has the Xendit MYR API behaviour been confirmed in sandbox (as noted in `TODO(sandbox)` comment in `buildPaymentMethod` for FPX shape)?
3. Is there a Xendit IP allowlist for the webhook? The route currently accepts tokens from any IP — Xendit publishes IP ranges that could be added as an extra defence layer.
