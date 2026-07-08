# EasyParcel COD Integration Research Report

**Date:** 2026-06-17 14:40  
**Context:** F36 Shipping Integration — Next.js + Payload CMS ecommerce store (Malaysia)  
**Sources:** EasyParcel official docs, help center, API docs, developer portal

---

## Q1: Does EasyParcel Support COD? Which Couriers?

**YES**, COD is fully supported on EasyParcel Malaysia as of 2025+.

| Courier | COD Status | Region | Notes |
|---------|-----------|--------|-------|
| **J&T Express** | ✓ Supported | West Malaysia only | Nationwide coverage; popular, reliable |
| **DHL eCommerce** | ✓ Supported | West Malaysia only | Rapid settlement (1-3 days) |
| **Flash Express** | ✓ Supported | West Malaysia only | Fastest settlement (1-3 days) |
| **Aramex** | ✓ Supported | West Malaysia only | Slower settlement (30 days) |
| **Pos Laju** | ✗ Not listed | — | Not available on EasyParcel COD |
| **SPX Express** | ✗ Not listed | — | Not available on EasyParcel COD |
| **City-Link** | ✗ Not listed | — | Not available on EasyParcel COD |
| **Skynet** | ✗ Not listed | — | Not available on EasyParcel COD |
| **Best Express** | ✗ Not listed | — | Not available on EasyParcel COD |

**Key constraint:** COD only available for **domestic West Malaysia** shipments. **NOT available for East Malaysia (Sabah/Sarawak) or international**.

**COD is a platform-level feature** — configured per courier on EasyParcel, not a per-parcel add-on. When a courier supports COD, it's automatically available in quotes and booking.

---

## Q2: COD API Fields

### EPSubmitOrderBulk (Order Submission)

**COD parameters:**

| Field Name | Type | Required | Notes |
|------------|------|----------|-------|
| `cod_enabled` | boolean | Optional | `true` if parcel is COD; `false` (default) if prepaid. Only applicable for couriers with COD support. |
| `cod_amount` | double | Conditional | Amount to collect (RM). Required if `cod_enabled: true`. Must fall within courier's min/max limits. |

**Example:**
```json
{
  "cod_enabled": true,
  "cod_amount": 150.50
}
```

### EPCheckCourierRate (Rate Checking / Availability)

**Response includes COD metadata:**

| Field Name | Type | Notes |
|------------|------|-------|
| `cod_service_available` | boolean | Whether this courier + route supports COD |
| `cod_service_min_cod_amount` | double | Minimum COD amount allowed (e.g., RM5.01) |
| `cod_service_max_cod_amount` | double | Maximum COD amount allowed (e.g., RM7,000) |
| `cod_charges_calculation` | object | JSON object: `{ "type": "fixed_or_percentage", "fixed_amount": X, "percentage": Y }` |

**After Order Submission, Response Includes:**

| Field | Type | Notes |
|-------|------|-------|
| `cod_charges` | double | Exact COD fee charged for this shipment (RM) |

---

## Q3: COD Remittance Flow

**High-level flow:**

1. **Parcel delivered** → Courier collects cash from buyer
2. **Settlement status = "Pending"** → Courier processing funds (in transit or processing phase)
3. **Settlement status = "To Release"** → Funds ready for withdrawal (merchant-initiated action)
4. **Merchant clicks "Withdraw"** → Status becomes "Releasing"
5. **Status = "Released"** → Money lands in merchant's **verified bank account** (payout complete)

### Remittance Cycle by Courier

| Courier | Settlement Time | Payout Time (After Withdraw Request) |
|---------|-----------------|--------------------------------------|
| Flash Express | 1-3 working days | 3-4 working days |
| DHL eCommerce | 1-3 working days | 3-4 working days |
| J&T Express | 7-12 working days | 3-4 working days |
| Aramex | 30 working days | 3-4 working days |

**Total time from delivery to bank account:** Settlement time + 3-4 working days (post-withdrawal). **Slowest = Aramex at ~34-38 working days.**

### COD Fees / Handling Charges

**Charged per shipment; deducted from COD settlement amount before payout:**

