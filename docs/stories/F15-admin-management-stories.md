# User Stories: Admin Management — Phase 1 (F15)

> **Feature:** F15 — Admin Management
> **Ưu tiên:** P1 | **Tham chiếu PRD:** [F15-admin-management.md](../prd/F15-admin-management.md)
> **Cập nhật:** 2026-04-15 | **Version:** 2.0

---

## Tiêu chí chấp nhận toàn cục (Admin Panel)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN  user có role `super-admin` truy cập `/admin-panel/*`
THEN   nội dung render bên trong Admin Panel layout riêng (KHÔNG dùng F18 CMS Layout)
  AND  AdminSidebar và AdminHeader hiển thị đúng, không bị che khuất
  AND  user KHÔNG có role `super-admin` bị redirect về `/dashboard`
```

---

## Bối cảnh Account Provisioning

> Áp dụng cho tất cả stories liên quan đến dữ liệu user/tenant.

- Tất cả Owner account tạo **100% từ SSO (TM Legacy)** qua `POST /api/v1/sso/provision`.
- Không có form đăng ký cho Owner (UI đã ẩn). Staff được Owner mời.
- 4 gói: **Freemium, Starter, Standard, Professional** — hiện tại giới hạn **giống nhau**.
- Plan gán từ SSO `pack_code`. Admin chỉ **xem** (chỉ đọc), không chỉnh sửa.

---

## Phase 1 — Activity Logs

### US-F15-01: Activity Logs — Nhật ký hoạt động

**Phase 1** | **P0** | **M** | **Trạng thái:** Ready
**Branch:** `feat/F15-01-activity-logs`

#### Story

```
As a   Super Admin
I want mọi thao tác mutation và auth event được ghi lại tự động
So that tôi có thể truy vết khi có sự cố và đảm bảo tính minh bạch của hệ thống
```

#### AC-1: Ghi log Mutations

```gherkin
GIVEN  một user thực hiện thao tác create, update, hoặc delete trên bất kỳ collection nào:
       Users, Tenants, Products, Orders, Sites, Pages, Blogs, BlogCategories
WHEN   thao tác hoàn thành thành công
THEN   hệ thống tạo một entry trong activity_logs với: actor_id, action (create|update|delete),
       resource (collection slug), resource_id, tenant_id, ip_address, user_agent, metadata, created_at
  AND  việc ghi log là fire-and-forget — lỗi ghi log KHÔNG block request gốc
```

#### AC-2: Ghi log Auth Events

```gherkin
GIVEN  một user cố gắng đăng nhập, đăng nhập thành công, đăng xuất, hoặc đổi mật khẩu
WHEN   auth event xảy ra
THEN   hệ thống tạo một entry trong activity_logs với action = login | logout | login_failed | password_reset
  AND  với login_failed: metadata bao gồm email đã thử (KHÔNG bao gồm mật khẩu)
  AND  log entry bao gồm ip_address và user_agent từ request headers
