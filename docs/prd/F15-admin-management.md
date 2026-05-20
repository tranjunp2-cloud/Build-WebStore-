# PRD: Admin Management — Phase 1 (F15)
> **Version:** 2.0 | **Created:** 2026-03-17 | **Updated:** 2026-04-15
> **Priority:** P1 | **Sprint:** [TBD] | **Size:** L
> **Depends on:** F02 (Auth — SSO provision, login flow) | **Blocks:** None

---

> [!IMPORTANT]
> **Phase 1 Scope:** PRD v2.0 thu hẹp scope từ "Full SaaS Admin" xuống **Phase 1 thực tế**:
> Activity Logs, User/Workspace Management, Usage History, Dashboard KPIs, Broadcast UI,
> và Admin Panel Layout. Các tính năng deferred (Impersonation, Subscription Config,
> Promotions, Campaigns, Multi-channel) sẽ được plan riêng khi có nhu cầu.

---

## 0. Story Traceability

| Story ID | Title | Phase | Status |
|----------|-------|-------|--------|
| US-F15-01 | Activity Logs — Audit Trail | Phase 1 | Ready |
| US-F15-02 | Quản lý User & Workspace | Phase 2 | Ready |
| US-F15-03 | Admin Dashboard KPIs | Phase 3 | Ready |
| US-F15-04 | Lịch sử sử dụng & Thông tin Plan | Phase 3 | Ready |
| US-F15-05 | Broadcast Notification UI | Phase 2 | Ready |
| US-F15-06 | Admin Panel Layout & Login Routing | Phase 2 | Ready |
| ~~US-F15-07~~ | ~~Impersonation~~ | — | **Deferred** |
| ~~US-F15-08~~ | ~~Cấu hình Subscription Tier~~ | — | **Deferred** |
| ~~US-F15-09~~ | ~~Khuyến mãi/Voucher~~ | — | **Deferred** |
| ~~US-F15-10~~ | ~~Chiến dịch tự động~~ | — | **Deferred** |
| ~~US-F15-11~~ | ~~Tích hợp đa kênh~~ | — | **Deferred** |

> Stories file: [`F15-admin-management-stories.md`](../stories/F15-admin-management-stories.md)

---

## 1. Problem Statement

Hệ thống hiện tại **không có công cụ quản trị** cho đội ngũ nội bộ:
- Không có audit trail — khi có sự cố (unauthorized access, data corruption), không thể truy vết.
- Không thể xem danh sách users/workspaces, không thể suspend tài khoản vi phạm.
- Không có usage metrics — phải truy vấn DB trực tiếp để biết tenant đang dùng bao nhiêu.
- Không có công cụ gửi thông báo toàn hệ thống (broadcast) từ giao diện admin.

Phase 1 giải quyết các vấn đề trên bằng **minimum viable admin surface**.

---

## 2. Target User

- **Primary User**: Super Admin (system owner, **1 tài khoản duy nhất**).
- **Technical Level**: Cao — nắm rõ hệ thống và operations.
- **Access**: Đăng nhập chung tại `/login`, hệ thống tự động redirect tới `/admin-panel` dựa trên role `super-admin`.

> **Đã chốt:** Chỉ có 1 tài khoản `super-admin` truy cập admin panel. Không cần thêm role nội bộ (Support Staff, Marketing).

---

## 3. Solution Overview

Xây dựng **Admin Panel** độc lập (`/admin-panel/*`) với layout riêng, tách biệt hoàn toàn
với tenant dashboard (`/dashboard`). Module cung cấp:

1. **Activity Logs** — Append-only audit trail ghi lại mọi mutation và auth event.
2. **User & Workspace Management** — Danh sách, tìm kiếm, lọc, suspend/unsuspend.
3. **Dashboard KPIs** — Tổng quan: total users, active today, tenants theo plan/status.
4. **Usage History** — Thống kê per-tenant: products, orders, AI usage, storage, plan & SSO info.
5. **Broadcast UI** — Form gửi global notification (API đã có sẵn).

---

## 4. Scope

### In Scope (Phase 1 — Hiện tại)
- User Activity Logs — audit trail cho mọi thao tác mutation + auth events.
- Basic User & Workspace Management — danh sách, tìm kiếm, lọc, suspend/unsuspend.
- User Usage History — thống kê per-tenant (products, orders, blogs, AI usage, storage) + plan & SSO info (chỉ xem).
- Admin Dashboard KPIs — total users, active today, tenants theo plan (Freemium/Starter/Standard/Professional)/status.

