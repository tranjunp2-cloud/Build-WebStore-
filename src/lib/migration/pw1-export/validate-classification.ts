import { EXCLUDED_DISCOUNT_RULE, excludedDiscountDiagnostic, PAGE_MENU_SCOPE_RULE, PAGE_MENU_SCOPE_CODE, PAGE_MENU_TABLES, ADDRESS_OVERFLOW_RULE, APPROVED_METADATA_RULE, MAPPED_ORDER_METADATA_RULE, TECHNICAL_SCOPE_RULE, TECHNICAL_SCOPE_CODE, TECHNICAL_TABLES, STORE_CODES_RULE } from './approved-source-scope'
import { MEDIA_METADATA_RULE } from './mappers/library-media'
import { MODEL_SETTINGS_RETAIN_RULE, MODEL_SETTINGS_RETAIN_CODE, RAW_MODEL_SETTINGS_RULE, MODEL_SETTINGS_PATHS, MODEL_SETTINGS_SCOPE_RULE, MODEL_SETTINGS_SCOPE_CODE, modelSettingsSecurityField } from './model-settings-scope'
import { validateSourceExclusions, sourceExclusionKey } from './source-exclusions'
import { createConflictRetention, CONFLICT_RETENTION_RULE } from './conflict-retention'
import { createProductExclusionIndex } from './product-exclusions'
import { EXTERNAL_SOURCE_RULE, externalSourcePath, externalSourceField } from './external-source'
import type { Diagnostic, MigrationPolicy } from './contracts'
import type { RowDisposition } from './source-dispositions'
import { classificationParentTables, classificationRequiresParent, retentionRuleMatches, type Ownership } from './source-classification'
import { SECRET_FIELDS } from './source-registry'
import { ExportError } from './primitives'

const failureRules = new Set(['OWNERSHIP_CYCLE', 'OWNERSHIP_MODEL_UNVERIFIED', 'OWNERSHIP_PARENT_UNVERIFIED', 'OWNERSHIP_STORE_CONFLICT', 'OWNERSHIP_STORE_MISSING'])
const polymorphic = new Set(['plan_subscriptions', 'model_has_roles', 'model_has_permissions', 'model_settings'])
const key = (table: string, id: string) => JSON.stringify([table, id])
function fail(): never { throw new ExportError('CLASSIFICATION_EVIDENCE_INVALID') }

