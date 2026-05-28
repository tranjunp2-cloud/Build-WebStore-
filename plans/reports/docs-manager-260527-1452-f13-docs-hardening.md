# F13 Payment Gateway — Docs Hardening Report

**Date:** 2026-05-27 14:52  
**Task:** Update F13 documentation for Wave 6.5 Stripe Flow Hardening  
**Branch:** docs/F26-design-content-localization  
**Status:** DONE

---

## Summary

Updated 4 core F13 documentation files to sync with production code reality and incorporate Wave 6.5 hardening scope (atomic webhook, oversell flag, confirm polling, cron reconcile, retry payment). Applied drift corrections across PRD, Architecture, QA, and Stories. Added 2 new stories (US-F13-05, US-F13-06), 16 new test cases (TC-F13.142–157, NHÓM 16), and comprehensive architecture sections covering Wave 6.5 flows. All files now v1.2–2.0 with updated timestamps and cross-references.

---

## Files Changed

### 1. `/docs/prd/F13-payment-gateway.md` (v1.1 → v1.2)

**Version bump & plan link:**
- Updated to v1.2, dated 2026-05-27
- Added Plan cross-link: `plans/260527-1410-f13-stripe-flow-hardening/plan.md`

**Story Traceability:**
- Added US-F13-05 (Khôi phục thanh toán dở dang) — Status: Ready
- Added US-F13-06 (Xác nhận thanh toán đáng tin cậy) — Status: Ready

**Scope corrections:**
- Clarified Wave 6 fee=0 (cross-border limitation); 3% deferred Wave 7+
- Added Wave 6.5 hardening scope block: 8 new FRs (FR-16 through FR-23)

**Functional Requirements (FR-01 to FR-23):**
- Reorganized into Wave 6 (core, FR-01–15) + Wave 6.5 (hardening, FR-16–23)
- **FR-16:** Atomic webhook `status='new'` + `paymentStatus='paid'`
- **FR-17:** Atomic stock decrement
- **FR-18:** Oversell flag + seller manual refund (no auto-refund)
- **FR-19:** Accurate payment method (card vs fpx from PaymentIntent)
- **FR-20:** Cart preservation on cancel; clear only on success
- **FR-21:** Confirm polling + self-heal + payment_failed state
- **FR-22:** "Pay Now" retry on pending/payment_failed
- **FR-23:** Cron reconcile late webhooks + expire stale

**Business Rules:**
- Added BR-04: Cart cleared only after confirmed success
- Added BR-05: Oversell handled manually, no auto-refund Wave 6.5

**Technical Architecture:**
- Corrected endpoint: `/api/orders/stripe-checkout` (not `/api/orders/create`)
- Endpoint documented in §13 code example with Wave 6 fee=0 comment

**Endpoint change:**
- Updated all endpoint references from `/api/orders/create` to `/api/orders/stripe-checkout`

**Fee model:**
- Removed 3% fee from §13 code example
- Added Wave 7+ forward reference

**Known Limitations:**
- Expanded table with Wave 6.5 context (oversell handling, advanced reconciliation deferred)

---

### 2. `/docs/architecture/F13-payment-gateway.md` (v1.0 → v2.0)

**Version bump & scope:**
- Updated to v2.0, dated 2026-05-27, tagged "Wave 6–6.5"
- Updated plan link to hardening plan

**Overview (§1):**
- Corrected: Wave 6 fee=0 (cross-border limitation)
- Clarified: Webhook sets `status='new'` AND `paymentStatus='paid'` atomically (no longer "pending → new" only)
- Added: Confirm polling + cron reconcile for late webhooks (v2.0 addition)

**Data Flow rewrite (§2):**

- **§2.1** (Buyer checkout): 
  - Endpoint corrected: `/api/orders/stripe-checkout`
  - Fee=0 documented with Wave 7+ forward reference
  - Cart cleared ONLY after confirmed success (§9.1a), not before redirect
  - Real `success_url` format with `session_id` param

