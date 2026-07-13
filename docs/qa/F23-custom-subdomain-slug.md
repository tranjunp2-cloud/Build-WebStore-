# QA Test Plan: Custom Subdomain Slug (F23)
> **Version:** 1.0 | **Ngày tạo:** 2026-04-09 | **Thực hiện:** QA Team
> **PRD Ref:** `plans/260409-1930-custom-subdomain-slug/plan.md`
> **Tổng ACs:** 13 | **Tổng TCs:** 52 | **Coverage:** 100%

---

## 1. Test Strategy

### 1.1 Phạm vi kiểm thử (Scope)
Tính năng F23 cho phép người dùng chọn custom subdomain (slug) thay vì `store-{id}` mặc định. Phạm vi bao gồm:
- Hàm `slugify()` — xử lý business name → DNS-safe slug
- API `GET /api/slug/check` — kiểm tra slug available/taken/reserved
- API `PATCH /api/tenant/slug` — cập nhật slug (authenticated)
- UI `SlugPicker` component trong Onboarding
- UI `Settings > Domains` — slug editor
- Middleware — 301 redirect cho `previousSlugs`

### 1.2 Loại kiểm thử (Test Types)

| Loại | Tool | Mục tiêu |
|------|------|-----------|
| Unit | Vitest | `slugify()`, `generateTenantSlug()`, `ensureUniqueSlug()`, reserved words validation |
| Integration | Vitest + supertest | API `/api/slug/check`, `/api/tenant/slug`, Payload beforeChange hook |
| E2E | Playwright | Onboarding SlugPicker flow, Settings slug editor flow |
| Security | Manual + Playwright | XSS injection, SQL injection, authorization bypass, rate limiting |
| Performance | Manual + Playwright | API response <200ms, debounce 400ms |

### 1.3 Coverage Targets

| Metric | Target |
|--------|--------|
| AC Coverage | 100% (13/13 ACs) |
| Critical Scenario Coverage | 100% (6/6) |
| High Scenario Coverage | 100% (10/10) |
| Unit test (slugify module) | >90% lines |
| Integration test (API endpoints) | >80% branches |

### 1.4 Môi trường kiểm thử

| Biến | Giá trị |
|------|---------|
| Môi trường | Staging (`web-v2.dev.ecommercehub.my`) |
| Browser | Chrome 120+, Safari 17+, Firefox 120+ |
| Devices | Desktop 1920x1080, Mobile iPhone 14 Pro (375px) |
| DB | PostgreSQL — staging instance |
| Auth | Bearer token (JWT có `mfa_verified: true`) |

---

## 2. Risk Assessment

| Rủi ro | Tác động | Khả năng | Ưu tiên kiểm thử |
|--------|----------|----------|-------------------|
| Race condition — 2 users tạo slug trùng đồng thời | Cao — dữ liệu corrupt | Trung bình | P1 — bắt buộc |
| XSS qua slug input | Cao — security breach | Thấp | P1 — bắt buộc |
| SQL injection qua slug param | Cao — data breach | Thấp | P1 — bắt buộc |
| Middleware redirect loop (previousSlugs) | Cao — site down | Thấp | P1 — bắt buộc |
| Collision loop không kết thúc (infinite recursion) | Cao — server timeout | Trung bình | P1 — bắt buộc |
| previousSlugs conflict cross-tenant | Trung bình — redirect sai site | Thấp | P1 — bắt buộc |
| API không rate-limit — enumeration attack | Trung bình — thông tin leak | Cao | P1 — bắt buộc |
| Vietnamese/Unicode business name không slugify được | Trung bình — UX xấu | Cao | P2 — quan trọng |
| Slug >63 chars — vi phạm DNS spec | Trung bình — routing lỗi | Thấp | P2 — quan trọng |
| previousSlugs expiresAt null — redirect vô tận | Thấp — redirect không mong muốn | Trung bình | P2 — quan trọng |
| Super-admin tạo slug qua Payload panel bỏ qua hook | Trung bình — bypass validation | Thấp | P2 — quan trọng |
| Redis cache down — check API slow | Thấp — degraded perf | Thấp | P3 — nên có |
| Tenant cũ `store-{id}` bị ảnh hưởng sau migration | Cao — breaking change | Thấp | P1 — bắt buộc |

---

## 3. Test Cases

### 3.1 Slugify Function (Unit Tests)

#### TC-F23-001: Slugify business name thông thường
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-01
- **Scenario Reference:** #1 (implicit — happy path)
- **Precondition:** Hàm `slugify()` được import từ `src/lib/utils/slugify.ts`
- **Steps:**
  1. Gọi `generateTenantSlug("Rimba Adventure Tours & Co.")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về `"rimba-adventure-tours-co"` — chỉ chứa `[a-z0-9-]`, không bắt đầu/kết thúc bằng `-`
- **Test Data:** `"Rimba Adventure Tours & Co."` → `"rimba-adventure-tours-co"`

---

#### TC-F23-002: Slugify tên tiếng Việt có dấu
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-01
- **Scenario Reference:** #2
- **Precondition:** Hàm `generateTenantSlug()` import đúng
- **Steps:**
  1. Gọi `generateTenantSlug("Cà Phê Nguyên Chất")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về `"ca-phe-nguyen-chat"` — strip diacritics, lowercase, hyphens đúng vị trí
- **Test Data:** `"Cà Phê Nguyên Chất"` → `"ca-phe-nguyen-chat"`

---

#### TC-F23-003: Slugify tên chứa emoji
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-01
- **Scenario Reference:** #3
- **Precondition:** Hàm `generateTenantSlug()` import đúng
- **Steps:**
  1. Gọi `generateTenantSlug("🍰🎂 Shop")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về `"shop"` — emoji bị strip, chỉ giữ phần ASCII hợp lệ
- **Test Data:** `"🍰🎂 Shop"` → `"shop"`

---

#### TC-F23-004: Slugify tên dài >63 ký tự — truncate
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-01
- **Scenario Reference:** #4
- **Precondition:** Hàm `generateTenantSlug()` import đúng
- **Steps:**
  1. Gọi `generateTenantSlug("Abcdefghijklmnopqrstuvwxyz Abcdefghijklmnopqrstuvwxyz Abcdefghijklmnop Store")` (>63 chars)
  2. Kiểm tra kết quả trả về
- **Expected:** Kết quả có độ dài ≤63 ký tự; không kết thúc bằng `-`
- **Test Data:** Input 80+ chars → output ≤63 chars

---

#### TC-F23-005: Slugify XSS injection — strip all special chars
- **Priority:** P1
- **Type:** Unit + Security
- **AC Reference:** AC-01
- **Scenario Reference:** #5 (Critical)
- **Precondition:** Hàm `generateTenantSlug()` import đúng
- **Steps:**
  1. Gọi `generateTenantSlug("<script>alert(1)</script>")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về `"scriptalert1script"` hoặc `"my-store"` (fallback) — KHÔNG có `<`, `>`, `(`, `)` trong output
- **Test Data:** `"<script>alert(1)</script>"` → output không chứa HTML tags

---

