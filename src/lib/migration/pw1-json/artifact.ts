import * as legacyOutcome from './export-outcome-v1'
import { outcomeSchema, exportOutcome, externalArchiveKeys } from './export-outcome'
import type { Progress } from './progress'
import { createSelectedSourceScope } from './source-scope'
import { constants, mkdtempSync, writeFileSync, appendFileSync, chmodSync, rmSync } from 'node:fs'
import { open, lstat, realpath, statfs, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve, basename, relative, isAbsolute } from 'node:path'
import { z } from 'zod'
import { parseJsonChunks, type ArrayItemVisitor } from './stream-json'
import { MigrationError } from './errors'
import { checksum } from './projection'
import { migrationPolicySchema, createDiagnosticCollector, APPROVED_POLICY } from './diagnostics'
import { validateUserActors, loadCreatorBindings } from './creator-bindings'
import { COLLECTIONS, type ImportArtifact, type ImportDiagnostic, type ImportManifest, type ImportStore, type ImportDocument, type StoreSelector } from './types'
import { createReconciliationIndex } from './reconciliation'
import { createSourceClassificationIndex, classificationRowSchema, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH } from './classification'
import { compareStoreIds, normalizeStoreId, selectStoreIds } from './selectors'

export { VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH } from './classification'

export const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024 * 1024
export const EXPECTED_MAPPING_HASH = '62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26'
export const NEW_MAPPING_HASH = '8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9'
export const CLASSIFIED_MAPPING_HASH = '27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567'
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const nonempty = z.string().min(1).max(512)
const importManifestV1 = z.object({
  version: z.literal(1), profile: z.literal('pw1-json-v1'), sourceInstance: nonempty,
  sourceDatabase: nonempty, snapshotId: nonempty, asOf: z.string().datetime({ offset: true }),
  mappingHash: z.literal(EXPECTED_MAPPING_HASH), masterHash: digest,
  credentialHash: digest.nullable(), exporterManifestHash: digest,
}).strict()
const importManifestV2 = importManifestV1.extend({
  version: z.literal(2), profile: z.literal('pw1-json-v2'), mappingHash: z.literal(NEW_MAPPING_HASH),
  sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/), migrationPolicyHash: digest.nullable(),
  actorArtifactHash: digest.nullable(), creatorBindingsHash: digest.nullable(), classifierVersion: z.literal('diagnostic-policy-v1'),
}).strict()
const importManifestV3 = importManifestV2.extend({
  version: z.literal(3), profile: z.literal('pw1-json-v3'), mappingHash: z.enum([CLASSIFIED_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH]),
  classifierVersion: z.literal('diagnostic-policy-v2'), classificationVersion: z.literal('source-classification-v1'),
  customerReconciliationHash: digest, productReconciliationHash: digest,
}).strict()
export const importManifestSchema = z.union([importManifestV1, importManifestV2, importManifestV3])
const exporterSchema = z.object({
  version: z.literal(1), exporterVersion: z.literal('1.0.0'), contractSha256: z.literal(EXPECTED_MAPPING_HASH),
  sourceConfigSha256: digest,
  sourceSnapshot: z.object({ sourceInstance: nonempty, sourceDatabase: nonempty, sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/), snapshotId: nonempty, asOf: z.string().datetime({ offset: true }) }).strict(),
  files: z.array(z.object({ table: z.string().optional(), filename: z.string(), sha256: digest, bytes: z.number().int().nonnegative(), selected: z.boolean(), rowCount: z.number().int().nonnegative().nullable(), headers: z.array(z.string()) }).strict()),
  artifacts: z.object({ 'master.json': digest, 'mapping-report.json': digest, 'mapping-report.csv': digest, 'README.md': digest, 'store-summary.json': digest.optional(), 'store-summary.csv': digest.optional() }).strict(),
  acceptedExclusions: z.array(z.object({ ruleId: z.literal('MASTER-2.2-OPTIONAL-HISTORY'), collection: z.enum(['notifications', 'subscribers', 'contact-submissions', 'analytics']), reason: nonempty, decisionEvidence: nonempty }).strict()).optional(),
  status: z.enum(['complete', 'needs_review']), importReady: z.literal(false),
  coverage: z.object({ accounted: z.literal(true) }).strict(), mapping: z.object({ complete: z.boolean() }).strict(),
  counts: z.object({ sourceStoreCount: z.number().int().nonnegative(), selectedStoreCount: z.number().int().nonnegative(), policyExcludedStoreCount: z.number().int().nonnegative(), emittedStoreCount: z.number().int().nonnegative(), blockedStoreCount: z.number().int().nonnegative(), blockers: z.number().int().nonnegative() }).strict(),
  blockedStores: z.array(z.string()), policyExcludedStores: z.array(z.string()),
}).strict()
const exporterV2 = exporterSchema.extend({
  contractSha256: z.literal(NEW_MAPPING_HASH),
  artifacts: exporterSchema.shape.artifacts.extend({ 'user-actors.json': digest.optional() }).strict(),
  migrationPolicy: migrationPolicySchema.optional(),
}).strict()
const exporterV3 = exporterV2.extend({
  exporterVersion: z.literal('1.2.0'), contractSha256: z.literal(CLASSIFIED_MAPPING_HASH),
  classificationVersion: z.literal('source-classification-v1'),
  artifacts: exporterV2.shape.artifacts.extend({ 'customer-reconciliation.json': digest, 'product-reconciliation.json': digest }).strict(),
}).strict()
const exporterV5 = exporterV3.extend({ exporterVersion: z.literal('1.4.0'), contractSha256: z.literal(ARCHIVE_MAPPING_HASH) })
const exporterV6 = exporterV3.extend({ exporterVersion: z.literal('1.5.0'), contractSha256: z.literal(OUTCOME_MAPPING_HASH), status: z.literal('exported'), outcome: legacyOutcome.outcomeSchema, artifacts: exporterV3.shape.artifacts.extend({ 'export-review.json': digest, 'export-review.md': digest }).strict() })
const exporterV7 = exporterV6.extend({ exporterVersion: z.literal('1.5.1'), contractSha256: z.literal(CORRECTED_OUTCOME_MAPPING_HASH), outcome: outcomeSchema })
const exporterV8 = exporterV7.extend({ exporterVersion: z.literal('1.6.0'), contractSha256: z.literal(DESCRIPTION_MAPPING_HASH) })
const exporterV9 = exporterV8.extend({ exporterVersion: z.literal('1.6.1'), contractSha256: z.literal(BLOG_OWNER_MAPPING_HASH) })
const exporterV10 = exporterV9.extend({ exporterVersion: z.literal('1.6.2'), contractSha256: z.literal(BLOG_CONTENT_MAPPING_HASH) })
const exporterV11 = exporterV10.extend({ exporterVersion: z.literal('1.7.0'), contractSha256: z.literal(VARIANT_MAPPING_HASH) })
const exporterV4 = exporterV3.extend({
  exporterVersion: z.literal('1.3.0'), contractSha256: z.literal(STATUS_MAPPING_HASH),
}).strict()
const diagnosticSchema = z.object({ code: z.string().max(128).regex(/^[A-Z][A-Z0-9_]*$/), severity: z.enum(['warning', 'blocker']), storeId: z.string().max(512).optional(), table: z.string().max(512).optional(), sourceId: z.string().max(512).optional(), field: z.string().max(512).optional(), reason: z.string().max(512).regex(/^[A-Z][A-Z0-9_]*$/).optional() }).strict()
const reportRowSchema = z.object({
  table: z.string(), sourceId: z.string(), storeId: z.string().nullable(), record: z.number().int().positive(),
  disposition: z.enum(['mapped', 'partial', 'retained-source', 'excluded', 'unresolved']),
  fields: z.record(z.enum(['security-excluded', 'mapped', 'retained-source', 'deleted-retained-source', 'technical-user-excluded', 'source-identity', 'unresolved'])),
  contributions: z.array(z.object({ storeId: z.string().optional(), table: z.string(), sourceId: z.string(), fields: z.array(z.string()), targetPath: z.string(), rule: z.string() }).strict()),
}).strict()
const pageTables = new Set(['pages', 'page_components', 'banners', 'shortlist_items', 'frontend_components'])

