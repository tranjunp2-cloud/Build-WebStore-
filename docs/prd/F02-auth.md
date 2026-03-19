# PRD: Auth Flow (F02)
> **Version:** 2.2 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 1 | **Size:** L
> **Depends on:** Payload CMS Users & Tenants collections ✅
> **Blocks:** Everything (Dashboard, Builder, Editor, Storefront)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F02-01 | Register & Welcome | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |
| US-F02-02 | Login | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |
| US-F02-03 | Auth Guard | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |
| US-F02-04 | Logout | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |
| US-F02-05 | Forgot Password | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |
| US-F02-06 | Reset Password | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |
| US-F02-07 | Two-Factor Authentication (Email) | [F02-auth-stories.md](../stories/F02-auth-stories.md) | Ready |

---

## 1. Problem Statement

Hệ thống yêu cầu luồng xác thực (Auth Flow) hoàn chỉnh bao gồm đăng nhập trước (mặc định), đăng ký, khôi phục mật khẩu, và bảo vệ các route (Auth guard). Ngoài ra, tài khoản SME cần được phân quyền rõ ràng rành mạch và bảo mật thêm tính năng 2FA qua Email OTP.

---

## 2. Target User

- Chủ doanh nghiệp SME mới lần đầu dùng (Persona A) - Nhập Form Đăng Ký (Owner).
- Nhân viên quản trị hệ thống của Owner - Được mời tham gia (Staff).
- Trình độ công nghệ (Tech): Thấp — Đòi hỏi giao diện người dùng (UX) thật đơn giản, lỗi báo rõ ràng, và tiện lợi hỗ trợ ngay ở trang đăng nhập.

---

## 3. Solution Overview

Luồng xác thực tiêu chuẩn 6 tính năng: Login, Register, Forgot Password, Reset Password, Middleware Auth Guard, và Verify OTP (2FA). 
Hệ thống ưu tiên điều hướng về màn hình Login (Đăng nhập) trước tiên trên giao diện Split-Screen hiện đại. 
- **Roles:** Phân định quyền Owner và Staff. Owner tạo Workspace, Staff được Invite.
- **Data store:** Payload CMS (JWT + Cookies).
- **Mật khẩu:** Buộc tuân thủ quy tắc dài 8 ký tự, có đủ biểu thức, tự động cắt khoảng trống.
- **Bảo mật:** 2 lớp bảo mật qua mã OTP Email.

---

## 4. Scope

### 4.1. Kiến Trúc User Roles & Cấu Trúc Khách (RBAC)
- **Owner**: Đăng ký từ trang `/register`, tự động sinh 1 Workspace duy nhất, quyền tạo site và thanh toán.
- **Staff**: Nhân viên được Owner mời (Invite) qua Payload CMS. KHÔNG tự đăng ký ở trang ngoài. Cấp quyền vào CMS dựa trên Policy của Owner.

### 4.2. In Scope
- Ưu tiên hiển thị màn hình Login làm luồng gốc cho khách lặp lại (returning users).
- Đăng nhập (Login) + Màn hình xác thực 2FA OTP qua Email (US-F02-02, US-F02-07).
- Form Đăng ký (Register) cho Owner bao gồm các trường: Email, Password, First/Last Name, Company Name, BRN Number (Bắt buộc); Phone, Address, TM Customer (Tùy chọn) (US-F02-01).
- Ràng buộc Hệ Thống Ẩn (Invisible Constraint): Mỗi Owner sinh ra **1 cấu trúc dữ liệu Namespace/Workspace gầm (ẩn)**. Người dùng không biết khái niệm Workspace trên giao diện.
- Cấu hình Gửi Email Welcome (có Banner ảnh + Nút Đăng nhập) khi Owner đăng ký xong hoặc Staff vừa được Invite.
- Auth guard chặn redirect các user chưa đăng nhập về `/login` (US-F02-03).
- Đăng xuất (Logout) (US-F02-04).
- Quên mật khẩu & Đặt lại mật khẩu (US-F02-05, US-F02-06).
- Giao diện Split Screen kết hợp Brand Logo/Banner và nút Hỗ trợ (User Guideline).