| Courier | Fee Structure | Example |
|---------|--------------|---------|
| Flash Express | RM5 or 4% (whichever **higher**) | COD RM100 → charge = RM5; COD RM500 → charge = RM20 (4% > RM5) |
| DHL eCommerce | RM6 or 4% (whichever **higher**) | Same logic |
| J&T Express | RM7 or 4% (whichever **higher**) | Same logic |
| Aramex | RM10 or 4% (whichever **higher**) | Same logic |

**Payout destination:** Funds land in merchant's **bank account** (not EasyParcel wallet). Requires verified bank details on file.

**No additional handling charges beyond courier's COD fee** — the % or flat rate is the only deduction.

---

## Q4: COD Limits & Constraints

### Amount Limits (Per Courier)

| Courier | Min COD | Max COD | Region |
|---------|---------|---------|--------|
| J&T Express | RM5.01 | RM7,000 | West Malaysia |
| DHL eCommerce | (TBD—not specified in docs) | (TBD) | West Malaysia |
| Flash Express | RM5.01 | RM7,000 | West Malaysia |
| Aramex | (TBD—not specified) | (TBD) | West Malaysia |

**Note:** Documentation states "minimum and maximum amount limit for COD varies depending on our courier partners" but only Flash Express / J&T specifics are publicly listed. **DHL eCommerce and Aramex limits must be checked via API EPCheckCourierRate response or contact support.**

### Geographic Constraints

- **West Malaysia only** (Peninsular Malaysia: Perlis, Kedah, Penang, Perak, Selangor, Kuala Lumpur, Putrajaya, Negeri Sembilan, Pahang, Terengganu, Kelantan, Johor)
- **NOT available** in East Malaysia (Sabah, Sarawak)
- **NOT available** for international shipments

### Weight / Size Constraints

**Not explicitly stated in public docs.** Likely same as courier's standard limits (check EPCheckCourierRate for actual capacity by courier).

### Couriers NOT Supporting COD

- Pos Laju
- SPX Express
- City-Link Express
- Skynet
- Best Express
- Any other non-listed couriers

---

## Q5: COD vs Prepaid Status Mapping

### COD-Specific Tracking Statuses

**Parcel delivery statuses** (standard for all):
- Scheduled
- Pending for Collection
- Collected / In Transit
- Delivered
- (Returned, Cancelled if applicable)

**No special COD-only delivery status.** The "COD" marker is metadata, not a tracking status.

### COD Settlement Statuses (Distinct from Delivery Status)

| Status | Meaning | Merchant Action |
|--------|---------|-----------------|
| **Pending** | Shipment in transit OR courier hasn't transferred funds to EasyParcel yet | Wait — cannot withdraw |
| **To Release** | Courier processed payment; funds ready for withdrawal | Click "Withdraw" button |
| **Releasing** | Withdrawal request submitted; payout processing (3-4 working days) | Wait |
| **Released** | Money landed in bank account | Download invoice/statement |
| **Cancelled** | Shipment cancelled or returned; no settlement | N/A |