#### TC-F23-006: Slugify SQL injection input
- **Priority:** P1
- **Type:** Unit + Security
- **AC Reference:** AC-01
- **Scenario Reference:** #6 (Critical)
- **Precondition:** Hàm `generateTenantSlug()` import đúng
- **Steps:**
  1. Gọi `generateTenantSlug("'; DROP TABLE tenants; --")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về chuỗi chỉ `[a-z0-9-]` — không chứa `'`, `;`, `-`-liên tiếp, `DROP`, `TABLE`
- **Test Data:** `"'; DROP TABLE tenants; --"` → clean slug output

---

#### TC-F23-007: Slugify chuỗi chỉ có ký tự đặc biệt "---"
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-01, AC-06
- **Scenario Reference:** #7
- **Precondition:** Hàm `generateTenantSlug()` import đúng
- **Steps:**
  1. Gọi `generateTenantSlug("---")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về fallback `"my-store"` — không trả về empty string hay `"-"`
- **Test Data:** `"---"` → `"my-store"` (fallback)

---

#### TC-F23-008: Từ chối slug toàn số
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-06
- **Scenario Reference:** #8
- **Precondition:** Hàm validate slug import đúng
- **Steps:**
  1. Gọi validate với slug `"12345"`
  2. Kiểm tra kết quả
- **Expected:** Validation fail — trả về error "Slug cannot be pure numbers" hoặc tương đương; không được save
- **Test Data:** `"12345"` → rejected

---

#### TC-F23-009: ensureUniqueSlug — append suffix khi slug đã tồn tại
- **Priority:** P1
- **Type:** Unit (mock DB)
- **AC Reference:** AC-02
- **Scenario Reference:** #9 (Critical — race condition)
- **Precondition:** Mock Payload `find()` trả về 1 doc với slug `"rimba-tours"` lần đầu, sau đó trả về empty
- **Steps:**
  1. Gọi `ensureUniqueSlug(mockPayload, "rimba-tours")`
  2. Kiểm tra kết quả trả về
- **Expected:** Trả về `"rimba-tours-{3chars}"` — suffix 3 ký tự alphanumeric, unique
- **Test Data:** Base slug `"rimba-tours"`, DB đã có `"rimba-tours"`

---

#### TC-F23-010: ensureUniqueSlug — collision loop >5 retries → fallback
- **Priority:** P1
- **Type:** Unit (mock DB)
- **AC Reference:** AC-02
- **Scenario Reference:** #16 (High)
- **Precondition:** Mock Payload `find()` luôn trả về docs (slug bao giờ cũng taken)
- **Steps:**
  1. Mock `ensureUniqueSlug()` để `find()` luôn trả về kết quả exist
  2. Gọi `ensureUniqueSlug(mockPayload, "popular-slug")`
  3. Đếm số lần retry
- **Expected:** Sau tối đa 5 retries → fallback về `"store-{userId}"` hoặc throw 409 error; KHÔNG infinite loop
- **Test Data:** Slug luôn taken trong mock

---

### 3.2 Slug Check API (Integration Tests)

#### TC-F23-011: GET /api/slug/check — slug available
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-03
- **Scenario Reference:** — (happy path)
- **Precondition:** DB staging không có tenant với slug `"mybakery"`
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=mybakery`
  2. Đo response time
  3. Kiểm tra response body
- **Expected:** HTTP 200; body `{ available: true, slug: "mybakery" }`; response time <200ms
- **Test Data:** `slug=mybakery` (chưa tồn tại trong DB)

---

#### TC-F23-012: GET /api/slug/check — slug đã tồn tại
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-04
- **Scenario Reference:** — (negative path)
- **Precondition:** DB staging có tenant với slug `"rimba-tours"`
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=rimba-tours`
  2. Kiểm tra response body
- **Expected:** HTTP 200; body `{ available: false, slug: "rimba-tours", suggestion: "rimba-tours-{suffix}" }`; suggestion là slug hợp lệ
- **Test Data:** `slug=rimba-tours` (đã tồn tại trong DB)

---

#### TC-F23-013: GET /api/slug/check — reserved word "admin"
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-05
- **Scenario Reference:** — (reserved words)
- **Precondition:** Endpoint `/api/slug/check` có blocklist reserved words
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=admin`
  2. Kiểm tra response
- **Expected:** HTTP 409; body `{ available: false, reason: "reserved" }` hoặc `error: "reserved"`
- **Test Data:** Các reserved words: `admin`, `www`, `api`, `app`, `login`, `register`, `billing`, `primeweb`, `ecommercehub`

---

#### TC-F23-014: GET /api/slug/check — format không hợp lệ (slug ngắn)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-06
- **Scenario Reference:** — (validation)
- **Precondition:** Endpoint có validation 3-63 chars
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=ab` (chỉ 2 chars)
  2. Kiểm tra response
- **Expected:** HTTP 422; error message rõ ràng về format không hợp lệ
- **Test Data:** `slug=ab`, `slug=-invalid-`, `slug=MY STORE`

---

#### TC-F23-015: GET /api/slug/check — format không hợp lệ (chữ hoa, dấu cách)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-06
- **Scenario Reference:** — (validation)
- **Precondition:** Endpoint có validation `[a-z0-9-]` only
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=MY STORE`
  2. Kiểm tra response
- **Expected:** HTTP 422; error message nêu rõ chỉ cho phép lowercase alphanumeric và hyphens
- **Test Data:** `slug=MY STORE`, `slug=my_store`, `slug=my.store`

---

#### TC-F23-016: GET /api/slug/check — slug bắt đầu/kết thúc bằng hyphen
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-06
- **Scenario Reference:** — (validation edge case)
- **Precondition:** Endpoint có rule "không bắt đầu/kết thúc bằng -"
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=-invalid-`
  2. Kiểm tra response
- **Expected:** HTTP 422; error message về format không hợp lệ
- **Test Data:** `slug=-invalid-`, `slug=-mybakery`, `slug=mybakery-`

---

#### TC-F23-017: GET /api/slug/check — không để lộ thông tin tenant
- **Priority:** P1
- **Type:** Security
- **AC Reference:** AC-03, AC-04
- **Scenario Reference:** #23 (Medium)
- **Precondition:** Endpoint là public (không cần auth)
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=rimba-tours` (slug tồn tại)
  2. Kiểm tra response body
- **Expected:** Response CHỈ có `{ available: false, suggestion: "..." }` — KHÔNG chứa `tenantId`, `userId`, `email`, hay thông tin nhạy cảm nào của tenant đang dùng slug đó
- **Test Data:** Slug của tenant thực trong DB

---

#### TC-F23-018: GET /api/slug/check — rate limiting 30 req/phút
- **Priority:** P2
- **Type:** Security + Performance
- **AC Reference:** AC-03
- **Scenario Reference:** #11 (Medium)
- **Precondition:** Rate limit được cấu hình (30 req/min per IP)
- **Steps:**
  1. Gửi 31 request liên tiếp từ cùng một IP đến `/api/slug/check`
  2. Kiểm tra response của request thứ 31
