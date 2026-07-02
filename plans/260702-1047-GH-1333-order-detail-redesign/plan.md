# F36 — Order Detail Redesign (full-page 2-column)

Redesign the CMS Order Detail from the current right-slide **drawer** (`OrderDetailPanel.tsx`, 1 column)
into the new **full-page 2-column** layout per Claude Design F36 (`f36/screen-c-label.jsx`).
Includes all new states/features: schedule-pickup popover, print-label modal, tracking timeline,
self-delivery (manual) fulfillment, COD-recovery, richer items table.

- **Issue:** GH-1333 (F36 EasyParcel Delivery)
- **Branch:** `feat/1333-F36-easyparcel-delivery`
- **Design:** claude.ai/design project `a2811344-f556-4b61-b1af-abfe95541560`
  - Order detail spec: `f36/screen-c-label.jsx` · list: `f36/screen-c-orders-list.jsx` · shared: `f36/atoms.jsx`
  - Local refs: `plans/260702-1047-GH-1333-order-detail-redesign/design-reference/` (`f36.css` 1187 lines)

## Design decisions (assumptions — confirm before Phase 03/backend)

1. **Routing:** new full-page route `src/app/(dashboard)/orders/[id]/page.tsx`; row click navigates there.
   Remove the drawer overlay from `OrdersClientLayout`.
2. **Items table:** resolve product image/SKU/weight via `depth` on the product relationship;
   fallback to monogram tile + hide SKU/weight when product lacks them.
3. **Missing-data form:** weight-only (schema has `parcelWeight`, no L/W/H). Skip dimensions (YAGNI).
4. **Schedule pickup:** create-label already sets EP collection date (earliest). Post-label "Schedule pickup"
   persists chosen date/slot to a new `pickupScheduledAt` field for record/display (EP reschedule not assumed).
5. **Self-delivery (manual):** new `selfDeliveryCourier` text field + reuse `trackingNumber`; shown when EP
   disabled or no courier selected. New endpoint `POST /orders/[id]/self-deliver`.
6. **COD-blocked:** detect `codAmount>0` + East-MY state (`EAST_MY_STATES`). Recovery offers **Ship manually**
   (self-deliver). "Re-pick EP courier (prepaid)" deferred/flagged — needs payment-switch (out of scope v1).
7. **Print label:** modal wraps existing `labelUrl` PDF (open / download / print). A4/A6 toggle informational.

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 01 | [Schema + backend](phase-01-schema-backend.md) — new fields, migration, self-deliver + pickup endpoints, COD-block flag | ✅ done | — |
| 02 | [Routing + page shell + CSS](phase-02-routing-shell.md) — `/orders/[id]` route, header, progress, 2-col grid, port f36 css | ✅ done | 01 |
| 03 | [Shipping Fulfillment Zone](phase-03-fulfillment-zone.md) — all ActionZone states + schedule popover + print modal + COD recovery + self-delivery | ✅ done | 01,02 |
| 04 | [Order Items table](phase-04-items-table.md) — thumbnail/SKU/weight, expandable, summary | ✅ done | 02 |
| 05 | [Right column + tracking timeline](phase-05-side-tracking.md) — customer/payment/actions cards, BT verify, tracking timeline | ✅ done | 02 |
| 06 | [i18n + tests + docs](phase-06-i18n-tests-docs.md) — locale keys, unit tests, docs/QA | ✅ done | 03,04,05 |

**Integrated** into `order-detail-view.tsx`; `npx tsc --noEmit` + full `next build` pass.

| 07 | Refund flow (PW2 design update) — RefundDialog (amount + reason) + "Refunded" stepper node + `/refund` accepts `reason`; refund stays FULL total (shipping refunded) | ✅ done | 05 |
| 08 | Courier name fix — persist `shippingCourierName` at checkout + display name (not EP code) w/ brand logo; legacy orders fall back to code | ✅ done | 03 |

Code-review (all findings H1/H2/M1-M4/L1-L7) applied + tests green. Phase 07 (refund) added after PW2 design (`a1c23759`) introduced a refund flow. Phase 08 (courier name) from user feedback (design shows name, not code).
Final: `tsc` clean · `check-migrations` pass · `next build` exit 0 · full suite **9213/9213** pass.

## Key files

- Replace: `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` → split into page + sub-components
- Edit: `OrdersClientLayout.tsx`, `OrdersTable.tsx` (row → navigate)
- New: `src/app/(dashboard)/orders/[id]/page.tsx` + `_components/detail/*`
- Backend: `src/collections/Orders.ts` + `scripts/db-setup.js` + `scripts/check-migrations.js`;
  new routes under `src/app/api/orders/[id]/`
- Styles: integrate `f36.css` order-detail classes with existing `--dash-*` tokens
- i18n: `src/i18n/locales/*.json` (`dashboard.orders.detail/actions/progress/*`)

## Constraints

- Schema rule: every new column → `db-setup.js` MIGRATIONS + pass `check-migrations.js` (CI hard gate)
- Keep files < 200 lines — split detail into per-section components
- Import logic from source in tests; TC-IDs from `docs/qa/F14-shipping.md`
- Conventional commits; PR → `staging`; `Relates to #1333`
