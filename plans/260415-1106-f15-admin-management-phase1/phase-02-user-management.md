---
title: "Phase 2 — User Management + Broadcast UI + Admin Layout"
phase: 2
status: pending
effort: M (~5–6 days)
branch: feat/F15-02-user-management
depends_on: feat/F15-01-activity-logs
created: 2026-04-15
updated: 2026-04-16
---

# Phase 2 — User Management + Broadcast UI + Admin Layout

## Context links

- Plan index: [plan.md](./plan.md)
- Phase 1 (required): [phase-01-activity-logs.md](./phase-01-activity-logs.md)
- PRD: `docs/prd/F15-admin-management.md` (v2.0)
- Stories: `docs/stories/F15-admin-management-stories.md` (v2.0)
- Users collection: `src/collections/Users.ts`
- Tenants collection: `src/collections/Tenants.ts`
- Auth helper: `src/lib/auth.ts`
- Broadcast route pattern: `src/app/api/admin/broadcasts/route.ts`
- Dashboard shell: `src/app/(dashboard)/layout.tsx`

## Overview

Phase 2 xây dựng **Admin Panel layout riêng** (`/admin-panel/*`) và cung cấp:
- Danh sách users + chi tiết user (tenant memberships + activity timeline + lỗi user gặp phải)
- Danh sách workspaces với SSO status
- Broadcast notification UI
- Login routing cho super-admin

> **Lưu ý quan trọng (PRD v2.0):**
> - **Suspend/unsuspend ĐÃ DEFERRED** — Admin chỉ xem thông tin + lỗi user gặp phải.
> - Trạng thái tài khoản do **SSO (TM Legacy) quản lý** — Admin không thay đổi.
> - Plan names trong code: `free/starter/pro/business` (khác với docs: Freemium/Starter/Standard/Professional).

## Key Insights

- **Không có suspend/unsuspend trong Phase 1 scope.** PRD v2.0 deferred FR-06.
  Admin focus vào: xem user info, xem lỗi user gặp phải qua activity logs,
  xem SSO status. Mọi thay đổi trạng thái đều từ SSO.
- SSO status mapping: `activated` → `active`, `inactivated` → `suspended`,
  `terminated` → `terminated`. Cần thêm field `sso_status` và status value
  `terminated` trên Tenants collection.
- The existing `Users` collection has `roles` and `tenants` array fields.
  Payload's built-in `find()` with `depth: 1` resolves tenant relations cheaply.
- Workspace (tenant) list already has `status`, `plan`, `settings.storageUsed`,
  `settings.storageLimitBytes` — minimal new columns needed.
- User count per tenant is not stored — computed via `payload.count()` at query
  time (cached at the UI layer via React Query with short TTL).
- The activity timeline on user detail re-uses the Phase 1 API with `userId`
  filter — no duplication of logic.
- Plan values trong code: `free | starter | pro | business` (source of truth:
  `src/collections/Tenants.ts`). Admin panel hiển thị các values này.
  SSO `pack_code` map qua `mapPlan()` — cần fix để handle `STANDARD` → `pro`
  hoặc tạo mapping mới.

## Requirements

### Functional — Admin Panel Layout (US-F15-06)

- FR-L1: Route group `(admin-panel)` với layout riêng (`AdminSidebar` dark theme,
  badge "ADMIN" ở header), tách biệt hoàn toàn với tenant dashboard.
- FR-L2: Login flow check `user.roles`: `super-admin` → `/admin-panel`,
  `tenant-owner` → `/dashboard`.
- FR-L3: Middleware guard `/admin-panel/*` — require `super-admin` role,
  redirect `/dashboard` nếu không đủ quyền.
- FR-L4: Sidebar menu items: Dashboard (Phase 3), Users, Workspaces,
  Activity Logs (Phase 1), Broadcast.

### Functional — Users List (US-F15-02 AC-1/2/3)

- FR1: Admin can view a paginated, sortable list of all users with columns:
  Name (link to detail), Email, Role badge, Tenant + Plan, Workspace status badge
  (`active/suspended/terminated`), Last login, Created at.