/** Refuse symlink components, including parents, before opening with O_NOFOLLOW. */
export async function secureFilePath(filename: string): Promise<string> {
  const absolute = resolve(filename)
  if (await realpath(absolute) !== absolute || !(await lstat(absolute)).isFile()) throw new MigrationError('ARTIFACT_PATH_UNSAFE')
  return absolute
}

/** Hash the exact descriptor bytes parsed, with identity/mtime check on completion. */
export async function readBoundFile(filename: string, options: { onBytes?: (bytes: number, total: number) => void; json?: boolean; expectedHash?: string; maxBytes?: number; maxScalarBytes?: number; visit?: ArrayItemVisitor } = {}): Promise<{ value: unknown; hash: string }> {
  const path = await secureFilePath(filename)
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = await handle.stat()
    const limit = options.maxBytes ?? MAX_ARTIFACT_BYTES
    if (before.size > limit) throw new MigrationError('ARTIFACT_SIZE_LIMIT')
    const hash = createHash('sha256')
    let bytes = 0
    options.onBytes?.(0, before.size)
    async function* chunks(): AsyncGenerator<Uint8Array> {
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
        bytes += buffer.length
        if (bytes > limit) throw new MigrationError('ARTIFACT_SIZE_LIMIT')
        hash.update(buffer)
        yield buffer
        options.onBytes?.(bytes, before.size)
      }
    }
    let value: unknown
    if (options.json) value = await parseJsonChunks(chunks(), options.visit, { maxScalarBytes: options.maxScalarBytes })
    else for await (const _chunk of chunks()) { /* hash only; no full-file buffer */ }
    const after = await handle.stat()
    const actual = hash.digest('hex')
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || bytes !== before.size || (options.expectedHash && actual !== options.expectedHash)) throw new MigrationError('ARTIFACT_HASH_MISMATCH')
    return { value, hash: actual }
  } finally { await handle.close() }
}

