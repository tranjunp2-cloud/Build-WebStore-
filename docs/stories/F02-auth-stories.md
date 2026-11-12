# User Stories: Auth Flow (F02)

> **Feature:** F02 — Auth (Login / Register / Guard / Password Recovery)
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F02-auth.md](../prd/F02-auth.md)

---


## US-F02-01: SSO Integration & Auto-provisioning

**Wave 1** | **P0** | **M** | **Status:** Ready

### Story

```text
As a   chủ doanh nghiệp SME (Owner)
I want tài khoản của tôi được tạo tự động thông qua giao thức tiếp nhận Payload từ cổng SSO (Legacy)
So that tôi không phải mất công đăng ký lại một form thủ công dư thừa trên Webstore 2.0
```

### Acceptance Criteria

#### AC-1: SSO Payload Sync Provisioning (Happy Path)

```gherkin
GIVEN hệ thống SSO (TM Legacy) có khách hàng Owner vừa khởi tạo xong
WHEN  SSO gọi Webhook/API `POST /api/users/sso/provision` truyền xuống Payload JSON
  AND payload chứa đủ 6 trường Identity bắt buộc: `company_name, email, customer_id_number, service_id, first_name, last_name, pack_code`
  AND các trường gửi sang đều là Unique (Chưa từng tồn tại trong DB Webstore)
  AND `service_id` KHÔNG phải là chuỗi `"NA"` hoặc chuỗi rỗng
THEN  hệ thống Webstore tự động sinh 1 Account với role 'owner'
  AND tự động sinh 1 Tenant (Workspace) liên kết
  AND trả về HTTP 201 Created chờ Owner qua đăng nhập
```

#### AC-2: Validation — Strict Service ID Constraint

```gherkin
GIVEN hệ thống Webstore 2.0 phân tích Payload từ SSO
WHEN  trường `service_id` bị thiếu, là chuỗi rỗng `""`, hoặc mang giá trị `"NA"`
THEN  hệ thống từ chối khởi tạo (Reject)
  AND trả về HTTP 400 Bad Request kèm message lỗi "service_id is required and cannot be NA"
```

#### AC-3: Validation — Global Unique Identity Check

```gherkin
GIVEN hệ thống Webstore 2.0 phân tích Payload từ SSO
WHEN  bất kỳ trường nào trong `email`, `customer_id_number`, hay `service_id` đã bị trùng lặp trong Database (có người dùng trước)
THEN  hệ thống từ chối khởi tạo (Reject)
  AND trả về HTTP 409 Conflict ngăn chặn ghi đè dữ liệu
```

#### AC-4: Staff Invitation Rule (Ngăn chặn tạo ngoài)

```gherkin
GIVEN user có hành vi cố tình gọi API tạo tài khoản Staff (hoặc dùng đường link ẩn /register)
WHEN  cố gắng tạo account Staff (Nhân viên)
THEN  hệ thống chặn bỏ (403 Forbidden hoặc 404 Not Found)
  AND Staff chỉ có thể được sinh ra thông qua lời mời (Invite) trực tiếp từ CMS nội bộ của Owner.
```


#### AC-5: Post-Login Auto Routing (Phân Luồng User Roles)

```gherkin
GIVEN user (Owner hoặc Staff) đã đăng nhập thành công ở /login chung
WHEN  chuẩn bị redirect
THEN  nếu Role = 'owner' → redirect về AI Builder (nếu chưa có site) hoặc Dashboard (nếu có site)
  AND nếu Role = 'staff' → redirect thẳng vào giao diện Payload CMS (đã bị giới hạn UI module do Owner phân quyền)
  AND Staff KHÔNG bị điều hướng nhầm vào luồng mua gói / tạo website của Owner.
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Auto-create Tenant khi register thành công
- [ ] BMAD Gate: 5/5 pass trước khi dev

---

## US-F02-02: Login 

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   người dùng đã có tài khoản
I want đăng nhập vào hệ thống
So that tôi truy cập được dashboard và quản lý website
```

