# Release Test Plan & Test Cases: F02 - Auth Flow
> **Version:** 2.2 (Release Candidate - Full Coverage) | **Updated:** 2026-04-06 | **Role:** Test Engineer
> **Reference PRD:** [F02-auth.md](../prd/F02-auth.md) | **Reference US:** [F02-auth-stories.md](../stories/F02-auth-stories.md)

---

## 1. Mục Tiêu Kiểm Thử (Objective)

Tài liệu cung cấp kế hoạch kiểm thử nghiệm thu toàn diện (Release Gate) đối với tính năng F02 Auth Flow. Đảm bảo cấu trúc chuẩn 42 Test Cases bao gồm UI/UX, Automation (Playwright), Server API (Payload CMS), Performance (K6) và Security. Không phát sinh rò rỉ chức năng.

Hệ thống được kiểm định qua 6 nhóm nghiệp vụ:
1. `UI/UX & RWD` — Giao diện ứng dụng và hiển thị đa thiết bị.
2. `Func` — Luồng chức năng Đăng ký, Đăng nhập và Phân quyền.
3. `Validate` — Xác thực biểu mẫu Form phía Client/Server.
4. `Sec & Auth` — Bảo vệ Session, Role Invite-only và Anti-Enumeration.
5. `API & DB` — Lưu trữ Payload Tenant, gửi Email chính xác.
6. `Perf & Stress` — Đo Performance và giới hạn server.

---

## 2. Quản Lý Truy Vết (Traceability Matrix)

| Khu vực Nghiệp Vụ (Area) | User Story Reference | FR Reference | Tổng TCs |
|:---|:---|:---|:---:|
| **1. UI/UX & Responsive Web Design** | US-F02-02 | FR-07, FR-10 | 6 |
| **2. Đăng Ký (Register - Owner)** | US-F02-01 | FR-01 → FR-06 | 8 |
| **3. Đăng Nhập (Login) & 2FA** | US-F02-02, 07 | FR-08, 09 | 8 |
| **4. Quên / Đặt Lại Mật Khẩu** | US-F02-05, 06 | FR-14, 15 | 7 |
| **5. Auth Guard & Role Access** | US-F02-03, 04 | FR-11, 12, 13 | 7 |
| **6. Hiệu Năng & Non-Functional** | N/A | BR-03, BR-05 | 3 |

---

## 3. CHI TIẾT TEST CASES

