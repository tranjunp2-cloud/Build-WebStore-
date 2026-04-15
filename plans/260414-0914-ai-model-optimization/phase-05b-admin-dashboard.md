# Phase 05b — Admin dashboard `/dashboard/ai-usage`

## Context
- Parent: [plan.md](./plan.md)
- Split from: [phase-05-gateway-observability.md](./phase-05-gateway-observability.md)
- Depends on: phase-05a (`8f4cd4b3` — collection + logger already shipped)
- Unblocks: OpenAI bill reconciliation (future phase-05c, see Next steps)

## Overview
- Date: 2026-04-14
- Description: Build a super-admin-only page at `/dashboard/ai-usage` that reads the `ai-usage-logs` Payload collection and surfaces actionable cost metrics. Replaces Payload's built-in collection view for the common "did cost drop after phase-03a?" question. Out of scope: Vercel AI Gateway routing migration (that's phase-05c, currently unscoped).
- Priority: P2 — nice-to-have, not blocking staging merge
- Status: planned, not implemented
- Review status: not reviewed

## Key insights
- Payload already ships a default collection view at `/admin/collections/ai-usage-logs` with row-level filter + sort. Enough for 80% of diagnostic queries, but **no aggregation** — we can't see "total cost last 24h" without SQL.
- Phase-05a writes `cost_usd` per row. A `SUM(cost_usd)` + date-bucket query gives us the whole story. No need for time-series DB.
- `recharts@3.8.0` already installed (`package.json`) — free chart tool.
- Dashboard root lives at `src/app/(dashboard)/dashboard/*` (Next.js route group with shared layout). New page goes there.
- Super-admin check pattern exists (collection `access.read` returns `req.user?.roles?.includes('super-admin')`) — mirror in page server component.
- Log volume projection: ~1k site-gen + 10k chat-edit + 100k bulk-parse / month = ~111k rows / month. Even 1 year of data = ~1.3M rows. Postgres indexes on `created_at DESC` + `endpoint, model` (phase-05a migration) make aggregate queries fast.
- **Do NOT use Payload local API for aggregates** — it's optimized for CRUD, not `GROUP BY`. Query directly via raw SQL through the pg pool or use Payload's `db.connection` (postgres-js) handle.
- Dashboard is READ-ONLY — no mutations, no form posts. Keeps security surface small.

## Requirements
- [ ] New route: `src/app/(dashboard)/dashboard/ai-usage/page.tsx` (server component)
- [ ] Auth guard: redirect to `/dashboard` if `user?.roles?.includes('super-admin')` is false
- [ ] 3 metric cards above the fold:
  - Total spend last 24h (USD, with delta vs previous 24h)
  - Total spend last 7d (USD, with delta vs previous 7d)
  - Total calls last 24h (count, with success rate %)
- [ ] Breakdown table — one row per (endpoint, model) for last 7 days:
  - columns: endpoint, model, calls, total cost, avg latency, success rate
  - sortable client-side (default sort: total cost desc)
  - rendered in shadcn/ui `Table`
- [ ] Line chart — daily cost last 30 days:
  - X axis: date
  - Y axis: USD
  - Stacked by endpoint (site-generation, chat-edit, bulk-parse, other)
  - Recharts `LineChart` or `AreaChart`
- [ ] Error panel — last 10 failed calls with errorCode + timestamp (diagnostic)
- [ ] No pagination on the dashboard itself — drill-down goes to Payload's built-in collection view via a "View all logs →" link
- [ ] SSR with `force-dynamic` (cost data must be fresh)
- [ ] Loading state (`loading.tsx`) for the route
- [ ] TypeScript strict — no `any` in query result typing
- [ ] Unit test for the SQL query builders (not for the rendered page)

## Architecture

```
Browser
   │
   ▼
/dashboard/ai-usage (Next.js server component)
   │
   ├─ withAuth() → guard super-admin
   │
   ├─ const db = await getPayloadDb()   // raw pg pool
   │
   ├─ Promise.all([
   │     queryTotalsLast24h(db),    // SUM(cost_usd), COUNT, success%
   │     queryTotalsLast7d(db),
   │     queryBreakdownLast7d(db),  // GROUP BY endpoint, model
   │     queryDailyLast30d(db),     // GROUP BY DATE_TRUNC(day), endpoint
   │     queryRecentErrors(db),     // WHERE success=false LIMIT 10
   │   ])
   │
   └─ render MetricCards + BreakdownTable + DailyChart + ErrorPanel
```

### SQL query sketches

```sql
-- queryTotalsLast24h
SELECT
  COUNT(*)                                         AS calls,
  COALESCE(SUM(cost_usd), 0)                       AS total_cost_usd,
  COALESCE(AVG(duration_ms), 0)                    AS avg_latency_ms,
  (SUM(CASE WHEN success THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100 AS success_rate_pct
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- queryBreakdownLast7d
SELECT
  endpoint,
  model,
  COUNT(*)                                         AS calls,
  COALESCE(SUM(cost_usd), 0)                       AS total_cost_usd,
  COALESCE(AVG(duration_ms), 0)                    AS avg_latency_ms,
  (SUM(CASE WHEN success THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100 AS success_rate_pct
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY endpoint, model
ORDER BY total_cost_usd DESC;

-- queryDailyLast30d (for stacked line chart)
SELECT
  DATE_TRUNC('day', created_at) AS day,
  endpoint,
  COALESCE(SUM(cost_usd), 0)    AS cost_usd
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY day, endpoint
ORDER BY day ASC;

-- queryRecentErrors
SELECT id, endpoint, model, error_code, duration_ms, created_at
FROM ai_usage_logs
WHERE success = false
ORDER BY created_at DESC
LIMIT 10;
```

