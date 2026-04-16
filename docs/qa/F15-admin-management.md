# Bộ Test Case: F15 — Admin Management (Phase 1)
> **Version:** 2.0 | **Cập nhật:** 2026-04-16 | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** PRD v2.0 (`F15-admin-management.md`), User Stories v2.0 (US-F15-01 đến US-F15-06).

---

## 1. Mục Tiêu (Objective)
Cung cấp bộ Test Suite kiểm thử tính năng Admin Management Phase 1 (F15). Bao phủ 6 User Stories: Activity Logs, User & Workspace Management, Admin Dashboard KPIs, Usage History, Broadcast Notification UI, và Admin Panel Layout. Tổng cộng **35 kịch bản chi tiết** bao gồm Functional, UI, Security và Edge cases.

> **Scope thay đổi so với v1.0:**
> - **Đã loại bỏ:** MRR/Churn Analytics, Impersonation, Subscription Tier Config, Promo Codes, RBAC đa role (Support/Admin).
> - **Đã thêm:** SSO status tracking, xem lỗi user gặp phải, Admin Panel layout riêng.
> - **Chỉ có 1 tài khoản `super-admin`** truy cập admin panel. Không có Support Staff / Marketing role.
> - **Suspend/unsuspend: DEFERRED** — Admin chỉ xem thông tin + lỗi user gặp phải.

---

## 2. Thông Tin Chung (Test Environment)
| Thông số | Diễn giải |
|---|---|
| Môi trường | Staging với dữ liệu >= 20 workspaces, 100+ users, activity logs data. |
| Tham gia | Super Admin (1 tài khoản duy nhất), Tenant Owner (để test access denied). |
| Thiết bị | Desktop (1440px). Mobile responsive deferred. |
| Auth | Đăng nhập chung tại `/login`, redirect theo role. |
| Roles | Super Admin (full access admin panel). Không có role Admin/Support. |

---

## 3. Ma Trận Kịch Bản Kiểm Thử (Traceability Matrix)

