import { SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH } from '@/lib/migration/pw1-json/classification'
import { MODEL_SETTINGS_MAPPING_HASH } from '@/lib/migration/pw1-json/classification'
import { masterSetHash, type MasterPart } from '@/lib/migration/pw1-json/master-parts'
import * as correctedOutcome from '@/lib/migration/pw1-json/export-outcome'
import { exportOutcome, exportReview, reviewMarkdown } from '@/lib/migration/pw1-json/export-outcome-v1'
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadImportArtifact, readImportStore, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH, POLICY_BOUNDARY_MAPPING_HASH, BLOG_CATEGORY_MAPPING_HASH, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH } from '@/lib/migration/pw1-json/artifact'
import { loadCredentialSidecar, prepareImportArtifact } from '@/lib/migration/pw1-json/credentials'
import { checksum } from '@/lib/migration/pw1-json/projection'
import { PENDING_POLICY_KEYS } from '@/lib/migration/pw1-json/diagnostics'
import { COLLECTIONS } from '@/lib/migration/pw1-json/types'

const CONTRACT = '27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
interface Row {
  table: string; sourceId: string; storeId: string | null; record: number; disposition: string
  fields: Record<string, string>; contributions: unknown[]
  ownership?: { storeId: string | null; rule: string; parentTable?: string; parentId?: string }
  sourceExclusion?: {table:string;sourceId:string;storeId:string;reason:string}
  productExclusion?: {productId:string;reason:string;canonicalProductId?:string}
  fieldRetentionRules?: Record<string, string>
}
interface Diagnostic { code: string; severity: 'warning' | 'blocker'; storeId?: string; table?: string; sourceId?: string; field?: string; reason?: string }
const snapshot = { sourceInstance: 'synthetic-v3', sourceDatabase: 'synthetic', sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v3', asOf: '2026-09-17T00:00:00Z' }
const emptyDiagnostics = () => ({ customerCrosswalk: [], addressDispositions: [], rankDispositions: [], rankConflicts: [], profileConflicts: [] })
const emptyCustomerStore = (storeId: string) => ({ storeId, status: 'reconciled', retainedSourceRows: [], quarantinedCustomerRefs: [], diagnostics: emptyDiagnostics() })
async function fixture(options: { storeIds?: string[]; sourceSnapshot?: typeof snapshot; actors?: unknown[]; rows?: Row[]; diagnostics?: Diagnostic[]; customerStores?: unknown[]; products?: unknown[]; documents?: { storeId: string; collection: string; documents: unknown[] }[]; override?: Record<string, unknown> } = {}) {
  const fixtureStores = options.storeIds ?? ['205','285']
  const sourceSnapshot = options.sourceSnapshot ?? snapshot
  const root = await mkdtemp(join(tmpdir(), 'pw1-json-v3-test-')); roots.push(root)
  const source = join(root, 'export'); await mkdir(source, { mode: 0o700 })
  const rows: Row[] = fixtureStores.map((id, i) => ({ table: 'stores', sourceId: id, storeId: id, record: i + 1,
    disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: id, rule: 'SOURCE_STORE_ID' } }))
  rows.push(...(options.rows ?? []))
  const diagnostics = options.diagnostics ?? []
  const master: Record<string, unknown[]>[] = fixtureStores.map(id => ({ ...Object.fromEntries(COLLECTIONS.map(collection => [collection, []])),
    tenants: [{ _ref: `@tenants:stores:${id}`, metaData: { pw1StoreId: id } }], sites: [{ _ref: `@sites:stores:${id}`, tenant: `@tenants:stores:${id}` }] }))
  for (const addition of options.documents ?? []) {
    const index = fixtureStores.indexOf(addition.storeId)
    if (index < 0) throw new Error('UNKNOWN_FIXTURE_STORE')
    master[index][addition.collection] = addition.documents
  }
  const files: Record<string, string> = {
    'master.json': JSON.stringify(master), 'mapping-report.json': JSON.stringify({ version: 1, diagnostics, rows }),
    'mapping-report.csv': 'table\n', 'README.md': 'Synthetic v3 reconciliation contract fixture',
    'user-actors.json': JSON.stringify({ version: 1, purpose: 'creator-target-binding-required', sourceInstanceToken: sourceSnapshot.sourceInstanceToken, snapshotId: sourceSnapshot.snapshotId, actors: options.actors ?? [] }),
    'customer-reconciliation.json': JSON.stringify({ version: 1, sourceSnapshot, archiveStorage: 'external-source-csv', stores: options.customerStores ?? fixtureStores.map(emptyCustomerStore) }),
    'product-reconciliation.json': JSON.stringify({ version: 1, sourceSnapshot, products: options.products ?? [] }),
  }
  for (const [name, value] of Object.entries(files)) await writeFile(join(source, name), value, { mode: 0o600 })
  const tables = [...new Set(rows.map(row => row.table))]
  const inventory = tables.map(table => { const entries = rows.filter(row => row.table === table); return { table, filename: `${table}.csv`,
    sha256: digest(`synthetic-${table}`), bytes: 1, selected: true, rowCount: entries.length, headers: Object.keys(entries[0].fields) } })
  const blockers = diagnostics.filter(row => row.severity === 'blocker').length
  const manifest = { version: 1, exporterVersion: '1.2.0', classificationVersion: 'source-classification-v1', contractSha256: CONTRACT,
    sourceConfigSha256: digest('synthetic-config'), sourceSnapshot, files: inventory,
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
  it.each(['page_components','menu_lines','stores'])('accepts exact historical raw setting receipts owned by %s while excluding the unresolved value',async parentTable=>{
    // Arrange
    const parentId=parentTable==='stores'?'205':'880'
    const parents:Row[]=parentTable==='page_components'?[{table:'pages',sourceId:'879',storeId:'205',record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_STORE_ID'}},{table:'page_components',sourceId:parentId,storeId:'205',record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_PARENT_RELATION',parentTable:'pages',parentId:'879'}}]:parentTable==='menu_lines'?[{table:'menus',sourceId:'878',storeId:'205',record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_STORE_ID'}},{table:'menu_items',sourceId:'879',storeId:'205',record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_PARENT_RELATION',parentTable:'menus',parentId:'878'}},{table:'menu_lines',sourceId:parentId,storeId:'205',record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_PARENT_RELATION',parentTable:'menu_items',parentId:'879'}}]:[]
    const row:Row={table:'model_settings',sourceId:'901',storeId:'205',record:1,disposition:'partial',fields:{id:'mapped',model_id:'mapped',model_type:'mapped',value:'unresolved'},contributions:[{storeId:'205',table:'model_settings',sourceId:'901',fields:parentTable==='stores'?['model_type','model_id']:['id','model_id','model_type'],targetPath:parentTable==='stores'?'sites.pw1_source.model_settings':parentTable==='page_components'?'pages.components.model_settings':'sites.menus.MenuLine.model_settings',rule:parentTable==='stores'?'MASTER_RAW_STORE_MODEL_OWNERSHIP':'MASTER_RAW_ALLOWLIST'}],ownership:{storeId:'205',rule:'SOURCE_PARENT_RELATION',parentTable,parentId}}
    const input=await fixture({rows:[...parents,row],diagnostics:[{code:'RAW_VALUE_UNVERIFIED',severity:'blocker',table:'model_settings',storeId:'205',sourceId:'901',field:'value',reason:'UNKNOWN_SETTING_KEY'}]})
    // Act / Assert
    const prepared=await prepare(input)
    expect((await loadImportArtifact(prepared.manifestPath)).blockers).toEqual([])
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
  it.each([false, true])('excludes all settings after verifying source ownership evidence (mixed=%s)', async mixed => {
    // Arrange
    const rows: Row[] = [{ table: 'model_settings', sourceId: '404', storeId: null, record: 1, disposition: 'unresolved',
      fields: { id: 'source-identity', value: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'page_components', parentId: '999' } }]
    if (mixed) rows.push({ ...rows[0], sourceId: '405', record: 2, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'products', parentId: '999' } })
    const diagnostics: Diagnostic[] = rows.map(row => ({ code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table: 'model_settings', sourceId: row.sourceId, reason: 'OWNERSHIP_PARENT_UNVERIFIED' }))
    diagnostics.push({ code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', table: 'model_settings' })
    const input = await fixture({ rows, diagnostics })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual([])
  })
  it.each(['UNKNOWN_SETTING_KEY','INVALID_JSON','UNSAFE_URL'])('excludes non-Page setting value diagnostics with verified source identity (%s)', async reason => {
    // Arrange
    const row: Row = { table:'model_settings',sourceId:'901',storeId:'205',record:1,disposition:'unresolved',fields:{id:'source-identity',value:'unresolved'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_PARENT_RELATION',parentTable:'stores',parentId:'205'} }
    const input=await fixture({rows:[row],diagnostics:[{code:'RAW_VALUE_UNVERIFIED',severity:'blocker',table:'model_settings',storeId:'205',sourceId:'901',field:'value',reason},{code:'SOURCE_FIELDS_UNRESOLVED',severity:'blocker',table:'model_settings',storeId:'205'}]})
    // Act / Assert
    const prepared=await prepare(input)
    expect((await loadImportArtifact(prepared.manifestPath,{storeIds:['205']})).blockers).toEqual([])
  })
  it.each(['wrong-store','unknown-source','invalid-retention','forged-contribution'])('does not waive forged setting evidence (%s)',async mutation=>{
    // Arrange
    const row: Row = { table:'model_settings',sourceId:'901',storeId:'205',record:1,disposition:'unresolved',fields:{id:'source-identity',value:'unresolved'},contributions:[],ownership:{storeId:'205',rule:'SOURCE_PARENT_RELATION',parentTable:'stores',parentId:'205'} }
    if(mutation==='forged-contribution')row.contributions=[{storeId:'205',table:'model_settings',sourceId:'901',fields:['value'],targetPath:'products',rule:'MASTER-5'}]
    if(mutation==='invalid-retention'){row.fields.value='retained-source';row.fieldRetentionRules={value:'MASTER-UNKNOWN-ALLOW-ALL'}}
    const input=await fixture({rows:[row],diagnostics:[{code:'RAW_VALUE_UNVERIFIED',severity:'blocker',table:'model_settings',storeId:mutation==='wrong-store'?'285':'205',sourceId:mutation==='unknown-source'?'902':'901',field:'value',reason:'UNKNOWN_SETTING_KEY'}]})
    // Act / Assert
    const prepared=await prepare(input)
    expect((await loadImportArtifact(prepared.manifestPath)).blockers).toEqual(expect.arrayContaining([expect.objectContaining({code:'SOURCE_CLASSIFICATION_INVALID'})]))
  })
  it.each(['DEFAULT_DOMAIN_AMBIGUOUS','SOURCE_MAIN_DOMAIN_AMBIGUOUS'])('binds aggregate domain warning %s to its Store rather than a colliding domain ID',async code=>{
    // Arrange
    const row:Row={table:'store_domains',sourceId:'205',storeId:'285',record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId:'285',rule:'SOURCE_STORE_ID'}}
    const diagnostic:Diagnostic={code,severity:'warning',table:'store_domains',sourceId:'205',storeId:'205',reason:code==='DEFAULT_DOMAIN_AMBIGUOUS'?'PLATFORM_DOMAIN_FALLBACK':'CUSTOM_DOMAINS_PENDING'}
    const input=await fixture({rows:[row],diagnostics:[diagnostic]})
    // Act / Assert
    const prepared=await prepare(input)
    expect((await loadImportArtifact(prepared.manifestPath)).blockers.some(d=>d.code==='SOURCE_CLASSIFICATION_INVALID')).toBe(false)
    diagnostic.reason='UNRECOGNIZED_REASON'
    const forged=await fixture({rows:[row],diagnostics:[diagnostic]})
    const forgedPrepared=await prepare(forged)
    expect((await loadImportArtifact(forgedPrepared.manifestPath)).blockers.some(d=>d.code==='SOURCE_CLASSIFICATION_INVALID')).toBe(true)
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
    expect(actual.blockers).toEqual([])
    expect(actual.diagnosticSummary?.buckets.find(bucket => bucket.diagnostic.code === 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT')?.disposition).toBe('APPROVED_POLICY')
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
    if (kind === 'valid') expect(artifact.diagnosticSummary?.buckets.find(bucket => bucket.diagnostic.code === 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT')?.disposition).toBe('APPROVED_POLICY')
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
  it('excludes Product-owned settings with truthful unresolved parent evidence', async () => {
    // Arrange
    const input = await fixture({ rows: [{ table: 'model_settings', sourceId: '1', storeId: null, record: 1, disposition: 'unresolved',
      fields: { id: 'source-identity', value: 'unresolved' }, contributions: [], ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'products', parentId: '999' } }],
      diagnostics: [{ table: 'model_settings', sourceId: '1', code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', field: 'value', reason: 'UNKNOWN_STRUCTURE_KEY' }] })
    // Act
    const prepared = await prepare(input); const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.blockers).toEqual([])
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
  it.each([['1.5.1', CORRECTED_OUTCOME_MAPPING_HASH], ['1.6.0', DESCRIPTION_MAPPING_HASH], ['1.6.1', BLOG_OWNER_MAPPING_HASH], ['1.6.2', BLOG_CONTENT_MAPPING_HASH], ['1.7.0', VARIANT_MAPPING_HASH], ['1.8.0', PRODUCT_EXCLUSION_MAPPING_HASH], ['1.8.1', BLOG_CATEGORY_MAPPING_HASH], ['1.8.2', POLICY_BOUNDARY_MAPPING_HASH]])('prepares %s and retains warning-based target checks [TC-F42-IMP-DESCRIPTION-001]', async (version, mappingHash) => {
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


describe('[TC-F42-IMP-POLICY-001] Reserved flags through artifact prepare/load', () => {
  it('loads disabled flags and rejects each true flag in a rewritten manifest', async () => {
    // Arrange
    const input = await fixture({ override: { exporterVersion: '1.8.2', contractSha256: POLICY_BOUNDARY_MAPPING_HASH, status: 'exported', outcome: correctedOutcome.exportOutcome([], 0, []) } })
    Object.assign(input.manifest.migrationPolicy, Object.fromEntries(PENDING_POLICY_KEYS.map(key => [key, false])))
    const review = correctedOutcome.exportReview([], [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) {
      await writeFile(join(input.source, name), bytes); input.manifest.artifacts[name] = digest(bytes)
    }
    await input.saveManifest()
    // Act / Assert
    const prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    expect(artifact.manifest.mappingHash).toBe(POLICY_BOUNDARY_MAPPING_HASH)
    expect(artifact.manifest.migrationPolicyHash).toBe(checksum(input.manifest.migrationPolicy))
    for (const key of PENDING_POLICY_KEYS) {
      await writeFile(join(input.source, 'master-manifest.json'), JSON.stringify({ ...input.manifest, migrationPolicy: { ...input.manifest.migrationPolicy, [key]: true } }))
      await expect(prepareImportArtifact({ exportArtifact: input.source, output: join(input.root, key) })).rejects.toThrow('EXPORT_MANIFEST_INVALID')
    }
  })
})


describe('[TC-F42-IMP-USERS-SCOPE] Temporary foundation loader', () => {
  it('ignores unrelated receipts while preserving full-import validation', async () => {
    // Arrange
    const input = await fixture()
    const prepared = await prepare(input)
    await writeFile(join(input.output, 'product-reconciliation.json'), '{}')
    await writeFile(join(input.output, 'mapping-report.json'), '{}')
    const progress = vi.fn()
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { scope: 'foundation', selector: { store: '205' }, progress })
    // Assert
    expect(artifact.stores.map(store => store.storeId)).toEqual(['205'])
    expect(artifact.stores[0].collections.tenants).toHaveLength(1)
    expect(artifact.stores[0].collections.products).toEqual([])
    expect(progress.mock.calls.map(([event]) => event.file)).not.toContain('mapping-report.json')
    expect(progress.mock.calls.map(([event]) => event.file)).not.toContain('product-reconciliation.json')
    await expect(loadImportArtifact(prepared.manifestPath)).rejects.toThrow()
  })
  it('still rejects tampered master in foundation scope', async () => {
    // Arrange
    const input = await fixture()
    const prepared = await prepare(input)
    await writeFile(join(input.output, 'master.json'), '[]')
    // Act / Assert
    await expect(loadImportArtifact(prepared.manifestPath, { scope: 'foundation' })).rejects.toThrow('ARTIFACT_HASH_MISMATCH')
  })
})


describe('[TC-F42-IMP-POLICY-003] Owner/email artifact handoff', () => {
  const policy = {"decisionEvidence": "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history. User decision 2026-09-23: temporarily defer PROD Stores 54 and 161 because original backend owners 118 and 343 are soft-deleted; preserve source data, omit these Stores from master JSON, report policy exclusion without blocking other Stores.", "activeCatalogOnly": true, "deferEmailTemplates": true, "allowSparseVariants": true, "preserveUserCreators": true, "siteTypeDefault": "ecommerce", "siteTypeOverrides": {}, "shippingPolicy": "pw2-defaults", "promoteActiveCategoriesToRoot": true, "deferredStoreIds": ["54", "161", "323"], "preserveHistoricalOrders": true, "gracefulTenantResolution": true, "resolveDuplicateSkus": true, "resolveDuplicateVariantTuples": true, "treatSingleSkuWithoutSelectionsAsSimple": true, "pruneUnreferencedTiers": true, "allowInactiveSkusForInactiveProduct": true, "resolveDuplicateCategorySlugs": true, "resolveDuplicateCategoryNames": true, "flattenBlogCategoriesToRoot": true, "resolveDuplicateBlogCategorySlugs": true, "resolveDuplicateBlogSlugs": true, "allowCustomerAddressOverflow": true, "allowInvalidCustomerAddresses": true, "allowHistoricalDiscountEligibilityGap": true, "preserveRefundedOrdersWithoutEvidence": true, "skipInvalidDiscountCodes": true, "allowUnresolvedBlogMedia": true, "fallbackBlogAuthorToOwner": true, "allowContactStructureGap": true, "allowBracketedProductNames": true, "pruneInvalidVariantSkus": true, "selectOldestOwner": true, "preserveInvalidUserEmails": true}
  async function currentFixture(enabled = true) {
    const diagnostics: Diagnostic[] = [{ code: 'USER_EMAIL_INVALID', severity: 'warning', storeId: '205', sourceId: '9', table: 'users', field: 'email', reason: 'SOURCE_EMAIL_PRESERVED' }]
    const input = await fixture({ diagnostics, override: { exporterVersion: '1.9.1', contractSha256: OWNER_EMAIL_MAPPING_HASH, migrationPolicy: { ...policy, preserveInvalidUserEmails: enabled }, status: 'exported', outcome: correctedOutcome.exportOutcome(diagnostics, 0, []) } })
    const review = correctedOutcome.exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) {
      await writeFile(join(input.source, name), bytes)
      input.manifest.artifacts[name] = digest(bytes)
    }
    await input.saveManifest()
    return input
  }
  it('prepares and loads approved policy capability, without weakening disabled policy or historical contracts', async () => {
    // Arrange / Act
    const enabled = await prepare(await currentFixture())
    const artifact = await loadImportArtifact(enabled.manifestPath)
    const disabled = await prepare(await currentFixture(false))
    const blocked = await loadImportArtifact(disabled.manifestPath)
    // Assert
    expect(artifact.preserveInvalidUserEmails).toBe(true)
    expect(artifact.blockers).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'USER_EMAIL_INVALID' })]))
    expect(blocked.preserveInvalidUserEmails).toBe(false)
    expect(blocked.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'USER_EMAIL_INVALID' })]))
    const old = await currentFixture()
    old.manifest.exporterVersion = '1.9.0'; old.manifest.contractSha256 = CONFLICT_RESOLUTION_MAPPING_HASH
    await old.saveManifest()
    await expect(prepare(old)).rejects.toThrow('EXPORT_MANIFEST_INVALID')
  })
})


describe('[TC-F42-IMP-POLICY-004] Catalog exclusion artifact handoff', () => {
  const policy = {"decisionEvidence": "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history. User decision 2026-09-23: temporarily defer PROD Stores 54 and 161 because original backend owners 118 and 343 are soft-deleted; preserve source data, omit these Stores from master JSON, report policy exclusion without blocking other Stores.", "activeCatalogOnly": true, "deferEmailTemplates": true, "allowSparseVariants": true, "preserveUserCreators": true, "siteTypeDefault": "ecommerce", "siteTypeOverrides": {}, "shippingPolicy": "pw2-defaults", "promoteActiveCategoriesToRoot": true, "deferredStoreIds": ["54", "161", "323"], "preserveHistoricalOrders": true, "gracefulTenantResolution": true, "resolveDuplicateSkus": true, "resolveDuplicateVariantTuples": true, "treatSingleSkuWithoutSelectionsAsSimple": true, "pruneUnreferencedTiers": true, "allowInactiveSkusForInactiveProduct": true, "resolveDuplicateCategorySlugs": true, "resolveDuplicateCategoryNames": true, "flattenBlogCategoriesToRoot": true, "resolveDuplicateBlogCategorySlugs": true, "resolveDuplicateBlogSlugs": true, "allowCustomerAddressOverflow": true, "allowInvalidCustomerAddresses": true, "allowHistoricalDiscountEligibilityGap": true, "preserveRefundedOrdersWithoutEvidence": true, "skipInvalidDiscountCodes": true, "allowUnresolvedBlogMedia": true, "fallbackBlogAuthorToOwner": true, "allowContactStructureGap": true, "allowBracketedProductNames": true, "pruneInvalidVariantSkus": true, "selectOldestOwner": true, "preserveInvalidUserEmails": true, "excludeDuplicateProductSlugs": true, "excludeProductsWithoutValidVariants": true}
  async function catalogFixture(enabled = true, reason = 'DUPLICATE_PRODUCT_SLUG') {
    const rule = 'MASTER-5.2-PRODUCT-CATALOG-POLICY'
    const diagnostics: Diagnostic[] = [{ code: 'PRODUCT_CATALOG_POLICY_EXCLUDED', severity: 'warning', storeId: '205', sourceId: '20', table: 'products', reason }]
    const rows: Row[] = [
      { table: 'products', sourceId: '10', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } },
      { table: 'products', sourceId: '20', storeId: '205', record: 2, disposition: 'retained-source', fields: { id: 'retained-source' }, fieldRetentionRules: { id: rule }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' }, productExclusion: { productId: '20', reason, ...(reason === 'DUPLICATE_PRODUCT_SLUG' ? { canonicalProductId: '10' } : {}) } },
    ]
    const input = await fixture({ rows, diagnostics, products: [{ storeId: '205', sourceProductId: '20', emitted: false, targetRef: null, eligibleSkuCount: 0, tiers: [], skus: [], errors: ['PRODUCT_NOT_EMITTED'] }], override: { exporterVersion: '1.9.2', contractSha256: PRODUCT_CATALOG_MAPPING_HASH, migrationPolicy: { ...policy, excludeDuplicateProductSlugs: enabled, excludeProductsWithoutValidVariants: enabled }, status: 'exported', outcome: correctedOutcome.exportOutcome(diagnostics, 0, []) } })
    const review = correctedOutcome.exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) {
      await writeFile(join(input.source, name), bytes); input.manifest.artifacts[name] = digest(bytes)
    }
    await input.saveManifest()
    return input
  }
  it.each(['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN'])('loads approved %s without emitting excluded Product', async reason => {
    // Arrange / Act
    const input = await catalogFixture(true, reason), prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.stores.every(store => store.collections.products.length === 0)).toBe(true)
    expect(artifact.manifest.mappingHash).toBe(PRODUCT_CATALOG_MAPPING_HASH)
  })
  it('rejects policy-disabled and historical manifests carrying new exclusion evidence', async () => {
    // Arrange / Act / Assert
    await expect(prepare(await catalogFixture(false))).rejects.toThrow('PRODUCT_EXCLUSION_EVIDENCE_INVALID')
    const historical = await catalogFixture()
    historical.manifest.exporterVersion = '1.9.1'; historical.manifest.contractSha256 = OWNER_EMAIL_MAPPING_HASH
    await historical.saveManifest()
    await expect(prepare(historical)).rejects.toThrow('EXPORT_MANIFEST_INVALID')
    const legacyPolicy = { ...policy }
    delete (legacyPolicy as Partial<typeof policy>).excludeDuplicateProductSlugs
    delete (legacyPolicy as Partial<typeof policy>).excludeProductsWithoutValidVariants
    Object.assign(historical.manifest, { migrationPolicy: legacyPolicy })
    await historical.saveManifest()
    await expect(prepare(historical)).rejects.toThrow('PRODUCT_EXCLUSION_EVIDENCE_INVALID')
  })
})


describe('[TC-F42-IMP-POLICY-005] Source omission handoff requires verified family proof', () => {
  const policy = {"decisionEvidence": "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history. User decision 2026-09-23: temporarily defer PROD Stores 54 and 161 because original backend owners 118 and 343 are soft-deleted; preserve source data, omit these Stores from master JSON, report policy exclusion without blocking other Stores.", "activeCatalogOnly": true, "deferEmailTemplates": true, "allowSparseVariants": true, "preserveUserCreators": true, "siteTypeDefault": "ecommerce", "siteTypeOverrides": {}, "shippingPolicy": "pw2-defaults", "promoteActiveCategoriesToRoot": true, "deferredStoreIds": ["54", "161", "323"], "preserveHistoricalOrders": true, "gracefulTenantResolution": true, "resolveDuplicateSkus": true, "resolveDuplicateVariantTuples": true, "treatSingleSkuWithoutSelectionsAsSimple": true, "pruneUnreferencedTiers": true, "allowInactiveSkusForInactiveProduct": true, "resolveDuplicateCategorySlugs": true, "resolveDuplicateCategoryNames": true, "flattenBlogCategoriesToRoot": true, "resolveDuplicateBlogCategorySlugs": true, "resolveDuplicateBlogSlugs": true, "allowCustomerAddressOverflow": true, "allowInvalidCustomerAddresses": true, "allowHistoricalDiscountEligibilityGap": true, "preserveRefundedOrdersWithoutEvidence": true, "skipInvalidDiscountCodes": true, "allowUnresolvedBlogMedia": true, "fallbackBlogAuthorToOwner": true, "allowContactStructureGap": true, "allowBracketedProductNames": true, "pruneInvalidVariantSkus": true, "selectOldestOwner": true, "preserveInvalidUserEmails": true, "excludeDuplicateProductSlugs": true, "excludeProductsWithoutValidVariants": true, "excludeInvalidProducts": true, "excludeInvalidBlogs": true, "skipUnverifiedOrders": true, "omitUnmappablePayments": true}
  async function omissionFixture(table = 'products', reason = 'PRODUCT_NAME_TOO_SHORT', mode = 'valid') {
    const rule = 'MASTER-APPROVED-SOURCE-ENTITY-EXCLUSION'
    const exclusion = { table, sourceId: '20', storeId: '205', reason }
    const rows: Row[] = [{ table, sourceId: '20', storeId: '205', record: 1, disposition: 'retained-source', fields: { id: 'retained-source' }, fieldRetentionRules: { id: rule }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' }, sourceExclusion: exclusion }]
    const diagnostics: Diagnostic[] = [{ code: 'SOURCE_ENTITY_EXCLUDED', severity: 'warning', table, storeId: '205', sourceId: '20', reason }]
    if (mode === 'ownership-conflict' || mode === 'forged-ownership') {
      rows.push({ table: 'product_skus', sourceId: '30', storeId: null, record: 1, disposition: 'retained-source', fields: { id: 'retained-source' }, fieldRetentionRules: { id: rule }, contributions: [], ownership: { storeId: null, rule: mode === 'forged-ownership' ? 'OWNERSHIP_PARENT_UNVERIFIED' : 'OWNERSHIP_STORE_CONFLICT', parentTable: 'products', parentId: '20' }, sourceExclusion: exclusion })
      diagnostics.push({ code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'warning', table: 'product_skus', sourceId: '30', reason: rows[1].ownership!.rule })
    }
    if (mode === 'missing-root') rows.length = 0
    if (mode === 'wrong-fields') rows[0].fields.id = 'mapped'
    if (mode === 'operational-error') diagnostics.push({ code: 'PRODUCT_MAPPING_INVALID', severity: 'blocker', table: 'products', storeId: '205', sourceId: '20', reason: 'UNEXPECTED_MAPPING_ERROR' })
    const gatewayValue = mode === 'enabled-gateway'
    const documents = table === 'store_payments' ? [
      { storeId: '205', collection: 'tenants', documents: [{ _ref: '@tenants:stores:205', metaData: { pw1StoreId: '205' }, payments: { payment_card: gatewayValue, payment_fpx: false, payment_qr: false } }] },
      { storeId: '205', collection: 'sites', documents: [{ _ref: '@sites:stores:205', tenant: '@tenants:stores:205', paymentConfig: { cardEnabled: gatewayValue, fpxEnabled: false, enableQrBanking: false } }] },
    ] : []
    if (mode === 'order-snapshot' || mode === 'order-dangling') {
      rows.push({ table: 'orders', sourceId: '90', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } })
      diagnostics.push({ code: 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', severity: 'warning', table: 'orders', storeId: '205', sourceId: '90', field: 'items.product', reason: 'SOURCE_PRODUCT_EXCLUDED' })
      documents.push({ storeId: '205', collection: 'orders', documents: [{ _ref: '@orders:orders:90', tenant: '@tenants:stores:205', items: [{ productName: 'Historical product', quantity: 1, unitPrice: 12.5, ...(mode === 'order-dangling' ? { product: '@products:products:20' } : {}) }] }] })
    }
    if (mode === 'emitted') documents.push({ storeId: '205', collection: table === 'blog_posts' ? 'blogs' : table, documents: [{ _ref: `@${table === 'blog_posts' ? 'blogs' : table}:${table}:20`, tenant: '@tenants:stores:205' }] })
    const customerStores = ['205','285'].map(id => ({ ...emptyCustomerStore(id), retainedSourceRows: rows.filter(row => row.storeId === id && row.table === 'orders').map(row => ({ table: 'orders', sourceId: row.sourceId })) }))
    const input = await fixture({ rows, diagnostics, documents, customerStores, override: { exporterVersion: '1.9.3', contractSha256: SOURCE_OMISSION_MAPPING_HASH, migrationPolicy: { ...policy, ...(mode === 'disabled' ? { excludeInvalidProducts: false } : {}) }, status: 'exported', outcome: correctedOutcome.exportOutcome(diagnostics, 0, []) } })
    const review = correctedOutcome.exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) { await writeFile(join(input.source, name), bytes); input.manifest.artifacts[name] = digest(bytes) }
    await input.saveManifest(); return input
  }
  it.each([['products','PRODUCT_NAME_TOO_SHORT'], ['orders','ORDER_STATUS_UNVERIFIED'], ['blog_posts','BLOG_TITLE_MISSING'], ['blog_categories','BLOG_CATEGORY_STATUS_UNVERIFIED'], ['store_payments','PAYMENT_PROVIDER_UNKNOWN']])('accepts proven %s source omission', async (table, reason) => {
    // Arrange / Act
    const prepared = await prepare(await omissionFixture(table,reason)), artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
  })
  it('accepts truthful failed child ownership without rewriting its tenant relation', async () => {
    // Arrange / Act
    const input = await omissionFixture('products','SOURCE_SKU_OWNER_MISMATCH','ownership-conflict'), prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(input.rows.find(row => row.table === 'product_skus')?.ownership).toMatchObject({ storeId: null, rule: 'OWNERSHIP_STORE_CONFLICT' })
  })
  it.each(['disabled','missing-root','wrong-fields','emitted'])('rejects %s exclusion proof', async mode => {
    // Arrange / Act / Assert
    await expect(prepare(await omissionFixture('products','PRODUCT_NAME_TOO_SHORT',mode))).rejects.toThrow('SOURCE_EXCLUSION_EVIDENCE_INVALID')
  })
  it('does not excuse forged ownership or unexpected mapper failures', async () => {
    // Arrange / Act / Assert
    for (const mode of ['forged-ownership','operational-error']) {
      const prepared = await prepare(await omissionFixture('products','SOURCE_SKU_OWNER_MISMATCH',mode))
      const artifact = await loadImportArtifact(prepared.manifestPath)
      expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: mode === 'forged-ownership' ? 'SOURCE_CLASSIFICATION_INVALID' : 'PRODUCT_MAPPING_INVALID' })]))
    }
  })
  it('keeps historical Order snapshots and does not waive a dangling Product reference', async () => {
    // Arrange / Act / Assert
    for (const mode of ['order-snapshot','order-dangling']) {
      const prepared = await prepare(await omissionFixture('products','PRODUCT_NAME_TOO_SHORT',mode))
      const artifact = await loadImportArtifact(prepared.manifestPath)
      const warnings = artifact.blockers.filter(d => d.code === 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED')
      expect(warnings).toHaveLength(mode === 'order-snapshot' ? 0 : 1)
      expect(artifact.stores.find(store => store.storeId === '205')?.collections.orders[0]).toMatchObject({ items: [{ productName: 'Historical product', quantity: 1, unitPrice: 12.5 }] })
    }
  })
  it('rejects new omission proof in a historical contract even with new flags removed', async () => {
    // Arrange
    const input = await omissionFixture()
    const priorPolicy: Record<string, unknown> = { ...policy }
    for (const key of ['excludeInvalidProducts','excludeInvalidBlogs','skipUnverifiedOrders','omitUnmappablePayments']) delete priorPolicy[key]
    Object.assign(input.manifest, { exporterVersion: '1.9.2', contractSha256: PRODUCT_CATALOG_MAPPING_HASH, migrationPolicy: priorPolicy })
    await input.saveManifest()
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('SOURCE_EXCLUSION_EVIDENCE_INVALID')
  })
  it('requires disabled gateway flags and rejects non-status Order omissions', async () => {
    // Arrange / Act / Assert
    await expect(prepare(await omissionFixture('store_payments','PAYMENT_PROVIDER_UNKNOWN','enabled-gateway'))).rejects.toThrow('SOURCE_EXCLUSION_EVIDENCE_INVALID')
    await expect(prepare(await omissionFixture('orders','ORDER_MAPPING_INVALID'))).rejects.toThrow()
  })
})


describe('[TC-F42-IMP-POLICY-006] Exact negative-total Orders and inherited policy handoff', () => {
  const policy = {"decisionEvidence": "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history. User decision 2026-09-23: temporarily defer PROD Stores 54 and 161 because original backend owners 118 and 343 are soft-deleted; preserve source data, omit these Stores from master JSON, report policy exclusion without blocking other Stores.", "activeCatalogOnly": true, "deferEmailTemplates": true, "allowSparseVariants": true, "preserveUserCreators": true, "siteTypeDefault": "ecommerce", "siteTypeOverrides": {}, "shippingPolicy": "pw2-defaults", "promoteActiveCategoriesToRoot": true, "deferredStoreIds": ["54", "161", "323"], "preserveHistoricalOrders": true, "gracefulTenantResolution": true, "resolveDuplicateSkus": true, "resolveDuplicateVariantTuples": true, "treatSingleSkuWithoutSelectionsAsSimple": true, "pruneUnreferencedTiers": true, "allowInactiveSkusForInactiveProduct": true, "resolveDuplicateCategorySlugs": true, "resolveDuplicateCategoryNames": true, "flattenBlogCategoriesToRoot": true, "resolveDuplicateBlogCategorySlugs": true, "resolveDuplicateBlogSlugs": true, "allowCustomerAddressOverflow": true, "allowInvalidCustomerAddresses": true, "allowHistoricalDiscountEligibilityGap": true, "preserveRefundedOrdersWithoutEvidence": true, "skipInvalidDiscountCodes": true, "allowUnresolvedBlogMedia": true, "fallbackBlogAuthorToOwner": true, "allowContactStructureGap": true, "allowBracketedProductNames": true, "pruneInvalidVariantSkus": true, "selectOldestOwner": true, "preserveInvalidUserEmails": true, "excludeDuplicateProductSlugs": true, "excludeProductsWithoutValidVariants": true, "excludeInvalidProducts": true, "excludeInvalidBlogs": true, "skipUnverifiedOrders": true, "omitUnmappablePayments": true, "approvedNegativeTotalOrders": [{"storeId": "43", "orderId": "112"}, {"storeId": "43", "orderId": "132"}]}
  async function mixedFixture(mode = 'valid') {
    const storeId = mode === 'other-store' ? '44' : '43'
    const orderIds = mode === 'inherit193' ? [] : mode === 'other-order' ? ['113','132'] : ['112','132']
    const sourceRule = 'MASTER-APPROVED-SOURCE-ENTITY-EXCLUSION'
    const root = (table: string, sourceId: string, disposition = 'retained-source'): Row => ({ table, sourceId, storeId, record: 1, disposition, fields: { id: disposition === 'mapped' ? 'source-identity' : 'retained-source' }, contributions: [], ownership: { storeId, rule: 'SOURCE_STORE_ID' } })
    const rows: Row[] = [
      { ...root('products','10'), fieldRetentionRules: { id: 'MASTER-5.2-PRODUCT-CATALOG-POLICY' }, productExclusion: { productId: '10', reason: 'NO_VALID_VARIANTS' } },
      { ...root('products','20'), fieldRetentionRules: { id: sourceRule }, sourceExclusion: { table: 'products', sourceId: '20', storeId, reason: 'PRODUCT_NAME_TOO_SHORT' } },
      { ...root('products','30'), fieldRetentionRules: { id: 'MASTER-5.2-PRODUCT-MISSING-PRICE-STOCK' }, productExclusion: { productId: '30', reason: 'MISSING_PRICE' } },
      { ...root('products','40'), fields: { description: 'retained-source' }, fieldRetentionRules: { description: 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE' }, contributions: [{ table: 'products', sourceId: '40', storeId, fields: ['description'], rule: 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE', targetPath: 'source-csv.products' }] },
      root('users','9','mapped'),
      ...orderIds.map(id => ({ ...root('orders',id), fieldRetentionRules: { id: sourceRule }, sourceExclusion: { table: 'orders', sourceId: id, storeId, reason: 'APPROVED_NEGATIVE_TOTAL' } })),
    ]
    const records = new Map<string, number>()
    for (const row of rows) {
      row.record = (records.get(row.table) ?? 0) + 1; records.set(row.table,row.record)
      if (row.table === 'products') {
        const rule = Object.values(row.fieldRetentionRules!)[0]
        row.fields = { id: 'retained-source', description: 'retained-source' }; row.fieldRetentionRules = { id: rule, description: rule }
        if (row.sourceId === '40') row.contributions = [{ table: 'products', sourceId: '40', storeId, fields: ['id','description'], rule, targetPath: 'source-csv.products' }]
      }
    }
    const diagnostics: Diagnostic[] = [
      { code: 'PRODUCT_CATALOG_POLICY_EXCLUDED', severity: 'warning', table: 'products', sourceId: '10', storeId, reason: 'NO_VALID_VARIANTS' },
      { code: 'SOURCE_ENTITY_EXCLUDED', severity: 'warning', table: 'products', sourceId: '20', storeId, reason: 'PRODUCT_NAME_TOO_SHORT' },
      { code: 'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED', severity: 'warning', table: 'products', sourceId: '30', storeId, reason: 'MISSING_PRICE' },
      { code: 'USER_EMAIL_INVALID', severity: 'warning', table: 'users', sourceId: '9', storeId, field: 'email', reason: 'SOURCE_EMAIL_PRESERVED' },
      { code: 'OWNER_IDENTITY_RESOLVED', severity: 'warning', table: 'users', sourceId: '9', storeId, field: 'is_store_owner', reason: 'OLDEST_OWNER_SELECTED' },
      ...orderIds.map(id => ({ code: 'SOURCE_ENTITY_EXCLUDED', severity: 'warning' as const, table: 'orders', sourceId: id, storeId, reason: 'APPROVED_NEGATIVE_TOTAL' })),
    ]
    const customerStores = [storeId,'285'].map(id => ({ ...emptyCustomerStore(id), retainedSourceRows: id === storeId ? orderIds.map(sourceId => ({ table: 'orders', sourceId })) : [] }))
    const sourceSnapshot = { ...snapshot, sourceInstance: mode === 'wrong-instance' ? 'SYNTHETIC' : 'PW1PROD', sourceInstanceToken: mode === 'wrong-token' ? 'SYNTHETIC' : 'PW1PROD' }
    const migrationPolicy = mode === 'disabled' || mode === 'historical' || mode === 'inherit193' ? { ...policy, approvedNegativeTotalOrders: [] } : policy
    const input = await fixture({ storeIds: [storeId,'285'], sourceSnapshot, rows, diagnostics, customerStores, documents: [{ storeId, collection: 'users', documents: [{ _ref: '@users:users:9', email: 'preserved-invalid-email', roles: ['tenant-owner'], tenants: [{ tenant: `@tenants:stores:${storeId}`, role: 'owner' }] }] }], override: { exporterVersion: ['historical','inherit193'].includes(mode) ? '1.9.3' : '1.9.4', contractSha256: ['historical','inherit193'].includes(mode) ? SOURCE_OMISSION_MAPPING_HASH : NEGATIVE_ORDER_MAPPING_HASH, migrationPolicy, status: 'exported', outcome: correctedOutcome.exportOutcome(diagnostics, 0, []) } })
    if (['historical','inherit193'].includes(mode)) delete (input.manifest.migrationPolicy as Record<string, unknown>).approvedNegativeTotalOrders
    const review = correctedOutcome.exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) { await writeFile(join(input.source, name), bytes); input.manifest.artifacts[name] = digest(bytes) }
    await input.saveManifest(); return input
  }
  it('loads exact PROD Orders 112/132 exclusions alongside all earlier Product/owner/email/raw-retention policies', async () => {
    // Arrange / Act
    const prepared = await prepare(await mixedFixture()), artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.preserveInvalidUserEmails).toBe(true)
    expect(artifact.stores.find(store => store.storeId === '43')?.collections.orders).toEqual([])
    expect(artifact.stores.find(store => store.storeId === '43')?.collections.users[0].email).toBe('preserved-invalid-email')
  })
  it.each(['1.10.0','1.10.1','1.10.2','1.10.3','1.10.4','1.10.5'])('inherits all mixed policies and exact PROD Order exemptions in chunked %s', async version => {
    // Arrange / Act
    const input=await mixedFixture();await chunkify(input)
    if(version!=='1.10.0'){Object.assign(input.manifest,{exporterVersion:version,contractSha256:version==='1.10.5'?SOURCE_DOMAIN_MAPPING_HASH:version==='1.10.4'?RESTORED_MODEL_SETTINGS_MAPPING_HASH:version==='1.10.3'?APPROVED_SOURCE_SCOPE_MAPPING_HASH:version==='1.10.2'?APPROVED_CATALOG_MAPPING_HASH:MODEL_SETTINGS_MAPPING_HASH});await input.saveManifest()}
    const prepared=await prepare(input),artifact=await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([]);expect(artifact.preserveInvalidUserEmails).toBe(true)
    expect(artifact.masterParts).toHaveLength(2)
  })
  it('keeps earlier exclusions and owner/email policies working together on 1.9.3', async () => {
    // Arrange / Act
    const prepared = await prepare(await mixedFixture('inherit193')), artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.preserveInvalidUserEmails).toBe(true)
  })
  it.each(['other-store','other-order','disabled','historical'])('rejects %s negative-total exclusion', async mode => {
    // Arrange / Act / Assert
    await expect(prepare(await mixedFixture(mode))).rejects.toThrow('SOURCE_EXCLUSION_EVIDENCE_INVALID')
  })
  it.each(['wrong-instance','wrong-token'])('uses exact Order approvals with the %s source identity', async mode => {
    // Arrange / Act
    const prepared = await prepare(await mixedFixture(mode))
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
  })
})


