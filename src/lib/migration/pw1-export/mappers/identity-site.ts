import { mapSocialLinks } from './social-links'
import { z } from 'zod'
import { applySitePolicy } from './site-policy'
import { globalCreatorChain } from '../user-actors'
import {
  type MappingContext,
  type Row,
  type Doc,
  ref,
  live,
} from '../contracts'
import { safeUrl, compareIds } from '../primitives'
import { hostname, slugFromDefaultDomain } from './tenant-slug-from-domain'
import {
  mainSubscription,
  membership,
  sourceTime,
  times,
} from './identity-lifecycle'

function sourceText(raw: string | null | undefined, allowContactGap = false): string {
  if (!raw) return ''
  if (!/^[\[{]/.test(raw.trim())) return raw.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    if (allowContactGap) return raw.trim()
    throw new Error('CONTACT_JSON_INVALID')
  }
  if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string'))
    return parsed[0] ?? ''
  if (typeof parsed === 'string') return parsed
  if (allowContactGap) {
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === 'string') return parsed[0]
      if (typeof parsed[0] === 'object' && parsed[0] !== null) {
        const firstVal = Object.values(parsed[0]).find((v) => typeof v === 'string')
        if (typeof firstVal === 'string') return firstVal
      }
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>
      if (typeof obj.en === 'string' && obj.en.trim()) return obj.en.trim()
      if (typeof obj.ms === 'string' && obj.ms.trim()) return obj.ms.trim()
      if (typeof obj.phone === 'string' && obj.phone.trim()) return obj.phone.trim()
      if (typeof obj.hotline === 'string' && obj.hotline.trim()) return obj.hotline.trim()
      const firstStr = Object.values(obj).find((v) => typeof v === 'string' && v.trim())
      if (typeof firstStr === 'string') return firstStr.trim()
    }
    return raw.trim()
  }
  throw new Error('CONTACT_STRUCTURE_UNRESOLVED')
}
function ownerRole(row: Row, ctx: MappingContext): boolean {
  const links = (ctx.tables.model_has_roles ?? []).filter(
    (link) =>
      link.model_type === 'App\\Models\\User' && link.model_id === row.id,
  )
  return links.some((link) => {
    const role = ctx.find('roles', link.role_id)
    return role?.name === 'owner' && role.guard_name === 'api' && live(role)
  })
}
function codEnabled(ctx: MappingContext): boolean {
  if (!ctx.tables.store_payments || !ctx.tables.payment_methods)
    throw new Error('PAYMENT_SOURCE_MISSING')
  const cod: Row[] = []
  for (const row of ctx.rows('store_payments', true).filter(live)) {
    const method = ctx.find('payment_methods', row.payment_method_id)
    if (!method || !['cod', 'stripe', 'billplz'].includes(method.code ?? '')) {
      if (!ctx.config.migrationPolicy?.omitUnmappablePayments) throw new Error('PAYMENT_PROVIDER_UNKNOWN')
      ctx.issue('SOURCE_ENTITY_EXCLUDED', 'store_payments', row.id, undefined, 'warning', 'PAYMENT_PROVIDER_UNKNOWN')
      continue
    }
    if (
      !['0', '1'].includes(row.status ?? '') ||
      !['0', '1'].includes(method.status ?? '')
    ) {
      if (!ctx.config.migrationPolicy?.omitUnmappablePayments) throw new Error('PAYMENT_STATUS_UNKNOWN')
      ctx.issue('SOURCE_ENTITY_EXCLUDED', 'store_payments', row.id, undefined, 'warning', 'PAYMENT_STATUS_UNKNOWN')
      continue
    }
    if (method.code === 'cod') cod.push(row)
    else if (ctx.config.migrationPolicy?.omitUnmappablePayments) ctx.issue('SOURCE_ENTITY_EXCLUDED', 'store_payments', row.id, undefined, 'warning', 'PAYMENT_PROVIDER_NOT_ACTIVATED')
    else ctx.issue('PAYMENT_PROVIDER_NOT_ACTIVATED', 'store_payments', row.id)
  }
  if (cod.length > 1) {
    if (!ctx.config.migrationPolicy?.omitUnmappablePayments) throw new Error('COD_CONFIGURATION_AMBIGUOUS')
    for (const row of cod) ctx.issue('SOURCE_ENTITY_EXCLUDED', 'store_payments', row.id, undefined, 'warning', 'COD_CONFIGURATION_AMBIGUOUS')
    return false
  }
  if (!cod.length) return false
  const method = ctx.find('payment_methods', cod[0].payment_method_id)!
  ctx.contribute(
    'store_payments',
    cod[0],
    ['payment_method_id', 'status', 'deleted_at'],
    'tenants[].payments.payment_cod + sites[].paymentConfig.enableCod',
    'MASTER-17-COD',
  )
  return cod[0].status === '1' && method.status === '1' && live(method)
}
function userDoc(row: Row, owner: boolean, ctx: MappingContext): Doc {
  if (!row.name?.trim()) throw new Error('USER_NAME_REQUIRED')
  const email = row.email
  if (!z.string().email().safeParse(email).success) {
    if (!ctx.config.migrationPolicy?.preserveInvalidUserEmails || typeof email !== 'string')
      throw new Error('USER_EMAIL_INVALID')
    ctx.issue('USER_EMAIL_INVALID', 'users', row.id, 'email', 'warning', 'SOURCE_EMAIL_PRESERVED')
  }
  const [firstName, ...rest] = row.name.trim().split(/\s+/)
  const readOnly = ctx.config.readOnlyUserIds?.includes(row.id!)
  const role = owner ? 'owner' : readOnly ? 'viewer' : 'editor'
  const doc: Doc = {
    _ref: ref('users', 'users', row.id!),
    email,
    firstName,
    lastName: rest.join(' '),
    phone: row.phone ?? null,
    roles: [owner ? 'tenant-owner' : role],
    tenants: [
      {
        tenant: ref('tenants', 'stores', ctx.storeId),
        role,
        status: membership(row, ctx),
        permissions: [],
      },
    ],
    prefer_lang: 'ms',
    has_seen_ai_wizard: false,
    migrationStatus: 'pending',
    otpAttempts: 0,
    ...times(row, ctx),
  }
  if (row.last_login_at) doc.lastLoginAt = sourceTime(row.last_login_at, ctx)
  if (!owner)
    ctx.issue(
      'USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED',
      'users',
      row.id,
      undefined,
      'warning',
    )
  return doc
}
/**
 * PW1 renew API (prime-web-api UserController.php:496-500) extends owner `expired_at` and the main
 * subscription but never resets `stores.status`, so a renewed store stays `2`. Treat Store=2 as
 * active only with explicit proof of renewal: active unbanned owner, future `expired_at`, active
 * main subscription. A missing `expired_at` is NOT proof (membership() treats it as active).
 */
