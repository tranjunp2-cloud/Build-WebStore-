# Phase 01 — Secure data contract and loader

## Context Links

- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1627
- Plan: [plan.md](./plan.md)
- Existing query reference: `src/app/api/dashboard/summary/route.ts:67`
- Orders schema: `src/collections/Orders.ts`
- Auth helpers: `src/lib/auth.ts:152-185`

## Overview

- **Priority:** P1 foundation
- **Status:** Completed
- **Effort:** 2h
- Extend the existing dashboard data contract and add one tenant-scoped Payload loader with a strict widget-local permission predicate. Do not change global route authorization.

## Key Insights

- Payload Local API defaults `overrideAccess` to `true`; set `user` and `overrideAccess: false` explicitly.
- Collection access and tenant `where` prevent cross-tenant reads, but do not enforce the repo's custom `orders` permission. The widget predicate and loader must both enforce it.
- `/orders?status=pending` maps to a broader status group; this issue explicitly requires raw `pending` only.
- Orders totals are major units. Legacy dashboard item count semantics sum `items[].quantity`.
- Raw order documents contain PII. Only a DTO may cross into the client component.
- Global `requirePermission` currently protects nine route layouts. Changing its legacy semantics is intentionally deferred from this widget PR.

## Requirements

### Functional

- Return `{ orders, totalCount }` for at most five newest exact-pending orders.
- Each row contains only `id`, `orderNumber`, `itemCount`, `total`, `currency`, and literal `status: 'pending'`.
- Sum valid numeric quantities; treat absent/non-numeric quantities as zero without throwing.

### Non-functional

- Tenant isolation in every query.
- No `any`; reuse generated Payload/User types or narrow `unknown` values.
- Loader derives the primary tenant from its authenticated user and enforces a strict local `orders` permission predicate before Payload initialization.
- No schema, migration, environment, new endpoint, or cache work.

## Architecture

```text
Dashboard Server Component
  -> getCurrentUser()
  -> canReadPendingOrders(user) [visibility/optimization]
  -> getPendingOrdersData({ user })
       -> re-check canReadPendingOrders + tenantIdForQuery(user) [security boundary]
       -> Payload find orders (tenant AND exact pending, newest first, limit 5)
       -> map raw docs to PendingOrdersData DTO
  -> PendingOrders client component receives DTO only
```

Recommended query contract:

```ts
payload.find({
  collection: 'orders',
  where: { and: [
    { tenant: { equals: tenantId } },
    { status: { equals: 'pending' } },
  ] },
  sort: '-createdAt',
  limit: 5,
  depth: 0,
  user,
  overrideAccess: false,
  select: {
    id: true,
    orderNumber: true,
    items: { quantity: true },
    total: true,
    currency: true,
    status: true,
  },
})
```

## Related Code Files

| Action | Absolute path | Change |
|---|---|---|
| Modify | `./src/lib/dashboard/dashboard-types.ts` | Add `PendingOrderRow`, `PendingOrdersData`, and ready/unavailable load state to the existing shared revamp types. |
| Create | `./src/lib/dashboard/pending-orders-data.ts` | Implement secure query and DTO mapper. |
| Create | `./src/__tests__/unit/dashboard/pending-orders-data.test.ts` | Verify query contract and mapping from source code. |

## Implementation Steps

1. Export `canReadPendingOrders(user)` from the new loader module as a synchronous, widget-local predicate.
   - unauthenticated or no primary tenant => `false`; super-admin still needs a tenant to load tenant-scoped dashboard data.
   - non-super-admin requires `status === 'active'` plus an explicit valid role.
   - `owner/admin/editor/viewer` or custom role containing `orders` => `true`; pending/suspended/missing status, missing/unknown role, or missing permission => `false`.
   - Do not import or modify `requirePermission` or `PlatformUser`; narrow the unknown user shape locally without `any`.
2. Extend the existing `dashboard-types.ts`.
   - Keep ID as `string | number`, currency as `MYR | USD | SGD`, and status literal `pending`.
   - Represent loader outcome explicitly: ready data versus unavailable, while ready + `orders: []` remains the authorized empty state.
3. Implement `getPendingOrdersData({ user })` as the security boundary.
   - Re-check `canReadPendingOrders(user)`, derive `tenantIdForQuery(user)` internally, and reject before `getPayload` when either fails.
   - Use `depth: 0`, nested item-quantity select, document `id`, `overrideAccess: false`, exact status, limit, and sort. If generated Payload types reject nested array selection, retain `items: true` without `any` and rely on the strict DTO boundary.
   - Treat null/undefined legacy currency as MYR because the schema default is MYR; reject unknown non-empty currency strings and non-finite required totals. Phase 02 converts those failures to the unavailable state.
   - Map defensively and return `result.totalDocs`, not `orders.length`, as total count.
4. Add loader/predicate tests under TC-F03.03 and TC-F03.73.
   - Assert denied/no-tenant users fail before Payload is called; caller cannot inject a different tenant.
   - Assert derived tenant/status `and` filter, sort, limit, depth, selected fields, user, and access override.
   - Assert quantity summation, document ID preservation, major-unit total, valid/legacy currency handling, invalid-total rejection, and totalDocs mapping.
   - Mock Payload at file top and use AAA comments per `docs/TEST_CONVENTION.md`.

## Todo List

- [x] Add and test pure permission predicate.
- [x] Extend the existing dashboard DTO file with rows and load state.
- [x] Implement secure loader and mapper.
- [x] Add loader unit coverage for query and edge mapping.

## Success Criteria

- Loader cannot query outside the authenticated tenant and never returns raw docs/PII.
- Query is exact `pending`, newest first, capped at five, but exposes full matching `totalCount`.
- Global permission redirect behavior is untouched.
- No new TypeScript `any` or collection/environment change.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `overrideAccess: false` is mistaken for custom RBAC | Enforce the widget-local predicate inside loader; page predicate remains an optimization. |
| `totalDocs` differs from rendered row count | Treat this as intentional AC01 behavior and test count > 5. |
| Relationship-heavy items inflate query | `depth: 0`, minimal select, limit 5; map only quantity. |
| Future F10 statuses alter meaning | Lock to issue's raw `pending`; status redesign remains separate. |
| Widget predicate diverges from global legacy guard | Intentional local safety boundary; track global alignment as a separate security issue. |

## Security Considerations

- Defense in depth is loader-owned authenticated user + strict widget-local permission + derived tenant `where` + `overrideAccess: false`.
- Do not log documents, emails, addresses, or user tokens.
- Never accept tenant ID from search params/client input.

## Next Steps

Phase 01 is complete: focused validation passed 27/27 tests, typecheck passed, and code review scored 9.8/10 with no critical findings or warnings. Phase 02 consumes only the DTO and predicate defined here.