async function chunkify(input: Awaited<ReturnType<typeof fixture>>) {
  const master = JSON.parse(await readFile(join(input.source,'master.json'),'utf8')) as Record<string,unknown>[]
  const parts: MasterPart[] = []
  for (const [index,store] of master.entries()) {
    const tenants=store.tenants as {_ref:string}[], storeId=tenants[0]._ref.slice('@tenants:stores:'.length)
    const text=JSON.stringify([store]), filename=`master-${String(index+1).padStart(4,'0')}.json`
    await writeFile(join(input.source,filename),text,{mode:0o600})
    const part={filename,sha256:digest(text),bytes:Buffer.byteLength(text),storeIds:[storeId]};parts.push(part);input.manifest.artifacts[filename]=part.sha256
  }
  await rm(join(input.source,'master.json'));delete input.manifest.artifacts['master.json']
  const diagnostics=(JSON.parse(input.files['mapping-report.json']) as {diagnostics:Diagnostic[]}).diagnostics
  const review=correctedOutcome.exportReview(diagnostics,input.manifest.blockedStores,input.manifest.policyExcludedStores)
  for(const [name,text] of Object.entries({'export-review.json':JSON.stringify(review),'export-review.md':correctedOutcome.reviewMarkdown(review)})) { await writeFile(join(input.source,name),text,{mode:0o600});input.manifest.artifacts[name]=digest(text) }
  Object.assign(input.manifest,{exporterVersion:'1.10.0',contractSha256:CHUNKED_MASTER_MAPPING_HASH,masterParts:parts,masterSetHash:masterSetHash(parts),status:'exported',outcome:correctedOutcome.exportOutcome(diagnostics,input.manifest.blockedStores.length,input.manifest.policyExcludedStores)})
  await input.saveManifest();return parts
}