- FR1a: Owner hiển thị thêm badge SSO status: `activated` (xanh) |
  `inactivated` (vàng) | `terminated` (đỏ).
- FR1b: Staff bị ảnh hưởng bởi workspace suspended/terminated hiển thị badge cảnh báo.
- FR2: Admin can search users by email or name (case-insensitive, debounced 300ms).
- FR3: Admin can filter by role (`super-admin` | `tenant-owner` | `staff`) and
  status (`active` | `suspended`).
- FR4: Admin can click a user row to open the user detail page.

### Functional — User Detail (US-F15-02 AC-4/5)

- FR5: Detail page shows profile info (name, email, role, createdAt, lastLogin).
- FR6: Detail page lists all tenant memberships with role, status, plan.
- FR6a: Nếu user là Owner: hiển thị SSO status badge + SSO info (customerId,
  serviceId, packCode, orderId).
- FR6b: Nếu user là Staff: hiển thị workspace membership status + cảnh báo nếu
  workspace bị suspended/terminated.
- FR7: Detail page shows last 20 activity log entries (from Phase 1 API).
- FR8: **Xem lỗi user gặp phải** — Activity section highlight các entry có
  `action = "login_failed"` hoặc lỗi hệ thống. Admin có thể lọc chỉ xem events lỗi.
- FR9: "View workspace" link opens Payload admin panel cho tenant đó trong tab mới.

> **~~FR-suspend~~: Deferred.** Admin KHÔNG có quyền suspend/unsuspend user.
> Trạng thái tài khoản do SSO quản lý.

### Functional — Workspaces List (US-F15-02 AC-6)

- FR10: Admin can view a paginated list of all tenants with columns:
  Name, Slug, Owner email, Plan badge, Status badge
  (`active/trialing/past_due/cancelled/suspended/terminated`),
  SSO status (`activated/inactivated/terminated`), User count,
  Storage used / limit, Created at.
- FR11: Admin can filter tenants by Plan, Status, SSO Status.
- FR12: Click row → opens `/admin/collections/tenants/{id}` in new tab.
- FR12a: Workspace bị terminated hiển thị badge đỏ + ghi chú "Gói đã bị xóa trên SSO".
- FR12b: Workspace bị suspended hiển thị badge vàng + ghi chú "Đang bị khóa tạm thời".

### Functional — Broadcast UI (US-F15-05)

- FR13: Form gửi global notification tại `/admin-panel/broadcast` với fields:
  Title (required, max 200), Message (required, max 2000),
  Action URL (optional), Target Audience (dropdown: "Tất cả" — chỉ hỗ trợ "all").
- FR14: Submit → call existing `POST /api/admin/broadcasts` + dialog xác nhận.
- FR15: Toast "Đã gửi broadcast tới {N} users" khi thành công.
- FR16: Bảo vệ XSS: strip HTML. URL validation: chỉ `/` hoặc `http(s)://`.
- FR17: Danh sách broadcasts gần đây bên dưới form (query notifications, type=SYSTEM_ALERT).

### Non-functional

- NFR1: User list must load in < 1 s for up to 50 k users (server-side pagination,
  limit 50 per page).
- NFR2: All routes protected by super-admin role check — 403 for others.
- NFR3: All admin API endpoints under `/api/admin/*` return 403 for non-super-admin.

## Architecture

### DB Migrations Required

Phase 2 cần bổ sung vào `scripts/db-setup.js`:

