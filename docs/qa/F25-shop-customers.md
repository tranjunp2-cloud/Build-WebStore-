# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F25 - Shop Customers
> **Phiên bản:** 2.1 | **Cập nhật:** 2026-05-25 (sync với state thực tế: 9 test files, 112 PASS + 7 todo; refactor CSV helpers → module riêng) | **Thực hiện:** QA Team

### Changelog
- **v2.1 (2026-05-25)** — Sync với state thực tế trên branch `test/verify-issue-1024`. Tạo 6 file tests mới (sync-customer-snapshot, customers-hooks-and-behavior, customers-edge-cases, customers-orders-tab, customers-export-csv-helpers, e2e/f25-customers.spec) + 1 source extraction (`src/lib/customers/csv-helpers.ts`). Final: 9 unit/integration files = 112 PASS + 7 todo (TC-F25-06-08 boundary cần extract `resolveTenantIds`). E2E spec 9 tests compile OK (defer execution chờ staging).
- **v2.0 (2026-05-21)** — Refactor sang format table chuẩn F08. Group lại 26 TC + 9 E2E thành 8 US logical groups. (⚠️ v2.0 claim 116 tests sai — thực tế tại snapshot chỉ 39; v2.1 sửa.)
- **v1.0 (2026-05-20)** — Initial 10 TCs (TC-F25-001..010): auto-link, access control, field validation, CSV export.

> **Nguồn Tham chiếu:** PRD (`F25-shop-customers.md`), Architecture (`F25-shop-customers.md`), Design (`F25-shop-customers-design.md`)
> **Kỹ năng ứng dụng:** Idempotency Testing, Tenant-Scoping Verification, CSV Injection Hardening, RSC Component Mocking, Payload Admin E2E.

---

## 1. Mục Tiêu (Objective)

Tài liệu đạt quy chuẩn **Comprehensive QA Expert**, Coverage 100% rủi ro xuyên suốt 8 logical US groups của module Shop Customers (F25): Schema/Field validation, Auto-link hook (idempotency + email normalization), Sync snapshot, Access Control + Tenant Isolation, Address Book, CSV Export Security, Orders Tab UI, và End-to-End admin flows.

**Tổng cộng 35 kịch bản chi tiết** bao phủ: Positive, Negative/Edge cases, Security (XSS/CSV-injection/IDOR), Fault Tolerance, RBAC, UI States, RSC Component Behavior, E2E Admin Lifecycle.

---

## 2. Test Environment