describe('[TC-F42-IMP-PARTS-001] Bound master parts without aggregate',()=>{
  async function setup() {
    const input=await fixture({documents:[{storeId:'205',collection:'tenants',documents:[{_ref:'@tenants:stores:205',metaData:{pw1StoreId:'205'},name:'Cửa hàng Việt 🙂'}]}]})
    const parts=await chunkify(input)
    return {input,parts}
  }
  it('prepares, streams and spools selected Stores across parts while binding the descriptor set',async()=>{
    // Arrange / Act
    const {input,parts}=await setup(), prepared=await prepare(input)
    const artifact=await loadImportArtifact(prepared.manifestPath,{storeIds:['205','285'],spoolDirectory:input.root})
    // Assert
    expect(artifact.manifest.masterHash).toBe(masterSetHash(parts));expect(artifact.masterParts).toEqual(parts)
    expect(artifact.stores).toEqual([]);expect(artifact.storeIds).toEqual(['205','285'])
    expect((await readImportStore(artifact,'205')).collections.tenants[0].name).toBe('Cửa hàng Việt 🙂')
    expect((await readImportStore(artifact,'285')).storeId).toBe('285')
    await expect(readFile(join(input.output,'master.json'))).rejects.toThrow()
    const foundation=await loadImportArtifact(prepared.manifestPath,{scope:'foundation',selector:{store:'285'}})
    expect(foundation.stores.map(store=>store.storeId)).toEqual(['285'])
    await writeFile(join(input.output,'master-with-destination.json'),'{"format":"pw1-destination-parts-v1"}')
    expect((await loadImportArtifact(prepared.manifestPath,{scope:'foundation',selector:{store:'285'}})).stores.map(store=>store.storeId)).toEqual(['285'])
  })
  it.each(['missing','extra','reordered','duplicate-id','wrong-ids','wrong-size','wrong-hash','wrong-set-hash','aggregate','utf8-char-count','too-many-stores','size-limit','path'])('rejects %s part metadata or files',async mutation=>{
    // Arrange
    const {input,parts}=await setup()
    if(mutation==='missing')await rm(join(input.source,parts[1].filename))
    if(mutation==='extra')await writeFile(join(input.source,'master-0003.json'),'[]')
    if(mutation==='aggregate')await writeFile(join(input.source,'master.json'),'[]')
    if(mutation==='reordered')parts.reverse()
    if(mutation==='duplicate-id')parts[1].storeIds=['205']
    if(mutation==='wrong-ids')parts[0].storeIds=['206']
    if(mutation==='wrong-size')parts[0].bytes++
    if(mutation==='utf8-char-count')parts[0].bytes=(await readFile(join(input.source,parts[0].filename),'utf8')).length
    if(mutation==='wrong-hash'){parts[0].sha256='0'.repeat(64);input.manifest.artifacts[parts[0].filename]=parts[0].sha256}
    if(mutation==='too-many-stores')parts[0].storeIds=Array.from({length:301},(_,i)=>String(i+1))
    if(mutation==='size-limit')parts[0].bytes=200_000_000
    if(mutation==='path')parts[0].filename='../master-0001.json'
    Object.assign(input.manifest,{masterSetHash:mutation==='wrong-set-hash'?'0'.repeat(64):masterSetHash(parts)})
    await input.saveManifest()
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow()
  })
  it('hashes an unselected later part to EOF and rejects tampering even in foundation mode',async()=>{
    // Arrange
    const {input,parts}=await setup(),prepared=await prepare(input)
    const path=join(input.output,parts[1].filename),text=await readFile(path,'utf8')
    await writeFile(path,text.replace('285','286'))
    // Act / Assert
    await expect(loadImportArtifact(prepared.manifestPath,{scope:'foundation',selector:{store:'205'}})).rejects.toThrow()
  })
  it('accepts an empty declared set with zero emitted Stores and no empty part file',async()=>{
    // Arrange
    const input=await fixture({customerStores:[],override:{blockedStores:['205','285'],counts:{sourceStoreCount:2,selectedStoreCount:2,policyExcludedStoreCount:0,emittedStoreCount:0,blockedStoreCount:2,blockers:0}}})
    await writeFile(join(input.source,'master.json'),'[]')
    const parts=await chunkify(input),prepared=await prepare(input)
    // Act / Assert
    const artifact=await loadImportArtifact(prepared.manifestPath,{storeIds:[]})
    expect(parts).toEqual([]);expect(artifact.storeIds).toEqual([]);expect(artifact.manifest.masterHash).toBe(masterSetHash([]))
  })
})


