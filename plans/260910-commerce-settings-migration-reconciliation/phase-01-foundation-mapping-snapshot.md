# Phase 01 — Foundation: mapping, snapshot và contract

## Overview

Priority P1. Thiết lập nguồn bằng chứng chung trước khi so sánh Commerce hoặc Settings.

## Current facts

- `pw1-mysql-connector.ts` hiện đọc PW1 read-only nhưng sinh nhiều `migratedId` giả định.
- Collections PW2 (`products`, `orders`, `discounts`, `customers`, `sites`, `tenants`) không lưu legacy source ID.
- Không được suy ra migration đúng bằng SKU/email/order number rồi hiển thị pass.

## Requirements

- Contract do migration team cung cấp hoặc schema evidence sidecar được phê duyệt.
- Một mapping phải có source/target entity, IDs, tenant/site, run ID, timestamp và mapping confidence.
- Snapshot audit là immutable/read-only; request UI không quét toàn bộ order history đồng bộ vào browser.

## Architecture

```text
PW1 MySQL read-only + PW2 Payload/Postgres
  → mapping evidence contract
  → server reconciliation service
  → immutable audit snapshot + aggregate counts
  → paginated super-admin API
  → Tester UI
```

## Related files

- Modify: `src/lib/admin/qa/pw1-mysql-connector.ts`
- Create: `src/lib/admin/qa/migration-evidence.ts`
- Create/modify: `src/app/api/qa/migration-reconciliation/route.ts`
- Potential schema only after contract approval: collection + `scripts/db-setup.js` migration.

## Implementation steps

1. Document and approve migration mapping contract; reject audit run if it is unavailable.
2. Implement typed evidence DTO; no `any`, no implicit inferred pass.
3. Resolve PW2 site/tenant from the official mapping, not untrusted request input.
4. Build server-side snapshot metadata: PW1/PW2 timestamps, run ID, counts, normalizer version.
5. Add deterministic result precedence: `missing`/`duplicate` → `mismatch` → `unverified` → `match`.
6. Add idempotent SQL migration if a sidecar evidence collection/table is approved; do not use `DROP TABLE`.

## Risks and mitigation

- **No historical mapping:** mark record unverified, do not false-pass; migration team runs backfill.
- **Large history:** cursor pagination and server aggregates; max API duration <=60s.
- **Cross-tenant exposure:** super-admin API only; all source/target queries constrained by mapped tenant/site.

## Todo

- [ ] Obtain and record the mapping contract.
- [ ] Receive a representative mapping export and baseline counts from migration/data team.
- [ ] Receive approved status, payment and financial rounding matrix from Product/Finance.
- [ ] Receive Security-approved safe-field allow-list for Settings/PII.
- [ ] Implement evidence reader and snapshot contract.
- [ ] Add approved migration/backfill procedure.
- [ ] Add unit tests for evidence precedence.

## Success criteria

- The service can prove why a PW1 record maps to a PW2 record.
- Unknown mapping never appears as migrated/matched.
