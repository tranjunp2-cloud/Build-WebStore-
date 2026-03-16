# User Stories: Auth Flow (F02)

> **Feature:** F02 — Auth (Login / Register / Guard / Password Recovery)
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F02-auth.md](../prd/F02-auth.md)

---


## US-F02-01: Register & Welcome ✅

**Wave 1** | **P0** | **M** | **Status:** Done ✅

### Story

```
As a   chủ doanh nghiệp SME mới tìm hiểu PrimeWeb
I want đăng ký tài khoản Owner với thông tin doanh nghiệp chi tiết
So that hệ thống ngầm khởi tạo dữ liệu của riêng tôi và cho phép tôi tự động bắt đầu hành trình tạo website
```

### Acceptance Criteria

#### AC-1: Happy Path — Đăng Ký Owner Thành Công

```gherkin
GIVEN user truy cập /register
WHEN  điền hợp lệ các trường bắt buộc (First Name, Last Name, Company Name, BRN Number, Email, Password)
  AND (Tùy chọn) điền Số điện thoại (chọn mã VN/MY), Address, TM Customer
  AND click "Create account"
THEN  hệ thống tạo tài khoản với role 'owner'
  AND tự động tạo ngầm 1 Tenant (Khái niệm Workspace không hiển thị ra UI cho user)
  AND tự động set auth cookie (lưu phiên đăng nhập) VÀ redirect thẳng vào /onboarding
  AND gửi 1 Welcome Email (có Banner hình ảnh + Nút Login) vào hòm thư
  AND hiển thị toast.success (thông báo xanh) "Account created! 🎉"
```

#### AC-2: Validation — Form & Phone Khác Khu Vực

```gherkin
GIVEN user đang nhập nội dung Phone Number
WHEN  chọn mã vùng +84 (VN) hoặc +60 (MY)
THEN  định dạng số điện thoại sẽ bị force validation phù hợp với format quốc gia đó
  AND các trường Password tự động trim space trước khi đánh giá dài 8 ký tự/đủ chữ hoa, số, đặc biệt.
```

#### AC-3: Validation — Global Email Uniqueness (Trùng Email Toàn Hệ Thống)

```gherkin
GIVEN email đã tồn tại trong collections (ở bất kỳ role nào: Owner cũ, Staff, Admin)
WHEN  nhập email đó vào register form và submit
THEN  inline error (lỗi hiển thị ngay dưới ô text) "This email is already registered in our system"
  AND KHÔNG submit form
```

#### AC-4: Staff Invitation (Staff Không Được Tự Đăng Ký)

```gherkin
GIVEN một nhân viên (Staff) tự truy cập /register
WHEN  cố gắng tạo account
THEN  Staff không thể tự sinh ra cấu trúc dữ liệu doanh nghiệp mới
  AND (Ghi chú kiến trúc) Staff chỉ được cấp tài khoản thông qua luồng Owner gửi chức năng Invite từ trong Payload CMS Dashboard. Khi đó Staff sẽ nhận Welcome Email tương tự Owner.
```


#### AC-4: Post-Login Auto Routing (Phân Luồng User Roles)

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

## US-F02-02: Login ✅

**Wave 1** | **P0** | **S** | **Status:** Done ✅

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
THEN  hiện alert banner "Incorrect email or password"
  AND toast.error (thông báo đỏ) message
  AND KHÔNG redirect, giữ nguyên trang
  AND password field cleared
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

**Wave 1** | **P0** | **S** | **Status:** Done ✅

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

**Wave 1** | **P0** | **XS** | **Status:** Done ✅

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

## US-F02-05: Forgot Password ✅

**Wave 1** | **P0** | **S** | **Status:** Done ✅

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

## US-F02-06: Reset Password ✅

**Wave 1** | **P0** | **S** | **Status:** Done ✅

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
