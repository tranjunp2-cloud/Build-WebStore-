// @vitest-environment node
import { describe,expect,it } from 'vitest'
import { createPreflightRegistry,preflightStore } from '@/lib/migration/pw1-json/writer'
import type { Runtime } from '@/lib/migration/pw1-json/runtime'
import type { Entity } from '@/lib/migration/pw1-json/projection'
import { argumentsFor,validateResumeCursor,safeError } from '@/lib/migration/pw1-json/runner'

describe('[TC-F42-IMP-002/012] CLI and resume contract',()=>{
 it('accepts explicit dry-run selection and batch cursor only',()=>{
  // Arrange / Act
  const selected=argumentsFor(['--manifest','/private/import-manifest.json','--from-store','205','--to-store','285','--dry-run'])
  const resumed=argumentsFor(['--resume','json:12345678-1234-1234-1234-123456789abc','--from-store','285'])
  // Assert
  expect(selected).toMatchObject({fromStore:'205',toStore:'285',dryRun:true});expect(resumed.fromStore).toBe('285')
 })
 it.each([['--store','205'],['--manifest','/m','--all','--store','205'],['--resume','12345678-1234-1234-1234-123456789abc'],['--resume','json:12345678-1234-1234-1234-123456789abc','--dry-run'],['--secret-canary'],['--manifest','/m','--from-store','205']])('rejects invalid flags %j',args=>{
  // Arrange / Act / Assert
  expect(()=>argumentsFor(args)).toThrow()
 })
 it('accepts an explicit local DB for apply and resume but rejects empty names',()=>{
  // Arrange / Act
  const apply=argumentsFor(['--manifest','/m','--store','636','--local-database','primeweb'])
  const resume=argumentsFor(['--resume','json:12345678-1234-1234-1234-123456789abc','--local-database','primeweb'])
  // Assert
  expect(apply.localDatabase).toBe('primeweb');expect(resume.localDatabase).toBe('primeweb')
  expect(()=>argumentsFor(['--manifest','/m','--store','636','--local-database',''])).toThrow('LOCAL_DATABASE_ARGUMENT_INVALID')
 })
 it('passes an explicit Neon host through apply and resume parsing',()=>{
  // Arrange
  const host='ep-test.c-6.us-east-2.aws.neon.tech'
  const batch='json:12345678-1234-1234-1234-123456789abc'
  // Act
  const apply=argumentsFor(['--manifest','/m','--store','636','--local-database','primeweb','--target-host',host])
  const resume=argumentsFor(['--resume',batch,'--local-database','primeweb','--target-host',host])
  // Assert
  expect(apply.targetHost).toBe(host)
  expect(resume.targetHost).toBe(host)
 })
 it('prevents cursor from skipping unfinished Store but permits already verified prefix',()=>{
  // Arrange
  const ids=['205','285','300'];const states={'205':'VERIFIED','285':'APPLYING'}
  // Act / Assert
  expect(()=>validateResumeCursor(ids,states,'285')).not.toThrow()
  expect(()=>validateResumeCursor(ids,states,'205')).not.toThrow()
  expect(()=>validateResumeCursor(ids,states,'300')).toThrow('RESUME_CANNOT_SKIP_STORE')
  expect(()=>validateResumeCursor(ids,states,'299')).toThrow('RESUME_CANNOT_SKIP_STORE')
 })
})
describe('[TC-F42-IMP-011] Sanitized CLI errors',()=>{
 it.each([['23505','TARGET_UNIQUE_CONFLICT',3],['40001','TRANSACTION_RETRY_EXHAUSTED',4],['08006','OUTCOME_REQUIRES_RESUME_RECONCILIATION',5]])('maps driver error %s without leaking data',(code,expected,exitCode)=>{
  // Arrange
  const error=Object.assign(new Error('password=SECRET_CANARY SQL customer data'),{code})
  // Act / Assert
  expect(safeError(error)).toEqual({code:expected,exitCode})
 })
 it('sanitizes arbitrary exceptions and argument values',()=>{
  // Arrange / Act / Assert
  expect(safeError(new Error('secret PRIVATE_CANARY'))).toEqual({code:'IMPORT_FAILED',exitCode:3})
  expect(safeError({password:'PRIVATE_CANARY'})).toEqual({code:'IMPORT_FAILED',exitCode:3})
 })
})


describe('[TC-F42-IMP-010] Source identity is Store-scoped within a batch',()=>{
 it('rejects identical source identity/projection reused by a different Store before DB access',async()=>{
  // Arrange — use a read-only empty DB boundary; register/preflight source code remains real.
  let calls=0
  const runtime={pool:{query:async()=>{calls++;return {rows:[]}}},payload:{collections:{tenants:{config:{fields:[],indexes:[]}}}}} as unknown as Runtime
  const entity:Entity={ref:'@tenants:stores:1',collection:'tenants',sourceEntity:'stores',sourceId:'1',storeId:'1',data:{createdAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z'},refs:[],sourceChecksum:'same-projection'}
  const registry=createPreflightRegistry()
  await preflightStore(runtime,[entity],'synthetic',new Map(),undefined,registry)
  const before=calls
  // Act / Assert
  await expect(preflightStore(runtime,[{...entity,storeId:'2'}],'synthetic',new Map(),undefined,registry)).rejects.toThrow('CROSS_STORE_SOURCE_CONFLICT')
  expect(calls).toBe(before)
 })
})
