import { describe, expect, it } from 'vitest'
import { mapCommerce, orderState } from '@/lib/migration/pw1-export/mappers/commerce'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import type { MigrationPolicy, Row } from '@/lib/migration/pw1-export/contracts'

function emptyStore() {
  return {
    tenants: [],
    users: [],
    sites: [],
    pages: [],
    categories: [],
    products: [],
    discounts: [],
    customers: [],
    orders: [],
    blogs: [],
    'blog-categories': [],
    tags: [],
    media: [],
    redirects: [],
    notifications: [],
    subscribers: [],
    'contact-submissions': [],
    analytics: [],
  }
}

const basePolicy: MigrationPolicy = {
  decisionEvidence: 'DECISION-TEST-GROUP5',
  siteTypeDefault: 'ecommerce',
  siteTypeOverrides: {},
  shippingPolicy: 'pw2-defaults',
  activeCatalogOnly: false,
  deferEmailTemplates: false,
  allowSparseVariants: false,
  preserveUserCreators: false,
}

function createContext(tables: Record<string, Row[]>, overrides: Partial<MigrationPolicy> = {}) {
  const config = sourceConfigSchema.parse({
    version: 1,
    sourceInstance: 'test',
    sourceDatabase: 'test',
    sourceInstanceToken: 'token',
    snapshotId: 'snap',
    asOf: '2026-01-01T00:00:00.000Z',
    utcOffset: '+08:00',
    sourcePlatformSuffix: 'example.com',
    targetPlatformSuffix: 'primeweb.app',
    tables: { stores: 'stores.csv' },
    deletedStores: 'review',
    migrationPolicy: { ...basePolicy, ...overrides },
  })
  const output = emptyStore()
  output.sites.push({ _ref: '@sites:stores:10' })
  return new SourceIndex(tables).context(config, '10', output, [], [])
}

