import { applySitePolicy } from './site-policy'
import { globalCreatorChain } from '../user-actors'
import {
  type MappingContext,
  type Row,
  type Doc,
  ref,
  live,
} from '../contracts'
import { safeUrl } from '../primitives'
import {
  isReservedSlug,
  validateSlugFormat,
} from '../../../utils/reserved-slugs'
import {
  mainSubscription,
  membership,
  sourceTime,
  times,
} from './identity-lifecycle'

function hostname(raw: string | null | undefined): string {
  const host = (raw ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (
    host.length > 253 ||
    !host.includes('.') ||
    host
      .split('.')
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new Error('DOMAIN_INVALID')
  return host
}
function sourceText(raw: string | null | undefined): string {
  if (!raw) return ''
  if (!/^[\[{]/.test(raw.trim())) return raw.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('CONTACT_JSON_INVALID')
  }
  if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string'))
    return parsed[0] ?? ''
  if (typeof parsed === 'string') return parsed
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
    if (!method || !['cod', 'stripe', 'billplz'].includes(method.code ?? ''))
      throw new Error('PAYMENT_PROVIDER_UNKNOWN')
    if (
      !['0', '1'].includes(row.status ?? '') ||
      !['0', '1'].includes(method.status ?? '')
    )
      throw new Error('PAYMENT_STATUS_UNKNOWN')
    if (method.code === 'cod') cod.push(row)
    else ctx.issue('PAYMENT_PROVIDER_NOT_ACTIVATED', 'store_payments', row.id)
  }
  if (cod.length > 1) throw new Error('COD_CONFIGURATION_AMBIGUOUS')
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
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
    throw new Error('USER_EMAIL_INVALID')
  const [firstName, ...rest] = row.name.trim().split(/\s+/)
  const readOnly = ctx.config.readOnlyUserIds?.includes(row.id!)
  const role = owner ? 'owner' : readOnly ? 'viewer' : 'editor'
  const doc: Doc = {
    _ref: ref('users', 'users', row.id!),
    email: row.email,
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
    if (
      owners.length !== 1 ||
      owners[0].is_store_owner !== '1' ||
      !ownerRole(owners[0], ctx)
    )
      throw new Error('OWNER_IDENTITY_CONFLICT')
    const owner = owners[0],
      ownerOutput = userDoc(owner, true, ctx)
    if (store.status !== owner.status)
      throw new Error('TENANT_LIFECYCLE_CONFLICT')
    const subscription = mainSubscription(ctx)
    if (store.status === '2' && subscription.doc.status !== 'ended')
      throw new Error('TENANT_LIFECYCLE_CONFLICT')
    const domains = ctx.rows('store_domains', true).filter(live)
    const defaults = domains.filter((row) => row.is_default === '1')
    if (defaults.length !== 1) throw new Error('DEFAULT_DOMAIN_AMBIGUOUS')
    const domain = hostname(defaults[0].domain),
      suffix = hostname(ctx.config.sourcePlatformSuffix)
    if (!domain.endsWith(`.${suffix}`))
      throw new Error('DEFAULT_DOMAIN_SUFFIX_MISMATCH')
    const slug = domain.slice(0, -(suffix.length + 1))
    if (validateSlugFormat(slug) || isReservedSlug(slug))
      throw new Error('TENANT_SLUG_INVALID')
    const customDomains: Doc[] = []
    const seenDomains = new Set<string>()
    for (const row of domains) {
      const host = hostname(row.domain)
      if (seenDomains.has(host)) throw new Error('DOMAIN_DUPLICATE')
      seenDomains.add(host)
      if (host === suffix || host.endsWith(`.${suffix}`)) continue
      customDomains.push({ domain: host, status: 'pending', isPrimary: false })
    }
    if (domains.filter((row) => row.is_main === '1').length !== 1)
      ctx.issue('SOURCE_MAIN_DOMAIN_AMBIGUOUS', 'store_domains', ctx.storeId)
    const cod = codEnabled(ctx),
      tenantRef = ref('tenants', 'stores', ctx.storeId)
    const contact: Record<string, string | null> = {}
    for (const field of ['hotline', 'address']) {
      try {
        contact[field] = sourceText(store[field])
      } catch {
        contact[field] = null
        ctx.issue('CONTACT_STRUCTURE_UNRESOLVED', 'stores', ctx.storeId, field)
      }
    }
    const contactPhone = contact.hotline,
      address = contact.address
    const tenant: Doc = {
      _ref: tenantRef,
      name: store.name.trim(),
      slug,
      status: owner.status === '1' ? 'active' : 'suspended',
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
      domain: `${slug}.${hostname(ctx.config.targetPlatformSuffix)}`,
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
      socialLinks: {},
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
    ctx.contribute(
      'store_domains',
      defaults[0],
      ['domain', 'is_default', 'deleted_at'],
      'tenants[].slug + sites[].domain',
      'MASTER-3.1-DOMAIN',
    )
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
          if (row.is_store_owner !== '0' || ownerRole(row, ctx))
            throw new Error('USER_OWNER_FLAG_CONFLICT')
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
