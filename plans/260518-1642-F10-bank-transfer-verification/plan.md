---
title: "F10 v2.2 — Bank Transfer 3-step Async Verification"
description: "Replace v2.1 auto-Paid Bank Transfer with awaiting_payment → pending_verification → paid lifecycle, magic-link post-order upload, seller verify UI, 24h TTL auto-cancel."
status: pending
priority: P1
effort: 5d
branch: feat/F10-1004-bank-transfer-verification
tags: [F10, orders, payments, bank-transfer, magic-link, cron]
created: 2026-05-18
---

# F10 v2.2 — Bank Transfer 3-Step Async Verification

PRD: `docs/prd/F10-orders-management.md` §3.1, §9.2, FR-14→FR-22, BR-Payment-03→08, AC-4→9, §13.1–13.3
Decision: PD-018 · Issue GH-1004 · Branch: `feat/F10-1004-bank-transfer-verification`

## Goal

Đổi v2.1 "upload-proof-at-checkout → auto-Paid" thành 3-step async với verification gate: buyer place order (no proof) → email magic link → buyer upload proof post-order → seller approve/reject → 24h TTL auto-cancel. Inventory reserve thay vì decrement cho đến khi Approve.

## Non-Goals (out-of-scope this plan)

- WhatsApp notification (Wave 7+)
- Open Banking auto-verify (Wave 8+ — schema dự phòng `verificationSource`/`autoVerifiedAt`/`bankTransactionId`)
- Bulk Approve pending_verification (D-14 — sau v2.2 ship)
- COD flow changes (parity confirmed D-12)
- Stripe/F13

## Phase summary

| # | Phase | File | Effort | Status | Owner | Blocks |
|---|-------|------|--------|--------|-------|--------|
| 01 | DB Schema + Collection | [phase-01-db-schema.md](./phase-01-db-schema.md) | 0.5d | pending | fullstack | — |
| 02 | Checkout API rewrite (BT branch) | [phase-02-checkout-api.md](./phase-02-checkout-api.md) | 0.75d | pending | fullstack | P01 |
| 03 | Magic Link JWT + Email templates | [phase-03-magic-link-email.md](./phase-03-magic-link-email.md) | 0.75d | pending | fullstack | P01 |
| 04 | Post-Order Upload Page (storefront) | [phase-04-post-order-upload-page.md](./phase-04-post-order-upload-page.md) | 1.0d | pending | fullstack | P01, P02, P03 |
| 05 | Background Cron: payment-expiry | [phase-05-background-job.md](./phase-05-background-job.md) | 0.5d | pending | fullstack | P01 |
| 06 | Seller Dashboard verify UI + APIs | [phase-06-seller-dashboard.md](./phase-06-seller-dashboard.md) | 1.5d | pending | fullstack | P01, P03 |

Critical path: P01 → P02 → P03 → P04. P05 and P06 can run after P03 in parallel with P04 (different file globs).

## Dependency graph

```
P01 (schema) ─┬─► P02 (checkout) ─► P04 (upload page)
              ├─► P03 (jwt+email) ─┤
              ├─► P05 (cron job)   │
              └─► P06 (seller UI) ─┘
```

## File ownership (parallel-safe)

| Phase | Owns | Reads only |
|-------|------|------------|
| P01 | `src/collections/Orders.ts`, `scripts/db-setup.js` (Orders block) | — |
| P02 | `src/app/api/orders/checkout/route.ts`, `src/lib/validations/orders.ts`, `src/lib/payment/reference.ts` (NEW) | P01 schema |
| P03 | `src/lib/auth/order-token.ts` (NEW), `src/lib/email/templates/bank-transfer-instructions.ts` (NEW), `src/lib/email/templates/payment-confirmed.ts` (NEW), `src/lib/email/templates/payment-rejected.ts` (NEW), `src/lib/email/templates/order-expired.ts` (NEW) | — |
| P04 | `src/app/sites/[slug]/orders/[id]/page.tsx` (NEW), `src/app/sites/[slug]/orders/[id]/UploadClient.tsx` (NEW), `src/app/api/orders/[id]/upload-proof/route.ts` (NEW) | P03 token util |
| P05 | `src/lib/jobs/payment-expiry.ts` (NEW), `src/app/api/cron/payment-expiry/route.ts` (NEW), `vercel.json` (crons array) | P01 schema |
| P06 | `src/app/(dashboard)/orders/_components/*` (NEW: `ManualPaymentVerificationBlock.tsx`, `RejectPaymentModal.tsx`, `AwaitingVerificationChip.tsx`), `src/app/api/orders/[id]/approve-payment/route.ts` (NEW), `src/app/api/orders/[id]/reject-payment/route.ts` (NEW) | existing OrderDetailDrawer |

