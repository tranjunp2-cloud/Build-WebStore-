# Research Report: EasyParcel Courier Selection & COD Integration Patterns

**Date:** 2026-07-01 15:12  
**Topic:** Courier selection mechanisms & COD handling for Malaysia-based e-commerce integrations  
**Audience:** Developer implementing multi-tenant storefront checkout with EasyParcel

---

## Executive Summary

EasyParcel integrations follow **two primary UX patterns**: (1) **buyer-selects** at checkout from live rates (Shopify/WooCommerce app mode, recommended), or (2) **seller-fixed** pre-configuration (legacy import mode). COD is **route-dependent** and **region-restricted to West Malaysia only**—not available for East Malaysia (Sabah/Sarawak) shipments. For multi-tenant sellers, the **recommended approach is buyer-selects live rates**, with COD validation done per-quotation response (not pre-checked against a fixed destination).

---

## Question 1: EasyParcel's Official Plugins — Courier Selection at Checkout

### Shopify Integration (Current Standard)

**UX Pattern: Buyer Selects**

- Merchants use the EasyParcel Shopify app ("EasyParcel - Delivery Made Easy") to enable **live shipping rates at checkout**.
- Customers see multiple courier options + rates on the checkout shipping page and **select their preferred courier**.
- System automatically fulfills the order using the buyer's chosen courier.
- Merchants can:
  - Configure different couriers per delivery zone
  - Set a display name for each courier
  - Apply markup (fixed amount or percentage) to the EasyParcel member rate
  - Apply flat-rate pricing regardless of location

**Key Details:**
- Requires Shopify Plus or higher billing plan for advanced rate customization
- Rates are fetched in real-time (no manual updates needed)
- The "cheapest" option may be highlighted but buyer choice takes precedence

### WooCommerce Integration (Import vs. Plugin Version)

**Two modes coexist:**

1. **Import Version:** Merchants manually import orders into EasyParcel
   - Merchant can **auto-select cheapest** (system picks lowest-price courier per destination)
   - OR **seller-fixed** (merchant pre-selects one preferred courier + optional alternative)
   - Buyer does NOT see courier options at checkout; sees shipping cost set by seller

2. **Plugin Version:** Direct fulfillment within WooCommerce
   - Similar to Shopify — merchant configures live rates per zone
   - Buyer may select from available couriers at checkout (if configured)
   - OR merchant sets fixed courier only

### Official Integrations Conclusion

**Most common pattern:** Buyer-selects from live rates (Shopify app mode, WooCommerce plugin). Seller-fixed is a fallback for simpler setups.

---

## Question 2: Courier Selection Models — Which is Most Common?

### Three Models Observed

| Model | Description | Common Use | Pros | Cons |
|-------|-------------|-----------|------|------|
| **Buyer-Selects** | Show all available couriers + rates at checkout; buyer chooses one | Shopify app, advanced WooCommerce, preferred for marketplace | Transparency, buyer control, reduces disputes, supports customer preference | Requires rate fetch at checkout (slight latency), more UI complexity |
| **Seller-Fixed** | Seller pre-configures one courier (+ optional alternative); buyer sees only that rate | Simple stores, legacy WooCommerce import mode | Simple setup, predictable cost, merchant control | Buyer has no choice, may miss cheaper options, COD availability unclear |
| **Auto-Cheapest** | System picks lowest-price courier per destination automatically | WooCommerce import mode (default) | No merchant config needed, always lowest price | No buyer control, hides courier options, COD availability unclear |

### Ranking by Adoption

1. **Buyer-Selects** (Winner) — Official recommendation from EasyParcel for modern integrations; used by Shopify app, EasyStore, and plugin-based WooCommerce.
2. **Seller-Fixed** — Fallback for single-product stores or sellers wanting full control.
3. **Auto-Cheapest** — Legacy/batch mode; rarely used for checkout-time integration.

### Recommendation for Checkouts

**Buyer-selects is the industry standard for transparency and customer satisfaction.** Enables differentiation (e.g., "Fast Express vs. Standard") and reduces "why am I paying this rate?" disputes.

---

## Question 3: COD (Cash on Delivery) in Malaysia via EasyParcel

### COD Support Overview

**Supported Couriers:** DHL eCommerce, J&T Express, Flash Express, Aramex  
**Geographic Scope:** West Malaysia (Peninsular only) — **NOT available for Sabah, Sarawak, or Labuan**  
**Route Dependency:** YES — COD availability is determined PER shipment route (origin → destination), not per courier universally

### Critical Finding: Route-Dependency

COD is **NOT a courier-level flag; it is a route-level flag.** This explains the symptom in your current implementation:

- A Sarawak-origin seller tried a sample quotation to Kuala Lumpur, received no COD couriers, then assumed no couriers support COD
- **Root cause:** Sarawak → KL is an **East Malaysia → West Malaysia cross-region route**, which typically has no COD support
- For that seller to see COD couriers, they must test a **Sarawak (origin) → Sarawak (destination)** quotation (within-state delivery)

