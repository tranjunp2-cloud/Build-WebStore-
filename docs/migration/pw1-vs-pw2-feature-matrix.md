# PW1 vs PW2 Feature Comparison Matrix

> **Created:** 2026-05-18 | **Owner:** PM + Dev Lead | **Audience:** PM / Dev / DevOps / Stakeholders
> **Source:** [Sitemap WebStore](../qa/Sitemap%20-%20WebStore.mm) + [Sitemap SSO](../qa/Sitemaps%20-%20SSO.mm) + PW2 codebase audit
> **Related:** [SSO_REDIRECT_MIGRATION_MASTER.md](../prd/SSO_REDIRECT_MIGRATION_MASTER.md) · [Stories consolidated](../stories/F-sso-migration-all-stories.md)

---

## Mục đích

Bảng này dùng để:
- PM align với stakeholders về scope migration
- Dev pickup features cần build (❌ MISSING)
- QA test plan từ feature parity matrix
- Owner communication: features nào giữ / dropped / enhanced

**Legend:**
- ✅ **Same** — 1:1 parity giữa PW1 và PW2
- 🔧 **Different/Enhanced** — PW2 có nhưng khác behavior
- ❌ **MISSING** — PW1 có, PW2 chưa có (cần build)
- 🆕 **NEW PW2** — PW2 only (PW1 không có)
- ❓ **Verify** — Cần audit PW1 schema để confirm

---

## 1. OVERVIEW — High-Level Comparison

| Module | PW1 | PW2 | Status | Migration Priority |
|--------|-----|-----|--------|-------------------|
| **Auth + Identity (SSO)** | SSO provision webhook | SSO provision webhook ✅ | ✅ Same | **P0** US-MIGA-01 |
| **Dashboard** | Có | F03 Dashboard | ✅ Same | P1 |
| **Multi-product Hub (DIS/PW/CRM/POS)** | TM SSO hub | Cần product switcher | 🔧 Different | **P0** US-MIG-06 |
| **Plan Tiers** (Free/Starter/Standard/Professional) | Có | Cần Tenants.limits + enforcement | 🔧 Different | **P0** US-MIG-04, US-EXT-01 |
| **Multi-store per Owner** | 1-10 stores tùy plan | Có (Tenants multi) | ✅ Same | **P0** US-MIG-05 |
| **Products + Variants** | Có | F08 + variants ✅ | ✅ Same | **P0** US-MIGA-03 |
| **Brand** | Có | ❌ Chưa có | ❌ MISSING | **P0** Group B2 |
| **Category** (parent/child) | Có | F08 Categories | ✅ Same | P0 |
| **Discount Codes** | Có (full CRUD + types) | ❌ Chưa có | ❌ MISSING | **P0** Group B1 |
| **Orders** | Pending/Shipping/Returned/Cancelled | F10 Orders | ✅ Same | **P0** US-MIGA-04 |
| **Order Returns/Refunds Detail** | Có | ❌ Chỉ status field | ❌ MISSING | **P1** US-MIGA-15 |
| **Inventory Log** (audit trail) | Có | ❌ Chỉ snapshot | ❌ MISSING | **P1** US-MIGA-14 |
| **Customers** (separate entity, Rank) | Có | F25 Customers | 🔧 Partial (PW2-built; ETL US-MIGA-12 pending) | **P0** Group B3 |
| **Customer Addresses Book** (multiple/customer) | Có | F25 Customers | 🔧 Partial (PW2-built; ETL US-MIGA-12 pending) | **P0** US-MIGA-12 |
| **Articles / Blog** | Có | F17 Blog | ✅ Same | P1 |
| **Templates** (system) | Có | F07 Template Gallery | ✅ Same | P0 |
| **Template Customizations** (Owner edits) | Có | ⚠️ Chưa scope | 🔧 Partial | **P2** US-MIGA-19 |
| **Pages** (storefront content) | WordPress (3rd-party) | F18 Pages (Payload) | 🔧 Different | **P2** US-MIGA-10 (defer) |
| **Menus** (Header/Footer + tabs/sub-tabs) | Có | ❌ Chưa có | ❌ MISSING | **P1** Group B4 |
| **Email Templates Editor** (per-tenant) | Có | ❌ Hardcoded SES | ❌ MISSING | **P1** Group B5 |
| **Payments** (COD + Bank Transfer) | Có | F13 Payment Gateway | ✅ Same | P1 |
| **Stripe Integration** | Có | ✅ Đã có | ✅ Same | P1 |
| **Shipping** (MY flat-rate) | Có | F14 Shipping (West RM8/East RM15) | ✅ Same | P0 |
| **Web Address** (multi-domain) | Có | ✅ Tenants.customDomains | ✅ Same | P0 |
| **DNS Verification status** | Có | ⚠️ Cần extension | 🔧 Partial | **P1** US-EXT-05 |
| **App Integration** (FB Pixel + GA) | Có | ❌ Chưa có schema | ❌ MISSING | **P1** US-EXT-03 |
| **Team Members** (Manager/Crew) | Có | ⚠️ Schema có, ETL chưa | 🔧 Partial | **P0** US-MIGA-17 |
| **Subscriptions / Plan History** | Có | Subscriptions collection | ✅ Same | P0 |
| **Tax Invoice PDFs** (compliance) | Có | ❌ Chưa scope | ❌ MISSING | **P1** US-MIGA-20 |
| **Custom JS/CSS Injection** | Có | ❌ Chưa có | ❌ MISSING | **P2** US-EXT-07 |
| **API Tokens / Custom Webhooks** (Owner) | Có | ❌ Chưa có | ❌ MISSING | **P1** US-MIGA-16 |
| **Reviews / Ratings** | ? | ❌ Chưa có | ❓ Verify Q-09 | P? |
| **Wishlist / Saved Items** | ? | ❌ Chưa có | ❓ Verify G-10 | P? |
| **MFA Backup Email** | Có | ❌ Chỉ OTP | ❌ MISSING | **P2** US-MIG-10 |
| **Media Gallery + Unsplash** | Có Unsplash | Media (no Unsplash) | 🔧 Different | P1 |
| **AI Builder** (text-to-website) | ❌ Không có | ✅ F01 | 🆕 NEW PW2 | — |
| **AI Editor** (chat-based) | ❌ Không có | ✅ F05 | 🆕 NEW PW2 | — |
| **Block Renderer** (custom blocks) | Static templates | ✅ F04 | 🆕 NEW PW2 | — |
| **Auto-Save Draft + Undo/Redo** | ❌ Không có | ✅ F11/F12 | 🆕 NEW PW2 | — |
| **Localization** | EN/JA/Bahasa | EN/MS/VI | 🔧 Different (drop JA) | P1 |
| **SEO URL Redirects PW1→PW2** | — | ❌ Cần build | ❌ MISSING | **P0** US-MIGA-11 |