### 3.1. Nhóm UI/UX & Tương Thích (RWD / Compatibility) — (US-F02-02, FR-07, FR-10)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---|:---:|
| **TC-F02.01** | `UI` | Hiển thị bố cục Split-Screen trên Desktop | 1. Mở trình duyệt ở kích thước ≥ 1280px.<br>2. Truy cập `/login`.<br>3. Quan sát bố cục trang. | - Vùng Banner hiển thị bên trái, Form bên phải.<br>- Nút hướng dẫn nằm ở phía dưới cùng. | Medium |
| **TC-F02.02** | `UI` | Bố cục Stack Column trên mobile | 1. Thu hẹp trình duyệt xuống ≤ 768px (hoặc dùng thiết bị thực).<br>2. Truy cập `/login`.<br>3. Thử tap vào các phần tử. | - Form hiển thị theo trục dọc.<br>- Các phần tử có diện tích click ≥ 44px.<br>- Bàn phím ảo không che Form. | High |
| **TC-F02.03** | `UX` | Loading State của nút Submit | 1. Nhập thông tin đăng nhập hợp lệ.<br>2. Nhấn **Sign In**.<br>3. Quan sát trạng thái nút ngay sau khi nhấn. | - Nút chuyển Disabled và hiện spinner.<br>- Không thể nhấn đúp để gửi form 2 lần. | High |
| **TC-F02.04** | `UX` | Hiển thị Error State trên Form | 1. Vào form đăng ký.<br>2. Điền dữ liệu sai định dạng (email thiếu @, mật khẩu quá ngắn...).<br>3. Nhấn Submit. | - Cảnh báo đỏ hiển thị inline tại từng trường lỗi.<br>- Banner alert xuất hiện ở đầu form. | High |
| **TC-F02.05** | `Compat` | Tương thích trên Safari & Firefox | 1. Mở màn hình `/login` trên **Safari**.<br>2. Mở lại trên **Firefox**.<br>3. Kiểm tra console của từng trình duyệt. | - Giao diện render đúng trên cả hai.<br>- Console không có JavaScript Error. | Low |
| **TC-F02.06** | `UX` | Điều hướng Form bằng phím Tab | 1. Vào form Đăng ký / Đăng nhập.<br>2. Chỉ dùng phím `Tab` di chuyển giữa các trường (không dùng chuột). | - Focus đi theo thứ tự: Email → Password → Submit.<br>- Outline focus hiển thị rõ theo chuẩn WCAG. | Low |
| **TC-F02.06b** | `UX` | Chống Auto-Zoom iOS & Numpad OTP | 1. Dùng iPhone/iOS Safari, vào `/login`.<br>2. Tap vào ô Input, quan sát màn hình.<br>3. Chuyển sang `/verify-otp`, tap vào ô OTP. | - Màn hình không bị zoom (font-size ≥ 16px).<br>- Ô OTP kích hoạt bàn phím số (`inputmode=numeric`).<br>- Focus tự chuyển ô khi nhập đủ ký tự. | High |

---

### 3.2. Nhóm Đăng Ký Tài Khoản (Register - Role Owner) — (US-F02-01, FR-01 → FR-06)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---|:---:|
| **TC-F02.07** | `API` | Khởi tạo Owner qua SSO Webhook | 1. Chuẩn bị System Token hợp lệ.<br>2. Gọi `POST /api/users/sso/provision` với đầy đủ payload.<br>3. Kiểm tra response và dữ liệu trong DB. | - Trả về `HTTP 201`.<br>- Tạo 1 account role `owner` + 1 Workspace Tenant.<br>- Dữ liệu khớp payload đã gửi. | Blocker |
| **TC-F02.08** | `Func` | Gửi Welcome Email sau đăng ký thành công | 1. Tạo tài khoản thành công như TC-F02.07.<br>2. Kiểm tra hộp thư của email Owner. | - Email Welcome được gửi đến Owner.<br>- Email chứa link redirect hợp lệ. | High |
| **TC-F02.09** | `Valid` | SSO API từ chối khi thiếu Service ID | 1. Gọi `POST /api/users/sso/provision`.<br>2. Truyền `service_id` = `""` hoặc `"NA"`. | - Trả về `HTTP 400 Bad Request`.<br>- Response mô tả rõ lỗi thiếu `service_id`. | Khẩn |
| **TC-F02.10** | `Valid` | SSO API từ chối khi trùng email/ID | 1. Dùng payload với `email`, `customer_id_number` hoặc `service_id` đã tồn tại.<br>2. Gọi `POST /api/users/sso/provision`. | - Trả về `HTTP 409 Conflict`.<br>- Không ghi đè dữ liệu cũ trong DB. | Khẩn |
| **TC-F02.11** | `DB` | Lưu Pack Code & Meta Data đúng schema | 1. Gọi API provision với `pack_code="STARTER"` và thêm các params phụ.<br>2. Kiểm tra record Tenant trong DB sau khi tạo. | - Gói cước Tenant = `"STARTER"`.<br>- Params phụ được lưu vào object `meta_data` dạng JSON. | High |
| **TC-F02.15** | `Sec` | Cấm Staff tự đăng ký qua API | 1. Gửi request API đăng ký với `role: "staff"` trong payload.<br>2. Không sử dụng System Token hợp lệ. | - Trả về `HTTP 403 Forbidden`.<br>- Không tạo account nào trong DB. | Blocker |
| **TC-F02.16** | `DB` | Mỗi Owner chỉ có đúng 1 Workspace | 1. Tạo tài khoản Owner thành công qua SSO.<br>2. Kiểm tra cấu trúc dữ liệu trong DB. | - Mảng `tenants` trỏ đúng vào Owner.<br>- Chỉ có đúng 1 Workspace record. | Khẩn |
| **TC-F02.17** | `Auth` | Owner không tạo được Workspace thứ 2 | 1. Đăng nhập tài khoản Owner đã có Workspace.<br>2. Gửi `POST /tenants` để tạo thêm Workspace mới. | - Trả về `HTTP 401 Unauthorized`.<br>- Không có Workspace mới được tạo. | High |
| **TC-F02.18** | `DB` | Dữ liệu tài khoản ánh xạ đúng DB schema | 1. Tạo tài khoản qua SSO thành công.<br>2. Vào Payload Admin CMS, kiểm tra record Users. | - Tên công ty, BRN lưu vào collection mở rộng.<br>- First/Last name lưu đúng vào core Users. | High |

