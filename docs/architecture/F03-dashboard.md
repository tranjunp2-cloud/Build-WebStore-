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
- `Google Analytics Data API` — Proxy backend query tới GA4, cache tại Redis.
- `Google Search Console API` — Khai thác Click, Impression, Keyword Ranking.
- `Google Site Verification API` — Tự động cấp quyền sở hữu tên miền.
- `tenants` — Lưu preferences dashboard (widgetOrder, hiddenWidgets) VÀ `google_access_token`, `refresh_token` phân quyền nghiêm ngặt.

## Tiêu chuẩn Mạch máu OAuth 2.0 (Google Integration)

Dev cần tuân thủ 3 mốc Checkpoint kỹ thuật để đảm bảo luồng Authentication an toàn với GCP:

1. **GCP Setup:** Cấp đủ Quota và quyền hạn cho 3 Library API (Analytics Data, Search Console, Site Verification). Thiết lập bắt buộc `Authorized redirect URIs` trỏ về trạm trung chuyển `/api/google/callback`.
2. **Hạ tầng & Entity:** Bảo vệ `GOOGLE_CLIENT_SECRET` ở môi trường server. Field Database cấp Tenant bắt buộc có 3 key: `google_access_token`, `google_refresh_token` (Long-lived để tái cấp), `token_expiry_date`.
3. **Route Logic (Next.js Routes):**
   - Lớp 1 (Init): `GET /api/google/auth` -> Phục vụ Trigger trỏ URL ra bảng Consent Screen của Google.
   - Lớp 2 (Callback): `GET /api/google/callback` -> Parse Auth Code, Trade lấy Tokens, Update vào Payload CMS Tenant object.
   - Lớp 3 (Auto-Renew Middleware): Kiểm tra `token_expiry_date` trước mọi function gọi Analytics, tự bẻ khoá tráo Token mới bằng `Refresh_Token` nếu Token hiện tại hết hạn 1 Giờ.

## 6-Layer Checklist

```
✅ Layer 1 — PRODUCT/UX:
   - Dashboard có thể customize, SSE stream cho AI fix < 15s. ✅
   - Mobile 375px: stack cards vertical ✅

✅ Layer 2 — API/BACKEND:
   - Tách API endpoints cho metrics, analytics, và SEO. ✅
   - Redis Cache layer đáp ứng Rate Limit fallback. (Mới)

✅ Layer 3 — DATA/STORAGE:
   - Scoped by tenant ✅
   - Preference & Google Access Token lưu an toàn theo Tenant session. ✅

✅ Layer 4 — SECURITY/AUTH:
   - API endpoints require auth (401) và check token revoke. ✅
   - Payload access control enforces tenant ✅

⬜ Layer 5 — OPS/RELIABILITY:
   - SSE Retry mechanisms & Timeout config cho Vercel AI Streaming. (TODO)

⬜ Layer 6 — BUSINESS:
   - Prompt Engineering: Gom Batch & Cắt input còn 150 ký tự để tối ưu chi phí Token. (TODO)
```
