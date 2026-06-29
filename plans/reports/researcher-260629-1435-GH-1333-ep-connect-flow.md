# EasyParcel OpenAPI 2026-03: Connect Flow + Order Lifecycle

**Dated:** 2026-06-29  
**Source:** Official EasyParcel OpenAPI 2026-03 docs (raw GitHub)  
**Stack:** ECH Prime Web v2 / F36 EasyParcel Delivery Integration  

---

## Part A: OAuth Connect Flow

### Overview
Developer registers app at EasyParcel Developer Hub, obtains `client_id`/`client_secret`, then uses OAuth 2.0 to connect merchant account. Access token lasts ~10 hours; refresh token ~1 year.

### A.1 Developer App Registration
| Step | Action | Input/Output | Notes |
|------|--------|--------------|-------|
| **1. Create Account** | Dev signs up at https://api.easyparcel.com | email, password (8+ chars + numbers/special), company name, contact | Verify email after signup |
| **2. Create Application** | Dev creates app in dashboard | App name, **Redirect URI** (e.g., `https://yourdomain.com/auth/callback`) | Redirect URI is callback URL for OAuth |
| **3. Obtain Credentials** | Dev retrieves credentials from app settings | `client_id`, `client_secret` | Store securely; never expose in frontend |

### A.2 OAuth 2.0 Authorization Flow (Merchant Account Connection)
| Step # | Step Name | HTTP Method | Endpoint | Request | Response | Purpose |
|--------|-----------|-------------|----------|---------|----------|---------|
| **1** | **Authorize Request** | GET | `https://api.easyparcel.com/oauth/login` | Query: `client_id`, `redirect_uri`, optional `state` | User directed to EasyParcel login page | Merchant logs in, chooses demo or live account, grants permission |
| **2** | **Authorization Callback** | GET | Your `redirect_uri` (callback) | Query: `code` (authorization code), `state` (if provided) | App receives `code` in URL | Code is valid for one-time token exchange |
| **3** | **Token Exchange** | POST | `https://api.easyparcel.com/oauth/token` | **Header:** `Authorization: Basic {Base64(client_id:client_secret)}`<br>**Body (form-urlencoded):** `code`, `grant_type=authorization_code` | JSON: `access_token`, `refresh_token`, `expires_in` (36000 sec = ~10 hrs) | Backend-to-backend; never expose token request in frontend |
| **4** | **Store Tokens** | — | — | Persist `access_token`, `refresh_token`, merchant account ID in DB | — | Use `access_token` in API calls; use `refresh_token` to renew before expiry |
| **5** | **Refresh Token** (when access expires) | POST | `https://api.easyparcel.com/oauth/token` | **Header:** `Authorization: Basic {Base64(client_id:client_secret)}`<br>**Body:** `refresh_token`, `grant_type=refresh_token` | JSON: new `access_token`, new `refresh_token` | Merchant session extended without re-login |

### A.3 Key OAuth Details
- **State Parameter:** Include in authorize request to prevent CSRF. Must match callback state.
- **Access Token Expiry:** 36,000 seconds (~10 hours).
- **Refresh Token Life:** ~1 year.
- **Security:** Always use HTTPS. Never store client_secret in frontend/browser.
- **Base64 Encoding:** For token exchange, encode `client_id:client_secret` → Base64.

---

## Part B: Post-Connect Order Lifecycle

After merchant connects OAuth, typical shipping order flow:

### B.1 Flow Overview (Sequential Order)
```
1. List Couriers → 2. Get Quotation → 3. Submit Order → 4. Get Details → 5. Track → (6. Cancel if needed)
```

### B.2 Step-by-Step API Endpoints

#### **B2.1 List Available Couriers**
| Field | Value |
|-------|-------|
| **Purpose** | Fetch available courier services for a country |
| **HTTP Method** | GET |
| **Endpoint** | `/open_api/2026-03/courier/list` |
| **Base URL** | `https://api.easyparcel.com` |
| **Full Path** | `GET https://api.easyparcel.com/open_api/2026-03/courier/list?country_code=MY` |
| **Auth** | Bearer token (OAuth access_token) |
| **Query Params** | `country_code` (string, required): "MY" (Malaysia), "SG" (Singapore) |
| **Response Fields** | `data[]`: array of courier objects |
| **Courier Object** | `courier_id`, `courier_name`, `short_name`, `courier_logo`, `uuid`, `country` |
| **Key Output** | `courier_id` → used in quotation & order submission |
| **Dependency** | None; run after OAuth connect |

