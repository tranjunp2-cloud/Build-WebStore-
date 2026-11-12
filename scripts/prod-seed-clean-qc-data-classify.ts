/**
 * Pure classification of staging rows for the prod-seed cleanup.
 *
 * Precedence is always: provenance (PW1 ledger) > explicit QC convention >
 * everything else. Anything that is neither provenance nor clearly QC is
 * `review`: it is reported and kept, never deleted.
 *
 * QC conventions come from scripts/qc-fixtures.ts (`qc-*@primeweb.local`,
 * tenants `qc-shop-N` / `QC Tenant N`), scripts/qc-seed-functional.ts
 * (`@qc.primeweb.local`), scripts/seed.ts (`demo@primeweb.app`,
 * `kedai-demo`) and docs/TEST_ACCOUNTS.md (`test@primeweb.app`, `test-store`).
 * Service accounts such as `sso-service@primeweb.app` are deliberately NOT
 * matched: they fall into `review`.
 */

export type Verdict = 'keep' | 'delete' | 'review'

export interface Classified {
  verdict: Verdict
  reason: string
}

export interface UserRow {
  id: number
  email: string
  roles: readonly string[]
  hasProvenance: boolean
}

export interface TenantRow {
  id: number
  slug: string
  name: string
  hasProvenance: boolean
  memberUserIds: readonly number[]
}

const QC_EMAIL_DOMAIN_SUFFIXES: readonly string[] = ['@primeweb.local', '.primeweb.local']
const QC_EXACT_EMAILS: ReadonlySet<string> = new Set([
  'test@primeweb.app',
  'demo@primeweb.app',
  'measure-variety@primeweb.app',
])
const QC_TENANT_SLUG = /^(qc-shop-\d+|kedai-demo|test-store)$/
const QC_TENANT_NAME = /^QC Tenant \d+$/

export function isQcEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return (
    QC_EXACT_EMAILS.has(normalized) ||
    QC_EMAIL_DOMAIN_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  )
}

/**
 * `--delete-review` purge: owner decided every non-provenance, non-QC row is
 * staging test data. Staff/service accounts below are still kept.
 */
export interface ClassifyOptions {
  deleteReview: boolean
}

const PURGE_PROTECTED_EMAIL = /(@primeweb\.app|@primecommerce\.asia)$|^phuong\.ltweb(\+[^@]*)?@/

export function isPurgeProtectedEmail(email: string): boolean {
  return PURGE_PROTECTED_EMAIL.test(email.trim().toLowerCase())
}

export function isQcTenant(slug: string, name: string): boolean {
  return QC_TENANT_SLUG.test(slug) || QC_TENANT_NAME.test(name)
}

export function classifyUser(user: UserRow, opts: ClassifyOptions = { deleteReview: false }): Classified {
  if (user.hasProvenance) return { verdict: 'keep', reason: 'pw1 provenance' }
  if (isQcEmail(user.email)) {
    return {
      verdict: 'delete',
      reason: user.roles.includes('super-admin') ? 'qc super-admin' : 'qc email convention',
    }
  }
  if (user.roles.includes('super-admin')) {
    return { verdict: 'keep', reason: 'non-qc super-admin (needs human approval)' }
  }
  if (opts.deleteReview && !isPurgeProtectedEmail(user.email)) {
    return { verdict: 'delete', reason: 'review purge (--delete-review)' }
  }
  return { verdict: 'review', reason: 'no provenance, no qc convention' }
}

export function classifyTenant(
  tenant: TenantRow,
  userVerdicts: ReadonlyMap<number, Verdict>,
  opts: ClassifyOptions = { deleteReview: false },
): Classified {
  if (tenant.hasProvenance) return { verdict: 'keep', reason: 'pw1 provenance' }
  if (isQcTenant(tenant.slug, tenant.name)) {
    return { verdict: 'delete', reason: 'qc slug/name convention' }
  }
  const members = tenant.memberUserIds
  if (members.length > 0 && members.every((id) => userVerdicts.get(id) === 'delete')) {
    return { verdict: 'delete', reason: 'all members are qc users' }
  }
  if (opts.deleteReview) return { verdict: 'delete', reason: 'review purge (--delete-review)' }
  return { verdict: 'review', reason: 'no provenance, no qc convention' }
}

/** Mask the local part so REVIEW output does not spill full customer emails. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`
}
