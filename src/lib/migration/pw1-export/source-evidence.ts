import { createHmac, hkdfSync } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { LoadedSource } from './csv-loader'
import type { RowDisposition } from './source-dispositions'

/** Only fields reviewed for QC evidence may leave the private CSV snapshot. */
export const SOURCE_EVIDENCE_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  products: ['name', 'slug', 'status', 'category_id', 'stock', 'package_weight', 'package_weight_type', 'package_length', 'package_width', 'package_height', 'package_dimension_type'],
  product_skus: ['sku', 'price', 'cost', 'stock', 'status', 'product_id'],
  product_images: ['product_id', 'url', 'signature', 'order'],
  orders: ['code', 'currency_id', 'sub_total', 'total_discount', 'total_shipping', 'total_tax', 'total', 'status', 'purchase_status', 'payment_method_id', 'refund_status', 'customer_id'],
  order_details: ['order_id', 'product_sku_id', 'quantity', 'price', 'total_price'],
  customers: ['name', 'email', 'phone'],
  addresses: ['customer_id'],
  promotion_codes: ['code', 'promotion_id'],
  promotions: ['discount_type_id', 'discount_value', 'start_date', 'end_date', 'status'],
  stores: ['name', 'currency_id'],
  store_email_templates: ['name', 'subject', 'status'],
  categories: ['name', 'slug', 'parent_id'],
  currencies: ['code'],
  payment_methods: ['code'],
  store_domains: ['domain'],
  pages: ['name', 'slug'],
  blog_posts: ['name', 'slug', 'status'],
})

// One source row can legitimately contribute to thousands of target paths.
// Keep a finite bound while allowing reviewed menu lineage receipts.
export const SOURCE_EVIDENCE_MAX_LINE_CHARS = 4 * 1024 * 1024

const PRIVATE_FIELDS = new Set(['name', 'email', 'phone', 'code', 'subject'])
const PRIVATE_TABLES = new Set(['customers', 'orders', 'promotion_codes', 'store_email_templates', 'stores'])
const URL_FIELDS = new Set(['url', 'signature'])

/** Separate evidence fingerprints from the credential-sidecar encryption purpose. */
export function evidenceHmacKey(migrationSecret: string | undefined): string | undefined {
  if (!migrationSecret) return undefined
  if (Buffer.byteLength(migrationSecret, 'utf8') < 32) throw new Error('MIGRATION_SECRET_TOO_SHORT_FOR_EVIDENCE')
  return Buffer.from(hkdfSync('sha256', Buffer.from(migrationSecret), Buffer.from('pw1-field-evidence-v1'),
    Buffer.from('source-target-fingerprints'), 32)).toString('hex')
}

export type SourceEvidenceField = {
  presence: 'absent' | 'null' | 'empty' | 'value'
  display: string | null
  fingerprint: string | null
  disposition: string
}

export type SourceEvidenceRow = {
  kind: 'row'
  table: string
  sourceId: string
  storeId: string | null
  record: number
  disposition: RowDisposition['disposition']
  targetPaths: Array<{ path: string; rule: string; fields: string[] }>
  redactedFieldCount: number
  fields: Record<string, SourceEvidenceField>
}

