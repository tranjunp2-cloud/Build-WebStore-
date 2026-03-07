# PRD: Auth Flow — Login / Register / Guard

> **Date:** 2026-03-07 | **Priority:** P0 | **Wave:** 2.1  
> **Agent:** PO Agent | **Prerequisite for:** Everything (Dashboard, Builder, Editor)

---

## Problem Statement

Hiện tại user vào bất kỳ route nào (`/dashboard`, `/builder`, `/editor`) đều không cần đăng nhập.
Không có:
- Trang login/register
- Auth guard (bất kỳ ai cũng truy cập được)
- Session management
- Logout

Đây là **blocker lớn nhất** — không có auth = không có multi-tenant = không phân biệt user.

## Proposed Solution

### User Journey
```
Landing page (/) → [Login] hoặc [Get Started Free]
    ↓
/register → Nhập email + password + name → auto-login → /onboarding
    ↓
/login → Email + password → /dashboard
```

### Screens cần build

| Screen | Route | Mô tả |
|--------|-------|--------|
| Login | `/login` | Email + password, link "Create account" |
| Register | `/register` | Name + email + password, auto-create tenant |
| Auth Layout | `(auth)/layout.tsx` | Centered card, branding, no sidebar |

## User Stories

### US-AUTH-01: Register
```
GIVEN user chưa có account
WHEN  vào /register, nhập firstName, email, password
THEN  tạo account + tenant mới
AND   auto-login (set cookie)
AND   redirect → /onboarding
```

### US-AUTH-02: Login
```
GIVEN user đã có account
WHEN  vào /login, nhập email + password đúng
THEN  set auth cookie
AND   redirect → /dashboard
```

### US-AUTH-03: Login Fail
```
GIVEN user nhập sai email/password
WHEN  submit form
THEN  hiện toast error "Email hoặc mật khẩu không đúng"
AND   KHÔNG redirect, giữ nguyên trang
AND   password field cleared
```

### US-AUTH-04: Auth Guard
```
GIVEN user chưa login (không có session)
WHEN  truy cập /dashboard, /builder/*, /editor/*
THEN  redirect → /login?redirect=[original_url]
AND   sau khi login → redirect lại original_url
```

### US-AUTH-05: Logout
```
GIVEN user đã login
WHEN  click Logout (sidebar bottom)
THEN  clear session cookie
AND   redirect → /login
```

### US-AUTH-06: Register Auto-Tenant
```
GIVEN user register thành công
WHEN  Payload creates user
THEN  auto-create Tenant { name: "[firstName]'s Store" }
AND   assign user.tenants[0] = { tenant: newTenantId, role: 'owner' }
```

## Out of Scope (Wave 2.1)
- ❌ Google SSO (Wave 5)
- ❌ Forgot password (Wave 5)
- ❌ Email verification (Wave 5)
- ❌ Rate limiting login (Wave 5)

## Dependencies
- Payload CMS `users` collection (`auth: true` ✅ đã có)
- Payload CMS `tenants` collection (✅ đã có)
- Payload built-in auth (cookie-based JWT ✅)

## Success Metrics
- Register → Dashboard < 10 giây
- Login → Dashboard < 3 giây
- 0 unprotected routes (dashboard/builder/editor)
