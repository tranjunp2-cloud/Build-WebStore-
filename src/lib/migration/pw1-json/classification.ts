import { createSourceDomainProof } from './source-domain-proof'
import { createModelSettingsProof, UNOWNED_SETTINGS_RULE } from './model-settings-proof'
import { createApprovedSourceScopeProof, approvedSourceRetentionRule, PAGE_MENU_TABLES } from './approved-source-scope'
import { createSocialLibraryProof, MEDIA_METADATA_RULE, SOCIAL_METADATA_RULE } from './social-library-proof'
const MODEL_SETTINGS_SCOPE_RULE = 'MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE'
const modelSettingsSecurityField = (field:string) => ['key_string','recovery_codes'].includes(field)||/password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key|cookie/i.test(field)
import { sourceExclusionSchema, SOURCE_EXCLUSION_RULE, createSourceExclusionIndex } from './source-exclusions'
import { createConflictRetention, CONFLICT_RETENTION_RULE } from './conflict-retention'
import { productExclusionSchema, PRODUCT_EXCLUSION_RULE, PRODUCT_CATALOG_EXCLUSION_RULE, productExclusionRule, type ProductCatalogPolicy, createProductExclusionIndex } from './product-exclusions'
import { externalArchiveKeys, archiveKey } from './export-outcome'
import { EXTERNAL_SOURCE_RULE, externalSourceField, externalSourcePath } from './external-source'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { MigrationError } from './errors'
import type { ImportDiagnostic } from './types'
import type { createSelectedSourceScope } from './source-scope'

