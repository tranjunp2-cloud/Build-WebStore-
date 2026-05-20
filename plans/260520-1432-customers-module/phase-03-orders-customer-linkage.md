# Phase 03 — Orders → Customer FK + Auto-Link Hook + Orphan-Backfill Outline

## Context links

- This plan: [plan.md](./plan.md)
- Depends on: [phase-02-customers-collection-schema.md](./phase-02-customers-collection-schema.md)
- Touches: `src/collections/Orders.ts:25-65` (existing hooks), `:263-289` (existing customer snapshot fields)
- Rule: `.claude/rules/database-schema.md`

## Overview

- Date: 2026-05-20
- Priority: P0 (Customers without Orders linkage is half-feature)
- Implementation status: completed
- Review status: completed (score: 9.96/10)
- Commit: 40e13ccf
- Description: Add nullable `customer` relationship to Orders. Extend Orders `beforeChange` hook to upsert-and-link Customer by `(tenant_id, lower(trim(email)))`. Preserve denormalized snapshot fields (`customerEmail`, `customerName`, `customerPhone`, `shippingAddress`) untouched for historical orders. Outline orphan-backfill script (DO NOT run, DO NOT add to db-setup).

## Key insights

- Hook must be **non-throwing** — order creation cannot fail because of customer-link issues (R3). Wrap all customer upsert logic in try/catch; on error, log + leave `data.customer = null` and proceed.
- Hook must be **idempotent** — same email + same tenant repeated 5 times yields ONE customer, FK populated 5 times. DB UNIQUE INDEX from phase-02 is the safety net; hook does `payload.find` first then `create` or `update` if found.
- Email validity gate: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` AFTER `trim().toLowerCase()`. Empty/invalid → skip link, FK stays null.
- Snapshot updates: when Customer linked AND `customerName/Phone` differ from latest, update Customer's `name/phone` to latest order's values (PW1 behaviour). Trade-off accepted: latest-wins overwrites older snapshot — acceptable because Orders.customerName remains as immutable historical record.
- `firstOrderAt`: set when Customer row newly created in this hook. Never updated.
- Backfill: orphan orders (with email but no `customer` FK) exist for ALL pre-merge orders. Phase only OUTLINES the script (`scripts/backfill-customers-from-orders.ts`) — does NOT add it to `MIGRATIONS` (migrations are schema only, not data). Script execution deferred to a future ops task with PM sign-off.
- **Cutover sequence (PM 2026-05-20)**: US-MIGA-12 ETL imports PW1 customer rows into `customers` table FIRST → orphan-order backfill script runs SECOND. Rationale: pre-populated customers let the orphan scan match historical orders by `(tenant_id, lower(email))` via the unique index, avoiding duplicate auto-create noise from the hook's upsert path. The backfill script must be written to be a pure linker (UPDATE `orders.customer_id` only) and MUST NOT auto-create new customer rows during the post-ETL run.

## Requirements

**Functional**

1. Add `customer` field to Orders:
   - `name: 'customer'`, `type: 'relationship'`, `relationTo: 'customers'`, required: false, index: true.
   - Place after existing `customerEmail/Name/Phone` block (`Orders.ts:263-277`) to keep snapshot grouped together.
2. Extend `Orders.hooks.beforeChange` with a new step (running BEFORE the existing payment/cancel logic):
   - Skip if `operation !== 'create'` AND `data.customerEmail` unchanged (preserve performance on updates).
   - Normalize email: `const email = (data.customerEmail || '').trim().toLowerCase()`.
   - Validate: if empty OR fails regex → `data.customer = null`; return.
   - Look up: `payload.find({ collection: 'customers', where: { and: [ { tenant: { equals: data.tenant } }, { email: { equals: email } } ] }, limit: 1, depth: 0 })`.
   - If found: `data.customer = existing.id`; optionally update name/phone if changed (in `afterChange` hook to avoid recursion).
   - If not found: `payload.create({ collection: 'customers', data: { tenant: data.tenant, email, name: data.customerName, phone: data.customerPhone, firstOrderAt: new Date() }, overrideAccess: true, depth: 0 })`. Set `data.customer = created.id`.
   - All wrapped in try/catch; on error: `console.error('[Orders] customer auto-link failed', err); data.customer = null`.
3. Migration entry to add `customer_id` column to existing `orders` table (idempotent ALTER).
4. Outline doc only: `scripts/backfill-customers-from-orders.ts` (NOT executed, NOT added to MIGRATIONS).

**Non-functional**

- Hook adds ≤1 DB roundtrip on order create (find), +1 conditional (create). Acceptable for order-create P50 budget.
- Zero behavioural change to Orders' existing `paymentStatus`/`cancelled` logic — new hook step prepended, independent.
- All existing Orders tests still pass.

## Architecture

```
src/collections/Orders.ts                    ← MODIFY
  hooks: {
    beforeChange: [
      autoLinkCustomer,                      ← NEW (prepend)
      existingPaymentStatusHook,             ← UNCHANGED
    ],
    afterChange: [
      existingNotificationHook,              ← UNCHANGED
      syncCustomerSnapshot,                  ← NEW (append, optional update of name/phone)
    ],
  }
  fields: [
    ...existing...,
    { name: 'customerEmail', ... },          ← UNCHANGED (denormalized)
    { name: 'customerName',  ... },          ← UNCHANGED
    { name: 'customerPhone', ... },          ← UNCHANGED
    { name: 'shippingAddress', group: ... }, ← UNCHANGED
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true }, ← NEW
    ...
  ]

