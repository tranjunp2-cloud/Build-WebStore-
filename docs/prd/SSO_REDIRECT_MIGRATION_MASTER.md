# MASTER PRD: SSO → PW2 Production Migration (Full Feature Parity)

> **Version:** 2.0 (Rewritten 2026-05-18 từ sitemaps) | **Agent:** `project-planner`
> **Priority:** P0 | **Type:** Master orchestration doc | **Size:** XL
> **Sub-template:** [`MIGRATION_PRD_TEMPLATE.md`](./MIGRATION_PRD_TEMPLATE.md)
> **Source-of-truth:** `docs/qa/Sitemap - WebStore.mm` + `docs/qa/Sitemaps - SSO.mm` (audit 2026-05-18)
> **Audience:** Dev / DevOps / QA / PM / TM SSO team / End-users (Owners)

---

> [!IMPORTANT]
> **Đây là master orchestration doc, KHÔNG phải feature PRD.**
> Mục đích: liệt kê **đầy đủ** mọi thứ cần làm để khi deploy PW2 lên production, user PW1 vẫn truy cập thành công với full data.
> Chi tiết per-feature (schema mapping, ETL, AC, parity matrix) → ở sub-PRDs dùng `MIGRATION_PRD_TEMPLATE.md`.

> [!IMPORTANT]
> **Multi-product hub context:** SSO không chỉ phục vụ PW — nó là hub cho **4 products**: DIS / **PW** / CRM / POS. User 1 SSO acc → access nhiều products tùy plan tier. PW2 must implement product switcher aware logic. Doc này chỉ scope **PW** side.

---

## 1. Vision & Goal

**One-line:** Sau khi deploy PW2 production, mọi user (mới + cũ) login SSO → land PW2 với full data PW1 + plan tier limits enforced + multi-product switcher hoạt động.

**Success state (T+0 = cutover ngày):**
- TM SSO redirect destination = PW2 URL (current: PW1)
- Mọi user login thành công vào PW2 trong < 3s
- Data PW1 (orders, products, customers, discounts, brands, articles, menus, email templates...) accessible đầy đủ ở PW2 ngay first login
- Plan tier limits (store count, order count, channels) được enforce trong PW2
- Product switcher (DIS/PW/CRM/POS) hoạt động via JWT claims
- Zero data loss, zero double-charge, rollback < 5 phút

---

## 2. User Personas (3 loại)

### Persona A — New User
- Chưa tồn tại ở PW1 lẫn PW2
- Đăng ký mới trên TM SSO Portal → TM provisions account → call `POST /api/v1/sso/provision` ở PW2
- Plan: Free (default), limit 1 store / 100 orders/month
- Land /dashboard onboarding

### Persona B — Pre-provisioned User (SSO acc tạo qua webhook, chưa login PW2)
- TM SSO đã call provision webhook → PW2 đã tạo User + Tenant
- Plan field set theo TM tier (Free / Starter / Standard / Professional)
- Không có data PW1 (acc tạo recent)
- Land /dashboard với empty state + seed templates

### Persona C — Active PW1 User (có data thực ở PW1)
- Acc + data thực ở PW1: products, orders, customers, discounts, brands, articles, menus, custom email templates...
- Plan tier xác định limit (store count, etc.)
- Đã được bulk pre-migrated sang PW2 trước cutover (T-7d → T+0)
- Multi-store: nếu plan Starter+, user có thể có 2-10 tenants trong PW2
- Khi flip SSO redirect (T+0) → land /dashboard với đầy đủ data

### Persona-routing logic (post-SSO landing)

```
TM SSO → JWT issued (carries: email, customer_id_number, plan, products[])
  ↓
Redirect /post-sso-landing (PW2)
  ↓
PW2 verify JWT (SSO_SHARED_SECRET) → extract identity + plan
  ↓
Lookup user by COMPOSITE key (email AND customer_id_number)
  ↓
  ├── Found + migrationStatus='migrated' → /dashboard (Persona B or C)
  ├── Found + migrationStatus='pending'  → /migration-in-progress (rare edge case)
  ├── Found + migrationStatus='failed'   → /migration-error (escalate support)
  └── Not found                          → fallback /api/v1/sso/provision (Persona A)

Plan tier enforcement: PW2 stores Tenants.limits, reads from JWT plan field, re-validates on each request
```

---

## 3. Multi-Product Hub Awareness

> Theo SSO sitemap, user truy cập 4 products qua: burger menu / internal icon link / "Start now" buttons / Setting steps.

### PW2 implementation requirements
- **Product switcher UI** (burger menu) — list 4 products với active product = PW highlighted
- **Internal product icons** — chuyển sang DIS/CRM/POS qua URL bên ngoài (TM SSO orchestrates)
- **JWT claims `products[]`** — chỉ show icons cho products user được access (theo plan tier)
- **Plan-tier gating:** 
  - Free → 4 products accessible but limited (1 store, 100 orders)
  - Starter → CRM **hoặc** PW (chọn 1)
  - Standard → DIS + CRM + PW (3 products)
  - Professional → All 4 products

### Bookkeeping
- PW2 KHÔNG implement DIS/CRM/POS — chỉ link out
- PW2 KHÔNG manage billing — TM SSO portal handles upgrade/downgrade
- PW2 receives plan-change notification via webhook (T-Dev-13)

---

## 4. Scope

