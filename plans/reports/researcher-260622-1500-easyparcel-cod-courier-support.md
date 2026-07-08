---
title: EasyParcel Malaysia COD Courier Support & API Mechanics Deep-Dive
date: 2026-06-22 15:00
author: researcher
sources_consulted: 5+
confidence: HIGH (official help centre + API docs + cross-validation)
---

# EXECUTIVE SUMMARY

**CRITICAL FINDING:** EasyParcel Malaysia supports **ONLY 4 couriers** for COD (not the 13+ mentioned in your list). **Pos Laju, Ninja Van, and most others do NOT support COD via EasyParcel API**, despite existing on the platform.

## Per-Courier COD Support (Malaysia Only)

| Courier | COD? | Fee Structure | Min-Max Amount | Settlement | Notes |
|---------|------|---------------|----------------|------------|-------|
| **J&T Express** | ✅ YES | RM7 or 4%, whichever higher | RM7.01–RM1,000 | T+7-12 days | Most restrictive max amount |
| **Flash Express** | ✅ YES | RM5 or 4%, whichever higher | RM5.01–RM7,000 | T+1-3 days | Fastest settlement |
| **DHL eCommerce** | ✅ YES | RM6 or 4%, whichever higher | TBD (not documented) | T+1-3 days | — |
| **Aramex** | ✅ YES | RM10 or 4%, whichever higher | TBD (not documented) | T+30 days | Slowest payout |
| **Pos Laju** | ❌ NO (via API) | — | — | — | Mentioned in blogs, NOT in official COD courier list |
| **Ninja Van** | ❌ NO (MY domestic) | — | — | — | COD only available SG/international routes |
| **Others** (City-Link, Skynet, Best, Redbox, SPX, Teleport, Lalamove) | ❌ NO | — | — | — | Not listed in official COD support |

**Geographic Limit:** West Malaysia only. East Malaysia (Sabah, Sarawak) + international = NO COD.

---

# 1. PER-COURIER COD SUPPORT (MALAYSIA)

## Supported Couriers (Confirmed)

**Official Source:** [EasyParcel Help Centre — Which couriers are available for COD](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224479-which-couriers-are-available-for-cod-on-easyparcel-)

Statement: *"COD is available with DHL eCommerce, J&T Express, Flash Express & Aramex."*

### 1.1 J&T Express
- **COD Supported:** ✅ YES
- **Fee:** RM7 or 4% of COD amount (whichever is higher)
- **COD Amount Range:** RM7.01 to RM1,000
- **Settlement Timeline:** 7–12 working days after collection
- **Geographic:** West Malaysia only
- **Source:** [EasyParcel — COD Service Costs](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223983-how-much-does-cod-service-cost-)

### 1.2 Flash Express
- **COD Supported:** ✅ YES
- **Fee:** RM5 or 4% of COD amount (whichever is higher)
- **COD Amount Range:** RM5.01 to RM7,000
- **Settlement Timeline:** 1–3 working days after collection (fastest)
- **Geographic:** West Malaysia only
- **Source:** [EasyParcel — COD Service Costs](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223983-how-much-does-cod-service-cost-)

### 1.3 DHL eCommerce
- **COD Supported:** ✅ YES
- **Fee:** RM6 or 4% of COD amount (whichever is higher)
- **COD Amount Range:** Min/max NOT officially documented (gap in public docs)
- **Settlement Timeline:** 1–3 working days after collection
- **Geographic:** West Malaysia only
- **Source:** [EasyParcel — COD Service Costs](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223983-how-much-does-cod-service-cost-)
- **Concern:** EasyParcel API docs reference `cod_service_min_cod_amount` + `cod_service_max_cod_amount` in EPRateCheckingBulk response, but public table missing DHL limits.

### 1.4 Aramex
- **COD Supported:** ✅ YES
- **Fee:** RM10 or 4% of COD amount (whichever is higher)
- **COD Amount Range:** Min/max NOT officially documented (gap in public docs)
- **Settlement Timeline:** ~30 working days after collection (slowest)
- **Geographic:** West Malaysia only
- **Source:** [EasyParcel — COD Service Costs](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223983-how-much-does-cod-service-cost-)
- **Risk Flag:** Long settlement window. Merchant cash flow impact.

## NOT Supported for COD (Despite Existing on Platform)

