// @vitest-environment node
import { createHash } from 'node:crypto'
import { createReconciliationIndex } from '@/lib/migration/pw1-json/reconciliation'
import { COLLECTIONS, type ImportStore } from '@/lib/migration/pw1-json/types'
import { describe, expect, it } from 'vitest'
import { migrationPolicySchema, conflictMigrationPolicySchema, ownerEmailMigrationPolicySchema, productCatalogMigrationPolicySchema, sourceOmissionMigrationPolicySchema, negativeOrderMigrationPolicySchema, PENDING_POLICY_KEYS, createDiagnosticCollector, APPROVED_POLICY } from '@/lib/migration/pw1-json/diagnostics'
import { OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH, POLICY_BOUNDARY_MAPPING_HASH, BLOG_CATEGORY_MAPPING_HASH } from '@/lib/migration/pw1-json/classification'
import { checksum } from '@/lib/migration/pw1-json/projection'

const sourcePolicy = {
  "decisionEvidence": "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history.",
  "activeCatalogOnly": true,
  "deferEmailTemplates": true,
  "allowSparseVariants": true,
  "preserveUserCreators": true,
  "siteTypeDefault": "ecommerce",
  "siteTypeOverrides": {},
  "shippingPolicy": "pw2-defaults",
  "promoteActiveCategoriesToRoot": true,
  "deferredStoreIds": [
    "323"
  ],
  "preserveHistoricalOrders": true
}
const diagnostic = { code: 'SITE_TYPE_POLICY_APPLIED', severity: 'warning' as const, storeId: '1', table: 'stores', field: 'siteType', reason: 'APPROVED_ECOMMERCE_DEFAULT' }
describe('[TC-F42-IMP-POLICY-001] Disabled draft policies preserve exact approved behavior', () => {
  it('keeps old policy bytes unchanged and recognizes explicit false only for the new contract', () => {
    // Arrange
    const absent = migrationPolicySchema.parse(sourcePolicy)
    const disabled = migrationPolicySchema.parse({ ...sourcePolicy, ...Object.fromEntries(PENDING_POLICY_KEYS.map(key => [key, false])) })
    // Act / Assert
    expect(absent).toEqual(sourcePolicy)
    expect(checksum(absent)).toBe(APPROVED_POLICY)
    expect(checksum(disabled)).not.toBe(APPROVED_POLICY)
    for (const [contractHash, policy, expected] of [[POLICY_BOUNDARY_MAPPING_HASH, absent, 'APPROVED_POLICY'], [POLICY_BOUNDARY_MAPPING_HASH, disabled, 'APPROVED_POLICY'], [BLOG_CATEGORY_MAPPING_HASH, disabled, 'BLOCKED']] as const) {
      const collector = createDiagnosticCollector({ contractHash, policy }); collector.add(diagnostic)
      expect(collector.result().summary.buckets[0].disposition).toBe(expected)
    }
  })
  it.each(PENDING_POLICY_KEYS)('refuses active draft flag %s', key => {
    // Arrange / Act / Assert
    expect(migrationPolicySchema.safeParse({ ...sourcePolicy, [key]: true }).success).toBe(false)
  })
  it('does not approve a different policy or waive independent data issues', () => {
    // Arrange
    const policy = migrationPolicySchema.parse({ ...sourcePolicy, decisionEvidence: 'Different policy', resolveDuplicateSkus: false })
    const collector = createDiagnosticCollector({ contractHash: POLICY_BOUNDARY_MAPPING_HASH, policy })
    // Act
    collector.add(diagnostic)
    collector.add({ code: 'ORDER_MAPPING_INVALID', severity: 'blocker', storeId: '1', table: 'orders', sourceId: '2' })
    // Assert
    expect(collector.result().summary.blockingCount).toBe(2)
    expect(migrationPolicySchema.safeParse({ ...sourcePolicy, unknownPolicy: false }).success).toBe(false)
  })
})


