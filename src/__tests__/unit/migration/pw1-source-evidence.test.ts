import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { evidenceHmacKey, SOURCE_EVIDENCE_MAX_LINE_CHARS, sourceEvidenceChunks, sourceEvidenceRow, validateSourceEvidence } from '@/lib/migration/pw1-export/source-evidence'
import type { LoadedSource } from '@/lib/migration/pw1-export/csv-loader'
import type { RowDisposition } from '@/lib/migration/pw1-export/source-dispositions'

const source = {
  tables: {
    products: [{ id: '10', store_id: '205', name: 'Safe product', slug: 'safe-product', stock: '0', password: 'never-export' }],
    customers: [{ id: '20', store_id: '205', name: 'Alice Example', email: 'alice@example.com', phone: '+60123456789' }],
  },
  files: [{ table: 'products', filename: 'products.csv', sha256: 'a'.repeat(64), bytes: 20, selected: true, rowCount: 1, headers: ['id', 'store_id', 'name', 'slug', 'stock'] }],
  config: { sourceInstance: 'PW1QA', snapshotId: 'snap-1', asOf: '2026-09-30T00:00:00Z' },
} as LoadedSource

const product = {
  table: 'products', sourceId: '10', storeId: '205', record: 1,
  disposition: 'retained-source', fields: { name: 'retained-source', slug: 'retained-source', stock: 'retained-source' },
  contributions: [],
} as RowDisposition

const customer = {
  table: 'customers', sourceId: '20', storeId: '205', record: 1,
  disposition: 'mapped', fields: { name: 'mapped', email: 'mapped', phone: 'mapped' },
  contributions: [],
} as RowDisposition

describe('[TC-F42-EXP-114] source evidence sidecar', () => {
  it('derives a stable evidence key separate from the migration secret', () => {
    // Arrange
    const secret = 'test-only-migration-secret-with-at-least-32-characters'

    // Act
    const first = evidenceHmacKey(secret)
    const second = evidenceHmacKey(secret)

    // Assert
    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).not.toBe(secret)
    expect(evidenceHmacKey(undefined)).toBeUndefined()
    expect(() => evidenceHmacKey('short')).toThrow('MIGRATION_SECRET_TOO_SHORT_FOR_EVIDENCE')
  })

  it('keeps an excluded source record and only approved safe fields', () => {
    // Arrange
    const key = 'test-only-hmac-key-with-at-least-32-characters'

    // Act
    const row = sourceEvidenceRow(source, product, key)

    // Assert
    expect(row.disposition).toBe('retained-source')
    expect(row.fields.stock.display).toBe('0')
    expect(JSON.stringify(row)).not.toContain('never-export')
    expect(row.fields.password).toBeUndefined()
  })

  it('masks Customer identity and binds selected CSV hash', () => {
    // Arrange
    const key = 'test-only-hmac-key-with-at-least-32-characters'

    // Act
    const lines = [...sourceEvidenceChunks(source, [product, customer], key)]
    const header = JSON.parse(lines[0]) as { selectedFiles: Array<{ sha256: string }>; piiComparable: boolean }
    const record = JSON.parse(lines[2]) as { fields: Record<string, { display: string | null; fingerprint: string | null }> }

    // Assert
    expect(header.selectedFiles[0].sha256).toBe('a'.repeat(64))
    expect(header.piiComparable).toBe(true)
    expect(record.fields.email.display).toBeNull()
    expect(record.fields.email.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(lines.join('')).not.toContain('alice@example.com')
  })

  it('normalizes Customer email before keyed fingerprinting without displaying it', () => {
    // Arrange
    const key = 'test-only-hmac-key-with-at-least-32-characters'
    const upper = { ...source, tables: { ...source.tables, customers: [{
      id: '20', store_id: '205', name: 'Alice Example', email: ' Alice@Example.COM ', phone: '+60123456789',
    }] } } as LoadedSource
    const lower = { ...source, tables: { ...source.tables, customers: [{
      id: '20', store_id: '205', name: 'Alice Example', email: 'alice@example.com', phone: '+60123456789',
    }] } } as LoadedSource
    // Act
    const a = sourceEvidenceRow(upper, customer, key).fields.email
    const b = sourceEvidenceRow(lower, customer, key).fields.email

    // Assert
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.display).toBeNull()
    expect(b.display).toBeNull()
  })

  it('does not claim sensitive comparison without a key', () => {
    // Arrange
    const rows = [customer]

    // Act
    const lines = [...sourceEvidenceChunks(source, rows, undefined)]
    const header = JSON.parse(lines[0]) as { piiComparable: boolean }
    const record = JSON.parse(lines[1]) as { fields: Record<string, { fingerprint: string | null }> }

    // Assert
    expect(header.piiComparable).toBe(false)
    expect(record.fields.email.fingerprint).toBeNull()
  })

  it('rejects a sidecar/report that silently omits a selected CSV row', async () => {
    // Arrange: both report and sidecar omit row 2; the selected CSV inventory says 2.
    const root = await mkdtemp(path.join(tmpdir(), 'pw1-source-count-'))
    try {
      const selected = { ...source, files: [{ ...source.files[0], rowCount: 2 }] } as LoadedSource
      const filename = path.join(root, 'source-evidence.ndjson')
      await writeFile(filename, [...sourceEvidenceChunks(selected, [product], undefined)].join(''))
      const manifest = { sourceSnapshot: {
        sourceInstance: selected.config.sourceInstance, snapshotId: selected.config.snapshotId,
        asOf: selected.config.asOf,
      }, files: selected.files.map(file => ({ table: file.table, selected: file.selected,
        sha256: file.sha256, rowCount: file.rowCount })) }

      // Act / Assert
      await expect(validateSourceEvidence(filename, manifest, [product]))
        .rejects.toThrow('SOURCE_EVIDENCE_SOURCE_COUNT_MISMATCH')
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  it('validates a legitimate source row with many target contribution paths', async () => {
    // Arrange: real menu lineage can make one NDJSON line exceed 64 KiB.
    const root = await mkdtemp(path.join(tmpdir(), 'pw1-source-wide-'))
    try {
      const filename = path.join(root, 'source-evidence.ndjson')
      const wide = { ...product, contributions: Array.from({ length: 800 }, (_, index) => ({
        targetPath: `@products:products:10.items.${index}`, rule: 'reviewed-lineage', fields: ['name'],
      })) } as RowDisposition
      const lines = [...sourceEvidenceChunks(source, [wide], undefined)]
      expect(lines[1].length).toBeGreaterThan(65536)
      expect(lines[1].length).toBeLessThan(SOURCE_EVIDENCE_MAX_LINE_CHARS)
      await writeFile(filename, lines.join(''))
      const manifest = { sourceSnapshot: {
        sourceInstance: source.config.sourceInstance, snapshotId: source.config.snapshotId,
        asOf: source.config.asOf,
      }, files: source.files.map(file => ({ table: file.table, selected: file.selected,
        sha256: file.sha256, rowCount: file.rowCount })) }

      // Act / Assert
      await expect(validateSourceEvidence(filename, manifest, [wide])).resolves.toBeUndefined()
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
