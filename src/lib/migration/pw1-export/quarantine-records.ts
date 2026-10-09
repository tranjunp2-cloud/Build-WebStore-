import { ROOTS, type Diagnostic, type StoreOutput, type Doc, type MigrationPolicy } from './contracts'
import { references } from './validate-master'

/** Keep valid Store identity while quarantining conflicting Products and their dependents. */
export function quarantineProductCollisions(
  stores: StoreOutput[],
  diagnostics: Diagnostic[],
  policy?: MigrationPolicy,
): void {
  const bySlug = new Map<string, Doc[]>()
  for (const store of stores)
    for (const product of store.products) {
      if (typeof product.slug !== 'string') continue
      const storeId = String((store.tenants[0].metaData as Doc).pw1StoreId)
      const key = JSON.stringify([storeId, product.slug.trim().toLowerCase()])
      const group = bySlug.get(key) ?? []
      group.push(product)
      bySlug.set(key, group)
    }
  const rejected = new Set<string>()
  for (const group of bySlug.values())
    if (group.length > 1)
      for (const product of group) rejected.add(String(product._ref))
  const collisionRefs = new Set(rejected)
  let changed = true
  while (changed) {
    changed = false
    for (const store of stores) {
      const storeId = String((store.tenants[0].metaData as Doc).pw1StoreId)
      for (const root of ROOTS) {
        // Identity failures still go through Store-level validation; raw pages retain source refs.
        if (['tenants', 'sites', 'users', 'pages'].includes(root)) continue
        store[root] = store[root].filter((doc) => {
          const identity = String(doc._ref)
          if (root === 'orders' && policy?.preserveHistoricalOrders && Array.isArray(doc.items)) {
            for (const item of doc.items as Doc[]) {
              if (typeof item.product !== 'string' || !collisionRefs.has(item.product)) continue
              delete item.product
              diagnostics.push({
                code: 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', severity: 'warning',
                storeId, table: 'orders', sourceId: identity.split(':').slice(2).join(':'),
                field: 'items.product', reason: 'PRODUCT_SLUG_COLLISION',
              })
            }
          }
          let dependency = false
          references(doc, root, (ref) => {
            if (rejected.has(ref)) dependency = true
          })
          if (!rejected.has(identity) && !dependency) return true
          rejected.add(identity)
          diagnostics.push({
            code: collisionRefs.has(identity)
              ? 'PRODUCT_SLUG_COLLISION'
              : 'DEPENDENCY_RECORD_QUARANTINED',
            severity: 'blocker',
            storeId,
            table: root,
            sourceId: identity.split(':').slice(2).join(':'),
            ...(collisionRefs.has(identity) ? { field: 'slug' } : {}),
          })
          changed = true
          return false
        })
      }
    }
  }
  // Keep valid source records. An offline export cannot establish that the target DB
  // has deployed the new tenant indexes, so cross-tenant reuse remains a readiness gate.
  for (const root of ['products', 'blogs', 'blog_categories'] as const) {
    const targetSlugs = new Map<string, { storeId: string; document: Doc }[]>()
    for (const store of stores) {
      const storeId = String((store.tenants[0].metaData as Doc).pw1StoreId)
      for (const document of store[root]) {
        if (typeof document.slug !== 'string') continue
        const key = document.slug.trim().toLowerCase()
        const group = targetSlugs.get(key) ?? []
        group.push({ storeId, document })
        targetSlugs.set(key, group)
      }
    }
    for (const group of targetSlugs.values()) {
      if (new Set(group.map((entry) => entry.storeId)).size < 2) continue
      for (const { storeId, document } of group)
        diagnostics.push({
          code: root === 'products' ? 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP' : 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED',
          severity: 'blocker', storeId, table: root, field: 'slug',
          sourceId: String(document._ref).split(':').slice(2).join(':'),
        })
    }
  }
}
