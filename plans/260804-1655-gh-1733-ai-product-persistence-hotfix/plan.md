---
title: "GH-1733 — AI Product Persistence Hotfix"
description: "Restore the verified AI Product save path, end loading with actionable outcomes, and prove preview-to-Draft behavior in staging E2E."
status: in_progress
priority: P1
urgency: urgent
effort: ~7h
branch: fix/f08-gh-1733-ai-product-persistence
issue: 1733
tags: [f08, bugfix, ai, products, payload, sentry]
created: 2026-08-04
blocks: [260710-1625-f08-category-integrity]
---

# GH-1733 — AI Product Persistence Hotfix

## Outcome

Every valid confirmed preview is auto-committed exactly once as a tenant-owned Draft, independently read back before success, and visible in Product List. A failed or ambiguous attempt ends loading with an actionable message and reference ID; support can correlate parse and save attempts without exposing merchant content.

## Confirmed Cause Boundary

- Staging returns success while no Product row exists; this is a backend persistence acknowledgement defect, not only stale UI state.
- GH-1410 used `disableTransaction:true` plus independent verification. The GH-1588 rewrite routed AI creates through a custom `payload.db.sessions` transaction and skipped that verification.
- The immediately preceding lock implementation already held `FOR KEY SHARE` in one connection while the Product auto-committed on another, preserving category-delete exclusion and the GH-1410 save path.
- The mutation gate can wait indefinitely; current tests mock the commit boundary; staging `TC-F08-04-101` fails in category setup before Approve.

## In Scope

- Restore the pre-transaction-rewrite two-connection category-lock pattern for AI saves; let `saveProduct` use its existing `disableTransaction:true` auto-commit path.
- Independently verify Product ID, tenant, stable slug, Draft status, non-deleted state, and selected category before returning success.
- Bound mutation-gate/category-lock waiting; retain stable-slug replay for safe in-drawer retry.
- Generate a server `generationId` in the bulk-parse response and a per-save `referenceId`; log sanitized tenant/user/generation/attempt/outcome context to Sentry.
- Update UI terminal states and the existing unit/Playwright regression coverage.

## Out of Scope

- New Product fields, SQL migration, environment variables, routes, operation ledger, or persisted reload/reparse idempotency.
- New PostgreSQL CI service, Vitest integration project, package scripts, empty-schema bootstrap, or general CI workflow hardening.
- A database resilience redesign beyond the two confirmed unbounded category waits.

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 01 | [Restore verified persistence](phase-01-restore-verified-persistence.md) | completed | — |
| 02 | [UI, correlation and recovery](phase-02-ui-correlation-and-recovery.md) | completed | 01 |
| 03 | [Focused regression and staging QA](phase-03-focused-regression-and-staging-qa.md) | implemented — awaiting staging QA | 01–02 |

## Implementation Decision

Use the category-lock implementation immediately before `a9a721b4e`: acquire the shared mutation gate, hold the active tenant category row with `FOR KEY SHARE`, run `saveProduct` without a transaction request so GH-1410's `disableTransaction:true` and independent read apply, then commit/release the lock connection. Add an outer exact-invariant verification before the AI action returns `{ok:true}`. Do not retain or introduce an alternate custom transaction in this hotfix.

## Definition of Done

- [x] Each confirmed preview yields one independently verified Draft row; replay returns the same Product ID.
- [x] Missing/rolled-back/mismatched rows can never produce a success toast or close the drawer.
- [x] Loading settles through success, structured failure, bounded category wait, or platform/network rejection.
- [x] Logs include tenant, user, generation ID, reference ID, safe payload summary, cause, attempt, duration, outcome, and retry correlation.
- [x] Existing GH-1410 tenant/auto-commit/verification regressions and focused UI tests pass.
- [ ] CI bot's Playwright flow reaches Approve and confirms the new rows in Draft list; the reporter needs no staging privileges.

## Current Verification Status

Implementation and local regression coverage for Phases 01–03 are complete. The focused suites pass **143/143**, including immutable retry-slug and Product-list visibility-filter regressions, and the secret-guarded provisioning suite passes **8/8 across three consecutive runs**. Targeted lint, `git diff --check`, and Playwright discovery with `--list` also pass.

The hotfix is not staging-signed-off yet. Safe staging credentials are not set in this checkout, so the real staging Playwright flow, Sentry reference lookup, and staging run URL have not been produced. Repository-wide typecheck and `src/__tests__/api/ai.test.ts` collection remain blocked by dependencies missing from the installed `node_modules`; these are environment blockers, not passing verification.
## Dependency and Rollback

This hotfix blocks `260710-1625-f08-category-integrity` Phase 10 because both use the same category save/delete contract and Product E2E. Rollback is application-only; no schema/data rollback exists. Do not merge if the restored path fails the focused category concurrency or staging persistence assertion.
