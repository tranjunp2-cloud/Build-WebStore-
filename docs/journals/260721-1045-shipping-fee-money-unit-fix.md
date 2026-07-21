---
date: 2026-07-21
session: shipping-fee-money-unit-fix
status: uncommitted
---

# Journal: 2026-07-21 — Shipping Fee Money Unit Fix

## Context

Checkout displayed RM 801.00 when West Malaysia's configured flat shipping rate was RM 8.01. The fix had to correct the sen/RM boundary without breaking consumers of the legacy shipping quote response.

## What Happened

- Reproduced the regression as TC-F14.159: a configured `westRate` of 801 sen reached checkout as RM 801.00 instead of RM 8.01.
- Found two unit-boundary faults. The flat-rate API multiplied the already-sen value returned by `getShippingRate` by 100, while `CheckoutClient` trusted the ambiguous top-level `data.fee` as an RM amount.
- Preserved the branch-specific legacy `data.fee` units for compatibility (flat-rate returns sen; EasyParcel returns RM) and made `rates[].priceSen` the canonical quoted amount for both response paths.
- Added `shippingRateToRM`, which converts only a non-negative safe-integer `priceSen`; malformed or absent quote data falls back to the existing RM value.
- The red TC-F14.159 case became green, and focused verification completed with 5/5 files and 59/59 tests passing.

## Reflection

The failure came from one numeric field carrying an implicit unit across API and UI boundaries. Preserving the legacy response while introducing one explicit canonical field avoids an unnecessary breaking change. Centralizing the conversion also makes malformed upstream data fail safely instead of silently inflating the order total.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Preserve branch-specific legacy `data.fee` units | Existing flat-rate and EasyParcel consumers may rely on their respective legacy contracts | Fix remains backward compatible while new clients avoid the ambiguous field |
| Use `rates[].priceSen` as the canonical quote | The field name makes the money unit explicit and works for flat and courier quotes | Checkout receives one unambiguous source of truth |
| Convert through `shippingRateToRM` | Validate type, safe-integer range, and non-negative value at the UI boundary | RM 8.01 displays and totals correctly; malformed rates use a safe fallback |
| Lock the regression with TC-F14.159 | The original 801-sen value exposes a 100x conversion error clearly | API preservation and checkout conversion remain covered |

## Verification

- TC-F14.159 red before the fix: `westRate=801` produced `rates[0].priceSen=80100` and checkout RM 801.00.
- TC-F14.159 green after the fix: flat-rate `data.fee=801`, `rates[0].priceSen=801`, and checkout RM 8.01.
- Focused shipping test suites: 5/5 files and 59/59 tests passing.
- Scoped ESLint: 0 errors; one pre-existing `react-hooks/exhaustive-deps` warning outside the changed hunk.
- `git diff --check`: passing.
- Typecheck reports only two unrelated missing local modules: `country-flag-icons/react/3x2` and `@aws-sdk/s3-presigned-post`; no new shipping type errors.
- Review result: Stage 2 PASS 9.7/10; Stage 3 adversarial review found no issues.
- Full local CI remains constrained by root-owned/stale `node_modules`, missing `@aws-sdk/s3-presigned-post` and `country-flag-icons/react/3x2`, and `npm ci` network timeouts.

## Next Steps

- Commit the shipping fee fix and documentation after final diff review.
- Re-run full CI in a clean environment with dependencies available.
- Push and open the staging PR only after the fix is committed.

This shipping fee fix is currently uncommitted and has not been pushed.
