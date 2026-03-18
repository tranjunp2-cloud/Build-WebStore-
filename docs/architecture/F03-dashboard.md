# Architecture: Dashboard

> **Date:** 2026-03-07 | **Related PRD:** `docs/prd/dashboard.md`  
> **Agent:** Architect Agent

---

## Overview

Dashboard là **Server Component** (data fetch ở server, không cần useEffect).
Dùng Payload CMS Local API để query — không qua REST, nhanh hơn.

## Component Architecture

```
(dashboard)/layout.tsx          ← Fixed sidebar + main area
    ├── Sidebar.tsx             ← Navigation (8 items, active state)
    ├── dashboard/page.tsx      ← Server Component (Home: Metrics & Orders)
    │       ├── DashboardGreeting.tsx
    │       ├── DashboardStatsView.tsx   ← 4 Customizable stat cards
    │       ├── DashboardActionList.tsx  ← Latest Pending Orders
    │       └── SEOHealthWidget.tsx      ← SEO quick glance
    ├── dashboard/analytics/page.tsx ← Client/Server Component (Analytics detail)
    │       ├── PeriodSelector.tsx
    │       ├── DailyBarChart.tsx
    │       └── TopPerformanceLists.tsx  ← Pages, Products, Blogs
    └── dashboard/seo/page.tsx   ← Client Component (SEO detail & AI Fix)
            ├── SEOScoreBreakdown.tsx
            ├── KeywordTracker.tsx       ← Tracks top 5 keywords
            └── AIFixAllPanel.tsx        ← SSE Streaming handler
```

## Data Flow

```
page.tsx (Server Component)
  │
  ├── getSession() → get tenantId
  │
  ├── fetch dashboard metrics (View, Leads, Orders, Revenue) via `/api/dashboard/summary`
  │
  └── render <DashboardStatsView /> + <DashboardActionList /> + <SEOHealthWidget />
```

## API Contract (Next.js Route Handlers)

```typescript
// GET /api/dashboard/summary (Overview)
// GET /api/analytics/summary (Detail Charts & Lists)
// POST /api/seo/analyze (Trigger API scan)
// POST /api/seo/fix (SSE Stream cho AI Fix)
// GET/POST/DELETE /api/seo/keywords (Keyword Tracker)
```

## Data Model

Sử dụng **collections có sẵn** hoặc third-party APIs:
- `orders` — Lấy pending orders và doanh thu (từ F10).
- `analytics_events` — (Tương lai/F12) Lấy page views, clicks.
- `seo_keywords` — Lưu trữ top 5 keywords (tạo collection mới hoặc JSON field trong tenant).
- `tenants` — Lưu preferences dashboard (widgetOrder, hiddenWidgets).

## 6-Layer Checklist

```
✅ Layer 1 — PRODUCT/UX:
   - Dashboard có thể customize, SSE stream cho AI fix < 15s. ✅
   - Mobile 375px: stack cards vertical ✅

✅ Layer 2 — API/BACKEND:
   - Tách API endpoints cho metrics, analytics, và SEO. ✅

✅ Layer 3 — DATA/STORAGE:
   - Scoped by tenant ✅
   - Preference lưu theo User/Tenant session. ✅

✅ Layer 4 — SECURITY/AUTH:
   - API endpoints require auth (401). ✅
   - Payload access control enforces tenant ✅

⬜ Layer 5 — OPS/RELIABILITY:
   - Timeout config cho AI SSE Stream. (TODO)

⬜ Layer 6 — BUSINESS:
   - AI SEO limit based on plan.
```
