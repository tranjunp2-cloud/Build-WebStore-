/**
 * User contact defaults — fill empty phone/email on the AI gen wire payload
 * from the signed-in account, so generated sites show the owner's real contact
 * info instead of canned category sample data.
 *
 * Pure functions only. Form-supplied values always win over account values.
 * QC test accounts (`@primeweb.local`) are skipped so fake inboxes never reach
 * a public page.
 */

import { normalizeEmail, normalizePhone } from './business-info-mapper'

const QC_EMAIL_SUFFIX = '@primeweb.local'

export type ContactDefaults = { phone?: string; email?: string }

export function pickUserContactDefaults(user: { email?: unknown; phone?: unknown }): ContactDefaults {
  const out: ContactDefaults = {}
  const email = normalizeEmail(typeof user.email === 'string' ? user.email : undefined)
  if (email && !email.endsWith(QC_EMAIL_SUFFIX)) out.email = email
  const phone = normalizePhone(typeof user.phone === 'string' ? user.phone : undefined)
  if (phone) out.phone = phone
  return out
}

/** Returns a copy of `info` with empty phone/email filled from `defaults`. */
export function withUserContactDefaults<T extends { phone?: string; email?: string }>(
  info: T,
  defaults: ContactDefaults,
): T {
  return {
    ...info,
    phone: normalizePhone(info.phone) ? info.phone : defaults.phone,
    email: normalizeEmail(info.email) ? info.email : defaults.email,
  }
}

/** Contact data to persist on `sites.contactInfo` — only non-empty fields. */
export function buildSiteContactInfo(info: { phone?: string; email?: string; address?: string }) {
  const out: { phone?: string; email?: string; address?: string } = {}
  const phone = normalizePhone(info.phone)
  if (phone) out.phone = phone
  const email = normalizeEmail(info.email)
  if (email) out.email = email
  const address = info.address?.trim()
  if (address) out.address = address
  return out
}
