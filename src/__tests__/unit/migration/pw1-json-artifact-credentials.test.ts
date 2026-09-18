// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EXPECTED_MAPPING_HASH, loadImportArtifact, readBoundFile, readImportStore } from '@/lib/migration/pw1-json/artifact'
import { prepareImportArtifact, loadCredentialSidecar } from '@/lib/migration/pw1-json/credentials'
import { COLLECTIONS, type ImportDiagnostic } from '@/lib/migration/pw1-json/types'

const temporary: string[] = []
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(temporary.splice(0).map(path => rm(path,{recursive:true,force:true}))) })
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
async function fixture(diagnostics: ImportDiagnostic[] = [], badPartition = false) {
  const root = await mkdtemp(join(tmpdir(),'pw1-json-test-')); temporary.push(root)
  const source = join(root,'export'); await mkdir(source,{mode:0o700})
  const store = (id: string) => ({...Object.fromEntries(COLLECTIONS.map(c=>[c,[]])),tenants:[{_ref:`@tenants:stores:${id}`,metaData:{pw1StoreId:id}}],sites:[{_ref:`@sites:stores:${id}`,tenant:`@tenants:stores:${id}`}],pages:[{raw:true}]})
  const data: Record<string,string> = {'master.json':JSON.stringify([store('205'),store('285')]),'mapping-report.json':JSON.stringify({version:1,rows:['205','285'].map((id,index)=>({table:'stores',sourceId:id,storeId:id,record:index+1,disposition:'mapped',fields:{id:'source-identity'},contributions:[]})),diagnostics}),'mapping-report.csv':'table\n','README.md':'Synthetic fixture'}
  for (const [name,value] of Object.entries(data)) await writeFile(join(source,name),value,{mode:0o600})
  const blockers = diagnostics.filter(d=>d.severity==='blocker').length
  const manifest = {version:1,exporterVersion:'1.0.0',contractSha256:EXPECTED_MAPPING_HASH,sourceConfigSha256:hash('config'),sourceSnapshot:{sourceInstance:'synthetic',sourceDatabase:'synthetic',sourceInstanceToken:'synthetic',snapshotId:'snapshot1',asOf:'2026-09-16T00:00:00Z'},files:[{table:'stores',filename:'stores.csv',sha256:hash('id\n205\n285\n'),bytes:11,selected:true,rowCount:2,headers:['id']}],artifacts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,hash(v)])),status:blockers?'needs_review':'complete',importReady:false,coverage:{accounted:true},mapping:{complete:blockers===0},counts:{sourceStoreCount:badPartition?99:2,selectedStoreCount:2,policyExcludedStoreCount:0,emittedStoreCount:2,blockedStoreCount:0,blockers},blockedStores:[],policyExcludedStores:[]}
  await writeFile(join(source,'master-manifest.json'),JSON.stringify(manifest),{mode:0o600})
  return {root,source,output:join(root,'import')}
}

