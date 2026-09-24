import { masterSetHash } from '@/lib/migration/pw1-export/master-parts'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

type Part = { filename: string; sha256: string; bytes: number; storeIds: string[] }
type FixtureManifest = Record<string, unknown> & { exporterVersion: string; artifacts: Record<string,string>; masterParts?: Part[]; masterSetHash?: string }
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex')
async function manifest(directory: string): Promise<FixtureManifest> { return JSON.parse(await readFile(path.join(directory,'master-manifest.json'),'utf8')) as FixtureManifest }
/** Fixture IO only; production validators still perform all integrity checks in each test. */
export async function readFixtureMasterText(directory: string): Promise<string> {
  const m=await manifest(directory)
  if(!m.masterParts)return readFile(path.join(directory,'master.json'),'utf8')
  if(m.masterParts.length===1)return readFile(path.join(directory,m.masterParts[0].filename),'utf8')
  const stores:unknown[]=[]
  for(const part of m.masterParts)stores.push(...JSON.parse(await readFile(path.join(directory,part.filename),'utf8')) as unknown[])
  return JSON.stringify(stores)
}
export async function writeFixtureMaster(directory: string,value: unknown): Promise<void> {
  const m=await manifest(directory),bytes=JSON.stringify(value)
  if(!m.masterParts){await writeFile(path.join(directory,'master.json'),bytes);m.artifacts['master.json']=digest(bytes)}
  else {
    if(m.masterParts.length!==1)throw new Error('FIXTURE_EXPECTED_ONE_MASTER_PART')
    const part=m.masterParts[0];await writeFile(path.join(directory,part.filename),bytes)
    part.sha256=digest(bytes);part.bytes=Buffer.byteLength(bytes);m.artifacts[part.filename]=part.sha256
    // Keep declared Store identities: tests mutate document content, not intended source scope.
    m.masterSetHash=masterSetHash(m.masterParts)
  }
  await writeFile(path.join(directory,'master-manifest.json'),JSON.stringify(m))
}
/** Downgrade file layout as well as version when constructing historical test artifacts. */
export async function writeFixtureManifest(directory: string,m: FixtureManifest): Promise<void> {
  if(!['1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', '1.10.5'].includes(m.exporterVersion) && m.masterParts){
    const bytes=await readFixtureMasterText(directory)
    await writeFile(path.join(directory,'master.json'),bytes)
    for(const part of m.masterParts){delete m.artifacts[part.filename];await rm(path.join(directory,part.filename))}
    delete m.masterParts;delete m.masterSetHash;m.artifacts['master.json']=digest(bytes)
  }
  await writeFile(path.join(directory,'master-manifest.json'),JSON.stringify(m))
}
