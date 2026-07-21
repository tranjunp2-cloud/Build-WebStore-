# Phase 04 — Tests and QA

## Context links

- Parent: [plan.md](plan.md)
- Test convention: `docs/TEST_CONVENTION.md`
- QA source: `docs/qa/F09-storefront-commerce.md` (TC-F09.57)

## Overview

| Field | Value |
| --- | --- |
| Date | 2026-07-20 |
| Description | Prove current product data reaches cart/checkout before payment |
| Priority | P1 |
| Implementation status | completed with follow-ups |
| Review status | completed with follow-ups |

## Key insights

- TC-F09.57 is already `[x] AUTO` but lacks the required cart-refresh scenario; update its implementation reference and add coverage.
- New API route requires E2E under repository review rules.

## Requirements

- All tests use real source imports, top-level mocks, AAA, and a TC-F09 ID.
- Test base and variant current price/stock; changed name/image; inactive/deleted/missing variant; quantity clamp; route validation, tenant/site isolation, custom-domain tenant resolution, legacy-key clear, site activation, stale-response race protection and strict resolver-failure checkout guard.
- Browser test: add, change product in controlled setup, open cart or checkout, assert price/info alert and updated total before payment.

## Architecture

`API tests → store tests → component/checkout tests → Playwright happy and unavailable flows`.

## Related code files

- `src/__tests__/api/storefront-products.test.ts`
- `src/__tests__/unit/stores/cartStore.test.ts`
- `src/__tests__/unit/storefront/cart-drawer-checkout.test.tsx`
- `tests/checkout-stripe-cancel.spec.ts`
- `docs/qa/F09-storefront-commerce.md`

## Implementation steps

1. Add/extend TC-F09.57 and companion cases in QA doc before test code.
2. Add resolver API tests: validation/rate-limit shape, batch query, filters/whitelist, normal-slug and custom-domain site binding, base/variant/unavailable/change responses. Add regressions proving the shared helper leaves checkout results unchanged.
3. Extend cart store tests: site activation at every entry point, update snapshots, clamp quantity, unavailable state, site-keyed storage + legacy-key clear, `cartRevision`, shared in-flight refresh and response-generation/signature race safety.
4. Add drawer/checkout component tests for pending, changed, unavailable, retry and strict CTA states: failure blocks Place Order until the exact current signature resolves successfully.
5. Assert a zero-priced or fully discounted quantity clamp still increments `cartRevision` and causes a shipping re-quote.
6. Add Playwright test for seller update → cart/checkout reconciliation and one unavailable variant scenario; use an isolated fixture/seed path for the seller mutation.
7. Run focused Vitest, full relevant suite, typecheck and E2E according to environment availability.

## Todo list

- [x] API and store tests
- [x] Drawer UI tests
- [x] Typecheck and targeted verification
- [ ] QA mapping update: retain TC-F09.57 as the source case and add the completed implementation references when QA documentation is next revised
- [ ] CheckoutClient focused component fixture/test: deferred because the component requires extensive brittle mocks; source guard was verified through focused flow/store tests
- [ ] E2E regression: explicitly declined by user; requires isolated seller/site/product fixture before Playwright coverage is added

## Success criteria

- TC-F09.57 asserts displayed current DB price, not only server final price; custom-domain, stale-response and resolver-failure paths cannot silently show a false fresh-cart state or proceed to payment.
- Tests prove no client-provided price can become authoritative.
- New endpoint has browser-flow coverage.

## Risk assessment

- E2E product mutation needs an isolated seed/setup path; avoid coupling to shared staging data.

## Security considerations

- Include explicit cross-site lookup and response-whitelist assertions.

## Next steps

Follow up only when E2E is authorized or a reusable CheckoutClient fixture exists.

## Completion record

- Completed 2026-07-20: 58/58 focused Vitest tests passed, covering resolver API/line rules, store reconciliation races and drawer feedback. The shared checkout resolver regression remains covered.
- Repository typecheck was run; the only failures are two pre-existing missing packages (`country-flag-icons/react/3x2` and `@aws-sdk/s3-presigned-post`), unrelated to this work.
- Playwright E2E is intentionally not implemented by user direction. Direct CheckoutClient component coverage is also deferred pending a reusable fixture; do not treat either as passed coverage.
- Review-finding regressions cover durable pending changes across a later no-change refresh, multi-line change merging, acknowledgement-only clearing, unavailable subtotal/CTA behavior, and active-request promise identity after site switching. The Playwright E2E exception remains unchanged.
