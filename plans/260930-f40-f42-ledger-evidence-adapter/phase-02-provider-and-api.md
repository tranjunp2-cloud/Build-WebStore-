# Phase 02 — Protected provider and API

## Goal

Connect F42 reader to F40's existing evidence-provider seam and expose safe,
read-only Super Admin APIs.

## Files

- Modify: `src/lib/admin/qa/migration-reconciliation.ts`
- Modify: `src/app/api/qa/migration-reconciliation/route.ts`
- Create: `src/app/api/qa/migration-reconciliation/runs/route.ts`
- Create: `src/app/api/qa/migration-reconciliation/issues/route.ts`
- Create: `src/__tests__/api/f40-f42-ledger-reconciliation.test.ts`

## Implementation steps

1. Register `F42LedgerEvidenceProvider` server-side while retaining unavailable
   behavior for environments without F42 tables.
2. Validate `run_id`, `store_id`, entity, state, cursor and limit with Zod. No
   arbitrary table name, sort expression or run auto-selection.
3. Return safe run/batch metadata and paginated `migration_exceptions` records.
4. Protect routes with `withSuperAdmin`, `dynamic = "force-dynamic"` and
   `maxDuration <= 60`; no endpoint writes ledger data.
5. Serialize only a strict allow-list and safe reason codes for unavailable schema,
   timeout and invalid pagination.

## Success criteria

- Unauthenticated calls are 401/403 and malformed selectors are 400.
- Responses contain no PII, secret, ciphertext, raw `detail` or checksum.
- Duplicate/missing mapping identities never become green.
