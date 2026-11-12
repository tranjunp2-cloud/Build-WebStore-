import { describe, expect, it } from 'vitest'
import {
  emptyStore,
  type MappingContext,
  type Row,
} from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema, validateMigrationPolicyScope } from '@/lib/migration/pw1-export/source-config'
import { operationalIssues } from '@/lib/migration/pw1-export/validate-master'
import { mapIdentity } from '@/lib/migration/pw1-export/mappers/identity-site'
import { createDiagnosticCollector } from '@/lib/migration/pw1-json/diagnostics'
import { SOURCE_DOMAIN_MAPPING_HASH } from '@/lib/migration/pw1-json/classification'
import { mapEntitlements } from '@/lib/migration/pw1-export/mappers/entitlements'
const dates = {
  created_at: '2025-01-01 00:00:00',
  updated_at: '2025-01-02 00:00:00',
}
function fixture(): MappingContext {
  const tables: Record<string, Row[]> = {
    stores: [{ id: '10', name: 'Example', status: '1', ...dates }],
    users: [
      {
        id: '20',
        store_id: '10',
        name: 'Owner Example',
        email: 'owner@example.test',
        status: '1',
        is_store_owner: '1',
        is_frontend: '0',
        ...dates,
      },
      {
        id: '21',
        store_id: '10',
        name: 'A',
        email: 'staff@example.test',
        status: '1',
        is_store_owner: '0',
        is_frontend: '0',
        ...dates,
      },
    ],
    roles: [{ id: '30', name: 'owner', guard_name: 'api' }],
    model_has_roles: [
      { model_type: 'App\\Models\\User', model_id: '20', role_id: '30' },
    ],
    store_domains: [
      {
        id: '40',
        store_id: '10',
        domain: 'example-2.old.test',
        is_default: '1',
        is_main: '1',
      },
    ],
    store_payments: [
      {
        id: '50',
        store_id: '10',
        payment_method_id: '99',
        status: '1',
        is_production: '0',
        is_default: '0',
      },
    ],
    payment_methods: [{ id: '99', code: 'cod', status: '1' }],
    plans: [{ id: '60', code: 'STANDARD_TM_USER' }],
    plan_subscriptions: [
      {
        id: '70',
        subscribable_type: 'App\\Models\\Store',
        subscribable_id: '10',
        name: 'main',
        plan_id: '60',
        starts_at: '2025-01-01 00:00:00',
        ends_at: '2027-01-01 00:00:00',
        canceled_immediately: '0',
        ...dates,
      },
    ],
    plan_subscription_usages: [
      {
        id: '80',
        subscription_id: '70',
        code: 'staff_limit',
        used: '1',
        valid_until: null,
        ...dates,
      },
    ],
    plan_features: [{ id: '90', plan_id: '60', code: 'staff_limit' }],
  }
  const ctx: MappingContext = {
    config: sourceConfigSchema.parse({
      version: 1,
      sourceInstance: 'test',
      sourceDatabase: 'test',
      sourceInstanceToken: 'test',
      snapshotId: 'one',
      asOf: '2026-01-01T00:00:00Z',
      utcOffset: '+00:00',
      sourcePlatformSuffix: 'old.test',
      targetPlatformSuffix: 'new.test',
      tables: { stores: 'stores.csv' },
      deletedStores: 'review',
    }),
    tables,
    storeId: '10',
    output: emptyStore(),
    diagnostics: [],
    contributions: [],
    rows(table) {
      return tables[table]?.filter((row) => row.store_id === '10') ?? []
    },
    find(table, id) {
      return tables[table]?.find((row) => row.id === id)
    },
    issue(code, table, sourceId, field, severity = 'blocker', reason) {
      ctx.diagnostics.push({
        code,
        table,
        sourceId: sourceId ?? undefined,
        field,
        severity,
        ...(reason ? { reason } : {}),
      })
    },
    contribute(table, row, fields, targetPath, rule) {
      ctx.contributions.push({
        table,
        sourceId: row.id ?? '',
        fields,
        targetPath,
        rule,
      })
    },
  }
  return ctx
}
describe('PW1 identity master rules', () => {
  it('TC-F42-EXP-007/008: keeps legacy slug and enables COD by code despite sandbox/non-default', () => {
    const ctx = fixture()
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.tenants[0].slug).toBe('example-2')
    expect(ctx.output.sites[0].domain).toBe('example-2.old.test')
    expect(ctx.output.tenants[0].payments).toMatchObject({ payment_cod: true })
    expect(ctx.output.sites[0].paymentConfig).toMatchObject({
      enableCod: true,
      cardEnabled: false,
    })
  })
  it('TC-F42-EXP-009: unknown staff permission defaults editor and explicit read-only takes priority', () => {
    const ctx = fixture()
    ctx.config.readOnlyUserIds = ['21']
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.users[1]).toMatchObject({
      firstName: 'A',
      lastName: '',
      roles: ['viewer'],
      tenants: [{ role: 'viewer', status: 'active', permissions: [] }],
    })
    const next = fixture()
    mapIdentity(next)
    expect(next.output.users[1].roles).toEqual(['editor'])
  })
  it('TC-F42-EXP-018: staff ban does not suspend active Tenant; lifecycle mismatch blocks whole Store', () => {
    const ctx = fixture()
    Object.assign(ctx.tables.users[1], {
      status: '3',
      banned_at: '2025-12-01 00:00:00',
    })
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.tenants[0].status).toBe('active')
    expect(ctx.output.users[1].tenants).toMatchObject([{ status: 'suspended' }])
    const bad = fixture()
    bad.tables.stores[0].status = '2'
    expect(mapIdentity(bad)).toBe(false)
    expect(bad.output.tenants).toEqual([])
  })
  it('TC-F42-EXP-018: consistent inactive and ended lifecycle become suspended', () => {
    for (const status of ['0', '2']) {
      const ctx = fixture()
      ctx.tables.stores[0].status = status
      ctx.tables.users[0].status = status
      if (status === '2') {
        ctx.tables.users[0].expired_at = '2025-12-01 00:00:00'
        ctx.tables.plan_subscriptions[0].ends_at = '2025-12-01 00:00:00'
      }
      expect(mapIdentity(ctx)).toBe(true)
      expect(ctx.output.tenants[0].status).toBe('suspended')
    expect(ctx.output.tenants[0].payments).toMatchObject({ payment_cod: false })
    expect(ctx.output.sites[0].paymentConfig).toMatchObject({ enableCod: false })
    }
  })
  it('TC-F42-EXP-018: trial beyond expired main blocks instead of extending dates', () => {
    const ctx = fixture()
    Object.assign(ctx.tables.plan_subscriptions[0], {
      ends_at: '2025-12-01 00:00:00',
      trial_ends_at: '2026-02-01 00:00:00',
    })
    expect(mapIdentity(ctx)).toBe(false)
    expect(ctx.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'SUBSCRIPTION_TRIAL_PARITY' }),
    )
  })
  it('TC-F42-EXP-008: duplicate COD cannot silently choose first', () => {
    const ctx = fixture()
    ctx.tables.store_payments.push({
      ...ctx.tables.store_payments[0],
      id: '51',
    })
    expect(mapIdentity(ctx)).toBe(false)
    expect(ctx.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'COD_CONFIGURATION_AMBIGUOUS' }),
    )
  })
  it('TC-F42-EXP-009: blank staff name is quarantined without email fallback and creator never becomes owner', () => {
    const ctx = fixture()
    ctx.tables.users[1].name = '  '
    ctx.tables.stores[0].created_by = '21'
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.users).toHaveLength(1)
    expect(ctx.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'USER_NAME_REQUIRED' }),
    )
  })
  it('TC-F42-EXP-007: rejects ambiguous defaults and preserves custom domains pending', () => {
    const ctx = fixture()
    ctx.tables.store_domains.push({
      id: '41',
      store_id: '10',
      domain: 'Custom.Example.test.',
      is_default: '0',
      is_main: '0',
    })
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.tenants[0].customDomains).toEqual([
      { domain: 'custom.example.test', status: 'pending', isPrimary: false },
    ])
    const bad = fixture()
    bad.tables.store_domains.push({ ...bad.tables.store_domains[0], id: '42' })
    expect(mapIdentity(bad)).toBe(false)
  })
  it('TC-F42-EXP-018: end-of-period cancellation preserves active and dates with a parity gap', () => {
    const ctx = fixture()
    ctx.tables.plan_subscriptions[0].canceled_at = '2025-12-01 00:00:00'
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output['plan-subscriptions'][0]).toMatchObject({
      status: 'active',
      canceledImmediately: false,
      canceledAt: '2025-12-01T00:00:00.000Z',
    })
    expect(ctx.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'SUBSCRIPTION_ROUTE_PARITY' }),
    )
  })
  it('TC-F42-EXP-009: unknown optional address does not discard valid Store identity', () => {
    const ctx = fixture()
    ctx.tables.stores[0].address = JSON.stringify({ unverified: 'structure' })
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.tenants[0]).not.toHaveProperty('businessAddress')
    expect(ctx.output.sites[0]).not.toHaveProperty('slug')
    expect(ctx.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'CONTACT_STRUCTURE_UNRESOLVED',
        field: 'address',
      }),
    )
  })
  it('TC-F42-EXP-018: usages preserve exact count and null expiry with matching feature', () => {
    const ctx = fixture()
    mapIdentity(ctx)
    mapEntitlements(ctx)
    expect(ctx.output['plan-subscription-usages'][0]).toMatchObject({
      used: 1,
      validUntil: null,
      subscription: '@plan-subscriptions:plan_subscriptions:70',
    })
  })
  it('TC-F42-EXP-018: absent cancellation flag/date preserves active or ended without inventing false', () => {
    for (const [endsAt, expectedStatus] of [['2027-01-01 00:00:00', 'active'], ['2025-12-01 00:00:00', 'ended']]) {
      const ctx = fixture()
      Object.assign(ctx.tables.plan_subscriptions[0], { canceled_immediately: '', canceled_at: '', ends_at: endsAt })
      expect(mapIdentity(ctx)).toBe(true)
      expect(ctx.output['plan-subscriptions'][0].status).toBe(expectedStatus)
      expect(ctx.output['plan-subscriptions'][0]).not.toHaveProperty('canceledImmediately')
      expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SUBSCRIPTION_CANCEL_FLAG_ABSENT', severity: 'warning', reason: 'NO_CANCELLATION_DATE' }))
    }
  })
  it('TC-F42-EXP-018: cancellation date with absent flag remains ambiguous; true without date conflicts', () => {
    const ambiguous = fixture()
    Object.assign(ambiguous.tables.plan_subscriptions[0], { canceled_immediately: '', canceled_at: '2025-12-01 00:00:00' })
    expect(mapIdentity(ambiguous)).toBe(false)
    expect(ambiguous.diagnostics).toContainEqual(expect.objectContaining({ code: 'SUBSCRIPTION_CANCEL_FLAG_UNKNOWN' }))
    const contradictory = fixture()
    contradictory.tables.plan_subscriptions[0].canceled_immediately = '1'
    expect(mapIdentity(contradictory)).toBe(false)
    expect(contradictory.diagnostics).toContainEqual(expect.objectContaining({ code: 'SUBSCRIPTION_TIME_CONFLICT' }))
  })

  it('TC-F42-EXP-009: resolved creator has field provenance; external actor grants no membership', () => {
    const ctx = fixture()
    ctx.tables.users[1].created_by = '20'
    ctx.tables.users[0].created_by = '100'
    ctx.tables.users.push({ id: '100', store_id: '99', name: 'External actor', ...dates })

    expect(mapIdentity(ctx)).toBe(true)

    expect(ctx.output.users).toHaveLength(2)
    expect(ctx.output.users[1].createdBy).toBe('@users:users:20')
    expect(ctx.output.users[0]).not.toHaveProperty('createdBy')
    expect(ctx.contributions).toContainEqual(expect.objectContaining({
      table: 'users', sourceId: '21', fields: ['created_by'],
      targetPath: '@users:users:21', rule: 'MASTER-3.4-CREATOR',
    }))
    expect(ctx.contributions).not.toContainEqual(expect.objectContaining({
      sourceId: '20', fields: ['created_by'],
    }))
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({
      code: 'USER_CREATOR_UNRESOLVED', sourceId: '20', severity: 'blocker',
    }))
  })

  it('TC-F42-EXP-022: gracefulTenantResolution resolves future subscription start without error', () => {
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Test graceful resolution',
      activeCatalogOnly: false,
      deferEmailTemplates: false,
      allowSparseVariants: false,
      preserveUserCreators: false,
      gracefulTenantResolution: true,
      siteTypeDefault: 'ecommerce',
      siteTypeOverrides: {},
      shippingPolicy: 'pw2-defaults',
    }
    // Gói cước bắt đầu ở tương lai
    ctx.tables.plan_subscriptions[0].starts_at = '2026-06-01 00:00:00'
    ctx.tables.plan_subscriptions[0].ends_at = '2027-06-01 00:00:00'
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output['plan-subscriptions'][0].status).toBe('active')
    expect(ctx.output.tenants[0].status).toBe('active')
  })

  it('TC-F42-EXP-023: gracefulTenantResolution resolves tenant lifecycle conflict to suspended', () => {
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Test graceful resolution',
      activeCatalogOnly: false,
      deferEmailTemplates: false,
      allowSparseVariants: false,
      preserveUserCreators: false,
      gracefulTenantResolution: true,
      siteTypeDefault: 'ecommerce',
      siteTypeOverrides: {},
      shippingPolicy: 'pw2-defaults',
    }
    // Store status = 2 nhưng owner status = 1 (mâu thuẫn vòng đời)
    ctx.tables.stores[0].status = '2'
    ctx.tables.users[0].status = '1'
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.tenants[0].status).toBe('suspended')
    expect(ctx.output.tenants[0].payments).toMatchObject({ payment_cod: false })
    expect(ctx.output.sites[0].paymentConfig).toMatchObject({ enableCod: false })
  })

  it('TC-F42-EXP-024: gracefulTenantResolution keeps invalid email blocked', () => {
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Test graceful resolution',
      activeCatalogOnly: false,
      deferEmailTemplates: false,
      allowSparseVariants: false,
      preserveUserCreators: false,
      gracefulTenantResolution: true,
      siteTypeDefault: 'ecommerce',
      siteTypeOverrides: {},
      shippingPolicy: 'pw2-defaults',
    }
    ctx.tables.users[0].email = 'invalid-email-no-domain'
    ctx.tables.store_domains[0].domain = 'admin.old.test' // 'admin' is reserved
    expect(mapIdentity(ctx)).toBe(false)
    expect(ctx.output.tenants).toHaveLength(0)
    expect(ctx.diagnostics.some(d => d.code === 'USER_EMAIL_INVALID')).toBe(true)
  })

  it('TC-F42-EXP-025: gracefulTenantResolution blocks missing live owner without verified binding', () => {
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Test graceful resolution',
      activeCatalogOnly: false,
      deferEmailTemplates: false,
      allowSparseVariants: false,
      preserveUserCreators: false,
      gracefulTenantResolution: true,
      siteTypeDefault: 'ecommerce',
      siteTypeOverrides: {},
      shippingPolicy: 'pw2-defaults',
    }
    // Owner is deleted (deleted_at is set)
    ctx.tables.users[0].deleted_at = '2025-01-27 11:05:33'
    expect(mapIdentity(ctx)).toBe(false)
    expect(ctx.output.tenants).toHaveLength(0)
    expect(ctx.diagnostics.some(d => d.code === 'OWNER_IDENTITY_CONFLICT' && d.severity === 'blocker')).toBe(true)
  })

  it('TC-F42-EXP-026: gracefulTenantResolution preserves invalid source Site domain and excludes it from custom domains', () => {
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Test graceful resolution',
      activeCatalogOnly: false,
      deferEmailTemplates: false,
      allowSparseVariants: false,
      preserveUserCreators: false,
      gracefulTenantResolution: true,
      siteTypeDefault: 'ecommerce',
      siteTypeOverrides: {},
      shippingPolicy: 'pw2-defaults',
    }
    // Subdomain label with 64 characters (Store 2330 case)
    const label64 = 'koperasi-pembangunan-tanah-pergaulan-anak-negeri-sandakan-sabah-berhad'
    ctx.tables.store_domains[0].domain = `${label64}.old.test`
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.tenants).toHaveLength(1)
    expect(ctx.output.tenants[0].slug).toBe('store-10')
    expect(ctx.output.sites[0].domain).toBe(`${label64}.old.test`)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SOURCE_SITE_DOMAIN_FORMAT_PRESERVED', severity: 'warning', reason: 'ORIGINAL_PW1_VALUE' }))
    expect(ctx.output.tenants[0].customDomains).toEqual([])
  })
})

