/**
 * Contact defaults for AI gen — fill empty phone/email/address on the wire
 * payload so generated sites show real contact info instead of canned sample
 * data.
 *
 * Priority per field: wizard form > contactInfo already on the site (owner may
 * have edited it in Global) > signed-in account. Account values only seed NEW
 * sites or fields still empty on an existing site, so regenerate never
 * overwrites what the owner set. QC accounts (`@primeweb.local`) are skipped
 * and PW1 migrations skip the account fallback entirely (the owner's login
 * email is not the store's business contact).
 *
 * Pure functions only — no I/O. Import from source in tests.
 */

import { normalizeEmail, normalizePhone } from './business-info-mapper'

const QC_EMAIL_SUFFIX = '@primeweb.local'

export type ContactDefaults = { phone?: string; email?: string; address?: string }
type ContactLike = { phone?: unknown; email?: unknown; address?: unknown }

function cleanAddress(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() ? raw.trim().replace(/\s+/g, ' ') : undefined
}

/** Contact fields from a record (account or site.contactInfo), normalized. Empty fields omitted. */
export function pickContact(src: ContactLike | null | undefined): ContactDefaults {
  const out: ContactDefaults = {}
  if (!src) return out
  const email = normalizeEmail(typeof src.email === 'string' ? src.email : undefined)
  if (email) out.email = email
  const phone = normalizePhone(typeof src.phone === 'string' ? src.phone : undefined)
  if (phone) out.phone = phone
  const address = cleanAddress(src.address)
  if (address) out.address = address
  return out
}

/** Account contact: email (minus QC domain) + phone. Users have no address field. */
export function pickUserContactDefaults(user: { email?: unknown; phone?: unknown }): ContactDefaults {
  const { email, phone } = pickContact({ email: user.email, phone: user.phone })
  return {
    ...(email && !email.endsWith(QC_EMAIL_SUFFIX) ? { email } : {}),
    ...(phone ? { phone } : {}),
  }
}

/** Returns a copy of `info` with empty phone/email/address filled from `defaults`. */
export function withUserContactDefaults<T extends { phone?: string; email?: string; address?: string }>(
  info: T,
  defaults: ContactDefaults,
): T {
  return {
    ...info,
    phone: normalizePhone(info.phone) ? info.phone : defaults.phone,
    email: normalizeEmail(info.email) ? info.email : defaults.email,
    address: cleanAddress(info.address) ? info.address : defaults.address,
  }
}

/**
 * Wire payload with contact defaults applied. `migration` skips the account
 * fallback; the site's own contactInfo is still honored.
 */
export function applyGenerationContact<T extends { phone?: string; email?: string; address?: string }>(
  info: T,
  ctx: {
    user: { email?: unknown; phone?: unknown }
    existingContactInfo?: ContactLike | null
    migration?: boolean
  },
): T {
  const account = ctx.migration ? {} : pickUserContactDefaults(ctx.user)
  return withUserContactDefaults(info, { ...account, ...pickContact(ctx.existingContactInfo) })
}

/** Contact data to persist on `sites.contactInfo` — only non-empty fields. */
export function buildSiteContactInfo(info: { phone?: string; email?: string; address?: string }) {
  return pickContact(info)
}