### Acceptance Criteria

#### AC-1: Happy Path — Login Thành Công

```gherkin
GIVEN user đã có account và vào /login
WHEN  nhập email + password đúng và submit
THEN  set auth cookie (lưu phiên đăng nhập)
  AND toast.success (thông báo xanh) "Welcome back! 🎉"
  AND redirect → /dashboard (hoặc ?redirect URL nếu có)
```

#### AC-2: Error — Sai Email/Password

```gherkin
GIVEN user nhập sai email hoặc password
WHEN  submit form
THEN  hiện alert banner "Incorrect email or password" (nếu tài khoản đang bị khóa sau 5 lần sai → "Too many unsuccessful sign-in attempts. Please try again in 15 minutes or reset your password.", API 423 — GH-2053)
  AND toast.error (thông báo đỏ) message
  AND KHÔNG redirect, giữ nguyên trang
  AND password field cleared
```

#### AC-2c: Validation — Password tối thiểu 6 ký tự (GH-2269)

```gherkin
GIVEN user ở /login
WHEN  nhập password ít hơn 6 ký tự và submit
THEN  hiện lỗi inline "Password must be at least 6 characters"
  AND KHÔNG gọi API đăng nhập
```

#### AC-2a: Error — Workspace bị khóa tạm thời (inactivated)

```gherkin
GIVEN user (Owner hoặc Staff) nhập đúng email + password
  AND workspace mà user thuộc về đang ở trạng thái `suspended` (SSO inactivated)
WHEN  hệ thống check workspace status sau khi xác thực mật khẩu
THEN  KHÔNG gửi OTP, KHÔNG cấp session
  AND hiển thị thông báo: "Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ nhà cung cấp dịch vụ."
  AND KHÔNG redirect, giữ nguyên trang login
```

#### AC-2b: Error — Workspace đã bị xóa (terminated)

```gherkin
GIVEN user (Owner hoặc Staff) nhập đúng email + password
  AND workspace mà user thuộc về đang ở trạng thái `terminated` (SSO terminated)
WHEN  hệ thống check workspace status sau khi xác thực mật khẩu
THEN  KHÔNG gửi OTP, KHÔNG cấp session
  AND hiển thị thông báo: "Tài khoản của bạn đã bị xóa. Vui lòng liên hệ nhà cung cấp dịch vụ để tạo lại."
  AND KHÔNG redirect, giữ nguyên trang login
```

#### AC-3: UI — Split Screen Layout & Brand Banner

```gherkin
GIVEN user truy cập /login
THEN  màn hình hiển thị dạng Split Screen (chia đôi)
  AND nửa màn hình hiển thị Brand Banner hình ảnh thu hút
  AND nửa còn lại hiển thị form Login có chứa Logo Brand ở trên cùng
  AND CTA chính (đăng nhập) nổi bật hơn đăng ký
  AND có thẻ/nút "Help / User Guideline" hướng dẫn sử dụng
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)

---

## US-F02-03: Auth Guard — Route Protection

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   hệ thống
I want tự động chuyển hướng (redirect) user chưa đăng nhập sang /login
So that các route nội bộ (private) không bị truy cập trái phép
```

### Acceptance Criteria

#### AC-1: Redirect Unauthenticated User

```gherkin
GIVEN user chưa login (không có session)
WHEN  truy cập trang chủ (/) hoặc các route nội bộ /dashboard, /builder/*, /editor/*
THEN  redirect → /login?redirect=[original_url]
  AND sau khi login thành công → redirect lại original_url
```

#### AC-2: Auto-create Tenant khi Register