```javascript
// 1. Add sso_status column to tenants
{
  name: 'tenants.sso_status',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sso_status varchar DEFAULT 'activated';`,
},
```

> **Lưu ý:**
> - `tenants.status` đã có sẵn các values `active/trialing/past_due/cancelled/suspended`.
>   Thêm value `terminated` ở application level (Tenants.ts select options).
> - `sso_status` là field mới: `activated | inactivated | terminated` — tracking
>   trạng thái từ SSO, tách biệt với `status` (business/billing status).
> - `users` collection hiện KHÔNG có field `status` riêng — user status gián tiếp
>   qua workspace status. Không cần thêm `users.status` vì suspend deferred.

### API routes

#### `GET /api/admin/users`

File: `src/app/api/admin/users/route.ts`

Query params: `search`, `role`, `status`, `page`, `limit` (default 50, max 200).

Uses `payload.find({ collection: 'users', where: {...}, depth: 1 })`.
Strips sensitive fields (password, OTP fields) before returning.

Response:
```json
{
  "docs": [
    {
      "id": 1,
      "email": "owner@example.com",
      "firstName": "Alice",
      "lastName": "Tan",
      "roles": ["tenant-owner"],
      "tenants": [{
        "tenant": {
          "id": 5, "name": "Alice Store", "plan": "starter",
          "status": "active", "ssoStatus": "activated"
        },
        "role": "owner"
      }],
      "lastLoginAt": "2026-04-14T08:00:00Z",
      "createdAt": "2025-01-15T08:00:00Z"
    }
  ],
  "totalDocs": 1240,
  "page": 1,
  "totalPages": 25
}
```

#### `GET /api/admin/users/[id]`

File: `src/app/api/admin/users/[id]/route.ts`

Returns full user profile with tenant memberships (depth: 2).
Includes SSO info from tenant: `customerId`, `serviceId`, `packCode`, `orderId`, `ssoStatus`.
Strips sensitive fields.

#### `GET /api/admin/workspaces`

File: `src/app/api/admin/workspaces/route.ts`

Query params: `plan`, `status`, `ssoStatus`, `page`, `limit`.

Uses `payload.find({ collection: 'tenants', ... })`.
Augments each tenant with `userCount` via `payload.count()`.

Response includes `ssoStatus` field for each workspace.

### UI pages

All pages under `src/app/(admin-panel)/` route group.

#### Admin Layout: `src/app/(admin-panel)/layout.tsx`

- Role guard: check `user.roles.includes('super-admin')` → redirect `/dashboard`
- Render `AdminSidebar` + `AdminHeader` + content area
- Style: dark theme sidebar with "ADMIN" badge

#### Users List: `src/app/(admin-panel)/users/page.tsx`

- Shadcn `DataTable` with server-side pagination
- Search input (debounced 300 ms) → calls `/api/admin/users?search=...`
- Filter dropdowns: Role, Status
- Columns: Name (link to detail), Email, Role badge, Tenant + Plan,
  SSO Status badge (Owner only), Workspace Status badge, Last login, Created
- Empty state: "Không tìm thấy user nào" with clear filters button

#### User Detail: `src/app/(admin-panel)/users/[id]/page.tsx`

Layout:
```
┌─────────────────────────────────┐
│  [← Back]  Alice Tan            │
│  alice@example.com · tenant-owner│
│  Created: 15 Jan 2025           │
├──────────────┬──────────────────┤
│ Tenant Memberships              │
│  Alice Store  starter  owner    │
│  SSO: activated (xanh)          │
│  customerId: 5320919-6794387    │
│  [View workspace ↗]             │
├──────────────────────────────────┤
│ Recent Activity (last 20)       │
│  [Filter: All | Errors only]    │
│  2026-04-14 login_failed 1.2.3.4│ ← highlighted red
│  2026-04-14 login  127.0.0.1   │
│  2026-04-13 update products/42  │
└──────────────────────────────────┘
```

- **Xem lỗi user gặp phải:** Activity section có filter toggle "All" / "Errors only"
  để highlight `login_failed`, `ai_generate_site_failed`, và các lỗi hệ thống.
- Activity section: fetches `GET /api/admin/activity-logs?userId={id}&limit=20`
- Error entries hiển thị highlight (border-left red) với metadata chi tiết

#### Workspaces List: `src/app/(admin-panel)/workspaces/page.tsx`

- Shadcn `DataTable` with server-side pagination
- Filter dropdowns: Plan, Status, SSO Status
- Columns: Name (Payload admin link), Slug, Owner email, Plan badge,
  Status badge, SSO Status badge, User count, Storage used / limit, Created
- Workspace terminated → badge đỏ + "Gói đã bị xóa trên SSO"
- Workspace suspended → badge vàng + "Đang bị khóa tạm thời"
- Click row → opens `/admin/collections/tenants/{id}` in new tab

#### Broadcast: `src/app/(admin-panel)/broadcast/page.tsx`

- Form fields: Title (required, max 200), Message (required, max 2000),
  Action URL (optional), Target Audience (dropdown: All)
- Submit → call existing `POST /api/admin/broadcasts` + confirm dialog
- Success: toast "Đã gửi broadcast tới {N} users"
- Error: toast with error message + inline validation
- Recent broadcasts list below form (query notifications, type=SYSTEM_ALERT)

### Route structure

```
src/app/(admin-panel)/
├── layout.tsx              ← Admin layout (sidebar + header + role guard)
├── page.tsx                ← Redirect to /admin-panel/activity-logs (Phase 1 default)
├── activity-logs/page.tsx  ← Phase 1 (move from dashboard if needed)
├── users/
│   ├── page.tsx            ← Users list
│   └── [id]/page.tsx       ← User detail
├── workspaces/page.tsx     ← Workspaces list
└── broadcast/page.tsx      ← Broadcast form
```

### Components

```
src/components/admin/
├── AdminSidebar.tsx        ← Sidebar riêng, dark theme, badge "ADMIN"
├── AdminHeader.tsx         ← Top header with admin indicator
├── SsoStatusBadge.tsx      ← Badge component: activated/inactivated/terminated
└── ErrorHighlight.tsx      ← Highlight cho error entries trong activity timeline
```

### Login Flow Update

File: `src/app/(auth)/login/page.tsx`

```
After login success:
  if user.roles.includes('super-admin') → router.push('/admin-panel')
  else → router.push('/dashboard')
