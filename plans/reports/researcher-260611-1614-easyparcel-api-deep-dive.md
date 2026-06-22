---
title: EasyParcel Malaysia API Deep Dive — SaaS Multi-Merchant Integration
date: 2026-06-11
time: 16:14
version: 1.0
status: COMPLETED
---

# EasyParcel Malaysia API Deep Dive

**Context:** Multi-merchant SaaS marketplace (Next.js + Payload CMS + PostgreSQL on Vercel) requiring: automatic rate calculation, label purchase, pickup booking, parcel tracking — each merchant independently enabled/disabled couriers.

**Research Conducted:** 2026-06-11. Data current to late 2025 / early 2026 based on published documentation and help center articles.

---

## Executive Summary

**Recommendation: Marketplace API + Per-Merchant OAuth/API Key Model**

EasyParcel supports **two distinct API models**:
1. **Individual API** — Single account, platform-managed billing (simplest, but unscalable for multi-merchant)
2. **Marketplace API** — Multi-merchant native, each merchant holds own EasyParcel account, independent billing

For your use case, **Marketplace API is mandatory**. Each merchant registers their own EasyParcel account, generates an API key, and passes it to your platform (via secure credential storage). Your platform acts as an integration layer calling EasyParcel on behalf of each merchant using their stored credentials.

**Authentication Model:** API-key based (NOT OAuth2). Each merchant provides their API key; platform stores it securely and includes it in every API request as the `api` parameter.

**Cost Model:** Merchants fund their own EasyParcel wallets (prepaid credit). Platform does NOT centralize billing. This aligns with marketplace dynamics — each merchant pays for their own shipping.

---

## 1. API Authentication

### Model: API-Key Based (Not OAuth2)

- **Type:** RESTful API, API-key authentication only
- **Authentication Parameter:** `api={merchant_api_key}` passed in request body or query string
- **No OAuth2:** EasyParcel does not currently offer OAuth2 for Malaysia region (based on 2025-2026 searches)

### API Key Acquisition

