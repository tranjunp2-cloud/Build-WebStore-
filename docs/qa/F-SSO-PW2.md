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
| **TC-SSOPW2-05** | API | Explicit setup intent: new user → onboarding | User has no tenants, has_seen_ai_wizard=false | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/onboarding' }` | High |
| **TC-SSOPW2-06** | API | Explicit setup intent: no Step 1 row → onboarding | Tenant onboardingCompleted=false, has_seen_ai_wizard=false; no step rows | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/onboarding' }`; step resolver is queried | High |
| **TC-SSOPW2-07** | API | Explicit setup intent: user already saw wizard and completed all steps | has_seen_ai_wizard=true; all step rows exist | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/dashboard' }` | High |
| **TC-SSOPW2-08** | API | Non-owner role → dashboard | User role=editor or viewer | POST with valid token | 200 `{ ok: true, redirectTo: '/dashboard' }` | Medium |
| **TC-SSOPW2-09** | API | Explicit setup intent: onboarding and all steps complete → dashboard | Tenant onboardingCompleted=true, has_seen_ai_wizard=false; all step rows exist | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/dashboard' }` | Medium |
| **TC-SSOPW2-10** | API | Session cookie set on success | — | POST with valid token | Response sets `payload-token` cookie: httpOnly=true, sameSite=lax, path=/ | High |
| **TC-SSOPW2-11** | E2E *(deferred — no Playwright impl yet)* | Full generic SSO flow → dashboard | Successfully authenticated SSO user | SSO login → `/sso/authorization` without step intent | Loading screen → cookie set → redirect to `/dashboard`, no `/verify-otp` bounce | High |
| **TC-SSOPW2-12** | E2E *(deferred — no Playwright impl yet)* | Full explicit setup flow → onboarding | SSO user, tenant onboardingCompleted=false, wizard not seen | SSO login → `/sso/authorization?redirect_url=/initial-setting` | Loading screen → cookie set → redirect to `/onboarding` | High |
| **TC-SSOPW2-13** | Security | Client redirect guard | Server returns malicious redirectTo | SsoAuthorizationClient receives `redirectTo: '//evil.com'` | Falls back to `/dashboard` — no external redirect | High |
| **TC-SSOPW2-14** | API | Explicit setup: 0 steps done → /onboarding | tenant-owner, onboarding complete, no sso_step_events rows | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/onboarding' }` | High |
| **TC-SSOPW2-15** | API | Explicit setup: step 1 done → /settings/shipping | tenant-owner, step 1 completed in sso_step_events | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/settings/shipping' }` | High |
| **TC-SSOPW2-16** | API | Explicit setup: steps 1+2 done → /products | tenant-owner, steps 1+2 completed | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/products' }` | High |
| **TC-SSOPW2-17** | API | Explicit setup: all 3 steps done → /dashboard | tenant-owner, all steps completed | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/dashboard' }` | High |
| **TC-SSOPW2-18** | API | Explicit setup: DB error → fail-open /dashboard | sso_step_events query throws | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/dashboard' }` — SSO not blocked | High |
| **TC-SSOPW2-19** | API | Explicit setup: has_seen_ai_wizard=false + onboarding done + 0 steps → /onboarding | Tenant onboardingCompleted=true, wizard not seen, no steps | POST with valid token and `redirect_url='/initial-setting'` | 200 `{ ok: true, redirectTo: '/onboarding' }` | Medium |

---

## GH-1725 — Generic Web Store Navigation

> **Issue:** App Switcher and Direct icon must open PWv2 Dashboard. Source evidence shows both generic entries omit `redirect_url`; ProductCard alone supplies the legacy step paths.
> **ProductCard contract:** `/content-manager/product[/]` resolves `/products`. For an existing tenant, `/initial-setting` uses completed `sso_step_events`; Step 1 wins over stale onboarding flags, while no tenant or no Step 1 remains `/onboarding`.