### 4.3. Out of Scope
- Google SSO / Social Logins (Các Wave sau).
- 2FA qua Authenticator App (Google Auth/Authy) (Các Wave sau).
- Thiết lập Rate limit chặn spam đăng nhập liên tiếp (Phạm vi Server/Infra ở Wave kế).

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Register → Dashboard | < 10s | Timing |
| Login → Dashboard | < 3s | Timing |
| Forgot → email sent | < 5s | Resend logs |
| Unprotected routes | 0 | Audit |

---

## 6. User Story Summary

```
AS A   chủ doanh nghiệp SME mới tìm hiểu PrimeWeb
I WANT đăng ký tài khoản Owner với thông tin doanh nghiệp chi tiết
SO THAT hệ thống ngầm khởi tạo không gian dữ liệu của riêng tôi và cho phép tôi tự động bắt đầu hành trình tạo website
```
> Source: [US-F02-01](../stories/F02-auth-stories.md#us-f02-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Register: Form bắt buộc (Company, BRN, Head name, Email, Pass). Tùy chọn (Phone format VN/MY, Address) | US-F02-01 | P0 |
| FR-02 | Register: Validate password ≥ 8 ký tự (Hoa, Số, Đặc biệt), tự động trim space trước khi submit | US-F02-01 | P0 |
| FR-03 | Register: Quét Uniqueness email trùng trên toàn bộ hệ thống (Owner, Staff) | US-F02-01 | P0 | 409 response |
| FR-04 | Register: Tạo Account + Auto-create 1 Tenant (Workspace) duy nhất cho Owner | US-F02-01 | P0 | After Hook |
| FR-05 | Register: Gửi Email Welcome có hình ảnh banner + Nút đăng nhập lúc Reg/Invite | US-F02-01 | P0 | Resend
| FR-06 | Register: Tự động Set Cookie và Redirect thẳng vào `/onboarding` | US-F02-01 | P0 |
| FR-07 | Login: Màn hình Login hiện theo dạng Split-Screen, có Logo & Nút hướng dẫn User Guideline | US-F02-02 | P0 |
| FR-08 | Login: Sau bước email/pass nhập đúng → Gọi màn OTP (nếu bật 2FA) | US-F02-07 | P0 |
| FR-09 | Login: Gửi OTP 6 số, giới hạn hạn sử dụng 5 phút. Set auth cookie khi verify THÀNH CÔNG | US-F02-07 | P0 | Payload CMS
| FR-10 | Login: alert banner + toast khi sai credentials | US-F02-02 | P0 | 401 response |
| FR-11 | Auth Guard: Redirect ngay về `/login` nếu user chưa auth truy cập route bất kỳ, ưu tiên luồng Login | US-F02-03 | P0 |
| FR-12 | Auth Guard: Phân luồng auto-routing: Owner (`/onboarding` hoặc `/dashboard`), Staff (`/admin` PayloadCMS) | US-F02-03 | P0 |
| FR-13 | Logout: clear cookie + redirect `/login` | US-F02-04 | P0 |
| FR-14 | Forgot pass: luôn hiện success state (không reveal email) | US-F02-05 | P0 | Security by design |
| FR-15 | Reset pass: validate token, cập nhật password (tuân thủ trim và rule 8 chars) | US-F02-06 | P0 |

---

## 8. Business Rules

- **BR-01 (Priority Routing):** Mặc định truy cập trang chủ `/` không có session sẽ bị điều hướng thẳng vào `/login` thay vì `/register`.
- **BR-02 (Role Routing):** Phân luồng đăng nhập: Owner vào khu vực Customer Dashboard/Builder. Staff bị đẩy về Payload CMS Workspace để làm việc.
- **BR-03 (Invisible Workspace Limits):** Auto-create 1 Tenant duy nhất sau khi register (chạy ngầm ở Backend) — gán Role 'Owner'. Các account ko thể tạo ra Tenant số 2. Toàn bộ UI sẽ không bao giờ hiển thị từ khóa "Workspace" hay "Tenant" để tránh gây rối cho user.
- **BR-04 (Staff Constraints):** Nhân viên (Staff) không được tự mở tài khoản ở `/register`. Staff Account chỉ sinh ra khi Owner dùng chức năng Invite.
- **BR-05 (Data Format):** Validation tự động trim khoảng trắng (trailing space) cho Email và Password. Password đủ 8 ký tự, mix chữ hoa, chữ thường, số, đặc biệt.
- **BR-06 (Security):** Tích hợp Email Verification code (OTP) sau user credential step lúc Login. Authentication Token chỉ set sau khi hoàn thành OTP nếu 2FA được bật.
- **BR-07 (Security):** Luôn hiện success state cho forgot-password (không reveal email có tồn tại hay không). Mọi protected route phải check auth (0 exposed routes). Token reset password expire sau 24h.

---

## 9. User Flow

```
1. Unauthenticated Root Flow:
   `/` → Hệ thống check session (None) → Redirect về `/login` theo mặc định.

2. Register (Owner only): 
   `/register` → Điền Form (Company, Header, BRN, Phone...) + Mật khẩu trim space 
   → POST `/api/users` 
   → Check Email Unique All Roles 
   → Validation → Auto-create 1 Tenant 
   → Gửi Welcome Email 
   → Auto-login → Redirect `/onboarding`

3. Login (Split-Screen Interface):
   `/login` → Điền Form & trim space → POST `/api/users/login` 
   ├── (Nếu bật 2FA) → Bypass Token → Gửi OTP qua Resend → Mở màn hình OTP → Nhập đúng OTP 6 số → Set Cookie
   └── (Nếu không bật 2FA) → Set Cookie ngay
       ├── (Nếu Role = Owner) → `/dashboard` (hoặc redirect `/onboarding`)
       └── (Nếu Role = Staff) → Giao diện CMS Admin (Workspace)

4. Auth Guard: access `/dashboard` → no session → `/login?redirect=/dashboard` → login → (route theo flow 3)

5. Forgot Pass: `/forgot-password` → email → POST forgot-password → success state (always)

6. Reset Pass: email link → `/reset-password?token=xxx` → new password → POST reset → `/login`
```

---

## 10. Screen Layout

```text
Auth screens nâng cấp lên giao diện Full Split Screen (Màn hình Login làm xương sống):

┌─ [Desktop] /login hay /register ────────────────────────────────────┐
│  [BRAND IMAGE / BANNER LỚN BÊN TRÁI] │  [PrimeWeb Logo]             │
│  (Hiệu ứng đồ họa, Slogan quảng cáo) │                              │
│                                      │  [Glassmorphism Form]        │
│                                      │  Email...                    │
│                                      │  Password...                 │
│                                      │  Forgot password?            │
│                                      │  [Sign In (Primary CTA)]     │
│                                      │  [Register (Secondary)]      │
│                                      │                              │
│                                      │ 🔗 [Hướng dẫn sử dụng Help]   │
└─────────────────────────────────────────────────────────────────────┘
Mobile: UI chuyển sang card form xếp dọc (Stack column), 44px tap targets.
```

---

## 11. Acceptance Criteria

> Các AC dưới đây được migrate chuẩn hóa từ `F02-auth-stories.md`.

### AC-1: Cấu trúc Form Đăng ký Owner và Welcome Email
> 📌 Source: [US-F02-01](../stories/F02-auth-stories.md)

```gherkin
GIVEN user truy cập /register để đăng ký Owner
WHEN  hoàn thành điền form bắt buộc (Tên cty, Tên người đứng đầu, BRN, Email, Pass)
  AND (tùy chọn) SĐT mã format QG, Địa chỉ
  AND không có bất kỳ email trùng nào trong DB toàn hệ thống
THEN  tạo mới account + sinh ngầm 1 Tenant data duy nhất (Không hiển thị khái niệm Workspace ra màn hình)
  AND tự động login chuyển vào /onboarding
  AND gửi Email Welcome có chèn hình ảnh Banner và nút Login
  AND hiển thị toast thành công
```

### AC-2: Mật khẩu chuẩn và Tự động Trim
> 📌 Source: [US-F02-01](../stories/F02-auth-stories.md)

```gherkin
GIVEN user đang nhập mật khẩu
WHEN  mật khẩu < 8 ký tự, hoặc thiếu (chữ hoa, số, ký tự đặc biệt)
THEN  inline validation hiển thị lỗi "Password must be at least 8 char..."
  AND Email và Pass khi submit tự động trim bỏ khoảng trắng thừa (trailing/leading space)
```

### AC-3: Luồng Staff Invitation
> 📌 Source: [US-F02-01](../stories/F02-auth-stories.md)

```gherkin
GIVEN user đóng vai trò Staff (nhân viên)
WHEN  cố tình truy cập trang /register ngoài frontend
THEN  chặn không cho kết nối workspace
  AND Staff chỉ có thể được tạo bằng cách Owner gửi thư mời từ Payload CMS (Nhận Welcome Email)
```

### AC-4: Split Screen UI và Support Guide Link
> 📌 Source: [US-F02-02](../stories/F02-auth-stories.md)

```gherkin
GIVEN user truy cập /login
THEN  màn hình hiển thị dạng Split Screen
  AND nửa MÀN HÌNH chứa Brand Banner nổi bật
  AND nửa FORMs chứa Kính trong suốt + Logo Brand + Nút Đăng nhập làm Primary CTA
  AND có Link Hướng dẫn (User Guideline) để trợ giúp
```

### AC-5: Post-Login Phân luồng Role (Auto-Routing)
> 📌 Source: [US-F02-02](../stories/F02-auth-stories.md)

```gherkin
GIVEN user (Owner hoặc Staff) đã đăng nhập thành công ở /login chung
WHEN  chuẩn bị redirect
THEN  nếu Role = 'owner' → redirect về AI Builder hoặc Dashboard
  AND nếu Role = 'staff' → redirect thẳng vào giao diện Payload CMS Admin Panel (giới hạn theo quyền)
```

### AC-6: Auth Guard — Chặn Quyền
> 📌 Source: [US-F02-03](../stories/F02-auth-stories.md)

```gherkin
GIVEN user chưa login (không có session)
WHEN  truy cập trang chủ / hoặc /dashboard, /builder/*
THEN  redirect mặc định → /login?redirect=[original_url]
```

### AC-7: Two-Factor Authentication (OTP Email)
> 📌 Source: [US-F02-07](../stories/F02-auth-stories.md)

```gherkin
GIVEN user kích hoạt 2FA qua Email
WHEN  nhập đúng email và password ở /login 
THEN  điều hướng sang màn hình OTP Verification, gửi SMS 6 số qua mail hạn 5 phút
  AND CHỈ set session cookie thực tế khi nhập mã OTP chuẩn xác
```

### AC-8: Forgot Password — Always Success Design
> 📌 Source: [US-F02-05](../stories/F02-auth-stories.md)

```gherkin
GIVEN user vào /forgot-password
WHEN  nhập email và click "Send reset link"
THEN  LUÔN hiện success state (bảo vệ không reveal email của database)
  AND gửi link khôi phục nếu email hợp lệ
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Security** | Không reveal email tồn tại trong forgot-password | Security by design |
| **Security** | JWT cookie HttpOnly, Secure, SameSite=Strict | Payload CMS |
| **Integrity** | Check uniqueness email ở cấp Database layer | Global scope |
| **Performance** | Login → Dashboard < 3s | |
| **Accessibility** | WCAG 2.1 AA, keyboard navigable forms | |
| **Device support** | Mobile 375px, Tablet 768px, Desktop 1280px+ | Stack Column ở Mobile |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `AuthLayout` | `app/(auth)/layout.tsx` | Màn hình Split Screen (Banner + Form Card), chứa UI Link guideline |
| `LoginPage` | `app/(auth)/login/page.tsx` | Login form |
| `OTPPage` | `app/(auth)/verify-otp/page.tsx` | Form nhập 6 số xác thực 2FA OTP |
| `RegisterPage` | `app/(auth)/register/page.tsx` | Mở rộng form: Email, Pass, Name, Company, BRN, Phone... |
| `ForgotPasswordPage` | `app/(auth)/forgot-password/page.tsx` | Email → reset link |
| `ResetPasswordPage` | `app/(auth)/reset-password/page.tsx` | Token → new password |

### 13.2 API Endpoints

```text
POST /api/users                  → Register (201 Created) — Include BRN, Phone, etc.
POST /api/users/login            → Login — Return 200 (OTP required) or 200 (Set-Cookie)
POST /api/users/verify-otp       → Verify 6 digit OTP (Set-Cookie)
POST /api/users/logout           → Logout (200 OK + Clear-Cookie)
POST /api/users/forgot-password  → Send reset email (200 always)
POST /api/users/reset-password   → Reset with token (200 OK / 400 Bad)
Auth: Payload CMS built-in with custom Resend hooks.
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| Payload CMS Users (Roles) | ✅ Thêm `Role`, `2FaConfig` field | |
| Payload CMS Tenants data | ✅ Thêm Company, BRN, Phone | |
| Resend email | ✅ Đã cấu hình | Tùy biến Welcome Email template dạng HTML Banner |

---

## 15. API Contract

```json
POST /api/users/register
Request: { 
  "email": "owner@sme.com", 
  "password": "...", 
  "firstName": "John", 
  "lastName": "Doe",
  "companyName": "SME LLC",
  "brnNumber": "12345678",
  "phone": "+84912345678",
  "tmCustomer": true
}
Response: { "success": true, "user": {...}, "workspace": {...} }

POST /api/users/login
Request: { "email": "owner@sme.com", "password": "..." }
Response: { "success": true, "requires2FA": true, "emailMasked": "ow***@sme.com" } 
(Cookie Not Set yet)
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Logic Invite Staff của Payload CMS sẽ xử lý UI trên Frontend như thế nào? Cần Custom View trong Payload Panel. | PO / Team | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [x] Loading State — Button spinner during API calls
- [x] Empty State — N/A (forms always visible)
- [x] Error State — Alert banner + inline field errors + toast
- [x] Form Validation — Zod schemas with phone number format validator and trimming
- [x] Button States — Disabled + spinner during submit
- [x] Toast Feedback — Success + error on all actions (sonner)
- [x] Auth Redirect — 401 → /login?redirect=[url] 
- [x] Mobile 375px — Responsive Stack column layout, 44px tap targets
- [x] TypeScript Clean — tsc --noEmit pass

---

## 18. Definition of Ready

- [x] User Stories approved và linked ở Section 0 ✅
- [x] AC ở Section 11 copy/merge logic gọn gàng từ story files ✅
- [x] FR ở Section 7 map 1-1 với thiết kế Roles và UI ✅
- [x] Schema CMS được note đầy đủ field BRN, Company... ✅

---

## 19. Definition of Done

- [ ] All FR items implemented và verified.
- [ ] Welcome emails render đúng HTML Banner và trigger ngay sau khi Invite/Register.
- [ ] 9-Point Checklist all pass.
- [ ] Uniqueness checking pass unit test trên API.
