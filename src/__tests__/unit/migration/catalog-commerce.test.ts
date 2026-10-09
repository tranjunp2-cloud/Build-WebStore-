import { mapContent } from '@/lib/migration/pw1-export/mappers/content'
import { blogLexical } from '@/lib/migration/pw1-export/mappers/content-lexical'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { productDocumentSchema } from '@/lib/migration/pw1-export/mappers/catalog-schemas'
import { mapCatalog } from '@/lib/migration/pw1-export/mappers/catalog'
import {
  mapCommerce,
  historicalOrderItem,
  orderState,
} from '@/lib/migration/pw1-export/mappers/commerce'
import {
  emptyStore,
  type MappingContext,
  type Row,
  type SourceConfig,
} from '@/lib/migration/pw1-export/contracts'
import { buildProductCatalogFromSource } from '@/lib/migration/pw2-product-eav.mjs'
import { sourceDiscountMinorUnits } from '@/lib/migration/pw2-commerce-reconciliation.mjs'
const date = {
  created_at: '2024-01-01 12:00:00',
  updated_at: '2024-01-02 12:00:00',
}
function context(extra: Record<string, Row[]> = {}): MappingContext {
  const tables = {
    stores: [{ id: '1', currency_id: '1' }],
    currencies: [{ id: '1', code: 'MYR' }],
    categories: [
      {
        id: '10',
        store_id: '1',
        name: 'Books',
        slug: 'books',
        status: '1',
        ...date,
      },
    ],
    products: [
      {
        id: '20',
        store_id: '1',
        category_id: '10',
        name: 'Book one',
        status: '1',
        slug: 'book-one',
        package_weight: '2',
        package_weight_type: '2',
        package_length: '30',
        package_dimension_type: '2',
        ...date,
      },
    ],
    product_skus: [
      {
        id: '30',
        product_id: '20',
        store_id: '1',
        sku: 'BOOK01',
        price: '12.50',
        stock: '5',
        status: '1',
        ...date,
      },
    ],
    ...extra,
  } as Record<string, Row[]>
  const output = emptyStore()
  output.sites.push({ _ref: '@sites:stores:1' })
  const ctx: MappingContext = {
    tables,
    storeId: '1',
    output,
    diagnostics: [],
    contributions: [],
    config: { sourceInstanceToken: 'DB1', utcOffset: '+08:00' } as SourceConfig,
    rows: (table, includeDeleted = false) =>
      (tables[table] ?? []).filter(
        (row) => row.store_id === '1' && (includeDeleted || !row.deleted_at),
      ),
    find: (table, id) => (tables[table] ?? []).find((row) => row.id === id),
    issue: (code, table, sourceId, field, severity = 'blocker', reason) =>
      ctx.diagnostics.push({
        code,
        table,
        sourceId: sourceId ?? undefined,
        field,
        severity,
        ...(reason ? { reason } : {}),
      }),
    contribute: (table, row, fields, targetPath, rule) =>
      ctx.contributions.push({
        table,
        sourceId: row.id ?? '',
        fields,
        targetPath,
        rule,
      }),
  }
  return ctx
}
describe('[TC-F42-EXP-010] Catalog validation', () => {
  it('emits a valid simple product and rejects a dangling category', () => {
    // Arrange
    const ctx = context()
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(ctx.output.products[0]).toMatchObject({
      price: 12.5,
      inventory: 5,
      hasVariants: false,
      category: ['@categories:categories:10'],
    })
    const broken = context({ categories: [] })
    mapCatalog(broken)
    expect(broken.output.products).toHaveLength(0)
    expect(
      broken.diagnostics.some(
        (item) => item.code === 'CATEGORY_REFERENCE_UNRESOLVED',
      ),
    ).toBe(true)
  })
  it('rejects every product sharing a tenant SKU', () => {
    const ctx = context()
    ctx.tables.products.push({
      ...ctx.tables.products[0],
      id: '21',
      slug: 'book-two',
    })
    ctx.tables.product_skus.push({
      ...ctx.tables.product_skus[0],
      id: '31',
      product_id: '21',
    })
    mapCatalog(ctx)
    expect(ctx.output.products).toHaveLength(0)
    expect(
      ctx.diagnostics.filter((item) => item.code === 'PRODUCT_SKU_COLLISION'),
    ).toHaveLength(2)
  })
})
it('[TC-F42-EXP-019] normalizes source grams to kg and preserves source cm', () => {
  const ctx = context()
  mapCatalog(ctx)
  expect(ctx.output.products[0]).toMatchObject({
    weight: 0.002,
    dimensions: { length: 30 },
  })
})
it('[TC-F42-EXP-017] stable source token keeps SKU/variant UUID across snapshots', () => {
  const ctx = context({
    attributes: [{ id: '40', store_id: '1', name: 'Size', code: 'size' }],
    attribute_values: [
      { id: '50', store_id: '1', attribute_id: '40', name: 'Small' },
    ],
    product_attributes: [
      {
        id: '60',
        product_id: '20',
        attribute_id: '40',
        attribute_value_id: '50',
      },
    ],
    product_variants: [
      {
        id: '70',
        product_sku_id: '30',
        attribute_id: '40',
        attribute_value_id: '50',
      },
    ],
  })
  const first = buildProductCatalogFromSource(
    ctx.tables.products[0],
    ctx.tables,
    'DB1',
  )
  const second = buildProductCatalogFromSource(
    { ...ctx.tables.products[0], updated_at: '2025-01-01 00:00:00' },
    ctx.tables,
    'DB1',
  )
  expect(first.errors).toEqual([])
  expect(first.fields.sku).toBe('PW1DB1P20')
  expect(first.skuCrosswalk).toEqual(second.skuCrosswalk)
})
describe('[TC-F42-EXP-011] Commerce source rules', () => {
  it('uses exact minor units and rejects sub-cent amounts', () => {
    expect(sourceDiscountMinorUnits('0.29', 'MYR')).toBe(29)
    expect(() => sourceDiscountMinorUnits('0.001', 'MYR')).toThrow()
  })
  it('keeps order status independent of COD payment and rejects unproven refunds', () => {
    expect(
      orderState(
        { status: '5', purchase_status: null, refund_status: null },
        'cod',
      ),
    ).toEqual({ status: 'completed', paymentStatus: 'unpaid' })
    expect(() =>
      orderState({ status: '8', purchase_status: '1' }, 'stripe'),
    ).toThrow()
    expect(() =>
      orderState(
        { status: '5', purchase_status: '1', refund_status: '1' },
        'stripe',
      ),
    ).toThrow()
  })
  it('merges customer phone identity deterministically', () => {
    const ctx = context({
      customers: [
        {
          id: '91',
          store_id: '1',
          name: 'Old name',
          phone: '+60 12-345',
          ...date,
        },
        {
          id: '92',
          store_id: '1',
          name: 'New name',
          phone: '6012345',
          ...date,
          updated_at: '2024-02-01 00:00:00',
        },
      ],
    })
    mapCommerce(ctx)
    expect(ctx.output.customers).toHaveLength(1)
    expect(ctx.output.customers[0]).toMatchObject({
      _ref: '@customers:customers:91',
      name: 'New name',
      phone: '6012345',
    })
  })
})
describe('[TC-F42-EXP-021] Discount history empty evidence', () => {
  it('does not invent history for verified empty source', () => {
    const ctx = context({ orders: [], promotions: [], promotion_codes: [] })
    mapCommerce(ctx)
    expect(ctx.output.discount_usage_history).toEqual([])
    expect(
      ctx.diagnostics.some(
        (item) => item.code === 'DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED',
      ),
    ).toBe(false)
  })
  it('includes deleted coded orders when checking history evidence', () => {
    const ctx = context({
      orders: [
        {
          id: '80',
          store_id: '1',
          promotion_code: 'OLD',
          deleted_at: '2024-01-03 00:00:00',
        },
      ],
    })
    mapCommerce(ctx)
    expect(
      ctx.diagnostics.some(
        (item) => item.code === 'DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED',
      ),
    ).toBe(true)
  })
})
it('[TC-F42-EXP-011] exports historical price and exact totals, rejects whole order on missing SKU', () => {
  // Arrange
  const order = {
    id: '80',
    store_id: '1',
    code: 'ORDER80',
    customer_name: 'Customer',
    currency_id: '1',
    status: '5',
    purchase_status: null,
    refund_status: null,
    payment_method_id: '2',
    shipping_address_id: '90',
    sub_total: '10.00',
    total_shipping: '2.00',
    total_discount: '0.29',
    total_tax: null,
    total: '11.71',
    total_weight: '1.001',
    ...date,
  }
  const tables = {
    orders: [order],
    order_details: [
      {
        id: '81',
        order_id: '80',
        product_sku_id: '30',
        name: 'Historical book',
        quantity: '2',
        price: '5.00',
      },
    ],
    payment_methods: [{ id: '2', code: 'cod' }],
    addresses: [
      { id: '90', store_id: '1', address: 'Road 1', country_id: '1' },
    ],
    countries: [{ id: '1', name: 'Malaysia' }],
  }
  const ctx = context(tables)
  // Act
  mapCatalog(ctx)
  mapCommerce(ctx)
  // Assert
  expect(ctx.output.orders).toHaveLength(1)
  expect(ctx.output.orders[0]).toMatchObject({
    subtotal: 10,
    total: 11.71,
    discountAmount: 29,
    parcelWeight: 1001,
    paymentStatus: 'unpaid',
    items: [{ productName: 'Historical book', unitPrice: 5, quantity: 2 }],
  })
  const broken = context({
    ...tables,
    order_details: [{ ...tables.order_details[0], product_sku_id: 'MISSING' }],
  })
  mapCatalog(broken)
  mapCommerce(broken)
  expect(broken.output.orders).toHaveLength(0)
  expect(
    broken.diagnostics.some((item) => item.code === 'ORDER_SKU_UNRESOLVED'),
  ).toBe(true)
})

