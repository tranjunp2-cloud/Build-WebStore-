// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, rm, appendFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import { validateArtifact } from '@/lib/migration/pw1-export/validate-artifact'
import { MASTER_SHA256, LEGACY_MASTER_SHA256, EXPORT_VERSION } from '@/lib/migration/pw1-export/master-version'

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
    const tables = {
      currencies: 'id,code\n1,MYR\n',
      categories: `id,store_id,name,slug,status,created_at,updated_at\n10,1,Books,books,1,${dates}\n`,
      products: `id,store_id,category_id,name,slug,created_at,updated_at\n20,1,10,First book,first-book,${dates}\n21,1,10,Second book,second-book,${dates}\n`,
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
    expect(master[0].products[0]).not.toHaveProperty('sku')
    expect(receipt.products.map((product: { skus: { sourceSkuId: string }[] }) => product.skus[0].sourceSkuId)).toEqual(['30', '31'])
    await expect(validateArtifact(output)).resolves.toMatchObject({ integrityStatus: 'valid' })
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
    const output = await fixture(), m = await manifest(output)
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
