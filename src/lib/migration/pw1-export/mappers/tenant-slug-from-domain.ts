import { type MappingContext, type Row } from '../contracts'
import {
  isReservedSlug,
  validateSlugFormat,
} from '../../../utils/reserved-slugs'

export function hostname(raw: string | null | undefined): string {
  const host = (raw ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (host.length > 253 || !host.includes('.') || host.split('.').some(
    label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  )) throw new Error('DOMAIN_INVALID')
  return host
}

/**
 * Derive the tenant slug from a default PW1 platform domain row
 * (`<slug>.<suffix>`), with the graceful `-store-<id>` / `store-<id>` fallback.
 * Used for single-default stores and, under gracefulTenantResolution, for the
 * source-domain-bound row of multi-default stores (#2179 item 7).
 */
export function slugFromDefaultDomain(
  row: Row,
  suffix: string,
  ctx: MappingContext,
  graceful: boolean,
): string {
  let slug = `store-${ctx.storeId}`
  let domain: string | undefined
  try { domain = hostname(row.domain) } catch {
    if (!graceful) throw new Error('DOMAIN_INVALID')
  }
  if (domain && !domain.endsWith(`.${suffix}`)) throw new Error('DEFAULT_DOMAIN_SUFFIX_MISMATCH')
  if (domain) slug = domain.slice(0, -(suffix.length + 1))
  if (validateSlugFormat(slug) || isReservedSlug(slug)) {
    if (!graceful) throw new Error('TENANT_SLUG_INVALID')
    slug = `${slug}-store-${ctx.storeId}`
    if (validateSlugFormat(slug) || isReservedSlug(slug)) slug = `store-${ctx.storeId}`
    ctx.issue('TENANT_SLUG_INVALID', 'store_domains', row.id, 'domain', 'warning', 'TENANT_SLUG_FALLBACK_APPLIED')
  }
  return slug
}
