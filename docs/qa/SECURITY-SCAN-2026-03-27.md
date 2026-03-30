# Security Scan Report — ECH Prime Web v2

**Date:** 2026-03-27
**Scan Scope:** OWASP Top 10 (2021) — Features F02, F13, F19
**Branch:** `staging` (commit `98ddb99`)
**Auditor:** Automated scan + manual code review (Claude)
**Classification:** Internal — Dev Team Only

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Critical** | 2 |
| **High** | 5 |
| **Medium** | 6 |
| **Low** | 4 |
| **Informational** | 3 |
| **Total Findings** | **20** |

The application demonstrates solid foundational security (OTP 2FA, webhook signature verification, Zod validation, RBAC checks). However, **2 critical findings** require immediate attention: hardcoded SMTP credentials in `.env.example` and a JWT fallback secret that weakens the entire auth chain.

---

## Findings Summary Table

| # | Finding | Severity | OWASP Category | File(s) | Status |
|---|---------|----------|----------------|---------|--------|
| SEC-01 | Hardcoded SMTP credentials in `.env.example` | **CRITICAL** | A07 Security Misconfiguration | `.env.example` | Open |
| SEC-02 | JWT fallback secret `'fallback-dev-secret'` | **CRITICAL** | A02 Cryptographic Failures | `src/collections/Users.ts:556` | Open |
| SEC-03 | No rate limiting on login endpoint | **HIGH** | A07 Security Misconfiguration | `src/app/(auth)/login/page.tsx` | Open |
| SEC-04 | No rate limiting on registration endpoint | **HIGH** | A07 Security Misconfiguration | `src/app/(auth)/register/page.tsx` | Open |
| SEC-05 | OTP hash uses SHA-256 without salt/HMAC | **HIGH** | A02 Cryptographic Failures | `src/lib/otp/generate.ts:14` | Open |
| SEC-06 | Cron secret fallback `'dev-cron-secret'` | **HIGH** | A07 Security Misconfiguration | `src/app/api/seo/cron/keywords/route.ts:11` | Open |
| SEC-07 | Order create uses server-side price (good) but no stock check before checkout | **HIGH** | A04 Insecure Design | `src/app/api/orders/create/route.ts:69` | Open |
| SEC-08 | Error messages expose internal details in 500 responses | **MEDIUM** | A09 Security Logging & Monitoring | `src/app/api/orders/create/route.ts:176` | Open |
| SEC-09 | Manual JWT implementation instead of library | **MEDIUM** | A02 Cryptographic Failures | `src/collections/Users.ts:554-571` | Open |
| SEC-10 | In-memory rate limiter not production-ready | **MEDIUM** | A07 Security Misconfiguration | `src/lib/rateLimit.ts` | Open |
| SEC-11 | `password.trim()` in login allows space-stripped passwords | **MEDIUM** | A07 Security Misconfiguration | `src/app/(auth)/login/page.tsx:80` | Open |
| SEC-12 | Bulk staff removal has no upper-bound on array size | **MEDIUM** | A04 Insecure Design | `src/collections/Users.ts:370` | Open |
| SEC-13 | DNS verification dev mode has 80% random success | **MEDIUM** | A07 Security Misconfiguration | `src/app/(dashboard)/settings/domains/actions.ts:109` | Open |
| SEC-14 | CORS/CSRF limited to single origin | **LOW** | A05 Security Misconfiguration | `src/payload.config.ts:120-125` | Open |
| SEC-15 | Auth guard in middleware only checks cookie existence | **LOW** | A01 Broken Access Control | `src/middleware.ts:123` | Open |
| SEC-16 | `update-staff` endpoint overwrites `firstName` globally | **LOW** | A01 Broken Access Control | `src/collections/Users.ts:250` | Open |
| SEC-17 | Missing `HttpOnly` / `Secure` / `SameSite` on custom JWT cookie | **LOW** | A02 Cryptographic Failures | `src/collections/Users.ts` (verify-otp) | Open |
| SEC-18 | npm audit: 4 high, 20 moderate vulnerabilities | **INFO** | A06 Vulnerable Components | `package.json` | Open |
| SEC-19 | OTP rate limit cooldown logic is fragile | **INFO** | A07 Security Misconfiguration | `src/collections/Users.ts:433-441` | Open |
| SEC-20 | `x-tenant-slug` header set without sanitization | **INFO** | A03 Injection | `src/middleware.ts:78` | Open |

