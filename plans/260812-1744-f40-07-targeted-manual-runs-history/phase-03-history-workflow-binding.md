# Phase 03 — Unified run-history read model and workflow binding

## Context

- Issue #1746 AC-3; UX `RunStatus`, `ResultTable`, evidence state matrix.
- `qa_test_runs` is terminal-only; `qa_smoke_dispatches` owns active/blocked lifecycle. A history endpoint that reads only runs cannot meet AC-3.

## Implementation steps

1. Add a dedicated read-model helper that treats the ledger as canonical for targeted records and joins its `terminalRun`; include non-targeted historical terminal runs only when required for the existing all-runs contract. Use a discriminated DTO with `source`, target, pack/version, profile, context, current state, timestamps and `canCancel`; avoid leaking nonce, digest, lease IDs, raw evidence or recovery internals.
2. Batch-fetch terminal result metadata for the page of run IDs (no per-row query). Derive `evidenceState` as `available`, `expiring`, `expired` or `unavailable` from approved evidence expiry metadata; return timestamp/status only, never artifact URL from history.
3. Extend `/api/admin/qa/runs` with default seven-day window and strict URL-addressable `days`, `targetId`, `state/result`, `profile`, `packId`, `testCaseId`, `pullRequest`, `commitSha` filters plus one stable keyset cursor sorted by latest meaningful time + source/id tie breaker. Bound load-more page size to 50 and all query inputs.
4. Preserve existing terminal API compatibility during transition or version the DTO deliberately; update existing F40 tests rather than silently changing their privacy guarantees.
5. Update `.github/workflows/targeted-smoke.yml` only with exact allow-listed profile/pack choices and cancellation-safe start behavior. It must still execute one registry pack and publish signed terminal evidence; never accept generic paths or Run All input.

## Edge cases

- A queued dispatch with no Actions run remains visible and cancellable.
- A cancel-requested dispatch remains active/history-visible until terminal ingestion or lease expiry; it must not appear falsely completed.
- Terminal ingest can arrive after cancel request; record terminal truth without resurrecting cancel action or reopening a lease.
- `blocked` is visible with safe reason/recovery projection but never a successful result.

## Success criteria

- Filters and cursor work for mixed active/terminal records without duplicate/missing items at same timestamp, including default seven-day, pack/test and result filters.
- Existing `GET /api/admin/qa/runs` safe-summary guarantees remain covered.

## Execution status — 2026-08-13

History and workflow-binding changes are implemented in the working tree. Remains in verification pending final validation of the mixed active/terminal cursor contract and all specified filters.
