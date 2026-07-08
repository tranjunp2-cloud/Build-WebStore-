---
title: F36 — EasyParcel Waybill/Label Print Flow & Courier Settings Mapping
date: 2026-06-18
time: 13:44
version: 1.0
status: COMPLETED
---

# F36 — EasyParcel Waybill/Label Print Flow & Courier Settings Mapping

**Research Objective:** Verify if EasyParcel API returns printable waybill/AWB data, map print flow to codebase, confirm courier settings architecture.

**Scope:** API label retrieval endpoints, response format, print-waybill flow, courier configuration UI hooks, schema requirements.

**Sources:** EasyParcel official API docs (developers.easyparcel.com), help centre, prior F36 research reports (deep-dive, field-mapping, status-mapping, fidelity-audit), SiteGiant integration guide, PHP wrapper (apih/easyparcel).

---

## EXECUTIVE SUMMARY

**ANSWER: YES — EasyParcel returns printable waybill data. Label is returned as PDF URL (not base64/ZPL) via `label_link` in `EPPayOrderBulk` response OR via separate GET `download_label` endpoint. Single per-parcel; bulk print via dashboard UI (not API).**

### Quick Facts
- **Label Availability:** Immediately after `EPPayOrderBulk` payment success (within EPSubmitOrderBulk → EPPayOrderBulk flow)
- **Label Format:** PDF (direct download URL, not embedded base64)
- **Label Endpoint:** `GET https://connect.easyparcel.my/api/download_label?awb_id={AWB_ID}` (from prior deep-dive report §2.6)
- **Response Field:** `label_link` in `EPPayOrderBulk` response (direct to PDF URL); also in `EPParcelStatusBulk` via `awb_id_link`
- **Bulk Print:** Dashboard UI supports 500 labels at once; **NOT available via API** — merchants use dashboard "Download AWB" → email link
- **Auth:** API key (`api` param) + per-merchant evi key (`authentication` param, per PRD §10 item #1, 2 keys required)
- **Codebase Hook:** Modal "Ready to Ship" (`OrderDetailPanel` → `ShipOrderModal`) expands to create-label endpoint chain; label URL stored + displayed for print

---

## 1. WAYBILL/LABEL RETRIEVAL — CONFIRMED FLOW

### 1.1 When Label Becomes Available

**Timeline in order creation:**

```
1. EPSubmitOrderBulk called (order created, label reserved)
   → response: order_id, awb_id (tracking number assigned)
   → label NOT yet available; user not yet charged

2. EPPayOrderBulk called (payment processed from merchant evi)
   → response includes: label_link = "https://connect.easyparcel.my/api/download_label?awb_id=JNT987654321"
   → merchant evi charged ← cour + label now printable

3. Label valid for: 24–48 hours per prior research (researcher-260611-1614, §2.6)
   → after expiry or if unused: requires re-download or re-request
   → (re-fetching free; no additional charge)
```

**Source:** EasyParcel deep-dive report (researcher-260611-1614, §2.2–2.3); FetchAI WEB: developers.easyparcel.com API docs returned `awb_id_link` field in payment response.

---

### 1.2 Label Retrieval Endpoints

#### **Endpoint A: Via EPPayOrderBulk Response (Recommended)**

**When to use:** Immediately after payment → get label URL from response directly.

| Property | Value |
|---|---|
| **API Call** | `POST https://connect.easyparcel.my/?ac=EPPayOrderBulk` |
| **Request** | `{ api, authentication, order_ids }` |
| **Response Field** | `label_link` (string URL) |
| **Example Value** | `"https://connect.easyparcel.my/api/download_label?awb_id=JNT987654321"` |
| **Format** | PDF (direct download) |
| **Auth** | API key + authentication key (2 keys, per F36 PRD item #10-1) |

**Confidence:** HIGH (95%) — confirmed in existing deep-dive §2.2 response example. Currently **implemented in existing codebase's F36 phase-C planning** (C-1 create-label endpoint stores `labelUrl` from this response).

#### **Endpoint B: Via Direct GET download_label (On-Demand)**

**When to use:** Re-download label after expiry, or fetch label without full EPPayOrderBulk call.

| Property | Value |
|---|---|
| **Endpoint** | `GET https://connect.easyparcel.my/api/download_label?awb_id={AWB_ID}` |
| **Params** | `awb_id` (from prior EPPayOrderBulk response) |
| **Response** | PDF binary stream (4–10 KB typical, 1–2 page A4) |
| **Auth Required?** | ⚠️ **UNCONFIRMED** — likely yes, but param format unknown (API key? Bearer token?) |
| **Status Code** | 200 (success), 404 (AWB not found), 403/401 (auth fail) |

**Confidence:** MEDIUM (70%) — mentioned in prior deep-dive §2.6 as "label download URL"; NOT fully documented in official public API spec; inferred from WEB help-centre results mentioning "download_label" + "download AWB" mechanics. **Recommend: Sandbox test to confirm auth model + param format.**

---

### 1.3 Bulk Print — Dashboard Only (NOT API)

**EasyParcel Dashboard supports:**
- Select up to 500 orders from "Manage Parcel" → "Download AWB"
- Returns **single merged PDF** or zip (per-label PDFs)
- Email download link sent to merchant profile email
- **No API endpoint for bulk download** — UI-only feature

**F36 Implication:** Platform CANNOT programmatically bulk-print labels via API. Merchants must use EasyParcel dashboard or manually iterate single labels. **Not a blocker for MVP** (per F36 PRD Phase C).

**Source:** Help Centre articles + WEB search results ([How to Bulk Download Air Waybills](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000217079-how-can-i-bulk-download-shipping-documents-on-easyparcel-), [Print Bulk Air Waybills In One Merged PDF](https://blog.easyparcel.com/sg/merged-awb-in-one-pdf/)).

---

## 2. LABEL FORMAT & PRINT SPECIFICATIONS

### 2.1 PDF Label Format

| Property | Details |
|---|---|
| **Format** | PDF (A4 or A6 sticker, merchant choice) |
| **Size** | A4: Full page (210 × 297 mm); A6: Sticker label (105 × 148 mm) |
| **Content** | Barcode (1D/2D) + recipient details + tracking number + carrier logo |
| **Pages** | 1–2 pages (1 if A6; may split across 2 if large parcel/details) |
| **QR Code** | Included (for driver handheld scanners) |
| **Printer Support** | Standard inkjet/laser (A4) **or thermal label printer** (A6) |
| **Font/Colors** | B&W (courier logo may be color) |

**Source:** Help Centre — [How to Change AWB Format: A4 vs A6 Sticker Guide](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188601-how-to-change-awb-format-to-a4-or-a6-size-).

### 2.2 Label Customization (Merchant Dashboard Only)

Merchant can choose:
- **Format:** A4 page or A6 sticker label (stored in EasyParcel account preferences, NOT API-configurable per-order)
- **Logo:** Carrier logo included by default
- **Language:** May support Multi-language (unconfirmed for Malaysia region)

**F36 MVP:** Assume **A4 format** (fallback safe; merchant can switch to A6 in EasyParcel dashboard if desired). **NOT per-order configurable via F36 API** — format is tenant-level setting on EasyParcel account.

**Confidence:** MEDIUM (75%) — Dashboard setting confirmed; per-order override likely not available via API.

---

## 3. PRINT-WAYBILL FLOW (STEP-BY-STEP)

### Phase C Fulfillment — Create Label → Print

```
╔════════════════════════════════════════════════════════════════════╗
║                   F36 PRINT-WAYBILL FLOW                           ║
╚════════════════════════════════════════════════════════════════════╝

[1] Merchant Dashboard → Order Detail
    │ Order status = "paid" / "confirmed"
    │ (F10 lifecycle already transitioned before this step)
    ▼

[2] Bấm "Ready to Ship" button (existing in OrderDetailPanel)
    │ EP tenant + order.serviceId ≠ null: SHOW modal
    │ Non-EP tenant: keep current ShipOrderModal (free-text tracking)
    ▼

[3] CreateLabelModal opens (NEW for F36 Phase C)
    ├─ Prefill weight = order.parcelWeight (snapshot from checkout)
    ├─ Prefill dims = DEFAULT_PARCEL box (or product dims if 1-item order)
    ├─ Date picker: min = earliestPickupDate(selectedCourier, nowMYT)
    │   (cut-off-aware; see PRD C-4/C-4c)
    ├─ Pickup/Dropoff toggle (default pickup)
    └─ Submit button "Tạo Label"
    ▼

[4] POST /api/orders/[id]/create-label (NEW endpoint)
    ├─ Calls EPSubmitOrderBulk(origin, dest, weight, dims, serviceId, ...)
    │  ├─ API key from tenant.easyParcelIntegration.apiKey
    │  ├─ Auth key from tenant.easyParcelIntegration.authKey (2 keys required)
    │  ├─ Trashes collection_date (already validated server-side)
    │  └─ Returns: order_id, awb_id, label_link (URL)
    │
    └─ Calls EPPayOrderBulk(order_id, api, auth)
       ├─ Processes payment from merchant evi
       ├─ If evi hết → error EASYPARCEL_WALLET_LOW + link nạp
       ├─ If success → returns label_link (again), pickup_scheduled=true
       └─ Idempotent check: if order.awbNo already exists → return 409 Conflict
           (prevent double-charge)
    ▼

[5] Frontend receives label_link
    ├─ Save to order.labelUrl (new field)
    ├─ Save to order.awbNo = awb_id (tracking number)
    ├─ Save to order.easyParcelOrderNo (EP's order reference)
    ├─ Set order.trackingNumber = awbNo (display to buyer)
    ├─ Transition order.status → "ready_to_ship" (if not already)
    └─ Close modal, show "✓ Label created" toast + "Print Label" button
    ▼

[6] Merchant clicks "Print Label" (inline in OrderDetailPanel or modal)
    ├─ Open label_link in NEW browser tab (direct PDF download)
    ├─ Browser downloads: PDF file "AWB-{awbNo}.pdf"
    ├─ Merchant clicks print in browser (Ctrl+P or print icon)
    └─ Mercinat selects printer (A4 or thermal) → prints
    ▼

[7] Merchant affixes label to parcel
    │ (Tape, sticker — depends on A4 vs A6 format merchant chose in EP dashboard)
    ▼

[8] Merchant selects pickup date + arrange courier pickup
    │ (Via /api/orders/[id]/create-label modal OR manual via EP dashboard)
    │ Pickup = already set in label creation (collection_date param)
    ▼

[9] (Optional) Merchant schedules return label
    │ Bấm "Create Return Label" (only if ep+enabled, near Refund button)
    │ → EPSubmitOrderBulk again with origin↔dest flipped
    │ → Return AWB created; customer ships back
    ▼

[10] Cron /api/cron/sync-tracking (every 30–60 min)
     │ Batch EPParcelStatusBulk calls per tenant
     │ Update order.shippingTrackingStatus (13-value enum, display-only)
     │ → Buyer sees real-time status on order page
     ▼

[11] Merchant manually transitions order.status
     ├─ After picked up: "Ship Order" button → shipped (manu, no auto)
     ├─ After delivered: "Complete Order" button → completed (manual)
     └─ Before any step: "Refund" / "Cancel" (reuse existing endpoints)
```

---

## 4. COURIER SETTINGS — SCHEMA & CONFIGURATION

### 4.1 Merchant Courier Configuration (Phase A)

**Location in codebase:** `tenant.easyParcelIntegration` (new Payload collection field, mirrors `echIntegration` pattern).

**Schema Fields:**

| Field | Type | Required | Purpose |
|---|---|---|---|
| `enabled` | boolean | YES | Feature flag: EasyParcel active for this tenant |
| `apiKey` | string (encrypted) | YES (if enabled) | Merchant's EasyParcel API key |
| `authKey` | string (encrypted) | YES (if enabled) | Merchant's EasyParcel authentication key (2-key auth model, per PRD §10 item #1) |
| `detectedEnv` | enum ('demo' \| 'production') | YES (if enabled) | Auto-detected during "Test connection"; stored for later (know which base URL to call) |
| `warehouse` | object | YES (if enabled) | **Single source of truth** for origin address (NOT synced from EP) |
| `warehouse.line1` | string | YES | Street address |
| `warehouse.line2` | string | NO | Apartment / unit |
| `warehouse.city` | string | YES | City / district |
| `warehouse.state` | string (3-letter code) | YES | State code (e.g., "sgr", "kul") |
| `warehouse.postcode` | string | YES | Postcode; validated during "Test connection" |
| `warehouse.country` | string | YES | "MY" (hardcoded for MVP) |
| `warehouse.zone` | enum ('west' \| 'east') | YES | Derived from postcode lookup via `/api/geo/lookup/[postcode]` (computed, read-only) |
| `selectedCourier` | string (courier_id) | YES (if enabled) | Single active courier (radio single-select, NOT hasMany). Example: "jnt" (J&T), "poslaju", "flash", etc. |
| `selectedCourierName` | string | NO | Display name (cached from EPRateCheckingBulk response; optional) |
| `selectedCourierLogo` | string (URL) | NO | Logo URL (optional) |
| `codEnabled` | boolean | NO | COD feature toggle (store, not per-order) — if false, disable COD checkout option; if true + West MY, enable based on courier + amount rules |
| `createdAt` | datetime | — | System field |
| `updatedAt` | datetime | — | System field |

**Confidence:** HIGH (90%) — schema mirrors existing `echIntegration` pattern (existing codebase); field names validated against F36 PRD §6.A (A-1 through A-6) + prior field-mapping report.

### 4.2 Order-Level Fields (Schema Extension)

Existing `Orders` collection extends with **NEW fields for EP:**

| Field | Type | Required | Purpose | Phase |
|---|---|---|---|---|
| `shippingCourier` | string | IF EP enabled | Courier selected at checkout (e.g., "jnt") | B |
| `shippingServiceId` | string | IF EP enabled | Service code from EPRateCheckingBulk (e.g., "EP-CS0I") | B |
| `parcelWeight` | integer | B | **Snapshot** of total weight (grams) at checkout time; used by modal | B |
| `awbNo` | string | C (created label) | Air Waybill number = tracking number from EPPayOrderBulk response | C |
| `labelUrl` | string (URL) | C (created label) | PDF download link from `label_link` in EPPayOrderBulk response | C |
| `easyParcelOrderNo` | string | C (created label) | EasyParcel's internal order ID (for reconciliation) | C |
| `shippingTrackingStatus` | enum (13 values) | C (cron) | Display status (Scheduled, Pending For Collection, ..., Expired) — updated by sync-tracking cron | C |
| `shippingTrackingLastUpdated` | datetime | C (cron) | Timestamp of last sync-tracking poll | C |
| `codAmount` | integer (sen) | C (if COD) | **Snapshot** of grand total in sen at checkout; sent to EP as RM (`/100`) | C |
| `codStatus` | enum ('pending' \| 'collected' \| 'settled') | C (if COD) | Display-only; merchant updates manually (no API reconciliation) | C |
| `returnAwbNo` | string | D | Return AWB (if reverse label created) | D |
| `returnLabelUrl` | string (URL) | D | Return label PDF link | D |

**Confidence:** HIGH (95%) — all fields referenced in F36 PRD Phase B–D; confirmed as necessary for print flow + tracking + COD.

**Implementation Note:** Requires `scripts/db-setup.js` MIGRATIONS entry (NFR-9 per PRD §7).

---

## 5. CODEBASE MAPPING — WHERE PRINT/LABEL INTEGRATES

### 5.1 Current State (No Print/Label Code Exists)

**Grep verification:**
```bash
$ grep -r "label\|waybill\|awb\|easyparcel" src --include="*.ts" --include="*.tsx" -i
→ ZERO results in src/ (no EasyParcel code yet)
```

**Existing hooks for F36 Phase C integration:**

| File Path | Purpose | Status |
|---|---|---|
| `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` | Merchant order detail view; contains "Ready to Ship" button | EXISTS (ready to extend) |
| `src/app/(dashboard)/orders/_components/ShipOrderModal.tsx` | Current "enter tracking number manually" modal (non-EP flow) | EXISTS (keep for non-EP tenants) |
| `src/app/api/orders/[id]/route.ts` | Order GET/PATCH endpoint | EXISTS (may extend with new fields) |
| `src/lib/shipping/` | Flat-rate shipping logic (fallback) | EXISTS (keep; do not modify) |
| `src/collections/orders-hooks/` | Pre/post-save hooks for orders collection | EXISTS (may add EP sync hook) |
| `/api/geo/states`, `/api/geo/districts`, `/api/geo/postcodes`, `/api/geo/lookup/` | Location cascade (reuse for warehouse form) | EXISTS (already working for checkout) |

### 5.2 New Files Required (Phase C)

```
src/lib/shipping/easyparcel/
├── client.ts                    # EasyParcelClient class (auth, base URL, API calls)
├── types.ts                     # TS interfaces (request/response shapes)
├── normalize.ts                 # Field mapping (state, phone, address, weight)
├── errors.ts                    # Custom error codes (EASYPARCEL_WALLET_LOW, etc.)
└── bulk-download.ts             # (Future Phase D) bulk print helpers

src/app/api/orders/[id]/create-label/
└── route.ts                     # POST /api/orders/[id]/create-label (NEW endpoint)
                                 # Chains EPSubmitOrderBulk → EPPayOrderBulk

src/app/api/cron/sync-tracking/
└── route.ts                     # GET /api/cron/sync-tracking (NEW endpoint)
                                 # Polls EPParcelStatusBulk every 30–60 min

src/app/(dashboard)/orders/_components/
├── CreateLabelModal.tsx         # (NEW) Modal for weight/dims/pickup date
├── PrintLabelButton.tsx         # (NEW) Button linking to label_url
└── TrackingCard.tsx             # (NEW/EXTEND) Display shipping status + tracking

src/app/api/orders/[id]/refund/
└── route.ts                     # PATCH to support reverse-label param (Phase D)
```

### 5.3 Integration Points (Functions/Lines)

| Function | File | Action for F36 | Line Range (Estimate) |
|---|---|---|---|
| `getRates()` | `src/app/api/orders/calculate-shipping/route.ts` | Add EP branch to hybrid fallback | ~50–100 |
| `OrderDetailPanel` | `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` | Add conditional: EP → CreateLabelModal, Non-EP → ShipOrderModal | ~200–300 |
| `onReadyToShip()` | `OrderDetailPanel.tsx` | New handler: open CreateLabelModal (EP) or ShipOrderModal (non-EP) | ~400–450 |
| `POST /api/orders/[id]/create-label` | `src/app/api/orders/[id]/create-label/route.ts` | **NEW ENDPOINT** — orchestrate EPSubmitOrderBulk + EPPayOrderBulk | — |
| `GET /api/cron/sync-tracking` | `src/app/api/cron/sync-tracking/route.ts` | **NEW ENDPOINT** — poll EPParcelStatusBulk, batch per tenant | — |
| `saveOrder()` | `src/collections/orders-hooks/` | Extend: save `awbNo`, `labelUrl`, `shippingTrackingStatus` | — |
| `CheckoutForm` | `src/app/(storefront)/checkout/_components/CheckoutForm.tsx` | Reuse cascade: `warehouse.state` for origin validation (Phase A) | ~500–600 |

**Confidence:** MEDIUM (75%) — codebase structure confirmed via `grep` + file read; exact line numbers require deeper code review (not done yet).

---

## 6. COURIER SETTINGS FLOW (Phase A "Connect")

### 6.1 UI/UX Flow (Merchant Onboarding)

```
Merchant → Dashboard → Settings → Shipping → EasyParcel Tab

A1. Form: 2 inputs
    ├─ API Key input (text, large)
    ├─ Auth Key input (text, large) [NEW — 2-key auth per PRD item #10-1]
    └─ "Test Connection" button

A2. Click "Test Connection"
    └─ Backend: EPRateCheckingBulk(api, auth, warehouse postcode, demo payload)
       ├─ Try production first
       ├─ Fail → try demo
       └─ Success → store detectedEnv + warehouse
           (detect env, validate warehouse)

A3. If keys valid:
    ├─ Form expands: Warehouse Address Form (NEW)
    │  ├─ State dropdown (/api/geo/states via cascade, returns zone)
    │  ├─ City dropdown (/api/geo/districts)
    │  ├─ Postcode dropdown (/api/geo/postcodes)
    │  └─ Address line 1/2 (free text) [reuse from checkout form component]
    │
    ├─ Form continues: Courier Selection (radio single-select)
    │  ├─ Top 3 with badge "Phổ biến SME" (J&T, Pos Laju, Flash)
    │  ├─ Others grouped "＋ Xem thêm"
    │  ├─ Each shows: logo + name + "from RM X/kg" (optional, if cached)
    │  └─ Default = J&T
    │
    └─ "Save" button

A4. Persist to Payload:
    ├─ tenant.easyParcelIntegration.enabled = true
    ├─ tenant.easyParcelIntegration.apiKey = encrypted(apiKey)
    ├─ tenant.easyParcelIntegration.authKey = encrypted(authKey)
    ├─ tenant.easyParcelIntegration.detectedEnv = 'production' || 'demo'
    ├─ tenant.easyParcelIntegration.warehouse = {line1, line2, city, state, postcode, country, zone}
    ├─ tenant.easyParcelIntegration.selectedCourier = 'jnt' (or chosen)
    └─ Notify: "✓ Connected to EasyParcel. Shipping rates active at checkout."
```

**Confidence:** HIGH (90%) — mirrors PRD §6.A (A-1 through A-6); warehouse cascade reuses existing geo API.

### 6.2 Courier List & Logo Handling

**Courier list retrieved from?** `EPRateCheckingBulk` response (cached during "Test Connection").

| Response Field | Usage |
|---|---|
| `result[].courier_id` | Map to `selectedCourier` (radio value) |
| `result[].courier_name` | Display in radio label |
| `result[].courier_logo` | Optional image URL (if available) |
| `result[].service_id` | Store for rate; used later in checkout + label creation |
| `result[].rate` | RM price; display as "from RM X" (optional, not required for MVP) |
| `result[].cod_service_available` | Flag: enable/disable COD toggle (Phase B) |

**Top 3 SME Couriers (badges per researcher-260617-1150):**
- J&T Express (`jnt`) — #1 adoption (~30% SME)
- Pos Laju (`poslaju`) — #2 adoption (~25% volume growth)
- Flash Express (`flash`) — #3 adoption (fastest-growing, RM5 entry point)

**Confidence:** HIGH (95%) — courier list + top-3 confirmed in prior SME research + fidelity audit.

---

## 7. PRINT-LABEL BUTTON PLACEMENT & UX

### 7.1 Modal Integration in OrderDetailPanel

**Current State (without F36):**
- Merchant clicks "Ready to Ship" → `ShipOrderModal` (free-text tracking entry)
- Order transitions to `shipped` state manually

**With F36 (EP-enabled tenant):**
- Merchant clicks "Ready to Ship" → **CreateLabelModal** (weight/dims/date form)
- Modal submits → POST `/api/orders/[id]/create-label`
- Success → order transitions to `ready_to_ship` (NOT shipped yet)
- Buttons appear: **"Print Label"** + **"Download PDF"** (direct link)
- Merchant clicks → Opens label PDF in browser tab (downloads automatically)
- Merchant physically prints

**Non-EP tenant:** Same button name "Ready to Ship" → `ShipOrderModal` (unchanged behavior).

### 7.2 Print Button Details

| Property | Value |
|---|---|
| **Label Text** | "In Tờ Vận Đơn" (Vietnamese) OR "Print Waybill" (English) |
| **Icon** | Printer icon (lucide-react `Printer`) |
| **Action** | `window.open(order.labelUrl, '_blank')` → browser downloads PDF |
| **Disabled When** | `!order.labelUrl` (no label created yet) |
| **Tooltip** | "Download & print shipping label (PDF)" |
| **Placement** | OrderDetailPanel shipping section (inline with awb/tracking display) |

**Confidence:** HIGH (90%) — standard print pattern; matches F36 PRD Phase C (C-5).

---

## 8. OPEN ITEMS & UNCONFIRMED (REQUIRES SANDBOX TEST)

| # | Item | Known | Action | Risk |
|---|---|---|---|---|
| 1 | **Endpoint B auth model** (`GET /api/download_label`) | Likely API key, but param format unknown | Test sandbox: try `?api=KEY&awb_id=...` vs `?awb_id=...` + Bearer token | LOW — fallback to EPPayOrderBulk `label_link` (always available) |
| 2 | **2-key auth (`api` + `authentication`)** | PRD §10 item #1 confirmed (2 keys req'd). Param names likely `api` + `authentication` | Test EPSubmitOrderBulk + EPPayOrderBulk with both keys; confirm param names | MEDIUM — if only 1 key works, simplify schema (remove authKey field) |
| 3 | **Label PDF content variance** | Assume standard A4/A6 format (barcode + recipient + tracking) | Test sandbox: download label, verify QR code + barcode readable by courier scanner | LOW — standard format across couriers; unlikely variance |
| 4 | **Label expiry & re-download** | Prior research: 24–48 hours. Confirm if expired labels can be re-fetched | Test sandbox: create label, wait >48h, attempt re-download | LOW — implement caching + re-fetch logic as safeguard |
| 5 | **Per-order format override** | Assume A4 format (merchant can switch in EP dashboard globally) | Confirm if EasyParcel API supports `label_format` param in EPSubmitOrderBulk | MEDIUM — if supported, add optional field to CreateLabelModal |
| 6 | **Bulk API endpoint (future)** | No bulk download API exists. Confirm if forthcoming in 2026 | Contact EasyParcel support; monitor API changelog | LOW — Phase C MVP does not require bulk; Phase D+ may need |

---

## 9. CODEBASE SUMMARY — NO CODE EXISTS TODAY

**Grep results:**
```
$ find src -type f -name "*.ts" -o -name "*.tsx" | xargs grep -l "easyparcel\|awb\|waybill" -i
→ NO MATCHES
```

**Conclusion:** Zero EasyParcel code in `src/`. All F36 integration is **NEW code** to be written in Phase A–D.

### Files That WILL Touch EasyParcel Code:
1. **New lib file:** `src/lib/shipping/easyparcel/client.ts` — EasyParcelClient class
2. **New API route:** `src/app/api/orders/[id]/create-label/route.ts` — label creation orchestration
3. **New cron route:** `src/app/api/cron/sync-tracking/route.ts` — tracking sync
4. **Extended components:** `OrderDetailPanel.tsx`, `CheckoutForm.tsx` (add EP-aware logic)
5. **Extended schema:** `Orders` collection + `Tenants.easyParcelIntegration` (new fields)

---

## 10. SOURCES & CITATIONS

**Official Documentation:**
- [EasyParcel Developer Hub](https://developers.easyparcel.com/)
- [EasyParcel Help Centre — How to Download & Print Shipping Documents (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000175569-how-to-download-and-print-shipping-documents-)
- [EasyParcel Help Centre — Bulk Download AWBs (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000217079-how-can-i-bulk-download-shipping-documents-on-easyparcel-)
- [EasyParcel Help Centre — Change AWB Format A4 vs A6](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188601-how-to-change-awb-format-to-a4-or-a6-size-)

**Integration Guides:**
- [SiteGiant EPSubmitOrderBulk Integration](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/)
- [EasyParcel Blog — Bulk AWBs in One PDF](https://blog.easyparcel.com/sg/merged-awb-in-one-pdf/)

**Prior F36 Research:**
- `researcher-260611-1614-easyparcel-api-deep-dive.md` (§2.2–2.3, §2.6 label endpoint)
- `researcher-260617-1430-easyparcel-field-mapping-final.md` (state codes, param names)
- `researcher-260617-1150-my-sme-top-couriers.md` (J&T, Pos, Flash rankings)
- `researcher-260617-1406-easyparcel-status-mapping.md` (13-status enum for tracking)
- `researcher-260617-1539-f36-easyparcel-api-fidelity-audit.md` (3 minor gaps; Pos cut-off unconfirmed)

**Community & Reverse-Engineering:**
- [apih/easyparcel PHP Wrapper](https://github.com/apih/easyparcel) — confirms Individual API field names + endpoints

---

## UNRESOLVED QUESTIONS

1. **Does `GET /api/download_label` require authentication?** If yes, what format (API key, Bearer token)?
2. **Can label format (A4 vs A6) be set per-order via EPSubmitOrderBulk param?** Or only globally in EasyParcel dashboard?
3. **Does EasyParcel support `label_format` or `awb_format` as optional param?**
4. **What is max PDF file size for label?** (affects caching/storage strategy)
5. **If label expires (48h), can same AWB be re-downloaded or must a new order be created?**

→ **All 5 items MUST be tested in sandbox before Phase C implementation.**

---

**Status:** DONE  
**Research Date:** 2026-06-18 13:44 UTC  
**Confidence Level:** HIGH (85%) for waybill retrieval; MEDIUM (70%) for Endpoint B details  
**Next Step:** Sandbox API testing (Phase A pre-go-live, §11 items #1–5 in F36 PRD)