### 4.1 In Scope (this initiative)
- TM SSO redirect destination flip → PW2 URL
- `/post-sso-landing` route — JWT verify + persona routing + plan extraction
- 4 groups of sub-PRDs (§7): data migration (A) + new collections (B) + schema extensions (C) + new feature infra (D)
- Plan tier limit enforcement in PW2
- Multi-store per Owner (1 user owns N tenants tùy plan)
- Product switcher UI (PW2 side)
- Subscription auto-update webhook receiver
- 30-day dual-write reverse safety window post-cutover
- User communication plan

### 4.2 Out of Scope (deferred / explicit NOT)
- JIT per-user migration (chọn bulk approach)
- Federated reads PW1↔PW2 (no live federation)
- TM SSO portal UI changes (TM team owns)
- DIS / CRM / POS implementation (PW2 chỉ link out)
- PW1 codebase changes ngoài endpoint deprecation
- Billing logic (TM SSO portal handles)
- Multi-region migration (Wave 7+)
- Inactive user (no login > 90d) cleanup — separate compliance ticket
- Customer reviews/ratings (PW1 không có, defer Wave 7)

---

## 5. Architecture Overview

```
                          ┌──────────────────────┐
                          │ TM SSO Portal        │  (3rd-party — TM team)
                          │ Multi-product hub:   │
                          │ DIS / PW / CRM / POS │
                          └──────────┬───────────┘
                                     │ JWT signed w/ SSO_SHARED_SECRET
                                     │ Claims: email, customer_id, plan, products[]
                                     ▼
                          ┌──────────────────────┐
                          │ PW2 /post-sso-landing│  Next.js 15 + Payload
                          │ - JWT verify         │
                          │ - persona routing    │
                          │ - plan extraction    │
                          └──────────┬───────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
    Persona A (new)          Persona B (pre-prov)     Persona C (active PW1)
    /provision               /dashboard empty         /dashboard w/ full data
                                                              ▲
                                                              │
                                                ┌─────────────┴───────────┐
                                                │ Bulk ETL (T-7d → T-0)   │
                                                │ scripts/migration/      │
                                                │ ├─ users.ts             │
                                                │ ├─ tenants-sites.ts     │
                                                │ ├─ products.ts          │
                                                │ ├─ orders.ts            │
                                                │ ├─ customers.ts (NEW)   │
                                                │ ├─ discounts.ts (NEW)   │
                                                │ ├─ brands.ts (NEW)      │
                                                │ ├─ menus.ts (NEW)       │
                                                │ ├─ email-templates (NEW)│
                                                │ ├─ blog.ts              │
                                                │ ├─ media.ts             │
                                                │ └─ subscriptions.ts     │
                                                └─────────────────────────┘
                                                              ▲
                                                ┌─────────────┴───────────┐
                                                │ PW1 Postgres / MySQL    │
                                                │ + WordPress media       │
                                                └─────────────────────────┘
```

---

## 6. Components Inventory

| # | Component | Type | Status | Owner |
|---|-----------|------|--------|-------|
| C-01 | TM SSO redirect URL config | External | ⬜ Pending TM | TM team |
| C-02 | JWT cross-service verify (`src/lib/auth.ts:50-68`) | Code | ✅ Exists | Dev |
| C-03 | `POST /api/v1/sso/provision` webhook | Code | ✅ Exists | Dev |
| C-04 | `/post-sso-landing` route — persona routing | Code | ⬜ New | Dev |
| C-05 | `migrationStatus` field on Users + Tenants | Schema | ⬜ New | Dev + DBA |
| C-06 | Plan tier `limits` object on Tenants | Schema | ⬜ New | Dev + DBA |
| C-07 | Bulk ETL framework (`scripts/migration/lib/`) | Code | ⬜ New | Dev |
| C-08 | 13 per-feature ETL scripts | Code | ⬜ New (per sub-PRD) | Dev |
| C-09 | 5 NEW collections (Discount, Brand, Customer, Menu, EmailTemplate) | Schema | ⬜ New | Dev + DBA |
| C-10 | Reconciliation cron + Lark alerts | Infra | ⬜ New | DevOps |
| C-11 | Login welcome UI (3 personas + 3 states) | Code + Design | ⬜ New | Dev + Design |
| C-12 | Product switcher UI (burger menu) | Code + Design | ⬜ New | Dev + Design |
| C-13 | Subscription update webhook (`POST /api/v1/sso/subscription-update`) | Code | ⬜ New | Dev |
| C-14 | Plan limit enforcement middleware | Code | ⬜ New | Dev |
| C-15 | User comms (email + in-app banner) | Content | ⬜ New | PM |
| C-16 | Rollback runbook | Doc | ⬜ New | DevOps |
| C-17 | Migration monitoring dashboards | Infra | ⬜ New | DevOps |

---

## 7. Sub-PRD Catalogue (~25 entries — 4 groups)

> Mỗi entry → 1 sub-PRD dùng `MIGRATION_PRD_TEMPLATE.md`.
> Sort by dependency order trong group; Group B (new collections) phải xong trước Group A (data migration vào collections đó).

### Group A — Data migration vào collections PW2 ĐÃ có (10 sub-PRDs)

