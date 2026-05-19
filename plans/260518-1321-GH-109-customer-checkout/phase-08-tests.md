# Phase 08 — Tests (TC-F10-02-* + TC-F10-06-*)

**Status:** pending | **Effort:** 2.5h | **Owner:** tester | **Blocks:** Phases 02–07

## Overview
Cover all TC-IDs from `docs/qa/F10-orders-management.md` for US-F10-02 (COD + BT v2.2). Vitest + Payload Local API + real Neon test DB (per `.claude/rules/testing.md` — no mocked DB).

## Related code files
- Modify: `src/__tests__/api/orders-checkout.test.ts` — drop proof-at-checkout assertions, add COD status='unpaid' assertions, add redirectUrl assertion
- Create: `src/__tests__/api/orders-bank-transfer.test.ts` — BT happy path + edge cases
- Create: `src/__tests__/lib/jwt-magic-link.test.ts` — sign/verify round-trip, expiry, tamper detection
- Create: `src/__tests__/lib/bank-transfer-reference.test.ts` — format + alphabet exclusion
- Create: `src/__tests__/api/orders-verify-payment.test.ts` — seller approve/reject
- Create: `src/__tests__/api/orders-upload-proof.test.ts` — JWT-gated upload
- Create: `src/__tests__/lib/auto-cancel-expired.test.ts` — TTL behavior
- Create: `src/__tests__/email/order-confirmation-bt.test.ts` — snapshot COD vs BT
- Optional: `e2e/checkout-bt-flow.spec.ts` (Playwright) — full flow if E2E infra exists

## Test matrix (TC-ID → file → assertion)

### TC-F10-02 (COD + current checkout)
| TC | File | Assertion |
|----|------|-----------|
| 02-01 | orders-checkout.test.ts | POST cod → 200 + status='unpaid' |
| 02-02 | orders-checkout.test.ts | Stock decremented for COD |
| 02-03 | orders-checkout.test.ts | OUT_OF_STOCK 422 (existing, keep) |
| 02-04 | orders-checkout.test.ts | SST 6% calc correct |
| 02-05 | orders-checkout.test.ts | Guest checkout (no user) succeeds |
| 02-06 | orders-checkout.test.ts | Missing email → 400 VALIDATION_ERROR |
| 02-07 | orders-checkout.test.ts | redirectUrl signed token verifiable |
| 02-08 | orders-checkout.test.ts | orderNumber unique format |
| 02-09 | orders-checkout.test.ts | Shipping fee = 10 flat |
| 02-10 | order-confirmation-bt.test.ts | COD email subject + CTA |
| 02-11 | orders-checkout.test.ts | Notification sent to tenant owners |
| 02-12 | orders-checkout.test.ts | Cart not cleared server-side (client) |
| 02-13 | orders-checkout.test.ts | Mixed cart OOS rejects before any create |
| 02-14 | orders-checkout.test.ts | currency from product, not user |

### TC-F10-06 (Bank Transfer v2.2)
Coverage grouped by area; each TC → one test case in mapped file:

**Order creation (06-01 → 06-08)** — `orders-bank-transfer.test.ts`
- Status='awaiting_payment'
- paymentReference matches `^BT-[A-Z2-9]{6}$`
- paymentReference excludes 0/O/I/1
- paymentExpiresAt = createdAt + 24h ±1s
- Stock NOT decremented
- redirectUrl token verifiable + maps to order.id
- Confirmation email triggered (mock sendEmail or check call)
- Reference uniqueness on collision retry

**JWT magic link (06-09 → 06-14)** — `jwt-magic-link.test.ts`
- Sign + verify round-trip
- Expired token → `{ valid: false, reason: 'expired' }`
- Tampered token → `{ valid: false, reason: 'invalid' }`
- Wrong orderId in token vs URL → reject
- Missing PAYLOAD_SECRET → throws at sign time
- Token TTL respects passed expiresIn

**Post-order page access (06-15 → 06-18)** — integration via `orders-upload-proof.test.ts` headers
- No token → 401
- Invalid token → 401
- Valid token but order.id mismatch → 403
- Valid token + valid order → 200

**Proof upload (06-19 → 06-25)** — `orders-upload-proof.test.ts`
- Upload from awaiting_payment → status='pending_verification'
- Upload from pending_verification (re-upload) → status stays/refreshes
- Upload from cancelled → 409 INVALID_STATUS
- File > 5MB → 413
- Non-image mimetype → 400
- paymentProofImage media ID set on order
- Seller notification fires

**Seller verify (06-26 → 06-33)** — `orders-verify-payment.test.ts`
- Approve → status='confirmed', stock decremented, paymentVerifiedAt set
- Approve when stock insufficient → 422, status unchanged
- Reject with valid reason → status='awaiting_payment', reason recorded
- Reject with reason='other' + no note → 400
- Reject without reason → 400
- Approve on non-pending_verification → 409
- paymentVerifiedBy set to req.user.id
- Customer email fires on both actions

**Auto-cancel TTL (06-34 → 06-40)** — `auto-cancel-expired.test.ts`
- BT order with expiry passed + status='awaiting_payment' → on read, status becomes 'cancelled'
- DB row updated (verify with payload.findByID re-fetch)
- Idempotent — second read no-op
- pending_verification with expiry passed → NOT auto-cancelled (guard)
- confirmed with expiry passed → NOT auto-cancelled
- Manual sweep endpoint cancels in bulk
- DISABLE_BT_AUTO_CANCEL=1 disables

## Test infra notes
- Use `payload.create` + `payload.find` directly (Local API) — no HTTP layer needed for most tests.
- Reuse existing test helpers in `src/__tests__/` (look for setup files).
- DO NOT mock DB (per `.claude/rules/testing.md`). Use test tenant + cleanup in `afterEach`.
- Email send: assert via Payload mock transport (already configured if `MAIL_HOST` unset).
- File uploads: use Buffer + simulated multipart in upload-proof test.

## Implementation steps
1. Update existing `orders-checkout.test.ts`: remove proof-at-checkout assertions, add status='unpaid', add redirectUrl JWT verify.
2. Create remaining 7 test files (skeletons + TC-ID comment per test).
3. Implement assertions per matrix above.
4. Run `npm test` — must reach 100% pass on new + existing F10 tests.
5. Address any flakes per `.claude/rules/testing.md` (no skip, no mock-the-bug-away).

## Todo list
- [ ] Update orders-checkout.test.ts (TC-02-*)
- [ ] Create orders-bank-transfer.test.ts (TC-06-01..08)
- [ ] Create jwt-magic-link.test.ts (TC-06-09..14)
- [ ] Create orders-upload-proof.test.ts (TC-06-15..25)
- [ ] Create orders-verify-payment.test.ts (TC-06-26..33)
- [ ] Create auto-cancel-expired.test.ts (TC-06-34..40)
- [ ] Create bank-transfer-reference.test.ts
- [ ] Create order-confirmation-bt.test.ts (email snapshot)
- [ ] All tests pass: `npm test`

## Success criteria
- All 14 TC-F10-02-* + 40 TC-F10-06-* mapped to a test that PASSES.
- `npm test` exits 0.
- `npm run lint` clean.
- `scripts/check-migrations.js` passes (Phase 01).
- CI green on PR.

## Risk
- Test DB shared with dev — use unique tenant per test run + cleanup. If contention, run F10 tests serial (`vitest --pool=forks --poolOptions.forks.singleFork=true`).
- Email assertions brittle on subject string — assert structurally (contains paymentReference, not exact subject).