it('[TC-F42-EXP-010] emits external media without unsupported tenant field', () => {
  const ctx = context({
    product_images: [
      {
        id: '100',
        product_id: '20',
        url: 'https://example.test/book.jpg',
        order: '0',
        ...date,
      },
    ],
  })
  mapCatalog(ctx)
  expect(ctx.output.media).toHaveLength(1)
  expect(ctx.output.media[0]).not.toHaveProperty('tenant')
  expect(ctx.output.products).toHaveLength(1)
})

describe('[TC-F42-EXP-091] Lossless Product description export', () => {
  it.each([
    '<h2>Details</h2><p style="color: red">A &amp; B</p><img src="https://cdn.example.test/en.jpg">',
    '<p onclick="evil()">Text</p><script>canary()</script><a href="javascript:evil()">Link</a>',
    '  \r\nTiếng Việt 🛒\n\t',
    '{"unknown_key":"value", invalid JSON',
    '',
  ])('retains exact EN/MS source text without content blockers: %j', (source) => {
    // Arrange
    const ctx = context()
    ctx.tables.products[0].description = source
    ctx.tables.products[0].description_ms = source + ' MS'
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(productDocumentSchema.safeParse(ctx.output.products[0]).success).toBe(true)
    expect(ctx.output.products[0].description).toMatchObject({ root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: source }] }] } })
    expect(ctx.output.products[0].descriptionBM).toMatchObject({ root: { children: [{ children: [{ text: source + ' MS' }] }] } })
    expect(ctx.output.media).toEqual([])
    expect(ctx.diagnostics).toEqual([])
  })
})