### COD Availability per Quotation

The EasyParcel API's `quotations` endpoint returns:
- Each quotation line item (per courier, per service)
- A `features[].cod` or similar field indicating COD availability for **that specific route**
- NOT a pre-determined list of "COD couriers" independent of destination

### Regions Requiring Special Handling

| Route | COD Available? | Couriers Supporting |
|-------|---|---|
| West Malaysia → West Malaysia (same state) | YES | DHL, J&T, Flash, Aramex |
| West Malaysia → West Malaysia (different state, same region) | YES | DHL, J&T, Flash, Aramex |
| West Malaysia ↔ East Malaysia (cross-region) | NO | None |
| East Malaysia (Sabah) → East Malaysia (Sabah, same state) | NO (confirmed) | Limited/none |
| East Malaysia (Sarawak) → East Malaysia (Sarawak, same state) | NO (confirmed) | Limited/none |

**Conclusion:** COD is effectively West Malaysia domestic-only. For cross-region or East Malaysia shipments, COD must be disabled at checkout.

### COD Charges

When available:
- **J&T Express:** RM 7 or 4% of COD amount (whichever is higher)
- **DHL eCommerce, Flash, Aramex:** Varies (check rate response)
- Settlement: 7–12 working days after collection; seller requests withdrawal when status = "To Release"

---

## Question 4: EasyParcel Rate API — Quotations Response & Sorting

### API Response Structure

The `POST /open_api/2026-03/shipment/quotations` endpoint returns:

```json
{
  "api_status": "success",
  "error_code": 0,
  "error_remark": "",
  "result": {
    "quotations": [
      {
        "courier_id": "jnt",
        "courier_name": "J&T Express",
        "service_id": "jnt-standard",
        "service_name": "J&T Standard",
        "service_type": "parcel",
        "pricing": {
          "total_amount": 15.50
        },
        "features": {
          "cod": {
            "available": true
          }
        },
        "scheduled_start_date": "2026-07-02",
        "delivery": "2-3 working days"
      }
    ]
  }
}
```

### Sorting Behavior

- **API returns:** Typically sorted by **price ascending** (cheapest first) in reference implementations
- **Integration implementations vary:** Some apps re-sort by delivery time, then price; some show all unsorted
- **Official recommendation:** Display all options, allow buyer to choose by price, speed, or brand preference

### Key Points

- **No filter parameter** to request "only COD couriers" in the API call itself
- Integration must **inspect the `features.cod.available` flag per quotation** at checkout time
- If seller wants to enforce "COD-only rates," filter client-side after receiving all quotations
- **Your current approach is correct:** Read `features[].cod.available` from the quotation response; do NOT pre-check against a fixed destination

---

## Question 5: Best Practice UX Recommendation for Multi-Tenant Storefront

### Context (Your Implementation)

- Each seller has own EasyParcel account (OAuth)
- Sellers can originate from anywhere in Malaysia (West or East)
- Buyers are primarily Malaysia-based (cross-region orders possible)
- Goal: Checkout UX that is transparent, supportive of all regions, and COD-capable where applicable

### Recommended Approach

#### Phase 1: Quotation Fetch (Checkout Address Entered)

1. **Buyer enters delivery address** → determine destination region (West or East Malaysia)
2. **Call `POST /quotations`** with:
   - Origin: seller's configured warehouse / account region
   - Destination: buyer's delivery address
   - Item details (weight, contents)
3. **Parse response:**
   - Build two lists:
     - **All couriers** (all pricing options)
     - **COD-capable couriers** (filter by `features.cod.available === true`)

#### Phase 2: Checkout Display

| Scenario | Display | Reasoning |
|----------|---------|-----------|
| **West→West, COD available** | Show all couriers + COD badge/tag on COD options. Let buyer choose. | Standard scenario; buyer may prefer COD or prepay. |
| **West→East or East→East** | Show all couriers. Hide/disable COD payment method in checkout. | COD not supported for cross-region; offer prepay only. |
| **East→West** | Show all couriers. Offer COD only for West-destination deliveries. | Rare but possible; support if available. |

#### Phase 3: Payment Method Selection (Concurrent)

- **If any COD-capable courier exists in the quotation:** Offer "Cash on Delivery" + "Prepay" payment methods
- **If no COD-capable courier:** Show "Prepay only" (COD toggle hidden/disabled)
- **Buyer choice:**
  - Selects courier (e.g., "J&T Express - RM 15.50")
  - Selects payment method (e.g., "COD" or "Credit Card")
  - System validates: **if (payment === COD && !selected_courier.features.cod.available) → error**

### UX Flow Diagram (Pseudo-ASCII)