describe('TC-F42-EXP-103: explicit owner and email policy', () => {
  function approved() {
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Approved owner/email decision', activeCatalogOnly: false,
      deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false,
      siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults',
      selectOldestOwner: true, preserveInvalidUserEmails: true,
    }
    return ctx
  }

  it.each([false, true])('selects oldest owner regardless of source order (reverse=%s)', reverse => {
    // Arrange
    const ctx = approved()
    ctx.tables.users[1].is_store_owner = '1'
    ctx.tables.users[1].created_at = '2024-01-01 00:00:00'
    if (reverse) ctx.tables.users.reverse()
    ctx.config.sourceDomainBindings = { '10': '40' }
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(true)
    expect(ctx.output.users.find(u => u.roles?.includes('tenant-owner'))?._ref).toBe('@users:users:21')
    expect(ctx.output.users.find(u => u._ref === '@users:users:20')?.roles).toEqual(['editor'])
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'OWNER_SECONDARY_MAPPED_EDITOR', sourceId: '20', severity: 'warning', reason: 'PRIMARY_OWNER_SELECTED' }))
  })

  it.each([false, true])('TC-F42-EXP-109: secondary owner editor proof excludes readOnly=%s', readOnly => {
    // Arrange
    const ctx = approved()
    ctx.tables.users[1].is_store_owner = '1'
    ctx.tables.users[1].created_at = '2026-01-01 00:00:00'
    if (readOnly) ctx.config.readOnlyUserIds = ['21']
    // Act
    expect(mapIdentity(ctx)).toBe(true)
    const user = ctx.output.users.find(doc => doc._ref === '@users:users:21')!
    // Assert
    expect(user.roles).toEqual([readOnly ? 'viewer' : 'editor'])
    expect(user.tenants).toEqual([expect.objectContaining({ role: readOnly ? 'viewer' : 'editor', permissions: [] })])
    expect(ctx.diagnostics.some(d => d.code === 'OWNER_SECONDARY_MAPPED_EDITOR' && d.sourceId === '21')).toBe(!readOnly)
    expect(ctx.diagnostics.some(d => d.code === 'USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED' && d.sourceId === '21')).toBe(true)
  })

  it('uses numeric ID for tied timestamps when promoting backend staff', () => {
    // Arrange
    const ctx = approved()
    ctx.tables.model_has_roles = []
    ctx.tables.users[0].is_store_owner = '0'
    ctx.tables.users[0].id = '100'
    ctx.tables.users[1].id = '9'
    // Act
    expect(mapIdentity(ctx)).toBe(true)
    // Assert
    expect(ctx.output.users.find(u => u.roles?.includes('tenant-owner'))?._ref).toBe('@users:users:9')
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'OWNER_IDENTITY_RESOLVED', sourceId: '9', reason: 'OLDEST_USER_PROMOTED' }))
  })

  it('does not promote frontend, deleted or foreign users', () => {
    // Arrange
    const ctx = approved()
    ctx.tables.users[0].deleted_at = '2025-01-03 00:00:00'
    ctx.tables.users[1].is_frontend = '1'
    ctx.tables.users.push({ ...ctx.tables.users[1], id: '1', is_frontend: '0', store_id: '99' })
    ctx.config.sourceDomainBindings = { '10': '40' }
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(false)
    expect(ctx.output.users).toHaveLength(0)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'OWNER_IDENTITY_CONFLICT', severity: 'blocker' }))
  })

  it('preserves malformed email exactly with warning', () => {
    // Arrange
    const ctx = approved()
    ctx.tables.users[0].email = ' Invalid SOURCE Email '
    // Act
    expect(mapIdentity(ctx)).toBe(true)
    // Assert
    expect(ctx.output.users[0].email).toBe(' Invalid SOURCE Email ')
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'USER_EMAIL_INVALID', field: 'email', severity: 'warning', reason: 'SOURCE_EMAIL_PRESERVED' }))
  })

  it('does not invent a missing email', () => {
    // Arrange
    const ctx = approved()
    ctx.tables.users[0].email = null
    ctx.config.sourceDomainBindings = { '10': '40' }
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(false)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'USER_EMAIL_INVALID', severity: 'blocker' }))
  })

  it('fails safely when candidate creation timestamp is missing', () => {
    // Arrange
    const ctx = approved()
    ctx.tables.users[0].created_at = null
    ctx.config.sourceDomainBindings = { '10': '40' }
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(false)
    expect(ctx.output.users).toHaveLength(0)
  })
})