it('[TC-F42-EXP-013] retains Product and Blog links as source text', () => {
  // Arrange
  const ctx = context()
  const html =
    '<p><a href="/reset?%74oken=CANARY">Encoded</a><a href="?credential=CANARY">Credential</a><a href="/view?unknown=CANARY">Unknown</a><a href="/view?w=100">Image size</a><a href="/about#details">About</a><a href="#section">Section</a></p>'
  ctx.tables.products[0].description = html
  // Act
  mapCatalog(ctx)
  const blog = blogLexical(ctx, { id: '88', content: html })
  // Assert
  expect(ctx.output.products[0].description).toMatchObject({ root: { children: [{ children: [{ text: html }] }] } })
  expect(blog).toMatchObject({ root: { children: [{ children: [{ text: html }] }] } })
  expect(ctx.diagnostics.some(issue => issue.code === 'BLOG_LINK_UNSAFE' || issue.code === 'PRODUCT_DESCRIPTION_LINK_UNSAFE')).toBe(false)
})


describe('[TC-F42-076] Full Product short-description preservation', () => {
  it.each([300, 301, 961])('keeps Product and source text at length %i without silently truncating', (length) => {
    // Arrange
    const ctx = context()
    const description = 'x'.repeat(length)
    ctx.tables.products[0].featured_description = description
    // Act
    mapCatalog(ctx)
    mapContent(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(ctx.output.products[0].price).toBe(12.5)
    expect(ctx.output.sites[0]).not.toHaveProperty('pw1_source')
    expect(ctx.tables.products[0].featured_description).toBe(description)
    const mapped = ctx.contributions.filter((entry) => entry.table === 'products'
      && entry.targetPath.startsWith('@products:'))
    expect(ctx.output.products[0].shortDescription).toBe(description)
    expect(mapped.some((entry) => entry.fields.includes('featured_description'))).toBe(true)
    expect(ctx.diagnostics.some((entry) => entry.code === 'SHORT_DESCRIPTION_TOO_LONG')).toBe(false)
  })
})

it('[TC-F42-076] raw safety remains independent of operational short-description preservation', () => {
  // Arrange
  const ctx = context()
  ctx.tables.products[0].featured_description = 'secret=' + 'x'.repeat(301)
  // Act
  mapCatalog(ctx)
  mapContent(ctx)
  // Assert
  expect(ctx.output.products).toHaveLength(1)
  expect(ctx.output.products[0].shortDescription).toBe(ctx.tables.products[0].featured_description)
  expect(ctx.output.sites[0]).not.toHaveProperty('pw1_source')
  expect(ctx.diagnostics).toContainEqual(expect.objectContaining({
    code: 'RAW_VALUE_UNVERIFIED', table: 'products', sourceId: '20', field: 'featured_description',
  }))
})


describe('[TC-F42-074] historical Order item snapshots', () => {
  const detail = {
    id: '901', order_id: '80', product_sku_id: '30',
    name: 'Original item', variant: 'Old option name', price: '7.25', quantity: '2',
  }
  it('keeps source values when the SKU and current Product are absent', () => {
    // Arrange
    const ctx = context({ product_skus: [], products: [] })
    // Act
    const item = historicalOrderItem(ctx, detail, 'MYR')
    // Assert
    expect(item).toMatchObject({ productName: 'Original item', variant: 'Old option name', quantity: 2, unitPrice: 7.25 })
    expect(item).not.toHaveProperty('product')
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', severity: 'warning' }))
  })
  it.each([{ status: '0' }, { deleted_at: '2025-01-01 00:00:00' }])('retains an owned historical line for unavailable SKU %j', (change) => {
    // Arrange
    const ctx = context()
    Object.assign(ctx.tables.product_skus[0], change)
    ctx.output.products.push({ _ref: '@products:products:20', hasVariants: true, variants: [{ name: 'Renamed option' }] })
    // Act
    const item = historicalOrderItem(ctx, detail, 'MYR')
    // Assert
    expect(item).toMatchObject({ product: '@products:products:20', variant: 'Old option name', unitPrice: 7.25 })
  })
  it.each(['product_skus', 'products'])('rejects an existing foreign-tenant %s link', (table) => {
    // Arrange
    const ctx = context()
    ctx.tables[table][0].store_id = '2'
    // Act / Assert
    expect(() => historicalOrderItem(ctx, detail, 'MYR')).toThrow('ORDER_ITEM_SOURCE_OWNERSHIP_MISMATCH')
  })
  it('retains exact item snapshots and original totals through the opted-in mapper', () => {
    // Arrange
    const ctx = context({
      products: [], product_skus: [],
      orders: [{ id: '80', store_id: '1', code: 'HISTORY-80', customer_name: 'Buyer', currency_id: '1', payment_method_id: '2', status: '2', shipping_address_id: '90', sub_total: '14.50', total_shipping: '2.00', total_discount: '0.29', total_tax: '0', total: '16.21', total_weight: '1.001', ...date }],
      order_details: [detail], payment_methods: [{ id: '2', code: 'cod' }],
      addresses: [{ id: '90', store_id: '1', address: 'Road 1', country_id: '1' }],
      countries: [{ id: '1', name: 'Malaysia' }],
    })
    ctx.config.migrationPolicy = { decisionEvidence: 'Preserve historical Orders', preserveHistoricalOrders: true, activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false, siteTypeDefault: 'ecommerce' as const, siteTypeOverrides: {}, shippingPolicy: 'review' as const }
    // Act
    mapCommerce(ctx)
    // Assert
    expect(ctx.output.orders).toHaveLength(1)
    expect(ctx.output.orders[0]).toMatchObject({ subtotal: 14.5, shippingFee: 2, discountAmount: 29, total: 16.21, items: [{ productName: 'Original item', variant: 'Old option name', unitPrice: 7.25, quantity: 2 }] })
    expect((ctx.output.orders[0].items as Record<string, unknown>[])[0]).not.toHaveProperty('product')
  })
})


it('[TC-F42-076] preserves eight source images in order with their media relationships', () => {
  // Arrange
  const images = Array.from({ length: 8 }, (_, index) => ({
    id: String(80 + index), product_id: '20', store_id: '1', order: String(index),
    url: `https://assets.example.com/image-${index}.jpg`, ...date,
  }));
  const ctx = context({ product_images: [...images].reverse() });
  // Act
  mapCatalog(ctx);
  // Assert
  expect(ctx.output.products).toHaveLength(1);
  expect(ctx.output.products[0].images).toEqual(images.map(image => ({ image: `@media:product_images:${image.id}`, alt: 'Book one' })));
  expect(ctx.output.media).toHaveLength(8);
  expect(ctx.diagnostics.some(row => row.code === 'TOO_MANY_PRODUCT_IMAGES')).toBe(false);
});


describe('[TC-F42-EXP-094] Skip Product with missing price or stock', () => {
  it.each(['price', 'stock'])('skips whole Product when eligible SKU %s is missing', field => {
    for (const value of [undefined, null, '', '   ']) {
      // Arrange
      const ctx = context()
      if (value === undefined) delete ctx.tables.product_skus[0][field]
      else ctx.tables.product_skus[0][field] = value
      // Act
      mapCatalog(ctx)
      // Assert
      expect(ctx.output.products).toEqual([])
      expect(ctx.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({
        table: 'products', sourceId: '20', code: 'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED', severity: 'warning',
        reason: field === 'price' ? 'MISSING_PRICE' : 'MISSING_STOCK',
      })]))
    }
  })
  it('retains actual zero price and zero stock without defaults', () => {
    // Arrange
    const ctx = context()
    ctx.tables.product_skus[0].price = '0'
    ctx.tables.product_skus[0].stock = '0'
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(ctx.output.products[0]).toMatchObject({ price: 0, inventory: 0 })
  })
  it('skips Product with no SKU source rows and records its identity', () => {
    // Arrange
    const ctx = context({ product_skus: [] })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toEqual([])
    expect(ctx.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED', severity: 'warning', sourceId: '20', reason: 'NO_SKU_ROWS' })]))
  })
})
