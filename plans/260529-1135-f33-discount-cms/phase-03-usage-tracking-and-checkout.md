# Phase 03 — Centralized Order-Total Computation + Usage Tracking (All Payment Methods)

**Priority:** P1 · **Status:** pending · **Effort:** 6h · **Blocks on:** 01, 02

Wire the discount into the order lifecycle, gateway-agnostically:
(a) a reusable server-side validator/resolver + a SINGLE shared total-computation function;
(b) call it from BOTH checkout routes (COD/QR and Stripe) so all three payment paths consume the same
`finalAmount`; (c) on successful order placement, record a DiscountUsageHistory row + atomically increment
`usageCount` enforcing the limit — regardless of gateway.

**Scope:** Both `src/app/api/orders/checkout/route.ts` (COD/QR) AND
`src/app/api/orders/stripe-checkout/route.ts` (Stripe). Discount is NOT gateway-specific: it is applied
once inside `computeOrderTotal()`, and the payment method only RECEIVES the resulting `finalAmount`.

## Confirmed decisions applied here

- **Decision 1 — base:** discount applies to **subtotal only** (Σ unit price × qty). Shipping + tax are
  added AFTER the discount: `finalAmount = (subtotal − discountAmount) + shipping + tax`.
- **Decision 2 — at-limit / invalid:** if the code is at-limit, expired, inactive, wrong-tenant, or
  wrong-site → **silently reject the code; the order still proceeds at full price.** Never hard-fail the
  checkout because of a bad/exhausted code. (`discountAmount = 0`, no `discount`/`discountCode` snapshot,
  no usage row.)
- **Decision 3 — gateway-agnostic:** Stripe is NOT deferred. The same `computeOrderTotal()` runs for
  COD/QR and Stripe. Stripe charges exactly `finalAmount` (no Stripe Coupon object, no per-line-item
  coupon mapping). Concrete Stripe change documented below.

## Gap-audit fixes applied here (2026-05-29)

From `plans/reports/audit-260529-1543-f33-discount-gaps.md`. These change the redemption model — read before implementing:

- **(A) Redemption happens AFTER the order is CONFIRMED PLACED, never at checkout-session creation.**
  - COD/QR: order is created synchronously → redeem immediately AFTER a successful `payload.create`.
  - **Stripe: a `pending` order is created BEFORE payment; the buyer may abandon (no webhook ever fires).**
    So Stripe does NOT redeem at session-creation. It only snapshots `discount`/`discountCode`/`discountAmount`
    on the pending order; redemption fires inside the **`checkout-completed.ts` webhook** after payment succeeds.
  - Free-order branch (finalAmount ≤ 0, no Stripe round-trip): redeem inline at creation (like COD).
  - Tolerance (user-confirmed): the usage-limit is enforced at RESOLVE time (before placement). Between resolve
    and placement a concurrent burst may let the limit be exceeded by a tiny margin — **accepted**. We never
    block an already-paid order.
- **(A-defect) The old "`Orders.afterChange` records usage on the webhook transition" plan does NOT work.**
  `checkout-completed.ts` flips `pending → new` with a **raw `payload.db.drizzle.execute` UPDATE** (L98-102),
  which fires NO Payload hook. Redemption is therefore an **explicit helper call**, not an `afterChange` hook.
  → no hook wired into `Orders.ts`; `record-discount-usage.ts` is repurposed as `redeem-and-record.ts`.
- **(B) Idempotency is DB-enforced** by the UNIQUE `discount_usage_history(order_id)` index (Phase 01).
  The helper INSERTs `ON CONFLICT (order_id) DO NOTHING`; `usage_count` is incremented ONLY when a new row was
  actually inserted → `usage_count` stays == `COUNT(history rows)`, and replays never double-count.
- **(C) No leak on order-create failure** — COD redeems AFTER create succeeds, so a thrown `create` redeems nothing.
- **(D) Redeem only when `discountAmount > 0`** — compute the amount first; a 0-value discount burns no usage slot.
- **(F) Stripe confirmation email must show the discount line** — `checkout-completed.ts` builds the buyer email
  (L168-191) and currently passes no discount fields; it must pass `discountCode`/`discountAmount`.

## Codebase findings (where totals are computed TODAY)

There is **no existing centralized total function** — both routes compute totals inline and they DRIFT:

