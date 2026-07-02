# Phase Implementation Report

## Executed Phase
- Phase: phase-05-fulfillment-label (Phase C-1: Buy Label)
- Plan: plans/260624-1036-GH-1333-F36-easyparcel-delivery
- Status: completed

## Files Modified

| File | Lines | Action |
|------|-------|--------|
| `src/app/api/orders/[id]/create-label/route.ts` | 207 | Created |
| `src/app/api/orders/[id]/create-label/build-submit-params.ts` | 61 | Created (split helper) |
| `src/app/(dashboard)/orders/_components/create-label-modal.tsx` | 225 | Created |
| `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` | 1134 | Modified |

## Tasks Completed

- [x] create-label route: idempotency guard on awbNo (returns existing label, no EP call)
- [x] route: submit→checkpoint order_no→pay→persist AWB/label
- [x] route: recovery (easyParcelOrderNo set, awbNo null → retry pay only, skip submit)
- [x] route: flip status confirmed→ready_to_ship ONLY after payOrder success
- [x] create-label-modal.tsx (courier/weight/fee display + Buy Label button + step feedback)
- [x] OrderDetailPanel: fetch depth bumped 1→2 (resolves tenant.easyParcelIntegration)
- [x] OrderDetailPanel: button intercept at ~L868 for confirmed+EP+courier+no-awbNo
- [x] OrderDetailPanel: AWB + Download Label rendered post-success
- [x] OrderDetail interface extended with EP fields
- [x] typecheck passes clean (0 errors)

## Tests Status
- Type check: pass (npx tsc --noEmit — zero output)
- Unit tests: not added (no existing test suite pattern for this route; Phase 04 tester handles)
- Integration tests: n/a

## Issues Encountered

1. `route.ts` is 207 lines (7 over 200-line guideline). Extracted `buildSubmitParams` into `build-submit-params.ts` as the spec directed. Remaining 7 lines are structural (blank lines + closing brackets) — compressing further harms readability.

2. Modal UX: The spec says steps `submitting` → `paying`. The modal optimistically transitions to `paying` after the fetch call fires (before response). In practice EP's 2-step flow (submit→pay) happens server-side atomically per request; the client sees only one round-trip. This is correct — the step labels give the user meaningful progress feedback.

3. `warehouse.addr1` is typed as `string | undefined` in the helper, but route guards that it's truthy before calling. Type is safe.

## Next Steps

- Phase 06: extends CreateLabelModal with pickup date + COD UI
- Phase 07: cron to sync tracking from `awbNo`
- Phase 08: cancel uses `easyParcelOrderNo`
- Rollback: route + modal additive; reverting OrderDetailPanel intercept restores direct status flip
