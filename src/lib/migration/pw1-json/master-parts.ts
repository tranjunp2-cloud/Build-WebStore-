import { createHash } from 'node:crypto'
import { z } from 'zod'
import { MigrationError } from './errors'
export const MAX_MASTER_PART_BYTES = 200_000_000
export const MAX_MASTER_PART_STORES = 300
export const masterPartSchema = z.object({ filename: z.string().regex(/^master-[0-9]{4,}\.json$/), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive().lt(MAX_MASTER_PART_BYTES), storeIds: z.array(z.string().regex(/^[1-9]\d*$/).max(512)).min(1).max(MAX_MASTER_PART_STORES) }).strict()
export const masterPartsSchema = z.array(masterPartSchema).max(100_000)
export type MasterPart = z.infer<typeof masterPartSchema>
/** Protocol order is explicit; this intentionally differs from canonical projection checksums. */
export function masterSetHash(parts: readonly MasterPart[]): string {
  return createHash('sha256').update(JSON.stringify(parts.map(({filename,sha256,bytes,storeIds}) => ({filename,sha256,bytes,storeIds})))).digest('hex')
}
export function validateMasterParts(parts: readonly MasterPart[], hash: string, artifacts: Readonly<Record<string,string | undefined>>, emittedStoreCount: number): void {
  let previous: string | undefined, count = 0
  for (const [index,part] of parts.entries()) {
    if (part.filename !== `master-${String(index+1).padStart(4,'0')}.json` || artifacts[part.filename] !== part.sha256) throw new MigrationError('MASTER_PART_INDEX_INVALID')
    for (const id of part.storeIds) { if (previous && BigInt(previous) >= BigInt(id)) throw new MigrationError('MASTER_PART_STORE_ORDER_INVALID'); previous=id; count++ }
  }
  const names = new Set(parts.map(part => part.filename))
  if ('master.json' in artifacts || Object.keys(artifacts).some(name => /^master-[0-9]+\.json$/.test(name) && !names.has(name)) || count !== emittedStoreCount || hash !== masterSetHash(parts)) throw new MigrationError('MASTER_PART_INDEX_INVALID')
}
export type MasterLayout = { artifacts: Readonly<Record<string,string | undefined>>; masterParts?: MasterPart[]; masterSetHash?: string }
export function masterFiles(layout: MasterLayout): { filename:string; sha256:string; bytes?:number; storeIds?:string[] }[] {
  if (layout.masterParts) return layout.masterParts
  const sha256 = layout.artifacts['master.json']
  if (!sha256) throw new MigrationError('MASTER_ARTIFACT_MISSING')
  return [{ filename:'master.json', sha256 }]
}
export function boundMasterHash(layout: MasterLayout): string { return layout.masterParts ? layout.masterSetHash! : masterFiles(layout)[0].sha256 }
