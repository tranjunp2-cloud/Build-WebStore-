# Test Cases: SSO PW2 Integration — Session Exchange Endpoint

> **Feature:** SSO Phase 07 — `/api/auth/sso-session` (POST) + `/sso/authorization` page
> **Branch:** feat/sso-pw2-implementation

---

## Test Cases

| ID | Area | Title | Precondition | Steps | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---:|
| **TC-SSOPW2-01** | API | Missing v2_token in request body | — | POST `/api/auth/sso-session` with empty body | 401 `{ error: 'invalid_token' }` | High |
| **TC-SSOPW2-02** | API | Forged/invalid v2_token | — | POST with `v2_token` that Payload rejects | 401 `{ error: 'invalid_token' }` | High |
| **TC-SSOPW2-03** | API | Rate limit exceeded | >10 requests/min from same IP | POST with valid token on >10th attempt | 429 `{ error: 'rate_limited' }` + `Retry-After` header | High |
| **TC-SSOPW2-04a** | API | All tenants suspended — login blocked | User has 1 tenant, status=suspended | POST with valid token | 403 `{ error: 'account_suspended' }` | High |
| **TC-SSOPW2-04b** | API | Mixed tenant statuses — login allowed | User has 2 tenants, 1 suspended 1 active | POST with valid token | 200 `{ ok: true }` | Medium |
| **TC-SSOPW2-05** | API | New user (no tenants, no wizard) → onboarding | User has no tenants, has_seen_ai_wizard=false | POST with valid token | 200 `{ ok: true, redirectTo: '/onboarding' }` | High |
| **TC-SSOPW2-06** | API | Existing user, onboarding incomplete, no wizard seen | Tenant onboardingCompleted=false, has_seen_ai_wizard=false | POST with valid token | 200 `{ ok: true, redirectTo: '/onboarding' }` | High |
| **TC-SSOPW2-07** | API | User already saw wizard → dashboard | has_seen_ai_wizard=true (regardless of onboardingCompleted) | POST with valid token | 200 `{ ok: true, redirectTo: '/dashboard' }` | High |
| **TC-SSOPW2-08** | API | Non-owner role → dashboard | User role=editor or viewer | POST with valid token | 200 `{ ok: true, redirectTo: '/dashboard' }` | Medium |
| **TC-SSOPW2-09** | API | Onboarding complete → dashboard | Tenant onboardingCompleted=true, has_seen_ai_wizard=false | POST with valid token | 200 `{ ok: true, redirectTo: '/dashboard' }` | Medium |
| **TC-SSOPW2-10** | API | Session cookie set on success | — | POST with valid token | Response sets `payload-token` cookie: httpOnly=true, sameSite=lax, path=/ | High |
| **TC-SSOPW2-11** | E2E *(deferred — no Playwright impl yet)* | Full SSO flow — happy path (dashboard) | SSO user with completed onboarding | SSO login → `/sso/authorization` page | Loading screen → cookie set → redirect to `/dashboard`, no `/verify-otp` bounce | High |
| **TC-SSOPW2-12** | E2E *(deferred — no Playwright impl yet)* | Full SSO flow — new user (onboarding) | SSO user, tenant onboardingCompleted=false, wizard not seen | SSO login → `/sso/authorization` page | Loading screen → cookie set → redirect to `/onboarding` | High |
| **TC-SSOPW2-13** | Security | Client redirect guard | Server returns malicious redirectTo | SsoAuthorizationClient receives `redirectTo: '//evil.com'` | Falls back to `/dashboard` — no external redirect | High |
