# Phase 02 — Secure preflight, dispatch and cancellation APIs

## Context

- Issue #1746 AC-1/AC-2/AC-3; existing `withSuperAdmin`, F40-03 transaction lock and server-only GitHub App client.

## API contract

| Endpoint | Purpose | Constraints |
| --- | --- | --- |
| `GET /api/admin/qa/manual-runs/preflight` | Registered target/profile preview | Super-admin; strict target/profile/context query; returns only safe metadata/reasons. |
| `POST /api/admin/qa/manual-runs` | Confirm one manual dispatch | Super-admin; strict JSON; server resolves pack/version and approved deployed context; requester-scoped idempotency; returns durable status only. |
| `POST /api/admin/qa/manual-runs/[id]/cancel` | Request permitted cancellation | Super-admin; only queued/dispatched/cancel_requested; never terminal/blocked/cancelled. |
| Protected scheduled reconciliation | Resolve stuck dispatch/cancel | Server-only scheduled auth; bounded batch; no browser exposure. |

## Implementation steps

1. Put schemas and orchestration in focused server modules (<200 lines each); routes only parse, authorize and map expected error codes.
2. Enforce target exists and is active, profile is exact, optional PR/SHA are paired and valid, SHA is immutable-format, the pair is a recorded approved/current Staging (QC) provenance, and no extra fields survive schema validation. Server resolves `packId`, version, fixture and project from registry; the environment is always stored `staging` and displayed Staging (QC).
3. Call preflight again inside dispatch before claiming lease; UI preflight is advisory, write-time preflight is authoritative. Use global-profile + fixture transaction/idempotency to make double-click/retry create at most one workflow for the same confirmation. Enforce requester/key uniqueness and return `409` for a matching key/different canonical digest.
4. Enhance GitHub App client with a bounded server-only cancellation request for a known workflow run ID. Never return app JWT or installation token.
5. Implement cancellation under the same fixture transaction: queued → cancelled + release lease; dispatched → cancel_requested and retain lease; known workflow ID gets best-effort GitHub cancel after durable state transition; a terminal winner is returned unchanged. When no workflow ID exists, leave it cancel-requested and rely on start rejection/expiry reconciliation; treat remote ambiguity as not released.
6. Make targeted-start reject cancelled/cancel_requested work before fixture provisioning. Make terminal ingest accept `dispatched` or `cancel_requested`, record its signed terminal truth, and never downgrade terminal/cancelled records. Define a signed cancelled/blocked fallback when start rejects, because a GitHub Actions cancellation can stop `always()` steps.
7. Add bounded reconciliation for dispatched/cancel-requested records. Re-read each record under both locks; query GitHub only with server credentials when workflowRunId exists; otherwise apply conservative expiry. Persist safe recovery/audit timestamp, release the lease exactly once, and refuse to overwrite a terminal ingestion winner.

## Security and success criteria

- Every browser endpoint uses `withSuperAdmin`, `dynamic = force-dynamic`, and `maxDuration <= 60`; non-admin/unauthenticated receives no target/run details. Reconciliation uses an existing server-to-server signed/scheduled authorization pattern.
- No browser-provided spec, test ID, fixture, workflow nonce, GitHub run ID or environment is authoritative.
- Unit/API tests cover authorization, malformed payload, non-deployed context mismatch, preflight block, same-key/same-body replay, same-key/different-body conflict, known GitHub rejection, queued cancellation, dispatched cancellation, cancellation-vs-ingest race and reconciliation/expiry race.

## Execution status — 2026-08-13

Routes, server orchestration, cancellation and scheduled reconciliation are implemented in the working tree. Remains in verification pending complete route/race coverage and final code review.