| # | Feature | Priority | Sub-PRD Path | Depends on | Notes |
|---|---------|----------|--------------|------------|-------|
| A1 | F02 Users + Auth identity | **P0** | `docs/prd/F02-migration-users.md` | — root | Composite key (email + customer_id) |
| A2 | F18 Tenants + Sites (incl. theme, customDomains, payments) | **P0** | `docs/prd/F18-migration-sites.md` | A1 | Multi-domain ✅ exists; multi-store via N tenants |
| A3 | F08 Products + Categories (incl. variants ✅) | **P0** | `docs/prd/F08-migration-products.md` | A1, A2, B2 (Brand) | Brand FK depends on B2 collection ready |
| A4 | F10 Orders historical | **P0** | `docs/prd/F10-migration-orders.md` | A1, A2, A3, B3 (Customer) | Customer FK depends on B3 |
| A5 | Subscriptions (billing/plan history) | **P0** | `docs/prd/F-migration-subscriptions.md` | A1 | Stripe customer ID mapping if applicable |
| A6 | F19 Store Configuration (sub-fields trong Sites) | **P0** | `docs/prd/F19-migration-store-config.md` | A2 | May merge into A2 |
| A7 | F17 Blog/Articles + BlogCategories | **P1** | `docs/prd/F17-migration-blog.md` | A1, A2 | PW1 calls these "Articles" |
| A8 | F13 Payment Gateway configs + transactions | **P1** | `docs/prd/F13-migration-payments.md` | A1, A4, A5 | Stripe webhook URL rewire |
| A9 | Media files (Owner uploads + WordPress media library) | **P1** | `docs/prd/F-media-migration.md` | A3, A7 | URL rewriter at PW2 storefront; Unsplash drop |
| A10 | Pages (storefront landing/about/policy from WordPress) | **P2 / Optional** | `docs/prd/F-migration-pages.md` | A2 | WordPress heterogeneous; cutover NOT blocked |
| **A11** | **SEO URL Redirect Map (PW1 URLs → PW2)** | **P0** | `docs/prd/F-migration-seo-redirects.md` | A2 | 🆕 Gap G-1: Bookmarked PW1 URLs + Google indexed → 404; SEO ranking drop. Build redirect rules từ Google Search Console export |
| **A12** | **Customer Addresses Book (multiple per customer)** | **P0** | `docs/prd/F-migration-customer-addresses.md` | A1, B3 (Customers) | 🆕 Gap G-2: Buyer mất địa chỉ đã save → cart abandonment tại checkout |
| **A13** | **Discount Usage History (Order ↔ DiscountCode link)** | **P0** | `docs/prd/F-migration-discount-usage.md` | A4 (Orders), B1 (Discounts) | 🆕 Gap G-3: Audit revenue lịch sử + campaign performance tracking broken nếu thiếu |
| **A14** | **Inventory Movements Log (stock audit trail)** | **P1** | `docs/prd/F-migration-inventory-log.md` | A3 (Products) | 🆕 Gap G-4: Lịch sử stock changes (manual adjust, sold, returned). Need new `InventoryMovements` collection hoặc nested array. Verify with PW1: Q-18 |
| **A15** | **Order Returns/Refunds Detail** | **P1** | `docs/prd/F-migration-returns-refunds.md` | A4 (Orders) | 🆕 Gap G-5: Status='returned' đã migrate nhưng refund amount, reason, processed_by chưa. Cần new `OrderReturns` collection hoặc Orders.returnDetail nested. Verify Q-19 |
| **A16** | **Owner API Tokens + Custom Webhooks** | **P1** | `docs/prd/F-migration-owner-integrations.md` | A2 (Tenants) | 🆕 Gap G-12: Nếu PW1 cho phép Owner tạo API tokens hoặc define webhooks → cần new `ApiTokens` + `OwnerWebhooks` collections, rewire webhook URLs trong tokens. Verify Q-20 |
| **A17** | **Team Members Data Migration (Manager/Crew accounts)** | **P0** | `docs/prd/F-migration-team-members.md` | A1, C2 (Tenants.members schema) | 🆕 Gap NEW-1: US-EXT-02 chỉ define schema. Cần ETL migrate Manager/Crew accounts từ PW1 → Tenants.members[]. Nếu thiếu → staff lost access day 1. Verify Q-22 |
| **A18** | **Subscription History Backfill từ Stripe Events** | **P1** | `docs/prd/F-migration-subscription-history.md` | A5, C5 (Tenants.subscriptionHistory) | 🆕 Gap NEW-2: C5 schema + hook future. KHÔNG explicit backfill past Stripe events. Owner xem "Request history" empty cho until-now |
| **A19** | **Templates Customizations** | **P2 / Optional** | `docs/prd/F-migration-template-customs.md` | A2 (Sites) | 🆕 Gap NEW-3: Owner có thể customize templates ở PW1 (color, layout text overrides). Templates không nằm trong scope migration default. Có thể skip nếu Owner sẵn sàng re-customize |
| **A20** | **Tax Invoice PDFs Archive** | **P1** | `docs/prd/F-migration-tax-invoices.md` | A4 (Orders) | 🆕 Gap NEW-4: Orders có SST nhưng PDF invoices đã generate ở PW1? Compliance MY require archive 7 năm. Migrate URLs từ PW1 storage hoặc re-generate. Verify Q-23 |

### Group B — NEW Payload collections cần BUILD trước migrate (5 sub-PRDs)