```

#### AC-2a: Ghi log AI Events

```gherkin
GIVEN  một user sử dụng bất kỳ tính năng AI nào
WHEN   AI request hoàn thành (thành công hoặc thất bại)
THEN   hệ thống tạo một entry trong activity_logs với action tương ứng:

  Thành công:
  - ai_generate_site — tạo website bằng AI (metadata: blocks count, time_ms, language)
  - ai_edit_block — chỉnh sửa block bằng AI trong editor (metadata: block_id, block_type)
  - ai_rewrite_text — viết lại text bằng AI (metadata: field)
  - ai_generate_seo — tự động tạo SEO metadata (metadata: site_id)
  - ai_generate_blog — tạo blog bằng AI (metadata: title)
  - ai_product_description — tạo mô tả sản phẩm bằng AI (metadata: product_id)
  - ai_bulk_parse — import sản phẩm hàng loạt bằng AI (metadata: products_count)
  - ai_extract_from_url — tạo site từ URL (metadata: source_url)
  - ai_apply_template — áp dụng template thay vì AI gen (metadata: template_id)

  Thất bại (ai_generate_site_failed):
  - metadata.error_code = VALIDATION_ERROR (400) — form input không hợp lệ
  - metadata.error_code = UNAUTHORIZED (401) — chưa đăng nhập / token hết hạn
  - metadata.error_code = PAYMENT_REQUIRED (402) — đã gen 1 lần, không cho gen lại
  - metadata.error_code = CONTENT_UNSAFE (400) — nội dung nhạy cảm / NSFW
  - metadata.error_code = RATE_LIMIT (429) — gửi request quá nhanh (>5/phút hoặc >20/giờ)
  - metadata.error_code = TIMEOUT (500) — OpenAI API quá chậm (>300s)
  - metadata.error_code = AI_API_ERROR (500) — OpenAI trả lỗi (overloaded, maintenance)
  - metadata.error_code = AI_PARSE_ERROR (500) — AI trả JSON không hợp lệ
  - metadata.error_code = AI_API_KEY_INVALID (500) — API key sai hoặc hết quota
  - metadata.error_code = DB_SAVE_FAILED (500) — lưu site/pages vào DB thất bại
  - metadata.error_code = TENANT_CREATE_FAILED (500) — tạo tenant tự động thất bại
  - metadata.error_code = SSE_DISCONNECT (0) — mất kết nối giữa chừng streaming
  - metadata.error_code = PARTIAL_SUCCESS — tạo được >=1 page nhưng lỗi giữa chừng

  AND  mọi AI failed log bao gồm: error_code, error_message, time_ms
  AND  AI thành công log bao gồm: model, cost_usd (nếu có), time_ms
```

#### AC-2b: Ghi log Website Editor Events

```gherkin
GIVEN  một user thao tác với website trong editor
WHEN   thao tác hoàn thành
THEN   hệ thống tạo entry với action tương ứng:

  Website lifecycle:
  - site_publish — publish website ra live (metadata: site_id, slug, url)
  - site_unpublish — gỡ website khỏi live (metadata: site_id, slug)

  Editor save (PATCH /api/sites/[siteId]/save):
  - site_save — lưu chỉnh sửa trong editor (metadata ghi chi tiết những gì thay đổi):
    metadata.changes_summary bao gồm danh sách thay đổi được phát hiện:
    · blocks_reordered: true/false — user kéo thả đổi vị trí block
    · blocks_added: ["hero", "faq"] — block mới được thêm vào
    · blocks_removed: ["testimonials"] — block bị xóa
    · blocks_modified: ["hero", "about"] — block có nội dung thay đổi (text, images, links)
    · theme_changed: true/false — đổi màu, font, hoặc style
    · header_changed: true/false — sửa navigation header (links, logo)
    · footer_changed: true/false — sửa footer
    · site_name_changed: true/false — đổi tên website
    · contact_info_changed: true/false — sửa thông tin liên hệ
    · social_links_changed: true/false — sửa social media links
    · branding_changed: true/false — sửa logo/branding
    · seo_changed: true/false — sửa SEO metadata
    metadata.page_id — trang nào được sửa
    metadata.blocks_count — tổng số blocks sau khi lưu

  Page management:
  - page_update — sửa page settings: visibility, slug, SEO (metadata: page_id, fields_changed)
  - page_delete — xóa page (soft delete via deletedAt) (metadata: page_id, page_title)

  SEO tools:
  - seo_fix — sửa SEO cho 1 page (metadata: site_id, page_id, fixes_applied)
  - seo_fix_all — sửa SEO cho tất cả pages (metadata: site_id, pages_count)
  - seo_auto_meta_toggle — bật/tắt auto SEO metadata (metadata: site_id, enabled)
