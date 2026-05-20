# User Stories: Migration SSO → PW2 Production — Tổng Hợp

<!-- Quy ước ID & Rules: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Tính năng:** SSO Migration Master + Nhóm A/B/C (Nhóm D infra cover trong master USs)
> **Wave:** 6-7 | **Độ ưu tiên:** P0 | **PRD tham chiếu:** [SSO_REDIRECT_MIGRATION_MASTER.md](../prd/SSO_REDIRECT_MIGRATION_MASTER.md)
> **Nguồn sitemap:** [WebStore](../qa/Sitemap%20-%20WebStore.mm) · [SSO](../qa/Sitemaps%20-%20SSO.mm)
> **Tổng số:** 44 USs (40 chính + 4 backlog) — gộp từ 8 file riêng

---

## Mục Lục

- [§1 Master Orchestration USs (US-MIG-01..07 + backlog 08-11)](#1-master-orchestration)
- [§2 Nhóm C — Mở Rộng Schema (US-EXT-01..04)](#2-nhóm-c--mở-rộng-schema)
- [§3 Nhóm B — Collections MỚI](#3-nhóm-b--collections-mới)
  - 3.1 Discounts (US-DSC-01..04)
  - 3.2 Brands (US-BRN-01..04)
  - 3.3 Customers (US-CUS-01..04)
  - 3.4 Menus (US-MNU-01..04)
  - 3.5 Email Templates (US-EML-01..03)
- [§4 Nhóm A — Migration Dữ Liệu (US-MIGA-01..10)](#4-nhóm-a--migration-dữ-liệu)
- [§5 Trình Tự, Phụ Thuộc, Quyết Định Đang Mở](#5-trình-tự--quyết-định-đang-mở)

---

## 1. Master Orchestration

### US-MIG-01: User PW1 Đang Hoạt Động Login PW2 Với Đầy Đủ Dữ Liệu

**Wave 7** | **P0** | **XL** | **Owner (Persona C)**

```text
As a   chủ doanh nghiệp đã sử dụng PW1
I want sau cutover login TM SSO → vào thẳng PW2 với đầy đủ dữ liệu lịch sử
So that tiếp tục vận hành kinh doanh không gián đoạn
```

**AC-1: Persona C Happy Path**

```gherkin
GIVEN tôi là Owner đang hoạt động trên PW1 với ≥1 store, ≥10 products, orders, customers, discounts
  AND dữ liệu đã được bulk pre-migrated (T-7d→T+0), migrationStatus='migrated'
WHEN  tôi login TM SSO sau cutover (T+0)
THEN  được redirect /post-sso-landing với JWT hợp lệ
  AND xác thực qua composite key (email + customer_id_number)
  AND redirect /dashboard trong < 3s
  AND mỗi module hiển thị số lượng records khớp với PW1 (±0)
```

**AC-2: Đối Chiếu Tính Toàn Vẹn Dữ Liệu**

```gherkin
GIVEN tôi vừa login lần đầu sau cutover
WHEN  mở từng module (Products/Orders/Customers/Discounts/Articles/Settings)
THEN  số lượng rows khớp PW1 ±0.01%
  AND nếu mismatch → log + alert Lark #migration-alerts
  AND hiển thị banner "Đã đồng bộ dữ liệu từ PW1 vào ngày {date}" trong 7 ngày đầu
```

**AC-3: Edge Case Migration Thất Bại**

```gherkin
GIVEN identity mapping thất bại (vd: email conflict)
  AND migrationStatus='failed'
WHEN  tôi login PW2 → redirect /migration-error
THEN  hiển thị thông báo "Hệ thống đang hoàn tất migration — vui lòng liên hệ support"
  AND ticket support tự động được tạo kèm context
```

**DoD:** Tất cả sub-PRDs Nhóm A hoàn thành · Data parity đã verify · Persona C E2E pass

---

### US-MIG-02: User Pre-Provisioned Login Lần Đầu — Trang Trống + Seed Templates

**Wave 6** | **P0** | **M** | **Owner (Persona B)**

```text
As a   Owner được tạo qua TM SSO webhook nhưng chưa login PW2
I want khi login lần đầu thấy dashboard trống + seed templates + onboarding checklist
So that hiểu cách dùng PW2 và bắt đầu setup
```

**AC-1: Empty State Với Seed Templates**

```gherkin
GIVEN tôi là Owner mới (đã được provision), migrationStatus='migrated', chưa login lần nào
WHEN  login TM SSO lần đầu
THEN  vào /dashboard với onboarding checklist: "Thêm sản phẩm / Chọn template / Setup vận chuyển / Setup thanh toán"
  AND seed templates được tải sẵn (F07)
  AND Tenants.limits được set theo plan tier
```

**AC-2: Theo Dõi Tiến Độ Onboarding**

```gherkin
GIVEN tôi đang ở empty state
WHEN  hoàn thành 1 step (vd: thêm product đầu tiên)
THEN  checklist tự cập nhật "✓ Đã thêm 1 sản phẩm"
  AND tiến độ hiển thị 1/4
  AND khi đủ 4/4 → banner "🎉 Setup hoàn tất!"
```

**DoD:** Persona B E2E pass · Onboarding lưu vào Tenants.onboardingProgress · Mobile 375px

---

### US-MIG-03: User Mới Đăng Ký Qua TM SSO Sau Cutover

**Wave 6** | **P0** | **S** | **Owner (Persona A)**

```text
As a   Owner đăng ký mới trên TM SSO Portal
I want tài khoản được tạo ở PW2 (không phải PW1) sau cutover
So that sử dụng platform mới ngay từ đầu
```

**AC-1: Endpoint Provisioning Route Sang PW2**

```gherkin
GIVEN form đăng ký submit ≥ ngày cutover
WHEN  TM gọi POST /api/v1/sso/provision với 6 fields bắt buộc
THEN  PW2 tạo User + Tenant với migrationStatus='migrated'
  AND Tenants.limits set theo pack_code → plan mapping
  AND HTTP 201 + gửi welcome email
```

**AC-2: Mapping Plan Tier Từ pack_code**

```gherkin
GIVEN payload có pack_code = "starter" / "business" / "pro" / "free"
WHEN  PW2 tạo Tenant
THEN  Tenants.plan map theo logic src/app/api/v1/sso/provision/route.ts:94
  AND Tenants.limits = ma trận tương ứng
  AND nếu unrecognized → mặc định 'free' + alert
```

**DoD:** Tests sso-provision hiện tại vẫn pass · Limits-matrix test cho 4 tiers

---

### US-MIG-04: Áp Dụng Giới Hạn Theo Plan Tier

**Wave 6** | **P0** | **L** | **Owner + Dev**

```text
As a   Owner gói Free (1 store, 100 orders/tháng)
I want PW2 block khi vượt giới hạn + hiển thị CTA upgrade
So that hiểu rõ giới hạn + quyết định upgrade trên TM SSO
```

**AC-1: Giới Hạn Số Lượng Store**

```gherkin
GIVEN gói Free, maxStores=1, đã có 1 tenant
WHEN  click "Thêm store mới" hoặc gọi API create
THEN  HTTP 403 code=PLAN_LIMIT_EXCEEDED, message "Gói Free chỉ cho phép 1 store. Nâng cấp Starter để có 3 stores"
  AND modal "Upgrade Plan" link đến TM SSO billing
  AND không có tenant nào được tạo
```

**AC-2: Giới Hạn Order Theo Tháng**

```gherkin
GIVEN gói Free maxOrdersPerMonth=100, tháng hiện tại đã có 100 orders
WHEN  customer checkout order #101
THEN  KHÔNG sync (theo sitemap: "đã vượt giới hạn thì không sync nữa")
  AND notification "Bạn đã đạt giới hạn. Nâng cấp để có 900 orders"
  AND order vẫn ghi DB với status='pending_plan_upgrade' (an toàn rollback)
```

**AC-3: Downgrade KHÔNG Tự Động Xóa**

```gherkin
GIVEN downgrade từ Professional (10) → Standard (5), đang có 8 stores
WHEN  webhook TM SSO báo plan change
THEN  Tenants.limits cập nhật
  AND KHÔNG tự xóa 3 stores dư (theo sitemap rule)
  AND notification "Vui lòng archive 3 stores hoặc upgrade lại"
  AND không thể tạo store mới đến khi count ≤ 5
```

**DoD:** Middleware D1 hoàn thành · Test 4 plan tiers tại boundaries · Audit log ≥ 90 ngày

---

### US-MIG-05: Chuyển Đổi Nhiều Store

**Wave 6** | **P0** | **M** | **Owner (Starter+)**

```text
As a   Owner gói Starter trở lên (3-10 stores)
I want chuyển nhanh giữa các stores qua switcher trong dashboard
So that quản lý nhiều stores không phải logout/login
```

**AC-1: UI Store Switcher**

```gherkin
GIVEN Owner có 3 tenants
WHEN  click dropdown switcher ở header
THEN  thấy 3 tenants với tên + thumbnail, tenant hiện tại được highlight
  AND nút "+ Thêm store mới" (disabled nếu đã đạt giới hạn)
```

**AC-2: Switch Context — Không Rò Rỉ Data**

```gherkin
GIVEN đang ở dashboard T1 với 50 orders
WHEN  chọn T2 từ switcher
THEN  URL update sang context T2
  AND data refresh (orders/products/customers của T2)
  AND latency ≤ 500ms
  AND không có data của T1 rò rỉ sang T2 view
```

**AC-3: Chặn Truy Cập Cross-Tenant**

```gherkin
GIVEN cố access T4 (không sở hữu) qua URL `/dashboard?tenantId=T4`
WHEN  middleware check users.tenants[]
THEN  HTTP 403 + redirect tenant đầu tiên của tôi
  AND ghi security audit log
```

**DoD:** Sub-PRD D2 hoàn thành · Pen-test isolation pass · Last-active lưu localStorage

---

### US-MIG-06: Chuyển Đổi Giữa 4 Products (DIS/PW/CRM/POS)

**Wave 6** | **P0** | **M** | **Owner**

```text
As a   Owner có quyền truy cập nhiều products
I want chuyển giữa DIS/PW/CRM/POS qua burger menu
So that không phải logout TM SSO mỗi lần đổi product
```

**AC-1: Burger Menu Theo JWT**

```gherkin
GIVEN JWT carry products=['DIS','PW','CRM'] (gói Standard, 3 products)
WHEN  click burger menu
THEN  hiển thị 4 icons: DIS / PW (current) / CRM / POS (greyed badge "Upgrade")
  AND click DIS → window.open(`dis.primecommerce.asia/sso-landing?token={JWT}`)
  AND click POS → tooltip "Nâng cấp Professional để mở khóa POS" + link TM SSO
```

**AC-2: Icon Link Internal Trên Pages**

```gherkin
GIVEN đang xem chi tiết Order
WHEN  thấy icon CRM cạnh tên customer (theo sitemap "icon internal link trên platform")
THEN  click → mở CRM customer profile, JWT pass để auto-login
```

**AC-3: Refresh Sau Downgrade Plan**

```gherkin
GIVEN Standard → Starter (chọn PW)
WHEN  webhook đến
THEN  burger refresh chỉ còn PW highlighted, products khác greyed
  AND nếu đang ở tab CRM → auto-redirect TM SSO portal
```

**DoD:** Sub-PRD D3 hoàn thành · Test integration 4 tiers × 4 products (16 combinations)

---

### US-MIG-07: Plan Thay Đổi Real-Time Qua Webhook

**Wave 6** | **P0** | **M** | **Owner + Dev**

```text
As a   Owner upgrade plan trên TM SSO
I want PW2 phản ánh plan mới ngay lập tức (không phải logout/login)
So that sử dụng feature mới của plan ngay trong session đang active
```

**AC-1: Webhook Phản Ánh < 5 Phút**

```gherkin
GIVEN đang gói Free trong PW2 dashboard (active session)
WHEN  click "Upgrade Starter" trên TM SSO portal
  AND TM gọi POST /api/v1/sso/subscription-update {customer_id, new_plan, effective_date}
THEN  verify signature TM_SSO_WEBHOOK_SECRET
  AND cập nhật Tenants.plan='starter' + Tenants.limits = matrix
  AND ghi entry vào Tenants.subscriptionHistory
  AND HTTP 200 trong < 2s
  AND PW2 dashboard refresh banner plan trong 5 phút (polling/SSE)
  AND user thấy "🎉 Đã nâng cấp Starter — bạn có thể tạo tối đa 3 stores"
```

**AC-2: Tính Idempotency Của Webhook**

```gherkin
GIVEN TM retry với cùng request_id
WHEN  PW2 nhận lần thứ 2
THEN  detect duplicate → HTTP 200 + log idempotent hit
  AND KHÔNG double-update plan / double-write history
```

**AC-3: Fallback Reconciliation**

```gherkin
GIVEN PW2 webhook receiver down 1 giờ, TM gửi mà PW2 miss
WHEN  cron chạy mỗi 15 phút
THEN  query TM SSO API để so sánh plan
  AND nếu mismatch → auto-update PW2 + alert Lark
  AND user vẫn được service đúng plan với lag tối đa 15 phút RPO
```

**DoD:** Sub-PRD D4 hoàn thành · Hợp đồng webhook ký với TM (T-30d) · Chống replay (timestamp + signature)

---

### Backlog (Wave 7)

- **US-MIG-08** Hỗ trợ escalation cho user migrationStatus='failed' (P1, Support perspective)
- **US-MIG-09** Diễn tập rollback DevOps < 5 phút (P1, DevOps perspective)
- **US-MIG-10** MFA backup email thay thế OTP (P2, theo sitemap SSO MFA Mail backup)
- **US-MIG-11** Migration Pages từ WordPress storefronts (P2, cần quyết định Q-07)

---

## 2. Nhóm C — Mở Rộng Schema

### US-EXT-01: Thêm Tenants.limits — Lưu Trữ Giới Hạn Plan Tier

**Wave 6** | **P0** | **M** | **Dev**

```text
As a   Dev triển khai middleware enforcement D1
I want Tenants schema có object limits lưu giới hạn theo plan
So that middleware đọc DB (cache 60s) thay vì hardcode
```

**AC-1: Định Nghĩa Schema**

```gherkin
GIVEN Tenants.ts chưa có field limits
WHEN  Dev thêm group field
THEN  schema có:
  - limits.maxStores: number
  - limits.maxOrdersPerMonth: number
  - limits.unlimitedSocialChannels: boolean
  - limits.unlimitedDeliveryProviders: boolean
  - limits.advancedAnalytics: boolean
  - limits.allowedProducts: array enum ['DIS','PW','CRM','POS']
  AND có entry trong db-setup.js MIGRATIONS
  AND CI check-migrations.js pass
```

**AC-2: Giá Trị Mặc Định Theo Plan (Seed)**

```gherkin
GIVEN matrix đã lock với Finance (Q-10)
WHEN  Tenant tạo mới / plan thay đổi
THEN  hook auto-populate:
  - Free: {maxStores:1, maxOrdersPerMonth:100}
  - Starter: {maxStores:3, maxOrdersPerMonth:900}
  - Standard: {maxStores:10, maxOrdersPerMonth:-1}
  - Professional: {maxStores:5, maxOrdersPerMonth:-1, allowedProducts: cả 4}
  AND giá trị seed khớp matrix sitemap SSO Billing
```

**DoD:** Schema shipped · Migration db-setup · Verify 4 plan tiers

---

### US-EXT-02: Thêm Tenants.members — Phân Vai Trò Team (Manager / Crew)

**Wave 6** | **P1** | **M** | **Dev + Owner**

```text
As a   Owner muốn mời staff hỗ trợ vận hành
I want thêm members với vai trò Manager / Crew (theo sitemap WebStore > Settings > Team Member)
So that staff truy cập dashboard với permission phù hợp
```

**AC-1: Schema + Luồng Invite**

```gherkin
GIVEN Dev thêm field Tenants.members[]
WHEN  định nghĩa schema
THEN  có:
  - user: relationship Users
  - role: 'owner'|'manager'|'crew'
  - invitedAt, acceptedAt, status (pending|active|revoked)
  AND email invite gửi qua AWS SES với link accept
  AND Crew KHÔNG thấy menu Discount/Settings/TeamMember (UI gate)
  AND Manager full quyền trừ Owner profile
```

**AC-2: Publish/Unpublish + Xóa**

```gherkin
GIVEN tenant có 5 members active
WHEN  Owner click "Unpublish" trên 1 member
THEN  status='revoked', user mất quyền truy cập ngay (middleware check)
  AND audit log lưu invitedAt + revokedAt
```

**DoD:** Schema + invite email · Middleware RBAC verify role mỗi route

---

### US-EXT-03: Thêm Sites.appIntegration — FB Pixel + GA

**Wave 6** | **P1** | **S** | **Dev + Owner**

```text
As a   Owner muốn track visitors storefront qua FB Pixel + GA
I want nhập tracking IDs trong Settings → storefront tự inject scripts
So that marketing đo conversions chính xác
```

**AC-1: Schema + Validate Input**

```gherkin
GIVEN Sites.ts chưa có appIntegration
WHEN  Dev thêm group field
THEN  có:
  - appIntegration.fbPixelId (validate /^\d{15,16}$/)
  - appIntegration.gaTrackingId (validate /^(UA-\d+-\d+|G-[A-Z0-9]+)$/)
  - appIntegration.fbPixelEnabled, gaEnabled (checkbox)
  AND nếu invalid → inline error trong Payload admin
```

**AC-2: Inject Script Vào Storefront**

```gherkin
GIVEN fbPixelEnabled=true với ID hợp lệ
WHEN  storefront page render
THEN  `<head>` chứa FB Pixel snippet với ID
  AND có `<noscript>` fallback
  AND nếu disabled/invalid → không render script
  AND tương tự cho GA (gtag.js)
```

**DoD:** Server-side render injection · Test với tài khoản FB/GA thật

---

### US-EXT-04: Thêm Tenants.subscriptionHistory — Audit Plan Modification

**Wave 6** | **P1** | **S** | **Dev + Finance**

```text
As a   Dev + Finance audit billing
I want subscriptionHistory[] log mọi plan change
So that audit khi có dispute + Owner xem "Request history" (sitemap SSO Billing)
```

**AC-1: Schema + Hook Write**

```gherkin
GIVEN Tenants.ts thêm field subscriptionHistory[]
WHEN  định nghĩa schema array
THEN  có:
  - fromPlan, toPlan: text
  - changeType: 'upgrade'|'downgrade'|'renewal'|'cancel'
  - changedAt: date UTC
  - source: 'tm_sso_webhook'|'manual_admin'|'migration_seed'
  - actor: text
  - metadata: json
  AND hook on Tenants.plan change → tự append entry
```

**AC-2: UI Request History**

```gherkin
GIVEN Owner vào /dashboard/billing/history
WHEN  page load
THEN  table với filters: type, status, date, search
  AND nút export CSV
  AND link đến TM SSO portal cho thao tác upgrade
```

**DoD:** Schema + hook · Webhook US-MIG-07 populate field · Phase D backfill từ Stripe events

---

### US-EXT-05: Thêm Tenants.customDomains.dnsVerification (Gap G-6)

**Wave 7** | **P1** | **S** | **DevOps + Dev**
**Maps to:** master §7 C6 · Risk R-23

```text
As a   DevOps đảm bảo custom domains hoạt động sau migration
I want extend Tenants.customDomains[] với dnsStatus + auto re-verify
So that domain không kẹt "pending" forever post-cutover
```

**AC-1: Schema Extension**

```gherkin
GIVEN Tenants.customDomains[] hiện có {domain, status, vercelDomainId, isPrimary}
WHEN  Dev extend
THEN  thêm fields:
  - dnsVerification.status: 'pending'|'verified'|'failed'
  - dnsVerification.lastVerifiedAt: date
  - dnsVerification.txtRecord: text
  - dnsVerification.errorMessage: text (nullable)
  AND db-setup migration entry
```

**AC-2: Auto Re-Verify Cron**

```gherkin
GIVEN migration set status='pending' cho domains
WHEN  cron chạy mỗi 1h cho 24h đầu post-cutover
THEN  Vercel API check DNS records
  AND nếu verified → update status, alert Owner via email
  AND nếu fail > 24h → escalate Lark + auto-create support ticket
```

**DoD:** Schema + cron · Tested 3 domains scenarios · DNS verification drilled

---

### US-EXT-06: Thêm Sites.emailConfig.senderDomain (Gap G-7)

**Wave 7** | **P1** | **S** | **DevOps + Dev**
**Maps to:** master §7 C7 · Risk R-24

```text
As a   DevOps + Dev coordinate SES domain migration
I want per-tenant SES sender domain config (nếu PW1 tenant đã verified)
So that emails gửi từ tenant-specific domain (higher deliverability)
```

**AC-1: Schema + Fallback Logic**

```gherkin
GIVEN Sites.ts thêm group emailConfig
WHEN  Dev define schema
THEN  có:
  - emailConfig.senderDomain: text (vd: "shop.example.com")
  - emailConfig.senderName: text (vd: "Shop Store")
  - emailConfig.verified: boolean
  - emailConfig.dkimRecords: array
  AND email send pipeline: nếu verified=true → dùng tenant domain, else fallback default SES sender
```

**AC-2: Migration + Re-Verify TXT Records**

```gherkin
GIVEN PW1 tenant có verified sending domain
WHEN  scripts/migration/email-config.ts
THEN  migrate senderDomain + senderName
  AND verified=false initially (cần re-verify)
  AND DevOps chạy aws ses verify-domain-identity per tenant
  AND notification Owner "Update TXT records cho email deliverability" với DKIM values
```

**DoD:** Schema + send pipeline fallback · DevOps drill SES verify · Owner comm template

---

### US-EXT-07: Thêm Sites.customCode (Header/Footer JS/CSS Injection) (Gap G-8)

**Wave 7+** | **P2** | **M** | **Dev + Security**
**Maps to:** master §7 C8 · Risk R-26

```text
As a   Owner đã từng inject custom JS (FB Pixel manual, A/B test, hotjar...) trong PW1
I want PW2 cho phép inject custom HTML vào header/footer
So that không phải redo manual tracking setup
```

**AC-1: Schema + XSS Sanitization**

```gherkin
GIVEN Sites.ts thêm customCode field
WHEN  Dev define
THEN  có:
  - customCode.headerHtml: textarea (max 10KB)
  - customCode.footerHtml: textarea (max 10KB)
  - customCode.enabled: boolean
  AND server-side sanitize remove `<script src=...>` từ untrusted domains (whitelist FB, Google, Hotjar, Intercom)
  AND audit log mỗi thay đổi
```

**AC-2: Storefront Render**

```gherkin
GIVEN customCode.enabled=true với headerHtml chứa FB Pixel
WHEN  storefront page render
THEN  inject vào `<head>` cuối
  AND CSP policy adjust để allow inline scripts (controlled)
  AND nếu Q-21 chọn "force C3" → migration prompt Owner re-add via C3 appIntegration thay vì migrate raw HTML
```

**DoD:** Q-21 resolved · XSS sanitizer pen-tested · Security review pass

---

## 3. Nhóm B — Collections MỚI

### 3.1 Discounts (US-DSC)

> **Sitemap:** WebStore > Discount | **Master:** §7 B1 | **Sub-PRD:** F-discounts-prd.md + F-migration-discounts.md

#### US-DSC-01: Owner CRUD Discount Code

**Wave 6** | **P0** | **M** | **Owner**

```text
As a   chủ shop chạy promotion
I want tạo discount với types, status, limit usage, date range
So that thu hút customers + đẩy doanh số campaigns
```

**AC-1: Tạo Với Đầy Đủ Fields**

```gherkin
GIVEN vào /dashboard/discounts click "Thêm"
WHEN  điền code, type (percentage/fixed), value, usage_limit, start_date, end_date, status
THEN  Discounts collection lưu với tenantId
  AND code UNIQUE per tenant (HTTP 409 nếu trùng)
  AND HTTP 201 + toast
```

**AC-2: Edit + Toggle Status**

```gherkin
GIVEN có ≥1 discount
WHEN  edit value/end_date, save
THEN  update với updatedAt=now
  AND active→inactive: orders đang dùng code không bị ảnh hưởng (BR: forward only)
```

**DoD:** Discounts.ts shipped · Tests CRUD pass

#### US-DSC-02: Search + Filter Discounts

**Wave 6** | **P1** | **S** | **Owner**

```gherkin
GIVEN /dashboard/discounts có 20+ records
WHEN  filter Type=percentage + Status=active + Date range last 30d
THEN  list refresh theo matching
  AND URL query params có thể share
```

**DoD:** Mobile 375px

#### US-DSC-03: Export CSV

**Wave 6** | **P2** | **XS** | **Owner**

```gherkin
GIVEN /dashboard/discounts
WHEN  click "Export"
THEN  CSV download cột: code, type, value, usage_count, status, dates
  AND filename `discounts-{slug}-{YYYYMMDD}.csv`
```

#### US-DSC-04: Migrate Từ PW1

**Wave 7** | **P0** | **L** | **Dev**

```text
As a   Dev Phase D
I want ETL PW1 discounts → PW2 Discounts
So that Owner thấy đủ discounts lịch sử
```

**AC-1: ETL Idempotent**

```gherkin
GIVEN pw1.promotions có N discounts
WHEN  npx tsx scripts/migration/discounts.ts --tenant=ALL
THEN  mỗi PW1 → PW2 Discount với legacyId=pw1.id
  AND re-run không tạo duplicate (upsert qua legacyId)
  AND count match ±0
  AND tenantId map qua identity mapper
```

**AC-2: Mapping Fields**

```gherkin
GIVEN pw1.promotions.{id, code, discount_type, amount, max_uses, valid_from, valid_to, is_active, owner_id}
THEN  PW2 mapping:
  - code → code
  - discount_type ('percent'/'amount') → type ('percentage'/'fixed_amount')
  - amount → value, max_uses → usage_limit
  - valid_from → start_date (convert MYT→UTC)
  - is_active → status
  - owner_id → resolve tenantId
```

**DoD:** Reconciliation pass · Dry-run staging với prod-size · Theo template sub-PRD

---

### 3.2 Brands (US-BRN)

> **Sitemap:** WebStore > Product > Brand | **Master:** §7 B2 + C4

#### US-BRN-01: Owner CRUD Brand

**Wave 6** | **P0** | **M** | **Owner**

```text
As a   shop bán nhiều brands
I want CRUD brands riêng
So that gán brand cho products → buyer filter ở storefront
```

**AC-1: Thêm Với Logo**

```gherkin
GIVEN /dashboard/brands click "Thêm"
WHEN  điền name, slug (auto), upload logo, description, status
THEN  Brands collection lưu với tenantId
  AND slug unique per tenant
  AND logo qua Media collection
```

**AC-2: Edit + Delete Có Guard**

```gherkin
GIVEN brand "Nike" liên kết 50 products
WHEN  click "Xóa Nike"
THEN  modal confirm "50 products sẽ mất reference brand. Tiếp tục?"
  AND confirm → soft delete, Products.brand → null
  AND hard delete request block với đề xuất reassign
```

**DoD:** Brands.ts + Products.brand FK shipped

#### US-BRN-02: Sort + Search

**Wave 6** | **P1** | **S** | **Owner**

```gherkin
GIVEN có 50+ brands
WHEN  sort "Product count desc" hoặc search "Nike"
THEN  list refresh
  AND mỗi row hiển thị product_count (cached 5 phút)
```

#### US-BRN-03: Gán Brand Cho Product

**Wave 6** | **P0** | **S** | **Owner**

**AC-1: Dropdown Brand Trong Product Form**

```gherkin
GIVEN edit product
WHEN  scroll đến field "Brand"
THEN  dropdown brands active theo alphabetical
  AND có option "+ Tạo brand mới" inline modal
  AND field optional
```

**AC-2: Filter Brand Ở Storefront**

```gherkin
GIVEN buyer ở /sites/{slug}/products
WHEN  sidebar filter "Brand" checkbox
THEN  list refresh theo selection
  AND URL `?brand=nike,adidas` có thể share
```

#### US-BRN-04: Migrate Brands Từ PW1

**Wave 7** | **P0** | **M** | **Dev**

**AC-1: ETL Trình Tự 2 Bước**

```gherkin
GIVEN pw1.brands.{id, name, logo_url, owner_id} + pw1.products.brand_id
WHEN  brands.ts chạy TRƯỚC products.ts
THEN  bước 1: tạo Brands với legacyId
  AND bước 2: products.ts resolve legacyBrandId → PW2 Brand._id
  AND orphan → log + brand=null
```

**AC-2: Migration Logo Media**

```gherkin
GIVEN brand có logo_url từ PW1 CDN/WordPress
THEN  download → upload PW2 Media
  AND Brands.logo = Media._id
  AND fail → log + null + alert
```

**DoD:** Reconciliation pass · Verify sample 10 brands

---

### 3.3 Customers (US-CUS)

> **Sitemap:** WebStore > Customers | **Master:** §7 B3
> **Lưu ý:** Promote từ Orders.customer nested → collection riêng

#### US-CUS-01: Owner Xem Danh Sách Customers

**Wave 6** | **P0** | **M** | **Owner**

```text
As a   shop quản lý mối quan hệ customer
I want xem customers list riêng (không nested theo từng order)
So that identify VIP, segment audit
```

**AC-1: View List**

```gherkin
GIVEN /dashboard/customers
THEN  table cột: name, email, phone, total_orders, total_spent, rank, last_order_date
  AND sort mặc định = total_spent desc
  AND pagination 50/page
  AND click row → /dashboard/customers/{id} detail
```

**AC-2: Detail Page Với Lịch Sử Order**

```gherkin
GIVEN click "Nguyễn Văn A"
THEN  info: contact, addresses, totals, rank
  AND list orders desc theo date
  AND CTA "Gửi email" + "Thêm note"
```

**DoD:** Customers.ts với tenantId scope · Derived fields via Payload hook

#### US-CUS-02: Hệ Thống Rank Customer

**Wave 6** | **P1** | **M** | **Owner**

```text
As a   Owner identify VIP
I want rank tự động compute theo total_spent
So that target marketing theo từng tier
```

```gherkin
GIVEN customer có total_spent = RM 1,500
WHEN  Payload hook chạy sau order paid
THEN  Customers.rank = 'Silver' (default tier matrix)
  AND Owner customize tiers ở /dashboard/settings/customer-tiers
  AND tier change → email "Chúc mừng! Bạn là {tier}"
```

**DoD:** Matrix rank cấu hình được trong Tenants.customerTierConfig

#### US-CUS-03: Search + Filter

**Wave 6** | **P1** | **S** | **Owner**

```gherkin
GIVEN /dashboard/customers
WHEN  filter Rank=Gold + Date range "Order cuối > 60d"
THEN  list refresh các VIP lapsed
  AND export CSV theo filter
```

#### US-CUS-04: Migrate Customers — Promote Từ Nested

**Wave 7** | **P0** | **L** | **Dev**

**AC-1: Dedup Từ PW1**

```gherkin
GIVEN pw1.customers (nếu có) hoặc nested pw1.orders.customer_email
WHEN  scripts/migration/customers.ts
THEN  dedup theo email per tenant
  AND tính total_orders + total_spent từ orders aggregation
  AND tính rank theo tenant tier config
```

**AC-2: Link Orders.customer FK**

```gherkin
GIVEN ETL customers xong trước ETL orders
WHEN  orders.ts chạy
THEN  resolve customer_email → Customers._id
  AND Orders.customer = FK (không nested)
  AND missing → tạo on-the-fly + warn
```

**AC-3: Backward Compatible**

```gherkin
GIVEN Orders hiện tại có Orders.customer = nested
WHEN  migration chạy
THEN  giữ Orders.customerSnapshot (immutable historical)
  AND thêm Orders.customer = relation
  AND UI ưu tiên Customers (live) cho contact, snapshot cho address tại thời điểm order
```

**DoD:** Unique emails khớp · Orders backward compat verified

---

### 3.4 Menus (US-MNU)

> **Sitemap:** WebStore > My web store > Menu | **Master:** §7 B4
> **Q-12 mở:** collection riêng vs extend Sites.headerBlock?

#### US-MNU-01: Cấu Hình Header Menu

**Wave 6** | **P1** | **M** | **Owner**

```text
As a   Owner customize navigation storefront
I want add/edit/reorder header với tabs + sub-tabs (dropdown)
So that buyer điều hướng dễ
```

**AC-1: Thêm Tab**

```gherkin
GIVEN /dashboard/menus/header
WHEN  click "Thêm tab" → điền label + link_type (page/category/external_url) + target
THEN  Menus collection lưu với menu_type=header, position=last
  AND drag-drop reorder cập nhật position
  AND preview pane real-time
```

**AC-2: Thêm Sub-tab Dropdown**

```gherkin
GIVEN có tab "Products" ở header
WHEN  click "+ Thêm sub-tab"
THEN  modal nhập label + link
  AND tab Products có chevron-down + dropdown
  AND max 3 levels deep
```

**DoD:** Menus.ts với menu_type, items[] (recursive), tenantId · Preview real-time

#### US-MNU-02: Cấu Hình Footer Menu

**Wave 6** | **P1** | **S** | **Owner**

```gherkin
GIVEN /dashboard/menus/footer
WHEN  thêm tab "Dịch vụ khách hàng" + sub-tabs "FAQ", "Đổi trả", "Liên hệ"
THEN  Menus lưu menu_type=footer
  AND storefront footer render theo cấu trúc
  AND footer hỗ trợ column groups (khác với header inline)
```

**DoD:** Footer mobile responsive (collapse accordion)

#### US-MNU-03: Toggle Hiển Thị Icon (Search/Cart)

**Wave 6** | **P2** | **XS** | **Owner**

```gherkin
GIVEN /dashboard/menus/settings
WHEN  uncheck "Hiện icon Cart"
THEN  Sites.headerIcons.cart=false
  AND storefront ẩn cart icon ngay (revalidatePath)
  AND disable cart → checkout vẫn accessible qua direct URL
```

#### US-MNU-04: Migrate Menus Từ PW1

**Wave 7** | **P1** | **M** | **Dev**

**AC-1: Cấu Trúc Tree**

```gherkin
GIVEN pw1.menus.{id, type, parent_id, label, link, position, owner_id} recursive
WHEN  scripts/migration/menus.ts
THEN  build tree từ parent_id → flat items[]
  AND giữ order theo position
  AND resolve: pw1.page_id → PW2 slug; pw1.category_id → Categories._id
  AND missing target → external URL/empty + warn
```

**AC-2: Tách Header/Footer**

```gherkin
GIVEN pw1.menus mixed types
THEN  filter pw1.menus.type='header' → menu_type='header'
  AND 'footer' → menu_type='footer'
  AND unknown → mặc định header + log
```

**DoD:** Q-12 đã resolve trước khi → Ready

---

### 3.5 Email Templates (US-EML)

> **Sitemap:** WebStore > Settings > Email templates | **Master:** §7 B5
> **Hạ tầng hiện có:** AWS SES via Payload (src/lib/email/send.ts) — templates hardcoded
> **Q-11 mở:** WYSIWYG hay variable-only edit?

#### US-EML-01: Owner Edit Email Templates

**Wave 6** | **P1** | **L** | **Owner**

```text
As a   shop muốn brand voice nhất quán
I want edit 3 templates: Order Confirmation / Cancelled / Delivered
So that customer nhận email phù hợp brand
```

**AC-1: List 3 Templates Với Status**

```gherkin
GIVEN /dashboard/settings/email-templates
THEN  3 cards: "Xác nhận đơn hàng", "Đơn hàng bị hủy", "Đơn hàng đã giao"
  AND status (active=custom edited, default=system fallback)
  AND CTA "Edit" + "Preview" + "Publish/Unpublish toggle"
```

**AC-2: Edit Với Chèn Variable**

```gherkin
GIVEN click Edit "Xác nhận đơn hàng"
WHEN  editor mở
THEN  input subject line + body editor (WYSIWYG/rich text)
  AND sidebar variables clickable: {{customer_name}}, {{order_number}}, {{order_total}}, {{order_items}}, {{store_name}}, {{tracking_url}}
  AND insert chèn vào cursor
  AND preview button với sample data
```

**AC-3: Publish/Unpublish**

```gherkin
GIVEN đã edit chưa publish
WHEN  toggle → "Published"
THEN  EmailTemplates lưu status='active'
  AND emails kế tiếp dùng template custom
  AND unpublish → fallback system default
  AND emails đang in-flight không bị ảnh hưởng (locked per email)
```

**DoD:** EmailTemplates.ts với template_type (enum), subject, body_html, status, tenantId · Variable interpolation an toàn XSS · Pipeline send: check active → fallback default

#### US-EML-02: Preview Với Sample Data

**Wave 6** | **P1** | **S** | **Owner**

```gherkin
GIVEN đang edit template
WHEN  click "Preview"
THEN  modal với rendered email dùng sample data (Tom Buyer, 3 items, RM 245.50)
  AND toggle view Desktop/Mobile
  AND button "Gửi test đến email tôi" → SES gửi đến Users.email
```

**DoD:** Preview <1s · Test send rate-limit 5/phút

#### US-EML-03: Migrate Email Templates Từ PW1

**Wave 7** | **P1** | **M** | **Dev**

**AC-1: ETL 3 Types**

```gherkin
GIVEN pw1.email_templates.{id, template_type, subject, body_html, status, owner_id}
WHEN  scripts/migration/email-templates.ts
THEN  3 types per tenant migrate độc lập (order_confirmation/cancelled/delivered)
  AND chỉ 1 record per type (duplicate → giữ latest by updated_at)
  AND convert variable syntax: PW1 [customer_name] → PW2 {{customer_name}}
  AND body_html sanitize XSS
```

**AC-2: Fallback Cho Tenants Chưa Custom**

```gherkin
GIVEN ~30% tenants chưa custom (dùng PW1 default)
THEN  KHÔNG tạo record (empty = system fallback)
  AND PW2 send pipeline tự dùng default
  AND log "Skipped {tenantId} — no custom template"
```

**DoD:** Q-11 đã resolve · Test variable syntax với 10 samples

---

## 4. Nhóm A — Migration Dữ Liệu

> **Phạm vi:** USs cho 10 features mà PW2 đã có collection sẵn. Chỉ chứa migration USs (Dev perspective). Stories về behavior feature vẫn ở các file F-numbered hiện có (F02, F08, F10, F17...).

### US-MIGA-01: Migrate Users + Identity Mapping (F02 base)

**Wave 7** | **P0** | **L** | **Dev**

```text
As a   Dev Phase D
I want ETL PW1 users → PW2 Users với composite key
So that mọi PW1 user có PW2 acc với migrationStatus='migrated' trước cutover
```

**AC-1: Nền Tảng Identity Map**

```gherkin
GIVEN pw1.users.{id, email, customer_id_number, service_id, first_name, last_name, pack_code, phone}
WHEN  scripts/migration/users.ts --tenant=ALL
THEN  PW2 Users record:
  - composite key (email + customer_id_number) unique
  - migrationStatus='migrated' sau success
  - roles=['tenant-owner']
  - legacyUserId=pw1.users.id
  AND duplicate key → status='failed' + log + alert Lark
```

**AC-2: Idempotency**

```gherkin
GIVEN script chạy lần 1 thành công
WHEN  re-run cùng day
THEN  upsert qua composite key (không duplicate)
  AND existing migrated → skip silently
  AND chỉ update fields đã thay đổi (firstName/lastName/phone)
```

**DoD:** users.ts shipped · Test composite validator · Reconciliation match

---

### US-MIGA-02: Migrate Tenants + Sites (customDomains)

**Wave 7** | **P0** | **L** | **Dev**

```text
As a   Dev
I want ETL tenants/stores + custom domains + theme → PW2 Tenants + Sites
So that Owner thấy đủ stores với domain/theme/payment config nguyên vẹn
```

**AC-1: Multi-Store Per Owner**

```gherkin
GIVEN PW1 owner có 5 stores (gói Standard)
WHEN  ETL chạy
THEN  PW2 tạo 5 Tenants với users.tenants[] đầy đủ
  AND mỗi Tenant.customDomains migrate đúng + giữ isPrimary
  AND Sites.theme + shippingConfig + paymentConfig + storeMeta đầy đủ
  AND Tenants.plan + limits set theo PW1
```

**AC-2: Verify Domain**

```gherkin
GIVEN PW1 store có custom domain shop.example.com
WHEN  ETL migrate
THEN  Tenants.customDomains[].domain
  AND status='pending' (cần re-verify Vercel)
  AND DNS health check job auto schedule
```

**DoD:** tenants-sites.ts shipped · Test transition workflow domain

---

### US-MIGA-03: Migrate Products + Categories + Variants

**Wave 7** | **P0** | **L** | **Dev**

```text
As a   Dev
I want ETL products + categories + variants → PW2
  AND link Products.brand FK (phụ thuộc B2)
So that Owner thấy đầy đủ catalogue
```

**AC-1: Trình Tự Brands → Categories → Products**

```gherkin
GIVEN US-BRN-04 (Brands ETL) xong
WHEN  categories.ts → products.ts
THEN  Categories build tree từ parent_id
  AND Products link Categories._id qua legacyCategoryId
  AND Products.brand FK qua legacyBrandId
  AND Products.variants giữ SKU/stock/price
```

**AC-2: Migration Media**

```gherkin
GIVEN PW1 products có images ở PW1 CDN/WordPress
WHEN  ETL chạy
THEN  download → upload R2/Media (parallel hoặc post-cutover)
  AND Products.images = Media._id refs
  AND PW2 URL rewriter pass-through PW1 CDN nếu re-upload chưa xong
```

**DoD:** Trình tự 3 bước hoạt động · Verify tổng stock variants · Reconciliation count

---

### US-MIGA-04: Migrate Orders Historical

**Wave 7** | **P0** | **L** | **Dev**

```text
As a   Dev
I want ETL orders với customer FK (phụ thuộc B3 Customers ETL)
So that lịch sử doanh thu + customer purchase history continuity
```

**AC-1: Order Sequence + Customer FK**

```gherkin
GIVEN US-CUS-04 (Customers) + Products ETL xong
WHEN  scripts/migration/orders.ts chạy
THEN  Orders.customer = FK Customers._id (không nested)
  AND Orders.items[] reference Products._id qua legacyProductId
  AND Orders.customerSnapshot immutable historical
  AND Orders.shippingFee + SST + total giữ chính xác
```

**AC-2: Mapping Status**

```gherkin
GIVEN PW1 statuses: Pending/Shipping/Returned/Cancelled
THEN  PW2 Orders.status:
  - Pending → pending
  - Shipping → shipped
  - Returned → returned
  - Cancelled → cancelled
  AND giữ tracking number nếu có (Wave 6 self-delivery free text)
```

**DoD:** Reconciliation total per tenant · Manual review sample 10 orders · Backward compat

---

### US-MIGA-05: Migrate Subscriptions

**Wave 7** | **P0** | **L** | **Dev + Finance**

```text
As a   Dev coordinate với Finance
I want migrate plan + Stripe customer ID + history từ PW1 + Stripe API
So that user không bị sai plan (silent billing failure)
```

**AC-1: Reconciliation 3 Nguồn**

```gherkin
GIVEN plan source ở 3 nơi: PW1 DB, Stripe API, TM SSO (Q-05 mở)
WHEN  ETL chạy
THEN  fetch plan từ TM SSO (source-of-truth) qua API
  AND verify với PW1 DB → log mismatch
  AND verify với Stripe → log mismatch
  AND PW2 Tenants.plan = TM SSO (final authority)
  AND subscriptionHistory[] populate từ Stripe events
```

**AC-2: Link Stripe Customer**

```gherkin
GIVEN PW1 tenant có Stripe customer ID
THEN  Tenants.stripeCustomerId migrate (field đã có)
  AND verify Stripe customer alive (not deleted) qua API
  AND missing → flag + alert Finance
```

**DoD:** Report reconciliation 3-source trước cutover · Finance sign-off plan mapping · Q-05 resolved

---

### US-MIGA-06: Migrate Store Configuration

**Wave 7** | **P0** | **M** | **Dev**

```text
As a   Dev
I want migrate Sites sub-fields: shippingConfig, paymentConfig, storeMeta
So that storefront hoạt động đúng config sau cutover
```

```gherkin
GIVEN US-MIGA-02 (Tenants/Sites base) xong
WHEN  scripts/migration/store-config.ts
THEN  Sites.shippingConfig = {westRate, eastRate, freeAbove, enabled} từ PW1
  AND Stripe webhook URL cập nhật sang PW2 (DevOps coordinate)
  AND giữ storeMeta SEO
  AND email send-from default fallback nếu empty
```

**DoD:** Có thể merge với US-MIGA-02 nếu sub-fields cùng pass

---

### US-MIGA-07: Migrate Blog (Articles)

**Wave 7** | **P1** | **M** | **Dev**

> **Lưu ý:** PW1 gọi "Articles" — cùng entity với PW2 Blogs

```text
As a   Dev
I want ETL PW1 articles + categories → PW2 Blogs + BlogCategories
So that content marketing assets không phải redo
```

```gherkin
GIVEN pw1.articles.{id, title, slug, content_html, status, category_id, author_id, published_at, owner_id}
WHEN  scripts/migration/blog.ts chạy
THEN  Categories migrate trước → articles sau
  AND content_html sanitize XSS
  AND slug unique per tenant (auto-append -2, -3)
  AND author_id → Users._id qua identity mapper hoặc tenantId owner
```

**DoD:** URL images auto-rewrite sang PW2 Media · Reconciliation

---

### US-MIGA-08: Migrate Payment + Rewire Stripe Webhook

**Wave 7** | **P1** | **M** | **Dev + DevOps**

```text
As a   Dev + DevOps coordinate Stripe migration
I want migrate payment configs + rewire Stripe webhook PW1 → PW2
So that payment tiếp tục hoạt động post-cutover (không drop transactions)
```

```gherkin
GIVEN PW1 Stripe webhook → pw1.com/api/stripe/webhook
WHEN  Phase D cutover writes
THEN  DevOps update Stripe Dashboard webhook URL → pw2.com/api/v2/stripe/webhook
  AND Sites.paymentConfig (COD/QR Banking) migrate qua ETL
  AND giữ Tenants.stripeOnboardingComplete
  AND test transaction trên staging confirm webhook đến PW2
```

**DoD:** Document Stripe URL change trong runbook · Giữ idempotency keys (tránh double-charge) · Finance sign-off

---

### US-MIGA-09: Migrate Media Files

**Wave 7** | **P1** | **XL** | **Dev**

```text
As a   Dev
I want migrate media từ PW1 CDN + WordPress library → PW2 Media (R2)
So that product images, banners, blog images không broken
```

**AC-1: Chiến Lược 2-Tier**

```gherkin
GIVEN PW1 media URLs phân tán giữa PW1 CDN + WordPress
WHEN  scripts/migration/media.ts chạy
THEN  download → upload R2/Media với giữ legacyUrl
  AND download fail → giữ Media.fallbackUrl
  AND storefront URL rewriter: serve R2 nếu uploaded, fallback CDN nếu chưa
  AND background job retry failed daily
```

**AC-2: WordPress Parser**

```gherkin
GIVEN một số tenants WordPress storefront /wp-content/uploads
WHEN  ETL chạy
THEN  WP parser (T-Dev-14) extract media URLs từ HTML/posts
  AND categorize: product_images / banners / blog_images
  AND link tới Products/Sites/Blogs records
```

**DoD:** R2 storage cost estimated · Failed upload rate <1% · URL rewriter tested

---

### US-MIGA-10: Migrate Pages (WordPress) — DEFER

**Wave 7+** | **P2 / Optional** | **XL** | **Dev + PM**

> **Rủi ro R-11:** WordPress heterogeneous schema; cutover KHÔNG block
> **Q-07 mở:** Cần quyết định T-30d

```text
As a   Dev với constraint: PW1 storefronts WordPress
I want quyết định strategy: defer, manual import, hay skip
So that không waste effort generic parser cho 100+ heterogeneous schemas
```

```gherkin
GIVEN master Q-07 chưa resolved
WHEN  T-30d gate
THEN  PM + Dev Lead chọn:
  - Option A: Defer Wave 7 (build parser sau khi P0 ổn định)
  - Option B: Manual import tool — Owner upload WordPress zip, dev hỗ trợ per-case
  - Option C: Skip — Owner rebuild storefront pages từ đầu
  AND document decision + comm affected owners
```

**DoD:** Q-07 resolved · User communication nếu chọn Option C · Estimate effort mỗi option

---

### US-MIGA-11: Map SEO Redirect PW1 URLs → PW2 (Gap G-1)

**Wave 7** | **P0** | **M** | **Dev + Marketing**
**Maps to:** master §7 A11 · Risk R-18

```text
As a   Marketing + Dev coordinate post-cutover SEO continuity
I want build redirect map từ PW1 URLs → PW2 URLs
So that bookmarked links + Google indexed pages không 404, giữ SEO ranking
```

**AC-1: Thu Thập URLs Từ Google Search Console**

```gherkin
GIVEN PW1 có traffic organic từ search engine
WHEN  trước cutover T-14d
THEN  Marketing export GSC top 1000 URLs (90 ngày traffic > 0)
  AND Dev parse → tạo redirect rules trong PW2 (Vercel rewrite hoặc Next.js middleware)
  AND mapping: pw1.com/products/{slug} → pw2.com/sites/{tenant}/products/{slug}
  AND mapping: pw1.com/articles/{slug} → pw2.com/sites/{tenant}/blog/{slug}
```

**AC-2: 301 Permanent Redirect + Monitor 404**

```gherkin
GIVEN redirect rules deployed
WHEN  buyer truy cập PW1 URL cũ
THEN  HTTP 301 permanent redirect → PW2 equivalent
  AND tracking analytics 301 count để verify hot URLs migrate đúng
  AND monitor Sentry 404 rate cho 7 ngày post-cutover
  AND nếu 404 spike > 5% → alert + add thêm redirect rules manual
```

**DoD:** Q-15 resolved (scope) · GSC export reviewed · Redirect rules tested staging · 404 rate < 1% sau 7 ngày

---

### US-MIGA-12: Migrate Customer Addresses Book (Gap G-2)

**Wave 7** | **P0** | **M** | **Dev**
**Maps to:** master §7 A12 · Risk R-19

```text
As a   Dev
I want ETL multiple addresses per customer từ PW1
So that buyer không phải re-enter địa chỉ tại PW2 checkout (giảm cart abandonment)
```

**AC-1: Schema Customer Addresses**

```gherkin
GIVEN Customers collection (US-CUS-04) đã ship
WHEN  Dev thêm field Customers.addresses[]
THEN  schema có array:
  - line1, line2, city, state, postcode, country
  - label (text: "Home", "Office", ...)
  - isPrimary (boolean)
  - isDefaultShipping, isDefaultBilling (boolean)
  AND constraint: 1 isPrimary=true per customer
```

**AC-2: ETL Migration**

```gherkin
GIVEN pw1.customer_addresses.{id, customer_id, line1, line2, city, state, postcode, is_default, label}
WHEN  scripts/migration/customer-addresses.ts chạy sau US-CUS-04
THEN  mỗi PW1 address → Customers.addresses[] entry
  AND is_default → isPrimary preserve
  AND reconciliation: COUNT(pw1.customer_addresses) per customer = COUNT(PW2 addresses) per customer ±0
  AND Q-16: nếu PW1 không có default flag → đầu tiên migrate set isPrimary=true
```

**AC-3: Checkout UX**

```gherkin
GIVEN buyer login PW2 lần đầu sau migration
WHEN  vào checkout
THEN  dropdown saved addresses hiển thị (với primary pre-selected)
  AND click "+ Use new address" tạo entry mới
  AND buyer không phải nhập lại addresses cũ
```

**DoD:** Customers.addresses schema · ETL script · Q-16 resolved · Checkout dropdown verified

---

### US-MIGA-13: Migrate Discount Usage History (Gap G-3)

**Wave 7** | **P0** | **M** | **Dev + Finance**
**Maps to:** master §7 A13 · Risk R-20

```text
As a   Finance audit revenue + Marketing track campaign ROI
I want migrate link giữa Orders đã sử dụng Discounts (which order used which code)
So that audit revenue lịch sử chính xác + performance campaign measurable
```

**AC-1: Schema Link Orders ↔ Discounts**

```gherkin
GIVEN Orders collection + Discounts collection (US-DSC-01) đã ship
WHEN  Dev thêm field Orders.appliedDiscount
THEN  schema có:
  - appliedDiscount.discount: relationship Discounts._id
  - appliedDiscount.code: text (snapshot — preserve even if Discount deleted)
  - appliedDiscount.discountAmount: number (sen)
  - appliedDiscount.appliedAt: date
  AND Discounts.usage_count auto-computed từ count Orders với link
```

**AC-2: ETL Usage History**

```gherkin
GIVEN pw1.order_discounts.{order_id, discount_id, code_snapshot, amount_applied}
WHEN  scripts/migration/discount-usage.ts chạy sau US-MIGA-04 (Orders) + US-DSC-04 (Discounts)
THEN  mỗi PW1 order-discount link → Orders.appliedDiscount
  AND code_snapshot preserve nếu Discount deleted (audit safe)
  AND Q-17: scope = full history hay last 12 tháng?
  AND reconciliation: SUM(pw1.order_discounts.amount) = SUM(PW2 Orders.appliedDiscount.discountAmount) per tenant
```

**AC-3: Finance Audit View**

```gherkin
GIVEN Finance vào /dashboard/discounts/{id}/analytics
WHEN  page load
THEN  thấy stats: total redemptions, total discount RM, top customers, breakdown by month
  AND tied to Orders.appliedDiscount data
  AND export CSV cho accounting
```

**DoD:** Orders.appliedDiscount schema · ETL script · Q-17 retention scope resolved · Finance analytics view live

---

### US-MIGA-14: Migrate Inventory Movements Log (Gap G-4)

**Wave 7** | **P1** | **M** | **Dev**
**Maps to:** master §7 A14 · Risk R-21 · Open Q-18

```text
As a   Dev preserve stock audit trail
I want migrate inventory movements (stock changes history) từ PW1
So that Owner audit được lịch sử stock changes (manual adjust, sold, returned, restocked) không chỉ snapshot hiện tại
```

**AC-1: Schema InventoryMovements**

```gherkin
GIVEN Products có inventory field hiện tại (snapshot)
WHEN  Dev tạo InventoryMovements collection HOẶC Products.movements[] nested
THEN  schema có:
  - product: relationship Products
  - variant: text (SKU nếu có variant)
  - changeType: 'sold'|'returned'|'manual_adjust'|'restocked'|'damaged'
  - quantity: number (signed: -5 = sold 5, +10 = restocked 10)
  - balanceAfter: number (snapshot sau change)
  - reason: text
  - actor: relationship Users (Owner / Manager / system)
  - relatedOrderId: text (nullable)
  - createdAt: date
  AND db-setup migration entry
```

**AC-2: ETL Migration**

```gherkin
GIVEN PW1 có inventory log table (Q-18 confirm schema)
WHEN  scripts/migration/inventory-movements.ts chạy sau US-MIGA-03 (Products)
THEN  mỗi pw1.inventory_log row → PW2 InventoryMovements
  AND resolve product_id qua legacyProductId
  AND nếu PW1 không có log table → skip migration + start log fresh post-cutover
  AND reconciliation: tổng quantity changes per product khớp với current stock
```

**DoD:** Q-18 resolved · Schema shipped · ETL script với fallback no-log scenario

---

### US-MIGA-15: Migrate Order Returns/Refunds Detail (Gap G-5)

**Wave 7** | **P1** | **M** | **Dev + Finance**
**Maps to:** master §7 A15 · Risk R-22 · Open Q-19

```text
As a   Finance + Owner audit returns/refunds
I want migrate full returns/refunds workflow data (không chỉ status='returned')
So that biết được lý do return, số tiền refund, ai xử lý, thời gian
```

**AC-1: Schema OrderReturns**

```gherkin
GIVEN Orders.status='returned' migrate qua US-MIGA-04 (status field only)
WHEN  Dev tạo OrderReturns collection HOẶC Orders.returnDetail nested
THEN  schema có:
  - order: relationship Orders
  - returnReason: 'wrong_item'|'damaged'|'not_as_described'|'changed_mind'|'other'
  - returnComment: text
  - refundAmount: number (sen)
  - refundStatus: 'pending'|'processed'|'rejected'
  - processedBy: relationship Users
  - processedAt: date
  - refundMethod: 'cod'|'qr_banking'|'cash'
  AND db-setup migration entry
```

**AC-2: ETL Migration**

```gherkin
GIVEN PW1 có returns table (Q-19 confirm)
WHEN  scripts/migration/order-returns.ts chạy sau US-MIGA-04 (Orders)
THEN  mỗi pw1.order_returns → PW2 OrderReturns với FK Orders._id
  AND nếu PW1 chỉ có status field → skip detail migration + log gap
  AND reconciliation: SUM(refundAmount) per tenant khớp Finance ledger
```

**AC-3: Finance Audit View**

```gherkin
GIVEN Finance /dashboard/returns
WHEN  page load
THEN  table với filters: date range, reason, status, tenant
  AND export CSV cho accounting reconciliation
  AND link tới Order detail cho audit
```

**DoD:** Q-19 resolved · OrderReturns schema · Finance dashboard view · Reconciliation report

---

### US-MIGA-16: Migrate Owner API Tokens + Custom Webhooks (Gap G-12)

**Wave 7** | **P1** | **L** | **Dev + Owner**
**Maps to:** master §7 A16 · Risk R-25 · Open Q-20

```text
As a   Owner đã setup 3rd-party integrations (Zapier, n8n, custom apps) trên PW1
I want API tokens + webhook configs migrate sang PW2 với endpoints rewire
So that integrations tiếp tục hoạt động không phải re-setup
```

**AC-1: Schema ApiTokens + OwnerWebhooks**

```gherkin
GIVEN PW1 có API token mechanism cho Owner (Q-20 confirm)
WHEN  Dev tạo 2 collections mới
THEN  ApiTokens schema:
  - tenant: relationship Tenants
  - tokenHash: text (hashed; raw chỉ trả về 1 lần)
  - name: text (vd: "Zapier integration")
  - scopes: array enum ['read:orders','write:products',...]
  - lastUsedAt: date
  - expiresAt: date (nullable)
  AND OwnerWebhooks schema:
  - tenant: relationship Tenants
  - event: 'order.created'|'order.paid'|'product.updated'|...
  - url: text (target endpoint)
  - secret: text (HMAC signing)
  - enabled: boolean
```

**AC-2: ETL với Webhook URL Rewire**

```gherkin
GIVEN PW1 có API tokens + webhook configs per Owner
WHEN  scripts/migration/owner-integrations.ts
THEN  ApiTokens migrate với tokenHash preserve (tránh re-issue)
  AND OwnerWebhooks migrate
  AND PW1 webhook source URLs auto-update sang PW2 endpoint paths
  AND notification Owner "Verify integrations còn hoạt động — webhook secret giữ nguyên"
```

**AC-3: Compatibility Layer**

```gherkin
GIVEN 3rd-party app gọi PW2 API với token migrated từ PW1
WHEN  request đến /api/v2/orders với Authorization: Bearer {legacy_token}
THEN  PW2 validate token qua ApiTokens collection
  AND response format giữ compatible với PW1 nếu possible (versioned API)
  AND breaking changes → document trong migration FAQ Owner
```

**DoD:** Q-20 resolved · ApiTokens + OwnerWebhooks shipped · Webhook URL rewire automated · Owner comm

---

### US-MIGA-17: Migrate Team Members (Manager/Crew Accounts) (Gap NEW-1)

**Wave 7** | **P0** | **L** | **Dev + PM**
**Maps to:** master §7 A17 · Risk R-27 · Open Q-22

```text
As a   Owner có staff (Manager/Crew) đã làm việc trên PW1
I want staff của tôi giữ được access PW2 với đúng role ngày 1 sau cutover
So that operations không bị gián đoạn (staff vẫn process orders, edit products...)
```

**AC-1: ETL Team Members Migration**

```gherkin
GIVEN US-EXT-02 (Tenants.members schema) đã ship
  AND PW1 có Manager/Crew accounts (Q-22 confirm schema source)
WHEN  scripts/migration/team-members.ts chạy sau US-MIGA-01 + US-MIGA-02
THEN  với mỗi staff record từ PW1:
  - tạo User PW2 (nếu chưa có) qua identity mapper (email + customer_id)
  - thêm Tenants.members[] entry với {user: PW2 user._id, role: mapped, status: 'active'}
  AND PW1 role mapping:
  - 'manager' → 'manager'
  - 'crew' / 'staff' → 'crew'
  - role lạ → log + skip
```

**AC-2: Pre-Cutover Staff Communication**

```gherkin
GIVEN ETL team members đã chạy thành công
WHEN  T-3d trước cutover
THEN  PM gửi email tới mọi staff "Login bằng credentials hiện tại sau cutover {date} — sẽ vào PW2"
  AND staff không nhận thêm welcome email duplicate
  AND staff login sau cutover qua TM SSO → land PW2 với permission đúng theo role
```

**AC-3: Edge Case Email Mismatch**

```gherkin
GIVEN staff PW1 email không tồn tại trong TM SSO
WHEN  ETL chạy
THEN  log "Staff email not in SSO: {email}" + alert PM
  AND skip migrate user đó
  AND PM phải verify staff có TM SSO acc hay không trước cutover
```

**DoD:** Q-22 resolved · ETL script · Pre-cutover staff comm · Role-based access tested · Reconciliation pass

---

### US-MIGA-18: Backfill Subscription History từ Stripe Events (Gap NEW-2)

**Wave 7** | **P1** | **M** | **Dev + Finance**
**Maps to:** master §7 A18 · Risk R-28

```text
As a   Finance audit + Owner xem "Request history"
I want backfill Tenants.subscriptionHistory[] từ Stripe events lịch sử
So that không phải hiển thị history rỗng cho until-now
```

**AC-1: Backfill từ Stripe Customer Events API**

```gherkin
GIVEN US-EXT-04 (subscriptionHistory schema + hook future-only) đã ship
WHEN  scripts/migration/subscription-history.ts chạy sau US-MIGA-05
THEN  với mỗi tenant có stripeCustomerId:
  - fetch Stripe events API: customer.subscription.created/updated/deleted
  - cho mỗi event → tạo subscriptionHistory entry
  - changeType infer từ event type
  - source = 'migration_seed'
  - actor = 'system_backfill'
  AND Stripe event retention 90 ngày → older events log gap "history pre-{90d ago} not available"
```

**AC-2: Reconciliation với Stripe**

```gherkin
GIVEN backfill xong
WHEN  Finance verify tenant ABC
THEN  Tenants.subscriptionHistory.count = Stripe events count (90 ngày qua)
  AND latest entry match Stripe customer current subscription
  AND mismatch → alert + manual review
```

**DoD:** ETL script · Stripe API rate limit handled (100 req/s) · Finance verify 10 sample tenants

---

### US-MIGA-19: Migrate Templates Customizations (Gap NEW-3) — OPTIONAL

**Wave 7+** | **P2 / Optional** | **L** | **Dev + Design**
**Maps to:** master §7 A19 · Risk R-29

```text
As a   Owner đã customize template trong PW1 (đổi màu, layout, text)
I want customizations giữ lại sang PW2
So that storefront không revert về template default
```

**AC-1: Capture Customizations Pre-Cutover**

```gherkin
GIVEN PW1 owner customize template (color overrides, layout adjustments)
WHEN  pre-cutover snapshot tool chạy
THEN  capture customizations từ pw1.template_overrides table (nếu có)
  AND export JSON per tenant
  AND backup screenshot storefront live cho visual diff
```

**AC-2: Apply Customizations to PW2 Sites**

```gherkin
GIVEN PW2 Sites.theme + Templates đã có
WHEN  ETL apply customizations
THEN  map PW1 color codes → Sites.theme.colorPalette
  AND map PW1 layout overrides → Sites.layoutOverrides (nếu PW2 hỗ trợ)
  AND nếu PW2 không hỗ trợ → log "Cannot port customization {type}; manual re-do required"
  AND Owner receive comm "Verify storefront sau cutover; nếu khác → re-customize"
```

**DoD:** Visual diff staging vs PW1 production · Owner comm template · Acceptable degradation defined

---

### US-MIGA-20: Migrate Tax Invoice PDFs Archive (Gap NEW-4)

**Wave 7** | **P1** | **M** | **Dev + Finance + Compliance**
**Maps to:** master §7 A20 · Risk R-30 · Open Q-23

```text
As a   Finance + Compliance officer
I want tax invoice PDFs PW1 archive sang PW2 (MY compliance 7-year retention)
So that audit + tax filings có access đến historical invoices
```

**AC-1: Migrate Invoice URLs / Re-generate**

```gherkin
GIVEN PW1 có generated PDFs (Q-23 confirm storage location)
WHEN  scripts/migration/tax-invoices.ts chạy sau US-MIGA-04 (Orders)
THEN  3 strategies tùy storage:
  - Option A (PW1 S3): copy files sang PW2 R2; Orders.taxInvoiceUrl point đến new R2 URL
  - Option B (PW1 local): re-upload sang R2
  - Option C (no archive): re-generate từ Orders data using existing PDF generator (preserve SST breakdown)
  AND filename: `invoice-{orderNumber}-{tenantId}.pdf`
```

**AC-2: 7-Year Retention Compliance**

```gherkin
GIVEN MY tax law require 7-year retention
WHEN  Compliance verify
THEN  PW2 R2 lifecycle policy: do not delete invoices < 7 năm tuổi
  AND audit log access (who accessed which invoice when)
  AND export functionality cho LHDN audit request
```

**AC-3: Access Control**

```gherkin
GIVEN Owner + accountant access /dashboard/finance/invoices
WHEN  view list
THEN  table filter date range + tenantId
  AND click row → download PDF (signed R2 URL, expires 5 phút)
  AND staff không có quyền finance không thấy menu
```

**DoD:** Q-23 resolved · 3 strategies tested · Compliance signoff retention policy · R2 lifecycle configured

---

## 5. Trình Tự & Quyết Định Đang Mở

### Trình Tự Migration Critical (Phase D Execution)

```
Phase A (Nhóm C — schema trước):
  US-EXT-01 (Tenants.limits) → US-EXT-04 (subscriptionHistory)

Phase B (Nhóm B — BUILD collections MỚI):
  US-DSC-01..03 + US-BRN-01..03 + US-CUS-01..03 + US-MNU-01..03 + US-EML-01..02
  US-EXT-02 (members) + US-EXT-03 (appIntegration) parallel

Phase C (Nhóm D — feature infra):
  US-MIG-04 (D1 plan enforcement) + US-MIG-05 (D2 multi-store)
  US-MIG-06 (D3 product switcher) + US-MIG-07 (D4 sub webhook)

Phase D (Data migration ETLs — Nhóm A + B migrations):
  1. US-MIGA-01 Users (ROOT — identity mapper)
       ↓
  2. US-MIGA-02 Tenants + Sites
       ↓
  3. US-BRN-04 Brands (Nhóm B prereq)
       ↓
  4. US-MIGA-03 Products + Categories (dùng Brands FK)
       ↓
  5. US-CUS-04 Customers (Nhóm B prereq)
       ↓
  6. US-MIGA-04 Orders (dùng Customer FK + Products)
       ↓
  7. US-MIGA-05 Subscriptions (có thể parallel)
       ↓
  8. US-MIGA-06 Store Config (có thể merge với 02)
       ↓
  9. US-MIGA-07 Blog (độc lập)
       ↓
  10. US-MIGA-08 Payment + Stripe webhook (thời điểm Phase D)
       ↓
  11. US-MIGA-09 Media (có thể parallel)
       ↓
  12. US-DSC-04 Discounts + US-MNU-04 Menus + US-EML-03 EmailTemplates
       ↓
  13. US-MIGA-10 Pages (DEFER Wave 7+)

Phase F (T+0 Cutover — verify):
  US-MIG-01 (Persona C) + US-MIG-02 (Persona B) + US-MIG-03 (Persona A) login
```

### Quyết Định Đang Mở (priority queue cho PM)

| ID | Câu hỏi | Block | Cần resolve trước |
|----|---------|-------|-------------------|
| Q-01 | Cơ chế redirect TM SSO (TM-side vs PW1 301)? | US-MIG-01/02/03 | T-30d |
| Q-05 | Source-of-truth Subscriptions (PW1 DB vs Stripe vs TM SSO)? | US-MIGA-05 | T-30d |
| Q-07 | Pages strategy (defer/manual/skip)? | US-MIGA-10 | T-30d |
| Q-10 | Matrix giới hạn plan (Free=1, Starter=1-3, Standard=5-10, Pro=3-5?) — sitemap có conflict | US-EXT-01, US-MIG-04 | T-30d |
| Q-11 | Editor email template (WYSIWYG vs variable-only)? | US-EML-01 | T-21d |
| Q-12 | Menu collection riêng vs extend Sites.headerBlock? | US-MNU-01 | T-30d |
| Q-13 | MFA backup thêm hay defer? | US-MIG-10 (backlog) | T-21d |
| Q-15 | Plan allowedProducts[] array vs single value? | US-EXT-01 | T-30d |

---

## 6. DoD Chung (áp dụng tất cả USs)

- [ ] 9-Point Checklist pass (ref `SPEC.md §13`)
- [ ] BMAD Gate 5/5 trước khi Dev pickup
- [ ] TypeScript clean `tsc --noEmit`
- [ ] Mobile responsive 375px (UI USs)
- [ ] Bilingual EN/MS verified (UI USs)
- [ ] Có entry trong db-setup.js MIGRATIONS (schema USs theo `.claude/rules/database-schema.md`)
- [ ] CI `check-migrations.js` pass
- [ ] Idempotent (ETL USs — re-runnable an toàn)
- [ ] Document reconciliation queries trong sub-PRD §13.6 (ETL USs)
- [ ] Integration Lark `#migration-alerts` (ETL USs)
- [ ] Identity mapper composite (US-MIGA-01) là prereq cho mọi ETL USs

---

## 7. Tổng Hợp Số Lượng

| Nhóm | USs Chính | Wave | Mix Priority |
|------|-----------|------|--------------|
| Master orchestration | 7 (+ 4 backlog) | 6-7 | P0 × 7 |
| Nhóm C extensions | 7 | 6-7 | P0 × 1, P1 × 5, P2 × 1 |
| Nhóm B Discounts | 4 | 6-7 | P0 × 2, P1 × 1, P2 × 1 |
| Nhóm B Brands | 4 | 6-7 | P0 × 3, P1 × 1 |
| Nhóm B Customers | 4 | 6-7 | P0 × 2, P1 × 2 |
| Nhóm B Menus | 4 | 6-7 | P1 × 3, P2 × 1 |
| Nhóm B Email Templates | 3 | 6-7 | P1 × 3 |
| Nhóm A migration | **20** | 7 | P0 × 10, P1 × 8, P2 × 2 |
| **Tổng** | **53 chính + 4 backlog** | — | P0 × 25, P1 × 24, P2 × 4 |
| **+3 Critical Gap (G-1/2/3)** | US-MIGA-11/12/13 | 7 | P0 × 3 |
| **+6 Medium Gap (G-4/5/6/7/8/12)** | US-MIGA-14/15/16 + US-EXT-05/06/07 | 7 | P1 × 5, P2 × 1 |
| **+4 Extra Gap (NEW-1/2/3/4)** | US-MIGA-17/18/19/20 | 7 | P0 × 1, P1 × 2, P2 × 1 |

**Hết file tổng hợp**
