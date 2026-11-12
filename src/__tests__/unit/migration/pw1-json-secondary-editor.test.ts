// @vitest-environment node
import { describe,expect,it } from 'vitest'
import { createSecondaryEditorProof } from '@/lib/migration/pw1-json/secondary-editor-proof'
import { COLLECTIONS,type ImportStore,type ImportDiagnostic } from '@/lib/migration/pw1-json/types'
const warning:ImportDiagnostic={code:'USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED',severity:'warning',table:'users',storeId:'1327',sourceId:'2697'}
const receipt:ImportDiagnostic={...warning,code:'OWNER_SECONDARY_MAPPED_EDITOR',field:'is_store_owner',reason:'PRIMARY_OWNER_SELECTED'}
function fixture():ImportStore {
 const collections=Object.fromEntries(COLLECTIONS.map(c=>[c,[]])) as ImportStore['collections']
 collections.users=[{_ref:'@users:users:2696',roles:['tenant-owner'],tenants:[{tenant:'@tenants:stores:1327',role:'owner',permissions:[]}]},{_ref:'@users:users:2697',roles:['editor'],tenants:[{tenant:'@tenants:stores:1327',role:'editor',permissions:[]}]}]
 return {storeId:'1327',collections}
}
describe('[TC-F42-IMP-EDITOR-001] Approved secondary editor evidence',()=>{
 it('requires both an actual editor document and the exact secondary-owner receipt',()=>{
  // Arrange
  const proof=createSecondaryEditorProof(true)
  // Act / Assert
  proof.addStore(fixture());expect(proof.approves(warning)).toBe(false)
  proof.addDiagnostic(receipt);expect(proof.approves(warning)).toBe(true)
 })
 it.each(['disabled','owner','custom-permission','platform-admin','other-tenant','extra-tenant','missing-primary','wrong-user','forged-receipt'])('rejects %s privilege or evidence mismatch',mutation=>{
  // Arrange
  const store=fixture(),user=store.collections.users[1]
  const members=user.tenants as {tenant:string;role:string;permissions:string[]}[]
  if(mutation==='owner')members[0].role='owner'
  if(mutation==='custom-permission')members[0].permissions=['settings']
  if(mutation==='platform-admin')user.roles=['editor','super-admin']
  if(mutation==='other-tenant')members[0].tenant='@tenants:stores:1329'
  if(mutation==='extra-tenant')members.push({...members[0]})
  if(mutation==='missing-primary')store.collections.users.shift()
  if(mutation==='wrong-user')user._ref='@users:users:999'
  const proof=createSecondaryEditorProof(mutation!=='disabled')
  // Act
  proof.addStore(store);proof.addDiagnostic(mutation==='forged-receipt'?{...receipt,reason:'UNVERIFIED'}:receipt)
  // Assert
  expect(proof.approves(warning)).toBe(false)
 })
})