- **Expected:** Request 1-30: HTTP 200; Request 31: HTTP 429 Too Many Requests
- **Test Data:** 31 requests với các slug khác nhau

---

#### TC-F23-019: PATCH /api/tenant/slug — không có token → 401
- **Priority:** P1
- **Type:** Security
- **AC Reference:** — (authorization)
- **Scenario Reference:** #21 (Critical)
- **Precondition:** Endpoint `/api/tenant/slug` yêu cầu authentication
- **Steps:**
  1. Gọi `PATCH /api/tenant/slug` với body `{ slug: "new-slug" }` — KHÔNG có Authorization header
  2. Kiểm tra response
- **Expected:** HTTP 401 Unauthorized; không có thay đổi gì trong DB
- **Test Data:** Request không có token

---

#### TC-F23-020: PATCH /api/tenant/slug — user A đổi slug tenant user B → 403
- **Priority:** P1
- **Type:** Security
- **AC Reference:** — (authorization)
- **Scenario Reference:** #22 (Critical)
- **Precondition:** User A đã đăng nhập, cố tình đổi slug của tenant User B
- **Steps:**
  1. Đăng nhập với User A (token hợp lệ)
  2. Gọi `PATCH /api/tenant/slug` với `tenantId` của User B và `slug: "stolen-slug"`
  3. Kiểm tra response
- **Expected:** HTTP 403 Forbidden; slug của Tenant B không thay đổi trong DB
- **Test Data:** 2 user accounts riêng biệt; tenantId của user B

---

#### TC-F23-021: PATCH /api/tenant/slug — thành công → update DB
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-08, AC-10
- **Scenario Reference:** — (happy path)
- **Precondition:** User đã đăng nhập với `mfa_verified: true`; slug mới available
- **Steps:**
  1. Đăng nhập, lấy token
  2. Gọi `PATCH /api/tenant/slug` với body `{ slug: "my-bakery-new" }`
  3. Kiểm tra response
  4. Query DB: `SELECT slug, "previousSlugs" FROM tenants WHERE id = ?`
- **Expected:** HTTP 200; `tenant.slug = "my-bakery-new"`; slug cũ được push vào `previousSlugs[]` với `expiresAt = now + 30 ngày`
- **Test Data:** User đã có slug `"my-bakery"`, đổi thành `"my-bakery-new"`

---

#### TC-F23-022: PATCH /api/tenant/slug — slug conflict cross-tenant (previousSlugs)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-02, AC-10
- **Scenario Reference:** #27 (Critical)
- **Precondition:** Tenant A đã từng dùng slug `"my-store"` (còn trong `previousSlugs` chưa expire); Tenant B muốn đăng ký slug `"my-store"`
- **Steps:**
  1. Đảm bảo Tenant A có `previousSlugs` chứa `"my-store"` chưa hết hạn
  2. User B gọi `PATCH /api/tenant/slug` với `{ slug: "my-store" }`
  3. Kiểm tra response
- **Expected:** HTTP 409 Conflict hoặc slug của User B nhận suggestion khác — KHÔNG được phép lấy slug đang trong grace period của Tenant A
- **Test Data:** `"my-store"` trong previousSlugs Tenant A với `expiresAt` = 2 tuần nữa

---

#### TC-F23-023: PATCH /api/tenant/slug — mất mạng giữa chừng → không thay đổi
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-09 (confirmation dialog), AC-08
- **Scenario Reference:** #18 (High)
- **Precondition:** Network bị drop sau khi submit
- **Steps:**
  1. Mock network failure trước khi PATCH request hoàn thành
  2. Kiểm tra DB sau khi timeout
- **Expected:** DB vẫn giữ slug cũ; UI hiển thị error state; không có slug mới trong DB
- **Test Data:** Simulate network timeout/error

---

#### TC-F23-024: Payload beforeChange hook — validate slug khi super-admin dùng Payload panel
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-05, AC-06
- **Scenario Reference:** #24 (Medium)
- **Precondition:** Super-admin đăng nhập Payload admin panel (`/admin`)
- **Steps:**
  1. Vào Payload admin panel
  2. Edit một tenant, đặt slug = `"admin"` (reserved word)
  3. Save
- **Expected:** Payload `beforeChange` hook reject — save fail với error rõ ràng; slug không được cập nhật thành `"admin"`
- **Test Data:** Reserved slug `"admin"` nhập qua Payload admin panel

---

#### TC-F23-025: Rate limit slug changes — tối đa 3 lần/tháng
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** — (business rule)
- **Scenario Reference:** #32 (Medium)
- **Precondition:** User đã đổi slug 3 lần trong tháng hiện tại
- **Steps:**
  1. Đổi slug lần thứ 4 trong tháng qua `PATCH /api/tenant/slug`
  2. Kiểm tra response
- **Expected:** HTTP 429 hoặc 403 với message rõ ràng "Đã đổi subdomain 3 lần trong tháng, thử lại tháng sau"
- **Test Data:** Tenant với 3 lịch sử đổi slug trong tháng này

---

### 3.3 SlugPicker UI — Onboarding (E2E Tests)

#### TC-F23-026: SlugPicker auto-populate từ business name
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-07
- **Scenario Reference:** — (happy path UI)
- **Precondition:** User ở bước onboarding nhập business name
- **Steps:**
  1. Mở `/onboarding` với account mới chưa có site
  2. Nhập business name `"My Bakery"` vào ô tên
  3. Quan sát SlugPicker component
- **Expected:** SlugPicker tự động populate `"my-bakery"`; badge hiển thị "Available" (xanh) nếu slug chưa tồn tại
- **Test Data:** Business name `"My Bakery"`; slug `"my-bakery"` không có trong DB staging

---

#### TC-F23-027: SlugPicker debounce 400ms — không spam API
- **Priority:** P2
- **Type:** E2E + Performance
- **AC Reference:** AC-07
- **Scenario Reference:** — (performance)
- **Precondition:** User ở bước onboarding
- **Steps:**
  1. Mở `/onboarding`
  2. Nhập từng ký tự vào ô slug: `"m"`, `"my"`, `"my-"`, `"my-b"`, `"my-ba"`, `"my-bak"`, `"my-bake"`, `"my-bakery"`
  3. Monitor network requests
- **Expected:** API `/api/slug/check` chỉ được gọi 1 lần sau khi user ngừng gõ 400ms — không gọi cho mỗi ký tự
- **Test Data:** Nhập nhanh `"my-bakery"` (type speed < 400ms/char)

---

#### TC-F23-028: SlugPicker badge "Taken" khi slug đã tồn tại
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-07
- **Scenario Reference:** — (negative UI)
- **Precondition:** DB staging có tenant với slug `"bakery-kl"` (hoặc bất kỳ slug nào)
- **Steps:**
  1. Mở `/onboarding`
  2. Nhập slug đã tồn tại vào ô SlugPicker
  3. Đợi debounce 400ms
- **Expected:** Badge hiển thị "Taken" (đỏ/cam); hiển thị suggestion slug thay thế; nút Continue/Submit bị disabled
- **Test Data:** Slug của tenant đang active trong staging

---