---

### 3.3. Nhóm Đăng Nhập & Xác Thực OTP (2FA) — (US-F02-02, 07)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---|:---:|
| **TC-F02.19** | `Sec` | Bắt buộc 2FA với mọi tài khoản | 1. Tạo account Staff không bật 2FA.<br>2. Đăng nhập với email và mật khẩu đúng.<br>3. Quan sát hành vi sau xác thực mật khẩu. | - Hệ thống không cấp session ngay.<br>- Hiển thị modal yêu cầu nhập OTP qua email.<br>- Không có cách nào bypass bước 2FA. | Blocker |
| **TC-F02.20** | `Func` | Đăng nhập thất bại khi sai mật khẩu | 1. Truy cập `/login`.<br>2. Nhập email đúng, mật khẩu sai.<br>3. Nhấn Sign In. | - Trả về `HTTP 401`.<br>- Hiện toast/alert thông báo sai thông tin.<br>- Nút Sign In trở về trạng thái bình thường. | High |
| **TC-F02.21** | `Func` | Kích hoạt OTP sau xác thực mật khẩu thành công | 1. Truy cập `/login`.<br>2. Nhập đúng email + mật khẩu của Staff.<br>3. Nhấn Sign In, quan sát màn hình tiếp theo. | - Không set cookie session.<br>- Hiện modal/màn hình nhập OTP.<br>- Timer đếm ngược, email OTP được gửi đi. | Blocker |
| **TC-F02.22** | `Sec` | Chặn bypass OTP bằng thay đổi URL | 1. Sau khi nhập mật khẩu đúng, đang ở màn hình chờ OTP.<br>2. Gõ thẳng `/dashboard` vào thanh địa chỉ. | - Middleware chặn, redirect về `/login`.<br>- Không có session/cookie nào được cấp. | Khẩn |
| **TC-F02.23** | `Func` | Đăng nhập thành công khi nhập đúng OTP | 1. Nhận mã OTP 6 số qua email.<br>2. Nhập mã vào form xác thực.<br>3. Nhấn xác nhận. | - OTP được xác thực thành công.<br>- Cấp JWT session hợp lệ.<br>- Redirect tới Workspace của người dùng. | Blocker |
| **TC-F02.24** | `Valid` | Từ chối khi nhập OTP sai | 1. Ở màn hình nhập OTP.<br>2. Nhập mã ngẫu nhiên không đúng (vd: `000000`).<br>3. Nhấn xác nhận. | - Hệ thống từ chối, không cấp session.<br>- Hiện thông báo "Mã không hợp lệ". | High |
| **TC-F02.25** | `Bound` | OTP hết hạn sau 5 phút | 1. Nhận mã OTP hợp lệ qua email.<br>2. Chờ hơn 5 phút không nhập.<br>3. Nhập mã vào form, nhấn xác nhận. | - Hệ thống báo mã đã hết hạn.<br>- Hiện nút yêu cầu gửi lại mã mới. | High |
| **TC-F02.26** | `UX` | Nút Resend OTP bị khóa 60 giây (Cooldown) | 1. Ở màn hình nhập OTP, nhấn **Gửi lại mã**.<br>2. Tiếp tục nhấn nhiều lần liên tiếp.<br>3. Chờ đủ 60 giây, quan sát lại. | - Sau lần nhấn đầu, nút chuyển Disabled.<br>- Nút bị khóa đúng 60 giây.<br>- Sau 60 giây, nút trở về bình thường. | Medium |

