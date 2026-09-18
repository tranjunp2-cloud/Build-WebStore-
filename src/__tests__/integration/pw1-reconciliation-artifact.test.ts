// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, rm, appendFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import { validateArtifact } from '@/lib/migration/pw1-export/validate-artifact'
import { MASTER_SHA256, STATUS_MASTER_SHA256, PREVIOUS_MASTER_SHA256, LEGACY_MASTER_SHA256, EXPORT_VERSION } from '@/lib/migration/pw1-export/master-version'

let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-receipts-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
async function fixture() {
  const source = await writeExportFixture(root), output = path.join(root, 'export')
  await exportMaster(source.input, source.configPath, output)
  return output
}
async function manifest(output: string) { return JSON.parse(await readFile(path.join(output, 'master-manifest.json'), 'utf8')) }
async function rewrite(output: string, name: string, value: unknown) {
  const content = JSON.stringify(value), m = await manifest(output)
  await writeFile(path.join(output, name), content)
  m.artifacts[name] = digest(content)
  await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
}

async function legacyFixture() {
  const output = await fixture()
  const master = JSON.parse(await readFile(path.join(output, 'master.json'), 'utf8'))
  for (const store of master) for (const site of store.sites) site.pw1_source = {
    store: {}, frontend_template: null, model_settings: [], brands: [], categories: [], products: [],
    blog_categories: [], blog_posts: [], store_domains: [], attributes: [], attribute_values: [], category_attributes: [],
  }
  await rewrite(output, 'master.json', master)
  const m = await manifest(output)
  delete m.outcome
  for (const name of ['export-review.json', 'export-review.md', 'store-summary.json', 'store-summary.csv']) delete m.artifacts[name]
  m.status = m.counts.blockers ? 'needs_review' : 'complete'
  await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
  return output
}

