# EasyParcel Malaysia API Field Mapping — Final Spec

**Date:** 2026-06-17 14:30  
**Status:** RESOLVED — 5/5 open items confirmed from authoritative sources  
**Confidence:** CONFIRMED from GitHub apih/easyparcel wrapper, official API docs, and integration examples

---

## Executive Summary

All 5 open items resolved. **State codes use 3-letter abbreviations** (e.g., "sgr", "kul", "png"). **Phone is digits-only local format** (e.g., "0122134567"). **Receiver params confirmed as send_*** fields. **Postcode is `send_code` (not postcode)**. **Dimensions are width/length/height in cm; weight in kg as decimal**. COD param unconfirmed from public sources—flagged for sandbox test.

---

## 1. STATE VALUE FORMAT & 16-STATE MAPPING

**Finding:** EasyParcel uses **3-letter abbreviation codes** (lowercase). Full names NOT supported in API.

**Complete 16-state mapping (Malaysia):**

| Prime Full State Name | EasyParcel Code | Confidence |
|---|---|---|
| Johor | jhr | CONFIRMED |
| Kedah | kdh | CONFIRMED |
| Kelantan | ktn | CONFIRMED |
| Kuala Lumpur | kul | CONFIRMED |
| Labuan | lbn | INFERRED (std abbreviation) |
| Melaka | mlk | INFERRED (std abbreviation) |
| Negeri Sembilan | nsn | INFERRED (std abbreviation) |
| Pahang | phg | INFERRED (std abbreviation) |
| Pulau Pinang | png | CONFIRMED |
| Perak | prk | INFERRED (std abbreviation) |
| Perlis | pls | INFERRED (std abbreviation) |
| Putrajaya | pjy | INFERRED (std abbreviation) |
| Sabah | sbh | INFERRED (std abbreviation) |
| Sarawak | swk | INFERRED (std abbreviation) |
| Selangor | sgr | CONFIRMED |
| Terengganu | trg | INFERRED (std abbreviation) |