---

### 3.4. Nhóm Quên / Đặt Lại Mật Khẩu — (US-F02-05, 06)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---|:---:|
| **TC-F02.27** | `Sec` | Không lộ thông tin email có/không tồn tại | 1. Truy cập trang Quên Mật Khẩu.<br>2. Nhập email không tồn tại (vd: `nobody@xxx.com`).<br>3. Nhấn Submit, quan sát thông báo. | - Luôn hiển thị thông báo dạng "Email đã được gửi nếu tài khoản tồn tại".<br>- Không phân biệt response giữa email có và không có trong DB. | Khẩn |
| **TC-F02.28** | `Func` | Gửi email đặt lại mật khẩu cho Staff | 1. Vào trang Quên Mật Khẩu.<br>2. Nhập email của tài khoản role `staff`.<br>3. Nhấn Submit.<br>4. Kiểm tra hộp thư email. | - Email đặt lại MK được gửi qua Payload Email Service.<br>- Email chứa link reset kèm `?token=XX` hợp lệ. | Blocker |
| **TC-F02.28b** | `Flow` | Redirect Owner sang SSO khi đặt lại MK | 1. Đăng nhập bằng tài khoản Owner.<br>2. Vào trang đổi mật khẩu hoặc dùng form Quên Mật Khẩu với email Owner. | - Hệ thống redirect sang trang SSO external.<br>- Không xử lý đặt lại MK nội bộ cho Owner. | Khẩn |
| **TC-F02.29** | `UX` | Nút Try Again đưa form về trạng thái ban đầu | 1. Gửi form Quên MK thành công, màn hình hiện thông báo xác nhận.<br>2. Nhấn **Try Again**. | - Form quay về trạng thái trống ban đầu để nhập lại email. | Low |
| **TC-F02.30** | `Func` | Đặt lại mật khẩu thành công qua link email | 1. Mở link đặt lại MK từ email.<br>2. Nhập mật khẩu mới đáp ứng yêu cầu.<br>3. Xác nhận và Submit. | - API cập nhật mật khẩu thành công.<br>- Hiện thông báo thành công.<br>- Redirect về `/login`. | Blocker |
| **TC-F02.31** | `Sec` | Link đặt lại mật khẩu hết hạn sau 24 giờ | 1. Lấy link reset password cũ hơn 24 giờ.<br>2. Mở link trên trình duyệt. | - Báo token đã hết hạn, không cho đặt lại MK.<br>- Hướng dẫn yêu cầu gửi link mới. | High |
| **TC-F02.32** | `Sec` | Chặn truy cập Reset Password không có token | 1. Điều hướng thủ công tới `/reset-password` không có `?token=`. | - Trang từ chối hiển thị form.<br>- Redirect về `/login`. | High |

---