| ID | LOẠI | KỊCH BẢN (Scenario) | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI (EXPECTED) | MỨC ĐỘ |
|:---|:---|:---|:---|:---|:---:|
| **[US-F15-06] Admin Panel Layout & Login Routing** ||||||
| **TC-F15.01** | `Func` | Admin layout render đúng | **1.** Super Admin đăng nhập tại `/login`. **2.** Hệ thống redirect tới `/admin-panel`. | **GIVEN** user có role `super-admin` **WHEN** đăng nhập thành công **THEN** redirect tới `/admin-panel`. AdminSidebar (dark theme, badge "ADMIN") và AdminHeader hiển thị đúng. Layout tách biệt với tenant dashboard. | Blocker |
| **TC-F15.02** | `Func` | Login redirect theo role | **1.** Đăng nhập với tài khoản `tenant-owner`. **2.** Kiểm tra redirect. | **GIVEN** user có role `tenant-owner` **WHEN** đăng nhập **THEN** redirect tới `/dashboard` (không phải `/admin-panel`). | Critical |
| **TC-F15.03** | `Sec` | Route guard chặn non-admin | **1.** Đăng nhập với tenant-owner. **2.** Truy cập trực tiếp URL `/admin-panel`. | **GIVEN** user KHÔNG có role `super-admin` **WHEN** truy cập `/admin-panel/*` **THEN** redirect về `/dashboard`. API `/api/admin/*` trả 403 Forbidden. | Blocker |
| **TC-F15.04** | `Func` | Sidebar menu hiện đầy đủ | **1.** Super Admin đang ở `/admin-panel`. **2.** Kiểm tra sidebar. | **GIVEN** super-admin đăng nhập **WHEN** xem sidebar **THEN** hiện các menu: Dashboard, Users, Workspaces, Activity Logs, Broadcast. Mỗi link navigate đúng route. | High |
| **[US-F15-01] Activity Logs — Nhật ký hoạt động** ||||||
| **TC-F15.05** | `Func` | Ghi log Mutations đầy đủ | **1.** Tenant Owner tạo product mới. **2.** Super Admin xem Activity Logs. | **GIVEN** user thực hiện create/update/delete trên collection **WHEN** thao tác hoàn thành **THEN** activity_logs có entry với: actor_id, action, resource, resource_id, tenant_id, ip_address, user_agent, metadata, created_at. | Critical |
| **TC-F15.06** | `Func` | Ghi log Auth events | **1.** User đăng nhập thành công. **2.** User đăng nhập thất bại (sai mật khẩu). **3.** Super Admin xem logs. | **GIVEN** auth event xảy ra **WHEN** đăng nhập thành công/thất bại/đăng xuất **THEN** log có action = login/login_failed/logout. login_failed metadata có email (KHÔNG có mật khẩu). Log có ip_address và user_agent. | Critical |
| **TC-F15.07** | `Func` | Ghi log AI events | **1.** User tạo website bằng AI. **2.** Super Admin xem logs. | **GIVEN** AI request hoàn thành **WHEN** thành công hoặc thất bại **THEN** log có action tương ứng (ai_generate_site, ai_edit_block, ...). Thành công: metadata có model, cost_usd, time_ms. Thất bại: metadata có error_code, error_message, time_ms. | Critical |
| **TC-F15.08** | `Func` | Ghi log Editor events (site_save) | **1.** User chỉnh sửa website trong editor và lưu. **2.** Super Admin xem logs. | **GIVEN** user lưu chỉnh sửa trong editor **WHEN** PATCH /api/sites/[siteId]/save thành công **THEN** log có action = site_save, metadata.changes_summary ghi chi tiết: blocks_added, blocks_removed, blocks_modified, theme_changed, header_changed, footer_changed, v.v. | High |
| **TC-F15.09** | `Func` | Truy vấn Activity Logs với bộ lọc | **1.** Super Admin truy cập `/admin-panel/activity-logs`. **2.** Áp dụng bộ lọc: action type, khoảng thời gian, tìm user. | **GIVEN** có nhiều log entries **WHEN** áp dụng bộ lọc **THEN** bảng chỉ hiện entries phù hợp. Bộ lọc kết hợp theo AND. Xóa bộ lọc khôi phục danh sách đầy đủ. Phân trang server-side 50/trang. | High |
| **TC-F15.10** | `Func` | Xem chi tiết log (expand row) | **1.** Super Admin click vào một dòng log. | **GIVEN** click vào log entry **WHEN** dòng mở rộng **THEN** metadata JSON tree hiển thị dễ đọc. Metadata KHÔNG BAO GIỜ chứa mật khẩu, mã OTP, hoặc Stripe secrets. | High |
| **TC-F15.11** | `Sec` | Audit log bất biến (immutable) | **1.** Thử update hoặc create activity logs qua API. | **GIVEN** bất kỳ API consumer nào **WHEN** thử update/create activity logs qua public API **THEN** hệ thống trả 403 Forbidden. Logs là append-only. Chỉ Super Admin có thể xóa (GDPR erasure). | Blocker |
| **TC-F15.12** | `Edge` | Activity logs trạng thái trống | **1.** Hệ thống mới, chưa có log nào. **2.** Xem `/admin-panel/activity-logs`. | **GIVEN** bảng activity_logs trống **WHEN** Super Admin xem trang **THEN** hiện "Chưa có nhật ký hoạt động nào". Không lỗi, không crash. | High |
| **TC-F15.13** | `Perf` | API activity-logs performance | **1.** Database có >= 100k log entries. **2.** GET /api/admin/activity-logs. | **GIVEN** 100k+ entries **WHEN** query với bộ lọc **THEN** API response < 500ms p95. Phân trang hoạt động chính xác. | High |
| **[US-F15-02] Quản lý User & Workspace** ||||||
| **TC-F15.14** | `Func` | Danh sách Users hiện đúng | **1.** Super Admin truy cập `/admin-panel/users`. | **GIVEN** có nhiều users trong hệ thống **WHEN** trang tải xong **THEN** DataTable hiện: Tên (link chi tiết), Email, Badge vai trò, Tenant + Plan, Badge trạng thái workspace, SSO status badge (Owner), Lần đăng nhập cuối, Ngày tạo. Phân trang 50/trang. | Critical |
| **TC-F15.15** | `Func` | Tìm kiếm User theo email/tên | **1.** Nhập email hoặc tên vào ô tìm kiếm. | **GIVEN** users tồn tại **WHEN** gõ tìm kiếm **THEN** kết quả lọc theo email hoặc tên (case-insensitive). Debounce 300ms. Xóa tìm kiếm khôi phục danh sách. | High |
| **TC-F15.16** | `Func` | Lọc Users theo role và status | **1.** Chọn bộ lọc Role = "tenant-owner", Status = "active". | **GIVEN** có users phù hợp **WHEN** áp dụng filter **THEN** chỉ hiện users thỏa điều kiện AND. Số lượng khớp với DB. | High |
| **TC-F15.17** | `Func` | Trang chi tiết User — Owner | **1.** Click vào một Owner user trong danh sách. | **GIVEN** user là Owner **WHEN** xem chi tiết **THEN** hiện: hồ sơ (tên, email, vai trò, ngày tạo, lần đăng nhập cuối), tenant memberships (vai trò, trạng thái, plan), SSO status badge (activated/inactivated/terminated), SSO info (customerId, serviceId, packCode, orderId), link "Xem workspace", 20 activity log entries gần nhất. | Critical |
| **TC-F15.18** | `Func` | Trang chi tiết User — Staff | **1.** Click vào một Staff user trong danh sách. | **GIVEN** user là Staff **WHEN** xem chi tiết **THEN** hiện: hồ sơ, workspace membership status. Nếu workspace bị suspended: cảnh báo "Workspace này đang bị khóa (inactivated)". Nếu terminated: "Workspace này đã bị xóa (terminated)". | High |
| **TC-F15.19** | `Func` | Xem lỗi user gặp phải | **1.** Super Admin xem chi tiết user có nhiều login_failed. **2.** Filter "Errors only". | **GIVEN** user có activity logs lỗi **WHEN** xem phần "Hoạt động gần đây" và filter lỗi **THEN** các entry login_failed/lỗi hệ thống hiện rõ ràng (highlight). Mỗi entry có: thời gian, loại lỗi, IP, metadata. | High |
| **TC-F15.20** | `Func` | Danh sách Workspaces | **1.** Super Admin truy cập `/admin-panel/workspaces`. | **GIVEN** có nhiều tenants **WHEN** trang tải xong **THEN** DataTable hiện: Tên, Slug, Email chủ sở hữu, Badge plan, Badge trạng thái, SSO status badge, Số user, Dung lượng đã dùng/giới hạn, Ngày tạo. Bộ lọc: Plan, Trạng thái, SSO Status. | Critical |
| **TC-F15.21** | `Func` | Workspace terminated badge | **1.** Xem workspace có SSO status = terminated. | **GIVEN** workspace bị terminated **WHEN** xem danh sách **THEN** badge đỏ + ghi chú "Gói đã bị xóa trên SSO". Click vào dòng mở Payload admin trong tab mới. | High |
| **TC-F15.22** | `Edge` | Tìm kiếm user/workspace không tồn tại | **1.** Nhập email không tồn tại vào tìm kiếm. | **GIVEN** không có kết quả phù hợp **WHEN** tìm kiếm **THEN** hiện "Không tìm thấy user nào" / "Không tìm thấy workspace nào" với nút xóa bộ lọc. | Medium |
| **[US-F15-05] Broadcast Notification UI** ||||||
| **TC-F15.23** | `Func` | Gửi broadcast notification | **1.** Super Admin vào `/admin-panel/broadcast`. **2.** Nhập: Title = "Bảo trì hệ thống", Message = "Hệ thống sẽ bảo trì lúc 2AM", Target = "Tất cả". **3.** Bấm Gửi + xác nhận dialog. | **GIVEN** nhập nội dung broadcast hợp lệ **WHEN** bấm Gửi + xác nhận **THEN** API POST /api/admin/broadcasts trả thành công. Toast "Đã gửi broadcast tới {N} users". Audit log ghi nhận. | High |
| **TC-F15.24** | `Func` | Validation broadcast form | **1.** Để trống Title. **2.** Nhập Message > 2000 ký tự. **3.** Nhập URL không hợp lệ (javascript:). | **GIVEN** dữ liệu không hợp lệ **WHEN** bấm Gửi **THEN** lỗi inline hiện cạnh trường sai. Form KHÔNG gửi đi. | High |
| **TC-F15.25** | `Sec` | XSS protection broadcast | **1.** Nhập Title = `<script>alert('xss')</script>`. **2.** Gửi broadcast. | **GIVEN** nội dung có HTML/script **WHEN** gửi broadcast **THEN** thẻ HTML bị strip. Notification hiện text thuần (không execute script). | Critical |
| **TC-F15.26** | `Func` | Broadcasts gần đây | **1.** Sau khi gửi broadcast, xem lại trang. | **GIVEN** đã gửi broadcast **WHEN** tải lại trang **THEN** danh sách broadcasts gần đây hiện: tiêu đề, preview nội dung, ngày gửi, số người nhận. | Medium |
| **[US-F15-03] Admin Dashboard KPIs** ||||||
| **TC-F15.27** | `Func` | KPI cards hiện đúng | **1.** Super Admin truy cập `/admin-panel`. | **GIVEN** có dữ liệu users và tenants **WHEN** trang tải xong **THEN** hiện KPI cards: Tổng số Users, Hoạt động hôm nay, Mới trong tuần, Chi phí AI tháng này. Số liệu khớp với DB. | Critical |
| **TC-F15.28** | `Func` | Phân bổ Tenants theo Plan/Status/SSO | **1.** Xem phần tenants trên dashboard. | **GIVEN** có tenants nhiều plan và status **WHEN** xem breakdown **THEN** Tenants theo Plan: free/starter/pro/business. Tenants theo Status: active/trialing/.../terminated. Tenants theo SSO Status: activated/inactivated/terminated. Tổng số khớp DB. | High |
| **TC-F15.29** | `Func` | Auto-refresh KPIs | **1.** Để trang dashboard mở 2 phút. **2.** Thêm user mới ở tab khác. | **GIVEN** dashboard đang mở **WHEN** 60 giây trôi qua **THEN** KPI tự động cập nhật. Không nhấp nháy khi refresh. | High |
| **TC-F15.30** | `Edge` | Dashboard khi chưa có dữ liệu | **1.** Hệ thống mới, chưa có users/tenants. **2.** Xem dashboard. | **GIVEN** không có dữ liệu **WHEN** xem dashboard **THEN** KPI cards hiện "0" hoặc "—". "Hoạt động hôm nay" hiện "—" nếu activity_logs trống. Không lỗi chia cho 0, không crash. | High |
| **[US-F15-04] Lịch sử sử dụng & Thông tin Plan** ||||||
| **TC-F15.31** | `Func` | Tab Sử dụng — thống kê | **1.** Super Admin xem chi tiết user, chọn tab "Sử dụng". | **GIVEN** tenant có dữ liệu **WHEN** xem tab Sử dụng **THEN** hiện: số Products, Orders, Blogs, Sites, dung lượng đã dùng/giới hạn (thanh tiến trình), AI site đã tạo (badge có/không + số lần tạo). Số liệu khớp DB. | Critical |
| **TC-F15.32** | `Func` | Tab Sử dụng — Plan & SSO info | **1.** Xem phần Plan & SSO trên tab Sử dụng. | **GIVEN** tenant có SSO info **WHEN** xem tab **THEN** hiện: Plan badge, packCode, customerId, serviceId, orderId, SSO status badge. Tất cả trường là chỉ đọc (không có nút chỉnh sửa). | High |
| **TC-F15.33** | `Func` | Tab Sử dụng — AI cost breakdown | **1.** Xem phần AI usage cho tenant đã dùng AI. | **GIVEN** tenant có ai_usage_logs **WHEN** xem AI section **THEN** hiện: tổng chi phí USD tháng này, bảng 10 lượt gọi AI gần nhất (endpoint, model, chi phí, độ trễ, thời gian). | High |
| **TC-F15.34** | `Edge` | Tab Sử dụng — chưa có AI usage | **1.** Xem tab Sử dụng cho tenant chưa dùng AI. | **GIVEN** tenant chưa dùng AI **WHEN** xem AI section **THEN** hiện "Chưa có dữ liệu sử dụng AI". Không lỗi. | Medium |
| **TC-F15.35** | `Perf` | API usage response time | **1.** GET /api/admin/users/[id]/usage với tenant có nhiều dữ liệu. | **GIVEN** tenant có >= 1000 products, 5000 orders **WHEN** query usage **THEN** API response < 1 giây. | High |