function safeDisplay(table: string, field: string, value: string): string | null {
  if (PRIVATE_TABLES.has(table) && PRIVATE_FIELDS.has(field)) return null
  if (URL_FIELDS.has(field)) return null
  if (value.length > 240 || /[\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

/** Keyed fingerprints prevent offline guessing of low-entropy PII and prices. */
function fingerprint(key: string | undefined, table: string, field: string, value: string | null): string | null {
  if (!key) return null
  const canonical = table === 'promotion_codes' && field === 'code' && value !== null
    ? value.trim().toUpperCase()
    : table === 'customers' && field === 'email' && value !== null
    ? value.trim().toLowerCase() : value
  return createHmac('sha256', key).update(JSON.stringify([table, field, canonical])).digest('hex')
}

export function evidenceKeyId(key: string | undefined): string | null {
  return key ? createHmac('sha256', key).update('pw1-field-evidence-key-id-v1').digest('hex') : null
}

export function sourceEvidenceRow(
  source: LoadedSource,
  disposition: RowDisposition,
  hmacKey: string | undefined,
): SourceEvidenceRow {
  const row = source.tables[disposition.table]?.[disposition.record - 1]
  if (!row || (row.id ?? `record:${disposition.record}`) !== disposition.sourceId) {
    throw new Error('SOURCE_EVIDENCE_ROW_IDENTITY_MISMATCH')
  }
  const fields: Record<string, SourceEvidenceField> = Object.create(null)
  const approved = new Set(SOURCE_EVIDENCE_FIELDS[disposition.table] ?? [])
  const names = [...new Set([...Object.keys(disposition.fields), ...approved])]
  let redactedFieldCount = 0
  for (const field of names) {
    if (disposition.fields[field] === 'security-excluded') { redactedFieldCount++; continue }
    const raw = row[field]
    const presence = raw === undefined ? 'absent' : raw === null ? 'null' : raw === '' ? 'empty' : 'value'
    fields[field] = {
      presence,
      display: approved.has(field) && typeof raw === 'string' ? safeDisplay(disposition.table, field, raw) : null,
      fingerprint: approved.has(field) && presence !== 'absent' ? fingerprint(hmacKey, disposition.table, field, raw ?? null) : null,
      disposition: disposition.fields[field] ?? 'unverified',
    }
  }
  return {
    kind: 'row', table: disposition.table, sourceId: disposition.sourceId,
    storeId: disposition.storeId, record: disposition.record,
    disposition: disposition.disposition,
    targetPaths: disposition.contributions.map(item => ({ path: item.targetPath, rule: item.rule, fields: item.fields })),
    redactedFieldCount,
    fields,
  }
}

/** Stream rows: a full production export must not duplicate the CSV in memory. */
export function* sourceEvidenceChunks(
  source: LoadedSource,
  dispositions: Iterable<RowDisposition>,
  hmacKey: string | undefined,
): Generator<string> {
  if (hmacKey && Buffer.byteLength(hmacKey, 'utf8') < 32) throw new Error('SOURCE_EVIDENCE_HMAC_KEY_TOO_SHORT')
  yield JSON.stringify({
    kind: 'header', version: 3, sourceInstance: source.config.sourceInstance,
    snapshotId: source.config.snapshotId, asOf: source.config.asOf,
    selectedFiles: source.files.filter(file => file.selected).map(file => ({ table: file.table, sha256: file.sha256, rowCount: file.rowCount })),
    piiComparable: Boolean(hmacKey), keyId: evidenceKeyId(hmacKey),
  }) + '\n'
  for (const disposition of dispositions) {
    yield JSON.stringify(sourceEvidenceRow(source, disposition, hmacKey)) + '\n'
  }
}

type EvidenceManifest = {
  sourceSnapshot: { sourceInstance: string; snapshotId: string; asOf: string }
  files: Array<{ table?: string; selected: boolean; sha256: string; rowCount: number | null }>
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Cross-check sidecar identity and coverage against the independent mapping report. */
export async function validateSourceEvidence(
  filename: string,
  manifest: EvidenceManifest,
  reportRows: readonly Pick<RowDisposition, 'table' | 'sourceId' | 'storeId' | 'record' | 'disposition' | 'fields' | 'contributions'>[],
): Promise<void> {
  const lines = createInterface({ input: createReadStream(filename, { encoding: 'utf8' }), crlfDelay: Infinity })
  let index = -1
  const rowsByTable = new Map<string, number>()
  for await (const line of lines) {
    if (!line || line.length > SOURCE_EVIDENCE_MAX_LINE_CHARS) throw new Error('SOURCE_EVIDENCE_LINE_INVALID')
    let parsed: unknown
    try { parsed = JSON.parse(line) } catch { throw new Error('SOURCE_EVIDENCE_JSON_INVALID') }
    if (!record(parsed)) throw new Error('SOURCE_EVIDENCE_SHAPE_INVALID')
    if (index === -1) {
      const expectedFiles = manifest.files.filter(file => file.selected).map(file => ({
        table: file.table, sha256: file.sha256, rowCount: file.rowCount,
      }))
      if (parsed.kind !== 'header' || parsed.version !== 3 ||
        parsed.sourceInstance !== manifest.sourceSnapshot.sourceInstance ||
        parsed.snapshotId !== manifest.sourceSnapshot.snapshotId ||
        parsed.asOf !== manifest.sourceSnapshot.asOf ||
        typeof parsed.piiComparable !== 'boolean' ||
        (parsed.piiComparable ? !/^[a-f0-9]{64}$/.test(String(parsed.keyId)) : parsed.keyId !== null) ||
        JSON.stringify(parsed.selectedFiles) !== JSON.stringify(expectedFiles)) {
        throw new Error('SOURCE_EVIDENCE_HEADER_MISMATCH')
      }
    } else {
      const expected = reportRows[index]
      if (!expected || parsed.kind !== 'row' || parsed.table !== expected.table ||
        parsed.sourceId !== expected.sourceId || parsed.storeId !== expected.storeId ||
        parsed.record !== expected.record || parsed.disposition !== expected.disposition ||
        JSON.stringify(parsed.targetPaths) !== JSON.stringify(expected.contributions.map(item => ({ path: item.targetPath, rule: item.rule, fields: item.fields }))) ||
        !record(parsed.fields)) throw new Error('SOURCE_EVIDENCE_COVERAGE_MISMATCH')
      rowsByTable.set(expected.table, (rowsByTable.get(expected.table) ?? 0) + 1)
      const approved = new Set(SOURCE_EVIDENCE_FIELDS[expected.table] ?? [])
      const fieldNames = [...new Set([...Object.keys(expected.fields), ...approved])]
        .filter(name => expected.fields[name] !== 'security-excluded')
      if (JSON.stringify(Object.keys(parsed.fields)) !== JSON.stringify(fieldNames)) {
        throw new Error('SOURCE_EVIDENCE_FIELD_REGISTRY_MISMATCH')
      }
      if (parsed.redactedFieldCount !== Object.values(expected.fields).filter(value => value === 'security-excluded').length) {
        throw new Error('SOURCE_EVIDENCE_REDACTED_FIELD_COUNT_MISMATCH')
      }
      for (const fieldName of fieldNames) {
        const field = parsed.fields[fieldName]
        if (!record(field) || !['absent', 'null', 'empty', 'value'].includes(String(field.presence)) ||
          field.disposition !== (expected.fields[fieldName] ?? 'unverified') ||
          (field.display !== null && (typeof field.display !== 'string' || field.display.length > 240 || /[\u0000-\u001f\u007f]/.test(field.display))) ||
          (field.fingerprint !== null && (typeof field.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(field.fingerprint))) ||
          (field.presence === 'absent' && field.fingerprint !== null) ||
          (!approved.has(fieldName) && (field.display !== null || field.fingerprint !== null)) ||
          (PRIVATE_TABLES.has(expected.table) && PRIVATE_FIELDS.has(fieldName) && field.display !== null) ||
          (URL_FIELDS.has(fieldName) && field.display !== null)) {
          throw new Error('SOURCE_EVIDENCE_FIELD_INVALID')
        }
      }
    }
    index++
  }
  if (index !== reportRows.length) throw new Error('SOURCE_EVIDENCE_COVERAGE_MISMATCH')
  for (const file of manifest.files.filter(file => file.selected)) {
    if (!file.table || file.rowCount === null || (rowsByTable.get(file.table) ?? 0) !== file.rowCount) {
      throw new Error('SOURCE_EVIDENCE_SOURCE_COUNT_MISMATCH')
    }
  }
}
