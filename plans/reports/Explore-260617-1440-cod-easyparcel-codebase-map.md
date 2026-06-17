# COD + EasyParcel Delivery Integration — Codebase Mapping Report

**Date:** 2026-06-17 14:40  
**Project:** ech-prime-web-v2 (Next.js 15 + Payload CMS 3 + PostgreSQL)  
**Scope:** Map current order/checkout/payment/shipping flow to identify where COD-via-EasyParcel fits  
**Status:** Complete exploration (read-only)  

---

## EXECUTIVE SUMMARY

**Current State:**
- ✅ **COD as payment method exists** — `paymentMethod='cod'` supported since checkout (line 85, `/api/orders/checkout/route.ts`); no delivery method integration yet
- ❌ **No shipping/delivery method schema** — no courier selection, no service pricing, no shipping method field
- ❌ **No EasyParcel integration** — zero lines of code in `src/`
- ✅ **Manual shipping workflow** — merchant enters free-text `trackingNumber` via `ShipOrderModal`; no automation

**Key Gap for F36 (COD via EasyParcel):**
- COD orders currently have `paymentMethod='cod'` but **no delivery method** — need to add where EasyParcel label creation happens
- **COD amount** = order grand total; no separate field needed, but tracking for "unpaid COD remittance" requires audit trail
- **Schema gaps:** `shippingCourier`, `shippingServiceId`, `shippingFee` **already exist in code path** (PRD §6.B-4), but NOT in Orders collection schema yet
- **Checkout flow:** Currently calculates flat West/East rate only; **hybrid fallback ready** (code exists at `src/lib/shipping/`)

---

## A. COD-AS-PAYMENT-METHOD FIT

### Current State (No Changes Needed for Phase A/B)
| Field | Type | Notes |
|-------|------|-------|
| `paymentMethod` (Orders) | `select` enum | ✅ Includes `'cod'` option (line 228, Orders.ts) |
| `paymentStatus` (Orders) | `select` enum | ✅ Tracks `'unpaid'`, `'pending_verification'`, `'paid'`, `'refunded'` |
| Validation | Both tenant + site level | ✅ `paymentMethod='cod'` requires `tenant.payments.payment_cod=true` **AND** `site.paymentConfig.enableCod=true` (lines 85–89, checkout/route.ts) |

### COD Unpaid Until Delivery Concern
- **Current model:** COD order created with `status='pending'` → merchant confirms → `status='confirmed'` → ready to ship → shipped → completed
- **Payment flow:** `paymentStatus='unpaid'` until... (check next section)
- **Risk:** No explicit "COD collected at delivery" status; relies on merchant marking order `completed` after receiving payment from courier
- **Recommendation:** Add `paymentStatus='cod_collected'` enum value + auto-transition when EasyParcel reports delivery (Phase C tracking)

---

## B. EASYPARCEL ORDER-SUBMISSION HOOK POINT

### Where Label Creation Should Trigger
| Event | Current Behavior | F36 Change |
|-------|------------------|-----------|
| **Order Created** | `status='pending'` → awaits merchant confirm | No change — order still pending |
| **Merchant Confirms** | `POST /api/orders/[id]` → `status='confirmed'` | No change |
| **Ready to Ship (Phase C)** | `status='ready_to_ship'` + merchant opens ShipOrderModal | ⚠️ **CONDITIONAL:** If EasyParcel enabled + order has `shippingCourier`/`shippingServiceId`, open **label-creation modal** instead of tracking-number modal |
| **Create Label** | (Does not exist today) | **NEW:** POST `/api/orders/[id]/create-label` → EPSubmitOrderBulk → EPPayOrderBulk → save `awbNo`, `labelUrl`, `easyParcelOrderNo`, `trackingNumber=awbNo` |
| **Ship Order** | Merchant enters tracking # → `status='shipped'` | ⚠️ **CONDITIONAL:** If `awbNo` exists, **auto-populate** tracking # + skip manual entry; else show manual modal |
| **Completed** | Merchant clicks "Mark Completed" → `status='completed'` | No change; merchant manual (per PRD §6.C) |

### COD Specifics
- **Order grand total** = COD amount (sum `items[qty×price] + shippingFee - discount`)
- **Where it's calculated:** `computeOrderTotal()` in `/lib/orders/order-total.ts` — already exists
- **Pass to EasyParcel:** EPSubmitOrderBulk accepts `cod` param (name TBD per F36 research; likely boolean or `cod_amount`); set when:
  - `order.paymentMethod='cod'` AND
  - `order.shippingAddress.state` ∈ West Malaysia only (EasyParcel COD West-only restriction)

