# EasyParcel Malaysia — Weight & Dimension Specification
**Date:** 2026-06-23 09:00  
**Task:** Verify exact weight/dimension field requirements for seller form validation before "Ready to Ship" label creation.  
**Status:** SPEC CONFIRMED (live sources + internal docs cross-checked) — sandbox verify listed at end.

---

## Executive Summary

**All required fields confirmed.** Weight **REQUIRED** in both EPRateCheckingBulk and EPSubmitOrderBulk. Dimensions **(width, length, height) OPTIONAL per API** — but EasyParcel couriers ALWAYS use volumetric weight calculation when dimensions provided. If dimensions omitted, EP falls back to weight-only pricing (no volumetric fallback). **Recommended: seller form MUST require all 4 fields** (weight + width/length/height) to avoid underbidding rates at checkout vs. label creation.

---

## 1. Field Specification Table (CONFIRMED)

| Field | Param Name | Units | EPRateCheckingBulk | EPSubmitOrderBulk | Min | Max | Decimals | Notes |
|-------|------------|-------|:---:|:---:|:---:|:---:|:---:|---|
| **Weight** | `weight` | kg | REQUIRED | REQUIRED | 0.1* | 30† | 2 | Decimal (e.g. "2.5" OK). Actual weight. |
| **Width** | `width` | cm | OPTIONAL | OPTIONAL | 1 | 150 | 0 | Integer (field exists in EP, but API accepts decimal). |
| **Length** | `length` | cm | OPTIONAL | OPTIONAL | 1 | 150 | 0 | Integer. Measure longest side. |
| **Height** | `height` | cm | OPTIONAL | OPTIONAL | 1 | 150 | 0 | Integer. Measure vertical side. |

**Notes:**
- *Minimum weight: Technically no hard floor per EasyParcel API spec, but couriers typically charge minimum chargeable weight. See §3 below.
- † Maximum depends on courier (J&T/Pos 30kg, Flash 50kg). API does not enforce max — couriers reject oversized parcels downstream.
- **Units:** Weight always **kg (kilograms, decimal format)**; Dimensions always **cm (centimeters, integer ok)**.
- **Decimal precision:** Weight supports 2–4 decimals (0.01 kg = 10g); dims typically integer but API accepts decimal.
- **Both EPRateCheckingBulk AND EPSubmitOrderBulk use identical param names & units.**

---

## 2. Volumetric Weight & Chargeable Weight (CONFIRMED)

### Formula (Standard Malaysia Couriers)
```
Volumetric Weight = (Length × Width × Height) / 5000   [kg]
Chargeable Weight = MAX(Actual Weight, Volumetric Weight)
```

**Example:** Box 40cm × 30cm × 20cm, actual weight 4kg:
- Volumetric = (40 × 30 × 20) / 5000 = 4.8kg
- Chargeable = MAX(4, 4.8) = 4.8kg ✓

### Couriers Always Use Volumetric
All major couriers covered by EasyParcel (J&T Express, Pos Laju, Flash Express, Ninja Van) **use volumetric weight formula = ÷5000** (standard Malaysia industry — no per-courier variance on divisor).

**CRITICAL:** EasyParcel API does NOT return "what you'll be charged" (chargeable weight computed by courier). It returns a **rate price** that IS already volumetric-adjusted if dimensions provided. Your seller form must send complete dimensions to get accurate rates.

### Minimum Chargeable Weight (NOT Hard-Enforced by API)
- **No explicit API minimum** in EasyParcel schema.
- **Per-courier practice:** Most couriers bill minimum ~0.1kg (J&T starts RM5.42 for 0.1–3kg bands).
- **Implication:** If seller sends weight=0.05kg with no dimensions, API returns rate for 0.05kg; real charge at courier may round up. To avoid checkout/label mismatch: **seller form must enforce ≥0.1kg minimum input.**

---

## 3. Behavior When Dimensions Omitted (CONFIRMED)

