# Phase 04 — i18n strings + tests

## Context

Shared dependency for phases 01–03 (UI strings) + test coverage for all four ACs.
Files: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`, `src/__tests__/**`.

## Priority / status

P2 · pending · ~1.5h. i18n keys block 01/02/03 UI; tests run after 01–03 land.

## i18n keys

Existing (verified): `storefront.checkout.payNow` = "Pay Now — " (price-suffix button on checkout — DO NOT reuse for tracking CTA; semantics differ). `storefront.checkout.networkError`, `storefront.confirmPage.*` exist.

Add NEW keys (en + ms, mirror nesting exactly in both files):

| Path | en | ms | Used by |
|------|----|----|---------|
| `storefront.checkout.paymentDeclined` | "Payment declined. Please try again." | "Pembayaran gagal. Sila cuba lagi." | phase-01 (AC-1 toast) |
| `storefront.confirmPage.verifyingPayment` | "Verifying your payment…" | "Mengesahkan pembayaran anda…" | phase-02 (AC-2 skeleton) |
| `storefront.confirmPage.verifyingHint` | "This can take a few seconds. You can also check My Orders." | "Ini mungkin mengambil masa beberapa saat. Anda juga boleh semak Pesanan Saya." | phase-02 (long-wait hint) |
| `storefront.orderTracking.payNow` | "Pay Now" | "Bayar Sekarang" | phase-03 (AC-3 CTA) |
| `storefront.orderTracking.retryError` | "Could not start payment. Please try again." | "Tidak dapat memulakan pembayaran. Sila cuba lagi." | phase-03 (retry failure) |

RESOLVE during impl: confirm the orderTracking section key path — `OrderTrackingClient` currently hardcodes English strings (no `useI18n`). If no `storefront.orderTracking` block exists, either add one OR keep the two new strings inline (KISS) since the component is not yet i18n-wired. Do NOT i18n-refactor the whole tracking component (YAGNI) — only the two new strings, matching surrounding convention.

Note: BM = ms.json. The AC-1 BM string is the exact spec wording "Pembayaran gagal. Sila cuba lagi." — ms.json `paymentDeclined` MUST match verbatim.

## Test matrix

TC-IDs from `docs/qa/F13-*.md` (RESOLVE actual IDs from that file; placeholders below).

| Scope | Test | Type | AC |
|-------|------|------|----|
| Cart preserve | After Stripe cancel redirect, cartStore items unchanged (no clearCart on Stripe branch) | unit | AC-1/AC-4 |
| Cancel toast | `?stripe_cancelled=1` → toast.error called with paymentDeclined; param stripped | unit (component) | AC-1 |
| Confirm clear | clearCart fires exactly once on paymentStatus→paid transition; never on COD/BT | unit | AC-4 |
| Verifying state | Stripe + !paid renders verifyingPayment; flips to paid block on SSE paid msg | unit (component) | AC-2 |
| No poll for COD/BT | COD/BT confirm opens no EventSource | unit | AC-2 |
| retry guard | non-retryable status (paid/cancelled) → 409 | unit (route) | AC-3 |
| retry auth | no cookie + no token → 401 | unit (route) | AC-3 |
| retry stock | item out of stock → 422 OUT_OF_STOCK, no Stripe session | unit (route) | AC-3 |
| retry happy | retryable + in stock + authed → new sessionUrl, ct_ cookie set | unit (route) | AC-3 |
| Pay Now visibility | CTA shown for awaiting_payment/payment_failed, hidden for paid | unit (component) | AC-3 |

## Requirements

- Import logic from source (no re-implementation). Mock Stripe SDK + Payload at module boundary only, NOT business logic. Real status-transition logic exercised.
- AAA structure. `vi.mock()` top-level. No fake-data-to-pass.
- Cover error paths (401/409/422), not just happy path.

## Related code files

Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
Create: test files under `src/__tests__/` mirroring existing F13 test layout (RESOLVE path from existing F13 tests, e.g. `src/__tests__/unit/orders/`).
Read: `docs/qa/F13-*.md` (TC-IDs), existing F13 test files (pattern + mock setup).

## Implementation steps

1. Add 5 new keys to en.json under correct sections; mirror in ms.json with BM translations (verify the AC-1 string verbatim).
2. Find existing F13 unit test dir + mock helpers; mirror the stripe-checkout route test for retry-payment.
3. Write tests per matrix, tagging each with its TC-ID.
4. `npm test` — 100% pass on new tests. Fix, never skip.

## Todo

- [ ] 5 i18n keys × 2 locales (en + ms), AC-1 BM string verbatim
- [ ] retry-payment route tests (guard/auth/stock/happy)
- [ ] CheckoutClient cancel+cart tests
- [ ] ConfirmClient verifying+clearCart tests
- [ ] OrderTracking Pay-Now visibility test
- [ ] TC-IDs mapped from docs/qa/F13
- [ ] `npm test` green

## Success criteria (measurable)

- `npm test` passes 100% on new tests; no skipped/only.
- ms.json `paymentDeclined` === "Pembayaran gagal. Sila cuba lagi." exactly.
- en.json and ms.json have identical key trees (no missing-locale key) — verify with a key-diff.
- Every new test references a TC-ID.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| en/ms key trees drift (missing translation) | M×M | Diff keys after edit; both files edited in same agent (atomic) |
| Mocking Stripe wrong → false green | M×M | Mock only SDK boundary; assert request shape + status transitions on real code |
| TC-IDs don't exist in docs/qa yet | L×M | If absent, propose IDs + note for QC to ratify; don't block |

## Rollback

Revert locale edits (additive — safe) and delete new test files. No runtime impact.

## Security

- No secrets in tests. Use env stubs for PAYLOAD_SECRET in token tests.

## Unresolved

- Q3: Does `OrderTrackingClient` use `useI18n`? If not, decide inline vs new `orderTracking` i18n block (lean inline, KISS).
- Q4: Actual F13 TC-ID range + test dir — read `docs/qa/F13-*.md` + existing tests.
