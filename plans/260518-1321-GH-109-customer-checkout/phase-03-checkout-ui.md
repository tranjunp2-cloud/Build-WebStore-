# Phase 03 — Checkout UI

**Status:** pending | **Effort:** 2.5h | **Owner:** fullstack-developer | **Blocks:** Phase 02

## Overview
Strip proof-upload UI from checkout page (v2.2 PD-018). Rename `qr_banking` payment option to `bank_transfer` with copy "You'll receive bank details by email after placing the order." On success, redirect to `redirectUrl` from API response. Mobile 375px no horizontal scroll.

## Related code files
- Modify: `src/app/sites/[slug]/checkout/page.tsx` (722 lines → target ≤ 500 after cleanup; if still >200 lines after edits, extract subcomponents)
- Modify: `src/lib/storefront/checkout.ts` (drop `paymentProofImage` from validation)
- Reference: `src/store/cartStore.ts` — `clearCart()` after success (unchanged)

## UI changes
1. **Remove** proof-upload section entirely (file input, preview, S3 upload trigger).
2. **Payment method radio**: replace label "QR Banking" with "Bank Transfer". Value sent to API = `bank_transfer`.
3. **Description text** under BT radio: "After placing your order, we'll email you bank details and a payment reference. Upload your receipt on the next page. (24-hour deadline)."
4. **Submit button label**: keep "Place Order".
5. **On success**: `router.push(redirectUrl)` from API response (don't construct client-side).
6. **Error handling**: existing toast + cart preservation works (AC-2 already met).

## Mobile (375px) audit checklist
- Inputs `w-full` not fixed width.
- Cart summary collapses above form on `<md` breakpoint.
- No horizontal scroll on payment radio labels (long copy → `text-wrap` or `whitespace-normal`).
- Submit button sticky-bottom on mobile OK as-is.

## Implementation steps
1. Open `src/app/sites/[slug]/checkout/page.tsx`. Identify proof-upload block (search for `paymentProofImage`, file input, `accept="image/*"`). Delete block + related state (`proofFile`, `proofUploading`, etc.).
2. Rename payment option label/value: `qr_banking` → `bank_transfer` throughout the file.
3. Update API call body to drop `paymentProofImage`.
4. After successful POST, replace any custom redirect logic with `router.push(data.redirectUrl)`.
5. Update `validateCheckoutForm` in `src/lib/storefront/checkout.ts` — remove proof requirement.
6. Run on dev `npm run dev`, manually check 375px viewport (Chrome devtools).
7. If file still > 500 lines, extract `<PaymentMethodSelect>` and `<ShippingAddressForm>` into `src/components/storefront/checkout/` subcomponents.

## Edge cases
- User had proof uploaded in old session (localStorage) — ignore; only API payload matters.
- Existing in-flight orders with `paymentMethod=qr_banking` — read path unchanged; admin UI still renders.

## Todo list
- [ ] Remove proof-upload UI block + state
- [ ] Rename qr_banking → bank_transfer (label + value)
- [ ] Update API call body (drop paymentProofImage)
- [ ] Redirect via API-provided redirectUrl
- [ ] Update validateCheckoutForm
- [ ] Mobile 375px visual check
- [ ] Extract subcomponents if file > 500 lines

## Success criteria
- Checkout page has no file input.
- Selecting BT → form submits → browser navigates to `/sites/{slug}/orders/{id}?token=...`.
- COD flow unchanged behaviorally (just status='unpaid' now, no upload prompt).
- 375px screenshot has no horizontal scrollbar.

## Risk
- Existing E2E checkout tests may assume proof upload — Phase 08 updates them.
- File > 200 lines violates `development-rules.md` — extraction step required if so.
