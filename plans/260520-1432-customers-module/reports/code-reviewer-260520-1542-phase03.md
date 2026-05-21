# Code Review — Phase 03 (Orders ↔ Customers linkage)

- Plan: `plans/260520-1432-customers-module/phase-03-orders-customer-linkage.md`
- Commit: `40e13ccf` on `feat/F25-customers-module`
- Scope: 2 new hooks, 1 modified collection, 2 migration entries + 1 CI bypass
- Reviewer: code-reviewer (read-only, automated checklist)

## Scope verified

- CREATED `src/collections/orders-hooks/auto-link-customer.ts` (88 LOC incl. header comment)
- CREATED `src/collections/orders-hooks/sync-customer-snapshot.ts` (50 LOC)
- MODIFIED `src/collections/Orders.ts` (+14 LOC — imports + hook wiring + field)
- MODIFIED `scripts/db-setup.js` (+9 LOC — 2 MIGRATIONS entries + 1 CI bypass entry)
- No other files touched. Diff stat: 4 files, 161 insertions, 0 deletions.

## Scores

| Category | Score | Notes |
|---|---|---|
| Correctness — Hook ordering | 10/10 | autoLinkCustomer prepended to beforeChange (`Orders.ts:29`), syncCustomerSnapshot appended to afterChange (`Orders.ts:68`). Existing payment/notification hooks unchanged. |
| Correctness — autoLinkCustomer non-throwing | 10/10 | Entire body in single try/catch (`auto-link-customer.ts:20-87`); catch sets `data.customer = null` and returns; never re-throws. |
| Correctness — Idempotency | 10/10 | `payload.find` by `(tenant, normalized email)` first; only `create` if no row. Relies on Phase 02 unique index `(tenant_id, LOWER(TRIM(email)))` as safety net. |
| Correctness — Skip conditions | 10/10 | Update-with-unchanged-email early return (`:24-26`), empty/invalid email (`:31-34`), missing tenantId (`:42-45`) all handled. Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` matches spec. |
| Correctness — Email normalization | 10/10 | `String(emailRaw).trim().toLowerCase()` (`:28`). Matches `Customers.beforeChange` normalizer at `Customers.ts:38-43`. |
| Correctness — tenantId resolver | 10/10 | Object-or-id narrowing at `:37-40` with null guard. |
| Correctness — overrideAccess scoping | 10/10 | `overrideAccess: true` only with explicit `tenant: { equals: tenantId }` in where (find) and explicit `tenant: tenantId` in create data. Tenant scoping enforced by query, not by access. |
| Correctness — firstOrderAt set once | 10/10 | Only present in `payload.create` data branch (`:74`). Absent from update path in syncCustomerSnapshot. |
| Correctness — syncCustomerSnapshot conditional | 10/10 | Runs only on `operation === 'create'` OR name/phone delta (`:27-32`). |
| Correctness — Snapshot scope | 10/10 | Updates only `name` and `phone` on Customer (`:36-40`). Never touches `email` or `firstOrderAt`. |
| Correctness — No recursion | 10/10 | Verified `Customers.ts:36-45` has only `beforeChange` hook, no `afterChange`. Safe to `payload.update('customers', …)` from Orders.afterChange. |
| Field definition | 10/10 | `name: 'customer'`, `type: 'relationship'`, `relationTo: 'customers'`, `index: true`, `admin.readOnly: true`, `admin.description` populated (`Orders.ts:343-352`). Required is implicit-false. |
| Field position | 10/10 | After `customerPhone`, before `shippingAddress`, inside `// --- Customer ---` block (`Orders.ts:328-352`). |
| Migration — ALTER COLUMN | 10/10 | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer` at `db-setup.js:4027-4028`. Idempotent. |
| Migration — Index | 10/10 | `CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id)` at `db-setup.js:4029-4030`. Idempotent. |
| Migration — No destructive SQL | 10/10 | No DROP. |
| CI bypass entry | 10/10 | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer` registered in `/* */` bypass block at `db-setup.js:4515-4517`. Matches existing `payment_verified_by` pattern (`:4513`). Acceptable tech-debt workaround for `check-migrations.js` relationship-field derivation. |
| LOC | 10/10 | auto-link-customer.ts 88 LOC, sync-customer-snapshot.ts 50 LOC. Combined 138 LOC — under 200 target. |
| Type imports | 10/10 | `CollectionBeforeChangeHook` and `CollectionAfterChangeHook` imported from `payload` (single source). Hook imports added at top of `Orders.ts` (no inline imports). |
| Type safety | 10/10 | Tenant narrowed via `typeof === 'object' && != null` then cast to `{ id: string \| number }`. No bare `any`. `id as string` cast in sync hook is acceptable since Payload IDs are runtime-string. |
| Security — No PII logging | 10/10 | `console.error('[Orders.autoLinkCustomer] failed', err)` and `console.error('[Orders.syncCustomerSnapshot] failed', err)` only. Email/name/phone never appended to log payload. |
| Security — Race condition handling | 9/10 | Two parallel orders with same email both reach `payload.create`; second insert hits unique constraint and throws PG 23505 → caught by outer try/catch → `data.customer = null` + log. Order itself succeeds (non-throwing). Phase spec explicitly accepts this path; spec also mentioned "retry find once" as alternative — agent chose the simpler null+log fall-through, which is acceptable. See observational note below. |
| Anti-scope — No Customers.ts changes | 10/10 | Confirmed via diff. |
| Anti-scope — No UI / tests / backfill .ts | 10/10 | None present in commit. Backfill stays pseudocode in phase markdown. |

