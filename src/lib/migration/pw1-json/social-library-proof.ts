import type { ClassificationRow } from './classification'
import type { ImportDiagnostic,ImportStore } from './types'
import { MigrationError } from './errors'
export const MEDIA_METADATA_RULE='MASTER-10-MEDIA-SOURCE-METADATA'
export const SOCIAL_METADATA_RULE='MASTER-4-SOCIAL-SOURCE-METADATA'
const mediaMetadata=new Set(['id','store_id','signature','type','parent_id','created_by','deleted_at'])
const platforms=new Set(['facebook','instagram','twitter','linkedin','youtube','tiktok'])
const identity=(store:string,id:string)=>JSON.stringify([store,id])
const safeURL=(value:unknown):boolean=>{if(typeof value!=='string')return false;try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password}catch{return false}}
function fail():never {throw new MigrationError('SOCIAL_LIBRARY_EVIDENCE_INVALID')}
/** Exact source-only receipts and safe projected documents, never arbitrary raw-field waivers. */
export function createSocialLibraryProof(enabled:boolean){
 const media=new Set<string>(),mappedMediaRows=new Set<string>(),mediaWarnings=new Set<string>(),mediaRows=new Set<string>(),socialStores=new Set<string>(),socialRows=new Set<string>()
 let bytes=0
 const charge=(value:string)=>{bytes+=128+2*value.length;if(bytes>64*1024*1024)fail()}
 return {
  addStore(store:ImportStore){
   if(!enabled)return
   const links=store.collections.sites[0]?.socialLinks
   if(links!==undefined){if(!links||typeof links!=='object'||Array.isArray(links)||Object.entries(links).some(([platform,url])=>!platforms.has(platform)||!safeURL(url)))fail()}
   socialStores.add(store.storeId);charge(store.storeId)
   for(const doc of store.collections.media){if(typeof doc._ref!=='string'||!doc._ref.startsWith('@media:medias:'))continue
    const k=identity(store.storeId,doc._ref.slice('@media:medias:'.length));if(media.has(k)||media.size>=100_000)fail()
    if(!safeURL(doc.url)||doc.sourceUrl!==doc.url||typeof doc.alt!=='string'||!doc.alt.trim()||doc.filename!=null)fail()
    media.add(k);charge(k)
   }
  },
  addDiagnostic(d:ImportDiagnostic){
   if(d.code!=='MEDIA_SOURCE_ONLY')return
   if(!enabled||d.table!=='medias'||d.severity!=='warning'||!d.storeId||!d.sourceId||d.field!==undefined||!['DELETED','FOLDER','EMPTY_URL'].includes(d.reason??''))fail()
   const k=identity(d.storeId,d.sourceId);mediaWarnings.add(k);charge(k)
  },
  allows(row:ClassificationRow,field:string,rule:string){
   if(!enabled||row.ownership.rule.startsWith('OWNERSHIP_')||!row.storeId)return false
   if(rule===SOCIAL_METADATA_RULE)return row.table==='stores'&&field==='social_channel'&&row.sourceId===row.storeId&&!row.contributions.some(c=>c.fields.includes(field))
   return rule===MEDIA_METADATA_RULE&&row.table==='medias'&&(mediaMetadata.has(field)||mediaWarnings.has(identity(row.storeId,row.sourceId)))
  },
  addRow(row:ClassificationRow){
   const rules=Object.values(row.fieldRetentionRules??{})
   if(!enabled){if(rules.includes(MEDIA_METADATA_RULE)||rules.includes(SOCIAL_METADATA_RULE)||row.contributions.some(c=>c.rule==='MASTER-4-SOCIAL-SUPPORTED-FIELDS'||c.rule==='MASTER-10-EXTERNAL-LIBRARY-MEDIA'))fail();return}
   if(row.table==='stores'&&row.storeId===row.sourceId&&socialStores.has(row.sourceId)){
    const social=row.contributions.filter(c=>c.fields.includes('social_channel'))
    if(social.length){if(social.length!==1||social[0].rule!=='MASTER-4-SOCIAL-SUPPORTED-FIELDS'||social[0].targetPath!=='sites[].socialLinks'||social[0].table!=='stores'||social[0].sourceId!==row.sourceId||social[0].storeId!==row.storeId||social[0].fields.length!==1||row.fields.social_channel!=='mapped')fail();socialRows.add(row.sourceId)}
    else if(row.fields.social_channel==='retained-source'&&row.fieldRetentionRules?.social_channel===SOCIAL_METADATA_RULE)socialRows.add(row.sourceId)
   }
   if(row.table!=='medias'||!row.storeId)return
   const k=identity(row.storeId,row.sourceId)
   if(mediaWarnings.has(k)){
    if(row.disposition!=='retained-source'||row.contributions.length||row.productExclusion||row.sourceExclusion||media.has(k)||Object.entries(row.fields).some(([f,s])=>s!=='security-excluded'&&(s!=='retained-source'||row.fieldRetentionRules?.[f]!==MEDIA_METADATA_RULE)))fail()
    mediaRows.add(k)
   }else if(row.contributions.some(c=>c.rule==='MASTER-10-EXTERNAL-LIBRARY-MEDIA')){
    if(!media.has(k)||row.productExclusion||row.sourceExclusion||row.fields.url!=='mapped'||!row.contributions.some(c=>c.fields.includes('url'))||row.contributions.some(c=>c.rule!=='MASTER-10-EXTERNAL-LIBRARY-MEDIA'||c.table!==row.table||c.sourceId!==row.sourceId||c.storeId!==row.storeId||c.targetPath!=='media[]'||c.fields.some(f=>!['name','url','created_at','updated_at'].includes(f)||row.fields[f]!=='mapped')))fail()
    mappedMediaRows.add(k)
   }
  },
  finish(){for(const k of mediaWarnings)if(!mediaRows.has(k))fail();for(const k of media)if(!mappedMediaRows.has(k))fail()},
  disposition(d:ImportDiagnostic):'OUT_OF_SCOPE'|undefined{
   if(!enabled)return
   if(d.code==='MEDIA_SOURCE_ONLY'&&d.storeId&&d.sourceId&&mediaRows.has(identity(d.storeId,d.sourceId)))return 'OUT_OF_SCOPE'
   if(d.table==='stores'&&d.severity==='warning'&&d.field==='social_channel'&&d.sourceId===d.storeId&&d.storeId&&socialRows.has(d.storeId)&&((d.code==='SOCIAL_CHANNEL_METADATA_OMITTED'&&['PW2_SUPPORTED_FIELDS_ONLY','UNSUPPORTED_PLATFORM','DUPLICATE_PLATFORM_FIRST_RETAINED'].includes(d.reason??''))||(d.code==='SOCIAL_CHANNEL_INVALID'&&d.reason==='SOURCE_ENTRY_OMITTED')))return 'OUT_OF_SCOPE'
  },
 }
}