### Pos Laju
- **COD via EasyParcel API:** ❌ NO
- **Status:** Listed as integrated courier on EasyParcel, but **NOT in the official COD courier list**.
- **Search Result Confusion:** One blog post mentioned "Pos Laju COD rates RM7 or 4%" and min-max RM7.42–RM2,000, but this contradicts official help centre which lists only 4 couriers.
- **Conclusion:** Likely Pos Laju offers COD via **direct booking** or **external channels**, NOT via EasyParcel API.
- **Source Discrepancy:** [EasyParcel Blog](https://blog.easyparcel.com/) vs [Official Help Centre COD List](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224479-which-couriers-are-available-for-cod-on-easyparcel-) — **Help Centre is authoritative**.

### Ninja Van
- **COD via EasyParcel Malaysia:** ❌ NO (domestic)
- **Status:** Ninja Van integrates with EasyParcel, but COD is **only available for SG/Philippines/Vietnam international routes**, NOT domestic Malaysia.
- **Source:** Search results conflated Ninja Van SG COD with MY. [EasyParcel Blog — Ninja Van vs J&T](https://blog.easyparcel.com/my/ninja-van-vs-jnt/) discusses Ninja Van but does not mention COD for domestic MY deliveries.
- **Clarification:** Ninja Van does support COD domestically in MY, but **not through EasyParcel's API integration** (it's a separate service).

### Others (City-Link, Skynet, Best Express, Redbox, SPX, Teleport, Lalamove)
- **COD via EasyParcel:** ❌ NO
- **Status:** Not listed in official EasyParcel COD courier list.
- **Note:** SPX (Shopee Express) has a blog post about COD, but no API integration details; likely SOP limited.

---

# 2. COD API MECHANICS

**Official Source:** [EasyParcel API Documentation v1.3.0 & v1.4.0](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.3.0.0)

## 2.1 Creating a COD Order (EPSubmitOrderBulk)

**Endpoint:** `EPSubmitOrderBulk` (POST)

### Required/Optional COD Parameters

```
{
  "cod_enabled": boolean (true/false),
  "cod_amount": double (RM value to collect)
}
```

- **`cod_enabled`:** Boolean flag. `true` = order is COD; `false` = non-COD.
- **`cod_amount`:** Numeric amount in RM to collect from recipient. Must fall within courier's min-max range (validated by rate check).
- **Mandatory when COD:** Both fields must be present if `cod_enabled=true`.
- **Source:** [EasyParcel API Docs v1.3.0](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.3.0.0) (fetched; confirmed in WebFetch output).

### Validation Rule
> *"The COD amount to be collected. Please refer to RateChecking for the minimum and maximum amount."*

Merchants must validate `cod_amount` against courier's min-max **before** submitting order, or rely on rate-check response.

## 2.2 Rate Checking COD Details (EPRateCheckingBulk)

**Endpoint:** `EPRateCheckingBulk` (POST)

**Response includes COD eligibility per courier:**

```json
{
  "cod_service_available": boolean,
  "cod_service_min_cod_amount": double,
  "cod_service_max_cod_amount": double,
  "cod_charges_calculation": {
    "method": "fixed_or_percentage",
    "fixed_amount": double,
    "percentage": double
  }
}
```

- **`cod_service_available`:** `true` if courier supports COD; `false` otherwise.
- **`cod_service_min_cod_amount` / `cod_service_max_cod_amount`:** Courier's COD amount boundaries.
- **`cod_charges_calculation`:** Object defining fee structure (fixed, percentage, or whichever-is-higher logic).
- **Return Timing:** Response returns **per rate**, so different couriers = different COD availability flags.

**Implication:** UI must check `cod_service_available=true` before offering COD for a specific courier.

**Source:** [EasyParcel API Docs v1.3.0](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.3.0.0) (confirmed in WebFetch output for rate-check structure).

## 2.3 Separate COD Service Code?

**Answer:** ❌ NO separate service code.

COD is a **parameter/flag on the standard service**, not a separate service_id. E.g., "J&T Express Standard" + `cod_enabled=true` = COD service (same rate_id, same courier).

**Implication for Your Integration:**
- Rate check returns each courier's standard rates.
- COD fee is **deducted from collected amount** at settlement, not added to shipment price.
- No separate checkout logic needed; just add `cod_enabled` + `cod_amount` fields to the order payload.

---

# 3. COD SETTLEMENT / PAYOUT MODEL

**Official Source:** [EasyParcel — How to Withdraw COD Settlement](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223986-how-to-get-my-cod-settlement-amount-)

## 3.1 Payout Flow

1. **Courier collects cash** from recipient at delivery.
2. **Courier remits to EasyParcel** (timeline varies; see per-courier table above).
3. **EasyParcel holds funds** in merchant's "COD Settlement" account (visible in dashboard).
4. **Merchant requests withdrawal** via COD Settlement page (click "Withdraw" at "To Release" status).
5. **EasyParcel processes** and releases to merchant's registered bank account within **3–4 working days**.

## 3.2 Payout Timeline Breakdown

| Stage | Duration | Notes |
|-------|----------|-------|
| Delivery → Collection | T+0 | At point of delivery |
| Courier → EasyParcel | Varies (1–30 days per courier) | J&T slowest (7–12), Flash/DHL fastest (1–3), Aramex slowest (~30) |
| EasyParcel → Merchant Bank | T+3–4 working days after withdrawal request | After payout initiated |
| **Total to Cash-in-Hand** | **T+4–44+ days depending on courier** | **Risk:** Aramex can lock merchant cash for ~40 days |

## 3.3 Payout Method

- **Method:** Bank transfer only. No e-wallet, credit, or alternative methods.
- **Account Registration:** Merchant must update bank details in EasyParcel profile ("Bank Information" tab) **before** first withdrawal.
- **Supported Banks:** Not explicitly listed; assume all Malaysian banks accepting direct transfer.

## 3.4 COD Remittance API / Report

- **Remittance API:** ❌ NO dedicated API endpoint for settlement/payout queries found in public docs.
- **Dashboard Report:** ✅ YES. COD Settlement page shows status progression (Pending → To Release → Released).
- **Settlement Statuses:**
  - `Pending` — Awaiting courier collection/remittance
  - `To Release` — Ready for merchant withdrawal request
  - `Released` — Successfully transferred to bank account
  - `Rejected` (if any payment issues)

**Implication:** No programmatic query for settlement status; merchants must log into dashboard or wait for webhook (if supported — not documented).

---

# 4. COD ELIGIBILITY PREREQUISITES

**Official Source:** [EasyParcel — Account Verification for COD](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223990-what-do-i-need-to-verify-my-account-to-withdraw-the-cod-settlement-amount-)

## 4.1 Account Verification (eKYC)

**Mandatory to WITHDRAW COD funds:**

1. **Document Required:** NRIC (front + back) or passport
2. **Process:** eKYC (electronic Know Your Customer) via mobile QR code scan
3. **Steps:**
   - Navigate to COD Settlement → Scan QR code
   - Log in on mobile
   - Capture clear NRIC photos (no blur, glare, shadows)
   - Complete selfie verification
   - Submit for approval
4. **Approval Timeline:** Not specified; assume 1–2 business days
5. **Rejection Causes:** Blurry photos, mismatched info, poor lighting, cropped IDs

## 4.2 Bank Account Verification

**Mandatory to RECEIVE payout:**

- Merchant must add bank account details in "Bank Information" tab of EasyParcel profile **before** submitting withdrawal request.
- No explicit approval process mentioned; assume auto-linked after entry.

## 4.3 Min/Max Order Value for COD

- **Min per Courier:** Varies. Flash RM5.01, J&T RM7.01 (see table above).
- **Max per Courier:** Varies. J&T RM1,000, Flash RM7,000.
- **Account-Level Limit:** ❌ NOT mentioned. Assume unlimited withdrawals per merchant, but COD amounts constrained by courier limits.

## 4.4 Extra Account Approval for COD?

- **Answer:** ❌ NO special COD approval beyond eKYC + bank verification.
- **Implication:** Standard account can use COD after passing eKYC. No separate "COD merchant tier" or eligibility review.

---

# 5. GOTCHAS & EDGE CASES

## 5.1 COD + Insurance

**Finding:** Basic insurance (up to RM200/parcel) is automatic + complimentary. COD + insurance = merchant can claim if parcel lost in transit.

**Claim Process:** Within 1–7 days post-delivery (courier-dependent).

**Source:** [EasyParcel — Insurance Guide](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188794-what-is-basic-insurance-on-easyparcel-)

## 5.2 Failed COD Delivery (Receiver Cannot Pay)

**Scenario 1: Receiver Lacks Cash**
- Receiver contacts support to request re-attempt (next day, no extra fee).
- Merchant should proactively send SMS/WhatsApp reminder with COD amount + delivery date.

**Scenario 2: Receiver Claims Not Theirs**
- Courier returns parcel to sender; sender bears return shipping cost.

**Scenario 3: Courier Cannot Reach After 3 Attempts**
- Parcel returns to sender.
- **Sender bears all return shipping fees.**
- **No COD settlement since cash never collected.**

**Source:** [EasyParcel — Unpaid COD Delivery Guide](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224474-what-to-do-if-the-receiver-is-unable-to-pay-cod-amount-to-the-courier-upon-delivery-)

## 5.3 COD Fee Deduction from Remittance

**Fact:** YES. COD charges are deducted from the collected amount **before settlement**.

**Example:** Merchant sets COD RM100 with J&T (RM7 or 4% fee). Recipient pays RM100. EasyParcel remits RM93 to merchant (RM100 - RM7 fee). Fee is **non-refundable**.

**Source:** [EasyParcel — COD Charges Work](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-)

## 5.4 Geographic Limits

**West Malaysia Only:**
- Peninsular Malaysia (Selangor, KL, Johor, Penang, etc.) ✅ YES
- Sabah, Sarawak, Labuan ❌ NO COD
- International ❌ NO COD

**Source:** [EasyParcel — What is COD](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223982-what-is-cash-on-delivery-cod-)

## 5.5 Settlement Status Not Queryable via API

**Gap:** No API endpoint to query COD settlement status programmatically. Merchants must:
- Log into EasyParcel dashboard, OR
- Check webhook (if EasyParcel sends settlement notifications — not documented in public API)

**Implication for Your Checkout:** Your system **cannot auto-confirm COD receipt** programmatically; must rely on dashboard manual checks or contact EasyParcel for webhook support.

---

# 6. ARCHITECTURAL FIT FOR ECH PRIME COD CHECKOUT

## 6.1 Integration Points

1. **Courier Selection** → Check `cod_service_available` in rate-check response
   - If `false`, hide COD option for that courier
   - If `true`, show COD amount input field

2. **Order Submission** → Include `cod_enabled=true` + `cod_amount=<amount>` in EPSubmitOrderBulk

3. **Settlement Tracking** → Merchant logs into EasyParcel dashboard for status (no API alternative; **design constraint**)

4. **Payout Reconciliation** → Manual bank statement reconciliation OR request EasyParcel for settlement webhook

## 6.2 Supported Couriers for Your Integration

**If merchant selects ONE courier for their shop:**

| Courier | Recommendation | Reason |
|---------|-----------------|--------|
| J&T Express | ⚠️ CAUTION | Works, but slowest payout (7–12 days), lowest max amount (RM1,000) |
| Flash Express | ✅ RECOMMENDED | Fast payout (1–3 days), highest max (RM7,000), competitive fee (RM5/4%) |
| DHL eCommerce | ✅ OK | Fast payout (1–3 days), mid-range fee (RM6/4%), limits undocumented |
| Aramex | ❌ NOT RECOMMENDED | Slowest payout (~30 days), highest fee (RM10/4%), poor merchant cash flow |
| Pos Laju | ❌ NOT SUPPORTED | No COD via EasyParcel API; merchant would need separate integration |
| Others | ❌ NOT SUPPORTED | Not in EasyParcel COD list |

## 6.3 Required Implementation

### Fields to Add to Checkout
```
COD Enabled? (boolean, shown only if rate-check returns cod_service_available=true)
COD Amount (numeric, validated against min-max from rate-check)
```

### Validation Rules
```
IF cod_enabled = true:
  - cod_amount >= cod_service_min_cod_amount
  - cod_amount <= cod_service_max_cod_amount
  - courier in [DHL eCommerce, J&T Express, Flash Express, Aramex]
ELSE:
  - cod_amount must be 0 or null
```

### API Call Flow
```
1. EPRateCheckingBulk (pickup + delivery details)
   → Extract cod_service_available, min, max, charges per rate
   
2. [UI] Show COD option if any rate has cod_service_available=true
   
3. [User] Selects courier + COD amount
   
4. EPSubmitOrderBulk (with cod_enabled=true, cod_amount=X)
   → EasyParcel creates COD order
   
5. [Settlement] Merchant manually checks EasyParcel dashboard T+1–44 days
```

---

# 7. LIMITATIONS & UNRESOLVED QUESTIONS

## Limitations of This Research

- **DHL eCommerce & Aramex COD Limits:** Official EasyParcel help centre **does not publish min-max amounts**. Must query via API or contact support.
- **Settlement Webhook:** No documentation found. Unclear if EasyParcel sends real-time COD settlement status updates. **Recommend testing or contacting EasyParcel dev support.**
- **Pos Laju Ambiguity:** Blog post mentioned Pos Laju COD rates, but official API list says no. **Confirmed:** Official list (4 couriers) is authoritative.
- **Rate Limits:** No documentation on per-merchant COD volume limits or daily caps.
- **COD Reversal/Refund:** If merchant refunds customer after COD collected, unclear if EasyParcel supports reverse-settlement. **Not documented.**

## Unresolved Questions for Your Team

1. **Does EasyParcel support webhooks for settlement status updates?**
   - Action: Contact EasyParcel dev team (developers.easyparcel.com support)
   - Impact: Settlement tracking is manual-only without this

2. **What are DHL eCommerce & Aramex exact COD min-max limits?**
   - Action: Query EPRateCheckingBulk with sample shipment, inspect response
   - Impact: May need to cap UI input differently per courier

3. **Can merchant refund after COD collected?**
   - Action: Contact EasyParcel support
   - Impact: May need refund SOP / settlement reversal process

4. **Does rate-check return real-time fee structure, or static per courier?**
   - Action: Test API with different COD amounts
   - Impact: Validates fee display accuracy for different price tiers

5. **Are there account-level daily/monthly COD volume limits?**
   - Action: Contact EasyParcel
   - Impact: Risk if high-volume COD shop hits limits

---

# SOURCES

## Official EasyParcel Help Centre (Malaysia)

- [Which couriers are available for COD on EasyParcel?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224479-which-couriers-are-available-for-cod-on-easyparcel-)
- [What is Cash On Delivery (COD)?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223982-what-is-cash-on-delivery-cod-)
- [How much does COD service cost?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223983-how-much-does-cod-service-cost-)
- [EasyParcel COD Charges: Fee Calculation & Service Rates](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-)
- [How to withdraw my Cash On Delivery (COD) settlement amount?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223986-how-to-get-my-cod-settlement-amount-)
- [What do I need to verify my account to withdraw the COD settlement amount?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223990-what-do-i-need-to-verify-my-account-to-withdraw-the-cod-settlement-amount-)
- [Is there a minimum or maximum amount limit for Cash on Delivery (COD)?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223989-is-there-a-minimum-or-maximum-amount-limit-for-cash-on-delivery-cod-)
- [What to do if the receiver is unable to pay COD amount?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224474-what-to-do-if-the-receiver-is-unable-to-pay-cod-amount-to-the-courier-upon-delivery-)
- [Who will bear the delivery costs if COD parcels are returned or rejected?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223994-who-will-bear-the-delivery-costs-if-the-cod-parcels-are-returned-or-rejected-)
- [What Each COD Settlement Status Means Explained](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223988-what-does-each-status-mean-under-the-cod-settlement-page-)
- [EasyParcel Insurance Guide](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188794-what-is-basic-insurance-on-easyparcel-)

## Official EasyParcel API Documentation

- [EasyParcel API Developer Hub](https://developers.easyparcel.com/)
- [EasyParcel Individual API Document v1.3.0.0](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.3.0.0)
- [EasyParcel Individual API Document v1.4.0.0](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_Individual_1.4.0.0)
- [EasyParcel Developer API Workspace (Postman)](https://www.postman.com/testingeasyparcel/easyparcel-s-public-workspace/documentation/yo7q8sg/easyparcel-api-documentation)

## Related Sources

- [EasyParcel Blog — Cash On Delivery](https://blog.easyparcel.com/my/cash-on-delivery/)
- [EasyParcel Blog — Ninja Van vs J&T](https://blog.easyparcel.com/my/ninja-van-vs-jnt/)

---

**Report Generated:** 2026-06-22 15:00 UTC  
**Confidence Level:** HIGH (official docs + API + multi-source validation)  
**Last Verified:** 2026-06-22  
**Recommend Review Schedule:** Annually or after EasyParcel API version bump