---

## 2. DETAIL — Per Module

### 2.1 Identity + Auth

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| Login | TM SSO portal | TM SSO portal | ✅ |
| Password reset | SSO external | Redirect SSO (TC-F02.28b) | ✅ |
| Account profile edit | Có | F02 + F23 | ✅ |
| Change password | Trong PW1 | Redirect SSO | ✅ |
| MFA Mail backup | Có | ❌ Chỉ OTP via email | ❌ MISSING |
| Composite identity (email + customer_id) | ✅ | ⚠️ Cần ETL match logic | 🔧 Partial |

### 2.2 Products & Catalog

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| Product CRUD | ✅ | ✅ F08 | ✅ |
| Variants | ✅ | ✅ Products.variants | ✅ |
| Categories (parent/child) | ✅ | ✅ Categories | ✅ |
| Brand | ✅ | ❌ | ❌ MISSING |
| Search by Category/Status | ✅ | ✅ | ✅ |
| Sort: price/discount/stock | ✅ | ✅ | ✅ |
| Active/Inactive toggle | ✅ | ✅ Products.status | ✅ |
| Export CSV | ✅ | ⚠️ Verify | 🔧 |
| Inventory log (audit) | ✅ | ❌ | ❌ MISSING |

### 2.3 Orders

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| Order list | ✅ | ✅ F10 | ✅ |
| Status: Pending/Shipping/Returned/Cancelled | ✅ | ✅ | ✅ |
| Search by status/date | ✅ | ✅ | ✅ |
| Export | ✅ | ⚠️ Verify | 🔧 |
| Returns/Refunds detail | ✅ | ❌ | ❌ MISSING |
| Tax invoice PDF | ✅ | ❌ | ❌ MISSING |
| Tracking number (free text) | ✅ | ✅ F14 | ✅ |
| SST 6% calculation | ✅ | ✅ F14 | ✅ |
| Total income dashboard | ✅ | ⚠️ Verify F03 | 🔧 |

