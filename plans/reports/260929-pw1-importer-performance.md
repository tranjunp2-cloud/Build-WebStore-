# PW1 importer performance design

## Problem and requirements

Local-to-Neon migration has repeated remote round trips during preflight and write. The full importer must retain artifact integrity, per-store group gates, target conflict checks, entity-level durable operations, resume, and destination verification. The current large artifact also incurs repeated local copy, hash, and parse work.

## Approaches

| Approach | Benefit | Cost and risk |
| --- | --- | --- |
| Run near Neon | Reduces latency for existing queries | Requires secure transfer and a separate runner |
| Batch read-only target checks by store | Reduces network round trips in dry-run and apply preflight | Must preserve claim ownership and unique collision semantics |
| Bulk business writes with SQL/COPY | High theoretical throughput | Bypasses Payload validation/hooks and changes ledger/resume behavior |

## Decision

Measure phases and query counts first. Batch claim and supported uniqueness reads per store with bounded chunks. Keep the group gate, apply-time preflight, per-entity write transaction, ledger operation, final verification, and resume binding unchanged. Retain individual checks where batch equivalence cannot be proven. Defer write batching and artifact validation changes until measurements justify them.

## Validation

Compare the same stores on local PostgreSQL and Neon. Require identical create/reuse/conflict outcomes and destination IDs, a lower query count or elapsed time, no change to failed-store diagnostics, and successful interruption/resume tests. Do not run a full migration solely to benchmark this change.
