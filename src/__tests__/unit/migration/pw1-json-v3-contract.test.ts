import * as correctedOutcome from '@/lib/migration/pw1-json/export-outcome'
import { exportOutcome, exportReview, reviewMarkdown } from '@/lib/migration/pw1-json/export-outcome-v1'
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadImportArtifact, BLOG_CATEGORY_MAPPING_HASH, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH } from '@/lib/migration/pw1-json/artifact'
import { loadCredentialSidecar, prepareImportArtifact } from '@/lib/migration/pw1-json/credentials'
import { COLLECTIONS } from '@/lib/migration/pw1-json/types'

const CONTRACT = '27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
interface Row {
  table: string; sourceId: string; storeId: string | null; record: number; disposition: string
  fields: Record<string, string>; contributions: unknown[]
  ownership?: { storeId: string | null; rule: string; parentTable?: string; parentId?: string }
  productExclusion?: {productId:string;reason:string}
  fieldRetentionRules?: Record<string, string>
}
interface Diagnostic { code: string; severity: 'warning' | 'blocker'; storeId?: string; table?: string; sourceId?: string; field?: string; reason?: string }
const snapshot = { sourceInstance: 'synthetic-v3', sourceDatabase: 'synthetic', sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v3', asOf: '2026-09-17T00:00:00Z' }
const emptyDiagnostics = () => ({ customerCrosswalk: [], addressDispositions: [], rankDispositions: [], rankConflicts: [], profileConflicts: [] })
const emptyCustomerStore = (storeId: string) => ({ storeId, status: 'reconciled', retainedSourceRows: [], quarantinedCustomerRefs: [], diagnostics: emptyDiagnostics() })
async function fixture(options: { actors?: unknown[]; rows?: Row[]; diagnostics?: Diagnostic[]; customerStores?: unknown[]; products?: unknown[]; documents?: { storeId: string; collection: string; documents: unknown[] }[]; override?: Record<string, unknown> } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pw1-json-v3-test-')); roots.push(root)
  const source = join(root, 'export'); await mkdir(source, { mode: 0o700 })
  const rows: Row[] = ['205', '285'].map((id, i) => ({ table: 'stores', sourceId: id, storeId: id, record: i + 1,
    disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: id, rule: 'SOURCE_STORE_ID' } }))
  rows.push(...(options.rows ?? []))
  const diagnostics = options.diagnostics ?? []
  const master: Record<string, unknown[]>[] = ['205', '285'].map(id => ({ ...Object.fromEntries(COLLECTIONS.map(collection => [collection, []])),
    tenants: [{ _ref: `@tenants:stores:${id}`, metaData: { pw1StoreId: id } }], sites: [{ _ref: `@sites:stores:${id}`, tenant: `@tenants:stores:${id}` }] }))
  for (const addition of options.documents ?? []) {
    const index = ['205', '285'].indexOf(addition.storeId)
    if (index < 0) throw new Error('UNKNOWN_FIXTURE_STORE')
    master[index][addition.collection] = addition.documents
  }
  const files: Record<string, string> = {
    'master.json': JSON.stringify(master), 'mapping-report.json': JSON.stringify({ version: 1, diagnostics, rows }),
    'mapping-report.csv': 'table\n', 'README.md': 'Synthetic v3 reconciliation contract fixture',
    'user-actors.json': JSON.stringify({ version: 1, purpose: 'creator-target-binding-required', sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v3', actors: options.actors ?? [] }),
    'customer-reconciliation.json': JSON.stringify({ version: 1, sourceSnapshot: snapshot, archiveStorage: 'external-source-csv', stores: options.customerStores ?? ['205', '285'].map(emptyCustomerStore) }),
    'product-reconciliation.json': JSON.stringify({ version: 1, sourceSnapshot: snapshot, products: options.products ?? [] }),
  }
  for (const [name, value] of Object.entries(files)) await writeFile(join(source, name), value, { mode: 0o600 })
  const tables = [...new Set(rows.map(row => row.table))]
  const inventory = tables.map(table => { const entries = rows.filter(row => row.table === table); return { table, filename: `${table}.csv`,
    sha256: digest(`synthetic-${table}`), bytes: 1, selected: true, rowCount: entries.length, headers: Object.keys(entries[0].fields) } })
  const blockers = diagnostics.filter(row => row.severity === 'blocker').length
  const manifest = { version: 1, exporterVersion: '1.2.0', classificationVersion: 'source-classification-v1', contractSha256: CONTRACT,
    sourceConfigSha256: digest('synthetic-config'), sourceSnapshot: snapshot, files: inventory,
    migrationPolicy: { decisionEvidence: 'Synthetic fixture; no policy transformations authorized', preserveHistoricalOrders: false, promoteActiveCategoriesToRoot: false, deferredStoreIds: [], activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: true, siteTypeDefault: 'ecommerce', siteTypeOverrides: {}, shippingPolicy: 'review' },
    artifacts: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, digest(value)])),
    status: blockers ? 'needs_review' : 'complete', importReady: false, coverage: { accounted: true }, mapping: { complete: blockers === 0 },
    counts: { sourceStoreCount: 2, selectedStoreCount: 2, policyExcludedStoreCount: 0, emittedStoreCount: 2, blockedStoreCount: 0, blockers },
    blockedStores: [], policyExcludedStores: [], ...options.override }
  const saveManifest = () => writeFile(join(source, 'master-manifest.json'), JSON.stringify(manifest), { mode: 0o600 })
  await saveManifest()
  return { root, source, output: join(root, 'prepared'), files, manifest, rows, saveManifest }
}
const prepare = (input: Awaited<ReturnType<typeof fixture>>) => prepareImportArtifact({ exportArtifact: input.source, output: input.output })