---

## Detailed Analysis by Feature

---

### F02 — Authentication & Authorization

#### What Works Well
- **OTP 2FA flow**: Login requires email + password + OTP verification. OTP is hashed with SHA-256 before storage.
- **OTP attempt limiting**: Max 5 failed attempts before lockout (line 502, `Users.ts`).
- **OTP cooldown**: Prevents spamming OTP requests (60-second cooldown, line 433).
- **Email enumeration prevention**: Send-OTP returns generic message regardless of email existence (line 426).
- **Zod validation**: Both login and register forms validate input with Zod schemas on client side.
- **Password strength indicator**: Register page shows real-time password strength feedback.
- **Access control**: Proper row-level access on Users collection (read/update own data only, super-admin override).
- **CSRF protection**: Payload CMS `csrf` config is set in `payload.config.ts`.

#### SEC-01 — CRITICAL: Hardcoded SMTP Credentials in `.env.example`

**File:** `.env.example` (lines 52-53)
**Details:** The `.env.example` file contains what appear to be real AWS SES SMTP credentials:
```
MAIL_USERNAME=AKIA5A2GJKSXIKQAXGYH
MAIL_PASSWORD=BDtfPoTybcSfRM7A/RzLprdUW4QCs7+l28IoARrfWJLk
```
These are not placeholder values — `AKIA` prefix is a real AWS access key format.

**Impact:** Anyone with repo access (or if repo becomes public) can use these credentials to send email as the application, potentially for phishing, spam, or account takeover.

**Recommendation:**
1. **IMMEDIATELY** rotate these AWS SES credentials in the AWS Console.
2. Replace with placeholder values: `MAIL_USERNAME=your-ses-smtp-username` / `MAIL_PASSWORD=your-ses-smtp-password`.
3. Run `git filter-branch` or BFG Repo Cleaner to remove from git history.
4. Add a pre-commit hook to scan for AWS key patterns (`AKIA[0-9A-Z]{16}`).

---

#### SEC-02 — CRITICAL: JWT Fallback Secret

**File:** `src/collections/Users.ts` (line 556)
```typescript
const secret = process.env.PAYLOAD_SECRET || 'fallback-dev-secret'
```

**Details:** The OTP verify endpoint manually constructs JWT tokens. If `PAYLOAD_SECRET` is missing from environment (e.g., misconfigured deploy), all tokens are signed with `'fallback-dev-secret'`, allowing an attacker to forge arbitrary JWTs.

**Impact:** Complete authentication bypass. Attacker can impersonate any user including super-admin.

**Recommendation:**
1. Remove the fallback — throw an error if `PAYLOAD_SECRET` is not set:
   ```typescript
   const secret = process.env.PAYLOAD_SECRET
   if (!secret) throw new Error('PAYLOAD_SECRET must be configured')
   ```
2. Add a startup health check that validates all required env vars are present.

---

#### SEC-03 — HIGH: No Rate Limiting on Login Endpoint

**File:** `src/app/(auth)/login/page.tsx` -> hits `/api/users/login` (Payload built-in)

**Details:** The login endpoint (`/api/users/login`) has no rate limiting. An attacker can brute-force passwords at high speed. While OTP adds a second factor, the password check itself is unprotected.

**Recommendation:**
- Apply IP-based rate limiting on `/api/users/login` (e.g., max 5 attempts per IP per 15 minutes).
- Use the existing `src/lib/rateLimit.ts` module or a production-grade solution (Redis-backed).
- Consider implementing account lockout after N failed attempts.

---

#### SEC-04 — HIGH: No Rate Limiting on Registration Endpoint

