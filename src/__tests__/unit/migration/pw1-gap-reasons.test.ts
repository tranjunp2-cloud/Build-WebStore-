// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { rawRow, settings } from '@/lib/migration/pw1-export/mappers/raw'
import { mapCatalog } from '@/lib/migration/pw1-export/mappers/catalog'
import { buildProductCatalogFromSource } from '@/lib/migration/pw2-product-eav.mjs'

function context(tables: Record<string, Row[]> = {}) {
  const config = sourceConfigSchema.parse({
    version: 1,
    sourceInstance: 'fixture',
    sourceDatabase: 'fixture',
    sourceInstanceToken: 'fixture',
    snapshotId: 'one',
    asOf: '2026-01-01T00:00:00Z',
    utcOffset: '+00:00',
    sourcePlatformSuffix: 'old.test',
    targetPlatformSuffix: 'new.test',
    tables: { stores: 'stores.csv' },
    deletedStores: 'review',
  })
  return new SourceIndex(tables).context(config, '10', emptyStore(), [], [])
}
const setting: Row = {
  id: '1',
  model_type: 'App\\Models\\Store',
  model_id: '10',
  store_id: null,
  key: 'title',
  value: 'Display',
}

describe('[TC-F42-060] Store setting ownership resolution', () => {
  it('retains source row and records evidence only for an exact live Store model', () => {
    // Arrange
    const ctx = context({ stores: [{ id: '10' }], model_settings: [setting] })
    const original = structuredClone(setting)
    // Act
    const result = settings(ctx, 'Store', '10', 'settings')
    // Assert
    expect(result).toEqual([original])
    expect(setting).toEqual(original)
    expect(ctx.diagnostics).toEqual([
      expect.objectContaining({
        code: 'RAW_OWNERSHIP_RESOLVED_FROM_STORE_MODEL',
        severity: 'warning',
      }),
    ])
    expect(ctx.contributions).toContainEqual(
      expect.objectContaining({
        fields: ['model_type', 'model_id'],
        rule: 'MASTER_RAW_STORE_MODEL_OWNERSHIP',
      }),
    )
  })
  it.each([
    ['missing Store', [], setting, 'Store', '10', 'RAW_OWNERSHIP_MISSING'],
    [
      'deleted Store',
      [{ id: '10', deleted_at: '2020-01-01' }],
      setting,
      'Store',
      '10',
      'RAW_OWNERSHIP_MISSING',
    ],
    [
      'conflicting owner',
      [{ id: '10' }],
      { ...setting, store_id: '11' },
      'Store',
      '10',
      'RAW_OWNERSHIP_MISMATCH',
    ],
    [
      'different Store',
      [{ id: '10' }, { id: '11' }],
      { ...setting, model_id: '11' },
      'Store',
      '11',
      'RAW_OWNERSHIP_MISSING',
    ],
    [
      'other model',
      [{ id: '10' }],
      { ...setting, model_type: 'App\\Models\\Page' },
      'Page',
      '10',
      'RAW_OWNERSHIP_MISSING',
    ],
  ] as const)(
    'does not infer ownership for %s',
    (_name, stores, row, model, id, code) => {
      // Arrange
      const ctx = context({ stores: [...stores], model_settings: [row] })
      // Act
      const result = settings(ctx, model, id, 'settings')
      // Assert
      expect(result).toEqual([])
      expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code }))
      expect(ctx.contributions).toEqual([])
    },
  )
})

describe('[TC-F42-061] Scoped raw grammar and safe reasons', () => {
  it.each([
    ['{"token":"fixture-secret"}', 'SECRET_CONTENT'],
    ['{"unverified_field":1}', 'UNKNOWN_STRUCTURE_KEY'],
    ['{"name":', 'INVALID_JSON'],
    ['https://example.test/image?custom=fixture-secret', 'UNSAFE_URL'],
  ])(
    'classifies rejection without exposing raw input (%s)',
    (value, reason) => {
      // Arrange
      const ctx = context()
      // Act
      const result = rawRow(
        ctx,
        'stores',
        { id: '1', social_channel: value },
        'raw',
      )
      // Assert
      expect(result).not.toHaveProperty('social_channel')
      expect(ctx.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'RAW_VALUE_UNVERIFIED', reason }),
      )
      expect(JSON.stringify(ctx.diagnostics)).not.toContain('fixture-secret')
      expect(JSON.stringify(ctx.diagnostics)).not.toContain('unverified_field')
    },
  )
  it('separates unknown setting keys from invalid supported settings', () => {
    // Arrange
    const ctx = context()
    // Act
    rawRow(
      ctx,
      'model_settings',
      { id: '1', key: 'unknown', value: 'opaque' },
      'raw',
    )
    rawRow(
      ctx,
      'model_settings',
      { id: '2', key: 'per_page', value: 'twenty' },
      'raw',
    )
    // Assert
    expect(ctx.diagnostics.map(({ reason }) => reason)).toEqual([
      'UNKNOWN_SETTING_KEY',
      'INVALID_SETTING_VALUE',
    ])
  })
  it('allows verified template/menu declarations only on their source fields', () => {
    // Arrange
    const ctx = context()
    const config =
      '{"component":{"banner":{"images":{"schema":{"button":{"required_if":{"images.*.button.status":1},"default_value":0}}}}}}'
    // Act
    const template = rawRow(
      ctx,
      'frontend_templates',
      { id: '1', config },
      'raw',
    )
    const store = rawRow(
      ctx,
      'stores',
      { id: '2', social_channel: config },
      'raw',
    )
    const menu = rawRow(
      ctx,
      'menu_line_types',
      { id: '3', config: '{"content_ms":{"type":"text"}}' },
      'raw',
    )
    const secret = rawRow(
      ctx,
      'frontend_templates',
      { id: '4', config: '{"component":{"token":"fixture-secret"}}' },
      'raw',
    )
    // Assert
    expect(template.config).toBe(config)
    expect(store).not.toHaveProperty('social_channel')
    expect(menu).toHaveProperty('config')
    expect(secret).not.toHaveProperty('config')
  })
  it('allows public navigation queries without widening media or signed URL policy', () => {
    // Arrange
    const ctx = context()
    const url = 'https://example.test/catalog?page=2'
    // Act
    const row = rawRow(ctx, 'banners', { id: '1', url, image: url }, 'raw')
    const signed = rawRow(
      ctx,
      'banners',
      { id: '2', url: 'https://example.test/?token=fixture-secret' },
      'raw',
    )
    // Assert
    expect(row.url).toBe(url)
    expect(row).not.toHaveProperty('image')
    expect(signed).not.toHaveProperty('url')
  })
})