function validate<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new MigrationError(code)
  return result.data
}

export async function inspectExportArtifact(directory: string) {
  const manifestFile = await readBoundFile(resolve(directory, 'master-manifest.json'), { json: true, maxBytes: 16 * 1024 * 1024 })
  const manifest = validate(z.union([exporterSchema, exporterV2, exporterV3, exporterV4, exporterV5, exporterV6, exporterV7, exporterV8, exporterV9, exporterV10, exporterV11]), manifestFile.value, 'EXPORT_MANIFEST_INVALID')
  return { manifest, hash: manifestFile.hash }
}

export async function loadImportArtifact(manifestPath: string, options: { progress?: Progress; selector?: StoreSelector; storeIds?: readonly string[]; maxRetainedBytes?: number; spoolDirectory?: string } = {}): Promise<ImportArtifact> {
  const readArtifact: typeof readBoundFile = (filename, readOptions = {}) => readBoundFile(filename, {
    ...readOptions,
    onBytes: (bytes, totalBytes) => options.progress?.({ phase: 'read-artifact', file: basename(filename), bytes, totalBytes }),
  })

  const directory = dirname(resolve(manifestPath))
  await assertOutsideRepository(directory)
  if (basename(manifestPath) !== 'import-manifest.json') throw new MigrationError('IMPORT_MANIFEST_FILENAME_INVALID')
  if (((await lstat(directory)).mode & 0o077) !== 0) throw new MigrationError('ARTIFACT_DIRECTORY_NOT_PRIVATE')
  if (((await lstat(manifestPath)).mode & 0o077) !== 0) throw new MigrationError('ARTIFACT_FILE_NOT_PRIVATE')
  const source = await readArtifact(manifestPath, { json: true, maxBytes: 1024 * 1024 })
  const manifest: ImportManifest = validate(importManifestSchema, source.value, 'IMPORT_MANIFEST_INVALID')
  if (((await lstat(resolve(directory, 'master-manifest.json'))).mode & 0o077) !== 0) throw new MigrationError('ARTIFACT_FILE_NOT_PRIVATE')
  const exported = await inspectExportArtifact(directory)
  if (exported.hash !== manifest.exporterManifestHash || exported.manifest.artifacts['master.json'] !== manifest.masterHash || exported.manifest.sourceSnapshot.sourceInstance !== manifest.sourceInstance || exported.manifest.sourceSnapshot.sourceDatabase !== manifest.sourceDatabase || exported.manifest.sourceSnapshot.snapshotId !== manifest.snapshotId || exported.manifest.sourceSnapshot.asOf !== manifest.asOf) throw new MigrationError('IMPORT_EXPORT_BINDING_MISMATCH')
  if (manifest.mappingHash !== exported.manifest.contractSha256) throw new MigrationError('IMPORT_EXPORT_BINDING_MISMATCH')
  const policy = 'migrationPolicy' in exported.manifest ? exported.manifest.migrationPolicy : undefined
  const actorHash = 'user-actors.json' in exported.manifest.artifacts ? exported.manifest.artifacts['user-actors.json'] : undefined
  if (manifest.version >= 2 && (manifest.sourceInstanceToken !== exported.manifest.sourceSnapshot.sourceInstanceToken || manifest.migrationPolicyHash !== (policy ? checksum(policy) : null) || manifest.actorArtifactHash !== (actorHash ?? null))) throw new MigrationError('IMPORT_EXPORT_BINDING_MISMATCH')
  if (manifest.version === 3) {
    if (!('classificationVersion' in exported.manifest) || exported.manifest.classificationVersion !== manifest.classificationVersion ||
      !('customer-reconciliation.json' in exported.manifest.artifacts) || exported.manifest.artifacts['customer-reconciliation.json'] !== manifest.customerReconciliationHash ||
      !('product-reconciliation.json' in exported.manifest.artifacts) || exported.manifest.artifacts['product-reconciliation.json'] !== manifest.productReconciliationHash) throw new MigrationError('IMPORT_EXPORT_BINDING_MISMATCH')
  }
  let actors: ImportArtifact['actors']
  if (actorHash) {
    const file = await readArtifact(resolve(directory, 'user-actors.json'), { json: true, expectedHash: actorHash, maxBytes: 16 * 1024 * 1024 })
    actors = validateUserActors(file.value, exported.manifest.sourceSnapshot)
  }
  const creatorBindings = manifest.creatorBindingsHash ? await loadCreatorBindings(resolve(directory, 'creator-bindings.json'), manifest.creatorBindingsHash) : undefined
  if (creatorBindings) {
    for (const field of ['sourceInstance', 'sourceDatabase', 'sourceInstanceToken', 'snapshotId'] as const) {
      if (creatorBindings[field] !== manifest[field]) throw new MigrationError('CREATOR_BINDING_PROVENANCE_MISMATCH')
    }
    if (creatorBindings.actorArtifactHash !== manifest.actorArtifactHash) throw new MigrationError('CREATOR_BINDING_PROVENANCE_MISMATCH')
  }
  const partitionIds = new Set<string>()
  for (const id of [...exported.manifest.blockedStores, ...exported.manifest.policyExcludedStores]) {
    normalizeStoreId(id)
    if (partitionIds.has(id)) throw new MigrationError('EXPORT_PARTITION_INVALID')
    partitionIds.add(id)
  }
  const counts = exported.manifest.counts
  if (counts.sourceStoreCount !== counts.selectedStoreCount + counts.policyExcludedStoreCount || counts.selectedStoreCount !== counts.emittedStoreCount + counts.blockedStoreCount) throw new MigrationError('EXPORT_PARTITION_INVALID')
  const sourceTables = new Map<string, { count: number; headers: string[]; seen: number }>()
  const filenames = new Set<string>()
  for (const file of exported.manifest.files) {
    if (filenames.has(file.filename) || new Set(file.headers).size !== file.headers.length) throw new MigrationError('SOURCE_FILE_METADATA_INVALID')
    filenames.add(file.filename)
    if (!file.selected) continue
    if (!file.table || file.rowCount === null || sourceTables.has(file.table)) throw new MigrationError('SOURCE_TABLE_METADATA_INVALID')
    sourceTables.set(file.table, { count: file.rowCount, headers: file.headers, seen: 0 })
  }
  if (sourceTables.get('stores')?.count !== counts.sourceStoreCount) throw new MigrationError('STORE_SOURCE_COVERAGE_INVALID')
  if (options.storeIds && options.selector) throw new MigrationError('DUPLICATE_STORE_SELECTOR')
  const selector = options.selector
  const directIds = selector?.store !== undefined ? [selector.store] : selector?.stores !== undefined ? selector.stores.split(',') : undefined
  const bounds = selector?.fromStore !== undefined && selector.toStore !== undefined ? { from: normalizeStoreId(selector.fromStore), to: normalizeStoreId(selector.toStore) } : undefined
  if (selector) selectStoreIds(directIds ?? (bounds ? [bounds.from, bounds.to] : []), selector)
  const selected = options.storeIds ? new Set(options.storeIds.map(normalizeStoreId)) : directIds ? new Set(directIds.map(normalizeStoreId)) : bounds ? new Set<string>() : undefined
  const diagnosticSelection = selected ?? new Set<string>()
  const retainStore = (id: string) => {
    if (bounds && compareStoreIds(id, bounds.from) >= 0 && compareStoreIds(id, bounds.to) <= 0) selected!.add(id)
    const retained = !selected || selected.has(id)
    if (retained) diagnosticSelection.add(id)
    return retained
  }
  const outcomeDiagnostics: ImportDiagnostic[] = []
  const outcomeArchive = new Set<string>()
  let exporterBlockerCount = 0
  const sourceScope = manifest.version === 3 ? createSelectedSourceScope(actors, Boolean(policy && checksum(policy) === APPROVED_POLICY && policy.shippingPolicy === 'pw2-defaults')) : undefined
  const classification = manifest.version === 3 ? createSourceClassificationIndex(sourceScope) : undefined
  const reconciliation = manifest.version === 3 ? createReconciliationIndex() : undefined
  let customerRoot: unknown, productRoot: unknown
  let spoolDirectory: string | undefined
  const storeFiles: Record<string, { path: string; hash: string }> = Object.create(null)
  if (options.spoolDirectory) {
    const parent = resolve(options.spoolDirectory)
    await assertOutsideRepository(parent)
    if (await realpath(parent) !== parent || !(await lstat(parent)).isDirectory()) throw new MigrationError('SPOOL_PARENT_UNSAFE')
    const masterSize = (await lstat(resolve(directory, 'master.json'))).size
    await assertDiskSpace(parent, BigInt(masterSize) * BigInt(2) + BigInt(64) * BigInt(1024) * BigInt(1024))
    spoolDirectory = mkdtempSync(resolve(parent, 'pw1-json-store-cache-'))
    chmodSync(spoolDirectory, 0o700)
  }
  const targetCheckFiles: Record<string, { path: string; hash: string }> = Object.create(null)
  const targetWriters = new Map<string, { path: string; hash: ReturnType<typeof createHash>; bytes: number; count: number }>()
  const writeTargetCheck = spoolDirectory ? (diagnostic: ImportDiagnostic) => {
    if (!diagnostic.storeId) throw new MigrationError('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
    const storeId = normalizeStoreId(diagnostic.storeId)
    let writer = targetWriters.get(storeId)
    if (!writer) {
      const path = resolve(spoolDirectory!, `checks-${storeId}.json`)
      writeFileSync(path, '[', { mode: 0o600, flag: 'wx' })
      writer = { path, hash: createHash('sha256').update('['), bytes: 1, count: 0 }
      targetWriters.set(storeId, writer)
    }
    const chunk = `${writer.count ? ',' : ''}${JSON.stringify(diagnostic)}`
    writer.bytes += Buffer.byteLength(chunk)
    if (writer.bytes > 64 * 1024 * 1024 - 1) throw new MigrationError('STORE_DIAGNOSTIC_MEMORY_LIMIT')
    appendFileSync(writer.path, chunk)
    writer.hash.update(chunk); writer.count++
  } : undefined
  const collector = createDiagnosticCollector({ selected: diagnosticSelection, policy, contractHash: manifest.mappingHash,
    acceptedExclusions: exported.manifest.acceptedExclusions, classificationFinal: Boolean(classification),
    classify: classification ? d => classification.disposition(d) : undefined, onTargetCheck: writeTargetCheck })
  const addDiagnostic = (d: ImportDiagnostic) => collector.add(d)
  try {
  let pageExcludedRecords = 0
  const stores: ImportStore[] = []
  const seenStores = new Set<string>()
  let retainedBytes = 0
  const priority = (name: string) => name === 'master.json' ? 0 : name === 'mapping-report.json' ? 1 : 2
  for (const [name, expectedHash] of Object.entries(exported.manifest.artifacts).sort(([a], [b]) => priority(a) - priority(b))) {
    if (!expectedHash) continue
    const path = resolve(directory, name)
    if (((await lstat(path)).mode & 0o077) !== 0) throw new MigrationError('ARTIFACT_FILE_NOT_PRIVATE')
    if (name === 'master.json') {
      const result = await readArtifact(path, { json: true, expectedHash, visit: (position, _index, value) => {
        // Page documents are explicitly outside this import scope; still parsed strictly and hashed.
        if (position.length === 2 && position[1] === 'pages') { pageExcludedRecords++; return true }
        if (position.length !== 0) return false
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MigrationError('STORE_SHAPE_INVALID')
        const collections = value as Record<string, unknown>
        if (Object.keys(collections).length !== COLLECTIONS.length || COLLECTIONS.some(key => !Array.isArray(collections[key]))) throw new MigrationError('COLLECTION_SHAPE_INVALID')
        for (const key of COLLECTIONS) if (!(collections[key] as unknown[]).every(doc => doc !== null && typeof doc === 'object' && !Array.isArray(doc))) throw new MigrationError('DOCUMENT_SHAPE_INVALID')
        const tenants = collections.tenants as ImportDocument[]
        const ref = tenants.length === 1 ? tenants[0]._ref : undefined
        if (typeof ref !== 'string' || !/^@tenants:stores:[1-9]\d*$/.test(ref)) throw new MigrationError('STORE_IDENTITY_INVALID')
        const storeId = ref.slice('@tenants:stores:'.length)
        if (partitionIds.has(storeId)) throw new MigrationError('EXPORT_PARTITION_INVALID')
        if (seenStores.has(storeId)) throw new MigrationError('DUPLICATE_STORE')
        seenStores.add(storeId)
        reconciliation?.addStore({ storeId, collections: collections as ImportStore['collections'] })
        if (retainStore(storeId)) {
          const store: ImportStore = { storeId, collections: collections as ImportStore['collections'] }
          sourceScope?.addStore(store)
          const serialized = JSON.stringify(store)
          if (Buffer.byteLength(serialized) > (options.maxRetainedBytes ?? 64 * 1024 * 1024)) throw new MigrationError('SELECTED_STORE_MEMORY_LIMIT')
          if (spoolDirectory) {
            const path = resolve(spoolDirectory, `${storeId}.json`)
            writeFileSync(path, serialized, { mode: 0o600, flag: 'wx' })
            storeFiles[storeId] = { path, hash: createHash('sha256').update(serialized).digest('hex') }
          } else {
            retainedBytes += Buffer.byteLength(serialized)
            if (retainedBytes > (options.maxRetainedBytes ?? 64 * 1024 * 1024)) throw new MigrationError('SELECTED_STORE_MEMORY_LIMIT')
            stores.push(store)
          }
        }
        return true
      } })
      if (!Array.isArray(result.value)) throw new MigrationError('MASTER_ROOT_INVALID')
    } else if (name === 'mapping-report.json') {
      // Index diagnostics before compact rows regardless of JSON object key order.
      // Both passes verify the same artifact digest.
      if (classification) await readArtifact(path, { json: true, expectedHash, visit: (position, _index, value) => {
        if (position.length === 1 && position[0] === 'diagnostics') {
          classification.addDiagnostic(validate(diagnosticSchema, value, 'DIAGNOSTIC_INVALID'))
          return true
        }
        return position.length === 1 && position[0] === 'rows'
      } })
      const result = await readArtifact(path, { json: true, expectedHash, visit: (position, _index, value) => {
        if (position.length === 1 && position[0] === 'diagnostics') { const diagnostic = validate(diagnosticSchema, value, 'DIAGNOSTIC_INVALID'); if (manifest.version === 1 && diagnostic.reason !== undefined) throw new MigrationError('DIAGNOSTIC_INVALID'); if ([OUTCOME_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH].includes(manifest.mappingHash)) { if (outcomeDiagnostics.length >= 1000000) throw new MigrationError('DIAGNOSTIC_LIMIT'); outcomeDiagnostics.push(diagnostic) }; if (diagnostic.severity === 'blocker') exporterBlockerCount++; if (!classification) addDiagnostic(diagnostic); return true }
        if (position.length === 1 && position[0] === 'rows') {
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MigrationError('REPORT_ROW_INVALID')
          const row = manifest.version === 3 ? validate(classificationRowSchema, value, 'REPORT_ROW_INVALID') : validate(reportRowSchema, value, 'REPORT_ROW_INVALID')
          const table = sourceTables.get(row.table)
          if (!table || row.record !== table.seen + 1 || row.record > table.count || Object.keys(row.fields).length !== table.headers.length || table.headers.some(header => !(header in row.fields)) || row.contributions.some(contribution => contribution.table !== row.table || contribution.sourceId !== row.sourceId)) throw new MigrationError('REPORT_COVERAGE_INVALID')
          table.seen++
          if (classification) { const classifiedRow = classificationRowSchema.parse(row); classification.addRow(classifiedRow); if ([OUTCOME_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH].includes(manifest.mappingHash)) for (const key of externalArchiveKeys(classifiedRow)) outcomeArchive.add(key) }
          reconciliation?.addSourceRow({ table: row.table, sourceId: row.sourceId, storeId: row.storeId })
          if (!classification && (row.disposition === 'unresolved' || row.disposition === 'partial' || Object.values(row.fields).includes('unresolved')) && !(typeof row.table === 'string' && pageTables.has(row.table))) addDiagnostic({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', sourceId: row.sourceId, ...(typeof row.storeId === 'string' ? { storeId: row.storeId } : {}), ...(typeof row.table === 'string' ? { table: row.table } : {}) })
          return true
        }
        return false
      } })
      const report = result.value as Record<string, unknown> | null
      if (!report || report.version !== 1 || !Array.isArray(report.diagnostics) || !Array.isArray(report.rows) || Object.keys(report).some(key => !['version', 'diagnostics', 'rows'].includes(key))) throw new MigrationError('REPORT_SHAPE_INVALID')
      // Release ownership indexes before streaming receipt validation.
      if (classification) {
        for (const diagnostic of classification.finish()) addDiagnostic(diagnostic)
        // Classification is now immutable. Aggregate final dispositions instead
        // of retaining every source identity for later reclassification.
        await readArtifact(path, { json: true, expectedHash, visit: (position, _index, value) => {
          if (position.length === 1 && position[0] === 'diagnostics') {
            addDiagnostic(validate(diagnosticSchema, value, 'DIAGNOSTIC_INVALID'))
            return true
          }
          if (position.length === 1 && position[0] === 'rows') {
            const row = validate(classificationRowSchema, value, 'REPORT_ROW_INVALID')
            if ((row.disposition === 'unresolved' || row.disposition === 'partial' || Object.values(row.fields).includes('unresolved')) && !pageTables.has(row.table)) {
              addDiagnostic({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', sourceId: row.sourceId,
                ...(row.storeId !== null ? { storeId: row.storeId } : {}), table: row.table })
            }
            return true
          }
          return false
        } })
      }
    } else if (reconciliation && (name === 'customer-reconciliation.json' || name === 'product-reconciliation.json')) {
      const customer = name === 'customer-reconciliation.json'
      const result = await readArtifact(path, { json: true, expectedHash, visit: (position, _index, value) => {
        if (position.length === 1 && position[0] === (customer ? 'stores' : 'products')) {
          if (customer) reconciliation.validateCustomerStore(value); else reconciliation.validateProduct(value)
          return true
        }
        return false
      } })
      if (customer) customerRoot = result.value; else productRoot = result.value
    } else await readArtifact(path, { expectedHash })
  }
  reconciliation?.finish(customerRoot, productRoot, exported.manifest.sourceSnapshot)
  if ([...sourceTables.values()].some(table => table.seen !== table.count)) throw new MigrationError('REPORT_COVERAGE_INVALID')
  if (exporterBlockerCount !== exported.manifest.counts.blockers || exported.manifest.mapping.complete !== (exporterBlockerCount === 0) || exported.manifest.status !== ([OUTCOME_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH].includes(manifest.mappingHash) ? 'exported' : exporterBlockerCount === 0 ? 'complete' : 'needs_review') || exported.manifest.blockedStores.length !== exported.manifest.counts.blockedStoreCount || exported.manifest.policyExcludedStores.length !== exported.manifest.counts.policyExcludedStoreCount) throw new MigrationError('EXPORT_REPORT_COUNT_MISMATCH')
  if (seenStores.size !== exported.manifest.counts.emittedStoreCount) throw new MigrationError('EXPORT_STORE_COUNT_MISMATCH')
  if (selector) selectStoreIds([...seenStores], selector)
  if (selected && [...selected].some(id => !seenStores.has(id))) throw new MigrationError('STORE_NOT_IN_ARTIFACT')
  for (const storeId of exported.manifest.blockedStores) if (diagnosticSelection.has(storeId)) addDiagnostic({ code: 'EXPORT_STORE_BLOCKED', severity: 'blocker', storeId })
  if (manifest.credentialHash) await readArtifact(resolve(directory, 'credentials.enc'), { expectedHash: manifest.credentialHash, maxBytes: 64 * 1024 * 1024 })
  const optionalDispositions: ImportArtifact['optionalDispositions'] = {}
  for (const collection of ['notifications', 'subscribers', 'contact-submissions', 'analytics']) optionalDispositions[collection] = exported.manifest.acceptedExclusions?.some(exclusion => exclusion.collection === collection) ? 'ACCEPTED_SOURCE_EXCLUSION' : 'SOURCE_UNVERIFIED'
  for (const [storeId, writer] of targetWriters) {
    appendFileSync(writer.path, ']')
    targetCheckFiles[storeId] = { path: writer.path, hash: writer.hash.update(']').digest('hex') }
  }
  targetWriters.clear()
  if (exported.manifest.exporterVersion === '1.5.0' && JSON.stringify(exported.manifest.outcome) !== JSON.stringify(legacyOutcome.exportOutcome(outcomeDiagnostics, exported.manifest.blockedStores.length, exported.manifest.policyExcludedStores.length, outcomeArchive))) throw new MigrationError('EXPORT_OUTCOME_INCONSISTENT')
  if ((exported.manifest.exporterVersion === '1.5.1' || exported.manifest.exporterVersion === '1.6.0' || exported.manifest.exporterVersion === '1.6.1' || exported.manifest.exporterVersion === '1.6.2' || exported.manifest.exporterVersion === '1.7.0') && JSON.stringify(exported.manifest.outcome) !== JSON.stringify(exportOutcome(outcomeDiagnostics, exported.manifest.blockedStores.length, exported.manifest.policyExcludedStores, outcomeArchive))) throw new MigrationError('EXPORT_OUTCOME_INCONSISTENT')
  const { diagnostics, blockers, summary: diagnosticSummary } = collector.result()
  return { actors, creatorBindings, diagnosticSummary, coverage: exported.manifest.counts, pageExcludedRecords, optionalDispositions, manifest, manifestHash: source.hash, manifestPath: resolve(manifestPath), directory, stores, ...(spoolDirectory ? { spoolDirectory, storeFiles, targetCheckFiles } : {}), storeIds: [...seenStores].sort(compareStoreIds), diagnostics, blockers }
  } catch (error) {
    if (spoolDirectory) rmSync(spoolDirectory, { recursive: true, force: true })
    throw error
  }
}

/** Spool handles are returned only after every source artifact hash/report validates. */
export async function readImportStore(artifact: ImportArtifact, storeId: string): Promise<ImportStore> {
  normalizeStoreId(storeId)
  const retained = artifact.stores.find(store => store.storeId === storeId)
  if (retained) return retained
  const cached = artifact.storeFiles?.[storeId]
  if (!cached || !artifact.spoolDirectory || dirname(cached.path) !== artifact.spoolDirectory || basename(cached.path) !== `${storeId}.json`) throw new MigrationError('STORE_NOT_SELECTED')
  if (((await lstat(artifact.spoolDirectory)).mode & 0o077) !== 0 || ((await lstat(cached.path)).mode & 0o077) !== 0) throw new MigrationError('SPOOL_NOT_PRIVATE')
  const result = await readBoundFile(cached.path, { json: true, expectedHash: cached.hash, maxBytes: 64 * 1024 * 1024 })
  const store = result.value as ImportStore | null
  if (!store || store.storeId !== storeId || !store.collections || Object.keys(store).some(key => !['storeId', 'collections'].includes(key))) throw new MigrationError('SPOOL_STORE_INVALID')
  return store
}

export async function assertDiskSpace(directory: string, requiredBytes: bigint): Promise<void> {
  const stats = await statfs(directory, { bigint: true })
  if (stats.bavail * stats.bsize < requiredBytes) throw new MigrationError('ARTIFACT_DISK_SPACE_INSUFFICIENT')
}

export async function assertOutsideRepository(filename: string): Promise<void> {
  let candidate = resolve(process.cwd())
  for (;;) {
    try {
      await access(resolve(candidate, '.git'))
      const path = relative(await realpath(candidate), resolve(filename))
      if (path === '' || (!path.startsWith('..' + '/') && path !== '..' && !isAbsolute(path))) throw new MigrationError('PRIVATE_ARTIFACT_INSIDE_REPOSITORY')
      return
    } catch (error) {
      if (error instanceof MigrationError) throw error
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    const parent = dirname(candidate)
    if (parent === candidate) throw new MigrationError('REPOSITORY_ROOT_NOT_FOUND')
    candidate = parent
  }
}

/** Exact target checks are loaded for one store, with spool integrity verified. */
export async function readStoreTargetChecks(artifact: ImportArtifact, storeId: string): Promise<import('./diagnostics').DiagnosticBucket[]> {
  normalizeStoreId(storeId)
  if (!artifact.targetCheckFiles) return artifact.diagnosticSummary?.buckets.filter(bucket => bucket.disposition === 'TARGET_CHECK_REQUIRED' && bucket.diagnostic.storeId === storeId) ?? []
  const file = artifact.targetCheckFiles[storeId]
  if (!file) return []
  if (!artifact.spoolDirectory || dirname(file.path) !== artifact.spoolDirectory || basename(file.path) !== `checks-${storeId}.json`) throw new MigrationError('SPOOL_NOT_PRIVATE')
  if (((await lstat(file.path)).mode & 0o077) !== 0 || ((await lstat(artifact.spoolDirectory)).mode & 0o077) !== 0) throw new MigrationError('SPOOL_NOT_PRIVATE')
  const buckets = new Map<string, import('./diagnostics').DiagnosticBucket>()
  const result = await readBoundFile(file.path, { json: true, expectedHash: file.hash, maxBytes: 64 * 1024 * 1024,
    visit: (position, _index, value) => {
      if (position.length !== 0) return false
      const diagnostic = validate(diagnosticSchema, value, 'DIAGNOSTIC_INVALID')
      if (diagnostic.storeId !== storeId) throw new MigrationError('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
      const key = checksum(diagnostic)
      const previous = buckets.get(key)
      if (previous) previous.count++
      else buckets.set(key, { diagnostic, count: 1, disposition: 'TARGET_CHECK_REQUIRED', samples: [] })
      return true
    } })
  if (!Array.isArray(result.value)) throw new MigrationError('DIAGNOSTIC_INVALID')
  return [...buckets.values()]
}