> **Lưu ý:** Tất cả Owner account tạo 100% từ SSO (TM Legacy) qua `POST /api/v1/sso/provision`.
> Không có form đăng ký cho Owner (UI đã ẩn). Plan gán từ SSO `pack_code`.
> 4 gói (Freemium/Starter/Standard/Professional) hiện tại giới hạn giống nhau.
- Broadcast Admin UI — form gửi global notification (API đã có sẵn).
- Admin Panel Layout riêng — route group `/admin-panel/*`, login redirect theo role.

### Out of Scope (Deferred — chưa quyết định timeline)
- Impersonate Account (US-F15-07) — phức tạp security, cần thiết kế riêng.
- Cấu hình Subscription Tier (US-F15-08) — tất cả gói hiện tại giới hạn giống nhau, chưa cần config.
- Plan enforcement/gating — hệ thống không enforce feature limits theo plan.
- Khuyến mãi/Voucher (US-F15-09) — phụ thuộc Subscription.
- Chiến dịch tự động (US-F15-10) — cần trigger engine riêng.
- Tích hợp đa kênh (US-F15-11) — cần budget third-party (Zalo ZNS, SendGrid).
- MRR/Churn Dashboard — chưa có recurring revenue data đủ.
- Dynamic Feature Sync — phụ thuộc Subscription Tier Config.
- Live Chat Customer Support.
- Tự động thay đổi giá tiền trên Payment Gateway.

---

## 5. Success Metrics

| Metric | Mục tiêu | Đo lường bằng |
|--------|----------|---------------|
| Audit Coverage | 100% mutations + auth events có log entry | Đếm activity_logs vs số write operations |
| Tốc độ xử lý Admin | Tìm user + xem info < 30 giây | Đo thủ công trong UAT |
| Khả năng truy vết | 0 incidents không truy vết được | Review sau 1 tháng vận hành |
| Hiệu năng truy vấn Log | GET /api/admin/activity-logs < 500ms p95 | API monitoring |
| Tốc độ tải Dashboard | Admin dashboard load < 1s | Lighthouse / Web Vitals |

---

## 6. Functional Requirements

| FR-ID | Yêu cầu | Story Ref | Ưu tiên | Phase |
|-------|---------|-----------|---------|-------|
| FR-01 | Hệ thống ghi log mọi mutation (create/update/delete) trên Users, Tenants, Products, Orders, Sites, Pages, Blogs, BlogCategories | US-F15-01 | P0 | 1 |
| FR-02 | Hệ thống ghi log auth events: login, logout, login_failed, password_reset | US-F15-01 | P0 | 1 |
| FR-02a | Hệ thống ghi log AI events: ai_generate_site, ai_generate_site_failed (chi tiết error code), ai_edit_block, ai_rewrite_text, ai_generate_seo, ai_generate_blog, ai_product_description, ai_bulk_parse, ai_extract_from_url, ai_apply_template | US-F15-01 | P0 | 1 |
| FR-02b | Hệ thống ghi log website editor events: site_publish, site_unpublish, site_save (với changes_summary chi tiết: blocks thêm/xóa/sửa/kéo thả, theme, header, footer, SEO, contact, branding), page_update, page_delete, seo_fix, seo_fix_all, seo_auto_meta_toggle | US-F15-01 | P0 | 1 |
| FR-02c | Hệ thống ghi log domain events: slug_change, domain_add, domain_remove | US-F15-01 | P0 | 1 |
| FR-02d | Hệ thống ghi log staff & account events: invite_staff, remove_staff, account_reset, plan_change | US-F15-01 | P1 | 1 |
| FR-03 | Admin có thể truy vấn activity logs với bộ lọc (userId, action, tenantId, khoảng thời gian) | US-F15-01 | P0 | 1 |
| FR-04 | Admin có thể xem danh sách và tìm kiếm tất cả users theo email/tên | US-F15-02 | P0 | 2 |
| FR-05 | Admin có thể xem chi tiết user: hồ sơ, tenant memberships, hoạt động gần đây | US-F15-02 | P0 | 2 |
| ~~FR-06~~ | ~~Admin có thể suspend/unsuspend users~~ | ~~US-F15-02~~ | — | **Deferred** — chưa cần, ưu tiên xem lỗi user gặp phải |
| FR-07 | Admin có thể xem danh sách và lọc tất cả workspaces (tenants) theo plan/status | US-F15-02 | P1 | 2 |
| FR-08 | Admin dashboard hiển thị KPIs: Total Users, Active Today, New/Week, Tenants theo Plan/Status | US-F15-03 | P1 | 3 |
| FR-09 | Admin có thể xem thống kê sử dụng per-tenant (products, orders, AI, storage) + plan & SSO info | US-F15-04 | P1 | 3 |
| FR-10 | Admin có thể gửi broadcast notification toàn hệ thống qua form UI | US-F15-05 | P1 | 2 |
| FR-11 | Admin panel có layout riêng, login redirect theo role, middleware guard | US-F15-06 | P0 | 2 |
| ~~FR-12~~ | ~~Impersonate workspace owner~~ | ~~US-F15-07~~ | — | **Deferred** |
| ~~FR-13~~ | ~~Cấu hình giới hạn subscription tiers~~ | ~~US-F15-08~~ | — | **Deferred** |
| ~~FR-14~~ | ~~Tạo và quản lý mã khuyến mãi~~ | ~~US-F15-09~~ | — | **Deferred** |
| ~~FR-15~~ | ~~Chiến dịch tự động~~ | ~~US-F15-10~~ | — | **Deferred** |
| ~~FR-16~~ | ~~Tích hợp đa kênh~~ | ~~US-F15-11~~ | — | **Deferred** |