describe('[TC-F42-IMP-SCOPE-001] 1.10.1 model settings source-only contract',()=>{
  async function setup(mutation='') {
    const row:Row={table:'model_settings',sourceId:'901',storeId:null,record:1,disposition:'retained-source',fields:{id:'retained-source',custom_setting:'retained-source',api_token:'security-excluded'},fieldRetentionRules:{id:'MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE',custom_setting:'MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE'},contributions:[],ownership:{storeId:null,rule:'OWNERSHIP_PARENT_UNVERIFIED',parentTable:'products',parentId:'999'}}
    if(mutation==='contribution')row.contributions=[{storeId:'205',table:'model_settings',sourceId:'901',fields:['custom_setting'],targetPath:'products',rule:'MASTER-5'}]
    if(mutation==='secret') {row.fields.api_token='retained-source';row.fieldRetentionRules!.api_token='MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE'}
    if(mutation==='table')row.table='users'
    if(mutation==='ownership')row.ownership={storeId:null,rule:'SOURCE_GLOBAL_SCOPE'}
    const input=await fixture({rows:[row],diagnostics:[{code:'MODEL_SETTINGS_OUTSIDE_SCOPE',severity:'warning',table:'model_settings'},{code:'SOURCE_OWNERSHIP_UNRESOLVED',severity:'warning',table:'model_settings',sourceId:'901',reason:'OWNERSHIP_PARENT_UNVERIFIED'}]})
    await chunkify(input)
    if(mutation!=='historical')Object.assign(input.manifest,{exporterVersion:'1.10.1',contractSha256:MODEL_SETTINGS_MAPPING_HASH})
    await input.saveManifest()
    return input
  }
  it('prepares and loads source-only settings with unknown fields and truthful failed ownership',async()=>{
    // Arrange / Act
    const input=await setup(),prepared=await prepare(input),artifact=await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.diagnosticSummary?.buckets.filter(b=>b.diagnostic.table==='model_settings').every(b=>b.disposition==='OUT_OF_SCOPE')).toBe(true)
  })
  it('requires the exact global source-only marker',async()=>{
    // Arrange
    const input=await setup()
    const report=JSON.parse(input.files['mapping-report.json'])
    report.diagnostics=report.diagnostics.filter((d:Diagnostic)=>d.code!=='MODEL_SETTINGS_OUTSIDE_SCOPE')
    const text=JSON.stringify(report)
    await writeFile(join(input.source,'mapping-report.json'),text)
    input.manifest.artifacts['mapping-report.json']=digest(text)
    await input.saveManifest()
    // Act / Assert
    await expect(prepare(input)).rejects.toThrow('MODEL_SETTINGS_SCOPE_EVIDENCE_INVALID')
  })
  it.each(['historical','contribution','secret','table','ownership'])('does not waive unsupported source-only evidence (%s)',async mutation=>{
    // Arrange / Act
    const input=await setup(mutation),prepared=await prepare(input),artifact=await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers.some(d=>d.code==='SOURCE_CLASSIFICATION_INVALID')).toBe(true)
  })
})


