# Phase 01 — Contract, registry and migration

## Context

- Issue #1746 AC-1/AC-2; PRD §4–§7; UX `PackPreview`/`RunPreflight`.
- Reuse `src/lib/admin/qa/targeted-smoke-registry.ts`, `targeted-smoke-dispatch.ts`, `src/collections/QaSmokeDispatches.ts`, and `scripts/db-setup.js`.

## Requirements

- A registered pack declares target, immutable ID/version, profile eligibility, test type(s), TC IDs, manual count/checklist summary, prerequisites, fixture/capacity, estimate and staging-only environment.
- Smoke capacity is at most two concurrent runs globally; Regression capacity is one globally, in addition to the existing per-fixture exclusive capacity. Both are authoritative DB-transaction checks, never UI/preflight-only counts.
- Registry validation fails closed for unknown/retired targets, unsafe identifiers, absent test cases, missing duration/prerequisite fields or profile mismatch.

## Implementation steps

1. Define small typed `QaRunProfile` (`smoke | regression`) and `QaPackPreview`/`QaRunPreflight` service contracts. Map predecessor `targeted-smoke`/`manual-retest` provenance deliberately; do not silently reinterpret old records.
2. Extend only the checked-in allow-list with metadata. Add Regression only for target-specific packs whose declared TC IDs are `[x] AUTO`; do not invent a full-suite pack.
3. Add pure preflight evaluation: active registry target, selected profile, configured current Staging (QC) context, allowed environment, profile quota and fixture lease availability. Preflight capacity is an advisory snapshot only; the claim transaction is authoritative. Return ordered blocking reason codes and recovery actions.
4. Extend the transaction helper to acquire a deterministic global `(staging, profile)` advisory lock as well as the fixture lock; while both are held count only non-terminal active leases/states. Test competing different fixture claims.
5. Extend `QaSmokeDispatches.ts` and `qa_smoke_dispatches` together: profile options preserve `targeted-smoke`/`manual-retest` and add `manual-smoke`/`manual-regression`; status options add `cancel_requested`/`cancelled`; add `requestedBy` relationship to `users`, `idempotencyKey` text, `cancelRequestedAt`, `cancelledAt`, `workflowCancelledAt` date fields, and bounded `cancelReason` text. Add additive idempotent columns/backfills and indexes for requester/key uniqueness, `(target_id, created_at)`, profile, PR and SHA history; keep collection slug unchanged.
6. Keep dispatch keys unambiguous: profile + immutable pack version + persisted approved context + requester-scoped idempotency key; canonical digest prevents same key with different body.

## Tests and success criteria

- Pure unit tests prove unsafe/deprecated/unmapped packs fail closed; profile quota and fixture conflicts produce stable reason codes; concurrent different-fixture claims enforce 2/1 global limits; no profile can select an arbitrary command.
- Migration works both on a clean DB and an F40-03-existing table without null/enum incompatibility.

## Risks

- DB enum alterations can be non-transactional depending on historical schema. Prefer text/check-compatible additive state storage already used by this ledger; validate against local migration.
- Do not turn `manual-retest` into `regression` in persisted historic rows; preserve provenance in read mapping.
- Regression duration may exceed the F40-03 30-minute lease. Make profile-specific lease/timeout limits explicit and reject unsupported pack estimates instead of silently letting a lease expire mid-run.

## Execution status — 2026-08-13

Implemented in the working tree; migration and focused checks have been exercised locally. Keep this phase in verification pending final schema/collection review and complete acceptance-suite evidence.