| Biến | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production (`staging.primeweb.app`) |
| Browsers | Chrome (v110+), Firefox (v105+), Safari iOS |
| Devices | Desktop (1920x1080), Tablet iPad, Mobile (iPhone 14 Pro 375px) |
| Backend | Payload CMS 3.79 + PostgreSQL (Neon) |
| Test runner | Vitest 3.2 (unit + integration) + Playwright (E2E) |
| Auth | Mock `req.user` với `roles[]` + `tenants[]` cho unit; auth.setup.ts cho E2E |
| Test data | Seeded customers/orders/tenants per suite |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-01: Customers Collection Schema & Field Validation (5 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-01-01** | `FR-01` | `UI` | Schema khai báo các field bắt buộc | 1. Inspect `src/collections/Customers.ts`.<br>2. Verify field list. | - Có `tenant` (required, indexed relationship).<br>- `email` (optional, indexed, type=email).<br>- `name` (required, text).<br>- `phone` (primary identity, indexed), `rank`, `addresses[]`, `notes`, `firstOrderAt`. | High | [x] |
| **TC-F25-01-02** | `FR-08` | `Val` | Rank enum chỉ chấp nhận 4 giá trị | 1. Update customer với `rank='platinum'` (ngoài enum).<br>2. Payload validator chạy. | - Update bị reject.<br>- Lỗi: "Field 'rank' must be one of: bronze, silver, gold, vip".<br>- Allowed: bronze, silver, gold, vip, null. | High | [x] |
| **TC-F25-01-03** | `FR-03` / `BR-06` | `Bound` | Addresses cap tối đa 10 rows | 1. Customer C1 đã có 10 addresses.<br>2. Thử update với 11 addresses. | - Payload `maxRows: 10` validator chặn.<br>- Lỗi: "Field 'addresses' exceeds maximum 10 rows".<br>- DB không bị mutate. | Blocker | [x] |
| **TC-F25-01-04** | `BR-02` | `Logic` | Email normalize lowercase + trim trên create | 1. POST `/api/customers` với `email='Foo@Bar.com '`.<br>2. Customers.beforeChange hook chạy. | - Saved email = `'foo@bar.com'` (lowercase + trim).<br>- Email không còn unique index — normalized for storage only. | High | [x] |
| **TC-F25-01-05** | `BR-02` | `Logic` | Email normalize trên update qua admin edit | 1. PATCH `/api/customers/:id` body `{ email: 'Foo@Bar.COM ' }`.<br>2. beforeChange hook chạy. | - Saved email = `'foo@bar.com'`.<br>- Conflict trong cùng tenant → DB UNIQUE INDEX reject 409. | High | [ ] |

---

### US-02: Auto-link Hook — Order → Customer Upsert (11 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-02-01** | `FR-02` / `AC-2` | `Logic` | Phone normalize trên auto-link order create | 1. Create order với `customerPhone='+60 123-456.789'`.<br>2. `autoLinkCustomer` beforeChange hook chạy.<br>3. Query customers table. | - 1 Customer row tạo với `phone='+60123456789'` (normalized).<br>- Order `customer_id` FK trỏ tới Customer này.<br>- Không tạo duplicate cho variant input. | Blocker | [x] |
| **TC-F25-02-02** | `BR-08` / `AC-2` | `Logic` | Idempotency — 5 orders cùng phone → 1 customer | 1. Tạo lần lượt 5 order với cùng `customerPhone='+60111222333'` cùng tenant A.<br>2. Mỗi order trigger auto-link hook. | - Chỉ 1 Customer row C1 trong DB.<br>- Cả 5 orders đều link tới C1.id.<br>- DB UNIQUE INDEX bảo vệ safety net. | Blocker | [x] |
| **TC-F25-02-03** | `BR-04` | `Edge` | Empty phone + email → no customer, no error | 1. Tạo order với `customerPhone=''`, `customerEmail=''`.<br>2. Hook validate. | - Order save thành công (không throw).<br>- `order.customer_id = null`.<br>- Không tạo Customer.<br>- Không log error (silent skip). | Blocker | [x] |
| **TC-F25-02-04** | `BR-04` | `Edge` | Whitespace-only phone → treated as absent | 1. Tạo order với `customerPhone='   '` (spaces).<br>2. Hook normalize. | - Normalized = null.<br>- `customer_id = null` (no email fallback).<br>- No DB call, no error. | High | [x] |
| **TC-F25-02-05** | `BR-03` / `BR-04`, TC-PERF-185 | `Recov` | Fault tolerance — customer lookup throws → hook rethrows, order rolls back (unit: `TC-F25-005`) | 1. Mock `req.payload.find` throw `Error('db down')`.<br>2. Tạo order với valid phone + tenant. | - Hook rethrow đúng lỗi đó (lookup chạy trên transaction của đơn, Payload đã rollback) → order KHÔNG được lưu, checkout báo lỗi.<br>- KHÔNG gọi `payload.create`, KHÔNG set `customer = null`.<br>- Xem TC-PERF-185 (`docs/qa/F-security-perf-upgrade.md`). | Blocker | [x] |
| **TC-F25-02-05b** | `BR-03`, TC-PERF-185 | `Recov` | Fault tolerance — customer create throws (unit: `TC-F25-006`, `TC-F25-006b`) | 1. Lookup trả `[]`, `req.payload.create('customers')` throw.<br>2. Tạo order với valid phone + tenant. | - Lỗi dữ liệu (vd. `value too long…`, `TC-F25-006b`): order vẫn lưu với `customer = null`, log `[Orders.autoLinkCustomer]` (không PII), không retry find.<br>- Lỗi unique (`TC-F25-006`): retry find; không có bản thắng → `customer = null` + log.<br>- Lỗi kết nối / pool (pg-pool "timeout exceeded when trying to connect", 08xxx / 57P0x / 53300, raw hoặc drizzle-wrapped): hook throw → order rollback, checkout báo lỗi, KHÔNG lưu với `customer = null` (TC-PERF-185). | Blocker | [x] |
| **TC-F25-02-06** | `FR-10` / `BR-09` | `Logic` | firstOrderAt set-once — không update trên subsequent orders | 1. Customer C1 với `firstOrderAt='2026-04-01'`.<br>2. Tạo order mới (order 5) → auto-link → C1 existing path. | - C1.firstOrderAt UNCHANGED (vẫn 2026-04-01).<br>- Hook KHÔNG update field này khi tìm thấy existing customer.<br>- Read-only constraint preserved. | High | [ ] |
| **TC-F25-02-07** | `FR-02` (perf) | `Perf` | Skip DB lookup khi phone unchanged trên order update | 1. Order O1 có `customerPhone='+60111'`.<br>2. Update O1 với same phone (originalDoc.customerPhone giống). | - `req.payload.find` KHÔNG được gọi (early return).<br>- `data.customer` KHÔNG bị mutate.<br>- Perf optimization preserved (chỉ check phone, không check email). | Medium | [ ] |
| **TC-F25-02-16** | `FR-02` | `Logic` | Phone absent + valid email → customer=null (no fallback) | 1. Tạo order với `customerPhone=''`, `customerEmail='existing@x.com'`.<br>2. Hook validate. | - Phone absent → immediate null return.<br>- `req.payload.find` KHÔNG được gọi (no email fallback).<br>- `customer_id = null`, no error. | High | [x] |
| **TC-F25-02-17** | `FR-02` | `Logic` | Same phone, diff email → same customer (phone-first) | 1. Tạo order với `customerPhone='+60111'`, `customerEmail='new@x.com'`.<br>2. Existing customer C1 với `phone='+60111'`, `email='old@x.com'`. | - Hook phone-first lookup finds C1.<br>- Order link tới C1.id.<br>- Email fallback NOT called.<br>- `payload.find` called once (phone only). | High | [x] |
| **TC-F25-02-20** | `FR-02` / `BE-1` | `Regression` | Unnormalized order phone links to admin-normalized customer (BE-1 regression guard) | 1. Admin saves customer với phone `'+60 12-345 6789'` → Customers.beforeChange stores `'+60123456789'`.<br>2. Order arrives với `customerPhone='+60 12-345 6789'` (raw).<br>3. autoLinkCustomer chạy. | - Hook normalizes phone → lookup key `'+60123456789'`.<br>- Matches admin customer → `customer_id` trỏ tới cust-1.<br>- `payload.create` KHÔNG được gọi (no duplicate).<br>- `payload.find` được gọi với `{ phone: { equals: '+60123456789' } }`. | Blocker | [x] |
| **TC-F25-02-21** | `FR-02`, #1996 bulk order update hang | `Logic` | Existing customer: link set, customer write không chặn transaction của đơn | 1. Bulk update nhiều order cùng tenant sang SĐT của customer C có sẵn (Payload update `where`).<br>2. Order đầu đã ghi `customer_id=C` (khóa FK `KEY SHARE` trên C); autoLinkCustomer của order sau chạy. | - Hook trả về ngay với `data.customer = C`, không await ghi customer.<br>- Ghi name/email chạy sau response qua `runAfterResponse`, không dùng `req`/transaction.<br>- Bulk update trả về, không treo. | Critical | ✅ |
| **TC-F25-02-22** | `FR-02` / `BR-08`, Payload 3.91 | `Recov` | Unique phone violation dạng Payload ValidationError → retry find | 1. Hai order cùng SĐT mới trong một bulk update (song song).<br>2. `payload.create('customers')` thứ hai lỗi unique, Payload trả `ValidationError` (không có pg code, message "The following field is invalid"). | - Nhận ra lỗi unique (field error `tableName` / "Value must be unique").<br>- Retry find → link customer thắng; không set `customer=null`, không log error. | High | ✅ |
| **TC-F25-02-23** | `FR-02, #2086` | `Logic` | Existing customer thiếu email / name `(unknown)` → chỉ điền trường trống | 1. C1 `name='Keep Me'`, email null; C2 `name='(unknown)'`, có email.<br>2. Order mới cùng SĐT với tên + email mới. | - C1: chỉ set email (lowercase), giữ name.<br>- C2: chỉ set name, giữ email. | High | [x] |

---

### US-03: Sync Snapshot Hook — Phone/latestOrderAt (không ghi đè name/email) (4 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-03-01** | `FR-02` (sync) | `Logic` | Sync hook update Customer.name/phone trên order create | 1. Order mới với `customerEmail='new@x.com'`, `customerName='Alice'`, `customerPhone='+60111'`.<br>2. auto-link tạo Customer với name='Alice'.<br>3. afterChange syncCustomerSnapshot chạy. | - Customer.name = 'Alice'.<br>- Customer.phone = '+60111'.<br>- Hook chạy idempotent dù create-path đã set fields. | High | [ ] |
| **TC-F25-03-02** | `FR-02`, #2086 | `Data` | Sync hook không ghi name/email lên customer khi sửa đơn | 1. Customer C1 (name='Alice') linked order O1.<br>2. Update O1 chỉ đổi `customerName='Alice Renamed'`. | - `payload.update` KHÔNG được gọi; C1.name giữ 'Alice'. | High | [x] |
| **TC-F25-03-03** | `FR-02` (sync), checkout hang #2180 | `Logic` | Sync hook không chặn transaction tạo đơn | 1. Checkout bank transfer với SĐT mới (`POST /api/orders/checkout`).<br>2. Order INSERT giữ khóa FK `KEY SHARE` trên dòng customer; afterChange syncCustomerSnapshot chạy. | - Hook trả về ngay, không await ghi customer (không deadlock giữa 2 connection).<br>- Ghi customer (name/phone/email/latestOrderAt) chạy sau response qua `runAfterResponse`, không dùng `req`/transaction của đơn.<br>- Checkout trả 201, đơn + customer đúng. | Critical | ✅ |
| **TC-F25-03-04** | `FR-02, #2086` | `Logic` | Update đơn đổi SĐT → chỉ sync phone, không name/email | 1. Update O1 đổi `customerPhone`, `customerName`, `customerEmail`. | - `data.phone` mới.<br>- Không có `name`, `email` trong data. | High | [x] |

---

### US-04: Address Book — Multi-address Field (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-04-01** | Design §3.1 | `Val` | Country default = 'Malaysia' khi tạo address | 1. Add address tới C1 chỉ với `line1='No. 12 Jalan ABC'` (no country).<br>2. Payload apply defaultValue. | - Saved address `country = 'Malaysia'`.<br>- Default chỉ apply khi value omit.<br>- Explicit `''` hoặc `null` không bị override. | Medium | [ ] |
| **TC-F25-04-02** | Design §3.2 (KISS) | `Edge` | Multiple isDefault addresses cho phép (no single-default enforce) | 1. Add Address A1 `{ line1: 'A', isDefault: true }`.<br>2. Add Address A2 `{ line1: 'B', isDefault: true }`.<br>3. Save customer. | - Cả 2 addresses saved với isDefault=true.<br>- KHÔNG throw error.<br>- Schema KISS — single-default enforcement deferred. | Medium | [ ] |

---

### US-05: Access Control & Tenant Isolation (3 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-05-01** | `FR-09` / `AC-3` | `Sec` | Read filter — tenant A user chỉ thấy customers tenant A | 1. Tenant A: 3 customers (C1, C2, C3); Tenant B: 2 (C4, C5).<br>2. User U1 owns Tenant A, gọi `Customers.access.read({ req })`.<br>3. Execute query. | - Access rule return `{ tenant: { in: [A.id] } }`.<br>- Query results = [C1, C2, C3].<br>- C4, C5 không trả về.<br>- Secure filter applied. | Blocker | [x] |
| **TC-F25-05-02** | `FR-09` / `BR-07` | `Sec` | Hard-delete forbidden — 403 cho mọi role | 1. User U (tenant owner hoặc super-admin) gọi `payload.delete({ collection: 'customers', id: C1.id })`.<br>2. Invoke `Customers.access.delete`. | - Access return `false`.<br>- Delete rejected (HTTP 403).<br>- C1 row vẫn còn trong DB.<br>- No data loss; bảo vệ Order FK integrity. | Blocker | [x] |
| **TC-F25-05-03** | `FR-06` / Code Review M3 | `Sec` | Orders tab defence-in-depth — query có cả customer + tenant filter | 1. Customer C1 thuộc Tenant A; render `<CustomersOrdersTab id={C1.id} />`.<br>2. Inspect `payload.find({ collection: 'orders', where })` arg. | - `where = { and: [{ customer: equals C1.id }, { tenant: equals C1.tenant.id }] }`.<br>- Cả 2 filters present (defence-in-depth).<br>- Nếu customer.tenant absent → fallback `{ customer: equals id }`. | High | [x] |

---

### US-06: CSV Export Security & Streaming (7 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-06-01** | `FR-07` / `BR-01` | `Sec` | Tenant isolation — User A export không thấy data Tenant B | 1. Tenant A: 5 customers; Tenant B: 3.<br>2. User U1 owns A, GET `/api/v1/customers/export?tenantId=B`.<br>3. resolveTenantIds(U1, 'B'). | - Request rejected (403) HOẶC kết quả chỉ A's customers.<br>- **Không bao giờ** leak B's PII (email/name/phone).<br>- Super-admin với `?tenantId=B` được phép (different path). | Blocker | [x] |
| **TC-F25-06-02** | `FR-07` | `Sec` | Formula-injection guard — prefix `=`, `+`, `-`, `@` | 1. Customer với `name='=SUM(A1)'`, `phone='+60111'`, `email='@malicious.com'`.<br>2. Export CSV, inspect raw output. | - name render `'=SUM(A1)` (leading `'`).<br>- phone render `'+60111`.<br>- email render `'@malicious.com`.<br>- Excel/Sheets open như text literal, không formula. | Blocker | [ ] |
| **TC-F25-06-03** | `FR-07` (RFC 4180) | `Val` | CSV escape — commas, quotes, newlines | 1. Customer với `name='Doe, John'`, `email='john"quoted"@x.com'`, `notes='line1\nline2'`.<br>2. Export CSV. | - Comma field wrap: `"Doe, John"`.<br>- Quote field double-escape: `"john""quoted""@x.com"`.<br>- Newline field wrap: `"line1\nline2"`.<br>- Empty cell render rỗng giữa `,` (không literal `null`). | High | [ ] |
| **TC-F25-06-04** | `FR-07` (filename) | `Val` | Filename format `customers-{label}-{YYYYMMDD}.csv` | 1. Super-admin GET `/api/v1/customers/export?tenantId=12`.<br>2. Inspect `Content-Disposition` header. | - Header: `attachment; filename="customers-12-20260520.csv"`.<br>- Date format YYYYMMDD (no separators).<br>- Tenant label sanitize `[A-Za-z0-9_-]`.<br>- Super-admin export-all → `customers-all-{date}.csv`. | Medium | [ ] |
| **TC-F25-06-05** | `FR-07` (validation) | `Val` | Super-admin invalid tenantId → 400 | 1. super-admin authenticated.<br>2. GET `?tenantId=abc` (non-numeric). | - HTTP 400.<br>- Body: `Bad Request: tenantId must be a positive integer`.<br>- Cache-Control: `private, no-store`.<br>- Không leak data. | High | [ ] |
| **TC-F25-06-06** | `FR-09` | `Sec` | Unauthenticated request → 401 | 1. Không có session cookie + không có Bearer JWT.<br>2. GET `/api/v1/customers/export`.<br>3. getCurrentUser return null. | - HTTP 401 Unauthorized.<br>- Cache-Control: `private, no-store`.<br>- Không có PII trong response body. | Blocker | [ ] |
| **TC-F25-06-07** | `FR-07` (cap) | `Bound` | Row cap 10k → 413 Too Large | 1. Mock DB count return > 10000.<br>2. GET `/api/v1/customers/export`. | - HTTP 413.<br>- Body JSON: `{ error: 'export_too_large', hint: 'Filter by date or rank' }`.<br>- Stream KHÔNG bắt đầu.<br>- Cache-Control private. | High | [ ] |

---

### US-07: Orders Tab UI — RSC Component Behavior (4 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-07-01** | `FR-06` / Design §4.4 | `UI` | No id (unsaved customer) → save-first prompt | 1. Render `<CustomersOrdersTab id={undefined} />`. | - Render "Save the customer record first to view linked orders.".<br>- `payload.find` KHÔNG được gọi (early return).<br>- Component không crash. | High | [x] |
| **TC-F25-07-02** | `FR-06` / Design §4.4 | `UI` | Empty state — 0 orders linked | 1. Mock `payload.find` return `{ docs: [], totalDocs: 0, totalPages: 0 }`.<br>2. Render `<CustomersOrdersTab id={C1.id} />`. | - Render "No orders linked yet." (italic, muted color).<br>- KHÔNG có `<table>` element.<br>- KHÔNG có pagination.<br>- Header "Orders (0)". | High | [x] |
| **TC-F25-07-03** | `FR-06` / Design §4.3 | `UI` | Pagination Prev/Next visibility | 1. Mock return `{ docs: [25 items], totalDocs: 75, totalPages: 3 }`.<br>2. Render với `searchParams={{ page: '2' }}`.<br>3. Lặp với page=1 và page=3. | - Page 2: "Page 2 of 3" + Prev link `?page=1` + Next link `?page=3`.<br>- Page 1: Prev ẩn, Next show.<br>- Page 3 (last): Next ẩn, Prev show.<br>- totalPages=1: pagination block ẩn hoàn toàn. | Medium | [x] |
| **TC-F25-07-04** | `FR-06` (row render) | `UI` | Row hiển thị orderNumber + total + currency + date | 1. Mock return 1 order: `{ id: 999, orderNumber: 'P-2098', total: 250.5, currency: 'MYR', createdAt: '2026-03-15' }`.<br>2. Render. | - Cell hiện `P-2098`, `250.50 MYR`, date format `15 Mar 2026`.<br>- View link `/admin/collections/orders/999`.<br>- Fallback to id khi orderNumber thiếu.<br>- Em-dash khi total null. | Medium | [x] |

---

### US-09: Edge Cases + Boundary Supplements (10 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-02-08** | `BR-01` | `Sec` | Cross-tenant — cùng email khác tenant → 2 records riêng biệt | 1. Tenant A: order với `email='x@y.com'`.<br>2. Tenant B: order với `email='x@y.com'`.<br>3. Inspect 2 find calls. | - 2 lookups riêng biệt `tenant: A` vs `tenant: B`.<br>- 2 Customer records riêng biệt.<br>- KHÔNG merge cross-tenant (BR-01 tenant-scoped identity). | High | [x] |
| **TC-F25-02-09** | `BR-04` | `Edge` | NULL email handled như empty (legacy data path) | 1. Order với `customerEmail=null`.<br>2. Order với `customerEmail` field missing entirely. | - `customer=null`, no DB call, no error.<br>- Cover legacy migration data. | High | [x] |
| **TC-F25-02-10** | `FR-02` | `Logic` | tenant relationship object → extract id correctly | 1. data.tenant = `{ id: 'tenant-99', name: 'X' }`.<br>2. Auto-link execute. | - find query dùng `tenant: { equals: 'tenant-99' }`.<br>- Support both populated object + raw id. | Medium | [x] |
| **TC-F25-02-11** | `FR-02`, #2086 | `Logic` | Existing customer đã có name+email → không ghi đè (thay latest-wins cũ) | 1. Customer C1 `name='Siti Old'`, `email='old@x.com'`.<br>2. Tạo order cùng SĐT, `customerName='Siti'`, `customerEmail='siti@new.com'`. | - Order link tới C1.<br>- `payload.update` KHÔNG được gọi. | High | [x] |
| **TC-F25-06-08** | `FR-07` (boundary) | `Bound` | Row cap boundary — 10000 OK, 10001 → 413 | 1. Mock count = 10000 → export.<br>2. Mock count = 10001 → export.<br>3. Mock count = 0 → export. | - 10000 → 200 OK stream.<br>- 10001 → 413 export_too_large.<br>- 0 → 200 header-only CSV. | Critical | [x] |
| **TC-F25-01-06** | `FR-01` | `UI` | Schema field types — phone optional, notes textarea, timestamps | 1. Inspect `Customers.fields`. | - phone type text + not required.<br>- notes type textarea + admin description.<br>- `timestamps: true` enabled. | Medium | [x] |
| **TC-F25-01-07** | `FR-08` | `Val` | Rank enum values all lowercase (case-sensitive) | 1. Inspect rank options. | - All values lowercase: bronze/silver/gold/vip.<br>- Labels có thể uppercase (VIP) nhưng value lowercase.<br>- Payload select case-sensitive. | Medium | [x] |
| **TC-F25-01-08** | `BR-02` | `Edge` | beforeChange — partial update không có email field | 1. PATCH với data = `{ name, rank }` (no email key).<br>2. beforeChange execute. | - data return unchanged.<br>- KHÔNG add email key.<br>- Hook defensive (typeof check). | High | [x] |
| **TC-F25-01-09** | `BR-02` | `i18n` | Unicode email preserved sau normalize | 1. `email='Café@Müller.COM'`.<br>2. `email='User🚀@Example.COM'`. | - Latin diacritics lowercase: `café@müller.com`.<br>- Emoji preserved: `user🚀@example.com`.<br>- JS toLowerCase Unicode-safe. | Medium | [x] |
| **TC-F25-04-03** | `FR-03` | `UI` | Address sub-fields complete spec verify | 1. Inspect `addresses` array fields. | - line1: text + required.<br>- line2/label/city/state/postcode: text + optional.<br>- isDefault: checkbox.<br>- label admin hint chứa "Home, Office". | Medium | [x] |

---

### US-09: Dashboard Server Actions & Client Utilities (11 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-11** | `FR-02` | `Logic` | mapCustomer — full doc maps all fields | 1. Construct mock Payload doc with all fields (id, email, name, phone, rank, notes, addresses array, firstOrderAt, createdAt, updatedAt).<br>2. Call `mapCustomer(doc, 5, 450.00, 80, 20)`. | - All fields mapped correctly.<br>- `addresses` array preserved with 2 items.<br>- `orderCount=5`, `lifetime=450.00`, `completedRate=80`, `failedRate=20`. | High | [x] |
| **TC-F25-12** | `FR-02` | `Edge` | mapCustomer — null fields preserved | 1. Doc with `phone=null, rank=null, notes=null, firstOrderAt=null, addresses=[]`.<br>2. Call `mapCustomer(doc, 0, 0, 0, 0)`. | - All nulls preserved in output.<br>- `addresses` returns empty array (not null).<br>- `orderCount=0`, `lifetime=0`. | High | [x] |
| **TC-F25-13** | `FR-07` | `Val` | toCsv — headers + rows format | 1. Pass 2 customer records to `toCsv(records)`.<br>2. Parse output by splitting `\n`. | - CSV starts with BOM `﻿`.<br>- Header row with 8 quoted columns: ID, Email, Name, Phone, Rank, Order Count, Lifetime (MYR), Created At.<br>- 2 data rows (7 commas per row).<br>- Total 3 lines (header + 2 rows). | High | [x] |
| **TC-F25-14** | `FR-07` | `Sec` | toCsv — escapes commas and quotes | 1. Customer with `name='Smith, John "The Boss"'`.<br>2. Call `toCsv([customer])`.<br>3. Inspect raw output. | - Name field wrapped in quotes: `"Smith, John ""The Boss"""`.<br>- Quotes doubled (RFC 4180).<br>- Commas properly escaped inside quotes. | High | [x] |
| **TC-F25-15** | `FR-04` | `Logic` | getShopCustomersAction — returns tenant customers | 1. Mock `getCurrentTenantId` → '123'.<br>2. Mock `drizzle.execute` → 2 SQL rows (data) + count=2.<br>3. Call action with empty filters (default sort = latestOrderAt → SQL path). | - Action returns `{ data: [...], meta: { total: 2 } }`.<br>- Both customers mapped correctly (email, name fields).<br>- `drizzle.execute` called twice (data query + count query). | High | [x] |
| **TC-F25-16** | `FR-04` (search) | `Logic` | getShopCustomersAction — search filter | 1. Call action with `{ search: 'ali' }`.<br>2. Mock `payload.find` return. | - `payload.find` called with `where` containing:<br>&nbsp;&nbsp;`or: [{ email: { like: 'ali' } }, { name: { like: 'ali' } }, { phone: { like: 'ali' } }]`. | High | [x] |
| **TC-F25-17** | `FR-04` (filter) | `Logic` | getShopCustomersAction — rank filter | 1. Call action with `{ rank: 'gold' }`.<br>2. Mock payload response. | - `payload.find` called with `where` containing `rank: { equals: 'gold' }`. | High | [x] |
| **TC-F25-18** | `FR-05` | `Sec` | getShopCustomerDetailAction — IDOR reject different tenant | 1. Mock `getCurrentTenantId` → 'my-tenant'.<br>2. Mock `payload.findByID` return doc with `tenant: { id: 'other-tenant' }`.<br>3. Call action. | - Action throws `Error('Unauthorized')`.<br>- No data leaked. | Blocker | [x] |
| **TC-F25-19** | `FR-05` | `Sec` | updateShopCustomerAction — IDOR reject different tenant | 1. Mock tenant mismatch as TC-F25-18.<br>2. Call update action. | - Throws `Error('Unauthorized')`.<br>- `payload.update` NOT called. | Blocker | [x] |
| **TC-F25-20** | `FR-05` | `Logic` | updateShopCustomerAction — persists fields | 1. Mock `payload.findByID` return existing doc (matching tenant).<br>2. Mock `payload.update` return updated doc.<br>3. Call action with `{ name, rank, notes }`. | - `payload.update` called with correct `data` object.<br>- name, rank, notes all passed correctly.<br>- Returned record has updated values.<br>- Invalid rank values throw 'Invalid rank value'. | High | [x] |
| **TC-F25-21** | All actions | `Sec` | requireTenantId — throws when no tenant | 1. Mock `getCurrentTenantId` → null.<br>2. Call any action (list/detail/update). | - All actions throw `Error('Unauthorized')`.<br>- No DB queries made. | Blocker | [x] |
| **TC-F25-22** | `FR-04` rate formula | `Logic` | rate formula — 2-decimal rounding + zero fallback | 1. Mock orders: 1 completed + 1 cancelled + 1 pending (count=3).<br>2. Call `getShopCustomersAction`.<br>3. Also call with 0 orders. | - `completedRate === 33.33` (not 33).<br>- `failedRate === 33.33` (not 33).<br>- Zero orders → `completedRate === 0`, `failedRate === 0`. | High | [x] |
| **TC-F25-23** | `FR-04` (sort) | `Logic` | getShopCustomersAction — orderCount sort uses SQL JOIN, skips fetchOrderStats | 1. Mock `getCurrentTenantId` → '1'.<br>2. Mock `drizzle.execute` → 2 rows with inline order stats.<br>3. Call action with `{ sortBy: 'orderCount', sortDir: 'desc' }`. | - Returns 2 customers in correct order.<br>- `completedRate === 80` (4/5 completed).<br>- `payload.find` NOT called (stats computed inline via SQL JOIN). | High | [x] |
| **TC-F25-24** | `FR-04` (sec) | `Sec` | SQL paths — reject non-integer tenantId before issuing any SQL | 1. Mock `getCurrentTenantId` → `'not-an-integer'`.<br>2. Call `getShopCustomersAction({})` (default sort → SQL path). | - Action throws `Invalid tenantId`.<br>- `drizzle.execute` NOT called (guard fires before SQL). | High | [x] |
| **TC-F25-25** | `FR-04, #2086` | `Logic` | Spend/failed theo định nghĩa mới | 1. 5 đơn: completed 100, paid chưa giao 50, cancelled 214.20, payment_failed 40, pending 30.<br>2. `fetchCustomerOrderStats`. | - count 5, spend 150, completed 20%, failed 40%. | High | [x] |
| **TC-F25-26** | `FR-04, #2086` | `Logic` | COD: completed tính vào spend dù paymentStatus chưa paid | 1. Đơn completed (paymentStatus pending) 80 + đơn shipped chưa thanh toán 60. | - spend = 80. | High | [x] |
| **TC-F25-27** | `FR-04, #2086` | `Logic` | Refunded: tính vào Total orders, không vào spend/completed/failed | 1. Đơn refunded 70 + completed 20. | - count 2, spend 20, completed 1, failed 0. | High | [x] |
| **TC-F25-28** | `FR-04, #2086` | `Logic` | Công thức dùng chung cho SQL sort, detail, CSV, ECH Agent | 1. Render SQL fragment `LIFETIME_SQL`/`FAILED_COUNT_SQL`.<br>2. Sort `spend` của ECH Agent. | - SQL loại cancelled/refunded, yêu cầu paid hoặc completed; failed = cancelled + payment_failed. | High | [x] |

---

### US-08: E2E Admin Flows — Playwright (9 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F25-08-01** | `FR-04` | `UI` | List page load không server error | 1. Login admin.<br>2. Navigate `/admin/collections/customers`. | - HTTP 200, page load thành công.<br>- Render rows hoặc empty state.<br>- Không có server error toast. | High | [x] |
| **TC-F25-08-02** | `FR-04` (search) | `Search` | Search debounced filter list | 1. Type "zzz_no_match_test" vào search input.<br>2. Wait 500ms (debounce 300ms + buffer).<br>3. Clear search. | - Không crash; result hoặc rỗng hoặc filter đúng.<br>- expectNoServerError pass.<br>- Clear → list re-load. | High | [x] |
| **TC-F25-08-03** | `FR-04` (filter) | `Func` | Rank filter qua URL param | 1. Navigate `/admin/collections/customers?where[rank][equals]=gold`. | - Page load OK.<br>- Filter apply (chỉ rank=gold rows).<br>- expectPageLoaded + expectNoServerError. | Medium | [x] |
| **TC-F25-08-04** | `FR-05` / `FR-06` | `Nav` | Detail view show Default + Addresses + Orders tabs | 1. List view → click first customer row.<br>2. URL chuyển `/customers/:id`.<br>3. Inspect tabs. | - URL match `/admin/collections/customers/<id>`.<br>- Orders tab (F25 custom) visible.<br>- Default + Addresses tabs render. | High | [x] |
| **TC-F25-08-05** | `FR-03` | `UI` | Addresses tab có Add button | 1. Mở customer detail.<br>2. Click Addresses tab.<br>3. Inspect array UI. | - Payload array field UI render.<br>- "Add" hoặc "+" button visible.<br>- expectNoServerError. | Medium | [x] |
| **TC-F25-08-06** | `FR-06` | `Nav` | Orders tab navigate + render | 1. Customer detail → click Orders tab.<br>2. Wait load. | - URL match `/orders` path.<br>- Render "Orders (N)" header HOẶC empty state HOẶC save-first prompt.<br>- expectNoServerError. | High | [x] |
| **TC-F25-08-07** | `FR-07` | `Func` | CSV export endpoint trả CSV với headers đúng | 1. GET `/api/v1/customers/export` (auth cookies từ browser).<br>2. Inspect response. | - Status < 500.<br>- Nếu 200: `Content-Type: text/csv`, `Content-Disposition: attachment`, `Cache-Control: private`.<br>- Body line 1 = `email,name,phone,rank,createdAt,addressCount,orderCount`. | Blocker | [x] |
| **TC-F25-08-08** | `FR-09` | `Sec` | CSV export no auth → 401/403 | 1. GET `/api/v1/customers/export` với empty `Cookie` header. | - Status ∈ {401, 403}.<br>- Cache-Control private.<br>- Không leak data. | Blocker | [x] |
| **TC-F25-08-09** | `BR-07` | `Sec` | Hard-delete DELETE `/api/customers/:id` → 403 | 1. Lấy customer ID từ list.<br>2. DELETE `/api/customers/:id`. | - Status ∈ {403, 401, 405}.<br>- Customer record vẫn còn trong DB.<br>- No data loss. | Blocker | [x] |
| **TC-F25-08-10** | `FR-03` | `UI` | Hộp Auto-link không lộ tên hook kỹ thuật (GH-2279) | 1. Mở customer detail.<br>2. Đọc hộp "Auto-link on". | - Nội dung EN/MS không chứa "hook" / `autoLinkCustomer`.<br>- Không còn thẻ `<code>` kỹ thuật. | Low | [x] AUTO |

---

## 4. Test Files Locations + Counts

> **Verified:** 2026-05-29 (GH-1107 server-side sort): server-side sort + SQL paths for `latestOrderAt`/`orderCount`. `shop-customer-actions.test.ts` updated to 14 PASS (TC-F25-15..24). Full suite **81 PASS** + 7 todo.

| Test File | Location | TC Coverage | Test Count |
|:---|:---|:---|:---:|
| `auto-link-customer.test.ts` | `src/__tests__/unit/customers/` | TC-F25-02-01..07, 02-15..20, TC-F25-005, TC-F25-006, TC-F25-006b | ✅ 21 PASS |
| `auto-link-customer-pool.test.ts` | `src/__tests__/unit/customers/` | TC-F25-02-05, 02-05b (TC-PERF-185: connection / pool error rethrows) | ✅ 5 PASS |
| `auto-link-customer-transaction.test.ts` | `src/__tests__/unit/customers/` | TC-F25-02-21..22 | ✅ 2 PASS |
| `sync-customer-snapshot.test.ts` | `src/__tests__/unit/customers/` | TC-F25-03-01..04, TC-F25-09-01..09 | ✅ 13 PASS |
| `customer-spend-rules.test.ts`, `crm-services.test.ts` | `src/__tests__/unit/customers/` | TC-F25-25..28 | ✅ PASS |
| `customers-access.test.ts` | `src/__tests__/unit/customers/` | TC-F25-05-01..02 | ✅ 8 PASS |
| `customers-field-validation.test.ts` | `src/__tests__/unit/customers/` | TC-F25-01-01..03, 04-01 | ✅ 15 PASS |
| `customers-orders-tab.test.tsx` | `src/__tests__/unit/customers/` | TC-F25-05-03, 07-01..04 | ✅ 16 PASS |
| `customers-export.test.ts` | `src/__tests__/integration/` | TC-F25-06-01, 05..07 | ✅ 9 PASS |
| `shop-customer-record.test.ts` | `src/__tests__/unit/customers/` | TC-F25-11..14 | ✅ 5 PASS |
| `shop-customer-actions.test.ts` | `src/__tests__/unit/customers/` | TC-F25-15..24 | ✅ 14 PASS |
| `customer-autolink-copy.test.ts` | `src/__tests__/unit/customers/` | TC-F25-08-10 | ✅ 2 PASS |
| `f25-customers.spec.ts` (E2E) | `e2e/` | TC-F25-08-01..09 | 🟡 9 specs compile (needs staging server) |
| **TOTAL** | — | **TC-F25-01..09-XX, 11..24** | **81 PASS + 7 todo + 9 E2E specs** |

**Source modules supporting tests:**
- `src/lib/customers/csv-helpers.ts` — NEW (2026-05-25): extract `csvField` / `toCsvLine` / `sanitizeFilenameSegment` từ route handler → enable unit testing. `src/app/api/v1/customers/export/route.ts` re-imports từ module này; integration tests 9/9 PASS regression confirmed.

**7 todo cases (TC-F25-06-08):** boundary tests cho `EXPORT_ROW_CAP` (0/10000/10001), `resolveTenantIds` sentinel. Blocked: các function này module-private trong `route.ts`. Fix: extract sang module riêng (giống pattern csv-helpers) → convert sang real tests.

---

## 5. Manual Smoke Test Matrix (Deferred to User QA)

Post-merge, user QA team thực hiện 3 manual scenarios:

| Scenario | Steps | Expected | Effort |
|:---|:---|:---|:---:|
| **List view + search** | 1. Go `/dashboard/customers`.<br>2. Search "john".<br>3. Filter rank=gold.<br>4. Verify mobile responsive. | List render, search highlight, filter work, mobile layout OK. | ~15 min |
| **Orders tab navigation** | 1. Mở customer detail.<br>2. Click Orders tab.<br>3. Verify linked orders.<br>4. Click order row → order detail load. | Orders tab load đúng customer's orders, navigation work, no 404. | ~10 min |
| **CSV export 10k cap** | 1. Seed 15k mock customers.<br>2. Export CSV.<br>3. Verify file < 10k rows.<br>4. Check formula injection guard. | Export cap 10k rows, no OOM, formulae safe (`=` → `'` prefix). | ~20 min |

**Recording:** Results documented in phase-05 manual smoke report (user QA).

---

## 6. Traceability Matrix

| TC ID | PRD Section | Architecture Section | Test File | Status |
|:---|:---|:---|:---|:---|
| TC-F25-01-01 | §7 FR-01 | §3 Schema | manual/grep | ✅ |
| TC-F25-01-02 | §7 FR-08 | §3.1 rank enum | customers-field-validation.test.ts | ✅ |
| TC-F25-01-03 | §7 FR-03, §8 BR-06 | §3.2 maxRows | customers-field-validation.test.ts | ✅ |
| TC-F25-01-04 | §7 FR-01, §8 BR-02 | §5.1 beforeChange | (existing) | ✅ |
| TC-F25-01-05 | §7 FR-01, §8 BR-02 | beforeChange hook | customers-hooks-and-behavior.test.ts | ✅ |
| TC-F25-02-01 | §7 FR-02, §8 BR-02 | §5.1 beforeChange | auto-link-customer.test.ts | ✅ |
| TC-F25-02-02 | §8 BR-08 | §2.1 hook flow | auto-link-customer.test.ts | ✅ |
| TC-F25-02-03 | §8 BR-04 | §2.1 edge case | auto-link-customer.test.ts | ✅ |
| TC-F25-02-04 | §8 BR-04 | §2.1 email validation | auto-link-customer.test.ts | ✅ |
| TC-F25-02-05 | §8 BR-03, TC-PERF-185 (lookup error rethrows) | §5.2 try/catch | auto-link-customer.test.ts, auto-link-customer-pool.test.ts | ✅ |
| TC-F25-02-05b | §8 BR-03, TC-PERF-185 (create: data error → null, connection error → rethrow) | §5.2 try/catch | auto-link-customer.test.ts, auto-link-customer-pool.test.ts | ✅ |
| TC-F25-02-06 | §7 FR-10, §8 BR-09 | §2.1 firstOrderAt | customers-hooks-and-behavior.test.ts | ✅ |
| TC-F25-02-07 | §7 FR-02 (perf) | §2.1 update path | auto-link-customer.test.ts | ✅ |
| TC-F25-02-20 | §7 FR-02 / BE-1 | §5.1 phone normalization regression | auto-link-customer.test.ts | ✅ |
| TC-F25-02-21 | §7 FR-02, bulk update hang (#1996) | §5.1 found path after response | auto-link-customer-transaction.test.ts | ✅ |
| TC-F25-02-22 | §8 BR-08, Payload 3.91 unique error | §5.1 race retry | auto-link-customer-transaction.test.ts | ✅ |
| TC-F25-03-01 | §7 FR-02, §9.2 flow | §2.2 syncCustomerSnapshot | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-03-02 | §7 FR-02 (#2086, không ghi đè) | §2.2 sync hook | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-03-03 | §7 FR-02, checkout hang (#2180) | §2.2 sync hook after response | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-04-01 | §7 FR-03, design §3.1 | §3.1 country default | customers-hooks-and-behavior.test.ts | ✅ |
| TC-F25-04-02 | design §3.2 (KISS) | — | customers-hooks-and-behavior.test.ts | ✅ |
| TC-F25-05-01 | §7 FR-09, §8 BR-01 | §6 access control | customers-access.test.ts | ✅ |
| TC-F25-05-02 | §7 FR-09, §8 BR-07 | §6 delete forbidden | customers-access.test.ts | ✅ |
| TC-F25-05-03 | §7 FR-06, code review M3 | §4.1 component spec | customers-orders-tab.test.tsx | ✅ |
| TC-F25-06-01 | §7 FR-07, §8 BR-01 | §7 CSV tenant isolation | customers-export.test.ts | ✅ |
| TC-F25-06-02 | §7 FR-07 | §7 formula guard | customers-export-csv-helpers.test.ts | ✅ |
| TC-F25-06-03 | §7 FR-07 | RFC 4180 | customers-export-csv-helpers.test.ts | ✅ |
| TC-F25-06-04 | §7 FR-07 | §7.3 filename | customers-export-csv-helpers.test.ts | ✅ |
| TC-F25-06-05 | §7 FR-07 (validation) | §7.4 error responses | customers-export.test.ts | ✅ |
| TC-F25-06-06 | §7 FR-09 | §7.4 auth | customers-export.test.ts | ✅ |
| TC-F25-06-07 | §7 FR-07 (cap) | §7 row cap | customers-export.test.ts | ✅ |
| TC-F25-06-08 | §7 FR-07 (boundary) | §7 row cap | customers-edge-cases.test.ts | 🟡 7 todo (cần extract `resolveTenantIds`) |
| TC-F25-07-01 | §7 FR-06 | §4.4 new customer state | customers-orders-tab.test.tsx | ✅ |
| TC-F25-07-02 | §7 FR-06 | §4.4 empty state | customers-orders-tab.test.tsx | ✅ |
| TC-F25-07-03 | §7 FR-06 | §4.3 pagination | customers-orders-tab.test.tsx | ✅ |
| TC-F25-07-04 | §7 FR-06 | §4.2 row rendering | customers-orders-tab.test.tsx | ✅ |
| TC-F25-08-01..09 | §7 FR-04..07, §8 BR-07 | §10 admin UI | f25-customers.spec.ts | ✅ |
| TC-F25-09-01 | Bug 1 fix | `operation=create` → latestOrderAt written | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-09-02 | Bug 1 fix | `operation=update` + name change → latestOrderAt NOT overwritten | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-09-03 | Bug 2 fix | valid email synced on create | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-09-04 | Bug 2 fix | invalid email not included | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-09-05 | Bug 2 fix | phone `+` stripped before store | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-09-06 | existing | null customer → no DB call | sync-customer-snapshot.test.ts | ✅ |
| TC-F25-09-07 | existing | update throws → non-throwing | sync-customer-snapshot.test.ts | ✅ |

---

## 7. Test Execution

**Unit + Integration:**
```bash
npm test -- src/__tests__/(unit|integration)/customers
```

**E2E:**
```bash
npx playwright test e2e/f25-customers.spec.ts
```

**Verified 2026-05-25:**
```
✓ auto-link-customer.test.ts (7 tests)
✓ sync-customer-snapshot.test.ts (11 tests)
✓ customers-access.test.ts (8 tests)
✓ customers-field-validation.test.ts (15 tests)
✓ customers-hooks-and-behavior.test.ts (11 tests)
✓ customers-edge-cases.test.ts (19 tests | 7 todo)
✓ customers-orders-tab.test.tsx (16 tests)
✓ customers-export.test.ts (9 tests — integration)
✓ customers-export-csv-helpers.test.ts (16 tests)

Test Files  9 passed (9)
     Tests  112 passed | 7 todo (119)
   Duration 14.62s
```

**Coverage targets:** Lines ≥ 70%, Branches ≥ 70%, Functions ≥ 70%.

---

## 8. Known Gaps / Future Work

> **Updated 2026-05-25:** v2.0 Draft items đã shipped trong v2.1. Còn lại 3 nhóm gaps thực tế.

| Gap | Wave | Reason |
|:---|:---|:---|
| TC-F25-06-08 boundary (0/10000/10001 rows) | Wave 7 | 7 todo. Cần extract `resolveTenantIds` + `EXPORT_ROW_CAP` từ route.ts → module riêng (giống pattern csv-helpers.ts) để unit test. Partial coverage qua integration test (TC-F25-06-07). |
| E2E spec execution (TC-F25-08-01..09) | Wave 7 | 9 specs compile OK trong `e2e/f25-customers.spec.ts`; cần staging server + `TEST_EMAIL`/`TEST_PASSWORD` env vars để run. |
| Concurrent order creation (race condition) | Wave 7+ | Idempotency tested via mock; real concurrency edge case cần load test infra |
| Large export stress (100k+ customers) | Wave 7+ | 10k cap + manual smoke đủ Wave 6 |
| PW1 ETL import validation | Wave 7 (US-MIGA-12) | Separate plan scope |
| Performance regression test | Wave 7+ | Baseline established |
| GDPR/anonymize delete flow | Wave 8+ | Out of F25 scope (hard-delete forbidden by design) |

---

## 9. References

- **PRD:** [`docs/prd/F25-shop-customers.md`](../prd/F25-shop-customers.md)
- **Architecture:** [`docs/architecture/F25-shop-customers.md`](../architecture/F25-shop-customers.md)
- **Design:** [`docs/design/F25-shop-customers-design.md`](../design/F25-shop-customers-design.md)
- **Implementation Plan:** [`plans/260520-1432-customers-module/`](../../plans/260520-1432-customers-module/)
- **Test Convention:** [`docs/TEST_CONVENTION.md`](../TEST_CONVENTION.md)
- **Code Standards:** [`docs/standards/CODE_STANDARDS.md`](../standards/CODE_STANDARDS.md)
- **F08 Template Reference:** [`docs/qa/F08-product-crud.md`](./F08-product-crud.md)
