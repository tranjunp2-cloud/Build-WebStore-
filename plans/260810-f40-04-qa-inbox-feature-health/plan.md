---
title: "US-F40-04 QA Inbox and Feature Health Detail"
description: "Build a real, evidence-led QA inbox and accessible feature-health detail for staged QA results."
status: in_progress
priority: P1
effort: 5.5d
branch: feat/f40-us-f40-04-qa-inbox-feature-health
tags: [f40, qa-control-center, inbox, evidence, e2e]
created: 2026-08-10
---

# Implementation plan

## Goal

Deliver `/studio/qa` Inbox and Feature Health Detail from persisted QA data: actionable ordering, evidence-led failure details, safe visual review, and no false-green health state.

## Scope boundaries

- No demo/static findings, raw CI artifacts, arbitrary commands, full-project run, or GitHub issue creation.
- F40-05 owns GitHub ticket sync/creation; F40-07 owns functional manual dispatch/retest history.
- Integrate with F40-03 targeted-dispatch work only after PR #1761 lands and its data contract is verified.

## Phases

| # | Phase | Status | Effort |
|---|---|---|---|
| 01 | Evidence/read-model contract and additive persistence | in_progress | 1.5d |
| 02 | Protected Inbox and feature-detail API | in_progress | 1d |
| 03 | Accessible responsive Inbox and detail UI | in_progress | 1.5d |
| 04 | E2E, migration verification, rollout | in_progress | 1.5d |

- [Phase 01](phase-01-evidence-read-model-contract.md) — source-of-truth fields and cross-story dependency gate.
- [Phase 02](phase-02-protected-read-api.md) — super-admin DTOs, priority and safety rules.
- [Phase 03](phase-03-inbox-and-feature-detail-ui.md) — real UI states, mobile and keyboard behaviour.
- [Phase 04](phase-04-e2e-verification-and-rollout.md) — AC-mapped browser tests and staged rollout.

## Acceptance trace

| Issue AC | Planned coverage |
|---|---|
| AC-1 Inbox priority and actionable row | 02–03, tested in 04 |
| AC-2 Product Grid failure evidence and retest | 01–03; functional retest conditional on F40-07 decision |
| AC-3 visual baseline/current/diff and no auto-ticket | 01–03, tested in 04 |
| DoD mobile, keyboard, states, E2E | 03–04 |

## Key decisions required before coding

1. **Decided 2026-08-11:** Implement a narrow manual Retest in this delivery because #1743 explicitly requires it. It may select only a checked-in targeted-Smoke pack, must use F40-03's server-owned ledger and fixture lease, and must never accept a command, arbitrary target, or full-project run.
2. Approve the owner/schema for persisted visual baseline/current/diff and tester confirmation. Existing results do not contain them; F40-05 may not create a GitHub issue from this record.
3. Confirm whether F40-04 waits for PR #1761 merge before integration, or uses an explicit adapter/feature gate until then.

## Research

- [Data/API research](research/researcher-01-data-contract.md)
- [UI/UX research](research/researcher-02-ui-ux.md)
- [Existing-surface scout](scout/scout-01-existing-qa-surfaces.md)
