# F03 completed-order Revenue plan

**Date:** 2026-07-22
**Plan:** [Completed-order Revenue metric](../../plans/260722-1727-f03-completed-revenue-metric/plan.md)

## Final business rules

- Revenue includes only orders whose current status is `completed`.
- Because Orders has no `completedAt`, Revenue is attributed to the existing order `createdAt`; no new lifecycle field is required.
- Refund/non-completed status removes the order retroactively. COD has no exception.
- Only MYR is displayed; legacy null currency is treated as MYR.
- Every authenticated user in the tenant may see the aggregate, without an Orders permission gate.

## Revised implementation

The earlier proposal to add `completedAt`, a transition hook, backfill, index, and migration was removed after product accepted creation-date attribution. The remaining implementation replaces the active loader's paid/completed, mixed-currency, 2,000-document Revenue reads with one tenant-scoped aggregate over `created_at`, then removes the card's hard-coded Coming Soon state and adds direct tests/docs.

The dashboard plan uses one shared code constant, `DASHBOARD_TIME_ZONE = 'UTC'`, for Views, Leads, Engagement, and Revenue. Bounds, labels/day keys, and every SQL daily grouping use UTC0 rather than Node runtime or PostgreSQL session timezone. Revenue uses exact UTC today/7d/30d windows and derives totals, delta, and zero-filled sparkline from the same aggregate rows. A late-completed order appears on its original UTC creation day.

## Deferred

Completion timestamp/history, schema migrations, legacy summary/OverviewView cleanup, multi-currency conversion, Orders RBAC changes, non-timezone event semantics, and caching remain separate follow-ups.
