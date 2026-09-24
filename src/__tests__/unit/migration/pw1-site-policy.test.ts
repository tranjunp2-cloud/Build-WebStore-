// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore, type Doc, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema, validateMigrationPolicyScope } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { applySitePolicy } from '@/lib/migration/pw1-export/mappers/site-policy'

const policy = { decisionEvidence: 'Approved by merchant migration owner', siteTypeDefault: 'ecommerce', shippingPolicy: 'pw2-defaults' }
const baseConfig = { version: 1, sourceInstance: 'fixture', sourceDatabase: 'fixture', sourceInstanceToken: 'fixture', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'review' }
const delivery: Row = { id: '20', store_id: '10', delivery_provider_id: '2', status: '1', config_status: '1', shipping_fee_method: '1', shipping_fee_config: '{"condition_type":1,"shipping_fee":"8.50"}' }
function fixture(tables: Record<string, Row[]> = {}, migrationPolicy: unknown = policy) {
  const config = sourceConfigSchema.parse({ ...baseConfig, migrationPolicy })
  const ctx = new SourceIndex({ stores: [{ id: '10', currency_id: '1', selected_delivery_method: '1' }], currencies: [{ id: '1', code: 'MYR' }], delivery_providers: [{ id: '2', code: 'self_delivery', status: '1' }], store_deliveries: [delivery], ...tables }).context(config, '10', emptyStore(), [], [])
  const site: Doc = { _ref: 'site:10', siteType: 'ecommerce' }
  return { ctx, site }
}

describe('[TC-F42-071] Approved site classification', () => {
  it('preserves legacy blockers when policy is absent', () => {
    // Arrange
    const { ctx, site } = fixture({}, undefined)
    delete ctx.config.migrationPolicy
    // Act
    applySitePolicy(ctx, site)
    // Assert
    expect(ctx.diagnostics.map(d => d.code)).toEqual(['SITE_TYPE_DEFAULT_REQUIRES_REVIEW', 'SITE_SHIPPING_MAPPING_UNRESOLVED'])
    expect(site.shippingConfig).toBeUndefined()
  })
  it.each([ [{ ...policy }, 'ecommerce'], [{ ...policy, siteTypeOverrides: { '10': 'blog' } }, 'blog'] ])('applies default or explicit verified override %j', (migrationPolicy, expected) => {
    // Arrange
    const { ctx, site } = fixture({}, migrationPolicy)
    // Act
    applySitePolicy(ctx, site)
    // Assert
    expect(site.siteType).toBe(expected)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SITE_TYPE_POLICY_APPLIED', severity: 'warning' }))
  })
  it.each([{ siteTypeDefault: 'blog' }, { siteTypeOverrides: { '10': 'unknown' } }, { siteTypeOverrides: { typo: 'blog' } }, { unexpected: true }])('rejects invalid or misspelled policy %j', patch => {
    // Arrange / Act
    const result = sourceConfigSchema.safeParse({ ...baseConfig, migrationPolicy: { ...policy, ...patch } })
    // Assert
    expect(result.success).toBe(false)
  })
  it.each([{ stores: [] }, { stores: [{ id: '10', deleted_at: '2025-01-01' }] }])('rejects override for absent/deleted store', ({ stores }) => {
    // Arrange
    const config = sourceConfigSchema.parse({ ...baseConfig, migrationPolicy: { ...policy, siteTypeOverrides: { '10': 'blog' } } })
    // Act / Assert
    expect(() => validateMigrationPolicyScope(config, { stores })).toThrow('SITE_TYPE_OVERRIDE_STORE_INVALID')
    expect(() => validateMigrationPolicyScope(config, { stores: [{ id: '10' }] })).not.toThrow()
  })
})

