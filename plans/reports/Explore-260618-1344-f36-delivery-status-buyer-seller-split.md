# F36 EasyParcel Delivery-Status — Buyer vs Seller Flow Audit

**Date:** 2026-06-18
**Branch:** docs/F36-easyparcel-delivery
**Scope:** Audit F36 delivery-status design vs ACTUAL code. Define TWO separated flows: Seller (admin dashboard, full control) + Buyer (public read-only). NO code changes.
**Method:** Read F36 PRD/design/reports + verified against live source (file:line refs below).

---

## 1. CURRENT STATE — what exists today

### 1.1 Order status — single enum, no shipping-status field

`src/collections/Orders.ts`:
- `status` (L189-208) — 11 values: `pending, new, confirmed, ready_to_ship, shipped, completed, cancelled, refunded` + 3 legacy Stripe (`paid, payment_failed, processing`). **This is the ONLY lifecycle field.**
- `ORDER_STATUS_TRANSITIONS` (L15-29) — state machine; `confirmed→ready_to_ship→shipped→completed`, `shipped→refunded`.
- `paymentStatus` (L211-225) — 8 values incl `unpaid` (default), `paid`, `refunded`.
- `paymentMethod` (L227-239) — incl `cod` (L230).
- `shippingFee` (L161-165) — `number`, default 0. **Stored as RM-float** (verified `checkout/route.ts:274` → `shippingFeeSen / 100`). Already populated for flat-rate.
- `trackingNumber` (L370-373) — free text, no enum. Merchant-entered. **This is the only delivery field.**
- `shippingAddress` group (L356-366) — line1/2, city, state, postcode, country.

**Missing today (ALL F36 fields):** no `shippingCourier`, `shippingServiceId`, `awbNo`, `easyParcelOrderNo`, `labelUrl`, `shippingTrackingStatus`, `parcelWeight`, `codAmount`, `codStatus`. No `shippingProvider` column (it only exists as an email-template function param — `order-confirmation.ts:46` etc., never wired to a DB field).

### 1.2 EasyParcel status mapping — needs 13-value enum, codebase has 6

EasyParcel `EPParcelStatusBulk` returns **13 normalized statuses** (status-mapping report): `SCHEDULED, PENDING_FOR_COLLECTION, COLLECTED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERY_ON_HOLD, DELIVERED, DROP_OFF, RETURNED, CANCELLED, ADMIN_CANCEL, EXCEPTION, EXPIRED_UNPAID`. Only 4/13 map cleanly to lifecycle. Design decision: **dual-field** — keep `order.status` (manual lifecycle) + add new `shippingTrackingStatus` enum (display, cron-synced). Neither exists wired today.

Buyer side derives a **6-value** display enum from `order.status` only (`OrderTrackingClient.tsx:13`): `processing | in-transit | delivered | cancelled | refunded | payment_failed` via `getTrackingStatus()` (L58-68). No real courier status.

### 1.3 Seller (admin) delivery capability today

| Capability | Where | Status |
|---|---|---|
| Status transitions (confirm/ready/ship/complete) | `OrderDetailPanel.tsx` primary button L860-889 | ✅ manual flip |
| "Ship Order" → enter tracking # | `ShipOrderModal.tsx` (free-text, 3-100 chars) opened at `status='ready_to_ship'` (`OrderDetailPanel.tsx:862`) | ✅ manual |
| PATCH status + trackingNumber | `api/orders/[id]/route.ts` PATCH L26-88; requires tracking on `shipped` (L74-78); validates `ORDER_STATUS_TRANSITIONS` | ✅ |
| Cancel (+restock) / Refund (+restock) | `api/orders/[id]/cancel`, `/refund` — idempotent, restock reused | ✅ reusable for F36 Phase D |
| Bulk status update | `api/orders/bulk-update/route.ts` | ✅ exists |
| Buy label / print AWB / courier API / pickup / tracking sync | — | ❌ none — zero EasyParcel code in `src/` |

**Key intercept point for F36:** the `confirmed→ready_to_ship` button at `OrderDetailPanel.tsx:863` calls `handleAction('ready_to_ship')` directly (no modal). That is where EP label-create modal must attach. The `ready_to_ship→shipped` button (L862) opens `ShipOrderModal` and is the "Ship Order" step — must NOT be confused (fidelity-audit D-2).

### 1.4 Buyer (public) delivery capability today

