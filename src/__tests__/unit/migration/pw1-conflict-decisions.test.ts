import { describe, expect, it } from 'vitest'
import { conflictDetails, conflictDetailsMarkdown } from '@/lib/migration/pw1-export/conflict-details'
import { APPROVED_CONFLICT_POLICY_KEYS, assertApprovedMigrationPolicy } from '@/lib/migration/pw1-export/policy-boundary'
import { emptyStore } from '@/lib/migration/pw1-export/contracts'
import { migrationPolicySchema } from '@/lib/migration/pw1-export/source-config'

describe('[TC-F42-EXP-102] reviewed conflict contract', () => {
  it.each(APPROVED_CONFLICT_POLICY_KEYS)('allows reviewed %s only in the current contract', key => {
    const policy = migrationPolicySchema.parse({ decisionEvidence: 'Reviewed decisions', siteTypeDefault: 'ecommerce', shippingPolicy: 'pw2-defaults', [key]: true })
    expect(() => assertApprovedMigrationPolicy(policy)).not.toThrow()
    expect(() => assertApprovedMigrationPolicy(policy, true)).toThrow(`MIGRATION_POLICY_NOT_APPROVED:${key}`)
  })
  it('TC-F42-EXP-105: permits explicit unknown-status omission only in new contract', () => {
    const policy = migrationPolicySchema.parse({ decisionEvidence: 'Reviewed decisions', siteTypeDefault: 'ecommerce', shippingPolicy: 'pw2-defaults', skipUnverifiedOrders: true })
    expect(() => assertApprovedMigrationPolicy(policy)).not.toThrow()
    expect(() => assertApprovedMigrationPolicy(policy, false, true, true, false)).toThrow('MIGRATION_POLICY_NOT_APPROVED:skipUnverifiedOrders')
  })
  it('reports collision IDs and before/after values without credentials or content bodies', () => {
    const output = emptyStore()
    output.blogs.push({ _ref: '@blogs:blog_posts:11', slug: 'same-B11' })
    const report = conflictDetails({ blog_posts: [
      { id: '11', store_id: '1', slug: 'same', content: 'private body', password: 'secret' },
      { id: '2', store_id: '1', slug: 'same' },
      { id: '3', store_id: '2', slug: 'same' },
    ] }, [output], [{ code: 'BLOG_SLUG_RESOLVED', table: 'blog_posts', sourceId: '11', storeId: '1', severity: 'warning' }])
    expect(report.entries[0]).toMatchObject({ relatedSourceIds: ['2', '11'], source: { slug: 'same' }, target: { slug: 'same-B11' } })
    expect(JSON.stringify(report)).not.toContain('secret')
    expect(JSON.stringify(report)).not.toContain('private body')
    expect(conflictDetailsMarkdown(report)).toContain('same-B11')
  })
  it('lists all owner-role candidates, including archived owners, without choosing one', () => {
    const report = conflictDetails({
      roles: [{ id: '1', name: 'owner', guard_name: 'api' }],
      model_has_roles: [{ role_id: '1', model_type: 'App\\Models\\User', model_id: '10' }],
      stores: [{ id: '54', status: '3' }],
      users: [{ id: '10', store_id: '54', deleted_at: '2025-01-01', email: 'private@example.com' }, { id: '11', store_id: '54', is_store_owner: '1' }],
    }, [], [{ code: 'OWNER_IDENTITY_CONFLICT', severity: 'blocker', storeId: '54', table: 'stores', sourceId: '54' }])
    expect(report.entries[0]).toMatchObject({ relatedSourceIds: ['10', '11'], targetRef: null, disposition: 'requires-reconciliation' })
    expect(JSON.stringify(report)).not.toContain('private@example.com')
  })
  it('groups coupon codes using promotion tenant ownership, not missing direct store_id', () => {
    const report = conflictDetails({
      promotions: [{ id: '1', store_id: '10' }, { id: '2', store_id: '20' }],
      promotion_codes: [{ id: '101', promotion_id: '1', code: 'Sale' }, { id: '102', promotion_id: '1', code: 'SALE' }, { id: '103', promotion_id: '2', code: 'SALE' }],
    }, [], [{ code: 'DISCOUNT_CODE_COLLISION', severity: 'warning', storeId: '10', table: 'promotion_codes', sourceId: '101' }])
    expect(report.entries[0].relatedSourceIds).toEqual(['101', '102'])
  })

})