describe('[TC-F42-IMP-APPROVED-102] Four approved decisions share an exact artifact contract',()=>{
  const policy = {"decisionEvidence": "User decisions 2026-09-17: active Category/SKU only; existing SKU tuples; defer Email; siteType ecommerce with Store overrides; preserve creator in Users only; shipping follows PW2. Incompatible shipping uses explicit PW2 defaults as stated in implementation update. User follow-up 2026-09-17 approves active child promotion, preserving all images/short descriptions, deferring Store 323 and optional history. User decision 2026-09-23: temporarily defer PROD Stores 54 and 161 because original backend owners 118 and 343 are soft-deleted; preserve source data, omit these Stores from master JSON, report policy exclusion without blocking other Stores.", "activeCatalogOnly": true, "deferEmailTemplates": true, "allowSparseVariants": true, "preserveUserCreators": true, "siteTypeDefault": "ecommerce", "siteTypeOverrides": {}, "shippingPolicy": "pw2-defaults", "promoteActiveCategoriesToRoot": true, "deferredStoreIds": ["54", "161", "323"], "preserveHistoricalOrders": true, "gracefulTenantResolution": true, "resolveDuplicateSkus": true, "resolveDuplicateVariantTuples": true, "treatSingleSkuWithoutSelectionsAsSimple": true, "pruneUnreferencedTiers": true, "allowInactiveSkusForInactiveProduct": true, "resolveDuplicateCategorySlugs": true, "resolveDuplicateCategoryNames": true, "flattenBlogCategoriesToRoot": true, "resolveDuplicateBlogCategorySlugs": true, "resolveDuplicateBlogSlugs": true, "allowCustomerAddressOverflow": true, "allowInvalidCustomerAddresses": true, "allowHistoricalDiscountEligibilityGap": true, "preserveRefundedOrdersWithoutEvidence": true, "skipInvalidDiscountCodes": true, "allowUnresolvedBlogMedia": true, "fallbackBlogAuthorToOwner": true, "allowContactStructureGap": true, "allowBracketedProductNames": true, "pruneInvalidVariantSkus": true, "selectOldestOwner": true, "preserveInvalidUserEmails": true, "excludeDuplicateProductSlugs": true, "excludeProductsWithoutValidVariants": true}
  async function setup(mode='valid') {
    const storeId='1327',catalogRule='MASTER-5.2-PRODUCT-CATALOG-POLICY',mediaRule='MASTER-10-MEDIA-SOURCE-METADATA'
    const root=(table:string,id:string):Row=>({table,sourceId:id,storeId,record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[],ownership:{storeId,rule:'SOURCE_STORE_ID'}})
    const product:Row={...root('products','10'),disposition:'retained-source',fields:{id:'retained-source'},fieldRetentionRules:{id:catalogRule},productExclusion:{productId:'10',reason:'INACTIVE_CATEGORY'}}
    const sku:Row={...root('product_skus','20'),disposition:'retained-source',fields:{id:'retained-source'},fieldRetentionRules:{id:catalogRule},productExclusion:{productId:'10',reason:'INACTIVE_CATEGORY'},ownership:{storeId,rule:'SOURCE_PARENT_RELATION',parentTable:'products',parentId:mode==='foreign-family'?'11':'10'}}
    const media:Row={...root('medias','1252'),fields:{id:'retained-source',name:'mapped',url:'mapped'},fieldRetentionRules:{id:mediaRule},contributions:[{storeId,table:'medias',sourceId:'1252',fields:['name','url'],targetPath:'media[]',rule:'MASTER-10-EXTERNAL-LIBRARY-MEDIA'}]}
    const rows=[product,sku,{...root('users','2696'),record:1},{...root('users','2697'),record:2},...(mode==='missing-media-receipt'?[]:[media])]
    const diagnostics:Diagnostic[]=[{code:'PRODUCT_CATALOG_POLICY_EXCLUDED',severity:'warning',table:'products',sourceId:'10',storeId,reason:'INACTIVE_CATEGORY'},{code:'OWNER_SECONDARY_MAPPED_EDITOR',severity:'warning',table:'users',sourceId:'2697',storeId,field:'is_store_owner',reason:'PRIMARY_OWNER_SELECTED'},{code:'USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED',severity:'warning',table:'users',sourceId:'2697',storeId},{code:'SOCIAL_CHANNEL_METADATA_OMITTED',severity:'warning',table:'stores',sourceId:storeId,storeId,field:'social_channel',reason:'PW2_SUPPORTED_FIELDS_ONLY'}]
    if(mode==='missing-editor-receipt')diagnostics.splice(1,1)
    const users=[{_ref:'@users:users:2696',roles:['tenant-owner'],tenants:[{tenant:'@tenants:stores:1327',role:'owner',permissions:[]}]},{_ref:'@users:users:2697',roles:[mode==='owner-escalation'?'tenant-owner':'editor'],tenants:[{tenant:'@tenants:stores:1327',role:mode==='owner-escalation'?'owner':'editor',permissions:[]}]}]
    const url='https://cdn.example.test/PW1/Media%20Original.JPG?sig=A%2Fb'
    const input=await fixture({storeIds:[storeId],sourceSnapshot:{...snapshot,sourceInstance:'PW1PROD',sourceInstanceToken:mode==='wrong-namespace'?'SYNTHETIC':'PW1PROD'},rows,diagnostics,documents:[{storeId,collection:'users',documents:users},{storeId,collection:'sites',documents:[{_ref:'@sites:stores:1327',tenant:'@tenants:stores:1327',socialLinks:mode==='unsafe-social'?{facebook:'javascript:bad'}:mode==='raw-social'?{facebook:'https://facebook.com/example',icon:'raw'}:{facebook:'https://facebook.com/example'}}]},{storeId,collection:'media',documents:[{_ref:'@media:medias:1252',url:mode==='unsafe-media'?'javascript:bad':url,sourceUrl:url,alt:'PW1 original'}]},...(mode==='emitted-product'?[{storeId,collection:'products',documents:[{_ref:'@products:products:10'}]}]:[])],products:[{storeId,sourceProductId:'10',emitted:false,targetRef:null,eligibleSkuCount:0,tiers:[],skus:[],errors:['PRODUCT_NOT_EMITTED']}],override:{counts:{sourceStoreCount:1,selectedStoreCount:1,policyExcludedStoreCount:0,emittedStoreCount:1,blockedStoreCount:0,blockers:0},migrationPolicy:{...policy,excludeProductsInInactiveCategories:mode!=='disabled'}}})
    const report=JSON.parse(input.files['mapping-report.json'])
    report.rows[0].fields.social_channel='mapped'
    input.manifest.files.find(file=>file.table==='stores')!.headers.push('social_channel')
    report.rows[0].contributions.push({storeId,table:'stores',sourceId:storeId,fields:['social_channel'],targetPath:'sites[].socialLinks',rule:'MASTER-4-SOCIAL-SUPPORTED-FIELDS'})
    const text=JSON.stringify(report);input.files['mapping-report.json']=text;await writeFile(join(input.source,'mapping-report.json'),text);input.manifest.artifacts['mapping-report.json']=digest(text)
    await chunkify(input)
    Object.assign(input.manifest,{exporterVersion:mode==='historical'?'1.10.1':'1.10.2',contractSha256:mode==='historical'?MODEL_SETTINGS_MAPPING_HASH:APPROVED_CATALOG_MAPPING_HASH})
    if(mode==='historical')delete (input.manifest.migrationPolicy as Record<string,unknown>).excludeProductsInInactiveCategories
    await input.saveManifest();return input
  }
  it('loads all four decisions while excluding Product family and preserving media URL bytes',async()=>{
    // Arrange / Act
    const input=await setup(),prepared=await prepare(input),artifact=await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.blockers).toEqual([])
    expect(artifact.stores[0].collections.products).toEqual([])
    expect(artifact.stores[0].collections.media[0].url).toBe('https://cdn.example.test/PW1/Media%20Original.JPG?sig=A%2Fb')
    expect(artifact.diagnosticSummary?.buckets.find(b=>b.diagnostic.code==='USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED')?.disposition).toBe('APPROVED_POLICY')
  })
  it.each(['disabled','historical','emitted-product','foreign-family','missing-media-receipt','unsafe-media','unsafe-social','raw-social'])('rejects invalid or unsupported artifact evidence (%s)',async mode=>{
    // Arrange / Act / Assert
    await expect(prepare(await setup(mode))).rejects.toThrow()
  })
  it.each(['missing-editor-receipt','owner-escalation'])('keeps the generic permission warning blocked without approved editor evidence (%s)',async mode=>{
    // Arrange / Act
    const input=await setup(mode),prepared=await prepare(input),artifact=await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.diagnosticSummary?.buckets.find(b=>b.diagnostic.code==='USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED')?.disposition).toBe('BLOCKED')
  })
  it('accepts verified editor evidence under another source namespace', async () => {
    // Arrange / Act
    const input = await setup('wrong-namespace'), prepared = await prepare(input), artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.diagnosticSummary?.buckets.find(b => b.diagnostic.code === 'USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED')?.disposition).toBe('APPROVED_POLICY')
  })
})


