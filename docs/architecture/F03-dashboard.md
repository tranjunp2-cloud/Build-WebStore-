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
    └── dashboard/page.tsx      ← Server Component (single-column stream)
            ├── DashboardToolbarHeader.tsx
            ├── PeriodSelector.tsx
            ├── AtAGlance.tsx
            ├── TrafficPerformance.tsx
            ├── SeoHealth.tsx
            └── PendingOrders.tsx        ← Latest Pending Orders (gated)
```

## Data Flow

```
page.tsx (Server Component)
  │
  ├── getCurrentUser() + tenantIdForQuery() → tenant scope
  │
  ├── getGlanceData(period, { user }) ──► Payload/Drizzle
  ├── getTrafficData(period) ─► Payload/Drizzle
  ├── getSeoData() ───────────► Payload/Drizzle
  │
  ├── load independent dashboard blocks
  └── load Pending Orders via secure local loader when tenant/site/block/permission gates pass
```

## API Contract (Next.js Route Handlers)

```typescript
// GET /api/analytics/summary (Detail Charts & Lists)
// GET /api/dashboard/products (canonical Products Dashboard query for HTTP/load clients)
// POST /api/seo/analyze (Trigger API scan)
// POST /api/seo/fix (SSE Stream cho AI Fix)
// GET/POST/DELETE /api/seo/keywords (Keyword Tracker)
```

### Active At-a-glance metrics

`getGlanceData(period, { user })` derives the tenant from the authenticated user and returns empty data when there is no usable tenant. Views, Leads, and Engagement remain tenant-scoped analytics metrics.
Revenue reuses the Orders permission gate: users without Orders access receive zero/empty Revenue and no Orders SQL is executed.

Views, Leads, Engagement, and Revenue share the single
`DASHBOARD_TIME_ZONE = 'UTC'` contract. Current/comparison boundaries are half-open,
equal, non-overlapping UTC windows, and `today`, `7d`, and `30d` produce exactly
1, 7, and 30 UTC day keys. Payload count filters, range labels, zero-filled series,
and SQL `created_at` grouping therefore do not depend on the Node host or PostgreSQL
session timezone.

The active Revenue loader uses one tenant-scoped SQL aggregate over the previous and
current windows. It includes only orders whose current status is `completed`, includes
`currency = 'MYR'` and legacy null currency via `COALESCE(currency, 'MYR')`, and
attributes the amount to the order's UTC `created_at` day. Payment method and payment
status do not alter inclusion, so COD follows the same rule and refunded/non-completed
orders are excluded. No `completedAt` field is used. The active Revenue card renders the
same aggregate total, delta, comparison note, and daily sparkline as `RM` with exactly
two fraction digits; it is visible in both English and Bahasa Melayu.

The aggregate's `EXPLAIN ANALYZE` on representative local/disposable data is still
outstanding. Add an index only through a separately reviewed schema/migration change if
the measured query plan requires one.

### Pending Orders widget (GH-1627)

The server loader queries tenant-scoped pending orders with `overrideAccess: false`,
selects only dashboard DTO fields, sorts newest first, and limits the result to five
rows. DTO mapping counts only positive safe-integer quantities and ignores malformed
values or additions that would make the cumulative count unsafe. Access requires a primary
tenant membership. Tenant-scoped super-admins bypass membership status and role checks;
otherwise the membership must be active, with owner/admin/editor/viewer receiving full
access and custom roles requiring explicit Orders permission. Missing tenant, usable site,
enabled Orders block, or authorization skips the query. Loader
failures render a distinct `unavailable` state; zero results render the localized
empty state through the shared `.empty-block` pattern.

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