---

## 4. Hành Trình End-to-End (E2E UAT Flow)

**E2E #1: Admin đăng nhập → Dashboard → Chi tiết User → Lỗi user**
1. Super Admin đăng nhập tại `/login` → verify redirect tới `/admin-panel`.
2. Xem Dashboard — kiểm tra KPI cards khớp DB (total users, active today, AI cost).
3. Click "Users" trong sidebar → verify danh sách users load đúng.
4. Tìm user bằng email → click vào chi tiết.
5. Xem SSO status badge → verify đúng trạng thái từ SSO.
6. Xem "Hoạt động gần đây" → filter "Errors only" → verify login_failed entries.
7. Chuyển qua tab "Sử dụng" → verify products/orders/AI cost khớp DB.

**E2E #2: Quản lý Workspace → Broadcast**
1. Super Admin truy cập `/admin-panel/workspaces`.
2. Lọc theo plan = "starter" → verify chỉ hiện starter workspaces.
3. Lọc theo SSO Status = "inactivated" → verify chỉ hiện workspaces bị khóa.
4. Click workspace → mở Payload admin trong tab mới.
5. Quay lại `/admin-panel/broadcast` → gửi broadcast "Bảo trì hệ thống".
6. Xác nhận dialog → toast thành công.
7. Verify broadcast xuất hiện trong danh sách gần đây.
8. Xem Activity Logs → verify có entry broadcast vừa gửi.