---

## 7. Business Rules

- **BR-01 (Tính bất biến của Audit):** Activity logs là append-only — không được update hoặc delete qua API (trừ GDPR erasure bởi super-admin).
- **BR-02 (Đầy đủ Log):** Mọi mutation (create/update/delete) trên Users, Tenants, Products, Orders phải tạo activity log entry. Log write failure KHÔNG được block request gốc (fire-and-forget pattern).
- **BR-03 (Không lưu PII trong Log):** Metadata trong activity logs không được chứa passwords, OTP codes, hoặc Stripe secrets.
- **BR-04 (Phân cấp):** Workspace Owner không thể bị xóa bởi Admin trừ khi Workspace đó bị xóa hoàn toàn.
- ~~**BR-05 (Tự bảo vệ):** Deferred — suspend chưa implement.~~
- **BR-06 (Chỉ SSO tạo tài khoản):** Admin KHÔNG tạo Owner account — chỉ SSO (TM Legacy) làm việc này. Admin chỉ xem thông tin và lỗi user gặp phải.
- **BR-07 (Plan chỉ xem):** Admin chỉ xem plan info từ SSO (Freemium/Starter/Standard/Professional) — không chỉnh sửa, không cấu hình giới hạn.
- **BR-09 (SSO Status đồng bộ):** Trạng thái tài khoản Owner do SSO quản lý (activated/inactivated/terminated). Webstore đồng bộ vào `tenants.status`. Admin chỉ xem, không thay đổi.
- **BR-10 (Inactivated = khóa toàn workspace):** Khi Owner bị inactivated → workspace status = suspended → tất cả Staff cũng mất quyền đăng nhập. Khi Owner activated lại → workspace tự động mở.
- **BR-11 (Terminated = gỡ website):** Khi Owner bị terminated → workspace status = terminated → website bị unpublish, dữ liệu giữ 90 ngày. Staff mất quyền truy cập.
- **BR-08 (Retention 90 ngày):** Activity logs giữ tối đa 90 ngày. Phase 1 chưa cần cron xóa tự động — thêm khi logs vượt 500k rows.
- ~~**BR-08 (Impersonation):** Deferred.~~
- ~~**BR-09 (Xác thực lại Subscription):** Deferred.~~
- ~~**BR-10 (Đồng bộ tính năng động):** Deferred.~~
- ~~**BR-11 (Khuyến mãi):** Deferred.~~

---

## 8. Bối cảnh Provisioning & Plan

### Cách tạo tài khoản (F02 Auth Flow)

Tất cả Owner account được tạo **100% từ SSO (TM Legacy)**:

