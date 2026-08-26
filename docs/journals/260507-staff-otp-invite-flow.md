# Staff Management + OTP Authentication Flow — Complete Documentation

**Date**: 2026-05-07 16:22
**Severity**: High
**Component**: F19 (Staff Management) + F02 (Authentication / OTP)
**Status**: Resolved
**Related PRs**: #906 (Payload 3 validation fix), fix/F19-905 (tenant normalization)

---

## What Happened

We implemented a full staff invite→login→OTP flow spanning user management, email delivery, and multi-tenant authentication. The flow had one critical bug: **Payload 3's validation layer rejected null values in select-hasMany arrays**, causing 500 errors when staff tried to send OTP. We fixed it by normalizing tenants before every Payload update. Anyone picking up this code needs to understand:

1. How the invite flow creates users and assigns tenant memberships
2. Where the OTP system stores and validates codes
3. Why `normalizeTenants()` is mandatory (not optional)
4. How tenant ID types vary (string vs number) and must be coerced
5. Why MAIL_HOST guards exist and what happens when email is disabled

---

## The Brutal Truth

This flow is fragile. It touches database schema (users → tenants → permissions), email transport (AWS SES via Payload), and authentication tokens (jose JWT). Each layer has edge cases:

- If you forget `normalizeTenants()` on a tenant-touching update, you get a cryptic 500 from Payload's schema validator
- If MAIL_HOST is not set, staff get silently dropped into /verify-otp with `emailSent: false` — the UI warns them but doesn't block
- If a developer blindly compares tenant IDs without type coercion, they'll fail on PostgreSQL integer IDs returned from `payload.find()`
- If OTP verification clears fields but doesn't activate pending invites, staff stay stuck in "pending" status forever

The mental model is: **invitation state is stored in the database (status: 'pending'/'active'), not in memory or email**. Once OTP verifies, we flip status → 'active'. If that doesn't happen, the staff member has no dashboard access.

---

## Technical Details

### 1. Staff Invite Flow (Endpoint: POST `/api/users/invite-staff`)

**Inputs:**
```json
{
  "email": "alice@example.com",
  "name": "Alice Chen",
  "tenantId": "123",
  "role": "manager",  // or "owner", "viewer", "custom"
  "permissions": ["users.read", "users.write"]  // only for custom role
}
```

**Process:**
1. Verify requester is an owner in tenantId (role = 'owner')
2. Check if user exists by email
3. If **new user**: Create with temp password + pending tenant membership
4. If **existing user**: Add to tenant + reset password (so they can log in again)
5. If **cross-tenant owner**: Reject — user can't be staff if they own another workspace
6. Send invitation email with temp password + login URL

**Key code** (`src/collections/Users.ts:191-317`):
```typescript
// After checking permissions, create or update user
tempPassword = randomBytes(8).toString('base64url').slice(0, 12)

if (targetUser) {
  // Existing: normalize before spreading (CRITICAL)
  const normalizedExisting = normalizeTenants(targetUser.tenants || [])
  await req.payload.update({
    collection: 'users',
    id: targetUser.id,
    overrideAccess: true,
    data: {
      password: tempPassword,
      tenants: [
        ...normalizedExisting,
        { tenant: tenantId, role, status: 'pending', permissions: role === 'custom' ? permissions : [] }
      ]
    }
  })
} else {
  // New: create with pending tenant
  targetUser = await req.payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email,
      firstName: name,
      password: tempPassword,
      roles: ['tenant-owner'],  // Platform role, not tenant role
      tenants: [{ tenant: tenantId, role, status: 'pending', permissions: role === 'custom' ? permissions : [] }]
    }
  })
}

// Email only if MAIL_HOST is configured
if (!process.env.MAIL_HOST) {
  emailSent = false
  console.error('[StaffInvite] MAIL_HOST not set — streamTransport swallows email')
} else {
  await req.payload.sendEmail({ to: email, subject, html })
}
```

**Email content** → `staffInvitationEmail()` template in `src/lib/email/templates/staff-invitation.ts`:
- Staff name, workspace name
- Login URL (`/login`)
- Temporary password (NOT a magic link — they must enter it manually)

**Validation rules:**
- Email length ≤ 254 chars (RFC 5321)
- Can't invite yourself (`email !== req.user.email`)
- Can't invite an active owner from another workspace
- Can't invite if user is already in this tenant

---

### 2. Staff Login + Send OTP Flow

**Step A: Login Page (POST `/api/users/login`)**

