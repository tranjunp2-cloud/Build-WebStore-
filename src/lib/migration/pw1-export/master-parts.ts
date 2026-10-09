import { createHash } from 'node:crypto'
import { lstat, readdir } from 'node:fs/promises'
import { z } from 'zod'
import type { StoreOutput } from './contracts'
import { checkedFile } from './csv-loader'
import { compareIds, ExportError } from './primitives'
import { readJsonStream, hashFileStream } from './stream-json'

export const MASTER_PART_MAX_STORES = 300
export const MASTER_PART_MAX_BYTES = 200_000_000
export const masterPartSchema = z.object({
  filename: z.string().regex(/^master-\d{4,}\.json$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive().max(MASTER_PART_MAX_BYTES - 1),
  storeIds: z.array(z.string().regex(/^[1-9]\d*$/)).min(1).max(MASTER_PART_MAX_STORES),
}).strict()
export type MasterPart = z.infer<typeof masterPartSchema>
export type PlannedMasterPart = { descriptor: MasterPart; stores: readonly StoreOutput[] }
export const masterPartFilename = (index: number) => `master-${String(index + 1).padStart(4, '0')}.json`
export function masterSetHash(parts: readonly MasterPart[]): string {
  // The descriptor key order is part of the cross-repository contract.
  const ordered = parts.map(({ filename, sha256, bytes, storeIds }) => ({ filename, sha256, bytes, storeIds }))
  return createHash('sha256').update(JSON.stringify(ordered), 'utf8').digest('hex')
}
export function masterStoreId(store: StoreOutput): string {
  const match = /^@tenants:stores:([1-9]\d*)$/.exec(String(store.tenants?.[0]?._ref ?? ''))
  if (!match || store.tenants.length !== 1) throw new ExportError('MASTER_STORE_ID_INVALID')
  const metadata = store.tenants[0].metaData
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata) && 'pw1StoreId' in metadata && String(metadata.pw1StoreId) !== match[1]) throw new ExportError('MASTER_STORE_ID_INVALID')
  return match[1]
}
export function masterStoreJson(store: StoreOutput): string {
  return JSON.stringify(store, null, 2).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
export function* masterPartChunks(stores: readonly StoreOutput[], checkResources?: () => void): Generator<string> {
  yield '[\n'
  for (let i = 0; i < stores.length; i++) {
    checkResources?.()
    yield (i ? ',\n' : '') + masterStoreJson(stores[i])
  }
  yield '\n]\n'
}
/** Store-atomic planning; only one serialized Store is held at a time. */
export function planMasterParts(stores: readonly StoreOutput[], options: { maxStores?: number; maxBytes?: number; checkResources?: () => void } = {}): PlannedMasterPart[] {
  const maxStores = options.maxStores ?? MASTER_PART_MAX_STORES, maxBytes = options.maxBytes ?? MASTER_PART_MAX_BYTES
  if (!Number.isInteger(maxStores) || maxStores < 1 || maxStores > MASTER_PART_MAX_STORES || !Number.isInteger(maxBytes) || maxBytes < 6 || maxBytes > MASTER_PART_MAX_BYTES) throw new ExportError('INVALID_MASTER_PART_LIMITS')
  const ordered = [...stores].sort((a, b) => compareIds(masterStoreId(a), masterStoreId(b)))
  const parts: PlannedMasterPart[] = []
  let current: StoreOutput[] = [], ids: string[] = [], bytes = 5, previousId: string | undefined
  let digest = createHash('sha256').update('[\n')
  const flush = () => {
    if (!current.length) return
    digest.update('\n]\n')
    parts.push({ descriptor: { filename: masterPartFilename(parts.length), sha256: digest.digest('hex'), bytes, storeIds: ids }, stores: current })
    current = []; ids = []; bytes = 5; digest = createHash('sha256').update('[\n')
  }
  for (const store of ordered) {
    options.checkResources?.()
    const id = masterStoreId(store)
    if (id === previousId) throw new ExportError('MASTER_STORE_DUPLICATE')
    previousId = id
    const serialized = masterStoreJson(store), size = Buffer.byteLength(serialized, 'utf8')
    if (size + 5 >= maxBytes) throw new ExportError(`MASTER_STORE_TOO_LARGE:${id}`)
    const added = size + (current.length ? 2 : 0)
    if (current.length && (current.length >= maxStores || bytes + added >= maxBytes)) flush()
    if (current.length) { digest.update(',\n'); bytes += 2 }
    digest.update(serialized); bytes += size; current.push(store); ids.push(id)
  }
  flush()
  return parts
}

/** Verify the declared set and disk layout before materializing any Store documents. */
export async function readMasterParts(root: string, parts: readonly MasterPart[], expectedSetHash: string, artifacts: Record<string, string | undefined>, validateStore: (value: unknown) => value is StoreOutput): Promise<StoreOutput[]> {
  if (masterSetHash(parts) !== expectedSetHash) throw new ExportError('MASTER_SET_HASH_MISMATCH')
  const names = new Set(parts.map(part => part.filename))
  if (names.size !== parts.length) throw new ExportError('MASTER_PART_REGISTRY_INVALID')
  const masterFiles = (await readdir(root)).filter(name => /^master.*\.json$/.test(name) && name !== 'master-manifest.json')
  if (masterFiles.length !== names.size || masterFiles.some(name => !names.has(name)) || Object.keys(artifacts).some(name => /^master.*\.json$/.test(name) && !names.has(name))) throw new ExportError('MASTER_PART_REGISTRY_INVALID')
  const result: StoreOutput[] = []
  let previousId: string | undefined
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!masterPartSchema.safeParse(part).success || part.filename !== masterPartFilename(i) || artifacts[part.filename] !== part.sha256) throw new ExportError('MASTER_PART_REGISTRY_INVALID')
    const filename = await checkedFile(root, part.filename), info = await lstat(filename)
    if (info.size !== part.bytes || info.size >= MASTER_PART_MAX_BYTES) throw new ExportError('MASTER_PART_SIZE_INVALID')
    if (await hashFileStream(filename) !== part.sha256) throw new ExportError('ARTIFACT_HASH_MISMATCH')
    const ids: string[] = []
    const value = await readJsonStream(filename, (itemPath, _index, item) => {
      if (itemPath.length === 0) {
        if (!validateStore(item)) throw new ExportError('MASTER_SCHEMA_INVALID')
        const id = masterStoreId(item)
        if (previousId !== undefined && compareIds(previousId, id) >= 0) throw new ExportError('MASTER_STORE_ORDER_INVALID')
        previousId = id; ids.push(id)
        if (ids.length > MASTER_PART_MAX_STORES) throw new ExportError('MASTER_PART_STORE_COUNT_INVALID')
      }
      return false
    })
    if (!Array.isArray(value)) throw new ExportError('MASTER_SCHEMA_INVALID')
    if (JSON.stringify(ids) !== JSON.stringify(part.storeIds)) throw new ExportError('MASTER_PART_STORE_IDS_INVALID')
    result.push(...value as StoreOutput[])
  }
  return result
}