No phase touches the same file as another phase. Updates to `src/app/(dashboard)/orders/page.tsx` and the existing OrderDetailDrawer (insert block) belong to P06.

## Data flow (high level)

```
Checkout (P02)
  POST /api/orders/checkout {paymentMethod:'bank_transfer'}
    → reserve stock (no decrement)
    → generate paymentReference BT-XXXXXX (P02 util)
    → magicLinkSecret = crypto.randomBytes(32)
    → paymentExpiresAt = now + 24h
    → paymentStatus='awaiting_payment'
    → sign JWT (P03) → send email (P03)
  returns {orderId, slug, redirectUrl: '/sites/[slug]/orders/[id]?token=...'}

Buyer opens magic link (P04)
  GET /sites/[slug]/orders/[id]?token=JWT
    → verify JWT against order.magicLinkSecret (P03)
    → render state based on paymentStatus
  POST /api/orders/[id]/upload-proof {token, mediaId}
    → re-verify JWT
    → must be in {awaiting_payment, pending_verification}
    → set paymentProofImage + paymentStatus='pending_verification'
    → notifyTenantOwners + email seller (fire-and-forget)

Seller verify (P06)
  PATCH /api/orders/[id]/approve-payment
    → paymentStatus='paid', paymentVerifiedAt=now, paymentVerifiedBy=user.id
    → status pending → confirmed
    → decrement inventory (commit reservation)
    → email buyer "Payment Confirmed"
  PATCH /api/orders/[id]/reject-payment {reason, detail?}
    → paymentStatus='awaiting_payment'
    → paymentRejectionReason/Detail saved
    → paymentExpiresAt = now + 24h (reset)
    → magicLinkSecret rotated (invalidate old JWT)
    → re-sign new JWT → email buyer with new link

Cron (P05) — every 15 min
  WHERE paymentStatus IN ('awaiting_payment','pending_verification')
    AND paymentExpiresAt < now
    AND paymentMethod = 'bank_transfer'
  → status='cancelled', paymentStatus='cancelled'
  → restock (only if not already decremented — reservation rollback)
  → email buyer "Order Expired"
```

## State machine — `paymentStatus` (Bank Transfer)

```
awaiting_payment ──upload──► pending_verification
       ▲                            │
       │ reject                     │ approve
       └────────────────────────────┤
                                    ▼
                  cancelled       paid (terminal for paymentStatus)
                  (timeout/reject-after-expiry)
```

Invariants:
- `paid` is forward-only (no reverse to awaiting).
- `cancelled` (payment) terminal except for explicit refund (out of scope here).
- `paymentRejectionReason` cleared on next upload (P04) so seller sees fresh proof state.

## Backwards compatibility

