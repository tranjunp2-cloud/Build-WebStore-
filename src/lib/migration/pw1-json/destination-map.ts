import { constants } from 'node:fs'
import { open, lstat, link, rename, unlink } from 'node:fs/promises'
import { dirname, resolve, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getBatch, listStoreStates, type SqlClient } from './ledger'
import { validateOutputPath } from './destination-master'
import { MigrationError } from './errors'

export interface DestinationMap {
  version: 1
  format: 'pw1-destination-map-v1'
  batchId: string
  source: { instance: string; snapshotId: string; manifestHash: string; masterHash: string }
  targetHash: string
  scope: 'foundation' | 'full'
  status: 'complete' | 'partial'
  completeness: { selected: number; verified: number; pendingStoreIds: string[] }
  stores: Record<string, { tenantId: number; siteId: number; productCategories: { sourceRef: string; targetId: number }[] }>
}

function positiveId(value: unknown): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new MigrationError('DESTINATION_TARGET_INVALID')
  return id
}
function provenance(value: DestinationMap): string {
  return JSON.stringify([value.version, value.format, value.batchId, value.source.instance, value.source.snapshotId,
    value.source.manifestHash, value.source.masterHash, value.targetHash, value.scope])
}

/** Read ledger and live targets only. Caller holds the orchestration run lock during publication. */
export async function buildDestinationMap(db: SqlClient, batchId: string, targetHash: string): Promise<DestinationMap> {
  const batch = await getBatch(db, batchId)
  if (batch.binding.targetHash !== targetHash) throw new MigrationError('DESTINATION_TARGET_MISMATCH')
  const states = await listStoreStates(db, batch.id)
  if (Object.keys(states).some(id => !batch.storeIds.includes(id))) throw new MigrationError('DESTINATION_STORE_OUTSIDE_BATCH')
  const verified = batch.storeIds.filter(id => states[id] === 'VERIFIED')
  const pendingStoreIds = batch.storeIds.filter(id => states[id] !== 'VERIFIED')
  const output: DestinationMap = {
    version: 1, format: 'pw1-destination-map-v1', batchId: batch.id,
    source: { instance: batch.binding.sourceInstance, snapshotId: batch.binding.snapshotId,
      manifestHash: batch.binding.manifestHash, masterHash: batch.binding.masterHash },
    targetHash, scope: batch.binding.executionScope === 'foundation' ? 'foundation' : 'full',
    status: pendingStoreIds.length ? 'partial' : 'complete',
    completeness: { selected: batch.storeIds.length, verified: verified.length, pendingStoreIds }, stores: {},
  }
  // Reuse operations are SKIP rows with an inactive claim: only their active owner confers ownership.
  const result = await db.query(`SELECT s.source_store_id,m.source_entity,m.source_id,m.target_collection,m.target_id,
    (m.source_system='pw1' AND m.source_instance_id=$2 AND ((m.action='CREATE' AND m.state='VERIFIED' AND m.claim_active=true)
      OR (m.action='SKIP' AND m.state='SKIPPED' AND m.claim_active=false
        AND m.detail->>'disposition'='VERIFIED_REUSE' AND owner.claim_active=true
        AND owner.state IN ('CREATED','VERIFIED','SKIPPED')
        AND owner.source_system=m.source_system AND owner.source_instance_id=m.source_instance_id AND owner.source_entity=m.source_entity
        AND owner.source_id=m.source_id AND owner.target_collection=m.target_collection AND owner.target_id=m.target_id))) AS claim_valid,
    CASE m.target_collection WHEN 'tenants' THEN t.id WHEN 'sites' THEN site.id WHEN 'categories' THEN c.id END AS live_id,
    CASE m.target_collection WHEN 'sites' THEN site.tenant_id WHEN 'categories' THEN c.tenant_id END AS tenant_id
    FROM migration_import_stores s JOIN migration_entity_map m ON m.run_id=s.run_id
    LEFT JOIN migration_entity_map owner ON owner.id=m.depends_on_entity_map_id
    LEFT JOIN tenants t ON m.target_collection='tenants' AND t.id::text=m.target_id
    LEFT JOIN sites site ON m.target_collection='sites' AND site.id::text=m.target_id
    LEFT JOIN categories c ON m.target_collection='categories' AND c.id::text=m.target_id
    WHERE s.batch_id=$1 AND s.state='VERIFIED' AND m.target_collection IN ('tenants','sites','categories')
    ORDER BY s.source_store_id,m.target_collection,m.source_id`, [batch.id.slice(5), batch.binding.sourceInstance])
  const verifiedSet = new Set(verified)
  const byStore = new Map<string, Record<string, unknown>[]>()
  for (const row of result.rows) {
    const id = String(row.source_store_id)
    if (!verifiedSet.has(id)) throw new MigrationError('DESTINATION_STORE_OUTSIDE_BATCH')
    const rows = byStore.get(id) ?? []
    rows.push(row)
    byStore.set(id, rows)
  }
  for (const id of verified) {
    const rows = byStore.get(id) ?? []
    const tenants = rows.filter(row => row.target_collection === 'tenants')
    const sites = rows.filter(row => row.target_collection === 'sites')
    if (tenants.length !== 1 || sites.length !== 1) throw new MigrationError('DESTINATION_FOUNDATION_INCOMPLETE')
    if (tenants[0].source_entity !== 'stores' || String(tenants[0].source_id) !== id || sites[0].source_entity !== 'sites' || String(sites[0].source_id) !== id) throw new MigrationError('DESTINATION_SOURCE_INVALID')
    for (const row of rows) {
      if (row.claim_valid !== true || positiveId(row.target_id) !== positiveId(row.live_id)) throw new MigrationError('DESTINATION_CLAIM_INVALID')
    }
    const tenantId = positiveId(tenants[0].target_id), siteId = positiveId(sites[0].target_id)
    if (rows.some(row => row.target_collection !== 'tenants' && positiveId(row.tenant_id) !== tenantId)) throw new MigrationError('DESTINATION_TENANT_MISMATCH')
    const categories = rows.filter(row => row.target_collection === 'categories')
    if (output.scope === 'foundation' && categories.length) throw new MigrationError('DESTINATION_SCOPE_MISMATCH')
    const productCategories = categories.map(row => {
      if (row.source_entity !== 'categories' || !/^[1-9]\d*$/.test(String(row.source_id))) throw new MigrationError('DESTINATION_SOURCE_INVALID')
      return { sourceRef: `@categories:categories:${String(row.source_id)}`, targetId: positiveId(row.target_id) }
    })
    if (new Set(productCategories.map(category => category.sourceRef)).size !== productCategories.length) throw new MigrationError('DESTINATION_SOURCE_INVALID')
    output.stores[id] = { tenantId, siteId, productCategories }
  }
  return output
}