```
SSO (TM Legacy) tạo user
  → Dùng account admin lấy Bearer token từ Webstore login API
  → POST /api/v1/sso/provision với payload (email, company_name, pack_code,
    customer_id_number, service_id, first_name, last_name, ...)
  → Webstore validate unique fields + tạo User (owner) + Tenant
  → Plan gán từ SSO pack_code: STARTER → starter, STANDARD → standard, PROFESSIONAL → professional, ...
```

- **KHÔNG có form đăng ký (Register) cho Owner** — UI đã bị ẩn.
- **Staff** được Owner mời qua `POST /api/users/invite-staff`.
- Đăng nhập chung tại `/login`: Owner redirect SSO auth, Staff dùng credential nội bộ.
- 2FA (Email OTP) bắt buộc cho tất cả.

### 4 gói plan

**Freemium, Starter, Standard, Professional** — tất cả giới hạn tính năng **hiện tại giống nhau**.
Plan chỉ là metadata từ SSO `pack_code`. Admin panel chỉ **xem plan info** (chỉ xem).

> **⚠️ Plan Name Mismatch (cần align):**
> Code (source of truth: `Tenants.ts`) dùng: `free | starter | pro | business`.
> Docs/Marketing dùng: Freemium | Starter | Standard | Professional.
> Mapping hiện tại (`mapPlan()` trong SSO provision):
>
> | SSO pack_code | Code value (DB) | Docs name |
> |---------------|-----------------|-----------|
> | *(default)* | `free` | Freemium |
> | `STARTER` | `starter` | Starter |
> | `PRO` / `PROFESSIONAL` | `pro` | Standard / Professional |
> | `BUSINESS` | `business` | *(không có trong F15 docs)* |
>
> **Rủi ro:** Nếu SSO gửi `pack_code: "STANDARD"` → `mapPlan()` fallback `free` (silent downgrade).
> **Action:** Cần quyết định canonical naming trước khi implement F15 admin panel.
> Chi tiết: `plans/260415-1106-f15-admin-management-phase1/research/researcher-04-plan-limits-audit.md`

### Trạng thái tài khoản SSO → Webstore

SSO (TM Legacy) quản lý trạng thái tài khoản Owner. Webstore cần đồng bộ và phản ánh trạng thái này:

```
SSO Status          Ý nghĩa                              Webstore Mapping
┌─────────────┬──────────────────────────────────┬────────────────────────────────────┐
│ activated    │ Gói đang hoạt động bình thường   │ tenants.status = 'active'          │
│              │                                  │ Owner + Staff đăng nhập được       │
├─────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ inactivated │ Bị khóa tạm thời                 │ tenants.status = 'suspended'       │
│ (deactivated)│ Có thể mở lại từ SSO            │ Owner KHÔNG đăng nhập được         │
│              │                                  │ Staff KHÔNG đăng nhập được         │
│              │                                  │ Website vẫn live (không gỡ)        │
│              │                                  │ Dữ liệu giữ nguyên                │
├─────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ terminated  │ Gói bị xóa vĩnh viễn             │ tenants.status = 'terminated'      │
│ (deactivated)│ Phải tạo lại tài khoản SSO mới  │ Owner KHÔNG đăng nhập được         │
│              │ mới xài được                     │ Staff KHÔNG đăng nhập được         │
│              │                                  │ Website bị gỡ (unpublish)          │
│              │                                  │ Dữ liệu giữ 90 ngày rồi xóa      │
└─────────────┴──────────────────────────────────┴────────────────────────────────────┘
```

**Tác động lên Staff khi Owner bị deactivated:**
- Owner bị `inactivated` → tất cả Staff thuộc workspace đó cũng KHÔNG đăng nhập được (workspace bị suspended, không phải từng user bị suspended)
- Owner bị `terminated` → tất cả Staff mất quyền truy cập. Staff accounts vẫn tồn tại nhưng workspace bị terminated.
- Khi Owner được `activated` lại → Staff tự động truy cập được lại (workspace status = active)

**Cách đồng bộ:** SSO gọi API Webstore để cập nhật trạng thái (cần bổ sung endpoint mới hoặc mở rộng SSO provision endpoint).

### Ý nghĩa cho F15 Admin Panel