**File:** `src/app/(auth)/register/page.tsx` -> hits `/api/users` (Payload built-in create)

**Details:** Registration has `access: { create: () => true }` with no rate limiting. An attacker can create thousands of accounts to exhaust database storage, flood email systems (welcome emails), or enumerate valid email addresses via duplicate error responses.

**Recommendation:**
- Add IP-based rate limiting on `/api/users` POST endpoint.
- Consider CAPTCHA (hCaptcha/Turnstile) on registration form.

---

#### SEC-05 — HIGH: OTP Hash Uses Unsalted SHA-256

**File:** `src/lib/otp/generate.ts` (line 14)
```typescript
export function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex')
}
```

**Details:** OTP codes are 6 digits (100,000-999,999). With unsalted SHA-256, an attacker with database read access can precompute a rainbow table of all 900,000 possible hashes in milliseconds and reverse any stored OTP.

**Recommendation:**
- Use HMAC-SHA256 with a server-side secret key:
  ```typescript
  export function hashOTP(otp: string): string {
      const secret = process.env.PAYLOAD_SECRET!
      return createHmac('sha256', secret).update(otp).digest('hex')
  }
  ```
- Alternatively, use bcrypt/scrypt for OTP hashing (slower but no rainbow table risk).

---

#### SEC-09 — MEDIUM: Manual JWT Implementation

**File:** `src/collections/Users.ts` (lines 554-571)

**Details:** The verify-otp endpoint manually constructs JWT tokens using raw Buffer/HMAC instead of a library like `jsonwebtoken`. Manual implementations are prone to subtle security bugs (e.g., algorithm confusion, timing attacks in signature comparison).

**Recommendation:**
- Use Payload CMS's built-in token generation, or the `jsonwebtoken` library.
- If manual implementation is required, use `crypto.timingSafeEqual()` for signature comparison in verification logic.

---

#### SEC-11 — MEDIUM: Password Trimming

**File:** `src/app/(auth)/login/page.tsx` (line 80)
```typescript
password: data.password.trim(),
```

**Details:** Trimming whitespace from passwords before sending means spaces at the start/end of a password are silently removed. This reduces the password keyspace and can cause confusion if users intentionally use leading/trailing spaces.

**Recommendation:**
- Remove `.trim()` from the password field. Email can be trimmed, but passwords should be sent as-is.

---

#### SEC-15 — LOW: Middleware Auth Check Only Validates Cookie Existence

**File:** `src/middleware.ts` (line 123)
```typescript
const hasToken = req.cookies.has('payload-token')
```

**Details:** The middleware only checks if `payload-token` cookie exists, not whether it's valid. An expired or forged token passes this check. Actual validation happens downstream in `getCurrentUser()`, but a user with an invalid token sees a flash of the protected page before redirect.

**Recommendation:**
- This is acceptable for edge middleware (can't do full JWT validation at edge). Document this as a known UX trade-off.
- Consider adding basic JWT expiry check (decode without verify, check `exp` claim) in middleware for better UX.

---

#### SEC-17 — LOW: Custom JWT Cookie Handling

**File:** `src/collections/Users.ts` (verify-otp endpoint)

**Details:** The verify-otp endpoint returns the JWT token in the JSON response body. The client must then set it as a cookie. There is no evidence the client sets `HttpOnly`, `Secure`, and `SameSite=Lax` attributes. Without `HttpOnly`, the token is accessible via JavaScript (XSS risk).

**Recommendation:**
- Set the cookie server-side in the verify-otp response:
  ```typescript
  const response = Response.json({ message: 'OK', user: safeUser })
  response.headers.set('Set-Cookie',
    `payload-token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expSeconds}`)
  return response
  ```

---

### F13 — Payment Gateway (Stripe)