describe('[TC-F42-IMP-003/004/005] Bound streaming artifact handoff', () => {
  it('selects and spools one Store only after validation, excluding raw Pages',async()=>{
    // Arrange
    const f=await fixture();const prepared=await prepareImportArtifact({exportArtifact:f.source,output:f.output})
    // Act
    const artifact=await loadImportArtifact(prepared.manifestPath,{storeIds:['285'],spoolDirectory:f.root})
    const store=await readImportStore(artifact,'285')
    // Assert
    expect(artifact.manifestHash).toBe(hash(await readFile(prepared.manifestPath,'utf8')));
    expect(artifact.stores).toEqual([]); expect(artifact.storeIds).toEqual(['205','285'])
    expect(store.collections.pages).toEqual([]); expect(store.storeId).toBe('285')
    expect((await stat(artifact.storeFiles!['285'].path)).mode&0o077).toBe(0)
    await expect(readImportStore(artifact,'205')).rejects.toThrow('STORE_NOT_SELECTED')
    await writeFile(artifact.storeFiles!['285'].path,'{}')
    await expect(readImportStore(artifact,'285')).rejects.toThrow('ARTIFACT_HASH_MISMATCH')
  })
  it('keeps global blockers but excludes only explicit Page diagnostics',async()=>{
    // Arrange
    const f=await fixture([{code:'RAW_VALUE_UNVERIFIED',severity:'blocker',storeId:'205',table:'pages'},{code:'UNKNOWN_SOURCE',severity:'blocker'}])
    const prepared=await prepareImportArtifact({exportArtifact:f.source,output:f.output})
    // Act
    const artifact=await loadImportArtifact(prepared.manifestPath,{storeIds:['205']})
    // Assert
    expect(artifact.blockers.map(d=>d.code)).toEqual(['UNKNOWN_SOURCE'])
  })
  it('rejects hash-authenticated inconsistent source Store partition',async()=>{
    // Arrange
    const f=await fixture([],true)
    // Act / Assert
    await expect(prepareImportArtifact({exportArtifact:f.source,output:f.output})).rejects.toThrow()
  })
  it('rejects changed bytes, duplicate keys, symlinks and configured size overflow',async()=>{
    // Arrange
    const f=await fixture(); const path=join(f.root,'input.json');await writeFile(path,'{"a":1}')
    // Act / Assert
    await expect(readBoundFile(path,{json:true,expectedHash:hash('{}')})).rejects.toThrow('ARTIFACT_HASH_MISMATCH')
    await expect(readBoundFile(path,{maxBytes:2})).rejects.toThrow('ARTIFACT_SIZE_LIMIT')
    const link=join(f.root,'link.json');await symlink(path,link)
    await expect(readBoundFile(link)).rejects.toThrow('ARTIFACT_PATH_UNSAFE')
    await writeFile(path,'{"a":1,"a":2}')
    await expect(readBoundFile(path,{json:true})).rejects.toThrow()
  })
})

describe('[TC-F42-IMP-011] Credential sidecar authenticated scope',()=>{
  it('round-trips private CSV while binding snapshot metadata and refusing wrong key',async()=>{
    // Arrange
    vi.stubEnv('PW2_MIGRATION_SECRET','synthetic-secret-at-least-thirty-two-characters')
    const f=await fixture();const csv=join(f.root,'credentials.csv');const canary='SYNTHETIC_PRIVATE_CREDENTIAL_CANARY'
    await writeFile(csv,`id,key_string,password\n517,${canary},synthetic-hash\n`,{mode:0o600})
    const csvText=await readFile(csv,'utf8');const exportPath=join(f.source,'master-manifest.json');const manifest=JSON.parse(await readFile(exportPath,'utf8'));const reportPath=join(f.source,'mapping-report.json');const report=JSON.parse(await readFile(reportPath,'utf8'))
    report.rows.push({table:'users',sourceId:'517',storeId:'205',record:1,disposition:'mapped',fields:{id:'source-identity',key_string:'security-excluded',password:'security-excluded'},contributions:[]})
    const reportText=JSON.stringify(report);await writeFile(reportPath,reportText);manifest.artifacts['mapping-report.json']=hash(reportText)
    manifest.files.push({table:'users',filename:'users.csv',sha256:hash(csvText),bytes:Buffer.byteLength(csvText),selected:true,rowCount:1,headers:['id','key_string','password']});await writeFile(exportPath,JSON.stringify(manifest))
    // Act
    const prepared=await prepareImportArtifact({exportArtifact:f.source,credentials:csv,output:f.output})
    const artifact=await loadImportArtifact(prepared.manifestPath)
    const recovered=await loadCredentialSidecar(artifact)
    // Assert
    expect(recovered.get('517')).toEqual({key_string:canary,passwordHash:'synthetic-hash'})
    expect(await readFile(join(f.output,'credentials.enc'),'utf8')).not.toContain(canary)
    expect((await stat(join(f.output,'credentials.enc'))).mode&0o077).toBe(0)
    await expect(loadCredentialSidecar({...artifact,manifest:{...artifact.manifest,snapshotId:'other'}})).rejects.toThrow('CREDENTIAL_SIDECAR_AUTH_FAILED')
    vi.stubEnv('PW2_MIGRATION_SECRET','another-synthetic-secret-at-least-thirty-two-characters')
    await expect(loadCredentialSidecar(artifact)).rejects.toThrow('CREDENTIAL_SIDECAR_AUTH_FAILED')
    await expect(prepareImportArtifact({exportArtifact:f.source,output:f.output})).rejects.toThrow()
  })
})