describe('[TC-F42-081] Hashed reconciliation artifacts and version compatibility', () => {
  it('exports both receipts and pins the exact consolidated local document', async () => {
    // Arrange
    const output = await fixture()
    // Act
    const m = await manifest(output), result = await validateArtifact(output)
    // Assert
    expect(m.exporterVersion).toBe(EXPORT_VERSION)
    expect(m.contractSha256).toBe(MASTER_SHA256)
    expect(digest(await readFile('docs/migration/pw1-pw2-master-field-mapping.md', 'utf8'))).toBe(MASTER_SHA256)
    for (const name of ['customer-reconciliation.json', 'product-reconciliation.json'])
      expect(m.artifacts[name]).toBe(digest(await readFile(path.join(output, name), 'utf8')))
    expect(result.integrityStatus).toBe('valid')
  })
  it('exports price-bearing Products without codes through the real artifact pipeline', async () => {
    // Arrange
    const source = await writeExportFixture(root), output = path.join(root, 'catalog-export')
    const config = JSON.parse(await readFile(source.configPath, 'utf8'))
    const storesPath = path.join(source.input, 'stores.csv')
    const stores = (await readFile(storesPath, 'utf8')).trimEnd().split('\n')
    await writeFile(storesPath, stores.map((line, index) => line + (index ? ',1' : ',currency_id')).join('\n') + '\n')
    const dates = '2025-01-01 00:00:00,2025-01-02 00:00:00'
    // TC-F42-EXP-091: preserve CSV quoting, CRLF and arbitrary HTML through publication.
    const description = '  <script>CANARY()</script>\r\n<a href="javascript:example()">A &amp; B</a>  '
    const descriptionCell = '"' + description.replace(/"/g, '""') + '"'
    const tables = {
      currencies: 'id,code\n1,MYR\n',
      categories: `id,store_id,name,slug,status,created_at,updated_at\n10,1,Books,books,1,${dates}\n`,
      products: `id,store_id,category_id,name,slug,status,created_at,updated_at,description,description_ms\n20,1,10,First book,first-book,1,${dates},${descriptionCell},${descriptionCell}\n21,1,10,Second book,second-book,0,${dates},,\n`,
      product_skus: 'id,store_id,product_id,status,sku,price,stock\n30,1,20,1,,12.50,5\n31,1,21,1,,15,6\n',
    }
    for (const [table, bytes] of Object.entries(tables)) {
      config.tables[table] = `${table}.csv`
      await writeFile(path.join(source.input, `${table}.csv`), bytes)
    }
    await writeFile(source.configPath, JSON.stringify(config))
    // Act
    await exportMaster(source.input, source.configPath, output)
    const master = JSON.parse(await readFile(path.join(output, 'master.json'), 'utf8'))
    const receipt = JSON.parse(await readFile(path.join(output, 'product-reconciliation.json'), 'utf8'))
    // Assert
    expect(master[0].products).toHaveLength(2)
    expect(master[0].products[0].description.root.children[0].children[0].text).toBe(description)
    expect(master[0].products[0].descriptionBM.root.children[0].children[0].text).toBe(description)
    const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
    expect(report.diagnostics.filter((d: { table?: string; field?: string }) => d.table === 'products' && ['description', 'description_ms'].includes(d.field ?? ''))).toEqual([])
    expect(master[0].products.map((p: { status: string }) => p.status)).toEqual(['active', 'draft'])
    expect(master[0].products[0]).not.toHaveProperty('sku')
    expect(receipt.products.map((product: { skus: { sourceSkuId: string }[] }) => product.skus[0].sourceSkuId)).toEqual(['30', '31'])
    await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
    const old = await manifest(output)
    old.exporterVersion = '1.2.0'; old.contractSha256 = PREVIOUS_MASTER_SHA256
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(old))
    await expect(validateArtifact(output)).rejects.toThrow('MASTER_SCHEMA_INVALID')
    // A legacy artifact cannot use newly relaxed SKU validation.
    const m = await manifest(output)
    m.contractSha256 = LEGACY_MASTER_SHA256; m.exporterVersion = '1.0.0'
    delete m.artifacts['customer-reconciliation.json']; delete m.artifacts['product-reconciliation.json']
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    await expect(validateArtifact(output)).rejects.toThrow('MASTER_SCHEMA_INVALID')
  })
  it('rejects receipt bytes changed without updating manifest', async () => {
    const output = await fixture()
    await appendFile(path.join(output, 'customer-reconciliation.json'), ' ')
    await expect(validateArtifact(output)).rejects.toThrow('ARTIFACT_HASH_MISMATCH')
  })
  it('rejects removal of a required receipt from the manifest', async () => {
    const output = await fixture(), m = await manifest(output)
    delete m.artifacts['product-reconciliation.json']
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    await expect(validateArtifact(output)).rejects.toThrow('RECONCILIATION_RECEIPT_REQUIRED')
  })
  it('rejects receipt provenance even with updated hash', async () => {
    const output = await fixture()
    const receipt = JSON.parse(await readFile(path.join(output, 'product-reconciliation.json'), 'utf8'))
    receipt.sourceSnapshot.snapshotId = 'different'
    await rewrite(output, 'product-reconciliation.json', receipt)
    await expect(validateArtifact(output)).rejects.toThrow('RECONCILIATION_PROVENANCE_INVALID')
  })
  it('rejects unknown fields rather than publishing an arbitrary raw archive', async () => {
    const output = await fixture()
    const receipt = JSON.parse(await readFile(path.join(output, 'customer-reconciliation.json'), 'utf8'))
    receipt.archive = { token: 'synthetic-secret' }
    await rewrite(output, 'customer-reconciliation.json', receipt)
    await expect(validateArtifact(output)).rejects.toThrow('RECONCILIATION_SCHEMA_INVALID')
  })
  it('rejects missing Store coverage even with updated hash', async () => {
    const output = await fixture()
    const receipt = JSON.parse(await readFile(path.join(output, 'customer-reconciliation.json'), 'utf8'))
    receipt.stores.pop()
    await rewrite(output, 'customer-reconciliation.json', receipt)
    await expect(validateArtifact(output)).rejects.toThrow('RECONCILIATION_REFERENCES_INVALID')
  })
  it('validates the allowlisted legacy format without requiring new receipts', async () => {
    const output = await legacyFixture(), m = await manifest(output)
    m.contractSha256 = LEGACY_MASTER_SHA256; m.exporterVersion = '1.0.0'
    delete m.artifacts['customer-reconciliation.json']; delete m.artifacts['product-reconciliation.json']
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
  })
  it('rejects a known hash paired with the wrong exporter version', async () => {
    const output = await fixture(), m = await manifest(output)
    m.exporterVersion = '1.0.0'
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    await expect(validateArtifact(output)).rejects.toThrow('UNSUPPORTED_MAPPING_CONTRACT')
  })
})

