---
title: "F40 — F42 migration ledger evidence adapter"
description: "Nối F40 vào ledger F42 để hiển thị migration run, mapping và lỗi thật theo Store."
status: in_progress
priority: P1
effort: 4-5d
issue: 1839
branch: feat/F40-1839-f42-ledger-evidence-adapter
tags: [feature, f40, f42, migration, backend, frontend, database, qa]
blockedBy: []
blocks: [260910-commerce-settings-migration-reconciliation]
created: 2026-09-30
---

# F40 — F42 Migration Ledger Evidence Adapter

## Overview

F40 Commerce/Settings reconciliation currently renders `demo` or `unverified`.
F42 provides a durable migration ledger. This plan connects F40 to that ledger so
Super Admin can inspect a selected batch/run/store, PW1→PW2 mapping and exceptions.
It never infers a mapping from SKU, email or order number.

## Scope

- In: read-only run/batch selection, mapping and exception evidence, summary,
  pagination/filtering, F40 UI states, authorization, tests and rollout guard.
- Out: importer execution, retry/rollback, auto-fix, live block render, and full
  field-value parity for price/stock/tax. Ledger lacks source field values; those
  need a later artifact-to-PW2 comparison adapter.
- Browser never reads database tables. F40 queries server-side only.

## Dependencies

1. F42 schema deployed first: `migration_runs`, `migration_entity_map`,
   `migration_exceptions`, `migration_import_batches`, `migration_import_stores`.
2. Migration owner supplies an approved `VERIFIED` staging run and entity namespace
   mapping. This is an environment dependency, not a reason to fabricate data.
3. Security approves safe metadata. No ciphertext, tokens, credentials, raw JSON
   `detail`, full PII or checksum values leave the server.

## Architecture

```text
F42 PostgreSQL ledger (read-only)
  → F42LedgerEvidenceProvider
  → F40 sanitizer + Super Admin API
  → Migration Inspector: Run → Store → Mapping / Issues
```

`migration_entity_map` is the source of truth for identities. F42's JSONL session
logs are only operator diagnostics and must not determine migration pass/fail.

## Phases

| # | Phase | Status | Depends |
|---|---|---|---|
| 01 | [Ledger contract and reader](./phase-01-ledger-contract-and-reader.md) | Done | F42 schema |
| 02 | [Protected provider and API](./phase-02-provider-and-api.md) | Done | 01 |
| 03 | [Migration Inspector evidence UX](./phase-03-run-mapping-issues-ui.md) | Done | 02 |
| 04 | [Validation and rollout](./phase-04-validation-and-rollout.md) | In progress — requires a deployed F42 schema and verified staging child run | 01–03 |

## Success criteria

- F40 displays evidence only from an explicit F42 verified run/store.
- Tester can filter mappings and exceptions without PII/secrets.
- Missing schema, source or failed run is `Chưa xác minh`; never a false pass.
- Field-level comparison remains explicitly deferred to the existing F40-14 plan.