### 3.5. Nhóm Middleware Authentication & Role Router — (US-F02-03, 04)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---|:---:|
| **TC-F02.33** | `Func` | Redirect về Login khi truy cập root chưa đăng nhập | 1. Đảm bảo không có session đăng nhập.<br>2. Gõ URL `/` vào thanh địa chỉ. | - Nhận `HTTP 307 Redirect`.<br>- Tự động chuyển tới `/login`. | Khẩn |
| **TC-F02.34** | `Func` | Giữ lại URL đích sau khi đăng nhập (Return Query) | 1. Chưa đăng nhập, truy cập `/builder/test-id`.<br>2. Quan sát URL sau khi bị redirect về Login.<br>3. Đăng nhập thành công, quan sát redirect. | - URL Login chứa `?redirect=/builder/test-id`.<br>- Sau đăng nhập, chuyển tới `/builder/test-id` thay vì `/dashboard`. | High |
| **TC-F02.35** | `Func` | Redirect sau đăng nhập khác nhau theo Role | 1. Đăng nhập bằng tài khoản **Owner**, quan sát URL đích.<br>2. Đăng xuất, đăng nhập bằng **Staff**, quan sát URL đích. | - Owner → `/dashboard`.<br>- Staff → Payload Admin CMS. | Khẩn |
| **TC-F02.36** | `Auth` | Staff không thể truy cập Owner Dashboard | 1. Đăng nhập bằng tài khoản Staff.<br>2. Gõ thủ công `/dashboard` vào thanh địa chỉ. | - Nhận `HTTP 403 Forbidden`.<br>- Không hiển thị nội dung Dashboard. | Blocker |
| **TC-F02.37** | `Auth` | Menu CMS bị giới hạn theo quyền Staff | 1. Đăng nhập bằng tài khoản Staff.<br>2. Vào Payload Admin CMS, kiểm tra menu bên trái. | - Menu bị cắt bớt so với Admin.<br>- Collection **Users** không hiển thị. | High |
| **TC-F02.38** | `Func` | Đăng xuất xóa sạch cookie session | 1. Đăng nhập thành công.<br>2. Nhấn **Sign Out** trên header.<br>3. Kiểm tra cookie trong DevTools (Application → Cookies). | - Cookie `payload-token` bị xóa.<br>- Redirect về `/login`.<br>- Không back lại trang nội bộ bằng nút Back. | Blocker |
| **TC-F02.39** | `Sec` | Logout đa thiết bị vô hiệu session còn lại | 1. Đăng nhập tài khoản trên Mobile và Chrome cùng lúc.<br>2. Logout trên Mobile.<br>3. Thao tác bất kỳ trên Chrome. | - Phiên Chrome bị vô hiệu hóa.<br>- Hiện thông báo hết hạn, redirect về `/login`. | Medium |

---

### 3.6. Nhóm Hiệu Năng & Non-Functional — (BR-03, BR-05)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---|:---:|
| **TC-F02.40** | `Perf` | Thời gian phản hồi API Login < 3 giây | 1. Mở DevTools Network trên trình duyệt.<br>2. Thực hiện đăng nhập (`POST /api/users/login`).<br>3. Ghi lại thời gian response. | - Response time < 3.0 giây. | High |
| **TC-F02.41** | `Load` | Hệ thống chịu 50 user đăng nhập đồng thời | 1. Cấu hình K6 với 50 Virtual Users gọi `POST /api/users/login` đồng thời.<br>2. Chạy script, ghi lại kết quả. | - P95 response trong ngưỡng chấp nhận.<br>- Error rate < 0.5%.<br>- Không xảy ra DB Pool Dead-Lock. | Khẩn |
| **TC-F02.42** | `Sec` | Rate Limit endpoint Quên Mật Khẩu chống spam | 1. Chạy script gửi 40 request liên tiếp tới endpoint Quên MK với cùng 1 email.<br>2. Quan sát response từ request vượt ngưỡng. | - Server trả `HTTP 429 Too Many Requests`.<br>- IP/tài khoản bị khóa tạm thời. | Medium |
| **TC-F02.43** | `Reg` | send-otp không lỗi 500 với multi-tenant user có null permissions (GH-905) | 1. Tạo staff user thuộc 2 tenant.<br>2. Insert null vào `users_tenants_permissions.value` cho tenant thứ 2 qua psql.<br>3. Gọi `POST /api/users/send-otp` với email của staff. | - Response `200` với `{ message: "If the email exists..." }`.<br>- Không có log `[Users] send-otp error` trong server console. | Blocker |