describe('[TC-F42-EXP-082] Classification artifact evidence', () => {
  it('requires the reviewed classification version for exporter 1.2', async () => {
    const output = await fixture(), m = await manifest(output)
    delete m.classificationVersion
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_VERSION_REQUIRED')
  })
  it('rejects ownership metadata inconsistent with its report row even with a fresh hash', async () => {
    const output = await fixture()
    const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
    report.rows[0].ownership.storeId = '999999'
    await rewrite(output, 'mapping-report.json', report)
    await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('rejects retention rules attached to unresolved fields even with a fresh hash', async () => {
    const output = await fixture()
    const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
    const field = Object.keys(report.rows[0].fields)[0]
    report.rows[0].fields[field] = 'unresolved'
    report.rows[0].fieldRetentionRules = { [field]: 'MASTER-2.2-EXISTING-SOURCE-RETENTION' }
    await rewrite(output, 'mapping-report.json', report)
    await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})

describe('[TC-F42-EXP-083] Classification relationships fail closed', () => {
  it.each(['foreign-store', 'missing-parent', 'wrong-parent-table', 'unknown-rule', 'failure-without-diagnostic'])(
    'rejects %s even when report bytes are rehashed', async mutation => {
      // Arrange
      const output = await fixture()
      const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
      const row = report.rows.find((r: { table: string; sourceId: string }) => r.table === 'plan_subscriptions' && r.sourceId === '1')
      // Act
      if (mutation === 'foreign-store') { row.storeId = '2'; row.ownership.storeId = '2' }
      if (mutation === 'missing-parent') row.ownership.parentId = 'missing'
      if (mutation === 'wrong-parent-table') row.ownership.parentTable = 'users'
      if (mutation === 'unknown-rule') row.ownership.rule = 'UNREVIEWED_RULE'
      if (mutation === 'failure-without-diagnostic') {
        row.storeId = null
        row.ownership = { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'stores', parentId: 'missing' }
        delete row.fieldRetentionRules
      }
      await rewrite(output, 'mapping-report.json', report)
      // Assert
      await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
    },
  )
  it.each(['MASTER-NOT-A-REVIEWED-RULE', 'MASTER-3.4-GLOBAL-USER-DEPENDENCY'])(
    'rejects a retention rule that is unknown or belongs to another table: %s', async rule => {
      // Arrange
      const output = await fixture()
      const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
      const row = report.rows.find((r: { table: string }) => r.table === 'stores')
      // Act
      row.fields.name = 'retained-source'
      row.fieldRetentionRules = { name: rule }
      await rewrite(output, 'mapping-report.json', report)
      // Assert
      await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
    },
  )
})


describe('[TC-F42-EXP-086] Source-status contract compatibility', () => {
  it.each(['1.1.0', '1.2.0', '1.3.0'])('still validates previous contract version %s', async version => {
    // Arrange
    const output = await legacyFixture(), m = await manifest(output)
    m.exporterVersion = version; m.contractSha256 = version === '1.3.0' ? STATUS_MASTER_SHA256 : PREVIOUS_MASTER_SHA256
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    // Act / Assert
    await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
  })
  it.each(['1.2.0', '1.3.0'])('rejects mismatched status contract/version %s', async version => {
    // Arrange
    const output = await fixture(), m = await manifest(output)
    m.exporterVersion = version
    m.contractSha256 = version === '1.2.0' ? MASTER_SHA256 : PREVIOUS_MASTER_SHA256
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    // Act / Assert
    await expect(validateArtifact(output)).rejects.toThrow('UNSUPPORTED_MAPPING_CONTRACT')
  })
})

 describe('[TC-F42-EXP-087] External CSV archive', () => {
  it('omits raw source and validates external retention evidence', async () => {
    const output = await fixture()
    const master = JSON.parse(await readFile(path.join(output, 'master.json'), 'utf8'))
    const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
    expect(master.every((store: { sites: Record<string, unknown>[] }) => store.sites.every(site => !('pw1_source' in site)))).toBe(true)
    expect(JSON.stringify(report)).not.toContain('sites.pw1_source.')
    expect(JSON.stringify(report)).toContain('source-csv.stores')
    await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
    master[0].sites[0].pw1_source = {}
    await rewrite(output, 'master.json', master)
    await expect(validateArtifact(output)).rejects.toThrow('MASTER_SCHEMA_INVALID')
  })
  it('rejects forged external contribution paths', async () => {
    const output = await fixture()
    const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
    const contribution = report.rows.flatMap((row: { contributions: { rule: string; targetPath: string }[] }) => row.contributions).find((item: { rule: string }) => item.rule === 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE')
    contribution.targetPath = 'source-csv.users'
    await rewrite(output, 'mapping-report.json', report)
    await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})

describe('[TC-F42-EXP-088] Outcome artifact integrity', () => {
  it('exports actionable reports and rejects a falsified completeness summary', async () => {
    // Arrange
    const output = await fixture(), m = await manifest(output)
    // Assert
    expect(m).toMatchObject({ status: 'exported', outcome: { exportStatus: 'succeeded', importStatus: 'not_verified' } })
    expect(m.artifacts['export-review.json']).toBeDefined()
    expect(m.artifacts['export-review.md']).toBeDefined()
    // Act / Assert
    m.outcome.dataIssueCount++
    await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(m))
    await expect(validateArtifact(output)).rejects.toThrow('ARTIFACT_OUTCOME_INCONSISTENT')
  })
  it('rejects a rewritten review report even with an updated file hash', async () => {
    const output = await fixture()
    const review = JSON.parse(await readFile(path.join(output, 'export-review.json'), 'utf8'))
    review.groups = []
    await rewrite(output, 'export-review.json', review)
    await expect(validateArtifact(output)).rejects.toThrow('ARTIFACT_OUTCOME_INCONSISTENT')
  })
})

describe('[TC-F42-EXP-089] Corrected contract real pipeline', () => {
  it('exports shared invalid raw template as CSV-only evidence without changing operational mapping', async () => {
    // Arrange
    const source = await writeExportFixture(root), output = path.join(root, 'global-template')
    const config = JSON.parse(await readFile(source.configPath, 'utf8'))
    config.tables.frontend_templates = 'frontend_templates.csv'
    await writeFile(path.join(source.input, 'frontend_templates.csv'), 'id,name,config\n1,Template,{\n')
    const storesPath = path.join(source.input, 'stores.csv')
    const lines = (await readFile(storesPath, 'utf8')).trimEnd().split('\n')
    await writeFile(storesPath, lines.map((line, i) => line + (i ? ',1' : ',frontend_template_id')).join('\n') + '\n')
    await writeFile(source.configPath, JSON.stringify(config))
    // Act
    await exportMaster(source.input, source.configPath, output)
    const review = JSON.parse(await readFile(path.join(output, 'export-review.json'), 'utf8'))
    // Assert
    expect(review.groups).toEqual(expect.arrayContaining([expect.objectContaining({ table: 'frontend_templates', code: 'RAW_VALUE_UNVERIFIED', reason: 'INVALID_JSON', category: 'outside_scope' })]))
    await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid', exitCode: 0 })
  })
})


it('TC-F42-EXP-093: exports exact Blog content with owner fallback and does not merge content_ms', async () => {
  // Arrange
  const source = await writeExportFixture(root), output = path.join(root, 'blog-export')
  const config = JSON.parse(await readFile(source.configPath, 'utf8'))
  const content = '  <script>CANARY()</script>\r\n<img src="javascript:x"><a href="/x?token=CANARY">A &amp; B</a> '
  const cell = '"' + content.replace(/"/g, '""') + '"'
  config.tables.blog_posts = 'blog_posts.csv'
  await writeFile(path.join(source.input, 'blog_posts.csv'), 'id,store_id,name,slug,status,created_by,content,content_ms,created_at,updated_at\n' +
    `99,1,Article,article,1,,${cell},MS_ONLY_CANARY,2025-01-01 00:00:00,2025-01-02 00:00:00\n`)
  await writeFile(source.configPath, JSON.stringify(config))
  // Act
  await exportMaster(source.input, source.configPath, output)
  const master = JSON.parse(await readFile(path.join(output, 'master.json'), 'utf8'))
  const report = JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8'))
  // Assert
  const blog = master[0].blogs[0]
  expect(blog.author).toBe('@users:users:1')
  expect(blog.content.root.children[0].children[0].text).toBe(content)
  expect(JSON.stringify(blog)).not.toContain('MS_ONLY_CANARY')
  expect(report.diagnostics.filter((d: { table?: string; field?: string; code: string }) => d.table === 'blog_posts' && (['content', 'content_ms'].includes(d.field ?? '') || d.code === 'BLOG_AUTHOR_UNRESOLVED'))).toEqual([])
  await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
})

it('TC-F42-EXP-095: publishes recovered option definitions with valid receipts and no invented SKU', async () => {
  // Arrange
  const source = await writeExportFixture(root), output = path.join(root, 'variant-recovery')
  const config = JSON.parse(await readFile(source.configPath, 'utf8'))
  const storesPath = path.join(source.input, 'stores.csv')
  const stores = (await readFile(storesPath, 'utf8')).trimEnd().split('\n')
  await writeFile(storesPath, stores.map((line, index) => line + (index ? ',1' : ',currency_id')).join('\n') + '\n')
  const dates = '2025-01-01 00:00:00,2025-01-02 00:00:00'
  const tables = {
    currencies: 'id,code\n1,MYR\n',
    categories: `id,store_id,name,slug,status,created_at,updated_at\n10,1,Books,books,1,${dates}\n`,
    products: `id,store_id,category_id,name,slug,status,created_at,updated_at\n20,1,10,First book,first-book,1,${dates}\n`,
    product_skus: 'id,store_id,product_id,status,sku,price,stock\n30,1,20,1,BOOK-S,12.50,5\n31,1,20,1,BOOK-M,15,6\n',
    attributes: 'id,store_id,name\n40,1,Size\n',
    attribute_values: 'id,store_id,attribute_id,name\n50,1,40,S\n51,1,40,M\n',
    product_attributes: 'id,product_id,attribute_id,attribute_value_id\n60,20,40,50\n',
    product_variants: 'id,product_sku_id,attribute_id,attribute_value_id\n70,30,40,50\n71,31,40,51\n',
  }
  for (const [table, bytes] of Object.entries(tables)) {
    config.tables[table] = `${table}.csv`
    await writeFile(path.join(source.input, `${table}.csv`), bytes)
  }
  await writeFile(source.configPath, JSON.stringify(config))
  // Act
  await exportMaster(source.input, source.configPath, output)
  const master = JSON.parse(await readFile(path.join(output, 'master.json'), 'utf8'))
  const receipt = JSON.parse(await readFile(path.join(output, 'product-reconciliation.json'), 'utf8'))
  // Assert
  expect(master[0].products).toHaveLength(1)
  expect(master[0].products[0].variants).toHaveLength(2)
  expect(master[0].products[0].inventory).toBe(11)
  expect(receipt.products[0].tiers[0].options.map((o: { attributeValueId: string }) => o.attributeValueId)).toEqual(['50', '51'])
  expect(receipt.products[0].skus.map((s: { sourceSkuId: string }) => s.sourceSkuId)).toEqual(['30', '31'])
  await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
})


describe('[TC-F42-EXP-096] Missing Product price/stock exclusion artifact', () => {
  it('retains Product and catalog children with explicit evidence and no unresolved coverage', async () => {
    // Arrange
    const source = await writeExportFixture(root), output = path.join(root,'excluded-product')
    const config = JSON.parse(await readFile(source.configPath,'utf8'))
    const tables = {
      products: 'id,store_id,name,slug,status\n20,1,Missing price,item,1\n21,1,No SKU,no-sku,1\n22,1,Deleted SKU,deleted-sku,1\n',
      product_skus: 'id,store_id,product_id,status,price,stock,deleted_at\n30,1,20,1,,5,\n31,1,22,1,5,2,2025-01-01\n',
      product_images: 'id,product_id,url\n40,20,https://example.test/image.png\n',
      product_attributes: 'id,product_id,attribute_id,attribute_value_id\n50,20,60,70\n',
      product_variants: 'id,product_sku_id,attribute_id,attribute_value_id\n80,30,60,70\n',
    }
    for (const [table,bytes] of Object.entries(tables)) {config.tables[table]=table+'.csv';await writeFile(path.join(source.input,table+'.csv'),bytes)}
    await writeFile(source.configPath,JSON.stringify(config))
    // Act
    await exportMaster(source.input,source.configPath,output)
    const report=JSON.parse(await readFile(path.join(output,'mapping-report.json'),'utf8'))
    const master=JSON.parse(await readFile(path.join(output,'master.json'),'utf8'))
    // Assert
    expect(master.flatMap((s:{products:unknown[]})=>s.products)).toEqual([])
    expect(report.diagnostics.filter((d:{code:string})=>d.code==='PRODUCT_MISSING_PRICE_STOCK_EXCLUDED')).toHaveLength(3)
    for (const table of Object.keys(tables)) {
      expect(report.rows.filter((r:{table:string})=>r.table===table)).toEqual(expect.arrayContaining([expect.objectContaining({disposition:'retained-source',productExclusion:expect.any(Object)})]))
      expect(report.diagnostics.filter((d:{table?:string;code:string})=>d.table===table&&d.code==='SOURCE_FIELDS_UNRESOLVED')).toEqual([])
    }
    await expect(validateArtifact(output)).resolves.toMatchObject({integrityStatus:'valid'})
    report.rows.find((r:{table:string;sourceId:string})=>r.table==='products'&&r.sourceId==='20').productExclusion.reason='MISSING_STOCK'
    await rewrite(output,'mapping-report.json',report)
    await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})
