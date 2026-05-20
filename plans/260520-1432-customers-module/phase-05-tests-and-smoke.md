# Phase 05 — Tests + Smoke Matrix (TC-F25-001..010)

## Context links

- This plan: [plan.md](./plan.md)
- Depends on: phases 02, 03, 04 merged on staging
- Rule: `.claude/rules/testing.md` — every test MUST reference a TC-ID; import from source, never re-implement logic
- TC-ID range proposed: `TC-F25-001` … `TC-F25-010` (new feature id F25-shop-customers)

## Overview

- Date: 2026-05-20
- Priority: P1 (no merge to `main` without green test matrix)
- Implementation status: pending
- Review status: pending
- Description: Author unit + integration tests covering the four risk axes — collection access control, hook idempotency, hook fault tolerance, UI/export tenant isolation. Tester owns test files only (per `.claude/rules/orchestration.md`); no implementation edits.

## Key insights

- The hook (`autoLinkCustomer`) is the highest-risk surface — it MUST never throw under any input. Three explicit fault-injection cases needed (DB failure, missing tenant, malformed email).
- Tenant isolation is a security boundary — verified at 3 layers: collection access rules, list view query, CSV export endpoint.
- DB UNIQUE INDEX is the last-line defence for idempotency — a test should attempt a race scenario (two parallel `payload.create` with same email) and assert exactly one row exists post-test.
- TC-ID document `docs/qa/F25-shop-customers.md` does NOT exist yet — docs-manager creates it post-merge (out of this plan's scope per anti-scope rule "no PRD"). For now, propose IDs inline in test names + table here; docs-manager will materialize.

## Requirements

**Functional**

1. Unit tests for `auto-link-customer.ts` hook (TC-F25-001..005).
2. Unit tests for Customers collection access control (TC-F25-006..007).
3. Integration test for CSV export endpoint tenant isolation (TC-F25-008).
4. Unit test for address `maxRows: 10` enforcement (TC-F25-009).
5. Unit test for rank enum validation (TC-F25-010).

**Non-functional**

- All tests in `src/__tests__/unit/customers/*.test.ts` (and `src/__tests__/integration/customers-export.test.ts` for endpoint).
- Vitest framework (existing project convention); `vi.mock()` at top level.
- No fake data outside test fixtures; never modify implementation files.
- Run time <5s for unit, <15s for integration.

## Architecture

```
src/__tests__/unit/customers/
  auto-link-customer.test.ts        ← TC-F25-001..005
  customers-access.test.ts          ← TC-F25-006..007
  customers-field-validation.test.ts ← TC-F25-009..010

src/__tests__/integration/
  customers-export.test.ts          ← TC-F25-008 (tenant isolation on CSV endpoint)
```

## Related code files

**READ (never modify)**

- `src/collections/Customers.ts`
- `src/collections/Orders.ts` (hook chain)
- `src/collections/orders-hooks/auto-link-customer.ts`
- `src/collections/orders-hooks/sync-customer-snapshot.ts`
- `src/app/api/v1/customers/export/route.ts`

**CREATE**

- `src/__tests__/unit/customers/auto-link-customer.test.ts`
- `src/__tests__/unit/customers/customers-access.test.ts`
- `src/__tests__/unit/customers/customers-field-validation.test.ts`
- `src/__tests__/integration/customers-export.test.ts`

**DELETE**

- None.

## Test matrix

| TC-ID | Layer | Scenario | Expected |
|-------|-------|----------|----------|
| TC-F25-001 | unit (hook) | Create order with email `Foo@Bar.com ` (mixed case, trailing space) | Exactly one Customer row created, key `foo@bar.com`, order.customer = newId |
| TC-F25-002 | unit (hook) | Create 5 orders, same email, same tenant, sequential | Exactly one Customer row; all 5 orders have same `customer_id` |
| TC-F25-003 | unit (hook) | Create order with `customerEmail = ''` | No Customer created; order.customer = null; hook returns without throwing |
| TC-F25-004 | unit (hook) | Create order with `customerEmail = 'not-an-email'` | No Customer created; order.customer = null; no throw |
| TC-F25-005 | unit (hook, fault injection) | Mock `payload.find` to throw `new Error('db down')` | Hook returns; order.customer = null; console.error called with prefix `[Orders.autoLinkCustomer]` |
| TC-F25-006 | unit (access) | Tenant A user reads `payload.find({ collection: 'customers' })` | Result restricted to tenant A rows only |
| TC-F25-007 | unit (access) | Any user calls `payload.delete({ collection: 'customers', id })` | Rejected (`delete: () => false`) |
| TC-F25-008 | integration (export) | Tenant A user `GET /api/v1/customers/export?tenantId=B` | 403 OR results restricted to tenant A (verify response body); never includes tenant B PII |
| TC-F25-009 | unit (field) | Create Customer with 11 addresses | Rejected by Payload validator (maxRows enforced) |
| TC-F25-010 | unit (field) | Create Customer with `rank = 'platinum'` | Rejected (not in enum); valid values `bronze/silver/gold/vip` accepted |

## Implementation steps

1. **Read** all files in the "READ (never modify)" list. Note exact function signatures and exports.
2. **Author** `auto-link-customer.test.ts` covering TC-F25-001..005:
   - Mock `req.payload.find` and `req.payload.create` per scenario.
   - Assert `data.customer` value AND no thrown error.
   - For TC-F25-005, also assert `console.error` was called.
3. **Author** `customers-access.test.ts` covering TC-F25-006..007:
   - Build mock `req.user` with `tenants` array; assert access rules return correct `{ tenant: { in: [...] } }` filter.
   - For TC-F25-007: assert `Customers.access.delete()` returns `false` regardless of user.
4. **Author** `customers-field-validation.test.ts` covering TC-F25-009..010:
   - Use Payload Local API in test (existing test setup) to attempt invalid creates; assert rejection.
   - Alternative: extract field configs from `Customers.fields` and assert option set / maxRows directly (faster, no DB).
5. **Author** `customers-export.test.ts` covering TC-F25-008:
   - Spin up Next route handler in test via `next-test-utils` OR call `route.GET(mockRequest)` directly.
   - Set auth cookie for tenant A user; assert response body never contains tenant B email.
   - Hint: seed two customers (one per tenant) before request.
6. **Run** `npm test src/__tests__/unit/customers` — must be all green.
7. **Run** `npm test src/__tests__/integration/customers-export.test.ts` — must be green.
8. **Run** full suite `npm test` — assert zero existing tests regressed.
9. **Manual** smoke matrix (run after CI green, before merge):
   - Login as tenant-owner → create 3 orders same email → verify single customer in UI.
   - Login as super-admin → CSV export both tenants → verify rows count matches.
   - Login as tenant A → attempt `?tenantId=B` export → expect 403 or own-tenant rows only.

## Todo

- [ ] Read all source files (no edits)
- [ ] Author `auto-link-customer.test.ts` (5 TCs)
- [ ] Author `customers-access.test.ts` (2 TCs)
- [ ] Author `customers-field-validation.test.ts` (2 TCs)
- [ ] Author `customers-export.test.ts` (1 TC, integration)
- [ ] `npm test src/__tests__/unit/customers` green
- [ ] `npm test src/__tests__/integration/customers-export.test.ts` green
- [ ] Full `npm test` no regression
- [ ] Manual smoke 3-scenario matrix recorded in `reports/`

## Success criteria

- All 10 TC-IDs (TC-F25-001..010) implemented with explicit test names referencing the TC-ID.
- Zero test files modify implementation source (tester ownership rule respected).
- Vitest run exits 0 locally and in CI.
- No existing tests regressed.
- Manual smoke results captured in `plans/260520-1432-customers-module/reports/smoke-{date}.md`.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Mocking `req.payload` mismatches actual shape | M×M | Import types from `payload` package; build mock with `Partial<Payload>` cast; cross-check with one integration test that uses real Local API |
| `customers-export.test.ts` flakes on streaming response | L×M | Drain stream fully in test before assertion; set explicit timeout 15s |
| Tenant-isolation test passes locally but fails in CI due to seed ordering | L×M | Use unique tenant IDs per test (`crypto.randomUUID()`); never rely on fixture order |
| Field validation test depends on Payload runtime that isn't booted in unit context | L×L | Use config introspection (read `Customers.fields` array) for cheap assertions; reserve runtime tests for integration suite |
| TC-IDs not yet documented in `docs/qa/F25-*` | L×L | Acceptable — docs-manager creates post-merge; test names embed the TC-ID inline ("TC-F25-001: …") so traceability holds |

## Security considerations

- Tenant-isolation test (TC-F25-006, TC-F25-008) is the security boundary check — if it fails, BLOCK merge.
- No real PII in fixtures; use deterministic emails like `tenant-a@example.test`.
- Mock secrets never include real Payload session tokens; use ephemeral test JWT helper if existing convention.
- `console.error` spy in TC-F25-005 should NOT leak full err.stack to test output if it contains seeded user data (truncate or assert on prefix only).

## Next steps

- After all phases green: hand off to `docs-manager` to:
  - Create `docs/architecture/F25-shop-customers.md`
  - Create `docs/qa/F25-shop-customers.md` with TC-F25-001..010 codified
  - Append to `docs/CHANGELOG.md`
  - Update `docs/CODEBASE_SUMMARY.md` collections list (`customers` slug)
  - Update `docs/migration/pw1-vs-pw2-feature-matrix.md` line 43 + 232 (status flip ❌ → ✅ PW2-side; ETL still pending US-MIGA-12)
- `git-manager` opens PR `feat(f25): shop customers collection + orders linkage` to `staging`.
- Defer to separate plan: ETL PW1→PW2 customers + addresses import (US-MIGA-12).