#### TC-F23-029: SlugPicker — user edit slug gợi ý thành slug tùy chỉnh
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** AC-07, AC-08
- **Scenario Reference:** — (user customization)
- **Precondition:** User ở onboarding, business name đã nhập
- **Steps:**
  1. Nhập business name `"Rimba Adventure Tours"` — slug gợi ý là `"rimba-adventure-tours"`
  2. Xóa slug gợi ý trong ô SlugPicker
  3. Nhập `"rimba-tours"` (slug tùy chỉnh ngắn hơn)
  4. Đợi debounce 400ms — verify "Available"
  5. Submit onboarding
- **Expected:** Slug được lưu là `"rimba-tours"` (tùy chỉnh của user), không phải slug auto-generated
- **Test Data:** Business name `"Rimba Adventure Tours"`, slug tùy chỉnh `"rimba-tours"`

---

#### TC-F23-030: Slug được lưu vào tenant khi generate site
- **Priority:** P1
- **Type:** E2E + Integration
- **AC Reference:** AC-08
- **Scenario Reference:** — (critical path)
- **Precondition:** User hoàn thành onboarding với slug `"my-bakery"`, đã xác nhận Available
- **Steps:**
  1. Submit onboarding form với slug `"my-bakery"`
  2. Đợi site generation hoàn thành
  3. Query DB: `SELECT slug FROM tenants WHERE ...`
- **Expected:** `tenant.slug = "my-bakery"` — KHÔNG phải `"store-{id}"`; site accessible tại `my-bakery.web-v2.dev.ecommercehub.my`
- **Test Data:** Onboarding form với slug `"my-bakery"` confirmed available

---

#### TC-F23-031: SlugPicker — đóng tab, mở lại → re-check slug
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** AC-07
- **Scenario Reference:** #17 (Medium)
- **Precondition:** User đang ở onboarding, có slug đã check
- **Steps:**
  1. Nhập slug `"my-shop"` → available
  2. Đóng tab trình duyệt
  3. Mở lại `/onboarding`
  4. Quan sát trạng thái SlugPicker
- **Expected:** SlugPicker reset hoặc re-check slug khi trang load lại — không show stale "Available" badge từ session trước
- **Test Data:** Slug `"my-shop"` — giữa 2 sessions có thể bị người khác lấy mất

---

### 3.4 Settings Slug Editor (E2E Tests)

#### TC-F23-032: Settings > Domains hiển thị subdomain hiện tại
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-09
- **Scenario Reference:** — (happy path UI)
- **Precondition:** User đã login, có tenant với slug `"rimba-tours"`
- **Steps:**
  1. Đăng nhập và vào `/settings/domains` (hoặc equivalent)
  2. Quan sát section subdomain
- **Expected:** Hiển thị `rimba-tours.web-v2.dev.ecommercehub.my` ở trạng thái read-only; nút `"Change subdomain"` visible
- **Test Data:** Tenant slug `"rimba-tours"`

---

#### TC-F23-033: Settings > "Change subdomain" → input + Save → confirmation dialog
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-09
- **Scenario Reference:** — (flow)
- **Precondition:** User ở `/settings/domains`, có nút "Change subdomain"
- **Steps:**
  1. Click nút `"Change subdomain"`
  2. Input field xuất hiện — nhập slug mới `"rimba-adventure"`
  3. Kiểm tra slug available (badge xanh)
  4. Click Save/Confirm
  5. Quan sát dialog confirmation
- **Expected:** Confirmation dialog xuất hiện với warning SEO (thay đổi URL ảnh hưởng SEO); có nút Confirm và Cancel
- **Test Data:** Slug hiện tại `"rimba-tours"`, slug mới `"rimba-adventure"`

---

#### TC-F23-034: Settings — đổi slug thành công → previousSlugs được lưu
- **Priority:** P1
- **Type:** E2E + Integration
- **AC Reference:** AC-10
- **Scenario Reference:** — (critical path)
- **Precondition:** User confirm đổi slug từ `"rimba-tours"` → `"rimba-adventure"`
- **Steps:**
  1. Confirm dialog → submit
  2. Kiểm tra UI phản hồi (success toast/message)
  3. Query DB: `SELECT slug, "previousSlugs" FROM tenants WHERE id = ?`
- **Expected:** `tenant.slug = "rimba-adventure"`; `tenant.previousSlugs` chứa `{ slug: "rimba-tours", expiresAt: now + 30 days }`; UI hiển thị subdomain mới
- **Test Data:** Tenant đổi từ `"rimba-tours"` → `"rimba-adventure"`

---

#### TC-F23-035: Settings — đổi A→B→A (đổi lại slug cũ của chính mình)
- **Priority:** P2
- **Type:** E2E + Integration
- **AC Reference:** AC-10
- **Scenario Reference:** #20 (High)
- **Precondition:** Tenant hiện tại slug `"rimba-adventure"`, trước đó là `"rimba-tours"` (trong previousSlugs, chưa expire)
- **Steps:**
  1. User muốn đổi ngược lại slug `"rimba-tours"`
  2. Nhập `"rimba-tours"` vào slug editor trong Settings
  3. Check availability
  4. Confirm đổi
- **Expected:** Cho phép đổi về `"rimba-tours"` (cùng tenant) — không bị reject với lý do "slug taken"; `previousSlugs` được cập nhật tương ứng
- **Test Data:** Tenant A có `previousSlugs: [{ slug: "rimba-tours" }]`, đang dùng `"rimba-adventure"`

---

#### TC-F23-036: Settings — 20+ previousSlugs → FIFO cleanup
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-10
- **Scenario Reference:** #14 (Medium)
- **Precondition:** Tenant có sẵn 20 entries trong `previousSlugs[]`
- **Steps:**
  1. Đổi slug lần thứ 21
  2. Query DB sau khi lưu thành công
- **Expected:** `previousSlugs[]` không vượt quá giới hạn (vd: 20 entries); entry cũ nhất/đã expire bị xóa FIFO; không có data leak
- **Test Data:** Tenant có 20 previousSlugs, đổi slug lần 21

---

#### TC-F23-037: Tenant cũ "store-7" giữ nguyên slug sau login
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-13
- **Scenario Reference:** — (backward compatibility)
- **Precondition:** Tenant cũ có slug `"store-7"` (tạo trước khi có F23)
- **Steps:**
  1. Đăng nhập với account tenant cũ
  2. Vào Settings > Domains
  3. Quan sát slug hiện tại
- **Expected:** Slug vẫn hiển thị `"store-7"` — KHÔNG bị thay đổi tự động; nút "Change subdomain" vẫn available để đổi nếu muốn
- **Test Data:** Tenant ID với slug format `"store-{id}"`

---

### 3.5 Middleware Redirect (Integration Tests)

#### TC-F23-038: 301 redirect từ old slug → new slug (previousSlugs chưa expire)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-11
- **Scenario Reference:** — (happy path redirect)
- **Precondition:** Tenant đã đổi slug từ `"old-shop"` → `"new-shop"`; `"old-shop"` trong `previousSlugs` với `expiresAt` = 15 ngày nữa
- **Steps:**
  1. Truy cập `old-shop.web-v2.dev.ecommercehub.my`
  2. Kiểm tra HTTP response