#### **B2.2 Get Quotation (Shipping Rate)**
| Field | Value |
|-------|-------|
| **Purpose** | Fetch shipping rates from all couriers for a shipment |
| **HTTP Method** | POST |
| **Endpoint** | `/open_api/2026-03/shipment/quotations` |
| **Full Path** | `POST https://api.easyparcel.com/open_api/2026-03/shipment/quotations` |
| **Auth** | Bearer token |
| **Request Body** | **Sender:** `postcode`, `subdivision_code` (ISO 3166), `country` (2-letter)<br>**Receiver:** same as sender<br>**Parcel:** `weight` (KG, required), `width`, `height`, `length` (CM, optional), `parcel_value` (optional) |
| **Response Fields** | Array of quotation objects, each includes:<br>`service_name`, `courier_name`, `courier_logo`, `total_amount`, `shipment_price`, `total_features_price`, `currency`, `is_pickup`, `is_dropoff`, `service_tag` |
| **Key Outputs** | `courier_name`, `total_amount` (final cost), `service_tag` (used to reference rate in submit order) |
| **Dependency** | After OAuth connect. Merchant should decide sender/receiver/parcel info from order. |

#### **B2.3 Submit Order (Create Shipment + Purchase Label)**
| Field | Value |
|-------|-------|
| **Purpose** | Create shipment, apply selected rate, generate AWB/label |
| **HTTP Method** | POST |
| **Endpoint** | `/open_api/2026-03/shipment/submit_orders` |
| **Full Path** | `POST https://api.easyparcel.com/open_api/2026-03/shipment/submit_orders` |
| **Auth** | Bearer token |
| **Request Body** | **shipment** (array, required): each shipment object includes<br>- `service_id` (from quotation)<br>- `collection_date`<br>- `weight`, `height`, `length`, `width`<br>- **items** array: `item_description`, `item_quantity`, `item_value`<br>- **sender/receiver:** name, phone, postcode, country, subdivision_code, city, address<br>- Feature flags: `need_sms`, `need_email`, `need_whatsapp`<br>**coupon_codes** (array, optional): promo codes |
| **Response Fields** | Success: `order_number`, `shipment_number`, `awb_number`, `awb_urls_by_format` (A4/A5/A6 labels), `tracking_url`, `pricing_breakdown`, `currency`<br>Error: `status`, `message` per shipment |
| **Key Outputs** | `awb_number` (tracking number), `shipment_number` (ID for future queries), `order_number` (batch ID), `awb_urls_by_format.a4` (label PDF URL) |
| **Critical Notes** | - Wallet must have sufficient balance before submit<br>- Status may be mixed success/failure if multiple shipments in one request<br>- Check individual shipment status in response, not just HTTP 200 |
| **Dependency** | After quotation (use `service_id` from quota). After wallet check. |

#### **B2.4 Get Shipment Details**
| Field | Value |
|-------|-------|
| **Purpose** | Fetch full shipment metadata (status, costs, tracking, items, address) |
| **HTTP Method** | POST |
| **Endpoint** | `/open_api/2026-03/shipment/details` |
| **Full Path** | `POST https://api.easyparcel.com/open_api/2026-03/shipment/details` |
| **Auth** | Bearer token |
| **Request Body** | `shipment_number` (string, required): format ES-YYMM-XXXXX |
| **Response Fields** | `shipment_number`, `order_number`, `status_code`, `awb_number`, `tracking_url`<br>**Physical:** `weight`, `height`, `length`, `width`<br>**Items:** item-by-item breakdown (description, quantity, value)<br>**Courier:** `courier_name`, `courier_id`, `service_name`, `courier_logo`<br>**Sender/Receiver:** full contact + address<br>**Financials:** `shipping_cost`, `tax`, `insurance_price`, `other_charges`, `total` |
| **Key Outputs** | All shipment metadata; `awb_number`, `tracking_url` (may be null until shipment processed), `status_code` (0–11 = shipment lifecycle) |
| **Status Codes** | 0=Cancel, 5=Delivered, 7=Schedule In Arrangement, 11=Drop Off, etc. |
| **Dependency** | After submit order (have shipment_number) |