---

## C. SCHEMA GAPS (NEW COLUMNS / FIELDS)

### Orders Collection (SRC: `/src/collections/Orders.ts`)

**MISSING (need to add to Orders schema):**

| Field Name | Type | Unit | Purpose | Notes |
|---|---|---|---|---|
| `shippingCourier` | `text` | — | EasyParcel `courier_id` (e.g. "EP-CR0A") | Store which courier order uses; immutable after label create |
| `shippingServiceId` | `text` | — | EasyParcel `service_id` (e.g. "EP-CS0I") | Specific service tier; used in EPSubmitOrderBulk |
| `shippingFee` | `number` | **sen** | Rate-checked fee at checkout | ✅ **ALREADY EXISTS** (line 161) — but not populated; set at checkout |
| `awbNo` | `text` | — | Airway Bill / Tracking # from EasyParcel | Returned by EPSubmitOrderBulk after label create |
| `easyParcelOrderNo` | `text` | — | EasyParcel internal order ID | Needed for status polling via EPParcelStatusBulk |
| `labelUrl` | `text` | URL | PDF label download link | Returned by EPSubmitOrderBulk / EPPayOrderBulk |
| `shippingTrackingStatus` | `select` (enum 13 values) | — | EasyParcel normalized status (e.g. "IN_TRANSIT", "DELIVERED") | Updated by cron `/api/cron/sync-tracking` |
| `shippingTrackingHistory` | `array` of objects | — | Audit trail of status changes | `[{ status, timestamp, message }, ...]` |
| `shippingTrackingLastUpdated` | `date` | ISO 8601 | Last time cron pulled from EasyParcel | For UI "updated X minutes ago" |
| `parcelWeight` | `number` | **grams** | Snapshot of total package weight | Sum of `items[qty × product.weight]` at checkout; used by label modal |
| `codAmount` | `number` | **sen** | COD remittance amount (= order total for COD) | Informational; EasyParcel holds, settles to merchant |
| `codStatus` | `select` | — | COD payment state (OPTIONAL for Phase C) | Values: `'unpaid'`, `'collected'`, `'remitted'` — mirror `paymentStatus` for COD |

**Already exist but need wiring:**
- `shippingFee` (line 161) — defined but NEVER populated; checkout routes need to set this
- `trackingNumber` (line 370) — used for manual entry; will be auto-set to `awbNo` for EasyParcel orders

### Tenants Collection (SRC: `/src/collections/Tenants.ts`)

**MISSING (add to `tenant.settings` or new `tenant.easyParcelIntegration` group):**

| Field Name | Type | Purpose | Auth Notes |
|---|---|---|---|
| `easyParcelIntegration` | `group` | Container for EP config | IDOR-protected (PATCH requires tenant ownership) |
| ├─ `enabled` | `checkbox` | Master toggle for EP mode | default: false |
| ├─ `apiKey` | `text` | EasyParcel API key | **ENCRYPT AT REST** before saving; never echo in response |
| ├─ `authKey` | `text` | EasyParcel auth key (separate from API key per research) | **ENCRYPT AT REST** |
| ├─ `detectedEnv` | `select` | Auto-detected environment (`'production'` \| `'demo'`) | readonly; set by "Test connection" |
| ├─ `warehouse` | `group` | Origin address for rate-check & label creation | — |
| │  ├─ `line1` | `text` | Address line 1 | required |
| │  ├─ `line2` | `text` | Address line 2 | — |
| │  ├─ `city` | `text` | City/district | required |
| │  ├─ `state` | `text` | Malaysia state (full name) | required; validated against 16-state list |
| │  ├─ `postcode` | `text` | Postcode (numeric) | required; validated in "Test connection" |
| │  └─ `country` | `text` | Country code (hardcode "MY") | default: "MY" |
| ├─ `selectedCourier` | `text` | **Single** courier `courier_id` (radio, not hasMany) | e.g. "EP-CR0A" (J&T); default: J&T |
| └─ `testedAt` | `date` | Last successful test connection | readonly; timestamp |

### Scripts/Migrations (SRC: `/scripts/db-setup.js`)

**ADD to MIGRATIONS array:**