```

### Middleware Update

File: `src/middleware.ts`

```
/admin-panel/* → require payload-token + super-admin role
  → nếu không có token: redirect /login
  → nếu có token nhưng không phải super-admin: redirect /dashboard
```

## Related code files

- `src/collections/Users.ts` — roles (`super-admin`, `tenant-owner`), tenants array,
  auth fields (otpHash, otpExpiresAt, lastLoginAt)
- `src/collections/Tenants.ts` — plan (`free/starter/pro/business`), status,
  SSO fields (customerId, serviceId, packCode, orderId, metaData),
  settings (storageUsed, storageLimitBytes, aiGenerationsCount)
- `src/lib/auth.ts` — `withAuth` wrapper, `getCurrentUser()`
- `src/lib/audit/log-activity.ts` — Phase 1 helper (logging)
- `src/app/api/admin/broadcasts/route.ts` — super-admin route guard pattern
- `src/lib/notifications/create-broadcast.ts` — broadcast implementation
- `src/app/(dashboard)/_components/` — sidebar reference for admin sidebar
- `src/middleware.ts` — routing rules, admin domain rewrite

## Implementation Steps

1. **DB migration** — Add `sso_status` column to `tenants` in `scripts/db-setup.js`.
   Add `terminated` to Tenants.ts `status` select options.
   Add `ssoStatus` field to Tenants.ts collection definition.
2. **Admin layout** — Create `src/app/(admin-panel)/layout.tsx` with role guard.
3. **Admin components** — `AdminSidebar.tsx`, `AdminHeader.tsx`, `SsoStatusBadge.tsx`.
4. **Login redirect** — Update login page to route super-admin → `/admin-panel`.
5. **Middleware** — Add `/admin-panel/*` guard in `src/middleware.ts`.
6. **API: users list** — `src/app/api/admin/users/route.ts`.
7. **API: user detail** — `src/app/api/admin/users/[id]/route.ts`.
8. **API: workspaces list** — `src/app/api/admin/workspaces/route.ts`.
9. **UI: users list page** — `src/app/(admin-panel)/users/page.tsx`.
10. **UI: user detail page** — `src/app/(admin-panel)/users/[id]/page.tsx`.
11. **UI: workspaces list page** — `src/app/(admin-panel)/workspaces/page.tsx`.
12. **UI: broadcast page** — `src/app/(admin-panel)/broadcast/page.tsx`.
13. **Move activity-logs** — Move Phase 1 page into `(admin-panel)` route group.
14. **Tests** — API route unit tests (TC-F15-02-xx).
15. **Validation** — `node scripts/check-migrations.js origin/staging`.

## Todo list

- [ ] Add `sso_status` column migration to `scripts/db-setup.js`
- [ ] Add `ssoStatus` field + `terminated` status to `src/collections/Tenants.ts`
- [ ] Create `src/app/(admin-panel)/layout.tsx` with role guard
- [ ] Create `src/components/admin/AdminSidebar.tsx`
- [ ] Create `src/components/admin/AdminHeader.tsx`
- [ ] Create `src/components/admin/SsoStatusBadge.tsx`
- [ ] Update login redirect in `src/app/(auth)/login/page.tsx`
- [ ] Update `src/middleware.ts` for `/admin-panel/*` routes
- [ ] Create `src/app/api/admin/users/route.ts`
- [ ] Create `src/app/api/admin/users/[id]/route.ts`
- [ ] Create `src/app/api/admin/workspaces/route.ts`
- [ ] Create `src/app/(admin-panel)/users/page.tsx`
- [ ] Create `src/app/(admin-panel)/users/[id]/page.tsx`
- [ ] Create `src/app/(admin-panel)/workspaces/page.tsx`
- [ ] Create `src/app/(admin-panel)/broadcast/page.tsx`
- [ ] Move Phase 1 activity-logs page into `(admin-panel)` route group
- [ ] Write unit/integration tests (TC-F15-02-xx)
- [ ] Run `node scripts/check-migrations.js origin/staging`
- [ ] PR: `feat/F15-02-user-management` → staging

## Success Criteria

- SC1: Users list loads and paginates. Search by email/name works. Role + status
  filters narrow results correctly.
- SC2: User detail shows SSO status badge for Owner users (activated/inactivated/terminated).
- SC3: User detail shows lỗi user gặp phải — error entries highlighted, filter works.
- SC4: Workspaces list renders with correct userCount, storageUsed, SSO status badge.
- SC5: Non-super-admin user receives 403 from all `/api/admin/*` endpoints.
- SC6: User detail page shows tenant memberships and last 20 activity entries.
- SC7: Super-admin login redirects to `/admin-panel`, not `/dashboard`.
- SC8: Broadcast form sends notification and shows success toast with count.
- SC9: Admin Panel layout tách biệt hoàn toàn với tenant dashboard layout.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `sso_status` column missing from existing DB | Certain | Medium | Idempotent ALTER TABLE migration in db-setup.js |
| userCount computation is slow at scale | Low | Medium | Cache via React Query (5 min TTL); add DB index on tenants.user relation |
| Plan name mismatch (docs vs code) | Certain | Low | Admin panel uses code values (`free/starter/pro/business`). Note mismatch in docs. |
| SSO status not yet synced from SSO | Medium | Medium | Default `sso_status = 'activated'` for existing tenants. Sync endpoint deferred until SSO integration confirmed. |
| Middleware conflicts with existing admin.primeweb.app routing | Medium | High | Test both paths: `/admin` (Payload CMS) vs `/admin-panel` (new admin UI) |

## Security Considerations

- All `/api/admin/*` routes use `withAuth` + super-admin role check — same
  pattern as `/api/admin/broadcasts`.
- User detail API strips `_verified`, `_verificationToken`, `loginAttempts`,
  `lockUntil`, OTP fields before returning response.
- "View workspace" link is a deep link — it does NOT create an impersonation
  session. Impersonation is deferred.
- Broadcast UI: XSS protection via HTML stripping, URL validation.
- Admin panel routes completely separated from tenant dashboard — no route overlap.

## Plan Name Reference

| Code value (DB) | SSO pack_code | Docs/Marketing name | Display in Admin |
|-----------------|---------------|--------------------|-----------------:|
| `free` | *(default fallback)* | Freemium | `free` |
| `starter` | `STARTER` | Starter | `starter` |
| `pro` | `PRO`, `PROFESSIONAL` | Standard / Professional | `pro` |
| `business` | `BUSINESS` | *(not in F15 PRD)* | `business` |

> **Action needed:** Align docs naming OR update code. See `researcher-04-plan-limits-audit.md`.

## Next steps

After Phase 2 merges:
- Phase 3 (Usage History) extends the user detail page with aggregated stats
  and adds KPI dashboard — no new collections, only new API endpoints and UI.
