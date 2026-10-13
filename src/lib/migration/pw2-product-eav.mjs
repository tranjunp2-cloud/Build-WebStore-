import crypto from 'node:crypto'
import { deriveVariantBaseSku } from './pw2-product-migration.mjs'

const present = (v) => v !== '' && v !== null && v !== undefined
const live = (r) => !present(r.deleted_at)
const missingNumber = (v) => !present(v) || (typeof v === 'string' && v.trim() === '')
const number = (v) => missingNumber(v) ? undefined : Number(v)
const id = (v) => String(v ?? '')
// PW1 has no tier/option position column. Compare numeric IDs without float loss.
const compareId = (a, b) => {
  const x = id(a), y = id(b)
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return BigInt(x) < BigInt(y) ? -1 : BigInt(x) > BigInt(y) ? 1 : 0
  return x < y ? -1 : x > y ? 1 : 0
}
const label = (row) => String(row?.name || row?.name_ms || '').trim()
const childId = (token, skuId) => {
  const hex = crypto.createHash('sha256').update(JSON.stringify([token, 'product_skus', skuId])).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Build catalog fields from PW1 EAV, keeping source identity outside collection JSON. */
export function buildProductCatalogFromSource(product, tables, sourceInstanceToken, options = {}) {
  const productId = id(product.id), storeId = id(product.store_id)
  const productRef = `@products:products:${productId}`
  const syntheticSku = deriveVariantBaseSku(productRef, sourceInstanceToken)
  const errors = []
  const excludedSkus = [], warnings = []
  const fail = (code, message, reason) => errors.push({ code, path: 'sourceEav', message, ...(reason ? { reason } : {}) })
  if (!live(product)) fail('SOURCE_PRODUCT_DELETED', 'Source Product is deleted')
  const ownedSkus = (tables.product_skus ?? []).filter((r) => id(r.product_id) === productId)
  if (ownedSkus.some((r) => live(r) && id(r.store_id) !== storeId)) {
    fail('SOURCE_SKU_OWNER_MISMATCH', 'SKU belongs to another Store')
  }
  const allowInactive = Boolean(options.allowInactiveSkusForInactiveProduct && id(product.status) === '0')
  const skus = ownedSkus.filter((r) => live(r) && id(r.store_id) === storeId && (id(r.status) === '1' || (allowInactive && id(r.status) === '0')))
    .sort((a, b) => compareId(a.id, b.id))
  if (ownedSkus.some((r) => live(r) && !['0', '1'].includes(id(r.status)))) {
    fail('SOURCE_SKU_STATUS_INVALID', 'Unknown source SKU status')
  }
  if (!skus.length) {
    const liveOwned = ownedSkus.filter((r) => live(r) && id(r.store_id) === storeId)
    const reason = !ownedSkus.length ? 'NO_SKU_ROWS'
      : !liveOwned.length ? 'NO_LIVE_OWNED_SKU'
      : liveOwned.every((r) => id(r.status) === '0') ? 'ALL_LIVE_OWNED_SKUS_INACTIVE'
      : 'LIVE_OWNED_SKU_STATUS_INVALID'
    fail('SOURCE_NO_ELIGIBLE_SKU', 'No current price source: PW1 stores simple-product prices in product_skus; a SKU code is not required by PW2', reason)
  }
  const skuIds = new Set(skus.map((r) => id(r.id)))
  const domain = (tables.product_attributes ?? []).filter((r) => live(r) && id(r.product_id) === productId)
  const selections = (tables.product_variants ?? []).filter((r) => live(r) && skuIds.has(id(r.product_sku_id)))
  const hasVariants = options.treatSingleSkuWithoutSelectionsAsSimple && skus.length === 1 && selections.length === 0
    ? false
    : !(skus.length === 1 && domain.length === 0 && selections.length === 0)
  const attributes = new Map((tables.attributes ?? []).map((r) => [id(r.id), r]))
  const values = new Map((tables.attribute_values ?? []).map((r) => [id(r.id), r]))
  const tiers = new Map()
  const identities = []
  if (hasVariants) {
    for (const row of domain) {
      const aid = id(row.attribute_id), vid = id(row.attribute_value_id)
      const attr = attributes.get(aid), value = values.get(vid)
      if (!attr || !value || !live(attr) || !live(value) || id(attr.store_id) !== storeId
        || id(value.store_id) !== storeId || id(value.attribute_id) !== aid) {
        fail('SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH', `Invalid option domain row ${row.id}`)
        continue
      }
      const tier = tiers.get(aid) ?? { attribute: attr, options: new Map() }
      if (tier.options.has(vid)) fail('SOURCE_DUPLICATE_OPTION_DOMAIN', `Duplicate option domain ${aid}/${vid}`)
      tier.options.set(vid, value)
      tiers.set(aid, tier)
    }
    // SKU selections are an independent PW1 relationship. Recover only definitions
    // actually selected by eligible SKUs, never infer options from SKU names/codes.
    for (const row of selections) {
      const aid = id(row.attribute_id), vid = id(row.attribute_value_id)
      const attr = attributes.get(aid), value = values.get(vid)
      if (!attr || !value || !live(attr) || !live(value) || id(attr.store_id) !== storeId
        || id(value.store_id) !== storeId || id(value.attribute_id) !== aid) {
        fail('SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH', `Invalid SKU selection definition ${row.id}`)
        continue
      }
      const tier = tiers.get(aid) ?? { attribute: attr, options: new Map() }
      tier.options.set(vid, value)
      tiers.set(aid, tier)
    }
    if (options.pruneUnreferencedTiers && selections.length > 0) {
      const referencedAttributeIds = new Set(selections.map((r) => id(r.attribute_id)))
      for (const aid of [...tiers.keys()]) {
        if (!referencedAttributeIds.has(aid)) {
          tiers.delete(aid)
        }
      }
    }
  }
  const orderedTiers = [...tiers].sort(([a], [b]) => compareId(a, b))
  const variantConfigs = hasVariants
    ? orderedTiers.map(([aid, tier], ti) => {
        const options = [...tier.options].sort(([a], [b]) => compareId(a, b))
        identities.push({
          attributeId: aid, attributeCode: tier.attribute.code ?? null,
          targetPath: `variantConfigs.${ti}`,
          options: options.map(([vid], oi) => ({ attributeValueId: vid, targetPath: `variantConfigs.${ti}.options.${oi}.value` })),
        })
        return { name: label(tier.attribute), options: options.map(([, value]) => ({ value: label(value) })) }
      })
    : []
  if (hasVariants && skus.length && !orderedTiers.length) fail('SOURCE_VARIANT_DOMAIN_MISSING', 'Variant Product has no valid option domain')
  const tuples = new Map()
  const skuCrosswalk = []
  const variants = []
  if (hasVariants && orderedTiers.length) {
    for (const sku of skus) {
      const errorStart = errors.length
      const selected = selections.filter((r) => id(r.product_sku_id) === id(sku.id))
      const tuple = [], names = []
      if (selected.length !== orderedTiers.length) fail('SOURCE_SELECTED_TIER_COUNT', `SKU ${sku.id} must select exactly one value per tier`)
      for (const [aid, tier] of orderedTiers) {
        const rows = selected.filter((r) => id(r.attribute_id) === aid)
        if (rows.length !== 1 || !tier.options.has(id(rows[0]?.attribute_value_id))) {
          const reason = rows.length === 0 ? 'MISSING_SELECTION'
            : rows.length > 1 ? 'DUPLICATE_SELECTION'
            : 'OUT_OF_DOMAIN'
          fail('SOURCE_SELECTED_OPTION_INVALID', `SKU ${sku.id} has missing/duplicate/out-of-domain selection for tier ${aid}`, reason)
          continue
        }
        const vid = id(rows[0].attribute_value_id)
        tuple.push([aid, vid])
        names.push(label(tier.options.get(vid)))
      }
      if (options.pruneInvalidVariantSkus && errors.length > errorStart) {
        excludedSkus.push({ sourceSkuId: id(sku.id), reasons: errors.splice(errorStart).map(error => error.reason ?? error.code) })
        continue
      }
      const key = JSON.stringify(tuple)
      // An incomplete tuple is not evidence of a duplicate: report the missing
      // selections instead of conflating all empty/partial tuples.
      const isComplete = selected.length === orderedTiers.length && tuple.length === orderedTiers.length
      if (isComplete && tuples.has(key)) {
        if (options.resolveDuplicateVariantTuples) {
          const primary = tuples.get(key)
          warnings.push({ code: 'DUPLICATE_VARIANT_TUPLE_RESOLVED', sourceSkuId: id(sku.id), canonicalSourceSkuId: primary.sourceSkuId })
          skuCrosswalk.push({
            sourceSkuId: id(sku.id),
            targetPath: primary.targetPath,
            targetId: primary.targetId,
            selectedTuple: tuple,
          })
          continue
        }
        fail('SOURCE_DUPLICATE_VARIANT_TUPLE', `Duplicate selected tuple for SKU ${sku.id}`)
      }
      const uuid = childId(sourceInstanceToken, id(sku.id))
      const variantIndex = variants.length
      const targetPath = `variants.${variantIndex}`
      if (isComplete && !tuples.has(key)) {
        tuples.set(key, { targetId: uuid, targetPath, sourceSkuId: id(sku.id) })
      }
      skuCrosswalk.push({ sourceSkuId: id(sku.id), targetPath, targetId: uuid, selectedTuple: tuple })
      variants.push({ id: uuid, name: names.join(' - '), sku: sku.sku, price: number(sku.price), stock: number(sku.stock) })
    }
  }
  if (!options.allowSparseVariants && hasVariants && orderedTiers.length && skus.length !== orderedTiers.reduce((n, [, t]) => n * t.options.size, 1)) {
    fail('SOURCE_SPARSE_VARIANT_MATRIX', 'Eligible SKU matrix differs from full option domain; no missing SKU is synthesized')
  }
  if (excludedSkus.length && !variants.length) fail('SOURCE_NO_VALID_VARIANT', 'Every SKU has invalid selections')
  const prices = hasVariants ? variants.map(r => r.price) : skus.map((r) => number(r.price))
  const stocks = hasVariants ? variants.map(r => r.stock) : skus.map((r) => number(r.stock))
  for (const sku of skus) {
    const price = number(sku.price), stock = number(sku.stock)
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) fail('SOURCE_SKU_PRICE_INVALID', `Invalid base price on SKU ${sku.id}`, missingNumber(sku.price) ? 'MISSING_PRICE' : undefined)
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) fail('SOURCE_SKU_STOCK_INVALID', `Invalid stock on SKU ${sku.id}`, missingNumber(sku.stock) ? 'MISSING_STOCK' : undefined)
  }
  const fields = {
    hasVariants, variantConfigs, variants,
    sku: hasVariants ? syntheticSku : skus[0]?.sku,
    price: prices.length && prices.every(Number.isFinite) ? Math.min(...prices) : undefined,
    inventory: stocks.length && stocks.every(Number.isFinite) ? stocks.reduce((a, b) => a + b, 0) : undefined,
  }
  return { fields, errors, identities, skuCrosswalk, excludedSkus, warnings, sourceInstanceToken, eligibleSkuCount: skus.length }
}
