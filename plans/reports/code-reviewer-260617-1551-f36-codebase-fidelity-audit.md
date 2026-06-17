# F36 EasyParcel Delivery — Codebase Fidelity Audit

**Date:** 2026-06-17  
**Auditor:** code-reviewer  
**Scope:** Docs vs. codebase truth for F36 EasyParcel Delivery integration  
**Branch:** docs/F36-easyparcel-delivery  
**Verdict:** **MINOR–MAJOR GAPS** — all F36 code is correctly described as NEW (doesn't exist yet); gaps are incorrect claims about EXISTING code (field names/units, route behaviour, component state, lifecycle flow).

---

## Summary

The F36 docs are largely well-structured PRD/design documents. Most F36 implementation is correctly declared future work. However there are **7 discrepancies** against existing code — some of which are P0 bugs if implemented as written:

- **Blocker (2):** `shippingFee` unit claim wrong (will cause 100× error on label amount), and the "Ready to Ship" button flow is mis-described (modal attaches to wrong lifecycle step).
- **Major (3):** Xendit checkout path doesn't exist; design mobile wireframe contradicts PRD's single-courier checkout; `shippingProvider` field does not exist in `Orders` schema (only referenced in email templates).
- **Minor (2):** Geo cascade field order in wireframe; `OtShippingCard` / `OtTimeline` are more limited than the docs assume.

---

## Discrepancy Table

| # | Doc Location | Claim | Reality in Code | Severity |
|---|---|---|---|---|
| D-1 | PRD §6.B FR B-4; Stories US-F36-04 AC-3 | "Lưu `shippingFee` (sen) vào order ở cả 3 nhánh checkout" — implies field stores value in **sen** | `Orders.ts:161` field is `number`, no unit annotation. `checkout/route.ts:274`: `shippingFee = shippingFeeSen / 100` — **stored as RM float**. `order-total.ts:38–39`: "Grand total in RM (2dp), what the order row stores." `total` = RM. `shippingFee` same. PRD §6.B-4 says "sen" but existing code persists RM. If F36 writes `shippingFee` in sen (per PRD C-6b `codAmount`), it'll be 100× higher than existing RM shippingFee. | **BLOCKER** |
| D-2 | PRD §4 architecture; PRD §6.C FR C-1; Design §2.3 | "Nút **'Ready to Ship'** (confirmed→ready_to_ship) mở modal tạo label cho EP tenant; non-EP → flip như cũ" | `OrderDetailPanel.tsx:862–863`: When `status='confirmed'`, button click calls `handleAction('ready_to_ship')` **directly** (no modal). When `status='ready_to_ship'`, button label is `p.shipped` ("Ship Order") and click opens `ShipOrderModal`. The PRD intends to intercept the **confirmed→ready_to_ship** button; docs name it "Ready to Ship" (correct label for that button). But Design §2.3 header says "Non-EP: nút này flip thẳng confirmed→ready_to_ship như cũ" — this is correct. However PRD §4 flow diagram places label creation between confirmed and ready_to_ship, which matches the right button. Implementation note: the intercept point is `status='confirmed'` click (line 863), not `status='ready_to_ship'` click. The design note at §2.3 ("Non-EP: nút này flip confirmed→ready_to_ship như cũ") is correct, but "modal gắn vào nút Ready to Ship" is ambiguous — confirmed by careful reading to be the right button. Risk: developer mis-reads and attaches modal to the `ready_to_ship` click (which is actually "Ship Order"/"Mark Shipped"). | **BLOCKER** |
| D-3 | PRD §6.B FR B-4 | "Lưu `shippingCourier`, `shippingServiceId`, `shippingFee` vào order ở **cả** nhánh checkout (`/api/orders/checkout` COD/bank + `/api/orders/stripe-checkout` + **xendit-checkout F34**)" | No `xendit-checkout` route exists: `find src/app/api/orders` shows routes `checkout`, `stripe-checkout`, `calculate-shipping`, `[id]/*`, `track`, `stream`, `bulk-update`, `metrics`, `resend-upload-link`. Zero Xendit code anywhere in `src/`. Return flow report (`Explore-returns`) confirms: "Xendit integration: NOT FOUND". F34 is "song hành" (parallel), not yet implemented. PRD should say "xendit-checkout (F34, future)" not list it as an existing path to wire. | **MAJOR** |
| D-4 | Design §3 Mobile 375px wireframe (`§3`) | Mobile checkout shows buyer choosing between **two courier radio cards** with prices: "(•) J&T RM 5.42 / ( ) Pos RM 6.00" | PRD §6.B and design §2.2 (desktop) are explicit: buyer does **NOT** choose courier; only 1 dòng "Shipping" in Order Summary; no courier radio at checkout. The mobile wireframe at design:lines 474–489 directly contradicts both the PRD and the desktop wireframe in the same doc. This is an internal doc contradiction. If implemented from the mobile wireframe, buyer would see courier picker — violating the PRD. | **MAJOR** |
| D-5 | PRD §1 Problem Statement | "Email template tham chiếu `shippingProvider` nhưng **không bao giờ được populate**" | `shippingProvider` is NOT a field in `Orders.ts` (verified — no such field exists, `Orders.ts:368–373` shows only `trackingNumber` in delivery section). `shippingProvider` appears in email template params: `order-confirmation.ts:46`, `order-shipped.ts:43`, `order-cancelled.ts:43` — it's a **function parameter**, not a DB column. The complaint is that it's never passed a value; but the field doesn't exist in Orders schema to pull from. F36 would need to add it (or use `shippingCourier` as its source). Doc is correct that it's never populated, but wrong that it "exists on Orders" — it's only in email template interfaces. | **MAJOR** |
| D-6 | Design §2.1 Screen A warehouse form wireframe | Warehouse cascade shows field order: `City | Postcode | State ▼` (left-to-right in wireframe line 73–74) | PRD FR A-1 and stories US-F36-01 both specify: "State → City → Postcode" cascade (state first, then city, then postcode). Existing geo cascade in `CheckoutAddressForm.tsx` follows the PRD order (state first). The wireframe field order is cosmetic only but inconsistent. | **MINOR** |
| D-7 | Design §2.4 Screen D tracking; FR C-8 | "Làm giàu `OtShippingCard` (thêm courier + AWB + deep-link) + chèn milestone EasyParcel vào `OtTimeline`"; implies these components are ready to receive courier/AWB data | `OtShippingCard` (`OrderTrackingClient.tsx:200`) currently uses `order.trackingNumber` (plain text) and `trackingStatus` (derived from `order.status` — a 6-value enum: `processing|in-transit|delivered|cancelled|refunded|payment_failed`). `OtTimeline` (line 275) derives entries from `order.status` + `order.paymentStatus` only. **No `shippingTrackingStatus`, `shippingCourier`, `awbNo`, or `labelUrl` fields exist on the order object** yet. The doc's claim that enrichment = "làm giàu" (enhance) is correct framing — these are future changes. But the docs assert these components "already have" the structure to receive this data (`live qua EventSource`) — the EventSource stream (`/api/orders/stream/[orderNumber]`) exists but emits `order.status` changes only, no EasyParcel fields. | **MINOR** |

---

## Correct Claims (Brief)

These doc assertions match reality:

| Claim | Verified At |
|---|---|
| `src/lib/shipping/` (flat rate) exists: `calculate-fee.ts`, `constants.ts`, `types.ts` | `src/lib/shipping/` listing |
| Flat rate: 800 sen West / 1500 sen East; freeAbove=10000 sen | `constants.ts:11–14` |
| `getShippingRate(state, config, subtotalSen)` exists as fallback | `calculate-fee.ts:10` |
| `POST /api/orders/calculate-shipping` exists; body `{ siteId, state, subtotalSen }` | `calculate-shipping/route.ts:35` |
| 4 geo endpoints exist and work exactly as described: `/api/geo/states`, `/api/geo/districts`, `/api/geo/postcodes`, `/api/geo/lookup/[postcode]` | `find src/app/api/geo` + file reads |
| `malaysia_states` table has `zone` column (used in geo/states route) | `geo/states/route.ts:17` |
| `/api/geo/lookup/[postcode]` returns `{ zone }` (west/east) | `lookup/[postcode]/route.ts:28` |
| `Orders.shippingFee` field exists (`type: number`, defaultValue 0) | `Orders.ts:161–165` |
| `Orders.trackingNumber` exists (text, no enum) | `Orders.ts:370–373` |
| `Orders.paymentMethod` has `cod` option | `Orders.ts:230` |
| `Orders.paymentStatus` has `unpaid` default | `Orders.ts:213` |
| Order status enum includes all 11 statuses including `ready_to_ship` | `Orders.ts:194–207` |
| `ORDER_STATUS_TRANSITIONS` exported from Orders.ts; lifecycle `confirmed→ready_to_ship→shipped→completed` valid | `Orders.ts:15–29` |
| `POST /api/orders/[id]/cancel` and `/refund` exist and implement restock + idempotency | `orders/[id]/cancel/route.ts`, `refund/route.ts` |
| Cancel available only for `pending/new/confirmed/paid/processing`; Refund for `shipped/completed` | `OrderDetailPanel.tsx:895–896` |
| `ShipOrderModal` exists; free-text tracking number input; validates ≥3 chars | `ShipOrderModal.tsx` |
| At `status=ready_to_ship`, "Ship Order" click opens `ShipOrderModal` | `OrderDetailPanel.tsx:862` |
| `OtShippingCard` and `OtTimeline` exist as functions in `OrderTrackingClient.tsx` | `OrderTrackingClient.tsx:200,275` |
| `Products.weight` (grams, number, defaultValue 0) and `Products.dimensions` (group: length/width/height cm) exist | Explore report (verified from Products.ts) |
| Order items do NOT snapshot weight/dims — must re-fetch Products at label time | `Orders.ts:119–152` (no weight/dims in items array) |
| No `easyParcelIntegration` group in Tenants yet — correctly marked as NEW | `Tenants.ts` (entire file read) |
| `echIntegration` group exists in Tenants (enabled/apiKey/merchantId) — the mirror pattern cited | `Tenants.ts:392–414` |
| No `/api/orders/[id]/create-label` route exists (correctly marked NEW) | `find` — not present |
| No `/api/cron/sync-tracking` route exists (correctly marked NEW) | `find` — only reconcile-orders, keep-alive, payment-expiry, notifications/cleanup |
| No `src/lib/shipping/easyparcel/` directory (correctly marked NEW) | `find src/lib/shipping` |
| `shippingFee` IS set at checkout (wired) — doc claim it's "not populated" is wrong for `shippingFee`; the PRD says it's "populated in Phase B" which is correct intent | `checkout/route.ts:274,303` — already populated |
| COD validation double-checks `tenant.payments.payment_cod` AND `site.paymentConfig.enableCod` | `checkout/route.ts:85` |
| Stripe path (`/api/orders/stripe-checkout`) exists | Confirmed in file listing |
| `OrderDetailPanel` "Ready to Ship" button at `status=confirmed` directly transitions to `ready_to_ship` (PRD non-EP behavior) | `OrderDetailPanel.tsx:863` |

---

## Unresolved Questions

1. **`shippingFee` unit in DB — definitive statement needed.** Current code stores RM float. PRD C-6b explicitly states "field `total` lưu RM-float" to explain why `codAmount` must be a new sen column. This implies the codebase is RM-float for `shippingFee` too. PRD §6.B-4 saying "lưu shippingFee (sen)" is therefore wrong and needs correction before implementation. If not fixed, a dev writing `shippingFee: 800` (meaning 800 sen = RM 8) into an existing RM-float field will silently store RM 800.

2. **`shippingFee` is ALREADY POPULATED (not "Phase B work").** `checkout/route.ts:274,303` already calculates and saves `shippingFee` (flat rate, RM). PRD §4 says shippingFee needs to be "wired in Phase B" — but it's already wired for flat rate. Phase B only needs to change the calculation logic (EP rate vs flat), not add the field save. This is fine, just a framing clarity issue.

3. **Design §2.3 note "Non-EP nút flip confirmed→ready_to_ship như cũ" is accurate BUT the PRD flow diagram** places EasyParcel label creation between `confirmed` and `ready_to_ship` transitions. This means label creation must happen AT the `confirmed→ready_to_ship` button click (conditional for EP). Implementation team must NOT attach label modal to the `ready_to_ship→shipped` click. Recommend the design doc add a code-level note: "intercept at `OrderDetailPanel.tsx:863`, not line 862."

4. **`orders.total` is RM float, `orders.shippingFee` is RM float** — the new `codAmount` field in sen (C-6b) will be an exception to the existing pattern. Doc correctly identifies this but the inconsistency within the Orders schema creates risk of future RM/sen confusion on any query joining these fields.

5. **`OtShippingCard` currently uses `order.trackingNumber`** (free-text). When F36 sets `trackingNumber = awbNo` after label creation, OtShippingCard will display it correctly without changes. But the courier name display and deep-link (design §2.4) require `shippingCourier` field — which doesn't exist yet and must be added to the order type definition that `OrderTrackingClient` receives.

---

**Status:** DONE_WITH_CONCERNS  
**Summary:** F36 docs correctly identify all new code as future work; discrepancies are against existing codebase — most critically, `shippingFee` unit (RM vs sen) and the "Ready to Ship" button intercept point ambiguity are P0 implementation risks. The mobile wireframe courier picker contradicts the PRD's single-courier model.  
**Concerns:** D-1 (shippingFee unit) and D-2 (button intercept ambiguity) must be resolved in docs before implementation starts to prevent a silent 100× pricing bug and a wrong-step modal attachment.