```

> **Lưu ý kỹ thuật:** `changes_summary` trong `site_save` được tính bằng cách so sánh
> blocks/theme TRƯỚC và SAU khi save. API route đọc state hiện tại trước khi update,
> diff với payload mới, rồi ghi metadata. Nếu diff quá nặng (performance), chỉ ghi
> `blocks_count_before` vs `blocks_count_after` + `fields_changed` list.

#### AC-2c: Ghi log Domain & Slug Events

```gherkin
GIVEN  một user thay đổi subdomain hoặc custom domain
WHEN   thao tác hoàn thành
THEN   hệ thống tạo entry với action tương ứng:
  - slug_change — đổi subdomain workspace (metadata: old_slug, new_slug, tenant_id)
  - domain_add — thêm custom domain (metadata: domain, tenant_id)
  - domain_remove — xóa custom domain (metadata: domain, tenant_id)
```

#### AC-2d: Ghi log Staff & Account Events

```gherkin
GIVEN  một user thao tác quản lý nhân viên hoặc tài khoản
WHEN   thao tác hoàn thành
THEN   hệ thống tạo entry với action tương ứng:
  - invite_staff — mời nhân viên vào workspace (metadata: invited_email, tenant_id)
  - remove_staff — xóa nhân viên khỏi workspace (metadata: removed_user_id, tenant_id)
  - account_reset — reset toàn bộ tài khoản (metadata: tenants_reset, collections_cleared)
  - plan_change — plan thay đổi qua SSO (metadata: old_plan, new_plan)
  - sso_status_change — trạng thái SSO thay đổi (metadata: old_status, new_status, reason)
    · activated → workspace mở lại, Owner + Staff đăng nhập được
    · inactivated → workspace bị khóa tạm, Owner + Staff KHÔNG đăng nhập được
    · terminated → workspace bị xóa, website unpublish, dữ liệu giữ 90 ngày
```

#### AC-3: Truy vấn Activity Logs

```gherkin
GIVEN  Super Admin truy cập /admin-panel/activity-logs
WHEN   trang tải xong
THEN   một DataTable phân trang hiển thị: Thời gian, Người thực hiện (tên + email), Hành động,
       Tài nguyên, ID tài nguyên, Tenant, Địa chỉ IP
  AND  phân trang phía server (50 mỗi trang, tối đa 200)
  AND  API phản hồi trong vòng 500ms ở p95 cho tới 1 triệu dòng
```

#### AC-4: Lọc Activity Logs

```gherkin
GIVEN  Super Admin đang xem trang activity logs
WHEN   họ áp dụng bộ lọc: loại hành động (multi-select), khoảng thời gian, tìm kiếm user
THEN   bảng cập nhật chỉ hiển thị các entries phù hợp
  AND  các bộ lọc kết hợp theo logic AND
  AND  xóa bộ lọc khôi phục danh sách đầy đủ
```

#### AC-5: Xem chi tiết Log

```gherkin
GIVEN  Super Admin click vào một dòng log entry
WHEN   dòng mở rộng
THEN   metadata JSON tree hiển thị ở dạng dễ đọc
  AND  metadata KHÔNG BAO GIỜ chứa mật khẩu, mã OTP, hoặc Stripe secrets
```

#### AC-6: Tính bất biến của Log

```gherkin
GIVEN  bất kỳ API consumer nào (bao gồm Super Admin)
WHEN   họ cố gắng update hoặc create activity logs qua public API
THEN   hệ thống trả về 403 Forbidden
  AND  chỉ Super Admin có thể xóa logs (chỉ cho mục đích GDPR erasure)
  AND  logs là append-only trong vận hành bình thường
```

#### AC-7: Trạng thái trống

```gherkin
GIVEN  bảng activity_logs trống (hệ thống mới)
WHEN   Super Admin xem /admin-panel/activity-logs
THEN   hiển thị thông báo trạng thái trống "Chưa có nhật ký hoạt động nào"
  AND  không có lỗi hoặc crash xảy ra
