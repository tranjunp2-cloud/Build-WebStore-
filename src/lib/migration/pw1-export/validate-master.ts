import type { UserActors } from './user-actors'
import type { Diagnostic, Doc, StoreOutput, Json, MigrationPolicy } from './contracts'
import { ROOTS } from './contracts'
/** Validates operational references only; raw PW1 fields keep source identities unchanged. */
const relationshipKeys = new Set([
  'tenant',
  'site',
  'customer',
  'parent',
  'createdBy',
  'author',
  'thumbnail',
  'subscription',
  'discount',
  'image',
  'category',
  'product',
  'order',
])
export function references(
  value: Json,
  path: string,
  visit: (ref: string, path: string) => void,
  key = '',
): void {
  if (typeof value === 'string') {
    if (relationshipKeys.has(key) && value.startsWith('@')) visit(value, path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => references(v, `${path}.${i}`, visit, key))
    return
  }
  if (value && typeof value === 'object') {
    if (
      value.type === 'upload' &&
      value.relationTo === 'media' &&
      typeof value.value === 'string'
    )
      visit(value.value, path + '.value')
    for (const [child, v] of Object.entries(value))
      if (!['_ref', 'pw1_source', 'menus', 'model_settings', 'raw_model_settings'].includes(child))
        references(v, `${path}.${child}`, visit, child)
  }
}
export function operationalIssues(stores: StoreOutput[], userActors?: UserActors, policy?: MigrationPolicy): Diagnostic[] {
  const issues: Diagnostic[] = [],
    all = new Map<string, string>(),
    unique = new Map<string, string>()
  const actorRefs = new Set(userActors?.actors.map(actor => actor._ref) ?? [])
  for (const store of stores) {
    const id = String((store.tenants[0]?.metaData as Doc)?.pw1StoreId ?? '')
    if (store.tenants.length !== 1 || store.sites.length !== 1)
      issues.push({
        code: 'STORE_CARDINALITY_INVALID',
        severity: 'blocker',
        storeId: id,
      })
    for (const root of ROOTS)
      for (const doc of store[root]) {
        if (root === 'products' && Array.isArray(doc.category) && doc.category.length === 0 && !policy?.activeCatalogOnly)
          issues.push({ code: 'PRODUCT_EMPTY_CATEGORY_POLICY_REQUIRED', severity: 'blocker', storeId: id, table: root, field: 'category' })
        if (root === 'orders' && Array.isArray(doc.items) && !policy?.preserveHistoricalOrders &&
            doc.items.some((item) => !item || typeof item !== 'object' || !(item as Doc).product))
          issues.push({ code: 'ORDER_ITEM_SNAPSHOT_POLICY_REQUIRED', severity: 'blocker', storeId: id, table: root, field: 'items.product' })
        const identity = String(doc._ref ?? '')
        if (!identity) {
          issues.push({
            code: 'MISSING_DOCUMENT_REF',
            severity: 'blocker',
            storeId: id,
            table: root,
          })
          continue
        }
        if (actorRefs.has(identity)) issues.push({ code: 'USER_ACTOR_DOCUMENT_COLLISION', severity: 'blocker', storeId: id, table: root })
        if (all.has(identity)) {
          issues.push({
            code: 'DUPLICATE_DOCUMENT_REF',
            severity: 'blocker',
            storeId: id,
            table: root,
          })
          issues.push({
            code: 'DUPLICATE_DOCUMENT_REF',
            severity: 'blocker',
            storeId: all.get(identity),
            table: root,
          })
        }
        all.set(identity, id)
        const fields =
          root === 'tenants'
            ? ['slug']
            : ['products', 'blogs', 'blog_categories'].includes(root)
              ? ['slug']
              : root === 'sites'
                ? ['domain']
                : root === 'users'
                ? ['email']
                : root === 'orders'
                  ? ['orderNumber']
                  : []
        for (const field of fields) {
          const raw = doc[field]
          if (typeof raw !== 'string') continue
          const key = JSON.stringify([
            root,
            field,
            ['products', 'blogs', 'blog_categories'].includes(root) ? id : null,
            raw.trim().toLowerCase(),
          ])
          const previous = unique.get(key)
          if (previous !== undefined) {
            issues.push({
              code:
                root === 'products'
                  ? 'PRODUCT_SLUG_COLLISION'
                  : 'GLOBAL_UNIQUE_COLLISION',
              severity: 'blocker',
              storeId: id,
              table: root,
              field,
            })
            issues.push({
              code:
                root === 'products'
                  ? 'PRODUCT_SLUG_COLLISION'
                  : 'GLOBAL_UNIQUE_COLLISION',
              severity: 'blocker',
              storeId: previous,
              table: root,
              field,
            })
          } else unique.set(key, id)
        }
        if (root === 'products')
          for (const sku of [
            doc.sku,
            ...((doc.variants as Doc[]) ?? []).map((v) => v.sku),
          ]) {
            if (typeof sku !== 'string' || !sku.trim()) continue
            const key = `sku:${id}:${sku}`
            if (unique.has(key))
              issues.push({
                code: 'SKU_COLLISION',
                severity: 'blocker',
                storeId: id,
                table: root,
              })
            else unique.set(key, id)
          }
      }
  }
  for (const store of stores) {
    const id = String((store.tenants[0]?.metaData as Doc)?.pw1StoreId ?? '')
    for (const root of ROOTS) {
      if (root === 'pages') {
        // Builder references have separate validation, but cannot borrow global creator identities.
        for (const doc of store[root]) references(doc, root, (reference, field) => {
          if (actorRefs.has(reference)) issues.push({ code: 'DANGLING_OPERATIONAL_REF', severity: 'blocker', storeId: id, table: root, field })
        })
        continue
      }
      for (const doc of store[root])
        references(doc, root, (reference, field) => {
          if (actorRefs.has(reference) && root === 'users' && field === 'users.createdBy') return
          const owner = all.get(reference)
          if (owner === undefined)
            issues.push({
              code: 'DANGLING_OPERATIONAL_REF',
              severity: 'blocker',
              storeId: id,
              table: root,
              field,
            })
          else if (owner !== id)
            issues.push({
              code: 'CROSS_STORE_OPERATIONAL_REF',
              severity: 'blocker',
              storeId: id,
              table: root,
              field,
            })
        })
    }
  }
  return issues
}