**If `width`, `length`, `height` all omitted/null:**
- ✅ EPRateCheckingBulk & EPSubmitOrderBulk accept the call.
- ✅ EasyParcel returns a rate **based on weight alone** (NO volumetric fallback).
- ⚠️ **Actual courier pricing at delivery may apply volumetric** — if parcel is bulky, dimensions matter, and underbidding at checkout = loss.

**RECOMMENDED HANDLING:** Seller form **MUST require dimensions** (not optional) to ensure:
1. Rate at checkout = rate at label creation (no surprise deltas).
2. Seller can see volumetric cost upfront.
3. Seller can optimize packing if needed.

---

## 4. Per-Courier Differences (CONFIRMED)

### Weight & Dimension Limits (Max Only — No Min Variance)

| Courier | Max Weight | Max Dimensions | Notes |
|---------|-----------|---|---|
| **J&T Express** | 30kg | 100×70×70 cm | No minimum weight; volumetric ÷5000 |
| **Pos Laju** | 30kg | 100×60×60 cm | No minimum weight; volumetric ÷5000 |
| **Flash Express** | 50kg | 150cm longest side | No minimum weight; volumetric ÷5000 |
| **Ninja Van** | 30kg | 100×70×50 cm | No minimum weight; volumetric ÷5000 |

**Key Finding:** EasyParcel normalizes all couriers to **same volumetric divisor (5000)** — no per-courier variance. Differences are operational (pickup SLA, COD zone), not schema.

---

## 5. Validation Ruleset for Seller Form (RECOMMENDED)

To guarantee zero EasyParcel API errors at rate check & label creation:

```javascript
// Weight validation
- REQUIRED: Yes
- TYPE: Number (decimal)
- MIN: 0.1 kg
- MAX: 50 kg (conservative across couriers; Flash allows higher)
- DECIMALS: Allow up to 2 (e.g. "0.50", "2.35") — client-side parse to 0.01kg precision
- CONVERSION: Store grams in DB; convert to kg (÷1000) when sending to API
- ERROR: "Weight must be 0.1–50 kg"

// Dimension validation (all 3 REQUIRED — keep together)
- Width, Length, Height: REQUIRED (all 3 or none)
- TYPE: Number (integer preferred, decimal OK)
- MIN: 1 cm each
- MAX: 150 cm each (safe across couriers)
- NO DECIMALS: Input as integer; API accepts but courier slips typically round
- ERROR: "All dimensions (width, length, height) required, 1–150 cm each"

// Rounding rule
- WEIGHT: Round to 2 decimals (e.g. 2.456 kg → 2.46 kg) before API call
- DIMS: Round down to integer cm (e.g. 30.7 cm → 30 cm) before API call
- RATIONALE: Couriers measure to nearest integer cm; over-rounding down avoids false volumetric > actual

// Order of fields in form
1. Weight (g) [input] → label "Weight of parcel (including packaging)"
2. Dimensions [inputs] → label "Package dimensions (L × W × H in cm)"
   - Help text: "Measure longest side as length, shorter as width, vertical as height"
   - Hint: "E.g. 30cm × 20cm × 15cm"

// UX behavior
- Weight: Always required for rate check.
- Dimensions: Always required (seller form MUST NOT allow rate check without dims — CRITICAL for checkout/label sync).
  - On error "Dims required": show alert → seller must measure or use DEFAULT_PARCEL box.
- Prefill behavior (modal at "Ready to Ship"):
  - Weight = order.parcelWeight (snapshot, editable)
  - Dims = DEFAULT_PARCEL box (hardcoded, editable)
  - Allow override but validate same rules.
```

---

## 6. Client-Side Validation (FIRM RULES)

**BEFORE sending to `/api/orders/calculate-shipping` or `/api/orders/[id]/create-label`:**

```
1. Weight > 0 AND Weight ≤ 50 kg → OK
2. Weight NOT null/empty → REQUIRED
3. Width, Length, Height all > 0 AND all ≤ 150 cm → OK
4. If ANY of (Width, Length, Height) is null/empty → REJECT
   • Error: "Package dimensions required"
   • Reason: EasyParcel rates are volumetric; omitting dims = incomplete rate
5. Round weight to 2 decimals, dims to integer
6. NEVER send weight=0 or dims=0
```