### 2.4 Customers (CRITICAL DELTA)

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| **Separate Customers entity** | ✅ | ❌ Chỉ nested in Orders | ❌ MISSING |
| **Customer Rank** | ✅ | ❌ | ❌ MISSING |
| **Multiple addresses per customer** | ✅ | ❌ Chỉ 1 trong Order | ❌ MISSING |
| Search by Rank/Date | ✅ | ❌ | ❌ MISSING |
| Customer order history view | ✅ | ⚠️ Order list filter by customer email | 🔧 Partial |
| Export customers | ✅ | ❌ | ❌ MISSING |

### 2.5 Storefront / My Web Store

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| Templates | ✅ (PW1 native) | ✅ F07 Templates | ✅ |
| Template change | ✅ | ✅ | ✅ |
| Preview Mobile/Tablet/Desktop | ✅ | ✅ | ✅ |
| Basic info (logo/favicon/social) | ✅ | ✅ Sites.theme | ✅ |
| **Pages with blocks** | WordPress | ✅ F18 Pages + F04 Blocks | 🔧 Different |
| Hero banner block | ✅ | ✅ BlockVariants | ✅ |
| Small banner / Category Listing / Product Listing / Article Listing / Rich Text | ✅ | ✅ BlockVariants | ✅ |
| Edit SEO per page | ✅ | ✅ Pages.seo | ✅ |
| **Menu Header** (tabs/sub-tabs) | ✅ | ❌ | ❌ MISSING |
| **Menu Footer** | ✅ | ❌ | ❌ MISSING |
| Search button visibility toggle | ✅ | ❌ Cần extension | ❌ MISSING |
| Cart button visibility toggle | ✅ | ❌ Cần extension | ❌ MISSING |

### 2.6 Settings

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| Account profile | ✅ | ✅ | ✅ |
| **Team Member** (Manager/Crew, Publish/Unpublish) | ✅ | ⚠️ Schema only | 🔧 Partial |
| **Email templates editor** | ✅ Per-tenant | ❌ Hardcoded | ❌ MISSING |
| Payments (Add/Delete) | ✅ | ✅ F13 | ✅ |
| Delivery (Shipping) | ✅ | ✅ F14 | ✅ |
| **Web Address** (multi-domain + primary) | ✅ | ✅ Tenants.customDomains | ✅ |
| **DNS verification status** | ✅ | ⚠️ Cần extension | 🔧 Partial |
| **App Integration: FB Pixel** | ✅ | ❌ | ❌ MISSING |
| **App Integration: Google Analytics** | ✅ | ❌ | ❌ MISSING |
| **Custom JS/CSS injection** | Có thể có | ❌ | ❌ MISSING |

### 2.7 Discount (CRITICAL MISSING)

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| **Entire Discount module** | ✅ | ❌ | ❌ MISSING |
| Add discount | ✅ | ❌ | ❌ |
| Edit discount | ✅ | ❌ | ❌ |
| Types (percentage/fixed) | ✅ | ❌ | ❌ |
| Status (active/inactive) | ✅ | ❌ | ❌ |
| Usage limit | ✅ | ❌ | ❌ |
| Date range | ✅ | ❌ | ❌ |
| Search/filter | ✅ | ❌ | ❌ |
| Export | ✅ | ❌ | ❌ |
| **Usage history per order** | ✅ | ❌ | ❌ MISSING |

### 2.8 Articles / Blog

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| All articles list | ✅ | ✅ F17 Blogs | ✅ |
| Add/Edit article | ✅ | ✅ | ✅ |
| Article categories | ✅ | ✅ BlogCategories | ✅ |
| Search by category | ✅ | ✅ | ✅ |
| Recent News audit | ✅ | ⚠️ Verify | 🔧 |
| Date range filter | ✅ | ✅ | ✅ |
| Export | ✅ | ⚠️ Verify | 🔧 |
| Bulk actions | ✅ | ⚠️ Verify | 🔧 |
| Display date created toggle | ✅ | ⚠️ Verify | 🔧 |

### 2.9 Billing (từ SSO sitemap)

