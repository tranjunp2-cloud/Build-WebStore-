---
title: "US-F40-07 — Targeted Manual Runs and Run History"
description: "Deliver a super-admin-only, allow-listed targeted Smoke/Regression run flow with preflight, cancellation, and safe unified history."
status: in-progress
priority: P1
effort: 5 phases / M
issue: 1746
branch: feat/f40-us-f40-07-targeted-manual-runs-history
tags: [feature, f40, qa, frontend, backend, api, database, e2e]
blockedBy: []
blocks: []
created: 2026-08-12
---

# US-F40-07 — Targeted Manual Runs and Run History

## Overview

Implement the controlled QA flow at `/studio/qa`: select exactly one active target and one checked-in pack/profile, inspect server-derived preflight, confirm one dispatch, observe/cancel non-terminal work, and filter a safe paginated history. It extends F40-03's registry, ledger, fixture lock, GitHub workflow and signed ingestion; it never accepts a command/spec from the browser and never exposes GitHub credentials.

## Specification lock

| Source | Binding decision |
| --- | --- |
| Issue #1746 AC-1 | Preflight returns test types, TC IDs, prerequisites, fixture, estimated duration and `staging`; every denial has machine reason + recovery text. |
| Issue #1746 AC-2 | One target + one allow-listed versioned pack + one profile per request. No Run All endpoint, control or workflow input. PR/SHA context is optional and strict. |
| Issue #1746 AC-3 | One DTO joins active dispatch ledger and terminal runs; filters target/state/PR/SHA/profile; keyset pagination; evidence availability only, never raw artifacts. |
| PRD §4–§7 | Regression is target-specific, not full-project; production is forbidden; fixture/precondition/cleanup contracts are mandatory; QC capacity is 1 Regression + 2 Smoke. The persisted environment remains existing enum `staging`, rendered consistently as **Staging (QC)**. |
| UX §4–§9 | Three primary tabs only (Inbox, Health, Run history); one contextual primary CTA; 44px controls; confirmation dialog, bounded polling (max 15 s), keyboard/Escape/focus return, icon + text states. |

## Scope and decisions

- Reuse `TARGETED_SMOKE_PACKS`, `qa_smoke_dispatches`, `qa_fixture_leases`, signed start/ingest and the existing GitHub App client. Do not create a second dispatcher.
- Rename the concept in code only where needed: the registry becomes a versioned **targeted QA pack** contract and supports `smoke` and `regression`; every Regression pack remains one target/allow-listed test set. There is no broad project regression.
- Context validation: user may supply both `pullRequest` and exact SHA, or neither. With neither, server resolves only the current deployed staging SHA and its recorded source PR; failure is a blocked preflight, never a guessed context.
- Supplied PR/SHA must be a recorded approved/current Staging (QC) context, not merely syntactically valid. The workflow receives and checks out only that persisted immutable SHA. No missing PR/SHA may be written because the ledger requires both.
- Add a bounded request idempotency key generated once by the client dialog and persist it with requester identity plus canonical request digest. Same requester/key/body returns the original dispatch; same requester/key/different body is `409`; a new explicit confirmation gets a new key. The server never trusts a client pack version/spec/fixture/command.
- Cancellation states are ledger-only (`queued`, `dispatched`, `cancel_requested`, `cancelled`, `blocked`, `terminal`). A queued cancellation releases its lease transactionally. A dispatched/cancel-requested run keeps the lease until terminal ingest or expiry, preventing a workflow-start/cancel race from contaminating a shared fixture. A signed terminal result may win a cancellation race; cancellation must never overwrite that terminal truth.
- Per-fixture locking remains necessary but insufficient: dispatch must also take an authoritative global advisory lock by `(environment, profile)` before counting leases/active states. That is how the 2 Smoke / 1 Regression PRD quota is enforced across distinct fixtures.
- Add a durable scheduled reconciliation path for `dispatched`/`cancel_requested` records: it queries the server-side GitHub workflow state when bound; otherwise expires conservatively, records safe terminal cancellation/timeout/blocking reason and releases exactly one active lease. Every reconciliation transition re-reads under fixture + profile quota locks and cannot overwrite terminal ingest.
- Existing F40-04 plan is in progress but has no blocking dependency: F40-07 must preserve its narrow Retest route during transition and reuse its target detail. No other active plan changes the same F40-03 ledger contract.

## Explicit rollout gate

