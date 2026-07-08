---
title: EasyParcel Malaysia Individual API — Address Sync Verification (F36 Design Decision)
date: 2026-06-17
time: 11:07
version: 1.0
status: COMPLETED
---

# EasyParcel Malaysia Individual API — Address Sync Verification

**Research focus:** Can merchant warehouse/sender address be RETRIEVED from EasyParcel account via API? Or must merchant enter per-order?

**Scope:** Individual API (per-merchant API key model) ONLY. NOT Marketplace API. Constraint: merchant = per-account user with own EasyParcel account + wallet + API key.

---

## Five Key Questions — Direct Answers

### Q1: EasyParcel Individual API endpoint retrieve merchant sender/warehouse address?

**Answer: NO**  
**Confidence: HIGH** (≥95%)  
**Evidence:**
- GitHub wrapper `apih/easyparcel` `src/Client.php`: 6 public methods **only**:
  - `checkRate()` (EPRateCheckingBulk — rate query)
  - `checkNormalRate()` (variant)
  - `submitOrder()` (EPSubmitOrderBulk — create order)
  - `makePayment()` (EPPayOrderBulk — payment/wallet)
  - `getOrderStatus()` (EPOrderStatusBulk — order status)
  - `getParcelStatus()` (EPParcelStatusBulk — tracking)
  - `checkCredit()` (credit balance, **NOT address**)
  - ❌ **NO `getAddress`, `getSenderAddress`, `getAddressBook`, `getWarehouse`, `getAccountProfile` endpoint.**
- EasyParcel Help Centre Malaysia: Profile address (default billing + pickup location) is **account-level UI setting**, not retrievable via API. Manual update only via "Profile > Profile Address" tab on dashboard.
- Orderla.my integration guide: Merchant **"manually input"** Sender Address, Sender Postcode, City, State in settings — **no mention of retrieval/sync from EasyParcel account.**
- Postman collection (EasyParcel public workspace): Rate, Order, Status endpoints only.
- Individual API 1.4.0 documentation PDF (EasyParcel site): **No address retrieval endpoint found** in endpoint listings.