| # | New Collection | Priority | Sub-PRD Path | Sitemap ref | Notes |
|---|----------------|----------|--------------|------------|-------|
| B1 | `Discounts` (codes, types, status, limit, date range) | **P0** | `docs/prd/F-discounts-prd.md` + `F-migration-discounts.md` | WebStore > Discount | Build collection schema + UI + ETL |
| B2 | `Brands` (product brands, CRUD, sort) | **P0** | `docs/prd/F-brands-prd.md` + `F-migration-brands.md` | WebStore > Product > Brand | Adds `brand` FK to Products |
| B3 | `Customers` (separate entity, Rank field, sort) | **P0** | `docs/prd/F-customers-prd.md` + `F-migration-customers.md` | WebStore > Customers | Currently nested in Orders → promote to separate collection |
| B4 | `Menus` (Header/Footer, tabs/subtabs, icon visibility) | **P1** | `docs/prd/F-menus-prd.md` + `F-migration-menus.md` | WebStore > My web store > Menu | Verify Sites.header block đủ chưa; có thể skip nếu existing block sufficient |
| B5 | `EmailTemplates` (Order conf / Cancelled / Delivered — per-tenant editable) | **P1** | `docs/prd/F-email-templates-prd.md` + `F-migration-email-templates.md` | WebStore > Settings > Email templates | Currently AWS SES hardcoded; add per-tenant override |

### Group C — Schema extensions to existing PW2 collections (5 sub-PRDs)

| # | Extension | Priority | Sub-PRD Path | What to add |
|---|-----------|----------|--------------|-------------|
| C1 | `Tenants.limits` object | **P0** | `docs/prd/F-tenants-limits.md` | `{maxStores, maxOrdersPerMonth, unlimitedSocialChannels, unlimitedDeliveryProviders, advancedAnalytics}` per plan tier |
| C2 | `Tenants.members[]` (Manager/Crew roles) | **P1** | `docs/prd/F-tenants-team-members.md` | Array of `{user: relation, role: 'manager'\|'crew'}`. Sitemap: WebStore > Settings > Team Member |
| C3 | `Sites.appIntegration` (FB Pixel ID + GA tracking ID) | **P1** | `docs/prd/F22-app-integration.md` | `{fbPixelId, gaTrackingId}`. Sitemap: WebStore > Settings > App Integration |
| C4 | `Products.brand` FK to Brands collection | **P0** | (rolled into B2) | Field added when B2 ships |
| C5 | `Tenants.subscriptionHistory[]` | **P1** | (rolled into A5) | Plan modification history for audit |
| **C6** | **`Tenants.customDomains[].dnsVerification` extension** | **P1** | `docs/prd/F-domain-dns-verification.md` | 🆕 Gap G-6: Existing customDomains có isPrimary nhưng cần thêm `dnsStatus, lastVerifiedAt, vercelDomainId`. Re-verify DNS sau migration. T-Ops task: auto re-verify cron |
| **C7** | **`Sites.emailConfig.senderDomain` extension** | **P1** | `docs/prd/F-ses-sender-domain.md` | 🆕 Gap G-7: SES per-tenant verified sending domain. Currently AWS SES sender mặc định; nếu PW1 tenant có verified domain → cần migrate config + re-verify TXT records. T-Ops coordinate |
| **C8** | **`Sites.customCode` (header/footer custom JS/CSS injection)** | **P2** | `docs/prd/F-custom-code-injection.md` | 🆕 Gap G-8: Owner có thể inject FB Pixel manual, A/B test scripts, custom CSS. Add fields: `customHeaderHtml, customFooterHtml` với XSS sanitization. Verify Q-21 |

### Group D — NEW feature/infra (KHÔNG phải data migration) (5 sub-PRDs)

| # | Feature | Priority | Sub-PRD Path | Notes |
|---|---------|----------|--------------|-------|
| D1 | Plan tier limit enforcement middleware | **P0** | `docs/prd/F-plan-enforcement.md` | Read Tenants.limits, block over-limit actions (e.g. create N+1 store) |
| D2 | Multi-store per Owner UI | **P0** | `docs/prd/F-multi-store-ui.md` | Owner has N tenants → store switcher in dashboard |
| D3 | Product switcher UI (DIS/PW/CRM/POS burger menu + internal icons) | **P0** | `docs/prd/F-product-switcher.md` | Read JWT `products[]` claim, link out to other apps |
| D4 | Subscription auto-update webhook receiver | **P0** | `docs/prd/F-subscription-webhook.md` | `POST /api/v1/sso/subscription-update` — TM SSO calls when plan changes |
| D5 | MFA backup email mechanism | **P2** | `docs/prd/F-mfa-backup.md` | Sitemap: SSO > Setting > MFA Mail backup. May defer if OTP via email sufficient |

### Priority key
- **P0** — Block cutover (T+0 không thể happen nếu thiếu)
- **P1** — Important nhưng có thể migrate trong tuần đầu sau cutover
- **P2 / Optional** — Defer Wave 7

### Counts summary
- **P0 sub-PRDs:** 18 (block cutover) — +4 từ critical/extra gaps (G-1/G-2/G-3 + NEW-1)
- **P1 sub-PRDs:** 16 (week-1 post-cutover) — +7 từ medium gaps (G-4/G-5/G-6/G-7/G-12 + NEW-2 + NEW-4)
- **P2 / Optional:** 4 (defer Wave 7) — +2 từ gap audit (G-8 custom code + NEW-3 templates)
- **Total:** 38 sub-PRDs

---

## 8. Dev Team Tasks (Orchestration)

> Tasks chung — KHÔNG bao gồm per-feature implementation (ở sub-PRDs).