#### What Works Well
- **Webhook signature verification**: `verifyStripeWebhook()` correctly uses `stripe.webhooks.constructEvent()` with proper secrets (line 185, `stripe.ts`).
- **No card data stored**: Application uses Stripe Checkout (hosted payment page). No PAN/CVV/sensitive card data touches the server.
- **Direct Charges model**: Payment goes to merchant's connected Stripe account with application fee. Clean separation of concerns.
- **Idempotency in webhook**: `handleCheckoutCompleted` checks if order is already `paid` before processing (line 105-117, webhook `route.ts`).
- **Server-side price calculation**: Order amounts are calculated from DB product prices, not from client input.
- **Zod validation**: Order creation is validated with `orderCreateSchema`.
- **Stock decrement with retry**: Optimistic locking pattern with 3 retries for stock updates.

#### SEC-07 — HIGH: No Stock Validation Before Checkout

**File:** `src/app/api/orders/create/route.ts` (line 69)
```typescript
if (!product) continue  // Skips missing products silently
```

**Details:** The order creation endpoint does not check if the product has sufficient inventory before creating the pending order and redirecting to Stripe Checkout. A customer could:
1. Place an order for a product with 0 inventory.
2. Complete payment on Stripe.
3. The webhook then tries to decrement stock (line 145-146) but `Math.max(0, currentInventory - quantity)` silently allows overselling.

**Impact:** Overselling inventory, merchant has to manually cancel/refund.

**Recommendation:**
- Add stock check before creating the order:
  ```typescript
  if (p.inventory !== undefined && p.inventory < item.quantity) {
      return NextResponse.json(
          { success: false, error: { code: 'OUT_OF_STOCK', message: `${p.name} is out of stock` } },
          { status: 422 }
      )
  }
  ```
- Reserve inventory when order is created (optimistic reservation), release if payment fails/expires.

---

#### SEC-08 — MEDIUM: Internal Error Details Exposed

**File:** `src/app/api/orders/create/route.ts` (line 176)
```typescript
{ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }
```

**Details:** The catch block exposes the raw `error.message` to the client. This can leak internal details (database errors, stack traces, file paths).

**Recommendation:**
- Return a generic error message to the client:
  ```typescript
  { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }
  ```
- Log the full error server-side (already done at line 173).

---

### F19 — Store Configuration (Domains & Staff)

#### What Works Well
- **Tenant isolation**: All domain actions use `getCurrentTenantId()` which derives tenant from the authenticated user's session. No user-supplied tenant ID for domain operations.
- **IDOR protection on staff endpoints**: Staff management endpoints (invite, remove, update) verify the requester's tenant membership and role (`owner`/`admin`) before proceeding.
- **Domain uniqueness check**: `addCustomDomain` checks globally that no other tenant has the same domain.
- **Domain format validation**: Regex validation on domain input with protocol stripping.
- **Last owner protection**: Cannot remove, demote, or deactivate the last workspace owner.
- **Input sanitization**: Domain input is lowercased, trimmed, and protocol-stripped.
- **SQL injection protection**: All database operations use Payload CMS ORM (parameterized queries).

#### SEC-06 — HIGH: Cron Secret Fallback

**File:** `src/app/api/seo/cron/keywords/route.ts` (line 11)
```typescript
const VERCEL_CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret'
```

**Details:** If `CRON_SECRET` is not set in production, the cron endpoint accepts `Bearer dev-cron-secret`. The production check (`process.env.NODE_ENV === 'production'`) mitigates this partially, but if NODE_ENV is misconfigured the endpoint is open.

**Recommendation:**
- Remove the fallback. Return 500 if `CRON_SECRET` is not set in production.
- Add `CRON_SECRET` to the deployment checklist and CI env validation.

---

#### SEC-10 — MEDIUM: In-Memory Rate Limiter

**File:** `src/lib/rateLimit.ts`

**Details:** The rate limiter stores state in a JavaScript `Map`. In production with multiple instances (e.g., DigitalOcean App Platform scaling), each instance has its own Map. An attacker can bypass rate limits by hitting different instances.

**Recommendation:**
- Replace with Redis-backed rate limiting for production. The comment in the file already acknowledges this.
- As an interim measure, document this limitation for the DevOps team.

---

#### SEC-12 — MEDIUM: Unbounded Bulk Operations