| Sub-feature | PW1 | PW2 | Status |
|-------------|-----|-----|--------|
| **Plan tiers** (Free/Starter/Standard/Professional) | ✅ | ⚠️ Schema có, limits chưa | 🔧 Partial |
| Upgrade flow (Free→Starter etc.) | TM SSO controls | TM SSO controls (PW2 receive webhook) | ✅ |
| Downgrade flow | TM SSO controls | TM SSO controls (US-MIG-07) | ✅ |
| Modify plan | TM SSO portal | TM SSO portal | ✅ |
| **Plan limits enforcement** | TM SSO checks | ⚠️ PW2 cần build (US-MIG-04) | 🔧 Partial |
| Subscription start/end date | ✅ | ✅ Subscriptions | ✅ |
| Modify plan history | ✅ | ❌ Cần backfill (US-MIGA-18) | ❌ MISSING |
| Request history filter/search | ✅ | ❌ Cần build UI | ❌ MISSING |
| Terminated subscription | ✅ | ⚠️ Verify | 🔧 |

### 2.10 PW2-Only NEW Features (KHÔNG có ở PW1)

| Feature | PW2 | PW1 |
|---------|-----|-----|
| AI Builder (text-to-website) | ✅ F01 | ❌ |
| AI Editor (chat-based edit) | ✅ F05 | ❌ |
| Block Variant System | ✅ F31 | ❌ Static templates only |
| Auto-Save Draft | ✅ F12 | ❌ |
| Undo/Redo | ✅ F11 | ❌ |
| Template Quality Score | ✅ | ❌ |
| AI Generation Records | ✅ | ❌ |
| Drift Validator (template integrity) | ✅ | ❌ |
| Storefront Cart (Zustand persist) | ✅ F09 | ⚠️ Verify cart implementation |
| Localization EN/MS/VI | ✅ F21 | EN/JA/Bahasa (drop JA, add VI) |

---

## 3. MIGRATION PRIORITY RANKING

### Tier S — Block Cutover (MUST migrate before T+0) — 15 items

| Rank | Feature | Lý do critical | US |
|------|---------|----------------|-----|
| 1 | Users + Identity Mapping | Không có → user không login được | US-MIGA-01 |
| 2 | Tenants + Sites + customDomains | Không có → storefront broken | US-MIGA-02 |
| 3 | Products + Categories + Variants | Core commerce data | US-MIGA-03 |
| 4 | Orders historical | Owner mất revenue history → không quản lý được | US-MIGA-04 |
| 5 | Subscriptions / Plan | Billing fail → wrong plan | US-MIGA-05 |
| 6 | Plan Tier Limits enforcement | User Free 1 store nhưng có 5 stores → conflict | US-MIG-04, US-EXT-01 |
| 7 | Multi-store + Product Switcher | UX broken | US-MIG-05, US-MIG-06 |
| 8 | Brand collection + Migration | Products mất reference brand → catalog broken | Group B2, US-BRN-04 |
| 9 | Customers separate + Addresses | Buyer mất addresses → cart abandonment | Group B3, US-MIGA-12 |
| 10 | Discount collection + Usage History | Revenue audit + active campaigns | Group B1, US-MIGA-13 |
| 11 | SEO URL Redirects PW1→PW2 | Bookmarks + Google indexed → 404 | US-MIGA-11 |
| 12 | Team Members migration | Staff lost day 1 access | US-MIGA-17 |
| 13 | Subscription Webhook | Real-time plan change | US-MIG-07, D4 |
| 14 | Store Config (shipping/payment) | Storefront commerce broken | US-MIGA-06 |
| 15 | Stripe Webhook Rewire | Payment drop transactions | US-MIGA-08 |

### Tier A — Important (Week-1 Post-Cutover) — 13 items

| Rank | Feature | Lý do | US |
|------|---------|-------|-----|
| 16 | Blog/Articles migration | Content marketing assets | US-MIGA-07 |
| 17 | Media files migration | Images render | US-MIGA-09 |
| 18 | Menus header/footer | Navigation | Group B4 |
| 19 | Email Templates editor + migration | Customer comm brand voice | Group B5 |
| 20 | Inventory Log | Stock audit trail | US-MIGA-14 |
| 21 | Order Returns Detail | Finance audit | US-MIGA-15 |
| 22 | API Tokens + Webhooks | 3rd-party integrations | US-MIGA-16 |
| 23 | Tax Invoice PDFs | MY compliance 7-year | US-MIGA-20 |
| 24 | Subscription History Backfill | Audit trail | US-MIGA-18 |
| 25 | DNS Verification extension | Domain pending forever | US-EXT-05 |
| 26 | SES Sender Domain | Email deliverability | US-EXT-06 |
| 27 | FB Pixel + GA Integration | Marketing tracking | US-EXT-03 |
| 28 | Team Members schema | Manager/Crew roles | US-EXT-02 |