| ID | Task | Sub-PRD ref | Effort | Sprint |
|----|------|-------------|--------|--------|
| T-Dev-01 | Schema audit complete — match PW1 entities vs PW2 collections (already done 2026-05-18) | — | ✅ Done | — |
| T-Dev-02 | Migration framework `scripts/migration/lib/{etl-base.ts, validator.ts, reporter.ts, identity-mapper.ts}` | — | L | Wave 6 |
| T-Dev-03 | Add `migrationStatus` field on Users + Tenants | A1 | S | Wave 6 |
| T-Dev-04 | Identity mapper module — composite key lookup + collision handling | A1 | M | Wave 6 |
| T-Dev-05 | `/post-sso-landing` route + JWT plan extraction | C-04 | M | Wave 6 |
| T-Dev-06 | Login welcome UI (3 states) | C-11 | M | Wave 6 |
| T-Dev-07 | Reconciliation cron template + Lark alerts | C-10 | M | Wave 6 |
| T-Dev-08 | Test fixtures — PW1 sample dataset dump | — | S | Wave 6 |
| T-Dev-09 | Build 5 NEW Payload collections (Discount, Brand, Customer, Menu, EmailTemplate) | Group B | XL | Wave 6 |
| T-Dev-10 | Add 4 schema extensions to existing collections (Tenants.limits, Tenants.members, Sites.appIntegration, Tenants.subscriptionHistory) | Group C | L | Wave 6 |
| T-Dev-11 | Implement Group D feature infra (plan enforcement, multi-store UI, product switcher, subscription webhook) | Group D | XL | Wave 6-7 |
| T-Dev-12 | Per-feature sub-PRDs (38 items) — write theo template | All sub-PRDs | XL | Wave 6-7 |
| T-Dev-13 | Per-feature ETL scripts (23 data migration items: Group A 20 + Group B 3 retain ETL) | Sub-PRDs §13.6 | XL | Wave 7 |
| T-Dev-14 | WordPress source parser (cho Pages + Media library) — multi-schema adapter | A9, A10 | L | Wave 7 (P2) |
| T-Dev-15 | PW1 endpoint deprecation handler (410 Gone + 301 redirect) | — | S | Post-cutover |
| T-Dev-16 | Plan tier seeding (Free/Starter/Standard/Professional defaults trong Tenants.limits) | C1 | S | Wave 6 |

---

## 9. DevOps Tasks

| ID | Task | Effort | Sprint |
|----|------|--------|--------|
| T-Ops-01 | PW1 DB read credentials → Vercel encrypted env | S | Wave 6 |
| T-Ops-02 | PW1 full DB snapshot pre-migration (rollback safety) | S | T-7d |
| T-Ops-03 | Vercel env vars: `PW1_DB_URL`, `PW1_API_BASE`, `SSO_SHARED_SECRET`, `TM_SSO_WEBHOOK_SECRET` | S | Wave 6 |
| T-Ops-04 | Reconciliation cron infra | M | Wave 6 |
| T-Ops-05 | Monitoring dashboards — Vercel Speed Insights, Sentry, Posthog, Lark #migration-alerts | M | Wave 6 |
| T-Ops-06 | TM SSO team coordination — redirect URL flip date + subscription webhook integration | M | T-30d |
| T-Ops-07 | Rollback runbook `docs/runbooks/sso-redirect-rollback.md` (drill before T-0) | M | T-14d |
| T-Ops-08 | Lark webhook setup `#migration-alerts` | S | Wave 6 |
| T-Ops-09 | Post-cutover monitoring (7-day intensive) | S | T+0 to T+7d |
| T-Ops-10 | WordPress access setup (read media library + content) cho A9, A10 | S | T-21d (P2) |

---

## 10. QA Tasks

| ID | Task | Effort | Sprint |
|----|------|--------|--------|
| T-QA-01 | Test plan per sub-PRD (`docs/qa/F[XX]-migration-[slug].md`) | XL | Wave 6-7 |
| T-QA-02 | E2E migration drill on staging — prod-size dataset | L | T-14d |
| T-QA-03 | Login flow regression — 3 personas + 4 plan tiers | M | Wave 6 |
| T-QA-04 | Rollback drill — verify < 5 min RTO | M | T-14d |
| T-QA-05 | Plan limit enforcement tests — over-limit actions blocked | M | Wave 6 |
| T-QA-06 | Multi-store switcher UX tests | M | Wave 6 |
| T-QA-07 | Product switcher tests — JWT plan-based gating | M | Wave 6 |
| T-QA-08 | Data integrity validation (per feature) — row count, FK, sample diff | M | T-7d (during backfill) |
| T-QA-09 | Post-cutover smoke tests — auto every 30 min for 24h | S | T+0 |
| T-QA-10 | Support team UAT — 5 reps (1 Persona A, 2 B, 2 C) | M | T-3d |

---

## 11. PM Tasks

| ID | Task | Effort | Sprint |
|----|------|--------|--------|
| T-PM-01 | TM SSO team alignment — confirm redirect mechanism + subscription webhook contract | S | T-30d |
| T-PM-02 | Sub-PRD prioritization + owner assignment (25 items) | M | Wave 6 start |
| T-PM-03 | User communication plan (emails + banners) | M | T-14d |
| T-PM-04 | FAQ doc `docs/help/sso-migration-faq.md` | M | T-7d |
| T-PM-05 | Support team training (60min) | M | T-7d |
| T-PM-06 | Cutover go/no-go meeting (T-1d) | S | T-1d |
| T-PM-07 | Weekly stakeholder updates (Wave 6-7) | S | Ongoing |
| T-PM-08 | Post-cutover retro (T+14d) | M | T+14d |
| T-PM-09 | Plan tier matrix sign-off với Finance/Sales (Free/Starter/Standard/Professional limits) | M | T-30d |
| T-PM-10 | Decision on "untraveled users" cleanup policy | S | T-7d |

---

## 12. Master Timeline