No active target-specific Regression pack exists in the execution registry today. This delivery must add only genuinely approved `[x] AUTO` Regression packs, or return `NO_ACTIVE_PACK` for Regression. It must not relabel a one-check Smoke pack as Regression or introduce a full-project command merely to satisfy the selector.

## Target architecture

```text
Studio target picker → GET preflight (server registry + current capacity/context)
  → confirm with idempotency key → POST manual dispatch
  → fixture-lock transaction → durable ledger + lease → server-only GitHub workflow dispatch
  → signed targeted-start/ingest → terminal run/results + release lease

Studio history → GET unified history (active ledger ∪ terminal runs)
  → bounded batched result lookup → evidence availability projection
  → cancel non-terminal → ledger lock + GitHub cancel when workflow ID exists
```

## Phases

| # | Phase | Depends on | Outcome |
| --- | --- | --- | --- |
| 01 | [Contract, registry and migration](./phase-01-contract-registry-migration.md) | — | Explicit pack/profile/preflight contract, global quota policy and additive persisted states. |
| 02 | [Secure preflight, dispatch, cancellation and reconciliation APIs](./phase-02-secure-run-apis.md) | 01 | Super-admin-only, idempotent flow with race-safe lease cancellation and recovery. |
| 03 | [Unified run-history read model and workflow binding](./phase-03-history-workflow-binding.md) | 01–02 | Active + terminal safe history, all specified filters/cursor/evidence states, and cancellation-aware workflow. |
| 04 | [Studio manual-run and history experience](./phase-04-studio-run-experience.md) | 02–03 | Accessible target picker, preview/confirm dialog, status and history UI; no Run All. |
| 05 | [Acceptance tests and rollout verification](./phase-05-tests-rollout.md) | 01–04 | TC-mapped unit/API/E2E, migration proof and regression checks. |

## Execution status — 2026-08-13

Implementation is in progress; no phase is marked complete until the final review and all required verification pass.

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 01 | Implemented, verification pending | Registry, ledger fields, global profile lock and additive migration are present. Migration and focused unit coverage have been run locally; final migration/schema review remains. |
| 02 | Implemented, verification pending | Super-admin preflight/dispatch/cancel routes and scheduled reconciliation are present. Idempotency, cancellation-vs-ingest and reconciliation race coverage still require final review/test confirmation. |
| 03 | Implemented, verification pending | History endpoint/workflow changes are present; all-filter/keyset and terminal/active read-model behavior await final test/review confirmation. |
| 04 | Implemented, verification pending | Studio picker, preflight/confirmation, cancel and URL-addressable history UI are present; final accessibility/mobile browser verification is pending. |
| 05 | In progress | QA TC rows, unit/API tests, fixture route and Playwright project are present. Focused Vitest, TypeScript and local migration have passed in this work session. Authenticated Playwright has **not** passed: the required local-app port guard/runtime is not yet available for verification, and this sandbox also stops Chromium at `sandbox_host_linux.cc` before setup can reach the application. |

## File ownership and dependency safety

| Area | Primary files | Owner phase |
| --- | --- | --- |
| Pack and persistence contract | `targeted-smoke-registry.ts`, `targeted-smoke-dispatch.ts`, transaction lock, `QaSmokeDispatches.ts`, `scripts/db-setup.js` | 01 |
| Write APIs, cancellation and reconciliation | new `manual-runs/**/route.ts`, protected reconciliation route/job, `github-targeted-smoke.ts`, targeted-start/ingest | 02 |
| Read/history contract and workflow | `runs/route.ts`, history helper, `targeted-smoke.yml` | 03 |
| Studio | `page.tsx`, split focused QA components only when needed | 04 |
| QA doc and tests | `docs/qa/F40-qa-control-center.md`, `src/__tests__/**`, `tests/**`, fixture endpoint | 05 |

## Success criteria

- All AC-1/2/3 paths are demonstrably server-authorized and cannot broaden execution beyond a registered target pack.
- Any collection-field change has an additive idempotent migration, indexes and `COLLECTION_SLUGS` update; no destructive SQL.
- A cancel/ingest race cannot release a fixture lease while a workflow may still claim it, and terminal ingest cannot be overwritten.
- Two simultaneous Smoke dispatches on different fixtures cannot exceed quota 2, and two Regression dispatches cannot exceed quota 1.
- Browser has no Run All control, GitHub token, raw result/log/artifact URL, or arbitrary test input.
- Focused Vitest/API, TypeScript, local migration and authenticated Playwright F40-07 pass; existing F40 project-health suite is rerun because it overlaps the Studio surface.
