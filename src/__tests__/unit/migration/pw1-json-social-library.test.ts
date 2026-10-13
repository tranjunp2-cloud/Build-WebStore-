// @vitest-environment node
import { describe,expect,it } from 'vitest'
import { createSocialLibraryProof,MEDIA_METADATA_RULE,SOCIAL_METADATA_RULE } from '@/lib/migration/pw1-json/social-library-proof'
import { COLLECTIONS,type ImportStore,type ImportDiagnostic } from '@/lib/migration/pw1-json/types'
import type { ClassificationRow } from '@/lib/migration/pw1-json/classification'
const store=():ImportStore=>({storeId:'205',collections:{...Object.fromEntries(COLLECTIONS.map(c=>[c,[]])),sites:[{socialLinks:{}}]} as ImportStore['collections']})
const mediaRow=():ClassificationRow=>({table:'medias',sourceId:'1',storeId:'205',record:1,disposition:'retained-source',fields:{id:'retained-source',url:'retained-source'},fieldRetentionRules:{id:MEDIA_METADATA_RULE,url:MEDIA_METADATA_RULE},contributions:[],ownership:{storeId:'205',rule:'SOURCE_STORE_ID'}})
describe('[TC-F42-IMP-SOCIAL-MEDIA-001] Source-only media and supported social projection',()=>{
 it.each(['DELETED','FOLDER','EMPTY_URL'])('accepts exact source-only media receipt %s without emitting it',reason=>{
  // Arrange
  const proof=createSocialLibraryProof(true),d:ImportDiagnostic={code:'MEDIA_SOURCE_ONLY',severity:'warning',table:'medias',sourceId:'1',storeId:'205',reason}
  // Act
  proof.addStore(store());proof.addDiagnostic(d);proof.addRow(mediaRow());proof.finish()
  // Assert
  expect(proof.disposition(d)).toBe('OUT_OF_SCOPE')
 })
 it.each(['disabled','missing-row','emitted','foreign-store'])('rejects source-only media proof mismatch %s',mode=>{
  // Arrange
  const proof=createSocialLibraryProof(mode!=='disabled'),s=store(),d:ImportDiagnostic={code:'MEDIA_SOURCE_ONLY',severity:'warning',table:'medias',sourceId:'1',storeId:'205',reason:'FOLDER'}
  if(mode==='emitted')s.collections.media=[{_ref:'@media:medias:1',url:'https://cdn.example.test/a.jpg',sourceUrl:'https://cdn.example.test/a.jpg',alt:'A'}]
  const row=mediaRow();if(mode==='foreign-store'){row.storeId='285';row.ownership.storeId='285'}
  // Act / Assert
  expect(()=>{proof.addStore(s);proof.addDiagnostic(d);if(mode!=='missing-row')proof.addRow(row);proof.finish()}).toThrow()
 })
 it('accepts malformed social source only when its field remains source-only and output is supported',()=>{
  // Arrange
  const proof=createSocialLibraryProof(true),row:ClassificationRow={table:'stores',sourceId:'205',storeId:'205',record:1,disposition:'mapped',fields:{social_channel:'retained-source'},fieldRetentionRules:{social_channel:SOCIAL_METADATA_RULE},contributions:[],ownership:{storeId:'205',rule:'SOURCE_STORE_ID'}}
  const d:ImportDiagnostic={code:'SOCIAL_CHANNEL_INVALID',severity:'warning',table:'stores',sourceId:'205',storeId:'205',field:'social_channel',reason:'SOURCE_ENTRY_OMITTED'}
  // Act
  proof.addStore(store());proof.addRow(row);proof.finish()
  // Assert
  expect(proof.allows(row,'social_channel',SOCIAL_METADATA_RULE)).toBe(true)
  expect(proof.disposition(d)).toBe('OUT_OF_SCOPE')
  expect(proof.disposition({...d,code:'RAW_VALUE_UNVERIFIED',severity:'blocker',reason:'UNSAFE_URL'})).toBeUndefined()
 })
})