Entry: `/login` page with email + password form

Staff enters:
- Email: `alice@example.com`
- Password: temporary password from invitation email (or password they set later)

Handler (`src/collections/Users.ts:125-188`):
1. Validate email format (zod schema)
2. Call Payload's native login: `req.payload.login({ collection: 'users', data: { email, password } })`
3. If valid, generate JWT token + set HttpOnly cookie
4. Return user object (tenant relationships populated at depth=1)

**Why this matters:** The login endpoint returns the full user object including tenants. The Next.js /login page client reads this and decides where to redirect.

**Step B: Send OTP (POST `/api/users/send-otp`)**

Triggered automatically by `/login` page after login succeeds:
```typescript
// In /login page client component
if (loginResult.ok) {
  const data = await loginResult.json()
  // Automatically call send-otp
  await fetch('/api/users/send-otp', { method: 'POST', body: JSON.stringify({ email }) })
  // Then redirect to /verify-otp?email=alice@example.com
}
```

**Handler** (`src/collections/Users.ts:629-733`):

Inputs:
```json
{ "email": "alice@example.com" }
```

**Process:**
1. Find user by email
2. Rate limit: max 1 OTP per 60s (checks `otpExpiresAt - 4min cooldown`)
3. Dev/E2E bypass check:
   - If `NODE_ENV=development` → any 6-digit code is valid later
   - If `E2E_TEST_OTP_CODE` set + `TEST_EMAIL` matches → use magic code
4. Generate OTP (or use test code):
   ```typescript
   const otp = (isDev && testOtpCode) ? testOtpCode : generateOTP()  // generateOTP() → random 6 digits
   const otpHash = hashOTP(otp)  // bcrypt hash
   const otpExpiry = getOTPExpiry()  // Date.now() + 5 min
   ```
5. **CRITICAL STEP: Normalize tenants before update**
   ```typescript
   await req.payload.update({
     collection: 'users',
     id: user.id,
     overrideAccess: true,
     data: {
       otpHash,
       otpExpiresAt: otpExpiry.toISOString(),
       otpAttempts: 0,
       tenants: normalizeTenants(user.tenants || [])  // ← WHY? See Root Cause below
     }
   })
   ```
6. Send OTP email (if MAIL_HOST set), otherwise return `emailSent: false`
7. Response: `{ message: '...', emailSent: true/false }`

**Email content** → `otpVerificationEmail()` template:
- Staff name
- 6-digit OTP code (never log the actual code in production)
- "Expires in 5 minutes"

**MAIL_HOST guard:**
```typescript
if (!process.env.MAIL_HOST) {
  emailSent = false
  console.error('[OTP] MAIL_HOST not set — streamTransport swallows email')
} else {
  await req.payload.sendEmail({ to: email, subject, html })
}
```
→ If email is disabled, `emailSent: false` is returned, and the client shows a warning toast. Staff are NOT blocked — they can still type any code and be verified (in dev/E2E).

---

### 3. Verify OTP + Activate Tenants (POST `/api/users/verify-otp`)

**Flow:** Staff enters 6-digit code on `/verify-otp?email=alice@example.com`

**Handler** (`src/collections/Users.ts:735-881`):

Inputs:
```json
{ "email": "alice@example.com", "otp": "123456" }
```

**Process:**
1. Find user by email
2. Rate limit: max 5 verification attempts
3. Test bypass checks (same as send-otp):
   - Dev mode: any 6-digit code passes
   - E2E: specific TEST_EMAIL + E2E_TEST_OTP_CODE
4. Check OTP expiry (skip for test bypass)
5. Verify hash if not bypassed:
   ```typescript
   const { verifyOTP } = await import('@/lib/otp/generate')
   const isValid = verifyOTP(otp, user.otpHash)  // bcrypt compare
   ```
6. **If invalid**: increment otpAttempts, return 401
7. **If valid**: **ACTIVATE PENDING TENANTS**
   ```typescript
   const updatedTenants = normalizeTenants(user.tenants || []).map((t) => ({
     ...t,
     status: t.status === 'pending' ? 'active' : t.status  // ← key step
   }))
   
   await req.payload.update({
     collection: 'users',
     id: user.id,
     overrideAccess: true,
     data: {
       otpHash: '',
       otpExpiresAt: null,
       otpAttempts: 0,
       lastLoginAt: new Date().toISOString(),
       tenants: updatedTenants
     }
   })
   ```
