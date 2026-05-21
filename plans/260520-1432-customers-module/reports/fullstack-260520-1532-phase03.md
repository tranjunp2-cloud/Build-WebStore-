# Phase 03 Implementation Report

## Phase
- Phase: phase-03-orders-customer-linkage
- Plan: /Users/tranthibichdung/Desktop/ech-prime-web-v2/plans/260520-1432-customers-module/
- Status: completed
- Commit: 40e13ccf (feat/F25-customers-module)

## Files Modified

| File | Action | LOC added |
|------|--------|-----------|
| `src/collections/orders-hooks/auto-link-customer.ts` | CREATED | 75 |
| `src/collections/orders-hooks/sync-customer-snapshot.ts` | CREATED | 50 |
| `src/collections/Orders.ts` | MODIFIED | +14 (2 imports, prepend hook, append hook, +customer field) |
| `scripts/db-setup.js` | MODIFIED | +9 (2 MIGRATIONS entries + 1 CI bypass comment) |

## Hook code summary

**`autoLinkCustomer` (beforeChange)**
- Early-exit on `operation === 'update'` with unchanged `customerEmail` (perf)
- Normalises: `String(emailRaw).trim().toLowerCase()`; validates via `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Resolves `tenantId` from either object (`data.tenant.id`) or scalar
- `payload.find` with `{ tenant: equals, email: equals }`, depth 0, overrideAccess
- On miss: `payload.create` with `{ tenant, email, name, phone, firstOrderAt: new Date().toISOString() }`; `firstOrderAt` set only on create
- Entire body in try/catch; on error: `console.error('[Orders.autoLinkCustomer] failed', err)` (no PII logged) + `data.customer = null`; never throws

**`syncCustomerSnapshot` (afterChange)**
- Resolves `customerId` from `doc.customer` (object or scalar); skips if null
- Only updates Customer when `operation === 'create'` OR `customerName`/`customerPhone` differ from `previousDoc`
- `payload.update` with `{ name, phone }`, depth 0, overrideAccess; no recursion risk (Customers has no afterChange hook per phase-02)
- Entire body in try/catch; logs on error; never throws; always returns `doc`

**`Orders.ts` wiring**
- 2 import lines at top
- `beforeChange`: `[autoLinkCustomer, existingPaymentStatusHook]` — prepended as required
- `afterChange`: `[existingNotificationHook, syncCustomerSnapshot]` — appended as required
- `customer` relationship field added after `customerPhone` field (line ~338): `type: 'relationship', relationTo: 'customers', index: true, admin: { readOnly: true }`

## Migration entries

| Name | SQL |
|------|-----|
| `orders.customer` | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer;` |
| `orders.customer_id_index` | `CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);` |
| CI bypass (comment) | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer` (inside `/* */` block, F25 phase-03 section) |

## Verification results

- `node scripts/check-migrations.js origin/staging` → **exit 0** ✓
- `npm run build` → **Compiled successfully** ✓ (83 static pages generated, no TS errors)
- `git diff --stat` shows exactly the 4 expected files ✓

## Deviation from spec + rationale

**CI bypass entry added** (not in original spec):
- The `check-migrations.js` script matches new relationship fields by bare snake_case field name (`orders.customer`), but `getMigrationColumns()` builds its set from SQL `ADD COLUMN` column names — which for a relationship FK is `customer_id` (not `customer`).
- The existing project pattern for this exact scenario is a CI bypass comment block (see `payment_verified_by` bypass at line ~4511 of db-setup.js, with explicit comment "bare name registered here so check-migrations CI can match the field name").
- Added `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer` inside the existing `/* */` bypass block following the same comment pattern. This does NOT execute against the DB (it's in a comment block); it only satisfies the regex scanner.
- The actual DB column `customer_id integer` is still created by the real MIGRATIONS entry.

**Migration entry name changed**: spec said `name: 'orders.customer_id'`; changed to `name: 'orders.customer'` to match check-migrations convention (name = `table.fieldSnakeCase` not `table.columnName`). No functional impact — the `name` field is only a registry key, not used in SQL execution.

## Unresolved questions

None.
