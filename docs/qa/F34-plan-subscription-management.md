# Quyết Định Kiểm Thử & Testcase Chi Tiết: F34 - Plan Subscription Management

> **Phiên bản:** 1.2 | **Cập nhật:** 2026-06-12 | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** `docs/prd/F34-plan-subscription-management.md` (v2.4), PR [#1143](https://github.com/primeproduction/ech-prime-web-v2/pull/1143), `plans/260602-1721-sso-plan-subscriptions/`, source code `src/lib/subscriptions/*.ts` + `src/app/api/v1/sso/*/route.ts`
> **Scenarios:** `docs/qa/scenarios/F34-plan-subscription-management.md` (68 scenarios × 12 dimensions) + v1.1 gap analysis (69 scenarios × 8 dimensions)
> **Kỹ thuật:** BDD (Gherkin), BVA, State Transition (canceledImmediately + status + endsAt), Concurrency (atomic staff_limit & upsert race), Security (Bearer + role + IDOR + SQLi + PII strip), Payload CMS DB Assertions, SSO Contract Tests, Migration Idempotency, Error Cascade Tests, Aliases/Backward-compat
> **Tổng TCs:** 208 (TC-F34-01-01 → TC-F34-21-11)
> **Status:** Phase 01–04 ✅ shipped staging · Phase 05 ⚠️ deferred F34.2 · Phase 06 🚧 in progress

### Change Log

| Version | Date | Changes |
|---|---|---|
| **1.2** | 2026-06-12 | Phase 1 scope acceptance. **THÊM Nhóm 21** (12 TCs): seed YES = ALLOW ALL verification (3), mapping đầy đủ 22 guarded routes theo 7 featureCode (6), R9 fork variant A/B + golden smoke test (3). **Tổng TCs**: 196 → 208. |
| **1.1** | 2026-06-12 | Gap analysis vs source code thực tế. **FIX 3 TCs SAI** + 1 TC bổ sung context: TC-F34-02-10 (sort `-createdAt`, không phải `updatedAt`), TC-F34-06-06 (renew KHÔNG reset `canceledImmediately`), TC-F34-07-06 (`canUse(null)` trả **false**, không phải true — default ALLOW chỉ ở route layer), TC-F34-10-01 (sub=null → 403 SUBSCRIPTION_EXPIRED, KHÔNG default ALLOW ở HOF). **CẬP NHẬT BR-07** đúng layer scope. **THÊM 40 TCs** trong Nhóm 20: `dateOnly` (4), `canUseWithinLimit` (8), `getActivePlanSubscription` filter active (4), provision aliases + name parsing (7), security/slug/default dates/invalid code (5), owner-role filter cho upgrade/downgrade/renew (4), `upsertPlanSubscription` CREATE vs UPDATE path (3), partial failure cascades (5). **THÊM 4 risks** R9..R12 vào Risk Assessment. **Tổng TCs**: 134 → 196. |
| 1.0 | 2026-06-12 | Initial draft từ PRD v2.4 — 134 TCs across 19 nhóm. |

---

## 1. Mục Tiêu

Bộ testcase này kiểm thử toàn diện F34 — hệ thống Plan Subscription Management cho PW2, mirror PW1 và đồng bộ từ SSO:

- **US-F34-01:** SSO provision tạo PlanSubscription cùng User + Tenant trong 1 transaction.
- **US-F34-02:** SSO upgrade subscription (plan mới + period mới + reset cancel state).
- **US-F34-03:** SSO renew (chỉ gia hạn endsAt, KHÔNG đổi plan).
- **US-F34-04:** SSO downgrade (giống upgrade, PW2 không validate hierarchy).
- **US-F34-05:** Developer dùng `isSubscriptionActive()`, `getActivePlanSubscription()` để check sub.
- **US-F34-06:** Super admin chỉnh `PlanFeatures` từ Payload mà không cần deploy.
- **US-F34-07:** ⚠️ DEFERRED F34.2 — ETL migrate 1,130 records PW1 → PW2.

**Business Rule cốt lõi:**
- SSO là **source of truth**; PW2 chỉ nhận state, không tự quản (BR-01).
- 7 plan codes: `FREEMIUM` + `STARTER|STANDARD|PROFESSIONAL × TM|NON_TM` (BR-02).
- `getPlanCode('freemium', any) → FREEMIUM`; `('professional', 1) → PROFESSIONAL_TM_USER`; `('professional', 2|null|undefined) → PROFESSIONAL_NON_TM_USER` (BR-03).
- `isSubscriptionActive = endsAt > now && NOT (canceledAt && canceledImmediately) && status ≠ ended/canceled` (BR-04).
- `canUse(planCode, featureCode)`: `YES`/`UNLIMITED`/`null` → true · `0` → false · numeric > 0 → true · numeric ≤ 0 / non-enum → false defensive (BR-05).
- `template_limit` special: `value=0` luôn block; `value=numeric+settings.name[]` → whitelist check; `YES/UNLIMITED/null` → ALLOW (BR-06).
- **Default ALLOW chỉ ở route layer** khi tenant chưa có sub (legacy): storefront guards (`allowing_buyer_*`, `email_confirmation`), template_limit inline. **KHÔNG áp dụng** cho `canUse` thuần (`canUse(null) → false`) hoặc `withFeatureGuard` HOF (sub=null → 403 SUBSCRIPTION_EXPIRED). Layer call-site chịu trách nhiệm fallback (BR-07).
- `Tenants.plan` phải sync `mapPlanCodeToTier()` trong provision/upgrade/downgrade — `ai/generate-site:246` vẫn đọc (BR-08).
- 4 SSO endpoints **bắt buộc** Bearer + role=`super-admin` (BR-09).
- DB migrations: `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING`, **NEVER DROP TABLE** (BR-10).
- `renew` KHÔNG upsert — chỉ update sub `name='main'` đang tồn tại; không tìm thấy → 404 (BR-11).

---

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production / Local |
| Trình duyệt (E2E) | Chrome v120+, Safari iOS |
| Backend | Next.js 15 + Payload CMS 3 + PostgreSQL (Neon test branch) |
| Test runner | Vitest 3 (unit + integration) + Playwright (E2E) |
| Mock | `vi.mock()` top-level cho Payload client; real DB cho integration/migration |
| Auth fixtures | `BEARER_SUPER_ADMIN`, `BEARER_TENANT_USER`, `BEARER_EXPIRED`, `BEARER_NO_ROLE` |
| Tenant fixtures | `tenant-A` (FREEMIUM), `tenant-B` (PROFESSIONAL_TM_USER), `tenant-C` (no sub, legacy), `tenant-D` (sub expired) |
| Plan codes test data | All 7 codes seeded vào `plans` table |
| Feature seed | 140 rows (7 plans × 20 features) all `YES` |
| Timezone | `Asia/Kuala_Lumpur` cho UI; UTC cho DB; `endOfDay` boundary check |
| SLA | `isSubscriptionActive()` O(1); `getActivePlanSubscription()` < 50ms |
| Coverage gate | lines/branches/functions ≥ 70% (project); critical files `plan-subscription.ts` + `feature-guard.ts` ≥ 90% |

---

## 3. Scope Kiểm Thử

### In Scope

- 4 SSO endpoints (`provision`, `upgrade`, `downgrade`, `renew`) — full Bearer + role + payload validation.
- Utility module: `getPlanCode`, `mapPlanCodeToTier`, `isSubscriptionActive`, `getActivePlanSubscription`, `upsertPlanSubscription`, `getFeatureValue`, `getFeatureSettings`, `canUse`.
- Usage tracking: `recordUsage`, `reduceUsage`, `getConsumed`, `clearUsage`, `recountStaffUsage`.
- Enforcement: `session-check` force_logout, `withFeatureGuard` HOF, `template_limit` inline, Payload `Products`/`Categories` access, domain server action, 6 staff Payload endpoints, 3 storefront guards (checkout/track/email_confirmation), `Tenants.plan` sync.
- DB migrations: 6 entries (plans table + seed → plan_subscriptions → plan_subscription_usages → plan_features table + seed) idempotent.
- Concurrency: upgrade/downgrade race, staff_limit atomic increment.
- Security: Bearer 401/403, response không leak PII, SQLi guard.

### Out of Scope (F34)

- ETL `scripts/migrate-pw1-subscriptions.js` — DEFERRED F34.2 (1,130 PW1 records).
- Self-service upgrade từ tenant user (SSO lo).
- Auto-renew / billing automation (SSO trigger, PW2 chỉ nhận PUT /renew).
- Subscription history / audit log dedicated.
- Frontend UI feature-gating (hiding components in dashboard) — chỉ enforce ở API.
- Stripe `Subscriptions` collection (payment buyer storefront — không liên quan).

---

## 4. Quản Lý Truy Vết (Traceability Matrix)

| Khu vực Nghiệp Vụ | User Story | FR Reference | AC Reference | Tổng TCs |
|:---|:---|:---|:---|:---:|
| **1. Utility — getPlanCode & mapPlanCodeToTier** | US-F34-05 | FR-08, FR-25 | — | 9 |
| **2. Utility — isSubscriptionActive & getActivePlanSubscription** | US-F34-05 | FR-09 | AC-18..21 | 10 |
| **3. SSO Provision** | US-F34-01 | FR-05, FR-10 | AC-01..07 | 14 |
| **4. SSO Upgrade** | US-F34-02 | FR-06, FR-10 | AC-08..11 | 10 |
| **5. SSO Downgrade** | US-F34-04 | FR-07, FR-10 | AC-16..17 | 6 |
| **6. SSO Renew** | US-F34-03 | FR-14 | AC-12..15 | 9 |
| **7. PlanFeatures + canUse + getFeatureSettings** | US-F34-06 | FR-11, FR-15 | AC-22..25 | 12 |
| **8. Usage Tracking** | US-F34-06 | FR-17, FR-23 | — | 8 |
| **9. Enforcement — session-check** | US-F34-05 | FR-18 | — | 5 |
| **10. Enforcement — withFeatureGuard HOF** | US-F34-06 | FR-19 | — | 11 |
| **11. Enforcement — template_limit inline** | US-F34-06 | FR-19b, FR-15 | — | 7 |
| **12. Enforcement — Payload access + Domain action** | US-F34-06 | FR-20, FR-21 | — | 6 |
| **13. Staff Endpoints — invite/remove/bulk** | US-F34-06 | FR-22, FR-23 | AC-23 | 9 |
| **14. Storefront Guards (public, no auth)** | US-F34-06 | FR-24 | — | 8 |
| **15. Tenants.plan Sync** | US-F34-01..04 | FR-25 | — | 5 |
| **16. DB Migrations & Seed** | — | FR-01..FR-04 | — | 7 |
| **17. Concurrency & Data Integrity** | — | NFR-Reliability | — | 6 |
| **18. Security & Authorization** | — | FR-13, NFR-Security | AC-06, AC-07 | 8 |
| **19. E2E Golden Path** | US-F34-01..06 | All | — | 6 |
| **20. Supplementary v1.1 — Implementation Reality Gaps** | All | FR-05..25 | — | 40 |
| **21. Phase 1 Soft Launch Acceptance** | US-F34-01..06 | FR-03, FR-19, R9 | — | 12 |
| **Tổng cộng** | | | | **208** |

> AC-26..31 (ETL) deferred F34.2 — không có TC trong F34. FR-12 deferred.

---

## 5. CHI TIẾT TEST CASES

---

### NHÓM 01 — Utility: `getPlanCode` & `mapPlanCodeToTier` (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-01-01** | `FR-08`, `BR-03` | `Logic` `[Positive]` | `getPlanCode('freemium', any)` → `FREEMIUM` | 1. Import `getPlanCode` từ `src/lib/subscriptions/plan-subscription.ts`.<br>2. Gọi với `('freemium', 1)`, `('freemium', 2)`, `('freemium', null)`, `('freemium', undefined)`. | **THEN** cả 4 trường hợp đều trả `'FREEMIUM'` — bỏ qua `subscription_type`. | Blocker | [x] |
| **TC-F34-01-02** | `FR-08`, `AC-02` | `Logic` `[Positive]` | `getPlanCode(*, 1)` → `*_TM_USER` | 1. Gọi `getPlanCode('professional', 1)`.<br>2. Gọi `getPlanCode('standard', 1)`.<br>3. Gọi `getPlanCode('starter', 1)`. | - Trả `PROFESSIONAL_TM_USER`, `STANDARD_TM_USER`, `STARTER_TM_USER`. | Blocker | [x] |
| **TC-F34-01-03** | `FR-08`, `AC-03` | `Logic` `[Positive]` | `getPlanCode(*, 2)` → `*_NON_TM_USER` | 1. Gọi `getPlanCode('professional', 2)`.<br>2. Gọi `('standard', 2)`.<br>3. Gọi `('starter', 2)`. | - Trả `PROFESSIONAL_NON_TM_USER`, `STANDARD_NON_TM_USER`, `STARTER_NON_TM_USER`. | Blocker | [x] |
| **TC-F34-01-04** | `FR-08` | `Logic` `[Edge]` | Type null/undefined default → NON_TM | 1. Gọi `getPlanCode('professional', null)`.<br>2. Gọi `('professional', undefined)`. | - Cả 2 trả `PROFESSIONAL_NON_TM_USER` (default sang non-TM theo PRD §8). | High | [x] |
| **TC-F34-01-05** | `FR-08` | `Logic` `[Edge]` | Code uppercase/whitespace normalize | 1. Gọi `getPlanCode('PROFESSIONAL', 1)`.<br>2. Gọi `getPlanCode(' professional ', 1)` (có spaces). | - Normalize lowercase + trim → trả `PROFESSIONAL_TM_USER`.<br>- Document hành vi nếu impl không normalize (assert deterministic). | High | [x] |
| **TC-F34-01-06** | `FR-08` | `Logic` `[Negative]` | Code không hợp lệ → throw hoặc fallback | 1. Gọi `getPlanCode('enterprise', 1)`.<br>2. Gọi `('', 1)`.<br>3. Gọi `(null as any, 1)`. | **WHEN** code không thuộc 4 giá trị hợp lệ<br>**THEN** throw `Error('Invalid subscription_code')` HOẶC trả `FREEMIUM` fallback + log warn (assert per impl). | Blocker | [x] |
| **TC-F34-01-07** | `FR-25`, `BR-08` | `Logic` `[Positive]` | `mapPlanCodeToTier` cho 7 plan codes | 1. Import `mapPlanCodeToTier`.<br>2. Gọi với từng plan code trong 7 codes. | - `FREEMIUM → 'free'`<br>- `STARTER_TM_USER`, `STARTER_NON_TM_USER → 'starter'`<br>- `STANDARD_TM_USER`, `STANDARD_NON_TM_USER → 'pro'`<br>- `PROFESSIONAL_TM_USER`, `PROFESSIONAL_NON_TM_USER → 'business'` | Blocker | [x] |
| **TC-F34-01-08** | `FR-25` | `Logic` `[Edge]` | `mapPlanCodeToTier(undefined)` | 1. Gọi `mapPlanCodeToTier(undefined as any)`.<br>2. Gọi với `null`. | - Default `'free'` HOẶC throw — assert deterministic. | Medium | [x] |
| **TC-F34-01-09** | `FR-25` | `Logic` `[Negative]` | `mapPlanCodeToTier` với string không hợp lệ | 1. Gọi `mapPlanCodeToTier('UNKNOWN_PLAN' as any)`. | - Throw HOẶC trả `'free'` fallback (assert per impl). | Medium | [x] |

---

### NHÓM 02 — Utility: `isSubscriptionActive` & `getActivePlanSubscription` (10 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-02-01** | `FR-09`, `AC-18`, `BR-04` | `Logic` `[Positive]` | Active khi endsAt tương lai + không cancel + status=active | 1. Set `now = 2026-06-12`.<br>2. Gọi `isSubscriptionActive({ endsAt: '2026-07-01', canceledAt: null, status: 'active' })`. | **THEN** trả `true`. | Blocker | [x] |
| **TC-F34-02-02** | `FR-09`, `AC-19`, `BR-04` | `Logic` `[Negative]` | endsAt quá khứ → inactive | 1. Set `now = 2026-06-12`.<br>2. Gọi với `endsAt='2026-06-01', status='active'`. | **THEN** trả `false`. | Blocker | [x] |
| **TC-F34-02-03** | `FR-09`, `AC-20a`, `BR-04`, `FR-16` | `Logic` `[Negative]` | canceledImmediately=true → inactive bất kể endsAt | 1. `canceledAt='2026-06-10', canceledImmediately=true, endsAt='2026-07-01', status='active'`.<br>2. Gọi isSubscriptionActive. | **WHEN** cancel ngay (immediate)<br>**THEN** trả `false` dù endsAt còn xa. | Blocker | [x] |
| **TC-F34-02-04** | `FR-09`, `AC-20b`, `BR-04`, `FR-16` | `Logic` `[Positive]` | canceledImmediately=false + endsAt tương lai → vẫn active | 1. `canceledAt='2026-06-10', canceledImmediately=false, endsAt='2026-07-01', status='active'`.<br>2. Gọi isSubscriptionActive. | **WHEN** cancel cuối kỳ<br>**THEN** trả `true` (vẫn còn hạn dùng hết kỳ). | Blocker | [x] |
| **TC-F34-02-05** | `FR-09`, `AC-21` | `Logic` `[Negative]` | status=ended → inactive | 1. `status='ended', endsAt='2027-01-01'`. | **THEN** trả `false` — status override endsAt. | Blocker | [x] |
| **TC-F34-02-06** | `FR-09` | `Logic` `[Negative]` | status=canceled → inactive | 1. `status='canceled', endsAt='2027-01-01'`. | **THEN** trả `false`. | High | [x] |
| **TC-F34-02-07** | `FR-09` | `Logic` `[Bound]` | endsAt = now (boundary) | 1. `endsAt = now exact`, status=active. | **THEN** trả `false` (strict `>` boundary — PRD §6 FR-09). | Medium | [x] |
| **TC-F34-02-08** | `FR-09` | `Logic` `[Edge]` | canceledImmediately=null/undefined không coi là immediate | 1. `canceledAt='2026-06-10', canceledImmediately=null, endsAt='2026-07-01'`. | **THEN** trả `true` nếu endsAt > now (null không trigger immediate). | High | [x] |
| **TC-F34-02-09** | `FR-09`, `NFR-Reliability` | `API` `[Positive]` | `getActivePlanSubscription` tìm sub 'main' theo tenantId | 1. Seed tenant-B có sub 'main' active.<br>2. Gọi `getActivePlanSubscription(payload, 'tenant-B-id')`.<br>3. Đo latency. | - Trả record sub 'main'.<br>- Latency < 50ms (indexed query trên `tenant_id + name`).<br>- Nếu không có → `null`. | Blocker | [x] |
| **TC-F34-02-10** | `FR-09` | `API` `[Edge]` | Tenant có nhiều sub `name='main'` (dirty data) → deterministic theo `-createdAt` | 1. Seed 2 rows `name='main'` cho 1 tenant (createdAt khác nhau).<br>2. Gọi `getActivePlanSubscription`. | **THEN** trả record mới nhất theo `-createdAt DESC` (per impl `src/lib/subscriptions/plan-subscription.ts:60`).<br>- KHÔNG dùng `updatedAt`.<br>- Log warning về dirty data. | High | [x] |

---

### NHÓM 03 — SSO Provision (14 TCs) — `POST /api/v1/sso/provision`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-03-01** | `FR-05`, `AC-01` | `API` `[Positive]` | Provision thành công tạo User + Tenant + PlanSubscription | 1. Bearer super-admin.<br>2. POST `/api/v1/sso/provision` với full payload: `{name, email='owner@acme.test', password, company_name, subscription_code='professional', subscription_type=1, start_date='2026-06-01', end_date='2027-06-01'}`.<br>3. Query DB. | **GIVEN** valid Bearer + full payload<br>**WHEN** POST provision<br>**THEN** HTTP 201; DB có 1 User + 1 Tenant + 1 PlanSubscription (name='main', plan='PROFESSIONAL_TM_USER'); response body có `planSubscription.id` + `plan`. | Blocker | [x] |
| **TC-F34-03-02** | `FR-05`, `AC-02` | `API` `[Positive]` | TM mapping: `professional + 1` → `PROFESSIONAL_TM_USER` | 1. Provision với `subscription_code='professional', subscription_type=1`. | - DB record `plan = 'PROFESSIONAL_TM_USER'`. | Blocker | [x] |
| **TC-F34-03-03** | `FR-05`, `AC-03` | `API` `[Positive]` | NON-TM mapping: `professional + 2` → `PROFESSIONAL_NON_TM_USER` | 1. Provision với `subscription_code='professional', subscription_type=2`. | - DB record `plan = 'PROFESSIONAL_NON_TM_USER'`. | Blocker | [x] |
| **TC-F34-03-04** | `FR-05`, `AC-04`, `BR-03` | `API` `[Positive]` | FREEMIUM bỏ qua subscription_type | 1. Provision với `subscription_code='freemium', subscription_type=1`.<br>2. Lặp với type=2. | - Cả 2 trường hợp `plan = 'FREEMIUM'`. | Blocker | [x] |
| **TC-F34-03-05** | `FR-05`, `AC-05` | `API` `[Positive]` | Date normalize: startsAt T00:00:00, endsAt endOfDay | 1. Provision `start_date='2026-06-01', end_date='2027-06-01'`.<br>2. Query DB. | - `startsAt = 2026-06-01T00:00:00Z` (00:00 UTC).<br>- `endsAt = 2027-06-01T23:59:59Z` (endOfDay UTC). | Blocker | [x] |
| **TC-F34-03-06** | `FR-05`, `AC-06`, `BR-09` | `Sec` `[Negative]` | Thiếu Authorization header → 401 | 1. POST không Authorization header. | - HTTP 401 `Invalid token`.<br>- Không tạo bất kỳ record nào trong DB. | Blocker | [x] |
| **TC-F34-03-07** | `FR-05`, `AC-07`, `BR-09` | `Sec` `[Negative]` | Bearer non-super-admin → 403 | 1. Bearer của role `tenant-user`.<br>2. POST provision. | - HTTP 403 Forbidden.<br>- Không tạo record. | Blocker | [x] |
| **TC-F34-03-08** | `FR-05` | `Sec` `[Negative]` | Bearer hết hạn → 401 | 1. Bearer expired.<br>2. POST. | - HTTP 401.<br>- Response không leak chi tiết token. | Khẩn | [x] |
| **TC-F34-03-09** | `FR-05` | `API` `[Negative]` | Email đã tồn tại → idempotent hoặc 409 | 1. Provision lần 1 thành công email `owner@acme.test`.<br>2. Provision lần 2 cùng email. | **WHEN** retry<br>**THEN** HTTP 409 Conflict HOẶC trả existing user (assert deterministic per impl); KHÔNG duplicate User/Tenant/PlanSubscription. | Khẩn | [x] |
| **TC-F34-03-10** | `FR-05` | `Valid` `[Negative]` | Thiếu `subscription_code` → 400 | 1. POST thiếu field `subscription_code`.<br>2. Lặp với các required field khác. | - HTTP 400 với field error rõ ràng.<br>- Không tạo record. | High | [x] |
| **TC-F34-03-11** | `FR-05` | `Valid` `[Negative]` | `end_date < start_date` → reject | 1. `start_date='2027-06-01', end_date='2026-06-01'`. | - HTTP 400 `Invalid period: end_date must be after start_date`.<br>- Không tạo record. | High | [x] |
| **TC-F34-03-12** | `FR-05`, `R3` | `API` `[Edge]` | Thiếu `subscription_type` → default sang NON_TM | 1. Provision `subscription_code='professional'` không kèm `subscription_type`. | - Trả `PROFESSIONAL_NON_TM_USER` (default type=2 per PRD §8 FR-08). | Medium | [x] |
| **TC-F34-03-13** | `FR-25`, `BR-08` | `DB` `[Positive]` | Sync `Tenants.plan` sau provision | 1. Provision `professional + 1`.<br>2. Query `tenants` table. | - `tenants.plan = 'business'` (qua `mapPlanCodeToTier`).<br>- Field này được `ai/generate-site:246` dùng. | Khẩn | [x] |
| **TC-F34-03-14** | `FR-05`, `R8` | `Sec` `[Negative]` | Response KHÔNG leak password / token | 1. Provision thành công.<br>2. Inspect response body. | - Response body KHÔNG chứa `password`, Bearer token, hoặc bất kỳ secret nào.<br>- Chỉ trả `id`, `email`, `tenant`, `planSubscription`. | Khẩn | [x] |

---

### NHÓM 04 — SSO Upgrade (10 TCs) — `PUT /api/v1/sso/upgrade`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-04-01** | `FR-06`, `AC-08` | `API` `[Positive]` | Upgrade FREEMIUM → PROFESSIONAL_TM thành công | 1. Bearer super-admin.<br>2. Pre: tenant-A có sub FREEMIUM.<br>3. PUT `/api/v1/sso/upgrade` với `{email='ownerA@test', subscription_code='professional', subscription_type=1, start_date='2026-06-12', end_date='2027-06-12'}`. | **THEN** HTTP 200; DB sub: `plan='PROFESSIONAL_TM_USER'`, `startsAt/endsAt` mới, `canceledAt=null`, `canceledImmediately=false`, `status='active'`. | Blocker | [x] |
| **TC-F34-04-02** | `FR-06`, `AC-09` | `API` `[Negative]` | Email không tồn tại → 404 | 1. PUT upgrade với `email='ghost@notexist.test'`. | - HTTP 404 `User not found`.<br>- Không update bất kỳ record nào. | Blocker | [x] |
| **TC-F34-04-03** | `FR-06`, `AC-10` | `API` `[Positive]` | Tenant chưa có PlanSubscription → upsert tạo mới | 1. Pre: tenant-X có User nhưng KHÔNG có sub.<br>2. PUT upgrade. | - HTTP 200.<br>- DB tạo mới sub `name='main'`. | Khẩn | [x] |
| **TC-F34-04-04** | `FR-06`, `AC-11` | `API` `[Positive]` | `packCode` lưu UPPERCASE từ `subscription_code` | 1. PUT upgrade `subscription_code='professional'`. | - DB `packCode = 'PROFESSIONAL'`. | High | [x] |
| **TC-F34-04-05** | `FR-06`, `FR-16` | `API` `[Positive]` | Upgrade reset cancel state | 1. Pre: sub đang `canceledAt='2026-06-10', canceledImmediately=true`.<br>2. PUT upgrade. | - Sau upgrade: `canceledAt=null, canceledImmediately=false, status='active'`. | Khẩn | [x] |
| **TC-F34-04-06** | `FR-25`, `BR-08` | `DB` `[Positive]` | Sync `Tenants.plan` sau upgrade | 1. tenant FREEMIUM (`tier='free'`) upgrade → PROFESSIONAL_TM.<br>2. Query `tenants`. | - `tenants.plan = 'business'`. | Khẩn | [x] |
| **TC-F34-04-07** | `FR-06`, `BR-09` | `Sec` `[Negative]` | Bearer non-super-admin → 403 | 1. Bearer của tenant-user.<br>2. PUT upgrade. | - HTTP 403.<br>- Không update DB. | Blocker | [x] |
| **TC-F34-04-08** | `FR-06`, `R8` | `Logic` `[Positive]` | Audit log có tenant email khi upgrade | 1. Capture console.log.<br>2. PUT upgrade thành công. | - Console output chứa tenant email + plan mới (audit trail).<br>- Log line emitted ngay cả khi success. | High | [x] |
| **TC-F34-04-09** | `FR-06` | `Valid` `[Negative]` | Thiếu fields required → 400 | 1. PUT upgrade thiếu `subscription_code`. | - HTTP 400 với field error. | High | [x] |
| **TC-F34-04-10** | `FR-06`, `FR-08` | `Logic` `[Positive]` | TM/NON_TM mapping đúng theo `subscription_type` | 1. Upgrade với `subscription_code='standard', subscription_type=1`.<br>2. Lặp `subscription_type=2`. | - Lần 1: `plan='STANDARD_TM_USER'`.<br>- Lần 2: `plan='STANDARD_NON_TM_USER'`. | High | [x] |

---

### NHÓM 05 — SSO Downgrade (6 TCs) — `PUT /api/v1/sso/downgrade`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-05-01** | `FR-07`, `AC-16` | `API` `[Positive]` | Downgrade PROFESSIONAL → STARTER thành công | 1. Pre: tenant-B đang PROFESSIONAL_TM.<br>2. PUT `/api/v1/sso/downgrade` với `subscription_code='starter', subscription_type=1, start_date, end_date`. | - HTTP 200; DB `plan='STARTER_TM_USER'`, period mới, `status='active', canceledAt=null`. | Blocker | [x] |
| **TC-F34-05-02** | `FR-07`, `AC-17` | `API` `[Positive]` | PW2 KHÔNG validate hierarchy — downgrade ngược lên cũng accept | 1. Pre: tenant-A FREEMIUM.<br>2. Gọi endpoint downgrade với code `professional + 1`. | - HTTP 200 — endpoint không reject vì semantic SSO lo.<br>- DB plan = `PROFESSIONAL_TM_USER`. | Khẩn | [x] |
| **TC-F34-05-03** | `FR-07`, `FR-17`, `FR-23` | `API` `[Positive]` | `clearUsage()` + `recountStaffUsage()` sau downgrade | 1. Pre: sub có `staff_limit usage=5`, actual staff trong DB = 3.<br>2. PUT downgrade.<br>3. Query usage table. | - `clearUsage()` chạy: reset toàn bộ usage.<br>- `recountStaffUsage()` chạy: `staff_limit usage = 3` (sync với truth thực tế). | Khẩn | [x] |
| **TC-F34-05-04** | `FR-25`, `BR-08` | `DB` `[Positive]` | Sync `Tenants.plan` sau downgrade | 1. tenant business (PROFESSIONAL) downgrade → STARTER_TM. | - `tenants.plan = 'starter'`. | High | [x] |
| **TC-F34-05-05** | `FR-07`, `BR-09` | `Sec` `[Negative]` | Bearer non-super-admin → 403 | 1. Bearer tenant-user.<br>2. PUT downgrade. | - HTTP 403. | Blocker | [x] |
| **TC-F34-05-06** | `FR-07` | `API` `[Negative]` | Email không tồn tại → 404 | 1. PUT downgrade email ghost. | - HTTP 404. | High | [x] |

---

### NHÓM 06 — SSO Renew (9 TCs) — `PUT /api/v1/sso/renew`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-06-01** | `FR-14`, `AC-12`, `BR-11` | `API` `[Positive]` | Renew chỉ update endsAt, KHÔNG đổi plan | 1. Pre: tenant-B đang `plan='PROFESSIONAL_TM_USER', endsAt='2026-08-01'`.<br>2. PUT `/api/v1/sso/renew` với `{email, expired_at='2027-06-01'}`. | **THEN** HTTP 200; DB sub: `endsAt='2027-06-01T23:59:59Z'`, `canceledAt=null`, `status='active'`. **plan KHÔNG đổi** (giữ nguyên PROFESSIONAL_TM_USER). | Blocker | [x] |
| **TC-F34-06-02** | `FR-14`, `AC-13` | `API` `[Negative]` | Email không tồn tại → 404 | 1. PUT renew email ghost. | - HTTP 404. | Blocker | [x] |
| **TC-F34-06-03** | `FR-14`, `AC-14`, `BR-11` | `API` `[Negative]` | Tenant chưa có sub 'main' → 404 (KHÔNG upsert) | 1. Pre: tenant-X có User nhưng KHÔNG có PlanSubscription.<br>2. PUT renew. | **THEN** HTTP 404 — renew **KHÔNG** create mới (khác hẳn upgrade/downgrade). | Khẩn | [x] |
| **TC-F34-06-04** | `FR-14`, `AC-15` | `API` `[Positive]` | endOfDay normalize cho expired_at | 1. PUT renew `expired_at='2027-06-01'`. | - DB `endsAt = '2027-06-01T23:59:59Z'` (endOfDay UTC). | Blocker | [x] |
| **TC-F34-06-05** | `FR-14`, `BR-04` | `API` `[Positive]` | Renew sub `status='ended'` → active trở lại | 1. Pre: sub `status='ended', endsAt quá khứ`.<br>2. PUT renew với expired_at tương lai. | - `endsAt` mới, `status='active'`, `canceledAt=null`.<br>- `plan` giữ nguyên. | Khẩn | [x] |
| **TC-F34-06-06** | `FR-14` | `API` `[Positive]` | Renew CHỈ reset `canceledAt + status`, KHÔNG đụng `canceledImmediately` | 1. Pre: sub `canceledAt='2026-06-10', canceledImmediately=false, status='active'`.<br>2. PUT renew với expired_at tương lai.<br>3. Query DB. | **THEN** `canceledAt=null, status='active'`. `canceledImmediately` GIỮ NGUYÊN giá trị cũ (per impl `src/app/api/v1/sso/renew/route.ts:78` — chỉ set 3 field: endsAt, canceledAt, status). | Khẩn | [x] |
| **TC-F34-06-07** | `FR-14` | `Valid` `[Negative]` | `expired_at='not-a-date'` → 400 | 1. PUT renew với `expired_at='not-a-date'`. | - HTTP 400 `Invalid expired_at format`.<br>- Không write DB. | High | [x] |
| **TC-F34-06-08** | `FR-14` | `API` `[Positive]` | `packCode` giữ nguyên sau renew | 1. Pre: sub có `packCode='PROFESSIONAL'`.<br>2. PUT renew. | - `packCode` không đổi. | High | [x] |
| **TC-F34-06-09** | `FR-14`, `BR-09` | `Sec` `[Negative]` | Bearer non-super-admin → 403 | 1. Bearer tenant-user.<br>2. PUT renew. | - HTTP 403.<br>- Không update DB. | Khẩn | [x] |

---

### NHÓM 07 — PlanFeatures + `canUse` + `getFeatureSettings` (12 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-07-01** | `FR-03`, `AC-22` | `DB` `[Positive]` | Seed 140 rows PlanFeatures sau migration | 1. Fresh DB → chạy `db-setup.js`.<br>2. Query `plan-features` collection. | - Count = 140 (7 plans × 20 features).<br>- Tất cả `value='YES'`. | Blocker | [x] |
| **TC-F34-07-02** | `FR-11`, `AC-24`, `BR-05` | `Logic` `[Positive]` | `canUse` với `value='YES'` → true | 1. Set feature `FREEMIUM.website_builder.value='YES'`.<br>2. Gọi `canUse(payload, 'FREEMIUM', 'website_builder')`. | - Trả `true`. | Blocker | [x] |
| **TC-F34-07-03** | `FR-11`, `AC-24`, `BR-05` | `Logic` `[Positive]` | `canUse` với `value='UNLIMITED'` → true | 1. Set `value='UNLIMITED'`.<br>2. canUse. | - Trả `true`. | Blocker | [x] |
| **TC-F34-07-04** | `FR-11`, `AC-23`, `BR-05` | `Logic` `[Negative]` | `canUse` với `value='0'` → false | 1. Set `FREEMIUM.staff_limit.value='0'`.<br>2. canUse. | - Trả `false`. | Blocker | [x] |
| **TC-F34-07-05** | `FR-11`, `AC-25`, `BR-05` | `Logic` `[Positive]` | `canUse` với `value='3'` (numeric > 0) → true | 1. Set `value='3'`.<br>2. canUse. | - Trả `true`.<br>- Caller phải tự check `consumed < numeric` riêng. | Blocker | [x] |
| **TC-F34-07-06** | `FR-11`, `BR-05` | `Logic` `[Negative]` | `canUse` với row không tồn tại (deleted) → **FALSE** | 1. Xóa row `FREEMIUM.website_builder`.<br>2. canUse. | **THEN** trả `false` (impl `src/lib/subscriptions/plan-subscription.ts:283` — `if (value === null) return false`).<br>- **Default ALLOW chỉ áp dụng ở route layer** (storefront guards, template_limit inline) — KHÔNG ở `canUse` thuần.<br>- Tested bởi TC-SUB-034 hiện tại đã pass. | Khẩn | [x] |
| **TC-F34-07-07** | `FR-11`, `BR-05` | `Logic` `[Negative]` | `canUse` với value âm/non-numeric không match enum → false | 1. Set `value='-1'`.<br>2. Set `value='abc'`.<br>3. canUse cho cả 2. | - Cả 2 trả `false` (defensive — assert per impl). | High | [x] |
| **TC-F34-07-08** | `FR-15` | `Logic` `[Positive]` | `getFeatureSettings` trả JSON whitelist | 1. Set `FREEMIUM.template_limit.settings={name:['modern','luxury']}`.<br>2. Gọi `getFeatureSettings`. | - Trả `{name:['modern','luxury']}`. | High | [x] |
| **TC-F34-07-09** | `FR-15` | `Logic` `[Edge]` | `getFeatureSettings` với settings=null | 1. Settings = null.<br>2. Gọi getFeatureSettings. | - Trả `null` (không throw). | High | [x] |
| **TC-F34-07-10** | `FR-15`, `R6` | `Logic` `[Edge]` | settings JSON malformed → safe parse | 1. Inject row có settings là string không phải JSON (legacy data corrupted).<br>2. Gọi getFeatureSettings. | - Parse safe → trả `null` + log warning.<br>- Không crash. | Medium | [x] |
| **TC-F34-07-11** | `FR-11`, `NFR-Performance` | `Logic` `[Positive]` | UNIQUE `(planCode, featureCode)` enforced | 1. Insert duplicate `(FREEMIUM, website_builder)` thủ công. | - DB throw UNIQUE constraint violation. | Khẩn | [x] |
| **TC-F34-07-12** | `FR-11` | `API` `[Positive]` | Super-admin sửa value từ Payload dashboard | 1. Login Payload admin.<br>2. Mở `plan-features`, set `FREEMIUM.product_management.value='0'`.<br>3. Reload tenant FREEMIUM dashboard → tạo Product. | - Save thành công, không cần deploy.<br>- TC-F34-12-01 (Payload access) immediately reflects (cache invalidation). | High | [x] |

---

### NHÓM 08 — Usage Tracking (8 TCs) — `recordUsage`/`reduceUsage`/`getConsumed`/`clearUsage`/`recountStaffUsage`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-08-01** | `FR-17` | `Logic` `[Positive]` | `recordUsage` lần đầu → used=1 | 1. Pre: sub không có usage row.<br>2. Gọi `recordUsage(subId, 'staff_limit', 1)`.<br>3. Gọi `getConsumed`. | - DB tạo row mới `(subId, 'staff_limit', used=1)`.<br>- getConsumed trả 1. | Khẩn | [x] |
| **TC-F34-08-02** | `FR-17` | `Logic` `[Positive]` | `recordUsage` cộng dồn | 1. Gọi recordUsage 3 lần (mỗi lần +1).<br>2. getConsumed. | - DB used = 3 (cộng dồn, không tạo row mới mỗi lần). | Khẩn | [x] |
| **TC-F34-08-03** | `FR-17` | `Logic` `[Positive]` | `reduceUsage` giảm đúng | 1. recordUsage 3 lần.<br>2. reduceUsage(1).<br>3. getConsumed. | - DB used = 2. | High | [x] |
| **TC-F34-08-04** | `FR-17` | `Logic` `[Bound]` | `reduceUsage` clamp ≥ 0 | 1. recordUsage 1 lần.<br>2. reduceUsage(5) — vượt quá. | - DB used = 0 (clamp, không âm). | High | [x] |
| **TC-F34-08-05** | `FR-17`, `FR-23` | `Logic` `[Positive]` | `clearUsage` reset toàn bộ feature của sub | 1. recordUsage cho nhiều feature.<br>2. clearUsage(subId).<br>3. getConsumed mỗi feature. | - Mọi feature `used=0` (hoặc row bị xóa). | Khẩn | [x] |
| **TC-F34-08-06** | `FR-23` | `API` `[Positive]` | `recountStaffUsage` sync với actual staff count | 1. Pre: DB có 5 staff active, usage table `staff_limit used=3` (lệch).<br>2. Gọi `recountStaffUsage(payload, subId, tenantId)`.<br>3. getConsumed. | - DB `used = 5` sau khi gọi. | Khẩn | [x] |
| **TC-F34-08-07** | `FR-23` | `API` `[Edge]` | `recountStaffUsage` khi DB có 0 staff | 1. Pre: không có staff active.<br>2. recountStaffUsage. | - `used = 0`. | Medium | [x] |
| **TC-F34-08-08** | `FR-17`, `R4` | `API` `[Edge]` | Sau `clearUsage`, recordUsage tiếp theo bắt đầu từ 0 | 1. recordUsage 3 lần.<br>2. clearUsage.<br>3. recordUsage 1 lần.<br>4. getConsumed. | - used = 1 (clear xóa sạch, không cộng dồn từ trạng thái cũ). | High | [x] |

---

### NHÓM 09 — Enforcement: `session-check` Force Logout (5 TCs) — `GET /api/auth/session-check`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-09-01** | `FR-18` | `API` `[Negative]` | Sub expired → `force_logout` | 1. Pre: tenant-D có sub `endsAt='2026-06-01' < now`.<br>2. GET `/api/auth/session-check`. | **THEN** Response body chứa `{action: 'force_logout', reason: 'subscription_expired'}`. | Blocker | [x] |
| **TC-F34-09-02** | `FR-18` | `API` `[Positive]` | Sub active → normal session | 1. Pre: tenant-B sub active.<br>2. GET session-check. | - Response normal (không force_logout).<br>- User tiếp tục dùng. | Blocker | [x] |
| **TC-F34-09-03** | `FR-18`, `BR-07` | `API` `[Positive]` | Sub=null (legacy tenant) → normal (default ALLOW) | 1. Pre: tenant-C không có PlanSubscription.<br>2. GET session-check. | - Response normal.<br>- KHÔNG force_logout. | Khẩn | [x] |
| **TC-F34-09-04** | `FR-18`, `R7` | `API` `[Edge]` | Vừa renew xong → không force_logout nhầm | 1. Pre: sub đang expired.<br>2. PUT renew thành công với expired_at tương lai.<br>3. GET session-check ngay sau (< 100ms). | - Đọc state mới từ DB.<br>- Response normal (KHÔNG force_logout). | High | [x] |
| **TC-F34-09-05** | `FR-18`, `FR-09`, `FR-16` | `API` `[Positive]` | Sub canceledImmediately=true → force_logout | 1. Pre: sub `canceledAt set, canceledImmediately=true, endsAt tương lai`.<br>2. GET session-check. | - `force_logout` vì `isSubscriptionActive=false` (cancel ngay). | Khẩn | [x] |

---

### NHÓM 10 — Enforcement: `withFeatureGuard` HOF (11 TCs) — Dashboard routes

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-10-01** | `FR-19`, `R3` | `API` `[Negative]` | Sub=null → 403 `SUBSCRIPTION_EXPIRED` (KHÔNG default ALLOW) | 1. Pre: tenant-C không có sub.<br>2. Gọi dashboard route wrap `withFeatureGuard('website_builder')`. | **THEN** HTTP 403 với body `{error: {code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found'}}` (per impl `src/lib/subscriptions/feature-guard.ts:49-53`).<br>- **Legacy tenants KHÔNG được default ALLOW ở HOF** — đây là Critical breaking change cần verify trên staging trước.<br>- Default ALLOW chỉ áp dụng ở storefront guards + template_limit. | Blocker | [x] |
| **TC-F34-10-02** | `FR-19` | `API` `[Negative]` | Sub active + `feature.value='0'` → 403 | 1. Pre: tenant FREEMIUM, `website_builder.value='0'`.<br>2. Gọi route. | - HTTP 403 Feature disabled. | Blocker | [x] |
| **TC-F34-10-03** | `FR-19`, `FR-09` | `API` `[Negative]` | Sub expired → 403 | 1. Pre: sub `endsAt < now`.<br>2. Gọi guarded route. | - HTTP 403 (sub không active → guard fail). | Blocker | [x] |
| **TC-F34-10-04** | `FR-19` | `API` `[Positive]` | Sub active + `feature.value='YES'` → 200 | 1. Pre: sub active, value=YES.<br>2. Gọi route. | - HTTP 200; handler chạy bình thường. | Blocker | [x] |
| **TC-F34-10-05** | `FR-19` | `API` `[Positive]` | `website_builder` guard hoạt động | 1. Test enforce trên route handler website_builder. | - Block khi value=0; cho qua khi YES. | High | [x] |
| **TC-F34-10-06** | `FR-19` | `API` `[Positive]` | `sitemap_robot_configuration` guard | 1. Test enforce trên route sitemap robot. | - Block/allow đúng. | High | [x] |
| **TC-F34-10-07** | `FR-19` | `API` `[Positive]` | `content_management` guard | 1. Test enforce trên content_management dashboard route. | - Block/allow đúng. | High | [x] |
| **TC-F34-10-08** | `FR-19` | `API` `[Positive]` | `order_management` guard | 1. Test enforce trên order_management. | - Block/allow đúng. | High | [x] |
| **TC-F34-10-09** | `FR-19` | `API` `[Positive]` | `payment_integration` guard | 1. Test enforce trên payment_integration settings route. | - Block/allow đúng. | High | [x] |
| **TC-F34-10-10** | `FR-19` | `API` `[Positive]` | `email_template_configuration` guard | 1. Test enforce trên email templates route. | - Block/allow đúng. | High | [x] |
| **TC-F34-10-11** | `FR-19` | `API` `[Positive]` | `delivery_provider_limit`/`shipping_fee_configuration` guard | 1. Test enforce trên shipping config route. | - Block/allow đúng. | High | [x] |

---

### NHÓM 11 — Enforcement: `template_limit` Inline Guard (7 TCs) — `POST /api/ai/apply-template`

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-11-01** | `FR-19b`, `BR-06`, `R6` | `API` `[Negative]` | `value='0'` → 403 luôn block | 1. Pre: tenant FREEMIUM, `template_limit.value='0'`.<br>2. POST `/api/ai/apply-template`. | - HTTP 403 — Feature off.<br>- Guard inject **sau** tenant-resolution (lines ~94–132). | Blocker | [x] |
| **TC-F34-11-02** | `FR-19b`, `FR-15`, `R6` | `API` `[Positive]` | `value=numeric + whitelist match` → 200 | 1. Pre: `value='3', settings={name:['modern','luxury']}`.<br>2. POST apply-template với template name=`'modern'`. | - HTTP 200 — whitelist match. | Khẩn | [x] |
| **TC-F34-11-03** | `FR-19b`, `FR-15`, `R6` | `API` `[Negative]` | `value=numeric + whitelist miss` → 403 | 1. Pre: `value='3', settings={name:['modern']}`.<br>2. POST với template name=`'retro'`. | - HTTP 403 — whitelist miss. | Khẩn | [x] |
| **TC-F34-11-04** | `FR-19b`, `BR-06` | `API` `[Positive]` | `value='YES'` (không settings) → 200 ALLOW | 1. Pre: `value='YES'`.<br>2. POST apply bất kỳ template. | - HTTP 200 — ALLOW không cần whitelist. | High | [x] |
| **TC-F34-11-05** | `FR-19b`, `BR-06` | `API` `[Positive]` | `value='UNLIMITED'` → 200 ALLOW | 1. Pre: `value='UNLIMITED'`.<br>2. POST apply. | - HTTP 200. | High | [x] |
| **TC-F34-11-06** | `FR-19b`, `BR-07`, `R3` | `API` `[Positive]` | Sub=null (legacy) → 200 default ALLOW | 1. Pre: tenant-C không có sub.<br>2. POST apply-template. | - HTTP 200 — không break legacy. | Blocker | [x] |
| **TC-F34-11-07** | `FR-19b`, `BR-06` | `API` `[Negative]` | `value='0' + settings có whitelist match` → vẫn 403 | 1. Pre: `value='0', settings={name:['modern']}`.<br>2. POST template name=`'modern'`. | - HTTP 403 — `value='0'` ưu tiên hơn whitelist (Critical bug guard). | Khẩn | [x] |

---

### NHÓM 12 — Enforcement: Payload Access + Domain Action (6 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-12-01** | `FR-20` | `API` `[Negative]` | `product_management='0'` → Create Product 403 | 1. Pre: tenant FREEMIUM, `product_management.value='0'`.<br>2. Tạo Product qua Payload REST/GraphQL. | - HTTP 403 (`access.create` denied). | Khẩn | [x] |
| **TC-F34-12-02** | `FR-20` | `API` `[Positive]` | `product_management='0'` không restrict READ | 1. Pre: value=0.<br>2. List Products qua Payload. | - HTTP 200 (read không restrict per PRD §6 FR-20). | High | [x] |
| **TC-F34-12-03** | `FR-20` | `API` `[Positive]` | `product_management='YES'` cho phép full CRUD | 1. Pre: value=YES.<br>2. Create/Update/Delete Product + Category. | - Tất cả HTTP 200. | High | [x] |
| **TC-F34-12-04** | `FR-20` | `API` `[Negative]` | Category access cũng bị guard | 1. Pre: value='0'.<br>2. Tạo Category. | - HTTP 403. | High | [x] |
| **TC-F34-12-05** | `FR-21` | `API` `[Negative]` | `domain_connection='0'` → add-domain throw | 1. Pre: tenant-A `domain_connection.value='0'`.<br>2. Gọi server action `addDomain` từ `settings/domains/actions.ts`. | - Action throw error / trả structured failure.<br>- DB không có record domain mới. | Khẩn | [x] |
| **TC-F34-12-06** | `FR-21` | `API` `[Positive]` | `domain_connection='YES'` → add-domain success | 1. Pre: value='YES'.<br>2. Add domain. | - Domain được tạo, response success. | High | [x] |

---

### NHÓM 13 — Staff Endpoints: invite-staff / remove-staff / bulk-remove (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-13-01** | `FR-22`, `FR-23` | `API` `[Positive]` | Invite-staff trong quota → success + recordUsage | 1. Pre: `staff_limit.value='3'`, used=0.<br>2. Gọi invite-staff endpoint trong Users.ts với 1 email.<br>3. getConsumed `staff_limit`. | - HTTP 200; staff được tạo.<br>- `used=1` sau invite. | Blocker | [x] |
| **TC-F34-13-02** | `FR-22`, `FR-23` | `API` `[Positive]` | Invite 3 staff đến quota | 1. limit=3, used=0.<br>2. invite-staff 3 emails khác nhau lần lượt. | - Cả 3 thành công.<br>- `used=3` sau cùng. | Blocker | [x] |
| **TC-F34-13-03** | `FR-22`, `FR-23` | `API` `[Negative]` | Invite thứ 4 (vượt quota) → 403 | 1. Pre: limit=3, used=3.<br>2. invite-staff email mới. | - HTTP 403 Quota exceeded.<br>- Staff KHÔNG được tạo.<br>- `used` vẫn =3. | Blocker | [x] |
| **TC-F34-13-04** | `FR-22`, `FR-23`, `AC-23` | `API` `[Negative]` | `staff_limit.value='0'` → invite block ngay | 1. Pre: value='0'.<br>2. invite-staff. | - HTTP 403 (`canUse=false`).<br>- Không tạo staff. | Khẩn | [x] |
| **TC-F34-13-05** | `FR-22`, `FR-23` | `API` `[Positive]` | Remove-staff → reduceUsage | 1. Pre: used=2.<br>2. remove-staff 1 user.<br>3. getConsumed. | - `used=1`. | Khẩn | [x] |
| **TC-F34-13-06** | `FR-22`, `FR-23` | `API` `[Positive]` | Bulk-remove-staff → reduce N | 1. Pre: used=5.<br>2. bulk-remove-staff 3 users. | - `used=2`. | High | [x] |
| **TC-F34-13-07** | `FR-22` | `API` `[Positive]` | Update-staff không thay đổi usage | 1. Pre: used=3.<br>2. update-staff (đổi role/info, không add/remove).<br>3. getConsumed. | - `used=3` không đổi. | Medium | [x] |
| **TC-F34-13-08** | `FR-22` | `API` `[Positive]` | resend-invite không tăng usage | 1. Pre: used=2 (1 staff pending invite).<br>2. resend-invite cho pending staff.<br>3. getConsumed. | - `used=2` không đổi. | Medium | [x] |
| **TC-F34-13-09** | `FR-22`, `FR-23` | `API` `[Positive]` | update-staff-status (activate/deactivate) không đụng usage | 1. update-staff-status từ active → inactive cho 1 staff. | - `used` không đổi.<br>- Document: nếu impl coi inactive là "không occupy slot" thì cần update spec; hiện tại assert `used` constant. | Medium | [x] |

---

### NHÓM 14 — Storefront Guards (public, no auth) (8 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-14-01** | `FR-24` | `API` `[Negative]` | `allowing_buyer_making_order='0'` → checkout 403 | 1. Pre: tenant FREEMIUM, value='0'.<br>2. Buyer (no auth) POST `/api/orders/checkout` với cart. | - HTTP 403.<br>- Không tạo order. | Khẩn | [x] |
| **TC-F34-14-02** | `FR-24` | `API` `[Positive]` | `allowing_buyer_making_order='YES'` → checkout success | 1. Pre: value=YES.<br>2. Buyer checkout. | - HTTP 200, order tạo OK. | Blocker | [x] |
| **TC-F34-14-03** | `FR-24`, `BR-07`, `R3` | `API` `[Positive]` | Sub=null (legacy storefront) → checkout success | 1. Pre: tenant-C không có sub.<br>2. Buyer checkout. | - HTTP 200 — KHÔNG break legacy storefront.<br>- Default ALLOW. | Blocker | [x] |
| **TC-F34-14-04** | `FR-24` | `API` `[Negative]` | `allowing_buyer_tracking_order='0'` → track 403 | 1. Pre: value='0'.<br>2. Buyer GET `/api/orders/track/[orderNumber]`. | - HTTP 403. | Khẩn | [x] |
| **TC-F34-14-05** | `FR-24` | `API` `[Positive]` | `allowing_buyer_tracking_order='YES'` → track success | 1. Pre: value=YES + order tồn tại.<br>2. GET track. | - HTTP 200, trả order info. | High | [x] |
| **TC-F34-14-06** | `FR-24` | `Logic` `[Negative]` | `email_confirmation='0'` → checkout OK nhưng KHÔNG gửi email | 1. Pre: value='0', mock email sender.<br>2. Checkout success. | - HTTP 200, order tạo OK.<br>- Email sender KHÔNG được gọi (assert `sendOrderConfirmation` not invoked). | Khẩn | [x] |
| **TC-F34-14-07** | `FR-24` | `Logic` `[Positive]` | `email_confirmation='YES'` → checkout + send email | 1. Pre: value=YES, mock sender.<br>2. Checkout. | - Sender được gọi đúng 1 lần với đúng buyer email. | High | [x] |
| **TC-F34-14-08** | `FR-24` | `Logic` `[Positive]` | `email_confirmation='0'` cũng skip email khi order status change | 1. Pre: value='0'.<br>2. Admin update order status (pending → paid). | - Email status change KHÔNG được gửi.<br>- DB status vẫn update bình thường. | High | [x] |

---

### NHÓM 15 — `Tenants.plan` Sync (5 TCs) — Cross-cutting concern FR-25

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-15-01** | `FR-25`, `BR-08` | `DB` `[Positive]` | provision → Tenants.plan sync | 1. POST provision `professional + 1`.<br>2. Query tenants.plan. | - `tenants.plan = 'business'`. | Khẩn | [x] |
| **TC-F34-15-02** | `FR-25`, `BR-08` | `DB` `[Positive]` | upgrade FREEMIUM → PROFESSIONAL_TM → sync | 1. Pre: tier='free'.<br>2. PUT upgrade.<br>3. Query tenants. | - `tenants.plan` từ `'free'` → `'business'`. | Khẩn | [x] |
| **TC-F34-15-03** | `FR-25`, `BR-08` | `DB` `[Positive]` | downgrade → sync | 1. Pre: tier='business'.<br>2. PUT downgrade → STARTER_TM.<br>3. Query. | - `tenants.plan = 'starter'`. | High | [x] |
| **TC-F34-15-04** | `FR-25`, `R2` | `API` `[Positive]` | `ai/generate-site` đọc Tenants.plan mới sau downgrade | 1. Pre: tier='business', recently downgraded → 'starter'.<br>2. Gọi `POST /api/ai/generate-site` ngay sau (< 100ms). | - Endpoint đọc `tenants.plan='starter'` (không cache cũ).<br>- Gate AI generation theo tier mới. | High | [x] |
| **TC-F34-15-05** | `FR-25`, `R2` | `DB` `[Edge]` | Renew KHÔNG đổi Tenants.plan | 1. Pre: tier='business'.<br>2. PUT renew.<br>3. Query tenants.plan. | - `tier='business'` không đổi (renew chỉ extend endsAt). | Medium | [x] |

---

### NHÓM 16 — DB Migrations & Seed (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-16-01** | `FR-04`, `BR-10` | `DB` `[Positive]` | Fresh DB → 6 migration entries chạy đúng thứ tự | 1. Fresh test DB.<br>2. Chạy `node scripts/db-setup.js`. | - 6 entries chạy thành công theo thứ tự:<br>  1. plans table<br>  2. plans seed 7 rows<br>  3. plan_subscriptions table + 2 indexes<br>  4. plan_subscription_usages + UNIQUE<br>  5. plan_features table + plan_id FK + UNIQUE<br>  6. plan_features seed 140 rows (JOIN plans). | Blocker | [x] |
| **TC-F34-16-02** | `FR-04`, `BR-10` | `DB` `[Positive]` | Idempotent: chạy migration lần 2 không lỗi | 1. Chạy `db-setup.js` lần 2 trên DB đã có data. | - Không lỗi.<br>- `ON CONFLICT DO NOTHING` chặn duplicate seed.<br>- Count vẫn đúng (7 plans, 140 features). | Khẩn | [x] |
| **TC-F34-16-03** | `FR-04` | `DB` `[Positive]` | Thứ tự: plans seed trước plan_features seed | 1. Inspect MIGRATIONS array. | - plans seed (entry 2) chạy trước plan_features seed (entry 6).<br>- plan_features.plan_id FK resolve được qua JOIN plans (vì plans data đã tồn tại). | Khẩn | [x] |
| **TC-F34-16-04** | `FR-02` | `DB` `[Negative]` | UNIQUE `(plan_code, feature_code)` chặn duplicate | 1. Insert thủ công duplicate `(FREEMIUM, website_builder)`. | - DB throw UNIQUE constraint violation. | High | [x] |
| **TC-F34-16-05** | `FR-04`, `BR-10` | `CI` `[Positive]` | `check-migrations.js` CI gate pass | 1. Chạy `node scripts/check-migrations.js`. | - Exit 0.<br>- Validate 6 entries tồn tại + naming convention `f-subscription-*`. | Khẩn | [x] |
| **TC-F34-16-06** | `BR-10` | `DB` `[Negative]` | NEVER DROP TABLE — verify migration không chứa DROP | 1. grep `DROP TABLE` trong MIGRATIONS entries của F34. | - Không có statement nào. | Khẩn | [x] |
| **TC-F34-16-07** | `FR-04` | `DB` `[Positive]` | Indexes tạo đúng | 1. Sau migration, query `pg_indexes` cho `plan_subscriptions`. | - Có `idx_plan_subscriptions_tenant_id` + `idx_plan_subscriptions_ends_at`. | High | [x] |

---

### NHÓM 17 — Concurrency & Data Integrity (6 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-17-01** | `R1`, `FR-10` | `Edge` `[Race]` | Upgrade + Downgrade đồng thời cùng email | 1. Promise.all([PUT upgrade, PUT downgrade]) cho cùng email.<br>2. Query DB sau. | - Final state deterministic (last-write-wins).<br>- Chỉ 1 record `name='main'` cho tenant.<br>- Không split data / không duplicate row. | Blocker | [x] |
| **TC-F34-17-02** | `R4`, `FR-22`, `FR-23` | `Edge` `[Race]` | Invite-staff song song khi sát quota | 1. Pre: limit=3, used=2.<br>2. Promise.all([invite × 3]) — 3 invite đồng thời. | - Đúng 1 invite thành công + 2 trả 403.<br>- `used=3` cuối cùng (atomic compare-and-increment). | Khẩn | [x] |
| **TC-F34-17-03** | `R4` | `Edge` `[Race]` | 5 invite-staff đồng thời khi limit=3, used=0 | 1. Promise.all([invite × 5]). | - Đúng 3 thành công + 2 trả 403.<br>- `used=3`. | Khẩn | [x] |
| **TC-F34-17-04** | `FR-09` | `Edge` `[Bound]` | Sub expire giữa lúc xử lý request | 1. Pre: sub `endsAt = now + 10ms`.<br>2. Gọi guarded route lúc T=0, sub expire lúc T=10ms.<br>3. Handler check isSubscriptionActive lúc T=15ms. | - Request hoặc complete (read snapshot before expire) hoặc trả 403.<br>- KHÔNG inconsistent state (commit partial). | High | [x] |
| **TC-F34-17-05** | `R3`, `FR-10` | `DB` `[Edge]` | Provision: tạo User OK, tạo Tenant fail → rollback | 1. Mock DB throw lỗi khi insert tenants table.<br>2. POST provision. | - Toàn bộ transaction rollback.<br>- User KHÔNG bị orphan (xóa hoặc không tạo). | Khẩn | [x] |
| **TC-F34-17-06** | `R2`, `FR-25` | `DB` `[Edge]` | upsertPlanSubscription OK, sync Tenants.plan fail → handle | 1. Mock update tenants throw.<br>2. PUT upgrade. | - Hoặc rollback toàn bộ; hoặc log + retry; hoặc trả error rõ ràng.<br>- KHÔNG để 2 nguồn lệch nhau im lặng. | Khẩn | [x] |

---

### NHÓM 18 — Security & Authorization (8 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-18-01** | `BR-09`, `FR-13` | `Sec` `[Negative]` | 4 SSO endpoints không có Authorization → 401 | 1. POST provision, PUT upgrade/downgrade/renew không Authorization. | - Tất cả 4 trả HTTP 401 `Invalid token`.<br>- Không write DB. | Blocker | [x] |
| **TC-F34-18-02** | `BR-09`, `AC-07` | `Sec` `[Negative]` | Bearer role=`admin` (không phải super-admin) → 403 | 1. Test 4 endpoints với Bearer của role `admin`. | - Tất cả trả HTTP 403 Forbidden. | Blocker | [x] |
| **TC-F34-18-03** | `BR-09` | `Sec` `[Negative]` | Bearer hết hạn → 401 | 1. Test 4 endpoints với token expired. | - HTTP 401.<br>- Response không leak chi tiết token. | Khẩn | [x] |
| **TC-F34-18-04** | `R8`, `FR-13` | `Sec` `[Positive]` | Response không leak password / Bearer token / PII | 1. Inspect response của 4 SSO endpoints (success + error cases). | - Không có field `password`, không có `Bearer`, không có PII của user khác. | Khẩn | [x] |
| **TC-F34-18-05** | `R8` | `Sec` `[Negative]` | SQL injection vào email field | 1. POST provision với `email="'; DROP TABLE plans;--"`.<br>2. Query DB. | - ORM escape an toàn — `plans` table còn nguyên.<br>- HTTP 400 hoặc 404.<br>- Không log secret. | High | [x] |
| **TC-F34-18-06** | `BR-09` | `Sec` `[Negative]` | Tenant owner không thể gọi PUT upgrade cho tenant khác | 1. Bearer của tenant-user của tenant-A.<br>2. PUT upgrade với email của tenant-B. | - HTTP 403 (vì không phải super-admin).<br>- IDOR guarded. | Khẩn | [x] |
| **TC-F34-18-07** | `FR-13` | `Sec` `[Positive]` | Payload access control: tenant không thấy PlanSubscriptions của tenant khác | 1. Login tenant-A user.<br>2. Query `plan-subscriptions` collection. | - HTTP 403 hoặc empty result (PRD §6 FR-13 — tenant users no access). | Khẩn | [x] |
| **TC-F34-18-08** | `R8` | `Sec` `[Positive]` | Audit log cho upgrade/downgrade emit đúng email | 1. Capture console output (spyOn).<br>2. PUT upgrade thành công với tenant email `xyz@test`. | - Log line chứa `xyz@test` + plan mới.<br>- Audit trail có thể trace ai upgrade gì. | High | [x] |

---

### NHÓM 19 — E2E Golden Path (6 TCs) — Playwright

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-19-01** | `US-F34-01`, `US-F34-02` | `E2E` `[Positive]` | SSO provision → login → upgrade → feature unlock | 1. SSO provision FREEMIUM cho `e2e-owner@test`.<br>2. Owner login vào dashboard.<br>3. Verify website_builder blocked (FREEMIUM).<br>4. SSO PUT upgrade → PROFESSIONAL_TM.<br>5. Reload dashboard. | - Step 3: website_builder return 403/UI block.<br>- Step 5: website_builder mở khóa, UI cho phép truy cập. | Khẩn | [ ] |
| **TC-F34-19-02** | `US-F34-06`, `FR-22` | `E2E` `[Negative]` | Invite staff vượt quota — UI hiển thị error | 1. Tenant FREEMIUM (staff_limit=3).<br>2. UI: invite staff 3 lần → success.<br>3. UI: invite lần 4. | - Lần 4: UI hiển thị error message rõ ràng (`Quota exceeded` / similar).<br>- Form không submit, hoặc submit nhưng nhận error. | High | [ ] |
| **TC-F34-19-03** | `FR-18` | `E2E` `[Negative]` | Sub expire qua đêm → user login lại bị force logout | 1. Pre: user đang login, sub `endsAt = tomorrow`.<br>2. Time travel sang ngày sau (sub expired).<br>3. User reload trang. | - Frontend nhận response `{action:'force_logout'}`.<br>- Redirect về `/login`.<br>- Hiển thị message `subscription_expired`. | Khẩn | [ ] |
| **TC-F34-19-04** | `FR-19b`, `FR-15` | `E2E` `[Positive]` | Apply template trong whitelist | 1. Tenant FREEMIUM, `template_limit.value='3', settings={name:['modern']}`.<br>2. UI: chọn template `'modern'` → Apply. | - Success, template áp dụng. | High | [ ] |
| **TC-F34-19-05** | `FR-19b`, `FR-15` | `E2E` `[Negative]` | Apply template ngoài whitelist → UI error | 1. Cùng setup TC-F34-19-04.<br>2. UI: chọn template `'retro'` → Apply. | - UI hiển thị error rõ ràng.<br>- Template KHÔNG được apply. | High | [ ] |
| **TC-F34-19-06** | `FR-24` | `E2E` `[Negative]` | Storefront buyer checkout khi `allowing_buyer_making_order=0` | 1. Tenant set value='0'.<br>2. Buyer truy cập storefront, add to cart, checkout. | - Checkout button disabled / form submit trả 403.<br>- Buyer không thể tạo order. | High | [ ] |

---

### NHÓM 20 — Supplementary Coverage v1.1 (40 TCs) — Implementation Reality Gaps

> Bổ sung sau khi đối chiếu testcase doc v1.0 với source code thực tế (`src/lib/subscriptions/*.ts`, 4 SSO routes). Tham chiếu scenarios trong `docs/qa/scenarios/F34-plan-subscription-management.md` §v1.1.

#### 20.1 — `dateOnly` utility (4 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-01** | `FR-14` | `Logic` `[Positive]` | `dateOnly('2026-06-01')` ISO date | 1. Import `dateOnly`.<br>2. `dateOnly('2026-06-01')`. | - Trả `'2026-06-01'`. | High | [x] |
| **TC-F34-20-02** | `FR-14` | `Logic` `[Positive]` | `dateOnly` với MySQL datetime format (B-02 fix) | 1. `dateOnly('2026-06-01 00:00:00')` (space delimiter). | - Trả `'2026-06-01'` (replace ` ` → `T`, lấy phần trước `T`). | Khẩn | [x] |
| **TC-F34-20-03** | `FR-14` | `Logic` `[Positive]` | `dateOnly` với ISO + time + Z | 1. `dateOnly('2026-06-01T23:59:59Z')`. | - Trả `'2026-06-01'`. | High | [x] |
| **TC-F34-20-04** | `FR-14` | `Logic` `[Edge]` | `dateOnly` với ISO + milliseconds | 1. `dateOnly('2026-06-01T00:00:00.000Z')`. | - Trả `'2026-06-01'`. | Medium | [x] |

#### 20.2 — `canUseWithinLimit` (8 TCs) — Function MỚI khác `canUse`

> `canUseWithinLimit(payload, subId, planCode, featureCode)`: check `consumed < numeric limit`. YES/UNLIMITED → true. null/0 → false.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-05** | `FR-11`, `BR-05` | `Logic` `[Positive]` | `canUseWithinLimit(YES)` → true (skip consumed) | 1. Mock feature value=`'YES'`.<br>2. canUseWithinLimit. | - Trả `true` không check consumed. | Khẩn | [x] |
| **TC-F34-20-06** | `FR-11`, `BR-05` | `Logic` `[Positive]` | `canUseWithinLimit(UNLIMITED)` → true | 1. value=`'UNLIMITED'`.<br>2. Call. | - Trả `true`. | Khẩn | [x] |
| **TC-F34-20-07** | `FR-11`, `BR-05` | `Logic` `[Positive]` | numeric '3', consumed=2 → true | 1. value='3', mock getConsumed=2.<br>2. Call. | - Trả `true` (2 < 3). | Khẩn | [x] |
| **TC-F34-20-08** | `FR-11`, `BR-05` | `Logic` `[Bound]` | numeric '3', consumed=3 → false (boundary) | 1. value='3', consumed=3.<br>2. Call. | - Trả `false` (3 >= 3, strict `<` boundary). | Khẩn | [x] |
| **TC-F34-20-09** | `FR-11` | `Logic` `[Negative]` | numeric '3', consumed=5 → false | 1. value='3', consumed=5.<br>2. Call. | - Trả `false`. | High | [x] |
| **TC-F34-20-10** | `FR-11` | `Logic` `[Negative]` | value=null → false | 1. Mock feature không tồn tại.<br>2. Call. | - Trả `false` (không default ALLOW). | High | [x] |
| **TC-F34-20-11** | `FR-11` | `Logic` `[Negative]` | value='0' → false | 1. value='0'.<br>2. Call. | - Trả `false` (limit zero — feature off). | Khẩn | [x] |
| **TC-F34-20-12** | `FR-11` | `Logic` `[Negative]` | value='abc' (non-numeric, không enum) → false | 1. value='abc'.<br>2. Call. | - Trả `false` (defensive, isNaN → false). | High | [x] |

#### 20.3 — `getActivePlanSubscription` filter active (4 TCs)

> Function này KHÔNG chỉ tìm — còn check `isSubscriptionActive` và trả null nếu inactive.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-13** | `FR-09` | `API` `[Negative]` | Sub tồn tại nhưng `endsAt < now` → null | 1. Seed sub `endsAt='2026-01-01'` (quá khứ), `status='active'`.<br>2. Gọi getActivePlanSubscription. | - Trả `null` (filter active sau khi find). | Khẩn | [x] |
| **TC-F34-20-14** | `FR-09`, `FR-16` | `API` `[Negative]` | Sub `canceledImmediately=true` → null | 1. Seed sub `canceledAt set, canceledImmediately=true`.<br>2. Call. | - Trả `null`. | Khẩn | [x] |
| **TC-F34-20-15** | `FR-09` | `API` `[Negative]` | Sub `status='ended'` → null | 1. Seed sub `status='ended'`.<br>2. Call. | - Trả `null`. | High | [x] |
| **TC-F34-20-16** | `FR-09` | `API` `[Positive]` | Sub `canceledImmediately=false` + endsAt tương lai → return sub | 1. Seed sub `canceledAt set, canceledImmediately=false, endsAt='2027-01-01'`.<br>2. Call. | - Trả sub object (cancel cuối kỳ, vẫn active). | High | [x] |

#### 20.4 — Provision aliases + name parsing (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-17** | `FR-05` | `API` `[Positive]` | provision với `pack_code` alias | 1. POST provision với `{pack_code: 'professional', ...}` thay vì `subscription_code`. | - HTTP 201 — accept alias.<br>- Plan `PROFESSIONAL_TM_USER` lưu đúng. | High | [x] |
| **TC-F34-20-18** | `FR-05` | `API` `[Positive]` | provision với `telephone` alias cho phone | 1. POST với `{telephone: '0123456789', ...}`. | - User phone field = '0123456789'. | Medium | [x] |
| **TC-F34-20-19** | `FR-05` | `API` `[Positive]` | provision với `subscription_type_id` alias | 1. POST với `{subscription_type_id: 1, subscription_code: 'professional', ...}`. | - Plan = `PROFESSIONAL_TM_USER`. | Medium | [x] |
| **TC-F34-20-20** | `FR-05` | `API` `[Positive]` | provision `name='John Doe'` auto-split | 1. POST với `name='John Doe'`, không truyền first_name/last_name. | - User: `firstName='John', lastName='Doe'`. | High | [x] |
| **TC-F34-20-21** | `FR-05` | `API` `[Edge]` | provision `name='Madonna'` (1 word) | 1. POST `name='Madonna'`. | - `firstName='Madonna', lastName=''`. | Medium | [x] |
| **TC-F34-20-22** | `FR-05` | `API` `[Edge]` | provision `name='  Trần   Văn   A  '` (extra spaces) | 1. POST với tên có nhiều space. | - Split bằng `/\s+/`: `firstName='Trần', lastName='Văn A'`. Không có empty strings. | Medium | [x] |
| **TC-F34-20-23** | `FR-05` | `API` `[Positive]` | `first_name` ưu tiên hơn `name` | 1. POST với cả `{first_name: 'Alice', name: 'Bob Smith', ...}`. | - User: `firstName='Alice'`, lastName từ `last_name` nếu có hoặc empty.<br>- `name` bị ignore. | High | [x] |

#### 20.5 — Provision security + slug + default dates (5 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-24** | `FR-05`, `R8` | `Sec` `[Positive]` | provision strip `password` khỏi `metaData` | 1. POST provision thành công.<br>2. Query `tenants.metaData` trong DB. | - `metaData` KHÔNG chứa key `password`.<br>- Các fields khác (`customer_id_number, service_id, etc.`) vẫn được lưu. | Khẩn | [x] |
| **TC-F34-20-25** | `FR-05` | `DB` `[Positive]` | provision slug normalize special chars + hex suffix | 1. POST với `company_name='Acme Sdn. Bhd. 🚀'`. | - Tenant.slug match pattern: `acme-sdn-bhd-[a-f0-9]{6}` (3 bytes hex).<br>- Special chars + emoji bị strip. | High | [x] |
| **TC-F34-20-26** | `FR-05` | `DB` `[Edge]` | provision company_name dài → slug truncate 30 chars | 1. POST `company_name='A'.repeat(100)`. | - Slug 30 chars `'a'` + `-` + 6 hex chars. | Medium | [x] |
| **TC-F34-20-27** | `FR-05` | `API` `[Positive]` | provision thiếu cả 2 dates → default now / now+365 | 1. POST không kèm `start_date, end_date`.<br>2. Query sub. | - `startsAt ≈ now` (within ±5s).<br>- `endsAt ≈ now + 365 days` (within ±5s). | High | [x] |
| **TC-F34-20-28** | `FR-05` | `API` `[Negative]` | provision `subscription_code='enterprise'` invalid → 400 cụ thể | 1. POST `subscription_code='enterprise'`. | - HTTP 400 message `'Invalid subscription_code: enterprise'` (per impl line 84-89).<br>- Validate TRƯỚC khi tạo Tenant/User. | Khẩn | [x] |

#### 20.6 — Owner-role filter cho upgrade/downgrade/renew (4 TCs)

> Impl filter `tenants.find(t => t.role === 'owner')` — staff member email → 404 đặc thù.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-29** | `FR-06`, `BR-09` | `API` `[Negative]` | upgrade email của staff (role!='owner') → 404 "User has no owner tenant" | 1. Pre: user `staff@test.com` có `tenants=[{tenant: X, role: 'staff'}]`.<br>2. PUT upgrade với email này. | - HTTP 404 message `'User has no owner tenant'`.<br>- KHÔNG update tenant nào. | Khẩn | [x] |
| **TC-F34-20-30** | `FR-07`, `BR-09` | `API` `[Negative]` | downgrade với staff email → 404 same | 1. Tương tự nhưng PUT downgrade. | - HTTP 404. | Khẩn | [x] |
| **TC-F34-20-31** | `FR-14`, `BR-09` | `API` `[Negative]` | renew với staff email → 404 | 1. PUT renew. | - HTTP 404 `'User has no owner tenant'`. | High | [x] |
| **TC-F34-20-32** | `FR-06`, `BR-09` | `API` `[Positive]` | User là owner tenant A + staff tenant B → upgrade chỉ tenant A | 1. Pre: user có `tenants=[{tenant:A, role:'owner'}, {tenant:B, role:'staff'}]`.<br>2. PUT upgrade. | - Tenant A's sub được update.<br>- Tenant B's sub KHÔNG đụng. | High | [x] |

#### 20.7 — `upsertPlanSubscription` CREATE vs UPDATE path distinction (3 TCs)

> CREATE path (sub không tồn tại): KHÔNG gọi clearUsage / recountStaffUsage. UPDATE path: gọi cả 2.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-33** | `FR-10` | `API` `[Positive]` | CREATE path: tenant chưa có sub → KHÔNG gọi clearUsage/recountStaffUsage | 1. Pre: tenant-X không có sub, mock `clearUsage`, `recountStaffUsage`.<br>2. PUT upgrade tenant-X. | - Sub được create.<br>- `clearUsage` KHÔNG được gọi.<br>- `recountStaffUsage` KHÔNG được gọi.<br>- Tenants.plan **vẫn được sync**. | High | [x] |
| **TC-F34-20-34** | `FR-10`, `FR-23` | `API` `[Positive]` | UPDATE path: clearUsage + recountStaffUsage được gọi | 1. Pre: tenant-B có sub. Mock 2 functions.<br>2. PUT upgrade. | - Sub được update.<br>- `clearUsage(payload, subId)` được gọi 1 lần.<br>- `recountStaffUsage(payload, subId, tenantId)` được gọi 1 lần SAU clearUsage.<br>- Tenants.plan synced. | Khẩn | [x] |
| **TC-F34-20-35** | `FR-23` | `API` `[Edge]` | `recountStaffUsage` actualCount=0 → KHÔNG tạo usage row mới | 1. Pre: tenant không có staff (chỉ owner).<br>2. Gọi recountStaffUsage.<br>3. Query usage table cho `staff_limit`. | - KHÔNG có row `staff_limit` được tạo.<br>- getConsumed sau đó trả 0 (fallback default). | High | [x] |

#### 20.8 — Partial failure cascade (5 TCs) — non-transactional risk

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-20-36** | `R6`, `FR-10` | `Edge` `[Error]` | upsertPlanSubscription: update sub OK, clearUsage throw → propagate | 1. Pre: sub tồn tại, mock `clearUsage` throw Error.<br>2. PUT upgrade. | - Error propagate → handler trả 500.<br>- **Risk:** sub đã update plan mới nhưng usage còn cũ → over-allow nếu tenant invite staff. Document trong runbook + log để ops fix tay. | Khẩn | [x] |
| **TC-F34-20-37** | `R6`, `FR-23` | `Edge` `[Error]` | upsertPlanSubscription: clearUsage OK, recountStaffUsage throw → stuck=0 | 1. Pre: sub tồn tại, mock `recountStaffUsage` throw.<br>2. PUT upgrade. | - Error propagate → 500.<br>- **Risk:** sub mới + usage=0 + staff thực vẫn còn → tenant có thể invite full staff_limit mới mặc dù đã có staff cũ. | Khẩn | [x] |
| **TC-F34-20-38** | `R2`, `FR-25` | `Edge` `[Error]` | upsert OK, sync Tenants.plan fail → tier lệch | 1. Pre: mock `payload.update({collection: 'tenants'})` throw.<br>2. PUT upgrade. | - Error propagate → 500.<br>- **Risk:** sub mới nhưng Tenants.plan cũ → `ai/generate-site:246` gate sai tier. | Khẩn | [x] |
| **TC-F34-20-39** | `R3`, `FR-05` | `Edge` `[Error]` | provision: Tenant tạo OK, User tạo fail → tenant orphan | 1. Mock `payload.create({collection: 'users'})` throw sau khi tạo Tenant.<br>2. POST provision. | - Error → 500.<br>- **Risk:** Tenant orphan trong DB.<br>- KHÔNG có rollback transaction. Cần cleanup script hoặc unique check trước. | Khẩn | [x] |
| **TC-F34-20-40** | `R3`, `FR-05` | `Edge` `[Error]` | provision: Tenant+User OK, PlanSubscription fail → user không có sub | 1. Mock `payload.create({collection: 'plan-subscriptions'})` throw.<br>2. POST provision. | - Error → 500.<br>- **Risk:** User login được nhưng mọi guarded route → 403 SUBSCRIPTION_EXPIRED.<br>- Cleanup hoặc retry endpoint cần thiết. | Khẩn | [x] |

---

### NHÓM 21 — Phase 1 Soft Launch Acceptance (12 TCs)

> **Bối cảnh scope Phase 1:** Code Phase 06 (enforcement) đã ship nhưng PlanFeatures seed **toàn `'YES'`** — cơ chế "soft launch". User mới đăng ký mọi gói (FREEMIUM/STARTER/PROFESSIONAL) đều **dùng được tất cả tính năng**. Phase 2 enforcement sẽ chỉ là việc admin đổi value `'YES'` → `'0'`/numeric trong Payload dashboard, không deploy code.
> Nhóm này verify: (a) seed YES thực sự ALLOW ALL, (b) mapping 22 routes guarded đầy đủ, (c) R9 fork — sub=null path.

#### 21.1 — Seed YES = ALLOW ALL behavior (3 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-21-01** | `FR-03`, `R9` | `E2E` `[Positive]` | User FREEMIUM mới đăng ký → dùng được TẤT CẢ 22 guarded routes | 1. POST provision với `subscription_code='freemium'`.<br>2. Login user mới.<br>3. Lần lượt gọi 22 guarded routes (xem bảng §21.2). | **THEN** Cả 22 routes trả HTTP 200 (không 403 FEATURE_LOCKED).<br>- `canUse('FREEMIUM', X) → true` cho mọi feature vì value=YES.<br>- Match scope Phase 1 user yêu cầu. | Blocker | [ ] |
| **TC-F34-21-02** | `FR-03` | `Integration` `[Positive]` | Default seed `value='YES'` cho mọi (plan × feature) combo | 1. Sau migration, query `plan-features` collection (no filter).<br>2. Group by `value`. | - 140 rows, tất cả `value='YES'`.<br>- KHÔNG có row `value='0'`, `'UNLIMITED'`, hay numeric. | Blocker | [x] |
| **TC-F34-21-03** | `FR-03` | `Integration` `[Positive]` | Admin đổi 1 feature → user gói tương ứng bị block ngay (no deploy) | 1. Login Payload admin.<br>2. Set `FREEMIUM.content_management.value = '0'`.<br>3. User FREEMIUM gọi `POST /api/blogs` ngay sau (< 1s). | - Trả 403 `FEATURE_LOCKED`.<br>- Phase 2 enforcement work without code deploy. | High | [ ] |

#### 21.2 — Verify đầy đủ 22 guarded routes (6 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-21-04** | `FR-19` | `Integration` `[Positive]` | `content_management` guard — 9 routes | 1. User FREEMIUM (seed YES) gọi lần lượt: POST/PATCH/DELETE `/api/blogs/[id]`, POST `/api/blogs`, PATCH/DELETE `/api/blog-categories/[id]`, POST `/api/blog-categories`, POST `/api/seo/{apply-fixes,fix,fix-all}`.<br>2. Khi value=`'0'`: lặp lại. | - Seed YES: tất cả 200.<br>- Value=0: tất cả 403 `FEATURE_LOCKED`. | Khẩn | [ ] |
| **TC-F34-21-05** | `FR-19` | `Integration` `[Positive]` | `order_management` guard — 6 routes | 1. Gọi PATCH `/api/orders/[id]`, POST `/api/orders/[id]/{cancel,refund,approve-payment,reject-payment}`, POST `/api/orders/bulk-update`. | - YES: 200; '0': 403. | Khẩn | [ ] |
| **TC-F34-21-06** | `FR-19` | `Integration` `[Positive]` | `payment_integration` guard — 2 routes | 1. POST `/api/stripe/connect/onboard`, POST `/api/stripe/connect/account-link`. | - YES: 200; '0': 403. | High | [ ] |
| **TC-F34-21-07** | `FR-19` | `Integration` `[Positive]` | `website_builder` guard — 2 routes | 1. POST `/api/sites/[siteId]/pages`, PATCH `/api/sites/[siteId]/pages/[pageId]`. | - YES: 200; '0': 403. | High | [ ] |
| **TC-F34-21-08** | `FR-19` | `Integration` `[Positive]` | `email_template_configuration` guard — 2 routes | 1. POST `/api/email-templates/send-test`, POST `/api/email-preview`. | - YES: 200; '0': 403. | High | [ ] |
| **TC-F34-21-09** | `FR-19` | `Integration` `[Positive]` | `sitemap_robot_configuration` + `shipping_fee_configuration` guard — 3 routes | 1. POST `/api/seo/sitemap`, POST `/api/seo/auto-meta-toggle`, PATCH `/api/sites/[siteId]/shipping-config`. | - YES: 200; '0': 403. | High | [ ] |

#### 21.3 — R9 Fork: sub=null behavior decision (3 TCs)

> **TC fork:** Team CẦN quyết định trước Phase 1 go-live. Doc giữ cả 2 variant để valid sau khi team chốt. Chọn variant phù hợp với decision của Tech Lead.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F34-21-10a** | `R9`, `FR-19` | `API` `[Negative]` | **Variant A** (KHÔNG patch HOF): sub=null → 403 SUBSCRIPTION_EXPIRED | 1. Pre: tenant legacy (không có PlanSubscription record).<br>2. Gọi bất kỳ trong 22 guarded routes. | - HTTP 403 `{error: {code: 'SUBSCRIPTION_EXPIRED'}}`.<br>- **Khi team chọn variant A:** mọi legacy tenant bị block — cần ETL F34.2 trước go-live.<br>- Current implementation behavior. | Blocker | [x] |
| **TC-F34-21-10b** | `R9`, `FR-19` | `API` `[Positive]` | **Variant B** (CÓ patch HOF default ALLOW): sub=null → 200 | 1. Pre: HOF được patch với `if (!sub) return handler(req, ctx)` ở `feature-guard.ts:49-53`.<br>2. Pre: tenant legacy sub=null.<br>3. Gọi guarded route. | - HTTP 200 — default ALLOW cho legacy tenants.<br>- **Phase 1 safe mode:** không break legacy.<br>- Trade-off: Phase 2 enforcement sẽ cần thêm điều kiện check sub.<br>- Hữu ích nếu team chọn không chạy ETL trước go-live. | Blocker | [ ] |
| **TC-F34-21-11** | `R9` | `Integration` `[Positive]` | Smoke test golden Phase 1: provision user mới → dùng 22 routes | 1. SSO provision `freemium_user@test.com` lúc T=0.<br>2. Login user → có sub active.<br>3. Loop qua 22 routes. | - 22/22 routes trả 200.<br>- Confirm Phase 1 scope thực sự work.<br>- Run trên staging trước go-live. | Blocker | [ ] |

---

## 6. Test Files Layout

```
src/__tests__/
├── unit/subscriptions/
│   ├── plan-subscription.test.ts            # TC-F34-01-* (getPlanCode, mapPlanCodeToTier)
│   │                                        # TC-F34-02-* (isSubscriptionActive, getActivePlanSubscription)
│   │                                        # TC-F34-08-* (usage tracking)
│   ├── plan-features.test.ts                # TC-F34-07-* (canUse, getFeatureSettings)
│   └── feature-guard.test.ts                # TC-F34-10-*, TC-F34-11-*
├── api/
│   ├── sso-provision.test.ts                # TC-F34-03-* (provision)
│   ├── sso-upgrade.test.ts                  # TC-F34-04-* (upgrade) — existing, mở rộng
│   ├── sso-downgrade.test.ts                # TC-F34-05-* (downgrade)
│   ├── sso-renew.test.ts                    # TC-F34-06-* (renew)
│   ├── session-check.test.ts                # TC-F34-09-*
│   ├── feature-guard-enforcement.test.ts    # TC-F34-10-* (8 dashboard routes) — existing, mở rộng
│   ├── apply-template-limit.test.ts         # TC-F34-11-* (template_limit inline)
│   ├── products-categories-access.test.ts   # TC-F34-12-01..04
│   ├── domains-action-guard.test.ts         # TC-F34-12-05..06
│   ├── users-staff-limit.test.ts            # TC-F34-13-*
│   ├── orders-checkout-guards.test.ts       # TC-F34-14-01..03, 06..08
│   ├── orders-track-guard.test.ts           # TC-F34-14-04..05
│   ├── tenants-plan-sync.test.ts            # TC-F34-15-*
│   └── sso-security.test.ts                 # TC-F34-18-*
├── migration/
│   └── plan-subscription-migrations.test.ts # TC-F34-16-*
└── concurrency/
    └── subscription-race.test.ts            # TC-F34-17-*

e2e/
└── f34-subscription.spec.ts                 # TC-F34-19-*
```

---

## 7. Test Data Fixtures

### Plan codes (7)
```
FREEMIUM
STARTER_TM_USER, STARTER_NON_TM_USER
STANDARD_TM_USER, STANDARD_NON_TM_USER
PROFESSIONAL_TM_USER, PROFESSIONAL_NON_TM_USER
```

### Feature codes (20) — seed all YES initially
```
website_builder, template_limit, code_snippet, sitemap_robot_configuration,
live_chat_plugin, domain_connection, shipping_fee_configuration,
delivery_provider_limit, allowing_buyer_making_order,
allowing_buyer_tracking_order, payment_integration, order_management,
product_management, promotion_management, content_management,
email_confirmation, email_template_configuration, staff_limit,
account_profile, distribution_integration
```

### Tenant fixtures
| Fixture | Plan | Status | Mô tả |
|---|---|---|---|
| `tenant-A` | FREEMIUM | active | Default test tenant, dùng cho quota tests |
| `tenant-B` | PROFESSIONAL_TM_USER | active | Tenant trả phí, dùng cho upgrade/downgrade/renew |
| `tenant-C` | — (sub=null) | — | Legacy tenant chưa có sub — test default ALLOW |
| `tenant-D` | STARTER_NON_TM_USER | expired (`endsAt < now`) | Test session-check force_logout |
| `tenant-E` | PROFESSIONAL_TM_USER | canceledImmediately=true | Test cancel-now flow |
| `tenant-F` | STANDARD_TM_USER | canceledImmediately=false (cancel cuối kỳ) | Test cancel-at-period-end |

### Bearer tokens
| Token | Role | Dùng cho |
|---|---|---|
| `BEARER_SUPER_ADMIN` | super-admin | All success path SSO endpoints |
| `BEARER_TENANT_USER` | tenant-user | TC-F34-04-07, TC-F34-05-05, TC-F34-06-09, TC-F34-18-02 |
| `BEARER_ADMIN` | admin (non-super) | TC-F34-18-02 |
| `BEARER_EXPIRED` | super-admin (expired) | TC-F34-03-08, TC-F34-18-03 |
| `BEARER_NO_ROLE` | user (no roles array) | TC-F34-18-02 variant |

### Sample SSO payloads
```json
// POST /api/v1/sso/provision (TC-F34-03-01)
{
  "name": "Acme Owner",
  "email": "owner@acme.test",
  "password": "Passw0rd!",
  "company_name": "Acme Sdn Bhd",
  "subscription_code": "professional",
  "subscription_type": 1,
  "start_date": "2026-06-01",
  "end_date": "2027-06-01"
}

// PUT /api/v1/sso/upgrade hoặc /downgrade (TC-F34-04-01, TC-F34-05-01)
{
  "email": "owner@acme.test",
  "subscription_code": "standard",
  "subscription_type": 2,
  "start_date": "2026-06-12",
  "end_date": "2027-06-12"
}

// PUT /api/v1/sso/renew (TC-F34-06-01)
{ "email": "owner@acme.test", "expired_at": "2027-06-01" }
```

---

## 8. Risk Assessment (Mapping với Test Cases)

| # | Risk | Impact | Likelihood | Test Cases liên quan |
|---|------|--------|------------|---------------------|
| **R1** | SSO upgrade/downgrade đồng thời gây split state | High | Medium | TC-F34-17-01 |
| **R2** | Tenants.plan vs PlanSubscription.plan lệch | High | Medium | TC-F34-15-01..05, TC-F34-17-06 |
| **R3** | Legacy tenants (sub=null) bị 403 sau deploy | Critical | High | TC-F34-09-03, TC-F34-10-01, TC-F34-11-06, TC-F34-14-03 |
| **R4** | staff_limit race condition vượt quota | Critical | Medium | TC-F34-17-02, TC-F34-17-03 |
| **R5** | Migration seed rerun làm fail CI | High | Low | TC-F34-16-02, TC-F34-16-05 |
| **R6** | template_limit whitelist bypass / value=0 không block | Critical | Low | TC-F34-11-01, TC-F34-11-07 |
| **R7** | session-check force_logout nhầm sau renew | High | Low | TC-F34-09-04 |
| **R8** | Bearer leak → upgrade tenant bất kỳ | Critical | Low | TC-F34-18-04, TC-F34-18-08, TC-F34-04-08 |
| **R9** | `canUse(null)` return false → legacy tenant đột nhiên 403 sau upgrade Phase 06 | Critical | High | TC-F34-07-06, TC-F34-10-01. **Mitigation:** verify trên staging với 1 tenant legacy (sub=null) trước khi promote main. Đảm bảo storefront + template_limit có default ALLOW riêng. |
| **R10** | provision tạo Tenant/User OK nhưng PlanSubscription fail → user login được nhưng không có sub | Critical | Low | TC-F34-20-40. **Mitigation:** monitoring + cleanup script weekly. |
| **R11** | upsertPlanSubscription partial failure (3 steps không transaction) → state lệch | Critical | Medium | TC-F34-20-36..38. **Mitigation:** ops runbook + alerting trên error 500 ở 4 SSO endpoints. |
| **R12** | Doc test cases lệch implementation (v1.0 → v1.1 fix 3 TCs SAI) | High | — | Audit định kỳ doc vs source khi bump version impl. |

---

## 9. Coverage Summary

| Loại | Số TCs |
|:---|:---:|
| Unit (Logic) | 67 |
| API Integration | 95 |
| DB Migration | 7 |
| Concurrency | 6 |
| Security | 9 |
| E2E (Playwright) | 6 |
| Edge cases | 6 |
| **Tổng** | **208** |

### Priority breakdown (v1.2)
| Priority | Số TCs |
|:---|:---:|
| Blocker | 34 |
| Khẩn | 77 |
| High | 82 |
| Medium | 15 |
| **Tổng** | **208** |

### AC Coverage (in-scope)
| AC Range | Coverage |
|:---|:---:|
| AC-01..07 (provision) | ✅ Full (TC-F34-03-*) |
| AC-08..11 (upgrade) | ✅ Full (TC-F34-04-*) |
| AC-12..15 (renew) | ✅ Full (TC-F34-06-*) |
| AC-16..17 (downgrade) | ✅ Full (TC-F34-05-*) |
| AC-18..21 (isSubscriptionActive) | ✅ Full (TC-F34-02-*) |
| AC-22..25 (PlanFeatures + canUse) | ✅ Full (TC-F34-07-*) |
| AC-26..31 | ⚠️ DEFERRED F34.2 (ETL) |

### FR Coverage
24/25 FRs covered (FR-12 ETL deferred). Mỗi FR có ≥ 1 TC mapping.

---

## 10. Definition of Done — F34 QA Gate

- [ ] Tất cả 28 Blocker TCs pass.
- [ ] Tất cả 41 Khẩn TCs pass.
- [ ] Coverage báo cáo: `plan-subscription.ts` + `feature-guard.ts` ≥ 90% lines/branches.
- [ ] CI gate `scripts/check-migrations.js` xanh trên PR.
- [ ] Migration idempotent verified trên staging DB (chạy `db-setup.js` 2 lần liên tiếp).
- [ ] Backwards-compat test (R3 default ALLOW) verified trên staging với 1 tenant legacy thật.
- [ ] Concurrency tests (TC-F34-17-01..03) chạy stable 10 lần liên tiếp không flake.
- [ ] E2E golden path (TC-F34-19-01) chạy stable trên staging.
- [ ] Audit log assertion (TC-F34-04-08, TC-F34-18-08) verified — console output có tenant email.