| Phase | Date offset | Milestone | Gate to next phase |
|-------|-------------|-----------|--------------------|
| **Phase 0 — Planning** | T-60d → T-45d | All 25 sub-PRDs drafted | All P0 sub-PRDs status=Ready |
| **Phase A — Collections + Schema** | T-45d → T-30d | 5 new collections built; 4 schema extensions shipped | Payload admin CRUD works for all new entities |
| **Phase B — Migration Framework + Foundation** | T-30d → T-21d | Migration framework + activation field + identity mapper + plan limits + persona routing live | E2E test on staging w/ 10 sample users pass |
| **Phase C — Feature Infra (Group D)** | T-21d → T-14d | Plan enforcement, multi-store UI, product switcher, subscription webhook all live | E2E tests pass |
| **Phase D — ETL Build + Staging Dry-Run** | T-14d → T-7d | All P0 ETL scripts coded + staging full migration drill | Row count match ±0.01% + rollback drill pass |
| **Phase E — Prod Backfill** | T-7d → T-1d | Bulk migration on prod (off-peak windows) | Reconciliation drift < 0.1% for 24h |
| **Phase F — Cutover (T+0)** | **T+0** | TM SSO redirect flip → PW2 | Login success rate > 99% in first 4h |
| **Phase G — Monitoring** | T+0 → T+7d | Intensive monitoring, hot-fix | 7 days stable |
| **Phase H — Wave 7 deferred (P1+P2)** | T+7d → T+30d | P1 sub-PRDs (Blog, Payment, Media, Subscribers, etc.) migrated | All P1 complete |
| **Phase I — Decommission** | T+30d | PW1 endpoint 410/301 redirect | No traffic to PW1 for 7d |

---

## 13. Master Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|-----------|--------|------------|-------|
| R-01 | TM SSO redirect config blocked / delayed (3rd-party) | High | Critical | Lock cutover date 30d ahead w/ TM, weekly sync, escalation path | PM |
| R-02 | Identity mapping ambiguity — same email + different customer_id | Medium | High | Composite key check, manual review (expect <0.1%), log + alert | Dev |
| R-03 | Bulk backfill exceeds maintenance window | Medium | High | Parallelize per feature, off-peak schedule, dry-run prod-size | Dev + DevOps |
| R-04 | PW1 schema drift mid-migration | Medium | High | Freeze PW1 schema 30d before cutover, daily diff alert | DBA + PM |
| R-05 | Untraveled users — migration waste | Low | Low | Track activation rate, cleanup 90d post-cutover | PM |
| R-06 | `migrationStatus='failed'` users → support spike | Medium | Medium | Pre-stage support team, runbook for manual remediation | Ops |
| R-07 | JWT signature verification failure (env mismatch) | Low | Critical | Pre-validate `SSO_SHARED_SECRET` align, monitor JWT decode errors | DevOps |
| R-08 | Media file URLs break (CDN path different) | Medium | Medium | URL rewriter at PW2 storefront, lazy re-upload to R2 | Dev |
| R-09 | Rollback infra fails — TM SSO can't flip back fast | Low | Critical | Drill rollback in staging, TM team on-call | DevOps + TM |
| R-10 | Owner reports missing data post-cutover | Medium | Medium | Reconciliation queries on-demand, support comparison tool | Dev + Support |
| R-11 | WordPress storefront heterogeneous schema | High | Medium | Defer Pages to Wave 7; per-owner audit; manual import tool | Dev + PM |
| R-12 | Subscriptions data mismatch — wrong plan / billing fail | Medium | Critical | Pre-cutover billing reconciliation w/ Stripe + TM SSO; Finance signoff | Dev + Finance |
| R-13 | **Plan tier limits not enforced** — user exceeds quota silently | Medium | High | D1 middleware blocks at API + UI; integration test per tier | Dev |
| R-14 | **Multi-store data leak** — user A sees user B's tenant | Low | Critical | Strict tenant access middleware; pen-test multi-store | Dev + Security |
| R-15 | **Subscription webhook missed** — plan change not reflected in PW2 | Medium | High | Webhook retry + reconciliation cron compare TM SSO vs PW2 plan | Dev + DevOps |
| R-16 | **5 new collections not ready** in time (Discount/Brand/Customer/Menu/EmailTemplate) | High | Critical | Phase A 15-day buffer; if slip → defer Discount + Email to Wave 7 | Dev + PM |
| R-17 | **Product switcher broken** — user can't access other products | Medium | High | Fallback: direct link to TM SSO portal; JWT validation tests | Dev |
| R-18 | **PW1 URLs return 404 sau cutover** — bookmarked links + Google indexed pages | High | High | A11 SEO Redirect Map: collect URLs từ Google Search Console + Vercel rewrite rules; monitor 404 rate post-cutover | Dev + Marketing |
| R-19 | **Customer mất địa chỉ checkout** — abandonment rate tăng | Medium | Medium | A12 Customer Addresses migrate; reconciliation per customer count saved addresses match | Dev |
| R-20 | **Discount usage audit broken** — Finance không track campaign ROI lịch sử | Medium | High | A13 Discount Usage migrate; Orders.discountCode FK link preserve; reconciliation total redemptions match | Dev + Finance |
| R-21 | **Inventory history mất** — chỉ có snapshot stock hiện tại, không có trail thay đổi | Medium | Medium | A14 InventoryMovements migrate; verify PW1 schema có log table không (Q-18) | Dev |
| R-22 | **Order returns/refunds detail mất** — chỉ status='returned' không đủ cho audit | Medium | Medium | A15 OrderReturns migrate; verify PW1 (Q-19) | Dev + Finance |
| R-23 | **Tenant custom domain mất DNS verify** — domain hiển thị "pending" forever | Medium | Medium | C6 dnsVerification + auto re-verify cron + DevOps drill DNS verify | DevOps |
| R-24 | **SES sender domain mất** — emails gửi từ default address (lower deliverability) | Medium | Medium | C7 senderDomain extension + DevOps re-verify TXT records per tenant | DevOps |
| R-25 | **Owner API tokens broken** — 3rd-party integrations (Zapier, custom apps) ngừng hoạt động | Medium | High | A16 ApiTokens + OwnerWebhooks migrate; rewire webhook URLs PW1→PW2 endpoints | Dev + Owner |
| R-26 | **Custom JS/CSS mất** — Owner inject FB Pixel manual / A/B test scripts mất | Low | Low | C8 customCode field (P2); document workaround dùng C3 appIntegration cho FB/GA chính thức | Dev + Owner |
| R-27 | **Team Members (Manager/Crew) mất access day 1** — staff không vào được dashboard sau cutover | High | High | A17 Team Members migration; verify Q-22 PW1 schema; pre-cutover comm tới staff | Dev + PM |
| R-28 | **Subscription history trống** — Owner xem "Request history" empty, Finance audit broken | Medium | Medium | A18 backfill từ Stripe events history (Stripe có 90-day event retention; older → log gap) | Dev + Finance |
| R-29 | **Templates customizations mất** — Owner phải re-customize colors/layouts | Low | Medium | A19 P2 deferred; pre-cutover screenshot capture; Owner comm | Dev + Design |
| R-30 | **Tax invoices PDF archive mất** — MY compliance 7-year requirement broken | Medium | High | A20 migrate URLs hoặc re-generate; verify Q-23 với Finance + Compliance team | Dev + Finance + Compliance |

