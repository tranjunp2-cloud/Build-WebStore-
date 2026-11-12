/**
 * E2E OTP bypass gate (the `E2E_TEST_OTP_CODE` + `TEST_EMAIL` shortcut in
 * Users.ts `/send-otp` and `/verify-otp`).
 *
 * The bypass used to work in any env that set the two vars (staging does), so
 * a leaked code logged in as whatever account sat behind TEST_EMAIL. It now
 * needs ALL of:
 *   1. `E2E_TEST_OTP_CODE` and `TEST_EMAIL` set, and the email is TEST_EMAIL
 *   2. env gate: `APP_ENV === 'qc-test'` OR `E2E_OTP_BYPASS_ENABLED === 'true'`
 *      (explicit per-env opt-in), and never a Vercel production deployment
 *      (`VERCEL_ENV === 'production'`) whatever the env says
 *   3. the account is not a super-admin
 *   4. when `E2E_OTP_BYPASS_TENANT_ID` is set (comma-separated ids allowed),
 *      the account has no active OR pending membership in any other workspace
 *      (verify-otp turns pending invites into active ones, so a pending invite
 *      would become a real membership through this very login). Suspended ones
 *      do not count.
 *
 * When any check fails the caller runs the normal OTP flow.
 * Sibling of the QC lane bypass in `./qc-bypass.ts`.
 */
import { timingSafeEqual } from 'crypto'

const QC_APP_ENV = 'qc-test'

export interface E2eBypassMembership {
  tenant?: unknown
  status?: string | null
}

export interface E2eBypassUser {
  roles?: readonly string[] | null
  tenants?: readonly E2eBypassMembership[] | null
}

/** True iff the runtime is the QC lane or the env explicitly opted in, and never on Vercel production. */
export function isE2eBypassEnvEnabled(): boolean {
  if (process.env.VERCEL_ENV === 'production') return false
  return process.env.APP_ENV === QC_APP_ENV || process.env.E2E_OTP_BYPASS_ENABLED === 'true'
}

function membershipTenantId(tenant: unknown): string | null {
  if (typeof tenant === 'string' || typeof tenant === 'number') return String(tenant)
  if (tenant && typeof tenant === 'object' && 'id' in tenant) {
    const id = (tenant as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

function allowedTenantIds(): Set<string> | null {
  const raw = process.env.E2E_OTP_BYPASS_TENANT_ID?.trim()
  if (!raw) return null
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))
}

/** Account guards: never a super-admin, never an account active in a non-QA workspace. */
export function isE2eBypassUserAllowed(user: E2eBypassUser | null | undefined): boolean {
  if (!user) return false
  if (user.roles?.includes('super-admin')) return false
  const allowed = allowedTenantIds()
  if (!allowed) return true
  return (user.tenants ?? []).every((membership) => {
    // A membership without a status is active (field defaultValue); a pending invite is accepted by this login.
    const status = membership.status ?? 'active'
    if (status !== 'active' && status !== 'pending') return true
    const id = membershipTenantId(membership.tenant)
    return id !== null && allowed.has(id)
  })
}

/** Send path: may this email/account receive the fixed E2E code instead of a real OTP? */
export function canUseE2eOtpBypass(email: string | undefined, user: E2eBypassUser | null | undefined): boolean {
  const code = process.env.E2E_TEST_OTP_CODE
  const testEmail = process.env.TEST_EMAIL
  if (!code || !testEmail || !email || email !== testEmail) return false
  if (!isE2eBypassEnvEnabled()) return false
  return isE2eBypassUserAllowed(user)
}

/** The fixed code, or undefined when unset. Only meaningful after `canUseE2eOtpBypass`. */
export function getE2eBypassCode(): string | undefined {
  return process.env.E2E_TEST_OTP_CODE || undefined
}

/** Verify path: gate passes AND the submitted code equals E2E_TEST_OTP_CODE. */
export function isValidE2eBypass(
  email: string | undefined,
  otp: string,
  user: E2eBypassUser | null | undefined,
): boolean {
  if (!canUseE2eOtpBypass(email, user)) return false
  const given = Buffer.from(String(otp))
  const wanted = Buffer.from(process.env.E2E_TEST_OTP_CODE as string)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}