```
Checkout Address Entered
       ↓
   Fetch Quotations
       ↓
   ├─ If Cross-Region? → Hide COD payment option
   │
   └─ If Same-Region? → Parse features.cod.available per courier
                           ↓
                    Display Couriers + Prices
                    (COD badge on eligible ones)
                           ↓
                    Buyer Picks Courier
                           ↓
                    Buyer Picks Payment Method
                    (COD available only if selected courier supports it)
                           ↓
                    Validate & Proceed
```

### Implementation Checklist

- ✅ **Never pre-check COD support** against a fixed destination (e.g., KL). Always fetch quotations with actual buyer address.
- ✅ **Parse `features.cod.available` per quotation**, not per courier globally.
- ✅ **Show all couriers** (buyer-selects pattern), but badge/highlight COD options.
- ✅ **Disable COD payment method** if buyer's address is in East Malaysia.
- ✅ **Validate at order creation:** if (COD selected && !quotation.features.cod.available) → reject and inform buyer.
- ✅ **Handle region detection** gracefully: use postcode/state to determine region, or let EasyParcel API return region info if available.

### Why This Approach Works

1. **Transparency:** Buyer sees all options, knows why COD isn't available for their location.
2. **Flexibility:** Supports all seller origins (West & East) and all buyer destinations.
3. **Reliability:** Validates COD availability at the last moment (per-quotation), avoiding stale pre-cached assumptions.
4. **User Experience:** Reduces checkout friction (no "COD unavailable" error after order placed).
5. **Multi-tenant safe:** Each seller's account (origin) doesn't affect the logical flow; quotation API handles origin → destination routing.

---

## Unresolved Questions

1. **API response sorting order:** Is `quotations[]` array guaranteed to be sorted by price, or is order undefined?
   - **Impact:** Minor — recommend sorting by price client-side for consistency.

2. **Exact COD fee breakdown:** Does the API return the COD charge (e.g., RM 7 or 4%) per quotation, or only a flag?
   - **Impact:** Low — EasyParcel help docs show rates, but API response structure unclear from public docs.
   - **Recommendation:** Test live API or check unofficial PHP wrapper on GitHub for real response examples.

3. **Cross-region quotation API behavior:** If seller in Sarawak queries to West Malaysia, does the API correctly return "no COD" in features?
   - **Impact:** Critical for your validation logic — recommend testing with a test account.
   - **Recommendation:** Set up a Sarawak test seller + West Malaysia test buyer, call quotations, inspect `features.cod.available`.

4. **Regional breakdown by courier:** Which exact couriers support intra-Sabah or intra-Sarawak COD (if any)?
   - **Impact:** Low (COD is West-only per docs, but confirming per-state would be thorough).

---

## Sources

- [EasyParcel Shopify Integration — Official Help Centre (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188739-how-to-integrate-easyparcel-with-shopify)
- [How to Add Live Rates at Checkout for Shopify (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000266895-how-to-add-live-rates-at-checkout-page-for-shopify-)
- [WooCommerce Integration Guide — EasyParcel Blog (MY)](https://blog.easyparcel.com/my/tutorial-integrate-easyparcel-with-woocommerce/)
- [Which Couriers Support COD? — Help Centre (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224479-which-couriers-are-available-for-cod-on-easyparcel-)
- [COD Charges & Fee Calculation — Help Centre (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224475-how-does-cod-charges-work-)
- [What is Cash on Delivery? — Help Centre (MY)](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223982-what-is-cash-on-delivery-cod-)
- [Send Parcels to East Malaysia — EasyParcel Blog (MY)](https://blog.easyparcel.com/my/send-to-east-malaysia/)
- [EasyParcel API Documentation — Developer Hub](https://api.easyparcel.com/)
- [EasyParcel Postman API Documentation](https://www.postman.com/testingeasyparcel/easyparcel-s-public-workspace/documentation/yo7q8sg/easyparcel-api-documentation)
- [EasyParcel Integration List (Multi-Platform)](https://easyparcel.com/my/integration-list/)
- [Malaysia Multi-Seller E-Commerce Best Practices — DHL Guide](https://www.dhl.com/discover/en-my/e-commerce-advice/international-market/best-ecommerce-platforms-for-malaysian-sellers)

---

## Next Steps for Implementation Team

1. **Validate with test account:** Create a Sarawak seller account, fetch quotations to West Malaysia, confirm `features.cod.available === false`.
2. **Implement region-aware UX:** Detect buyer's region from postcode, conditionally show/hide COD payment method.
3. **Update settings UI:** Remove the "test to fixed KL destination" pre-check; instead, validate COD per-quotation at checkout.
4. **Error handling:** If COD selected but not available, show friendly error: "COD is not available for deliveries to [Buyer Region]. Please choose another payment method."
5. **Consider seller communication:** Add a note in seller settings: "COD is available only for domestic deliveries within West Malaysia (Peninsular Malaysia)."