describe('[TC-F42-EXP-101] Order & Promotion Domain Resolution', () => {
  it('preserves delivery status and rejects partial/failed refunds', () => {
    const policy = { ...basePolicy, preserveRefundedOrdersWithoutEvidence: true }
    const row = { status: '4', purchase_status: '1', refund_status: '1' }
    expect(orderState(row, 'stripe', policy)).toEqual({ status: 'shipped', paymentStatus: 'refunded' })
    expect(() => orderState({ ...row, refund_type: '1' }, 'stripe', policy)).toThrow('ORDER_REFUND_EVIDENCE_CONFLICT')
    expect(() => orderState({ ...row, refund_message: 'Payment return status fail' }, 'stripe', policy)).toThrow('ORDER_REFUND_EVIDENCE_CONFLICT')
  })
  const store = { id: '10', name: 'Shop', currency_id: '1' }
  const currency = { id: '1', code: 'MYR' }
  const country = { id: '1', name: 'Malaysia' }
  const address: Row = {
    id: '1',
    store_id: '10',
    customer_id: '40',
    address: '123 Main St',
    country_id: '1',
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
  }
  const customer: Row = {
    id: '40',
    store_id: '10',
    name: 'Buyer',
    email: 'buyer@test.local',
    phone: '+60123456789',
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
  }
  const product: Row = {
    id: '100',
    store_id: '10',
    name: 'Item 1',
    slug: 'item-1',
    status: '1',
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
  }
  const sku: Row = {
    id: '200',
    product_id: '100',
    store_id: '10',
    sku: 'SKU-100',
    status: '1',
    price: '100.00',
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
  }

  it('handles DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED: blocker by default, warning when allowed', () => {
    const promotion: Row = {
      id: '1',
      store_id: '10',
      discount_type_id: '1',
      discount_value: '10',
      status: '1',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const promoCode: Row = {
      id: '1',
      promotion_id: '1',
      code: 'SAVE10',
      used: '5',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const tables = {
      stores: [store],
      currencies: [currency],
      countries: [country],
      addresses: [address],
      customers: [customer],
      products: [product],
      product_skus: [sku],
      orders: [],
      order_details: [],
      promotions: [promotion],
      promotion_codes: [promoCode],
    }

    // 1. Strict
    const strictCtx = createContext(tables, { allowHistoricalDiscountEligibilityGap: false })
    mapCommerce(strictCtx)
    const strictIssue = strictCtx.diagnostics.find(d => d.code === 'DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED')
    expect(strictIssue).toBeDefined()
    expect(strictIssue?.severity).toBe('blocker')

    // 2. Permissive
    const permissiveCtx = createContext(tables, { allowHistoricalDiscountEligibilityGap: true })
    mapCommerce(permissiveCtx)
    const permissiveIssue = permissiveCtx.diagnostics.find(d => d.code === 'DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED')
    expect(permissiveIssue).toBeDefined()
    expect(permissiveIssue?.severity).toBe('warning')
  })

  it('handles ORDER_REFUND_EVIDENCE_REQUIRED: preserves refunded orders when enabled', () => {
    const refundedOrder: Row = {
      id: '500',
      store_id: '10',
      customer_id: '40',
      customer_name: 'Buyer',
      code: 'ORD-REF-500',
      currency_id: '1',
      payment_method_id: '1',
      shipping_address_id: '1',
      total_weight: '1.000',
      sub_total: '100.00',
      total_shipping: '0',
      total_discount: '0',
      total_tax: '0',
      total: '100.00',
      status: '6', // cancelled
      purchase_status: '1', // was paid
      refund_status: '1', // refunded without transaction proof
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const orderDetail: Row = {
      id: '600',
      order_id: '500',
      product_sku_id: '200',
      name: 'Item 1',
      quantity: '1',
      price: '100.00',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const tables = {
      stores: [store],
      currencies: [currency],
      countries: [country],
      addresses: [address],
      customers: [customer],
      products: [product],
      product_skus: [sku],
      orders: [refundedOrder],
      order_details: [orderDetail],
      payment_methods: [{ id: '1', code: 'stripe' }],
      promotions: [],
      promotion_codes: [],
    }

    // 1. Strict mode: throws ORDER_REFUND_EVIDENCE_REQUIRED and rejects order
    const strictCtx = createContext(tables, {
      preserveRefundedOrdersWithoutEvidence: false,
      preserveHistoricalOrders: true,
    })
    mapCommerce(strictCtx)
    expect(strictCtx.output.orders).toHaveLength(0)
    expect(strictCtx.diagnostics.some(d => d.code === 'ORDER_REFUND_EVIDENCE_REQUIRED')).toBe(true)

    // 2. Permissive mode: preserves order as refunded
    const permissiveCtx = createContext(tables, {
      preserveRefundedOrdersWithoutEvidence: true,
      preserveHistoricalOrders: true,
    })
    mapCommerce(permissiveCtx)
    expect(permissiveCtx.output.orders).toHaveLength(1)
    expect(permissiveCtx.output.orders[0].paymentStatus).toBe('refunded')
    expect(permissiveCtx.diagnostics.some(d => d.code === 'ORDER_REFUND_EVIDENCE_ABSENT')).toBe(true)
    const contradicted = createContext({ ...tables, queue_sync: [{ id: '42', store_id: '10', code: 'ORD-REF-500', type: '1', sync_name: 'sync_order_refund', status: '3' }] }, {
      preserveRefundedOrdersWithoutEvidence: true, preserveHistoricalOrders: true,
    })
    mapCommerce(contradicted)
    expect(contradicted.output.orders).toHaveLength(0)
    expect(contradicted.diagnostics).toContainEqual(expect.objectContaining({ code: 'ORDER_REFUND_EVIDENCE_CONFLICT', severity: 'blocker' }))

  })

  it('skips invalid/colliding discount codes as warning when skipInvalidDiscountCodes is true', () => {
    const promo1: Row = {
      id: '1',
      store_id: '10',
      discount_type_id: '1',
      discount_value: '10',
      status: '1',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const promo2: Row = {
      id: '2',
      store_id: '10',
      discount_type_id: '1',
      discount_value: '20',
      status: '1',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    // Colliding code 'PROMO'
    const code1: Row = {
      id: '1',
      promotion_id: '1',
      code: 'PROMO',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const code2: Row = {
      id: '2',
      promotion_id: '2',
      code: 'promo', // duplicate
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    // Invalid code (invalid discount_type_id)
    const promo3: Row = {
      id: '3',
      store_id: '10',
      discount_type_id: '99',
      discount_value: '10',
      status: '1',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const code3: Row = {
      id: '3',
      promotion_id: '3',
      code: 'INVALID_TYPE',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }

    const tables = {
      stores: [store],
      currencies: [currency],
      countries: [country],
      addresses: [address],
      customers: [customer],
      products: [product],
      product_skus: [sku],
      orders: [],
      order_details: [],
      promotions: [promo1, promo2, promo3],
      promotion_codes: [code1, code2, code3],
    }

    // 1. Strict mode: blocker
    const strictCtx = createContext(tables, { skipInvalidDiscountCodes: false })
    mapCommerce(strictCtx)
    expect(strictCtx.output.discounts).toHaveLength(0)
    expect(strictCtx.diagnostics.find(d => d.code === 'DISCOUNT_CODE_COLLISION')?.severity).toBe('blocker')
    expect(strictCtx.diagnostics.find(d => d.code === 'DISCOUNT_MAPPING_INVALID')?.severity).toBe('blocker')

    // 2. Permissive mode: skips invalid & duplicate codes as warning
    const permissiveCtx = createContext(tables, { skipInvalidDiscountCodes: true })
    mapCommerce(permissiveCtx)
    expect(permissiveCtx.output.discounts).toHaveLength(0) // skipped
    expect(permissiveCtx.diagnostics.find(d => d.code === 'DISCOUNT_CODE_COLLISION')?.severity).toBe('warning')
    expect(permissiveCtx.diagnostics.find(d => d.code === 'DISCOUNT_MAPPING_INVALID')?.severity).toBe('warning')
    // A malformed sibling must not make the other duplicate usable.
    const invalidSibling = createContext({ ...tables, promotions: [promo1, { ...promo2, discount_type_id: '99' }, promo3] }, { skipInvalidDiscountCodes: true })
    mapCommerce(invalidSibling)
    expect(invalidSibling.output.discounts).toHaveLength(0)
    expect(invalidSibling.diagnostics.filter(d => d.code === 'DISCOUNT_CODE_COLLISION').map(d => d.sourceId).sort()).toEqual(['1', '2'])
    const dates = { created_at: '2025-01-01 00:00:00', updated_at: '2025-01-01 00:00:00' }
    const history = createContext({ ...tables,
      payment_methods: [{ id: '1', code: 'cod' }],
      orders: [{ id: '800', store_id: '10', code: 'ORDER-HISTORY', customer_id: '40', customer_name: 'Buyer', currency_id: '1', payment_method_id: '1', shipping_address_id: '1', total_weight: '1.000', sub_total: '100', total_shipping: '0', total_discount: '10', total_tax: '0', total: '90', status: '5', purchase_status: '1', promotion_code: 'PROMO', ...dates }],
      order_details: [{ id: '801', order_id: '800', name: 'Historical item', quantity: '1', price: '100', ...dates }],
    }, { skipInvalidDiscountCodes: true, preserveHistoricalOrders: true })
    mapCommerce(history)
    expect(history.output.orders).toHaveLength(1)
    expect(history.output.orders[0]).toMatchObject({ discountCode: 'PROMO', total: 90, discountAmount: 1000 })
    expect(history.output.orders[0]).not.toHaveProperty('discount')
    expect(history.diagnostics).toContainEqual(expect.objectContaining({ code: 'ORDER_DISCOUNT_REFERENCE_OMITTED', reason: 'COUPON_EXCLUDED_BY_POLICY', severity: 'warning' }))


  })

  it('TC-F42-EXP-105: explicitly excludes unknown Order status only under approved flag', () => {
    const unverifiedOrder: Row = {
      id: '700',
      store_id: '10',
      customer_id: '40',
      customer_name: 'Buyer',
      code: 'ORD-BAD-STATUS',
      currency_id: '1',
      payment_method_id: '1',
      shipping_address_id: '1',
      total_weight: '1.000',
      sub_total: '100.00',
      total_shipping: '0',
      total_discount: '0',
      total_tax: '0',
      total: '100.00',
      status: '99', // unverified status code
      purchase_status: '1',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const orderDetail: Row = {
      id: '800',
      order_id: '700',
      product_sku_id: '200',
      name: 'Item 1',
      quantity: '1',
      price: '100.00',
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-01 00:00:00',
    }
    const tables = {
      stores: [store],
      currencies: [currency],
      countries: [country],
      addresses: [address],
      customers: [customer],
      products: [product],
      product_skus: [sku],
      orders: [unverifiedOrder],
      order_details: [orderDetail],
      payment_methods: [{ id: '1', code: 'cod' }],
      promotions: [],
      promotion_codes: [],
    }

    // 1. Strict mode: blocker
    const strictCtx = createContext(tables, { skipUnverifiedOrders: false })
    mapCommerce(strictCtx)
    expect(strictCtx.output.orders).toHaveLength(0)
    const strictIssue = strictCtx.diagnostics.find(d => d.code === 'ORDER_STATUS_UNVERIFIED')
    expect(strictIssue).toBeDefined()
    expect(strictIssue?.severity).toBe('blocker')

    // 2. Permissive mode: skips unverified order and issues warning
    const permissiveCtx = createContext(tables, { skipUnverifiedOrders: true })
    mapCommerce(permissiveCtx)
    expect(permissiveCtx.output.orders).toHaveLength(0) // skipped
    const permissiveIssue = permissiveCtx.diagnostics.find(d => d.code === 'SOURCE_ENTITY_EXCLUDED')
    expect(permissiveIssue).toBeDefined()
    expect(permissiveIssue?.severity).toBe('warning')
    expect(permissiveIssue?.reason).toBe('ORDER_STATUS_UNVERIFIED')
  })
})

describe('TC-F42-EXP-106: explicitly approved negative Order identities', () => {
  function negativeContext(id = '112', storeId = '43', total = '-31.0', enabled = true, sourceInstance = 'PW1PROD') {
    const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'PW1PROD', sourceDatabase: 'fixture', sourceInstanceToken: 'PW1PROD', snapshotId: 'fixture', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'exclude', migrationPolicy: { ...basePolicy, ...(enabled ? { approvedNegativeTotalOrders: [{ storeId: '43', orderId: '112' }, { storeId: '43', orderId: '132' }] } : {}) } })
    // Exercise runtime scope defense even if an internal caller bypassed config parsing.
    config.sourceInstance = sourceInstance
    const output = emptyStore()
    const tables = { stores: [{ id: storeId }], currencies: [{ id: '1', code: 'MYR' }], orders: [{ id, store_id: storeId, total, code: 'ORDER', customer_name: 'Customer', status: '1', purchase_status: '1', currency_id: '1' }], order_details: [], customers: [], addresses: [], promotions: [], promotion_codes: [], payment_methods: [] }
    return new SourceIndex(tables).context(config, storeId, output, [], [])
  }
  it.each(['112', '132'])('excludes approved negative Order %s before contributions', id => {
    // Arrange
    const ctx = negativeContext(id)
    // Act
    mapCommerce(ctx)
    // Assert
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SOURCE_ENTITY_EXCLUDED', table: 'orders', storeId: '43', sourceId: id, reason: 'APPROVED_NEGATIVE_TOTAL', severity: 'warning' }))
    expect(ctx.output.orders).toEqual([])
    expect(ctx.contributions.some(c => ['orders', 'order_details'].includes(c.table))).toBe(false)
    expect(ctx.tables.orders[0].total).toBe('-31.0')
  })
  it('applies explicit Order approval to another source instance', () => {
    // Arrange
    const ctx = negativeContext('112', '43', '-31.0', true, 'PW1DEV')
    // Act
    mapCommerce(ctx)
    // Assert
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SOURCE_ENTITY_EXCLUDED', sourceId: '112', reason: 'APPROVED_NEGATIVE_TOTAL' }))
  })
  it.each([
    ['113', '43', '-31.0', true, 'PW1PROD'],
    ['112', '44', '-31.0', true, 'PW1PROD'],
    ['112', '43', '31.0', true, 'PW1PROD'],
    ['112', '43', '0', true, 'PW1PROD'],
    ['112', '43', '-oops', true, 'PW1PROD'],
    ['112', '43', '-31.0', false, 'PW1PROD'],
  ] as const)('does not waive another/corrected/unapproved source (%s/%s/%s/%s/%s)', (id, storeId, total, enabled, sourceInstance) => {
    // Arrange
    const ctx = negativeContext(id, storeId, total, enabled, sourceInstance)
    // Act
    mapCommerce(ctx)
    // Assert
    expect(ctx.diagnostics.some(d => d.code === 'SOURCE_ENTITY_EXCLUDED')).toBe(false)
  })
})
