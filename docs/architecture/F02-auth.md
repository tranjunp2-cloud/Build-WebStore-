# Architecture: Auth Flow (F02)

> **Version:** 2.0 | **Updated:** 2026-03-16 | **Agent:** `project-planner`  
> **Related PRD:** `docs/prd/F02-auth.md`  

---

## Overview

Hệ thống Auth Flow phiên bản 2.0 tích hợp **Role-Based Access Control (RBAC)** bảo mật cao, kết hợp **Payload CMS built-in authentication** (JWT + Cookies) và hệ thống gửi nhận email ngoài (Resend).
Payload quản lý:
- Cookie-based session (`payload-token`)
- Password hashing (bcrypt)
- Quản lý 2FA (mã OTP) và Email Verification.
- Các endpoint built-in: `/api/users/login`, `/api/users/logout`, `/api/users/me` (có thể kết hợp custom hooks).
- Khóa đăng nhập: `maxLoginAttempts: 5`, `lockTime: 15 phút` (login trả `423 ACCOUNT_LOCKED`). Payload không gỡ khóa khi đổi mật khẩu, nên `src/lib/auth/clear-login-lock-on-password-change.ts` gỡ khóa khi password đổi (`beforeChange`) và sau khi reset qua email thành công (`afterOperation` `resetPassword`) — GH-2053.
- Độ dài password tối thiểu 6 ký tự (`PASSWORD_MIN_LENGTH` trong `src/lib/auth/password-rules.ts`), dùng chung cho form Login, Reset password và Đổi mật khẩu Profile (`passwordBaseSchema`, cả server `/api/users/me/password`). Server `/api/users/reset-password` chặn password ngắn qua `beforeOperation` `enforceResetPasswordMinLength` (Payload mặc định chỉ chặn < 3). Không chặn ở `create`/`update` vì SSO, PW1 và admin panel ghi password qua đó — GH-2269.

Frontend Pages = **Client Components** (forms có state, validation Zod).  
Auth guard = **Server-side middleware** + `getPayload()` session check.

## Component Architecture

```
(auth)/layout.tsx               ← Split-Screen layout (Banner Trái, Form Phải)
├── login/page.tsx              ← Client Component (Form đăng nhập + Check 2FA)
├── register/page.tsx           ← Client Component (Form đăng ký Owner mở rộng)
├── verify-otp/page.tsx         ← Client Component (Nhập mã 6-digit OTP)
├── forgot-password/page.tsx    ← Client Component (Quên pass)
└── reset-password/page.tsx     ← Client Component (Đổi pass)

middleware.ts                   ← Auth guard (Chặn users chưa có payload-token cookie)

src/lib/auth.ts                 ← Helper: getCurrentUser() server-side
```

## API Endpoints

| Method | Endpoint | Request Body | Response (Success) |
|--------|----------|--------------|--------------------|
| POST | `/api/users/login` | `{ email, password }` | 2FA Tắt: `{ user, token }` (Set-Cookie)<br> 2FA Bật: `{ requires2FA: true }` (NO cookie) |
| POST | `/api/users/verify-otp` | `{ email, code }` | `{ user, token }` (Set-Cookie) |
| POST | `/api/users` | `{ email, password, firstName, lastName, companyName, brnNumber... }` | `{ doc: user }` (Register Owner) |
| POST | `/api/users/logout` | — | `{ message }` (Clear-Cookie) |
| POST | `/api/users/forgot-password`| `{ email }` | `{ message: "Success" }` (Always) |
| POST | `/api/users/reset-password` | `{ token, password }` | `{ message: "Success" }` |
| GET | `/api/users/me` | Cookie `payload-token` | `{ user }` or `null` |

## Data Flow

### 1. Register Flow (Owner)
```text
RegisterForm.tsx (Client)
  │
  ├── 1. POST /api/users { email, password, firstName, lastName, company, BRN... }
  │      → Check Email Uniqueness (All Roles)
  │      → Validate Password Rules + auto-trim
  │      → Payload creates user (cookie auto-set)
  │
  ├── 2. After-Change Hook (Payload CMS)
  │      → Auto-create 1 Invisible Tenant (Workspace Backend) cho Account
  │      → Assign role 'owner' liên kết User - Tenant
  │
  ├── 3. Resend Email Trigger
  │      → Gửi Welcome Email (HTML Banner + Login Button) tới hòm thư
  │
  └── 4. router.push('/onboarding')
```

### 2. Staff Invite Flow
```text
Payload CMS Dashboard (Owner)
  │
  ├── 1. Owner gửi Invitation Email chứa Access Link
  │
  ├── 2. Staff click link, thiết lập mật khẩu (tuân thủ rule)
  │
  └── 3. Hệ thống tạo User mang role 'staff' (Tenant giữ nguyên)
         → Gửi Welcome Email
         → Staff dùng cổng Login chung
```

### 3. Unified Login Flow & Auto-Routing
```text
LoginForm.tsx (Client)
  │
  ├── 1. POST /api/users/login { email, password (trimmed) }
  │      → Fail: show toast error 401
  │      → Pass Credential Check:
  │           │
  │           ├── Nếu 2FA Bật: 
  │           │   → Trả logic requires2FA: true, Không set cookie
  │           │   → Backend gửi mã 6-digit OTP qua Resend Email
  │           │   → Chuyển user sang màn hình verify-otp/page.tsx
  │           │   → Nhập đúng: Set Cookie.
  │           │
  │           └── Nếu 2FA Tắt: 
  │               → Set Cookie payload-token ngay lập tức.
  │
  └── 2. Auto-Routing Guard:
         ├── If Role == 'owner' → router.push('/dashboard' hoặc '/onboarding')
         └── If Role == 'staff' → router.push('/admin' Payload CMS khu vực quy định)
```

### 4. Auth Guard (Middleware)
```text
middleware.ts
  │
  ├── Check: request.cookies.get('payload-token')
  │
  ├── If NO token + Truy cập gốc (/) HOẶC /dashboard|/builder|/editor
  │      → redirect('/login?redirect=' + pathname) (Ưu tiên Login, không trỏ về Register)
  │
  └── If HAS token → continue (next())
```

## 6-Layer Security & Auth Checklist

```text
✅ Layer 1 — PRODUCT/UX:
   - Split-Screen Login/Register forms with inline validation.
   - Trimming trailing/leading spaces from Email/Password.
   - Thêm nút/link tới Hướng dẫn (User Guideline).
   - Loading state, Error toast (sonner).

✅ Layer 2 — API/BACKEND:
   - Payload REST logic extended for OTP and Invite.
   - Global Unique Email verification across Roles.
   - Auto-create Invisible Tenant system.

✅ Layer 3 — DATA/STORAGE:
   - Users collection (auth: true, fields mở rộng BRN, Company...).
   - Tenants collection (Invisible logic).
   - Flag 2FA và mã OTP tạm thời gắn theo User.

✅ Layer 4 — SECURITY/AUTH:
   - bcrypt password hashing (Payload built-in).
   - Cookie HttpOnly, Secure (Payload built-in).
   - 2FA Email verification pass.
   - CSRF protection / Middleware server check.

✅ Layer 5 — BUSINESS & NOTIFICATIONS:
   - Gửi **Welcome Email** (via Resend) khi tạo account/Invite thành công.
   - Forgot/Reset Password via Payload + Resend.
   - Role-Based Access Control logic (Owner = Builder/Dashboard, Staff = CMS).

⬜ Layer 6 — FUTURE OPS:
   - Rate limiting (Wave 5).
   - Google SSO (Wave 5).
```
