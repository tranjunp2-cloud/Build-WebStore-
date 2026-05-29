# Phase 05 — Tests

**Priority:** P1 · **Status:** pending · **Effort:** 4h · **Blocks on:** 01–04

Unit tests for all pure/business logic + collection config, mapped to TC-IDs in a new
`docs/qa/F33-discount-cms.md`. Per `.claude/rules/testing.md`: every test references a TC-ID, AAA,
import from source (never re-implement), no fake data to pass CI.

## Context links

- Convention: `docs/TEST_CONVENTION.md`, `.claude/rules/testing.md`
- Pattern: `src/__tests__/unit/collections/orders-collection.test.ts`, `orders-config.test.ts`
- TC-ID style: `TC-F33.NN` (see existing `docs/qa/F10-orders-management.md`)

## Key insights

- Pure functions are the highest-value unit targets: `computeDiscount` (math/clamping), `computeOrderTotal`,
  `validateDiscount` (bounds/date/uniqueness + date-normalize branches) + `resolveDiscount`
  (active/date/scope/**limit** branches + end-of-day boundary).
- **Redemption is now history-driven, not a conditional UPDATE.** Test `recordDiscountRedemption` against
  mocked `drizzle.execute`: assert `INSERT ... ON CONFLICT (order_id) DO NOTHING` runs first, and the
  `usage_count + 1` UPDATE fires ONLY when a row was returned. The reconciliation invariant
  `usage_count == COUNT(history)` is the key assertion (gaps B/D).
- **Gap A is the most important new coverage and it lives in the webhook, not a hook.** Test
  `checkout-completed.ts`: redeems exactly once after the atomic `pending→new` transition; a re-delivered
  event redeems nothing more; an abandoned session (no event) / `payment_failed` redeems nothing. Test that
  `stripe-checkout/route.ts` does NOT redeem at session creation. Mock `payload` + `drizzle.execute`.
- Collection config test: assert slugs registered, tenant-scoped access present, usageCount readOnly,
  `access.delete: false` (soft-delete — decision J), unique-per-tenant intent — mirrors `orders-config.test.ts`.
- Export route: test auth 401, tenant scoping, CSV escaping/formula-injection (reuse customers export test shape if present).
- Date tests must pin the timezone (Asia/Kuala_Lumpur) explicitly — never assert against the runner's local tz (CI is UTC).

## Test matrix

| TC-ID | Layer | Scenario | Asserts |
|-------|-------|----------|---------|
| TC-F33.01 | unit | computeDiscount percentage | round(subtotal*pct/100), clamp ≤ subtotal |
| TC-F33.02 | unit | computeDiscount fixed | min(value, subtotal), ≥0 |
| TC-F33.03 | unit | computeDiscount 100% | == subtotal, total never negative |
| TC-F33.04 | unit | validateDiscount percentage >100 | throws |
| TC-F33.05 | unit | validateDiscount fixed <0 | throws |
| TC-F33.06 | unit | validateDiscount startsAt>=expiresAt | throws |
| TC-F33.07 | unit | validateDiscount code normalized upper/trim | data.code uppercased |
| TC-F33.08 | unit | validateDiscount dup code same tenant | throws (find returns hit) |
| TC-F33.09 | unit | validateDiscount same code other tenant | passes (find empty) |
| TC-F33.10 | unit | resolveDiscount inactive | returns null (silent reject — decision 2) |
| TC-F33.11 | unit | resolveDiscount expired (now>expiresAt) | returns null |
| TC-F33.12 | unit | resolveDiscount not-yet-started | returns null |
| TC-F33.13 | unit | resolveDiscount wrong tenant/site | returns null |
| TC-F33.14 | unit | resolveDiscount valid | returns discount |
| TC-F33.15 | unit | recordDiscountRedemption happy path | INSERT history row + `usage_count +1` once |
| TC-F33.16 | unit | recordDiscountRedemption idempotent | re-fire same `order_id` → `ON CONFLICT DO NOTHING` → still 1 row, no double increment (webhook re-delivery / admin re-save safe — gap B) |
| TC-F33.17 | unit | Discounts collection config | slug registered, tenant access, usageCount readOnly |
| TC-F33.18 | unit | DiscountUsageHistory immutable | update/delete access → false |
| TC-F33.19 | unit | export route auth | 401 when unauthenticated |
| TC-F33.20 | unit | export CSV escaping | formula-injection prefix + CRLF strip |
| TC-F33.21 | unit | computeOrderTotal with discount | finalAmount = (subtotal − discount) + shipping + tax (decision 1: discount on subtotal, shipping/tax after) |
| TC-F33.22 | unit | computeOrderTotal no/zero discount | finalAmount = subtotal + shipping + tax (unchanged) |
| TC-F33.23 | unit | computeOrderTotal 100%-off | discountedSubtotal=0, finalAmount = shipping + tax, never negative |
| TC-F33.24 | unit | Stripe line-item rebuild sums to finalAmount | Σ(unit_amount×qty) == round(finalAmount*100), exact (remainder fixed on last line) |
| TC-F33.25 | unit | invalid/at-limit code → full price | route applies discountAmount=0, total=full, no snapshot fields, no usage row (decision 2) |
| TC-F33.26 | unit | resolveDiscount at usageLimit | `usage_count >= usage_limit` → returns null (limit enforced at RESOLVE, not redeem — gap A) |
| TC-F33.27 | unit | recordDiscountRedemption keeps invariant | after N redemptions `usage_count == COUNT(history rows)`; increment only when a row was inserted (gap D) |
| TC-F33.28 | unit | COD redeems AFTER create | redemption helper not called when `payload.create` throws → no leak (gap C) |
| TC-F33.29 | unit | COD redeem only when discountAmount>0 | 0-value discount → no history row, no usage burned (gap D) |
| TC-F33.30 | unit | Stripe route does NOT redeem at session creation | pending order has snapshot; `usage_count` unchanged until webhook (gap A) |
| TC-F33.31 | unit | checkout-completed redeems once on pending→new | after atomic transition wins → exactly 1 redemption; re-delivery → still 1 (gaps A+B) |
| TC-F33.32 | unit | abandoned / payment_failed Stripe → no redemption | no webhook (or payment_failed) → `usage_count` unchanged, no history (gap A) |
| TC-F33.33 | unit | Stripe confirmation email shows discount line | checkout-completed passes `discountCode`/`discountAmount` → email contains "Discount (CODE) −RM X" (gap F) |
| TC-F33.34 | unit | validateDiscount normalizes dates | `startsAt → start-of-day`, `expiresAt → end-of-day` in Asia/Kuala_Lumpur (gap H) |
| TC-F33.35 | unit | resolveDiscount end-of-day boundary | `now` at 23:59 on expiry date → valid; 00:00 next day → null (gap H) |
| TC-F33.36 | unit | Stripe line-items rebuild safety | no line `unit_amount < 0`; `order.items[].unitPrice` preserved (original, not scaled) (gap I) |

## Related code files

**Create**
- `docs/qa/F33-discount-cms.md` (TC table — owner QC, but planner stubs the IDs/scenarios above)
- `src/__tests__/unit/discounts/compute-discount.test.ts` (TC-F33.01–03)
- `src/__tests__/unit/discounts/validate-discount.test.ts` (TC-F33.04–09, **34** date-normalize)
- `src/__tests__/unit/discounts/resolve-discount.test.ts` (TC-F33.10–14, **26** at-limit, **35** end-of-day boundary)
- `src/__tests__/unit/discounts/redeem-and-record.test.ts` (TC-F33.15–16, **27–29** invariant/after-create/zero-skip) — renamed from redeem-discount (helper is now `recordDiscountRedemption`)
- `src/__tests__/unit/collections/discounts-config.test.ts` (TC-F33.17–18)
- `src/__tests__/unit/api/discounts-export.test.ts` (TC-F33.19–20)
- `src/__tests__/unit/orders/compute-total.test.ts` (TC-F33.21–23)
- `src/__tests__/unit/orders/stripe-discount-line-items.test.ts` (TC-F33.24, **36** no-negative + unitPrice preserved)
- `src/__tests__/unit/discounts/discount-full-price-fallback.test.ts` (TC-F33.25)
- `src/__tests__/unit/discounts/stripe-checkout-no-redeem.test.ts` (TC-F33.30) — pending order snapshots, no increment
- `src/__tests__/unit/webhooks/stripe-checkout-completed-discount.test.ts` (TC-F33.31–33) — redeem-on-confirm, idempotent re-delivery, abandoned/failed no-op, email discount line

**Modify:** none (tester owns test files only; reads impl, never edits — per orchestration rule)

## Implementation steps

1. Write `docs/qa/F33-discount-cms.md` with the matrix above (TC-ID, type, steps, expected).
2. Implement each test file: AAA, import functions from source, `vi.mock()` top-level for payload where needed.
3. Run `npm test` → 100% pass on new files. Fix code (not tests) if failures reveal real bugs.

## Todo

- [ ] docs/qa/F33-discount-cms.md created with TC-F33.01–36
- [ ] compute-discount.test.ts
- [ ] validate-discount.test.ts (incl. date-normalize TC-F33.34)
- [ ] resolve-discount.test.ts (incl. at-limit TC-F33.26 + end-of-day TC-F33.35)
- [ ] redeem-and-record.test.ts (TC-F33.15–16, 27–29 — history-driven + idempotent + invariant)
- [ ] compute-total.test.ts (TC-F33.21–23)
- [ ] stripe-discount-line-items.test.ts (TC-F33.24, 36)
- [ ] stripe-checkout-no-redeem.test.ts (TC-F33.30)
- [ ] **stripe-checkout-completed-discount.test.ts (TC-F33.31–33 — gap A redeem-on-confirm + gap F email)**
- [ ] discounts-config.test.ts
- [ ] discounts-export.test.ts
- [ ] npm test green (existing customers-export tests still pass after Phase 04 refactor)

## Success criteria

- All TC-F33.01–36 pass. No skipped/`.only`. No fake data. Existing suite unaffected (esp. customers export).
- Gap regressions explicitly covered: Stripe never redeems pre-payment (A), idempotent on re-delivery (B),
  no leak on create-fail (C), no usage burned at 0-value (D), Stripe email shows discount (F),
  expiry valid through end-of-day in store tz (H), no negative Stripe line + unitPrice preserved (I).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| DB-dependent logic hard to unit test | M×M | Mock payload.find / drizzle.execute; assert call args + branch behavior |
| Phase 04 helper extraction breaks customers tests | L×M | Run full suite; keep helpers byte-identical |
| Webhook redemption (gap A) hard to unit test | M×M | Mock `payload` + `drizzle.execute` in checkout-completed; drive the pending→new path + a re-delivery + a no-event case; assert redemption call count (0/1/1) |
| Date tests flaky across CI tz | M×M | Pin Asia/Kuala_Lumpur explicitly; never use runner-local `new Date()` in assertions |

## Security considerations

- Tests assert tenant scoping + auth gates (TC-F33.13, TC-F33.19) — security is verified, not assumed.

## Next steps

Green tests unblock Phase 06 docs + code-reviewer + git-manager.