| ID | Automation | Area | Scenario | Expected Result | Priority |
|:---|:---:|:---|:---|:---|:---:|
| **TC-1725-NAV-01** | [x] AUTO | API | Generic callback with Step 1 row present and Step 2 absent | `/dashboard`; `sso_step_events` is not queried | High |
| **TC-1725-NAV-02** | [x] AUTO | API | Generic callback for a user matching the current onboarding predicate | `/dashboard`; generic entry takes precedence | High |
| **TC-1725-NAV-03** | [x] AUTO | API | Explicit `/initial-setting` with no step rows | `/onboarding` | High |
| **TC-1725-NAV-04** | [x] AUTO | API | Explicit `/initial-setting` with Step 1 row | `/settings/shipping` | High |
| **TC-1725-NAV-05** | [x] AUTO | API | Explicit `/content-manager/product` with or without trailing slash | `/products`; step resolver is not queried | High |
| **TC-1725-NAV-06** | [x] AUTO | Security | Unknown, external, protocol-relative, oversized, or non-string intent | `/dashboard`; raw value is never used as destination | High |
| **TC-1725-NAV-07** | [x] AUTO | API | Explicit `/initial-setting`, Step 1 row, onboarding flags still false | `/settings/shipping`; step state overrides stale onboarding flags | High |
| **TC-1725-CLIENT-01** | [x] AUTO | Client | Authorization client receives a legacy ProductCard intent | Session POST includes the same `redirect_url` | High |
| **TC-1725-CLIENT-02** | [x] AUTO | Client security | Session API returns a disallowed destination | Client falls back to `/dashboard` | High |
| **TC-1725-CLIENT-03** | [x] AUTO | Client | Session API returns canonical Product list destination | Client navigates to `/products` | High |
| **TC-1725-PAGE-01** | [x] AUTO | Server page | Authorization page receives one `redirect_url` value | Client receives the exact string prop | High |
| **TC-1725-PAGE-02** | [x] AUTO | Server page | Authorization page receives repeated `redirect_url` values | Client receives no intent; session fallback is Dashboard | High |
| **TC-1725-E2E-FIXTURE-01** | [x] AUTO | API fixture security | Invalid SSO completed-step fixture values | Guarded fixture returns 400 before Payload/DB access | High |
| **TC-1725-E2E-FIXTURE-02** | [x] AUTO | API fixture | Seed `ssoCompletedSteps: [1]` for the isolated E2E user | Existing rows are replaced with deterministic Step-1-only state | High |
| **TC-1725-E2E-03** | [x] AUTO | PWv2 browser | Generic authorization callback with deterministic Step-1-only state | Real page → session API → cookie flow ends at `/dashboard`, never Shipping or OTP | High |
| **TC-1725-E2E-01** | [ ] MANUAL | Staging browser | App Switcher → Web Store, exact Step-1-complete reproducer | Final pathname `/dashboard` | High |
| **TC-1725-E2E-02** | [ ] MANUAL | Staging browser | Web Store Direct icon, same reproducer | Final pathname `/dashboard` | High |

### Execution record — 2026-08-14

- PWv2 and SSO staging were reachable, but the fix was not yet deployed when manual acceptance was attempted.
- No verified exact-state SSO session was available.
- `TC-1725-E2E-01`: **BLOCKED / NOT RUN**.
- `TC-1725-E2E-02`: **BLOCKED / NOT RUN**.
- `TC-1725-E2E-03` now automates the PWv2-owned callback boundary with a guarded Step-1-only fixture. It does not claim to click either external SSO Hub control.
- Focused baseline was 44/50 with six targeted contract failures; after the reviewer follow-up, local verification passed 50/50 tests, typecheck, lint, and diff-check. Lint retained 147 baseline warnings, with none attributable to GH-1725.
- Review remains conditional on the two external SSO Hub journeys for full cross-application acceptance.
- Unblock by deploying the exact fix to PWv2 staging and providing a secure SSO-issued session for the exact Step-1-complete/Step-2-current account state.
- Token safety: do not use a locally minted application token as an SSO fixture; do not store credentials, tokens, or full callback paths in execution evidence.

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

---

## SSO Step-Sync Notify + Retry Cron — Unit Test Cases (TC-1293-SYNC-*)

> **Added:** 2026-07-02 | **Issue:** #1293 | **Coverage gap closed by:** `fix/GH-1293-sso-step-sync-timeout`
> **Automated in:** `src/__tests__/unit/lib/sso-api-client.test.ts`, `src/__tests__/api/process-sso-steps-cron.test.ts`

