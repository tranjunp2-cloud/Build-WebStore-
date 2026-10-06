# Phase 01 — Ledger contract and reader

## Goal

Create a typed, fail-closed read model over F42's durable ledger. Do not create a
new F40 mapping table and do not read operator JSONL logs.

## Evidence source

| F42 table | F40 use |
|---|---|
| `migration_import_batches`, `migration_import_stores` | Batch and Store scope |
| `migration_runs` | Run state, mapping version, timestamps, safe summary |
| `migration_entity_map` | PW1 entity/ID → PW2 collection/ID and map state |
| `migration_exceptions` | Blocker/warning and safe error code |

## Files

- Create: `src/lib/admin/qa/f42-ledger-evidence-provider.ts`
- Modify: `src/lib/admin/qa/migration-reconciliation.ts`
- Create: `src/__tests__/unit/qa/f40-f42-ledger-evidence-provider.test.ts`
- Reference: `scripts/pw1-migration-schema.js`, `scripts/pw1-json-migration-schema.js`

## Implementation steps

1. Define row/DTO schemas and bounded `runId`/`storeId` selectors.
2. Use `getPayload({ config })` and parameterized `payload.db.drizzle.execute(sql\`...\`)`.
   Do not create a second connection pool or accept client SQL.
3. Query only an explicitly selected `VERIFIED` run and Store. Missing/active/failed/
   rolled-back/out-of-scope runs return a fixed `unverified` reason.
4. Build separate bounded queries for run summary, entity-map page and exception page.
5. Map state conservatively: identity mapping does not equal field equality. Zero or
   duplicate targets and unresolved exceptions stay attention/unverified.
6. Exclude `detail`, checksums, ciphertext, operator reference and raw source labels.

## Success criteria

- Queries are parameterized, Store-scoped and cursor/limit bounded.
- Ledger unavailable never leaks a database error or fakes results.
- No source ID is joined to target by SKU/email/order-number heuristic.
