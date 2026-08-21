# Phase 04 - July 22 QA Follow-up UI And Responsive Fixes

**Status:** Completed

## Context

- Plan: [GH-1652 overview](./plan.md)
- Depends on: [Phase 02](./phase-02-settings-workflow-and-ui.md)
- Can run independently from the connected-sandbox UAT still pending in Phase 03.
- Priority: P1
- Estimate: 8h
- Source: issue comments `#issuecomment-5042880413` and `#issuecomment-5042950394`

## Scope Guard

This phase changes presentation and component composition only. It must not change:

- EasyParcel OAuth, token, connection, save, or warehouse canonicalization contracts;
- courier selection, label creation, AWB persistence, tracking, or order status transitions;
- Payload collections, SQL schema, API routes, or environment variables;
- shared checkbox/button behavior outside the affected EasyParcel screens.

## Workstream A - EasyParcel Settings (Six Findings)

### Files

- `src/app/(dashboard)/settings/shipping/easyparcel-settings-tab.tsx`
- `src/app/(dashboard)/settings/shipping/ep-setup-stepper.tsx`
- `src/app/(dashboard)/settings/shipping/pickup-addresses.tsx`
- `src/__tests__/unit/dashboard/easyparcel-settings-tab.test.tsx`
- `src/__tests__/unit/dashboard/ep-setup-stepper.test.tsx`
- `e2e/f36-easyparcel-settings.spec.ts`

### Implementation

1. Scope checked-state foreground styling to the two EasyParcel default-warehouse checkboxes so the check icon is explicitly white in light and dark mode. Do not modify `src/components/ui/checkbox.tsx`.
2. Make the disconnected EasyParcel brand mark 42x42 below `sm`, retaining the current desktop size.
3. Top-align the connected-state brand mark on mobile; retain the desktop header alignment.
4. Remove circular outlines from setup-step indicators. Preserve clear active/completed/inactive fills and force the completed check to white in both themes.
5. Replace custom 44px Back/Next overrides with the existing dashboard-standard button size. Preserve disabled/loading behavior and full-width mobile layout where already required.
6. Add visible required markers to Label, Phone, Address Line 1, State, City, and Postcode. Keep Address Line 2 explicitly optional and preserve existing validation.

### Acceptance Checks

- At 390px, disconnected logo is exactly 42x42.
- In connected state at 390px, the logo starts at the top of the header content.
- Default warehouse checks are white in light and dark mode.
- Setup nodes have no ring/border and completed checks are white.
- Back/Next match standard dashboard control height.
- All six required warehouse labels show `*`; Address Line 2 does not.

## Workstream B - Order Progress Composition And Mobile Layout (Two Findings)

### Files

- `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx`
- `src/app/(dashboard)/orders/_components/order-detail-view.tsx`
- `src/app/(dashboard)/orders/order-detail.css`
- `e2e/orders-flow.spec.ts`

### Implementation

1. Add an explicit embedded presentation to `OrderProgress`:
   - standalone mode retains its card and heading for the drawer;
   - embedded mode renders only the stepper body inside the full-page `.od-card`;
   - use embedded mode from `order-detail-view.tsx`, leaving exactly one page-level heading.
2. Remove fixed mobile height assumptions from the embedded stepper. Give the step track an explicit minimum width and keep horizontal scrolling on the stepper viewport, not on the page/card.
3. Keep all five statuses, icons, labels, active-state calculation, and refunded behavior unchanged.

### Acceptance Checks

- Full order page contains one visible `ORDER PROGRESS` heading.
- Drawer still contains its own heading and card.
- At 390px and 481px, every progress step is reachable by horizontal scrolling; no label is clipped by a fixed-height container.
- The document itself has no horizontal overflow.

## Workstream C - Courier And AWB Mid-width Wrapping (One Finding)

### Files

- `src/app/(dashboard)/orders/_components/detail/fulfillment.css`
- `src/app/(dashboard)/orders/order-detail.css`
- `e2e/orders-flow.spec.ts`

### Implementation

1. Add `min-width: 0` to the order-detail main column, fulfillment fields, copy-field wrapper, and AWB value where needed so long content can shrink.
2. At the affected 1167-1270px range, stack the Courier and Tracking AWB fields within Shipping Fulfillment at full width.
3. Preserve the existing 65/35 Shipping Fulfillment / Customer Information desktop grid and current mobile breakpoint; do not move Customer Information or alter fulfillment state.

### Acceptance Checks

- At 1167px, 1200px, and 1270px, Courier and Tracking AWB stay inside Shipping Fulfillment.
- Long AWB values wrap or truncate according to the existing copy-field behavior without covering Customer Information.
- At widths above the follow-up breakpoint, the existing desktop row remains unchanged.

## Regression Strategy

1. Extend existing component tests with class/variant assertions for logo sizing, step states, required markers, and button sizing.
2. Extend `e2e/f36-easyparcel-settings.spec.ts` with 390px light/dark screenshots and geometry assertions.
3. Extend `e2e/orders-flow.spec.ts` with:
   - one-heading assertion;
   - 390px/481px stepper scrollability and page-overflow checks;
   - 1167px/1200px/1270px fulfillment/customer overlap checks using bounding boxes.
4. Run focused Vitest, Playwright, typecheck, and diff validation.

## Validation Commands

```bash
npx vitest run \
  src/__tests__/unit/dashboard/easyparcel-settings-tab.test.tsx \
  src/__tests__/unit/dashboard/ep-setup-stepper.test.tsx
npx playwright test e2e/f36-easyparcel-settings.spec.ts e2e/orders-flow.spec.ts --project=chromium
npm run typecheck
git diff --check
```

## Execution Order

1. Settings visual corrections.
2. OrderProgress standalone/embedded split.
3. Mid-width fulfillment wrapping.
4. Component tests.
5. Browser tests at all target viewports.
6. Manual light/dark review and final diff audit to confirm no business-logic changes.

## Done Definition

- All nine July 22 feedback items pass.
- Existing settings persistence/OAuth and fulfillment lifecycle tests remain green.
- Diff contains no API, collection, migration, environment, or shipping business-logic changes.
- No new dependency is added.

## Execution Record

- Completed the six EasyParcel settings presentation/accessibility corrections in the existing disconnected, setup, connected, and pickup-address workflows.
- Added standalone and embedded `OrderProgress` presentations so the full order page has one heading while the drawer retains its existing card.
- Contained the progress track on mobile and stacked Courier/AWB fields within Shipping Fulfillment at 1167-1270px.
- Added focused component coverage and browser regression scenarios for the reported viewport ranges.
- Verification:
  - focused Vitest: 4 files, 33/33 tests passed;
  - `npm run typecheck`: passed;
  - `git diff --check`: passed;
  - Playwright discovery: 11 tests found across setup and the two affected E2E files;
  - full browser execution remains pending because this worktree does not have `TEST_EMAIL` and `TEST_PASSWORD`.
- Phase 03 connected-sandbox UAT remains in progress and is not closed by this implementation.
