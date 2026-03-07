# Architecture: Auth Flow

> **Date:** 2026-03-07 | **Related PRD:** `docs/prd/auth.md`  
> **Agent:** Architect Agent

---

## Overview

Auth sử dụng **Payload CMS built-in authentication** — không cần thêm JWT library.
Payload quản lý:
- Cookie-based session (`payload-token`)
- Password hashing (bcrypt)
- `/api/users/login`, `/api/users/logout`, `/api/users/me`

Login/Register pages = **Client Components** (forms có state).
Auth guard = **Server-side middleware** + `getPayload()` check.

## Component Architecture

```
(auth)/layout.tsx               ← Centered layout, no sidebar
├── login/page.tsx              ← Client Component (login form)
└── register/page.tsx           ← Client Component (register form)

middleware.ts                   ← Auth guard (check payload-token cookie)

src/lib/auth.ts                 ← Helper: getCurrentUser() server-side
```

## API Endpoints (Payload Built-in)

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/users/login` | `{ email, password }` | `{ user, token, exp }` |
| POST | `/api/users` | `{ email, password, firstName, lastName }` | `{ doc: user }` (register) |
| POST | `/api/users/logout` | — | `{ message }` |
| GET | `/api/users/me` | Cookie `payload-token` | `{ user }` or `null` |

## Data Flow

### Register Flow
```
RegisterForm.tsx (Client)
  │
  ├── 1. POST /api/users { email, password, firstName, lastName }
  │      → Payload creates user (cookie auto-set)
  │
  ├── 2. POST /api/tenants { name: "[firstName]'s Store" }
  │      → Create tenant for new user
  │
  ├── 3. PATCH /api/users/:id { tenants: [{ tenant: tenantId, role: 'owner' }] }
  │      → Link user to tenant
  │
  └── 4. router.push('/onboarding')
```

### Login Flow
```
LoginForm.tsx (Client)
  │
  ├── 1. POST /api/users/login { email, password }
  │      → Success: cookie set, get user object
  │      → Fail: show toast error
  │
  └── 2. router.push(redirectUrl || '/dashboard')
```

### Auth Guard (Middleware)
```
middleware.ts
  │
  ├── Check: request.cookies.get('payload-token')
  │
  ├── If NO token + route matches /dashboard|/builder|/editor:
  │      → redirect('/login?redirect=' + pathname)
  │
  └── If HAS token → continue (next())
```

## 6-Layer Checklist

```
✅ Layer 1 — PRODUCT/UX:
   - Login/Register forms with inline validation ✅
   - Password visibility toggle ✅
   - Loading state on submit button ✅
   - Error toast for failed login ✅

✅ Layer 2 — API/BACKEND:
   - Payload built-in REST (no custom endpoints) ✅
   - Cookie-based auth (httpOnly, secure) ✅

✅ Layer 3 — DATA/STORAGE:
   - Users collection (auth: true) ✅
   - Tenants collection ✅
   - Auto-create tenant on register ✅

✅ Layer 4 — SECURITY/AUTH:
   - bcrypt password hashing (Payload built-in) ✅
   - httpOnly cookie (not accessible via JS) ✅
   - CSRF protection (Payload built-in) ✅
   - Middleware guard (server-side check) ✅

⬜ Layer 5 — OPS/RELIABILITY:
   - Rate limiting (Wave 5)
   - Sentry error tracking (Wave 5)

⬜ Layer 6 — BUSINESS:
   - Google SSO (Wave 5)
   - Email verification (Wave 5)
```

## File List

| Action | File | Notes |
|--------|------|-------|
| NEW | `src/app/(auth)/layout.tsx` | Centered card layout, branding |
| NEW | `src/app/(auth)/login/page.tsx` | Login form (Client Component) |
| NEW | `src/app/(auth)/register/page.tsx` | Register form (Client Component) |
| NEW | `src/lib/auth.ts` | getCurrentUser() helper |
| MODIFY | `src/middleware.ts` | Add auth guard for protected routes |
| MODIFY | `src/components/dashboard/Sidebar.tsx` | Wire logout button |