```gherkin
GIVEN user register thành công
WHEN  Payload creates user
THEN  auto-create Tenant { name: "[firstName]'s Store" }
  AND assign user.tenants[0] = { tenant: newTenantId, role: 'owner' }
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] 12 protected routes trả 401 khi no-cookie (ref: SPEC §11)

---

## US-F02-04: Logout

**Wave 1** | **P0** | **XS** | **Status:** Ready

### Story

```
As a   người dùng đã đăng nhập
I want đăng xuất (logout) khỏi hệ thống
So that phiên làm việc (session) của tôi được đóng an toàn
```

### Acceptance Criteria

#### AC-1: Happy Path — Logout Thành Công

```gherkin
GIVEN user đã login
WHEN  click Logout (sidebar bottom)
THEN  clear session cookie
  AND redirect → /login
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)

---

## US-F02-05: Forgot Password 

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   người dùng quên mật khẩu
I want khôi phục tài khoản qua email
So that tôi không bị khóa nick vĩnh viễn
```

### Acceptance Criteria

#### AC-1: Happy Path — Gửi Reset Link

```gherkin
GIVEN user vào /forgot-password
WHEN  nhập email và click "Send reset link"
THEN  POST /api/users/forgot-password
  AND LUÔN hiện success state (security — không reveal email tồn tại)
  AND toast.success (thông báo xanh) "Reset link sent!"
  AND UI: "Check your email" + email hiện ra + "Back to sign in" link
```

#### AC-2: Try Again — Nhập Lại Email

```gherkin
GIVEN user muốn thử lại
WHEN  click "try again" trong success state
THEN  form reset, user có thể nhập lại email
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Reset link đến email trong vòng 60 giây (Resend)

---

## US-F02-06: Reset Password 

**Wave 1** | **P0** | **S** | **Status:** Ready
### Story

```
As a   người dùng nhận được email khôi phục
I want đặt mật khẩu mới
So that tôi có thể đăng nhập lại
```

### Acceptance Criteria

#### AC-1: Happy Path — Reset Thành Công

```gherkin
GIVEN user click link /reset-password?token=xxx
WHEN  nhập new password + confirm password hợp lệ
THEN  POST /api/users/reset-password { token, password }
  AND thành công → toast.success (thông báo xanh) "Password reset successful! 🔐"
  AND redirect → /login
```

#### AC-1a: Validation — Password mới tối thiểu 6 ký tự (GH-2269)

```gherkin
GIVEN user ở /reset-password?token=xxx
WHEN  nhập new password ít hơn 6 ký tự
THEN  hiện lỗi inline "Password must be at least 6 characters", không gửi form
  AND nếu gọi thẳng POST /api/users/reset-password với password < 6 ký tự → server trả 400, mật khẩu không đổi
```

#### AC-2: Token Hết Hạn / Invalid

```gherkin
GIVEN token hết hạn hoặc invalid
WHEN  API trả lỗi
THEN  error alert "This reset link has expired"
  AND toast.error (thông báo đỏ) message
  AND CTA "Request new reset link" → /forgot-password
```

#### AC-3: Truy Cập Không Có Token

```gherkin
GIVEN user access /reset-password KHÔNG có ?token
THEN  error state: icon + "Invalid reset link"
  AND CTA "Request new reset link" → /forgot-password
  AND link "Back to sign in" → /login
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Token expire hoạt động đúng (< 24h)

---



## US-F02-07: Two-Factor Authentication (Email OTP)

**Wave 1** | **P0** | **M** | **Status:** Ready

### Story

```
As a   người dùng sở hữu tài khoản PrimeWeb
I want xác thực bảo mật 2 lớp (2FA) bằng Email OTP trước khi đăng nhập thành công
So that tài khoản của tôi được bảo vệ khỏi hành vi đánh cắp mật khẩu
```

### Acceptance Criteria

#### AC-1: Bật 2FA trong Dashboard (Settings)

```gherkin
GIVEN user đang ở Dashboard > Settings
WHEN  bật tính năng "Enable Two-Factor Authentication" (chọn qua Email)
THEN  hệ thống tạo record cấu hình 2FA (Payload CMS)
  AND gửi Email chứa mã OTP 6 số để xác nhận
  AND bật 2FA thành công chỉ khi nhập đúng OTP này