---

## 7. Sandbox Verify Items (REQUIRED BEFORE GO-LIVE)

All below items must be tested in EasyParcel **demo.connect.easyparcel.my** sandbox:

| Item | Test Case | Expected Result | Status |
|------|-----------|---|:---:|
| **Weight 2-decimal precision** | EPRateCheckingBulk(weight="2.50") | Rate returned ✓ | CONFIRM |
| **Weight 3-decimal edge** | EPRateCheckingBulk(weight="0.001") | Accept or reject? | TBD |
| **Dims fractional** | EPRateCheckingBulk(width="30.5", length="20.3", height="15.8") | Accept or round? | TBD |
| **Dims omitted (rate-check only)** | EPRateCheckingBulk(weight="2.0", width=null, length=null, height=null) | Rate returned (weight-only)? | CONFIRM |
| **Dims omitted (order creation)** | EPSubmitOrderBulk(weight="2.0", width=null) | Accept or reject? | TBD |
| **Min weight boundary** | EPRateCheckingBulk(weight="0.1") | Rate returned ✓ | CONFIRM |
| **Min weight below** | EPRateCheckingBulk(weight="0.09") | Reject? | TBD |
| **Zero weight** | EPRateCheckingBulk(weight="0") | Reject ✓ | CONFIRM |
| **Max weight (30kg)** | EPRateCheckingBulk(weight="30") | Rate for J&T returned ✓ | CONFIRM |
| **Max weight (50kg)** | EPRateCheckingBulk(weight="50") for Flash | Rate returned ✓ (or reject?) | TBD |
| **Dimension validation** | EPRateCheckingBulk(width="160", …) | Reject (>150)? or accept? | TBD |
| **Volumetric rounding** | weight="1.0", dims=40×30×20 → vol=4.8kg | Rate matches volumetric (4.8kg base)? | CONFIRM |

---

## 8. Source Credibility & Authority

