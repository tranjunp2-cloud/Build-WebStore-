/**
 * QC test environment OTP bypass helper.
 *
 * Lets the QC lane (branch `qc-test` deployed via Vercel Preview scope) skip
 * the real OTP send + verify path so QA can iterate without waiting for
 * emails to hit fake `@primeweb.local` inboxes.
 *
 * Triple guard — ALL three must hold before bypass activates:
 *   1. `APP_ENV === 'qc-test'`      — the Vercel scope stamp
 *   2. `QC_OTP_BYPASS_ENABLED='true'` — explicit opt-in per env
 *   3. Email ends with `QC_OTP_BYPASS_DOMAIN`  — user-space restrict
 *
 * NODE_ENV is intentionally NOT used because Vercel sets NODE_ENV=production
 * on every non-development build, including the QC Preview lane. APP_ENV is
 * the env-scoped stamp (see .claude/rules/env-vars.md).
 *
 * Defense-in-depth: if any env var accidentally lands on the production
 * scope, the domain check still refuses to bypass real customer emails.
 *
 * Related:
 *   - Existing `E2E_TEST_OTP_CODE` + `TEST_EMAIL` bypass in Users.ts remains
 *     unchanged. This helper adds a NEW, DOMAIN-SCOPED bypass on top of it.
 *   - Plan: plans/260706-1653-GH-02-qa-performance-testing-plan/phase-01-*.md
 */

const QC_APP_ENV = 'qc-test'

/** Returns the code the QC lane accepts (throws if the env var is unset). */
export function getQcBypassCode(): string {
  const code = process.env.QC_OTP_BYPASS_CODE
  if (!code || code.length < 4) {
    throw new Error(
      'QC_OTP_BYPASS_CODE env var must be set (>= 4 chars) when QC bypass is enabled',
    )
  }
  return code
}

/** True iff the current runtime is the QC lane AND bypass is explicitly on. */
export function isQcBypassEnabled(): boolean {
  return (
    (process.env.APP_ENV === QC_APP_ENV || process.env.NEXT_PUBLIC_APP_ENV === QC_APP_ENV)
    && process.env.QC_OTP_BYPASS_ENABLED === 'true'
  )
}

/**
 * True iff QC bypass is enabled AND the email belongs to the configured
 * QC domain (default `@primeweb.local`). Callers must still verify the OTP
 * matches `getQcBypassCode()` before granting access.
 */
export function canBypassOtpForEmail(email: string | undefined): boolean {
  if (!email) return false
  if (!isQcBypassEnabled()) return false
  const domain = process.env.QC_OTP_BYPASS_DOMAIN
  if (!domain) return false
  return email.toLowerCase().endsWith(domain.toLowerCase())
}

/**
 * Convenience: does the email + code match the QC bypass? Wraps the domain
 * gate with a code equality check so verify-otp callers get a single-line
 * check instead of two.
 */
export function isValidQcBypass(email: string | undefined, code: string): boolean {
  if (!canBypassOtpForEmail(email)) return false
  return code === getQcBypassCode()
}