```

#### AC-2: Happy Path — Đăng Nhập OTP Thành Công

```gherkin
GIVEN user (đã bật 2FA) nhập đúng email và password ở màn hình /login
WHEN  submit form
THEN  gửi mã OTP (6 chữ số, thời hạn 5 phút) qua email 
  AND chuyển sang màn hình "Enter Verification Code"
  AND KHÔNG set auth cookie (lưu phiên đăng nhập) (chưa log in)
  AND user nhập đúng mã OTP gửi tới email
  AND hệ thống xác thực thành công → set auth cookie (lưu phiên đăng nhập), chuyển vào /dashboard
```

#### AC-3: Validation — Sai Mã OTP hoặc Hết Hạn

```gherkin
GIVEN user đang ở màn hình nhập OTP
WHEN  mã OTP sai, hoặc quá 5 phút đã hết hạn (Expired)
THEN  inline error (lỗi hiển thị ngay dưới ô text) message "Code is incorrect or has expired"
  AND KHÔNG cho login
```

#### AC-4: Request Lại OTP (Resend Code)

```gherkin
GIVEN user không nhận được mã hoặc mã hết hạn
WHEN  click "Resend Code" (sau thời gian cooldown 60s)
THEN  hệ thống gửi OTP MỚI vào email
  AND reset timeout countdown
```

### Definition of Done

- [ ] Email OTP setup và gởi thành công (Resend)
- [ ] Màn hình OTP Verified pass 9-Point Checklist
- [ ] Bảo mật: KHÔNG set token nếu chưa verify OTP


## BMAD Gate Check — F02 Auth

```
──────────────────────────────────────────────────
BMAD GATE — Feature: F02-auth
──────────────────────────────────────────────────
☑ 1. PRD exists?           → docs/prd/F02-auth.md (v2.0)
      Gherkin AC complete?   PASS ☑

☑ 2. Architecture exists?  → docs/architecture/F02-auth.md
      Component tree clear?  PASS ☑

☑ 3. UI Mockups exist?     → N/A (auth UI standard — glassmorphism card)
      Desktop + Mobile?      PASS ☑ (responsive layout verified)

☑ 4. API contracts ready?  → Payload CMS built-in endpoints
      Error codes defined?   PASS ☑ (401, 404, 409, 422)

☑ 5. Dependencies resolved?
      Packages installed?    PASS ☑ (react-hook-form, zod, sonner)

Result: 5/5 PASS → PROCEED ✅
──────────────────────────────────────────────────
```

---

## US-F02-08: Mobile Web UX — Adaptive Auth Layout & Numeric Inputs

**Wave 1** | **P0 🌟** | **S** | **Status:** Ready

### Story

```
As a   mobile user
I want the login form to be perfectly sized for my screen and show the numeric keyboard when entering OTP
So that I can log in quickly without zooming, panning, or switching keyboards
```

### Acceptance Criteria

#### AC-1: Adaptive Split Screen to Stacked Layout

```gherkin
GIVEN the user accesses /login or /register on a smartphone (< 768px)
WHEN  the page loads
THEN  the Split Screen layout adapts into a vertical stack
  AND the large Brand Banner is either hidden to save space OR collapsed into a compact top header logo
  AND the Form Area takes up 100% of the viewport width and remaining height
  AND all text inputs use font-size 16px to prevent iOS Safari auto-zooming
```

#### AC-2: Tap-Friendly OTP & Virtual Keyboard (Numpad)

```gherkin
GIVEN the user is at the /verify-otp screen on a mobile device
WHEN  they tap on the 6-digit OTP input fields
THEN  the browser natively triggers the Numeric Keyboard (Numpad) instead of the full text keyboard
  AND typing a digit auto-advances focus to the next input box
  AND this auto-advance does NOT cause the mobile viewport to scroll or jump unexpectedly
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] OTP inputs use `inputmode="numeric"` or `type="tel"`
- [ ] iOS auto-zoom is prevented via 16px font size on inputs