### Tier B — Optional (Wave 7+ Defer) — 4 items

| Rank | Feature | Lý do defer | US |
|------|---------|-------------|-----|
| 29 | Pages WordPress migration | Heterogeneous schema, không block cutover | US-MIGA-10 |
| 30 | Custom JS/CSS Injection | Workaround dùng C3 chính thức | US-EXT-07 |
| 31 | MFA Backup Email | OTP đủ tạm thời | US-MIG-10 |
| 32 | Templates Customizations | Owner re-customize OK | US-MIGA-19 |

### Tier C — Unknown (Need PW1 Audit)

| Feature | Status |
|---------|--------|
| Reviews/Ratings | Q-09 verify với PW1 team |
| Wishlist | G-10 verify |
| Storefront Search Index | G-11 (rebuild post-cutover OK) |

---

## 4. SUMMARY NUMBERS

| Category | Count | Note |
|----------|-------|------|
| ✅ Same/Match (1:1) | ~18 features | Core commerce |
| 🔧 Enhanced/Different | ~5 features | UI improvements, Wave 6 simplifications |
| ❌ **MISSING in PW2** (cần build) | **12 features** | Critical: Brand, Discount, Customers, Menus, EmailTemplates |
| 🆕 NEW in PW2 (no PW1 equiv) | ~10 features | AI Builder/Editor, Block system, Auto-save |
| ❓ Verify | 3 features | Reviews, Wishlist, Search |

**Tổng features cần migration: ~32 (15 Tier S + 13 Tier A + 4 Tier B)**

---

## 5. CRITICAL CALL-OUTS cho Stakeholders

### 🔴 Top 5 Risks nếu KHÔNG migrate đầy đủ

1. **Discount module mất** → Owner mất công cụ promotion + revenue loss campaigns đang active
2. **Customers separate entity mất** → Marketing không identify VIP, lapsed customers
3. **Brand mất** → Catalog của shop bán nhiều brands sẽ broken (mất filter UX)
4. **Plan tier limits sai** → User Free có 5 stores → silent over-limit hoặc lock-out
5. **SEO redirects không có** → Mất organic traffic + Google ranking drop

### 🟡 Top 5 Compliance / Operations Risks

1. **Tax Invoice PDFs mất** → MY tax compliance 7-year retention VI PHẠM
2. **Team Members migration mất** → Manager/Crew lose access day 1 = ops disruption
3. **Stripe Webhook không rewire** → Payment events drop = double charges hoặc missed payments
4. **Order Returns detail mất** → Finance audit refunds broken
5. **API Tokens / Webhooks mất** → 3rd-party integrations (Zapier, etc.) ngừng

### 🟢 Quick Wins (NEW PW2 features bán cho Owner)

1. **AI Builder** — generate website từ description (sales pitch huge)
2. **AI Editor** — chat-based edit, no design skills needed
3. **Auto-Save Draft + Undo/Redo** — UX vượt trội vs PW1
4. **Block Variant System** — design flexibility cao hơn templates

---

## 6. NEXT STEPS

### Cho PM
- [ ] Share bảng này với stakeholders (Sales, Finance, Compliance, TM SSO team)
- [ ] Resolve 8 critical Q-* (Q-01/05/07/10/15/22/23 + Q-18-21) trong 1 buổi audit
- [ ] Approve scope: 32 features migration + 4 P2 defer + 3 ❓ verify

### Cho Dev Lead
- [ ] Assign 38 sub-PRDs từ master §7 cho devs theo Group A/B/C/D
- [ ] Sequence Phase A (schema) → Phase B (collections) → Phase D (migration ETLs)
- [ ] Build migration framework chung (T-Dev-02)

### Cho DevOps
- [ ] Coordinate TM SSO redirect flip date (T-30d)
- [ ] PW1 DB read access + snapshot strategy
- [ ] Rollback runbook drill

### Cho QA
- [ ] Test plan per sub-PRD
- [ ] E2E migration drill staging (T-14d)
- [ ] Reconciliation queries cho mọi 16 ETL scripts

---

**Hết bảng so sánh — cập nhật khi audit PW1 phát hiện gaps mới**
