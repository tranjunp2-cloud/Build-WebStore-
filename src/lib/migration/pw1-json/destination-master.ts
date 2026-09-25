import { masterPartsSchema, masterSetHash, validateMasterParts, MAX_MASTER_PART_BYTES, type MasterPart } from './master-parts'
import { constants, writeSync, openSync, closeSync, fsyncSync } from 'node:fs'
import { open, lstat, realpath, link, unlink, rm, mkdir, writeFile } from 'node:fs/promises'
import { dirname, basename, isAbsolute, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { assertOutsideRepository, assertDiskSpace, readBoundFile } from './artifact'
import { MigrationError } from './errors'
import type { Progress } from './progress'

export interface FoundationDestination { tenantId: number; siteId: number; productCategories: number[] }

/** Private existing parent; publication never overwrites a prior handoff or source. */
export async function validateOutputPath(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new MigrationError('OUTPUT_PATH_MUST_BE_ABSOLUTE')
  const output = resolve(path), parent = dirname(output)
  await assertOutsideRepository(output)
  if (await realpath(parent) !== parent) throw new MigrationError('OUTPUT_PARENT_UNSAFE')
  // Reject other worktrees/repositories too, not just the current checkout.
  for (let directory = parent;; directory = dirname(directory)) {
    try { await lstat(resolve(directory, '.git')); throw new MigrationError('PRIVATE_ARTIFACT_INSIDE_REPOSITORY') }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error }
    if (dirname(directory) === directory) break
  }
  try { await lstat(output); throw new MigrationError('OUTPUT_ALREADY_EXISTS') }
  catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error }
  return output
}

export async function writeDestinationMaster(source: string, expectedHash: string, outputPath: string, destinations: ReadonlyMap<string, FoundationDestination>, progress?: Progress): Promise<void> {
  const output = await validateOutputPath(outputPath)
  if (!destinations.size) throw new MigrationError('DESTINATION_EMPTY')
  for (const [store, destination] of destinations) {
    if (!/^[1-9]\d*$/.test(store) || !Number.isSafeInteger(destination.tenantId) || destination.tenantId <= 0 || !Number.isSafeInteger(destination.siteId) || destination.siteId <= 0 || destination.productCategories.length) throw new MigrationError('DESTINATION_INVALID')
  }
  const temp = resolve(dirname(output), `.destination-${randomUUID()}.tmp`)
  const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  const seen = new Set<string>()
  let count = 0
  // The parser visitor is synchronous: bounded writes provide backpressure without a queue.
  const write = (text: string) => {
    const buffer = Buffer.from(text)
    let offset = 0
    while (offset < buffer.length) {
      const bytes = writeSync(handle.fd, buffer, offset, buffer.length - offset)
      if (!bytes) throw new MigrationError('OUTPUT_WRITE_FAILED')
      offset += bytes
    }
  }
  try {
    write('[\n')
    const result = await readBoundFile(source, { json: true, expectedHash, onBytes: (bytes, totalBytes) => progress?.({ phase: 'read-artifact', file: 'master-with-destination.json', bytes, totalBytes }), visit: (path, _index, value) => {
      if (path.length) return false
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MigrationError('STORE_SHAPE_INVALID')
      const store = value as Record<string, unknown>
      const tenants = store.tenants
      const tenant = Array.isArray(tenants) && tenants.length === 1 ? tenants[0] : undefined
      const ref: unknown = tenant && typeof tenant === 'object' ? tenant._ref : undefined
      if (typeof ref !== 'string' || !/^@tenants:stores:[1-9]\d*$/.test(ref)) throw new MigrationError('STORE_IDENTITY_INVALID')
      const id = ref.slice('@tenants:stores:'.length)
      if (seen.has(id)) throw new MigrationError('DUPLICATE_STORE')
      if (seen.size >= 1_000_000) throw new MigrationError('STORE_INDEX_LIMIT')
      seen.add(id)
      if ('destination' in store) throw new MigrationError('SOURCE_DESTINATION_CONFLICT')
      const destination = destinations.get(id)
      write(`${count++ ? ',\n' : ''}${JSON.stringify(destination ? { ...store, destination } : store)}`)
      return true
    } })
    if (!Array.isArray(result.value) || [...destinations.keys()].some(id => !seen.has(id))) throw new MigrationError('DESTINATION_STORE_MISSING')
    write('\n]\n')
    await handle.sync()
    await handle.close()
    // Hard-link publication is atomic and fails if another process created the target.
    await link(temp, output)
  } finally {
    await handle.close()
    await unlink(temp)
  }
}

export function destinationPartsDirectory(outputPath: string): string { return `${outputPath}.parts` }
export async function validateDestinationPartsOutput(outputPath: string): Promise<void> {
  await validateOutputPath(outputPath)
  await validateOutputPath(destinationPartsDirectory(outputPath))
}