describe('[TC-F42-072] PW2 shipping migration policy', () => {
  it.each([['8.50', 850], ['0', 0], ['1000', 100000]])('maps MYR %s to sen without losing zero', (fee, expected) => {
    // Arrange
    const { ctx, site } = fixture({ store_deliveries: [{ ...delivery, shipping_fee_config: JSON.stringify({ condition_type: 1, shipping_fee: fee, api_key: 'PRIVATE' }), credentials: 'PRIVATE' }] }, { ...policy, shippingPolicy: 'review' })
    // Act
    applySitePolicy(ctx, site)
    // Assert
    expect(site.shippingConfig).toEqual({ enabled: true, westRate: expected, eastRate: expected, freeAbove: null, shippingSetupConfirmed: false })
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SHIPPING_FIXED_FEE_MAPPED' }))
    expect(JSON.stringify(site)).not.toMatch(/PRIVATE|credentials|api_key|easyParcel/)
  })
  it('TC-F42-EXP-111: pw2-defaults never copies an otherwise valid legacy fixed fee', () => {
    // Arrange
    const { ctx, site } = fixture()
    // Act
    applySitePolicy(ctx, site)
    // Assert
    expect(site.shippingConfig).toEqual({ enabled: true, westRate: 800, eastRate: 1500, freeAbove: null, shippingSetupConfirmed: false })
    expect(ctx.contributions).toEqual([])
    expect(ctx.diagnostics.some(d => d.code === 'SHIPPING_FIXED_FEE_MAPPED')).toBe(false)
  })
  it.each(['USD', ''])('blocks unsupported or unknown currency %s', code => {
    // Arrange
    const { ctx, site } = fixture({ currencies: [{ id: '1', code }] })
    // Act
    applySitePolicy(ctx, site)
    // Assert
    expect(site.shippingConfig).toBeUndefined()
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SITE_SHIPPING_CURRENCY_UNSUPPORTED', severity: 'blocker' }))
  })
  it.each([
    ['missing', { store_deliveries: [] }, 'MISSING_OR_UNCONFIGURED_SOURCE'],
    ['inactive', { store_deliveries: [{ ...delivery, status: '0' }] }, 'MISSING_OR_UNCONFIGURED_SOURCE'],
    ['unconfigured', { store_deliveries: [{ ...delivery, config_status: '0' }] }, 'MISSING_OR_UNCONFIGURED_SOURCE'],
    ['deleted', { store_deliveries: [{ ...delivery, deleted_at: '2025-01-01' }] }, 'MISSING_OR_UNCONFIGURED_SOURCE'],
    ['wrong tenant', { store_deliveries: [{ ...delivery, store_id: '11' }] }, 'MISSING_OR_UNCONFIGURED_SOURCE'],
    ['inactive provider', { delivery_providers: [{ id: '2', code: 'self_delivery', status: '0' }] }, 'MISSING_OR_UNCONFIGURED_SOURCE'],
    ['ambiguous', { store_deliveries: [delivery, { ...delivery, id: '21' }] }, 'AMBIGUOUS_SELF_DELIVERY'],
    ['provider mode', { stores: [{ id: '10', currency_id: '1', selected_delivery_method: '2' }] }, 'PROVIDER_OR_UNKNOWN_SOURCE_MODE'],
    ['tier', { store_deliveries: [{ ...delivery, shipping_fee_config: '{"condition_type":2,"condition_value":[{"sub_total_from":"0","sub_total_to":"100","shipping_fee":"10"}]}' }] }, 'LEGACY_TIER_NOT_MAPPED'],
    ['dynamic', { store_deliveries: [{ ...delivery, shipping_fee_method: '2' }] }, 'LEGACY_DYNAMIC_NOT_MAPPED'],
    ['over limit', { store_deliveries: [{ ...delivery, shipping_fee_config: '{"condition_type":1,"shipping_fee":"1000.01"}' }] }, 'FIXED_FEE_EXCEEDS_PW2_LIMIT'],
    ['precision', { store_deliveries: [{ ...delivery, shipping_fee_config: '{"condition_type":1,"shipping_fee":"8.501"}' }] }, 'FIXED_FEE_PRECISION_OR_VALUE_INVALID'],
  ] satisfies Array<[string, Record<string, Row[]>, string]>)('uses explicit PW2 defaults for %s, but blocks under review policy', (_label, tables, reason) => {
    // Arrange
    const defaults = fixture(tables)
    const review = fixture(tables, { ...policy, shippingPolicy: 'review' })
    // Act
    applySitePolicy(defaults.ctx, defaults.site)
    applySitePolicy(review.ctx, review.site)
    // Assert
    expect(defaults.site.shippingConfig).toEqual({ enabled: true, westRate: 800, eastRate: 1500, freeAbove: null, shippingSetupConfirmed: false })
    expect(defaults.ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', table: 'stores', sourceId: '10', severity: 'warning', reason: 'APPROVED_PW2_DEFAULTS' }))
    expect(review.site.shippingConfig).toBeUndefined()
    expect(review.ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SITE_SHIPPING_RECONFIGURATION_REQUIRED', severity: 'blocker', reason }))
    expect(defaults.ctx.contributions).toEqual([])
  })
})


describe('[TC-F42-077] Explicit Store deferral policy', () => {
  it.each([['0'], ['bad'], ['10', '10']])('rejects malformed or duplicate deferred IDs %j', (...ids) => {
    // Arrange / Act
    const result = sourceConfigSchema.safeParse({ ...baseConfig, migrationPolicy: { ...policy, deferredStoreIds: ids } });
    // Assert
    expect(result.success).toBe(false);
  });
  it.each([[], [{ id: '10', deleted_at: '2025-01-01' }]])('rejects missing or deleted deferred Store', (...stores) => {
    // Arrange
    const config = sourceConfigSchema.parse({ ...baseConfig, migrationPolicy: { ...policy, deferredStoreIds: ['10'] } });
    // Act / Assert
    expect(() => validateMigrationPolicyScope(config, { stores })).toThrow('DEFERRED_STORE_INVALID');
    expect(() => validateMigrationPolicyScope(config, { stores: [{ id: '10' }] })).not.toThrow();
  });
});