**Update cadence:** Weekly during Phase 0-D, daily during Phase E-G.

---

## 14. Success Metrics

| Metric | Target | Measured |
|--------|--------|----------|
| First-login success rate (post-cutover) | ≥ 99% | Sentry + login analytics |
| Data parity (row count per feature) | ≥ 99.99% | Reconciliation queries |
| Page-1 `/dashboard` p95 post-redirect | ≤ 3s | Vercel Speed Insights |
| Support ticket spike | < 2× baseline | Helpdesk |
| Rollback executed | 0 ideal / drill verified | DevOps |
| Active PW1 → PW2 conversion (T+30d) | ≥ 90% | Auth analytics |
| Data loss incidents | 0 | Incident log |
| Plan limit enforcement violations | 0 (silent over-limit) | Audit log |
| Multi-store switch latency | ≤ 500ms | Synthetic monitoring |
| Product switcher accuracy (JWT plan vs UI shown) | 100% | Integration test |

---

## 15. Open Decisions

| # | Question | Required by | Owner |
|---|----------|-------------|-------|
| Q-01 | TM SSO redirect mechanism — TM-side config vs PW1 301 redirect chain? | T-30d | PM + TM team |
| Q-02 | Untraveled-user cleanup policy (default 90d)? | T-7d | PM |
| Q-03 | Support SLA for `migrationStatus='failed'`? | T-7d | Support + Dev |
| Q-04 | Media migration: re-upload to PW2 R2 vs PW1 CDN passthrough? | T-21d | Dev + Ops |
| Q-05 | Subscriptions source-of-truth: PW1 DB vs Stripe API vs TM SSO portal? | T-30d | PM + Finance |
| Q-06 | Inactive PW1 tenants (zero orders > 180d) — migrate or skip? | T-21d | PM |
| Q-07 | Pages migration strategy (defer/manual/skip) given WordPress source? | T-30d | PM + Dev Lead |
| Q-08 | Customer reviews — skip or build new collection? | T-21d | PM |
| Q-09 | **Plan tier limit override** — can support manually grant limit increase? | T-14d | PM + Support |
| Q-10 | **Multi-store cap per plan** — confirm matrix (Free=1, Starter=1-3, Standard=5-10, Professional=3-5)? Sitemap có conflict | T-30d | PM + Sales |
| Q-11 | **EmailTemplates editor scope** — full WYSIWYG vs variable-only edit? | T-21d | PM + Design |
| Q-12 | **Menu collection** — build separate hay extend Sites header block? | T-30d | Dev Lead |
| Q-13 | **MFA backup mechanism** — add hay defer (OTP via email enough)? | T-21d | PM + Security |
| Q-14 | **Brand entity** — full CRUD UI hay seed-only? | T-21d | PM + Design |
| Q-15 | **SEO redirect scope** (A11) — bao nhiêu URLs migrate? Top-N từ Google Search Console hay full sitemap? | T-21d | PM + Marketing |
| Q-16 | **Customer addresses primary** (A12) — PW1 schema có default address flag không? Nếu không → migrate tất cả as equal? | T-14d | Dev + PM |
| Q-17 | **Discount usage retention period** (A13) — migrate full history hay last 12 tháng để giảm storage? | T-14d | PM + Finance |
| Q-18 | **Inventory history** (A14) — PW1 có dedicated InventoryMovements table hay chỉ log trong audit_log? Schema source? | T-21d | Dev + PM |
| Q-19 | **Order returns schema** (A15) — PW1 có OrderReturns table riêng hay chỉ status field + comment? | T-21d | Dev + Finance |
| Q-20 | **Owner integrations** (A16) — PW1 có cho Owner tạo API tokens và webhooks không? Nếu có → liệt kê endpoints cũ + plan rewire | T-21d | PM + Dev Lead |
| Q-21 | **Custom code injection** (C8) — PW1 có cho Owner inject custom JS/CSS không? Nếu có → migrate hay buộc dùng C3 appIntegration chính thức? | T-21d | PM + Security |
| Q-22 | **Team Members schema PW1** (A17) — Manager/Crew accounts lưu ở pw1.users với role field hay table riêng pw1.staff_members? Permissions mapping sang PW2? | T-21d | PM + Dev Lead |
| Q-23 | **Tax invoices storage** (A20) — PW1 lưu PDF ở đâu (S3/local)? Re-generate khả thi từ Orders data không? Compliance 7-year retention OK? | T-21d | PM + Finance + Compliance |