- Existing `qr_banking` orders: data migration in P01 backfills `payment_method='bank_transfer'` for rows where `payment_method='qr_banking'`. Both enums kept in collection options during transition (`qr_banking` marked deprecated, read-only).
- Existing `paymentStatus='paid'` orders from v2.1 stay `paid` — not touched by cron (filter requires `awaiting_payment`/`pending_verification`).
- CheckoutClient (`src/app/sites/[slug]/checkout/CheckoutClient.tsx`): P02 instructs Client to drop the in-checkout upload form for `bank_transfer` (small client diff — handled inside P02's "FE adapter" sub-step to keep P02 atomic per file ownership; if conflict with active design work emerges, move to its own P02b).
- Old confirm route `/sites/[slug]/order/[id]/confirm` stays for COD and for backward compat of links already in the wild. New BT redirect goes to `/sites/[slug]/orders/[id]?token=...`.

## Test matrix

| Layer | What | Phase |
|-------|------|-------|
| Unit | `generatePaymentReference()` excludes 0/O/I/1, format `BT-` + 6 alphanum | P02 |
| Unit | `signOrderToken` / `verifyOrderToken` happy + expired + tampered | P03 |
| Unit | `paymentExpiryJob` returns ids of expired BT orders only (not COD, not paid) | P05 |
| Unit | Reject schema: `other` requires detail ≥10 chars | P06 |
| Integration | Checkout BT creates order w/ awaiting_payment, no decrement, paymentReference set | P02 |
| Integration | Upload proof transitions to pending_verification only when token valid + status allows | P04 |
| Integration | Approve flow: paymentStatus→paid, status→confirmed, inventory decrement | P06 |
| Integration | Reject flow: status revert, magicLinkSecret rotates, new email sent | P06 |
| Integration | Cron expires only matching orders, restocks 0 (already reserved), emails buyer | P05 |
| E2E (manual) | Full happy: checkout → email → upload → approve | All |
| E2E (manual) | Reject loop → re-upload → approve | P04+P06 |
| E2E (manual) | TTL expiry → auto-cancel | P05 |
| E2E (manual) | Expired magic link → error state | P04 |

## Risk + mitigation (cross-phase)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Stock oversell because reservation is logical (no separate counter) | M | H | P02 still validates `inventory >= qty` at checkout; decrement only on Approve. Race accepted because seller-paced approval; if BT volume spikes, add `reservedStock` field as follow-up. |
| JWT secret leaked via email forwarding | M | M | Per-order `magicLinkSecret` (rotates on reject). Link scoped to `orderId` claim. No PII in token. |
| Cron not firing on Vercel (region/timezone) | L | H | Add structured log + alerting. Idempotent job (status guards prevent double-cancel). |
| Email delivery delayed → buyer can't find link | M | M | Magic link URL also returned in checkout API response so buyer can be redirected immediately. |
| paymentMethod enum rename breaks existing CMS queries | M | M | Keep `qr_banking` as deprecated option; backfill via migration; do grep audit of code references. |
| Re-upload after Reject not invalidating old proof | L | M | P04 PATCH replaces `paymentProofImage` (overwrite, not append). Clear rejection fields on new upload. |

## Rollback plan (per phase)

| Phase | Rollback |
|-------|----------|
| P01 | DB migrations are additive (`ADD COLUMN IF NOT EXISTS`, no drops). Revert collection schema PR — columns remain (harmless). |
| P02 | Revert route; legacy v2.1 behavior returns. New schema columns remain unused. |
| P03 | Revert lib files; nothing else imports them yet. |
| P04 | Remove new route folder; magic link 404 → fall back to confirm page link in email if needed. |
| P05 | Remove cron entry in `vercel.json`; route returns 410 Gone. Expired orders accrue until manual seller cancel. |
| P06 | Remove component imports from dashboard page; APIs return 410. Seller falls back to manual status edit via existing PATCH. |

## Success criteria (overall)

- AC-4 → AC-9 all pass on staging.
- `npm test` green; coverage on new lib files ≥80%.
- Zero auto-Paid Bank Transfer orders in staging logs for 48h after deploy.
- Cron runs visible in Vercel cron dashboard with non-error logs every 15 min.
- Schema migration check (`scripts/check-migrations.js`) green in CI.

## Open questions

- Q1: Email sender identity per tenant (use tenant's configured `MAIL_FROM` or platform default)? Assume platform default — confirm with PM.
- Q2: When seller Rejects after expiry already triggered (race), do we allow Reject? Plan assumes Reject blocked if `paymentStatus ∉ {pending_verification}`. Confirm.
- Q3: PRD §10.4 mentions anti-fraud warning (FR-24) but FR-24 not in §7 table. Treat as advisory copy text — not a new FR. Confirm.
- Q4: Should buyer email show both magic link AND a plaintext fallback URL? Plan uses magic link only (signed). Confirm.