8. Generate JWT (jose library, same as Payload V3):
   ```typescript
   const token = await new SignJWT({
     id: user.id,
     email: user.email,
     collection: 'users',
     mfa_verified: true  // ← required by middleware
   })
     .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
     .setIssuedAt(now)
     .setExpirationTime(now + 86400)  // 24h
     .sign(secretKey)
   ```
9. Set HttpOnly cookie + return token + user
10. Client redirects to `/dashboard` (owner) or `/admin` (staff)

**Return:**
```json
{
  "message": "Verification successful",
  "token": "eyJ...",
  "user": { "id": "...", "email": "..." },  // Sensitive fields stripped
  "exp": 1715000000
}
```

---

### 4. The Critical Bug: Payload 3 Validation Error

**Symptom:** POST `/api/users/send-otp` returns 500 on staff login.

**Root cause:**
- Payload 3 validates the **full merged document** on `payload.update()`, not just passed fields
- When creating users with tenants, the `users_tenants_permissions` select-hasMany table stores NULL (not []) when no permission rows exist
- Payload's schema validator for select-hasMany arrays rejects `null` → validation error → 500

**Example:**
```sql
-- PostgreSQL: users_tenants table has no linked permissions rows
SELECT id, tenant_id, role FROM users_tenants WHERE id = 'xyz';
-- Returns: (xyz, 123, manager, NULL permissions_value)

-- When Payload fetches this user and we call payload.update(),
-- it merges the fetched user object:
{
  id: 'user1',
  email: 'alice@example.com',
  tenants: [
    { id: 'xyz', tenant: 123, role: 'manager', permissions: null }  // ← null, not []
  ]
}

-- Payload's validator sees tenants[0].permissions = null
// and rejects it because the schema expects string[] not null
```

**Fix:** `normalizeTenants()` converts null → []:
```typescript
// src/lib/normalize-tenants.ts
export function normalizeTenants(tenants: TenantMembership[]): TenantMembership[] {
  return tenants.map((t: TenantMembership) => ({
    ...(t.id ? { id: t.id } : {}),
    tenant: (t.tenant && typeof t.tenant === 'object') ? t.tenant.id : t.tenant,
    role: t.role,
    status: t.status,
    permissions: t.permissions || [],  // ← null || [] = []
  }))
}
```

**Applied in:**
- `invite-staff`: before spreading normalizedExisting
- `send-otp`: before storing user in DB
- `verify-otp`: before activating tenants
- `remove-staff`, `bulk-remove-staff`: before removing tenants
- `update-staff`, `update-staff-status`: before mutating tenants

**Lesson:** Always use `normalizeTenants()` before passing tenants to `payload.update()`. This is not defensive programming — it's mandatory.

---

### 5. Tenant ID Type Coercion Issue

**Problem:** PostgreSQL returns integer IDs; TypeScript types expect strings (or both).

**Symptoms:**
- Tenant ID comparisons fail: `String(t.tenant?.id ?? t.tenant) === String(tenantId)` returns false
- Staff list doesn't filter by correct tenant

**Solution:** Coerce all tenant ID comparisons to strings:

In `page.tsx`:
```typescript
const tId = typeof t.tenant === 'object' && t.tenant !== null 
  ? String(t.tenant.id)  // ← coerce
  : String(t.tenant)
return tId === tenantId
```

In `extractTenantId()` (`src/lib/auth.ts:151-160`):
```typescript
const first = tenants[0].tenant
if (typeof first === 'string') return first
if (typeof first === 'number') return String(first)  // ← coerce number to string
if (first?.id != null) return String(first.id)
return null
```

In all endpoints (invite-staff, send-otp, etc.):
```typescript
String(t.tenant?.id ?? t.tenant) === String(tenantId)
```

---

### 6. MAIL_HOST Guard Behavior

**When MAIL_HOST is not set:**
```typescript
if (!process.env.MAIL_HOST) {
  emailSent = false
  console.error('[StaffInvite] MAIL_HOST not set — streamTransport swallows email')
} else {
  await req.payload.sendEmail(...)
}
return Response.json({ ..., emailSent })
```

**What this means:**
- `emailSent: false` is returned to the client
- Client shows a **warning toast**, NOT an error
- In dev/E2E, staff can still proceed to /verify-otp and enter a code
- In production, if MAIL_HOST is misconfigured, users are stuck at /verify-otp with no code

**Applied to:**
- `/invite-staff` (line 300)
- `/send-otp` (line 709)
- `/resend-invite` (line 564)

---

