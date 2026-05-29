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

- Pure functions are the highest-value unit targets: `computeDiscount` (math/clamping) +
  `validateDiscount` (bounds/date/uniqueness branches) + `resolveDiscount` (active/date/scope branches).
- Atomic redemption + checkout integration are harder to unit test (DB). Cover `computeDiscount` and the
  decision branches of `resolveDiscount` with mocked payload.find; cover the SQL conditional-increment
  shape with a focused test that asserts the WHERE clause logic (or an integration test if DB harness exists).
- Collection config test: assert slugs registered, tenant-scoped access present, usageCount readOnly,
  unique-per-tenant intent documented — mirrors `orders-config.test.ts`.
- Export route: test auth 401, tenant scoping, CSV escaping/formula-injection (reuse customers export test shape if present).

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
| TC-F33.15 | unit | redeemDiscount at limit | conditional UPDATE yields 0 rows → returns false (caller drops code, order proceeds full price — decision 2) |
| TC-F33.16 | unit | recordDiscountUsage placement-only + idempotent | no insert on admin update; no dup for same order (webhook re-fire safe) |
| TC-F33.17 | unit | Discounts collection config | slug registered, tenant access, usageCount readOnly |
| TC-F33.18 | unit | DiscountUsageHistory immutable | update/delete access → false |
| TC-F33.19 | unit | export route auth | 401 when unauthenticated |
| TC-F33.20 | unit | export CSV escaping | formula-injection prefix + CRLF strip |
| TC-F33.21 | unit | computeOrderTotal with discount | finalAmount = (subtotal − discount) + shipping + tax (decision 1: discount on subtotal, shipping/tax after) |
| TC-F33.22 | unit | computeOrderTotal no/zero discount | finalAmount = subtotal + shipping + tax (unchanged) |
| TC-F33.23 | unit | computeOrderTotal 100%-off | discountedSubtotal=0, finalAmount = shipping + tax, never negative |
| TC-F33.24 | unit | Stripe line-item rebuild sums to finalAmount | Σ(unit_amount×qty) == round(finalAmount*100), exact (remainder fixed on last line) |
| TC-F33.25 | unit | invalid/at-limit code → full price | route applies discountAmount=0, total=full, no snapshot fields, no usage row (decision 2) |

## Related code files

**Create**
- `docs/qa/F33-discount-cms.md` (TC table — owner QC, but planner stubs the IDs/scenarios above)
- `src/__tests__/unit/discounts/compute-discount.test.ts` (TC-F33.01–03)
- `src/__tests__/unit/discounts/validate-discount.test.ts` (TC-F33.04–09)
- `src/__tests__/unit/discounts/resolve-discount.test.ts` (TC-F33.10–14)
- `src/__tests__/unit/discounts/redeem-discount.test.ts` (TC-F33.15)
- `src/__tests__/unit/collections/discounts-config.test.ts` (TC-F33.16–18)
- `src/__tests__/unit/api/discounts-export.test.ts` (TC-F33.19–20)
- `src/__tests__/unit/orders/compute-total.test.ts` (TC-F33.21–23)
- `src/__tests__/unit/orders/stripe-discount-line-items.test.ts` (TC-F33.24) — Stripe line-item rebuild sums to finalAmount
- `src/__tests__/unit/discounts/discount-full-price-fallback.test.ts` (TC-F33.25) — invalid/at-limit → full price

**Modify:** none (tester owns test files only; reads impl, never edits — per orchestration rule)

## Implementation steps

1. Write `docs/qa/F33-discount-cms.md` with the matrix above (TC-ID, type, steps, expected).
2. Implement each test file: AAA, import functions from source, `vi.mock()` top-level for payload where needed.
3. Run `npm test` → 100% pass on new files. Fix code (not tests) if failures reveal real bugs.

## Todo

- [ ] docs/qa/F33-discount-cms.md created with TC-F33.01–20
- [ ] compute-discount.test.ts
- [ ] validate-discount.test.ts
- [ ] resolve-discount.test.ts
- [ ] redeem-discount.test.ts
- [ ] discounts-config.test.ts
- [ ] discounts-export.test.ts
- [ ] npm test green (existing customers-export tests still pass after Phase 04 refactor)

## Success criteria

- All TC-F33.* pass. No skipped/`.only`. No fake data. Existing suite unaffected (esp. customers export).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| DB-dependent logic hard to unit test | M×M | Mock payload.find / drizzle.execute; assert call args + branch behavior |
| Phase 04 helper extraction breaks customers tests | L×M | Run full suite; keep helpers byte-identical |

## Security considerations

- Tests assert tenant scoping + auth gates (TC-F33.13, TC-F33.19) — security is verified, not assumed.

## Next steps

Green tests unblock Phase 06 docs + code-reviewer + git-manager.