/** Validate internal evidence consistency; does not re-read or authenticate source CSV values. */
export function validateClassification(rows: readonly RowDisposition[], diagnostics: readonly Diagnostic[], policy?: MigrationPolicy, products: { storeId: string; ref: string }[] = [], allowProductExclusions = true, emittedRefs: ReadonlySet<string> = new Set(products.map(p=>p.ref)), allowSourceExclusions = true, allowModelSettingsScope = true, allowSocialLibraryMedia = true, allowApprovedSourceScope = true, allowRawModelSettings = true, allowSourceSiteDomain = true) {
  const excludedDiscountCodes = new Set(diagnostics.filter(excludedDiscountDiagnostic).map(d => key(d.storeId!,d.sourceId!)))
  const discountChildren = new Map<string, RowDisposition[]>()
  for (const row of rows) if (row.table === 'promotion_codes' && row.ownership?.parentTable === 'promotions' && row.ownership.parentId) { const id = key(row.storeId ?? '',row.ownership.parentId); const children = discountChildren.get(id) ?? []; children.push(row); discountChildren.set(id,children) }
  const addressOverflow = new Set(diagnostics.filter(d => d.code === 'CUSTOMER_ADDRESS_OVERFLOW' && d.table === 'addresses' && d.severity === 'warning' && d.field === undefined && d.reason === undefined).map(d => key(d.storeId ?? '',d.sourceId ?? '')))
  const rawMarkers = new Set<string>()
  for (const d of diagnostics.filter(d => d.code === PAGE_MENU_SCOPE_CODE)) {
    if (!allowApprovedSourceScope || !PAGE_MENU_TABLES.has(d.table ?? '') || d.severity !== 'warning' || d.storeId !== undefined || d.sourceId !== undefined || d.field !== undefined || d.reason !== undefined) fail()
    rawMarkers.add(d.table!)
  }
  const technicalMarkers = new Set<string>()
  for (const d of diagnostics.filter(d => d.code === TECHNICAL_SCOPE_CODE)) {
    if (!allowApprovedSourceScope || !TECHNICAL_TABLES.has(d.table ?? '') || d.severity !== 'warning' || d.storeId !== undefined || d.sourceId !== undefined || d.field !== undefined || d.reason !== undefined) fail()
    technicalMarkers.add(d.table!)
  }
  const sourceOnlyMedia = new Map<string,string>()
  for (const diagnostic of diagnostics.filter(d => d.code === 'MEDIA_SOURCE_ONLY')) {
    if (!allowSocialLibraryMedia || diagnostic.table !== 'medias' || diagnostic.severity !== 'warning' || !diagnostic.storeId || !diagnostic.sourceId || diagnostic.field !== undefined || !['DELETED','FOLDER','EMPTY_URL'].includes(diagnostic.reason ?? '')) fail()
    const identity = key(diagnostic.table!, diagnostic.sourceId!)
    if (sourceOnlyMedia.has(identity) && sourceOnlyMedia.get(identity) !== diagnostic.storeId) fail()
    sourceOnlyMedia.set(identity, diagnostic.storeId!)
  }
  const settingsMarker = diagnostics.filter(d => d.code === MODEL_SETTINGS_RETAIN_CODE)
  if (settingsMarker.some(d => !allowRawModelSettings || d.table !== 'model_settings' || d.severity !== 'warning' || d.storeId !== undefined || d.sourceId !== undefined || d.field !== undefined || d.reason !== undefined) || settingsMarker.length > 1) fail()
  const hasModelSettingsScope = diagnostics.some(d => d.code === MODEL_SETTINGS_SCOPE_CODE && d.table === 'model_settings')
  for (const d of diagnostics.filter(d => d.code === MODEL_SETTINGS_SCOPE_CODE))
    if (allowRawModelSettings || !allowModelSettingsScope || d.table !== 'model_settings' || d.severity !== 'warning' || d.storeId !== undefined || d.sourceId !== undefined || d.field !== undefined || d.reason !== undefined) fail()
  const sourceExcluded = validateSourceExclusions(rows,diagnostics,policy,emittedRefs,allowSourceExclusions,fail)
  const conflicts = createConflictRetention(policy)
  diagnostics.forEach(d => conflicts.add(d))
  const exclusions = createProductExclusionIndex(fail, allowProductExclusions, policy)
  for (const product of products) exclusions.addProduct(product.storeId, product.ref)
  for (const d of diagnostics) exclusions.addDiagnostic(d)
  for (const row of rows) exclusions.addRow(row)
  exclusions.finish()
  const index = new Map<string, RowDisposition>()
  for (const row of rows) {
    const id = key(row.table, row.sourceId)
    if (index.has(id)) fail()
    index.set(id, row)
  }
  const failures = new Set(diagnostics.filter(d => d.code === 'SOURCE_OWNERSHIP_UNRESOLVED' && (d.severity === 'blocker' || (d.severity === 'warning' && (sourceExcluded.has(sourceExclusionKey(d.table ?? '',d.sourceId ?? '')) || (allowModelSettingsScope && d.table === 'model_settings') || (allowApprovedSourceScope && (TECHNICAL_TABLES.has(d.table ?? '') || PAGE_MENU_TABLES.has(d.table ?? '')))))) && d.storeId === undefined)
    .map(d => JSON.stringify([d.table, d.sourceId, d.reason])))
  const shipping = new Set(diagnostics.filter(d => d.table === 'store_deliveries' && d.severity === 'warning' &&
    ['SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', 'SHIPPING_FIXED_FEE_MAPPED'].includes(d.code)).map(d => key(d.storeId ?? '', d.sourceId ?? '')))
  const sourceDomainStores = new Set([...emittedRefs].filter(ref => ref.startsWith('@sites:stores:')).map(ref => ref.slice('@sites:stores:'.length)))
  const sourceDomainReceipts = new Set<string>()
  const sourceDomainFields = ['id', 'store_id', 'domain', 'is_default', 'deleted_at']
  for (const row of rows) {
    const rules = Object.values(row.fieldRetentionRules ?? {})
    for (const contribution of row.contributions.filter(c => c.rule === 'MASTER-4.1-SOURCE-SITE-DOMAIN')) {
      if (!allowSourceSiteDomain || row.table !== 'store_domains' || contribution.table !== row.table || contribution.sourceId !== row.sourceId || contribution.storeId !== row.storeId || !row.storeId || !sourceDomainStores.has(row.storeId) || sourceDomainReceipts.has(row.storeId) || contribution.targetPath !== 'sites[].domain' || !contribution.fields.includes('domain') || contribution.fields.length !== sourceDomainFields.filter(field => Object.hasOwn(row.fields, field)).length || new Set(contribution.fields).size !== contribution.fields.length || contribution.fields.some(field => !sourceDomainFields.includes(field) || row.fields[field] !== 'mapped')) fail()
      sourceDomainReceipts.add(row.storeId)
    }

    if (!allowApprovedSourceScope && row.contributions.some(c => c.rule === 'MASTER_RAW_PW1_CONTENT')) fail()
    if (!allowApprovedSourceScope && rules.some(rule => [EXCLUDED_DISCOUNT_RULE, PAGE_MENU_SCOPE_RULE, ADDRESS_OVERFLOW_RULE, APPROVED_METADATA_RULE, MAPPED_ORDER_METADATA_RULE, TECHNICAL_SCOPE_RULE, STORE_CODES_RULE].includes(rule))) fail()
    if (PAGE_MENU_TABLES.has(row.table) && allowApprovedSourceScope && (!rawMarkers.has(row.table) || (row.ownership?.rule.startsWith('OWNERSHIP_') && row.contributions.length))) fail()
    if (TECHNICAL_TABLES.has(row.table) && allowApprovedSourceScope) {
      if (!technicalMarkers.has(row.table) || row.disposition !== 'retained-source' || row.contributions.length || row.productExclusion || row.sourceExclusion || Object.entries(row.fields).some(([field,status]) => modelSettingsSecurityField(field) ? status !== 'security-excluded' || row.fieldRetentionRules?.[field] !== undefined : status !== 'retained-source' || row.fieldRetentionRules?.[field] !== TECHNICAL_SCOPE_RULE)) fail()
    }

    if (!allowSocialLibraryMedia && rules.some(rule => [MEDIA_METADATA_RULE, 'MASTER-4-SOCIAL-SOURCE-METADATA'].includes(rule))) fail()
    if (row.table === 'medias' && !sourceOnlyMedia.has(key(row.table,row.sourceId)) && Object.entries(row.fieldRetentionRules ?? {}).some(([field,rule]) => rule === MEDIA_METADATA_RULE && !['id','store_id','signature','type','parent_id','created_by','deleted_at'].includes(field))) fail()
    if (sourceOnlyMedia.has(key(row.table,row.sourceId))) {
      if (row.table !== 'medias' || row.disposition !== 'retained-source' || row.contributions.length || !row.storeId || emittedRefs.has(`@media:medias:${row.sourceId}`) || Object.entries(row.fields).some(([field,status]) => status !== 'security-excluded' && (status !== 'retained-source' || row.fieldRetentionRules?.[field] !== MEDIA_METADATA_RULE)) || sourceOnlyMedia.get(key(row.table,row.sourceId)) !== row.storeId) fail()
      sourceOnlyMedia.delete(key(row.table,row.sourceId))
    }
    const scopeRules = Object.values(row.fieldRetentionRules ?? {}).includes(MODEL_SETTINGS_SCOPE_RULE)
    if (scopeRules && (!allowModelSettingsScope || row.table !== 'model_settings')) fail()
    if (allowModelSettingsScope && !allowRawModelSettings && row.table === 'model_settings') {
      if (row.contributions.length || row.productExclusion || row.sourceExclusion || row.disposition !== 'retained-source' ||
        Object.entries(row.fields).some(([field, status]) => modelSettingsSecurityField(field) ? status !== 'security-excluded' || row.fieldRetentionRules?.[field] !== undefined : status !== 'retained-source' || row.fieldRetentionRules?.[field] !== MODEL_SETTINGS_SCOPE_RULE)) fail()
      if (!hasModelSettingsScope) fail()
    }
    if (row.table === 'model_settings' && allowRawModelSettings) {
      if (settingsMarker.length !== 1 || scopeRules || row.productExclusion || row.sourceExclusion) fail()
      if (row.contributions.length) {
        if (row.disposition !== 'mapped' || row.contributions.length !== 1 || !row.storeId) fail()
        const contribution = row.contributions[0]
        if (contribution.rule !== RAW_MODEL_SETTINGS_RULE || contribution.table !== row.table || contribution.sourceId !== row.sourceId || !MODEL_SETTINGS_PATHS.has(contribution.targetPath)) fail()
        if (Object.entries(row.fields).some(([field,status]) => modelSettingsSecurityField(field) ? status !== 'security-excluded' || contribution.fields.includes(field) : status !== 'mapped' || !contribution.fields.includes(field))) fail()
      } else if (row.disposition !== 'retained-source' || (row.storeId && emittedRefs.has(`@tenants:stores:${row.storeId}`)) || Object.entries(row.fields).some(([field,status]) => modelSettingsSecurityField(field) ? status !== 'security-excluded' : status !== 'retained-source' || row.fieldRetentionRules?.[field] !== MODEL_SETTINGS_RETAIN_RULE)) fail()
    }
    if (!allowRawModelSettings && (rules.includes(MODEL_SETTINGS_RETAIN_RULE) || row.contributions.some(c => c.rule === RAW_MODEL_SETTINGS_RULE))) fail()
    const owner = row.ownership
    if (!owner || owner.storeId !== row.storeId) fail()
    const allowedParents = classificationParentTables(row.table)
    const hasParent = owner.parentTable !== undefined || owner.parentId !== undefined
    const parent = owner.parentTable && owner.parentId ? index.get(key(owner.parentTable, owner.parentId)) : undefined
    const parentFailed = !parent?.ownership || failureRules.has(parent.ownership.rule)
    if (hasParent && (!owner.parentTable || !allowedParents.includes(owner.parentTable) || owner.parentId === '')) fail()
    if (failureRules.has(owner.rule)) {
      if (owner.storeId !== null || !failures.has(JSON.stringify([row.table, row.sourceId, owner.rule]))) fail()
      if (owner.rule === 'OWNERSHIP_PARENT_UNVERIFIED') {
        if (!owner.parentTable || (parent && !parentFailed)) fail()
      } else if (owner.rule === 'OWNERSHIP_STORE_CONFLICT') {
        if (!parent || parentFailed) fail()
      } else {
        if (hasParent) fail()
        if (owner.rule === 'OWNERSHIP_MODEL_UNVERIFIED' && !polymorphic.has(row.table)) fail()
        if (owner.rule === 'OWNERSHIP_STORE_MISSING' && row.table !== 'stores' && !Object.hasOwn(row.fields, 'store_id')) fail()
      }
    } else if (owner.rule === 'SOURCE_PARENT_RELATION') {
      if (!parent || parentFailed || parent.storeId !== owner.storeId) fail()
    } else if (owner.rule === 'SOURCE_SETTING_STORE_ID') {
      if (!allowRawModelSettings || row.table !== 'model_settings' || hasParent || !owner.storeId || !Object.hasOwn(row.fields, 'store_id')) fail()
      const store = index.get(key('stores', owner.storeId))
      if (!store || store.storeId !== owner.storeId || store.ownership?.rule !== 'SOURCE_STORE_ID') fail()
    } else if (owner.rule === 'SOURCE_STORE_ID') {
      if (hasParent || !owner.storeId || classificationRequiresParent(row.table)) fail()
      const store = index.get(key('stores', owner.storeId))
      if (!store || store.storeId !== owner.storeId || store.ownership?.rule !== 'SOURCE_STORE_ID') fail()
      if (row.table === 'stores' ? row.sourceId !== owner.storeId : !Object.hasOwn(row.fields, 'store_id')) fail()
    } else if (owner.rule === 'SOURCE_GLOBAL_SCOPE') {
      if (hasParent || owner.storeId !== null || row.table === 'stores' || classificationRequiresParent(row.table)) fail()
    } else fail()
    for (const contribution of row.contributions.filter(c => c.rule === EXTERNAL_SOURCE_RULE)) {
      if (contribution.table !== row.table || contribution.sourceId !== row.sourceId || contribution.targetPath !== externalSourcePath(row.table) || contribution.fields.some(field => !externalSourceField(row.table, field))) fail()
    }
    for (const [field, rule] of Object.entries(row.fieldRetentionRules ?? {})) {
      if (row.fields[field] !== 'retained-source' || SECRET_FIELDS.has(field) || !retentionRuleMatches(rule, row.table, field, owner)) fail()
      if (rule === EXCLUDED_DISCOUNT_RULE) {
        const codes = row.table === 'promotion_codes' ? [row] : discountChildren.get(key(row.storeId ?? '',row.sourceId)) ?? []
        if (!policy?.skipInvalidDiscountCodes || row.contributions.length || !codes.length || codes.some(code => !excludedDiscountCodes.has(key(code.storeId ?? '',code.sourceId)) || emittedRefs.has(`@discounts:promotion_codes:${code.sourceId}`) || code.contributions.length)) fail()
      }
      if (rule === ADDRESS_OVERFLOW_RULE && (!policy?.allowCustomerAddressOverflow || !addressOverflow.has(key(row.storeId ?? '',row.sourceId)))) fail()
      if (rule === MAPPED_ORDER_METADATA_RULE) {
        const order = row.table === 'orders' ? row : parent
        if (!order || order.table !== 'orders' || order.storeId !== row.storeId || !emittedRefs.has(`@orders:orders:${order.sourceId}`) || !order.contributions.some(c => c.table === 'orders' && c.sourceId === order.sourceId && c.rule === 'master-7.2' && c.targetPath === `@orders:orders:${order.sourceId}`)) fail()
      }
      if (rule === CONFLICT_RETENTION_RULE && !conflicts.allows(row.table, row.sourceId, field, owner)) fail()
      if (rule === EXTERNAL_SOURCE_RULE && !row.contributions.some(c => c.rule === rule && c.fields.includes(field) && c.targetPath === externalSourcePath(row.table))) fail()
      if (rule === 'MASTER-4.1-APPROVED-SHIPPING-SOURCE' &&
        (policy?.shippingPolicy !== 'pw2-defaults' || (!allowApprovedSourceScope && !shipping.has(key(row.storeId ?? '', row.sourceId))))) fail()
    }
  }
  // Iterative traversal keeps hostile chains from exhausting the JS call stack.
  if (allowSourceSiteDomain && [...sourceDomainStores].some(storeId => !sourceDomainReceipts.has(storeId))) fail()
  if (sourceOnlyMedia.size) fail()
  const complete = new Set<RowDisposition>()
  for (const row of rows) {
    const path = new Set<RowDisposition>()
    let current: RowDisposition | undefined = row
    while (current && !complete.has(current)) {
      if (path.has(current)) fail()
      path.add(current)
      const owner: Ownership = current.ownership!
      current = owner.parentTable && owner.parentId ? index.get(key(owner.parentTable, owner.parentId)) : undefined
    }
    for (const visited of path) complete.add(visited)
  }
}
