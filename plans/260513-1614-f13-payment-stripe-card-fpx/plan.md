# Plan: F13 Payment Gateway — Stripe Card + FPX Wiring

> **Feature:** F13 — Payment Gateway (Malaysia)
> **Created:** 2026-05-13
> **Owner:** TBD (Backend + Frontend Dev)
> **Wave:** 6 | **Priority:** P1
> **Branch base:** `staging` (after COD/QR storefront PR merges for Phase B)

---

## Goal

Wire Stripe Card + FPX vào Settings + Checkout, dùng **Stripe Checkout Session HOSTED** (existing `createStripeCheckoutSession` ở `src/lib/payment/stripe.ts`). Stripe Connect Direct Charges + 3% application fee đã có sẵn.

**Out of scope:** Inline Payment Element. COD/QR (F19 owns). Refund UI (Wave 7+).

---

## Strategy — Hướng C (split into 2 phases)

| Phase | Scope | Status | Depends |
|-------|-------|--------|---------|
| **A** | Settings (Schema + UI) + Stripe lib + Checkout API | **READY — start now (parallel-safe với COD/QR)** | — |
| **B** | Storefront checkout integration (`/sites/[slug]/checkout/page.tsx`) | **HOLD** — wait COD/QR storefront PR merge staging | A done + COD/QR storefront merged |

**Reason for split:** COD/QR đang active edit `checkout/page.tsx`. Phase A touch files COD/QR không touch → 0 conflict. Phase B touch shared file → conflict risk cao, HOLD.

**Timeline (semi-flexible):** Target Phase A complete trong **tuần này** (~8-10h) để giải phóng nguồn lực sang Phase 04 / F15 / F21 / F22.

---

## Phases

| # | File | Scope | Est | Parallel |
|---|------|-------|-----|----------|
| 01 | [`phase-01-schema-settings-backend.md`](./phase-01-schema-settings-backend.md) | Tenants.ts schema fields, actions.ts, DB migration | S | — (blocks 02, 03) |
| 02 | [`phase-02-settings-ui-wiring.md`](./phase-02-settings-ui-wiring.md) | Extract `<StripePaymentToggles />` wrapper + wire toggles + add FPX | S | ✅ với 03 |
| 02b | (sub-task của 02) | Verify `/dashboard/settings/payments/connect` route hoặc fallback API onboard | XS (1-2h) | (sequential trong Phase 02) |
| 03 | [`phase-03-checkout-api-dynamic-methods.md`](./phase-03-checkout-api-dynamic-methods.md) | Stripe lib accept dynamic `payment_method_types`, orders/create pass tenant settings, backfill migration | S | ✅ với 02 |
| 04 | [`phase-04-storefront-integration-hold.md`](./phase-04-storefront-integration-hold.md) | **HOLD** — Storefront checkout add Stripe radio + redirect | M | — (after COD/QR merge) |

---

## Dependencies graph

```
Phase 01 (schema)
  ├── Phase 02 (Settings UI) ──┐
  └── Phase 03 (API + lib) ────┴── Phase A complete
                                    │
                                    ↓
                            Wait COD/QR storefront PR merge staging
                                    │
                                    ↓
                            Phase 04 (Storefront — HOLD released)
```

---

## File ownership (atomicity)

| File | Owner phase | Conflict risk với COD/QR |
|------|-------------|--------------------------|
| `src/collections/Tenants.ts` | 01 | None — additive fields |
| `scripts/db-setup.js` | 01 | None — append MIGRATIONS entry |
| `src/app/(dashboard)/settings/payments/actions.ts` | 01 | None — extend functions |
| `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx` | 02 | **Low** — additive; COD/QR section untouched |
| `src/lib/payment/stripe.ts` | 03 | None — COD/QR doesn't use |
| `src/app/api/orders/create/route.ts` | 03 | None — COD/QR uses `/checkout` |
| `src/app/sites/[slug]/checkout/page.tsx` | 04 (HOLD) | **HIGH** — COD/QR actively edits |

---

## Acceptance criteria (Plan-level)

- [ ] Seller có thể bật/tắt Card + FPX riêng từ `Dashboard > Settings > Payments`
- [ ] Settings persist vào `tenant.payment_card`, `tenant.payment_fpx`
- [ ] `payment_method_types` array vào Stripe Checkout dynamic theo tenant settings
- [ ] Card OFF + FPX OFF → backend reject create với clear error
- [ ] Stripe Connect not complete → toggles disabled + CTA "Connect Stripe"
- [ ] All migration tests pass (`scripts/check-migrations.js`)
- [ ] No regression trên COD/QR flows (manual + automated)

---

## Key insights

