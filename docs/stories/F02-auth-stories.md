# User Stories: Auth Flow (F02)

> **Feature:** F02 — Auth (Login / Register / Guard / Password Recovery)  
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F02-auth.md](../prd/F02-auth.md)  
> **SaaS Bible:** Group A — Screen Inventory (5 screens)

---

## US-001: Register & Welcome

**Wave 1** | **P0** | **S** | Status: ✅ Done

### Story
```
As a   SME owner mới tìm hiểu PrimeWeb
I want đăng ký tài khoản và được chào đón  
So that tôi hiểu ngay bước tiếp theo là tạo website
```

### Acceptance Criteria
```gherkin
GIVEN user điền firstName, lastName, email, password, confirmPassword
WHEN  click "Create account"
THEN  tạo account + auto-login + redirect /onboarding
AND   auto-create Tenant { name: "[firstName]'s Store" }
AND   toast.success "Account created! 🎉"
AND   KHÔNG redirect về /login

GIVEN email đã tồn tại
WHEN  nhập email đó vào register form
THEN  inline error "This email is already registered"
AND   toast.error message
AND   KHÔNG submit form

GIVEN password và confirmPassword không khớp
WHEN  submit form
THEN  inline error "Passwords don't match" dưới confirmPassword field
```

---

## US-AUTH-02: Login

**Wave 1** | **P0** | **S** | Status: ✅ Done

```gherkin
GIVEN user đã có account
WHEN  vào /login, nhập email + password đúng
THEN  set auth cookie
AND   toast.success "Welcome back! 🎉"
AND   redirect → /dashboard (hoặc ?redirect URL)
```

## US-AUTH-03: Login Fail

```gherkin
GIVEN user nhập sai email/password
WHEN  submit form
THEN  hiện alert banner "Incorrect email or password"
AND   toast.error message
AND   KHÔNG redirect, giữ nguyên trang
AND   password field cleared
```

## US-AUTH-04: Auth Guard

```gherkin
GIVEN user chưa login (không có session)
WHEN  truy cập /dashboard, /builder/*, /editor/*
THEN  redirect → /login?redirect=[original_url]
AND   sau khi login → redirect lại original_url
```

## US-AUTH-05: Logout

```gherkin
GIVEN user đã login
WHEN  click Logout (sidebar bottom)
THEN  clear session cookie
AND   redirect → /login
```

## US-AUTH-06: Register Auto-Tenant

```gherkin
GIVEN user register thành công
WHEN  Payload creates user
THEN  auto-create Tenant { name: "[firstName]'s Store" }
AND   assign user.tenants[0] = { tenant: newTenantId, role: 'owner' }
```

---

## US-AUTH-07: Forgot Password 🆕

**Wave 1** | **P0** | **S** | Status: ✅ Done

### Story
```
As a   user quên mật khẩu
I want khôi phục account qua email
So that tôi không bị lock out vĩnh viễn
```

### Acceptance Criteria
```gherkin
GIVEN user vào /forgot-password
WHEN  nhập email và click "Send reset link"
THEN  POST /api/users/forgot-password
AND   LUÔN hiện success state (security — không reveal email tồn tại)
AND   toast.success "Reset link sent!"
AND   UI: "Check your email" + email hiện ra + "Back to sign in" link

GIVEN user muốn thử lại
WHEN  click "try again" trong success state
THEN  form reset, user có thể nhập lại email
```

---

## US-AUTH-08: Reset Password 🆕

**Wave 1** | **P0** | **S** | Status: ✅ Done

### Story
```
As a   user nhận được email reset
I want đặt mật khẩu mới
So that tôi đăng nhập lại được
```

### Acceptance Criteria
```gherkin
GIVEN user click link /reset-password?token=xxx
WHEN  nhập new password + confirm password
THEN  POST /api/users/reset-password { token, password }
AND   thành công → toast.success "Password reset successful! 🔐"
AND   redirect → /login

GIVEN token hết hạn hoặc invalid
WHEN  API trả lỗi
THEN  error alert "This reset link has expired"
AND   toast.error message
AND   CTA "Request new reset link" → /forgot-password
```

---

## US-AUTH-09: Reset Password — No Token 🆕

**Wave 1** | **P0** | **XS** | Status: ✅ Done

```gherkin
GIVEN user access /reset-password KHÔNG có ?token
THEN  error state: icon + "Invalid reset link"
AND   CTA "Request new reset link" → /forgot-password
AND   link "Back to sign in" → /login
```

---

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
