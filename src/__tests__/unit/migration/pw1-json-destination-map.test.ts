import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { exportDestinationMap } from '@/lib/migration/pw1-json/destination-map'
import type { SqlClient } from '@/lib/migration/pw1-json/ledger'

const batchId = 'json:00000000-0000-4000-8000-000000000001'
const directories: string[] = []
async function outputPath() {
  const directory = await mkdtemp(join(tmpdir(), 'pw1-destination-map-'))
  directories.push(directory)
  return join(directory, 'destination-map.json')
}
function fixture(options: { pending?: boolean; foundation?: boolean; invalid?: boolean; wrongTenant?: boolean; targetHash?: string } = {}) {
  const rows: Record<string, unknown>[] = [
    { source_store_id: '636', source_entity: 'stores', source_id: '636', target_collection: 'tenants', target_id: '425', live_id: 425, claim_valid: true },
    { source_store_id: '636', source_entity: 'sites', source_id: '636', target_collection: 'sites', target_id: '424', live_id: 424, tenant_id: options.wrongTenant ? 99 : 425, claim_valid: !options.invalid },
  ]
  if (!options.foundation) rows.push({ source_store_id: '636', source_entity: 'categories', source_id: '12', target_collection: 'categories', target_id: '98', live_id: 98, tenant_id: 425, claim_valid: true })
  const queries: string[] = []
  const db: SqlClient = { async query(sql) {
    queries.push(sql)
    if (sql.includes('SELECT * FROM migration_import_batches')) return { rows: [{ batch_id: batchId.slice(5), profile_version: 'pw1-json-v3', binding: {
      profile: 'pw1-json-v3', sourceInstance: 'PW1_PROD', snapshotId: 'snapshot', targetHash: options.targetHash ?? 'target', manifestHash: 'manifest', masterHash: 'master', ...(options.foundation ? { executionScope: 'foundation' } : {}),
    }, selected_store_ids: options.pending ? ['636', '637'] : ['636'], state: options.pending ? 'PAUSED' : 'VERIFIED', created_at: '2026-09-23T00:00:00Z' }] }
    if (sql.startsWith('SELECT source_store_id,state')) return { rows: [{ source_store_id: '636', state: 'VERIFIED' }] }
    return { rows }
  } }
  return { db, queries }
}
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))) })

describe('[TC-F42-IMP-DESTINATION-MAP] compact ledger destination', () => {
  it('exports live verified mappings with category source refs and only read queries', async () => {
    // Arrange
    const path = await outputPath(), { db, queries } = fixture()
    // Act
    const value = await exportDestinationMap(db, batchId, 'target', path)
    // Assert
    expect(value.stores['636']).toEqual({ tenantId: 425, siteId: 424, productCategories: [{ sourceRef: '@categories:categories:12', targetId: 98 }] })
    expect(value.status).toBe('complete')
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(value)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(queries.every(sql => sql.startsWith('SELECT'))).toBe(true)
    expect(queries.at(-1)).toContain('owner.claim_active=true')
    expect(queries.at(-1)).toContain("m.action='SKIP'")
  })
  it('labels partial users output and omits pending stores', async () => {
    // Arrange
    const path = await outputPath(), { db } = fixture({ pending: true, foundation: true })
    // Act
    const value = await exportDestinationMap(db, batchId, 'target', path)
    // Assert
    expect(value.scope).toBe('foundation')
    expect(value.status).toBe('partial')
    expect(value.completeness).toEqual({ selected: 2, verified: 1, pendingStoreIds: ['637'] })
    expect(value.stores['636'].productCategories).toEqual([])
    expect(value.stores['637']).toBeUndefined()
  })
  it.each([{ invalid: true }, { wrongTenant: true }, { targetHash: 'other' }])('blocks invalid ownership, relationships or target %j', async options => {
    // Arrange
    const path = await outputPath(), { db } = fixture(options)
    // Act / Assert
    await expect(exportDestinationMap(db, batchId, 'target', path)).rejects.toThrow(/DESTINATION_/)
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('allows atomic same-batch retry but preserves foreign output', async () => {
    // Arrange
    const path = await outputPath(), { db } = fixture()
    await exportDestinationMap(db, batchId, 'target', path)
    // Act
    await exportDestinationMap(db, batchId, 'target', path)
    const foreign = { ...JSON.parse(await readFile(path, 'utf8')), batchId: 'other' }
    await writeFile(path, JSON.stringify(foreign))
    // Assert
    await expect(exportDestinationMap(db, batchId, 'target', path)).rejects.toThrow('DESTINATION_OUTPUT_PROVENANCE_MISMATCH')
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(foreign)
  })
  it('rejects symlink output without changing its target', async () => {
    // Arrange
    const path = await outputPath(), { db } = fixture()
    const target = `${path}.original`
    await writeFile(target, 'unchanged')
    await symlink(target, path)
    // Act / Assert
    await expect(exportDestinationMap(db, batchId, 'target', path)).rejects.toThrow('DESTINATION_OUTPUT_UNSAFE')
    expect(await readFile(target, 'utf8')).toBe('unchanged')
  })
})
