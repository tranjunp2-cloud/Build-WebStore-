# PRD: Analytics Dashboard (F13)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P1 | **Wave:** 5 | **Size:** M  
> **Depends on:** F10 Storefront (analytics tracking)

---

## 1. Problem Statement

Site owners have no visibility into how their storefront is performing. They don't know how many visitors they get, which pages are popular, or how their products convert. They need a simple analytics dashboard — not Google Analytics complexity, just the essential metrics.

## 2. User Story

```
AS A site owner
I WANT TO see page views, visitors, and shopping events
SO THAT I can understand customer behavior and improve my store
```

## 3. Screen Layout

```
┌─ /dashboard/analytics ─────────────────────────────┐
│  Analytics        [7 Days ▼] [30 Days] [Custom]     │
│                                                      │
│  ┌─ Stats Cards ─────────────────────────────────┐  │
│  │ 📊 Views   │ 👤 Visitors │ 🛒 Add Cart │ 💰 Orders │
│  │ 1,234      │ 456         │ 89          │ 23        │
│  │ +12% ↑     │ +5% ↑       │ -3% ↓       │ +18% ↑   │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Daily Chart ─────────────────────────────────┐  │
│  │ █ █ ▄ █ █ ▄ ▄ █ ▄ █ █ █ ▄ █ (bar chart)    │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Top Pages ───────────────────────────────────┐  │
│  │ URL               │ Views │ Unique              │  │
│  │ /                  │ 456   │ 234                  │  │
│  │ /products          │ 234   │ 156                  │  │
│  │ /products/baju-raya│ 123   │ 89                   │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## 4. Acceptance Criteria

### AC-1: Stats Cards
```gherkin
GIVEN user navigates to /dashboard/analytics
WHEN  page loads with selected period (7d default)
THEN  4 stat cards: Total Views, Unique Visitors, Add to Cart events, Orders
AND   each card shows absolute number + % change vs previous period
AND   green arrow ↑ for increase, red arrow ↓ for decrease
```

### AC-2: Daily Chart
```gherkin
GIVEN analytics data exists for selected period
WHEN  displayed
THEN  bar chart shows daily page views
AND   hover shows tooltip with exact count + date
AND   responsive: chart fills container width
```

### AC-3: Top Pages
```gherkin
GIVEN analytics data exists
WHEN  displayed
THEN  table: URL path, total views, unique visitors
AND   sorted by views descending
AND   max 10 rows
```

### AC-4: Period Selector
```gherkin
GIVEN user clicks period selector
WHEN  selects "30 Days"
THEN  all data refreshes for 30-day window
AND   comparison shows vs previous 30 days
```

### AC-5: No Data State
```gherkin
GIVEN site has no analytics data (new or unpublished)
WHEN  page loads
THEN  empty state: "No data yet. Publish your site to start tracking."
AND   link to publish flow
```

## 5. Technical Requirements

### Data Source
- Uses existing `analytics` collection in Payload CMS
- Events tracked by `POST /api/analytics/track` (from F10 storefront)
- IP hashed with SHA-256 for anonymization

### API
- `GET /api/analytics/summary?siteId=X&period=7d` — Stats + chart data + top pages

### Components
| Component | File |
|-----------|------|
| AnalyticsPage | `app/(dashboard)/dashboard/analytics/page.tsx` |
| StatCard | `components/dashboard/StatCard.tsx` |
| DailyChart | `components/dashboard/DailyChart.tsx` |
| TopPagesTable | `components/dashboard/TopPagesTable.tsx` |

## 6. 9-Point Done Checklist

- [ ] Loading State — Skeleton for stats cards and chart
- [ ] Empty State — "No data yet" + publish CTA
- [ ] Error State — Toast + retry on API failure
- [ ] Form Validation — N/A
- [ ] Button States — Period selector active state
- [ ] Toast Feedback — N/A (read-only dashboard)
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Stats cards 2×2 grid, chart scrollable
- [ ] TypeScript Clean
