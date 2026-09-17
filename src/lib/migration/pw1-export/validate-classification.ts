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
export function validateClassification(rows: readonly RowDisposition[], diagnostics: readonly Diagnostic[], policy?: MigrationPolicy) {
  const index = new Map<string, RowDisposition>()
  for (const row of rows) {
    const id = key(row.table, row.sourceId)
    if (index.has(id)) fail()
    index.set(id, row)
  }
  const failures = new Set(diagnostics.filter(d => d.code === 'SOURCE_OWNERSHIP_UNRESOLVED' && d.severity === 'blocker' && d.storeId === undefined)
    .map(d => JSON.stringify([d.table, d.sourceId, d.reason])))
  const shipping = new Set(diagnostics.filter(d => d.table === 'store_deliveries' && d.severity === 'warning' &&
    ['SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', 'SHIPPING_FIXED_FEE_MAPPED'].includes(d.code)).map(d => key(d.storeId ?? '', d.sourceId ?? '')))
  for (const row of rows) {
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
    } else if (owner.rule === 'SOURCE_STORE_ID') {
      if (hasParent || !owner.storeId || classificationRequiresParent(row.table)) fail()
      const store = index.get(key('stores', owner.storeId))
      if (!store || store.storeId !== owner.storeId || store.ownership?.rule !== 'SOURCE_STORE_ID') fail()
      if (row.table === 'stores' ? row.sourceId !== owner.storeId : !Object.hasOwn(row.fields, 'store_id')) fail()
    } else if (owner.rule === 'SOURCE_GLOBAL_SCOPE') {
      if (hasParent || owner.storeId !== null || row.table === 'stores' || classificationRequiresParent(row.table)) fail()
    } else fail()
    for (const [field, rule] of Object.entries(row.fieldRetentionRules ?? {})) {
      if (row.fields[field] !== 'retained-source' || SECRET_FIELDS.has(field) || !retentionRuleMatches(rule, row.table, field, owner)) fail()
      if (rule === 'MASTER-4.1-APPROVED-SHIPPING-SOURCE' &&
        (policy?.shippingPolicy !== 'pw2-defaults' || !shipping.has(key(row.storeId ?? '', row.sourceId)))) fail()
    }
  }
  // Iterative traversal keeps hostile chains from exhausting the JS call stack.
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