const category = (id: string, extra: Row = {}): Row => ({
  id,
  store_id: '10',
  name: `Category ${id}`,
  slug: `category-${id}`,
  status: '1',
  created_at: '2024-01-01 00:00:00',
  updated_at: '2024-01-01 00:00:00',
  ...extra,
})
describe('[TC-F42-062] Catalog reason classification preserves quarantine', () => {
  it.each([
    [[category('1', { name: '' })], '1', 'REQUIRED_FIELD_MISSING'],
    [
      [category('1', { parent_id: '99' })],
      '1',
      'PARENT_MISSING_OR_NOT_LIVE_IN_STORE',
    ],
    [[category('1', { parent_id: '1' })], '1', 'PARENT_CYCLE'],
    [
      [
        category('1'),
        category('2', { parent_id: '1' }),
        category('3', { parent_id: '2' }),
        category('4', { parent_id: '3' }),
      ],
      '4',
      'TARGET_DEPTH_LIMIT',
    ],
    [
      [category('1'), category('2', { slug: 'category-1' })],
      '1',
      'DUPLICATE_SLUG_IN_STORE',
    ],
    [
      [category('1'), category('2', { name: 'Category 1' })],
      '1',
      'DUPLICATE_SIBLING_NAME',
    ],
    [
      [category('1', { created_at: 'invalid' })],
      '1',
      'TIMESTAMP_OR_MAPPING_INVALID',
    ],
  ] as const)(
    'keeps a safe reason for category %s',
    (rows, sourceId, reason) => {
      // Arrange
      const ctx = context({ categories: [...rows] })
      // Act
      mapCatalog(ctx)
      // Assert
      expect(ctx.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'CATEGORY_INVALID', sourceId, reason }),
      )
      expect(
        ctx.output.categories.some(
          (doc) => doc._ref === `@categories:categories:${sourceId}`,
        ),
      ).toBe(false)
    },
  )
  it.each([
    [[], 'NO_SKU_ROWS'],
    [
      [{ id: '1', product_id: '1', store_id: '10', status: '0' }],
      'ALL_LIVE_OWNED_SKUS_INACTIVE',
    ],
    [
      [
        {
          id: '1',
          product_id: '1',
          store_id: '10',
          status: '1',
          deleted_at: '2020-01-01',
        },
      ],
      'NO_LIVE_OWNED_SKU',
    ],
    [
      [{ id: '1', product_id: '1', store_id: '11', status: '1' }],
      'NO_LIVE_OWNED_SKU',
    ],
    [
      [{ id: '1', product_id: '1', store_id: '10', status: '9' }],
      'LIVE_OWNED_SKU_STATUS_INVALID',
    ],
  ] as const)('does not synthesize eligible SKUs for %s', (rows, reason) => {
    // Arrange
    const product = { id: '1', store_id: '10' }
    // Act
    const result = buildProductCatalogFromSource(
      product,
      { product_skus: [...rows] },
      'fixture',
    )
    // Assert
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'SOURCE_NO_ELIGIBLE_SKU', reason }),
    )
    expect(result.eligibleSkuCount).toBe(0)
    expect(result.skuCrosswalk).toEqual([])
  })
})

// Navigation validation must not treat polymorphic ownership metadata as a URL.
describe('[TC-F42-061] Raw navigation field boundaries', () => {
  it('keeps MenuLine owner metadata and checks every URL in navigation arrays', () => {
    // Arrange
    const ctx = context()
    const row = {
      id: '1',
      model_type: 'App\\Models\\MenuLine',
      model_id: '30',
      store_id: '10',
      key: 'items.0.url',
      value: '/catalog?page=2',
    }
    // Act
    const result = rawRow(ctx, 'model_settings', row, 'raw')
    const valid = rawRow(
      ctx,
      'banners',
      { id: '2', url: '["/catalog?page=2","#details"]' },
      'raw',
    )
    const unsafe = rawRow(
      ctx,
      'banners',
      { id: '3', url: '["javascript:alert(1)"]' },
      'raw',
    )
    // Assert
    expect(result).toEqual(row)
    expect(valid).toHaveProperty('url')
    expect(unsafe).not.toHaveProperty('url')
    expect(ctx.diagnostics).toContainEqual(
      expect.objectContaining({ sourceId: '3', reason: 'UNSAFE_URL' }),
    )
  })
})
