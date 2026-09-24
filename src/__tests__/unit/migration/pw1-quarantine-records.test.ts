import { readFixtureMasterText } from '@/__tests__/helpers/pw1-master-artifact'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import {
  emptyStore,
  type Diagnostic,
} from '@/lib/migration/pw1-export/contracts'
import { quarantineProductCollisions } from '@/lib/migration/pw1-export/quarantine-records'
import { storeSummaries } from '@/lib/migration/pw1-export/store-summary'
import { operationalIssues } from '@/lib/migration/pw1-export/validate-master'
import { buildProductCatalogFromSource } from '@/lib/migration/pw2-product-eav.mjs'

function store(id: string) {
  const output = emptyStore()
  output.tenants.push({
    _ref: `@tenants:stores:${id}`,
    slug: `store-${id}`,
    metaData: { pw1StoreId: id },
  })
  output.sites.push({
    _ref: `@sites:stores:${id}`,
    tenant: `@tenants:stores:${id}`,
  })
  return output
}

describe('[TC-F42-EXP-010/016] Product collision quarantine', () => {
  it('removes both same-tenant conflicting Products and preserves Store identity, unrelated data and raw refs', () => {
    // Arrange
    const first = store('1'),
      second = store('2'),
      diagnostics: Diagnostic[] = []
    first.products.push(
      { _ref: '@products:products:11', slug: 'Same' },
      { _ref: '@products:products:12', slug: 'unique' },
    )
    first.products.push({ _ref: '@products:products:21', slug: ' same ' })
    first.categories.push({
      _ref: '@categories:categories:1',
      name: 'retained',
    })
    first.pages.push({
      _ref: '@pages:pages:1',
      product: '@products:products:11',
    })
    first.sites[0].pw1_source = { product: '@products:products:11' }
    first.sites[0].menus = [{ product: '@products:products:11' }]
    const stores = [first, second]
    // Act
    quarantineProductCollisions(stores, diagnostics)
    // Assert
    expect(stores).toHaveLength(2)
    expect(first.tenants).toHaveLength(1)
    expect(second.sites).toHaveLength(1)
    expect(first.products.map((p) => p._ref)).toEqual(['@products:products:12'])
    expect(second.products).toEqual([])
    expect(first.categories).toHaveLength(1)
    expect(first.pages).toHaveLength(1)
    expect(first.sites[0].pw1_source).toEqual({
      product: '@products:products:11',
    })
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.map((d) => d.sourceId).sort()).toEqual(['11', '21'])
    expect(diagnostics.every((d) => d.code === 'PRODUCT_SLUG_COLLISION')).toBe(
      true,
    )
    expect(operationalIssues(stores)).toEqual([])
  })

  it('cascades removal from Product to Order and usage until operational references are closed', () => {
    // Arrange
    const first = store('1'),
      second = store('2'),
      diagnostics: Diagnostic[] = []
    first.products.push({ _ref: '@products:products:11', slug: 'same' })
    first.products.push({ _ref: '@products:products:21', slug: 'same' })
    first.orders.push({
      _ref: '@orders:orders:31',
      orderNumber: 'order-31',
      items: [{ product: '@products:products:11' }],
    })
    first.discount_usage_history.push({
      _ref: '@discount_usage_history:history:41',
      order: '@orders:orders:31',
    })
    // Act
    quarantineProductCollisions([first, second], diagnostics)
    // Assert
    expect(first.orders).toEqual([])
    expect(first.discount_usage_history).toEqual([])
    expect(
      diagnostics
        .filter((d) => d.code === 'DEPENDENCY_RECORD_QUARANTINED')
        .map((d) => d.sourceId)
        .sort(),
    ).toEqual(['31', '41'])
    expect(operationalIssues([first, second])).toEqual([])
  })

  it('retains same slugs across tenants and dependent Orders while reporting the target global constraint gap', () => {
    // Arrange
    const first = store('1'),
      second = store('2'),
      diagnostics: Diagnostic[] = []
    first.products.push({
      _ref: '@products:products:11',
      slug: 'same',
      tenant: '@tenants:stores:1',
    })
    second.products.push({
      _ref: '@products:products:21',
      slug: 'same',
      tenant: '@tenants:stores:2',
    })
    first.orders.push({
      _ref: '@orders:orders:31',
      orderNumber: 'order-31',
      items: [{ product: '@products:products:11' }],
    })
    second.orders.push({
      _ref: '@orders:orders:32',
      orderNumber: 'order-32',
      items: [{ product: '@products:products:21' }],
    })
    const stores = [first, second],
      original = structuredClone(stores)
    // Act
    quarantineProductCollisions(stores, diagnostics)
    // Assert
    expect(stores).toEqual(original)
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics).toEqual(
      expect.arrayContaining(
        ['1', '2'].map((storeId) =>
          expect.objectContaining({
            code: 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP',
            severity: 'blocker',
            storeId,
            table: 'products',
            field: 'slug',
          }),
        ),
      ),
    )
    expect(operationalIssues(stores)).toEqual([])
  })

  it('validates Product slug uniqueness within a tenant while leaving cross-tenant slugs valid', () => {
    // Arrange
    const first = store('1'),
      second = store('2')
    first.products.push({ _ref: '@products:products:11', slug: 'same' })
    second.products.push({ _ref: '@products:products:21', slug: 'same' })
    // Act / Assert
    expect(operationalIssues([first, second])).toEqual([])
    first.products.push({ _ref: '@products:products:12', slug: ' same ' })
    expect(operationalIssues([first, second])).toContainEqual(
      expect.objectContaining({
        storeId: '1',
        table: 'products',
        field: 'slug',
        severity: 'blocker',
        code: 'PRODUCT_SLUG_COLLISION',
      }),
    )
  })

  it.each(['tenant slug', 'user email'])(
    'keeps global %s collision checks across tenants',
    (kind) => {
      // Arrange
      const first = store('1'),
        second = store('2')
      if (kind === 'tenant slug') second.tenants[0].slug = first.tenants[0].slug
      else {
        first.users.push({
          _ref: '@users:users:11',
          email: 'same@example.test',
        })
        second.users.push({
          _ref: '@users:users:21',
          email: 'same@example.test',
        })
      }
      // Act
      const issues = operationalIssues([first, second])
      // Assert
      expect(issues).toHaveLength(2)
      expect(issues.map((issue) => issue.storeId).sort()).toEqual(['1', '2'])
      expect(
        issues.every((issue) => issue.code === 'GLOBAL_UNIQUE_COLLISION'),
      ).toBe(true)
    },
  )

  it('does not change Store content or create diagnostics when no slug conflicts exist', () => {
    // Arrange
    const output = store('1'),
      diagnostics: Diagnostic[] = []
    output.products.push({ _ref: '@products:products:1', slug: 'one' })
    const original = structuredClone(output)
    // Act
    quarantineProductCollisions([output], diagnostics)
    // Assert
    expect(output).toEqual(original)
    expect(diagnostics).toEqual([])
  })
})

