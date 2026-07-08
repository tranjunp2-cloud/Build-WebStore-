# Phase 06 — i18n (en+ms) + tests

**Priority:** P1 | **Status:** pending | **AC:** all | **TC:** TC-F13.143/145/146/150/152/155/156/157 | **Effort:** 1h
**Depends:** 03, 04, 05

## Overview
Add en+ms strings for new UI (oversell badge, confirm self-heal states if any). Write/extend tests mapping
each AC to its TC-ID. Import logic from source — never re-implement (per testing.md).

## Related code files
- MODIFY `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` — oversell badge / refund warning text
- CREATE/MODIFY tests (own test files only; read impl, never edit):
  - `src/__tests__/unit/payment/reconcile-order-paid.test.ts` (NEW) — TC-143 idempotency, TC-145 oversell
  - `src/__tests__/api/orders-payment-status.test.ts` (NEW) — TC-150/152 endpoint + ct_ auth
  - `src/__tests__/api/cron-reconcile-orders.test.ts` (NEW) — TC-155 heal, TC-156 stale + CRON_SECRET 401
  - `src/__tests__/api/orders-refund.test.ts` (EXTEND) — TC-146 oversellReview refundable + flag clear
  - existing `stripe-webhook.test.ts` (regression — must still pass after phase 02 refactor)

## i18n keys (en/ms, mirror existing dashboard.orders structure)
- `dashboard.orders.oversellReview.badge` — "Stock oversold" / "Stok terlebih jual"
- `dashboard.orders.oversellReview.warning` — explains why refund offered
- (confirm page self-heal reuses existing "Verifying payment…" strings — no new keys unless UI added)

## Test matrix
| TC | Type | What | Mock |
|----|------|------|------|
| TC-143 | unit | reconcile twice → 2nd already_processed, no dup stock/email | payload db execute returns 0 rows on 2nd |
| TC-145 | unit | oversell → flag true, SYSTEM_ALERT, stays new/paid, no refund | stock RETURNING oversold=true |
| TC-146 | api | flagged order refundable, flag cleared after refund | mock Stripe refund |
| TC-150 | api/integration | confirm heal path (endpoint reconciles, status flips) | Stripe session paid |
| TC-152 | api | payment-status self-heal pending→paid; ct_ auth 401 | session paid / bad cookie |
| TC-155 | api | cron heals paid pending order | session paid |
| TC-156 | api | cron stale>24h→cancelled; no CRON_SECRET→401 | session expired / 24h old |
| TC-157 | schema/CI | check-migrations passes (phase 01) | — |

## Todo
- [ ] en.json + ms.json oversell keys (parity check both files)
- [ ] reconcile-order-paid.test.ts (TC-143, 145)
- [ ] orders-payment-status.test.ts (TC-150, 152)
- [ ] cron-reconcile-orders.test.ts (TC-155, 156)
- [ ] extend orders-refund.test.ts (TC-146)
- [ ] `npm test` — 100% pass incl. regression stripe-webhook.test.ts

## Success criteria
- All listed TCs GREEN; existing webhook/refund tests still pass (no regression from phase 02 refactor).
- en/ms key parity (no missing translation in either locale).
- No fake data / mocks-to-pass-CI; tests import from source modules.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Phase 02 refactor breaks existing webhook tests | Med×High | run stripe-webhook.test.ts FIRST as regression gate |
| Mocking Stripe session shape wrong | Med×Med | reuse fixtures from existing stripe-webhook/refund tests |
| en/ms drift | Low×Low | grep both files for new keys before done |

## Rollback
Revert i18n + delete new test files. No runtime impact.

## Next
Hand to code-reviewer → docs-manager (update docs/qa/F13 TC statuses, docs/architecture/F13) → git-manager.
