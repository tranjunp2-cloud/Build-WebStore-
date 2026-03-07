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
    └── dashboard/page.tsx      ← Server Component (main)
            ├── DashboardGreeting.tsx    ← Client: greeting theo thời gian
            ├── DashboardStats.tsx       ← Server: 4 stat cards
            ├── DashboardSiteGrid.tsx    ← Server: site cards grid
            ├── DashboardEmptyState.tsx  ← Static: empty state CTA
            ├── DashboardBanner.tsx      ← Client: dismissible banner
            └── DashboardSkeleton.tsx    ← Static: loading skeleton
```

## Data Flow

```
page.tsx (Server Component)
  │
  ├── getPayload() → payload.find({ collection: 'sites', where: { tenant: { equals: tenantId }, deletedAt: { exists: false } } })
  │
  ├── if sites.length === 0 → render <DashboardEmptyState />
  │
  ├── else → render <DashboardStats /> + <DashboardSiteGrid sites={sites} />
  │
  └── if any site.isPublished === false → render <DashboardBanner />
```

## API (Payload Local API — No REST needed)

```typescript
// Server Component — direct DB access, no API call
import { getPayload } from 'payload'

// Get user's sites
const sites = await payload.find({
  collection: 'sites',
  where: {
    tenant: { equals: user.tenant.id },
    deletedAt: { exists: false },
  },
  sort: '-updatedAt',
  limit: 6,
})

// Stats (aggregate)
const totalViews = 0       // Mock for Wave 1
const storageUsed = '1.2'  // Mock for Wave 1
const aiCredits = 15       // From subscription tier
```

## Data Model

Sử dụng **collections có sẵn** — không cần thay đổi schema:
- `sites` — name, slug, isPublished, themeConfig, tenant
- `users` — email, name, role, tenants[]
- `subscriptions` — plan, aiCreditsRemaining

## 6-Layer Checklist

```
✅ Layer 1 — PRODUCT/UX:
   - 3 states: has-sites, empty, loading ✅
   - Mobile 375px: stack cards vertical ✅
   - Greeting dynamic (morning/afternoon/evening) ✅

✅ Layer 2 — API/BACKEND:
   - Payload Local API (no REST endpoint needed) ✅
   - Server Component (no client fetch) ✅

✅ Layer 3 — DATA/STORAGE:
   - Uses existing collections ✅
   - Scoped by tenant ✅
   - Excludes soft-deleted (deletedAt exists: false) ✅

✅ Layer 4 — SECURITY/AUTH:
   - Server Component = no API exposure ✅
   - Payload access control enforces tenant ✅
   - Unauthenticated → redirect /login ✅

⬜ Layer 5 — OPS/RELIABILITY:
   - Error boundary per route (TODO)
   - Sentry logging (TODO — Wave 5)

⬜ Layer 6 — BUSINESS:
   - AI credits from subscription (mock for now)
   - Storage from S3 usage (mock for now)
```

## File List (to create/modify)

| Action | File | Notes |
|--------|------|-------|
| MODIFY | `src/app/(dashboard)/dashboard/page.tsx` | Rewrite as Server Component |
| KEEP | `src/components/dashboard/Sidebar.tsx` | Already exists, needs minor cleanup |
| NEW | `src/components/dashboard/DashboardStats.tsx` | 4 stat cards |
| NEW | `src/components/dashboard/DashboardSiteGrid.tsx` | Site cards grid |
| NEW | `src/components/dashboard/DashboardEmptyState.tsx` | Empty state |
| NEW | `src/components/dashboard/DashboardBanner.tsx` | Unpublished warning |
| NEW | `src/components/dashboard/DashboardSkeleton.tsx` | Loading skeleton |
| NEW | `src/components/dashboard/DashboardGreeting.tsx` | Dynamic greeting |
