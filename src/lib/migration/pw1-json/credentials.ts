import { isClassifiedMappingHash, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH } from './classification'
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parse } from 'csv-parse'
import { z } from 'zod'
import { MAX_ARTIFACT_BYTES, assertDiskSpace, assertOutsideRepository, NEW_MAPPING_HASH, CLASSIFIED_MAPPING_HASH, inspectExportArtifact, loadImportArtifact, readBoundFile, secureFilePath } from './artifact'
import { MigrationError } from './errors'
import { checksum } from './projection'
import { loadCreatorBindings } from './creator-bindings'
import type { ImportArtifact, ImportManifest, SourceCredential } from './types'

const LIMIT = 64 * 1024 * 1024
const sourceCredential = z.object({ key_string: z.string().max(1024 * 1024).nullable(), passwordHash: z.string().max(4096).optional() }).strict()
const encryptedSchema = z.object({ version: z.literal(1), iv: z.string().regex(/^[a-f0-9]{24}$/), tag: z.string().regex(/^[a-f0-9]{32}$/), ciphertext: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/) }).strict()

function binding(manifest: ImportManifest): string {
  return JSON.stringify({ purpose: 'pw1-json-credentials-v1', sourceInstance: manifest.sourceInstance, sourceDatabase: manifest.sourceDatabase, snapshotId: manifest.snapshotId, asOf: manifest.asOf, mappingHash: manifest.mappingHash, masterHash: manifest.masterHash, exporterManifestHash: manifest.exporterManifestHash, ...(manifest.version >= 2 ? { profile: manifest.profile, sourceInstanceToken: manifest.sourceInstanceToken, migrationPolicyHash: manifest.migrationPolicyHash, actorArtifactHash: manifest.actorArtifactHash, creatorBindingsHash: manifest.creatorBindingsHash, classifierVersion: manifest.classifierVersion, ...(manifest.version === 3 ? { classificationVersion: manifest.classificationVersion, customerReconciliationHash: manifest.customerReconciliationHash, productReconciliationHash: manifest.productReconciliationHash } : {}) } : {}) })
}
function encryptionKey(): Buffer {
  const secret = process.env.PW2_MIGRATION_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) throw new MigrationError('MIGRATION_SECRET_REQUIRED')
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret), Buffer.from('pw1-json-v1'), Buffer.from('credential-sidecar'), 32))
}

export async function loadCredentialSidecar(artifact: ImportArtifact): Promise<Map<string, SourceCredential>> {
  if (!artifact.manifest.credentialHash) return new Map()
  const filename = resolve(artifact.directory, 'credentials.enc')
  if (((await lstat(filename)).mode & 0o077) !== 0) throw new MigrationError('CREDENTIAL_FILE_NOT_PRIVATE')
  const result = await readBoundFile(filename, { json: true, expectedHash: artifact.manifest.credentialHash, maxBytes: LIMIT, maxScalarBytes: LIMIT })
  const parsed = encryptedSchema.safeParse(result.value)
  if (!parsed.success) throw new MigrationError('CREDENTIAL_SIDECAR_INVALID')
  const key = encryptionKey()
  let plaintext: Buffer | undefined
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.data.iv, 'hex'))
    decipher.setAAD(Buffer.from(binding(artifact.manifest)))
    decipher.setAuthTag(Buffer.from(parsed.data.tag, 'hex'))
    plaintext = Buffer.concat([decipher.update(Buffer.from(parsed.data.ciphertext, 'base64')), decipher.final()])
    const value: unknown = JSON.parse(plaintext.toString('utf8'))
    const schema = z.array(z.object({ sourceUserId: z.string().regex(/^[1-9]\d*$/), credential: sourceCredential }).strict())
    const credentials = schema.safeParse(value)
    if (!credentials.success) throw new MigrationError('CREDENTIAL_RECORD_INVALID')
    const records = new Map<string, SourceCredential>()
    for (const row of credentials.data) {
      if (records.has(row.sourceUserId)) throw new MigrationError('DUPLICATE_CREDENTIAL_USER')
      records.set(row.sourceUserId, row.credential)
    }
    return records
  } catch (error) {
    if (error instanceof MigrationError) throw error
    throw new MigrationError('CREDENTIAL_SIDECAR_AUTH_FAILED')
  } finally { key.fill(0); plaintext?.fill(0) }
}

