import type { Diagnostic, Row, StoreOutput } from './contracts'
import { compareIds } from './primitives'
import { EXPORT_VERSION, MASTER_SHA256 } from './master-version'

// Explicitly selected business fields only. Never include full source rows or Users credentials.
const fields: Record<string, string[]> = {
  addresses: ['country_id', 'province_id', 'district_id', 'ward_id'],
  stores: ['status', 'deleted_at'],
  store_payments: ['payment_method_id', 'status', 'deleted_at'],
  users: ['status', 'deleted_at', 'is_store_owner', 'created_at'],
  store_domains: ['domain', 'is_default', 'is_main'],
  categories: ['slug', 'name', 'parent_id', 'status'],
  blog_categories: ['slug', 'parent_id', 'status'],
  blog_posts: ['slug', 'blog_category_id', 'created_by', 'status'],
  products: ['slug', 'category_id', 'status'],
  product_skus: ['product_id', 'sku', 'price', 'stock', 'status'],
  orders: ['total', 'sub_total', 'total_discount', 'total_shipping', 'status', 'purchase_status', 'refund_status', 'refund_type', 'shipping_address_id', 'promotion_code'],
  promotion_codes: ['code', 'promotion_id'],
  plan_subscriptions: ['starts_at', 'ends_at', 'canceled_at', 'canceled_immediately'],
}
const collections: Record<string, keyof StoreOutput> = {
  stores: 'tenants', users: 'users', categories: 'categories', products: 'products',
  blog_categories: 'blog_categories', blog_posts: 'blogs', orders: 'orders', promotion_codes: 'discounts',
}
const relevant = /USER_EMAIL_INVALID|VARIANT|SKU|CONFLICT|COLLISION|DUPLICATE|RESOLVED|FALLBACK|PRUNED|QUARANTINED|OWNER_|DOMAIN_|REFUND_|ORDER_STATUS|ORDER_MAPPING|SOURCE_SELECTED|SOURCE_NO_ELIGIBLE|EXCLUDED|SOURCE_NO_VALID_VARIANT|SUBSCRIPTION_FUTURE|GEOGRAPHY|ADDRESS_INVALID/
const pick = (row: Row | undefined, keys: string[]) => Object.fromEntries(keys.filter(key => row && row[key] !== undefined).map(key => [key, row![key]]))

type ProductEvidence = { storeId: string; sourceProductId: string; skus: { sourceSkuId: string; targetId: string | null; targetPath: string | null }[]; excludedSkus?: { sourceSkuId: string }[] }