**E2E #3: Kiểm tra quyền truy cập**
1. Đăng nhập với `tenant-owner` → verify redirect tới `/dashboard`.
2. Thử truy cập `/admin-panel` trực tiếp → verify redirect về `/dashboard`.
3. Thử gọi `GET /api/admin/users` → verify 403 Forbidden.
4. Thử gọi `POST /api/admin/broadcasts` → verify 403 Forbidden.
5. Đăng xuất, đăng nhập lại với `super-admin` → verify truy cập được `/admin-panel`.

---

## 5. Tiêu chí Đánh giá Chất lượng (Quality Gates)

| Nhóm Kiểm thử | Trạng thái | Ghi chú |
|---|---|---|
| **1. Admin Panel Layout & Routing** | [ ] Đã chạy 0/4 TC | Login redirect, route guard, sidebar menu. |
| **2. Activity Logs** | [ ] Đã chạy 0/9 TC | Mutation/auth/AI/editor logging, filtering, immutability, performance. |
| **3. User & Workspace Management** | [ ] Đã chạy 0/9 TC | Danh sách user, chi tiết (Owner/Staff), SSO status, xem lỗi, workspace list. |
| **4. Broadcast** | [ ] Đã chạy 0/4 TC | Gửi, validation, XSS, danh sách gần đây. |
| **5. Dashboard KPIs** | [ ] Đã chạy 0/4 TC | Độ chính xác KPI, phân bổ tenant, auto-refresh, trạng thái trống. |
| **6. Lịch sử sử dụng** | [ ] Đã chạy 0/5 TC | Thống kê, Plan & SSO info, AI cost, trạng thái trống, performance. |

> **Lưu ý Release:**
> - TC-F15.01 (Admin layout), TC-F15.03 (Route guard), TC-F15.11 (Audit immutability) là **Blocker** — không release nếu chưa PASS.
> - Suspend/unsuspend đã **deferred** — không test.
> - Chỉ có 1 role `super-admin` — không cần test RBAC đa role.
