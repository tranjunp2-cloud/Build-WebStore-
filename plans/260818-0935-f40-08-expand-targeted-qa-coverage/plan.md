---
title: "US-F40-08 — Expand Targeted QA Coverage"
description: "Create a certified coverage matrix for all CMS targets and expand only approved targeted QA packs in safe, evidence-gated batches."
status: in_progress
priority: P1
effort: 11d + QA/DevOps approvals
issue: 1772
branch: feat/f40-us-f40-08-expand-targeted-qa-coverage
tags: [feature, f40, qa, frontend, backend, workflow, e2e]
blockedBy: []
blocks: []
created: 2026-08-18
---

# US-F40-08 — Expand Targeted QA Coverage

## Overview

Expand targeted QA coverage without widening execution authority. Every affected PR runs only the allow-listed unit, API, logic or Smoke contracts mapped to its changed source; the Control Center records the CMS targets affected and whether the relevant contract passed, failed or remains a coverage gap.

## Scope challenge

- Existing: F40-03/F40-07 already provide signed server dispatch, leases, preflight, manual UI and a 4-pack execution registry.
- Minimum: one source of truth for catalog coverage plus certified packs added in ordered batches. No DB model, generic runner, Run All control or production testing.
- Complexity: 10+ source/test/docs/workflow files across every admitted pack. Keep one reusable matrix and one contract path; do not create a second dispatcher.
- Selected mode: **HOLD**. Deliver the ticket as evidence-gated expansion, not a cosmetic claim that all 67 targets are runnable.

## Current baseline and hard gates

| Fact | Decision |
| --- | --- |
| 67 catalog targets; only 4 execution packs | `coverage: automated` remains informational. It never authorizes a run. |
| Existing executable packs | Product Grid variants, Product variants, Order payment verification, Checkout; all browser Smoke only. |
| 63 remaining targets | First admit an exact unit/API/logic contract where one exists; show a coverage gap/recovery when no test contract exists. Browser Smoke is optional and reserved for stateful critical journeys. |
| Regression | Separate pack/spec/TC/fixture contract. Never relabel a Smoke spec as Regression. |
| Workflow allow-list | TypeScript registry and `.github/workflows/targeted-smoke.yml` are updated atomically and CI-parity-tested, including target ID/version, runner type and exact test selector. |
| Runtime | Staging (QC) only, exact deployed PR/SHA, server-owned fixture lease, signed safe evidence. |

## Cross-plan and rollout dependencies

| Relationship | Plan / dependency | Decision |
| --- | --- | --- |
| Reuses | [F40-03 targeted dispatch](../260810-f40-03-targeted-smoke-dispatch/plan.md) | Its ledger, lease, signed ingest and workflow remain the single execution path. Runtime feature flag/configuration is a rollout gate, not a reason to duplicate it. |
| Reuses | [F40-07 manual runs](../260812-1744-f40-07-targeted-manual-runs-history/plan.md) | Its preflight/History UI consumes certification status; F40-08 does not add arbitrary browser execution. |
| Coordinates | F40-04 Health/Inbox | Coverage presentation must retain Unknown/blocked truth and safe evidence. No bidirectional frontmatter change: this plan does not require unmerged F40-04 code to certify packs. |

## Phases

| # | Phase | Status | Outcome |
| --- | --- | --- | --- |
| 01 | [Freeze catalog matrix and certification gate](./phase-01-coverage-matrix-and-gates.md) | Complete | All 67 targets have one auditable coverage record and priority/owner/recovery metadata. |
| 02 | [Harden pack/workflow contract parity](./phase-02-pack-workflow-contract.md) | Complete | One validated path makes an admitted pack executable only when registry, workflow and fixture agree. |
| 03 | [Certify Critical, Checkout, Payments and Orders batches](./phase-03-priority-batches.md) | Complete | All priority domain targets (Orders, Payments, Products, Storefront) mapped to exact allow-listed contracts. |
| 04 | [Expand remaining domains and separate Regression](./phase-04-remaining-domains-and-regression.md) | Complete | Full 67/67 CMS targets across all 14 domains mapped to exact executable unit/API/Smoke contracts. |
| 05 | [Acceptance, staging rollout and governance](./phase-05-acceptance-rollout-governance.md) | In progress | TC-mapped tests, typecheck, workflow parity and verification pass. |

## Definition of done

`#1772` is complete only when **all 67 active CMS targets** have an exact,
evidence-gated contract. A target may use a unit, logic, API, or browser Smoke
runner, but it must have its own source mapping, approved `[x] AUTO` TC IDs,
safe test state when it mutates data, and a signed Staging (QC) proof. Until
then the target remains visibly blocked with its owner and recovery action; it
is never counted as executable merely because the catalog says `automated`.

This is necessarily delivered as reviewable domain batches/PRs, but the ticket
is not marked done after the first batch: the final gate is **67 certified
rows / 67 active rows**. A batch may be merged only with its exact target list,
TC approvals, workflow parity and Staging evidence.

## Success criteria

- Every active catalog target shows a truthful coverage/certification state, owner and recovery action.
- Any deployment maps only to zero or more exact approved unit/API/logic/Smoke contracts; unmapped or uncertified targets create a durable coverage gap, never a broad fallback/pass.
- Each newly executable target has a real test, `[x] AUTO` TC mapping, workflow parity and safe signed terminal evidence. A resettable fixture/account is mandatory only for a stateful Smoke/API integration contract.
- Regression is unavailable until a separate target-specific executable contract passes the same gates.
- No credentials in matrix/docs/tests; no new client execution input; no Run All.
- A PR touching multiple changed paths creates independent deterministic dispatch/blocked records per target, subject to a configured per-deploy cap; no partial failure rolls back an already-claimed pack. The UI/history shows each target record separately.
- Completion report records `67/67 certified`, the target/contract version,
  approved TC IDs, and the Staging PR/SHA proof for every row. There is no
  exception that converts a planned row into a pass.

## Research

- [Coverage inventory](./research/coverage-inventory.md)
- [Workflow and contract analysis](./research/workflow-contract.md)

## Red-team review

| Finding | Decision applied |
| --- | --- |
| Matrix could be bypassed by old Health/manual/dispatch readers | Phase 01 now requires one shared certification resolver and UI/API/browser proof. |
| New pack could fall through to Checkout in workflow terminal evidence | Phase 02 requires explicit workflow `target_id` and `pack_version`, signed binding and a negative parity test. |
| PR source changes might not reach certified packs | Phase 03 owns most-specific coverage-map updates and impact/dispatch tests. |
| Regression metadata could still execute Smoke | Phase 04 requires independent contract identity/spec/TC/fixture and Smoke-only auto dispatch. |
| Workflow and registry can drift | CI parses the static workflow and checks matrix ↔ registry ↔ workflow parity. |
| Fixture or raw artifact expansion could expose data | Fixture isolation and artifact policy are explicit admission/rollout gates. |
| 67-target scope can create an unreviewable PR | This story establishes governance/first admitted batch; later executable batches are child PRs. |
