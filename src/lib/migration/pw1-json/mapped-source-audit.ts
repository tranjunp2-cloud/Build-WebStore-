import { externalArchiveKeys, archiveKey } from './export-outcome'
import { EXTERNAL_SOURCE_RULE, externalSourcePath } from './external-source'
import type { ClassificationRow } from './classification'
import { MigrationError } from './errors'
import type { ImportDiagnostic, ImportStore } from './types'

const key = (...parts: string[]) => JSON.stringify(parts)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
// Reviewed fields retained in the source archive, not emitted into the PW2 master.
const archiveFields: Record<string, ReadonlySet<string>> = Object.fromEntries(Object.entries({
  addresses: ['full_address', 'phone', 'comment', 'created_at', 'updated_at'],
  order_details: ['sku', 'price_with_tax', 'total_price', 'total_price_with_tax', 'item_price', 'total_item_price', 'image', 'signature', 'created_by', 'created_at', 'updated_at'],
  orders: ['invoice_date', 'delivery_date', 'total_discount_tax', 'total_shipping_tax', 'prepaid', 'balance', 'billing_address_id', 'refund_status', 'refund_message', 'cancel_note', 'created_by'],
  product_images: ['signature', 'created_by'],
  product_skus: ['cost', 'created_by', 'created_at', 'updated_at'],
  // Master mapping §18.3.6/8: EAV row audit metadata stays in source CSV.
  product_attributes: ['created_by', 'created_at', 'updated_at'],
  product_variants: ['created_by', 'created_at', 'updated_at'],
}).map(([table, fields]) => [table, new Set(fields)]))

export function createMappedSourceAudit(defaultShipping: boolean) {
  const external = new Set<string>()
  const selected = new Set<string>(), disabledPayments = new Set<string>()
  const rows = new Set<string>(), inactiveProviders = new Set<string>(), archivedContent = new Set<string>(), emitted = new Set<string>()
  const totals = new Map<string, { total: number; outside: number }>()
  let bytes = 0
  const retain = (set: Set<string>, identity: string) => {
    if (set.has(identity)) return
    bytes += 96 + identity.length * 2
    if (bytes > 64 * 1024 * 1024) throw new MigrationError('MAPPED_SOURCE_AUDIT_MEMORY_LIMIT')
    set.add(identity)
  }
  return {
    addStore(store: ImportStore): void {
      selected.add(store.storeId)
      for (const document of [...store.collections.blogs, ...store.collections.products]) if (typeof document._ref === 'string') {
        const match = /^@[^:]+:([^:]+):(.+)$/.exec(document._ref)
        if (match) retain(emitted, key(store.storeId, match[1], match[2]))
      }
      const tenant = store.collections.tenants[0], site = store.collections.sites[0]
      const payments = tenant?.payments, config = site?.paymentConfig
      if (object(payments) && object(config) &&
        ['payment_card', 'payment_fpx', 'payment_qr'].every(field => payments[field] === false) &&
        ['cardEnabled', 'fpxEnabled', 'enableQrBanking'].every(field => config[field] === false)) disabledPayments.add(store.storeId)
    },
    addRow(row: ClassificationRow): void {
      for (const sourceKey of externalArchiveKeys(row, selected)) retain(external, sourceKey)
      if (!row.storeId || !selected.has(row.storeId)) return
      const identity = key(row.storeId, row.table, row.sourceId)
      if (['blog_posts', 'products'].includes(row.table) && !emitted.has(identity) && row.contributions.length > 0 && row.contributions.every(contribution => (contribution.targetPath.startsWith('sites.pw1_source.') || (contribution.rule === EXTERNAL_SOURCE_RULE && contribution.targetPath === externalSourcePath(row.table))))) retain(archivedContent, identity)
      const fields = Object.entries(row.fields).filter(([, disposition]) => disposition === 'unresolved').map(([field]) => field)
      const mapped = new Set(row.contributions.filter(contribution => contribution.rule !== EXTERNAL_SOURCE_RULE).flatMap(contribution => contribution.fields))
      const providerInactive = row.table === 'store_payments' && disabledPayments.has(row.storeId) && row.contributions.length === 0
      if (providerInactive) retain(inactiveProviders, identity)
      if (!fields.length && !['unresolved', 'partial'].includes(row.disposition)) return
      const totalKey = key(row.storeId, row.table)
      const count = totals.get(totalKey) ?? { total: 0, outside: 0 }
      count.total++; totals.set(totalKey, count)
      if (row.ownership.rule.startsWith('OWNERSHIP_')) return
      const eavRule = row.table === 'product_attributes' ? 'master-16-eav-domain' : row.table === 'product_variants' ? 'master-16-eav-tuple' : undefined
      const eavMapped = !eavRule || row.contributions.some(contribution => {
        const target = /^@products:products:([0-9]+)\.(variantConfigs|variants)(?:\.|$)/.exec(contribution.targetPath)
        return contribution.rule === eavRule && contribution.table === row.table && contribution.sourceId === row.sourceId &&
          (!contribution.storeId || contribution.storeId === row.storeId) && target !== null &&
          target[2] === (row.table === 'product_attributes' ? 'variantConfigs' : 'variants') && emitted.has(key(row.storeId!, 'products', target[1]))
      })
      const archived = fields.length > 0 && row.contributions.length > 0 && eavMapped &&
        fields.every(field => archiveFields[row.table]?.has(field) && !mapped.has(field))
      const defaultDelivery = row.table === 'store_deliveries' && defaultShipping && row.contributions.length === 0
      if (archived || defaultDelivery || providerInactive) { retain(rows, identity); count.outside++ }
    },
    disposition(d: ImportDiagnostic): 'OUT_OF_SCOPE' | undefined {
      if (d.storeId && d.table && d.sourceId && ['RAW_VALUE_UNVERIFIED', 'RAW_FIELD_UNVERIFIED'].includes(d.code) && external.has(archiveKey(d.storeId, d.table, d.sourceId))) return 'OUT_OF_SCOPE'
      if (d.storeId && ['blog_posts', 'products'].includes(d.table ?? '') && d.sourceId && d.code === 'RAW_VALUE_UNVERIFIED' && d.severity === 'blocker' && d.reason === 'UNSAFE_URL' && (d.table === 'products' ? ['description', 'description_ms'] : ['content', 'content_ms']).includes(d.field ?? '') && archivedContent.has(key(d.storeId, d.table!, d.sourceId))) return 'OUT_OF_SCOPE'
      if (!d.storeId || !d.table || d.severity !== 'blocker' || d.field !== undefined || d.reason !== undefined) return undefined
      if (d.code === 'PAYMENT_PROVIDER_NOT_ACTIVATED' && d.sourceId && inactiveProviders.has(key(d.storeId, d.table, d.sourceId))) return 'OUT_OF_SCOPE'
      if (!['SOURCE_FIELDS_UNRESOLVED', 'REPORT_ROW_UNRESOLVED'].includes(d.code)) return undefined
      if (d.sourceId) return rows.has(key(d.storeId, d.table, d.sourceId)) ? 'OUT_OF_SCOPE' : undefined
      const count = totals.get(key(d.storeId, d.table))
      return count && count.total > 0 && count.total === count.outside ? 'OUT_OF_SCOPE' : undefined
    },
  }
}
