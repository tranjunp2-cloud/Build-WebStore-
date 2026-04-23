---
title: "F15 Admin Management — Phase 1"
description: >
  Super-admin tooling: activity logging, basic user/workspace management,
  usage history, and broadcast UI.
status: pending
priority: P1
effort: M (2 engineers × ~2 sprints)
branch: feat/F15-admin-management-phase1
tags: [admin, audit-log, user-management, usage-history, super-admin]
created: 2026-04-15
---

# F15 Admin Management — Phase 1

## Context

Super-admin currently has no visibility into what users are doing, cannot
suspend accounts, and cannot view usage metrics without direct DB queries.
This phase delivers the minimum viable admin surface for ECH Prime Web v2.

## Admin Account & Access

### Tạo tài khoản Admin

- Super-admin account được tạo **thủ công qua Payload CMS Admin Panel** (`/admin`)
  hoặc bằng script seed data.
- Trường `users.roles` chứa `['super-admin']` — chỉ super-admin hiện tại mới
  có quyền update field `roles` (access control đã có sẵn trong Users collection).
- **Không có registration flow cho admin** — admin accounts chỉ được tạo bởi
  super-admin khác hoặc qua database seed.

### Login Flow

- Admin dùng **chung trang login** (`/login`) với users bình thường.
- Sau khi login, hệ thống check `user.roles`:
  - Nếu có `super-admin` → redirect tới `/admin-panel` (admin dashboard mới).
  - Nếu có `tenant-owner` → redirect tới `/dashboard` (tenant dashboard hiện tại).
- Middleware kiểm tra role trước khi cho truy cập `/admin-panel/*` routes.
- Admin cũng có thể truy cập Payload CMS built-in panel tại `/admin` (đã có sẵn).

### Admin UI Menu Structure

```
/admin-panel
├── Dashboard           /admin-panel                  ← KPI cards (Phase 3)
├── Users               /admin-panel/users            ← User list + detail (Phase 2)
├── Workspaces          /admin-panel/workspaces       ← Tenant list (Phase 2)
├── Activity Logs       /admin-panel/activity-logs    ← Audit trail (Phase 1)
└── Broadcast           /admin-panel/broadcast        ← Send notification (Phase 2)
```

- Menu chỉ hiển thị cho users có role `super-admin`.
- Layout riêng: `src/app/(admin-panel)/layout.tsx` — tách biệt với tenant dashboard.
- Sidebar style giống tenant dashboard (dark theme) nhưng có badge "Admin" ở header.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | User Activity Logs | pending | [phase-01-activity-logs.md](./phase-01-activity-logs.md) |
| 2 | User Management + Broadcast UI | pending | [phase-02-user-management.md](./phase-02-user-management.md) |
| 3 | User Usage History & Stats | pending | [phase-03-usage-history.md](./phase-03-usage-history.md) |

## Dependency order

Phase 1 → Phase 2 → Phase 3.
Phase 2 requires activity_logs table (Phase 1) for the inline activity timeline.
Phase 3 aggregates data from Phase 1 logs + existing Tenants/AiUsageLogs collections.

## Branch strategy

```
feat/F15-01-activity-logs    → PR → staging
feat/F15-02-user-management  → PR → staging
feat/F15-03-usage-history    → PR → staging
```

Each PR follows `.github/pull_request_template.md`. No feature-parent branch.

## Account Provisioning & Plan Context

### Cách tạo tài khoản (F02 Auth Flow)

Tất cả Owner account đều được tạo **100% từ SSO (TM Legacy)**:

```
SSO (TM Legacy) tạo user
  → Dùng account admin lấy Bearer token từ Webstore login API
  → POST /api/v1/sso/provision với payload (email, company_name, pack_code, 
    customer_id_number, service_id, first_name, last_name, ...)
  → Webstore validate unique fields + tạo User (owner) + Tenant
  → Plan gán từ SSO pack_code: STARTER → starter, STANDARD → standard, PROFESSIONAL → professional, ...
  → ⚠️ Code hiện tại (mapPlan) dùng tên cũ free/starter/pro/business — cần cập nhật khi sửa code.
```

- **KHÔNG có form đăng ký (Register) cho Owner** — UI đã bị ẩn. Đầu vào
  Owner hoàn toàn phụ thuộc SSO.
- **Staff** được Owner mời qua `POST /api/users/invite-staff` — không tự đăng ký.
- Login chung tại `/login`: Owner redirect SSO auth, Staff dùng credential nội bộ.
- 2FA (Email OTP) bắt buộc cho tất cả.

### 4 gói plan

**Freemium, Starter, Standard, Professional** — tất cả giới hạn tính năng
**hiện tại giống nhau**. Plan chỉ là metadata từ SSO `pack_code`.

AI site generation: thành công 1 lần → ẩn F01, không cho gen lại.
Lỗi → cho retry hoặc chọn template. Admin panel chỉ **view plan info** (view-only).

### Ý nghĩa cho F15 Admin Panel

- Admin account (super-admin) cũng dùng chung login `/login`, nhưng routing
  khác: `super-admin` → `/admin-panel`, `tenant-owner` → `/dashboard`.
- Admin **không tạo Owner account** — chỉ SSO làm việc này.
- Admin có thể: xem user info, xem plan (từ SSO), suspend/unsuspend, xem logs.
- SSO payload fields hiện trong user/tenant detail: `customerId`, `serviceId`,
  `packCode`, `orderId`, `metaData` (raw JSON).

## Explicit Out of Scope

Các tính năng sau **KHÔNG nằm trong plan này**:

- **Impersonation** (US-F15-03) — Session giả lập, phức tạp security
- **Subscription Tier Config** (US-F15-04) — Tất cả gói giới hạn giống nhau, chưa cần config
- **Promotions/Voucher** (US-F15-05) — Chưa cần
- **Automated Campaigns** (US-F15-08) — Cần trigger engine riêng
- **Multi-channel messaging** (US-F15-09) — Cần budget third-party
- **MRR/Churn Dashboard** — Chưa có recurring revenue data
- **Plan enforcement/gating** — Tất cả plans hiện tại giới hạn giống nhau

## Related docs

- `docs/prd/F15-admin-management.md` (PRD source — đã cập nhật scope)
- `src/collections/AiUsageLogs.ts` — reference pattern for log collections
- `src/app/api/admin/broadcasts/route.ts` — reference pattern for super-admin APIs
- `src/components/dashboard/Sidebar.tsx` — reference for admin sidebar
- `scripts/db-setup.js` — migration executor (all DB changes go here)