- **Expected:** HTTP 301 redirect đến `new-shop.web-v2.dev.ecommercehub.my`; redirect đến đúng path (không mất pathname)
- **Test Data:** Old slug `"old-shop"`, new slug `"new-shop"`, expiresAt = hôm nay + 15 ngày

---

#### TC-F23-039: Old slug đã expired → 404
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-12
- **Scenario Reference:** — (expired redirect)
- **Precondition:** `"expired-slug"` trong `previousSlugs` của một tenant với `expiresAt` = 31 ngày trước
- **Steps:**
  1. Truy cập `expired-slug.web-v2.dev.ecommercehub.my`
  2. Kiểm tra HTTP response
- **Expected:** HTTP 404 Not Found — KHÔNG redirect; trang 404 hiển thị đúng
- **Test Data:** `expiresAt = now - 31 days`

---

#### TC-F23-040: previousSlugs expiresAt null → treat as expired
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-12
- **Scenario Reference:** #25 (High)
- **Precondition:** `previousSlugs` entry có `expiresAt = null` (data cũ hoặc migration incomplete)
- **Steps:**
  1. Tạo previousSlugs entry với `expiresAt = null` trong DB trực tiếp
  2. Truy cập slug tương ứng
  3. Kiểm tra HTTP response
- **Expected:** Treat as expired — HTTP 404; KHÔNG redirect vô tận
- **Test Data:** `previousSlugs: [{ slug: "null-expire-slug", expiresAt: null }]`

---

#### TC-F23-041: 2 tenants có cùng previousSlug → redirect tenant mới nhất
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-11
- **Scenario Reference:** #26 (High)
- **Precondition:** Hai tenant A và B đều có `"shared-slug"` trong `previousSlugs` (edge case do conflict cũ)
- **Steps:**
  1. Query DB để verify edge case tồn tại
  2. Truy cập `shared-slug.web-v2.dev.ecommercehub.my`
  3. Kiểm tra redirect destination
- **Expected:** Redirect đến tenant có `expiresAt` gần nhất (mới nhất); KHÔNG redirect vòng; KHÔNG expose conflict
- **Test Data:** 2 tenants cùng có `"shared-slug"` trong previousSlugs với expiresAt khác nhau

---

#### TC-F23-042: Middleware previousSlugs query fail → serve normally (không block traffic)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-11
- **Scenario Reference:** #30 (Critical)
- **Precondition:** Giả lập DB query fail khi middleware cố tra cứu previousSlugs
- **Steps:**
  1. Mock DB connection error hoặc query timeout trong middleware context
  2. Truy cập một subdomain bất kỳ
  3. Kiểm tra response
- **Expected:** Middleware skip redirect logic; serve request normally (hoặc 404 nếu slug không tồn tại); KHÔNG throw 500; KHÔNG block traffic
- **Test Data:** DB query simulate timeout/error

---

#### TC-F23-043: Middleware redirect — DB migration fail → 500 + log
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** — (infra)
- **Scenario Reference:** #28 (High)
- **Precondition:** `previousSlugs` column không tồn tại trong DB (migration chưa chạy)
- **Steps:**
  1. Simulate missing column bằng cách drop/rename column trên staging DB test
  2. Truy cập một subdomain
  3. Kiểm tra logs
- **Expected:** Server logs lỗi rõ ràng (column not found); HTTP 500 hoặc graceful fallback; không crash toàn app
- **Test Data:** DB thiếu column `previousSlugs`

---

#### TC-F23-044: Middleware redirect — redirect timeout → serve 404 gracefully
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-11
- **Scenario Reference:** #13 (High)
- **Precondition:** DB query cho previousSlugs timeout >timeout threshold
- **Steps:**
  1. Simulate slow DB response (>timeout) trong middleware
  2. Truy cập old slug URL
  3. Kiểm tra response behavior
- **Expected:** Middleware timeout gracefully — serve 404 thay vì hang indefinitely; response time <threshold
- **Test Data:** DB query simulate 5s+ delay

---

### 3.6 Security & Authorization (Security Tests)

#### TC-F23-045: XSS qua slug trong URL subdomain
- **Priority:** P1
- **Type:** Security
- **AC Reference:** AC-01, AC-06
- **Scenario Reference:** #5 (Critical)
- **Precondition:** Middleware xử lý hostname từ subdomain
- **Steps:**
  1. Tạo request với hostname `"<script>alert(1)</script>.web-v2.dev.ecommercehub.my"` (hoặc simulate qua Host header)
  2. Kiểm tra middleware xử lý như thế nào
  3. Kiểm tra response — không có XSS execution
- **Expected:** Middleware extract slug, slugify/sanitize hostname; KHÔNG reflect raw hostname ra HTML; không có XSS execution
- **Test Data:** Host header: `<script>alert(1)</script>.web-v2.dev.ecommercehub.my`

---

#### TC-F23-046: SQL injection qua slug check API parameter
- **Priority:** P1
- **Type:** Security
- **AC Reference:** AC-03
- **Scenario Reference:** #6 (Critical)
- **Precondition:** `/api/slug/check` dùng ORM (Payload) để query DB
- **Steps:**
  1. Gọi `GET /api/slug/check?slug='; DROP TABLE tenants; --`
  2. Kiểm tra response
  3. Verify DB vẫn intact sau request
- **Expected:** HTTP 422 (format validation reject trước khi đến DB); DB không bị modify; ORM parameterized query không bị bypass
- **Test Data:** `slug='; DROP TABLE tenants; --`, `slug=" OR "1"="1`

---

#### TC-F23-047: Race condition — 2 users đồng thời claim cùng slug
- **Priority:** P1
- **Type:** Integration + Security
- **AC Reference:** AC-02
- **Scenario Reference:** #9 (Critical)
- **Precondition:** 2 user accounts riêng biệt; slug `"popular-shop"` chưa tồn tại
- **Steps:**
  1. User A và User B đồng thời check `"popular-shop"` → cả 2 đều thấy "Available"
  2. Cả 2 đồng thời submit onboarding với slug `"popular-shop"`
  3. Kiểm tra DB sau khi cả 2 request complete
- **Expected:** DB unique constraint đảm bảo chỉ 1 user thành công; user còn lại nhận error + suggestion slug khác; KHÔNG có 2 tenants cùng slug
- **Test Data:** Concurrent requests từ 2 sessions khác nhau

---

#### TC-F23-048: Check API public — không cần auth, nhưng không leak data
- **Priority:** P1
- **Type:** Security
- **AC Reference:** AC-03
- **Scenario Reference:** #23 (Medium)
- **Precondition:** Endpoint là public (unauthenticated)
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=existing-tenant` không có token
  2. Thử enumerate các slug theo pattern: `store-1`, `store-2`, ..., `store-100`
  3. Kiểm tra response của từng slug
- **Expected:** Response chỉ trả về `available: true/false` — không có tenant details; rate limiting kick in sau 30 req/min; không thể deduce số lượng tenants từ response time
- **Test Data:** Enumerate 50+ slugs nhanh từ 1 IP

---

### 3.7 Edge Cases & Error Handling

#### TC-F23-049: Slug "admin" — reserved → rejected ở cả API và Payload hook
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-05
- **Scenario Reference:** — (double layer validation)
- **Precondition:** Reserved words blocklist có `"admin"`, `"www"`, `"api"`, `"login"`, `"billing"`
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=admin` → verify 409
  2. Gọi `PATCH /api/tenant/slug` với `{ slug: "admin" }` → verify reject
  3. Thử qua Payload admin panel (AC-24 scenario) → verify hook reject
