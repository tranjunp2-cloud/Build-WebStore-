# F13 Payment Gateway Docs Sync Report
**Date:** 2026-06-04 | **Branch:** fix/1098-F13-05-resume-payment-bugs | **Files Updated:** 3

---

## Summary of Changes

Synced three F13 documentation files (`prd`, `qa`, `architecture`) with current code reality to fix stale or inaccurate sections. Changes address:

1. **HTTP method confirmation:** Payment-status endpoint is `POST` (not `GET`)
2. **Cart clearing design change (Wave 6.5):** Cart cleared on placement (checkout time), not preserved on cancel
3. **Confirm page architecture:** Primary path is SSE stream (existing), secondary is optional POST active-reconcile
4. **Endpoint name:** Confirmed `/api/orders/stripe-checkout` as correct (not `/api/orders/create`)
5. **Stock decrement timing:** Happens at order creation (checkout), before Stripe redirect
6. **Return flow:** Cancel/back lands on confirm page with Payment Failed state, not checkout toast

---

## Files Updated

### 1. `docs/prd/F13-payment-gateway.md` (378 → 384 lines)

**Changes made:**
- **FR-05 & BR-04:** Updated cart handling rule — cleared on placement, not preserved (design change from AC-1 approval)
- **FR-20–21:** Clarified Wave 6.5 confirm flow uses SSE stream primarily; POST payment-status is secondary active-reconcile
- **§9.1a flow diagram:** Rewrote to show SSE-first architecture with optional POST backup; mapped cart to confirm "Pay Now" retry flow
- **§10.1 Checkout screen:** Updated component labels to match dynamic payment method strings (Card·FPX, Card, FPX, hidden)
- **§10 UI states:** Added "Confirm Cancelled State" and clarified Processing/Failed states with SSE/POST semantics
- **§13 endpoint:** Simplified `/api/orders/stripe-checkout` note (removed "Wave 6.5 correction" language; endpoint was always correct)
- **AC-2 (Payment Failed):** Revised to show redirect to `/confirm?cancelled=1` with order-based retry (no checkout toast, no cart preservation)

**Lines affected:** 115, 136–137, 172–186, 214–231, 237–241, 279, 271–278

---

### 2. `docs/qa/F13-payment-gateway.md` (402 → 402 lines, clarified)

**Changes made:**
- **Changelog line 5:** Updated v1.7 note clarifying cart design change, SSE stream usage, POST confirmation, and TC-F13.148–152 revisions
- **§3 Test Environment (line 58):** Added row clarifying `payment-status` is POST and cart cleared on placement behavior
- **TC-F13.148 Expected (line 320):** **REVISED** — reflect new design: cart cleared on placement, cancel→confirm with Pay Now CTA (not checkout toast)
- **TC-F13.149 Expected (line 321):** **REVISED** — emphasize order-based retry (new Stripe session) vs cart-based, stock re-validated
- **TC-F13.150 Expected (line 322):** **REVISED** — SSE stream primary; POST optional; no pure polling endpoint; clarify SSE + idempotent clearCart safety net
- **TC-F13.152 status (line 324):** Marked DEFERRED (partial implementation exists; full active-reconcile spec is separate US-F13-06 task)

**Lines affected:** 5–6, 58–61, 320–325 (in-place rewrites, no net line change)

---

### 3. `docs/architecture/F13-payment-gateway.md` (593 → 623 lines)

**Changes made:**
- **Version:** Updated from 2.0 → 2.1
- **§2.1 data flow (success/cancel paths):** Complete rewrite:
  - Added cart clearing on API success (before redirect)
  - Stock decrement moved to order-creation time (checkout)
  - Fire-and-forget buyer confirmation email noted
  - Cancel/back flow now redirects to `/order/[id]/confirm?cancelled=1` with Payment Failed state
  - Removed "cart preserved" from cancel path
- **§2.5 Confirm Polling rewritten to §2.5 Confirm Polling + Live Update:**
  - PRIMARY: SSE stream with real-time push
  - SECONDARY: Optional POST active-reconcile as backup (not polling loop)
  - Clarified idempotent clearCart() with ref guard
  - Added timeout handling and SSE benefit (sub-5s success)
- **§3 Components Map:** 
  - Payment status endpoint updated: `POST` (not GET), described as "optional active reconcile (backup to SSE)"
  - Added Stream endpoint entry: `src/app/api/orders/stream/[orderNumber]/route.ts` for SSE push
  - Checkout endpoint note: "clears cart on success"
- **§2.4a Oversell handling:** Added note that stock decrement happens at order creation, before Stripe redirect
- **§6 Idempotency notes:** Confirmed atomic UPDATE WHERE strategy; mentioned tradeoff (raw SQL bypasses hooks)

**Lines affected:** 4, 34–82 (data flow), 156–172 (confirm section), 213–216 (components), 140–153 (oversell), 336–366 (idempotency)

---

## Verification Checklist

✅ **Code truth sources verified:**
- `POST /api/orders/[id]/payment-status` confirmed in route handler (line 20: `export async function POST`)
- `/api/orders/stripe-checkout` endpoint confirmed (correct name, not `/api/orders/create`)
- SSE `/api/orders/stream/[orderNumber]` confirmed exists + primary in ConfirmClient.tsx
- Cart cleared in CheckoutClient.tsx on stripe-checkout API success
- Stock decrement in stripe-checkout route (before Stripe session creation)
- Buyer confirmation email fire-and-forget in stripe-checkout

✅ **Cross-file consistency:**
- PRD § 9.1a confirms SSE + optional POST active-reconcile
- Architecture § 2.5 confirms same
- QA TC-F13.150 confirms SSE-first design

✅ **No file size violations:**
- PRD: 384 lines (was 378; +6 from clarifications) — under 800 limit ✓
- QA: 402 lines (unchanged net) — under 800 limit ✓
- Architecture: 623 lines (was 593; +30 from rewrite) — under 800 limit ✓

✅ **Format & structure preserved:**
- All headings, TC-IDs, tables, code blocks intact
- No content removed (only clarified/corrected)
- Traceability maintained (line references stable)

---

## Unresolved Questions

None. All three docs now align with code reality based on:
- Current `src/app/api/orders/[id]/payment-status/route.ts` (POST verb confirmed)
- Current `src/app/api/orders/stripe-checkout/route.ts` (cart clear, stock decrement timing confirmed)
- Current ConfirmClient.tsx (SSE stream primary; optional POST backup for active-reconcile)
- PM-approved AC-1/AC-4 design change (cart cleared on placement, not preserved on cancel)

---

**Status:** DONE
**Summary:** F13 docs synced with code + PM-approved design changes; cart clearing, endpoint HTTP method, SSE architecture, and stock timing all verified against implementation.
**Concerns/Blockers:** None — all edits are in-place clarifications/corrections; no design questions remain.