- **§2.3** (Webhook rewrite): 
  - Now describes REAL handlers: `payment_success`, `payment_failed`, `account_updated`, `account.application.deauthorized`, `subscription_updated`
  - payment_failed handler described (was "out of scope" in drift)
  - account.deauthorized handler described (locks toggles)

- **§2.4 NEW** (Reconcile shared artifact):
  - Single source of truth: `reconcileOrderPaid(payload, orderId, context)`
  - Atomic `status='new'`, `paymentStatus='paid'`, stock decrement, oversell flag, emails, notifications
  - Called by: webhook, confirm polling, cron
  - Oversell handling: inventory<qty → flag + SYSTEM_ALERT (no auto-refund)

- **§2.5 NEW** (Confirm polling):
  - Active reconcile: if Stripe=paid but order=pending, self-heal via reconcile
  - Polling every 2s, 15min timeout

- **§2.6 NEW** (Retry payment):
  - `/api/orders/[id]/retry-payment` endpoint
  - Guards state (pending/payment_failed), re-validates stock, new session

- **§2.7 NEW** (Cron reconcile):
  - `/api/cron/reconcile-orders` endpoint
  - Reconciles pending >15min, expires stale >24h
  - CRON_SECRET auth

**Components Map (§3):**
- Added `reconcile-order.ts` (new, shared artifact)
- Added `payment-status` endpoint (new)
- Added `retry-payment` endpoint (new)
- Added `cron/reconcile-orders` endpoint (new)
- Updated Orders schema fields (new: `oversellReview`)
- Marked components as Wave 6 (existing) vs Wave 6.5 (new)

**Schema (§4):**
- Added §4.2 (Order payment fields):
  - `paymentStatus: 'pending' | 'paid' | 'payment_failed' | 'refunded'` (atomic with status='new')
  - `stripeSessionId` (UNIQUE, idempotency key)
  - `stripePaymentIntentId` (for method detection)
  - `oversellReview: boolean` (oversell flag)
- Updated migration section (§4.3) with Wave 6.5 columns
- Added migration note per `.claude/rules/database-schema.md`

**Environment Variables (§5):**
- Added `CRON_SECRET` (Vercel cron auth, Wave 6.5)
- Marked as required Wave 6.5

**Application Fee (§7):**
- Rewrite: Wave 6 fee=0 (cross-border), Wave 7+ revisit
- Removed fee rounding code (deferred Wave 7+)

