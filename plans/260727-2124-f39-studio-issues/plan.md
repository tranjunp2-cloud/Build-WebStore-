---
title: "F39 Studio Live Error Inbox"
description: "Add an on-demand, sanitized Sentry and Vercel error inbox to the existing Studio Issues page; Sentry promotion is implemented while Vercel promotion remains gated."
status: in-progress
priority: P1
effort: 8h
branch: feat/f39-studio-issues
tags: [feature, frontend, backend, api, auth, database, critical]
blockedBy: [live-provider-credentials, live-db-access, staging-super-admin-e2e]
blocks: []
created: 2026-07-27
---

# F39 Studio Live Error Inbox

## Overview

Implement the approved one-day baseline in [F39 PRD v4](../../docs/prd/F39-studio-log-issue-tracking.md): add `Tracked issues` and read-on-demand `Live errors` views inside `/studio/issues`. Sentry provider evidence stays temporary until a super-admin explicitly promotes it; Vercel promotion stays disabled until its stable-refetch gate passes.

## Scope Boundary
- In: independent Sentry/Vercel reads, positive-allowlist normalization, honest tenant attribution, deterministic suggested checks, Sentry manual promotion, exact runtime deduplication, and a fail-closed Vercel promotion gate.
- Out: `/studio/logs`, `/studio/generations` changes, AI/Seer, webhooks, Log Drains, cron, queues, polling, background sync, automatic issue creation, raw telemetry storage, fuzzy correlation, provider mutation.

## Verified Baseline
- `/studio/issues` and its APIs already enforce super-admin access.
- `TemplateIssues` already owns title, severity, status, assignee, comments, and timeline.
- `related_type` and `related_id` are existing `varchar` columns with a non-unique index.
- Slug and custom-domain tenant lookup primitives already exist.
- No provider reader, Live Errors UI, deterministic guidance, `runtime` relation, or race-safe promotion deduplication exists.
- Existing dynamic Issues API context must be regression-tested before F39 relies on detail/comments; the shared wrapper currently does not normalize Next 15 async route params.

## Hard Gates
- Confirm Sentry runtime read credentials and unresolved production issue/latest-event access.
- Pass the Vercel current-production-deployment Runtime Logs spike within the 5-second/50-row bound.
- Verify live DB support for `related_type='runtime'` and preflight duplicates before adding the partial unique index.
- Keep the approved escalation conditions in PRD Section 11 aligned with deterministic guidance tests.

## Dependency Graph
`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4`

## Phases
| Phase | Name | Effort | Status |
|---|---|---:|---|
| 0 | [Validate delivery gates](./phase-00-validate-delivery-gates.md) | 1h | Blocked on live credentials and DB |
| 1 | [Build provider read contracts](./phase-01-provider-read-contracts.md) | 3h | Code complete; live gate pending |
| 2 | [Add Live Errors UI](./phase-02-live-errors-ui.md) | 2h | Code/component tests complete; browser gate pending |
| 3 | [Implement runtime promotion and deduplication](./phase-03-runtime-promotion-dedup.md) | 1h | Sentry code complete; live DB and Vercel gated |
| 4 | [Verify QA and staging release](./phase-04-qa-staging-verification.md) | 1h | In progress |

## Acceptance Traceability
| Phase | Acceptance criteria |
|---|---|
| 0 | Definition of Ready for AC-01–AC-16 |
| 1 | AC-01–AC-11; AC-14 blocked pending stable Vercel refetch |
| 2 | AC-01–AC-11, AC-16 |
| 3 | Sentry path for AC-12–AC-16; Vercel promotion and AC-14 blocked |
| 4 | AC-01–AC-16 end-to-end |

## Global Gates
- Provider credentials remain server-only; page and APIs remain super-admin-only.
- Raw provider objects never reach logs, browser, or database.
- Each provider has its own timeout, empty/error state, fetch timestamp, and retry.
- Missing or unmatched tenant evidence is `Unknown`; never infer.
- Cross-source relation requires one exact non-empty request/trace ID.
- PostgreSQL enforces exact runtime identity; query-before-create alone is insufficient.
- Reviewing or closing Live Errors without promotion performs zero writes.

## Cut Order and Rollback
If the timebox slips, cut cross-source related-evidence display, then tenant-name enrichment for custom domains while preserving hostname and `Unknown`. Never cut authorization, sanitization, source isolation, manual promotion, exact deduplication, honest attribution, or the Vercel gate.

Rollback hides Live Errors, disables the provider route and runtime POST branch, and keeps tracked issues usable. Retain the additive partial index; do not drop data or schema.

## Success Criteria
- AC-01–AC-16 pass with TC-ID traceability.
- `/studio/issues` owns both views; `/studio/generations` and route inventory remain unchanged.
- Both real providers pass staging smoke, or two-source delivery is reported blocked.
- Excluded sensitive fields are absent from API responses, DOM, logs, and persisted issues.
