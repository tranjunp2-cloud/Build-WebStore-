---
title: "US-F40-06 — Finding Review and Manual GitHub Ticket Creation"
description: "Add an internal, deduplicated QA-finding lifecycle with explicit, idempotent human promotion to GitHub issues."
status: complete
priority: P1
effort: 16h
issue: 1745
branch: feat/f40-us-f40-06-finding-review-manual-github-ticket
tags: [feature, qa, frontend, backend, database, api, github]
blockedBy: [f40-04-qa-inbox-feature-health, 260811-f40-05-github-issue-sync]
blocks: []
created: 2026-08-12
---

# US-F40-06 implementation plan

## Overview

Turn a failed QA testcase into a durable internal finding first. A super-admin reviews
safe result/evidence, can cancel, or explicitly confirms a single GitHub bug creation.
The same active failure must not create another finding or another GitHub issue. A passing
required retest verifies the fix; a later matching failure reopens the finding with new
evidence.

## Scope lock

- Reuse US-F40-02 run/result/safe-evidence contracts and US-F40-05 GitHub App/mirror.
- No automatic GitHub creation, arbitrary GitHub client, raw artifacts, issue-body mirror,
  generic test-runner output, or public QA routes.
- No new Studio route unless the existing `/studio/qa` surface cannot accommodate review.

## Cross-plan dependency

| Relationship | Plan                              | Why                                                                                                 |
| ------------ | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Blocked by   | US-F40-04 QA Inbox/Feature Health | Its enriched QA inbox DTO, result evidence and E2E fixtures are the intended review surface.        |
| Blocked by   | `260811-f40-05-github-issue-sync` | Promotion must reuse its server-only GitHub App client and `qa_github_issues` mirror/link contract. |

## Architecture decisions

```text
signed terminal failed testcase
  -> transaction: canonical fingerprint + unique finding upsert
  -> /studio/qa review (safe run/result/evidence projection)
  -> cancel: no remote call
  -> confirm: promotion lease + marker reconciliation -> GitHub POST once
  -> safe mirror upsert + attach issue -> active finding remains deduped
required targeted retest passes -> verify-fix
same fingerprint fails later -> reopen + attach latest run/result evidence
```

- Fingerprint uses only stable, non-secret identity: `targetId`, suite, TC-ID and assertion
  code (plus a documented assertion discriminator if needed). Never include run IDs,
  timestamps, artifact URLs, cookies, trace content or free-form errors.
- Active lifecycle includes `needs_review`, `promoting`, and `github_created`; this keeps
  known defects deduplicated until they are verified fixed. `verify_fix` is terminal until a
  matching later failure reopens the same durable finding.
- Enforce global fingerprint uniqueness in PostgreSQL and reopen the existing record on later
  recurrence. A database advisory lock plus application find-then-update guards concurrent
  ingestion; an application find-then-create check is insufficient under race.
- Promotion owns a short durable lease/state and uses deterministic marker
  `qa-finding:<id>:<fingerprint>`. Reconcile that marker before retry/after ambiguous remote
  failure, then atomically store the returned sanitized GitHub metadata/link.

## Phases

| Phase | Outcome                                                                                     | Status                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [Persisted finding contract and atomic lifecycle](./phase-01-finding-contract-lifecycle.md) | Complete — contract, migration, ingestion, verify/reopen handling and active-finding health precedence are implemented.                                                                           |
| 2     | [Protected review and idempotent GitHub promotion](./phase-02-review-promotion-api.md)      | Complete — protected list, dismiss and explicit marker-reconciled promotion routes are implemented.                                                                                               |
| 3     | [Studio review workflow and health integration](./phase-03-studio-review-workflow.md)       | Complete — existing QA Control Center has review, dismiss and confirm workflow; Project Health links active findings without changing verified data.                                              |
| 4     | [Automated verification and rollout evidence](./phase-04-tests-rollout.md)                  | Complete for implementation — focused unit/API coverage passes and authenticated local Playwright passes; staging rollout evidence remains an operational handoff. |

## Acceptance mapping

| AC                       | Delivery                                                                                             | Evidence                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| AC-1 lifecycle/dedupe    | collection, unique DB index, advisory lock + transactional failed-result upsert, reopen/verify rules | unit + API race/lifecycle tests       |
| AC-2 explicit promotion  | review UI, confirm-only protected API, durable promotion lease and GitHub marker reconciliation      | unit/API + E2E cancel/confirm tests   |
| AC-3 fix verification    | retest-pack eligibility and verify/reopen transitions with latest safe evidence                      | unit/API tests                        |
| DoD: safe GitHub failure | remote failure state/audit without data loss or secret leakage                                       | API tests and manual staging evidence |

## Success criteria

- All three issue acceptance criteria and DoD checks are automated where stated.
- Schema migration is additive/idempotent; no `DROP TABLE`; `qa_findings` is in
  `COLLECTION_SLUGS[]`.
- All finding routes are super-admin-only, `dynamic = 'force-dynamic'`, and `maxDuration <= 60`.
- PR uses `feat(F40): [US-F40-06] ...` and `Relates to #1745`.

## Current implementation evidence

- `QaFindings`, its additive `qa_findings` migration/indexes, safe ingestion updates and
  lifecycle helpers are implemented.
- Super-admin finding list, dismissal, and confirmation-only GitHub promotion are implemented;
  promotion keeps a deterministic marker and reconciles it before any retry.
- The existing QA Control Center now exposes a finding-review workflow with an accessible
  confirmation step and linked GitHub issue display.
- `TC-F40-06-01` through `TC-F40-06-04` have focused Vitest/API coverage. `TC-F40-06-05` has
  Playwright coverage using the internal QA fixture and a browser-level promotion intercept.

## Verification / rollout note

On 2026-08-12, local Docker PostgreSQL migration and super-admin seed completed, and the
allow-listed authenticated Playwright project passed setup plus `TC-F40-06-05` (2/2). Focused
unit/API coverage passes 24/24 assertions and TypeScript validation passes.

Before staging rollout, capture migration-only and GitHub App/evidence-link evidence. This is an
operational deployment gate; the automated browser test intentionally does not create a real
GitHub issue.