describe('[TC-F42-IMP-003/011] Exporter 1.2 strict profile and receipt binding', () => {
  it('pins classification and both receipt hashes in profile v3 while preserving actor compatibility', async () => {
    // Arrange
    const input = await fixture()
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest).toMatchObject({ version: 3, profile: 'pw1-json-v3', mappingHash: CONTRACT,
      classificationVersion: 'source-classification-v1', customerReconciliationHash: digest(input.files['customer-reconciliation.json']),
      productReconciliationHash: digest(input.files['product-reconciliation.json']), actorArtifactHash: digest(input.files['user-actors.json']), credentialHash: null })
  })
  it.each([{ exporterVersion: '1.3.0' }, { classificationVersion: 'source-classification-v2' }, { classificationVersion: undefined }, { contractSha256: digest('unknown-contract') }])('rejects unsupported contract metadata %j', async override => {
    // Arrange
    const input = await fixture({ override })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it.each(['customer-reconciliation.json', 'product-reconciliation.json'])('rejects changed %s after prepare', async name => {
    // Arrange
    const input = await fixture(); const prepared = await prepare(input)
    await writeFile(join(input.output, name), '{}')
    // Act / Assert
    await expect(loadImportArtifact(prepared.manifestPath)).rejects.toThrow()
  })
  it.each(['customer-reconciliation.json', 'product-reconciliation.json'])('requires the %s publication receipt', async name => {
    // Arrange
    const input = await fixture(); delete input.manifest.artifacts[name]; await input.saveManifest()
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('rejects hash-authenticated receipts from another snapshot', async () => {
    // Arrange
    const input = await fixture(); const name = 'customer-reconciliation.json'
    const receipt = JSON.stringify({ version: 1, sourceSnapshot: { ...snapshot, snapshotId: 'other' }, archiveStorage: 'external-source-csv', stores: ['205', '285'].map(emptyCustomerStore) })
    await writeFile(join(input.source, name), receipt); input.manifest.artifacts[name] = digest(receipt); await input.saveManifest()
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
})

describe('[TC-F42-IMP-003/004/008] Reconciliation ownership and quarantined targets', () => {
  const row: Row = { table: 'customers', sourceId: '101', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } }
  const quarantined = (storeId = '205', targetRef: string | null = null) => ({ ...emptyCustomerStore(storeId),
    retainedSourceRows: [{ table: 'customers', sourceId: '101' }], quarantinedCustomerRefs: ['@customers:customers:101'],
    diagnostics: { ...emptyDiagnostics(), customerCrosswalk: [{ sourceCustomerId: '101', disposition: 'canonical', targetRef }] } })
  it('accepts explicit quarantined source identity with a null operational target', async () => {
    // Arrange
    const input = await fixture({ rows: [row], customerStores: [quarantined(), emptyCustomerStore('285')] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.stores.find(store => store.storeId === '205')?.collections.customers).toEqual([])
  })
  it('rejects a receipt claiming a customer owned by another Store', async () => {
    // Arrange
    const input = await fixture({ rows: [row], customerStores: [emptyCustomerStore('205'), quarantined('285')] })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('rejects a quarantined customer that still advertises a non-null target', async () => {
    // Arrange
    const input = await fixture({ rows: [row], customerStores: [quarantined('205', '@customers:customers:101'), emptyCustomerStore('285')] })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('rejects non-emitted Product SKU paths or IDs which imply an operational target', async () => {
    // Arrange
    const rows: Row[] = ['products', 'product_skus'].map((table, index) => ({ table, sourceId: String(301 + index), storeId: '205', record: 1,
      disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } }))
    const input = await fixture({ rows, products: [{ storeId: '205', sourceProductId: '301', emitted: false, targetRef: null, eligibleSkuCount: 1, tiers: [],
      skus: [{ sourceSkuId: '302', targetPath: 'variants.0', targetId: '00000000-0000-4000-8000-000000000001', selectedTuple: [] }], errors: ['PRODUCT_NOT_EMITTED'] }] })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
})

describe('[TC-F42-IMP-003/004/011] Classified retention and selected-scope fail-closed behavior', () => {
  const retainedUser: Row = { table: 'users', sourceId: '10', storeId: '205', record: 1, disposition: 'retained-source',
    fields: { id: 'source-identity', username: 'retained-source' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' },
    fieldRetentionRules: { username: 'MASTER-3.2-USER-METADATA-SOURCE-ONLY' } }
  it('preserves an explicitly classified source-only User field without treating it as an operational write', async () => {
    // Arrange
    const input = await fixture({ rows: [retainedUser] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.stores[0].collections.users).toEqual([])
  })
  it('does not accept a retention rule attached to a mapped field', async () => {
    // Arrange
    const input = await fixture({ rows: [{ ...retainedUser, fields: { ...retainedUser.fields, username: 'mapped' } }] })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('rejects disagreement between report Store and classified ownership', async () => {
    // Arrange
    const input = await fixture({ rows: [{ ...retainedUser, ownership: { storeId: '285', rule: 'SOURCE_STORE_ID' } }] })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('reports an unrelated global orphan without blocking Store205', async () => {
    // Arrange
    const input = await fixture({ rows: [{ table: 'menu_items', sourceId: '404', storeId: null, record: 1, disposition: 'unresolved',
      fields: { id: 'source-identity', name: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'menus', parentId: '999' } }],
      diagnostics: [{ code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table: 'menu_items', sourceId: '404', reason: 'OWNERSHIP_PARENT_UNVERIFIED' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.diagnosticSummary.buckets).toEqual(expect.arrayContaining([expect.objectContaining({ disposition: 'OUT_OF_SCOPE', diagnostic: expect.objectContaining({ code: 'SOURCE_OWNERSHIP_UNRESOLVED' }) })]))
  })
  it.each(['wrong-store', 'missing-source'])('refuses diagnostic scope forgery before Store filtering: %s', async kind => {
    // Arrange
    const input = await fixture({ rows: [retainedUser], diagnostics: [{ code: 'UNKNOWN_SOURCE_REQUIREMENT', severity: 'blocker',
      table: 'users', sourceId: kind === 'missing-source' ? '999' : '10', storeId: '285' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_CLASSIFICATION_INVALID' })]))
  })
  it('keeps unsupported retention semantics globally blocking instead of trusting a MASTER rule string', async () => {
    // Arrange
    const input = await fixture({ rows: [{ ...retainedUser, fieldRetentionRules: { username: 'MASTER-UNKNOWN-ALLOW-ALL' } }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['285'] })
    // Assert
    expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_CLASSIFICATION_INVALID' })]))
  })
  it.each([false, true])('limits shared settings Page exclusion to proved Page owners (mixed=%s)', async mixed => {
    // Arrange
    const rows: Row[] = [{ table: 'model_settings', sourceId: '404', storeId: null, record: 1, disposition: 'unresolved',
      fields: { id: 'source-identity', value: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'page_components', parentId: '999' } }]
    if (mixed) rows.push({ ...rows[0], sourceId: '405', record: 2, contributions: [{ storeId: '205', table: 'model_settings', sourceId: '405', fields: ['value'], targetPath: 'products', rule: 'MASTER-5' }], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'products', parentId: '999' } })
    const diagnostics: Diagnostic[] = rows.map(row => ({ code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table: 'model_settings', sourceId: row.sourceId, reason: 'OWNERSHIP_PARENT_UNVERIFIED' }))
    diagnostics.push({ code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', table: 'model_settings' })
    const input = await fixture({ rows, diagnostics })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    if (mixed) expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_OWNERSHIP_UNRESOLVED' })]))
    else expect(artifact.blockers).toEqual([])
  })
  it.each(['205', '285'])('rejects duplicate compressed leaf identity even when its second owner is %s', async secondOwner => {
    // Arrange
    const rows: Row[] = ['205', secondOwner].map((storeId, index) => ({ table: 'store_deliveries', sourceId: '801', storeId, record: index + 1,
      disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId, rule: 'SOURCE_STORE_ID' } }))
    const input = await fixture({ rows })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('CLASSIFICATION_DUPLICATE_SOURCE')
  })
  it.each([false, true])('rejects the same shared-setting ID across resolved/unresolved index modes (reverse=%s)', async reverse => {
    // Arrange
    const resolved: Row = { table: 'model_settings', sourceId: '801', storeId: '205', record: 1, disposition: 'mapped',
      fields: { id: 'source-identity', value: 'mapped' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_PARENT_RELATION', parentTable: 'stores', parentId: '205' } }
    const unresolved: Row = { table: 'model_settings', sourceId: '801', storeId: null, record: 2, disposition: 'unresolved',
      fields: { id: 'source-identity', value: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'products', parentId: '999' } }
    const rows = (reverse ? [unresolved, resolved] : [resolved, unresolved]).map((row, index) => ({ ...row, record: index + 1 }))
    const input = await fixture({ rows })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('CLASSIFICATION_DUPLICATE_SOURCE')
  })
  it('classifies leaf diagnostics identically when report rows precede diagnostics', async () => {
    // Arrange
    const rows: Row[] = [{ table: 'store_deliveries', sourceId: '801', storeId: '205', record: 1, disposition: 'mapped',
      fields: { id: 'source-identity', shipping_fee_config: 'mapped' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } }]
    const diagnostics: Diagnostic[] = [{ code: 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', severity: 'warning', table: 'store_deliveries',
      sourceId: '801', storeId: '205', field: 'shipping_fee_config', reason: 'INVALID_SOURCE_CONFIGURATION' }]
    const first = await fixture({ rows, diagnostics }); const reordered = await fixture({ rows, diagnostics })
    const report: { version: number; rows: unknown[]; diagnostics: unknown[] } = JSON.parse(reordered.files['mapping-report.json'])
    const text = JSON.stringify({ version: report.version, rows: report.rows, diagnostics: report.diagnostics })
    await writeFile(join(reordered.source, 'mapping-report.json'), text)
    reordered.manifest.artifacts['mapping-report.json'] = digest(text); await reordered.saveManifest()
    // Act
    const originalPrepared = await prepare(first); const reorderedPrepared = await prepare(reordered)
    const original = await loadImportArtifact(originalPrepared.manifestPath, { storeIds: ['205'] })
    const actual = await loadImportArtifact(reorderedPrepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(actual.diagnosticSummary).toEqual(original.diagnosticSummary)
    expect(actual.blockers.map(item => item.code)).toEqual(['SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT'])
  })
  it('retains credential sidecar authentication under the v3 snapshot binding', async () => {
    // Arrange
    vi.stubEnv('PW2_MIGRATION_SECRET', 'synthetic-v3-secret-at-least-thirty-two-characters')
    const row: Row = { table: 'users', sourceId: '10', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'source-identity', key_string: 'security-excluded', password: 'security-excluded' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } }
    const input = await fixture({ rows: [row] })
    const csv = 'id,key_string,password\n10,SYNTHETIC_V3_SECRET,synthetic-hash\n'
    const path = join(input.root, 'users.csv'); await writeFile(path, csv, { mode: 0o600 })
    const inventory = input.manifest.files.find(file => file.table === 'users')!
    inventory.sha256 = digest(csv); inventory.bytes = Buffer.byteLength(csv); await input.saveManifest()
    // Act
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, credentials: path, output: input.output })
    const artifact = await loadImportArtifact(prepared.manifestPath); const recovered = await loadCredentialSidecar(artifact)
    // Assert
    expect(recovered.get('10')).toEqual({ key_string: 'SYNTHETIC_V3_SECRET', passwordHash: 'synthetic-hash' })
    expect(await readFile(join(input.output, 'credentials.enc'), 'utf8')).not.toContain('SYNTHETIC_V3_SECRET')
    await expect(loadCredentialSidecar({ ...artifact, manifest: { ...artifact.manifest, snapshotId: 'another-snapshot' } })).rejects.toThrow()
  })
})


describe('[TC-F42-IMP-003/008/009] Emitted reconciliation closure', () => {
  const owned = (table: string, sourceId: string): Row => ({ table, sourceId, storeId: '205', record: 1, disposition: 'mapped',
    fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } })
  const variantId = '00000000-0000-4000-8000-000000000001'
  const product = { _ref: '@products:products:301', hasVariants: true,
    variantConfigs: [{ name: 'Size', options: [{ value: 'Large' }] }], variants: [{ id: variantId, name: 'Large' }] }
  const receipt = () => ({ storeId: '205', sourceProductId: '301', emitted: true, targetRef: product._ref, eligibleSkuCount: 1,
    tiers: [{ attributeId: '501', attributeCode: 'size', targetPath: 'variantConfigs.0', options: [{ attributeValueId: '601', targetPath: 'variantConfigs.0.options.0.value' }] }],
    skus: [{ sourceSkuId: '302', targetPath: 'variants.0', targetId: variantId, selectedTuple: [['501', '601']] }], errors: [] })
  const productFixture = (products: unknown[]) => fixture({ rows: [owned('products', '301'), owned('product_skus', '302'), owned('attributes', '501'), owned('attribute_values', '601')],
    documents: [{ storeId: '205', collection: 'products', documents: [product] }], products })
  it('accepts complete Product tier, SKU UUID, path and tuple-to-name evidence', async () => {
    // Arrange
    const input = await productFixture([receipt()])
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.stores[0].collections.products).toEqual([product])
  })
  it.each(['path', 'id', 'tuple', 'duplicate', 'omitted'])('rejects invalid emitted Product evidence: %s', async failure => {
    // Arrange
    const entry = receipt()
    if (failure === 'path') entry.skus[0].targetPath = 'variants.1'
    if (failure === 'id') entry.skus[0].targetId = '00000000-0000-4000-8000-000000000002'
    if (failure === 'tuple') entry.skus[0].selectedTuple = [['501', '602']]
    const input = await productFixture(failure === 'omitted' ? [] : failure === 'duplicate' ? [entry, entry] : [entry])
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('requires emitted customer addresses to have owned source and target-index coverage', async () => {
    // Arrange
    const customer = { _ref: '@customers:customers:101', addresses: [{ line1: 'Synthetic address' }] }
    const store = { ...emptyCustomerStore('205'), retainedSourceRows: [{ table: 'customers', sourceId: '101' }, { table: 'addresses', sourceId: '102' }, { table: 'orders', sourceId: '201' }],
      diagnostics: { ...emptyDiagnostics(), customerCrosswalk: [{ sourceCustomerId: '101', targetRef: customer._ref, disposition: 'canonical' }],
        addressDispositions: [{ targetRef: customer._ref, sourceOrderId: '201', sourceAddressId: '102', usage: 'Shipping', legacyGeographyTypes: [], disposition: 'emitted', targetIndex: 1 }] } }
    const input = await fixture({ rows: [owned('customers', '101'), owned('addresses', '102'), owned('orders', '201')],
      documents: [{ storeId: '205', collection: 'customers', documents: [customer] }], customerStores: [store, emptyCustomerStore('285')] })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
})

describe('[TC-F42-IMP-003/004] Exact exporter diagnostic source conventions', () => {
  it.each([true, false])('permits shared definition consumers only for the exact raw diagnostic (valid=%s)', async valid => {
    // Arrange
    const input = await fixture({ rows: [{ table: 'frontend_templates', sourceId: '1', storeId: null, record: 1,
      disposition: 'mapped', fields: { id: 'source-identity', config: 'mapped' }, contributions: [], ownership: { storeId: null, rule: 'SOURCE_GLOBAL_SCOPE' } }],
      diagnostics: [{ table: 'frontend_templates', sourceId: '1', storeId: '205', code: valid ? 'RAW_VALUE_UNVERIFIED' : 'UNKNOWN_RAW_VALUE',
        severity: 'blocker', field: 'config', reason: 'UNKNOWN_STRUCTURE_KEY' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers.some(item => item.code === 'SOURCE_CLASSIFICATION_INVALID')).toBe(!valid)
    if (valid) expect(artifact.blockers).toEqual([])
  })
  it.each(['valid', 'missing-store', 'forged-reason'])('checks shipping fallback against the actual Store row: %s', async kind => {
    // Arrange
    const storeId = kind === 'missing-store' ? '999' : '205'
    const input = await fixture({ rows: [{ table: 'store_deliveries', sourceId: '801', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } }], diagnostics: [{ table: 'store_deliveries', sourceId: storeId, storeId,
      code: 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', severity: 'warning', field: 'shipping_fee_config',
      reason: kind === 'forged-reason' ? 'INVALID_SOURCE_CONFIGURATION' : 'PROVIDER_OR_UNKNOWN_SOURCE_MODE' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers.some(item => item.code === 'SOURCE_CLASSIFICATION_INVALID')).toBe(kind !== 'valid')
    if (kind === 'valid') expect(artifact.blockers.map(item => item.code)).toContain('SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT')
  })
  it.each([true, false])('excludes typed Page ownership only for a known reason through the artifact collector (known=%s)', async known => {
    // Arrange
    const input = await fixture({ rows: [{ table: 'shortlist_items', sourceId: '1', storeId: null, record: 1, disposition: 'unresolved',
      fields: { id: 'source-identity', value: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'page_components', parentId: '999' } }],
      diagnostics: [{ table: 'shortlist_items', sourceId: '1', code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', reason: known ? 'OWNERSHIP_PARENT_UNVERIFIED' : 'UNREVIEWED_REASON' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers.some(item => item.code === 'SOURCE_OWNERSHIP_UNRESOLVED')).toBe(!known)
  })
  it('does not classify Product-owned shared settings as Page definitions', async () => {
    // Arrange
    const input = await fixture({ rows: [{ table: 'model_settings', sourceId: '1', storeId: null, record: 1, disposition: 'unresolved',
      fields: { id: 'source-identity', value: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'products', parentId: '999' } }],
      diagnostics: [{ table: 'model_settings', sourceId: '1', code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', field: 'value', reason: 'UNKNOWN_STRUCTURE_KEY' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers.map(item => item.code)).toContain('RAW_VALUE_UNVERIFIED')
  })
  it.each([true, false])('keeps intentional Banner ownership mismatch blocked without trusting other codes (exact=%s)', async exact => {
    // Arrange
    const code = exact ? 'RAW_OWNERSHIP_MISMATCH' : 'UNKNOWN_BANNER_ISSUE'
    const input = await fixture({ rows: [{ table: 'banners', sourceId: '1', storeId: '285', record: 1,
      disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '285', rule: 'SOURCE_STORE_ID' } }],
      diagnostics: [{ table: 'banners', sourceId: '1', storeId: '205', code, severity: 'blocker', field: 'store_id' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers.some(item => item.code === 'SOURCE_CLASSIFICATION_INVALID')).toBe(!exact)
    expect(artifact.blockers.map(item => item.code)).toContain(code)
  })
})


describe('[TC-F42-IMP-004/008] Selected master dependency scope', () => {
  const orphan = (sourceId = 'record:5753', parentId = '5753', record = 1): Row => ({
    table: 'model_has_roles', sourceId, storeId: null, record, disposition: 'unresolved',
    fields: { model_id: 'unresolved' }, contributions: [],
    ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'users', parentId },
  })
  const diagnostics: Diagnostic[] = [
    { code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table: 'model_has_roles', sourceId: 'record:5753', reason: 'OWNERSHIP_PARENT_UNVERIFIED' },
    { code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', table: 'model_has_roles' },
  ]
  it('keeps all three orphan diagnostics in the audit while allowing an unrelated selected master', async () => {
    // Arrange
    const input = await fixture({ rows: [orphan()], diagnostics })
    const prepared = await prepare(input)
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.diagnosticSummary.buckets.filter(bucket => bucket.diagnostic.table === 'model_has_roles')).toHaveLength(3)
    expect(artifact.diagnosticSummary.buckets.every(bucket => bucket.disposition === 'OUT_OF_SCOPE')).toBe(true)
    expect(artifact.diagnosticSummary.rawBlockers).toBe(2)
  })
  it.each(['createdBy', '_ref'])('still blocks a missing User referenced through %s in the selected master', async field => {
    // Arrange
    const input = await fixture({ rows: [orphan()], diagnostics, documents: [
      { storeId: '205', collection: 'users', documents: [{ _ref: '@users:users:500', [field]: '@users:users:5753' }] },
    ] })
    const prepared = await prepare(input)
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toHaveLength(3)
  })
  it('does not inherit dependencies from unselected Stores, but includes them for all selection', async () => {
    // Arrange
    const input = await fixture({ rows: [orphan()], diagnostics, documents: [
      { storeId: '285', collection: 'users', documents: [{ _ref: '@users:users:500', createdBy: '@users:users:5753' }] },
    ] })
    const prepared = await prepare(input)
    // Act
    const selected = await loadImportArtifact(prepared.manifestPath, { selector: { store: '205' } })
    const all = await loadImportArtifact(prepared.manifestPath, { selector: { all: true } })
    // Assert
    expect(selected.blockers).toEqual([])
    expect(all.blockers).toHaveLength(3)
  })
  it('retains a global summary when another unresolved row affects the selected Store', async () => {
    // Arrange
    const input = await fixture({ rows: [orphan(), orphan('record:999', '999', 2)], diagnostics, documents: [
      { storeId: '205', collection: 'users', documents: [{ _ref: '@users:users:500', createdBy: '@users:users:999' }] },
    ] })
    const prepared = await prepare(input)
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SOURCE_FIELDS_UNRESOLVED' }),
      expect.objectContaining({ code: 'REPORT_ROW_UNRESOLVED', sourceId: 'record:999' }),
    ]))
    expect(artifact.blockers.some(diagnostic => diagnostic.sourceId === 'record:5753')).toBe(false)
  })
  it.each([false, true])('includes only reachable external creator ancestry (reachable=%s)', async reachable => {
    // Arrange
    const actors = ['51', '5753'].map(id => ({
      _ref: `@users:users:${id}`, sourceId: id, name: `Synthetic actor ${id}`, email: `actor${id}@example.test`,
      ...(reachable && id === '51' ? { createdBy: '@users:users:5753' } : {}),
      source: { table: 'users', storeId: null, deletedAt: null, isFrontend: '0', status: '1',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', roles: [] },
    }))
    const input = await fixture({ rows: [orphan()], diagnostics, actors, documents: [
      { storeId: '205', collection: 'users', documents: [{ _ref: '@users:users:500', createdBy: '@users:users:51' }] },
    ] })
    const prepared = await prepare(input)
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toHaveLength(reachable ? 3 : 0)
  })
  it('limits all to emitted master Stores, retaining errors for a non-emitted Store only in the report', async () => {
    // Arrange
    const input = await fixture({ rows: [{ table: 'stores', sourceId: '409', storeId: '409', record: 3,
      disposition: 'unresolved', fields: { id: 'unresolved' }, contributions: [], ownership: { storeId: '409', rule: 'SOURCE_STORE_ID' } }],
      diagnostics: [{ code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', table: 'stores', storeId: '409' }],
      override: { blockedStores: ['409'], counts: { sourceStoreCount: 3, selectedStoreCount: 3, policyExcludedStoreCount: 0, emittedStoreCount: 2, blockedStoreCount: 1, blockers: 1 } },
    })
    const prepared = await prepare(input)
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { selector: { all: true } })
    // Assert
    expect(artifact.storeIds).toEqual(['205', '285'])
    expect(artifact.blockers).toEqual([])
    expect(artifact.diagnostics.some(diagnostic => diagnostic.storeId === '409')).toBe(true)
    await expect(loadImportArtifact(prepared.manifestPath, { selector: { store: '409' } })).rejects.toThrow('STORE_NOT_IN_ARTIFACT')
  })
  it('preserves a report contribution to the selected master as a dependency', async () => {
    // Arrange
    const row = orphan()
    row.contributions = [{ storeId: '205', table: row.table, sourceId: row.sourceId, fields: ['model_id'], targetPath: 'users[].roles', rule: 'MASTER-3.4' }]
    const input = await fixture({ rows: [row], diagnostics })
    const prepared = await prepare(input)
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toHaveLength(3)
  })
})


describe('[TC-F42-IMP-STATUS-001] Source-status exporter contract', () => {
  it('prepares and loads exporter 1.3 using the exact status contract', async () => {
    // Arrange
    const input = await fixture({ override: { exporterVersion: '1.3.0', contractSha256: STATUS_MAPPING_HASH } })
    // Act
    const prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest).toMatchObject({ version: 3, mappingHash: STATUS_MAPPING_HASH })
  })
  it('rejects the new status contract on an old exporter version', async () => {
    // Arrange
    const input = await fixture({ override: { contractSha256: STATUS_MAPPING_HASH } })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('EXPORT_MANIFEST_INVALID')
  })
})

 describe('[TC-F42-IMP-ARCHIVE-001] External CSV contract', () => {
  const rule = 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE'
  const row = (): Row => ({ table: 'products', sourceId: '101', storeId: '205', record: 1,
    disposition: 'retained-source', fields: { description: 'retained-source' },
    ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' }, fieldRetentionRules: { description: rule },
    contributions: [{ storeId: '205', table: 'products', sourceId: '101', fields: ['description'], targetPath: 'source-csv.products', rule }],
  })
  it('prepares and loads 1.4 without embedded source, preserving external CSV evidence', async () => {
    // Arrange
    const input = await fixture({ rows: [row()], override: { exporterVersion: '1.4.0', contractSha256: ARCHIVE_MAPPING_HASH } })
    // Act
    const prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest.mappingHash).toBe(ARCHIVE_MAPPING_HASH)
    expect(artifact.blockers).toEqual([])
  })
  it.each(['missing-evidence', 'wrong-path', 'secret-field'])('rejects invalid external retention: %s', async mutation => {
    // Arrange
    const source = row()
    if (mutation === 'missing-evidence') source.contributions = []
    if (mutation === 'wrong-path') source.contributions = [{ storeId: '205', table: 'products', sourceId: '101', fields: ['description'], targetPath: 'source-csv.users', rule }]
    if (mutation === 'secret-field') { source.fields = { password: 'retained-source' }; source.fieldRetentionRules = { password: rule } }
    const input = await fixture({ rows: [source], override: { exporterVersion: '1.4.0', contractSha256: ARCHIVE_MAPPING_HASH } })
    // Act
    const prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_CLASSIFICATION_INVALID' })]))
  })
  it('rejects an archive contract paired with an earlier exporter', async () => {
    // Arrange
    const input = await fixture({ override: { exporterVersion: '1.3.0', contractSha256: ARCHIVE_MAPPING_HASH } })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('EXPORT_MANIFEST_INVALID')
  })
})

describe('[TC-F42-IMP-OUTCOME-001] Published artifact with partial data', () => {
  async function outcomeFixture() {
    const diagnostics: Diagnostic[] = [
      { code: 'PRODUCT_DESCRIPTION_STYLE_FIDELITY', severity: 'blocker', table: 'products', storeId: '205', sourceId: '4', field: 'description' },
      { code: 'PRODUCT_DESCRIPTION_LINK_UNSAFE', severity: 'blocker', table: 'products', storeId: '205', sourceId: '4', field: 'description' },
    ]
    const input = await fixture({ diagnostics, override: { exporterVersion: '1.5.0', contractSha256: OUTCOME_MAPPING_HASH, status: 'exported', outcome: exportOutcome(diagnostics, 0, 0) } })
    const review = exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': reviewMarkdown(review) })) {
      await writeFile(join(input.source, name), bytes, { mode: 0o600 })
      input.manifest.artifacts[name] = digest(bytes)
    }
    await input.saveManifest()
    return input
  }
  it('accepts successful export without treating partial data as import-ready', async () => {
    // Arrange
    const input = await outcomeFixture()
    // Act
    const prepared = await prepare(input), artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest.mappingHash).toBe(OUTCOME_MAPPING_HASH)
    expect(artifact.blockers.some(d => d.code === 'PRODUCT_DESCRIPTION_STYLE_FIDELITY')).toBe(false)
    expect(artifact.blockers.some(d => d.code === 'PRODUCT_DESCRIPTION_LINK_UNSAFE')).toBe(true)
  })
  it('rejects false completeness metadata', async () => {
    // Arrange
    const input = await outcomeFixture()
    await writeFile(join(input.source, 'master-manifest.json'), JSON.stringify({ ...input.manifest, outcome: { ...exportOutcome([], 0, 0) } }), { mode: 0o600 })
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('EXPORT_OUTCOME_INCONSISTENT')
  })
})

describe('[TC-F42-IMP-OUTCOME-002] Corrected contract acceptance', () => {
  it.each([['1.5.1', CORRECTED_OUTCOME_MAPPING_HASH], ['1.6.0', DESCRIPTION_MAPPING_HASH], ['1.6.1', BLOG_OWNER_MAPPING_HASH], ['1.6.2', BLOG_CONTENT_MAPPING_HASH], ['1.7.0', VARIANT_MAPPING_HASH], ['1.8.0', PRODUCT_EXCLUSION_MAPPING_HASH], ['1.8.1', BLOG_CATEGORY_MAPPING_HASH]])('prepares %s and retains warning-based target checks [TC-F42-IMP-DESCRIPTION-001]', async (version, mappingHash) => {
    // Arrange
    const diagnostics: Diagnostic[] = [{ code: 'ORDER_PAYMENT_METHOD_UNVERIFIED', severity: 'warning', table: 'orders', storeId: '205', sourceId: '4', field: 'payment_method_id' }]
    const input = await fixture({ diagnostics, override: { exporterVersion: version, contractSha256: mappingHash, status: 'exported', outcome: correctedOutcome.exportOutcome(diagnostics, 0, []) } })
    const review = correctedOutcome.exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) {
      await writeFile(join(input.source, name), bytes, { mode: 0o600 }); input.manifest.artifacts[name] = digest(bytes)
    }
    await input.saveManifest()
    // Act
    const prepared = await prepare(input), artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest.mappingHash).toBe(mappingHash)
    expect(artifact.diagnosticSummary?.buckets).toEqual(expect.arrayContaining([expect.objectContaining({ disposition: 'TARGET_CHECK_REQUIRED' })]))
    // Rehashed false summary must still be rejected.
    await writeFile(join(input.source, 'master-manifest.json'), JSON.stringify({ ...input.manifest, outcome: correctedOutcome.exportOutcome([], 0, []) }))
    await expect(prepareImportArtifact({ exportArtifact: input.source, output: join(input.root, 'invalid') })).rejects.toThrow('EXPORT_OUTCOME_INCONSISTENT')
  })
})


describe('[TC-F42-IMP-EXCLUSION-001] Missing Product data policy through prepare/load', () => {
  it.each([false,true])('accepts exact verified exclusion; forged reason=%s', async forged => {
    // Arrange
    const diagnostics: Diagnostic[] = [{code:'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED',severity:'warning',storeId:'205',table:'products',sourceId:'20',reason:'MISSING_PRICE'}]
    const rule='MASTER-5.2-PRODUCT-MISSING-PRICE-STOCK'
    const rows: Row[] = [{table:'products',sourceId:'20',storeId:'205',record:1,disposition:'retained-source',fields:{id:'retained-source',store_id:'retained-source'},fieldRetentionRules:{id:rule,store_id:rule},ownership:{storeId:'205',rule:'SOURCE_STORE_ID'},contributions:[],productExclusion:{productId:'20',reason:forged?'MISSING_STOCK':'MISSING_PRICE'}}]
    const input=await fixture({rows,diagnostics,products:[{storeId:'205',sourceProductId:'20',emitted:false,targetRef:null,eligibleSkuCount:0,tiers:[],skus:[],errors:['PRODUCT_NOT_EMITTED']}],override:{exporterVersion:'1.8.0',contractSha256:PRODUCT_EXCLUSION_MAPPING_HASH,status:'exported',outcome:correctedOutcome.exportOutcome(diagnostics,0,[])}})
    const review=correctedOutcome.exportReview(diagnostics,[],[])
    for(const [name,bytes] of Object.entries({'export-review.json':JSON.stringify(review),'export-review.md':correctedOutcome.reviewMarkdown(review)})){await writeFile(join(input.source,name),bytes);input.manifest.artifacts[name]=digest(bytes)}
    await input.saveManifest()
    // Act / Assert
    if(forged) await expect(prepare(input)).rejects.toThrow('PRODUCT_EXCLUSION_EVIDENCE_INVALID')
    else {const prepared=await prepare(input);const artifact=await loadImportArtifact(prepared.manifestPath);expect(artifact.blockers).toEqual([])}
  })
})
