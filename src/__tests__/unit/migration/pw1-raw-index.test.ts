import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { rawChildren, settings } from '@/lib/migration/pw1-export/mappers/raw'

function context(tables: Record<string, Row[]>, storeId = '10') {
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
  return new SourceIndex(tables).context(config, storeId, emptyStore(), [], [])
}

describe('TC-F42-EXP-012: indexed raw relationships preserve export semantics', () => {
  it('TC-F42-EXP-112: preserves settings across snapshots, exact IDs and model types', () => {
    // Arrange
    const first = context({
      model_settings: [
        {
          id: '1',
          model_type: 'App\\Models\\Page',
          model_id: '01',
          store_id: '10',
          key: 'title',
          value: 'First',
        },
        {
          id: '2',
          model_type: 'App\\Models\\PageComponent',
          model_id: '01',
          store_id: '10',
          key: 'title',
          value: 'Component',
        },
        {
          id: '3',
          model_type: 'App\\Models\\Page',
          model_id: '1',
          store_id: '10',
          key: 'title',
          value: 'Numeric-looking',
        },
      ],
    })
    const second = context({
      model_settings: [
        {
          id: '1',
          model_type: 'App\\Models\\Page',
          model_id: '01',
          store_id: '10',
          key: 'title',
          value: 'Second',
        },
      ],
    })
    // Act
    const outputs = [
      settings(first, 'Page', '01', 'a'),
      settings(second, 'Page', '01', 'b'),
      settings(first, 'PageComponent', '01', 'c'),
    ]
    // Assert
    expect(outputs).toEqual([[first.tables.model_settings[0]], [second.tables.model_settings[0]], [first.tables.model_settings[1]]])
    expect(settings(first, 'Page', '1', 'd')).toEqual([first.tables.model_settings[2]])
    for (const ctx of [first, second]) {
      expect(ctx.diagnostics).toEqual([])
      expect(ctx.contributions.length).toBeGreaterThan(0)
    }
  })

  it('TC-F42-EXP-112: preserves matching settings without leaking direct foreign Store rows', () => {
    // Arrange
    const tables = {
      model_settings: [
        {
          id: '1',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          store_id: '10',
          key: 'title',
          value: 'Own',
        },
        {
          id: '2',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          store_id: '',
          key: 'title',
          value: 'Missing',
        },
        {
          id: '3',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          store_id: '11',
          key: 'title',
          value: 'Other',
        },
      ],
    }
    const own = context(tables),
      other = context(tables, '11')
    // Act
    const ownRows = settings(own, 'Page', '30', 'first')
    const otherRows = settings(other, 'Page', '30', 'second')
    // Assert
    expect(ownRows).toEqual(tables.model_settings.slice(0, 2))
    expect(otherRows).toEqual(tables.model_settings.slice(1))
    for (const ctx of [own, other]) {
      expect(ctx.diagnostics).toEqual([])
      expect(ctx.contributions.length).toBeGreaterThan(0)
    }
  })

  it('preserves deleted children, position/ID order, ownership diagnostics and fresh outputs', () => {
    // Arrange
    const rows: Row[] = [
      {
        id: '10',
        page_component_id: '30',
        store_id: '10',
        position: '2',
        name: 'Later',
        deleted_at: '2020-01-01',
      },
      {
        id: '3',
        page_component_id: '30',
        store_id: '',
        position: '1',
        name: 'Missing owner allowed by existing child rule',
      },
      {
        id: '2',
        page_component_id: '30',
        store_id: '10',
        position: '1',
        name: 'First',
      },
      {
        id: '4',
        page_component_id: '30',
        store_id: '11',
        position: '3',
        name: 'Foreign',
      },
      {
        id: '5',
        page_component_id: '030',
        store_id: '10',
        name: 'Different parent',
      },
    ]
    const ctx = context({ banners: rows })
    // Act
    const first = rawChildren(
      ctx,
      'banners',
      'page_component_id',
      '30',
      'first',
    )
    first[0].name = 'Decorated'
    first[0].nested = { changed: true }
    const second = rawChildren(
      ctx,
      'banners',
      'page_component_id',
      '30',
      'second',
    )
    // Assert
    expect(second.map(({ id }) => id)).toEqual(['2', '3', '10'])
    expect(second[0]).toMatchObject({ name: 'First' })
    expect(second[0]).not.toHaveProperty('nested')
    expect(second[2].deleted_at).toBe('2020-01-01')
    expect(rows.map(({ id }) => id)).toEqual(['10', '3', '2', '4', '5'])
    expect(ctx.diagnostics.map(({ code }) => code)).toEqual([
      'RAW_OWNERSHIP_MISMATCH',
      'RAW_OWNERSHIP_MISMATCH',
    ])
    expect(ctx.contributions.map(({ targetPath }) => targetPath)).toEqual([
      'first',
      'first',
      'first',
      'second',
      'second',
      'second',
    ])
  })
})