describe('[TC-F42-EXP-010] EAV primary errors', () => {
  it('reports no eligible SKU without inventing a missing variant domain', () => {
    // Arrange
    const product = { id: '1', store_id: '1' }
    // Act
    const result = buildProductCatalogFromSource(product, {}, 'TEST')
    // Assert
    expect(result.errors.map((e) => e.code)).toEqual(['SOURCE_NO_ELIGIBLE_SKU'])
    expect(result.skuCrosswalk).toEqual([])
  })

  it('reports a missing domain without fabricating duplicate empty tuples for multiple SKUs', () => {
    // Arrange
    const product = { id: '1', store_id: '1' }
    const product_skus = ['1', '2'].map((id) => ({
      id,
      product_id: '1',
      store_id: '1',
      status: '1',
      sku: `SKU-${id}`,
      price: '1',
      stock: '1',
    }))
    // Act
    const result = buildProductCatalogFromSource(
      product,
      { product_skus },
      'TEST',
    )
    // Assert
    expect(result.errors.map((e) => e.code)).toEqual([
      'SOURCE_VARIANT_DOMAIN_MISSING',
    ])
    expect(result.fields.variants).toEqual([])
    expect(result.skuCrosswalk).toEqual([])
  })
})

describe('[TC-F42-EXP-001/015] Master Unicode roundtrip', () => {
  it('escapes Unicode line separators on disk while preserving parsed source content', async () => {
    // Arrange
    const root = await mkdtemp(path.join(os.tmpdir(), 'pw1-unicode-'))
    try {
      const { input, configPath } = await writeExportFixture(root)
      const filename = path.join(input, 'stores.csv')
      const name = 'Store\u2028line\u2029paragraph'
      await writeFile(
        filename,
        (await readFile(filename, 'utf8')).replace('Store 1', name),
      )
      const output = path.join(root, 'output')
      // Act
      const result = await exportMaster(input, configPath, output)
      const bytes = await readFixtureMasterText(output)
      // Assert
      expect(result.counts.emittedStoreCount).toBe(3)
      expect(bytes).not.toContain('\u2028')
      expect(bytes).not.toContain('\u2029')
      expect(bytes).toContain('\\u2028')
      expect(bytes).toContain('\\u2029')
      expect(JSON.parse(bytes)[0].tenants[0].name).toBe(name)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})


describe('[TC-F42-056] Blog target deployment readiness', () => {
  it.each(['blogs', 'blog_categories'] as const)('preserves cross-tenant %s and flags target migration in both store summaries', (root) => {
    // Arrange
    const first = store('1'), second = store('2'), diagnostics: Diagnostic[] = []
    first[root].push({ _ref: `@${root}:source:11`, slug: 'same' })
    second[root].push({ _ref: `@${root}:source:21`, slug: 'same' })
    const original = structuredClone([first, second])
    // Act
    quarantineProductCollisions([first, second], diagnostics)
    const summaries = storeSummaries([first, second], diagnostics, [], [])
    // Assert
    expect([first, second]).toEqual(original)
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.map(item => item.code)).toEqual(Array(2).fill('TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED'))
    expect(diagnostics.map(item => item.table)).toEqual([root, root])
    expect(summaries.map(item => item.targetConstraintCodes)).toEqual(Array(2).fill(['TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED']))
    expect(summaries.map(item => item.otherBlockerCodes)).toEqual([[], []])
    expect(summaries.map(item => item.mappingStatus)).toEqual(['needs_review', 'needs_review'])
  })

  it('does not treat reuse across different collections as a target collision', () => {
    // Arrange
    const first = store('1'), second = store('2'), diagnostics: Diagnostic[] = []
    first.blogs.push({ _ref: '@blogs:source:11', slug: 'same' })
    second.blog_categories.push({ _ref: '@blog_categories:source:21', slug: 'same' })
    // Act
    quarantineProductCollisions([first, second], diagnostics)
    // Assert
    expect(diagnostics).toEqual([])
  })
})


describe('[TC-F42-074] historical Orders survive catalog quarantine', () => {
  const policy = { decisionEvidence: 'Keep original Orders', preserveHistoricalOrders: true, activeCatalogOnly: false, deferEmailTemplates: false, allowSparseVariants: false, preserveUserCreators: false, siteTypeDefault: 'ecommerce' as const, siteTypeOverrides: {}, shippingPolicy: 'review' as const }
  it('omits only the conflicting Product link and retains the full historical item and Order', () => {
    // Arrange
    const output = store('1')
    const diagnostics: Diagnostic[] = []
    output.products.push({ _ref: '@products:products:11', slug: 'same' }, { _ref: '@products:products:12', slug: 'same' })
    output.orders.push({ _ref: '@orders:orders:31', orderNumber: 'original', total: 14.5, items: [{ product: '@products:products:11', productName: 'Historical title', variant: 'Old variant', quantity: 2, unitPrice: 7.25 }] })
    // Act
    quarantineProductCollisions([output], diagnostics, policy)
    // Assert
    expect(output.products).toEqual([])
    expect(output.orders).toEqual([{ _ref: '@orders:orders:31', orderNumber: 'original', total: 14.5, items: [{ productName: 'Historical title', variant: 'Old variant', quantity: 2, unitPrice: 7.25 }] }])
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED', severity: 'warning' }))
    expect(operationalIssues([output], undefined, policy)).toEqual([])
    expect(operationalIssues([output])).toContainEqual(expect.objectContaining({ code: 'ORDER_ITEM_SNAPSHOT_POLICY_REQUIRED' }))
  })
  it('does not hide a dangling Product reference under snapshot policy', () => {
    // Arrange
    const output = store('1')
    output.orders.push({ _ref: '@orders:orders:31', orderNumber: 'original', items: [{ product: '@products:products:404' }] })
    // Act
    const issues = operationalIssues([output], undefined, policy)
    // Assert
    expect(issues.length).toBeGreaterThan(0)
  })
})