describe('TC-F42-EXP-108: aggregate domain diagnostic ownership', () => {
  it('identifies the Store when an unrelated domain has the same numeric ID', () => {
    // Arrange
    const ctx = fixture()
    ctx.config.migrationPolicy = {
      decisionEvidence: 'Approved aggregate domain fallback', activeCatalogOnly: false,
      deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false,
      gracefulTenantResolution: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults',
    }
    ctx.tables.store_domains.push(
      { id: '41', store_id: '10', domain: 'second.old.test', is_default: '1', is_main: '1' },
      { id: '10', store_id: '99', domain: 'unrelated.old.test', is_default: '1', is_main: '1' },
    )
    ctx.config.sourceDomainBindings = { '10': '40' }
    // Act
    const mapped = mapIdentity(ctx)
    const warnings = ctx.diagnostics.filter(d => ['DEFAULT_DOMAIN_AMBIGUOUS', 'SOURCE_MAIN_DOMAIN_AMBIGUOUS'].includes(d.code))
    // Assert
    expect(mapped).toBe(true)
    expect(warnings).toHaveLength(2)
    for (const diagnostic of warnings) expect(diagnostic).toMatchObject({ table: 'stores', sourceId: ctx.storeId, severity: 'warning' })
    expect(warnings.find(d => d.code === 'DEFAULT_DOMAIN_AMBIGUOUS')?.reason).toBe('SOURCE_DOMAIN_BINDING_APPLIED')
    // Slug follows the bound row 40 (example-2.old.test), not the store-<id> fallback (#2179 item 7).
    expect(ctx.output.tenants[0].slug).toBe('example-2')
    expect(ctx.output.tenants[0].customDomains).toEqual([])
  })
})