### sso-api-client.ts (`sendSSOStepNotification`, `notifyStepComplete`, `persistStepEvent`)

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1293-SYNC-01** | `fetchWithTimeout` aborts at `SSO_FETCH_TIMEOUT_MS` (30s) — not sooner, not later | Still pending at 29,999ms; rejects with `AbortError` at 30,000ms |
| **TC-1293-SYNC-02** | Login failure never includes the response body (request carries the real plaintext password) | Error message contains status only, never body text; `res.text()` not even called |
| **TC-1293-SYNC-03** | step-status PATCH failure includes status and response body, with our own bearer token redacted | Error message contains status + body text (safe — no password in this request), but never the raw token even if Hub's error response echoes it back |
| **TC-1293-SYNC-04** | `notifyStepComplete` never throws; persists a `pending` row with the error text on failure | Resolves `undefined`; `sso_step_events` upsert has `status='pending'` + error text |
| **TC-1293-SYNC-05** | `notifyStepComplete` skips the SSO call when the step is already `completed` | No `fetch` call made |
| **TC-1293-SYNC-06** | A failing body read on an error response still throws a status-bearing error | No unhandled rejection; error message contains status |
| **TC-1293-SYNC-07** | `persistStepEvent` upserts via `ON CONFLICT (user_id, step)` on every attempt, never a plain insert | Two sequential calls for the same `(userId, step)` both produce an `ON CONFLICT` upsert |
| **TC-1293-SYNC-08** | Upsert resets `retry_count` to 0 on both the insert default and the conflict-update path | SQL contains `retry_count = 0` (DO UPDATE) and `, 0) ON CONFLICT` (VALUES default) |

### EasyParcel activation trigger — Issue #1724

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1724-SYNC-01** | Enabled EasyParcel activation schedules Shipping step 2 | After successful tenant persistence, PWv2 invokes `notifyStepComplete(payload, user.id, 2)` and sends `{ step2_status: 1 }` |
| **TC-1724-SYNC-02** | Disabled EasyParcel save does not complete SSO Shipping step | No SSO notification is scheduled when `enabled=false` |
| **TC-1724-SYNC-03** | SSO outage does not fail EasyParcel activation | Save returns 200; notifier failure is contained and retryable through `sso_step_events` |
| **TC-1724-SYNC-04** | Missing SSO key material is not marked completed | Missing `keyString` produces a pending event, never a completed event |
| **TC-1724-SYNC-05** | Missing `after()` request context uses safe fallback | Save remains successful and invokes the notifier immediately when `after()` cannot be scheduled |

### EasyParcel browser acceptance — Issue #1724

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1724-E2E-01** | Incomplete pickup address blocks activation | Fixture must be in setup or management state; incomplete setup keeps Next unavailable, while management exposes an active EasyParcel control surface. Full Save & Activate/SSO completion is verified with the configured local or staging fixture.

### SSO retry cron resilience — Issue #1724

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1724-CRON-01** | Cron requires authorization | Missing or invalid CRON_SECRET returns 401 without database work |
| **TC-1724-CRON-02** | Cron claims bounded work | One invocation claims at most two events and processes at most two concurrently |
| **TC-1724-CRON-03** | Slow SSO stays within worker budget | Cron uses 20s login/25s PATCH budgets and leaves unfinished processing rows reclaimable |
| **TC-1724-CRON-04** | Queue summary is observable | Response/log includes queue count, oldest age, concurrency/outcome counters, and no secrets |
### process-sso-steps/route.ts (retry cron finalize guard)

| ID | Title | Expected |
|:---|:---|:---|
| **TC-1293-SYNC-09** | Finalize on success updates the row and counts it `succeeded` when the guard genuinely matches | Row transitions to `completed`; response `succeeded=1`, `raced=0` |
| **TC-1293-SYNC-10** | Finalize on failure updates the row and counts it `failed` when the guard genuinely matches | Row transitions to `pending`; response `failed=1`, `raced=0` |
| **TC-1293-SYNC-11** | Concurrent completion (row already off `processing`) makes the success finalize no-op | Row untouched; response `succeeded=0`, `raced=1` — not miscounted as a success |
| **TC-1293-SYNC-12** | Concurrent update (row already off `processing`) makes the failure finalize no-op | Row untouched; response `failed=0`, `raced=1` — not miscounted as a failure |