```

---

## Phase 2 — Quản lý User + Broadcast UI + Admin Layout

### US-F15-02: Quản lý User & Workspace

**Phase 2** | **P0** | **L** | **Trạng thái:** Ready
**Branch:** `feat/F15-02-user-management`
**Phụ thuộc:** US-F15-01 (Activity Logs — cho inline activity timeline)

#### Story

```
As a   Super Admin
I want xem danh sách users và workspaces, tìm kiếm, lọc, và suspend/unsuspend users
So that tôi có thể quản lý tài khoản và xử lý vi phạm mà không cần truy vấn DB trực tiếp
```

#### AC-1: Danh sách Users

```gherkin
GIVEN  Super Admin truy cập /admin-panel/users
WHEN   trang tải xong
THEN   một DataTable phân trang hiển thị: Tên (link tới chi tiết), Email, Badge vai trò,
       Tenant chính + Plan, Badge trạng thái workspace (active/suspended/terminated),
       Lần đăng nhập cuối, Ngày tạo
  AND  Owner hiển thị thêm badge SSO status: activated (xanh) | inactivated (vàng) | terminated (đỏ)
  AND  Staff bị ảnh hưởng bởi workspace suspended/terminated hiển thị badge cảnh báo
  AND  phân trang phía server (50 mỗi trang)
  AND  trang tải trong vòng 1 giây cho tới 50 nghìn users
```

#### AC-2: Tìm kiếm Users

```gherkin
GIVEN  Super Admin đang ở trang danh sách users
WHEN   họ gõ vào ô tìm kiếm
THEN   kết quả lọc theo email hoặc tên (không phân biệt hoa thường)
  AND  tìm kiếm có debounce (300ms)
  AND  xóa tìm kiếm khôi phục danh sách đầy đủ
```

#### AC-3: Lọc Users

```gherkin
GIVEN  Super Admin đang ở trang danh sách users
WHEN   họ chọn bộ lọc Vai trò (super-admin | tenant-owner | staff) và/hoặc bộ lọc Trạng thái (active | suspended)
THEN   bảng chỉ hiển thị users phù hợp
  AND  các bộ lọc kết hợp theo logic AND
```

#### AC-4: Trang chi tiết User

```gherkin
GIVEN  Super Admin click vào một dòng user trong danh sách
WHEN   trang chi tiết user tải (/admin-panel/users/[id])
THEN   hiển thị: thông tin hồ sơ (tên, email, vai trò, ngày tạo, lần đăng nhập cuối),
       tất cả tenant memberships (với vai trò, trạng thái membership, plan),
       link "Xem workspace" (mở tenant trong tab mới),
       và 20 entries activity log gần nhất (từ Phase 1 API)

  AND  nếu user là Owner:
       hiển thị trạng thái SSO: activated (badge xanh) | inactivated (badge vàng) | terminated (badge đỏ)
       hiển thị SSO info: customerId, serviceId, packCode, orderId

  AND  nếu user là Staff:
       hiển thị workspace membership status: pending | active | suspended
       hiển thị cảnh báo nếu workspace bị suspended/terminated:
       "Workspace này đang bị khóa (inactivated) — Staff không thể đăng nhập"
       hoặc "Workspace này đã bị xóa (terminated) — Staff mất quyền truy cập"
```

#### ~~AC-5: Tạm ngưng User~~ — **Deferred**

> Chưa cần suspend user lúc này. Ưu tiên xem lỗi/sự cố user gặp phải qua activity logs.

#### ~~AC-6: Bỏ tạm ngưng User~~ — **Deferred**

#### ~~AC-7: Không thể tạm ngưng chính mình~~ — **Deferred**

#### AC-5: Xem lỗi user gặp phải

```gherkin
GIVEN  Super Admin đang xem trang chi tiết user
WHEN   họ xem phần "Hoạt động gần đây" (activity logs)
THEN   các entry với action = "login_failed" hoặc lỗi hệ thống hiển thị rõ ràng
  AND  mỗi entry hiển thị: thời gian, loại lỗi, IP, metadata (nếu có)
  AND  Admin có thể lọc chỉ xem các events lỗi