describe('TC-F42-EXP-113: preserve PW1 Site domain independently of slug', () => {
  it('preserves exact source case/text even when the tenant slug needs a fallback', () => {
    // Arrange
    const ctx = fixture()
    ctx.config.migrationPolicy = { decisionEvidence: 'approved', activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false, gracefulTenantResolution: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults' }
    ctx.tables.store_domains[0].domain = 'ADMIN.old.test'
    // Act
    expect(mapIdentity(ctx)).toBe(true)
    // Assert
    expect(ctx.output.sites[0].domain).toBe('ADMIN.old.test')
    expect(ctx.output.tenants[0].slug).toBe('admin-store-10')
  })
  it('preserves the multi-label Store55-style domain despite an invalid tenant slug', () => {
    // Arrange
    const ctx = fixture()
    ctx.config.migrationPolicy = { decisionEvidence: 'approved', activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false, gracefulTenantResolution: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults' }
    ctx.tables.store_domains[0].domain = 'mk.web.old.test'
    // Act
    expect(mapIdentity(ctx)).toBe(true)
    // Assert
    expect(ctx.output.sites[0].domain).toBe('mk.web.old.test')
    expect(ctx.output.tenants[0].slug).toBe('store-10')
  })
  it('still rejects an invalid source hostname in strict mode', () => {
    // Arrange
    const ctx = fixture()
    ctx.tables.store_domains[0].domain = `${'x'.repeat(64)}.old.test`
    // Act
    expect(mapIdentity(ctx)).toBe(false)
    // Assert
    expect(ctx.diagnostics.some(d => d.code === 'DOMAIN_INVALID')).toBe(true)
  })
  it('requires a choice for ambiguous defaults even under graceful policy', () => {
    // Arrange
    const ctx = fixture()
    ctx.config.migrationPolicy = { decisionEvidence: 'approved', activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false, gracefulTenantResolution: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults' }
    ctx.tables.store_domains.push({ ...ctx.tables.store_domains[0], id: '41', domain: 'other.old.test' })
    // Act
    expect(mapIdentity(ctx)).toBe(false)
    // Assert
    expect(ctx.output.sites).toEqual([])
    expect(ctx.diagnostics.some(d => d.code === 'SOURCE_SITE_DOMAIN_SELECTION_REQUIRED')).toBe(true)
  })
  it.each(['wrong-store','deleted','not-default','missing'])('rejects %s source row binding before mapping', mutation => {
    // Arrange
    const ctx = fixture()
    ctx.config.sourceDomainBindings = { '10': mutation === 'missing' ? '999' : '40' }
    if (mutation === 'wrong-store') ctx.tables.store_domains[0].store_id = '11'
    if (mutation === 'deleted') ctx.tables.store_domains[0].deleted_at = '2025-01-01'
    if (mutation === 'not-default') ctx.tables.store_domains[0].is_default = '0'
    // Act / Assert
    expect(() => validateMigrationPolicyScope(ctx.config,ctx.tables)).toThrow('SOURCE_DOMAIN_BINDING_INVALID')
  })
  it('detects the same selected Site domain across Stores case-insensitively', () => {
    // Arrange
    const stores = ['10','11'].map(id => {
      const store = emptyStore()
      store.tenants.push({ _ref: `@tenants:stores:${id}`, metaData: { pw1StoreId: id } })
      store.sites.push({ _ref: `@sites:stores:${id}`, tenant: `@tenants:stores:${id}`, domain: id === '10' ? 'Original.old.test' : 'original.old.test' })
      return store
    })
    // Act
    const issues = operationalIssues(stores)
    // Assert
    expect(issues.filter(d => d.code === 'GLOBAL_UNIQUE_COLLISION' && d.table === 'sites' && d.field === 'domain')).toHaveLength(2)
  })
  it('accepts an explicit live default source row binding without changing policy', () => {
    // Arrange
    const ctx = fixture()
    ctx.config.sourceDomainBindings = { '10': '40' }
    // Act / Assert
    expect(() => validateMigrationPolicyScope(ctx.config,ctx.tables)).not.toThrow()
    expect(mapIdentity(ctx)).toBe(true)
    expect(ctx.output.sites[0].domain).toBe(ctx.tables.store_domains[0].domain)
    expect(ctx.contributions.filter(c => c.rule === 'MASTER-4.1-SOURCE-SITE-DOMAIN')).toMatchObject([{ sourceId: '40', targetPath: 'sites[].domain' }])
  })
})

const gracefulPolicy = { decisionEvidence: 'approved', activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false, gracefulTenantResolution: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults' } as const
function staleExpired(graceful = true): MappingContext {
  const ctx = fixture()
  if (graceful) ctx.config.migrationPolicy = { ...gracefulPolicy }
  ctx.tables.stores[0].status = '2'
  ctx.tables.users[0].expired_at = '2027-06-01 00:00:00'
  return ctx
}
describe('TC-F42-EXP-115: stale expired Store status with renewed owner (Rule A)', () => {
  it('keeps the Tenant active, COD per source and warns once when owner renewal is explicit', () => {
    // Arrange
    const ctx = staleExpired()
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(true)
    expect(ctx.output.tenants[0].status).toBe('active')
    expect(ctx.output.tenants[0].payments).toMatchObject({ payment_cod: true })
    expect(ctx.output.sites[0].paymentConfig).toMatchObject({ enableCod: true })
    expect(ctx.diagnostics.filter(d => d.code === 'TENANT_STALE_EXPIRED_STATUS')).toEqual([
      expect.objectContaining({ table: 'stores', sourceId: '10', field: 'status', severity: 'warning', reason: 'OWNER_RENEWED_ACTIVE' }),
    ])
    expect(ctx.diagnostics.some(d => d.code === 'TENANT_LIFECYCLE_CONFLICT')).toBe(false)
  })
  it.each([
    ['owner expired_at missing', (c: MappingContext) => { delete c.tables.users[0].expired_at }],
    ['owner expired_at in the past', (c: MappingContext) => { c.tables.users[0].expired_at = '2025-12-01 00:00:00' }],
    ['owner expired_at equals asOf', (c: MappingContext) => { c.tables.users[0].expired_at = '2026-01-01 00:00:00' }],
    ['main subscription ended', (c: MappingContext) => { c.tables.plan_subscriptions[0].ends_at = '2025-12-01 00:00:00' }],
    ['owner banned', (c: MappingContext) => { c.tables.users[0].banned_at = '2025-12-01 00:00:00' }],
  ])('stays a lifecycle conflict when %s', (_name, mutate) => {
    // Arrange
    const ctx = staleExpired()
    mutate(ctx)
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(true)
    expect(ctx.output.tenants[0].status).toBe('suspended')
    expect(ctx.output.tenants[0].payments).toMatchObject({ payment_cod: false })
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'TENANT_LIFECYCLE_CONFLICT', reason: 'SAFE_HOLD_APPLIED' }))
    expect(ctx.diagnostics.some(d => d.code === 'TENANT_STALE_EXPIRED_STATUS')).toBe(false)
  })
  it('stays a lifecycle conflict outside gracefulTenantResolution (strict)', () => {
    // Arrange
    const ctx = staleExpired(false)
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(false)
    expect(ctx.output.tenants).toEqual([])
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'TENANT_LIFECYCLE_CONFLICT', severity: 'blocker' }))
  })
  it('is an approved-policy warning under graceful policy only', () => {
    // Arrange
    const ctx = staleExpired()
    mapIdentity(ctx)
    const warning = { ...ctx.diagnostics.find(d => d.code === 'TENANT_STALE_EXPIRED_STATUS')!, storeId: '10' }
    const run = (policy: Record<string, unknown>) => {
      const collector = createDiagnosticCollector({ contractHash: SOURCE_DOMAIN_MAPPING_HASH, policyRulesEnabled: true, classificationFinal: true, policy: policy as never })
      collector.add(warning)
      return collector.result().summary.buckets[0].disposition
    }
    // Act / Assert
    expect(run({ gracefulTenantResolution: true })).toBe('APPROVED_POLICY')
    expect(run({ gracefulTenantResolution: false })).toBe('BLOCKED')
  })
})