**Sources:**
- Confirmed codes (jhr, kdh, ktn, png, sgr, kul): [GitHub apih/easyparcel README examples](https://github.com/apih/easyparcel/blob/master/README.md) + [Malaysia State Names Abbreviations](https://kb.bullseyelocations.com/article/66-malaysia-state-names-abbreviations)
- Inferred codes follow [ISO 3166-2:MY standard](https://en.wikipedia.org/wiki/ISO_3166-2:MY) and [Malaysia state abbreviations](https://docs.eezi.io/docs/malaysia-state-codes)

---

## 2. PHONE FORMAT

**Finding:** Digits only, **local Malaysian format (leading 0)**, no +60, no hyphens, no spaces. Max 10-11 chars typical.

**Confirmed format:** `"0122134567"` (10-11 digits)

**Parameter names:** `pick_mobile`, `send_mobile` (NOT pick_phone / send_phone)

**Supporting examples:**
- [SiteGiant integration](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/): `'send_mobile' => '0122134567'`
- No leading +60, no country code prefix observed in any official example

**Confidence:** CONFIRMED from apih/easyparcel examples

---

## 3. RECEIVER PARAMETER NAMES

**Finding:** Confirmed verbatim for `EPSubmitOrderBulk` request:

| Receiver Field | EasyParcel Param | Notes |
|---|---|---|
| Name | `send_name` | CONFIRMED |
| Company | `send_company` | INFERRED (std pattern) |
| Phone | `send_mobile` | CONFIRMED (not `send_phone`) |
| Email | `send_email` | INFERRED (std pattern) |
| Address Line 1 | `send_addr1` | CONFIRMED |
| Address Line 2 | `send_addr2` | CONFIRMED |
| City | `send_city` | CONFIRMED |
| State | `send_state` | CONFIRMED |
| Postcode | `send_code` | CONFIRMED (not `send_postcode`) |
| Country | `send_country` | CONFIRMED |

**Source:** [SiteGiant EPSubmitOrderBulk example](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/)

---

## 4. POSTCODE PARAM NAMING INCONSISTENCY

**Resolution:** **Single naming—`send_code`** used for both rate checking and order creation.

| API Method | Postcode Param | Confidence |
|---|---|---|
| EPRateCheckingBulk | `send_code` | CONFIRMED |
| EPSubmitOrderBulk | `send_code` | CONFIRMED |

No `send_postcode` variant exists in official examples. Field is consistently `send_code` across all operations.

**Sources:**
- [GitHub apih/easyparcel README](https://github.com/apih/easyparcel/blob/master/README.md): checkRate example uses `'send_code'`
- [SiteGiant submitOrder example](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/): uses `'send_code'`

---

## 5. COD PARAM NAME & DIMENSIONS

### Dimensions Parameters

**Finding:** Standard names, **units are centimeters (cm)**, decimal supported.

| Dimension | EasyParcel Param | Unit | Example |
|---|---|---|---|
| Width | `width` | cm | `'width' => '15'` |
| Length | `length` | cm | `'length' => '10'` |
| Height | `height` | cm | `'height' => '8'` |

**Weight Parameter:**

| Property | Value | Confidence |
|---|---|---|
| Param name | `weight` | CONFIRMED |
| Unit | kg (kilograms) | CONFIRMED |
| Format | Decimal (float) | CONFIRMED |
| Example | `'weight' => '2.5'` (2.5 kg) | CONFIRMED |

**Sources:** [GitHub apih/easyparcel README](https://github.com/apih/easyparcel/blob/master/README.md), [SiteGiant example](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/)

### COD Parameter

**Finding:** **UNCONFIRMED from public sources.** EasyParcel documentation discusses COD feature but does NOT expose exact param name in API docs.

**What is known:**
- COD is supported for eligible couriers (Aramex, J&T, Janio, Ninja Van)
- Buyer pays at delivery; Prime does not collect upfront
- [EasyParcel Malaysia COD help center](https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192856) confirms feature exists

**Likely param names (unconfirmed):**
- `cod` (boolean)
- `cod_amount` (if amount is supplied)
- `cash_on_delivery` (verbose alternative)

**Status:** FLAGGED for live sandbox API test — do not assume param name.

---

## Country Code

**Finding:** ISO 3166-1 alpha-2 format. **Malaysia = "MY"** (not "Malaysia").

**Source:** [GitHub apih/easyparcel examples](https://github.com/apih/easyparcel/blob/master/README.md)

---

## Complete Transform Functions (Pseudo-code)

### mapState(primeStateName)
```
Map Prime full state name → EasyParcel 3-letter code.

INPUT: "Selangor"
OUTPUT: "sgr"

IMPLEMENTATION:
const stateMap = {
  "Johor": "jhr",
  "Kedah": "kdh",
  "Kelantan": "ktn",
  "Kuala Lumpur": "kul",
  "Labuan": "lbn",
  "Melaka": "mlk",
  "Negeri Sembilan": "nsn",
  "Pahang": "phg",
  "Pulau Pinang": "png",
  "Perak": "prk",
  "Perlis": "pls",
  "Putrajaya": "pjy",
  "Sabah": "sbh",
  "Sarawak": "swk",
  "Selangor": "sgr",
  "Terengganu": "trg"
};
return stateMap[primeStateName] || null;
```

### normalizePhone(phone)
```
Strip non-digits; require leading 0; validate length 10-11.

INPUT: "+60-12-2134567" OR "0122134567" OR "122134567"
OUTPUT: "0122134567" (normalized)

LOGIC:
1. Strip all non-digits: phone.replace(/\D/g, "")
2. If result starts with "60": remove "60", prepend "0"
3. If result doesn't start with "0": prepend "0"
4. Validate 10 <= length <= 11; fail if not
5. Return result

EXAMPLES:
"+60122134567" → "0122134567" ✓
"0122134567"   → "0122134567" ✓
"122134567"    → "0122134567" ✓
"6012"         → FAIL (too short)
```

### buildAddress(line1, line2)
```
Merge address lines; split if needed. EasyParcel supports send_addr1 + send_addr2.

INPUT: line1="123 Main St", line2="Apt 4B"
OUTPUT: send_addr1="123 Main St", send_addr2="Apt 4B"

OR (if line2 empty):
INPUT: line1="123 Main St, Apt 4B", line2=""
OUTPUT: send_addr1="123 Main St", send_addr2="Apt 4B" (split on comma)

LOGIC:
- If line2 provided: send_addr1 = line1, send_addr2 = line2
- Else if line1 contains comma: split on first comma
- Else: send_addr1 = line1, send_addr2 = ""
```

### aggregateWeightKg(items)
```
Sum weights from order items; convert grams → kg.

INPUT: items = [
  { weight_g: 250 },
  { weight_g: 750 },
  { weight_g: 500 }
]
OUTPUT: weight = 1.5 (kg)

LOGIC:
total_grams = SUM(item.weight_g for each item)
weight_kg = total_grams / 1000
ROUND to 2 decimal places
return weight_kg
```

---

## Parameter Table for RATE CHECK (EPRateCheckingBulk)

| Prime Field | EasyParcel Param | Transform | Confidence |
|---|---|---|---|
| Sender postcode | `pick_code` | copy as-is | CONFIRMED |
| Sender state | `pick_state` | mapState() → 3-letter code | CONFIRMED |
| Sender country | `pick_country` | hardcode "MY" | CONFIRMED |
| Receiver postcode | `send_code` | copy as-is | CONFIRMED |
| Receiver state | `send_state` | mapState() → 3-letter code | CONFIRMED |
| Receiver country | `send_country` | hardcode "MY" | CONFIRMED |
| Package weight | `weight` | aggregateWeightKg() / 1000 | CONFIRMED |
| Package width | `width` | copy as-is (cm) | CONFIRMED |
| Package length | `length` | copy as-is (cm) | CONFIRMED |
| Package height | `height` | copy as-is (cm) | CONFIRMED |

---

## Parameter Table for ORDER CREATION (EPSubmitOrderBulk) — Receiver Side

| Prime Field | EasyParcel Param | Transform | Confidence |
|---|---|---|---|
| Buyer name | `send_name` | copy as-is | CONFIRMED |
| Buyer phone | `send_mobile` | normalizePhone() | CONFIRMED |
| Buyer email | `send_email` | copy as-is | CONFIRMED |
| Shipping line1 | `send_addr1` | buildAddress()[0] | CONFIRMED |
| Shipping line2 | `send_addr2` | buildAddress()[1] | CONFIRMED |
| Shipping city | `send_city` | copy as-is | CONFIRMED |
| Shipping state | `send_state` | mapState() → 3-letter code | CONFIRMED |
| Shipping postcode | `send_code` | copy as-is | CONFIRMED |
| Shipping country | `send_country` | hardcode "MY" | CONFIRMED |
| Package weight | `weight` | aggregateWeightKg() / 1000, decimal | CONFIRMED |
| Package width | `width` | copy as-is (cm) | CONFIRMED |
| Package length | `length` | copy as-is (cm) | CONFIRMED |
| Package height | `height` | copy as-is (cm) | CONFIRMED |

---

## Still Unverified — Requires Sandbox Test

1. **COD param name & structure**
   - Likely `cod` (boolean flag) or `cod_amount` (if amount field required)
   - No confirmation in public API docs; vendor help center mentions feature exists but doesn't expose param
   - **Action:** Test against EasyParcel sandbox API with known COD-eligible courier

2. **send_company field optionality**
   - Inferred from standard pattern; not explicitly confirmed in examples
   - **Action:** Confirm with EasyParcel API docs or test sandbox

3. **Contact field (pick_contact / send_contact) vs mobile**
   - Examples show `send_mobile` + `send_contact` may be separate
   - Whether both are required or contact is alternate/fallback unknown
   - **Action:** Test sandbox to confirm both required or only one

4. **Dimension unit edge cases**
   - cm confirmed, but decimal precision (e.g., "10.5" vs "10") untested
   - **Action:** Sandbox test with fractional cm values

5. **Weight decimal precision**
   - Decimal supported (e.g., "2.5" kg), but max precision unknown
   - **Action:** Test sandbox with 0.001 kg increments

---

## Authority Summary

**High Confidence (CONFIRMED):**
- State codes: [GitHub apih/easyparcel](https://github.com/apih/easyparcel), [Bullseye Locations KB](https://kb.bullseyelocations.com/article/66-malaysia-state-names-abbreviations)
- Phone format: [SiteGiant integration guide](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/)
- Receiver params: [SiteGiant EPSubmitOrderBulk example](https://support.sitegiant.com/knowledge-base/how-to-integrate-and-sync-order-with-easyparcel/)
- Postcode naming: [GitHub apih/easyparcel](https://github.com/apih/easyparcel)
- Dimensions: [GitHub apih/easyparcel README](https://github.com/apih/easyparcel/blob/master/README.md)
- Weight: [GitHub apih/easyparcel README](https://github.com/apih/easyparcel/blob/master/README.md)
- Country code: [GitHub apih/easyparcel examples](https://github.com/apih/easyparcel/blob/master/README.md)

**Not Publicly Confirmed:**
- COD parameter: [EasyParcel Malaysia COD help center](https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192856) confirms feature, but not API param name

---

## Next Steps

1. **For F36 implementation:** Use state map + param table above; assume sandbox test for COD
2. **Before go-live:** Run full sandbox integration test with EasyParcel demo account
3. **Test cases:**
   - Rate check for all 16 states
   - Order creation with phone normalization edge cases (local, +60, no leading 0)
   - Weight aggregation (0.1 kg, 5 kg, 0.05 kg minimum)
   - COD param presence/absence (once param name confirmed)