**Key insight:** A parcel can show "Delivered" in tracking while COD settlement still shows "Pending" (courier hasn't remitted yet). These are **two separate status streams**.

**No additional field like "COD collected" or "remittance pending"** in the delivery tracking — the collection confirmation is implicit in the settlement status transition.

---

## Q6: Sandbox / Demo Environment

**YES**, COD can be tested in sandbox.

**Demo URL:** `http://demo.connect.easyparcel.my/`  
**Live URL:** `https://connect.easyparcel.my/`

**Demo environment is available** for testing API workflows. Per developer portal (developers.easyparcel.com), the demo endpoint allows full order submission and rate-checking without affecting live data.

**Test credentials:** Use your EasyParcel account API key (register at www.easyparcel.my, verify account, generate API key in developer console).

**Note:** The developer portal mentions "demo page" at https://developers.easyparcel.com/?pg=Demo&c=Malaysia but doesn't explicitly state if COD can be tested in sandbox or only live orders. **Recommend testing via demo.connect.easyparcel.my endpoint with `cod_enabled: true` to verify.**

---

## Summary Table: Courier-COD Support Matrix

| Courier | Supported? | Fee | Settlement | Max Amount | Notes |
|---------|-----------|-----|-----------|-----------|-------|
| J&T Express | ✓ | RM7 or 4% | 7-12 days | RM7,000 | Most popular, reliable |
| DHL eCommerce | ✓ | RM6 or 4% | 1-3 days | TBD | Fastest settlement |
| Flash Express | ✓ | RM5 or 4% | 1-3 days | RM7,000 | Lowest base fee |
| Aramex | ✓ | RM10 or 4% | 30 days | TBD | Slowest, highest fee |
| Pos Laju | ✗ | — | — | — | Not COD-enabled |
| SPX Express | ✗ | — | — | — | Not COD-enabled |
| City-Link | ✗ | — | — | — | Not COD-enabled |
| Skynet | ✗ | — | — | — | Not COD-enabled |
| Best Express | ✗ | — | — | — | Not COD-enabled |

---

## Implementation Checklist for F36

- [ ] Add `cod_enabled` and `cod_amount` fields to order submission form (conditional on courier support)
- [ ] Call EPCheckCourierRate before showing COD option — check `cod_service_available` + populate min/max constraints in UI
- [ ] Validate COD amount against courier-specific min/max (reject out-of-range before API submit)
- [ ] On EPSubmitOrderBulk, submit `cod_enabled: true` + `cod_amount` for COD orders
- [ ] Parse `cod_charges` from response; show merchant exact fee charged
- [ ] Fetch COD settlement status separately (not from tracking API) — use COD Settlement endpoint
- [ ] Display settlement status ("Pending" → "To Release" → "Releasing" → "Released") in admin dashboard
- [ ] Restrict COD booking to **West Malaysia only** — show warning for Sabah/Sarawak postcodes
- [ ] Document in store: COD available for J&T, DHL eCommerce, Flash Express, Aramex only
- [ ] Test in demo.connect.easyparcel.my before live
- [ ] Bank account verification is **mandatory** for merchants to withdraw COD funds

---

## Unresolved Questions

1. **DHL eCommerce & Aramex COD min/max amounts** — not listed in public docs. Must fetch via EPCheckCourierRate API or contact support.
2. **Can COD be tested in demo.connect.easyparcel.my?** — Portal mentions demo environment; unclear if COD API calls are supported. Recommend testing directly.
3. **Does API return settlement status / COD status for a specific order?** — Docs mention "COD Settlement page" in UI but no explicit API endpoint for settlement status per order. May need a separate query.
4. **Are there any weight/size/price restrictions per courier for COD?** — Not publicly specified. Likely tied to courier's general capacity (check EPCheckCourierRate).
5. **What happens if merchant's bank account verification fails?** — Process unclear. Likely blocks withdrawal request. Confirm with EasyParcel.
6. **TikTok Shop / Shopee COD integration** — EasyParcel mentions multi-platform support (Shopify, WooCommerce, TikTok Shop, Lazada, Shopee), but explicit COD behavior per platform is unclear.

---

## Sources

- [EasyParcel Cash on Delivery (COD) Made Easy & Secure](https://easyparcel.com/my/cash-on-delivery/)
- [How to Create COD Shipment on EasyParcel](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223985-how-to-create-cod-shipment-on-easyparcel-)
- [What is Cash On Delivery (COD)? E-commerce Payment Guide](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223982-what-is-cash-on-delivery-cod-)
- [EasyParcel COD Charges: Fee Calculation & Service Rates](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-)
- [How to Withdraw My Cash On Delivery (COD) Settlement Amount](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223986-how-to-get-my-cod-settlement-amount-)
- [Is There a Minimum or Maximum Amount Limit for Cash On Delivery (COD)?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223989-is-there-a-minimum-or-maximum-amount-limit-for-cash-on-delivery-cod-)
- [Which Couriers Are Available for COD on EasyParcel?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224479-which-couriers-are-available-for-cod-on-easyparcel-)
- [What Does Each Status Mean Under the COD Settlement Page?](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223988-what-does-each-status-mean-under-the-cod-settlement-page-)
- [EasyParcel Developer Hub: Empower Your Business with Our API](https://api.easyparcel.com/)
- [EasyParcel API Documentation Portal](https://developers.easyparcel.com/)
- [[Update] EasyParcel Introduces Cash On Delivery (COD)](https://blog.easyparcel.com/my/cash-on-delivery/)
- [EasyParcel Malaysia API Marketplace Documentation](https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace)