- **Expected:** Tất cả 3 paths đều reject; lỗi message nhất quán; DB không có tenant nào với slug reserved
- **Test Data:** Reserved words: `admin`, `www`, `api`, `app`, `login`, `billing`, `primeweb`, `ecommercehub`

---

#### TC-F23-050: Slug empty string → fallback behavior
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-06
- **Scenario Reference:** #1 (High)
- **Precondition:** Endpoint có validation
- **Steps:**
  1. Gọi `GET /api/slug/check?slug=` (empty string)
  2. Gọi `PATCH /api/tenant/slug` với `{ slug: "" }` (empty)
- **Expected:** Cả 2 call trả về HTTP 422 với message rõ ràng; không crash; không lưu empty slug vào DB
- **Test Data:** `slug=""`, `slug=null`, `slug=undefined` (query param missing)

---

#### TC-F23-051: Suspended tenant slug vẫn được giữ reserved
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** — (business rule)
- **Scenario Reference:** #35 (Medium)
- **Precondition:** Tenant A bị suspend (status = suspended); slug là `"suspended-shop"`
- **Steps:**
  1. User B cố check slug `"suspended-shop"`
  2. Gọi `GET /api/slug/check?slug=suspended-shop`
- **Expected:** `available: false` — slug của tenant bị suspend vẫn được giữ; User B không thể lấy slug này (prevent squatting)
- **Test Data:** Tenant với `status = "suspended"` và slug `"suspended-shop"`

---

#### TC-F23-052: Redis cache down → fallback đến DB query cho slug check
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-03
- **Scenario Reference:** #31 (Medium)
- **Precondition:** Redis unavailable (stop Redis container hoặc mock failure)
- **Steps:**
  1. Stop Redis / simulate Redis connection failure
  2. Gọi `GET /api/slug/check?slug=mybakery`
  3. Đo response time
- **Expected:** API vẫn trả về kết quả đúng (query thẳng DB); response time có thể >200ms nhưng không lỗi; không crash; log warning về Redis unavailable
- **Test Data:** Redis down, slug `"mybakery"` check

---

