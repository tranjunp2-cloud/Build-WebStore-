---
title: "Phase 3 — Usage History & Dashboard KPIs"
phase: 3
status: pending
effort: M (~4–5 days)
branch: feat/F15-03-usage-history
depends_on: feat/F15-02-user-management
created: 2026-04-15
updated: 2026-04-16
---

# Phase 3 — Usage History & Dashboard KPIs

## Context links

- Plan index: [plan.md](./plan.md)
- Phase 1 (required): [phase-01-activity-logs.md](./phase-01-activity-logs.md)
- Phase 2 (required): [phase-02-user-management.md](./phase-02-user-management.md)
- PRD: `docs/prd/F15-admin-management.md` (v2.0)
- Stories: US-F15-03 (Dashboard KPIs), US-F15-04 (Usage History)
- Tenants collection: `src/collections/Tenants.ts`
- AiUsageLogs collection: `src/collections/AiUsageLogs.ts`
- Products collection: `src/collections/Products.ts`
- Orders collection: `src/collections/Orders.ts`

## Overview

Phase 3 bổ sung chiều sâu cho admin panel: mỗi tenant đang dùng platform bao nhiêu?
Và tổng thể platform hoạt động như thế nào? Gồm 2 phần:

1. **Per-tenant Usage Stats** — tab "Sử dụng" trên user detail page (Phase 2)
   với products, orders, blogs, AI usage, storage, plan & SSO info.
2. **Admin Dashboard KPIs** — trang chủ `/admin-panel` với tổng quan platform:
   total users, active today, new/week, AI cost, tenant breakdown.

> **Lưu ý (PRD v2.0):**
> - Plan + SSO info chỉ **xem** (view-only) — không config/edit.
> - Plan names trong code: `free/starter/pro/business`.
> - SSO status: `activated/inactivated/terminated` (từ Phase 2 migration).
> - "Active today" = distinct users có activity_log entry hôm nay (Phase 1 data).

## Account & Plan Context

- Tất cả Owner account tạo **100% từ SSO (TM Legacy)** qua `POST /api/v1/sso/provision`.
- 4 gói code: `free | starter | pro | business` — tất cả giới hạn **giống nhau**.
  Plan gán từ SSO `pack_code`.
- AI site generation: thành công 1 lần → ẩn F01, không cho gen lại.
  Counter: `tenants.settings.aiGenerationsCount`.
- SSO payload lưu trên Tenants: `customerId`, `serviceId`, `packCode`, `orderId`,
  `metaData` (raw JSON), `ssoStatus` (từ Phase 2).

## Key Insights

- All required data already exists across collections: `Tenants`
  (plan, status, ssoStatus, aiGenerationsCount, storageUsed), `AiUsageLogs`
  (per-call AI spend), `Products`, `Orders`, `Blogs`.
- No new tables needed. All aggregations computed at query time using
  `payload.count()` and `payload.find()` with appropriate where clauses.
- Dashboard KPIs (total users, active today, new this week) computed via
  `payload.count()` queries — no materialised view needed at this scale.
- "Active today" = users with `activity_logs` entry where `created_at >= today`.
  Requires Phase 1 logs to be present; gracefully shows "—" if table is empty.
- Plan breakdown uses code values (`free/starter/pro/business`).
- Tenant status breakdown includes `terminated` (from Phase 2 migration).
- SSO status breakdown: `activated/inactivated/terminated`.
- `ai_usage_logs` has fields: `costUsd` (number), `endpoint` (select),
  `model` (text), `tokensIn/tokensOut` (number), `durationMs` (number),
  `success` (checkbox), `tenant` (relationship), `user` (relationship).

## Requirements

### Functional — Usage Stats per tenant (US-F15-04)

- FR1: User detail page (Phase 2) gains a "Sử dụng" tab showing:
  AI site generated (yes/no badge + count), products count, orders count,
  blogs count, sites count, storage used vs limit (progress bar).
- FR2: Plan & SSO info card (view-only): current plan badge
  (`free/starter/pro/business`), SSO fields (packCode, customerId, serviceId,
  orderId), SSO status badge.
- FR3: AI usage cost breakdown (from `ai_usage_logs`):
  total cost USD this month, last 10 calls table with endpoint, model,
  cost, latency (durationMs), timestamp.
- FR4: Nếu chưa có AI usage → hiển thị "Chưa có dữ liệu sử dụng AI".
- FR5: Dữ liệu usage phải chính xác khớp với DB. API response < 1s.