- Admin (super-admin) dùng chung login `/login`, routing khác: `super-admin` → `/admin-panel`.
- Admin **không tạo Owner account** — chỉ SSO làm việc này.
- Admin có thể: xem user info, xem plan (từ SSO), xem trạng thái SSO (activated/inactivated/terminated), xem logs, gửi broadcast.
- SSO payload fields hiển thị trong user/tenant detail: `customerId`, `serviceId`, `packCode`, `orderId`, `metaData`, **`ssoStatus`**.
- Admin **nhìn thấy** trạng thái SSO nhưng **không thay đổi** được — mọi thay đổi trạng thái đều từ SSO.

---

## 9. Các Phase triển khai

| # | Phase | Khối lượng | Branch | Trạng thái |
|---|-------|-----------|--------|-----------|
| 1 | Activity Logs | ~4–5 ngày | `feat/F15-01-activity-logs` | Chờ triển khai |
| 2 | User Management + Broadcast UI + Admin Layout | ~5–6 ngày | `feat/F15-02-user-management` | Chờ triển khai |
| 3 | Usage History & Dashboard KPIs | ~4–5 ngày | `feat/F15-03-usage-history` | Chờ triển khai |

**Thứ tự phụ thuộc:** Phase 1 → Phase 2 → Phase 3.

Chi tiết: [`plans/260415-1106-f15-admin-management-phase1/`](../../plans/260415-1106-f15-admin-management-phase1/plan.md)

---

## 10. Bố cục màn hình

> **[Ràng buộc chung]** Đây là Super Admin Panel nội bộ. Giao diện Admin này hoạt động
> độc lập và hoàn toàn tách biệt F18 CMS Layout (dành cho end-users).
> Admin panel có layout riêng: `src/app/(admin-panel)/layout.tsx`.

### 10.1. Admin Panel Layout

- **Route group:** `/admin-panel/*`
- **Sidebar:** `AdminSidebar` — dark theme, badge "ADMIN" ở header
- **Menu items:**
  - Dashboard (`/admin-panel`) — KPI cards (Phase 3)
  - Users (`/admin-panel/users`) — Danh sách user + chi tiết (Phase 2)
  - Workspaces (`/admin-panel/workspaces`) — Danh sách tenant (Phase 2)
  - Activity Logs (`/admin-panel/activity-logs`) — Nhật ký hoạt động (Phase 1)
  - Broadcast (`/admin-panel/broadcast`) — Gửi thông báo (Phase 2)
- **Bảo vệ route:** Middleware kiểm tra role `super-admin`, redirect `/dashboard` nếu không đủ quyền.

### 10.2. Nhật ký hoạt động — Activity Logs (Phase 1)

- **Mô tả:** Danh sách audit trail, chỉ thêm mới (append-only).
- **Components chính:**
  - DataTable với các cột: Thời gian, Người thực hiện (tên + email), Hành động, Tài nguyên, ID tài nguyên, Tenant, IP
  - Thanh lọc: Loại hành động (multi-select), Khoảng thời gian, Tìm user
  - Phân trang: phía server (50/trang, tối đa 200)
  - Mở rộng dòng: hiển thị `metadata` dạng JSON tree
- **Trạng thái:** Trống ("Chưa có nhật ký hoạt động nào"), Đang tải (skeleton), Lỗi (toast)

### 10.3. Danh sách Users (Phase 2)

- **Mô tả:** Danh sách tất cả users, có tìm kiếm và bộ lọc.
- **Components chính:**
  - Ô tìm kiếm (debounced 300ms)
  - Bộ lọc dropdown: Vai trò, Trạng thái
  - DataTable các cột: Tên (link tới chi tiết), Email, Badge vai trò, Tenant + Plan, Badge trạng thái, Lần đăng nhập cuối, Ngày tạo
- **Trạng thái:** Trống ("Không tìm thấy user nào" + nút xóa bộ lọc), Đang tải, Lỗi

### 10.4. Chi tiết User (Phase 2 + Phase 3)

- **Mô tả:** Thông tin chi tiết user, tenant memberships, timeline hoạt động, thống kê sử dụng.
- **Components chính:**
  - Thẻ hồ sơ: tên, email, vai trò, ngày tạo, lần đăng nhập cuối
  - Tenant memberships: vai trò, trạng thái, plan
  - Thao tác: [Tạm ngưng user] / [Bỏ tạm ngưng] + [Xem workspace]
  - Hoạt động gần đây (20 entries gần nhất) — từ Phase 1 API
  - Tab Sử dụng (Phase 3): số products, orders, AI usage, thanh storage, plan & SSO info
