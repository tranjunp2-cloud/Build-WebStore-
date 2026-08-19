---
title: "F40-08 coverage inventory"
created: 2026-08-18
---

# F40-08 coverage inventory

## Baseline

- `src/lib/admin/qa/target-registry.ts` has 67 active targets. Its `coverage` label is descriptive, not an execution authorization.
- `src/lib/admin/qa/targeted-smoke-registry.ts` has four executable Smoke packs only:
  - `editor-productgrid-variants` / `TC-F40-04-02`
  - `products-variants-inventory` / `TC-F09.64`
  - `order-payment-verification` / `TC-F10-06-41`
  - `storefront-discount-checkout` / `TC-F09.32`, `TC-F09.30`
- `src/app/api/e2e/targeted-smoke-fixture/route.ts` provisions only those product, checkout and bank-transfer fixtures.

## Priority-domain evidence

| Domain | Current state | Safe next step |
| --- | --- | --- |
| Checkout | Checkout pack is executable. Cart/product/tracking targets have no target-scoped fixture contract. | Certify one target only after an isolated fixture + true targeted Playwright spec. |
| Orders | Payment verification is executable. Refund, fulfilment, labels and stream have unit/API coverage but no executable target pack. | Candidate: refund/cancel after provider-neutral resettable fixture and browser assertion. |
| Settings & Payments | No executable pack. Existing Stripe/Xendit browser specs are skipped for missing tenant/auth fixtures. | Start with deterministic manual-payment settings; never use live provider credentials. |
| Critical | No machine-readable priority exists. | Matrix assigns QA-approved priority; do not infer it from filenames or `coverage`. |

## Non-negotiable admission rule

Each proposed row needs a QA owner approval and all of: `[x] AUTO` TC ID, actual source test, isolated/resettable fixture or test account, bounded duration, preflight/recovery instructions, matching registry and workflow entry. Failed gate stays `no-certified-pack`.