async function readCredentialCsv(filename: string, expected: { hash: string; headers: string[]; rowCount: number }): Promise<Array<{ sourceUserId: string; credential: SourceCredential }>> {
  const path = await secureFilePath(filename)
  if (((await lstat(path)).mode & 0o077) !== 0) throw new MigrationError('CREDENTIAL_FILE_NOT_PRIVATE')
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  const result: Array<{ sourceUserId: string; credential: SourceCredential }> = []
  const ids = new Set<string>()
  let bytes = 0
  try {
    const before = await handle.stat()
    if (before.size > LIMIT) throw new MigrationError('CREDENTIAL_SIZE_LIMIT')
    const sourceHash = createHash('sha256')
    const input = handle.createReadStream({ autoClose: false })
    const parser = parse({
      bom: true, skip_empty_lines: true, max_record_size: 1024 * 1024,
      columns: (headers: string[]) => {
        if (headers.length !== expected.headers.length || headers.some((header, index) => header !== expected.headers[index])) throw new MigrationError('CREDENTIAL_HEADERS_SNAPSHOT_MISMATCH')
        if (new Set(headers).size !== headers.length || headers.some(key => ['__proto__', 'prototype', 'constructor'].includes(key)) || !headers.includes('id') || !headers.includes('key_string')) throw new MigrationError('CREDENTIAL_HEADERS_INVALID')
        return headers
      },
    })
    input.on('data', chunk => sourceHash.update(chunk))
    input.on('error', error => parser.destroy(error))
    input.pipe(parser)
    for await (const raw of parser) {
      const row = raw as Record<string, unknown>
      const sourceUserId = row.id
      if (typeof sourceUserId !== 'string' || !/^[1-9]\d*$/.test(sourceUserId) || ids.has(sourceUserId)) throw new MigrationError('CREDENTIAL_ID_INVALID')
      if (typeof row.key_string !== 'string' || (row.password !== undefined && typeof row.password !== 'string')) throw new MigrationError('CREDENTIAL_RECORD_INVALID')
      const credential: SourceCredential = { key_string: row.key_string || null, ...(row.password ? { passwordHash: row.password as string } : {}) }
      if (!sourceCredential.safeParse(credential).success) throw new MigrationError('CREDENTIAL_RECORD_INVALID')
      bytes += Buffer.byteLength(JSON.stringify(credential)) + sourceUserId.length
      if (bytes > LIMIT / 2) throw new MigrationError('CREDENTIAL_MEMORY_LIMIT')
      ids.add(sourceUserId)
      result.push({ sourceUserId, credential })
    }
    if (sourceHash.digest('hex') !== expected.hash || result.length !== expected.rowCount) throw new MigrationError('CREDENTIAL_SOURCE_SNAPSHOT_MISMATCH')
    const after = await handle.stat()
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new MigrationError('CREDENTIAL_INPUT_CHANGED')
    return result
  } catch (error) {
    if (error instanceof MigrationError) throw error
    throw new MigrationError('CREDENTIAL_CSV_INVALID')
  } finally { await handle.close() }
}

async function copyBoundFile(source: string, target: string, expectedHash: string): Promise<void> {
  const input = await open(await secureFilePath(source), constants.O_RDONLY | constants.O_NOFOLLOW)
  let output: Awaited<ReturnType<typeof open>> | undefined
  try {
    const before = await input.stat()
    if (before.size > MAX_ARTIFACT_BYTES) throw new MigrationError('ARTIFACT_SIZE_LIMIT')
    output = await open(target, 'wx', 0o600)
    const hash = createHash('sha256')
    for await (const chunk of input.createReadStream({ autoClose: false })) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
      hash.update(buffer)
      await output.writeFile(buffer)
    }
    const after = await input.stat()
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || hash.digest('hex') !== expectedHash) throw new MigrationError('ARTIFACT_CHANGED_DURING_COPY')
    await output.sync()
  } finally { await output?.close(); await input.close() }
}

