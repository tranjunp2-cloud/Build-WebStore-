---
title: "F03 — Activate completed-order Revenue metric"
description: "Activate tenant-scoped MYR Revenue from currently completed orders, attributed to order creation date."
status: completed-with-operational-handoff
priority: P1
effort: 7h
branch: feature/gh-1627-pending-orders-widget
tags: [feature, frontend, backend, dashboard, orders, revenue, i18n]
blockedBy: []
blocks: []
created: 2026-07-22
---

# F03 — Completed-order Revenue metric

## Overview

Activate the dashboard Revenue card using orders whose **current** status is `completed`. Revenue is assigned to the UTC calendar day of the order's existing `createdAt`; no completion timestamp, schema field, hook, or database migration is added.

This is a successor to the completed Pending Orders work, not another phase of GH-1627, and currently has no Revenue-specific GitHub issue number.

## Scope Challenge

- **Reuse:** keep `DashboardRoot -> getGlanceData(period) -> GlanceData -> AtAGlance`, existing tenant resolution, Drizzle access, stat/delta/sparkline DTO, and card UI.
- **Minimum change:** add one shared dashboard timezone constant, normalize all four At-a-glance blocks to UTC0, replace active Revenue reads with one aggregate query, remove Coming Soon, and add focused tests/docs.
- **Selected mode:** scope reduction. The new `completedAt` field, lifecycle hook, migration, backfill, and generated type work have been removed by product decision.
- **Complexity:** two sequential phases; query correctness precedes UI activation.

## Locked Decisions

- Include only orders whose **current** `orders.status = 'completed'`.
- Attribute Revenue to `orders.created_at`. An order completed later appears on its original creation day, not its completion day.
- A currently refunded or otherwise non-completed order is excluded, even if it was completed before. This can remove historical Revenue retroactively.
- COD has no special handling; payment method and payment status do not affect inclusion.
- Revenue supports MYR only. Include `currency = 'MYR'`; treat legacy `NULL` currency as MYR; exclude USD, SGD, and unknown non-null values.
- Every authenticated user in the current tenant may view the aggregate. Do not apply the Pending Orders/Orders permission gate. Tenant isolation remains mandatory.
- Export one code constant, `DASHBOARD_TIME_ZONE = 'UTC' as const`, and use it across Views, Leads, Engagement, and Revenue. Do not introduce an environment variable.
- Use UTC0 half-open boundaries: today is `00:00 UTC` through tomorrow `00:00 UTC`; 7d includes today plus six prior UTC days; 30d includes today plus 29 prior UTC days; comparison windows are equal and non-overlapping.

## Architecture

```text
Dashboard Server Component
  -> getGlanceData(period)
  -> import DASHBOARD_TIME_ZONE = 'UTC'
  -> derive current tenant from server auth
  -> calculate shared UTC current + previous boundaries
  -> one parameterized SQL aggregate
       tenant_id = current tenant
       current status = completed
       COALESCE(currency, 'MYR') = 'MYR'
       created_at in previousStart..<endExclusive
       GROUP BY UTC creation day using the shared timezone parameter
  -> split rows into previous/current totals and zero-filled series
  -> AtAGlance displays RM with two decimals, delta, note, and sparkline
```

No order document or customer PII crosses the aggregate boundary. Views, Leads, and Engagement keep their event semantics but move to the same explicit UTC boundary and day-key contract.

## Cross-Plan Dependencies

| Relationship | Plan | Status | Decision |
|---|---|---|---|
| Predecessor, complete | [GH-1627 Pending Orders widget](../260721-1759-gh-1627-pending-orders-widget/plan.md) | completed | Preserve its permission-gated Pending Orders behavior; Revenue intentionally has broader tenant-user visibility. |
| Related, not blocking | [US-F10-02 Customer Checkout](../260518-1321-GH-109-customer-checkout/plan.md) | pending | Revenue depends only on current completed status and existing creation time. |
| Related, not blocking | [F10 Bank Transfer Verification](../260518-1642-F10-bank-transfer-verification/plan.md) | pending | Bank-transfer approval alone does not create Revenue until status becomes completed. |
| Related, not blocking | [GH-1099 Reliable Payment](../260602-1754-GH-1099-reliable-payment/plan.md) | pending | Payment reconciliation remains separate from the locked completed-status rule. |

## Phases

| Phase | Name | Status | Effort |
|---|---|---|---|
| 1 | [Shared UTC period and Revenue aggregation](./phase-01-revenue-aggregation-and-period-contract.md) | Completed with operational handoff | 4h |
| 2 | [Card activation, QA, and documentation](./phase-02-card-activation-and-validation.md) | Completed with operational handoff | 3h |

## Acceptance Criteria

| ID | Acceptance criterion | Primary phase |
|---|---|---|
| REV-01 | Current/comparison totals include only current-status completed, MYR/legacy-null orders in the authenticated tenant, grouped by `createdAt`. | Phase 1 |
| REV-02 | COD is neither specially included nor excluded; refunded/non-completed and USD/SGD orders do not contribute. | Phase 1 |
| REV-03 | All four At-a-glance blocks use `DASHBOARD_TIME_ZONE = 'UTC'`, exact UTC today/7d/30d windows, and deterministic 1/7/30 day keys. | Phase 1 |
| REV-04 | Every tenant user can receive the aggregate; missing tenant returns empty data and cross-tenant rows cannot contribute. | Phase 1 |
| REV-05 | Revenue no longer shows Coming Soon and renders RM with exactly two decimals, delta/note, and sparkline in EN/MS. | Phase 2 |
| REV-06 | Focused tests, dashboard regression, typecheck, lint/diff checks, and credentialed/manual QA are recorded before release. | Phase 2 |