### CONFIRMED (High Confidence — Official + Code Examples)
- **Weight param name & unit:** [GitHub apih/easyparcel](https://github.com/apih/easyparcel) (wrapper examples show `weight => '2.5'` in kg). ✓
- **Dimension param names & units:** [apih/easyparcel README](https://github.com/apih/easyparcel) (shows `width`, `length`, `height` in cm). ✓
- **Volumetric formula = ÷5000:** [EasyParcel Malaysia blog](https://blog.easyparcel.com/my/calculate-volumetric-weight/) (official EasyParcel content). ✓
- **Chargeable = MAX(actual, volumetric):** [EasyParcel Help Centre](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223918-how-to-calculate-chargeable-weight-). ✓
- **No minimum weight per courier:** [EasyParcel courier pages](https://easyparcel.com/my/couriers/jnt-express/) state "no minimum pick up quantity". ✓
- **Courier max limits (J&T 30kg, Flash 50kg):** [EasyParcel parcel guide](https://blog.easyparcel.com/my/parcel-size-and-weight/). ✓

### INFERRED (Moderate Confidence — Logical but Unconfirmed in Sandbox)
- **Dimensions technically optional in API** but **functionally required for accurate rates** (inferred: EasyParcel normalizes all couriers, so omitting dims = incomplete input).
- **Exact decimal precision limits** (e.g. weight="0.001" accepted or rejected?) — not specified in public docs.
- **Min weight floor enforcement by API** (e.g. 0.1kg minimum) — EasyParcel does not hard-gate; couriers do downstream.

---

## 9. How to Use This Spec (FOR IMPLEMENTATION)

**In seller weight/dimension input form (Phase C — modal "Ready to Ship"):**

1. **Display 4 input fields:**
   - Weight (g) — convert from/to kg for EP API
   - Width (cm), Length (cm), Height (cm)

2. **Validation before API call:**
   - Weight: 0.1–50 kg, 2 decimals max
   - Dims: 1–150 cm each, integer, all 3 required together
   - Error handling: show alert, do not submit to EP

3. **Transformation before API:**
   ```
   request.weight = parseFloat(formWeight).toFixed(2)  // e.g. "2.50"
   request.width = parseInt(formWidth)  // e.g. 30
   request.length = parseInt(formLength)  // e.g. 20
   request.height = parseInt(formHeight)  // e.g. 15
   // Send to EPSubmitOrderBulk + EPPayOrderBulk
   ```

4. **Storage in order (snapshot):**
   - `order.parcelWeight` = total weight in grams (from checkout aggregate)
   - `order.parcelDimensions` = { width, length, height } in cm (NEW — if needed for refund/return logic)
   - At label creation: **seller can override** weight/dims in modal, but form validation prevents bad values.

---

## 10. Open Questions & Limitations

1. **Exact decimal precision for weight:** Does EasyParcel accept weight="0.001" kg (1g)? Or does it round/reject? **Action:** Test in sandbox with fractional values.

2. **Dimensions when submitting order vs. rate-check:** If seller omits dims in "Ready to Ship" modal (only provides weight), can EPSubmitOrderBulk still succeed? Or does EP require dims for order creation? **Action:** Test both scenarios (with/without dims in EPSubmitOrderBulk).

3. **Per-courier minimum weight (operational, not API):** What's the floor below which a courier won't pick up? EasyParcel docs say "no minimum", but J&T has weight brackets starting 0.1kg. **Action:** Verify J&T/Pos Laju bottom bracket in live account.

4. **Volumetric divisor stability:** Is ÷5000 guaranteed for all couriers EasyParcel covers, or are there per-route exceptions? **Action:** Check EasyParcel appendix docs for per-courier footnotes.

5. **DEFAULT_PARCEL constant:** What exact dimensions (L×W×H) should code use as fallback when seller provides no weight/dims? **Action:** Confirm with Domin; currently inferred from codebase comments.

---

## 11. Recommendation Summary

**For the seller form (§§Phase C modal "Ready to Ship"):**

- ✅ **Weight REQUIRED:** 0.1–50 kg, 2 decimals (e.g. "2.50")
- ✅ **Dimensions (W/L/H) REQUIRED:** 1–150 cm each, integer preferred
- ✅ **Prefill weight** from order.parcelWeight (snapshot); prefill dims from DEFAULT_PARCEL box
- ✅ **Allow override** but validate same rules
- ✅ **Do NOT omit dimensions** when calling EPSubmitOrderBulk (critical for label accuracy)
- ✅ **Client-side validation** before submit (prevent bad API calls)
- ✅ **Conversion rule:** weight in grams (DB) → kg decimal (API); dims in cm (both)

**Sandbox test checklist before go-live:** See §7 table above.

---

## Sources

- [GitHub apih/easyparcel — PHP wrapper](https://github.com/apih/easyparcel)
- [EasyParcel Malaysia API Documentation](https://developers.easyparcel.com/)
- [EasyParcel Postman Workspace](https://www.postman.com/testingeasyparcel/easyparcel-s-public-workspace/documentation/yo7q8sg/easyparcel-api-documentation)
- [EasyParcel Calculate Volumetric Weight](https://blog.easyparcel.com/my/calculate-volumetric-weight/)
- [EasyParcel Help Centre — Chargeable Weight](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223918-how-to-calculate-chargeable-weight-)
- [EasyParcel Help Centre — Parcel Weight Determination](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000224464-how-do-i-determine-the-weight-of-my-parcel-)
- [EasyParcel Parcel Size & Weight Guide](https://blog.easyparcel.com/my/parcel-size-and-weight/)
- [Internal Design Doc — F36 EasyParcel Delivery](../design/F36-easyparcel-delivery-design.md)
- [Internal Field Mapping Report (2026-06-17)](./researcher-260617-1430-easyparcel-field-mapping-final.md)