describe('[TC-F42-EXP-102] conflict CSV retention proof', () => {
  it('requires exact policy, diagnostic and owner for alias retention', async () => {
    const { createConflictRetention } = await import('@/lib/migration/pw1-export/conflict-retention')
    const evidence = { code: 'DUPLICATE_VARIANT_TUPLE_RESOLVED', severity: 'warning', storeId: '1', table: 'product_skus', sourceId: '2', reason: 'CANONICAL_SKU_ALIAS' }
    const owner = { storeId: '1', rule: 'SOURCE_PARENT_RELATION', parentTable: 'products', parentId: '10' }
    const approved = createConflictRetention({ resolveDuplicateVariantTuples: true }), disabled = createConflictRetention()
    approved.add(evidence); disabled.add(evidence)
    expect(approved.allows('product_skus', '2', 'price', owner)).toBe(true)
    expect(disabled.allows('product_skus', '2', 'price', owner)).toBe(false)
    expect(approved.allows('product_skus', '3', 'price', owner)).toBe(false)
    expect(approved.allows('product_skus', '2', 'password', owner)).toBe(false)
    expect(approved.allows('product_skus', '2', 'price', { ...owner, storeId: '2' })).toBe(false)
    expect(approved.allows('product_skus', '2', 'price', { ...owner, rule: 'OWNERSHIP_STORE_CONFLICT' })).toBe(false)
  })
  it('retains only the pruned SKU and its own selections', async () => {
    const { createConflictRetention } = await import('@/lib/migration/pw1-export/conflict-retention')
    const retention = createConflictRetention({ pruneInvalidVariantSkus: true })
    retention.add({ code: 'PRODUCT_VARIANT_SKU_EXCLUDED', severity: 'warning', storeId: '1', table: 'product_skus', sourceId: '2', reason: 'MISSING_SELECTION' })
    const owner = { storeId: '1', rule: 'SOURCE_PARENT_RELATION', parentTable: 'product_skus', parentId: '2' }
    expect(retention.allows('product_variants', '21', 'attribute_id', owner)).toBe(true)
    expect(retention.allows('product_variants', '21', 'attribute_id', { ...owner, parentId: '3' })).toBe(false)
    expect(retention.allows('product_variants', '21', 'attribute_id', { ...owner, storeId: '2' })).toBe(false)
  })
})


describe('[TC-F42-EXP-102] alias report canonical identity', () => {
  it('shows canonical SKU even when alias SKU codes differ', () => {
    const store = emptyStore()
    store.products.push({ _ref: '@products:products:10', inventory: 5 })
    const report = conflictDetails({ product_skus: [
      { id: '201', store_id: '1', product_id: '10', sku: 'A', stock: '5' },
      { id: '202', store_id: '1', product_id: '10', sku: 'B', stock: '9' },
    ] }, [store], [{ code: 'DUPLICATE_VARIANT_TUPLE_RESOLVED', severity: 'warning', table: 'product_skus', sourceId: '202', storeId: '1', reason: 'CANONICAL_SKU_ALIAS' }], undefined, [{ storeId: '1', sourceProductId: '10', skus: [
      { sourceSkuId: '201', targetId: 'variant-id', targetPath: 'variants.0' },
      { sourceSkuId: '202', targetId: 'variant-id', targetPath: 'variants.0' },
    ] }])
    expect(report.entries[0]).toMatchObject({ relatedSourceIds: ['201', '202'], skuMapping: { canonicalSourceSkuId: '201', targetVariantId: 'variant-id' } })
    expect(conflictDetailsMarkdown(report)).toContain('canonicalSourceSkuId')
  })
})