## Out of Scope

- Adding `completedAt`, status history, hook, schema/index migration, or reconstructing completion dates.
- Refactoring dormant `OverviewView.tsx` or legacy `/api/dashboard/summary`; record their duplicate Revenue logic as follow-up debt.
- Multi-currency conversion, exchange rates, partial refunds, net/gross accounting, or tenant currency settings.
- Orders RBAC changes, new route/API, caching, individual card customization, or non-timezone event semantics.

## Risks and Rollback

| Risk | Mitigation / rollback |
|---|---|
| Creation date differs materially from completion date | This is the explicit fallback rule; document and test that late completion is attributed to the original creation day. |
| Refund changes historical totals retroactively | This is the locked current-status rule; add regression coverage. |
| Query leaks tenants or PII | Derive tenant server-side, use a parameterized predicate, and return only day/sum rows. |
| Currency/numeric coercion corrupts totals | Filter MYR/null and safely normalize finite aggregate results. |
| Query is slow without a new composite index | Measure with `EXPLAIN ANALYZE` against representative data; add an index only in a separate reviewed schema/migration scope if needed. |
| UTC changes near-midnight values for existing blocks | Lock the requested UTC0 behavior with boundary tests and document that dashboard dates are UTC. |
| Application regression | Roll back loader/UI changes; no database rollback is required because this plan changes no schema or stored data. |

## Release Gates

- The Revenue scope introduces no collection/schema change, `scripts/db-setup.js` change, environment variable, or route/page change; predecessor work already present on the shared branch is outside this gate.
- Shared UTC constant/boundary/day-key, aggregation, formatter/component, and dashboard regression tests pass.
- `npm run typecheck`, lint, build, and `git diff --check` pass or any environment-only build blocker is recorded honestly.
- Credentialed/manual fixtures confirm created-date attribution, completed/COD inclusion, refund exclusion, tenant isolation, MYR/null behavior, decimals, and today/7d/30d behavior.
- If an issue is created, the PR uses `Relates to #N`, never `Closes #N`; do not reuse #1627 for this separate scope.

## Progress

- [x] Phase 1 — shared UTC period and Revenue aggregation (automated correctness gates complete; read-only `EXPLAIN ANALYZE` handed off)
- [x] Phase 2 — card activation, QA, and documentation (automated gates complete; manual responsive QA and representative `EXPLAIN ANALYZE` handed off)

## Phase 2 Completion Evidence

- Revenue is active, no longer shows Coming Soon, and formats MYR with exactly two decimals while preserving delta, note, and sparkline behavior.
- Component coverage renders through the real EN/MS locale provider rather than a private translation fixture.
- A PostgreSQL-backed regression calls the production `getGlanceData` SQL against session-local TEMP tables and covers the exact placeholder/runtime failure class; CI provisions PostgreSQL 16 and runs this test separately on pull requests.
- Focused Revenue tests, the dashboard regression suite, TypeScript, lint, and diff integrity passed.
- An isolated Docker BuildKit builder exited 0, compiled successfully, and generated **113/113** pages; a local PostgreSQL `ECONNREFUSED` log during page generation was non-fatal.
- Remaining operational gates: credentialed browser/responsive QA and `EXPLAIN ANALYZE` on representative staging-like data.

## Phase 1 Completion Evidence

- Implemented the Phase 1 contract in five scoped files: `src/lib/dashboard/timezone.ts`, `src/lib/dashboard/dashboard-period.ts`, `src/lib/dashboard/glance-data.ts`, `src/__tests__/unit/dashboard/dashboard-period.test.ts`, and `src/__tests__/unit/dashboard/glance-data.test.ts`.
- Focused Phase 1 tests: **10/10 passed**.
- Dashboard regression suite: **1074/1074 passed**.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Final delegated code review: **9.5/10**, zero critical findings, recommended approval.
- Operational handoff: run the planned read-only `EXPLAIN ANALYZE` against a safe disposable or staging-like database before release. It was not run because no safe database target was identified; no index or schema change is authorized by this plan.

## Revision Note

On 2026-07-22, product explicitly chose `createdAt` when no `completedAt` field exists. The earlier schema/hook/backfill phase was removed rather than retaining unnecessary infrastructure.

## Validation Outcome

- Before this implementation, Active Revenue used `createdAt` but incorrectly included paid status, mixed currencies, capped Payload reads at 2,000, used inconsistent ranges, and was hard-coded Coming Soon.
- The implemented active revamp path now uses the shared UTC contract and an uncapped, tenant-scoped aggregate limited to completed MYR/legacy-null orders; it adds no database schema or migration.
- Automated coverage addresses server-derived tenant isolation, deterministic UTC string day keys, currency/status rules, real EN/MS resources, and production PostgreSQL query execution.
- Credentialed browser/responsive QA and representative `EXPLAIN ANALYZE` remain operational handoff items; no unresolved product decision blocks implementation.
