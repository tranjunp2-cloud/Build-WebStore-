---
title: "F43 — Billplz Payment Integration"
description: "Add Billplz (Malaysia hosted-checkout gateway) as a payment provider: merchant-keys connect, bill checkout, X Signature webhook, lifecycle jobs, plus stretch phases for OAuth Connect and refunds."
status: pending
priority: P1
effort: "~6-8d core (P0-P1) + stretch"
feature: F43
branch: research/billplz-payment-method
tags: [payments, billplz, malaysia, fpx, feature, backend, frontend]
created: 2026-10-05
---

# F43 — Billplz Payment Integration

> [!NOTE]
> **Provenance:** Dev-researched (no BA involvement yet). When BA joins: business context/scope/metrics → `docs/prd/F43-billplz-payment.md`; product decisions → PD-023/PD-024 in `docs/decisions/decisions-log.md`; stories → `docs/stories/F43-billplz-payment-stories.md` (BA-accept to mark Ready).

> **Source of truth:** [research.md](./research.md) — API, X Signature algorithm, endpoint probing results, fees, risks.
> **Convention:** 1 phase = 1 User Story = 1 branch = 1 PR into `staging`. Branch per phase: `feat/F43-XX-<slug>`.

## Goal

Buyer on a Billplz-enabled storefront picks "Billplz" at checkout → ECH creates a Bill → buyer pays on Billplz hosted page (FPX/wallet/card/BNPL) → webhook marks order paid. Sellers connect by pasting 3 keys (Phase 1) or OAuth (stretch Phase 7, blocked on Billplz partner access).

## Scope

**In scope (core):** schema + client lib, manual-key seller connect, checkout + redirect, webhook reconciliation, expiry/reconcile cron, order-status UX, E2E.

**Stretch (EXPANSION mode — planned, lower priority):** OAuth Connect (P7 — outreach + skeleton only until Billplz confirms the credentials contract), refund via Payment Order v5 (P6).

**Out of scope:** Billplz payouts/splits, subscription billing, non-MYR currency, bank-code bypass (no picker UX exists — reintroduce as its own phase when designed).

## Shared technical decisions (apply to all phases)

1. **Units:** codebase stores RM (major, 2dp) in `orders.*`; Billplz `amount` is **sen** — convert `Math.round(total * 100)` at the client boundary only. Never round-trip.
2. **Auth:** client takes `auth: {type:'basic', key} | {type:'bearer', token}` — Basic (`apiKey` as username, empty password) is the live path; the Bearer arm exists so OAuth hypothesis (a) (research.md §Phase 2) is a config change, not a client rewrite. Keys live on `tenant` with `access: { read: () => false }`; consumers re-fetch tenant per request (no caching).
3. **Env:** `BILLPLZ_API_BASE` (default `https://www.billplz.com/api`, sandbox `https://www.billplz-sandbox.com/api`) + `BILLPLZ_WEBHOOK_URL` (tunnel override, mirrors `XENDIT_WEBHOOK_URL`) → both go in `.env.staging.example` + `.env.production.example`.
4. **Order ↔ Bill linkage:** `reference_2_label='Order ID'`, `reference_2=String(order.id)`, plus `callback_url={base}/api/webhooks/billplz?o={orderId}`. `reference_1` stays reserved (unused — bank-code bypass out of scope).
5. **Webhook trust:** `?o=` or `reference_2` → order → tenant → `billplzXSignatureKey` → verify HMAC-SHA256 over whitelisted keys (sorted case-insensitive, `|`-joined, empty values dropped, `x_signature` excluded) → `timingSafeEqual`. **After verification, bind the signed bill id:** require `order.paymentProvider==='billplz'` AND `order.billplzBillId === params.id` — `?o=`/`reference_2` are unsigned and replayable, so they locate the order but never authorize it (signed params are visible to every paying buyer via the redirect URL). Status contract: unknown order → 200 + warn (test pings); bad signature / missing key / bill-id mismatch → 401 + error marker; always 200 after dispatch.
6. **Idempotency:** paid-state flip goes only through `reconcileOrderPaid` CAS (`UPDATE ... WHERE status='pending' RETURNING`). Duplicate checkout submits create duplicate *orders* (same as xendit — no provider idempotency key); mitigation = client submit lock + optional `orderId` resume in the checkout schema, documented in P3. When `paid==='true'` hits a **cancelled/terminal** order (CAS miss) → emit a dedicated `PAID_AFTER_CANCEL` error log + ops alert — never silent (money captured on a cancelled order).
7. **`paymentProvider: 'billplz'`** on orders; `paymentMethod` gets a new `'billplz'` enum value (PG enum — migration required). A distinct provider-named value is intentional (Xendit reused `'ewallet'` and renders "Xendit"); P3/P5 enumerate ALL consumers that must learn the new value: cancel/refund Stripe-by-elimination predicates, retry guard, expiry in-list, `ConfirmClient`/`confirm/page.tsx`, email `paymentMethodLabel` + prepaid checks, i18n `paymentMethods` (en+ms), `OrdersActionBar` filter, `OrderTrackingClient` label map.
8. **Connection = key presence, no toggles.** `billplzConnected = !!(apiKey && collectionId && xSignatureKey)` — same as Xendit (`!!xenditSecretKey`). Do NOT add `payments.payment_billplz` or `sites.paymentConfig.billplzEnabled`: `paymentConfig` has no app-code write path (admin-only dead toggles) and a tenant toggle duplicates what disconnect already does.
9. **Clone map:** `xendit-client.ts`→`billplz-client.ts`, `xendit.ts`→`billplz.ts` (subset), `XenditConnect*`→`BillplzConnect*`, `xendit-checkout/route.ts`→`billplz-checkout/route.ts`, `webhooks/xendit/`→`webhooks/billplz/`.

