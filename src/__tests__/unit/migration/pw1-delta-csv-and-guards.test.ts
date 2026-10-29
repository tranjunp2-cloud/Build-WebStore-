// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeCsvText, snapshotTableName, type CsvTableStats } from '@/lib/migration/pw1-delta/csv-normalize'
import { snapshotIssues } from '@/lib/migration/pw1-delta/input-guards'
import { assertDirectConnection } from '@/lib/migration/pw1-delta/ledger-lookup'

describe('[TC-F42-DELTA-01] CSV quote-prefix normalization', () => {
  it('strips the spreadsheet quote only before = + - @ and keeps every other byte', () => {
    // Arrange
    const text = '﻿id,phone,slug,note\r\n1,\'+6012,"\'-1","\'abc"\r\n2,"line\nbreak ""q""",\'@x,\'=1\r\n3,,,\'plain'
    // Act
    const result = normalizeCsvText(text)
    // Assert
    expect(result.text).toBe('﻿id,phone,slug,note\r\n1,+6012,"-1","\'abc"\r\n2,"line\nbreak ""q""",@x,=1\r\n3,,,\'plain')
    expect(result.headers).toEqual(['id', 'phone', 'slug', 'note'])
    expect(result.rowCount).toBe(3)
    expect(result.fixes).toEqual([
      { row: 1, id: '1', column: 'phone' }, { row: 1, id: '1', column: 'slug' },
      { row: 2, id: '2', column: 'slug' }, { row: 2, id: '2', column: 'note' },
    ])
  })

  it('never touches the header and can be disabled', () => {
    // Arrange
    const text = "id,'-x\n1,'-1\n"
    // Act
    const stripped = normalizeCsvText(text), kept = normalizeCsvText(text, false)
    // Assert
    expect(stripped.text).toBe("id,'-x\n1,-1\n")
    expect(kept.text).toBe(text)
    expect(kept.fixes).toEqual([])
  })

  it('counts duplicate and empty ids and rejects an unterminated quote', () => {
    // Arrange
    const text = 'id,name\n1,a\n1,b\n,c\n'
    // Act
    const result = normalizeCsvText(text)
    // Assert
    expect(result).toMatchObject({ rowCount: 3, duplicateIds: 1, emptyIds: 1 })
    expect(() => normalizeCsvText('id\n"1')).toThrow('CSV_UNTERMINATED_QUOTE')
  })

  it('reads table name and date from the snapshot file name', () => {
    expect(snapshotTableName('products_202609161353.csv')).toEqual({ table: 'products', date: '20260916' })
    expect(snapshotTableName('_attributes__20261028.csv')).toEqual({ table: 'attributes', date: '20261028' })
    expect(snapshotTableName('products.csv')).toBeNull()
  })
})

const table = (name: string, overrides: Partial<CsvTableStats> = {}): CsvTableStats => ({
  table: name, file: `${name}_20260916.csv`, date: '20260916', headers: ['id', 'name'], rowCount: 1000, duplicateIds: 0, emptyIds: 0, ...overrides,
})

describe('[TC-F42-DELTA-02] Snapshot input guards', () => {
  it('accepts two consistent snapshots', () => {
    const issues = snapshotIssues({ tables: [table('stores')], unrecognized: [] }, { tables: [table('stores', { date: '20261028' })], unrecognized: [] }, ['stores'])
    expect(issues).toEqual([])
  })

  it('reports every problem of the new snapshot', () => {
    // Arrange
    const old = { tables: [table('stores'), table('users')], unrecognized: [] }
    const next = {
      tables: [
        table('stores', { date: '20261028', headers: ['id', 'title'], rowCount: 500, duplicateIds: 2 }),
        table('users', { date: '20261027' }), table('users', { date: '20261028' }), table('legacy', { date: '20261028' }),
      ],
      unrecognized: ['stores.csv'],
    }
    // Act
    const codes = snapshotIssues(old, next, ['stores', 'users', 'products']).map(issue => `${issue.code}:${issue.side}:${issue.table ?? ''}`)
    // Assert
    expect(codes).toEqual(expect.arrayContaining([
      'INPUT_FILENAME_INVALID:new:', 'INPUT_MIXED_DATES:new:', 'INPUT_TABLE_DUPLICATE:new:users', 'INPUT_TABLE_UNEXPECTED:new:legacy',
      'INPUT_TABLE_MISSING:new:products', 'INPUT_TABLE_MISSING:old:products', 'INPUT_HEADER_CHANGED:new:stores',
      'INPUT_ID_INVALID:new:stores', 'INPUT_ROWCOUNT_DROP:new:stores',
    ]))
  })

  it('ignores row drops on small tables', () => {
    const issues = snapshotIssues({ tables: [table('roles', { rowCount: 50 })], unrecognized: [] }, { tables: [table('roles', { rowCount: 10 })], unrecognized: [] }, ['roles'])
    expect(issues).toEqual([])
  })

  it('[TC-F42-DELTA-06] checks only the new snapshot when --old is not given', () => {
    // Arrange
    const next = { tables: [table('stores')], unrecognized: ['notes.csv'] }
    // Act
    const codes = snapshotIssues(null, next, ['stores', 'users']).map(issue => `${issue.code}:${issue.side}:${issue.table ?? ''}`)
    // Assert
    expect(codes).toEqual(['INPUT_FILENAME_INVALID:new:', 'INPUT_TABLE_MISSING:new:users'])
  })

  it('[TC-F42-DELTA-02] ignores row drops in archive tables that never reach PW2', () => {
    // Arrange
    const old = { tables: [table('role_has_permissions', { rowCount: 270 })], unrecognized: [] }
    const next = { tables: [table('role_has_permissions', { rowCount: 144 })], unrecognized: [] }
    // Act
    const issues = snapshotIssues(old, next, ['role_has_permissions'])
    // Assert
    expect(issues).toEqual([])
  })
})

describe('[TC-F42-DELTA-02] Database connection guard', () => {
  it('rejects a Neon pooled (-pooler) DATABASE_URI and accepts the direct one', () => {
    // Arrange
    const pooled = 'postgresql://u:p@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    const direct = 'postgresql://u:p@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    // Act + Assert
    expect(() => assertDirectConnection(pooled)).toThrow('POOLED_DATABASE_URI')
    expect(() => assertDirectConnection(direct)).not.toThrow()
    expect(() => assertDirectConnection('postgresql://u:p@localhost:5433/primeweb')).not.toThrow()
  })
})