/** Legacy compact report API. Config workflow finalizes prepared masters instead. */
export async function exportDestinationMap(db: SqlClient, batchId: string, targetHash: string, outputPath: string): Promise<DestinationMap> {
  const output = await buildDestinationMap(db, batchId, targetHash)
  await publish(outputPath, output)
  return output
}

async function publish(path: string, value: DestinationMap): Promise<void> {
  // Reuse the same outside-repository and symlink-parent checks for both initial and retry publication.
  const temp = resolve(dirname(path), `.destination-map-${randomUUID()}.tmp`)
  if (!isAbsolute(path)) throw new MigrationError('OUTPUT_PATH_MUST_BE_ABSOLUTE')
  await validateOutputPath(temp)
  let previous: Awaited<ReturnType<typeof lstat>> | undefined
  try { previous = await lstat(path) }
  catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error }
  if (previous) {
    if (!previous.isFile() || previous.isSymbolicLink() || previous.size > 64 * 1024 * 1024) throw new MigrationError('DESTINATION_OUTPUT_UNSAFE')
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const actual = await handle.stat()
      if (actual.ino !== previous.ino || actual.dev !== previous.dev) throw new MigrationError('DESTINATION_OUTPUT_CHANGED')
      let existing: DestinationMap
      try { existing = JSON.parse(await handle.readFile('utf8')) as DestinationMap
        if (provenance(existing) !== provenance(value)) throw new Error('provenance')
      } catch { throw new MigrationError('DESTINATION_OUTPUT_PROVENANCE_MISMATCH') }
    } finally { await handle.close() }
  } else await validateOutputPath(path)
  const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    try {
      await handle.writeFile(JSON.stringify(value, null, 2) + '\n')
      await handle.sync()
    } finally { await handle.close() }
    if (previous) {
      const current = await lstat(path)
      if (current.ino !== previous.ino || current.dev !== previous.dev || current.mtimeMs !== previous.mtimeMs) throw new MigrationError('DESTINATION_OUTPUT_CHANGED')
      await rename(temp, path)
    } else await link(temp, path)
    const directory = await open(dirname(path), 'r')
    try { await directory.sync() } finally { await directory.close() }
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
  }
}
