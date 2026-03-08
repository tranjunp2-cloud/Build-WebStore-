# PRD: Auth Flow — Login / Register / Guard / Password Recovery (F02)

> **Version:** 2.0 | **Updated:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 1 | **Size:** L  
> **Depends on:** Payload CMS Users & Tenants collections ✅  
> **Blocks:** Everything (Dashboard, Builder, Editor, Storefront)  
> **Ref:** [SaaS Bible](../../../saas_bible.docx) Ch.02 Screen Inventory Group A  
> **Market Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — Persona A, B

---

## 1. Problem Statement

User phải có full auth flow bao gồm đăng ký, đăng nhập, khôi phục mật khẩu, và bảo vệ route. Theo chuẩn SaaS Bible Group A, auth cần **5 màn hình** (trước đây chỉ có 2). Thiếu forgot/reset password = user bị lock out vĩnh viễn nếu quên mật khẩu.

## 2. Target User

- SME owner đăng ký lần đầu (Persona A)
- Dropshipper quản lý nhiều tài khoản (Persona B)
- Trình độ tech: thấp — cần UX đơn giản, clear error messages

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| Register → Dashboard | < 10s |
| Login → Dashboard | < 3s |
| Forgot → email sent | < 5s |
| Reset → login ready | < 10s |
| Unprotected routes | 0 |

---

## 4. Screen Inventory (Group A — SaaS Bible)

| # | Screen | Route | Status | Mô tả |
|---|--------|-------|--------|--------|
| A1 | Login | `/login` | ✅ Built | Email + password, "Forgot password?" link |
| A2 | Register | `/register` | ✅ Built | Name + email + password + confirm, auto-create tenant |
| A3 | Forgot Password | `/forgot-password` | ✅ Built | Email input → send reset link |
| A4 | Reset Password | `/reset-password` | ✅ Built | Token from email → new password form |
| A5 | Auth Layout | `(auth)/layout.tsx` | ✅ Built | Glassmorphism card, PrimeWeb branding, sonner Toaster |
| A6 | Verify Email | `/verify-email` | ⏸️ Deferred | Needs email transport (Resend/SMTP) — Wave 6+ |

---

## 5. UX Standards (SaaS Bible Compliance)

| Standard | Implementation |
|----------|---------------|
| **Form validation** | `react-hook-form` + `zod` — inline errors on every field |
| **Toast feedback** | `sonner` — success/error on every action |
| **Loading state** | Button disabled + spinner during API call |
| **Error state** | Red alert banner + inline field errors |
| **Password strength** | 4-segment bar (red → orange → yellow → green) |
| **UI components** | `shadcn/ui` (Button, Input, Label) |

---

## 6. User Stories

### US-AUTH-01: Register
```gherkin
GIVEN user chưa có account
WHEN  vào /register, nhập firstName, lastName, email, password, confirmPassword
THEN  tạo account + tenant mới (auto: "[firstName]'s Store")
AND   auto-login (set cookie)
AND   toast.success "Account created! 🎉"
AND   redirect → /onboarding
```

### US-AUTH-02: Login
```gherkin
GIVEN user đã có account
WHEN  vào /login, nhập email + password đúng
THEN  set auth cookie
AND   toast.success "Welcome back! 🎉"
AND   redirect → /dashboard (hoặc ?redirect URL nếu có)
```

### US-AUTH-03: Login Fail
```gherkin
GIVEN user nhập sai email/password
WHEN  submit form
THEN  hiện alert error "Incorrect email or password"
AND   toast.error message
AND   KHÔNG redirect, giữ nguyên trang
AND   password field cleared
```

### US-AUTH-04: Auth Guard
```gherkin
GIVEN user chưa login (không có session)
WHEN  truy cập /dashboard, /builder/*, /editor/*
THEN  redirect → /login?redirect=[original_url]
AND   sau khi login → redirect lại original_url
```

### US-AUTH-05: Logout
```gherkin
GIVEN user đã login
WHEN  click Logout (sidebar bottom)
THEN  clear session cookie
AND   redirect → /login
```

### US-AUTH-06: Register Auto-Tenant
```gherkin
GIVEN user register thành công
WHEN  Payload creates user
THEN  auto-create Tenant { name: "[firstName]'s Store", slug: auto-generated }
AND   assign user.tenants[0] = { tenant: newTenantId, role: 'owner' }
```

### US-AUTH-07: Forgot Password 🆕
```gherkin
GIVEN user quên mật khẩu
WHEN  vào /forgot-password, nhập email
THEN  POST /api/users/forgot-password
AND   LUÔN hiện success state (không reveal email có tồn tại hay không — security)
AND   toast.success "Reset link sent!"
AND   success UI: "Check your email for a reset link" + link "Back to sign in"
```

### US-AUTH-08: Reset Password 🆕
```gherkin
GIVEN user click reset link trong email (/reset-password?token=xxx)
WHEN  nhập new password + confirm password
THEN  POST /api/users/reset-password { token, password }
AND   thành công → toast.success "Password reset successful! 🔐"
AND   redirect → /login

GIVEN token invalid hoặc expired
THEN  error state: "This reset link has expired"
AND   CTA "Request new reset link" → /forgot-password
```

### US-AUTH-09: Reset Password — No Token 🆕
```gherkin
GIVEN user access /reset-password KHÔNG có ?token
THEN  error state: "Invalid reset link"
AND   CTA "Request new reset link" → /forgot-password
AND   link "Back to sign in" → /login
```

---

## 7. Technical Requirements

### Dependencies
| Package | Purpose | Status |
|---------|---------|--------|
| `react-hook-form` v7 | Form state management | ✅ Installed |
| `@hookform/resolvers` | Zod resolver | ✅ Installed |
| `zod` | Schema validation | ✅ Installed |
| `sonner` | Toast notifications | ✅ Installed |

### Payload CMS APIs (built-in)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users` | POST | Register user |
| `/api/users/login` | POST | Login |
| `/api/users/logout` | POST | Logout |
| `/api/users/forgot-password` | POST | Send reset email |
| `/api/users/reset-password` | POST | Reset with token |

### Components
| Component | File | Description |
|-----------|------|-------------|
| AuthLayout | `app/(auth)/layout.tsx` | Glassmorphism card, PrimeWeb logo, Toaster |
| LoginPage | `app/(auth)/login/page.tsx` | Login form |
| RegisterPage | `app/(auth)/register/page.tsx` | Register form |
| ForgotPasswordPage | `app/(auth)/forgot-password/page.tsx` | Email → reset link |
| ResetPasswordPage | `app/(auth)/reset-password/page.tsx` | Token → new password |

---

## 8. Out of Scope (Deferred)

| Feature | Target Wave | Reason |
|---------|-------------|--------|
| Google SSO | Wave 6+ | Requires OAuth setup |
| Email verification | Wave 6+ | Requires email transport (Resend/SMTP) |
| Rate limiting login | Wave 6+ | Requires middleware/Redis |
| 2FA (Two-Factor Auth) | Wave 7+ | Nice-to-have |

---

## 9. 9-Point Done Checklist

- [x] Loading State — Button spinner during API calls
- [x] Empty State — N/A (forms always visible)
- [x] Error State — Alert banner + inline field errors + toast
- [x] Form Validation — Zod schemas on all forms (email, password, name)
- [x] Button States — Disabled + spinner during submit
- [x] Toast Feedback — Success + error on all actions (sonner)
- [x] Auth Redirect — 401 → /login?redirect=[url]
- [x] Mobile 375px — Responsive card layout, 44px tap targets
- [x] TypeScript Clean — tsc --noEmit pass (no new errors)