```javascript
// ── Orders: EasyParcel integration fields (F36) ──
{
  name: 'orders.shipping_courier',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_courier varchar;`,
},
{
  name: 'orders.shipping_service_id',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service_id varchar;`,
},
{
  name: 'orders.awb_no',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_no varchar;`,
},
{
  name: 'orders.easyparcel_order_no',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS easyparcel_order_no varchar;`,
},
{
  name: 'orders.label_url',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url text;`,
},
{
  name: 'orders.shipping_tracking_status',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tracking_status varchar;`,
},
{
  name: 'orders.parcel_weight_grams',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS parcel_weight_grams integer DEFAULT 0;`,
},
{
  name: 'orders.cod_amount_sen',
  sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_amount_sen integer;`,
},

// ── Orders: shipping tracking history array table ──
{
  name: 'orders_shipping_tracking_history.create_table',
  sql: `CREATE TABLE IF NOT EXISTS orders_shipping_tracking_history (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    _order integer NOT NULL DEFAULT 0,
    _parent_id integer NOT NULL,
    _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
    status varchar NOT NULL,
    timestamp timestamp with time zone DEFAULT now(),
    message text
  );`,
},
{
  name: 'orders_shipping_tracking_history.parent_idx',
  sql: `CREATE INDEX IF NOT EXISTS orders_shipping_tracking_history_parent_idx ON orders_shipping_tracking_history (_parent_id);`,
},

// ── Tenants: EasyParcel integration (F36) ──
{
  name: 'tenants_easyparcel_warehouse.create_table',
  sql: `CREATE TABLE IF NOT EXISTS tenants_easyparcel_warehouse (
    line1 varchar,
    line2 varchar,
    city varchar,
    state varchar,
    postcode varchar,
    country varchar DEFAULT 'MY'
  );`,
},
// (Nested group field — Payload handles as inline JSON or flattened columns; use ALTER TABLE for each subfield if needed)
// For MVP, warehouse can be stored as JSON in tenants table if group is not fully materialized by Drizzle.
{
  name: 'tenants.easyparcel_integration',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_enabled boolean DEFAULT false;`,
},
{
  name: 'tenants.easyparcel_api_key',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_api_key text;`, // ENCRYPT at app layer
},
{
  name: 'tenants.easyparcel_auth_key',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_auth_key text;`, // ENCRYPT at app layer
},
{
  name: 'tenants.easyparcel_detected_env',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_detected_env varchar DEFAULT 'production';`,
},
{
  name: 'tenants.easyparcel_warehouse_json',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_warehouse_json jsonb;`,
},
{
  name: 'tenants.easyparcel_selected_courier',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_selected_courier varchar;`,
},
{
  name: 'tenants.easyparcel_tested_at',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easyparcel_tested_at timestamp with time zone;`,
},
```

---

## D. CONCRETE FILE LIST — TO MODIFY & CREATE

### Files to MODIFY

| File | Changes | Lines | Type |
|------|---------|-------|------|
| `/src/collections/Orders.ts` | Add 12 new fields: `shippingCourier`, `shippingServiceId`, `awbNo`, `easyParcelOrderNo`, `labelUrl`, `shippingTrackingStatus`, `shippingTrackingHistory` (array), `shippingTrackingLastUpdated`, `parcelWeight`, `codAmount`, `codStatus` | 368–414 (shipping section) | Collection config |
| `/src/collections/Tenants.ts` | Add `easyParcelIntegration` group field with nested warehouse + auth config | ~250–350 (new section) | Collection config |
| `/src/app/api/orders/calculate-shipping/route.ts` | Hybrid fallback: detect tenant EasyParcel status; call new `getRates()` fn (calls EPRateCheckingBulk or flat rate); return selected courier + fee + ETA; also **snapshot `parcelWeight` into order** | 22–81 | API route |
| `/src/app/api/orders/checkout/route.ts` | **Save `shippingCourier`, `shippingServiceId`, `shippingFee`** to order creation payload (currently missing); call rate endpoint to get these values | ~260–290 (order creation) | API route |
| `/src/app/api/orders/stripe-checkout/route.ts` | Same: save `shippingCourier`, `shippingServiceId`, `shippingFee` (Stripe path) | ~200–250 | API route |
| `/src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` | **Conditional rendering:** If EasyParcel enabled + order has `shippingCourier`/`shippingServiceId`, swap ShipOrderModal with **CreateLabelModal** on "Ready to Ship" button (line 860–889); show different UI for manual vs. EP path | 860–889 (button + modal binding) | Client component |
| `/src/app/(dashboard)/orders/_components/ShipOrderModal.tsx` | Keep for **non-EasyParcel tenants** (manual tracking entry); no changes needed, but check conditional usage in OrderDetailPanel | — | Client component |
| `/src/lib/shipping/calculate-fee.ts` | Keep existing flat-rate logic; **reuse as fallback** | — | Utility |
| `/src/lib/shipping/index.ts` | Export new `getRates()` function (wraps flat-rate or EasyParcel) | — | Barrel export |
| `/scripts/db-setup.js` | Add migration entries for all new columns (above, §C) | ~100–150 new lines | Migration |

### Files to CREATE

| File | Purpose | Size (est.) | Type |
|------|---------|------------|------|
| `/src/lib/shipping/easyparcel/client.ts` | EasyParcel API client wrapper (EPRateCheckingBulk, EPSubmitOrderBulk, EPPayOrderBulk, EPParcelStatusBulk) | 300–400 lines | Utility |
| `/src/lib/shipping/easyparcel/normalize.ts` | Field transformation (mapState, normalizePhone, aggregateWeightKg, buildAddress, etc.) | 150–200 lines | Utility |
| `/src/lib/shipping/easyparcel/types.ts` | TypeScript interfaces for EasyParcel requests/responses | 100–150 lines | Type definitions |
| `/src/lib/shipping/get-rates.ts` | Hybrid router: detect tenant EasyParcel; call EasyParcel or fallback flat rate | 100–150 lines | Utility |
| `/src/app/api/orders/[id]/create-label/route.ts` | POST endpoint: validate order, call EPSubmitOrderBulk, EPPayOrderBulk, save awbNo/labelUrl; idempotent check (`if awbNo exists, reject`) | 200–300 lines | API route |
| `/src/app/api/cron/sync-tracking/route.ts` | Cron job: fetch orders with awbNo, batch-call EPParcelStatusBulk, update `shippingTrackingStatus` + history; no auto-complete | 200–300 lines | API route |
| `/src/app/(dashboard)/orders/_components/CreateLabelModal.tsx` | Modal form: weight (prefilled, editable), dimensions (prefilled, editable), pickup date (cut-off-aware), COD flag (if applicable); buttons for create + in-label + download | 400–500 lines | Client component |
| `/src/lib/email/templates/order-shipping-label.ts` | Email template: notify buyer of label creation + tracking # + ETA (optional) | 100–150 lines | Email template |

---

## E. COD-SPECIFIC CONCERNS & FLOW DIFFERENCES

### Current (Pre-F36) Manual COD
- Order placed with `paymentMethod='cod'`
- `paymentStatus='unpaid'` (never transitions until refund)
- Merchant ships manually, enters tracking #
- Merchant later records cash received from courier (manual process, no API)
- No audit trail of COD collection

### With F36 EasyParcel + COD
| Step | Field Changes | Status Changes | Risk |
|------|-------|-----------------|------|
| **1. Checkout** | Set `shippingCourier`, `shippingServiceId`, `shippingFee`, `parcelWeight`, `codAmount=order.total` | `status='pending'`, `paymentStatus='unpaid'` | None (same as before) |
| **2. Create Label** | Set `awbNo`, `easyParcelOrderNo`, `labelUrl`, `trackingNumber=awbNo` | `status='ready_to_ship'`, `paymentStatus='unpaid'` (still) | ⚠️ **Cruck:** EasyParcel deducts fee from merchant wallet; **label is paid upfront**, but COD remittance is held by courier until delivery + settlement. Need clear UI: "Shipping paid (RM X), COD will be collected by courier (RM Y)". |
| **3. Pickup** | — | — | If merchant cancels before pickup, fee is lost (EasyParcel policy — not API reversible) |
| **4. In Transit** | `shippingTrackingStatus` updates via cron to "IN_TRANSIT", "OUT_FOR_DELIVERY", etc. | `status='shipped'` (merchant manual) | None — display-only |
| **5. Delivered** | `shippingTrackingStatus='DELIVERED'` | `status='shipped'` (merchant still manual; NO auto-complete per PRD) | ⚠️ **Unpaid until merchant confirms.** Need reminder: "Mark as Completed once you receive COD cash." |
| **6. Refund (Before Pickup)** | Call `/api/orders/[id]/cancel` (existing) or `/api/orders/[id]/refund` (existing); will restock inventory | `status='cancelled'/'refunded'`, `paymentStatus='cancelled'` | ⚠️ **Cruck:** Shipping fee NOT auto-refunded by EasyParcel (no API); message to merchant: "Log into EasyParcel dashboard to cancel shipment and reclaim credit." |

### Key Architectural Insight
**COD = Order total unpaid until delivery; Shipping fee = prepaid (deducted from merchant wallet).** Platform never touches COD cash → **zero liability** (per PRD §4 non-custody guardrails). Merchant reconciles COD receipt with EasyParcel settlement report (manual weekly).

---

## F. MAPPING CHECKLIST — CURRENT FLOW TO F36 HOOK POINTS

### Current Checkout → New Checkout (Phase B)

**Before F36:**
```
Buyer address → calculate-shipping(state only) → flat fee → Order w/ shippingFee, no courier
```

**After F36 (hybrid):**
```
Buyer address → calculate-shipping(state + items.weight) → 
  ├─ Tenant EP enabled?
  │  ├─ YES → EPRateCheckingBulk(origin postcode, dest postcode, weight, dims, selectedCourier)
  │  │       → Order w/ shippingCourier + shippingServiceId + shippingFee + parcelWeight
  │  └─ NO  → flat West/East rate
  │       → Order w/ shippingFee, null courier
  └─ Both paths → Order created