#### **B2.5 Track Shipment**
| Field | Value |
|-------|-------|
| **Purpose** | Get real-time tracking status + event history |
| **HTTP Method** | POST |
| **Endpoint** | `/open_api/2026-03/shipment/tracking_status` |
| **Full Path** | `POST https://api.easyparcel.com/open_api/2026-03/shipment/tracking_status` |
| **Auth** | Bearer token |
| **Request Body** | `awb_numbers` (array, max 100): list of AWB numbers to track |
| **Response Fields** | `data.results[]`: array of tracking objects:<br>`awb_number`, `shipment_number`, `order_number`, `latest_shipment_status_code`, `latest_tracking_status` (human-readable), `latest_event_date` (YYYY-MM-DD HH:MM:SS UTC), `status_log[]` (chronological events with timestamps) |
| **Key Outputs** | `latest_tracking_status` (e.g., "In Transit"), `status_log` (full journey), `latest_event_date` |
| **Batch Tracking** | Can track up to 100 shipments per request |
| **Dependency** | After submit order (have AWB number) |

#### **B2.6 Cancel Shipment**
| Field | Value |
|-------|-------|
| **Purpose** | Cancel an active shipment (if not yet in transit) |
| **HTTP Method** | POST |
| **Endpoint** | `/open_api/2026-03/shipment/cancel` |
| **Full Path** | `POST https://api.easyparcel.com/open_api/2026-03/shipment/cancel` |
| **Auth** | Bearer token |
| **Request Body** | `cancel_list` (array): each item has `shipment_number`, `remark` (cancellation reason) |
| **Response Fields** | `status_code`, `message` (e.g., "2 requests success, 0 request error"), `data[]`: array of cancellation results |
| **Each Result** | `status` ("success" or "error"), `message`, `shipment_number` |
| **Critical** | HTTP 200 does NOT mean all cancellations succeeded — check each item's status |
| **Dependency** | After submit order (have shipment_number). Usually before AWB issued or in early transit. |

#### **B2.7 Check Wallet Balance**
| Field | Value |
|-------|-------|
| **Purpose** | Verify merchant has sufficient credit for shipping |
| **HTTP Method** | GET |
| **Endpoint** | `/open_api/2026-03/wallet` |
| **Full Path** | `GET https://api.easyparcel.com/open_api/wallet` |
| **Auth** | Bearer token (no additional params) |
| **Request Body** | None |
| **Response Fields** | `data.wallet[]`: array with `balance` (double), `currency` (e.g., "MYR")<br>`data.free_credit_wallet[]`: same structure (promotional/bonus credits) |
| **Key Outputs** | `wallet[0].balance` (main account balance), `free_credit_wallet[0].balance` (promo balance) |
| **Real-time** | Balance updates immediately after each order; reflects current available funds |
| **Dependency** | Can run anytime after OAuth connect. Recommended before submit order to avoid failed payments. |

---

## Part C: Webhook Events

EasyParcel sends real-time notifications via POST to your registered webhook endpoint.

### C.1 Webhook Setup
| Item | Details |
|------|---------|
| **Setup Location** | Developer Hub → Apps → Settings → Webhook → "Add Endpoint" |
| **Endpoint URL** | Must be publicly accessible HTTPS URL |
| **Response Requirement** | HTTP 200 within 30 seconds |
| **Retry Policy** | Failed deliveries trigger automatic retries (behavior not fully specified in doc) |

### C.2 Webhook Topics & Payloads
| Topic | Fires When | Payload Includes |
|-------|-----------|-----------------|
| **Shipment Status Update** | Shipment status changes (created, in transit, delivered, etc.) | `shipment_number`, `status_code`, `status`, `timestamp` |
| **Shipment AWB Update** | AWB/label is issued or updated | `shipment_number`, `awb_number`, `awb_urls_by_format` |
| **Tracking Status Update** | Courier reports tracking event | `awb_number`, `shipment_number`, `latest_tracking_status`, `status_log` (chronological events) |
| **Shipment Created** | New shipment order submitted successfully | `order_number`, `shipment_number` array |
| **On-Demand Order Status Update** | (Relevant for on-demand pickup/dropoff services) | Status codes 0–7 (Pending, Accepted, Fulfilled, etc.) |

### C.3 Status Codes Reference
| Code | Meaning (Standard Shipment) |
|------|---------------------------|
| 0 | Cancel |
| 5 | Delivered / Collected by Recipient |
| 7 | Schedule In Arrangement |
| 11 | Drop Off |
| (full list 0–11 implied but not all detailed in doc) | — |

---

## Part D: Sandbox vs. Production

