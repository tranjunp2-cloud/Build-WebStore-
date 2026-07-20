# Phase 01 - Canonical Warehouse Contract And Persistence

## Context

- Plan: [GH-1652 overview](./plan.md)
- Evidence: [Scout report](./reports/scout-report.md)
- Priority: P1
- Estimate: 4h
- Issues covered: 4, 5, 6, 8

## Requirements

- One client-safe implementation canonicalizes a MY phone to digits-only `60...` and validates the post-prefix local number.
- Warehouse input is bounded and sanitized server-side; arbitrary client keys are not persisted.
- Canonical warehouses have stable IDs, trimmed fields, exactly one default when non-empty, and default-first persisted order.
- Disabled EasyParcel may retain an incomplete draft warehouse; activation still requires a complete default warehouse.
- Save returns the canonical persisted settings used to reset the client snapshot.
- Existing tenant ownership/IDOR guard remains unchanged.

## Related Code Files

- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/lib/shipping/easyparcel/phone.ts` - add canonical MY normalization beside split/validation.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/lib/shipping/easyparcel/normalize.ts` - re-export the client-safe phone implementation; remove duplicate behavior.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/lib/shipping/easyparcel/warehouse.ts` - canonicalize/sort/default helpers without mutating caller arrays.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/api/tenant/[id]/easyparcel-save/route.ts` - parse, validate, canonicalize, persist, and return settings.

## Implementation Steps

1. Add `normalizeMyPhone(raw)` to `phone.ts`; derive it from `splitPhone`, return `60${number}`, and keep `hasUsablePhone` based on the actual local number sent to EP.
2. Replace the duplicate server-only `normalizePhone` body with a re-export/alias so label creation and settings use identical rules.
3. Add pure warehouse helpers:
   - trim/whitelist `id`, `label`, `name`, `phone`, `address1`, `address2`, `city`, `state`, `postcode`, `country`, `isDefault`;
   - normalize non-empty phones;
   - enforce deterministic default-first persisted order without in-place sort;
   - assign the first warehouse as default only when none is marked;
   - clear extra defaults.
4. Bound warehouse count and string lengths in the route. Return `400 INVALID_WAREHOUSE` for bad shape/format and keep `EP_NOT_READY` for activation without a complete default.
5. Persist only canonical warehouses plus `enabled`; return `{ success: true, data: { enabled, warehouses } }`.
6. Verify Payload update does not erase OAuth token/identity fields. Lock this with route-call assertions and connected sandbox UAT in Phase 03.

## Edge Cases

- `0123456789`, `60123456789`, spaces/dashes, empty, all-zero, double-prefix, and oversized input.
- Two defaults, no default, empty warehouses, duplicate/missing IDs, and legacy `name` label.
- Deactivated integration with an incomplete seeded pickup address.
- Active integration deleting its last warehouse: Phase 02 drafts `enabled=false` before calling this route.

## Security And Performance

- Never echo or log access/refresh tokens.
- Keep explicit ownership check before Payload `overrideAccess`.
- Reject oversized arrays/fields to avoid unbounded JSON persistence.
- Sorting/normalization is O(n) over a small bounded warehouse list.

## Todo

- [x] Add shared MY phone canonicalization.
- [x] Add non-mutating warehouse canonicalization/default-first persisted ordering.
- [x] Harden save request parsing and response contract.
- [x] Preserve activation and tenant-isolation guards.

## Success Criteria

- Client and server produce the same canonical phone.
- The save route cannot persist malformed/unbounded warehouse JSON.
- Canonical response is deterministic and default-first.
- No schema or migration file changes.