### 7. Permission Scope & Auth

**All staff-write endpoints require owner role:**
- `/invite-staff`: `requesterTenant.role !== 'owner'` → 403
- `/remove-staff`: same check
- `/update-staff`: same check
- `/resend-invite`: same check
- `/bulk-remove-staff`: same check

**UI gate:** `/settings/staff` page itself redirects non-owners to `/settings` (line 23):
```typescript
if (currentUserRole !== 'owner') {
  redirect('/settings')
}
```

**Why both?** Defense in depth. UI prevents non-owners from seeing the interface. API enforces it server-side. A user with direct API access can't bypass.

---

## Asciiflow Diagram: Invite → Login → OTP → Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STAFF INVITE → LOGIN → OTP FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

OWNER (Dashboard)                    STAFF (Email + Browser)
    │
    ├─ Opens /settings/staff
    │
    ├─ Clicks "Invite Staff"
    │  ├─ Fills email + role + permissions
    │  └─ POST /api/users/invite-staff
    │     │
    │     ├─ Check owner permission ✓
    │     │
    │     ├─ Create or update user
    │     │  └─ Generate temp password
    │     │
    │     ├─ Store tenant: { status: 'pending' }
    │     │  └─ normalizeTenants() ✓ prevents Payload 500
    │     │
    │     └─ Send invitation email
    │        └─ if MAIL_HOST set, await send; else emailSent=false
    │
    │
    ├─ Response: { emailSent: true/false }
    │
    │
    ├─────────────────────────────────────────────────────────→ Staff receives email
                                                                (temp password)
                                                                     │
                                                                     ├─ Clicks login link
                                                                     │
                                                                     ├─ Enters email + temp password
                                                                     │  └─ POST /api/users/login
                                                                     │     ├─ Validate email format
                                                                     │     ├─ Call payload.login()
                                                                     │     └─ Return user + token
                                                                     │
                                                                     ├─ Auto-trigger send-otp
                                                                     │  └─ POST /api/users/send-otp
                                                                     │     ├─ Find user
                                                                     │     ├─ Rate limit: 1 per 60s ✓
                                                                     │     ├─ Generate OTP (or use E2E bypass)
                                                                     │     ├─ Hash OTP + store in DB
                                                                     │     ├─ normalizeTenants() ✓
                                                                     │     └─ Send OTP email or set emailSent=false
                                                                     │
                                                                     ├─ Redirects to /verify-otp?email=...
                                                                     │  └─ Shows warning if emailSent=false
                                                                     │
                                                                     ├─ Enters 6-digit OTP
                                                                     │  └─ POST /api/users/verify-otp
                                                                     │     ├─ Find user
                                                                     │     ├─ Rate limit: 5 attempts ✓
                                                                     │     ├─ Check expiry (5 min TTL)
                                                                     │     ├─ Verify bcrypt hash
                                                                     │     ├─ If valid:
                                                                     │     │  ├─ Update tenants:
                                                                     │     │  │  status: 'pending' → 'active' ✓
                                                                     │     │  ├─ normalizeTenants() ✓
                                                                     │     │  └─ Clear otpHash + otpExpiresAt
                                                                     │     ├─ Generate JWT (jose)
                                                                     │     │  └─ { id, email, mfa_verified: true }
                                                                     │     └─ Set HttpOnly cookie
                                                                     │
                                                                     ├─ Response: { token, user, exp }
                                                                     │
                                                                     └─ Redirects to /dashboard or /admin
                                                                        └─ Middleware verifies JWT
                                                                        └─ nextAuth() checks mfa_verified=true