```

#### AC-6: Danh sách Workspaces

```gherkin
GIVEN  Super Admin truy cập /admin-panel/workspaces
WHEN   trang tải xong
THEN   một DataTable phân trang hiển thị: Tên, Slug, Email chủ sở hữu, Badge plan,
       Badge trạng thái (active/trialing/past_due/cancelled/suspended/terminated),
       SSO status (activated/inactivated/terminated), Số lượng user, Dung lượng đã dùng/giới hạn, Ngày tạo
  AND  bộ lọc dropdown có sẵn cho: Plan, Trạng thái, SSO Status
  AND  workspace bị terminated hiển thị badge đỏ + ghi chú "Gói đã bị xóa trên SSO"
  AND  workspace bị suspended hiển thị badge vàng + ghi chú "Đang bị khóa tạm thời"
  AND  click vào dòng mở Payload admin cho tenant đó trong tab mới
```

#### AC-9: Trạng thái trống

```gherkin
GIVEN  Super Admin tìm kiếm một user/workspace không tồn tại
WHEN   kết quả trả về trống
THEN   hiển thị thông báo "Không tìm thấy user nào" / "Không tìm thấy workspace nào" với nút xóa bộ lọc
```

---

### US-F15-05: Broadcast Notification UI

**Phase 2** | **P1** | **S** | **Trạng thái:** Ready
**Branch:** `feat/F15-02-user-management` (gộp chung với Phase 2)

#### Story

```
As a   Super Admin
I want gửi thông báo broadcast tới tất cả users từ giao diện admin
So that tôi có thể thông báo bảo trì, cập nhật, hoặc khuyến mãi mà không cần truy cập DB
```

#### AC-1: Form Broadcast

```gherkin
GIVEN  Super Admin truy cập /admin-panel/broadcast
WHEN   trang tải xong
THEN   một form hiển thị với các trường: Tiêu đề (bắt buộc, tối đa 200 ký tự),
       Nội dung (bắt buộc, tối đa 2000 ký tự), URL hành động (tùy chọn),
       Đối tượng nhận (dropdown: "Tất cả" — hiện tại chỉ có tùy chọn này)
```

#### AC-2: Gửi Broadcast

```gherkin
GIVEN  Super Admin điền form broadcast với dữ liệu hợp lệ
WHEN   họ click [Gửi] và xác nhận qua dialog
THEN   hệ thống gọi POST /api/admin/broadcasts (API đã có sẵn)
  AND  toast "Đã gửi broadcast tới {N} users" xuất hiện khi thành công
  AND  bảo vệ XSS: thẻ HTML bị loại bỏ khỏi tiêu đề/nội dung
  AND  kiểm tra URL: chỉ cho phép đường dẫn nội bộ (/) hoặc http(s)://
```

#### AC-3: Xử lý lỗi Broadcast

```gherkin
GIVEN  Super Admin gửi broadcast không hợp lệ (tiêu đề trống, nội dung quá dài, URL không hợp lệ)
WHEN   kiểm tra validation thất bại
THEN   thông báo lỗi inline hiển thị bên cạnh trường không hợp lệ
  AND  form KHÔNG được gửi đi
```

#### AC-4: Broadcasts gần đây

```gherkin
GIVEN  Super Admin đang ở trang broadcast
WHEN   trang tải xong
THEN   danh sách broadcasts gần đây hiển thị bên dưới form
  AND  mỗi entry hiển thị: tiêu đề, preview nội dung, ngày gửi, số người nhận
