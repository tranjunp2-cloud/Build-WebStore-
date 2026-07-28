# Phase 01 — Shared UTC period and Revenue aggregation

## Context

- Plan: [plan.md](./plan.md)
- Active loader: `src/lib/dashboard/glance-data.ts`
- Shared DTO: `src/lib/dashboard/dashboard-types.ts`

## Overview

- **Status:** Completed with operational handoff
- **Priority:** P1 correctness
- **Effort:** 4h
- Establish one explicit UTC0 contract for all At-a-glance blocks and replace capped, mixed-currency Revenue reads with one tenant-scoped aggregate over order creation time.

## Related Files

| Action | File | Change |
|---|---|---|
| Create | `src/lib/dashboard/timezone.ts` | Export the single shared `DASHBOARD_TIME_ZONE = 'UTC'` constant. |
| Create | `src/lib/dashboard/dashboard-period.ts` | Pure UTC boundary, range-label, and day-key helpers shared by all four blocks. |
| Modify | `src/lib/dashboard/glance-data.ts` | Apply shared UTC bounds/grouping to all blocks and replace active Revenue totals/series logic. |
| Create | `src/__tests__/unit/dashboard/dashboard-period.test.ts` | Shared constant, host-independent UTC boundaries, labels, and day keys. |
| Create or modify | `src/__tests__/unit/dashboard/glance-data.test.ts` | Query, mapping, delta, currency, status, and tenant tests. |

## Period Contract

Use explicit UTC0 boundaries for all four At-a-glance metrics:

| Period | Current start | Current end | Previous start | Points |
|---|---|---|---|---|
| `today` | UTC today 00:00 | UTC tomorrow 00:00 | UTC yesterday 00:00 | 1 |
| `7d` | UTC today minus 6 days | UTC tomorrow 00:00 | UTC today minus 13 days | 7 |
| `30d` | UTC today minus 29 days | UTC tomorrow 00:00 | UTC today minus 59 days | 30 |

Use UTC date methods and `Intl` with `timeZone: DASHBOARD_TIME_ZONE`; never rely on host-local `startOfDay`, local `format`, or PostgreSQL session timezone. Do not add a timezone dependency.

## Query Contract

Use one parameterized Drizzle query over previous plus current window:

```sql
SELECT TO_CHAR(created_at AT TIME ZONE :dashboardTimeZone, 'YYYY-MM-DD') AS day_key,
       SUM(total) AS amount
FROM orders
WHERE tenant_id = :tenantId
  AND status = 'completed'
  AND COALESCE(currency, 'MYR') = 'MYR'
  AND created_at >= :previousStart
  AND created_at < :endExclusive
GROUP BY 1
```

Return only deterministic `day_key` and `amount`, split rows at `currentStart`, and derive current total, previous total, delta, and zero-filled series from the same rows.

## Implementation Steps

1. Export exactly one shared code constant: `DASHBOARD_TIME_ZONE = 'UTC' as const`. Do not read `process.env.TZ` or add environment files.
2. Add shared pure helpers for UTC current/previous bounds, UTC range labels, and 1/7/30 UTC day keys. Results must not depend on the Node host timezone.
3. Apply the same UTC bounds to Payload counts for Views, Leads, and Engagement, and use `DASHBOARD_TIME_ZONE` as the parameter for every SQL daily grouping. Preserve their existing event semantics.
4. Keep authentication and tenant derivation server-side. `getGlanceData(period, { user })` accepts the authenticated user rather than a caller-supplied tenant ID; anonymous/missing tenant returns `emptyGlanceData`. Reuse the existing Orders permission gate before executing Revenue SQL, and return zero/empty Revenue when access is denied.
5. Remove the two Revenue `payload.find(... limit: 2000)` calls and replace them with the single aggregate. Filter current `completed` status and MYR/null currency; do not filter payment method or payment status.
6. Normalize finite aggregate values without `any` or `NaN`; compute Revenue total, comparison, and series from the same rows.
7. Add AAA tests mapped to F03 QA IDs:
   - the exported timezone constant is exactly UTC and all four blocks share it for boundaries and SQL grouping;
   - results are identical under different mocked host/database session timezones;
   - today/7d/30d yield equal non-overlapping UTC windows and 1/7/30 keys;
   - completed status, COD parity, refund exclusion, MYR/null currency, created-at attribution, decimals, delta, zero-fill, tenant visibility, and isolation;
   - no Payload Revenue find or 2,000-document cap remains.
8. Run `EXPLAIN ANALYZE` read-only on representative staging-like data. Record performance; do not add an index in this no-schema plan.

## Validation Commands

```bash
npm test -- src/__tests__/unit/dashboard/dashboard-period.test.ts src/__tests__/unit/dashboard/glance-data.test.ts
npm test -- src/__tests__/unit/dashboard
npm run typecheck
rg -n "limit: 2000|status IN \('paid', 'completed'\)|SUM\(total\).*created_at" src/lib/dashboard/glance-data.ts
git diff --check
```

## Success Criteria

- Revenue is current-status completed-only, MYR-only, tenant-scoped, and grouped by order creation day.
- Current total, comparison delta, and sparkline use identical predicates with no pagination cap.
- All four metrics use exact 1/7/30 UTC0 windows and matching UTC SQL day keys regardless of runtime or database session timezone.
- Only tenant users with Orders access receive the aggregate; denied users trigger no Revenue Orders query and receive zero/empty Revenue without exposing order/customer data.
- No schema, migration, route, or unrelated metric behavior changes.

## Todo

- [x] Add and test the shared UTC timezone constant and period helpers.
- [x] Apply shared UTC boundaries/grouping to all blocks and replace capped Revenue reads with one aggregate.
- [x] Add query/mapping/auth regression coverage.
- [x] Pass focused tests, the dashboard regression suite, typecheck, diff checks, and final delegated review.
- [ ] Operational handoff: run read-only `EXPLAIN ANALYZE` on representative data once a safe disposable or staging-like database is available.

## Completion Evidence

| Gate | Result |
|---|---|
| Scoped implementation | Five files: `timezone.ts`, `dashboard-period.ts`, `glance-data.ts`, `dashboard-period.test.ts`, and `glance-data.test.ts` |
| Focused Phase 1 tests | 10/10 passed |
| Dashboard regression suite | 1074/1074 passed |
| TypeScript | `npm run typecheck` passed |
| Diff integrity | `git diff --check` passed |
| Final delegated review | 9.5/10, zero critical findings, approve |
| Query plan measurement | Not run; explicit operational handoff because no safe database target was identified |

The follow-up review executed the production query successfully against local PostgreSQL and added a TEMP-table PostgreSQL regression test to CI. The available local dataset was too small to replace the outstanding representative-data `EXPLAIN ANALYZE` handoff.

Phase 1 acceptance criteria REV-01 through REV-04 are covered by the implementation, focused tests, dashboard regression, and final review. The remaining `EXPLAIN ANALYZE` item validates deployment-data performance rather than functional correctness and does not authorize adding an index or migration.