describe('[TC-F42-IMP-SCOPE-001] Approved scope artifact roundtrip', () => {
  it.each([false, true])('validates technical scope and detects tampered outcome=%s', async tampered => {
    // Arrange
    const diagnostics: Diagnostic[] = [{ code: 'SOURCE_TABLE_OUTSIDE_SCOPE', table: 'queue_sync', severity: 'warning' }]
    const input = await fixture({ diagnostics, rows: [{ table: 'queue_sync', sourceId: '1', storeId: null, record: 1, disposition: 'retained-source', fields: { payload: 'retained-source' }, fieldRetentionRules: { payload: 'MASTER-2.2-TECHNICAL-OUTSIDE-SCOPE' }, contributions: [], ownership: { storeId: null, rule: 'SOURCE_GLOBAL_SCOPE' } }] })
    await chunkify(input)
    const outcome = correctedOutcome.exportOutcome(diagnostics, 0, [])
    Object.assign(input.manifest, { exporterVersion: '1.10.3', contractSha256: APPROVED_SOURCE_SCOPE_MAPPING_HASH, outcome: tampered ? { ...outcome, outsideScopeCount: 0 } : outcome })
    const review = correctedOutcome.exportReview(diagnostics, [], [])
    for (const [name, bytes] of Object.entries({ 'export-review.json': JSON.stringify(review), 'export-review.md': correctedOutcome.reviewMarkdown(review) })) { await writeFile(join(input.source, name), bytes); input.manifest.artifacts[name] = digest(bytes) }
    await input.saveManifest()
    // Act / Assert
    if (tampered) await expect(prepare(input)).rejects.toThrow('EXPORT_OUTCOME_INCONSISTENT')
    else { const prepared = await prepare(input); expect((await loadImportArtifact(prepared.manifestPath)).blockers).toEqual([]) }
  })
})