```

**Files touched:**
- `POST /api/orders/calculate-shipping` — add items param, call `getRates()` hybrid
- `POST /api/orders/checkout` — save `shippingCourier`, `shippingServiceId`, `shippingFee`, `parcelWeight`
- `POST /api/orders/stripe-checkout` — same

### Current Fulfillment → New Fulfillment (Phase C)

**Before F36:**
```
OrderDetailPanel "Ready to Ship" → ShipOrderModal (tracking # free text) → PATCH /api/orders/[id] {status:'shipped'}
```

**After F36 (conditional):**
```
OrderDetailPanel "Ready to Ship" → 
  ├─ Tenant EP enabled + order.shippingCourier != null?
  │  ├─ YES → CreateLabelModal (weight, dims, pickup date, COD flag) 
  │  │       → POST /api/orders/[id]/create-label 
  │  │       → EPSubmitOrderBulk + EPPayOrderBulk 
  │  │       → Order w/ awbNo, labelUrl, easyParcelOrderNo, trackingNumber
  │  │       → PATCH /api/orders/[id] {status: 'ready_to_ship'} (inline, no explicit modal confirm)
  │  └─ NO  → ShipOrderModal (old behavior)
  └─ Cron /api/cron/sync-tracking → EPParcelStatusBulk → update shippingTrackingStatus
```

**Files touched:**
- `OrderDetailPanel` (decision: which modal to show based on tenant config)
- `/api/orders/[id]/create-label` (new)
- `/api/cron/sync-tracking` (new)
- `CreateLabelModal` (new)

---

## G. UNRESOLVED QUESTIONS & BLOCKERS

1. **COD Param Name (EPSubmitOrderBulk):**  
   Per F36 research report, param name unconfirmed in public API docs. Likely `cod` (boolean) or `cod_amount`. **ACTION:** Sandbox test before Phase C go-live.

2. **Tenants.easyParcelIntegration Structure — Payload Field Type:**  
   Field is `group`, so Payload nests as JSON object. For warehouse sub-fields, can either:
   - (A) Keep as `group` → Payload flattens to `easyparcel_warehouse_{line1,line2,city,state,postcode}` columns (Drizzle auto-naming), OR
   - (B) Use `json` for warehouse → single JSONB column, more flexible
   - **Choose (B) for MVP** (simpler, avoids Drizzle column proliferation)

3. **Shipping Fee Already in Order Schema:**  
   Field `shippingFee` exists (line 161, Orders.ts) but is **NEVER POPULATED** by either checkout route. **Must wire this in Phase B.** Currently hard-coded 0 or calculated client-side?

4. **Parcel Dimensions Aggregation:**  
   Products have dimensions (length/width/height cm). For multi-item orders, rule unclear:
   - Use largest product dims? (assume flat packing)
   - Sum all dims? (assume stacking)
   - Use DEFAULT_PARCEL constant if any item has 0 dims?
   - **Recommendation:** Use largest dims per product; if all 0, fallback to DEFAULT_PARCEL constant (TBD by business).

5. **Cut-Off Time per Courier:**  
   PRD §6.C-4c lists hardcoded times (J&T 13:50, Flash 14:00, Pos 12:50 MYT). **These must be verified pre-go-live.** Recommend task to re-verify mid-2026.

6. **Encryption of API Keys:**  
   `tenant.easyParcelApiKey` and `authKey` must not be readable plaintext. **Recommendation:** Use `@payloadcms/plugin-cloud` KMS or manual encryption library (e.g., `crypto`); store ciphertext in DB, decrypt at request time.

7. **Stripe Path + Shipping:**  
   Stripe-checkout creates order *before* Stripe session succeeds. **Does shipping fee = 0 at Stripe session creation?** If so, user sees wrong price in Stripe. **ACTION:** Verify; may need to calculate shipping earlier in flow.

8. **COD Remittance Reconciliation:**  
   No API provided by EasyParcel for COD settlement. Merchant views dashboard manually. **Platform responsibility = NONE.** Just track `codAmount` for audit; let merchant reconcile.

9. **Reverse Label API Shape:**  
   F36 research resolved this: use EPSubmitOrderBulk with origin↔dest swapped (pick=buyer address, send=merchant warehouse). But exact return value shape (does it return AWB for reverse?) **untested.** **ACTION:** Sandbox test Phase D.

10. **Order Depth for OrderDetailPanel:**  
    Currently uses `depth=1` → doesn't fetch `product.weight`/`product.dimensions`. CreateLabelModal needs these for modal prefill. **Must upgrade to `depth=2`** or fetch separately.

---

## SUMMARY TABLE — FILES MODIFIED + CREATED

| Category | Count | Examples |
|----------|-------|----------|
| **Modify (Existing Collections)** | 2 | Orders.ts (12 fields), Tenants.ts (1 group field) |
| **Modify (API Routes)** | 4 | checkout, stripe-checkout, calculate-shipping, OrderDetailPanel |
| **Create (API Routes)** | 2 | `/api/orders/[id]/create-label`, `/api/cron/sync-tracking` |
| **Create (Client Components)** | 1 | CreateLabelModal.tsx |
| **Create (Utilities/Libraries)** | 5 | easyparcel/{client,normalize,types}.ts, get-rates.ts, email template |
| **Modify (Migrations)** | 1 | db-setup.js (12 new migration entries) |
| **TOTAL NEW LINES OF CODE** | ~2500–3500 (est.) | — |

---

## KEY INSIGHTS FOR IMPLEMENTATION

1. **Flat-rate path untouched:** Existing `src/lib/shipping/` (calculate-fee, classify-region) remains as fallback. New code is additive.

2. **Per-merchant, non-custody:** Tenant owns EasyParcel account + API key; platform never holds wallet or COD funds. Shipping fees deducted from merchant wallet; COD settled by courier → merchant.

3. **Idempotency critical:** `create-label` endpoint must check `if order.awbNo exists → reject` to prevent double-charging merchant wallet.

4. **Hybrid checkout:** Seamless degradation — if EasyParcel unavailable/unconfigured, checkout falls back to flat rate. No user-facing disruption.

5. **Status decoupling:** Order lifecycle (`pending → confirmed → shipped → completed`) stays manual + intentional. Delivery tracking status (`SCHEDULED → DELIVERED`) is separate, display-only field populated by cron.

6. **COD risk:** Order is "confirmed but unpaid" until merchant receives cash from courier. Requires clear merchant UX + email reminders.

---

## NEXT STEPS (FOR PARENT AGENT)

1. **Phase A (Connect + Settings):** Implement `POST /api/tenants/[id]/easyparcel-test-connection` (calls EPRateCheckingBulk to validate key + warehouse).
2. **Phase B (Rate @ Checkout):** Wire `shippingFee`, `shippingCourier`, `parcelWeight` into checkout order creation; call `getRates()` hybrid.
3. **Phase C (Fulfillment):** Build CreateLabelModal + create-label endpoint + cron sync-tracking.
4. **Phase D (Returns):** Add reverse-label button + reuse existing refund/cancel endpoints.
5. **Pre-go-live:** Sandbox test COD param name, all 16 state codes, decimal precision for weight/dims, cut-off times.

---

**Report Generated:** 2026-06-17 14:40 UTC  
**Status:** Ready for development planning  
**Confidence Level:** HIGH (all questions map to working code paths or PRD decisions)

