# Test Cases: SSO PW2 Integration — Session Exchange Endpoint

> **Feature:** SSO Phase 07 — `/api/auth/sso-session` (POST) + `/sso/authorization` page
> **Branch:** feat/sso-pw2-implementation

---

## Test Cases

| ID | Area | Title | Precondition | Steps | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---:|
| **TC-SSOPW2-01** | API | Missing v2_token in request body | — | POST `/api/auth/sso-session` with empty body | 401 `{ error: 'invalid_token' }` | High |
| **TC-SSOPW2-02** | API | Forged/invalid v2_token | — | POST with `v2_token` that Payload rejects | 401 `{ error: 'invalid_token' }` | High |
| **TC-SSOPW2-03** | API | Rate limit exceeded (IP bucket) | >300 req/min from same IP | POST with valid token after IP bucket exhausted | 429 `{ error: 'rate_limited', message: 'Too many sign-in attempts...', retryAfter: N }` + `Retry-After` header | High |
| **TC-SSO.RL-01** | API | IP bucket raised to 300 — shared-WiFi users all pass | Default env, 200 users same IP | POST valid token — verify limit arg is 300 | `checkRateLimit` called with limit=300; all requests pass | High |
| **TC-SSO.RL-02** | API | Per-user bucket blocks spammer despite IP having capacity | IP bucket not exhausted | POST valid token 11th time as same user | 429 `{ error: 'rate_limited' }` from user bucket | High |
| **TC-SSO.RL-03** | API | Normal login passes both IP and per-user buckets | Fresh buckets | POST valid token once | 200; `checkRateLimit` called twice: IP (300) then user (10) | High |
| **TC-SSO.RL-08** | API | `SSO_RATE_LIMIT_PER_MIN` env var overrides IP bucket limit | `SSO_RATE_LIMIT_PER_MIN=500` | POST valid token | `checkRateLimit` called with limit=500 on IP bucket | Medium |
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

---

## SSO Sync Endpoints — Unit Test Cases (TC-1251-SYNC-*)

> **Added:** 2026-06-23 | **Issue:** #1251 | **Coverage gap closed by:** `fix/1251-check-email-fail-safe`
> **Automated in:** `src/__tests__/unit/auth/sso-{check,change}-email.test.ts`, `sso-{ban,unban}-user.test.ts`

### check-email (`GET /api/v1/sso/check-email`)

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1251-SYNC-CE-01** | Missing Authorization header | 401 `{message: 'Authorization required'}` |
| **TC-1251-SYNC-CE-01b** | Malformed auth header (no Bearer prefix) | 401 `{message: 'Authorization required'}` |
| **TC-1251-SYNC-CE-02** | Caller not super-admin | 403 `{message: 'Insufficient permissions'}` |
| **TC-1251-SYNC-CE-03** | Missing `?email` query param | 400 `{message: 'email query param is required'}` |
| **TC-1251-SYNC-CE-04a** | Email found in DB | 200 `{exists: true}` |
| **TC-1251-SYNC-CE-04b** | Email not found in DB | 200 `{exists: false}` — no `error` field |
| **TC-1251-SYNC-CE-05** | DB error (fail-safe) — **TC-3.06 fix** | 200 `{exists: false, error: 'service_unavailable'}` |

### change-email (`POST /api/v1/sso/change-email`)

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1251-SYNC-CHE-01** | Missing Authorization header | 401 |
| **TC-1251-SYNC-CHE-02** | Caller not super-admin | 403 |
| **TC-1251-SYNC-CHE-03** | Missing `email` or `new_email` fields | 400 |
| **TC-1251-SYNC-CHE-04** | Old email not found, new_email also not applied | 404 |
| **TC-1251-SYNC-CHE-05** | Idempotency — old missing, new_email already applied | 200 `{userId}`, `payload.update` NOT called |
| **TC-1251-SYNC-CHE-06** | `new_email` in use by different user | 409 `{message: 'Email already in use'}` |
| **TC-1251-SYNC-CHE-07** | Success | 200 `{userId}`, `payload.update` called with `new_email` |

### ban-user (`POST /api/v1/sso/ban-user`)

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1251-SYNC-BU-01** | Missing Authorization header | 401 |
| **TC-1251-SYNC-BU-02** | Caller not super-admin | 403 |
| **TC-1251-SYNC-BU-03** | Missing `email` field | 400 |
| **TC-1251-SYNC-BU-04** | User not found | 404 |
| **TC-1251-SYNC-BU-05** | User has 0 tenants | 200 `{tenantsUpdated: 0}`, no crash |
| **TC-1251-SYNC-BU-06** | Suspends all tenants | 200 `{tenantsUpdated: N}`, each tenant set to `status: suspended` |

### unban-user (`POST /api/v1/sso/unban-user`)

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1251-SYNC-UBU-01** | Missing Authorization header | 401 |
| **TC-1251-SYNC-UBU-02** | Caller not super-admin | 403 |
| **TC-1251-SYNC-UBU-03** | Missing `email` field | 400 |
| **TC-1251-SYNC-UBU-04** | User not found | 404 |
| **TC-1251-SYNC-UBU-05** | User has 0 tenants | 200 `{tenantsUpdated: 0}`, no crash |
| **TC-1251-SYNC-UBU-06** | Restores all tenants to active | 200 `{tenantsUpdated: N}`, each tenant set to `status: active` |