## Phases

| # | Phase | US | P | Status | Depends |
|---|-------|----|---|--------|---------|
| 1 | Schema + Billplz client lib | US-F43-01 | P0 | pending | — |
| 2 | Seller connect (manual keys) | US-F43-02 | P0 | pending | P1 |
| 3 | Checkout flow | US-F43-03 | P0 | pending | P1 |
| 4 | Webhook + reconciliation | US-F43-04 | P0 | pending | P1, P3 |
| 5 | Lifecycle: expiry/reconcile/status UX | US-F43-05 | P1 | pending | P3, P4 |
| 6 | Refund via Payment Order v5 *(stretch)* | US-F43-06 | P2 | pending | P4 |
| 7 | OAuth Connect *(stretch, blocked)* | US-F43-07 | P2 | pending | P2 + Billplz partner credentials |
| 8 | Docs + hardening pass *(specs live in owning phases)* | US-F43-08 | P0 | pending | P2–P5 |

## Success criteria (whole feature)

- [ ] Seller connects Billplz in <5 min via Settings → Payments (3 keys, validated server-side)
- [ ] Buyer completes FPX payment on Billplz hosted page; order flips to `new`/`paid` via webhook within seconds
- [ ] Missed webhook recovers via reconcile cron; expired orders delete their Billplz bill
- [ ] No secrets in logs/browser; all new fields have `db-setup.js` migrations; all new routes have E2E

## Open questions (carried from research)

1. OAuth: `client_id/secret` provisioning, what `access_token` unlocks (Bearer-on-API vs credential endpoint vs token payload), scopes, TTL/refresh → business emails `team@billplz.com` (list in research.md §Phase 2)
2. ~~Late payment after order expiry: manual refund vs revive order~~ → **DECIDED (Validation S1):** order stays cancelled, money is refunded to buyer (manual via `team@billplz.com` in v1, PO API in P6). Industry-standard: cancelled is cancelled — Shopee/Lazada auto-refund on post-cancel payment, never revive. Billplz docs confirm no auto-refund exists (FPX non-reversible; payer bank details not stored) — refund always requires collecting buyer bank details. `PAID_AFTER_CANCEL` detection + alert is the only code needed.
3. Sandbox test cards / simulated FPX → create sandbox account and verify

## Validation Log

### Session 1 — 2026-10-05
**Trigger:** `/ck:plan validate` post-red-team
**Questions asked:** 4 (+2 clarification rounds on late-payment)

#### Questions & Answers