describe('[TC-F42-IMP-POLICY-002] Reviewed conflict policies are contract scoped', () => {
  it('accepts reviewed flags only in the new policy schema and refuses skipping Orders', () => {
    // Arrange / Act / Assert
    for (const key of PENDING_POLICY_KEYS.filter(key => key !== 'skipUnverifiedOrders')) {
      expect(conflictMigrationPolicySchema.safeParse({ ...sourcePolicy, [key]: true }).success).toBe(true)
      expect(migrationPolicySchema.safeParse({ ...sourcePolicy, [key]: true }).success).toBe(false)
    }
    expect(conflictMigrationPolicySchema.safeParse({ ...sourcePolicy, pruneInvalidVariantSkus: true }).success).toBe(true)
    expect(conflictMigrationPolicySchema.safeParse({ ...sourcePolicy, skipUnverifiedOrders: true }).success).toBe(false)
  })
  it('approves an exact enabled warning and refuses wrong shape, disabled flag, blockers and old contract', () => {
    // Arrange
    const policy = conflictMigrationPolicySchema.parse({ ...sourcePolicy, resolveDuplicateBlogSlugs: true })
    const warning = { code: 'BLOG_SLUG_COLLISION_RESOLVED', severity: 'warning' as const, storeId: '1', sourceId: '2', table: 'blog_posts', field: 'slug', reason: 'BLOG_SLUG_COLLISION_RESOLVED' }
    // Act / Assert
    const collector = createDiagnosticCollector({ contractHash: CONFLICT_RESOLUTION_MAPPING_HASH, policy, classificationFinal: true })
    collector.add(warning)
    collector.add({ ...warning, field: 'title' })
    collector.add({ ...warning, severity: 'blocker' })
    collector.add({ code: 'ORDER_STATUS_UNVERIFIED', severity: 'blocker', storeId: '1', sourceId: '3', table: 'orders' })
    expect(collector.result().summary.blockingCount).toBe(3)
    for (const context of [
      { contractHash: POLICY_BOUNDARY_MAPPING_HASH, policy },
      { contractHash: CONFLICT_RESOLUTION_MAPPING_HASH, policy: { ...policy, resolveDuplicateBlogSlugs: false } },
      { contractHash: CONFLICT_RESOLUTION_MAPPING_HASH, policy: { ...policy, decisionEvidence: 'unreviewed' } },
    ]) {
      const blocked = createDiagnosticCollector(context); blocked.add(warning)
      expect(blocked.result().summary.blockingCount).toBe(1)
    }
  })
})


describe('[TC-F42-IMP-POLICY-002] Canonical alias evidence', () => {
  function fixture(mode: 'valid' | 'wrong-product' | 'wrong-tuple' | 'disabled' | 'exclude') {
    const hex = createHash('sha256').update(JSON.stringify(['PW1', 'product_skus', '302'])).digest('hex')
    const targetId = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
    const collections = Object.fromEntries(COLLECTIONS.map(key => [key, []])) as ImportStore['collections']
    collections.products = [{ _ref: '@products:products:301', hasVariants: true, variantConfigs: [{ name: 'Size', options: [{ value: 'Large' }] }], variants: [{ id: targetId, name: 'Large' }] }]
    const index = createReconciliationIndex(mode === 'disabled' ? undefined : { resolveDuplicateVariantTuples: true, pruneInvalidVariantSkus: true }, 'PW1')
    index.addStore({ storeId: '205', collections })
    for (const [table, sourceId] of [['products','301'],['product_skus','302'],['product_skus','303'],['attributes','501'],['attribute_values','601']]) {
      index.addSourceRow({ table, sourceId, storeId: '205', parentId: sourceId === '303' && mode === 'wrong-product' ? '999' : '301', parentTable: 'products', ownershipRule: 'SOURCE_PARENT_RELATION' })
    }
    const sku = (sourceSkuId: string) => ({ sourceSkuId, targetPath: 'variants.0', targetId, selectedTuple: [['501', sourceSkuId === '303' && mode === 'wrong-tuple' ? '602' : '601']] })
    return { index, receipt: { storeId: '205', sourceProductId: '301', emitted: true, targetRef: '@products:products:301', eligibleSkuCount: 2,
      tiers: [{ attributeId: '501', attributeCode: 'size', targetPath: 'variantConfigs.0', options: [{ attributeValueId: '601', targetPath: 'variantConfigs.0.options.0.value' }] }],
      skus: mode === 'exclude' ? [sku('302')] : [sku('303'), sku('302')], ...(mode === 'exclude' ? { excludedSkus: [{ sourceSkuId: '303', reasons: ['MISSING_SELECTION'] }] } : {}), errors: [] } }
  }
  it.each(['valid', 'exclude'] as const)('accepts exact canonical or excluded SKU evidence: %s', mode => {
    // Arrange
    const { index, receipt } = fixture(mode)
    // Act / Assert
    expect(() => index.validateProduct(receipt)).not.toThrow()
  })
  it.each(['wrong-product', 'wrong-tuple', 'disabled'] as const)('rejects invalid or unapproved alias: %s', mode => {
    // Arrange
    const { index, receipt } = fixture(mode)
    // Act / Assert
    expect(() => index.validateProduct(receipt)).toThrow('RECONCILIATION_REFERENCES_INVALID')
  })
})


