# Phase 01 — AC-1 + AC-4: Cancel preserves cart, "Try Again", no premature clear

## Context

- AC-1: Stripe cancel → cart PRESERVED + BM toast "Pembayaran gagal. Sila cuba lagi." + "Try Again" CTA re-triggers Stripe session.
- AC-4 (Stripe side): clearCart must NOT run before `window.location.href = sessionUrl`.
- Wired file: `src/app/sites/[slug]/checkout/CheckoutClient.tsx` (the unused `use-checkout-state.ts` hook is NOT touched).

## Priority / status

P2 · pending · ~1.5h

## Key insights

- Cancel URL set by backend: `cancelUrl: .../checkout?stripe_cancelled=1` (stripe-checkout/route.ts:268).
- CheckoutClient currently: line 343 `clearCart()` then line 346 `window.location.href = sessionUrl`. The clearCart() is the bug — removing it preserves cart automatically because `cartStore` persists to localStorage and rehydrates on mount.
- CheckoutClient does NOT currently read `?stripe_cancelled=1` — no toast, no recovery affordance.
- The "Try Again" CTA does not need a separate button: when buyer lands back on /checkout with cart intact, the existing "Place Order" button (already wired to Stripe `handlePlaceOrder`) IS the retry path. AC-1 "Try Again CTA triggers new Stripe session" is satisfied by surfacing a toast/banner that points at the existing place-order button. KISS — do not add a duplicate Stripe-init button.

## Data flow

```
Stripe Cancel → redirect /checkout?stripe_cancelled=1
  → CheckoutClient mount effect reads param
    → toast.error(BM message)  [AC-1 toast]
    → strip param from URL (history.replace) so refresh doesn't re-toast
  → cart already in localStorage (never cleared) → renders populated  [AC-1 preserve]
  → buyer clicks existing "Place Order" (Stripe) → handlePlaceOrder → new session  [AC-1 retry]
```

## Requirements

Functional:
1. Remove `clearCart()` at CheckoutClient.tsx:343 (the line immediately before the Stripe redirect). Keep `clearCart()` at line 380 (non-Stripe COD/BT path) — that path lands on confirm page directly where order is already placed, so clearing there is correct per existing behavior. VERIFY line 380 context during impl: if it is the COD/bank_transfer success branch that pushes to confirm, leave it; AC-4 only forbids clearing on the *Stripe-redirect* and *cancel* paths.
2. Add mount-time effect: read `?stripe_cancelled=1` via `useSearchParams()`; if present → `toast.error(t...cancelled message)` and clean the param from the URL using `router.replace(pathname)` (no full reload — keeps cart state).
3. Use i18n keys from phase-04 (`paymentDeclined`). No hardcoded BM string.

Non-functional:
- No reload on param cleanup (would re-fetch). Use `router.replace`.
- Toast fires exactly once (guard with a ref or rely on param removal preventing re-trigger).

## Related code files

Modify:
- `src/app/sites/[slug]/checkout/CheckoutClient.tsx`
  - remove line ~343 `clearCart()` (Stripe branch only)
  - add `useSearchParams` import + mount effect for `stripe_cancelled`
  - reference i18n key

Read for context:
- `src/store/cartStore.ts` (confirms localStorage persistence — no change)
- `src/app/api/orders/stripe-checkout/route.ts:268` (cancel URL param)

Do NOT touch: `use-checkout-state.ts` (dead code).

## Implementation steps

1. Confirm the two `clearCart()` call sites (lines ~343 Stripe, ~380 non-Stripe). Remove ONLY the Stripe-branch one.
2. Add `useSearchParams` + `usePathname` from `next/navigation` (router already imported).
3. Add effect:
   ```ts
   const searchParams = useSearchParams()
   const pathname = usePathname()
   useEffect(() => {
     if (searchParams.get('stripe_cancelled') === '1') {
       toast.error(ck.paymentDeclined)  // BM: "Pembayaran gagal. Sila cuba lagi."
       router.replace(pathname)         // strip param, no reload, cart intact
     }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [])
   ```
4. Build check: `npm run build` (or `tsc --noEmit`) — must compile.

## Todo

- [ ] Remove Stripe-branch `clearCart()` (AC-4)
- [ ] Add `stripe_cancelled` detection effect (AC-1 toast)
- [ ] Wire i18n `paymentDeclined` key (phase-04 dependency)
- [ ] Verify line-380 clearCart is non-Stripe path; keep it
- [ ] Compile clean

## Success criteria (measurable)

- Cancel Stripe → land on /checkout, cart item count unchanged (localStorage intact).
- Exactly one BM toast shown; URL no longer contains `stripe_cancelled` after mount.
- Clicking Place Order again issues a fresh `POST /api/orders/stripe-checkout` (new session).
- No `clearCart()` executes on the Stripe-redirect path.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Removing wrong clearCart() breaks COD/BT (cart not cleared after order) | M×M | Only remove the Stripe-branch call; verify line-380 branch in diff |
| `useSearchParams` requires Suspense boundary in App Router | M×L | CheckoutClient is already a client component under a page; if build warns, wrap usage or read from `window.location` in effect |
| Double toast on Strict Mode double-mount (dev) | L×L | Param removed on first run → second run sees no param |

## Rollback

Revert the single-file diff on `CheckoutClient.tsx`. No schema, no API, no data migration. Zero cascade.

## Security

- No new endpoint. `stripe_cancelled` is a presence flag only — no trust placed in it beyond UI toast.

## Next

Independent of phase-02/03 at runtime. Needs phase-04 i18n key `ck.paymentDeclined` to exist (add key first or stub inline then swap).