function isStaleExpired(
  store: Row,
  owner: Row,
  ownerMembership: string,
  subscriptionStatus: unknown,
  ctx: MappingContext,
): boolean {
  if (store.status !== '2' || owner.status !== '1' || owner.banned_at || !owner.expired_at) return false
  const expiry = Date.parse(sourceTime(owner.expired_at, ctx))
  return expiry > Date.parse(ctx.config.asOf) && ownerMembership === 'active' && subscriptionStatus === 'active'
}

/** Creates Store identity atomically; invalid owner/domain/main never produces a partial Tenant. */
export function mapIdentity(ctx: MappingContext): boolean {
  const store = ctx.find('stores', ctx.storeId)
  if (!store || !live(store)) {
    ctx.issue('STORE_NOT_LIVE', 'stores', ctx.storeId)
    return false
  }
  try {
    if (!store.name?.trim()) throw new Error('STORE_NAME_REQUIRED')
    if (!ctx.tables.roles || !ctx.tables.model_has_roles)
      throw new Error('OWNER_ROLE_SOURCE_MISSING')
    const users = ctx
      .rows('users', true)
      .filter((row) => live(row) && row.is_frontend === '0')
    const owners = users.filter(
      (row) => row.is_store_owner === '1' || ownerRole(row, ctx),
    )
    const graceful = Boolean(ctx.config.migrationPolicy?.gracefulTenantResolution)
    let owner: Row
    if (ctx.config.migrationPolicy?.selectOldestOwner) {
      // Only same-tenant live backend users qualify; never resurrect a deleted account.
      const candidates = owners.length ? owners : users
      const dated = candidates.map(row => ({ row, createdAt: sourceTime(row.created_at, ctx) }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || compareIds(a.row.id!, b.row.id!))
      if (!dated.length) throw new Error('OWNER_IDENTITY_CONFLICT')
      owner = dated[0].row
      if (owners.length !== 1 || owner.is_store_owner !== '1' || !ownerRole(owner, ctx))
        ctx.issue('OWNER_IDENTITY_RESOLVED', 'users', owner.id, 'is_store_owner', 'warning', owners.length ? 'OLDEST_OWNER_SELECTED' : 'OLDEST_USER_PROMOTED')
    } else {
      if (owners.length !== 1 || owners[0].is_store_owner !== '1' || !ownerRole(owners[0], ctx))
        throw new Error('OWNER_IDENTITY_CONFLICT')
      owner = owners[0]
    }
    const ownerOutput = userDoc(owner, true, ctx)
    const subscription = mainSubscription(ctx)
    const ownerMembership = membership(owner, ctx)
    const staleExpired = graceful && isStaleExpired(store, owner, ownerMembership, subscription.doc.status, ctx)
    const hasLifecycleConflict = !staleExpired && (
      store.status !== owner.status ||
      (store.status === '2' && subscription.doc.status !== 'ended'))
    if (staleExpired) ctx.issue('TENANT_STALE_EXPIRED_STATUS', 'stores', ctx.storeId, 'status', 'warning', 'OWNER_RENEWED_ACTIVE')
    if (hasLifecycleConflict) {
      if (!graceful) throw new Error('TENANT_LIFECYCLE_CONFLICT')
      ctx.issue('TENANT_LIFECYCLE_CONFLICT', 'stores', ctx.storeId, 'status', 'warning', 'SAFE_HOLD_APPLIED')
    }
    const domains = ctx.rows('store_domains', true).filter(live)
    const defaults = domains.filter((row) => row.is_default === '1')
    // Source Site domain selection is independent of tenant slug fallback and custom domains.
    const boundDomainId = ctx.config.sourceDomainBindings?.[ctx.storeId]
    const selectedSiteDomain = boundDomainId ? domains.find(row => row.id === boundDomainId && row.is_default === '1') : defaults.length === 1 ? defaults[0] : undefined
    if (!selectedSiteDomain) throw new Error(boundDomainId ? 'SOURCE_DOMAIN_BINDING_INVALID' : 'SOURCE_SITE_DOMAIN_SELECTION_REQUIRED')
    if (!selectedSiteDomain.domain?.trim()) throw new Error('SOURCE_SITE_DOMAIN_EMPTY')
    try { hostname(selectedSiteDomain.domain) } catch {
      if (!graceful) throw new Error('DOMAIN_INVALID')
      ctx.issue('SOURCE_SITE_DOMAIN_FORMAT_PRESERVED', 'store_domains', selectedSiteDomain.id, 'domain', 'warning', 'ORIGINAL_PW1_VALUE')
    }
    const suffix = hostname(ctx.config.sourcePlatformSuffix)
    let slug: string
    if (defaults.length === 1) {
      slug = slugFromDefaultDomain(defaults[0], suffix, ctx, graceful)
    } else {
      if (!graceful) throw new Error('DEFAULT_DOMAIN_AMBIGUOUS')
      // Overrides master 1.10.5 (binding does not change slug fallback): slug follows the bound
      // domain. See docs/migration/pw1-stale-expired-status-and-bound-slug-20261102.md.
      slug = slugFromDefaultDomain(selectedSiteDomain, suffix, ctx, graceful)
      ctx.issue('DEFAULT_DOMAIN_AMBIGUOUS', 'stores', ctx.storeId, undefined, 'warning', 'SOURCE_DOMAIN_BINDING_APPLIED')
    }
    const customDomains: Doc[] = []
    const seenDomains = new Set<string>()
    for (const row of domains) {
      let host: string
      try { host = hostname(row.domain) } catch {
        if (!graceful) throw new Error('DOMAIN_INVALID')
        ctx.issue('DOMAIN_INVALID', 'store_domains', row.id, 'domain', 'warning', 'INVALID_CUSTOM_DOMAIN_EXCLUDED')
        continue
      }
      if (seenDomains.has(host)) throw new Error('DOMAIN_DUPLICATE')
      seenDomains.add(host)
      if (host === suffix || host.endsWith(`.${suffix}`)) continue
      customDomains.push({ domain: host, status: 'pending', isPrimary: false })
    }
    if (domains.filter((row) => row.is_main === '1').length !== 1)
      ctx.issue('SOURCE_MAIN_DOMAIN_AMBIGUOUS', 'stores', ctx.storeId, undefined, graceful ? 'warning' : 'blocker', graceful ? 'CUSTOM_DOMAINS_PENDING' : undefined)
    const sourceCod = codEnabled(ctx),
      tenantRef = ref('tenants', 'stores', ctx.storeId)
    const contact: Record<string, string | null> = {}
    const allowContactGap = ctx.config.migrationPolicy?.allowContactStructureGap === true
    for (const field of ['hotline', 'address']) {
      try {
        contact[field] = sourceText(store[field], allowContactGap)
      } catch {
        contact[field] = null
        const severity = allowContactGap ? 'warning' : 'blocker'
        ctx.issue('CONTACT_STRUCTURE_UNRESOLVED', 'stores', ctx.storeId, field, severity)
      }
    }
    const contactPhone = contact.hotline,
      address = contact.address
    const tenantStatus = (hasLifecycleConflict || !(store.status === '1' || staleExpired) || ownerMembership !== 'active') ? 'suspended' : 'active'
    const cod = sourceCod && tenantStatus === 'active'
    const tenant: Doc = {
      _ref: tenantRef,
      name: store.name.trim(),
      slug,
      status: tenantStatus,
      plan: subscription.tier,
      metaData: { pw1StoreId: ctx.storeId },
      migrationStatus: 'pending',
      onboardingCompleted: false,
      settings: {
        allowedWebsites: 1,
        storageUsed: 0,
        storageLimitBytes: 0,
        dashboardPreferences: {},
      },
      previousSlugs: [],
      customDomains,
      ...(contactPhone === null ? {} : { whatsappNumber: contactPhone }),
      ...(address === null ? {} : { businessAddress: address }),
      payments: {
        payment_cod: cod,
        payment_card: false,
        payment_fpx: false,
        payment_qr: false,
      },
      ...times(store, ctx),
    }
    const site: Doc = {
      _ref: ref('sites', 'stores', ctx.storeId),
      tenant: tenantRef,
      name: store.name.trim(),
      status: 'draft',
      generationStatus: 'none',
      siteType: 'ecommerce',
      locale: 'ms',
      generationLocale: 'ms',
      domain: selectedSiteDomain.domain,
      seo: {
        metaTitle: store.name.trim(),
        metaDescription: store.description ?? '',
      },
      branding: {},
      contactInfo: {
        ...(contactPhone === null ? {} : { phone: contactPhone }),
        email: store.email ?? '',
        ...(address === null ? {} : { address }),
      },
      socialLinks: mapSocialLinks(ctx, store),
      paymentConfig: {
        enableCod: cod,
        enableQrBanking: false,
        cardEnabled: false,
        fpxEnabled: false,
      },
    }
    for (const field of ['logo', 'favicon'])
      if (store[field]) {
        try {
          ;(site.branding as Doc)[field] = safeUrl(store[field]!)
        } catch {
          ctx.issue('STORE_MEDIA_URL_UNSAFE', 'stores', ctx.storeId, field)
        }
      }
    applySitePolicy(ctx, site)
    ctx.output.tenants.push(tenant)
    ctx.output.sites.push(site)
    ctx.output.users.push(ownerOutput)
    ctx.output['plan-subscriptions'].push(subscription.doc)
    ctx.contribute(
      'stores',
      store,
      [
        'id',
        'name',
        'status',
        ...(contactPhone === null ? [] : ['hotline']),
        ...(address === null ? [] : ['address']),
        'description',
        'email',
        'logo',
        'favicon',
        'created_at',
        'updated_at',
      ],
      'tenants[] + sites[]',
      'MASTER-3.1-4.1',
    )
    const slugRow = defaults.length === 1 ? defaults[0] : graceful ? selectedSiteDomain : undefined
    if (slugRow) ctx.contribute(
      'store_domains',
      slugRow,
      ['domain', 'is_default', 'deleted_at'],
      'tenants[].slug',
      'MASTER-3.1-DOMAIN',
    )
    ctx.contribute('store_domains', selectedSiteDomain, ['id', 'store_id', 'domain', 'is_default', 'deleted_at'].filter(field => Object.hasOwn(selectedSiteDomain, field)), 'sites[].domain', 'MASTER-4.1-SOURCE-SITE-DOMAIN')
    ctx.contribute(
      'plan_subscriptions',
      subscription.row,
      [
        'id',
        'name',
        'plan_id',
        'subscribable_type',
        'subscribable_id',
        'starts_at',
        'ends_at',
        'canceled_at',
        'canceled_immediately',
        'created_at',
        'updated_at',
      ],
      'plan-subscriptions[]',
      'MASTER-9.1',
    )
    ctx.contribute(
      'plans',
      subscription.plan,
      ['code'],
      'tenants[].plan + plan-subscriptions[].plan',
      'MASTER-9.1-PLAN',
    )
    for (const row of users) {
      for (const link of (ctx.tables.model_has_roles ?? []).filter(
        (link) =>
          link.model_type === 'App\\Models\\User' && link.model_id === row.id,
      )) {
        ctx.contribute(
          'model_has_roles',
          link,
          ['model_type', 'model_id', 'role_id'],
          'users[].roles',
          'MASTER-3.4-ROLE',
        )
        const role = ctx.find('roles', link.role_id)
        if (role)
          ctx.contribute(
            'roles',
            role,
            ['name', 'guard_name'],
            'users[].roles',
            'MASTER-3.4-ROLE',
          )
      }
      if (row.id !== owner.id) {
        try {
          if (row.is_store_owner !== '0' || ownerRole(row, ctx)) {
            if (!ctx.config.migrationPolicy?.selectOldestOwner) throw new Error('USER_OWNER_FLAG_CONFLICT')
            if (!ctx.config.readOnlyUserIds?.includes(row.id!)) ctx.issue('OWNER_SECONDARY_MAPPED_EDITOR', 'users', row.id, 'is_store_owner', 'warning', 'PRIMARY_OWNER_SELECTED')
          }
          ctx.output.users.push(userDoc(row, false, ctx))
        } catch (error) {
          ctx.issue(
            error instanceof Error ? error.message : 'USER_MAPPING_FAILED',
            'users',
            row.id,
          )
          continue
        }
      }
      ctx.contribute(
        'users',
        row,
        [
          'id',
          'store_id',
          'name',
          'email',
          'phone',
          'is_store_owner',
          'is_frontend',
          'status',
          'banned_at',
          'expired_at',
          'created_at',
          'updated_at',
          'last_login_at',
        ],
        ref('users', 'users', row.id!),
        'MASTER-3.2-3.4',
      )
    }
    for (const row of users)
      if (row.created_by && row.created_by !== '0') {
        const output = ctx.output.users.find(
          (doc) => doc._ref === ref('users', 'users', row.id!),
        )
        if (!output) continue
        if (
          ctx.output.users.some(
            (doc) => doc._ref === ref('users', 'users', row.created_by!),
          )
        ) {
          output.createdBy = ref('users', 'users', row.created_by)
          ctx.contribute(
            'users',
            row,
            ['created_by'],
            ref('users', 'users', row.id!),
            'MASTER-3.4-CREATOR',
          )
        } else if (ctx.config.migrationPolicy?.preserveUserCreators && globalCreatorChain(ctx, row.created_by)) {
          output.createdBy = ref('users', 'users', row.created_by)
          ctx.contribute('users', row, ['created_by'], ref('users', 'users', row.id!), 'MASTER-3.4-CREATOR-DEPENDENCY')
          ctx.issue('TARGET_USER_CREATOR_BINDING_REQUIRED', 'users', row.id, 'created_by')
        } else ctx.issue('USER_CREATOR_UNRESOLVED', 'users', row.id, 'created_by')
      }
    return true
  } catch (error) {
    ctx.issue(
      error instanceof Error ? error.message : 'IDENTITY_MAPPING_FAILED',
      'stores',
      ctx.storeId,
    )
    return false
  }
}