1. **Code đã sẵn:** Stripe Connect onboarding, Direct Charges + 3% fee, webhook handler đều đã wired. F13 chỉ cần wire Settings UI + dynamic methods.
2. **Toggle mocked:** `PaymentsFormClient.tsx:288-296` đang hardcode "Inactive" — Phase 02 wire functional.
3. **Hardcoded methods:** `src/lib/payment/stripe.ts:123` cứng `['card', 'fpx']` — Phase 03 đổi thành dynamic.
4. **Hook pattern reuse:** `payment_qr` auto-false nếu `qr_image` empty (`Tenants.ts:286`) — Phase 01 copy pattern: `payment_card`/`payment_fpx` auto-false nếu `stripeOnboardingComplete = false`.
5. **`payment_method_types` constraint:** Stripe yêu cầu array non-empty. Phase 03 validate: nếu cả 2 OFF → return clear error trước khi gọi Stripe API.

---

## Risk + mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Migration breaks existing tenant rows | HIGH | Phase 01 dùng `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS` (per `.claude/rules/database-schema.md`); defaults `false`; backfill safe |
| COD/QR team refactor toggle UI pattern mid-flight | MED | Phase 02 follow existing Switch pattern; rebase on staging trước commit |
| Stripe Connect not onboarded → buyer can't pay | MED | Phase 02 disable toggles + show CTA; Phase 04 hide Stripe row in storefront if `stripeOnboardingComplete = false` |
| Both methods OFF tenant accidentally → no checkout option | LOW | Phase 03 backend validate; Phase 02 UI soft warn |
| PRD §13 outdated (Payment Element pattern) confuses reviewer | LOW | Flag trong design doc §10 + ask BA update; doesn't block code |

---

## Decisions Log (chốt 2026-05-13 với PM)

| # | Decision | Reason |
|---|----------|--------|
| D-01 | **Wave 6 timeline:** semi-flexible; target Phase A done **tuần này** (~8-10h) | Giải phóng nguồn lực sang Phase 04 / F15 / F21 / F22 |
| D-02 | **Backfill existing tenants:** SET `payment_card = true` cho tenants có `stripeOnboardingComplete = true`; `payment_fpx` default `false` | Giữ behavior cũ (hardcode `['card', 'fpx']` ở `stripe.ts:123` — Card luôn enabled) → 0 disruption khách hàng đang dùng |
| D-03 | **Stripe not onboarded UX:** **Disabled + Lock icon + tooltip** "Connect Stripe to enable" — toggles vẫn render rõ ràng (không hidden) | Người dùng thấy được payment options tồn tại → motivation onboard Stripe. Nhất quán với Screenshot 2026-05-13 16:19:20 |
| D-04 | **Phase 02b dự phòng (~1-2h):** Verify `/dashboard/settings/payments/connect` route hoặc fallback POST `/api/stripe/connect/onboard` cho Connect button | Infrastructure Stripe Connect đã sẵn, chỉ cần đảm bảo CTA dẫn đúng flow |
| D-05 | **PRD §13 update timing:** **Parallel với Phase A start** — không block | Phase A đi hướng A (Redirect, đã chốt §8.6), không phụ thuộc PRD code sample |
| D-06 | **Wrapper component cho Stripe toggles:** Extract `<StripePaymentToggles />` component riêng trong Phase 02 — tách Stripe section khỏi `PaymentsFormClient.tsx` chính | Giảm rebase conflict với COD/QR team đang sửa cùng file; cô lập F13 changes vào 1 file mới |
| D-07 | **Tests scope:** Unit + integration đủ cho Phase A; E2E Stripe sandbox defer Phase 04 | Phase A không touch Stripe runtime flow (chỉ settings + dynamic methods param) |

---

## Next steps

1. PM/BA confirm 5 open questions trên
2. Dev claim Phase 01 → migration + schema → merge staging
3. Phase 02 + 03 parallel sau Phase 01 merge
4. Monitor COD/QR storefront PR — gate Phase 04 readiness check
5. Phase 04 start sau COD/QR merge + Phase A done

---

## Reference

- Design: [`docs/design/F13-payment-gateway-design.md`](../../docs/design/F13-payment-gateway-design.md)
- PRD: [`docs/prd/F13-payment-gateway.md`](../../docs/prd/F13-payment-gateway.md)
- Stories: [`docs/stories/F13-payment-gateway-stories.md`](../../docs/stories/F13-payment-gateway-stories.md)
- Architecture: TBD (Dev draft trước Phase 01)
- Audit report: [`plans/reports/Explore-260512-1449-prd-design-gap-audit.md`](../reports/Explore-260512-1449-prd-design-gap-audit.md)