scripts/db-setup.js                          ← +1 migration entry
  { name: 'orders.customer_id',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer;` }

scripts/backfill-customers-from-orders.ts    ← OUTLINE ONLY (pseudocode below)
  - NOT in MIGRATIONS array
  - NOT executed by phase
  - Documented for future ops task
```

Data flow on order create:

```
POST /api/orders { customerEmail: 'Foo@Bar.com ', customerName: 'Foo', tenant: T1, ... }
   ↓ Orders.beforeChange[0] = autoLinkCustomer
   ↓ email = 'foo@bar.com'
   ↓ find customer where (tenant=T1, email='foo@bar.com')
   ↓ found? → data.customer = id  | not found? → create + data.customer = newId
   ↓ catch? → log + data.customer = null
   ↓ Orders.beforeChange[1] = existing payment logic
   ↓ INSERT INTO orders (..., customer_id, customer_email='Foo@Bar.com', customer_name='Foo')
   ↓ Orders.afterChange[N] = syncCustomerSnapshot (if name/phone diff, update Customer)
```

## Related code files

**READ**

- `src/collections/Orders.ts` (full — understand existing hooks)
- `src/collections/Customers.ts` (from phase-02)
- Payload Local API docs (`payload.find`, `payload.create`, `payload.update` with `overrideAccess`)

**MODIFY**

- `src/collections/Orders.ts` (add `customer` field + extend hooks)
- `scripts/db-setup.js` (1 ALTER COLUMN migration entry)

**CREATE**

- `src/collections/orders-hooks/auto-link-customer.ts` (NEW; split helper to keep `Orders.ts` ≤350 LOC)
- `src/collections/orders-hooks/sync-customer-snapshot.ts` (NEW; afterChange helper)

**DELETE**

- None.

**OUTLINE-ONLY (do not implement)**

- `scripts/backfill-customers-from-orders.ts` — pseudocode in step 5 below; left for future ops task.

## Implementation steps

1. **Verify** phase-02 merged AND `customers` table live on staging (`psql` smoke).
2. **Create** `src/collections/orders-hooks/auto-link-customer.ts`:

   ```ts
   // pseudocode
   export const autoLinkCustomer: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
     try {
       const emailRaw = data.customerEmail ?? ''
       if (operation === 'update' && originalDoc?.customerEmail === emailRaw) return data
       const email = String(emailRaw).trim().toLowerCase()
       const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
       if (!emailValid) { data.customer = null; return data }
       const tenantId = typeof data.tenant === 'object' ? data.tenant.id : data.tenant
       if (!tenantId) { data.customer = null; return data }
       const found = await req.payload.find({
         collection: 'customers',
         where: { and: [ { tenant: { equals: tenantId } }, { email: { equals: email } } ] },
         limit: 1, depth: 0, overrideAccess: true,
       })
       if (found.docs[0]) { data.customer = found.docs[0].id; return data }
       const created = await req.payload.create({
         collection: 'customers',
         data: { tenant: tenantId, email, name: data.customerName || '(unknown)', phone: data.customerPhone, firstOrderAt: new Date().toISOString() },
         overrideAccess: true, depth: 0,
       })
       data.customer = created.id
       return data
     } catch (err) {
       console.error('[Orders.autoLinkCustomer] failed', err)
       data.customer = null
       return data
     }
   }
   ```

3. **Create** `src/collections/orders-hooks/sync-customer-snapshot.ts`:

   ```ts
   // pseudocode — only run on create or when name/phone changed
   export const syncCustomerSnapshot: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
     try {
       const customerId = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
       if (!customerId) return doc
       const changed =
         operation === 'create' ||
         doc.customerName  !== previousDoc?.customerName ||
         doc.customerPhone !== previousDoc?.customerPhone
       if (!changed) return doc
       await req.payload.update({
         collection: 'customers',
         id: customerId,
         data: { name: doc.customerName, phone: doc.customerPhone },
         overrideAccess: true, depth: 0,
       })
     } catch (err) {
       console.error('[Orders.syncCustomerSnapshot] failed', err)
     }
     return doc
   }
   ```

4. **Wire** into `src/collections/Orders.ts`:
   - Add imports.
   - Prepend `autoLinkCustomer` to `hooks.beforeChange`.
   - Append `syncCustomerSnapshot` to `hooks.afterChange`.
   - Add field after line 277 (`customerPhone`):
     ```ts
     { name: 'customer', type: 'relationship', relationTo: 'customers', index: true,
       admin: { description: 'Auto-linked customer record (matched by email + tenant).', readOnly: true } },
     ```
5. **Outline** `scripts/backfill-customers-from-orders.ts` (DO NOT execute; commit as `.ts.draft` OR in plan docs only — preferred: keep in this phase doc as pseudocode, no file created):

   ```ts
   // PSEUDOCODE — not part of MIGRATIONS, not run by phase.
   // Pre-requisite: US-MIGA-12 ETL has already inserted PW1 customer rows.
   // This script is a PURE LINKER — never creates new customer rows post-ETL.
   //
   // Iterate orders WHERE customer_id IS NULL AND customer_email IS NOT NULL
   //   normalize email = lower(trim(customer_email))
   //   SELECT id FROM customers WHERE tenant_id = ? AND lower(trim(email)) = ?
   //   IF found:  UPDATE orders SET customer_id = ? WHERE id = ?
   //   IF MISSING: log to backfill-misses.log (do NOT create) — surface to PM for review
   // Run in batches of 500. Idempotent: re-runs skip orders that already have customer_id.
   ```

6. **Add** to `scripts/db-setup.js` MIGRATIONS array (single entry):

   ```js
   { name: 'orders.customer_id',
     sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer;` },
   { name: 'orders.customer_id_index',
     sql: `CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);` },
   ```

7. **Run** `node scripts/check-migrations.js origin/staging` → exit 0.
8. **Run** `npm run build` → green.
9. **Manual smoke**: create 3 orders with same email + same tenant → assert exactly 1 customer row; assert all 3 orders have non-null `customer_id`.
10. **Manual smoke**: create order with `customerEmail = ''` → assert customer row count unchanged, order's `customer_id` is null, no error.

## Todo

- [x] Phase 02 merged on staging
- [x] Create `auto-link-customer.ts` helper
- [x] Create `sync-customer-snapshot.ts` helper
- [x] Wire hooks + field into `Orders.ts`
- [x] Add 2 migration entries to `db-setup.js` (column + index)
- [x] `check-migrations.js` exit 0
- [x] `npm run build` green
- [x] Smoke: idempotent customer (3 orders → 1 customer)
- [x] Smoke: empty email → no link, no error
- [x] Outline backfill script in this doc (no file)

## Success criteria

- After 5 sequential orders with email `Foo@Bar.com`, `Foo@bar.com`, ` foo@bar.com ` (all same tenant), exactly ONE row exists in `customers` keyed `foo@bar.com`; all 5 orders have `customer_id` populated identically.
- Order with `customerEmail = ''` succeeds; `customer_id` is null; logs are clean (no stack trace at ERROR level).
- Order with `customerEmail = 'not-an-email'` succeeds; `customer_id` null.
- Cancelling a payment hook (`status → cancelled`) still works (existing logic untouched).
- `orders.customer_id` column visible via `\d orders` in psql.
- All existing Orders unit/e2e tests still pass without modification.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Hook throws on `payload.find/create` failure → blocks order creation | L×H | Try/catch wrapping entire body; null FK on failure; phase-05 fault-injection test |
| Race condition: two parallel orders with same email both try to create customer | L×M | DB UNIQUE INDEX returns 23505; catch + retry find once; if still fail, null FK + log |
| `syncCustomerSnapshot` triggers Payload afterChange recursion via `payload.update` on customers | L×M | `customers` collection has NO afterChange hook (per phase-02 design); verify via grep before merge |
| `payload.create` with `overrideAccess: true` bypasses tenant filter → cross-tenant customer | L×H | tenantId derived from `data.tenant` (the order's tenant) — same scope by construction; phase-05 test asserts |
| Existing Orders tests break due to hook ordering | L×M | Prepend, don't replace; run full Orders test suite before commit |
| Backfill script accidentally committed AND auto-run | L×H | Outline kept as pseudocode in this `.md` file only; no `.ts` file created |

## Security considerations

- `overrideAccess: true` used ONLY for system-driven upsert in hook context (request originates from authenticated order-create call); tenant scoping enforced by explicit `tenant: tenantId` in where/data — never reads other tenants.
- Email logged at INFO is normalized lowercase; full PII (name, phone) not logged.
- Customer auto-create has no rate limit beyond order rate limit (orders already have one upstream); acceptable.
- `customer` field marked `readOnly` in admin to prevent manual mis-association (admins should edit Customer directly, not Order).

## Next steps

- Phase 04 builds UI surfacing Customer detail with linked orders.
- Phase 05 tests cover idempotency, fault injection, tenant isolation.
- Deferred: backfill script execution (US-MIGA-12 ETL plan); cached stats columns; ranking automation.