**Overall: 9.96 / 10**

## Findings

No CRITICAL or MAJOR findings.

### MINOR / observational (non-blocking)

1. `[MINOR] auto-link-customer.ts:67-78` — On race-loss to unique constraint (PG 23505), implementation falls through to `data.customer = null` + log. Phase spec accepted either this path or a one-shot retry-find. Current choice is simpler and consistent with the non-throwing contract; the orphan-backfill script can clean up rare null-FK rows. No fix needed unless QA flags real production frequency. Fix (if ever needed): in catch, detect `err.code === '23505'`, retry `payload.find` once, set FK. Out of scope for this phase.

2. `[MINOR] sync-customer-snapshot.ts:36-40` — When the Customer was just created in `autoLinkCustomer`, this hook will fire a redundant `payload.update` with identical name/phone (since `operation === 'create'` always triggers, regardless of whether anything changed). Cost: 1 extra UPDATE per first-ever order per customer. Negligible. Fix (optional): also gate the `create` branch on `previousDoc === undefined && doc.customer` AND values differ from what autoLinkCustomer just wrote. Not worth the complexity right now.

3. `[MINOR] db-setup.js:4515-4517` — The CI bypass block keeps accreting per-relationship entries (now: `payment_verified_by`, `customer`). This is tech debt in `check-migrations.js` itself, not in the migration. Long-term fix: teach `check-migrations.js` to derive `{field}_id` for `type: 'relationship'` fields automatically (similar to KNOWN_GROUP_PREFIXES). Track separately; not a blocker.

## Positive observations

- Hook ordering choice (append `syncCustomerSnapshot`, not prepend) is correct even though the existing notification hook doesn't read `doc.customer` today — keeps the snapshot write off the critical path of buyer-facing notifications.
- `phone: data.customerPhone ?? null` (auto-link-customer.ts:73) and `phone: doc.customerPhone ?? null` (sync-customer-snapshot.ts:39) consistently coerce undefined → null, avoiding Payload type-validation noise.
- Comment headers on both hook files clearly document the contract (non-throwing, idempotent, no recursion), which will save future debuggers reading-time.
- `id as string` cast in `sync-customer-snapshot.ts:36` matches Payload runtime convention; alternative would have required a generic on the hook type.
- Bypass comment at `db-setup.js:4513-4514` and `:4515-4516` explicitly documents the workaround reason — good defensive doc.

## RECOMMENDATION: AUTO-APPROVE — proceed to Phase 04

Score 9.96 ≥ 9.5 with zero critical and zero major findings. Phase 03 is production-ready.

## Unresolved questions

None.

**Status:** DONE
**Summary:** Phase 03 scored 9.96/10 with zero critical/major findings. AUTO-APPROVE — proceed to Phase 04.
**Concerns/Blockers:** None.