| Path | File / lines | How total is computed today |
|------|--------------|------------------------------|
| COD / QR | `src/app/api/orders/checkout/route.ts` L209–215 | `subtotalSen = round(subtotal*100)`; `shippingFee = getShippingRate(state, site.shippingConfig, subtotalSen)/100`; `tax = round(subtotal*0.06*100)/100`; `total = subtotal + shippingFee + tax` |
| Stripe | `src/app/api/orders/stripe-checkout/route.ts` L179–182 | `shippingFee = 10` (flat placeholder, #962 pending); `tax = round(subtotal*0.06*100)/100`; `total = round((subtotal+shippingFee+tax)*100)/100` |
| Stripe subtotal source | `src/app/api/orders/stripe-checkout/build-order-items.ts` L150–154 | `subtotal += unitPrice*qty`; also builds `checkoutItems[]` (per-line `price` in sen) |
| Stripe charge construction | `stripe-checkout/route.ts` L254–258 → `src/lib/payment/stripe.ts` L156–166 | builds `line_items` from `checkoutItems + Shipping + SST` synthetic items; **buyer is charged the SUM of positive `unit_amount` line items** — NOT a single total. Stripe does NOT accept negative line items. |
| Free-order escape hatch | `stripe-checkout/route.ts` L185–211 (TC-F13.103) | if `total <= 0` → create order `paymentMethod:'free'`, skip Stripe. Already anticipates "coupon 100% off". |

Email totals also read `subtotal/shippingFee/total` directly (checkout/route.ts L424–432, L465–475).

## Architecture / data flow

```
                 ┌─────────────────────────────────────────────┐
                 │  src/lib/discounts/resolve-discount.ts        │
 discountCode ──▶│  resolveDiscount(payload, code, tenant, site, │
                 │     now) → discount | null (silent reject)    │
                 │  computeDiscount(discount, subtotalSen) (pure)│
                 └───────────────────────┬─────────────────────┘
                                         │ discountAmount (sen)
                 ┌───────────────────────▼─────────────────────┐
                 │  src/lib/orders/compute-total.ts (NEW, shared)│
                 │  computeOrderTotal({subtotal, shipping, tax,  │
                 │     discountAmount}) →                        │
                 │     { discountedSubtotal, finalAmount }       │
                 │  finalAmount = (subtotal − discountAmount)    │
                 │                + shipping + tax  (clamp ≥ 0)   │
                 └───────────────────────┬─────────────────────┘
                                         │ finalAmount
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                 ▼                                 ▼
  COD/QR route                      Stripe route                    (free order)
  total = finalAmount          line_items rebuilt so SUM ==        finalAmount ≤ 0
  shipper/QR shows finalAmount finalAmount; Stripe charges it      → paymentMethod 'free'
  create order (snapshot)      create PENDING order (snapshot)     create order (snapshot)
        │                                 │                                 │
        ▼ (after create OK)               ▼ (buyer pays → webhook)          ▼ (inline, no webhook)
  redeemAndRecord(order)        checkout-completed.ts:               redeemAndRecord(order)
        │                       atomic pending→new wins →                   │
        │                       redeemAndRecord(order)                      │
        └────────────────────────────────┴────────────────────────────────┘
                                         │
                 ┌───────────────────────▼───────────────────────────────┐
                 │ recordDiscountRedemption(payload, {discount,order,...}) │
                 │   INSERT discount_usage_history (...)                   │
                 │     ON CONFLICT (order_id) DO NOTHING RETURNING id      │
                 │   if inserted → UPDATE discounts                        │
                 │     SET usage_count = usage_count + 1 WHERE id = $1      │
                 │   ⇒ usage_count == COUNT(history); replay-safe          │
                 └─────────────────────────────────────────────────────────┘
```

**At-limit handling (decision 2 + gap A tolerance):** the usage-limit is checked inside `resolveDiscount`
(`usage_count < usage_limit`, or unlimited) BEFORE the order is placed. If `resolveDiscount` returns null
(invalid / expired / inactive / wrong-tenant / wrong-site / at-limit) → `discountAmount = 0`, drop the
snapshot fields, proceed at full price. **No 4xx for a bad code.** Redemption itself is unconditional once
the order is placed (history-driven count), so a rare concurrent over-limit by 1–2 placed orders is accepted
rather than failing a paid order.

## Centralized total function (the single source of truth)

`src/lib/orders/compute-total.ts` — pure, gateway-agnostic, unit-testable. Signature (sketch):

```
computeOrderTotal(input: { subtotal: number; shippingFee: number; tax: number; discountAmount?: number })
  → { discountedSubtotal: number; finalAmount: number }
```

- `discountedSubtotal = max(0, subtotal − discountAmount)`
- `finalAmount = round2(discountedSubtotal + shippingFee + tax)`
- Both routes replace their inline `total = subtotal + shippingFee + tax` with a call to this fn,
  passing `discountAmount` (0 when no/invalid code). This unifies the discount step in ONE place.
- Units: routes currently work in RM-floats for `total`; keep that signature (RM-float) to minimize the
  diff, but compute `discountAmount` from `subtotalSen` then convert (`/100`) so rounding matches the
  existing sen-based shipping/tax math. Document the unit at the call site.

## Concrete Stripe change required (decision 3)

`createStripeCheckoutSession` (`src/lib/payment/stripe.ts` L156–166) charges the **sum of positive
`line_items`** — Stripe forbids negative line items, so a "−discount" line is NOT an option. To make the
Stripe charge equal `finalAmount` while keeping per-item display:

- In `stripe-checkout/route.ts`, after `computeOrderTotal()` yields `discountAmount` (sen) and
  `finalAmount`, **rebuild the Stripe `line_items` ONLY so their summed `unit_amount × quantity` equals
  `round(finalAmount*100)`.** Two acceptable implementations (reviewer picks one; keep it simple):
  1. **Discounted item prices (preferred, KISS):** scale each `checkoutItems[i].price` down
     proportionally by `discountedSubtotal / subtotal`, then append the existing Shipping + SST synthetic
     items unchanged. Fix any rounding remainder on the last item so the sum is exact.
  2. **Single synthetic "Order" line:** replace per-product lines with one line `unit_amount = round(finalAmount*100), quantity 1` (loses per-item display on the Stripe page).
- **(gap I) DO NOT mutate the order doc's `items[].unitPrice`.** The scaling applies ONLY to the Stripe
  `line_items` payload. `orders.items[].unitPrice` keeps the ORIGINAL price (emails L175-181, stock decrement,
  and refunds all read it); the discount lives solely in the `discountAmount` snapshot. Email/UI show original
  line prices + a separate "Discount (CODE) −RM X" line.
- **(gap I) Guard the scaling:** clamp every scaled `unit_amount` to `≥ 0`; if `discountedSubtotal == 0`
  (100%-off products, but shipping/tax keep `finalAmount > 0`), emit only the Shipping + SST lines. Unit-test
  that the summed line items == `round(finalAmount*100)` exactly for representative carts.
- The existing `total <= 0` free-order path (L185–211) already handles 100%-off-everything: when
  `finalAmount <= 0`, take that branch (`paymentMethod:'free'`, skip Stripe), feeding it `finalAmount`.
  **Because there is no Stripe webhook for a free order, call `recordDiscountRedemption` INLINE right after
  the free-order `payload.create` succeeds** (same as COD).
- Persist `discount`, `discountCode`, `discountAmount` on the PENDING Stripe order doc (same snapshot fields
  as COD/QR), but **do NOT redeem here.** `checkout-completed.ts` calls `recordDiscountRedemption` after it
  wins the atomic `pending → new` transition (gap A). The UNIQUE `(order_id)` guard makes a replayed webhook safe.

**Do NOT over-claim:** F33 delivers Stripe discount support via this line-item rebuild. It does NOT add a
Stripe Coupon/Promotion-code object. State exactly that in Phase 06 docs.

## Context links

- COD/QR apply point: `src/app/api/orders/checkout/route.ts` (L84–215 totals; L229 create; emails L424–475)
- Stripe apply point: `src/app/api/orders/stripe-checkout/route.ts` (L166–258); subtotal in `build-order-items.ts`
- Stripe session builder: `src/lib/payment/stripe.ts` `createStripeCheckoutSession` (L130–185)
- Hook pattern: `src/collections/orders-hooks/update-payment-status.ts`, `sync-customer-snapshot.ts`
- Hook registration: `Orders.ts` `hooks.afterChange[]`
- Validation helpers: `src/lib/validations/orders.ts` (`orderCreateSchema`, `stripeCheckoutSchema`)

## Key insights

- The checkout routes already aggregate items and compute totals server-side → the ONLY trusted place to
  apply a discount (never trust a client-sent discount amount).
- Discount math (pure): percentage → `round(subtotalSen * value/100)`; fixed → `min(value, subtotalSen)`;
  clamp `≥ 0` and `≤ subtotalSen`. (Also clamp percentage `value` to ≤ 100 defensively in case a bad value
  bypassed the admin form.)
- **Limit enforcement is at RESOLVE time, not via a conditional UPDATE.** `resolveDiscount` filters
  `status='active' AND (usage_limit IS NULL OR usage_count < usage_limit) AND now ∈ [startsAt, expiresAt]
  AND site (null-or-equal)`; any miss ⇒ returns null ⇒ silent reject (decision 2). Gap-A tolerance accepts a
  rare concurrent over-limit rather than failing an already-placed/paid order.
- **Redemption is history-driven and idempotent (gaps B/C/D).** Single helper `recordDiscountRedemption`:
  `INSERT discount_usage_history ... ON CONFLICT (order_id) DO NOTHING RETURNING id`; only if a row was inserted,
  `UPDATE discounts SET usage_count = usage_count + 1 WHERE id=$1`. So `usage_count == COUNT(history)` always,
  replays/admin-re-saves/webhook-redeliveries never double-count, and nothing is redeemed if the order was
  never created. Called explicitly: COD after `create`; free-order inline; Stripe inside `checkout-completed.ts`.
- **Code normalization must match on both sides (gap K):** store canonical `UPPER(TRIM(code))` (Phase 02
  beforeChange) AND `resolveDiscount` looks up by `UPPER(TRIM(input))`. Otherwise lookups miss.
- **Date boundaries (gap H):** `resolveDiscount` treats `startsAt` as inclusive from start-of-day and
  `expiresAt` as inclusive THROUGH end-of-day, in the store timezone (Asia/Kuala_Lumpur, UTC+8) — Phase 02
  normalizes the stored timestamps; resolve compares against them directly. Null on either side = open-ended.

## Related code files

**Create**
- `src/lib/orders/compute-total.ts` — `computeOrderTotal()` (pure, shared by both routes; the single discount-apply + final-amount point)
- `src/lib/discounts/resolve-discount.ts` — `resolveDiscount()` (returns discount | null — silent reject; enforces status + limit + date window + site + `UPPER(TRIM)` lookup) + `computeDiscount(discount, subtotalSen)` (pure)
- `src/lib/discounts/redeem-and-record.ts` — `recordDiscountRedemption(payload, {discountId, orderId, tenantId, amountApplied, customerEmail})`: history-driven, idempotent `INSERT ... ON CONFLICT (order_id) DO NOTHING` then conditional `usage_count++` only if inserted (gaps B/C/D). **This is a plain helper, NOT a Payload hook.**

**Modify**
- `src/app/api/orders/checkout/route.ts` (COD/QR) — resolve + compute amount (only if >0) + `computeOrderTotal()`; create order with snapshot; **after create succeeds → `recordDiscountRedemption`**; pass `discountAmount`/`discountCode` to the COD + bank-transfer emails
- `src/app/api/orders/stripe-checkout/route.ts` — resolve + compute + `computeOrderTotal()`; rebuild Stripe `line_items` so sum == `finalAmount` (original `items[].unitPrice` untouched); persist snapshot on the PENDING order; **do NOT redeem here**; free-order branch redeems inline after create
- `src/app/api/webhooks/stripe/handlers/checkout-completed.ts` — **(gaps A + F)** after the atomic `pending→new` transition wins, if `order.discount` present → `recordDiscountRedemption`; AND pass `discountCode`/`discountAmount` into `orderConfirmationEmail({...})` (L168-191) so the Stripe receipt shows the discount line
- `src/lib/validations/orders.ts` — add optional `discountCode: z.string().trim().max(64).optional()` to BOTH `orderCreateSchema` and `stripeCheckoutSchema`

**Delete:** none
**NOT doing:** no `Orders.afterChange` discount hook — the webhook transitions status via raw SQL (no hook fires), so redemption is an explicit helper call (gap A-defect).

## Implementation steps

1. `computeDiscount(discount, subtotalSen)`: percentage → `Math.round(subtotalSen * min(value,100)/100)`; fixed → `Math.min(value, subtotalSen)`; clamp `≥0` and `≤ subtotalSen`.
2. `computeOrderTotal({subtotal, shippingFee, tax, discountAmount})`: `discountedSubtotal = max(0, subtotal − discountAmount)`; `finalAmount = round2(discountedSubtotal + shippingFee + tax)`; return both.
3. `resolveDiscount(payload, code, tenant, site, now)`: look up by `UPPER(TRIM(code))` + tenant; require `status='active'`, `usage_limit IS NULL OR usage_count < usage_limit`, `now ∈ [startsAt(start-of-day), expiresAt(end-of-day)]` (null=open), `site` null-or-equal. On ANY miss return `null` (caller treats as no discount — decision 2). No throw.
4. `recordDiscountRedemption(payload, {discountId, orderId, tenantId, amountApplied, customerEmail})`: `INSERT discount_usage_history (...) ON CONFLICT (order_id) DO NOTHING RETURNING id`; if a row was returned → `UPDATE discounts SET usage_count = usage_count + 1 WHERE id = discountId`. Idempotent + keeps `usage_count == COUNT(history)` (gaps B/C/D). No throw on conflict.
5. Add `discountCode` to `orderCreateSchema` AND `stripeCheckoutSchema`.
6. **COD/QR route:** after subtotal computed, if `discountCode` → `resolveDiscount` → if non-null `discountAmount = computeDiscount(...)` (else 0). Call `computeOrderTotal` → set `total = finalAmount`. Include `discount`/`discountCode`/`discountAmount` in `payload.create` only when `discountAmount > 0`. **After `create` succeeds AND a discount was applied → `recordDiscountRedemption(...)`** (gap C: redeem only after create). Pass `discountAmount`/`discountCode` to the COD + bank-transfer email calls (gap F).
7. **Stripe route:** same resolve + compute. Call `computeOrderTotal`. If `finalAmount <= 0` → free-order branch: create order, then `recordDiscountRedemption` INLINE (no webhook). Else: rebuild Stripe `line_items` so summed `unit_amount × qty == round(finalAmount*100)` (proportional scale, clamp ≥0, fix remainder on last line); leave `items[].unitPrice` ORIGINAL; persist snapshot on the PENDING order; **do NOT redeem** (deferred to webhook — gap A).
8. **`checkout-completed.ts` (gaps A + F):** after the existing atomic `pending→new` UPDATE wins (L98-102), re-read the order; if `order.discount` present → `recordDiscountRedemption({discountId: order.discount, orderId: order.id, tenantId, amountApplied: order.discountAmount, customerEmail: order.customerEmail})`. Also pass `discountCode: order.discountCode` + `discountAmount: order.discountAmount` into the `orderConfirmationEmail({...})` call so the Stripe receipt shows the discount line.
9. `npx tsc --noEmit`.

## Todo

- [ ] `computeOrderTotal` (pure, shared) implemented + both routes call it
- [ ] `computeDiscount` (pure) implemented; percentage clamped ≤100, amount clamped ≤ subtotal
- [ ] `resolveDiscount` returns null on any failure (silent reject — decision 2); enforces limit + end-of-day expiry + `UPPER(TRIM)` lookup
- [ ] `recordDiscountRedemption` helper: `ON CONFLICT (order_id) DO NOTHING` + conditional `usage_count++`; idempotent (gaps B/C/D)
- [ ] `discountCode` added to `orderCreateSchema` AND `stripeCheckoutSchema`
- [ ] COD/QR route: discount applied to subtotal, `total = finalAmount`, snapshot persisted, **redeem AFTER create**, emails get discount fields
- [ ] Stripe route: line items rebuilt to sum == `finalAmount`; `items[].unitPrice` left original; snapshot on PENDING order; **no redeem here**; free-order branch redeems inline
- [ ] `checkout-completed.ts`: redeems after `pending→new` wins + passes discount fields to confirmation email (gaps A + F)
- [ ] NO `Orders.afterChange` discount hook (raw-SQL webhook fires none)
- [ ] tsc clean

## Success criteria

- Valid active code on COD/QR → `finalAmount = (subtotal − discount) + shipping + tax`; `usageCount +1`; 1 history row (redeemed AFTER create).
- Valid active code on Stripe → Stripe charge == `finalAmount` (line-item sum verified, `items[].unitPrice` unchanged); `usageCount +1`; 1 history row ONLY after the webhook confirms payment.
- **Abandoned Stripe checkout** (no webhook) → pending order carries snapshot but `usageCount` UNCHANGED, no history row (gap A — no leak).
- **Stripe `payment_failed`** → no redemption, no count change (gap A).
- **Stripe confirmation email** shows "Discount (CODE) −RM X" line (gap F).
- Expired / inactive / wrong-tenant / wrong-site / at-limit code → silently dropped, order proceeds at FULL price (no 4xx), no count change, no history. (decision 2)
- `discountAmount == 0` (e.g. 0% code) → no redemption, no usage slot consumed (gap D).
- 100% percentage on full subtotal → `discountAmount = subtotal`; `finalAmount = shipping + tax`; if ≤0 → free-order path (redeems inline). Never negative; no scaled line item < 0 (gap I).
- Shipping + tax are computed on the ORIGINAL subtotal and added AFTER discount (decision 1).
- Order-create failure (COD) → nothing redeemed (gap C).
- Re-saving the same order in admin / Stripe webhook re-delivery → no duplicate history row, no double increment (UNIQUE `order_id` + `ON CONFLICT`, gap B).
- `usage_count == COUNT(discount_usage_history)` for every discount (reconciliation invariant).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Stripe usage leak via abandoned/failed checkout (gap A) | H×H | Defer redemption to `checkout-completed.ts` webhook; pending order only snapshots, never increments |
| Redemption double-counts (admin edit / webhook re-delivery) (gap B) | M×H | UNIQUE `(order_id)` + `INSERT ... ON CONFLICT DO NOTHING`; increment only when a row was inserted |
| Leak on order-create failure (gap C) | M×H | COD redeems AFTER `create` succeeds; nothing redeemed if create throws |
| Usage burned for a 0-value discount (gap D) | L×M | compute amount first; redeem only when `discountAmount > 0` |
| Concurrent burst exceeds limit by 1–2 | L×L | Accepted (user-confirmed tolerance); limit checked at resolve, never fails a placed order |
| Negative or >subtotal discount | L×H | clamp in `computeDiscount` (≤100% / ≤ subtotal); `finalAmount` clamped ≥0 |
| Client sends forged discountAmount | M×H | amount computed server-side only; client field ignored |
| Stripe line-item sum ≠ finalAmount, or scaled line < 0 (gap I) | M×H | fix remainder on last line; clamp each line ≥0; keep `items[].unitPrice` original; unit-test the rebuild |
| Two routes drift on total math | M×M | shared `computeOrderTotal()` is the single discount-apply point |
| Bad/exhausted code blocks legit checkout | L×H | decision 2 — silently reject code, never fail the order |
| expiresAt off-by-one / timezone (gap H) | M×M | normalize start-of-day/end-of-day in store tz (Phase 02); resolve compares directly |

## Security considerations

- All discount math server-side; client-supplied amounts never trusted.
- Tenant + site scoping in `resolveDiscount` prevents cross-store code abuse.
- Rate-limit reuse: code-guessing mitigated by existing checkout protections; follow-up if abuse seen.

## Cross-phase dependency (gaps H + K)

**Phase 02 must add** (admin config + validation): a `beforeChange` on `Discounts` that (a) normalizes
`code → UPPER(TRIM(code))`, and (b) normalizes `startsAt → start-of-day` / `expiresAt → end-of-day` in the
store timezone (Asia/Kuala_Lumpur). `resolveDiscount` here relies on those stored invariants. Flag this in
Phase 02 before implementing.

## Next steps

Unblocks Phase 05 tests. New/changed scenarios to cover:
- `computeOrderTotal` + `computeDiscount` (pure): bounds, 100%-off, clamps.
- `resolveDiscount`: silent-reject matrix (expired/inactive/wrong-tenant/wrong-site/at-limit) + end-of-day boundary + `UPPER(TRIM)`.
- `recordDiscountRedemption`: idempotency (call twice for same `order_id` → 1 row, +1 count), `usage_count == COUNT(history)`.
- **Gap A:** abandoned Stripe (no webhook) → no increment; `payment_failed` → no increment; webhook success → exactly one redemption; webhook re-delivery → still one.
- **Gap F:** Stripe confirmation email contains the discount line.
- **Gap I:** Stripe line-item sum == `round(finalAmount*100)` exactly; no line < 0; `items[].unitPrice` unchanged.
No Stripe-discount follow-up issue needed — covered here via the shared pricing path.