- **Trạng thái:** Đang tải, Lỗi, User bị tạm ngưng (banner cảnh báo)

### 10.5. Danh sách Workspaces (Phase 2)

- **Mô tả:** Danh sách tất cả tenants.
- **Components chính:**
  - Bộ lọc dropdown: Plan, Trạng thái
  - DataTable các cột: Tên, Slug, Email chủ sở hữu, Badge plan, Badge trạng thái, Số user, Dung lượng đã dùng/giới hạn, Ngày tạo
  - Click dòng → deep link `/admin/collections/tenants/{id}` (Payload panel)
- **Trạng thái:** Trống, Đang tải, Lỗi

### 10.6. Gửi thông báo — Broadcast (Phase 2)

- **Mô tả:** Form gửi global notification. API `POST /api/admin/broadcasts` đã có sẵn.
- **Components chính:**
  - Các trường form: Tiêu đề (bắt buộc, tối đa 200 ký tự), Nội dung (bắt buộc, tối đa 2000 ký tự), URL hành động (tùy chọn), Đối tượng nhận (dropdown: Tất cả)
  - Nút Gửi + dialog xác nhận
  - Toast thành công: "Đã gửi broadcast tới {N} users"
  - Danh sách broadcasts gần đây (query từ notifications collection, type=SYSTEM_ALERT)
- **Trạng thái:** Form trống, Đang gửi, Thành công, Lỗi

### 10.7. Admin Dashboard (Phase 3)

- **Mô tả:** Trang chủ admin với KPI cards, tự động làm mới mỗi 60 giây.
- **Components chính:**
  - KPI cards: Tổng số Users, Hoạt động hôm nay, Mới trong tuần, Chi phí AI tháng này
  - Phân bổ Tenants theo Plan (biểu đồ cột hoặc badge list)
  - Phân bổ Tenants theo Trạng thái
  - Thao tác nhanh: link tới Users, Workspaces, Broadcast
- **Trạng thái:** Đang tải (skeleton cards), Dữ liệu đã tải, Lỗi (nút thử lại)

---

## 11. Câu hỏi mở (Cần Review)

| # | Câu hỏi | Người phụ trách | Trạng thái |
|---|---------|----------------|-----------|
| 1 | ~~**Phân quyền nội bộ Admin:** Cần chia nhỏ role?~~ | PO/Team | ✅ Resolved — Chỉ 1 tài khoản `super-admin` duy nhất truy cập hệ thống. Không cần Support Staff / Marketing. |
| 2 | ~~**Chu kỳ thanh toán:** Hàng tháng hay hàng năm?~~ | — | **Deferred** — chưa có subscription model |
| 3 | ~~**Tích hợp thanh toán:** Backend validate hay delegate Stripe?~~ | — | **Deferred** — chưa có promotion |
| 4 | ~~**Dịch vụ bên thứ 3:** Zalo ZNS / SendGrid ưu tiên?~~ | — | **Deferred** — chưa có budget |
| 5 | ~~**Chính sách lưu trữ:** Activity logs giữ bao lâu?~~ | Tech Lead | ✅ Resolved — Giữ 90 ngày. Phase 1 chưa cần cron xóa tự động, thêm khi logs > 500k rows. |
| 6 | ~~**Tạm ngưng có lan truyền:**~~ | PO | ✅ Resolved — Suspend deferred. Chưa cần, ưu tiên xem lỗi user gặp phải qua activity logs. |

---

## 12. Điều kiện sẵn sàng (Definition of Ready)

- [x] PO/Team review và chốt phạm vi Phase 1 (In/Out scope).
- [x] Thu hẹp scope từ Full SaaS Admin xuống Phase 1 thực tế.
- [ ] Xác nhận các câu hỏi mở (#1, #5, #6).
- [x] Chốt quyết định UI: dùng Shadcn components (đã có sẵn trong project).
- [x] Implementation plan chi tiết: `plans/260415-1106-f15-admin-management-phase1/`
- [ ] Chuyển trạng thái Feature từ Draft → Approved.