**NEW §8: Vercel Cron Configuration**
- `vercel.json` crons array example
- CRON_SECRET auth via bearer token
- Per `.claude/rules/vercel-deploy.md` safety notes (don't change git.deploymentEnabled)

**Idempotency (§6.2 rewrite):**
- Now describes IMPLEMENTED atomic `UPDATE WHERE status='pending'`
- Raw SQL bypasses Payload hooks (tradeoff noted)
- Webhook retries via state machine guard (second invocation skips)

**Testing Strategy (§15):**
- Expanded: Wave 6.5 tests for reconcile, oversell, polling, cron, retry
- Integration tests now include webhook handlers, polling endpoint, cron endpoint

**Rollout Strategy (§16):**
- Phases 01–04 = Sprint 1 (blocker fixes)
- Phases 05–07 = Sprint 2 (UX + reconciliation)

**Known Limitations (§17):**
- Updated table with Wave 6.5 context and timing notes

---

### 3. `/docs/qa/F13-payment-gateway.md` (v1.5 → v1.6)

**Version bump:**
- Updated to v1.6, dated 2026-05-27
- Changelog: Wave 6.5 hardening + drift corrections

**Drift corrections applied across existing TCs:**

1. **Endpoint name:** 
   - TC-F13.01, .57, .58: `/api/orders/create` → `/api/orders/stripe-checkout`

2. **Fee=0 (Wave 6, not 3%):**
   - TC-F13.04: Corrected to "NO application_fee_amount Wave 6; fee=0; 3% deferred Wave 7+"
   - TC-F13.05: Corrected to "Wave 6 fee=0, no rounding needed"
   - TC-F13.63: Updated to "Wave 6 fee=0; rounding deferred Wave 7+"

3. **Status contract:**
   - §3 Test Environment: Updated contract to "`status='new'` AND `paymentStatus='paid'` (atomic on webhook)"
   - TC-F13.02: Updated expected result to atomic status + paymentStatus + stock decrement
   - TC-F13.09: Updated to atomic status + paymentStatus
   - TC-F13.33: Updated to FR-16 + atomic UPDATE WHERE

**New NHÓM 16 (Wave 6.5 Flow Hardening):**
- **TC-F13.142–157** (16 new TCs, continuing from .141)
- Each TC maps to FR-16 through FR-23 (Wave 6.5 FRs)
- Coverage:
  - .142–143: FR-16 (atomic webhook)
  - .144: FR-17 (atomic stock)
  - .145–146: FR-18 (oversell flag + refund button)
  - .147: FR-19 (payment method accuracy)
  - .148–149: FR-20 (cart handling)
  - .150–152: FR-21 (confirm polling + self-heal)
  - .153–154: FR-22 (pay now retry)
  - .155–157: FR-23 (cron reconcile + schema)

**Traceability Summary (§8):**
- Added Wave 6.5 FRs (FR-16 through FR-23) with TC mappings
- Total TC count now 157 (was 141)

---

### 4. `/docs/stories/F13-payment-gateway-stories.md` (no version, added 2 stories)

**Added US-F13-05: Khôi phục thanh toán dở dang (Wave 6.5)**
- Status: Ready
- As: Buyer who didn't finish paying
- Maps FR-20, FR-21, FR-22
- ACs:
  - AC-1: Cancel preserves cart + BM toast
  - AC-2: Confirm polling + processing state
  - AC-3: Pay Now on order detail (re-validate stock)
  - AC-4: Cart cleared only after confirmed success
- DoD: E2E tests, BM toast, polling with delay, stock validation, i18n

**Added US-F13-06: Xác nhận thanh toán đáng tin cậy (Wave 6.5)**
- Status: Ready
- As: Buyer wanting reliable payment confirmation
- Maps FR-16, FR-17, FR-18, FR-19, FR-21, FR-23
- ACs:
  - AC-1: Atomic webhook status + paymentStatus
  - AC-2: Atomic stock decrement
  - AC-3: Oversell flag + seller refund (no auto-refund)
  - AC-4: Accurate payment method (fpx vs card)
  - AC-5: Active reconcile on polling
  - AC-6: Cron reconciles late webhooks
- DoD: Atomic UPDATE test, stock safety, oversell + refund wiring, PaymentIntent read, polling + reconcile, cron + expiry, schema migration, i18n

---

## Key Corrections (DRIFT FIXES)

### Endpoint Name
- **Was:** `/api/orders/create`
- **Now:** `/api/orders/stripe-checkout`
- **Files affected:** PRD §13, Architecture §2.1, QA multiple TCs
- **Impact:** All code references updated; old name still incorrect in code but docs now match real route

### Application Fee
- **Was:** "PrimeWeb thu 3% application_fee_amount" (PRD §3, Architecture §1, §7, QA .04/.05)
- **Now:** "Wave 6: Zero application fee (0%); 3% deferred Wave 7+ (cross-border limitation)"
- **Files affected:** PRD §3 Solution, §4 Scope, §13 code, §16 Limitations; Architecture §1, §7, §2.1; QA TC-F13.04/.05/.63
- **Impact:** Reflect production code reality (no `application_fee_amount` sent)

### Order Status Contract
- **Was:** "order status `pending → new`" (inconsistent; sometimes "→ paid")
- **Now:** "Atomic: `status='new'` AND `paymentStatus='paid'` (single UPDATE WHERE status='pending')" 
- **Files affected:** PRD §9/.9.1a, §10.4; Architecture §1, §2.1, §2.3, §2.4; QA §3 Test Environment, TC-F13.02/.09/.33
- **Impact:** Accurate contract; Confirm page reads `paymentStatus='paid'` for success (not just status)

### payment_intent.payment_failed Handler
- **Was:** "out of scope handler" (Architecture §2.3)
- **Now:** "Implemented: sets `paymentStatus='payment_failed'`, notifies merchant" (Architecture §2.3)
- **Files affected:** Architecture §2.3
- **Impact:** Document actual code behavior

### account.application.deauthorized Handler
- **Was:** Not mentioned
- **Now:** "Locks tenant toggles: `stripeOnboardingComplete=false`" (Architecture §2.3, QA TC-F13.87)
- **Files affected:** Architecture §2.3
- **Impact:** Document actual webhook handler

---

## Version Bumps

| File | Old → New | Date Updated |
|------|-----------|---|
| `docs/prd/F13-payment-gateway.md` | 1.1 → 1.2 | 2026-05-27 |
| `docs/architecture/F13-payment-gateway.md` | 1.0 → 2.0 | 2026-05-27 |
| `docs/qa/F13-payment-gateway.md` | 1.5 → 1.6 | 2026-05-27 |
| `docs/stories/F13-payment-gateway-stories.md` | — | Added US-F13-05, US-F13-06 |

---

## Test Cases Added (NHÓM 16)

16 new TCs (TC-F13.142–157) covering Wave 6.5 hardening:
- Atomic webhook + idempotency (.142–143)
- Stock safety + oversell (.144–146)
- Payment method accuracy (.147)
- Cart handling (.148–149)
- Confirm polling + self-heal (.150–152)
- Retry payment (.153–154)
- Cron reconcile + schema (.155–157)

**Total QA TCs now: 157** (was 141)

---

## FR Traceability

| FR | Story | Phase | Notes |
|---|---|---|---|
| FR-16 | US-F13-06 | 01 | Webhook atomic `status='new'` + `paymentStatus='paid'` |
| FR-17 | US-F13-06 | 02 | Stock decrement atomic, never negative |
| FR-18 | US-F13-06 | 02, 07 | Oversell flag + seller manual refund (no auto) |
| FR-19 | US-F13-06 | 03 | Card vs fpx from PaymentIntent on connected account |
| FR-20 | US-F13-05 | 04 | Cart clear only on confirmed success, not before |
| FR-21 | US-F13-05, 06 | 05 | Confirm polling + self-heal + payment_failed |
| FR-22 | US-F13-05 | 06 | Pay Now retry (re-validate stock, new session) |
| FR-23 | US-F13-06 | 07 | Cron reconcile >15min + expire >24h |

---

## Unresolved Questions

None. All corrections applied based on:
1. **Code reality:** Read actual handlers, endpoint names, SQL queries
2. **Plan authority:** `plans/260527-1410-f13-stripe-flow-hardening/` defines Wave 6.5 scope
3. **Locked decisions:** No oversell auto-refund, no buyer order-list page
4. **Constraint compliance:** `.claude/rules/database-schema.md`, `vercel-deploy.md` noted where applicable

---

## Impact Assessment

- **Code changes needed:** YES (if endpoint in code differs; already `/api/orders/stripe-checkout` confirmed)
- **Database migration needed:** YES (Wave 6.5: `oversell_review` BOOLEAN column, `payment_status` varchar)
- **Docs lock:** NO — ready for code implementation to follow
- **Test gate:** All 16 new TCs have [x] AUTO or [ ] manual flags; blockers identified

---

**Status:** DONE  
**Quality:** All FR/TC/story numbering consistent; cross-references valid; drift corrections verified against code; plan alignment confirmed.