export async function prepareImportArtifact(options: { exportArtifact: string; credentials?: string; creatorBindings?: string; output: string }): Promise<{ manifestPath: string }> {
  const source = resolve(options.exportArtifact)
  const output = resolve(options.output)
  await assertOutsideRepository(output)
  if (await realpath(source) !== source || !(await lstat(source)).isDirectory()) throw new MigrationError('EXPORT_DIRECTORY_UNSAFE')
  const parent = dirname(output)
  if (await realpath(parent) !== parent) throw new MigrationError('OUTPUT_PARENT_UNSAFE')
  // mkdir is deliberately nonrecursive/exclusive: never overwrite another snapshot.
  const exported = await inspectExportArtifact(source)
  for (const [name, expectedHash] of Object.entries(exported.manifest.artifacts)) if (expectedHash) await readBoundFile(resolve(source, name), { expectedHash })
  const userFiles = exported.manifest.files.filter(file => file.selected && file.table === 'users')
  if (options.credentials && (userFiles.length !== 1 || userFiles[0].rowCount === null)) throw new MigrationError('CREDENTIAL_SOURCE_INVENTORY_REQUIRED')
  const credentials = options.credentials ? await readCredentialCsv(options.credentials, { hash: userFiles[0].sha256, headers: userFiles[0].headers, rowCount: userFiles[0].rowCount! }) : undefined
  let creatorBindingsHash: string | null = null
  if (options.creatorBindings) {
    if (![NEW_MAPPING_HASH, CLASSIFIED_MAPPING_HASH, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH].includes(exported.manifest.contractSha256)) throw new MigrationError('CREATOR_BINDINGS_PROFILE_INVALID')
    creatorBindingsHash = (await readBoundFile(options.creatorBindings, { maxBytes: 16 * 1024 * 1024 })).hash
    await loadCreatorBindings(options.creatorBindings, creatorBindingsHash)
  }
  const v3 = isClassifiedMappingHash(exported.manifest.contractSha256)
  const v2 = v3 || exported.manifest.contractSha256 === NEW_MAPPING_HASH
  const policy = 'migrationPolicy' in exported.manifest ? exported.manifest.migrationPolicy : undefined
  const actorHash = 'user-actors.json' in exported.manifest.artifacts ? exported.manifest.artifacts['user-actors.json'] : undefined
  const manifest: ImportManifest = {
    version: v3 ? 3 : v2 ? 2 : 1, profile: v3 ? 'pw1-json-v3' : v2 ? 'pw1-json-v2' : 'pw1-json-v1',
    ...(v2 ? { sourceInstanceToken: exported.manifest.sourceSnapshot.sourceInstanceToken, migrationPolicyHash: policy ? checksum(policy) : null, actorArtifactHash: actorHash ?? null, creatorBindingsHash, classifierVersion: v3 ? 'diagnostic-policy-v2' as const : 'diagnostic-policy-v1' as const } : {}), sourceInstance: exported.manifest.sourceSnapshot.sourceInstance,
    sourceDatabase: exported.manifest.sourceSnapshot.sourceDatabase, snapshotId: exported.manifest.sourceSnapshot.snapshotId,
    asOf: exported.manifest.sourceSnapshot.asOf, mappingHash: exported.manifest.contractSha256,
    ...(v3 && 'classificationVersion' in exported.manifest ? { classificationVersion: exported.manifest.classificationVersion, customerReconciliationHash: exported.manifest.artifacts['customer-reconciliation.json'], productReconciliationHash: exported.manifest.artifacts['product-reconciliation.json'] } : {}),
    masterHash: exported.manifest.artifacts['master.json'], credentialHash: null, exporterManifestHash: exported.hash,
  }
  let encrypted: string | undefined
  if (credentials) {
    const key = encryptionKey(), iv = randomBytes(12)
    const plaintext = Buffer.from(JSON.stringify(credentials))
    try {
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(binding(manifest)))
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
      encrypted = JSON.stringify({ version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('base64') })
      if (Buffer.byteLength(encrypted) > LIMIT) throw new MigrationError('CREDENTIAL_SIZE_LIMIT')
      manifest.credentialHash = createHash('sha256').update(encrypted).digest('hex')
    } finally { key.fill(0); plaintext.fill(0) }
  }
  let copyBytes = BigInt(0)
  for (const name of ['master-manifest.json', ...Object.keys(exported.manifest.artifacts)]) copyBytes += BigInt((await lstat(resolve(source, name))).size)
  const masterBytes = BigInt((await lstat(resolve(source, 'master.json'))).size)
  await assertDiskSpace(parent, copyBytes + masterBytes * BigInt(2) + BigInt(encrypted ? Buffer.byteLength(encrypted) : 0) + BigInt(64) * BigInt(1024) * BigInt(1024))
  await mkdir(output, { mode: 0o700 })
  for (const name of ['master-manifest.json', ...Object.keys(exported.manifest.artifacts)]) {
    const expectedHash = name === 'master-manifest.json' ? exported.hash : exported.manifest.artifacts[name as keyof typeof exported.manifest.artifacts]
    if (!expectedHash) throw new MigrationError('ARTIFACT_HASH_MISSING')
    await copyBoundFile(resolve(source, name), resolve(output, name), expectedHash)
  }
  if (options.creatorBindings && creatorBindingsHash) await copyBoundFile(options.creatorBindings, resolve(output, 'creator-bindings.json'), creatorBindingsHash)
  if (encrypted) await writeFile(resolve(output, 'credentials.enc'), encrypted, { mode: 0o600, flag: 'wx' })
  const manifestPath = resolve(output, 'import-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  // Complete validation after copy catches input replacement during preparation.
  // Empty selection validates the whole stream/reports without retaining Stores.
  await loadImportArtifact(manifestPath, { storeIds: [] })
  return { manifestPath }
}