```

---

### US-F15-06: Admin Panel Layout & Login Routing

**Phase 2** | **P0** | **M** | **Trạng thái:** Ready
**Branch:** `feat/F15-02-user-management` (gộp chung với Phase 2)

#### Story

```
As a   Super Admin
I want có giao diện admin riêng, tách biệt với tenant dashboard
So that tôi không bị nhầm lẫn và có thể truy cập nhanh các công cụ quản trị
```

#### AC-1: Admin Layout

```gherkin
GIVEN  một user có role `super-admin` truy cập /admin-panel
WHEN   trang tải xong
THEN   Admin Panel layout render với:
       AdminSidebar (dark theme, badge "ADMIN" ở header),
       AdminHeader (chỉ báo admin),
       và vùng nội dung chính
  AND  layout này tách biệt với layout tenant dashboard
```

#### AC-2: Redirect sau đăng nhập

```gherkin
GIVEN  một user đăng nhập thành công tại /login
WHEN   hệ thống kiểm tra user.roles
THEN   nếu roles bao gồm `super-admin` → redirect tới /admin-panel
  AND  nếu roles bao gồm `tenant-owner` → redirect tới /dashboard (hành vi hiện tại)
```

#### AC-3: Bảo vệ Route

```gherkin
GIVEN  một user KHÔNG có role `super-admin` cố truy cập /admin-panel/*
WHEN   middleware kiểm tra role
THEN   user bị redirect về /dashboard
  AND  các API endpoint dưới /api/admin/* trả về 403 Forbidden
```

#### AC-4: Thanh điều hướng Admin Sidebar

```gherkin
GIVEN  Super Admin đang trong Admin Panel
WHEN   họ nhìn vào sidebar
THEN   các mục menu hiển thị:
       Dashboard (/admin-panel) — Phase 3
       Users (/admin-panel/users) — Phase 2
       Workspaces (/admin-panel/workspaces) — Phase 2
       Activity Logs (/admin-panel/activity-logs) — Phase 1
       Broadcast (/admin-panel/broadcast) — Phase 2
  AND  các mục menu CHỈ hiển thị cho users có role `super-admin`
```

---

## Phase 3 — Lịch sử sử dụng & Dashboard KPIs

### US-F15-03: Admin Dashboard KPIs

**Phase 3** | **P1** | **M** | **Trạng thái:** Ready
**Branch:** `feat/F15-03-usage-history`
**Phụ thuộc:** US-F15-01 (Activity Logs — cho chỉ số "Hoạt động hôm nay")

#### Story

```
As a   Super Admin
I want xem dashboard tổng quan với các chỉ số KPI của platform
So that tôi nắm được tình hình sử dụng hệ thống mà không cần truy vấn DB
```

#### AC-1: KPI Cards

```gherkin
GIVEN  Super Admin truy cập /admin-panel (trang chủ dashboard)
WHEN   trang tải xong
THEN   các KPI cards hiển thị:
       Tổng số users đã đăng ký (đếm),
       Hoạt động hôm nay (số users riêng biệt có entry activity_log hôm nay),
       Mới trong tuần (users tạo trong 7 ngày qua),
       Tổng chi phí AI tháng này (tổng ai_usage_logs.cost_usd)
  AND  các cards hiển thị dữ liệu chính xác khớp với truy vấn DB
```

#### AC-2: Phân bổ Tenants

```gherkin
GIVEN  Super Admin đang ở dashboard
WHEN   họ xem phần tenants
THEN   Tenants theo Plan hiển thị phân bổ: Freemium / Starter / Standard / Professional
  AND  Tenants theo Trạng thái hiển thị: active / trialing / past_due / cancelled / suspended
  AND  các con số khớp với tổng số tenants thực tế trong DB
```

#### AC-3: Tự động làm mới

```gherkin
GIVEN  Super Admin đang ở dashboard
WHEN   60 giây trôi qua
THEN   dữ liệu KPI tự động làm mới mà không cần tải lại trang
  AND  không có nhấp nháy khi làm mới
```

#### AC-4: Trạng thái trống Dashboard

```gherkin
GIVEN  hệ thống chưa có users hoặc tenants (cài đặt mới)
WHEN   Super Admin xem dashboard
THEN   các KPI cards hiển thị "0" hoặc "—" (không phải lỗi)
  AND  "Hoạt động hôm nay" hiển thị "—" nếu bảng activity_logs trống
  AND  không có lỗi chia cho 0
```

---

### US-F15-04: Lịch sử sử dụng & Thông tin Plan

**Phase 3** | **P1** | **M** | **Trạng thái:** Ready
**Branch:** `feat/F15-03-usage-history` (gộp chung với Phase 3)
**Phụ thuộc:** US-F15-02 (Trang chi tiết User)

#### Story

```
As a   Super Admin
I want xem chi tiết mức độ sử dụng của từng tenant và thông tin plan/SSO
So that tôi hiểu rõ tenant nào đang active, đang dùng bao nhiêu tài nguyên
```

#### AC-1: Tab Thống kê sử dụng

```gherkin
GIVEN  Super Admin đang ở trang chi tiết user (/admin-panel/users/[id])
WHEN   họ xem tab "Sử dụng" (tab mới thêm trong Phase 3)
THEN   hiển thị các thẻ thống kê:
       Số lượng Products, Số lượng Orders, Số lượng Blogs, Số lượng Sites,
       Dung lượng đã dùng so với giới hạn (thanh tiến trình),
       AI site đã tạo (badge có/không + số lần tạo)
  AND  dữ liệu được lấy từ GET /api/admin/users/[id]/usage
```

#### AC-2: Thông tin Plan & SSO

```gherkin
GIVEN  Super Admin đang xem tab Sử dụng
WHEN   dữ liệu tải xong
THEN   thẻ "Plan & SSO" hiển thị (chỉ đọc):
       Plan hiện tại (Freemium/Starter/Standard/Professional) với badge,
       SSO pack_code, customer_id, service_id, order_id
  AND  tất cả trường là chỉ đọc (không có nút chỉnh sửa)
```

#### AC-3: Phân tích chi phí AI

```gherkin
GIVEN  Super Admin đang xem tab Sử dụng cho một tenant đã dùng tính năng AI
WHEN   phần AI usage tải xong
THEN   hiển thị: tổng chi phí AI (USD) tháng này,
       và bảng 10 lượt gọi AI gần nhất với: endpoint, model, chi phí, độ trễ, thời gian
  AND  nếu chưa có AI usage, hiển thị "Chưa có dữ liệu sử dụng AI"
```

#### AC-4: Độ chính xác dữ liệu sử dụng

```gherkin
GIVEN  một tenant có số liệu đã biết (ví dụ: 42 products, 180 orders)
WHEN   Super Admin xem tab Sử dụng
THEN   các con số hiển thị khớp với tổng thực tế trong DB
  AND  API phản hồi trong vòng 1 giây
```

---

## Stories Deferred (Ngoài phạm vi Phase 1)

> Các stories sau **KHÔNG nằm trong Phase 1**. Giữ lại để tham chiếu khi lên plan tiếp theo.

| Story ID | Tiêu đề | Lý do Deferred |
|----------|---------|----------------|
| ~~US-F15-07~~ | Impersonation (Xem với tư cách Tenant) | Phức tạp security — cần session management riêng, audit trail đặc biệt |
| ~~US-F15-08~~ | Cấu hình Subscription Tier | 4 gói hiện tại giới hạn giống nhau, chưa cần config UI |
| ~~US-F15-09~~ | Quản lý Khuyến mãi/Voucher | Phụ thuộc Subscription Tier Config |
| ~~US-F15-10~~ | Chiến dịch tự động | Cần trigger engine riêng (event-driven) |
| ~~US-F15-11~~ | Tích hợp đa kênh | Cần budget third-party (Zalo ZNS, SendGrid, Messenger) |
| ~~US-F15-12~~ | MRR/Churn Analytics Dashboard | Chưa có recurring revenue data |
| ~~US-F15-13~~ | Mobile Responsive Admin | Phase 1 ưu tiên desktop, responsive sau |