describe('[TC-F42-IMP-RAW-SETTINGS] Restored settings streaming contract', () => {
  it.each(['valid', 'source-domain-contract', 'missing-value', 'historical', 'legacy-marker'])('verifies actual Page content and Site fallback: %s', async mutation => {
    // Arrange
    const content = '<p><a href="tel:011 1259 5933">Call</a></p>{invalid json'
    const raw = { id: '901', store_id: '205', model_type: 'App\\Models\\PageComponent', model_id: '700', key: 'content', value: content }
    const fallback = { ...raw, id: '902', model_id: 'missing-parent' }
    const fields = Object.fromEntries(Object.keys(raw).map(field => [field, 'mapped']))
    const rows: Row[] = [
      { table: 'pages', sourceId: '600', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'mapped' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' } },
      { table: 'page_components', sourceId: '700', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'mapped' }, contributions: [], ownership: { storeId: '205', rule: 'SOURCE_PARENT_RELATION', parentTable: 'pages', parentId: '600' } },
      { table: 'model_settings', sourceId: '901', storeId: '205', record: 1, disposition: 'mapped', fields, contributions: [{ table: 'model_settings', sourceId: '901', storeId: '205', fields: Object.keys(raw), targetPath: 'pages.components.model_settings', rule: 'MASTER_RAW_MODEL_SETTINGS' }], ownership: { storeId: '205', rule: 'SOURCE_PARENT_RELATION', parentTable: 'page_components', parentId: '700' } },
      { table: 'model_settings', sourceId: '902', storeId: '205', record: 2, disposition: 'mapped', fields, contributions: [{ table: 'model_settings', sourceId: '902', storeId: '205', fields: Object.keys(raw), targetPath: 'sites.raw_model_settings', rule: 'MASTER_RAW_MODEL_SETTINGS' }], ownership: { storeId: '205', rule: 'SOURCE_SETTING_STORE_ID' } },
    ]
    const input = await fixture({ rows, diagnostics: [
      { code: mutation === 'legacy-marker' ? 'MODEL_SETTINGS_OUTSIDE_SCOPE' : 'MODEL_SETTINGS_RAW_PRESERVED', table: 'model_settings', severity: 'warning' },
      ...['pages', 'page_components'].map(table => ({ code: 'PAGE_MENU_RAW_SOURCE_ONLY', table, severity: 'warning' as const })),
    ], documents: [
      { storeId: '205', collection: 'pages', documents: [{ id: '600', model_settings: [], components: [{ id: '700', model_settings: [mutation === 'missing-value' ? { ...raw, value: undefined } : raw] }] }] },
      { storeId: '205', collection: 'sites', documents: [{ _ref: '@sites:stores:205', tenant: '@tenants:stores:205', raw_model_settings: [fallback] }] },
    ] })
    await chunkify(input)
    Object.assign(input.manifest, { exporterVersion: mutation === 'historical' ? '1.10.3' : mutation === 'source-domain-contract' ? '1.10.5' : '1.10.4', contractSha256: mutation === 'historical' ? APPROVED_SOURCE_SCOPE_MAPPING_HASH : mutation === 'source-domain-contract' ? SOURCE_DOMAIN_MAPPING_HASH : RESTORED_MODEL_SETTINGS_MAPPING_HASH })
    await input.saveManifest()
    // Act / Assert
    if (!['valid','source-domain-contract'].includes(mutation)) { await expect((async () => { const prepared = await prepare(input); return loadImportArtifact(prepared.manifestPath) })()).rejects.toThrow(); return }
    const prepared = await prepare(input)
    const artifact = await loadImportArtifact(prepared.manifestPath)
    expect(artifact.blockers).toEqual([])
    expect(artifact.delegateRawModelSettings).toBe(true)
    expect((input.manifest as unknown as { outcome: { outsideScopeCount: number } }).outcome.outsideScopeCount).toBe(3)
    expect(artifact.pageExcludedRecords).toBe(1)
    expect(artifact.stores[0].collections.sites[0].raw_model_settings).toEqual([fallback])
    const master = JSON.parse(await readFile(join(input.output, 'master-0001.json'), 'utf8'))
    expect(master[0].pages[0].components[0].model_settings[0].value).toBe(content)
  })
})