**File:** `src/collections/Users.ts` (line 370)
```typescript
for (const userId of userIds) {  // No limit on array size
```

**Details:** The `bulk-remove-staff` endpoint accepts an array of `userIds` with no upper bound. An attacker could send thousands of IDs, causing N+1 database queries and potential DoS.

**Recommendation:**
- Add a maximum limit:
  ```typescript
  if (userIds.length > 50) {
      return Response.json({ errors: [{ message: 'Maximum 50 users per bulk operation' }] }, { status: 400 })
  }
  ```

---

#### SEC-13 — MEDIUM: Dev Mode DNS Verification

**File:** `src/app/(dashboard)/settings/domains/actions.ts` (line 109)
```typescript
isSuccess = Math.random() > 0.2;  // 80% random success in dev
```

**Details:** When `SERVER_IP` is not set, domain verification randomly succeeds. If this env var is accidentally missing in production, any domain could be "verified" and pointed at the platform.

**Recommendation:**
- Add explicit `NODE_ENV` check:
  ```typescript
  if (!serverIp && process.env.NODE_ENV === 'production') {
      return { success: false, error: 'SERVER_IP not configured. Contact support.' }
  }
  ```

---

#### SEC-16 — LOW: Staff Update Overwrites User's Global Name

**File:** `src/collections/Users.ts` (line 250)
```typescript
firstName: name, // Overwrite name along with access rights
```

**Details:** The `update-staff` endpoint overwrites the user's global `firstName` field. If the user belongs to multiple tenants, a workspace admin in Tenant A can rename a user, affecting how they appear in Tenant B.

**Recommendation:**
- Store per-tenant display names separately, or remove the name update from the staff update endpoint.

---

## Additional Findings

#### SEC-14 — LOW: CORS/CSRF Single Origin

**File:** `src/payload.config.ts` (lines 120-125)

**Details:** CORS and CSRF are configured for a single origin (`NEXT_PUBLIC_SERVER_URL`). If the app is accessed via custom domains or subdomains, API requests from those origins will be blocked by CORS or fail CSRF validation.

**Recommendation:**
- Add wildcard subdomain support: `*.primeweb.app`.
- Consider dynamically building the allowed origins list from tenant custom domains.

---

#### SEC-18 — INFO: Dependency Vulnerabilities

**npm audit results:** 4 high, 20 moderate, 0 critical vulnerabilities (24 total).

Most are transitive dependencies from `@payloadcms/db-postgres` -> `drizzle-kit` -> `esbuild`. These are build-time/dev dependencies and pose lower runtime risk.

**Recommendation:**
- Run `npm audit fix` to resolve what can be auto-fixed.
- Track the remaining as known-acceptable in a `.nsprc` or similar audit ignore file.
- Upgrade `@payloadcms/db-postgres` when a compatible major version is available.

---

#### SEC-19 — INFO: OTP Cooldown Logic

**File:** `src/collections/Users.ts` (lines 433-441)

**Details:** The cooldown calculation `lastExpiry.getTime() - (4 * 60 * 1000)` back-calculates when the OTP was sent from its expiry time. This is fragile — if `OTP_TTL_MS` changes from 5 minutes, the cooldown breaks.

**Recommendation:**
- Store `otpSentAt` as a separate field, or use a constant for the cooldown window that's independent of TTL.

---

#### SEC-20 — INFO: Unsanitized Tenant Slug in Header

**File:** `src/middleware.ts` (line 78)
```typescript
response.headers.set('x-tenant-slug', tenantSlug)
```

**Details:** The tenant slug is extracted from the hostname and set as a response header without sanitization. While HTTP header injection is unlikely via hostname, defense-in-depth suggests sanitizing.

**Recommendation:**
- Validate slug format: `/^[a-z0-9-]+$/` before setting the header.

---

## Action Items for Dev Team

### Immediate (Before Next Deploy)

| Priority | Task | Assignee | Est. |
|----------|------|----------|------|
| P0 | SEC-01: Rotate AWS SES credentials, scrub from `.env.example` and git history | DevOps | 1h |
| P0 | SEC-02: Remove JWT fallback secret, throw error if env missing | Dev | 15m |