export function conflictDetails(tables: Readonly<Record<string, Row[]>>, stores: StoreOutput[], diagnostics: Diagnostic[], snapshot?: { sourceInstance: string; snapshotId: string; asOf: string }, productReceipts: readonly ProductEvidence[] = []) {
  const skuEvidence = new Map<string, { sourceProductId: string; canonicalSourceSkuId: string | null; targetVariantId: string | null; targetPath: string | null; sourceSkuIds: string[]; excluded: boolean }>()
  for (const receipt of productReceipts) {
    const groups = new Map<string, string[]>()
    for (const sku of receipt.skus) if (sku.targetId) groups.set(sku.targetId, [...(groups.get(sku.targetId) ?? []), sku.sourceSkuId])
    for (const sku of receipt.skus) {
      const ids = [...(sku.targetId ? groups.get(sku.targetId) ?? [] : [sku.sourceSkuId])].sort(compareIds)
      skuEvidence.set(JSON.stringify([receipt.storeId, sku.sourceSkuId]), { sourceProductId: receipt.sourceProductId, canonicalSourceSkuId: sku.targetId ? ids[0] : null, targetVariantId: sku.targetId, targetPath: sku.targetPath, sourceSkuIds: ids, excluded: false })
    }
    for (const sku of receipt.excludedSkus ?? []) skuEvidence.set(JSON.stringify([receipt.storeId, sku.sourceSkuId]), { sourceProductId: receipt.sourceProductId, canonicalSourceSkuId: null, targetVariantId: null, targetPath: null, sourceSkuIds: [sku.sourceSkuId], excluded: true })
  }
  const indexes = new Map<string, Map<string, Row>>()
  const duplicates = new Map<string, string[]>()
  const owners = new Map<string, string[]>()
  const domainIds = new Map<string, string[]>()
  const skuRows = new Map<string, Row[]>()
  const promotions = new Map((tables.promotions ?? []).map(row => [row.id, row]))
  const scope = (table: string, row: Row) => table === 'promotion_codes' ? promotions.get(row.promotion_id)?.store_id : row.store_id
  const ownerRoles = new Set((tables.roles ?? []).filter(row => row.name === 'owner' && row.guard_name === 'api' && !row.deleted_at).map(row => row.id))
  const ownerIds = new Set((tables.model_has_roles ?? []).filter(row => row.model_type === 'App\\Models\\User' && ownerRoles.has(row.role_id)).map(row => row.model_id))
  for (const [table, rows] of Object.entries(tables)) {
    if (!(table in fields)) continue
    indexes.set(table, new Map(rows.map(row => [row.id ?? '', row])))
    for (const row of rows) {
      if (table === 'store_domains') {
        const list = domainIds.get(row.store_id ?? '') ?? []
        list.push(row.id ?? '')
        domainIds.set(row.store_id ?? '', list)
      }
      if (table === 'product_skus') {
        const key = JSON.stringify([row.store_id, row.product_id])
        skuRows.set(key, [...(skuRows.get(key) ?? []), row])
      }
      if (table === 'users' && (row.is_store_owner === '1' || ownerIds.has(row.id))) {
        const list = owners.get(row.store_id ?? '') ?? []
        list.push(row.id ?? '')
        owners.set(row.store_id ?? '', list)
      }
      const field = table === 'product_skus' ? 'sku' : table === 'promotion_codes' ? 'code' : 'slug'
      if (!row[field]?.trim()) continue
      const key = JSON.stringify([table, scope(table, row), row[field]!.trim().toLowerCase()])
      const list = duplicates.get(key) ?? []
      list.push(row.id ?? '')
      duplicates.set(key, list)
    }
  }
  const targets = new Map<string, Record<string, unknown>>()
  for (const store of stores) for (const docs of Object.values(store)) for (const doc of docs) targets.set(String(doc._ref), doc)
  const entries = diagnostics.filter(d => d.table && fields[d.table] && relevant.test(d.code)).map(d => {
    const table = d.table!, source = indexes.get(table)?.get(d.sourceId ?? '')
    const sourceField = table === 'product_skus' ? 'sku' : table === 'promotion_codes' ? 'code' : 'slug'
    const key = JSON.stringify([table, source ? scope(table, source) : undefined, source?.[sourceField]?.trim().toLowerCase()])
    const skuMapping = table === 'product_skus' ? skuEvidence.get(JSON.stringify([d.storeId, d.sourceId])) : undefined
    const domainAggregate = table === 'stores' && ['DEFAULT_DOMAIN_AMBIGUOUS', 'SOURCE_MAIN_DOMAIN_AMBIGUOUS'].includes(d.code)
    const ownerCandidates = ['OWNER_IDENTITY_RESOLVED', 'OWNER_SECONDARY_MAPPED_EDITOR'].includes(d.code) ? (tables.users ?? []).filter(row => row.store_id === d.storeId && !row.deleted_at && row.is_frontend === '0').map(row => row.id ?? '') : undefined
    const relatedIds = (domainAggregate ? domainIds.get(d.storeId ?? '') ?? [] : undefined) ?? ownerCandidates ?? (skuMapping ? skuMapping.sourceSkuIds : ['OWNER_IDENTITY_CONFLICT', 'USER_EMAIL_INVALID'].includes(d.code) ? owners.get(d.storeId ?? '') ?? [] : table === 'store_domains' && !source ? domainIds.get(d.storeId ?? '') ?? [] : duplicates.get(key) ?? [])
    const relatedTable = domainAggregate ? 'store_domains' : ['OWNER_IDENTITY_CONFLICT', 'USER_EMAIL_INVALID'].includes(d.code) ? 'users' : table
    const relatedSources = [...relatedIds].sort(compareIds).map(id => ({ id, ...pick(indexes.get(relatedTable)?.get(id), fields[relatedTable]) }))
    const targetRef = skuMapping && !skuMapping.excluded ? `@products:products:${skuMapping.sourceProductId}` : collections[table] && source ? `@${collections[table]}:${table}:${source.id}` : undefined
    const target = targetRef ? targets.get(targetRef) : undefined
    const after = target ? Object.fromEntries(['slug', 'sku', 'status', 'paymentStatus', 'discountCode', 'author', 'category', ...(table === 'users' ? ['roles', 'tenants'] : [])].filter(k => target[k] !== undefined).map(k => [k, target[k]])) : {}
    const productSkus = table === 'products' && /SKU|VARIANT|SELECTED/.test(d.code) ? skuRows.get(JSON.stringify([d.storeId, d.sourceId])) ?? [] : []
    return {
      ...(d.code === 'PRODUCT_CATALOG_POLICY_EXCLUDED' && d.reason === 'DUPLICATE_PRODUCT_SLUG' ? { canonicalProductId: relatedIds.filter(id => !indexes.get('products')?.get(id)?.deleted_at).sort(compareIds)[0] ?? null } : {}),
      ...(skuMapping ? { skuMapping } : {}),
      ...(productSkus.length ? { sourceSkus: productSkus.map(row => ({ id: row.id, ...pick(row, fields.product_skus) })), targetSkus: target ? { sku: target.sku, price: target.price, inventory: target.inventory, variants: target.variants } : null } : {}),
      storeId: d.storeId ?? null, table, sourceId: d.sourceId ?? null, code: d.code,
      severity: d.severity, reason: d.reason ?? null,
      source: { ...pick(source, fields[table]), ...(d.code === 'USER_EMAIL_INVALID' && table === 'users' && source ? { email: source.email } : {}) },
      relatedSourceIds: [...relatedIds].sort(compareIds), relatedTable, relatedSources,
      targetRef: target ? targetRef : null, target: after,
      disposition: skuMapping?.excluded ? 'excluded-from-product' : d.severity === 'blocker' ? 'requires-reconciliation' : target ? 'mapped-with-warning' : 'see-reconciliation-receipt',
    }
  })
  return { version: 1, exporterVersion: EXPORT_VERSION, contractSha256: MASTER_SHA256, ...(snapshot ? { snapshot: { sourceInstance: snapshot.sourceInstance, snapshotId: snapshot.snapshotId, asOf: snapshot.asOf } } : {}), note: 'Source groups include archived/inactive records for comparison; group membership alone does not mean every record was exported or rejected. No credentials or source content bodies included.', entries }
}

