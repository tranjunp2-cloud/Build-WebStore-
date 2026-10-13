// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { mapCatalog } from '@/lib/migration/pw1-export/mappers/catalog'
import { mapContent } from '@/lib/migration/pw1-export/mappers/content'
import { mapCommerce } from '@/lib/migration/pw1-export/mappers/commerce'
import { productDocumentSchema } from '@/lib/migration/pw1-export/mappers/catalog-schemas'
import { blogSchema } from '@/lib/migration/pw1-export/mappers/content-schemas'
import { discountDocumentSchema } from '@/lib/migration/pw1-export/mappers/commerce-schemas'
const dates = { created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }
function fixture(status: string | null) {
  const tables: Record<string, Row[]> = {
    stores: [{ id: '1', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }],
    categories: [{ id: '10', store_id: '1', name: 'Books', slug: 'books', status: '1', ...dates }],
    products: [{ id: '20', store_id: '1', category_id: '10', name: 'First book', slug: 'first-book', status, ...dates }],
    product_skus: [{ id: '30', product_id: '20', store_id: '1', status: '1', price: '12', stock: '3', sku: 'BOOK', ...dates }],
    blog_posts: [{ id: '40', store_id: '1', name: 'Article', slug: 'article', status, created_by: '2', content: '<p>Hello</p>', ...dates }],
    promotions: [{ id: '50', store_id: '1', name: 'Offer', status, discount_type_id: '1', discount_value: '10', ...dates }],
    promotion_codes: [{ id: '60', promotion_id: '50', code: 'OFFER', ...dates }], orders: [],
  }
  const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'fixture', sourceDatabase: 'fixture', sourceInstanceToken: 'fixture', snapshotId: 'status', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'review' })
  const output = emptyStore()
  output.sites.push({ _ref: '@sites:stores:1' }); output.users.push({ _ref: '@users:users:2', tenants: [{ tenant: '@tenants:stores:1', role: 'owner' }] })
  const ctx = new SourceIndex(tables).context(config, '1', output, [], [])
  return { ctx, tables, run() { mapCatalog(ctx); mapContent(ctx); mapCommerce(ctx) } }
}
describe('[TC-F42-EXP-086] Preserve source operational status', () => {
  it.each(['0', '1'])('preserves status %s through mapping, sanitizer and document schemas', status => {
    // Arrange
    const f = fixture(status)
    // Act
    f.run()
    // Assert
    expect(f.ctx.output.products[0]?.status).toBe(status === '1' ? 'active' : 'draft')
    expect(f.ctx.output.blogs[0]?.status).toBe(status === '1' ? 'published' : 'draft')
    expect(f.ctx.output.discounts[0]?.status).toBe(status === '1' ? 'active' : 'inactive')
    expect(productDocumentSchema.safeParse(f.ctx.output.products[0]).success).toBe(true)
    expect(blogSchema.safeParse(f.ctx.output.blogs[0]).success).toBe(true)
    expect(discountDocumentSchema.safeParse(f.ctx.output.discounts[0]).success).toBe(true)
    expect(f.ctx.output.blogs[0]).not.toHaveProperty('publishedAt')
  })
  it.each([null, '', '9'])('rejects unverified status %j instead of silently drafting', status => {
    // Arrange
    const f = fixture(status)
    // Act
    f.run()
    // Assert
    expect(f.ctx.output.products).toEqual([])
    expect(f.ctx.output.blogs).toEqual([])
    expect(f.ctx.output.discounts).toEqual([])
    expect(f.ctx.diagnostics.map(d => d.code)).toEqual(expect.arrayContaining(['PRODUCT_STATUS_UNVERIFIED', 'BLOG_STATUS_UNVERIFIED', 'DISCOUNT_STATUS_UNVERIFIED']))
  })
  it.each(['2025-12-01 00:00:00', '2026-02-01 00:00:00', null])('preserves expired discounts only with verified expiry %j', expiry => {
    // Arrange
    const f = fixture('2'); f.tables.promotions[0].end_date = expiry
    // Act
    f.run()
    // Assert
    if (expiry === '2025-12-01 00:00:00') expect(f.ctx.output.discounts[0]).toMatchObject({ status: 'inactive', expiresAt: '2025-12-01T00:00:00.000Z' })
    else {
      expect(f.ctx.output.discounts).toEqual([])
      expect(f.ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'DISCOUNT_EXPIRY_UNVERIFIED' }))
    }
  })
})