describe('TC-F42-EXP-116: multi-default Store slug from source-bound domain (Rule B)', () => {
  function multiDefault(first: string, second: string, graceful = true): MappingContext {
    const ctx = fixture()
    if (graceful) ctx.config.migrationPolicy = { ...gracefulPolicy }
    ctx.tables.store_domains = [
      { id: '40', store_id: '10', domain: first, is_default: '1', is_main: '1' },
      { id: '41', store_id: '10', domain: second, is_default: '1', is_main: '1' },
    ]
    ctx.config.sourceDomainBindings = { '10': '40' }
    return ctx
  }
  it('derives the slug from the bound domain and records slug provenance', () => {
    // Arrange
    const ctx = multiDefault('luxe.old.test', 'luxe-2.old.test')
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(true)
    expect(ctx.output.tenants[0].slug).toBe('luxe')
    expect(ctx.output.tenants[0].customDomains).toEqual([])
    expect(ctx.diagnostics.filter(d => d.code === 'DEFAULT_DOMAIN_AMBIGUOUS')).toEqual([
      expect.objectContaining({ table: 'stores', sourceId: '10', severity: 'warning', reason: 'SOURCE_DOMAIN_BINDING_APPLIED' }),
    ])
    expect(ctx.contributions).toContainEqual(expect.objectContaining({ table: 'store_domains', sourceId: '40', targetPath: 'tenants[].slug', rule: 'MASTER-3.1-DOMAIN' }))
  })
  it('falls back to <slug>-store-<id> when the bound domain slug is reserved', () => {
    // Arrange
    const ctx = multiDefault('admin.old.test', 'admin-2.old.test')
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(true)
    expect(ctx.output.tenants[0].slug).toBe('admin-store-10')
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'TENANT_SLUG_INVALID', sourceId: '40', reason: 'TENANT_SLUG_FALLBACK_APPLIED' }))
  })
  it('still throws DEFAULT_DOMAIN_AMBIGUOUS in strict mode', () => {
    // Arrange
    const ctx = multiDefault('luxe.old.test', 'luxe-2.old.test', false)
    // Act
    const mapped = mapIdentity(ctx)
    // Assert
    expect(mapped).toBe(false)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'DEFAULT_DOMAIN_AMBIGUOUS', severity: 'blocker' }))
  })
  it('leaves single-default slug derivation unchanged', () => {
    // Arrange
    const ctx = fixture()
    ctx.config.migrationPolicy = { ...gracefulPolicy }
    // Act
    mapIdentity(ctx)
    // Assert
    expect(ctx.output.tenants[0].slug).toBe('example-2')
    expect(ctx.diagnostics.some(d => d.code === 'DEFAULT_DOMAIN_AMBIGUOUS')).toBe(false)
  })
  it('is an approved-policy warning under graceful policy only', () => {
    // Arrange
    const ctx = multiDefault('luxe.old.test', 'luxe-2.old.test')
    mapIdentity(ctx)
    const warning = { ...ctx.diagnostics.find(d => d.code === 'DEFAULT_DOMAIN_AMBIGUOUS')!, storeId: '10' }
    const run = (graceful: boolean) => {
      const collector = createDiagnosticCollector({ contractHash: SOURCE_DOMAIN_MAPPING_HASH, policyRulesEnabled: true, classificationFinal: true, policy: { gracefulTenantResolution: graceful } as never })
      collector.add(warning)
      return collector.result().summary.buckets[0].disposition
    }
    // Act / Assert
    expect(run(true)).toBe('APPROVED_POLICY')
    expect(run(false)).toBe('BLOCKED')
  })
})