export function conflictDetailsMarkdown(report: ReturnType<typeof conflictDetails>): string {
  const cell = (value: unknown) => JSON.stringify(value).replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('`', '&#96;')
  return '# Chi tiết conflict migration\n\n' + `Exporter: ${report.exporterVersion}; contract: ${report.contractSha256}. Snapshot: ${cell(report.snapshot ?? null)}.\n\n` + 'Mỗi dòng là một diagnostic; nhiều dòng có thể cùng một record. IDs liên quan gồm cả nguồn inactive/đã lưu trữ để đối chiếu, không khẳng định tất cả cùng bị loại. `targetRef = null` không tự có nghĩa record đã mất: xem receipt và mã lỗi. Nội dung và thông tin đăng nhập không được đưa vào báo cáo.\n\n' +
    '| Store | Bảng / ID | Lỗi / lý do | Nguồn | IDs liên quan | Đích | Xử lý |\n|---|---|---|---|---|---|---|\n' +
    report.entries.map(e => `| ${cell(e.storeId)} | ${cell([e.table, e.sourceId])} | ${cell([e.code, e.reason])} | ${cell({ ...e.source, ...('sourceSkus' in e ? { skus: e.sourceSkus } : {}) })} | ${cell({ table: e.relatedTable, records: e.relatedSources })} | ${cell({ ref: e.targetRef, ...e.target, ...('targetSkus' in e ? { skus: e.targetSkus } : {}), ...('skuMapping' in e ? { skuMapping: e.skuMapping } : {}), ...('canonicalProductId' in e ? { canonicalProductId: e.canonicalProductId } : {}) })} | ${e.disposition} |`).join('\n') + '\n'
}
