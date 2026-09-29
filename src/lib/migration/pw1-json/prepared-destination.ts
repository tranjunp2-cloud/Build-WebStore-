import { constants, writeSync } from 'node:fs'
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { assertDiskSpace, assertOutsideRepository, importManifestSchema, inspectExportArtifact, readBoundFile } from './artifact'
import { boundMasterHash, masterFiles, type MasterLayout } from './master-parts'
import { checksum } from './projection'
import { MigrationError } from './errors'
import type { DestinationMap } from './destination-map'
import type { Progress } from './progress'

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().regex(/^[1-9]\d*$/).max(512)
const mappingSchema = z.object({
  version: z.literal(1), format: z.literal('pw1-destination-map-v1'), batchId: z.string().regex(/^json:[a-f0-9-]{36}$/),
  source: z.object({ instance: z.string().min(1), snapshotId: z.string().min(1), manifestHash: hash, masterHash: hash }).strict(),
  targetHash: hash, scope: z.enum(['foundation', 'full']), status: z.literal('complete'),
  completeness: z.object({ selected: z.number().int().positive(), verified: z.number().int().positive(), pendingStoreIds: z.array(id).length(0) }).strict(),
  stores: z.record(id, z.object({ tenantId: z.number().int().positive().safe(), siteId: z.number().int().positive().safe(),
    productCategories: z.array(z.object({ sourceRef: z.string().regex(/^@categories:categories:[1-9]\d*$/), targetId: z.number().int().positive().safe() }).strict()),
  }).strict()),
}).strict()
const entrySchema = z.object({ filename: z.string().regex(/^master(?:-[0-9]{4,})?\.json$/), originalHash: hash, originalBytes: z.number().int().nonnegative().safe(),
  tempName: z.string().regex(/^\.destination-[a-f0-9-]{36}\.tmp$/), state: z.enum(['pending', 'ready', 'complete']),
  outputHash: hash.nullable(), bytes: z.number().int().nonnegative().safe().nullable(), storeIds: z.array(id).nullable(),
}).strict()
const journalSchema = z.object({ version: z.literal(1), format: z.literal('pw1-prepared-destination-v1'),
  importManifestHash: hash, exporterManifestHash: hash, mappingHash: hash, mapping: mappingSchema,
  status: z.enum(['finalizing', 'complete']), files: z.array(entrySchema).min(1).max(100_000),
}).strict()
type Journal = z.infer<typeof journalSchema>
type Entry = z.infer<typeof entrySchema>
export type DestinationFinalizeHook = (phase: 'temp-synced' | 'journal-ready' | 'renamed', filename: string) => Promise<void>
function fail(code: string): never { throw new MigrationError(code) }
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error }
}
async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r'); try { await handle.sync() } finally { await handle.close() }
}
async function save(directory: string, journal: Journal): Promise<void> {
  const path = resolve(directory, `.destination-journal-${randomUUID()}.tmp`)
  const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
  try {
    try { await handle.writeFile(JSON.stringify(journal) + '\n'); await handle.sync() } finally { await handle.close() }
    await rename(path, resolve(directory, 'destination-manifest.json')); await syncDirectory(directory)
  }
  finally { await unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error }) }
}