describe('[TC-F42-IMP-SOURCE-DOMAIN] Source-domain artifact handoff', () => {
  it.each(['current', 'historical'])('binds original Site domain receipt under %s contract', async version => {
    // Arrange
    const domain = 'original malformed PW1 hostname'
    const input = await fixture({ rows: [{ table: 'store_domains', sourceId: '4000', storeId: '205', record: 1, disposition: 'mapped', fields: { id: 'mapped', store_id: 'mapped', domain: 'mapped', is_default: 'mapped', deleted_at: 'mapped' }, ownership: { storeId: '205', rule: 'SOURCE_STORE_ID' }, contributions: [{ table: 'store_domains', sourceId: '4000', storeId: '205', fields: ['id','store_id','domain','is_default','deleted_at'], targetPath: 'sites[].domain', rule: 'MASTER-4.1-SOURCE-SITE-DOMAIN' }] }],
      diagnostics: [{ code: 'SOURCE_SITE_DOMAIN_FORMAT_PRESERVED', severity: 'warning', table: 'store_domains', storeId: '205', sourceId: '4000', field: 'domain', reason: 'ORIGINAL_PW1_VALUE' }],
      documents: [{ storeId: '205', collection: 'sites', documents: [{ _ref: '@sites:stores:205', tenant: '@tenants:stores:205', domain }] }] })
    await chunkify(input)
    Object.assign(input.manifest, { exporterVersion: version === 'current' ? '1.10.5' : '1.10.4', contractSha256: version === 'current' ? SOURCE_DOMAIN_MAPPING_HASH : RESTORED_MODEL_SETTINGS_MAPPING_HASH,
      migrationPolicy: { ...input.manifest.migrationPolicy, gracefulTenantResolution: true } })
    await input.saveManifest()
    // Act / Assert
    if (version === 'historical') { await expect(prepare(input)).rejects.toThrow('SOURCE_SITE_DOMAIN_EVIDENCE_INVALID'); return }
    const prepared = await prepare(input), artifact = await loadImportArtifact(prepared.manifestPath)
    expect(artifact.blockers).toEqual([])
    expect(artifact.stores[0].collections.sites[0].domain).toBe(domain)
    expect(artifact.diagnosticSummary?.buckets.find(bucket => bucket.diagnostic.code === 'SOURCE_SITE_DOMAIN_FORMAT_PRESERVED')?.disposition).toBe('APPROVED_POLICY')
  })
})
