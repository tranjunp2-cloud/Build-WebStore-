# Phase 04 — Storefront Checkout Integration

> **Phase B** | **Status:** 🔴 HOLD — wait COD/QR storefront PR merge staging
> **Est:** M (6-8h) | **Owner:** Frontend Dev
> **Depends:** Phase 01-03 done + COD/QR storefront merged

## Why HOLD

`src/app/sites/[slug]/checkout/page.tsx` is **HIGH conflict risk** — COD/QR team đang Phase 1 active edit. Per Hướng C strategy: F13 storefront integration HOLD đến khi COD/QR PR merge staging, then Phase 04 release.

**Gate condition:** COD/QR storefront PR merged + Phase 01-03 deployed staging + 0 regression confirmed.

## Context

- Plan: [`plan.md`](./plan.md)
- Design: [`docs/design/F13-payment-gateway-design.md`](../../docs/design/F13-payment-gateway-design.md) §2.2 (B.1, B.2, B.4)
- Stories: US-F13-01 (FPX happy path), US-F13-03 (Mobile UX)

## Overview

Thêm "Pay with Stripe" option vào storefront checkout method RadioGroup. Click "Place Order" với Stripe selected → POST `/api/orders/create` → backend tạo Stripe Checkout Session → client redirect `window.location.href = url`. Stripe page handles Card/FPX/3D Secure/receipt. Return: `success_url` → confirmation; `cancel_url` → BM toast + cart preserved.

## Related code files

| File | Action |
|------|--------|
| `src/app/sites/[slug]/checkout/page.tsx` | Edit — extend type, add Stripe radio, redirect logic, return handlers |
| `src/i18n/locales/en.json`, `ms.json` | Edit — add Stripe row labels, redirect copy, BM error |
| `src/__tests__/integration/checkout-flow.test.tsx` | Edit/create — assert Stripe redirect flow |

## Implementation steps

### 1. Extend type union (line 51)

```typescript
// Before:
const [paymentMethod, setPaymentMethod] = useState<'cod' | 'qr_banking'>('cod')

// After:
const [paymentMethod, setPaymentMethod] = useState<'cod' | 'qr_banking' | 'stripe' | null>(null)
```

Default `null` (no method pre-selected) — UX clearer than auto-COD.

### 2. Fetch tenant payment settings

Add lookup ở component mount (existing site fetch logic):

```typescript
const stripeAvailable = (tenant.payment_card || tenant.payment_fpx) && tenant.stripeOnboardingComplete

const stripeLabel = useMemo(() => {
  if (tenant.payment_card && tenant.payment_fpx) return 'Pay with Stripe (Card · FPX)'
  if (tenant.payment_card) return 'Pay with Card'
  if (tenant.payment_fpx) return 'Pay with FPX (Online Banking)'
  return null
}, [tenant.payment_card, tenant.payment_fpx])
```

### 3. Add Stripe radio row

Insert TRƯỚC COD row (line ~384, theo §8.7 design priority order):

```jsx
{stripeAvailable && (
  <label style={{...}} onClick={() => setPaymentMethod('stripe')}>
    <div className="radio" />
    <CreditCard /> {stripeLabel}
    <small>🔒 Secured by Stripe</small>
  </label>
)}
```

Style match existing COD/QR rows (currently inline styles line 384-440). Mobile: ≥ 54px height (FR-08).

### 4. Submit logic — branch on method

Existing submit handler (~line 140-180) calls `/api/orders/checkout` (manual). Add branch:

```typescript
const handlePlaceOrder = async () => {
  if (paymentMethod === 'stripe') {
    // Show full-page redirect overlay
    setRedirectingToStripe(true)

    const res = await fetch('/api/orders/create', {
      method: 'POST',
      body: JSON.stringify({ siteId, items, customer, /* no paymentMethod field — Stripe path */ }),
    })

    if (!res.ok) {
      const err = await res.json()
      if (err.error?.code === 'NO_PAYMENT_METHODS') {
        toast.error(t.checkout.noPaymentMethods)
      } else {
        toast.error(t.checkout.failedToStartPayment)
      }
      setRedirectingToStripe(false)
      return
    }

    const { url } = await res.json()
    window.location.href = url  // Redirect ra Stripe Checkout
    // Component unmounts khi navigate; overlay vẫn hiện đến lúc unmount
  } else {
    // Existing COD/QR flow
    // ... unchanged
  }
}
```

### 5. Redirect overlay

Add new state + render full-page Dialog:

```jsx
{redirectingToStripe && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ background: 'white', padding: 32, borderRadius: 16, textAlign: 'center' }}>
      <StripeLogo />
      <Spinner />
      <h3>{t.checkout.redirectingToStripe}</h3>
      <p>{t.checkout.dontCloseWindow}</p>
    </div>
  </div>
)}
```

### 6. Return handlers (success_url + cancel_url)

- `success_url`: `/sites/[slug]/orders/[id]/confirmation?session_id={CHECKOUT_SESSION_ID}` — handled by F10 confirmation page (existing). No code in checkout.
- `cancel_url`: `/sites/[slug]/checkout?stripe_cancelled=1` — checkout page reads query param:

