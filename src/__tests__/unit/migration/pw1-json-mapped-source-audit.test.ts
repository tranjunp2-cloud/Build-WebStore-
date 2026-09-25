import { createSelectedSourceScope } from '@/lib/migration/pw1-json/source-scope'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMappedSourceAudit } from '@/lib/migration/pw1-json/mapped-source-audit'
import { createDiagnosticCollector, migrationPolicySchema, APPROVED_POLICY } from '@/lib/migration/pw1-json/diagnostics'
import { CLASSIFIED_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, createSourceClassificationIndex, type ClassificationRow } from '@/lib/migration/pw1-json/classification'
import { checksum } from '@/lib/migration/pw1-json/projection'
import { COLLECTIONS, type ImportStore, type ImportDiagnostic } from '@/lib/migration/pw1-json/types'
const store = (): ImportStore => ({ storeId: '636', collections: {
  ...Object.fromEntries(COLLECTIONS.map(collection => [collection, []])),
  tenants: [{ payments: { payment_card: false, payment_fpx: false, payment_qr: false } }],
  sites: [{ paymentConfig: { cardEnabled: false, fpxEnabled: false, enableQrBanking: false } }],
} as ImportStore['collections'] })
const row = (fields = { url: 'mapped', signature: 'unresolved' }): ClassificationRow => ({
  table: 'product_images', sourceId: '12', storeId: '636', record: 1, disposition: 'partial',
  fields: fields as ClassificationRow['fields'], ownership: { storeId: '636', rule: 'SOURCE_PARENT_RELATION', parentTable: 'products', parentId: '1' },
  contributions: [{ table: 'product_images', sourceId: '12', fields: ['url'], targetPath: '@media:product_images:12', rule: 'master-5.2-images' }],
})
describe('[TC-F42-IMP-004/007/008] Source archive versus mapped output', () => {
  it('preserves unmapped source fields in audit without blocking emitted media through the collector', () => {
    // Arrange
    const audit = createMappedSourceAudit(false); audit.addStore(store())
    const collector = createDiagnosticCollector({ contractHash: CLASSIFIED_MAPPING_HASH, classify: diagnostic => audit.disposition(diagnostic) })
    collector.add({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', storeId: '636', table: 'product_images', sourceId: '12' })
    collector.add({ code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', storeId: '636', table: 'product_images' })
    // Act
    audit.addRow(row()); const result = collector.result()
    // Assert
    expect(result.blockers).toEqual([])
    expect(result.diagnostics).toHaveLength(2)
    expect(result.summary.buckets.every(bucket => bucket.disposition === 'OUT_OF_SCOPE')).toBe(true)
  })
  it.each(['mapped-overlap', 'unknown-field', 'mixed-summary'])('keeps unresolved operational or unreviewed fields blocking: %s', kind => {
    // Arrange
    const audit = createMappedSourceAudit(false); audit.addStore(store()); const source = row()
    if (kind === 'mapped-overlap') source.contributions[0].fields.push('signature')
    if (kind === 'unknown-field') source.fields.other = 'unresolved'
    audit.addRow(source)
    if (kind === 'mixed-summary') audit.addRow({ ...row(), sourceId: '13', fields: { url: 'unresolved' } })
    // Act / Assert
    expect(audit.disposition({ code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', storeId: '636', table: 'product_images' })).toBeUndefined()
  })
  it.each([false, true])('requires explicitly disabled online payment flags (enabled=%s)', enabled => {
    // Arrange
    const input = store(); input.collections.sites[0].paymentConfig = { cardEnabled: enabled, fpxEnabled: false, enableQrBanking: false }
    const audit = createMappedSourceAudit(false); audit.addStore(input)
    audit.addRow({ ...row(), table: 'store_payments', contributions: [], fields: { payment_method_id: 'unresolved' }, ownership: { storeId: '636', rule: 'SOURCE_STORE_ID' } })
    // Act
    const disposition = audit.disposition({ code: 'PAYMENT_PROVIDER_NOT_ACTIVATED', severity: 'blocker', storeId: '636', table: 'store_payments', sourceId: '12' })
    // Assert
    expect(disposition).toBe(enabled ? undefined : 'OUT_OF_SCOPE')
  })
  it.each([false, true])('requires the approved default-shipping policy (approved=%s)', approved => {
    // Arrange
    const audit = createMappedSourceAudit(approved); audit.addStore(store())
    audit.addRow({ ...row(), table: 'store_deliveries', contributions: [], fields: { shipping_fee_config: 'unresolved' }, ownership: { storeId: '636', rule: 'SOURCE_STORE_ID' } })
    // Act / Assert
    expect(audit.disposition({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', storeId: '636', table: 'store_deliveries', sourceId: '12' })).toBe(approved ? 'OUT_OF_SCOPE' : undefined)
  })
  it.each([false, true])('only excludes raw blog archive when no operational blog is emitted (emitted=%s)', emitted => {
    // Arrange
    const input = store(); if (emitted) input.collections.blogs = [{ _ref: '@blogs:blog_posts:12' }]
    const audit = createMappedSourceAudit(false); audit.addStore(input)
    audit.addRow({ ...row(), table: 'blog_posts', fields: { content: 'mapped' }, disposition: 'mapped', contributions: [{ table: 'blog_posts', sourceId: '12', fields: ['content'], targetPath: 'sites.pw1_source.blog_posts', rule: 'MASTER_RAW_ALLOWLIST' }] })
    // Act / Assert
    expect(audit.disposition({ code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', storeId: '636', table: 'blog_posts', sourceId: '12', field: 'content', reason: 'UNSAFE_URL' })).toBe(emitted ? undefined : 'OUT_OF_SCOPE')
  })
  it.each([false, true])('excludes archived product descriptions only when the product is not emitted (emitted=%s)', emitted => {
    // Arrange
    const input = store(); if (emitted) input.collections.products = [{ _ref: '@products:products:12' }]
    const audit = createMappedSourceAudit(false); audit.addStore(input)
    const collector = createDiagnosticCollector({ contractHash: CLASSIFIED_MAPPING_HASH, selected: new Set(['636']), classify: diagnostic => audit.disposition(diagnostic) })
    collector.add({ code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', storeId: '636', table: 'products', sourceId: '12', field: 'description', reason: 'UNSAFE_URL' })
    // Act
    audit.addRow({ ...row(), table: 'products', fields: { description: 'deleted-retained-source' }, disposition: 'mapped', contributions: [{ table: 'products', sourceId: '12', fields: ['id'], targetPath: 'sites.pw1_source.products', rule: 'MASTER_RAW_ALLOWLIST' }] })
    // Assert
    expect(collector.result().summary.buckets[0].disposition).toBe(emitted ? 'TARGET_CHECK_REQUIRED' : 'OUT_OF_SCOPE')
  })

})

describe('[TC-F42-IMP-OUTCOME-001] Blog index target identity', () => {
  it.each([false, true])('normalizes target collection to source table for runner checks (spool=%s)', spool => {
    // Arrange
    const checks: { table?: string; sourceId?: string }[] = []
    const collector = createDiagnosticCollector({ contractHash: OUTCOME_MAPPING_HASH, ...(spool ? { onTargetCheck: diagnostic => checks.push(diagnostic) } : {}) })
    // Act
    collector.add({ code: 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED', severity: 'blocker', storeId: '636', table: 'blogs', sourceId: '12', field: 'slug' })
    const result = collector.result()
    // Assert
    expect(result.summary.buckets[0].disposition).toBe('TARGET_CHECK_REQUIRED')
    expect(spool ? checks[0] : result.blockers[0]).toMatchObject({ table: 'blog_posts', sourceId: '12' })
  })
})

describe('[TC-F42-IMP-OUTCOME-002] Global archive consumer evidence', () => {
  it.each(['valid', 'mixed', 'foreign', 'unverified', 'missing-consumer', 'invalid-field'])('keeps only verified CSV-only global templates outside scope: %s', kind => {
    // Arrange
    const input = store(), scope = createSelectedSourceScope(); scope.addStore(input)
    const index = createSourceClassificationIndex(scope)
    const diagnostic = { code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker' as const, storeId: '636', table: 'frontend_templates', sourceId: '12', field: 'config', reason: 'INVALID_JSON' }
    const template: ClassificationRow = { table: 'frontend_templates', sourceId: '12', storeId: null, record: 1,
      disposition: 'retained-source', fields: { id: 'source-identity', config: 'retained-source' },
      ownership: { storeId: null, rule: 'SOURCE_GLOBAL_SCOPE' }, contributions: [{ table: 'frontend_templates', sourceId: '12', storeId: kind === 'foreign' ? '637' : '636', fields: ['id'], targetPath: 'source-csv.frontend_templates', rule: 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE' }] }
    if (kind === 'mixed') template.contributions.push({ ...template.contributions[0], targetPath: 'pages.frontend_template', rule: 'MASTER_RAW_ALLOWLIST' })
    if (kind === 'unverified') template.ownership.rule = 'OWNERSHIP_STORE_MISSING'
    if (kind === 'invalid-field') template.contributions[0].fields.push('password')
    index.addDiagnostic(diagnostic)
    if (kind !== 'missing-consumer') index.addRow({ table: 'stores', sourceId: '636', storeId: '636', record: 1, disposition: 'mapped', fields: { id: 'source-identity' }, ownership: { storeId: '636', rule: 'SOURCE_STORE_ID' }, contributions: [] })
    index.addRow(template)
    // Act
    const failures = index.finish()
    const collector = createDiagnosticCollector({ contractHash: CORRECTED_OUTCOME_MAPPING_HASH, classificationFinal: true, classify: d => index.disposition(d) })
    for (const failure of failures) collector.add(failure)
    collector.add(diagnostic)
    const result = collector.result()
    // Assert
    expect(result.blockers.length === 0).toBe(kind === 'valid')
    if (kind === 'valid') expect(result.summary.buckets[0].disposition).toBe('OUT_OF_SCOPE')
  })
  it('does not register a global template for a different selected Store', () => {
    // Arrange
    const audit = createMappedSourceAudit(false); audit.addStore(store())
    audit.addRow({ table: 'frontend_templates', sourceId: '12', storeId: null, record: 1, disposition: 'retained-source', fields: { id: 'source-identity' }, ownership: { storeId: null, rule: 'SOURCE_GLOBAL_SCOPE' }, contributions: [{ table: 'frontend_templates', sourceId: '12', storeId: '637', fields: ['id'], targetPath: 'source-csv.frontend_templates', rule: 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE' }] })
    // Act / Assert
    expect(audit.disposition({ code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', storeId: '636', table: 'frontend_templates', sourceId: '12', field: 'config', reason: 'UNSAFE_URL' })).toBeUndefined()
  })
})


describe('[TC-F42-IMP-004/007/008] EAV source audit metadata', () => {
  it.each(['product_attributes', 'product_variants'])('archives only proven mapped %s audit fields', table => {
    // Arrange
    const input = store(); input.collections.products = [{ _ref: '@products:products:10' }]
    const audit = createMappedSourceAudit(false); audit.addStore(input)
    const source: ClassificationRow = { ...row(), table,
      fields: { attribute_id: 'mapped', attribute_value_id: 'mapped', created_by: 'unresolved', created_at: 'unresolved', updated_at: 'unresolved' },
      contributions: [{ table, sourceId: '12', fields: ['attribute_id', 'attribute_value_id'],
        targetPath: '@products:products:10.' + (table === 'product_attributes' ? 'variantConfigs' : 'variants.0'),
        rule: table === 'product_attributes' ? 'master-16-eav-domain' : 'master-16-eav-tuple' }] }
    // Act
    audit.addRow(source)
    // Assert
    expect(audit.disposition({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', storeId: '636', table, sourceId: '12' })).toBe('OUT_OF_SCOPE')
  })
  it.each(['missing-contribution', 'missing-product', 'foreign-store', 'wrong-rule', 'wrong-target', 'unresolved-option', 'mapped-audit', 'unknown-field', 'invalid-owner'])('keeps unproven EAV evidence blocked: %s', kind => {
    // Arrange
    const input = store(); if (kind !== 'missing-product') input.collections.products = [{ _ref: '@products:products:10' }]
    const audit = createMappedSourceAudit(false); audit.addStore(input)
    const source: ClassificationRow = { ...row(), table: 'product_variants',
      fields: { attribute_id: 'mapped', created_by: 'unresolved' },
      contributions: [{ table: 'product_variants', sourceId: '12', fields: ['attribute_id'], targetPath: '@products:products:10.variants.0', rule: 'master-16-eav-tuple' }] }
    if (kind === 'missing-contribution') source.contributions = []
    if (kind === 'foreign-store') source.contributions[0].storeId = '637'
    if (kind === 'wrong-rule') source.contributions[0].rule = 'unreviewed'
    if (kind === 'wrong-target') source.contributions[0].targetPath = '@products:products:10.variantConfigs'
    if (kind === 'unresolved-option') source.fields.attribute_value_id = 'unresolved'
    if (kind === 'mapped-audit') source.contributions[0].fields.push('created_by')
    if (kind === 'unknown-field') source.fields.other = 'unresolved'
    if (kind === 'invalid-owner') source.ownership.rule = 'OWNERSHIP_PARENT_UNVERIFIED'
    // Act
    audit.addRow(source)
    // Assert
    expect(audit.disposition({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', storeId: '636', table: 'product_variants', sourceId: '12' })).toBeUndefined()
  })
})


describe('[TC-F42-IMP-004/007/008] Approved catalog and historical-order warnings', () => {
  const policy = migrationPolicySchema.parse({
    decisionEvidence: 'User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history.',
    preserveHistoricalOrders: true, promoteActiveCategoriesToRoot: true, deferredStoreIds: ['323'], activeCatalogOnly: true,
    deferEmailTemplates: true, allowSparseVariants: true, preserveUserCreators: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'pw2-defaults',
  })
  const warnings: ImportDiagnostic[] = [
    { code: 'PRODUCT_INACTIVE_SKUS_EXCLUDED', severity: 'warning', storeId: '636', sourceId: '12', table: 'products' },
    { code: 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', severity: 'warning', storeId: '636', sourceId: '12', table: 'order_details', field: 'product_sku_id' },
    { code: 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', severity: 'warning', storeId: '636', sourceId: '12', table: 'orders', field: 'items.product', reason: 'PRODUCT_SLUG_COLLISION' },
  ]
  it.each(warnings)('accepts the exact reviewed warning $table/$code with pinned policy', diagnostic => {
    // Arrange
    const collector = createDiagnosticCollector({ contractHash: CORRECTED_OUTCOME_MAPPING_HASH, policy, classificationFinal: true })
    // Act
    collector.add(diagnostic)
    // Assert
    expect(checksum(policy)).toBe(APPROVED_POLICY)
    expect(collector.result().summary.buckets[0].disposition).toBe('APPROVED_POLICY')
  })
  it.each(['no-policy', 'changed-policy', 'blocker', 'wrong-table', 'wrong-field', 'wrong-reason', 'no-source', 'no-store', 'unknown-code'])('keeps unsupported evidence blocking: %s', kind => {
    // Arrange
    const collector = createDiagnosticCollector({ contractHash: CORRECTED_OUTCOME_MAPPING_HASH,
      policy: kind === 'no-policy' ? undefined : kind === 'changed-policy' ? { ...policy, preserveHistoricalOrders: false } : policy, classificationFinal: true })
    const diagnostics = warnings.map(row => ({ ...row }))
    for (const diagnostic of diagnostics) {
      if (kind === 'blocker') diagnostic.severity = 'blocker'
      if (kind === 'wrong-table') diagnostic.table = 'medias'
      if (kind === 'wrong-field') diagnostic.field = 'price'
      if (kind === 'wrong-reason') diagnostic.reason = 'UNKNOWN_REASON'
      if (kind === 'no-source') delete diagnostic.sourceId
      if (kind === 'no-store') delete diagnostic.storeId
      if (kind === 'unknown-code') diagnostic.code = 'UNREVIEWED_WARNING'
    }
    // Act
    for (const diagnostic of diagnostics) collector.add(diagnostic)
    // Assert
    expect(collector.result().summary.buckets.every(bucket => bucket.disposition === 'BLOCKED')).toBe(true)
  })
})