| Aspect | Sandbox | Production |
|--------|---------|-----------|
| **Base URL** | Assumed same: `https://api.easyparcel.com` (with sandbox credentials) | `https://api.easyparcel.com` (live credentials) |
| **Access** | Via Developer Portal → Connection Management → add "sandbox environment" | OAuth using live merchant account |
| **Credits** | Free test credits; "Top Up" in connection settings for simulation | Real paid credits; balance deducted per shipment |
| **Shipment Status Updates** | **NOT updated** during lifecycle (limitation) | Real-time updates from couriers |
| **Tracking** | SMS/Email/WhatsApp notifications **do NOT work** | Full notification delivery |
| **Cost** | Free | Pay per shipment (see quotation for rates) |
| **Suitability** | Development/testing only; no real shipments | Production orders; actual carrier integration |
| **Setup** | Login with dev credentials in dashboard; grant app permission | OAuth flow as described in Part A |

---

## Part E: Unresolved Questions & Doc Conflicts

### E.1 Potential Conflicts (Need Verification Against Live API)
1. **Account Info Endpoint**
   - **Doc says:** Not fully documented in OAuth section
   - **User note:** Actual endpoint is `GET /open_api/2026-03/account/get_account_information` (doc incorrectly said POST)
   - **Action:** Verify if account info can be fetched; if yes, add to post-connect flow

2. **Wallet Endpoint Path**
   - **Doc says:** `GET /open_api/2026-03/wallet` (correct)
   - **User note:** Old code may have referenced `/account/wallet` — incorrect
   - **Verification:** Confirmed doc path is live

3. **Token Expiry**
   - **Doc says:** "36,000 seconds" for access token
   - **Conversion:** ~10 hours (36,000 ÷ 3,600)
   - **Action:** Implement refresh logic 15 min before expiry to avoid edge cases

4. **Status Code Mapping**
   - **Doc lists:** 0=Cancel, 5=Delivered, 7=Schedule In Arrangement, 11=Drop Off
   - **Missing:** Codes 1–4, 6, 8–10 not fully documented
   - **Action:** May need to infer from courier responses or request full status map

### E.2 Implementation Gaps (Not in Doc)
1. **Error Handling Detail**
   - Docs mention "400 Invalid country code", "401 Auth", "500 Server" but don't list exhaustive error codes per endpoint
   - **Action:** Test and catalog error responses during integration

2. **Feature Flags in Submit Order**
   - `need_sms`, `need_email`, `need_whatsapp` mentioned but no docs on default behavior if omitted
   - **Action:** Test with/without flags; determine if opt-in or opt-out

3. **Coupon Code Validation**
   - `coupon_codes` array accepted in submit order, but no validation/error doc
   - **Action:** Test invalid coupons to see error response

4. **Shipment Number vs Order Number**
   - Doc notes they differ but doesn't clarify use case for each
   - **Example:** Order "EI-2602-4P2SK" vs Shipment "ES-2602-4VW9E"
   - **Action:** Assume order_number = batch (multi-shipment request), shipment_number = individual package

5. **Bulk Operations Limits**
   - Tracking accepts "up to 100" AWB numbers; submit_orders and cancel_shipment don't specify batch size
   - **Action:** Test reasonable batch sizes (10–50) to avoid timeouts

---

## Part F: Integration Checklist for ECH Prime Web v2

- [ ] Register app at EasyParcel Developer Hub; store client_id/secret in Vercel env vars
- [ ] Implement OAuth authorize → token exchange → refresh logic (Part A.2)
- [ ] Store merchant access_token + refresh_token in DB; auto-refresh before expiry
- [ ] Build "List Couriers" UI for merchant to select shipping service
- [ ] Build quotation lookup: input address + parcel info → display rates
- [ ] Build order submission: accept merchant selection → call submit_orders → return AWB/label URL
- [ ] Implement shipment tracking: call tracking_status on demand + via webhooks
- [ ] Set up webhook listener for Shipment Status Update + Tracking Status Update events
- [ ] Add cancel shipment UI (if business requirement exists)
- [ ] Pre-check wallet balance before submit order; warn if insufficient
- [ ] Test full flow in sandbox; verify status updates do NOT occur (known limitation)
- [ ] Deploy to production with live OAuth credentials

---

## Summary

**Part A:** OAuth flow involves 5 steps: app registration → authorize request → user login → code → token exchange → refresh before expiry.

**Part B:** Order lifecycle: list couriers → quotation → submit order → shipment details → track → optionally cancel. All endpoints use OAuth Bearer token. 

**Part C:** Webhooks fire on status change, AWB issue, tracking update. Subscribe in Developer Hub settings.

**Part D:** Sandbox mirrors production but shipment status does NOT auto-update (intentional limitation for testing).

**Part E:** Key verification needed: account info endpoint, full status code mapping, error catalogs, batch size limits.