describe('[TC-F42-IMP-POLICY-002] excluded coupon reference evidence', () => {
  it('approves only an explicit policy-excluded reference and retains independent blockers', () => {
    const policy = conflictMigrationPolicySchema.parse({ ...sourcePolicy, skipInvalidDiscountCodes: true })
    const collector = createDiagnosticCollector({ contractHash: CONFLICT_RESOLUTION_MAPPING_HASH, policy, classificationFinal: true })
    collector.add({ code: 'ORDER_DISCOUNT_REFERENCE_OMITTED', severity: 'warning', storeId: '1', sourceId: '2', table: 'orders', field: 'promotion_code', reason: 'COUPON_EXCLUDED_BY_POLICY' })
    collector.add({ code: 'ORDER_DISCOUNT_REFERENCE_UNVERIFIED', severity: 'warning', storeId: '1', sourceId: '3', table: 'orders', field: 'promotion_code' })
    collector.add({ code: 'DISCOUNT_MAPPING_INVALID', severity: 'blocker', storeId: '1', sourceId: '4', table: 'promotion_codes', reason: 'UNEXPECTED_MAPPING_ERROR' })
    expect(collector.result().summary.blockingCount).toBe(2)
  })
})


describe('[TC-F42-IMP-POLICY-003] Owner/email decisions are contract scoped', () => {
  it('approves exact owner/email warnings only for enabled new-contract policy', () => {
    // Arrange
    const policy = ownerEmailMigrationPolicySchema.parse({ ...sourcePolicy, decisionEvidence: "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history. User decision 2026-09-23: temporarily defer PROD Stores 54 and 161 because original backend owners 118 and 343 are soft-deleted; preserve source data, omit these Stores from master JSON, report policy exclusion without blocking other Stores.", deferredStoreIds: ["54", "161", "323"], selectOldestOwner: true, preserveInvalidUserEmails: true })
    const warnings = [
      { code: 'USER_EMAIL_INVALID', field: 'email', reason: 'SOURCE_EMAIL_PRESERVED' },
      { code: 'OWNER_IDENTITY_RESOLVED', field: 'is_store_owner', reason: 'OLDEST_OWNER_SELECTED' },
      { code: 'OWNER_IDENTITY_RESOLVED', field: 'is_store_owner', reason: 'OLDEST_USER_PROMOTED' },
    ].map(d => ({ ...d, severity: 'warning' as const, table: 'users', storeId: '796', sourceId: '9' }))
    // Act / Assert
    for (const [contractHash, enabled, expected] of [[OWNER_EMAIL_MAPPING_HASH, true, 0], [OWNER_EMAIL_MAPPING_HASH, false, 3], [CONFLICT_RESOLUTION_MAPPING_HASH, true, 3]] as const) {
      const collector = createDiagnosticCollector({ contractHash, classificationFinal: true, policy: enabled ? policy : { ...policy, selectOldestOwner: false, preserveInvalidUserEmails: false } })
      warnings.forEach(d => collector.add(d))
      expect(collector.result().summary.blockingCount).toBe(expected)
    }
    const malformed = createDiagnosticCollector({ contractHash: OWNER_EMAIL_MAPPING_HASH, policy, classificationFinal: true })
    malformed.add({ ...warnings[0], field: 'name' }); malformed.add({ ...warnings[0], severity: 'blocker' })
    expect(malformed.result().summary.blockingCount).toBe(2)
    expect(conflictMigrationPolicySchema.safeParse(policy).success).toBe(false)
  })
})


describe('[TC-F42-IMP-POLICY-005] Source omission decisions remain contract scoped', () => {
  it.each(['excludeInvalidProducts', 'excludeInvalidBlogs', 'skipUnverifiedOrders', 'omitUnmappablePayments'])('accepts %s only in 1.9.3 schema', flag => {
    // Arrange
    const policy = { ...sourcePolicy, [flag]: true }
    // Act / Assert
    expect(sourceOmissionMigrationPolicySchema.safeParse(policy).success).toBe(true)
    expect(productCatalogMigrationPolicySchema.safeParse(policy).success).toBe(false)
    expect(ownerEmailMigrationPolicySchema.safeParse(policy).success).toBe(false)
  })
})


describe('[TC-F42-IMP-POLICY-006] Only approved negative-total pairs can be configured', () => {
  it.each([[{storeId:'44',orderId:'112'}],[{storeId:'43',orderId:'113'}],[{storeId:'43',orderId:'112'},{storeId:'43',orderId:'112'}]])('rejects unapproved or duplicate pairs %j', pairs => {
    // Arrange / Act / Assert
    expect(negativeOrderMigrationPolicySchema.safeParse({ ...sourcePolicy, approvedNegativeTotalOrders: pairs }).success).toBe(false)
  })
  it('accepts the two exact pairs only in the current schema', () => {
    // Arrange
    const policy = { ...sourcePolicy, approvedNegativeTotalOrders: [{storeId:'43',orderId:'112'},{storeId:'43',orderId:'132'}] }
    // Act / Assert
    expect(negativeOrderMigrationPolicySchema.safeParse(policy).success).toBe(true)
    expect(sourceOmissionMigrationPolicySchema.safeParse(policy).success).toBe(false)
  })
})
