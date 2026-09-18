import { createHash } from 'node:crypto'
import { sourceDiscountMinorUnits } from '../../pw2-commerce-reconciliation.mjs'
import { reconcileCustomers } from '../../pw2-customer-reconciliation.mjs'
import { sourceCatalog } from './catalog-source'
import {
  live,
  ref,
  type Doc,
  type MappingContext,
  type Row,
} from '../contracts'
import { timestamp, numberValue } from '../primitives'

const present = (value: string | null | undefined) =>
  value !== null && value !== undefined && value.trim() !== ''
const dates = (row: Row, ctx: MappingContext) => ({
  createdAt: timestamp(row.created_at, ctx.config),
  updatedAt: timestamp(row.updated_at, ctx.config),
})
const fields = (row: Row, names: string[]) =>
  names.filter((name) => name in row)
const childId = (token: string, id: string) => {
  const hex = createHash('sha256')
    .update(JSON.stringify([token, 'order_details', id]))
    .digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Historical line values belong to the order, independently of the current catalog. */
export function historicalOrderItem(
  ctx: MappingContext,
  detail: Row,
  currency: string,
): Doc {
  if (!detail.id || !detail.name?.trim() ||
      (detail.store_id && detail.store_id !== ctx.storeId))
    throw new Error('ORDER_DETAIL_INVALID')
  const sku = ctx.find('product_skus', detail.product_sku_id)
  const sourceProduct = ctx.find('products', sku?.product_id)
  // Existing links must still prove tenant ownership, even when soft-deleted.
  if ((sku && sku.store_id !== ctx.storeId) ||
      (sourceProduct && sourceProduct.store_id !== ctx.storeId))
    throw new Error('ORDER_ITEM_SOURCE_OWNERSHIP_MISMATCH')
  const quantity = numberValue(detail.quantity)
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error('ORDER_QUANTITY_INVALID')
  const product = sourceProduct && ctx.output.products.find(
    (doc) => doc._ref === ref('products', 'products', sourceProduct.id ?? ''),
  )
  const item: Doc = {
    id: childId(ctx.config.sourceInstanceToken, detail.id),
    productName: detail.name,
    quantity,
    unitPrice: sourceDiscountMinorUnits(detail.price, currency) / 100,
  }
  if (product) item.product = product._ref
  else ctx.issue(
    'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', 'order_details', detail.id,
    'product_sku_id', 'warning',
  )
  if (present(detail.variant)) item.variant = detail.variant
  return item
}

export function orderState(
  row: Row,
  provider: string,
): { status: string; paymentStatus: string } {
  const statuses: Record<string, string> = {
    '1': 'pending',
    '2': 'pending',
    '3': 'ready_to_ship',
    '4': 'shipped',
    '5': 'completed',
    '6': 'cancelled',
    '8': 'payment_failed',
  }
  const payments: Record<string, string> = {
    '1': 'paid',
    '2': 'awaiting_payment',
    '3': 'failed',
    '4': 'payment_failed',
  }
  const status = statuses[row.status ?? '']
  if (
    !status ||
    (row.status === '8' && !['3', '4'].includes(row.purchase_status ?? ''))
  )
    throw new Error('ORDER_STATUS_UNVERIFIED')
  // Source can mark failed refunds as success. A final flag alone is insufficient evidence.
  if (row.refund_status === '1')
    throw new Error('ORDER_REFUND_EVIDENCE_REQUIRED')
  if (
    present(row.refund_status) &&
    !['2', '3', '4'].includes(row.refund_status ?? '')
  )
    throw new Error('ORDER_REFUND_STATUS_INVALID')
  const paymentStatus =
    payments[row.purchase_status ?? ''] ??
    (!present(row.purchase_status) &&
    provider === 'cod' &&
    !present(row.refund_status)
      ? 'unpaid'
      : undefined)
  if (!paymentStatus) throw new Error('ORDER_PAYMENT_UNVERIFIED')
  return { status, paymentStatus }
}

function shippingAddress(ctx: MappingContext, source: Row): Doc {
  const row = ctx.find('addresses', source.shipping_address_id)
  if (
    !row ||
    !live(row) ||
    row.store_id !== ctx.storeId ||
    !row.address?.trim()
  )
    throw new Error('ORDER_ADDRESS_INVALID')
  const country = ctx.find('countries', row.country_id)
  const province = ctx.find('provinces', row.province_id)
  const district = ctx.find('districts', row.district_id)
  const ward = ctx.find('wards', row.ward_id)
  if (
    !country?.name ||
    (present(row.province_id) &&
      (!province?.name || province.country_id !== country.id)) ||
    (present(row.district_id) &&
      (!district?.name || district.province_id !== province?.id)) ||
    (present(row.ward_id) && (!ward?.name || ward.district_id !== district?.id))
  )
    throw new Error('ORDER_ADDRESS_GEOGRAPHY')
  const result: Doc = { line1: row.address, country: country.name }
  const city = row.city?.trim() || district?.name
  if (city) result.city = city
  const line2 = [
    ...new Set(
      [ward?.name, district?.name].filter((item) => item && item !== city),
    ),
  ].join(', ')
  if (line2) result.line2 = line2
  if (province?.name) result.state = province.name
  if (row.post_code) result.postcode = row.post_code
  ctx.contribute(
    'addresses',
    row,
    fields(row, [
      'id',
      'store_id',
      'address',
      'city',
      'country_id',
      'province_id',
      'district_id',
      'ward_id',
      'post_code',
    ]),
    ref('orders', 'orders', source.id ?? '') + '.shippingAddress',
    'master-7.2-address',
  )
  return result
}

export function mapCommerce(ctx: MappingContext): void {
  const tenant = ref('tenants', 'stores', ctx.storeId),
    site = String(ctx.output.sites[0]?._ref ?? '')
  const customerRefs = new Map<string, string>()
  try {
    for (const row of [
      ...ctx.rows('customers').filter(live),
      ...ctx.rows('orders').filter(live),
    ])
      dates(row, ctx)
    const candidates = ctx
      .rows('customers')
      .filter(live)
      .map((row) => ({
        _ref: ref('customers', 'customers', row.id ?? ''),
        tenant,
      }))
    const reconciled = reconcileCustomers(
      { ...ctx.output, customers: candidates, orders: [] },
      ctx.storeId,
      ctx.tables,
      { utcOffset: ctx.config.utcOffset },
    )
    ctx.captureCustomerReconciliation?.(reconciled.diagnostics)
    ctx.output.customers = reconciled.store.customers
    for (const entry of reconciled.diagnostics.customerCrosswalk) {
      if (!entry.targetRef) continue
      customerRefs.set(entry.sourceCustomerId, entry.targetRef)
      const row = ctx.find('customers', entry.sourceCustomerId)
      if (row)
        ctx.contribute(
          'customers',
          row,
          fields(row, [
            'id',
            'store_id',
            'name',
            'email',
            'phone',
            'note',
            'rank_id',
            'created_at',
            'updated_at',
          ]),
          entry.targetRef,
          'master-6-canonical-customer',
        )
    }
    for (const entry of reconciled.diagnostics.addressDispositions)
      if (['invalid-source-address', 'overflow'].includes(entry.disposition))
        ctx.issue(
          'CUSTOMER_ADDRESS_' +
            entry.disposition.toUpperCase().replaceAll('-', '_'),
          'addresses',
          entry.sourceAddressId,
        )
    for (const entry of reconciled.diagnostics.rankDispositions)
      if (entry.disposition === 'unmapped-rank')
        ctx.issue(
          'CUSTOMER_RANK_UNMAPPED',
          'customers',
          entry.sourceCustomerId,
          'rank_id',
        )
  } catch {
    ctx.issue('CUSTOMER_COHORT_INVALID', 'customers')
    ctx.output.customers = []
  }

  mapDiscounts(ctx, tenant, site)
  for (const row of ctx.rows('orders').filter(live)) {
    try {
      if (!row.id || !row.code?.trim() || !row.customer_name?.trim())
        throw new Error('ORDER_REQUIRED')
      const currency = ctx.find('currencies', row.currency_id)?.code ?? ''
      const minor = (raw: string | null | undefined) =>
        sourceDiscountMinorUnits(raw, currency)
      const method = ctx.find('payment_methods', row.payment_method_id)
      const state = orderState(row, method?.code ?? '')
      const details = (ctx.tables.order_details ?? []).filter(
        (detail) => detail.order_id === row.id && live(detail),
      )
      if (!details.length) throw new Error('ORDER_DETAILS_MISSING')
      let sum = BigInt(0)
      const items: Doc[] = details.map((detail) => {
        if (
          !detail.id ||
          !detail.name?.trim() ||
          (detail.store_id && detail.store_id !== ctx.storeId)
        )
          throw new Error('ORDER_DETAIL_INVALID')
        if (ctx.config.migrationPolicy?.preserveHistoricalOrders) {
          const item = historicalOrderItem(ctx, detail, currency)
          sum += BigInt(numberValue(detail.quantity)) * BigInt(minor(detail.price))
          ctx.contribute(
            'order_details', detail,
            fields(detail, ['id', 'order_id', 'product_sku_id', 'name', 'quantity', 'price', 'variant']),
            ref('orders', 'orders', row.id!) + '.items.' + item.id,
            'master-7.2-historical-detail-snapshot',
          )
          return item
        }
        const sku = ctx.find('product_skus', detail.product_sku_id)
        const sourceProduct = ctx.find('products', sku?.product_id)
        const product = ctx.output.products.find(
          (doc) =>
            doc._ref === ref('products', 'products', sku?.product_id ?? ''),
        )
        if (
          !sku ||
          !live(sku) ||
          sku.status !== '1' ||
          sku.store_id !== ctx.storeId ||
          !sourceProduct ||
          sourceProduct.store_id !== ctx.storeId ||
          !product
        )
          throw new Error('ORDER_SKU_UNRESOLVED')
        const quantity = numberValue(detail.quantity)
        if (!Number.isSafeInteger(quantity) || quantity < 1)
          throw new Error('ORDER_QUANTITY_INVALID')
        const unitMinor = minor(detail.price)
        sum += BigInt(quantity) * BigInt(unitMinor)
        const catalog = sourceCatalog(ctx, sourceProduct)
        const item: Doc = {
          id: childId(ctx.config.sourceInstanceToken, detail.id),
          product: product._ref,
          productName: detail.name,
          quantity,
          unitPrice: unitMinor / 100,
        }
        if (product.hasVariants) {
          const crosswalk = catalog.skuCrosswalk.find(
            (entry) => entry.sourceSkuId === sku.id,
          )
          const variant = (product.variants as Doc[]).find(
            (entry) => entry.id === crosswalk?.targetId,
          )
          if (!variant || catalog.errors.length)
            throw new Error('ORDER_VARIANT_UNRESOLVED')
          item.variant = variant.name
        } else if (present(detail.variant) || catalog.eligibleSkuCount !== 1)
          throw new Error('ORDER_SIMPLE_SKU_INVALID')
        ctx.contribute(
          'order_details',
          detail,
          fields(detail, [
            'id',
            'order_id',
            'product_sku_id',
            'name',
            'quantity',
            'price',
            'variant',
          ]),
          ref('orders', 'orders', row.id!) + '.items.' + item.id,
          'master-7.2-detail-identity',
        )
        return item
      })
      const subtotal = minor(row.sub_total),
        shipping = minor(row.total_shipping),
        discount = minor(row.total_discount),
        tax = minor(present(row.total_tax) ? row.total_tax : '0'),
        total = minor(row.total)
      const expected = BigInt(subtotal) + BigInt(shipping) - BigInt(discount)
      if (
        sum !== BigInt(subtotal) ||
        BigInt(total) !== (expected < BigInt(0) ? BigInt(0) : expected) ||
        tax !== 0
      )
        throw new Error('ORDER_TOTAL_RECONCILIATION')
      const customer = present(row.customer_id)
        ? customerRefs.get(row.customer_id!)
        : null
      if (present(row.customer_id) && !customer)
        throw new Error('ORDER_CUSTOMER_UNRESOLVED')
      const doc: Doc = {
        _ref: ref('orders', 'orders', row.id),
        tenant,
        site,
        orderNumber: row.code,
        customer: customer ?? null,
        customerName: row.customer_name,
        items,
        currency,
        subtotal: subtotal / 100,
        shippingFee: shipping / 100,
        discountAmount: discount,
        tax: tax / 100,
        total: total / 100,
        ...state,
        ...dates(row, ctx),
        shippingAddress: shippingAddress(ctx, row),
        locale: 'en',
        verificationSource: 'manual',
      }
      if (row.customer_email) doc.customerEmail = row.customer_email
      if (row.customer_phone) doc.customerPhone = row.customer_phone
      if (method?.code === 'cod') doc.paymentMethod = 'cod'
      else
        ctx.issue(
          'ORDER_PAYMENT_METHOD_UNVERIFIED',
          'orders',
          row.id,
          'payment_method_id',
          'warning',
        )
      if (method?.code === 'stripe') doc.paymentProvider = 'stripe'
      if (row.tracking_code) doc.trackingNumber = row.tracking_code
      const weight = /^(\d+)(?:\.(\d+))?$/.exec(row.total_weight ?? '')
      if (!weight || (weight[2] ?? '').replace(/0+$/, '').length > 3)
        throw new Error('ORDER_WEIGHT_INVALID')
      const grams =
        BigInt(weight[1]) * BigInt(1000) +
        BigInt((weight[2] ?? '').replace(/0+$/, '').padEnd(3, '0'))
      if (grams > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error('ORDER_WEIGHT_INVALID')
      doc.parcelWeight = Number(grams)
      const courier = ctx.find('delivery_providers', row.delivery_provider_id)
      if (courier?.name) doc.shippingCourierName = courier.name
      if (row.comment || row.note)
        doc.notes = [
          row.comment ? 'Comment: ' + row.comment : '',
          row.note ? 'Note: ' + row.note : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      if (row.promotion_code) {
        doc.discountCode = row.promotion_code
        if (
          !ctx.tables.orders ||
          !ctx.tables.promotions ||
          !ctx.tables.promotion_codes
        )
          ctx.issue('DISCOUNT_HISTORY_SOURCE_UNVERIFIED', 'promotion_codes')
        const codes = (ctx.tables.promotion_codes ?? []).filter(
          (code) =>
            code.code === row.promotion_code &&
            ctx.find('promotions', code.promotion_id)?.store_id === ctx.storeId,
        )
        const target =
          codes.length === 1
            ? ctx.output.discounts.find(
                (discount) =>
                  discount._ref ===
                  ref('discounts', 'promotion_codes', codes[0].id ?? ''),
              )
            : undefined
        if (target) doc.discount = target._ref
        else
          ctx.issue(
            'ORDER_DISCOUNT_REFERENCE_UNVERIFIED',
            'orders',
            row.id,
            'promotion_code',
            'warning',
          )
      }
      ctx.output.orders.push(doc)
      ctx.contribute(
        'orders',
        row,
        fields(row, [
          'id',
          'store_id',
          'code',
          'customer_id',
          'customer_name',
          'customer_email',
          'customer_phone',
          'currency_id',
          'sub_total',
          'total_shipping',
          'total_discount',
          'total_tax',
          'total',
          'status',
          'purchase_status',
          'payment_method_id',
          'created_at',
          'updated_at',
          'shipping_address_id',
          'total_weight',
          'tracking_code',
          'delivery_provider_id',
          'comment',
          'note',
          'promotion_code',
        ]),
        String(doc._ref),
        'master-7.2',
      )
    } catch (error) {
      ctx.issue(
        error instanceof Error && /^ORDER_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'ORDER_MAPPING_INVALID',
        'orders',
        row.id,
      )
    }
  }
  // History eligibility is not inferred from final order state or source counters.
  if (
    !ctx.tables.orders ||
    !ctx.tables.promotions ||
    !ctx.tables.promotion_codes
  )
    ctx.issue('DISCOUNT_HISTORY_SOURCE_UNVERIFIED', 'promotion_codes')
  const codes = (ctx.tables.promotion_codes ?? []).filter(
    (code) =>
      ctx.find('promotions', code.promotion_id)?.store_id === ctx.storeId,
  )
  const codedOrders = ctx
    .rows('orders', true)
    .filter((row) => present(row.promotion_code))
  const counters = codes.some(
    (code) =>
      present(code.used) &&
      (!/^\d+$/.test(code.used!) || BigInt(code.used!) > BigInt(0)),
  )
  if (codedOrders.length || counters)
    ctx.issue('DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED', 'orders')
}

function mapDiscounts(ctx: MappingContext, tenant: string, site: string): void {
  for (const row of ctx.tables.promotion_codes ?? []) {
    const promotion = ctx.find('promotions', row.promotion_id)
    if (promotion?.store_id !== ctx.storeId || !live(row) || !live(promotion))
      continue
    try {
      if (!row.id || !row.code?.trim()) throw new Error('DISCOUNT_REQUIRED')
      if (!['0', '1', '2'].includes(promotion.status ?? '')) {
        ctx.issue('DISCOUNT_STATUS_UNVERIFIED', 'promotions', promotion.id, 'status')
        continue
      }
      // PW2 has no expired enum: retain a verified expiry and keep the code disabled.
      if (promotion.status === '2' && (!promotion.end_date ||
        Date.parse(timestamp(promotion.end_date, ctx.config)) > Date.parse(ctx.config.asOf))) {
        ctx.issue('DISCOUNT_EXPIRY_UNVERIFIED', 'promotions', promotion.id, 'status')
        continue
      }
      const currency =
        ctx.find('currencies', ctx.find('stores', ctx.storeId)?.currency_id)
          ?.code ?? ''
      if (!['1', '2'].includes(promotion.discount_type_id ?? ''))
        throw new Error('DISCOUNT_TYPE')
      const type = promotion.discount_type_id === '1' ? 'percentage' : 'fixed'
      if (type === 'fixed' && currency !== 'MYR')
        throw new Error('DISCOUNT_CURRENCY')
      const amount =
        type === 'percentage'
          ? numberValue(promotion.discount_value)
          : sourceDiscountMinorUnits(promotion.discount_value, currency)
      if (amount < 0 || (type === 'percentage' && amount > 100))
        throw new Error('DISCOUNT_VALUE')
      if (present(row.used) && !/^\d+$/.test(row.used!))
        throw new Error('DISCOUNT_USED')
      const code = row.code.trim().toUpperCase()
      if (!/^[A-Z0-9_-]+$/.test(code)) throw new Error('DISCOUNT_CODE')
      const parentDates = dates(promotion, ctx),
        codeDates = dates(row, ctx)
      const doc: Doc = {
        _ref: ref('discounts', 'promotion_codes', row.id),
        tenant,
        site,
        code,
        type,
        value: amount,
        status: promotion.status === '1' ? 'active' : 'inactive',
        usageCount: 0,
        ...codeDates,
        updatedAt:
          parentDates.updatedAt > codeDates.updatedAt
            ? parentDates.updatedAt
            : codeDates.updatedAt,
      }
      if (promotion.description || promotion.name)
        doc.description = promotion.description || promotion.name
      if (promotion.start_date)
        doc.startsAt = timestamp(promotion.start_date, ctx.config)
      if (promotion.end_date)
        doc.expiresAt = timestamp(promotion.end_date, ctx.config)
      if (promotion.is_limit === '1') {
        const limit = numberValue(promotion.limit)
        if (!Number.isSafeInteger(limit) || limit < 1)
          throw new Error('DISCOUNT_LIMIT')
        doc.usageLimit = limit
      }
      ctx.output.discounts.push(doc)
      ctx.contribute(
        'promotion_codes',
        row,
        fields(row, [
          'id',
          'promotion_id',
          'code',
          'is_limit',
          'limit',
          'created_at',
          'updated_at',
        ]),
        String(doc._ref),
        'master-7.1',
      )
      ctx.contribute(
        'promotions',
        promotion,
        fields(promotion, [
          'id',
          'store_id',
          'status',
          'discount_type_id',
          'discount_value',
          'name',
          'description',
          'start_date',
          'end_date',
          'is_limit',
          'limit',
          'created_at',
          'updated_at',
        ]),
        String(doc._ref),
        'master-7.1',
      )
    } catch {
      ctx.issue('DISCOUNT_MAPPING_INVALID', 'promotion_codes', row.id)
    }
  }
  const duplicates = new Set(
    ctx.output.discounts
      .filter((doc) =>
        ctx.output.discounts.some(
          (other) => other !== doc && other.code === doc.code,
        ),
      )
      .map((doc) => doc._ref),
  )
  ctx.output.discounts = ctx.output.discounts.filter((doc) => {
    if (!duplicates.has(doc._ref)) return true
    ctx.issue(
      'DISCOUNT_CODE_COLLISION',
      'promotion_codes',
      String(doc._ref).split(':').at(-1),
    )
    return false
  })
}