---

---

## 3.7. TenantAccessWatcher — Session Guard (Unit Tests)

> Automated unit tests in `src/__tests__/unit/dashboard/tenant-access-watcher.test.tsx`
> Bug fix: #1270 — "Access Revoked" false-positive on HMR / stale tenant cache

| ID | Loại | Tiêu Đề | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---:|
| **TC-1270-TAW-01** | `Unit` | Không gọi session-check trước 5s startup | `fetch` không được gọi trong 4999ms đầu. | High |
| **TC-1270-TAW-02** | `Unit` | Gọi session-check đúng 1 lần sau 5s | `fetch` được gọi đúng 1 lần với `/api/auth/session-check`. | High |
| **TC-1270-TAW-03** | `Unit` | retry:true × 2 rồi ok:true — không hiện dialog | Không hiện dialog "Access Revoked" trong toàn bộ luồng retry. | High |
| **TC-1270-TAW-04** | `Unit` | retry:true × 3 liên tiếp → hiện "Session Expired" | Dialog hiện "Session Expired" (không phải "Access Revoked"). | Blocker |
| **TC-1270-TAW-05** | `Unit` | subscription_expired → hiện dialog ngay lập tức | Dialog "Subscription Expired" xuất hiện sau lần check đầu. | Blocker |
| **TC-1270-TAW-06** | `Unit` | Account suspended → hiện dialog ngay lập tức | Dialog "Account Suspended" xuất hiện sau lần check đầu. | Blocker |
| **TC-1270-TAW-07** | `Unit` | Removed from workspace × 1 → không hiện dialog | Hit đầu tiên chỉ bắt đầu grace period 12s, chưa hiện dialog. | High |
| **TC-1270-TAW-08** | `Unit` | Removed from workspace × 2 cách nhau ≥10s → hiện dialog | Dialog "Access Revoked" xuất hiện sau hit thứ hai xác nhận. | Blocker |
| **TC-1270-TAW-09** | `Unit` | ok:true trong grace period reset counter | Sau recovery, hit đơn tiếp theo không hiện dialog. | High |
| **TC-1270-TAW-10** | `Unit` | focus trong 5s startup không trigger check | `fetch` không được gọi khi focus trước khi `mountedRef=true`. | Medium |
| **TC-1270-TAW-11** | `Unit` | focus trong grace period không trigger check | `fetch` không được gọi thêm khi đang trong grace period. | High |
| **TC-1270-TAW-12** | `Unit` | Unmount trong startup delay hủy timer | `fetch` không được gọi sau khi component unmount. | Medium |
| **TC-1270-TAW-13** | `Unit` | focus+visibilitychange double-fire chỉ tính 1 check | 5s guard chặn lần thứ hai; `fetch` chỉ được gọi 1 lần. | High |
| **TC-1270-TAW-14** | `Unit` | expiresAt < 15min → trigger proactive refresh | `POST /api/auth/refresh-token` được gọi khi token gần hết hạn. | High |
| **TC-1270-TAW-15** | `Unit` | refresh fail → không evict user | Refresh reject chỉ log warning; không hiện bất kỳ dialog eviction nào. | Blocker |
| **TC-1270-TAW-16** | `Unit` | expiresAt > 15min → không refresh | `POST /api/auth/refresh-token` không được gọi khi token còn nhiều thời gian. | Medium |

---

## 3.8. refresh-token — Proactive JWT Refresh (Unit Tests)

> Automated unit tests in `src/__tests__/unit/auth/refresh-token.test.ts`
> Endpoint: `POST /api/auth/refresh-token` — re-mints payload-token cookie without hitting Payload's built-in refresh