export const CLASSIFIED_MAPPING_HASH = '27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567'
export const SOURCE_DOMAIN_MAPPING_HASH = 'a5f311eea68c1aef772ee0c36962c7f17b088026d6d098a206c32f6e4306b2b1'
export const RESTORED_MODEL_SETTINGS_MAPPING_HASH = '08adfe1449160fddfbafcc305a3b2064da599035ed36dda697ba285d11f1516a'
export const APPROVED_SOURCE_SCOPE_MAPPING_HASH = 'fe5b368a1e40d5a02b373170684a3d2b5ec3188373c69359300b8c5fc7c0507f'
export const APPROVED_CATALOG_MAPPING_HASH = '774905b66cc3e44d347706ee3337168728d5720d2cc46ea7dc5cb5a5050a9e29'
export const MODEL_SETTINGS_MAPPING_HASH = 'fb284290ae501c5a22eb09d08627cd3a705d5fd4c84837e3407ce806778a10f7'
export const CHUNKED_MASTER_MAPPING_HASH = '0ac3452beeb4d13ff5ec8bab692b96c4a0a7b54a5ee4f109c28725734d795375'
export const NEGATIVE_ORDER_MAPPING_HASH = '072db65ddeac43bbc709852467a6df6c7c27119a55259614041d9d6bc76cf2a7'
export const SOURCE_OMISSION_MAPPING_HASH = '15303a3f1d6e0efe0bef44a0df294471a70ee82bf75c5e373b5e23182b0c2aee'
export const PRODUCT_CATALOG_MAPPING_HASH = 'b18aba17b84fd99aba8b18808b6f245bca4782c8cb7951a2a82837303c4c147b'
export const OWNER_EMAIL_MAPPING_HASH = 'bd1013ca744f7e8dda398de395c04c1801a8bb7160b390d3c34086da059c97cd'
export const CONFLICT_RESOLUTION_MAPPING_HASH = '8b230a503dba36d690bdae60ecd5bae9b04c6485977a90dc9011c99e61597ab4'
export const POLICY_BOUNDARY_MAPPING_HASH = '8894e3ab00ac2707d724349335dcf20722be5ba53c7e91924a2bb6af23bf5c93'
export const BLOG_CATEGORY_MAPPING_HASH = '514c3b2ae19649296da4b2deb4952ab690108c6701cde94deb55137aae1e3c16'
export const PRODUCT_EXCLUSION_MAPPING_HASH = '763d7ebea95a9772343d135e3943e80cfe94f2b06ca2e466fde54e942972f55e'
export const VARIANT_MAPPING_HASH = 'b93fbe73dddf63cb1fc51ae4bc0c5bebdacf8e12ee3795cad721a0b9a4181887'
export const BLOG_CONTENT_MAPPING_HASH = 'b04256a9b01672b244256f2a13a00191c41ee052a8ffefa8b620c2e6ed1f1820'
export const BLOG_OWNER_MAPPING_HASH = '26946b1948202a6463ca40329befb2886d116d71e3d4e193a31239e3384e3f7c'
export const DESCRIPTION_MAPPING_HASH = 'c0d9098a24005ee04918e2ac01406741de8a845d1f617ac1a6c1a28729b5297d'
export const CORRECTED_OUTCOME_MAPPING_HASH = '049053c41684d888d1d213b029c026666e060afbae09c815f17dd6523870db9c'
export const OUTCOME_MAPPING_HASH = 'bde643f544656d7f1af2b1a0aed0d40b3c748b3051710e1c3043605f06454302'
export const ARCHIVE_MAPPING_HASH = '367ad0adb899cfcbc59c4d44cbd735d545419ca7b0afd53491420b112b0bf43a'
export const STATUS_MAPPING_HASH = 'b531dea88c9fc862b6111df2343dcff0dd0370292dbe308b55ca6b0fc2549870'
export function isClassifiedMappingHash(hash: string): boolean {
  return hash === SOURCE_DOMAIN_MAPPING_HASH || hash === RESTORED_MODEL_SETTINGS_MAPPING_HASH || hash === APPROVED_SOURCE_SCOPE_MAPPING_HASH || hash === APPROVED_CATALOG_MAPPING_HASH || hash === MODEL_SETTINGS_MAPPING_HASH || hash === CHUNKED_MASTER_MAPPING_HASH || hash === NEGATIVE_ORDER_MAPPING_HASH || hash === SOURCE_OMISSION_MAPPING_HASH || hash === PRODUCT_CATALOG_MAPPING_HASH || hash === OWNER_EMAIL_MAPPING_HASH || hash === CONFLICT_RESOLUTION_MAPPING_HASH || hash === POLICY_BOUNDARY_MAPPING_HASH || hash === BLOG_CATEGORY_MAPPING_HASH || hash === PRODUCT_EXCLUSION_MAPPING_HASH || hash === VARIANT_MAPPING_HASH || hash === BLOG_CONTENT_MAPPING_HASH || hash === BLOG_OWNER_MAPPING_HASH || hash === DESCRIPTION_MAPPING_HASH || hash === CORRECTED_OUTCOME_MAPPING_HASH || hash === OUTCOME_MAPPING_HASH || hash === ARCHIVE_MAPPING_HASH || hash === CLASSIFIED_MAPPING_HASH || hash === STATUS_MAPPING_HASH
}
export const CLASSIFICATION_VERSION = 'source-classification-v1'
const ownershipSchema = z.object({ storeId: z.string().nullable(), rule: z.enum([
  'SOURCE_STORE_ID', 'SOURCE_SETTING_STORE_ID', 'SOURCE_GLOBAL_SCOPE', 'SOURCE_PARENT_RELATION', 'OWNERSHIP_CYCLE',
  'OWNERSHIP_MODEL_UNVERIFIED', 'OWNERSHIP_PARENT_UNVERIFIED', 'OWNERSHIP_STORE_CONFLICT', 'OWNERSHIP_STORE_MISSING',
]), parentTable: z.string().optional(), parentId: z.string().optional() }).strict()
export const classificationRowSchema = z.object({
  table: z.string(), sourceId: z.string(), storeId: z.string().nullable(), record: z.number().int().positive(),
  disposition: z.enum(['mapped', 'partial', 'retained-source', 'excluded', 'unresolved']),
  fields: z.record(z.enum(['security-excluded', 'mapped', 'retained-source', 'deleted-retained-source', 'technical-user-excluded', 'source-identity', 'unresolved'])),
  contributions: z.array(z.object({ storeId: z.string().optional(), table: z.string(), sourceId: z.string(), fields: z.array(z.string()), targetPath: z.string(), rule: z.string() }).strict()),
  ownership: ownershipSchema,
  productExclusion: productExclusionSchema.optional(),
  sourceExclusion: sourceExclusionSchema.optional(),
  fieldRetentionRules: z.record(z.string().regex(/^MASTER-[A-Z0-9.-]+$/)).optional(),
}).strict()
export type ClassificationRow = z.infer<typeof classificationRowSchema>
const parents: Record<string, string> = {
  product_skus:'products',category_attributes:'categories',product_attributes:'products',product_images:'products',product_variants:'product_skus',
  product_sku_images:'product_skus',product_sku_promotion_prices:'product_skus',order_details:'orders',order_status_histories:'orders',
  promotion_codes:'promotions',promotion_product_skus:'promotions',voucher_product_skus:'vouchers',page_components:'pages',
  menu_items:'menus',menu_lines:'menu_items',plan_subscription_usages:'plan_subscriptions',chat_logs:'users',plan_subscriptions:'stores',shortlist_items:'page_components',
}
const modelParents = new Set(['stores','users','pages','page_components','menus','menu_items','menu_lines','products','categories'])
const modelTables = new Set(['model_has_roles','model_has_permissions','model_settings'])
const archiveTables = new Set(['brands','product_sku_promotion_prices','media_items','media_categories','permissions','role_has_permissions','model_has_permissions','user_has_model','plans','plan_features','frontend_templates','frontend_components','menu_line_types','countries','provinces','districts','wards','ranks','currencies','payment_methods','roles'])
const sourceOnly: Record<string,string> = {
  oauth_access_tokens:'MASTER-3.2-AUTH-NO-REPLAY',oauth_auth_codes:'MASTER-3.2-AUTH-NO-REPLAY',oauth_clients:'MASTER-3.2-AUTH-NO-REPLAY',oauth_personal_access_clients:'MASTER-3.2-AUTH-NO-REPLAY',oauth_refresh_tokens:'MASTER-3.2-AUTH-NO-REPLAY',password_resets:'MASTER-3.2-AUTH-NO-REPLAY',service_tokens:'MASTER-3.2-AUTH-NO-REPLAY',
  migrations:'MASTER-2.2-SOURCE-BOOKKEEPING',import_histories:'MASTER-2.2-SOURCE-BOOKKEEPING',import_history_details:'MASTER-2.2-SOURCE-BOOKKEEPING',chat_logs:'MASTER-2.2-SOURCE-BOOKKEEPING',delivery_providers:'MASTER-4.1-PROVIDER-LOOKUP',discount_types:'MASTER-7-LOOKUP',promotion_types:'MASTER-7-LOOKUP',order_statuses:'MASTER-7-LOOKUP',email_template_types:'MASTER-8.3-TEMPLATE-LOOKUP',postcodes:'MASTER-6-GEOGRAPHY-LOOKUP',frontend_template_categories:'MASTER-4-TEMPLATE-LOOKUP',icons:'MASTER-4-TEMPLATE-LOOKUP',faq_categories:'MASTER-2.2-SOURCE-SUPPORT-CONTENT',faqs:'MASTER-2.2-SOURCE-SUPPORT-CONTENT',product_sku_images:'MASTER-5.2-SKU-IMAGES-SOURCE-ONLY',
}
const userFields = new Set(['username','backup_email','gender','company_name','introduce','address','signature','birth_day','first_login_status','account_type','verified_at','initial_step1_completed_at','initial_step2_completed_at','initial_step3_completed_at','initial_step4_completed_at','is_enabled_mfa','mfa_type','completed_pages_tour','completed_menu_tour','completed_add_product_tour','completed_delivery_setting_tour'])
function retentionAllowed(row:ClassificationRow,field:string,rule:string):boolean {
  if (rule===SOURCE_EXCLUSION_RULE) return row.fields[field]==='retained-source' && Boolean(row.sourceExclusion)
  if(row.fields[field]!=='retained-source'||row.ownership.rule.startsWith('OWNERSHIP_'))return false
  if(rule===PRODUCT_EXCLUSION_RULE||rule===PRODUCT_CATALOG_EXCLUSION_RULE)return Boolean(row.productExclusion && productExclusionRule(row.productExclusion)===rule)
  if(rule===EXTERNAL_SOURCE_RULE)return externalSourceField(row.table,field)&&row.contributions.some(c=>c.rule===rule&&c.table===row.table&&c.sourceId===row.sourceId&&c.targetPath===externalSourcePath(row.table)&&c.fields.includes(field))
  if(sourceOnly[row.table]===rule)return true
  if(rule==='MASTER-2.2-EXISTING-SOURCE-RETENTION')return archiveTables.has(row.table)
  if(rule==='MASTER-3.4-GLOBAL-USER-DEPENDENCY')return row.table==='users'&&row.storeId===null
  if(rule==='MASTER-3.4-ROLE-SOURCE-EVIDENCE')return row.table==='model_has_roles'
  if(rule==='MASTER-3.2-USER-METADATA-SOURCE-ONLY')return row.table==='users'&&userFields.has(field)
  if(rule==='MASTER-3.2-OPTIONAL-AVATAR-ABSENT')return row.table==='users'&&field==='profile_picture'
  if(rule==='MASTER-2.3-LIVE-ROW-EVIDENCE')return field==='deleted_at'
  if(rule==='MASTER-9.1-TRIAL-SOURCE-EVIDENCE')return row.table==='plan_subscriptions'&&field==='trial_ends_at'
  if(rule==='MASTER-4.1-APPROVED-SHIPPING-SOURCE')return row.table==='store_deliveries'
  if(rule==='MASTER-17-COD-NON-GATEWAY-METADATA')return row.table==='store_payments'&&!['payment_method_id','status'].includes(field)
  return false
}
/** Historical raw receipts describe Page/Menu data that the importer never writes. */
function validLegacySettingContribution(row:ClassificationRow,c:ClassificationRow['contributions'][number]):boolean {
  if(c.table!==row.table||c.sourceId!==row.sourceId||c.storeId!==row.storeId||row.ownership.rule!=='SOURCE_PARENT_RELATION'||!row.storeId||!c.fields.length||c.fields.some(field=>row.fields[field]!=='mapped'))return false
  if(c.rule==='MASTER_RAW_STORE_MODEL_OWNERSHIP')return c.targetPath==='sites.pw1_source.model_settings'&&row.ownership.parentTable==='stores'&&row.ownership.parentId===row.storeId&&c.fields.length===2&&new Set(c.fields).size===2&&c.fields.every(field=>['model_type','model_id'].includes(field))
  return c.rule==='MASTER_RAW_ALLOWLIST'&&({'pages.model_settings':'pages','pages.components.model_settings':'page_components','sites.menus.model_settings':'menus','sites.menus.MenuItem.model_settings':'menu_items','sites.menus.MenuLine.model_settings':'menu_lines','sites.pw1_source.model_settings':'stores'} as Record<string,string>)[c.targetPath]===row.ownership.parentTable&&c.fields.every(field=>['id','store_id','model_id','model_type','key','name','description','value','signature','field','status','parent_id','created_at','updated_at'].includes(field))
}
type Entry = {table:string;sourceId:string;storeId:string|null;owner:ClassificationRow['ownership'];invalid:boolean;unresolved:boolean;fields?:Set<string>;visit?:'visiting'|'verified'}
const key = (table:string,id:string)=>JSON.stringify([table,id])
/** Metadata index only: never retains field values, diagnostic arrays or report rows. */
export function createSourceClassificationIndex(scope?: ReturnType<typeof createSelectedSourceScope>, allowProductExclusions = false, conflictPolicy?: Parameters<typeof createConflictRetention>[0] & Parameters<typeof createApprovedSourceScopeProof>[1] & Parameters<typeof createSourceDomainProof>[1], catalogPolicy?: ProductCatalogPolicy, omissionPolicy?: Parameters<typeof createSourceExclusionIndex>[0], allowModelSettingsSourceOnly = false, allowSocialLibraryMedia = false, allowApprovedSourceScope = false, allowRestoredModelSettings = false, allowSourceDomain = false) {
  const sourceDomain = createSourceDomainProof(allowSourceDomain,conflictPolicy)
  const rawSettings = createModelSettingsProof(allowRestoredModelSettings)
  const approvedSource=createApprovedSourceScopeProof(allowApprovedSourceScope,conflictPolicy)
  const socialLibrary=createSocialLibraryProof(allowSocialLibraryMedia)
  const omissions = createSourceExclusionIndex(omissionPolicy)
  const conflicts = createConflictRetention(conflictPolicy)
  const exclusions = createProductExclusionIndex(() => { throw new MigrationError('PRODUCT_EXCLUSION_EVIDENCE_INVALID') }, allowProductExclusions, catalogPolicy)
  const rows=new Map<string,Entry>(), owners=new Map<string,{id:number;owner:ClassificationRow['ownership']}>()
  const leafIdentities=new Set<bigint>()
  const parentTables=new Set([...Object.values(parents),...modelParents])
  const knownTables=new Set<string>()
  const settingFieldChecks=new Map<string,Set<string>>()
  const diagnosticChecks=new Map<string,{table:string;sourceId:string;stores:Set<string>;allowGlobal:boolean;externalGlobal:boolean;actualStore?:string|null;fields:Set<string>}>()
  let finished=false,indexBytes=0,sourceCount=0,modelSettingsRows=0,modelSettingsScopeMarker=false
  const externalConsumers = new Set<string>()
  const sharedPageDefinitions=new Set<string>()
  const pageStoreCounts=new Map<string,{total:number;pages:number}>()
  const pageRows=new Map<string,Entry>(),globalUnresolved=new Map<string,{total:number;pages:number}>()
  return {
    addProduct: exclusions.addProduct,
    addRawPage: rawSettings.addPage,
    addStore(store:Parameters<typeof omissions.addStore>[0]){omissions.addStore(store);socialLibrary.addStore(store);approvedSource.addStore(store);rawSettings.addStore(store);sourceDomain.addStore(store)},
    addDiagnostic(d:ImportDiagnostic):void {
      if(allowModelSettingsSourceOnly&&d.code==='MODEL_SETTINGS_OUTSIDE_SCOPE'&&d.table==='model_settings'&&d.severity==='warning'&&d.storeId===undefined&&d.sourceId===undefined&&d.field===undefined&&d.reason===undefined)modelSettingsScopeMarker=true
      socialLibrary.addDiagnostic(d)
      approvedSource.addDiagnostic(d)
      rawSettings.addDiagnostic(d)
      omissions.addDiagnostic(d)
      exclusions.addDiagnostic(d)
      conflicts.add(d)
      if(finished)throw new MigrationError('CLASSIFICATION_ALREADY_FINISHED')
      if(d.table==='model_settings'&&d.sourceId){const k=key(d.table,d.sourceId);let fields=settingFieldChecks.get(k);if(!fields){fields=new Set();settingFieldChecks.set(k,fields);indexBytes+=96+2*k.length}if(d.field&&!fields.has(d.field)){fields.add(d.field);indexBytes+=48+2*d.field.length}if(indexBytes>256*1024*1024)throw new MigrationError('CLASSIFICATION_MEMORY_LIMIT')}
      if(!d.table||!d.sourceId||!d.storeId)return
      if(allowApprovedSourceScope&&PAGE_MENU_TABLES.has(d.table)&&d.severity==='warning'&&d.code==='RAW_OWNERSHIP_MISMATCH'&&d.field==='store_id'&&d.reason===undefined)return
      // This Page diagnostic intentionally identifies a referenced row owned by
      // another Store. Keep its original blocker; it is not report corruption.
      if(d.table==='banners'&&d.code==='RAW_OWNERSHIP_MISMATCH'&&d.severity==='blocker'&&d.field==='store_id'&&d.reason===undefined)return
      let table=d.table,sourceId=d.sourceId
      // site-policy.ts uses selected?.id ?? storeId for these fallback reasons.
      if(table==='store_deliveries'&&d.code==='SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT'&&d.severity==='warning'&&d.field==='shipping_fee_config'&&sourceId===d.storeId&&['MISSING_OR_UNCONFIGURED_SOURCE','PROVIDER_OR_UNKNOWN_SOURCE_MODE','AMBIGUOUS_SELF_DELIVERY'].includes(d.reason??''))table='stores'
      // These aggregate domain warnings identify the Store, not a store_domains row.
      if(table==='store_domains'&&d.severity==='warning'&&d.field===undefined&&sourceId===d.storeId&&((d.code==='DEFAULT_DOMAIN_AMBIGUOUS'&&d.reason==='PLATFORM_DOMAIN_FALLBACK')||(d.code==='SOURCE_MAIN_DOMAIN_AMBIGUOUS'&&d.reason==='CUSTOM_DOMAINS_PENDING')))table='stores'
      // Shared Page definitions emit per-consuming-Store raw diagnostics.
      const allowGlobal=['frontend_components','frontend_templates','menu_line_types'].includes(table)&&d.code==='RAW_VALUE_UNVERIFIED'&&d.severity==='blocker'&&d.reason==='UNKNOWN_STRUCTURE_KEY'&&(d.field==='config'||(table!=='frontend_templates'&&d.field==='default_config_values'))
      const externalGlobal = table === 'frontend_templates' && d.severity === 'blocker' && ['RAW_VALUE_UNVERIFIED','RAW_FIELD_UNVERIFIED'].includes(d.code) && Boolean(d.field)
      if(sourceId.startsWith('@')){
        const match=/^@[^:]+:([^:]+):([^:]+)$/.exec(sourceId)
        if(!match||match[1]!==d.table)return
        sourceId=match[2]
      }
      const k=key(table,sourceId)+(allowGlobal?':global-reference':externalGlobal?':external-reference':'')
      let check=diagnosticChecks.get(k)
      if(!check){
        if(diagnosticChecks.size>=100_000)throw new MigrationError('CLASSIFICATION_DIAGNOSTIC_LIMIT')
        check={table,sourceId,stores:new Set(),allowGlobal,externalGlobal,fields:new Set()};diagnosticChecks.set(k,check)
        indexBytes+=192+2*k.length
      }
      if(d.field&&!check.fields.has(d.field)){check.fields.add(d.field);indexBytes+=48+2*d.field.length}
      if(!check.stores.has(d.storeId)){check.stores.add(d.storeId);indexBytes+=48+2*d.storeId.length}
      if(indexBytes>256*1024*1024)throw new MigrationError('CLASSIFICATION_MEMORY_LIMIT')
    },
    addRow(row:ClassificationRow):void {
      socialLibrary.addRow(row)
      approvedSource.addRow(row)
      omissions.addRow(row)
      exclusions.addRow(row)
      if(finished)throw new MigrationError('CLASSIFICATION_ALREADY_FINISHED')
      if(row.ownership.storeId!==row.storeId||Object.keys(row.fieldRetentionRules??{}).some(field=>row.fields[field]!=='retained-source'))throw new MigrationError('CLASSIFICATION_ROW_INVALID')
      if(++sourceCount>1_000_000)throw new MigrationError('CLASSIFICATION_INDEX_LIMIT')
      scope?.addRow(row)
      knownTables.add(row.table)
      if(['frontend_components','frontend_templates','menu_line_types'].includes(row.table)&&row.ownership.rule==='SOURCE_GLOBAL_SCOPE'&&row.storeId===null){
        const definitionKey=key(row.table,row.sourceId)
        if(!sharedPageDefinitions.has(definitionKey))indexBytes+=48+2*definitionKey.length
        sharedPageDefinitions.add(definitionKey)
      }
      for(const suffix of ['',':global-reference',':external-reference']){
        const diagnostic=diagnosticChecks.get(key(row.table,row.sourceId)+suffix)
        if(diagnostic)diagnostic.actualStore=row.storeId
      }
      const scopeRow=allowModelSettingsSourceOnly&&row.table==='model_settings'
      if(scopeRow)modelSettingsRows++
      const scopeValid=scopeRow&&row.disposition==='retained-source'&&row.contributions.length===0&&!row.productExclusion&&!row.sourceExclusion&&Object.entries(row.fields).every(([field,status])=>modelSettingsSecurityField(field)?status==='security-excluded':status==='retained-source'&&row.fieldRetentionRules?.[field]===MODEL_SETTINGS_SCOPE_RULE)
      const invalid=(scopeRow&&!scopeValid)||(row.table==='model_settings'&&row.contributions.some(c=>c.rule!==EXTERNAL_SOURCE_RULE&&!(allowRestoredModelSettings?rawSettings.validContribution(row,c):validLegacySettingContribution(row,c))))||row.contributions.some(c=>c.rule===EXTERNAL_SOURCE_RULE&&(c.table!==row.table||c.sourceId!==row.sourceId||c.targetPath!==externalSourcePath(row.table)||c.fields.some(field=>!externalSourceField(row.table,field))))||Object.entries(row.fieldRetentionRules??{}).some(([field,rule])=>!(rule===UNOWNED_SETTINGS_RULE ? rawSettings.allows(row,field,rule) : approvedSourceRetentionRule(rule) ? approvedSource.allows(row,field,rule) : (rule === MEDIA_METADATA_RULE || rule === SOCIAL_METADATA_RULE) ? socialLibrary.allows(row,field,rule) : rule === MODEL_SETTINGS_SCOPE_RULE ? scopeValid : rule === CONFLICT_RETENTION_RULE ? conflicts.allows(row.table, row.sourceId, field, row.ownership) : retentionAllowed(row,field,rule)))
      rawSettings.addRow(row)
      sourceDomain.addRow(row)
      if (!invalid && row.storeId === null && row.ownership.rule === 'SOURCE_GLOBAL_SCOPE') {
        for (const consumer of externalArchiveKeys(row)) if (!externalConsumers.has(consumer)) { externalConsumers.add(consumer); indexBytes += 48 + 2 * consumer.length }
      }
      const unresolved=row.disposition==='unresolved'||row.disposition==='partial'||Object.values(row.fields).includes('unresolved')
      const ownerKey=JSON.stringify(row.ownership)
      // Leaf rows cannot be ownership parents. Equivalent checks need one entry,
      // while model_settings IDs remain available for exact diagnostic discharge.
      const indexed=Boolean(row.sourceExclusion)||parentTables.has(row.table)||(row.table==='model_settings'&&(unresolved||diagnosticChecks.has(key(row.table,row.sourceId))||settingFieldChecks.has(key(row.table,row.sourceId))))
      if(!indexed||row.table==='model_settings'){
        // A fingerprint collision rejects safely; it can never hide a duplicate.
        const bytes=createHash('sha256').update(key(row.table,row.sourceId)).digest()
        const fingerprint=(bytes.readBigUInt64BE(0)<<BigInt(64))|bytes.readBigUInt64BE(8)
        if(leafIdentities.has(fingerprint))throw new MigrationError('CLASSIFICATION_DUPLICATE_SOURCE')
        leafIdentities.add(fingerprint);indexBytes+=48
      }
      let interned=owners.get(ownerKey)
      if(!interned){interned={id:owners.size,owner:row.ownership};owners.set(ownerKey,interned);indexBytes+=160+ownerKey.length*2}
      const sourceId=indexed?row.sourceId:`leaf:${interned.id}:${Number(invalid)}:${Number(unresolved)}`
      const rowKey=key(row.table,sourceId)
      if(indexBytes>256*1024*1024)throw new MigrationError('CLASSIFICATION_MEMORY_LIMIT')
      if(rows.has(rowKey)){
        if(indexed)throw new MigrationError('CLASSIFICATION_DUPLICATE_SOURCE')
        return
      }
      if(rows.size>=1_000_000)throw new MigrationError('CLASSIFICATION_INDEX_LIMIT')
      const owner=interned.owner
      // Approximate metadata budget, not a measurement/guarantee of V8 RSS.
      indexBytes+=128+2*(rowKey.length+row.table.length+sourceId.length+(row.storeId?.length??0))
      if(indexBytes>256*1024*1024)throw new MigrationError('CLASSIFICATION_MEMORY_LIMIT')
      const requestedFields=settingFieldChecks.get(key(row.table,row.sourceId))
      const fields=row.table==='model_settings'&&requestedFields?new Set([...requestedFields].filter(field=>field in row.fields)):undefined
      if(fields)indexBytes+=[...fields].reduce((sum,field)=>sum+48+2*field.length,0)
      if(indexBytes>256*1024*1024)throw new MigrationError('CLASSIFICATION_MEMORY_LIMIT')
      rows.set(rowKey,{table:row.table,sourceId,storeId:row.storeId,owner,invalid,unresolved,fields})
    },
    finish():ImportDiagnostic[] {
      if(finished)throw new MigrationError('CLASSIFICATION_ALREADY_FINISHED')
      finished=true
      if(modelSettingsRows&&!modelSettingsScopeMarker)throw new MigrationError('MODEL_SETTINGS_SCOPE_EVIDENCE_INVALID')
      socialLibrary.finish()
      approvedSource.finish()
      rawSettings.finish()
      sourceDomain.finish()
      exclusions.finish()
      omissions.finish()
      const validOwner=(entry:Entry):boolean=>{
        if(entry.visit==='verified')return !entry.invalid
        if(entry.visit==='visiting'){entry.invalid=true;return false}
        entry.visit='visiting'
        const o=entry.owner
        if(o.rule.startsWith('OWNERSHIP_')){
          if(entry.storeId!==null)entry.invalid=true
          if(o.parentTable){
            const allowed=modelTables.has(entry.table)?modelParents.has(o.parentTable):parents[entry.table]===o.parentTable
            if(!allowed)entry.invalid=true
          }
          if(o.rule==='OWNERSHIP_PARENT_UNVERIFIED'){
            if(!o.parentTable)entry.invalid=true
            const parent=o.parentTable&&o.parentId?rows.get(key(o.parentTable,o.parentId)):undefined
            if(parent&&!parent.owner.rule.startsWith('OWNERSHIP_')&&validOwner(parent))entry.invalid=true
          }
        }
        else if(o.rule==='SOURCE_GLOBAL_SCOPE'){if(entry.storeId!==null||o.parentTable||o.parentId||modelTables.has(entry.table)||(parents[entry.table]&&entry.table!=='shortlist_items'&&entry.table!=='product_skus')||entry.table==='stores')entry.invalid=true}
        else if(o.rule==='SOURCE_SETTING_STORE_ID'){
          if(!allowRestoredModelSettings||entry.table!=='model_settings'||!entry.storeId||o.parentTable||o.parentId||!rows.has(key('stores',entry.storeId)))entry.invalid=true
        }
        else if(o.rule==='SOURCE_STORE_ID'){
          if(!entry.storeId||o.parentTable||o.parentId||modelTables.has(entry.table)||(parents[entry.table]&&entry.table!=='shortlist_items'&&entry.table!=='product_skus')||!rows.has(key('stores',entry.storeId))||(entry.table==='stores'&&entry.sourceId!==entry.storeId))entry.invalid=true
        }else {
          const allowed=modelTables.has(entry.table)?modelParents.has(o.parentTable??''):parents[entry.table]===o.parentTable
          const parent=o.parentTable&&o.parentId?rows.get(key(o.parentTable,o.parentId)):undefined
          if(!allowed||!parent||parent.owner.rule.startsWith('OWNERSHIP_')||!validOwner(parent)||parent.storeId!==entry.storeId)entry.invalid=true
        }
        entry.visit='verified';return !entry.invalid
      }
      const failures=new Map<string,ImportDiagnostic>()
      for(const entry of rows.values()) {
        validOwner(entry)
        const page=!entry.invalid&&entry.table==='model_settings'
        if(entry.unresolved&&entry.table==='model_settings'&&entry.storeId){
          const counts=pageStoreCounts.get(entry.storeId)??{total:0,pages:0};counts.total++;if(page)counts.pages++;pageStoreCounts.set(entry.storeId,counts)
        }
        if(page)pageRows.set(key(entry.table,entry.sourceId),entry)
        if(entry.unresolved&&entry.storeId===null){const counts=globalUnresolved.get(entry.table)??{total:0,pages:0};counts.total++;if(page)counts.pages++;globalUnresolved.set(entry.table,counts)}
        if(entry.invalid){
          if(failures.size>=1000&&!failures.has(entry.table))throw new MigrationError('CLASSIFICATION_FAILURE_LIMIT')
          failures.set(entry.table,{code:'SOURCE_CLASSIFICATION_INVALID',severity:'blocker',table:entry.table})
        }
      }
      for(const check of diagnosticChecks.values()){
        const actual=check.actualStore!==undefined?check.actualStore:rows.get(key(check.table,check.sourceId))?.storeId
        const verifiedExternal = check.externalGlobal && [...check.stores].every(store => {
          const consumer = rows.get(key('stores',store))
          return consumer && validOwner(consumer) && externalConsumers.has(archiveKey(store,check.table,check.sourceId))
        })
        if((actual!==undefined&&!(actual===null&&(check.allowGlobal||verifiedExternal))&&[...check.stores].some(store=>store!==actual))||(actual===undefined&&knownTables.has(check.table)&&/^(?:[0-9]+|record:[1-9][0-9]*)$/.test(check.sourceId))){
          if(failures.size>=1000&&!failures.has(check.table))throw new MigrationError('CLASSIFICATION_FAILURE_LIMIT')
          failures.set(check.table,{code:'SOURCE_CLASSIFICATION_INVALID',severity:'blocker',table:check.table})
        }
      }
      scope?.finish((table,id) => rows.has(key(table,id)))
      settingFieldChecks.clear();rows.clear();owners.clear();leafIdentities.clear();diagnosticChecks.clear();knownTables.clear();externalConsumers.clear()
      return [...failures.values()]
    },
    disposition(d:ImportDiagnostic):'OUT_OF_SCOPE'|'APPROVED_POLICY'|undefined {
      if(!finished)return undefined
      if(allowModelSettingsSourceOnly&&d.code==='MODEL_SETTINGS_OUTSIDE_SCOPE'&&d.table==='model_settings'&&d.severity==='warning'&&!d.storeId&&!d.sourceId&&!d.field&&!d.reason)return 'OUT_OF_SCOPE'
      const sourceDomainDisposition=sourceDomain.disposition(d)
      if(sourceDomainDisposition)return sourceDomainDisposition
      const rawDisposition=rawSettings.disposition(d)
      if(rawDisposition)return rawDisposition
      const approvedDisposition=approvedSource.disposition(d)
      if(approvedDisposition)return approvedDisposition
      const socialDisposition=socialLibrary.disposition(d)
      if(socialDisposition)return socialDisposition
      const omitted=omissions.disposition(d)
      if(omitted)return omitted
      const scoped = scope?.disposition(d)
      if(scoped)return scoped
      if(d.severity==='blocker'&&d.code==='SOURCE_OWNERSHIP_UNRESOLVED'&&d.field===undefined&&d.sourceId&&['pages','page_components','banners','shortlist_items','frontend_components'].includes(d.table??'')&&['OWNERSHIP_CYCLE','OWNERSHIP_MODEL_UNVERIFIED','OWNERSHIP_PARENT_UNVERIFIED','OWNERSHIP_STORE_CONFLICT','OWNERSHIP_STORE_MISSING'].includes(d.reason??''))return 'OUT_OF_SCOPE'
      if(d.severity==='blocker'&&d.code==='RAW_VALUE_UNVERIFIED'&&d.reason==='UNKNOWN_STRUCTURE_KEY'&&(d.field==='config'||(d.table!=='frontend_templates'&&d.field==='default_config_values'))&&d.table&&d.sourceId&&sharedPageDefinitions.has(key(d.table,d.sourceId)))return 'OUT_OF_SCOPE'
      if(d.table==='model_settings'&&d.severity==='blocker'&&d.code==='RAW_FIELD_UNVERIFIED'&&d.reason===undefined&&d.field&&d.sourceId){const row=pageRows.get(key(d.table,d.sourceId));if(row&&row.storeId===(d.storeId??null)&&row.fields?.has(d.field))return 'OUT_OF_SCOPE'}
      if(d.table==='model_settings'&&d.severity==='blocker'&&d.code==='RAW_VALUE_UNVERIFIED'&&d.field&&['SECRET_CONTENT','UNSAFE_URL','UNKNOWN_STRUCTURE_KEY','INVALID_JSON','INVALID_VALUE_TYPE','UNKNOWN_SETTING_KEY','INVALID_SETTING_VALUE'].includes(d.reason??'')&&d.sourceId&&pageRows.get(key(d.table,d.sourceId))?.storeId===(d.storeId??null)&&pageRows.get(key(d.table,d.sourceId))?.fields?.has(d.field))return 'OUT_OF_SCOPE'
      if(d.table!=='model_settings'||!(d.severity==='blocker'||(allowModelSettingsSourceOnly&&d.severity==='warning'&&d.code==='SOURCE_OWNERSHIP_UNRESOLVED'))||d.field!==undefined||!['SOURCE_OWNERSHIP_UNRESOLVED','SOURCE_FIELDS_UNRESOLVED','REPORT_ROW_UNRESOLVED'].includes(d.code))return undefined
      if(d.sourceId&&pageRows.has(key(d.table,d.sourceId))){
        const row=pageRows.get(key(d.table,d.sourceId))!
        if((d.storeId??null)===row.storeId&&(d.code==='SOURCE_OWNERSHIP_UNRESOLVED'?d.reason===row.owner.rule:d.reason===undefined))return 'OUT_OF_SCOPE'
      }
      if(d.code==='SOURCE_FIELDS_UNRESOLVED'&&d.storeId&&!d.sourceId&&d.reason===undefined){const counts=pageStoreCounts.get(d.storeId);if(counts&&counts.total>0&&counts.total===counts.pages)return 'OUT_OF_SCOPE'}
      const counts=globalUnresolved.get(d.table)
      if(d.code!=='SOURCE_OWNERSHIP_UNRESOLVED'&&d.reason===undefined&&!d.storeId&&!d.sourceId&&counts&&counts.total>0&&counts.total===counts.pages)return 'OUT_OF_SCOPE'
      return undefined
    },
  }
}