### Functional — Admin Dashboard KPIs (US-F15-03)

- FR6: Trang chủ `/admin-panel` hiển thị KPI cards:
  - **Tổng số Users** — `payload.count({ collection: 'users' })`
  - **Hoạt động hôm nay** — distinct `actor_id` trong `activity_logs` hôm nay
  - **Mới trong tuần** — users created trong 7 ngày qua
  - **Chi phí AI tháng này** — `SUM(cost_usd)` từ `ai_usage_logs` tháng này
- FR7: Phân bổ Tenants:
  - **Theo Plan** — breakdown: `free / starter / pro / business`
  - **Theo Status** — breakdown: `active / trialing / past_due / cancelled / suspended / terminated`
  - **Theo SSO Status** — breakdown: `activated / inactivated / terminated`
- FR8: KPI cards auto-refresh mỗi 60 giây (React Query `refetchInterval`),
  không nhấp nháy khi refresh.
- FR9: Empty state: KPI cards hiển thị "0" hoặc "—" (không lỗi).
  "Hoạt động hôm nay" hiển thị "—" nếu `activity_logs` trống.
- FR10: Quick action links: Users, Workspaces, Broadcast.

### Non-functional

- NFR1: All aggregation API calls respond in < 1 s at p95.
- NFR2: Dashboard page load < 1 s (Lighthouse target).
- NFR3: No division-by-zero errors when data is empty.

## Architecture

### No new DB migrations required

All data is in existing tables + Phase 2 migration (`sso_status`).
No new collections or columns needed.

### API routes

#### `GET /api/admin/users/[id]/usage`

File: `src/app/api/admin/users/[id]/usage/route.ts`

Aggregates across collections for the user's primary tenant:

```typescript
// Get user's primary tenant
const user = await payload.findByID({ collection: 'users', id, depth: 1 })
const tenantMembership = user.tenants?.find(t => t.role === 'owner') || user.tenants?.[0]
const tenantId = tenantMembership?.tenant?.id

// Parallel fetch pattern
const [products, orders, blogs, sites, aiLogs, tenant] = await Promise.all([
  payload.count({ collection: 'products', where: { tenant: { equals: tenantId } } }),
  payload.count({ collection: 'orders', where: { tenant: { equals: tenantId } } }),
  payload.count({ collection: 'blogs', where: { tenant: { equals: tenantId } } }),
  payload.count({ collection: 'sites', where: { tenant: { equals: tenantId } } }),
  payload.find({
    collection: 'ai-usage-logs',
    where: {
      tenant: { equals: tenantId },
      createdAt: { greater_than: startOfMonth },
    },
    limit: 10,
    sort: '-createdAt',
  }),
  payload.findByID({ collection: 'tenants', id: tenantId }),
])
```

Response:
```json
{
  "tenantId": 5,
  "plan": "starter",
  "sso": {
    "packCode": "STARTER",
    "customerId": "5320919-6794387",
    "serviceId": "SVC-123",
    "orderId": "PC-CV17SXDUSAAAA",
    "ssoStatus": "activated"
  },
  "aiSiteGenerated": true,
  "aiGenerationsCount": 1,
  "products": 42,
  "orders": 180,
  "blogs": 5,
  "sites": 2,
  "storageUsedBytes": 52428800,
  "storageLimitBytes": 524288000,
  "aiUsage": {
    "totalCostUsdMonth": 0.045,
    "recentCalls": [
      {
        "endpoint": "site-generation",
        "model": "gpt-4.1-mini-2025-04-14",
        "costUsd": 0.012,
        "durationMs": 8500,
        "success": true,
        "createdAt": "2026-04-15T10:30:00Z"
      }
    ]
  }
}
```

#### `GET /api/admin/stats`

File: `src/app/api/admin/stats/route.ts`

Computes platform-wide KPIs. Uses mix of `payload.count()` and raw SQL
for aggregate queries that Payload can't express efficiently.