| Capability | Where | Status |
|---|---|---|
| Public order lookup (enter order #) | `OrderLookupClient.tsx` → routes to `/sites/[slug]/orders/[orderNumber]` | ✅ |
| Order tracking page (read-only) | `OrderTrackingClient.tsx` (`OtShippingCard` L200, `OtTimeline` L275, `OtStageTracker` L161) | ✅ |
| Live status updates | SSE `EventSource` → `api/orders/stream/[orderNumber]` (`OrderTrackingClient.tsx:449`); emits only `status/paymentStatus/trackingNumber` | ✅ |
| Polling fallback API | `api/orders/track/[orderNumber]/route.ts` — returns `status/paymentStatus/trackingNumber/terminal` only (L66-71) | ✅ |
| Courier name / AWB deep-link / real delivery milestones | `OtShippingCard` shows `trackingNumber` as plain text + dead `<a href="#">` (L225); no courier | ❌ placeholder |

**Buyer auth model = NONE.** Order loaded server-side via `payload.find({ overrideAccess: true })` scoped by `orderNumber + site.id` (`page.tsx:54-61`). Knowing the order number = access. Token (`?token=`) is used ONLY for the bank-transfer receipt-upload redirect (`page.tsx:110-114`), NOT for tracking. Feature-gated by plan: `allowing_buyer_tracking_order` (`page.tsx:37-40`, `track route:36`).

---

## 2. BUYER vs SELLER SPLIT

| Dimension | SELLER (admin) | BUYER (public) |
|---|---|---|
| **Entry route** | `/(dashboard)/orders` → `OrderDetailPanel.tsx` (slide-in panel) | `/sites/[slug]/orders` (lookup) → `/sites/[slug]/orders/[orderNumber]` |
| **Components** | `OrderDetailPanel`, `OrderStatusBadge`, `ShipOrderModal`, `OrdersTable`, `OrdersActionBar`, `CancelOrderModal` | `OrderLookupClient`, `OrderTrackingClient` (`OtShippingCard`/`OtTimeline`/`OtStageTracker`), `order-tracking-styles.ts` |
| **Data write API** | `PATCH api/orders/[id]`, `bulk-update`, `[id]/cancel`, `[id]/refund` | none (read-only) |
| **Data read** | full order + items + payment + address + internal notes | sanitized subset (`page.tsx:126-158`): no internal notes, no payment proof, no magicLinkSecret |
| **Auth model** | admin session — `withAuth` + `withFeatureGuard('order_management')` + tenant IDOR (`overrideAccess: false`) | **NO auth** — public, order-number-as-key, `overrideAccess: true`, plan-feature-gated |
| **Status detail** | full lifecycle control + (F36) raw 13-value courier status + COD status | 6-value derived display status; (F36) enriched courier name + AWB + milestones — read-only |
| **F36 actions** | buy label, print AWB, set pickup, COD flag, reverse label, mark complete | view enriched tracking only |

### Where today's code MIXES the two (must stay separated)

1. **SSE stream + track API are shared infra** (`stream/[orderNumber]`, `track/[orderNumber]`) — public, no auth, return `status/paymentStatus/trackingNumber`. F36 must add `shippingTrackingStatus`, `shippingCourier`, `awbNo` to the **buyer-safe subset only** — do NOT leak seller-internal fields (easyParcelOrderNo, labelUrl, codAmount, wallet errors) through these public endpoints.
2. **`trackingNumber` field is dual-purpose** — seller writes it (manual or `=awbNo`); buyer reads it. For EP orders F36 sets `trackingNumber = awbNo`, so `OtShippingCard` shows it with no change. Fine — but the courier deep-link needs `shippingCourier` which must be added to the buyer sanitized payload (`page.tsx:126-158`), gated to non-sensitive value.
3. **No separate "buyer status" projection exists** — buyer reuses `order.status` directly. F36's dual-field model is the clean separation: lifecycle (`status`, seller-driven) vs courier display (`shippingTrackingStatus`, cron-driven). Buyer should read the courier-display field; seller controls lifecycle.

---

## 3. GAPS — F36 requires, codebase lacks

### 3.1 Schema (Orders) — all NEW (CRITICAL: each needs `scripts/db-setup.js` MIGRATIONS entry + CI gate per NFR-9)

| Field | Unit | Purpose | Flow |
|---|---|---|---|
| `shippingCourier` | text (`courier_id`) | which courier | both (buyer reads name) |
| `shippingServiceId` | text (`service_id`) | service tier for label | seller |
| `awbNo` | text | AWB / tracking from EP | both |
| `easyParcelOrderNo` | text | EP internal id for polling | seller only |
| `labelUrl` | text | PDF label link | seller only |
| `shippingTrackingStatus` | varchar (13-enum) | courier display status | both |
| `parcelWeight` | integer (**grams**) | snapshot for label/rate | seller |
| `codAmount` | integer (**sen**) | COD remittance amount | seller |
| `codStatus` | varchar (pending/collected/settled) | COD display state | seller |

> **Unit landmine (fidelity-audit D-1, NFR-1):** existing `shippingFee` + `total` are **RM-float**; new `codAmount` is **sen**. Mixing on a join = 100× error. Mandatory regression test.

### 3.2 Schema (Tenants) — NEW `easyParcelIntegration` group (mirror `echIntegration` at `Tenants.ts:392-414`)

`enabled`, `apiKey`, `authKey` (2 keys, encrypt at rest), `detectedEnv`, `warehouse` (line1/2/city/state/postcode/country), `selectedCourier` (single, radio). PATCH needs auth + IDOR.

### 3.3 Backend — all NEW

- `src/lib/shipping/easyparcel/{client,types,normalize}.ts` + `get-rates.ts` (hybrid router).
- `api/orders/[id]/create-label/route.ts` (EPSubmitOrderBulk→EPPayOrderBulk, idempotent on awbNo).
- `api/cron/sync-tracking/route.ts` (poll EPParcelStatusBulk, cron-secret auth).
- Wire `shippingCourier/serviceId/fee/parcelWeight` into `checkout/route.ts` + `stripe-checkout/route.ts`. (Xendit path does NOT exist — F34 future; fidelity-audit D-3.)

### 3.4 UI gaps per flow

**Seller:** EasyParcel settings tab (Phase A); `CreateLabelModal` (weight/dims/pickup/COD, attach at `OrderDetailPanel.tsx:863`); tracking badge + COD status badge in panel; reverse-label button (Phase D, currently cut from MVP per design §8).

**Buyer:** enrich `OtShippingCard` — courier name + real AWB deep-link (currently dead `href="#"` L225); inject 13-status milestones into `OtTimeline` (currently derives from `order.status` only). Extend buyer sanitized payload + SSE/track subset with `shippingTrackingStatus` + `shippingCourier` (safe fields only).

---

## 4. RECOMMENDED ARCHITECTURE (KISS/YAGNI)

### Shared core
- **One status-mapping module** `src/lib/shipping/easyparcel/status-map.ts` — single source for the 13-value enum + labels + the 4 lifecycle-suggestion mappings. Both seller panel and buyer timeline import it. DRY; no duplicated status strings.
- **Dual-field, not full-mapping** (per status-mapping report §3): `order.status` = manual lifecycle (seller); `shippingTrackingStatus` = cron-synced display (both). Never auto-promote `completed` on `DELIVERED`.

### Seller flow (full control, admin-auth)
- Reuse `OrderDetailPanel` + status buttons. Intercept ONLY `confirmed→ready_to_ship` (L863) for EP tenants → open new `CreateLabelModal`. Keep `ShipOrderModal` unchanged for non-EP manual path. Branch by **tenant config**, not a per-order toggle.
- Reuse `cancel`/`refund` endpoints 100% for returns (Phase D) — no RMA collection.
- Cron writes `shippingTrackingStatus`; merchant still flips lifecycle manually.

### Buyer flow (public read-only, no auth)
- Keep order-number-as-key + plan gate. NO token, NO new auth.
- Enrich existing components in place (no new route/component): add courier + AWB deep-link to `OtShippingCard`; map 13 statuses → timeline entries in `OtTimeline`.
- Extend the **buyer-safe projection** only (`page.tsx` sanitizedOrder + `track` route + SSE stream): add `shippingTrackingStatus`, `shippingCourier`, `awbNo`. Explicitly exclude seller-internal fields (`labelUrl`, `easyParcelOrderNo`, `codAmount`, wallet errors).

### Reuse map
| Need | Reuse |
|---|---|
| Flat-rate fallback | `src/lib/shipping/calculate-fee.ts`, `constants.ts` |
| Geo cascade (warehouse + checkout) | `api/geo/{states,districts,postcodes,lookup}` |
| Returns/refund/restock | `api/orders/[id]/{cancel,refund}` |
| Per-merchant key pattern | `Tenants.echIntegration` |
| Manual ship path | `ShipOrderModal` (non-EP unchanged) |

---

## 5. Unresolved questions

1. **Buyer projection scope** — should buyer see raw 13-value courier status, or a buyer-friendly collapse (e.g. `EXCEPTION`/`ON_HOLD` → generic "delay")? Recommend a buyer-facing label map in the shared status module; don't leak `ADMIN_CANCEL`/`EXPIRED_UNPAID` verbatim.
2. **SSE/track field additions** — confirm these two public endpoints add only safe fields. They currently hard-code a 3-field response; any new field is a deliberate public exposure.
3. **`shippingTrackingStatus` storage** — scalar varchar (simple) vs select-enum (Payload admin dropdown). Report-map suggested array history table too; YAGNI for MVP — scalar + last-updated date is enough; defer history.
4. **COD param name + reverse-label shape** — still sandbox-unverified (PRD §11).
5. **Buyer Case-2 RMA fields** (return_tracking / fee_by / fee) — DEV decision deferred (design §10); not needed for the status-split itself.

**Status:** DONE
**Summary:** Buyer side is fully public/read-only (order-number-as-key, no auth, plan-gated) showing a 6-value status derived from `order.status`; seller side is admin-authed with full manual lifecycle control + manual tracking. F36 cleanly splits via the dual-field model — keep `order.status` seller-driven, add `shippingTrackingStatus` cron-synced; enrich buyer components in place but extend ONLY the buyer-safe projection (`page.tsx` sanitizedOrder + `track` + SSE), never leaking seller-internal EP fields. All 9 Orders fields + Tenants group + backend are NEW and absent from code today.