### Sprint Backlog (Next 2 Sprints)

| Priority | Task | Assignee | Est. |
|----------|------|----------|------|
| P1 | SEC-03/04: Add rate limiting to login & register endpoints | Dev | 4h |
| P1 | SEC-05: Switch OTP hashing to HMAC-SHA256 with server secret | Dev | 1h |
| P1 | SEC-06: Remove cron secret fallback, validate env on startup | Dev | 30m |
| P1 | SEC-07: Add inventory check before order creation | Dev | 2h |
| P2 | SEC-08: Sanitize error messages in API responses | Dev | 1h |
| P2 | SEC-09: Replace manual JWT with `jsonwebtoken` or Payload built-in | Dev | 2h |
| P2 | SEC-10: Plan Redis-backed rate limiting for multi-instance | DevOps | 4h |
| P2 | SEC-11: Remove `password.trim()` from login form | Dev | 15m |
| P2 | SEC-12: Add max limit to bulk staff operations | Dev | 30m |
| P2 | SEC-13: Add NODE_ENV guard for dev-mode DNS verification | Dev | 15m |
| P2 | SEC-17: Set JWT cookie server-side with HttpOnly/Secure flags | Dev | 1h |

### Backlog (Track, Lower Priority)

| Priority | Task | Assignee | Est. |
|----------|------|----------|------|
| P3 | SEC-14: Expand CORS/CSRF for multi-domain support | Dev | 2h |
| P3 | SEC-15: Add basic JWT expiry check in middleware | Dev | 1h |
| P3 | SEC-16: Refactor staff name update to per-tenant scope | Dev | 2h |
| P3 | SEC-18: Resolve npm audit high-severity dependencies | Dev | 2h |
| P3 | SEC-19: Refactor OTP cooldown to use explicit `otpSentAt` field | Dev | 1h |
| P3 | SEC-20: Add slug validation in middleware header | Dev | 15m |

---

## OWASP Top 10 Coverage Matrix

| OWASP Category | Findings | Assessment |
|----------------|----------|------------|
| A01 Broken Access Control | SEC-15, SEC-16 | **Good** — RBAC enforced at API layer, row-level access on Users collection |
| A02 Cryptographic Failures | SEC-02, SEC-05, SEC-09, SEC-17 | **Needs Work** — JWT fallback secret, unsalted OTP hash |
| A03 Injection | SEC-20 | **Good** — ORM prevents SQLi, Zod validates input |
| A04 Insecure Design | SEC-07, SEC-12 | **Fair** — Stock validation gap, unbounded bulk ops |
| A05 Security Misconfiguration | SEC-14 | **Good** — CSRF/CORS configured, single-origin limitation |
| A06 Vulnerable Components | SEC-18 | **Fair** — 4 high via transitive deps |
| A07 Security Misconfiguration | SEC-01, SEC-03, SEC-04, SEC-06, SEC-10, SEC-11, SEC-13 | **Needs Work** — Rate limiting gaps, secret fallbacks |
| A08 Software & Data Integrity | N/A | **Good** — Webhook signature verification in place |
| A09 Security Logging & Monitoring | SEC-08 | **Fair** — Errors logged but details leaked to client |
| A10 SSRF | N/A | **Good** — No user-controlled URL fetching observed |

---

## Methodology

- **Static analysis**: Manual code review of all specified files + related auth/payment/config modules.
- **Secret scanning**: Regex scan for patterns `password`, `secret`, `api_key`, `sk_live`, `sk_test` across `src/`.
- **Dependency audit**: `npm audit` for known CVEs in dependencies.
- **OWASP mapping**: Each finding mapped to OWASP Top 10 (2021) categories.
- **Scope limitations**: This scan covers application code only. Infrastructure (Docker, DigitalOcean, DNS) and Payload CMS framework internals were not audited.

---

*Report generated: 2026-03-27 | Next scheduled scan: 2026-04-27*