| ID | Loại | Tiêu Đề | Kết Quả Mong Đợi | Ưu Tiên |
|:---|:---|:---|:---|:---:|
| **TC-F02-RTOKEN-01** | `Unit` | Rate limit → 429 | Trả `{ error: "rate_limited" }` với header `Retry-After`. | High |
| **TC-F02-RTOKEN-02** | `Unit` | Không có cookie payload-token → 401 | Trả `{ error: "No token found" }`. | Blocker |
| **TC-F02-RTOKEN-03** | `Unit` | Token chữ ký không hợp lệ → 401 | jwtVerify ném lỗi → trả `{ error: "Invalid or expired token" }`. | Blocker |
| **TC-F02-RTOKEN-04** | `Unit` | User không tồn tại trong DB → 403 | find() trả docs rỗng → trả `{ error: "User not found" }`. | Blocker |
| **TC-F02-RTOKEN-05** | `Unit` | Tất cả tenant bị suspended → 403 (depth:0 raw IDs) | Với `depth: 0`, tenant IDs là số thô; suspension check vẫn hoạt động đúng. | High |
| **TC-F02-RTOKEN-06** | `Unit` | Preserve mfa_verified:true từ token gốc | SignJWT được gọi với `mfa_verified: true` khi token gốc có claim này. | High |
| **TC-F02-RTOKEN-07** | `Unit` | Mặc định mfa_verified=true khi claim vắng mặt | Token cũ (chưa có claim) → SignJWT vẫn nhận `mfa_verified: true`. | High |
| **TC-F02-RTOKEN-08** | `Unit` | Happy path → 200, set httpOnly cookie | Trả `{ ok: true }`, cookie `payload-token` được set với `httpOnly: true`. | Blocker |
---

## 4. End-to-End User Flow (Acceptance Test)

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | Người dùng chưa đăng nhập truy cập `/`. | Hệ thống redirect về `/login`. |
| 2 | Owner được tạo qua SSO Webhook. | Nhận Welcome Email với link redirect hợp lệ. |
| 3 | Owner đăng nhập: nhập mật khẩu đúng → nhận OTP → nhập OTP. | Cấp session, redirect vào `/dashboard`. |
| 4 | Staff đăng nhập tương tự. | Redirect vào Payload Admin CMS. |
| 5 | Owner invite Staff → Staff nhận email, thiết lập mật khẩu, đăng nhập. | Toàn bộ luồng invite và đăng nhập thành công. |

---

## 5. Cấp Phép Nghiệm Thu Phát Hành (10-Point Quality Checklist)

| Hạng mục (10-Point) | Trạng thái | Coverage Traceability |
|:---|:---:|:---|
| **1. Happy Path** | [ ] Untested | TC-F02.07, 08, 17, 19, 21, 23, 26, 28, 30 |
| **2. UI/UX** | [ ] Untested | TC-F02.01, 02, 03, 04, 24, 29 |
| **3. Validation** | [ ] Untested | TC-F02.09, 10, 22, 24 |
| **4. Boundary** | [ ] Untested | TC-F02.11, 25, 26 |
| **5. Data** | [ ] Untested | TC-F02.15, 16, 18 |
| **6. Performance** | [ ] Untested | TC-F02.40, 41 |
| **7. Security** | [ ] Untested | TC-F02.15, 19, 22, 27, 31, 32, 36, 42 |
| **8. Navigation** | [ ] Untested | TC-F02.33, 34, 35 |
| **9. Interruption** | [ ] Untested | TC-F02.38, 39 |
| **10. Compatibility** | [ ] Untested | TC-F02.05, 06, 06b |

> **Quyết Định Ký Phát Hành:** Hệ thống đã phủ kín 10 yếu tố khắt khe nhất. Vui lòng bàn giao 42 Test Cases tích hợp chuẩn BDD/Auto này cho Developer chạy kiểm thử chéo (Cross-Testing).