## Related code files

### New files
- `src/app/(dashboard)/dashboard/ai-usage/page.tsx` — server component + data fetching
- `src/app/(dashboard)/dashboard/ai-usage/loading.tsx` — skeleton UI
- `src/app/(dashboard)/dashboard/ai-usage/_components/metric-cards.tsx` — 3-card summary
- `src/app/(dashboard)/dashboard/ai-usage/_components/breakdown-table.tsx` — endpoint × model table
- `src/app/(dashboard)/dashboard/ai-usage/_components/daily-chart.tsx` — recharts stacked line
- `src/app/(dashboard)/dashboard/ai-usage/_components/error-panel.tsx` — last 10 failed
- `src/lib/ai/usage-queries.ts` — SQL query functions (typed results, testable)
- `src/__tests__/unit/lib/ai/usage-queries.test.ts` — SQL builder unit tests (no DB hit)

### Modified
- `src/app/(dashboard)/dashboard/layout.tsx` — add nav link "AI Usage" (super-admin only)

### Unchanged (but referenced)
- `src/collections/AiUsageLogs.ts` — source of truth for fields
- `src/lib/ai/log-usage.ts` — writer side (not touched by dashboard)

## Implementation steps
1. Create `src/lib/ai/usage-queries.ts` with 4 typed query functions + strict result types. No side effects, takes `Pool` as arg.
2. Write unit tests for query builders — mock pg client, assert SQL shape + parameters. No DB integration tests (that's a /qa-full concern).
3. Create server component `page.tsx` — call queries in parallel, pass to 4 presentational components.
4. Build presentational components one at a time: metric-cards → breakdown-table → daily-chart → error-panel. Each takes typed data, zero fetching.
5. Add `loading.tsx` with shadcn `Skeleton` placeholders.
6. Add super-admin guard at top of `page.tsx` — redirect with next.js `redirect('/dashboard')`.
7. Add nav link in `layout.tsx` conditional on `user.roles.includes('super-admin')`.
8. Manual test localhost: seed a few `ai_usage_logs` rows (via `scripts/ai/seed-usage-logs.ts` dev helper) → visit `/dashboard/ai-usage` → verify render.
9. Screenshot for PR description.
10. Commit + push + PR reference to PR #555 or separate.

## Todo
- [ ] Confirm `recharts@3.8.0` import path (`recharts` vs `recharts/esm`)
- [ ] Decide nav link placement: top-level sidebar vs nested under "Analytics"
- [ ] Decide date range selector (dropdown 24h/7d/30d/custom) — drop or include in v1?
- [ ] Seed script for local testing — use `payload.create()` with random rows
- [ ] Confirm super-admin role string — `'super-admin'` vs `'super_admin'` (check Users.ts)
- [ ] Dev Neon branch has empty `ai_usage_logs` table locally — need seed script or wait for real prod traffic
- [ ] If `cost_usd` column is `numeric(12,6)`, TS result is `string` not `number` — cast at query layer

## Success criteria
- [ ] `pnpm tsc --noEmit` clean
- [ ] Unit tests green (4 query builder tests minimum)
- [ ] Manual screenshot of rendered page with seeded data attached to PR
- [ ] Non-super-admin user hitting `/dashboard/ai-usage` gets redirected to `/dashboard`
- [ ] Metric cards show non-zero value after running 1 site-gen on staging
- [ ] Daily chart renders without console error even when table has < 30 days of data
- [ ] No SQL injection surface — all queries use parameterized values (`$1`, `$2`) not string interpolation

## Risk assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Payload pg pool access pattern differs from expected | Medium | Research existing query patterns in codebase (`grep -l "pool.query" src/`), mirror |
| Recharts SSR hydration mismatch on dates | Medium | Render chart in client component wrapper, pass data from server |
| Super-admin role check drifts from collection access rule | Low | Extract `isSuperAdmin(user)` helper shared by both |
| Aggregate queries slow at 1M+ rows | Low | Indexes on (created_at DESC) + (endpoint, model) from phase-05a cover all queries |
| Dashboard leaks cost data to tenant admins | Critical | Super-admin guard is the only control — MUST verify redirect works before ship |
| Dev has no data to display | Medium | Seed script writes 50 random rows spread over 30 days |

## Security considerations
- Page is READ-ONLY — no mutations possible
- Auth check: super-admin only, enforced server-side (redirect before any data fetch)
- Raw SQL queries use parameterized arguments — no string concatenation
- Error messages on query failure do NOT leak SQL or stack traces to browser (generic "Failed to load usage data")
- No PII surfaced — we never logged prompt content, only metadata
- Log write side (phase-05a) is already fire-and-forget, dashboard doesn't trigger any new writes

## Next steps

After this phase-05b lands:

1. **Phase-05c (OpenAI bill reconciliation)** — not yet scoped. Validates that `ai_usage_logs.cost_usd` matches OpenAI's actual billing ±5%. Would pull OpenAI usage via `platform.openai.com/v1/organization/usage/completions` API (admin key required), compare daily totals, alert on drift via smart-notify. Effort estimate 2-3h. File `phase-05c-bill-reconciliation.md` when ready.

2. **Vercel AI Gateway migration** — still deferred. Separate concern (provider routing, not observability). Would migrate direct `openai` SDK → `@ai-sdk/openai` + `@ai-sdk/gateway`. Effort estimate 2-3h. This was the original scope of phase-05 before the split.

3. **Alerts** — if this dashboard proves useful, add a cron that checks `SUM(cost_usd) last 1h > threshold` and posts to Lark `[PrimeWeb - V2] — CI/CD` group via smart-notify. Prevents surprise OpenAI bills.