/** Caller owns the run lock and supplies complete, live-verified ledger destinations. Original manifests remain provenance, not reusable input. */
export async function finalizePreparedDestination(preparedDirectory: string, expectedImportManifestHash: string, input: DestinationMap, progress?: Progress, hook?: DestinationFinalizeHook): Promise<{ manifestPath: string; files: number }> {
  if (!isAbsolute(preparedDirectory) || await realpath(preparedDirectory) !== preparedDirectory) fail('DESTINATION_DIRECTORY_UNSAFE')
  await assertOutsideRepository(preparedDirectory)
  const directoryStat = await lstat(preparedDirectory)
  if (!directoryStat.isDirectory() || (directoryStat.mode & 0o077)) fail('DESTINATION_DIRECTORY_UNSAFE')
  if (!hash.safeParse(expectedImportManifestHash).success) fail('DESTINATION_PROVENANCE_MISMATCH')
  const parsed = mappingSchema.safeParse(input)
  if (!parsed.success) fail('DESTINATION_MAPPING_INVALID')
  const mapping = parsed.data
  if (mapping.completeness.selected !== mapping.completeness.verified || Object.keys(mapping.stores).length !== mapping.completeness.selected) fail('DESTINATION_MAPPING_INCOMPLETE')
  for (const destination of Object.values(mapping.stores)) {
    if ((mapping.scope === 'foundation' && destination.productCategories.length) || new Set(destination.productCategories.map(c => c.sourceRef)).size !== destination.productCategories.length) fail('DESTINATION_MAPPING_INVALID')
  }
  const imported = await readBoundFile(resolve(preparedDirectory, 'import-manifest.json'), { json: true, expectedHash: expectedImportManifestHash, maxBytes: 1024 * 1024 })
  const manifest = importManifestSchema.parse(imported.value)
  if (mapping.source.manifestHash !== imported.hash || mapping.source.masterHash !== manifest.masterHash || mapping.source.instance !== manifest.sourceInstance || mapping.source.snapshotId !== manifest.snapshotId) fail('DESTINATION_PROVENANCE_MISMATCH')
  const manifestPath = resolve(preparedDirectory, 'destination-manifest.json')
  let journal: Journal
  if (await exists(manifestPath)) {
    const parsedJournal = journalSchema.safeParse((await readBoundFile(manifestPath, { json: true, maxBytes: 64 * 1024 * 1024 })).value)
    if (!parsedJournal.success) fail('DESTINATION_JOURNAL_INVALID')
    journal = parsedJournal.data
  } else {
    const exported = await inspectExportArtifact(preparedDirectory)
    if (exported.hash !== manifest.exporterManifestHash || boundMasterHash(exported.manifest) !== manifest.masterHash || exported.manifest.sourceSnapshot.sourceInstance !== manifest.sourceInstance || exported.manifest.sourceSnapshot.snapshotId !== manifest.snapshotId || exported.manifest.sourceSnapshot.sourceDatabase !== manifest.sourceDatabase || exported.manifest.sourceSnapshot.asOf !== manifest.asOf || exported.manifest.contractSha256 !== manifest.mappingHash) fail('DESTINATION_PROVENANCE_MISMATCH')
    const inputFiles = masterFiles(exported.manifest)
    if (inputFiles.every(file => file.storeIds)) {
      const ids = new Set(inputFiles.flatMap(file => file.storeIds!))
      if (Object.keys(mapping.stores).some(id => !ids.has(id))) fail('DESTINATION_STORE_MISSING')
    }
    if (inputFiles.some(file => !file.storeIds)) {
      const ids = new Set<string>()
      for (const file of inputFiles) {
        const result = await readBoundFile(resolve(preparedDirectory, file.filename), { json: true, expectedHash: file.sha256, visit: (path, _index, value) => {
          if (path.length) return false
          const storeId = storeIdentity(value)
          if (ids.has(storeId)) fail('DUPLICATE_STORE')
          if (ids.size >= 1_000_000) fail('STORE_INDEX_LIMIT')
          ids.add(storeId)
          if ('destination' in (value as Record<string, unknown>)) fail('SOURCE_DESTINATION_CONFLICT')
          return true
        } })
        if (!Array.isArray(result.value)) fail('STORE_SHAPE_INVALID')
      }
      if (Object.keys(mapping.stores).some(id => !ids.has(id))) fail('DESTINATION_STORE_MISSING')
    }
    const entries: Entry[] = []
    for (const file of inputFiles) entries.push({ filename: file.filename, originalHash: file.sha256, originalBytes: (await lstat(resolve(preparedDirectory, file.filename))).size, tempName: `.destination-${randomUUID()}.tmp`, state: 'pending', outputHash: null, bytes: null, storeIds: null })
    journal = { version: 1, format: 'pw1-prepared-destination-v1', importManifestHash: imported.hash,
      exporterManifestHash: exported.hash, mappingHash: checksum(mapping), mapping, status: 'finalizing',
      files: entries,
    }
    await save(preparedDirectory, journal)
  }
  if (journal.importManifestHash !== imported.hash || journal.exporterManifestHash !== manifest.exporterManifestHash || journal.mappingHash !== checksum(mapping) || checksum(journal.mapping) !== journal.mappingHash) fail('DESTINATION_PROVENANCE_MISMATCH')
  // This unchanged, hash-bound manifest was schema-validated before journal publication.
  const original = await readBoundFile(resolve(preparedDirectory, 'master-manifest.json'), { json: true, expectedHash: journal.exporterManifestHash, maxBytes: 16 * 1024 * 1024 })
  const layout = original.value as MasterLayout
  if (boundMasterHash(layout) !== mapping.source.masterHash) fail('DESTINATION_PROVENANCE_MISMATCH')
  const originals = masterFiles(layout)
  if (journal.files.length !== originals.length || journal.files.some((file, i) => file.filename !== originals[i].filename || file.originalHash !== originals[i].sha256 || (originals[i].bytes !== undefined && file.originalBytes !== originals[i].bytes)) || new Set(journal.files.map(file => file.tempName)).size !== journal.files.length) fail('DESTINATION_JOURNAL_INVALID')
  const seen = new Set<string>()
  for (const [index, entry] of journal.files.entries()) {
    const path = resolve(preparedDirectory, entry.filename), temp = resolve(preparedDirectory, entry.tempName)
    if ((entry.state === 'pending') !== (entry.outputHash === null && entry.bytes === null && entry.storeIds === null) || (journal.status === 'complete' && entry.state !== 'complete')) fail('DESTINATION_JOURNAL_INVALID')
    const currentHash = (await readBoundFile(path)).hash
    if (entry.state === 'pending') {
      if (currentHash !== entry.originalHash || (await lstat(path)).size !== entry.originalBytes) fail('DESTINATION_SOURCE_CHANGED')
      await assertDiskSpace(preparedDirectory, BigInt(entry.originalBytes) * BigInt(2) + BigInt(64 * 1024 * 1024))
      // A crash during generation may leave this specifically journal-owned temporary file.
      if (await exists(temp)) { await readBoundFile(temp); await unlink(temp) }
      await generate(path, temp, entry, mapping, originals[index].storeIds, progress)
      await hook?.('temp-synced', entry.filename)
      entry.state = 'ready'
      await save(preparedDirectory, journal)
      await hook?.('journal-ready', entry.filename)
    } else if (!entry.outputHash || entry.bytes === null || !entry.storeIds) fail('DESTINATION_JOURNAL_INVALID')
    if (entry.state === 'ready') {
      if (currentHash === entry.outputHash) {
        if (await exists(temp)) { await readBoundFile(temp, { expectedHash: entry.outputHash! }); await unlink(temp); await syncDirectory(preparedDirectory) }
      } else if (currentHash === entry.originalHash) {
        await readBoundFile(temp, { expectedHash: entry.outputHash! })
        if ((await lstat(temp)).size !== entry.bytes) fail('DESTINATION_OUTPUT_CHANGED')
        await rename(temp, path); await syncDirectory(preparedDirectory)
        await hook?.('renamed', entry.filename)
      } else if (currentHash !== entry.outputHash) fail('DESTINATION_OUTPUT_CHANGED')
      entry.state = 'complete'; await save(preparedDirectory, journal)
    }
    await readBoundFile(path, { expectedHash: entry.outputHash! })
    if ((await lstat(path)).size !== entry.bytes) fail('DESTINATION_OUTPUT_CHANGED')
    if (originals[index].storeIds && JSON.stringify(entry.storeIds) !== JSON.stringify(originals[index].storeIds)) fail('DESTINATION_JOURNAL_INVALID')
    for (const storeId of entry.storeIds!) { if (seen.has(storeId)) fail('DUPLICATE_STORE'); seen.add(storeId) }
  }
  if (Object.keys(mapping.stores).some(storeId => !seen.has(storeId))) fail('DESTINATION_STORE_MISSING')
  if (journal.status !== 'complete') { journal.status = 'complete'; await save(preparedDirectory, journal) }
  return { manifestPath, files: journal.files.length }
}