---

## 16. Glossary

| Term | Meaning |
|------|---------|
| **Persona A / B / C** | New user / Pre-provisioned / Active PW1 (§2) |
| **Composite identity key** | `(email, customer_id_number)` — match PW1 ↔ PW2 user records |
| **migrationStatus** | Field on Users + Tenants: `'pending' \| 'migrated' \| 'failed'` |
| **Post-SSO landing** | PW2 route `/post-sso-landing` — JWT verify + persona routing |
| **Cutover (T+0)** | Date TM SSO redirect flip from PW1 → PW2 |
| **Multi-product hub** | TM SSO portal routes user vào 4 products: DIS / PW / CRM / POS |
| **Plan tier** | Free / Starter / Standard / Professional — determines limits |
| **Limit enforcement** | PW2 middleware blocks actions exceeding Tenants.limits |
| **Multi-store** | 1 Owner có N tenants (1-10) tùy plan |
| **Reverse dual-write** | Post-cutover safety: PW2 (primary) → PW1 (mirror) for 30d rollback |
| **TM** | Telekom Malaysia — SSO portal operator |
| **Group A/B/C/D** | Sub-PRD groups: Data migration / New collections / Schema extensions / New infra |

> Glossary chung cho migration terms (dual-write, backfill, etc.) ở [`MIGRATION_PRD_TEMPLATE.md`](./MIGRATION_PRD_TEMPLATE.md) Appendix A.

---

## 17. Definition of Ready (Master)

- [ ] All 25 sub-PRDs drafted (§7 catalogue)
- [ ] Group B (5 new collections) PRDs approved by Tech Lead
- [ ] Group C (4 schema extensions) reviewed for migration impact
- [ ] Group D (5 feature infra) owners assigned
- [ ] §8 Dev tasks owners assigned
- [ ] §9 DevOps tasks owners assigned
- [ ] §10 QA tasks owners assigned
- [ ] §11 PM tasks owners assigned
- [ ] §12 Cutover date approved by stakeholders + TM team
- [ ] §13 Risks R-01, R-04, R-12, R-16 mitigation plans documented
- [ ] §15 Open Decisions Q-01, Q-05, Q-07, Q-10, Q-12 resolved
- [ ] Plan tier limit matrix locked với Finance/Sales
- [ ] Subscription webhook contract signed with TM SSO team
- [ ] Identity mapping logic tested on staging
- [ ] Rollback runbook drafted

---

## 18. Definition of Done (Master)

- [ ] All 25 sub-PRDs status = Done (or P2 deferred to Wave 7 với rationale)
- [ ] §12 Phase I reached — PW1 endpoint returns 410/301, 0 traffic 7d
- [ ] §14 Success metrics achieved for ≥ 7 consecutive days post-cutover
- [ ] §13 Risks reviewed in retro (T+14d) — no Critical-level incident
- [ ] Migration framework + reconciliation infra documented for future migrations
- [ ] 5 new collections fully operational (Discount, Brand, Customer, Menu, EmailTemplate)
- [ ] Plan tier limit enforcement verified zero silent over-limit incidents
- [ ] Multi-store UI verified với multi-tenant test owner
- [ ] Product switcher verified for all 4 plan tiers
- [ ] Subscription webhook 100% delivered (no missed plan changes)
- [ ] Final post-mortem written nếu có rollback / Critical incident
- [ ] Stakeholder sign-off (PM + Tech Lead + TM team + Finance)

---

## 19. How-to-use this master doc

### For Devs starting a sub-PRD
1. Pick assigned feature from §7 Sub-PRD Catalogue
2. Identify group (A: data only / B: build new / C: extend schema / D: new infra)
3. Copy `MIGRATION_PRD_TEMPLATE.md` → `docs/prd/F[XX]-migration-[slug].md`
4. Fill §13.5 Schema Mapping + §13.6 Data Migration Plan
5. Reference master §8 cho shared dev tasks (no duplication)
6. Submit for review → status → Ready

### For Group B (new collections) sub-PRDs
- Write 2 PRDs per collection: `F-[name]-prd.md` (feature spec) + `F-migration-[name].md` (migration plan)
- Collection MUST ship to staging before migration ETL begins

### For DevOps
- Track tasks §9
- Coordinate TM SSO team per Q-01
- Drill rollback in staging per T-Ops-07
- Setup subscription webhook receiver per T-Dev-13

### For PM
- Track sub-PRD progress §7 status column
- Resolve §15 Open Decisions per deadlines
- Weekly stakeholder updates per T-PM-07

### For QA
- Per-sub-PRD test plan trong `docs/qa/F[XX]-migration-[slug].md`
- Staging dry-run drill T-14d (T-QA-02)
- Plan tier enforcement tests (T-QA-05)
- Product switcher tests (T-QA-07)

---

**End of SSO_REDIRECT_MIGRATION_MASTER.md v2.0**