```typescript
useEffect(() => {
  if (searchParams.get('stripe_cancelled') === '1') {
    toast.error('Pembayaran gagal. Sila cuba lagi.', { duration: 5000 })
    // Cart preserved (already in cart context — không cần làm gì thêm)
    // Strip URL param sau khi toast
    router.replace('/sites/[slug]/checkout')
  }
}, [searchParams])
```

### 7. Both-payment-OFF — hide Stripe row

Nếu `stripeAvailable = false` → KHÔNG render Stripe row. Buyer chỉ thấy COD + QR. KISS — no fallback message needed; seller có thể test với COD/QR.

### 8. i18n strings

`en.json` + `ms.json` dưới `checkout`:

```json
{
  "stripeRowLabel": {
    "both": "Pay with Stripe (Card · FPX)",
    "card": "Pay with Card",
    "fpx": "Pay with FPX (Online Banking)"
  },
  "stripeSecured": "Secured by Stripe",
  "redirectingToStripe": "Redirecting to Stripe Checkout",
  "dontCloseWindow": "Please don't close this window.",
  "stripeCancelled": "Pembayaran gagal. Sila cuba lagi.",
  "failedToStartPayment": "Failed to start payment. Please try again.",
  "noPaymentMethods": "Payment temporarily unavailable. Please use COD or QR."
}
```

### 9. Tests

`checkout-flow.test.tsx`:
- Render với tenant card-only → assert "Pay with Card" row visible
- Render với tenant both-OFF → assert NO Stripe row
- Select Stripe → click Place Order → assert `fetch('/api/orders/create')` called + `window.location.href` set
- Return với `?stripe_cancelled=1` → assert toast BM visible

## Todo

- [ ] Extend `paymentMethod` union type
- [ ] Fetch tenant payment settings + compute `stripeAvailable` + `stripeLabel`
- [ ] Add Stripe radio row trong RadioGroup
- [ ] Refactor `handlePlaceOrder` — branch on `'stripe'` path
- [ ] Add `redirectingToStripe` state + full-page overlay
- [ ] Add cancel return handler — read `?stripe_cancelled=1` query → toast BM
- [ ] Update i18n en.json + ms.json (8 new strings + BM)
- [ ] Update/create `checkout-flow.test.tsx` — 4+ cases
- [ ] Manual QA: full Stripe sandbox happy path (Card test 4242) + FPX test bank
- [ ] Manual QA: cancel return → cart preserved + toast BM
- [ ] Mobile 375px: 54px hitbox, sticky Place Order, overlay full-screen

## Success criteria

- Buyer thấy "Pay with Stripe" row khi tenant có Card hoặc FPX enabled
- Label dynamic theo settings (Card / FPX / both)
- Click "Place Order" với Stripe → redirect `checkout.stripe.com/...`
- Cancel return → toast BM "Pembayaran gagal. Sila cuba lagi." + cart preserved
- Success return → land confirmation page với order status `new`
- Mobile 375px: hit area ≥ 54px (FR-08), overlay full-screen
- 0 regression trên COD/QR flows

## Risk

| Risk | Mitigation |
|------|-----------|
| Browser block window.location redirect (rare popup blocker?) | Use button-click handler (user gesture) — không block; verify trên Safari/Chrome |
| Cart state mất khi return từ Stripe | Cart context (localStorage hoặc context provider) persist; verify cart vẫn còn sau redirect |
| `success_url` query parsing fail F10 confirmation | Test với real Stripe session — F10 đã wire `?session_id=` parsing? Verify trước khi merge |
| Stripe Connect chưa onboard → `/api/orders/create` returns 422 ở runtime | Phase 02 đã prevent toggle khi `stripeOnboardingComplete = false` — defense-in-depth ở Phase 04 chỉ hide row |

## Open questions

1. **Cart persistence:** Sau cancel redirect, cart state có giữ trong localStorage / context không? Cần verify để confirm FR-05.
2. **Mobile sticky bottom button:** Current code đã có sticky pattern cho COD/QR chưa? Nếu chưa → Phase 04 add (consistent với F14 shipping mobile checkout pattern).
3. **Place Order button label:** Static "Place Order" hay dynamic "Pay with Stripe — RM 61" khi Stripe selected? Nice-to-have, không cần thiết Wave 6.
4. **Analytics tracking:** Có cần fire event khi user click Pay with Stripe vs COD/QR? Defer Wave 7.

## Gate checklist before starting

- [ ] COD/QR storefront PR merged staging (verify với QC)
- [ ] Phase 01 + 02 + 03 deployed staging
- [ ] Manual QA Phase A: COD/QR flows still working (regression check)
- [ ] Stripe sandbox account ready (test cards + FPX test banks documented)
- [ ] `/dashboard/settings/payments/connect` UI page accessible (or onboard flow tested)

## Next steps after Phase 04

- E2E test với Playwright (real Stripe sandbox session)
- Production rollout: enable Card + FPX cho 1-2 pilot tenants trước, monitor 1 tuần
- Wave 7: Payment Element migration (nếu PM muốn inline UX)
