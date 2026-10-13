import type { ClassificationRow } from './classification'
import type { ImportDiagnostic, ImportStore } from './types'
import { MigrationError } from './errors'
import { APPROVED_METADATA_FIELDS, APPROVED_SCOPE_HEADERS } from './approved-source-fields'
export const APPROVED_METADATA_RULE='MASTER-2.2-APPROVED-SOURCE-METADATA'
export const MAPPED_ORDER_METADATA_RULE='MASTER-7-MAPPED-ORDER-SOURCE-METADATA'
export const TECHNICAL_SCOPE_RULE='MASTER-2.2-TECHNICAL-OUTSIDE-SCOPE'
export const TECHNICAL_SCOPE_CODE='SOURCE_TABLE_OUTSIDE_SCOPE'
export const ADDRESS_OVERFLOW_RULE='MASTER-6-ADDRESS-OVERFLOW-SOURCE-ONLY'
export const EXCLUDED_DISCOUNT_RULE='MASTER-7-EXCLUDED-DISCOUNT-SOURCE'
export const STORE_CODES_RULE='MASTER-2.2-STORE-CODES-SOURCE-ONLY'
export const PAGE_MENU_SCOPE_RULE='MASTER-PAGE-MENU-RAW-SOURCE'
export const PAGE_MENU_SCOPE_CODE='PAGE_MENU_RAW_SOURCE_ONLY'
export const PAGE_MENU_TABLES=new Set(['pages','page_components','banners','shortlist_items','menus','menu_items','menu_lines','frontend_components','frontend_templates','menu_line_types'])
export const TECHNICAL_TABLES=new Set(['queue_sync','model_exports'])
const rules=new Set([APPROVED_METADATA_RULE,MAPPED_ORDER_METADATA_RULE,TECHNICAL_SCOPE_RULE,ADDRESS_OVERFLOW_RULE,EXCLUDED_DISCOUNT_RULE,STORE_CODES_RULE,PAGE_MENU_SCOPE_RULE])
const rawPaths:Record<string,string>={pages:'pages',page_components:'pages.components',banners:'pages.components.banners',shortlist_items:'pages.components.shortlist_items',frontend_components:'pages.components.frontend_component',frontend_templates:'sites.raw_frontend_template',menus:'sites.menus',menu_items:'sites.menus.menu_items',menu_lines:'sites.menus.menu_items.menu_lines',menu_line_types:'sites.menus.menu_line_type'}
const security=(field:string)=>['key_string','recovery_codes'].includes(field)||/password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key|cookie/i.test(field)
const key=(table:string,id:string)=>JSON.stringify([table,id])
const ownedKey=(store:string,id:string)=>key(store,id)
const fail=():never=>{throw new MigrationError('APPROVED_SOURCE_SCOPE_EVIDENCE_INVALID')}
const globalMarker=(d:ImportDiagnostic)=>d.severity==='warning'&&d.storeId===undefined&&d.sourceId===undefined&&d.field===undefined&&d.reason===undefined
export function createApprovedSourceScopeProof(enabled:boolean,policy?:{shippingPolicy?:string;allowCustomerAddressOverflow?:boolean;skipInvalidDiscountCodes?:boolean;selectOldestOwner?:boolean;preserveHistoricalOrders?:boolean;allowHistoricalDiscountEligibilityGap?:boolean}){
 const markers=new Set<string>(),wanted=new Set<string>(),evidence=new Map<string,{storeId:string|null;rule:string;fields:Set<string>}>()
 const sourceStores=new Set<string>(),templateMissing=new Set<string>()
 const editors=new Set<string>(),userRoots=new Set<string>(),historicalDiscountOrders=new Set<string>()
 const emittedOrders=new Set<string>(),orderRoots=new Map<string,string>(),pendingOrders=new Map<string,string>()
 const emittedDiscounts=new Set<string>(),discountWarnings=new Set<string>(),discountCodes=new Map<string,{storeId:string|null;parentId?:string;contributions:boolean}>(),discountParents=new Set<string>(),discountClaims=new Set<string>()
 const overflowWarnings=new Set<string>(),shippingStores=new Set<string>(),shippingWarnings=new Set<string>(),scopedRows=new Set<string>()
 let bytes=0,finished=false
 const charge=(v:string)=>{bytes+=128+2*v.length;if(bytes>64*1024*1024)fail()}
 return {
  addStore(store:ImportStore){if(!enabled)return
   for(const order of store.collections.orders){const ref=String(order._ref);const k=ownedKey(store.storeId,ref);emittedOrders.add(k);charge(k);if(typeof order.discountCode==='string'&&order.discountCode.trim()&&order.discount===undefined)historicalDiscountOrders.add(k)}
   for(const discount of store.collections.discounts){const k=ownedKey(store.storeId,String(discount._ref));emittedDiscounts.add(k);charge(k)}
   for(const user of store.collections.users){
    const memberships=user.tenants
    if(!Array.isArray(user.roles)||user.roles.length!==1||user.roles[0]!=='editor'||!Array.isArray(memberships)||memberships.length!==1)continue
    const member=memberships[0] as Record<string,unknown>
    if(member.tenant===`@tenants:stores:${store.storeId}`&&member.role==='editor'&&Array.isArray(member.permissions)&&member.permissions.length===0&&(user.permissions===undefined||(Array.isArray(user.permissions)&&user.permissions.length===0))){const k=ownedKey(store.storeId,String(user._ref));editors.add(k);charge(k)}
   }
   const config=store.collections.sites[0]?.shippingConfig as Record<string,unknown>|undefined
   if(config&&config.enabled===true&&config.westRate===800&&config.eastRate===1500&&config.freeAbove===null&&config.shippingSetupConfirmed===false)shippingStores.add(store.storeId)
  },
  addDiagnostic(d:ImportDiagnostic){
   if(d.code===TECHNICAL_SCOPE_CODE||d.code===PAGE_MENU_SCOPE_CODE){if(!enabled||!globalMarker(d)||!(d.code===TECHNICAL_SCOPE_CODE?TECHNICAL_TABLES:PAGE_MENU_TABLES).has(d.table??''))fail();markers.add(d.table!);return}
   if(!enabled)return
   if(d.code==='RAW_TEMPLATE_MISSING'&&d.table==='stores'&&d.severity==='warning'&&d.storeId&&d.sourceId===d.storeId&&d.field==='frontend_template_id'&&d.reason===undefined)templateMissing.add(d.storeId)
   if(d.table&&d.sourceId&&(PAGE_MENU_TABLES.has(d.table)||TECHNICAL_TABLES.has(d.table))){const k=key(d.table,d.sourceId);if(!wanted.has(k)){wanted.add(k);charge(k)}}
   if(d.code==='CUSTOMER_ADDRESS_OVERFLOW'&&d.table==='addresses'&&d.severity==='warning'&&d.storeId&&d.sourceId&&d.field===undefined&&d.reason===undefined)overflowWarnings.add(ownedKey(d.storeId,d.sourceId))
   if(d.table==='promotion_codes'&&d.severity==='warning'&&d.storeId&&d.sourceId&&d.field===undefined&&d.reason===undefined&&['DISCOUNT_MAPPING_INVALID','DISCOUNT_CODE_COLLISION'].includes(d.code))discountWarnings.add(ownedKey(d.storeId,d.sourceId))
   if(d.code==='SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT'&&d.table==='stores'&&d.severity==='warning'&&d.storeId&&d.sourceId===d.storeId&&d.field==='shipping_fee_config'&&d.reason==='APPROVED_PW2_DEFAULTS')shippingWarnings.add(d.storeId)
  },
  allows(row:ClassificationRow,field:string,rule:string):boolean{
   if(!rules.has(rule))return false
   if(!enabled||row.fields[field]!=='retained-source')return false
   if(rule===TECHNICAL_SCOPE_RULE)return TECHNICAL_TABLES.has(row.table)&&markers.has(row.table)&&!security(field)
   if(rule===PAGE_MENU_SCOPE_RULE)return PAGE_MENU_TABLES.has(row.table)&&markers.has(row.table)&&!security(field)
   if(row.ownership.rule.startsWith('OWNERSHIP_'))return false
   if(rule===APPROVED_METADATA_RULE)return row.table!=='medias'&&(APPROVED_METADATA_FIELDS[row.table]?.includes(field)??false)
   if(rule===MAPPED_ORDER_METADATA_RULE)return ['orders','order_details'].includes(row.table)&&(APPROVED_SCOPE_HEADERS[row.table]?.includes(field)??false)
   if(rule===ADDRESS_OVERFLOW_RULE)return row.table==='addresses'&&policy?.allowCustomerAddressOverflow===true&&overflowWarnings.has(ownedKey(row.storeId??'',row.sourceId))&&(APPROVED_SCOPE_HEADERS.addresses?.includes(field)??false)
   if(rule===EXCLUDED_DISCOUNT_RULE)return ['promotions','promotion_codes'].includes(row.table)&&policy?.skipInvalidDiscountCodes===true&&(APPROVED_SCOPE_HEADERS[row.table]?.includes(field)??false)
   return rule===STORE_CODES_RULE&&row.table==='store_codes'&&(APPROVED_SCOPE_HEADERS.store_codes?.includes(field)??false)
  },
  addRow(row:ClassificationRow){
   const used=Object.values(row.fieldRetentionRules??{})
   if(!enabled){if(used.some(r=>rules.has(r))||row.contributions.some(c=>c.rule==='MASTER_RAW_PW1_CONTENT'||c.rule==='master-6-customer-address'))fail();return}
   if(row.table==='stores'&&row.storeId===row.sourceId&&row.ownership.rule==='SOURCE_STORE_ID'&&'frontend_template_id' in row.fields)sourceStores.add(row.sourceId)
   const scoped=TECHNICAL_TABLES.has(row.table)||PAGE_MENU_TABLES.has(row.table)
   if(scoped){
    if(!markers.has(row.table))fail()
    scopedRows.add(row.table)
    if(TECHNICAL_TABLES.has(row.table)&&(row.disposition!=='retained-source'||row.contributions.length||row.productExclusion||row.sourceExclusion||Object.entries(row.fields).some(([f,s])=>security(f)?s!=='security-excluded'||row.fieldRetentionRules?.[f]!==undefined:s!=='retained-source'||row.fieldRetentionRules?.[f]!==TECHNICAL_SCOPE_RULE)))fail()
    if(row.ownership.rule.startsWith('OWNERSHIP_')&&row.contributions.length)fail()
    const k=key(row.table,row.sourceId)
    if(wanted.has(k)){evidence.set(k,{storeId:row.storeId,rule:row.ownership.rule,fields:new Set(Object.keys(row.fields))});charge(k+Object.keys(row.fields).join(','))}
   }
   for(const c of row.contributions.filter(c=>c.rule==='MASTER_RAW_PW1_CONTENT'))if(!PAGE_MENU_TABLES.has(row.table)||c.table!==row.table||c.sourceId!==row.sourceId||c.targetPath!==rawPaths[row.table]||!c.storeId||(row.storeId!==null&&c.storeId!==row.storeId)||!c.fields.length||c.fields.some(f=>row.fields[f]!=='mapped'||security(f)))fail()
   if(row.table==='users'&&row.storeId&&row.contributions.some(c=>c.rule==='MASTER-3.2-3.4'&&c.table==='users'&&c.sourceId===row.sourceId&&c.storeId===row.storeId&&c.targetPath===`@users:users:${row.sourceId}`))userRoots.add(ownedKey(row.storeId,`@users:users:${row.sourceId}`))
   if(row.table==='orders'&&row.storeId&&row.contributions.some(c=>c.rule==='master-7.2'&&c.table==='orders'&&c.sourceId===row.sourceId&&c.storeId===row.storeId&&c.targetPath===`@orders:orders:${row.sourceId}`)){orderRoots.set(row.sourceId,row.storeId);charge(row.sourceId)}
   if(used.includes(MAPPED_ORDER_METADATA_RULE)){
    const id=row.table==='orders'?row.sourceId:row.ownership.parentTable==='orders'?row.ownership.parentId:undefined
    if(!id||!row.storeId)return fail();pendingOrders.set(ownedKey(row.storeId,id),id);charge(id)
   }
   if(row.table==='promotion_codes'){discountCodes.set(row.sourceId,{storeId:row.storeId,parentId:row.ownership.parentTable==='promotions'?row.ownership.parentId:undefined,contributions:row.contributions.length>0});charge(row.sourceId)}
   if(used.includes(EXCLUDED_DISCOUNT_RULE)){if(row.contributions.length||!row.storeId||!policy?.skipInvalidDiscountCodes)return fail();if(row.table==='promotions')discountParents.add(ownedKey(row.storeId,row.sourceId));else if(row.table==='promotion_codes')discountClaims.add(row.sourceId);else fail()}
   if(used.includes(STORE_CODES_RULE)&&row.contributions.length)fail()
  },
  finish(){
   if(!enabled){finished=true;return}
   for(const [k,id]of pendingOrders){const store=orderRoots.get(id);if(!store||ownedKey(store,id)!==k||!emittedOrders.has(ownedKey(store,`@orders:orders:${id}`)))fail()}
   const validCode=(id:string)=>{const c=discountCodes.get(id);return c?.storeId&&!c.contributions&&discountWarnings.has(ownedKey(c.storeId,id))&&!emittedDiscounts.has(ownedKey(c.storeId,`@discounts:promotion_codes:${id}`))}
   for(const id of discountClaims)if(!validCode(id))fail()
   for(const parent of discountParents){let count=0;for(const [id,c]of discountCodes)if(c.storeId&&c.parentId&&ownedKey(c.storeId,c.parentId)===parent){count++;if(!validCode(id))fail()}if(!count)fail()}
   for(const id of shippingWarnings)if(policy?.shippingPolicy!=='pw2-defaults'||!shippingStores.has(id))fail()
   finished=true
  },
  disposition(d:ImportDiagnostic):'OUT_OF_SCOPE'|'APPROVED_POLICY'|undefined{
   if(!enabled||!finished)return
   if(d.code==='USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED'&&d.table==='users'&&d.severity==='warning'&&d.storeId&&d.sourceId&&d.field===undefined&&d.reason===undefined&&policy?.selectOldestOwner===true){const k=ownedKey(d.storeId,`@users:users:${d.sourceId}`);if(editors.has(k)&&userRoots.has(k))return 'APPROVED_POLICY'}
   if(d.code==='ORDER_DISCOUNT_REFERENCE_UNVERIFIED'&&d.table==='orders'&&d.severity==='warning'&&d.storeId&&d.sourceId&&d.field==='promotion_code'&&d.reason===undefined&&policy?.preserveHistoricalOrders===true&&policy?.allowHistoricalDiscountEligibilityGap===true&&orderRoots.get(d.sourceId)===d.storeId&&historicalDiscountOrders.has(ownedKey(d.storeId,`@orders:orders:${d.sourceId}`)))return 'APPROVED_POLICY'
   if(d.code==='RAW_TEMPLATE_MISSING'&&d.table==='stores'&&d.severity==='warning'&&d.storeId&&d.sourceId===d.storeId&&d.field==='frontend_template_id'&&d.reason===undefined&&markers.has('frontend_templates')&&templateMissing.has(d.storeId)&&sourceStores.has(d.storeId))return 'OUT_OF_SCOPE'
   if((d.code===TECHNICAL_SCOPE_CODE||d.code===PAGE_MENU_SCOPE_CODE)&&globalMarker(d)&&markers.has(d.table??''))return 'OUT_OF_SCOPE'
   if(d.code==='SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT'&&d.table==='stores'&&d.severity==='warning'&&d.storeId&&d.sourceId===d.storeId&&d.field==='shipping_fee_config'&&d.reason==='APPROVED_PW2_DEFAULTS'&&shippingWarnings.has(d.storeId))return 'OUT_OF_SCOPE'
   if(!d.table||!d.sourceId||d.severity!=='warning'||!markers.has(d.table))return
   const row=evidence.get(key(d.table,d.sourceId));if(!row)return
   if(d.code==='SOURCE_OWNERSHIP_UNRESOLVED'&&d.field===undefined&&d.storeId===undefined&&row.storeId===null&&d.reason===row.rule)return 'OUT_OF_SCOPE'
   if(PAGE_MENU_TABLES.has(d.table)&&d.reason===undefined&&((d.code==='RAW_COMPONENT_DEFINITION_MISSING'&&d.table==='page_components'&&d.field==='frontend_component_id')||(d.code==='RAW_MENU_TYPE_MISSING'&&['menu_items','menu_lines'].includes(d.table)&&d.field==='type_id')||(d.code==='RAW_OWNERSHIP_MISMATCH'&&d.field==='store_id'))&&d.field&&row.fields.has(d.field))return 'OUT_OF_SCOPE'
   if(d.code==='RAW_SECRET_EXCLUDED'&&d.field&&row.fields.has(d.field)&&security(d.field))return 'OUT_OF_SCOPE'
  },
 }
}
export const approvedSourceRetentionRule=(rule:string)=>rules.has(rule)