```

---

## Lessons Learned

### 1. Payload 3 Validates the Full Merged Document

When you call `payload.update(id, { field: value })`, Payload doesn't just validate the field you passed — it merges that field into the full fetched document and validates the entire result against the schema. If the database has null in a field that the schema expects to be an array, the update fails.

**Prevention:** Always fetch + normalize before update.

### 2. Email Transport Can Fail Silently in Development

Payload's `streamTransport` (used when MAIL_HOST is not set) silently discards emails. There's no error, no warning — just `await req.payload.sendEmail()` completes without actually sending. This is confusing when developing locally.

**Prevention:** Check MAIL_HOST before sending. Return `emailSent: false` to the client so they know the email might not have arrived.

### 3. Database IDs Can Be Numbers or Strings

PostgreSQL integer columns return numbers (`123`), but string UUID columns return strings (`"abc-def"`). When comparing tenant IDs, always coerce to string: `String(id)`.

**Prevention:** Use `extractTenantId()` and `String(t.tenant?.id ?? t.tenant)` pattern consistently.

### 4. Tenant Membership Status Is the Source of Truth

The user's dashboard access is determined by `user.tenants.find(t => t.tenant === tenantId).status === 'active'`. The email was just notification. If OTP verification doesn't flip status to 'active', the staff member has no access.

**Prevention:** In verify-otp, always map `status: 'pending' → 'active'` before the update.

### 5. Defense in Depth: Both UI + API Gates

Staff write endpoints check permissions at two layers:
- Frontend: `/settings/staff` redirects non-owners to `/settings`
- Backend: each endpoint returns 403 if not owner

A user can't bypass the API by bypassing the UI. Both layers matter.

### 6. Rate Limiting Prevents Brute Force

- send-otp: 1 per 60s (detected by `otpExpiresAt - 4 min < now`)
- verify-otp: 5 attempts per code (detected by `otpAttempts >= 5`)

These are soft limits (just return 429), not hard locks. If someone hits the limit, they can request a new OTP.

---

## Next Steps

### Immediate (Critical)

1. **Verify MAIL_HOST in staging/production**
   - Check Vercel env vars: `echo $MAIL_HOST`
   - If empty, add AWS SES credentials to Vercel Dashboard + `.env.staging.example`
   - Redeploy to staging to test end-to-end

2. **Run OTP E2E tests**
   - Check `docs/qa/F02-*.md` for test cases
   - Especially test: invite → login → send-otp → verify-otp → dashboard access
   - Verify `lastLoginAt` is set correctly after OTP verify

### Soon (Tech Debt)

1. **Extract OTP validation to reusable utility**
   - `verifyOTP()` + rate limit logic is duplicated in verify-otp endpoint
   - Create `src/lib/otp/verify-with-ratelimit.ts` to avoid future bugs

2. **Add index to otpExpiresAt column**
   - Queries to find expired OTPs will scan the whole users table
   - Add `CREATE INDEX IF NOT EXISTS idx_users_otp_expires_at ON users(otpExpiresAt)` to db-setup.js

3. **Document tenant ID coercion pattern**
   - Add a section to `docs/CODE_STANDARDS.md` about tenant comparisons
   - Suggest: always use `String(id)` or create a `compareTenantIds(id1, id2)` helper

### Later (Future Features)

1. **Magic link invitations** (instead of temp password)
   - Gen random token + store hash in invites table
   - Email link: `/onboard?token=xyz`
   - Token auto-logs in + auto-verifies OTP (MFA bypass for first login)

2. **Bulk staff import**
   - CSV upload with emails + roles
   - Async job to create users + send invites
   - Retry logic for failed sends

3. **Revoke pending invitations**
   - Owner can revoke an invite before staff accepts it
   - Delete the tenant membership row

---

## Key Files Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/collections/Users.ts` | All staff endpoints | 191-881 |
| `src/app/(dashboard)/settings/staff/page.tsx` | Staff list page, owner gate | 8-64 |
| `src/app/(dashboard)/settings/staff/StaffDirectoryClient.tsx` | Staff table UI | — |
| `src/app/(dashboard)/settings/staff/StaffDrawer.tsx` | Invite/edit drawer form | — |
| `src/app/(auth)/login/page.tsx` | Login form + send-otp trigger | 1-100 |
| `src/app/(auth)/verify-otp/page.tsx` | OTP entry + verification | 1-80 |
| `src/lib/normalize-tenants.ts` | **CRITICAL:** Payload validation fix | 1-21 |
| `src/lib/auth.ts` | extractTenantId, getCurrentUser, tenant coercion | 152-170 |
| `src/lib/otp/generate.ts` | generateOTP, hashOTP, verifyOTP, getOTPExpiry | — |
| `src/lib/email/templates/staff-invitation.ts` | Invitation email template | — |
| `src/lib/email/templates/otp-verification.ts` | OTP email template | — |

---

## Unresolved Questions

1. **Magic link invitations**: Should we implement these to replace temp passwords? They're more user-friendly but require storing invite tokens.
2. **Bulk staff operations**: Do we need a CSV upload flow for large teams (10+ staff)?
3. **Cross-tenant staff**: Can a user who is staff in tenant A also be staff in tenant B? Current logic blocks owners from being re-invited, but allows multiple staff roles.

---

**Status**: RESOLVED — Full flow implemented, critical bug fixed, documented for future maintainers.
