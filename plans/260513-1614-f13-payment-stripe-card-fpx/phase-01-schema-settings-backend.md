# Phase 01 — Schema + Settings Backend

> **Phase A.1** | **Status:** Ready | **Est:** S (4-6h) | **Owner:** Backend Dev
> **Blocks:** Phase 02, Phase 03
> **Parallel-safe với COD/QR work**

## Context

- Plan: [`plan.md`](./plan.md)
- Design: [`docs/design/F13-payment-gateway-design.md`](../../docs/design/F13-payment-gateway-design.md) §2.1, §8.5
- Schema rule: [`.claude/rules/database-schema.md`](../../.claude/rules/database-schema.md)

## Overview

Thêm 2 boolean fields `payment_card`, `payment_fpx` vào `tenants` collection. Extend `getPaymentSettings`/`updatePaymentSettings` actions để read/write 2 fields mới. DB migration via `scripts/db-setup.js`.

## Related code files

| File | Action |
|------|--------|
| `src/collections/Tenants.ts` | Edit — add 2 fields + hook validation |
| `src/app/(dashboard)/settings/payments/actions.ts` | Edit — extend types + functions |
| `scripts/db-setup.js` | Edit — append MIGRATIONS entry for 2 new columns |
| `src/__tests__/integration/payload-collection-schema.test.ts` | Edit — add assertions |
| `src/__tests__/unit/payment/` | Create — `payment-settings-actions.test.ts` |

## Implementation steps

### 1. Update `Tenants.ts` schema

Locate existing `payment_cod` field (line ~249). Add 2 new fields trong cùng group:

```typescript
{
  name: 'payment_card',
  type: 'checkbox',
  defaultValue: false,
  admin: { description: 'Enable Card payment via Stripe Checkout' },
  hooks: {
    beforeChange: [
      ({ value, siblingData }) => {
        // Auto-disable nếu Stripe Connect chưa onboard
        if (value && !siblingData.stripeOnboardingComplete) {
          return false
        }
        return value
      },
    ],
  },
},
{
  name: 'payment_fpx',
  type: 'checkbox',
  defaultValue: false,
  admin: { description: 'Enable FPX (Malaysia online banking) via Stripe Checkout' },
  hooks: {
    beforeChange: [
      ({ value, siblingData }) => {
        if (value && !siblingData.stripeOnboardingComplete) {
          return false
        }
        return value
      },
    ],
  },
},
```

### 2. Update DB migration (with backfill — D-02)

Append vào `scripts/db-setup.js` `MIGRATIONS` array (per `database-schema.md`):

```javascript
{
  name: '2026-05-13-add-tenant-payment-card-fpx',
  sql: `
    -- 1. Add new columns với default false
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_card BOOLEAN DEFAULT false;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_fpx BOOLEAN DEFAULT false;

    -- 2. Backfill — preserve behavior cũ (D-02):
    -- Tenants đã onboarded Stripe (chargesEnabled) → Card luôn enabled vì hardcode trước đây
    -- FPX giữ false → seller manual enable sau (FPX là new feature)
    UPDATE tenants
    SET payment_card = true
    WHERE stripe_onboarding_complete = true
      AND payment_card = false;
  `,
}
```

**Lý do backfill:** Trước F13, `stripe.ts:123` hardcode `payment_method_types: ['card', 'fpx']` → Card luôn enabled cho mọi tenant onboarded. Nếu không backfill, sau migration: existing tenants có `payment_card = false` → checkout reject 422 → **gián đoạn kinh doanh khách hàng đang sống**. Backfill `payment_card = true` cho onboarded tenants giữ hành vi cũ. FPX là feature mới → giữ false → seller chủ động enable.

### 3. Extend `actions.ts`

Find `PaymentUpdates` type. Add 2 fields:

```typescript
export type PaymentUpdates = {
  payment_cod?: boolean
  payment_qr?: boolean
  payment_card?: boolean  // NEW
  payment_fpx?: boolean   // NEW
  qr_image?: string | number | null
}
```

Update `getPaymentSettings` return shape to include new fields. Update `updatePaymentSettings` to persist. Reuse existing tenant lookup pattern.

### 4. Tests

- `payload-collection-schema.test.ts`: assert 2 new fields exist với correct type + defaultValue
- `payment-settings-actions.test.ts` (new): unit test cho `updatePaymentSettings({ payment_card: true })` + assert hook auto-disables nếu `stripeOnboardingComplete = false`

## Todo

- [ ] Edit `src/collections/Tenants.ts` — add `payment_card`, `payment_fpx` fields + hooks
- [ ] Edit `scripts/db-setup.js` — append migration entry
- [ ] Edit `src/app/(dashboard)/settings/payments/actions.ts` — extend `PaymentUpdates` + `getPaymentSettings` + `updatePaymentSettings`
- [ ] Edit `src/__tests__/integration/payload-collection-schema.test.ts` — assert new fields
- [ ] Create `src/__tests__/unit/payment/payment-settings-actions.test.ts`
- [ ] Run `npm run check-migrations` — verify CI gate passes
- [ ] Run `npm run test:unit src/__tests__/unit/payment/` — all green
- [ ] Manual: Payload admin UI shows 2 new toggles trong `tenants` collection

## Success criteria

- Migration runs idempotent (re-run = no error)
- New tenant rows default `payment_card = false`, `payment_fpx = false`
- Hook auto-disables nếu `stripeOnboardingComplete = false` (test cover)
- `getPaymentSettings()` returns 2 new fields
- `updatePaymentSettings({ payment_card: true })` persists + reads back correct
- `check-migrations.js` CI gate passes
- 0 regression trên existing `payment_cod`, `payment_qr`, `qr_image` (existing tests still pass)

## Risk

| Risk | Mitigation |
|------|-----------|
| Migration fails trên production DB | Use `IF NOT EXISTS` — idempotent; test trên staging trước |
| Hook breaks if `stripeOnboardingComplete` undefined trên old rows | Hook check `siblingData.stripeOnboardingComplete` (falsy → return false) — safe default |
| Backward compat trên `getPaymentSettings` callers | Return shape additive (new keys), existing keys untouched → 0 impact |

## Open questions

- Field naming convention: `payment_card` (snake_case match `payment_cod`) vs `paymentCard` (camelCase Payload convention)? Đề xuất `payment_card` để consistent với existing.

## Verify backfill khi merge

Sau migration trên staging, chạy assertion:
```sql
-- Should return 0 (zero existing onboarded tenants with payment_card = false)
SELECT COUNT(*) FROM tenants WHERE stripe_onboarding_complete = true AND payment_card = false;
```

## Next phase

Phase 02 + 03 can start parallel sau khi Phase 01 merge staging.
