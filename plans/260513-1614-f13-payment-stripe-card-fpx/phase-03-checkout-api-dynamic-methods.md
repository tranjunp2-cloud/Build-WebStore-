# Phase 03 — Checkout API + Stripe Lib Dynamic Methods

> **Phase A.3** | **Status:** Ready after Phase 01 | **Est:** S (3-4h) | **Owner:** Backend Dev
> **Depends:** Phase 01 merged
> **Parallel với:** Phase 02

## Context

- Plan: [`plan.md`](./plan.md)
- Design: [`docs/design/F13-payment-gateway-design.md`](../../docs/design/F13-payment-gateway-design.md) §8.7
- Current state: `stripe.ts:123` hardcode `payment_method_types: ['card', 'fpx']`

## Overview

Refactor `createStripeCheckoutSession` để accept dynamic `paymentMethodTypes` từ caller. Update `/api/orders/create` để build array từ tenant settings (`payment_card`, `payment_fpx`) trước khi gọi Stripe. Validate: cả 2 OFF → reject 422 với clear error.

## Related code files

| File | Action |
|------|--------|
| `src/lib/payment/stripe.ts` | Edit — accept `paymentMethodTypes` param trong `CheckoutParams` |
| `src/lib/payment/types.ts` | Edit — extend `CheckoutParams` type |
| `src/app/api/orders/create/route.ts` | Edit — read tenant settings, build array, validate |
| `src/__tests__/unit/payment/stripe-connect.test.ts` | Edit — extend test cases |
| `src/__tests__/api/orders.test.ts` | Edit — assert dynamic methods |
| `src/__tests__/unit/payment/payment-method-builder.test.ts` | Create — pure function test |

## Implementation steps

### 1. Extend `CheckoutParams` type

`src/lib/payment/types.ts`:

```typescript
export type StripePaymentMethod = 'card' | 'fpx'

export type CheckoutParams = {
  // ... existing fields
  paymentMethodTypes: StripePaymentMethod[]  // NEW — required, non-empty
}
```

### 2. Update `createStripeCheckoutSession` (stripe.ts:107-161)

Replace hardcode line 123 `payment_method_types: ['card', 'fpx']` →

```typescript
payment_method_types: params.paymentMethodTypes,
```

Add validate ở đầu function:

```typescript
if (!params.paymentMethodTypes || params.paymentMethodTypes.length === 0) {
  throw new Error('At least one payment method type required')
}
```

### 3. Build helper trong `orders/create/route.ts`

Extract pure function `buildPaymentMethodTypes`:

```typescript
function buildPaymentMethodTypes(tenant: any): StripePaymentMethod[] {
  const methods: StripePaymentMethod[] = []
  if (tenant.payment_card) methods.push('card')
  if (tenant.payment_fpx) methods.push('fpx')
  return methods
}
```

Có thể tách ra `src/lib/payment/method-builder.ts` để test riêng (KISS — chỉ tách nếu reused).

### 4. Update `/api/orders/create/route.ts`

Trước khi gọi `createStripeCheckoutSession`:

```typescript
const paymentMethodTypes = buildPaymentMethodTypes(tenant)

if (paymentMethodTypes.length === 0) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'NO_PAYMENT_METHODS',
        message: 'Seller has not enabled Card or FPX. Please contact seller.',
      },
    },
    { status: 422 }
  )
}

const checkout = await createStripeCheckoutSession({
  // ... existing params
  paymentMethodTypes,
})
```

### 5. Update existing tests

`stripe-connect.test.ts`:
- Test `createStripeCheckoutSession` với `paymentMethodTypes: ['card']` → Stripe API called với 1 method
- Test với `paymentMethodTypes: ['card', 'fpx']` → 2 methods
- Test với empty array → throws

`orders.test.ts`:
- Mock tenant với `payment_card: true, payment_fpx: false` → assert Stripe called với `['card']`
- Mock tenant với both `false` → assert 422 response với `NO_PAYMENT_METHODS` code
- Mock tenant với both `true` → assert `['card', 'fpx']`

### 6. New unit test — `payment-method-builder.test.ts`

```typescript
import { buildPaymentMethodTypes } from '@/app/api/orders/create/route' // or extracted lib

describe('buildPaymentMethodTypes', () => {
  it('returns [card] when only card enabled', () => {
    expect(buildPaymentMethodTypes({ payment_card: true, payment_fpx: false }))
      .toEqual(['card'])
  })
  it('returns [fpx] when only fpx enabled', () => {
    expect(buildPaymentMethodTypes({ payment_card: false, payment_fpx: true }))
      .toEqual(['fpx'])
  })
  it('returns [card, fpx] when both enabled', () => {
    expect(buildPaymentMethodTypes({ payment_card: true, payment_fpx: true }))
      .toEqual(['card', 'fpx'])
  })
  it('returns [] when both disabled', () => {
    expect(buildPaymentMethodTypes({ payment_card: false, payment_fpx: false }))
      .toEqual([])
  })
})
```

## Todo

- [ ] Extend `CheckoutParams` type với `paymentMethodTypes`
- [ ] Replace hardcode trong `stripe.ts:123` — use dynamic param
- [ ] Add validate empty array — throw early
- [ ] Create `buildPaymentMethodTypes` helper trong `orders/create/route.ts`
- [ ] Pre-check ở `/api/orders/create` — return 422 nếu empty
- [ ] Update `stripe-connect.test.ts` — 3 new cases
- [ ] Update `orders.test.ts` — 3 new cases (card-only, fpx-only, both-off-422)
- [ ] Create `payment-method-builder.test.ts` — 4 cases
- [ ] Run `npm run test:unit` + `npm run test:api` — all green
- [ ] Manual: hit `/api/orders/create` với tenant card-only → verify Stripe Checkout Session params

## Success criteria

- `payment_method_types` array dynamic theo tenant settings (verify qua Stripe Dashboard request logs hoặc test mock)
- Tenant với cả 2 OFF → API returns 422 `NO_PAYMENT_METHODS` (không gọi Stripe)
- Tenant card-only → Stripe Checkout shows ONLY Card (verify manual qua sandbox)
- Tenant fpx-only → Stripe Checkout shows ONLY FPX
- 0 regression trên existing flows (card + fpx default both enabled = previous behavior)
- All tests pass

## Risk

| Risk | Mitigation |
|------|-----------|
| Existing tenants chưa có `payment_card`/`payment_fpx` fields → default false → break checkout | **Phase 01 migration backfills `payment_card = true` cho onboarded tenants (D-02)** — 0 disruption khách hàng đang dùng |
| Stripe Connect failure (transient) → false `chargesEnabled` → API rejects valid request | Pre-check chỉ dựa trên tenant.payment_card / payment_fpx (đã hook validation Phase 01); không double-check Stripe Connect runtime trừ khi cần |
| Type error nếu caller quên pass `paymentMethodTypes` | Make required (không optional) trong type → compile-time error |

## Open questions (resolved)

1. ~~Backfill existing tenants?~~ → **D-02:** SET `payment_card = true` cho tenants có `stripeOnboardingComplete = true`; FPX default `false`. Implementation ở Phase 01 migration SQL.
2. ~~`payment-method-builder.ts` extraction?~~ → Extract sang `src/lib/payment/method-builder.ts` để Phase 04 storefront cũng reuse (render dynamic label "Pay with Stripe (Card · FPX)" theo settings).

## Next phase

Phase 04 (storefront) — HOLD until COD/QR storefront merge staging.