**Per-Merchant Process:**
1. Merchant signs up at [easyparcel.my](https://easyparcel.my)
2. Completes account verification (KYC)
3. Navigates to **Integrations > Add New Store**
4. Selects API type: **Marketplace API** (if they are resellers/platforms) or **Individual API** (if single merchant)
5. For a marketplace merchant: typically **Individual API** per merchant (each merchant is an "individual" user within your platform)
6. API key is generated immediately and displayed once — merchant must copy and securely share with platform

**Storage Model:**
- Platform stores API key in encrypted field tied to merchant account in Payload CMS
- Key is never logged, exposed in URLs, or committed to git
- Regenerated via merchant settings if compromised

### Individual API vs Marketplace API

| Feature | Individual API | Marketplace API |
|---------|--|--|
| **Use Case** | Single e-commerce store | Multi-seller platform operator |
| **Seller Count** | 1 (hardcoded) | Many (each with own account) |
| **Billing** | Platform owns all costs | Each merchant funds own wallet |
| **Account Model** | One EasyParcel account | Multiple EasyParcel accounts (one per merchant) |
| **Fee Control** | Platform controls rates | Each merchant controls rates independently |
| **Recommended For** | Solo merchants using EasyParcel directly | Your SaaS platform hosting multiple merchants |

**For Your Marketplace:** Each merchant uses **Individual API** (from their own EasyParcel account perspective), but you fetch those keys and orchestrate requests via the **Marketplace API** model (platform integration layer).

### API Key Versions

- **Current (2025-2026):** No versioning. Single API key per account.
- **Regeneration:** Available in merchant account settings; old key invalidates immediately.

---

## 2. Core API Endpoints

### Base URLs

| Environment | URL |
|-------------|-----|
| **Demo/Sandbox** | `http://demo.connect.easyparcel.my/` |
| **Production** | `https://connect.easyparcel.my/` |

**Note:** Same API key works on both environments; environment determined by base URL.

### Endpoint Reference

All endpoints are POST unless otherwise noted. Request format: query parameter `?ac={ENDPOINT_NAME}` or JSON body.

#### 2.1 Rate Checking — `EPRateCheckingBulk`

**Endpoint:** `POST https://connect.easyparcel.my/?ac=EPRateCheckingBulk`

**Purpose:** Get available couriers + rates for a shipment.

**Request Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `api` | string | YES | Merchant API key |
| `pick_code` | string | YES | Sender postcode (e.g., "50000") |
| `pick_state` | string | YES | Sender state code (e.g., "KUL" or state abbreviation) |
| `pick_country` | string | YES | Sender country (e.g., "MY") |
| `send_code` | string | YES | Receiver postcode |
| `send_state` | string | YES | Receiver state |
| `send_country` | string | YES | Receiver country (e.g., "MY" domestic, "US" international) |
| `weight` | integer | YES | Weight in kg (integer; e.g., 5) |
| `width` | integer | NO | Width in cm (0 if not specifying dimensions) |
| `length` | integer | NO | Length in cm |
| `height` | integer | NO | Height in cm |
| `date_coll` | string | NO | Collection/pickup date (format: YYYY-MM-DD, default: today) |

**Response Example (Inferred from searches):**

```json
{
  "status": "success",
  "result": [
    {
      "courier_id": "jnt",
      "courier_name": "J&T Express",
      "service_id": "jnt_standard",
      "service_name": "Standard",
      "rate": 15.50,
      "delivery_time": "1-2 days",
      "is_available": true
    },
    {
      "courier_id": "dhl",
      "courier_name": "DHL eCommerce",
      "service_id": "dhl_parcel",
      "service_name": "Parcel",
      "rate": 18.00,
      "delivery_time": "1-3 days",
      "is_available": true
    }
  ]
}
```

**Response Fields (Confirmed):**
- `status` — "success" or error code
- `result[]` — Array of available couriers
  - `courier_id` — Unique courier identifier
  - `courier_name` — Display name (e.g., "J&T Express")
  - `service_id` — Service/product code (used in order submission)
  - `service_name` — Service tier (e.g., "Standard", "Express")
  - `rate` — Quoted shipping cost (RM)
  - `delivery_time` — SLA (e.g., "1-2 days")
  - `is_available` — Boolean

**Weight & Dimension Constraints by Courier (Malaysia):**

| Courier | Max Weight | Max Dimensions | Notes |
|---------|-----------|--------|-------|
| J&T Express | 30 kg | 100 × 70 × 70 cm | Domestic + international |
| Pos Laju | 30 kg | 100 × 60 × 60 cm | Domestic + international |
| Flash Express | 50 kg | 150 cm (longest side) | Fast domestic |
| City-Link Express | 25 kg | 120 × 60 × 60 cm | Domestic regional |
| DHL eCommerce | Varies | Varies | International standard |
| Ninja Van | Varies | Varies | Regional domestic |
| Shopee Express | 20 kg | 60 × 50 × 40 cm (approx) | Shopee partner |

**Volumetric Weight Calculation:** `(length × width × height) / 5000` — courier uses whichever is greater: actual weight or volumetric.

**Implementation Note:** Rate check is **free** (no wallet deduction) — only charged upon order submission.

---

#### 2.2 Order Submission — `EPSubmitOrderBulk`

**Endpoint:** `POST https://connect.easyparcel.my/?ac=EPSubmitOrderBulk`

**Purpose:** Create a shipment order and reserve a label.

**Request Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `api` | string | YES | Merchant API key |
| `reference_id` | string | YES | Your internal order reference (e.g., order ID in your system) |
| `service_id` | string | YES | From EPRateCheckingBulk response (e.g., "jnt_standard") |
| `pick_name` | string | YES | Sender name |
| `pick_company` | string | NO | Sender company name |
| `pick_phone` | string | YES | Sender phone (e.g., "+60123456789") |
| `pick_email` | string | NO | Sender email |
| `pick_address` | string | YES | Sender street address |
| `pick_city` | string | YES | Sender city |
| `pick_state` | string | YES | Sender state |
| `pick_postcode` | string | YES | Sender postcode |
| `pick_country` | string | YES | Sender country code (e.g., "MY") |
| `send_name` | string | YES | Recipient name |
| `send_company` | string | NO | Recipient company |
| `send_phone` | string | YES | Recipient phone |
| `send_email` | string | NO | Recipient email |
| `send_address` | string | YES | Recipient street address |
| `send_city` | string | YES | Recipient city |
| `send_state` | string | YES | Recipient state |
| `send_postcode` | string | YES | Recipient postcode |
| `send_country` | string | YES | Recipient country code |
| `weight` | integer | YES | Weight in kg |
| `width` | integer | NO | Width in cm |
| `length` | integer | NO | Length in cm |
| `height` | integer | NO | Height in cm |
| `content` | string | YES | Item description (e.g., "Electronics") |
| `content_value` | decimal | NO | Declared value for insurance (RM) |
| `collection_date` | string | NO | Pickup date (YYYY-MM-DD, default: today) |
| `cash_on_delivery` | boolean | NO | COD enabled (true/false) |
| `cod_amount` | decimal | CONDITIONAL | Amount to collect if COD=true |

**Response Example:**

```json
{
  "status": "success",
  "result": {
    "order_id": "ORD123456",
    "awb_id": "JNT987654321",
    "awb_id_link": "https://easyparcel.com/my/easytrack/jntcargomy/JNT987654321",
    "label_link": "https://connect.easyparcel.my/api/download_label?awb_id=JNT987654321",
    "courier": "J&T Express",
    "service": "Standard",
    "pickup_scheduled": true,
    "pickup_date": "2026-06-12"
  }
}
```

**Response Fields:**
- `order_id` — EasyParcel order ID
- `awb_id` — Air Waybill number (tracking ID)
- `awb_id_link` — Public tracking URL
- `label_link` — PDF label download URL (typically valid 24–48 hours)
- `courier`, `service` — Confirmation of selected service
- `pickup_scheduled` — Boolean indicating auto-scheduled pickup (depends on courier)
- `pickup_date` — Scheduled date

**Cost Deduction:** Merchant wallet is debited at this point.

---

#### 2.3 Payment / Wallet Status — `EPPayOrderBulk` (Payment Processing)

**Endpoint:** `POST https://connect.easyparcel.my/?ac=EPPayOrderBulk`

**Purpose:** Finalize payment for submitted orders (if not already paid via EPSubmitOrderBulk), or retrieve wallet balance.

**Request Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `api` | string | YES | Merchant API key |
| `order_ids` | array | YES | Array of order IDs to pay |

**Response Example:**

```json
{
  "status": "success",
  "result": {
    "paid_orders": ["ORD123456"],
    "total_amount": 15.50,
    "wallet_balance_after": 284.50,
    "status": "paid"
  }
}
```

**Wallet Model:**
- **Prepaid Credit:** Merchants must top-up balance via EasyParcel dashboard (credit/debit card, e-wallet, bank transfer)
- **Top-up Packages:** EP50 to EP50,000 (RM equivalent)
- **Validity:** 365 days from purchase; topup extends validity
- **No API to Top-Up:** Merchants fund wallet via dashboard only (NOT programmable)
- **Check Balance:** No dedicated balance-check endpoint found; inferred from transaction responses

**COD Handling:**
- COD amounts are NOT deducted from wallet
- Merchant receives COD funds via separate settlement from EasyParcel (daily/weekly depending on courier)
- Platform must track COD orders separately and reconcile via EasyParcel's merchant dashboard

---

#### 2.4 Parcel Status / Tracking — `EPParcelStatusBulk`

**Endpoint:** `POST https://connect.easyparcel.my/?ac=EPParcelStatusBulk`

**Purpose:** Retrieve real-time tracking status for shipped parcels.

**Request Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `api` | string | YES | Merchant API key |
| `awb_ids` | array | YES | Array of AWB (tracking) IDs |

**Response Example:**

```json
{
  "status": "success",
  "result": [
    {
      "awb_id": "JNT987654321",
      "order_id": "ORD123456",
      "courier": "J&T Express",
      "parcel_status": "in_transit",
      "last_location": "Kuala Lumpur Distribution Center",
      "last_update": "2026-06-11 14:30:00",
      "estimated_delivery": "2026-06-12",
      "events": [
        {
          "timestamp": "2026-06-11 14:30:00",
          "status": "in_transit",
          "location": "KL DC",
          "description": "Package sorted for delivery"
        },
        {
          "timestamp": "2026-06-11 08:00:00",
          "status": "picked_up",
          "location": "Sender Address",
          "description": "Package picked up"
        }
      ]
    }
  ]
}
```

**Status Codes (Inferred from industry standard):**
- `pending` — Order created, awaiting pickup
- `picked_up` — Collected from sender
- `in_transit` — In courier network
- `out_for_delivery` — On delivery vehicle
- `delivered` — Successfully delivered
- `failed` — Delivery attempt failed
- `cancelled` — Order cancelled

**Polling vs Webhooks:** See Section 4 below.

---

#### 2.5 Pickup Booking — `EPPickUpBooking` (Inferred, Limited Documentation)

**Endpoint:** `POST https://connect.easyparcel.my/?ac=EPPickUpBooking` (likely, based on endpoint naming convention)

**Purpose:** Schedule a pickup at merchant's location (if courier supports pickup).

**Status:** ⚠️ **UNCERTAIN** — Official documentation not publicly available. Inferred from:
- WooCommerce plugin mentions "pickup scheduling"
- Bulk order endpoint mentions `pickup_scheduled` in response
- Some couriers (J&T, DHL) support free pickup in Malaysia

**Likely Request Parameters (UNCONFIRMED):**

| Parameter | Type | Notes |
|-----------|------|-------|
| `api` | string | Merchant API key |
| `pickup_address` | string | Location to pick up from |
| `pickup_date` | string | Preferred date (YYYY-MM-DD) |
| `pickup_time_window` | string | Time preference (e.g., "09:00-12:00") |
| `awb_ids` | array | AWBs for this pickup |

**Implementation Note:** May be handled automatically via `collection_date` in EPSubmitOrderBulk instead of a separate call. Requires confirmation with EasyParcel support.

---

#### 2.6 Label / AWB Retrieval

**Endpoint:** `GET https://connect.easyparcel.my/api/download_label?awb_id={AWB_ID}`

**Purpose:** Download shipping label (PDF) for printing.

**Response:** PDF binary stream (typically 1–2 pages, includes barcode + recipient/sender details)

**Validity:** Labels typically expire after 24–48 hours if not used; retrieve on-demand or cache locally.

---

## 3. Payment & Wallet Flow

### Model: Prepaid Merchant Wallet (No Platform Top-Up API)

**Flow:**

```
1. Merchant signs up → logs into EasyParcel dashboard
2. Merchant tops up credit (RM50–RM50,000) via dashboard
   - Payment methods: CC, Debit, E-wallet, Bank Transfer, Grab PayLater
   - No API available for this step
3. Merchant shares API key with SaaS platform (securely)
4. Platform stores encrypted API key in Payload CMS
5. At checkout: Platform calls EPRateCheckingBulk → displays rates to customer
6. On order placement: Platform calls EPSubmitOrderBulk (charged to merchant wallet)
7. Wallet balance tracked by EasyParcel, visible only in merchant's dashboard
8. Merchant manually tops up when balance runs low
```

### Wallet Balance Checking

- **No Public API:** EasyParcel does not expose a dedicated "check balance" endpoint
- **Workaround (Option 1):** Infer from EPSubmitOrderBulk response (`wallet_balance_after` field, if present)
- **Workaround (Option 2):** Cache merchant's declared balance in Payload; require merchant to confirm top-up in their settings
- **Workaround (Option 3):** Provide UI hint: "Check your EasyParcel dashboard for current balance"

**Recommendation:** Implement **Option 1** (infer from response) + **Option 2** (cache + UI indicator). Fall back to requiring manual confirmation.

### COD (Cash on Delivery) Model

- **Enablement:** Pass `cash_on_delivery: true` + `cod_amount: {amount}` in EPSubmitOrderBulk
- **Supported Couriers:** J&T, Pos Laju, others (check current list on EasyParcel)
- **Settlement:** Courier collects cash → transfers to EasyParcel → EasyParcel transfers to merchant (daily/weekly batch)
- **Platform Role:** Track COD orders separately; do NOT deduct from wallet; reconcile via EasyParcel merchant dashboard
- **No API for COD Settlement:** Manual reconciliation only

---

## 4. Webhooks & Real-Time Tracking

### Webhook Support: **CONFIRMED but Limited Documentation**

EasyParcel offers webhooks for tracking status updates, but official endpoint structure not publicly detailed.

**What We Know:**
- Webhooks feature exists ("Subscribe Webhook" mentioned in API overview)
- Intended for real-time parcel status notifications
- Specific callback URL, event types, payload format NOT documented in public sources

### Recommended Implementation

**Polling Approach (Fallback):**
- Call `EPParcelStatusBulk` every 30–60 minutes for active shipments
- Cache results in Payload CMS / Redis
- Display to end-customer via frontend

**Webhook Approach (If Available):**
1. Contact EasyParcel support to:
   - Obtain webhook endpoint documentation
   - Register your callback URL (e.g., `https://your-platform.com/api/easyparcel/webhook`)
   - Confirm supported event types
2. Implement POST endpoint to receive events:
   ```typescript
   POST /api/easyparcel/webhook
   {
     "event_type": "tracking_update", // or similar
     "awb_id": "JNT987654321",
     "order_id": "ORD123456",
     "status": "in_transit",
     "timestamp": "2026-06-11T14:30:00Z",
     "location": "KL DC"
   }
   ```
3. On receive: update Payload parcel status, trigger frontend update (socket.io / polling refresh)

**Current Recommendation:** Implement polling; add webhook support later if officially documented.

---

## 5. Sandbox & Demo Environment

### Demo URL

| Environment | Base URL | Use Case |
|-------------|----------|----------|
| **Sandbox/Demo** | `http://demo.connect.easyparcel.my/` | Testing, NO charges |
| **Production** | `https://connect.easyparcel.my/` | Live orders, wallet charged |

**Same API Key Works on Both:** Environment determined by hostname, not credentials.

**Rate Checking in Sandbox:** Free (no charges, but returns demo rates).

**Order Submission in Sandbox:** Can create test orders without deducting wallet credit; orders do not route to couriers.

**Recommendation:** 
- Development & QA: Use `demo.connect.easyparcel.my` with test merchant account
- Staging: Either sandbox or production (depending on test data needs)
- Production: Use `connect.easyparcel.my` exclusively

---

## 6. Rate Limits & Performance

### Rate Limits: **NOT FOUND**

EasyParcel does not publicly document rate limiting for Malaysia API. Industry standard SaaS APIs typically impose 100–1000 requests/min.

**Recommendation:**
1. Contact EasyParcel support to confirm limits
2. Implement exponential backoff on 429 responses
3. Assume conservative limit (≤100 req/min) until confirmed
4. Cache rate checks aggressively (5–15 min TTL)

### Supported Couriers in Malaysia

| Courier | Domestic | International | Pickup | Drop-off | COD |
|---------|----------|--|--------|----------|-----|
| J&T Express | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pos Laju | ✓ | ✓ | ✓ | ✓ | ✓ |
| DHL eCommerce | ✓ | ✓ | ✓ | ✓ | ✗ |
| Ninja Van | ✓ | ✗ | ✓ | ✗ | ✓ |
| Flash Express | ✓ | ✗ | ✓ | ✗ | ✓ |
| City-Link Express | ✓ | ✗ | ✓ | ✗ | ✓ |
| Shopee Express | ✓ | ✗ | ✗ | ✗ | ✓ |
| ABX Express | ✓ | ✗ | ✓ | ✓ | ✓ |
| Skynet | ✓ | ✗ | ✓ | ✓ | ✗ |

**Note:** Coverage and features change frequently; pull authoritative list from EPRateCheckingBulk response.

---

## 7. SDKs & Community Implementations

### Official SDKs

- **Node.js:** None found (as of June 2026)
- **PHP:** None official, but community wrappers exist

### Community Packages

| Name | Language | Source | Status |
|------|----------|--------|--------|
| `apih/easyparcel` | PHP | [GitHub](https://github.com/apih/easyparcel) | Marketplace API wrapper, maintained |
| `adly/easyparcel` | PHP | [Packagist](https://packagist.org/packages/adly/easyparcel) | Unknown status |
| `rusdyahmad/php-easyparcel` | PHP | [Packagist](https://packagist.org/packages/rusdyahmad/php-easyparcel) | Unknown status |
| `nestjs-easyparcel` | TypeScript (NestJS) | [npm/Packagist](https://www.jsdelivr.com/package/npm/nestjs-easyparcel) | NestJS-specific, may not fit Next.js |

### Shopify & WooCommerce Integration

- **Shopify:** EasyParcel app (built-in, per-store key model)
- **WooCommerce:** Plugin + REST API import (per-store key model)
- **Pattern:** Each merchant integrates separately; each has their own EasyParcel account + API key

---

## 8. Architectural Recommendations for SaaS

### Authentication & Storage

```typescript
// In Payload CMS - Merchant collection
{
  id: 'merchant-001',
  name: 'Example Shop',
  easyparcelApiKey: '<encrypted>', // AES-256 encrypted
  easyparcelSandbox: false, // toggle between demo/prod
  enabledCouriers: ['jnt_standard', 'dhl_parcel'], // merchant preference
  walletWarningThreshold: 50 // notify when balance < RM50
}
```

### Request Wrapper

```typescript
// lib/easyparcel/client.ts
class EasyParcelClient {
  constructor(private apiKey: string, private sandbox: boolean = false) {}
  
  private baseUrl() {
    return this.sandbox 
      ? 'http://demo.connect.easyparcel.my' 
      : 'https://connect.easyparcel.my';
  }
  
  async rateCheck(params: RateCheckParams) {
    const url = `${this.baseUrl()}/?ac=EPRateCheckingBulk`;
    return this.post(url, { ...params, api: this.apiKey });
  }
  
  async submitOrder(params: OrderParams) {
    const url = `${this.baseUrl()}/?ac=EPSubmitOrderBulk`;
    return this.post(url, { ...params, api: this.apiKey });
  }
  
  async trackParcel(awbIds: string[]) {
    const url = `${this.baseUrl()}/?ac=EPParcelStatusBulk`;
    return this.post(url, { awb_ids: awbIds, api: this.apiKey });
  }
  
  private async post(url: string, data: any) {
    // Implement retry, error handling, logging
  }
}
```

### Checkout Flow

```
1. Customer selects origin/destination + weight
2. Call EPRateCheckingBulk (via merchant's API key)
3. Filter results by merchant's enabledCouriers preference
4. Display rates + delivery times in checkout
5. On confirm: EPSubmitOrderBulk → create Order in Payload + save AWB
6. Return label link for immediate download
7. Background job (cron): EPParcelStatusBulk every 60min → update Order.trackingStatus
```

### Error Handling

- **Wallet Balance Low (< RM10):** Warn merchant in dashboard; block new orders unless merchant explicitly confirms
- **API Key Invalid:** Clear in merchant settings; require re-entry
- **Courier Unavailable:** Gracefully hide from rate check results
- **Label Download Failed:** Retry with exponential backoff; cache URL for 48h

---

## 9. Known Unknowns & Unconfirmed Items

| Item | Status | Action |
|------|--------|--------|
| **Exact EPPickUpBooking endpoint** | ⚠️ UNCERTAIN | Confirm with EasyParcel support; may be auto-scheduled via EPSubmitOrderBulk |
| **Webhook callback structure** | ⚠️ UNCERTAIN | Request official documentation from EasyParcel |
| **Rate limits (req/min, burst)** | ⚠️ UNCERTAIN | Contact EasyParcel support; assume ≤100 req/min conservatively |
| **Wallet balance check API** | ⚠️ UNCERTAIN | Infer from transaction responses or use polling via dashboard |
| **COD settlement timing & API** | ⚠️ CONFIRMED MANUAL | No API; manual reconciliation via merchant dashboard |
| **Label PDF expiry & re-download** | ⚠️ LIKELY 24–48h | Confirm; cache or re-request on demand |
| **Supported fields in EPSubmitOrderBulk** | ⚠️ PARTIAL | Full documentation behind PDF files; request developer access |
| **Error response codes & formats** | ⚠️ PARTIAL | Standardize error handling; document during integration |

---

## 10. Integration Checklist

### Pre-Integration

- [ ] Register test EasyParcel account (sandbox)
- [ ] Generate test API key
- [ ] Verify sandbox demo URL connectivity
- [ ] Contact EasyParcel support for: webhook docs, rate limits, pickup endpoint
- [ ] Review latest Marketplace API v1.4 documentation

### Development Phase

- [ ] Implement `EasyParcelClient` wrapper
- [ ] Build rate-check endpoint: `POST /api/v1/shipping/rates`
- [ ] Build order-submit endpoint: `POST /api/v1/shipping/orders`
- [ ] Implement tracking poll: `GET /api/v1/shipping/{awb}/status`
- [ ] Add encrypted API key storage in Merchant collection
- [ ] Implement wallet warning logic (< threshold)
- [ ] Add error logging + retry logic
- [ ] Write unit tests (mock EasyParcel responses)

### QA & Staging

- [ ] Test rate checking with multiple postcodes/weights
- [ ] Test order submission → label download → tracking updates
- [ ] Test COD orders (verify no wallet charge, verify settlement path)
- [ ] Test API key rotation (regenerate, verify old key invalid)
- [ ] Test rate limiting (burst requests, verify backoff)
- [ ] Test error scenarios (invalid postcode, courier unavailable, wallet low)
- [ ] Verify label PDF validity (24–48h refresh)

### Production Launch

- [ ] Switch to production base URL (`connect.easyparcel.my`)
- [ ] Deploy encrypted key storage
- [ ] Monitor API response times (target: <2s p95)
- [ ] Set up alerting for failed rate checks / order submissions
- [ ] Train merchants on wallet top-up process
- [ ] Document tracking lag (typical: real-time, but 30min–60min polling acceptable)

---

## 11. Sources

**Official Documentation:**
- [EasyParcel Developer Hub](https://developers.easyparcel.com/)
- [Marketplace API Documentation](https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace)
- [Individual API v1.4.0](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.4.0.0)
- [EasyParcel Help Centre — Malaysia](https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192728)

**API Comparison:**
- [Individual vs Marketplace API](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188831-the-difference-between-individual-api-and-marketplace-api)
- [How to Get API Key](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188829-how-to-get-easyparcel-api-key-)

**Integration Guides:**
- [WooCommerce Integration](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188606-how-to-integrate-easyparcel-with-woocommerce-)
- [Shopify Integration Tutorial](https://blog.easyparcel.com/my/tutorial-easyparcel-integration-shopify-v8/)

**Reference Materials:**
- [Courier Constraints (Weight/Dimensions)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224464-how-do-i-determine-the-weight-of-my-parcel-)
- [Supported Couriers & Services](https://easyparcel.com/my/)
- [PHP Wrapper](https://github.com/apih/easyparcel)
- [Postman Collection](https://www.postman.com/testingeasyparcel/easyparcel-s-public-workspace/documentation/yo7q8sg/easyparcel-api-documentation)

**Community & Testing:**
- [nestjs-easyparcel npm](https://www.npmjs.com/package/nestjs-easyparcel)
- [EasyParcel API Landing](https://easyparcel.com/my/apilanding/)

---

## Summary: Authentication Model Recommended

**Answer to Core Question:**

| Question | Answer |
|----------|--------|
| **Auth type?** | API-key based; NOT OAuth2 |
| **Per-merchant or platform account?** | Per-merchant (Marketplace API model) |
| **How merchant connects?** | Merchant registers EasyParcel account → generates API key → securely shares with platform |
| **Platform stores it?** | Encrypted in Payload CMS Merchant collection |
| **Platform calls on behalf?** | Yes, includes merchant's API key in every request |
| **Each merchant enables/disables couriers?** | Yes, filter EPRateCheckingBulk results by merchant preference |
| **Payment model?** | Merchant prepaid wallet (top-up via EasyParcel dashboard, not via API) |
| **Webhooks?** | Supported but undocumented; recommend polling as fallback |

**This model aligns with marketplace SaaS patterns:** each merchant maintains independent relationship with EasyParcel, but your platform orchestrates API calls on their behalf for seamless checkout UX.

---

**Status:** DONE  
**Report Date:** 2026-06-11 16:14 UTC  
**Research Confidence:** High for core endpoints; Medium for edge cases (pickup, webhooks); Low for rate limits and wallet balance API (recommend confirmation with support)