1. **[Scope] Discount codes on Billplz path?**
   - **Answer:** Port full discount support — `applyDiscount` + `computeOrderTotal` from stripe-checkout; bill amount = discounted total (already in P3)
   - **Rationale:** displayed price must equal charged price; silent full-price charge is unacceptable

2. **[Scope] Keep P6 (Payment Order refund) as stretch?**
   - **Answer:** Yes — keep stretch P6; core ships `BILLPLZ_MANUAL_REFUND` 422 guard in P5
   - **Rationale:** PO needs seller pre-fund + buyer bank PII; defer until real demand

3. **[Tradeoff] payment-status throttle?**
   - **Answer:** 30s remote-GET cache per order
   - **Rationale:** stays under ~100 GET/5min Billplz limit; webhook normally flips order before buyer polls

4. **[Policy] Paid-after-cancel handling?**
   - **Answer:** 3-layer solution — (1) `deleteBill` on every cancel path minimizes the window (P5); (2) `PAID_AFTER_CANCEL` error marker + seller alert when payment still lands — order stays cancelled, NEVER auto-revive (P4); (3) seller refunds buyer — v1 manual (`team@billplz.com`/dashboard, same as COD/BT refunds today), P6 stretch upgrades to semi-auto (auto-email buyer bank-details form → Payment Order disburse)
   - **Rationale:** cancelled is a business decision (restock done, buyer emailed); no major platform resurrects cancelled orders. Billplz docs confirm FPX is non-reversible and payer bank details are never stored → fully-automatic refund is impossible on this rail; max automation = PO disbursement + buyer form.

#### Confirmed Decisions
- Discount: full port from stripe-checkout
- Refund: manual-guard in P5, PO semi-auto flow stays stretch P6
- payment-status: 30s throttle
- Late payment: 3-layer — prevent (deleteBill) / detect (`PAID_AFTER_CANCEL`) / resolve (manual refund now, semi-auto in P6)

#### Action Items
- [x] P4: `PAID_AFTER_CANCEL` already specified — add explicit "order stays cancelled, seller refunds" policy note

#### Impact on Phases
- Phase 4: clarify PAID_AFTER_CANCEL = terminal (no revive path ever)

## Red Team Review

4 hostile reviewers (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic) → 34 raw findings → 25 unique after dedup, all evidence-backed (`file:line` verified). **0 rejected; 22 accepted, 3 accepted-modified.** All applied to the phase files. Headline items:

- **Critical ×3:** webhook replay via unsigned `?o=`/`reference_2` (now binds `billplzBillId === params.id` post-verify — P4); paid-after-cancel was silent (now `PAID_AFTER_CANCEL` marker + alert — P4); Stripe-by-elimination in `cancel`/`refund` would trap paid Billplz orders (explicit `paymentProvider` guards — P5).
- **High ×9:** `paymentMethod:'billplz'` consumer enumeration (emails/i18n/filters/tracking — P3/P5); `hasPaymentMethods` extended at both sites (P3); notify-owner guard keyed on `paymentProvider` not `paymentStatus` (protects bank_transfer — P3); discount codes ported from stripe-checkout instead of silently charging full price (P3); `deleteBill` on all cancel paths not just expiry (P5); retry voids old bill (P5); dead idempotency guard → real `orderId` resume (P3); `confirm/page.tsx` must pass `paymentProvider` (P5); OAuth `state` needs nonce+TTL+single-use instead of eternal `HMAC(tenantId)` (P7).
- **Medium ×13:** persist `billplzBillId` inside createBill try-block; dispatch on `paid==='true'` alone; uniform status contract (unknown→200, bad-sig→401); global rate-limit budget incl. payment-status throttle; `saveBillplzKeys` consistent network-error semantics; drop dead `billplzData` slot (→ `bankTransactionId`), forbid `xenditChannelCode` pollution; `auth` union in client; **dropped both dead toggles** (`payment_billplz`, `billplzEnabled`) — gate on key presence; P8 collapsed to docs+hardening (specs stay in owning phases); P7 reduced to outreach+skeleton pending contract; bank-code bypass removed from P3; order-waiting reminder + refund-route 422 guard added (P5).