async function generate(source: string, temp: string, entry: Entry, mapping: z.infer<typeof mappingSchema>, expectedIds: string[] | undefined, progress?: Progress): Promise<void> {
  const handle = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
  const digest = createHash('sha256'), ids: string[] = []; let bytes = 0
  const write = (text: string) => {
    const buffer = Buffer.from(text); let offset = 0
    while (offset < buffer.length) { const written = writeSync(handle.fd, buffer, offset, buffer.length - offset); if (!written) fail('OUTPUT_WRITE_FAILED'); offset += written }
    digest.update(buffer); bytes += buffer.length
  }
  try {
    write('[\n')
    const result = await readBoundFile(source, { json: true, expectedHash: entry.originalHash,
      onBytes: (bytes, totalBytes) => progress?.({ phase: 'read-artifact', file: entry.filename, bytes, totalBytes }),
      visit: (path, _index, value) => {
        if (path.length) return false
        const storeId = storeIdentity(value)
        const store = value as Record<string, unknown>
        if ('destination' in store) fail('SOURCE_DESTINATION_CONFLICT')
        if (ids.length >= 1_000_000) fail('STORE_INDEX_LIMIT')
        const destination = mapping.stores[storeId]
        const masterDestination = destination ? {
          ...destination,
          productCategories: destination.productCategories.map(category => category.targetId),
        } : undefined
        write(`${ids.length ? ',\n' : ''}${JSON.stringify(masterDestination ? { ...store, destination: masterDestination } : store)}`)
        ids.push(storeId); return true
      },
    })
    if (!Array.isArray(result.value) || new Set(ids).size !== ids.length || (expectedIds && JSON.stringify(ids) !== JSON.stringify(expectedIds))) fail('MASTER_PART_STORES_MISMATCH')
    write('\n]\n'); await handle.sync()
    entry.outputHash = digest.digest('hex'); entry.bytes = bytes; entry.storeIds = ids
  } finally { await handle.close() }
}

function storeIdentity(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('STORE_SHAPE_INVALID')
  const tenants = (value as Record<string, unknown>).tenants
  const tenant = Array.isArray(tenants) && tenants.length === 1 ? tenants[0] as Record<string, unknown> : undefined
  if (!tenant || typeof tenant._ref !== 'string' || !/^@tenants:stores:[1-9]\d*$/.test(tenant._ref)) fail('STORE_IDENTITY_INVALID')
  return tenant._ref.slice('@tenants:stores:'.length)
}
