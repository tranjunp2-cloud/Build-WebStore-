import { buildProductCatalogFromSource } from './pw2-product-eav.mjs'

const id = (v) => String(v ?? '')
const present = (v) => v !== '' && v !== null && v !== undefined
const sourceId = (ref) => id(ref).split(':').at(-1)

/** Exact major-unit to minor-unit conversion; never round an unrepresentable source amount. */
export function sourceDiscountMinorUnits(value, currency) {
  if (!['MYR', 'USD', 'SGD'].includes(currency)) throw new Error('Unsupported discount currency')
  if (!['string', 'number'].includes(typeof value)) throw new Error('Missing or invalid source discount')
  const text = String(value).trim()
  if (text.length > 100) throw new Error('Source discount exceeds supported range')
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) throw new Error('Invalid source discount')
  const fraction = (match[2] ?? '').replace(/0+$/, '')
  if (fraction.length > 2) throw new Error('Source discount contains sub-minor-unit precision')
  const minor = BigInt(match[1]) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Source discount exceeds safe integer range')
  return Number(minor)
}

export function sourceTimestamps(row, utcOffset) {
  if (!/^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/.test(utcOffset ?? '')) throw new Error('Explicit source UTC offset required')
  return Object.fromEntries([['created_at', 'createdAt'], ['updated_at', 'updatedAt']].map(([from, to]) => {
    const value = row?.[from]
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value ?? '')) throw new Error(`Invalid source ${from}`)
    const iso = new Date(`${value.replace(' ', 'T')}${utcOffset}`)
    if (!Number.isFinite(iso.getTime())) throw new Error(`Invalid source ${from}`)
    const local = value.replace(' ', 'T').slice(0, 19)
    const check = new Date(`${local}Z`)
    if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 19) !== local) throw new Error(`Invalid source ${from}`)
    return [to, iso.toISOString()]
  }))
}

/** Research-artifact repair only. Never reprice history or synthesize missing SKUs. */
export function reconcileCommerce(store, storeId, tables, { sourceInstanceToken, utcOffset }) {
  const output = structuredClone(store)
  const diagnostics = { quarantinedOrders: [], paymentGaps: [], orderItemCrosswalk: [] }
  const owned = (r) => id(r?.store_id) === id(storeId)
  const products = new Map((tables.products ?? []).map(r => [id(r.id), r]))
  const skus = new Map((tables.product_skus ?? []).map(r => [id(r.id), r]))
  const orders = new Map((tables.orders ?? []).map(r => [id(r.id), r]))
  const methods = new Map((tables.payment_methods ?? []).map(r => [id(r.id), r]))
  const catalogs = new Map()
  for (const product of output.products) {
    const source = products.get(sourceId(product._ref))
    if (!source || !owned(source)) throw new Error(`Product ownership mismatch: ${product._ref}`)
    Object.assign(product, sourceTimestamps(source, utcOffset))
    catalogs.set(product._ref, buildProductCatalogFromSource(source, tables, sourceInstanceToken))
  }
  const targets = new Map(output.products.map(p => [p._ref, p]))
  output.orders = output.orders.filter(order => {
    const source = orders.get(sourceId(order._ref))
    const reasons = []
    const crosswalk = []
    if (!source || !owned(source)) throw new Error(`Order ownership mismatch: ${order._ref}`)
    Object.assign(order, sourceTimestamps(source, utcOffset))
    try {
      // Always convert source, never multiply an already repaired payload.
      order.discountAmount = sourceDiscountMinorUnits(source.total_discount, order.currency)
    } catch (error) {
      reasons.push({ code: 'ORDER_DISCOUNT_INVALID', field: 'total_discount', message: error.message })
    }
    const method = methods.get(id(source.payment_method_id))
    if (method?.code === 'cod') order.paymentMethod = 'cod'
    else {
      // Gateway identity alone is not proof of card/FPX/bank payment method.
      delete order.paymentMethod
      diagnostics.paymentGaps.push({ orderRef: order._ref, sourcePaymentMethodId: id(source.payment_method_id), sourceCode: method?.code ?? null, code: method?.code === 'stripe' ? 'PAYMENT_METHOD_UNVERIFIED' : 'PAYMENT_PROVIDER_AND_METHOD_UNMAPPED' })
    }
    if (method?.code === 'stripe') order.paymentProvider = 'stripe'
    else delete order.paymentProvider
    const details = (tables.order_details ?? []).filter(r => id(r.order_id) === id(source.id) && !present(r.deleted_at))
    const used = new Set()
    for (const [index, item] of (order.items ?? []).entries()) {
      const target = targets.get(item.product)
      // Match a complete historical line fingerprint, never CSV position or labels alone.
      const candidates = details.filter(r => !used.has(id(r.id))
        && id(skus.get(id(r.product_sku_id))?.product_id) === sourceId(item.product)
        && id(r.name).trim() === id(item.productName).trim()
        && present(r.quantity) && Number(r.quantity) === item.quantity
        && present(r.price) && Number(r.price) === item.unitPrice
        && (id(r.variant) === id(item.variant) || (target?.hasVariants && (() => {
          const c = catalogs.get(item.product)?.skuCrosswalk.find(v => v.sourceSkuId === id(r.product_sku_id))
          return c && target.variants?.some(v => v.id === c.targetId && v.name === item.variant)
        })())))
      if (candidates.length !== 1) { reasons.push({ code: 'ORDER_DETAIL_IDENTITY_AMBIGUOUS', itemIndex: index }); continue }
      const detail = candidates[0]
      used.add(id(detail.id))
      const sku = skus.get(id(detail.product_sku_id))
      if (!target || !owned(sku) || !owned(products.get(id(sku?.product_id)))) {
        reasons.push({ code: 'ORDER_PRODUCT_OR_SKU_UNRESOLVED', itemIndex: index, sourceDetailId: detail.id }); continue
      }
      const catalog = catalogs.get(item.product)
      const mapping = catalog?.skuCrosswalk.find(v => v.sourceSkuId === id(sku.id))
      const variant = mapping && target.variants?.find(v => v.id === mapping.targetId)
      if (catalog?.errors.length || (target.hasVariants
        ? !variant || target.variants.filter(v => v.name === variant.name).length !== 1
        : catalog?.fields.hasVariants || catalog?.eligibleSkuCount !== 1 || present(sku.deleted_at) || id(sku.status) !== '1' || present(detail.variant))) {
        reasons.push({ code: 'ORDER_SKU_NOT_EMITTED', itemIndex: index, sourceDetailId: detail.id, sourceSkuId: sku.id }); continue
      }
      if (target.hasVariants) item.variant = variant.name
      else delete item.variant
      crosswalk.push({ orderRef: order._ref, itemIndex: index, sourceDetailId: id(detail.id), sourceSkuId: id(sku.id), productRef: item.product, variantId: variant?.id ?? null, variantName: variant?.name ?? null, sourceVariant: detail.variant ?? null })
    }
    if (used.size !== details.length || !order.items?.length) reasons.push({ code: 'ORDER_DETAIL_COVERAGE_MISMATCH' })
    if (reasons.length) {
      diagnostics.quarantinedOrders.push({ storeId: id(storeId), sourceRef: order._ref, status: 'quarantine', reasonCode: 'ORDER_COMMERCE_RECONCILIATION_FAILED', reasons })
      return false
    }
    diagnostics.orderItemCrosswalk.push(...crosswalk)
    return true
  })
  return { store: output, diagnostics }
}
