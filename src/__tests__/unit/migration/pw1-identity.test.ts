import { describe, expect, it } from 'vitest'
import {
  emptyStore,
  type MappingContext,
  type Row,
} from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { mapIdentity } from '@/lib/migration/pw1-export/mappers/identity-site'
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
    expect(ctx.output.sites[0].domain).toBe('example-2.new.test')
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

})