```typescript
const today = new Date(); today.setHours(0,0,0,0)
const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

const [totalUsers, newThisWeek, activeToday, tenantsByPlan, tenantsByStatus, tenantsBySsoStatus, aiCostMonth] = await Promise.all([
  payload.count({ collection: 'users' }),
  payload.count({ collection: 'users', where: { createdAt: { greater_than: weekAgo.toISOString() } } }),
  // Distinct actor_ids in activity_logs today — raw query
  pool.query(
    `SELECT COUNT(DISTINCT actor_id) as count FROM activity_logs WHERE created_at >= $1`,
    [today.toISOString()]
  ),
  // Tenants by plan
  pool.query(`SELECT plan, COUNT(*)::int as count FROM tenants GROUP BY plan`),
  // Tenants by status
  pool.query(`SELECT status, COUNT(*)::int as count FROM tenants GROUP BY status`),
  // Tenants by SSO status
  pool.query(`SELECT sso_status, COUNT(*)::int as count FROM tenants WHERE sso_status IS NOT NULL GROUP BY sso_status`),
  // AI cost this month
  pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float as total FROM ai_usage_logs WHERE created_at >= $1`,
    [monthStart.toISOString()]
  ),
])
```

Uses shared `pg.Pool` singleton from `src/lib/db/pool.ts` (create if not exists).

Response:
```json
{
  "totalUsers": 1240,
  "activeToday": 83,
  "newThisWeek": 14,
  "tenantsByPlan": {
    "free": 800,
    "starter": 300,
    "pro": 100,
    "business": 40
  },
  "tenantsByStatus": {
    "active": 1100,
    "trialing": 80,
    "past_due": 40,
    "cancelled": 20,
    "suspended": 5,
    "terminated": 2
  },
  "tenantsBySsoStatus": {
    "activated": 1200,
    "inactivated": 5,
    "terminated": 2
  },
  "aiCostThisMonth": 12.45
}
```

> **Pool singleton pattern:** Uses `pg.Pool` with `max: 2` and
> `idleTimeoutMillis: 10000` — safe for Vercel serverless.
> All queries use parameterised `$1` to prevent SQL injection.

### UI additions

#### Extend User Detail: `src/app/(admin-panel)/users/[id]/page.tsx`

Add "Sử dụng" tab below existing sections (Phase 2):

```
┌─────────────────────────────────────┐
│ [Thông tin]  [Sử dụng]             │
├─────────────────────────────────────┤
│ Plan & SSO                          │
│  Plan: starter (badge)              │
│  SSO Status: activated (badge xanh) │
│  Pack Code: STARTER                 │
│  Customer ID: 5320919-6794387       │
│  Service ID: SVC-123                │
│  Order ID: PC-CV17SXDUSAAAA         │
├─────────────────────────────────────┤
│ Thống kê sử dụng                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐│
│  │  42  │ │ 180  │ │   5  │ │  2  ││
│  │Prods │ │Orders│ │Blogs │ │Sites││
│  └──────┘ └──────┘ └──────┘ └─────┘│
│  Storage: 50MB / 500MB [====----]   │
│  AI Site: Generated (1 lần)  ✅     │
├─────────────────────────────────────┤
│ Chi phí AI (tháng này): $0.045      │
│  ┌──────────────────────────────────┤
│  │ Endpoint       │ Model  │ Cost  ││
│  │ site-generation│gpt-4.1m│$0.012 ││
│  │ chat-edit      │gpt-4.1m│$0.003 ││
│  │ ...            │        │       ││
│  └──────────────────────────────────┤
│ "Chưa có dữ liệu sử dụng AI"      │ ← if empty
└─────────────────────────────────────┘
```

- Calls `/api/admin/users/{id}/usage`
- All fields are **read-only** — no edit buttons
- Plan & SSO info card highlighted as view-only section

#### Admin Dashboard: `src/app/(admin-panel)/page.tsx`

Update from redirect (Phase 2) to KPI dashboard:

```
┌────────────┬────────────┬────────────┬────────────┐
│   1,240    │     83     │     14     │   $12.45   │
│ Total Users│Active Today│ New / Week │ AI Cost/mo │
└────────────┴────────────┴────────────┴────────────┘
┌─────────────────────┬──────────────────────────────┐
│ Tenants by Plan     │ Tenants by Status             │
│  free      800      │  active       1,100           │
│  starter   300      │  trialing        80           │
│  pro       100      │  past_due        40           │
│  business   40      │  cancelled       20           │
│                     │  suspended        5           │
│                     │  terminated       2           │
├─────────────────────┼──────────────────────────────┤
│ SSO Status          │ Quick Actions                 │
│  activated  1,200   │  → Users                      │
│  inactivated    5   │  → Workspaces                 │
│  terminated     2   │  → Broadcast                  │
└─────────────────────┴──────────────────────────────┘
```

- Uses Shadcn `Card` components
- Plan/Status breakdown: simple badge list with counts (no recharts dependency
  needed — add chart library in follow-up if PM approves).
- Auto-refresh every 60s via React Query `refetchInterval: 60_000`.
- Skeleton loading state for initial load.
- Error state with retry button.
- Empty state: "0" or "—" for each KPI.

## Related code files

- `src/collections/Tenants.ts` — plan (`free/starter/pro/business`), status,
  ssoStatus, aiGenerationsCount, storageUsed, storageLimitBytes, SSO fields
- `src/collections/AiUsageLogs.ts` — costUsd, endpoint, model, tokensIn/Out,
  durationMs, success, tenant, user
- `src/collections/Products.ts` — tenant relation for count
- `src/collections/Orders.ts` — tenant relation for count
- `src/collections/Blogs.ts` — tenant relation for count
- `src/app/api/v1/sso/provision/route.ts` — SSO provision (plan assignment, mapPlan)
- `src/app/(admin-panel)/users/[id]/page.tsx` — Phase 2 detail page (extend)
- `src/app/api/admin/broadcasts/route.ts` — super-admin route guard pattern

## Implementation Steps

1. **DB pool singleton** — create `src/lib/db/pool.ts` if not already present
   (needed for raw aggregate queries in `/api/admin/stats`).
2. **API: usage stats** — `src/app/api/admin/users/[id]/usage/route.ts`.
3. **API: platform stats** — `src/app/api/admin/stats/route.ts`.
4. **UI: extend user detail** — add "Sử dụng" tab to Phase 2 user detail page.
5. **UI: admin dashboard** — update `src/app/(admin-panel)/page.tsx` from redirect
   to KPI dashboard.
6. **Tests** — unit tests for usage API + stats API (TC-F15-03-xx).

## Todo list

- [ ] Create or verify `src/lib/db/pool.ts` singleton exists
- [ ] Create `src/app/api/admin/users/[id]/usage/route.ts`
- [ ] Create `src/app/api/admin/stats/route.ts`
- [ ] Extend `src/app/(admin-panel)/users/[id]/page.tsx` with "Sử dụng" tab
- [ ] Update `src/app/(admin-panel)/page.tsx` to KPI dashboard
- [ ] Write unit/integration tests (TC-F15-03-xx)
- [ ] PR: `feat/F15-03-usage-history` → staging

## Success Criteria

- SC1: Usage stats card shows accurate counts matching direct DB query for a
  test tenant with known product/order/site counts.
- SC2: Plan & SSO info displayed correctly as read-only (no edit buttons).
- SC3: AI cost breakdown shows correct total and last 10 calls.
- SC4: Admin dashboard KPI cards load on page mount and re-fetch every 60 s
  without visible flicker.
- SC5: "Active today" KPI matches manual count of distinct actor_ids in
  `activity_logs` for today (requires Phase 1 to have data).
- SC6: Tenant breakdown by plan/status/SSO status shows correct counts.
- SC7: Empty state: all KPIs show "0" or "—" without errors.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `payload.count()` slow for large collections | Low | Medium | Collections already indexed; if needed, add composite index (tenant_id, created_at) |
| `active today` count is 0 if Phase 1 has no data yet | Medium | Low | Show "—" instead of 0 when activity_logs is empty; document dependency |
| Pool singleton connection leak in serverless | Medium | Medium | Use `pg.Pool` with `max: 2` and `idleTimeoutMillis: 10000`; Vercel serverless safe pattern |
| `activity_logs` table not yet created when Phase 3 deploys | Low | High | Phase dependency: Phase 1 must merge first. Stats API handles missing table gracefully (try/catch). |
| Blogs collection may not have tenant relation | Medium | Medium | Check `src/collections/Blogs.ts` for tenant field. If missing, skip blogs count or add relation. |

## Security Considerations

- Raw pool queries in `/api/admin/stats` use parameterised queries (`$1`)
  to prevent SQL injection.
- Usage and stats endpoints follow same `withAuth` + super-admin guard
  as all other admin routes.
- AI cost data is sensitive — only super-admin can access it (matches
  `AiUsageLogs` access policy: read/delete only for super-admin).
- SSO info (customerId, serviceId) is PII-adjacent — only visible to super-admin.

## Next steps

After Phase 3 merges:
- Consider CSV export of activity logs as Phase 4 item.
- Dashboard KPIs could feed weekly digest Lark notification via `smart-notify`.
- Plan name alignment (docs vs code) — separate cleanup PR.
- Subscription management deferred until business model decided.