/** Preserve input part boundaries exactly; publish the index only after every part is verified. */
export async function writeDestinationMasterParts(directory: string, inputParts: readonly MasterPart[], expectedHash: string, outputPath: string, destinations: ReadonlyMap<string, FoundationDestination>, progress?: Progress): Promise<void> {
  const parts = masterPartsSchema.parse(inputParts)
  validateMasterParts(parts,expectedHash,Object.fromEntries(parts.map(part => [part.filename,part.sha256])),parts.reduce((sum,part) => sum+part.storeIds.length,0))
  const output = await validateOutputPath(outputPath)
  if (!destinations.size) throw new MigrationError('DESTINATION_EMPTY')
  let extraBytes = 0
  for (const [id,destination] of destinations) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(destination.tenantId) || destination.tenantId <= 0 || !Number.isSafeInteger(destination.siteId) || destination.siteId <= 0 || destination.productCategories.length) throw new MigrationError('DESTINATION_INVALID')
    extraBytes += Buffer.byteLength(JSON.stringify(destination))+32
  }
  await assertDiskSpace(dirname(output),parts.reduce((sum,part) => sum+BigInt(part.bytes)+BigInt(part.storeIds.length*4),BigInt(extraBytes)+BigInt(64*1024*1024)))
  const partDirectory = destinationPartsDirectory(output)
  await validateOutputPath(partDirectory)
  await mkdir(partDirectory, { mode: 0o700 })
  const temporary = resolve(dirname(output), `.destination-index-${randomUUID()}.tmp`)
  const outputParts: MasterPart[] = []
  let published = false, bytes = 0, digest = createHash('sha256')
  const seen = new Set<string>()
  let fd: number | undefined, count = 0
  const write = (text: string) => {
    const buffer = Buffer.from(text)
    let offset = 0
    while (offset < buffer.length) {
      const written = writeSync(fd!, buffer, offset, buffer.length - offset)
      if (!written) throw new MigrationError('OUTPUT_WRITE_FAILED')
      offset += written
    }
    bytes += buffer.length
    digest.update(buffer)
  }
  try {
    for (const part of parts) {
      count = 0
      bytes = 0
      digest = createHash('sha256')
      fd = openSync(resolve(partDirectory, part.filename), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      write('[\n')
      if ((await lstat(resolve(directory,part.filename))).size !== part.bytes) throw new MigrationError('MASTER_PART_SIZE_INVALID')
      const actualIds: string[]=[]
      const result=await readBoundFile(resolve(directory,part.filename),{json:true,expectedHash:part.sha256,maxBytes:MAX_MASTER_PART_BYTES-1,onBytes:(count,totalBytes)=>progress?.({phase:'read-artifact',file:part.filename,bytes:count,totalBytes}),visit:(path,_index,value)=>{
        if(path.length)return false
        if(!value||typeof value!=='object'||Array.isArray(value))throw new MigrationError('STORE_SHAPE_INVALID')
        const store=value as Record<string,unknown>,tenants=store.tenants
        const tenant=Array.isArray(tenants)&&tenants.length===1?tenants[0]:undefined
        const ref=tenant&&typeof tenant==='object'?tenant._ref:undefined
        if(typeof ref!=='string'||!/^@tenants:stores:[1-9]\d*$/.test(ref))throw new MigrationError('STORE_IDENTITY_INVALID')
        const id=ref.slice('@tenants:stores:'.length)
        if(seen.has(id))throw new MigrationError('DUPLICATE_STORE')
        if(seen.size>=1_000_000)throw new MigrationError('STORE_INDEX_LIMIT')
        seen.add(id);actualIds.push(id)
        if('destination' in store)throw new MigrationError('SOURCE_DESTINATION_CONFLICT')
        const destination = destinations.get(id)
        write(`${count++ ? ',\n' : ''}${JSON.stringify(destination ? { ...store, destination } : store)}`)
        return true
      }})
      if(!Array.isArray(result.value)||JSON.stringify(actualIds)!==JSON.stringify(part.storeIds))throw new MigrationError('MASTER_PART_STORES_MISMATCH')
      write('\n]\n')
      fsyncSync(fd)
      closeSync(fd)
      fd = undefined
      outputParts.push({ filename: part.filename, sha256: digest.digest('hex'), bytes, storeIds: actualIds })
    }
    if([...destinations.keys()].some(id=>!seen.has(id)))throw new MigrationError('DESTINATION_STORE_MISSING')
    const index = { version: 1, format: 'pw1-destination-parts-v1', sourceMasterSetHash: expectedHash, partsDirectory: basename(partDirectory), masterSetHash: masterSetHash(outputParts), masterParts: outputParts }
    await writeFile(temporary, JSON.stringify(index, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    const handle = await open(temporary, 'r')
    try { await handle.sync() } finally { await handle.close() }
    await link(temporary, output)
    published = true
  } finally {
    if (fd !== undefined) closeSync(fd)
    await rm(temporary, { force: true })
    if (!published) await rm(partDirectory, { recursive: true, force: true })
  }
}
