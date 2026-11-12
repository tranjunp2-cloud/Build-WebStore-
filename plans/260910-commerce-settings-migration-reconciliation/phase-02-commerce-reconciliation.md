# Phase 02 — Commerce: Product, Order, Discount, Customer

## Overview

Priority P1. Đối soát toàn bộ lịch sử Commerce sau khi Phase 01 có mapping evidence.

## PW1 schema đã xác minh (read-only, 2026-09-10)

- **Products:** `products` → `product_skus`, `product_images`, `product_attributes`; gồm localized name/description, category/brand, package dimensions/weight, stock threshold, SKU price/cost/stock/status, image order và attribute values.
- **Orders:** `orders` → `order_details`, `order_status_histories`, shipping/billing `addresses`; gồm customer snapshot, provider/tracking, currency, invoice/delivery date, promotion, tất cả subtotal/discount/shipping/tax/prepaid/balance/total, payment/purchase/refund status và notes.
- **Discounts:** `promotions` → `promotion_product_skus` và `vouchers` → `voucher_product_skus`; gồm schedule, type/value, max/min/limit rules, usage và SKU applicability.
- **Customers:** `customers` + `addresses`; name/email/phone/note/rank và address fields. PII phải mask ở list UI.

Registry phải giữ source table/column cùng transform/compare rule cho mọi business field. `id`, foreign-key evidence và audit timestamps nằm trong section Audit có thể thu gọn; credential bị loại hoàn toàn.

## Requirements

### Product

- Compare presence, SKU, name, status, price, inventory, category, variants, media references.
- SKU is an investigation fallback only; official mapping decides pass/fail.

### Order

- Compare order number, customer linkage, item count/line items, quantity, unit price, subtotal, tax, shipping, total, currency, payment status, order status and created time.
- Apply an approved PW1→PW2 status/payment compatibility map.
- Reconcile aggregate count and money totals per status/date window; money compare uses fixed rounding policy.

### Discount

- Compare code, type, value, status, usage limit/count, starts/expires time and scope.
- Normalize code uppercase and Kuala Lumpur date boundaries before diff.

### Customer

- Compare presence, normalized email/phone, name, addresses, first/latest order, order count and spend if source provides it.
- Mask email/phone/address in list output; reveal only to permitted super-admin detail view.

## Related files

- Create: `src/lib/admin/qa/commerce-reconciliation.ts`
- Create: `src/lib/admin/qa/commerce-normalizers.ts`
- Modify: `src/app/api/qa/migration-reconciliation/route.ts`
- Reference: `src/collections/Products.ts`, `Orders.ts`, `Discounts.ts`, `Customers.ts`
- Add tests: `src/__tests__/unit/qa/f40-commerce-reconciliation.test.ts`
- Add E2E: `tests/f40-commerce-migration-reconciliation.spec.ts`
- Add TC mappings: `docs/qa/F40-qa-control-center.md`

## Implementation steps

1. Define typed field rules and normalizers per entity; keep status/currency mappings versioned in source.
2. Read only mapped PW1/PW2 records server-side and produce compact summary + detail DTOs.
3. Return paginated records with `match`, `missing`, `mismatch`, `duplicate`, `unverified` status and human-readable error message.
4. Compute per-entity totals and Order financial aggregates without exposing all records.
5. Add drill-down evidence: source ID, target ID, fields compared, normalizer/mapping rule used.
6. Add unit coverage for all status categories and E2E Case: missing, mismatch, duplicate, masked PII.

## Out of scope

- Auto-correct/auto-create target records.
- Treating a same SKU/email/order number as certification without mapping evidence.

## Todo

- [ ] Implement four entity reconcilers.
- [ ] Implement aggregate reconciliation.
- [ ] Add tests and F40 TC IDs.

## Success criteria

- Tester can isolate a failed Commerce record and see exactly what is missing/different.
- Financial mismatch is P0 and prevents migration pass.