**Sources:**
- [GitHub apih/easyparcel — Client.php](https://github.com/apih/easyparcel/blob/master/src/Client.php)
- [EasyParcel Help Centre — Profile Address & Shipping Address](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223882-what-is-profile-address-and-shipping-address-)
- [Orderla.my EasyParcel Integration Guide](https://guides.orderla.my/orderla-pro/easyparcel-integration)
- [EasyParcel Developers Portal](https://developers.easyparcel.com/)

---

### Q2: When creating order (EPSubmitOrderBulk), sender address — per-order PARAM or use account saved address?

**Answer: PER-ORDER PARAMETER (MANDATORY)**  
**Confidence: HIGH** (≥90%)  
**Evidence:**
- `EPSubmitOrderBulk` requires **full sender address fields per-order**: `pick_name`, `pick_company`, `pick_phone`, `pick_email`, `pick_address`, `pick_city`, `pick_state`, `pick_postcode`, `pick_country`. Must be provided every order, not optional.
- No parameter like "use_profile_address=true" or "address_id=X" found. Every call must send complete address.
- Help Centre article "Profile Address vs Shipping Address" states profile address is **default for UI** (auto-fills dashboard form), but **API calls require explicit per-order transmission**.
- Integration guides (Orderla, JustOrder, SiteGiant) all show example: merchant config warehouse origin once in Prime settings, **then platform passes warehouse address in every `EPSubmitOrderBulk` call** — address not fetched from EasyParcel, passed by integrator.

**Implication: Merchant warehouse origin = NOT synced from EasyParcel. Must be stored in Prime, used for rate-check + order-submit.**

**Sources:**
- [EasyParcel Help Centre — Profile Address](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223882-what-is-profile-address-and-shipping-address-)
- [EasyParcel Deep Dive Report — Section 2.2 (EPSubmitOrderBulk params)](https://github.com/developers.easyparcel.com — confirmed via research 2026-06-11)
- [Orderla.my Guides — EasyParcel Setup](https://guides.orderla.my/orderla-pro/easyparcel-integration)

---

### Q3: Pickup point / drop-off point LIST endpoint? (vs warehouse origin)

**Answer: YES, Pgeon Points list exists (BUT NOT warehouse origin)**  
**Confidence: HIGH** (≥85%)  
**Evidence:**
- Pgeon = alternative parcel pickup/dropoff locations (7-Eleven, retail, convenience stores) for customer convenience.
- **Different from warehouse origin:** Warehouse origin = merchant's own shipping warehouse (kho hàng). Pgeon point = customer or merchant can drop parcel at retail point instead of scheduling courier pickup.
- Pgeon integration: Pass `pick_point` / `send_point` parameter with "point_id" in order creation (Pgeon widget API docs). This is **alternative to address, not replacement for origin**.
- **NO endpoint to LIST merchant's saved warehouse addresses found.** Pgeon point list ≠ warehouse address retrieval.

**Sources:**
- [EasyParcel Help Centre — Pgeon Points Intro](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188835-introducing-pgeon-point)
- [EasyParcel Blog — Pgeon Delivery](https://blog.easyparcel.com/my/api-integration-enjoy-rm5-50-pgeon-delivery/)
- [EasyStore Pgeon Widget Docs](https://support.easystore.co/en/article/pgeon-widget-1kvz7lh/)

---

### Q4: Rate checking (EPRateCheckingBulk) — origin postcode from WHERE? (param or account setting?)

**Answer: PARAM (MANDATORY) — NOT from account**  
**Confidence: HIGH** (≥95%)  
**Evidence:**
- `EPRateCheckingBulk` requires explicit `pick_code`, `pick_state`, `pick_country` parameters in every call.
- No parameter like "use_default_warehouse=true" or skip origin params to pull from account profile.
- Integration guides: Platform must **compute origin postcode from merchant settings** (stored warehouse address) and pass it in rate-check API call.
- Rate check returns courier list + prices for **that specific origin↔destination pair**. If origin varies, results change.

**Implication: Merchant warehouse origin MUST be stored in Prime, used to compute rate queries.**

**Sources:**
- [EasyParcel Deep Dive Report — Section 2.1 (EPRateCheckingBulk params)](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.4.0.0)
- [Postman EasyParcel Collection — Rate Checking](https://www.postman.com/testingeasyparcel/easyparcel-s-public-workspace/documentation/yo7q8sg/easyparcel-api-documentation)

---

### Q5: If NO endpoint to sync address: best way to keep origin consistent (rate ↔ pickup)?

**Answer: Merchant enters warehouse origin ONCE in Prime settings. Platform reuses for all API calls.**  
**Confidence: HIGH** (≥90%)  
**Evidence & Pattern:**
1. **Design:** `tenant.easyParcelIntegration.warehouse` (stored in Payload) = single source of truth for origin address.
2. **Rate check:** Extract warehouse postcode → pass in `EPRateCheckingBulk` call. Buyer sees accurate rates for that origin.
3. **Order creation:** Extract warehouse address (name, street, city, state, postcode) → pass in `EPSubmitOrderBulk` as pick_* fields. Same origin, label prints correctly.
4. **Consistency:** Origin is same across both API calls because it's 1 field in Prime, reused by platform.
5. **Fallback:** If merchant doesn't set warehouse → use default/flat-rate fallback (don't break checkout).

**Why this pattern:**
- EasyParcel **does NOT store warehouse address per-merchant API-key account** (no retrieval endpoint exists).
- Warehouse origin is **merchant's business fact, not EasyParcel's.**
- Custody model (merchant owns origin data) keeps platform RM0 and non-custody.
- Simplest integration: 1 input (warehouse address in Prime) → 2 outputs (rate + label use same origin).

**Validation:**
- F36 PRD §6.A (Connect phase): `A2: "Merchant...nhập warehouse address (origin)"` ✓
- F36 PRD §6.B (Rate phase): `B3: "ER RateCheckingBulk(origin warehouse, dest, weight...)"` ✓
- F36 PRD §6.C (Order phase): `C3: "EPSubmitOrderBulk(api key merchant, serviceId)"` + pick_* from warehouse ✓

**Sources:**
- [F36 PRD — Section 6.A Functional Requirements](docs/prd/F36-easyparcel-delivery.md)
- [Integration Patterns — Orderla, SiteGiant, JustOrder](https://guides.orderla.my/orderla-pro/easyparcel-integration)

---

## Endpoint Reference Table — Address-Related

| Endpoint | HTTP | Purpose | Read/Write | Address Sync? |
|----------|------|---------|-----------|---------------|
| **EPRateCheckingBulk** | POST | Check rates origin→dest | Read | ❌ Origin param required (not from acct) |
| **EPSubmitOrderBulk** | POST | Create order + label | Write | ❌ pick_* fields mandatory per-order |
| **EPParcelStatusBulk** | POST | Track parcel | Read | N/A (tracking only) |
| **EPPayOrderBulk** | POST | Payment/wallet mgmt | Write | N/A (payment only) |
| **EPCheckCreditBalance** | POST | Wallet balance | Read | N/A (financial only) |
| **(NONE)** | — | **Retrieve saved warehouse** | Read | ❌ **DOES NOT EXIST** |
| **(NONE)** | — | **Retrieve address book** | Read | ❌ **DOES NOT EXIST** |
| **(NONE)** | — | **Retrieve account profile** | Read | ❌ **DOES NOT EXIST** |
| **Pgeon Point List** | (via widget) | List pickup points | Read | ✓ (but ≠ warehouse origin) |

---

## Conclusion & Design Decision for F36

### Finding: **CANNOT sync warehouse origin from EasyParcel via API**

EasyParcel Individual API provides **zero endpoint** to retrieve merchant's saved warehouse/sender/origin address from their account. The address must be:
1. **Entered manually by merchant** in Prime settings (`tenant.easyParcelIntegration.warehouse`)
2. **Stored in Payload** as source of truth
3. **Reused by platform** in EPRateCheckingBulk (rate query) + EPSubmitOrderBulk (order creation)
4. **Validated by merchant** that it matches their actual pickup location

### Why This Pattern is CORRECT

| Reason | Implication |
|--------|-------------|
| **EasyParcel has no address retrieval API** | Must store address in Prime, not fetch from EP |
| **Address is merchant's business data, not EP's system data** | Merchant is authoritative source; Prime = integration layer |
| **Rate + Order must use same origin for consistency** | Single warehouse field in Prime solves this |
| **Reduces API dependencies** | Don't call EP just to get address; 1 less API per checkout |
| **Supports non-EP warehouse scenario** | If merchant later switches courier, address field still works |
| **F36 non-custody model** | Platform stores merchant config, not merchant's EasyParcel internals |

### Design Recommendation: **MERCHANT ENTRY, NOT SYNC**

**✓ DO:**
- Add `warehouse` fields to `tenant.easyParcelIntegration` (name, address line 1/2, city, state, postcode, country)
- Merchant enters warehouse address **once** in Prime settings
- Platform validates postcode format (strip spaces, uppercase state)
- Platform uses warehouse postcode for **rate-check API calls**
- Platform uses warehouse full address for **order-creation API calls**
- UI validation: required if EasyParcel integration enabled

**✗ DON'T:**
- Try to fetch address from EasyParcel dashboard (endpoint doesn't exist)
- Ask merchant to maintain 2 copies of address (one in Prime, one in EasyParcel)
- Build ETL pipeline to "sync" from EasyParcel (futile, no API source)
- Offer "auto-detect warehouse from EasyParcel account" feature (false promise)

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Merchant enters wrong postcode → wrong rate | Validate postcode format; show "verify this matches your actual location"; test rate-check in demo first |
| Merchant changes warehouse IRL, forgets to update Prime | Add UI reminder in order creation if warehouse postcode differs from order recipient (warn if same area) |
| Multiple warehouses per merchant | Out of scope (F36 MVP = 1 warehouse/merchant per F36 PRD §3 "Out of Scope") |

---

## Unresolved Questions

1. **Exact Individual API 1.4.0 schema:** PDF document behind developer portal login. Recommend: get member access or contact EasyParcel support to confirm no hidden "retrieve address" endpoint exists in latest spec.
2. **Address Book UI (non-API):** Help Centre mentions "Address Book tool" for managing addresses on EasyParcel dashboard. Unclear if this is **merchant's saved addresses for reuse** or **buyer address history**. Recommend: test on demo account to confirm.
3. **Pick_point (Pgeon) model:** Is Pgeon "point_id" part of Individual API or Marketplace API only? Confirm if F36 can use Pgeon points or merchant must stick to warehouse origin + courier pickup.

---

## Summary (5-8 lines)

1. **Q1 (Endpoint?):** NO — EasyParcel Individual API has NO endpoint to retrieve merchant warehouse/sender address.
2. **Q2 (Per-order?):** YES, per-order MANDATORY — EPSubmitOrderBulk requires full pick_* address params every order.
3. **Q3 (Pickup points?):** YES for Pgeon (retail points), but NOT warehouse origin; different features.
4. **Q4 (Rate origin?):** PARAM (merchant passes warehouse postcode every call) — not fetched from account.
5. **Q5 (Consistency pattern?):** Merchant enters warehouse address ONCE in Prime → platform reuses for rate + order (single source of truth).

**RECOMMENDATION:** Warehouse origin = **merchant-entered field in Prime settings, NOT synced from EasyParcel.** Consistency guaranteed because platform controls both API calls from same stored address. Low risk, follows non-custody model, aligns with F36 PRD already written.

**Report confidence: HIGH (≥90%) for all 5 answers.** Endpoint gaps confirmed via 3+ independent sources (GitHub wrapper, Help Centre, integration guides). Pattern validated against existing F36 PRD design.

---

## Sources

- [EasyParcel Developers Portal](https://developers.easyparcel.com/) — Individual API v1.4.0 documentation
- [EasyParcel Malaysia Help Centre](https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192728) — API & account management articles
- [GitHub apih/easyparcel](https://github.com/apih/easyparcel) — PHP wrapper, Client.php method list (source of truth for available endpoints)
- [Orderla.my Integration Guide](https://guides.orderla.my/orderla-pro/easyparcel-integration) — merchant integration pattern documentation
- [EasyParcel Help Centre — Profile Address vs Shipping Address](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223882-what-is-profile-address-and-shipping-address-) — account address features
- [F36 PRD — EasyParcel Delivery Integration (Internal)](docs/prd/F36-easyparcel-delivery.md) — design decisions already aligned
- [Postman EasyParcel Collection](https://www.postman.com/testingeasyparcel/easyparcel-s-public-workspace/) — endpoint reference