#### TC-F23-053: Subdomain input — IME tiếng Việt không rớt ký tự (composition)
- **Priority:** P1
- **Type:** Unit (component)
- **AC Reference:** — (BUG #1459)
- **Scenario Reference:** — (regression)
- **Precondition:** `/settings/domains`, đang ở chế độ "Change subdomain" (input slug hiển thị)
- **Steps:**
  1. `compositionStart` trên input (mô phỏng IME Telex/VNI/Unikey bắt đầu compose)
  2. `change` với giá trị `"shopđ"` khi đang compose
  3. `compositionEnd` với giá trị `"shopđ"`
- **Expected:** Trong lúc compose, buffer giữ nguyên `"shopđ"` (KHÔNG bị sanitize giữa chừng → không rớt ký tự); sau `compositionEnd` giá trị được lọc còn `"shop"` (`[a-z0-9-]`)
- **Test Data:** Chuỗi compose `"shopđ"` → kết quả `"shop"`
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-054: Subdomain input — EN keyboard vẫn lowercase + strip khi gõ
- **Priority:** P1
- **Type:** Unit (component)
- **AC Reference:** — (BUG #1459)
- **Scenario Reference:** — (regression)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain", không có composition
- **Steps:**
  1. `change` với giá trị `"My-Shop!@#"`
- **Expected:** Không regression — giá trị được lowercase + strip ký tự lạ ngay lập tức → `"my-shop"`
- **Test Data:** `"My-Shop!@#"` → `"my-shop"`
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-055: Subdomain input — không còn bị chốt cứng 280px
- **Priority:** P1
- **Type:** Unit (component)
- **AC Reference:** — (BUG #1459)
- **Scenario Reference:** — (regression)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain"
- **Steps:**
  1. Render input, đọc className của container + input
- **Expected:** Container KHÔNG chứa `max-w-[280px]`, có `sm:max-w-[520px]`; input giữ `flex-1` + `min-w-0` để slug dài tới 63 ký tự luôn hiển thị
- **Test Data:** —
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-056: Subdomain edit — message validation không bị cắt trên mobile
- **Priority:** P1
- **Type:** Unit (component)
- **AC Reference:** — (BUG #1583)
- **Scenario Reference:** — (regression)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain"
- **Steps:**
  1. Đọc className của row bao ngoài (cha của input-group)
  2. Idle: đếm số con của row
  3. `change` với giá trị `"ab"` (< 3 ký tự), chờ debounce 400ms
- **Expected:** Row có `flex-wrap` (mobile: input `w-full` → message rớt xuống dưới, không tràn viewport); idle KHÔNG render status div (tránh dòng wrap rỗng); message `"At least 3 characters"` có `break-words`, container có `min-w-0`, không còn `ml-2`
- **Test Data:** `"ab"` → invalid
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-057: Subdomain edit — gõ về đúng slug hiện tại thì message lỗi cũ tự reset
- **Priority:** P2
- **Type:** Unit (component)
- **AC Reference:** — (BUG #1583)
- **Scenario Reference:** — (regression)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain"
- **Steps:**
  1. `change` với giá trị `"ab"` → chờ debounce → message `"At least 3 characters"` xuất hiện
  2. `change` về đúng slug hiện tại (`"mywebstore"`)
- **Expected:** Status reset về `idle` — message lỗi cũ biến mất (trước đây effect early-return khi `slugInput === currentSlug` mà không reset status → message treo)
- **Test Data:** `"ab"` → invalid → `"mywebstore"` → idle
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-058: Subdomain edit — response check về muộn (sau khi revert input) bị bỏ, không đè UI
- **Priority:** P1
- **Type:** Unit (component)
- **AC Reference:** — (BUG #1583, review PR #1596)
- **Scenario Reference:** — (race: fetch in-flight vs revert)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain", fetch mock deferred (không resolve ngay)
- **Steps:**
  1. Gõ `"shop-race"` → chờ debounce → fetch được dispatch (chưa resolve)
  2. Revert input về đúng slug hiện tại → status reset `idle`
  3. Resolve fetch (kết quả `unavailable`)
- **Expected:** Seq guard bỏ response cũ — KHÔNG hiện `"Already taken"` cạnh slug hiện tại (chống biến thể race của #1583); cơ chế này đồng thời chặn 2 fetch chồng nhau resolve ngược thứ tự
- **Test Data:** deferred fetch, `"shop-race"` → revert `"mywebstore"`
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-059: Subdomain edit — gõ tiếp sau verdict `available` thì Save disable ngay lập tức
- **Priority:** P1
- **Type:** Unit (component)
- **AC Reference:** — (review PR #1596)
- **Scenario Reference:** — (cửa sổ 400ms debounce: Save sáng với status của slug cũ)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain", fetch mock trả `available: true`
- **Steps:**
  1. Gõ `"shop-a"` → chờ check → Save enabled
  2. Gõ thêm 1 ký tự (`"shop-ab"`) → assert Save disabled NGAY (không chờ debounce)
- **Expected:** Verdict cũ hết hiệu lực ngay khi input đổi — user không thể Save slug chưa được check
- **Test Data:** `"shop-a"` (available) → `"shop-ab"`
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-060: Subdomain edit — dừng gõ giữa IME composition không bắn check; check chạy sau compositionEnd
- **Priority:** P2
- **Type:** Unit (component)
- **AC Reference:** — (review PR #1596, liên quan #1459 IME)
- **Scenario Reference:** — (debounce fire với raw buffer IME)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain", đang composition (IME tiếng Việt)
- **Steps:**
  1. `compositionStart` → `change` với buffer `"shopd"` → đợi > 400ms (vẫn đang composition)
  2. Assert fetch KHÔNG được gọi
  3. `compositionEnd` với `"shopd"` (sanitize xong không đổi giá trị)
- **Expected:** Không có request nào cho buffer chưa chốt; sau compositionEnd check vẫn chạy cho giá trị đã chốt (state `isComposingSlug` đảm bảo effect re-run kể cả khi input không đổi)
- **Test Data:** `"shopd"` (buffer ASCII — case khó: sanitize không đổi)
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

#### TC-F23-061: Subdomain edit — Cancel giữa IME composition không làm kẹt checker ở session sau
- **Priority:** P2
- **Type:** Unit (component)
- **AC Reference:** — (review PR #1596 — comment levietducprime)
- **Scenario Reference:** — (flag `isComposingSlug` kẹt true khi input unmount trước compositionend)
- **Precondition:** `/settings/domains`, chế độ "Change subdomain", đang composition
- **Steps:**
  1. `compositionStart` → `change` buffer → bấm **Cancel** (input unmount, compositionend không bao giờ bắn)
  2. Bấm "Change subdomain" vào lại edit mode → gõ slug hợp lệ
- **Expected:** Flag composition được reset khi vào edit mode → check chạy bình thường → Save enable; không fix thì effect debounce early-return vĩnh viễn, Save không bao giờ sáng
- **Test Data:** `"shopcomposing"` (đang compose) → Cancel → `"shop-fresh"` → available
- **Automated:** `src/__tests__/unit/dashboard/f19-domains-client.test.tsx`

---

## 4. Traceability Matrix — AC → TC

| AC | Mô tả | Test Cases | Coverage |
|----|-------|-----------|---------|
| AC-01 | Slugify chuẩn `[a-z0-9-]` | TC-F23-001, TC-F23-002, TC-F23-003, TC-F23-004, TC-F23-005, TC-F23-006, TC-F23-007 | 7 TCs |
| AC-02 | Collision handling — auto suffix | TC-F23-009, TC-F23-010, TC-F23-022, TC-F23-047 | 4 TCs |
| AC-03 | Check API — available <200ms | TC-F23-011, TC-F23-017, TC-F23-018, TC-F23-048, TC-F23-052 | 5 TCs |
| AC-04 | Check API — unavailable + suggestion | TC-F23-012, TC-F23-017 | 2 TCs |
| AC-05 | Từ chối reserved words | TC-F23-013, TC-F23-024, TC-F23-049 | 3 TCs |
| AC-06 | Validate format slug | TC-F23-014, TC-F23-015, TC-F23-016, TC-F23-008, TC-F23-050 | 5 TCs |
| AC-07 | SlugPicker real-time, debounce 400ms | TC-F23-026, TC-F23-027, TC-F23-028, TC-F23-029, TC-F23-031 | 5 TCs |
| AC-08 | Slug lưu khi generate site | TC-F23-030, TC-F23-023 | 2 TCs |
| AC-09 | Settings hiển thị subdomain + editor | TC-F23-032, TC-F23-033 | 2 TCs |
| AC-10 | previousSlugs lưu khi đổi slug | TC-F23-034, TC-F23-035, TC-F23-036, TC-F23-021 | 4 TCs |
| AC-11 | 301 redirect old slug | TC-F23-038, TC-F23-041, TC-F23-042, TC-F23-044 | 4 TCs |
| AC-12 | Old slug expired → 404 | TC-F23-039, TC-F23-040 | 2 TCs |
| AC-13 | Tenant cũ giữ nguyên store-{id} | TC-F23-037 | 1 TC |

**Coverage: 13/13 ACs = 100%**

---

## 5. Scenario Coverage Matrix

### 5.1 Critical Scenarios (Bắt buộc có TC)

| Scenario | Mô tả | TC Coverage | Status |
|----------|-------|-------------|--------|
| #5 | XSS injection `<script>alert(1)</script>` | TC-F23-005, TC-F23-045 | Covered |
| #6 | SQL injection `'; DROP TABLE tenants; --` | TC-F23-006, TC-F23-046 | Covered |
| #9 | Race condition 2 users cùng slug | TC-F23-009, TC-F23-047 | Covered |
| #21 | PATCH không có token → 401 | TC-F23-019 | Covered |
| #22 | User A đổi slug tenant B → 403 | TC-F23-020 | Covered |
| #27 | previousSlugs conflict cross-tenant | TC-F23-022 | Covered |
| #30 | Middleware previousSlugs query fail | TC-F23-042 | Covered |

**Critical Coverage: 6/6 = 100%**

### 5.2 High Scenarios (Bắt buộc có TC)

| Scenario | Mô tả | TC Coverage | Status |
|----------|-------|-------------|--------|
| #1 | Empty string slug | TC-F23-050 | Covered |
| #2 | Vietnamese: "Cà Phê Nguyên Chất" | TC-F23-002 | Covered |
| #4 | Slug >63 chars → truncate | TC-F23-004 | Covered |
| #10 | Check available but create fails (race) | TC-F23-047 | Covered |
| #13 | Middleware redirect timeout | TC-F23-044 | Covered |
| #16 | Collision loop 5+ retries → 409 | TC-F23-010 | Covered |
| #18 | Settings slug change + network loss | TC-F23-023 | Covered |
| #20 | User đổi A→B→A (back to original) | TC-F23-035 | Covered |
| #25 | previousSlugs expiresAt null | TC-F23-040 | Covered |
| #26 | 2 tenants same previousSlug | TC-F23-041 | Covered |
| #28 | DB migration fail | TC-F23-043 | Covered |

**High Coverage: 10/10 = 100%**

### 5.3 Medium Scenarios (Nên có TC)

| Scenario | Mô tả | TC Coverage | Status |
|----------|-------|-------------|--------|
| #3 | Emoji "🍰🎂 Shop" → "shop" | TC-F23-003 | Covered |
| #7 | Slug "---" → empty → fallback | TC-F23-007 | Covered |
| #8 | Pure numbers "12345" → reject | TC-F23-008 | Covered |
| #11 | Spam check API 100 req/s | TC-F23-018 | Covered |
| #14 | 20+ previousSlugs → FIFO cleanup | TC-F23-036 | Covered |
| #17 | Close tab, reopen → re-check slug | TC-F23-031 | Covered |
| #23 | Public check endpoint → no data leak | TC-F23-017, TC-F23-048 | Covered |
| #24 | Super-admin qua Payload panel | TC-F23-024 | Covered |
| #31 | Redis cache down → fallback DB | TC-F23-052 | Covered |
| #32 | Rate limit slug changes 3/month | TC-F23-025 | Covered |
| #33 | Competitor brand slug → reserved | TC-F23-049 | Covered (blocklist) |
| #35 | Suspended tenant slug → reserved | TC-F23-051 | Covered |

**Medium Coverage: 12/12 = 100%**

---

## 6. Test Data Requirements

### 6.1 Business Names cho Slugify Tests

| Input | Expected Output | Dùng cho |
|-------|----------------|---------|
| `"Rimba Adventure Tours & Co."` | `"rimba-adventure-tours-co"` | AC-01, TC-001 |
| `"Cà Phê Nguyên Chất"` | `"ca-phe-nguyen-chat"` | AC-01, TC-002 |
| `"My Bakery"` | `"my-bakery"` | AC-07, TC-026 |
| `"🍰🎂 Shop"` | `"shop"` | AC-01, TC-003 |
| `"<script>alert(1)</script>"` | clean output (no HTML) | Security, TC-005 |
| `"'; DROP TABLE tenants; --"` | clean alphanumeric only | Security, TC-006 |
| `"---"` | `"my-store"` (fallback) | Edge case, TC-007 |
| 80+ char business name | output ≤63 chars | TC-004 |
| `"12345"` | rejected (pure numbers) | TC-008 |

### 6.2 Slug Strings cho API Tests

| Slug | Tình trạng | Dùng cho |
|------|-----------|---------|
| `"mybakery"` | Available (không có trong DB) | TC-011 |
| `"rimba-tours"` | Taken (có trong DB staging) | TC-012, TC-028 |
| `"admin"` | Reserved | TC-013, TC-049 |
| `"www"`, `"api"`, `"login"` | Reserved | TC-049 |
| `"ab"` | Too short (<3 chars) | TC-014 |
| `"-invalid-"` | Starts/ends with hyphen | TC-016 |
| `"MY STORE"` | Uppercase + space | TC-015 |
| `"my_store"`, `"my.store"` | Invalid chars | TC-015 |
| `""` (empty) | Empty string | TC-050 |

### 6.3 DB Test Data

| Cần tạo | Mục đích |
|---------|---------|
| Tenant với slug `"rimba-tours"` (active) | Test taken slug, collision |
| Tenant với `previousSlugs: [{slug: "old-shop", expiresAt: +15d}]` | Test 301 redirect |
| Tenant với `previousSlugs: [{slug: "expired-slug", expiresAt: -31d}]` | Test 404 expired |
| Tenant với `previousSlugs: [{slug: "null-expire-slug", expiresAt: null}]` | Test null expiresAt |
| Tenant bị suspend với slug `"suspended-shop"` | Test reserved suspended |
| Tenant cũ với slug `"store-7"` | Test backward compatibility |
| 2 tenants với cùng previousSlug `"shared-slug"` | Test cross-tenant conflict |
| Tenant với 20 entries trong `previousSlugs[]` | Test FIFO cleanup |

### 6.4 Security Payloads

| Payload | Loại | Dùng cho |
|---------|------|---------|
| `<script>alert(1)</script>` | XSS | TC-005, TC-045 |
| `<img src=x onerror=alert(1)>` | XSS | TC-045 |
| `'; DROP TABLE tenants; --` | SQLi | TC-006, TC-046 |
| `" OR "1"="1` | SQLi | TC-046 |
| `../../../etc/passwd` | Path traversal | TC-045 |
| Slug với 31 requests/minute | Rate limit | TC-018 |

---

## 7. E2E UAT Flow (Hành trình End-to-End)

### Flow 1: Onboarding với Custom Slug
1. User mới đăng nhập → vào `/onboarding`
2. Nhập business name `"My Bakery Shop"` → SlugPicker auto-populate `"my-bakery-shop"`
3. Debounce 400ms → API check → badge "Available" (xanh)
4. User chỉnh slug thành `"my-bakery"` (ngắn hơn)
5. Re-check → "Available" → Submit
6. Site generated với `tenant.slug = "my-bakery"`
7. Verify: `my-bakery.web-v2.dev.ecommercehub.my` load đúng

### Flow 2: Settings Slug Change + Redirect
1. User login với tenant slug `"rimba-tours"`
2. Vào Settings > Domains → thấy `rimba-tours.web-v2.dev.ecommercehub.my`
3. Click "Change subdomain" → nhập `"rimba-adventure"` → Available
4. Click Save → confirmation dialog SEO warning → Confirm
5. Slug đổi thành công → DB: `slug="rimba-adventure"`, `previousSlugs=[{slug:"rimba-tours", expiresAt:+30d}]`
6. Truy cập `rimba-tours.web-v2.dev.ecommercehub.my` → 301 → `rimba-adventure.web-v2.dev.ecommercehub.my`
7. Sau 30 ngày: `rimba-tours.web-v2.dev.ecommercehub.my` → 404

---

## 8. Quality Gates

| Nhóm kiểm thử | Target | Ghi chú |
|---------------|--------|---------|
| Unit Tests (slugify) | 100% pass | Bắt buộc trước khi merge |
| API Integration | 100% P1 TCs pass | `/api/slug/check` + `/api/tenant/slug` |
| Security Tests | 0 vulnerabilities P1 | XSS, SQLi, Auth bypass |
| E2E Onboarding Flow | Flow 1 pass hoàn toàn | Playwright |
| E2E Settings Flow | Flow 2 pass hoàn toàn | Playwright |
| Performance | Check API <200ms | Đo trên staging |
| Backward Compatibility | Tenant cũ `store-{id}` không bị ảnh hưởng | TC-F23-037 |

---

*Tài liệu này cover 13/13 ACs, 6/6 Critical scenarios, 10/10 High scenarios, 12/12 Medium scenarios.*
*Tổng: 61 Test Cases — 19 Unit, 18 Integration, 8 E2E, 6 Security, 10 Edge Cases.*
*TC-F23-053..055 bổ sung cho BUG #1459 (subdomain input width + IME tiếng Việt).*
*TC-F23-056..057 bổ sung cho BUG #1583 (message validation tràn khỏi màn hình mobile + message lỗi treo khi gõ về slug hiện tại).*
*TC-F23-058..060 bổ sung từ adversarial review PR #1596 (seq guard chống response về muộn, Save disable ngay khi gõ tiếp, IME composition không bắn check).*
*TC-F23-061 bổ sung từ review comment PR #1596 (reset flag composition khi vào edit mode — chống kẹt checker sau Cancel giữa composition).*
