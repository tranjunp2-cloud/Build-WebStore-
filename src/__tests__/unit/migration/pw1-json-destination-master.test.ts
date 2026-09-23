import { masterSetHash, type MasterPart } from '@/lib/migration/pw1-json/master-parts'
// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, readdir, rm, stat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { writeDestinationMasterParts, destinationPartsDirectory, writeDestinationMaster, validateOutputPath } from '@/lib/migration/pw1-json/destination-master'

const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })
const store = (id: string) => ({ tenants: [{ _ref: `@tenants:stores:${id}`, name: 'Original tenant' }], users: [{ _ref: '@users:users:7' }], sites: [{ _ref: `@sites:stores:${id}` }], pages: [{ html: '<p>Keep \\"quoted\\" HTML\r\n</p>' }], products: [{ inventory: 0, variants: [{ id: 'sku-1', price: 0 }] }] })
const destination = { tenantId: 425, siteId: 424, productCategories: [] }
async function fixture(data: unknown = [store('636'), store('637')]) {
  const directory = await mkdtemp(join(tmpdir(), 'pw1-destination-')); directories.push(directory)
  const source = join(directory, 'master.json'), output = join(directory, 'master-with-destination.json')
  const bytes = JSON.stringify(data, null, 2)
  await writeFile(source, bytes, { mode: 0o600 })
  return { directory, source, output, bytes, hash: createHash('sha256').update(bytes).digest('hex') }
}
describe('[TC-F42-IMP-DESTINATION] Verified foundation master handoff', () => {
  it('preserves source bytes and all collections while annotating only selected Stores', async () => {
    // Arrange
    const f = await fixture()
    // Act
    await writeDestinationMaster(f.source, f.hash, f.output, new Map([['636', destination]]))
    // Assert
    expect(JSON.parse(await readFile(f.output, 'utf8'))).toEqual([{ ...store('636'), destination }, store('637')])
    expect(await readFile(f.source, 'utf8')).toBe(f.bytes)
    expect((await stat(f.output)).mode & 0o777).toBe(0o600)
    expect((await readdir(f.directory)).sort()).toEqual(['master-with-destination.json', 'master.json'])
  })
  it.each(['hash', 'missing', 'duplicate', 'invalid-id', 'existing-destination', 'non-array'])('leaves no published file after %s failure', async mutation => {
    // Arrange
    const data = mutation === 'duplicate' ? [store('636'), store('636')] : mutation === 'existing-destination' ? [{ ...store('636'), destination }] : mutation === 'non-array' ? { stores: [store('636')] } : undefined
    const f = await fixture(data)
    const targets = new Map([[mutation === 'missing' ? '999' : '636', mutation === 'invalid-id' ? { ...destination, tenantId: 0 } : destination]])
    // Act / Assert
    await expect(writeDestinationMaster(f.source, mutation === 'hash' ? '0'.repeat(64) : f.hash, f.output, targets)).rejects.toThrow()
    expect(await readdir(f.directory)).toEqual(['master.json'])
    expect(await readFile(f.source, 'utf8')).toBe(f.bytes)
  })
  it('refuses overwriting an output, source, or symlink', async () => {
    // Arrange
    const f = await fixture()
    await writeFile(f.output, 'existing')
    const alias = join(f.directory, 'alias.json'); await symlink(f.source, alias)
    // Act / Assert
    for (const path of [f.output, f.source, alias]) await expect(writeDestinationMaster(f.source, f.hash, path, new Map([['636', destination]]))).rejects.toThrow()
    expect(await readFile(f.output, 'utf8')).toBe('existing')
    expect(await readFile(f.source, 'utf8')).toBe(f.bytes)
  })
  it('rejects repository and relative output locations', async () => {
    // Arrange / Act / Assert
    await expect(validateOutputPath('master-with-destination.json')).rejects.toThrow()
    await expect(validateOutputPath(join(process.cwd(), 'master-with-destination.json'))).rejects.toThrow()
  })
})


describe('[TC-F42-IMP-PARTS-002] Destination index and bounded annotated parts',()=>{
  async function partFixture(count=2) {
    const directory=await mkdtemp(join(tmpdir(),'pw1-destination-parts-'));directories.push(directory)
    const records=Array.from({length:count},(_,i)=>store(String(i+1))),parts:MasterPart[]=[]
    for(let i=0;i<records.length;i+=300){
      const batch=records.slice(i,i+300),text=JSON.stringify(batch),filename=`master-${String(parts.length+1).padStart(4,'0')}.json`
      await writeFile(join(directory,filename),text,{mode:0o600})
      parts.push({filename,sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text),storeIds:batch.map(row=>row.tenants[0]._ref.split(':').at(-1)!)})
    }
    return {directory,records,parts,output:join(directory,'master-with-destination.json')}
  }
  it('writes a small index and parts, retaining content and annotating only selected Stores',async()=>{
    // Arrange / Act
    const f=await partFixture(301)
    await writeDestinationMasterParts(f.directory,f.parts,masterSetHash(f.parts),f.output,new Map([['1',destination],['301',destination]]))
    // Assert
    const index=JSON.parse(await readFile(f.output,'utf8'))
    expect(index).toMatchObject({format:'pw1-destination-parts-v1',sourceMasterSetHash:masterSetHash(f.parts)})
    expect(index.masterParts.map((part:MasterPart)=>part.storeIds.length)).toEqual([300,1])
    const data=[]
    for(const part of index.masterParts as MasterPart[]){const bytes=await readFile(join(destinationPartsDirectory(f.output),part.filename));expect(bytes.byteLength).toBe(part.bytes);expect(bytes.byteLength).toBeLessThan(200_000_000);data.push(...JSON.parse(bytes.toString()))}
    expect(data[0]).toEqual({...f.records[0],destination});expect(data[1]).toEqual(f.records[1]);expect(data[300]).toEqual({...f.records[300],destination})
    expect((await stat(destinationPartsDirectory(f.output))).mode&0o777).toBe(0o700)
    expect((await stat(f.output)).size).toBeLessThan(10_000)
  })
  it('repartitions after destination annotations using UTF-8 bytes and cleans oversized singleton failures',async()=>{
    // Arrange
    const f=await partFixture(),singleBytes=Buffer.byteLength(JSON.stringify({...f.records[0],destination}))+5
    // Act
    await writeDestinationMasterParts(f.directory,f.parts,masterSetHash(f.parts),f.output,new Map([['1',destination]]),undefined,{maxBytes:singleBytes+1})
    // Assert
    const index=JSON.parse(await readFile(f.output,'utf8'))
    expect(index.masterParts).toHaveLength(2)
    for(const part of index.masterParts)expect(part.bytes).toBeLessThan(singleBytes+1)
    const g=await partFixture()
    await expect(writeDestinationMasterParts(g.directory,g.parts,masterSetHash(g.parts),g.output,new Map([['1',destination]]),undefined,{maxBytes:singleBytes})).rejects.toThrow('DESTINATION_STORE_SIZE_LIMIT')
    expect((await readdir(g.directory)).sort()).toEqual(g.parts.map(part=>part.filename))
  })
  it('never publishes index or leftover parts after later-input hash failure',async()=>{
    // Arrange
    const f=await partFixture(301),last=f.parts[1];await writeFile(join(f.directory,last.filename),JSON.stringify([store('302')]))
    // Act / Assert
    await expect(writeDestinationMasterParts(f.directory,f.parts,masterSetHash(f.parts),f.output,new Map([['1',destination]]))).rejects.toThrow()
    expect((await readdir(f.directory)).sort()).toEqual(f.parts.map(part=>part.filename))
  })
})
