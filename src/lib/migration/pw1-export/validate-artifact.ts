import { validateClassification } from './validate-classification'
import { validateReconciliationReceipts } from './reconciliation-receipts'
import { validateUserActors } from './user-actors'
import { storeSummaries } from './store-summary'
import {
  readJsonStream,
  hashFileStream,
  type ArrayItemVisitor,
} from './stream-json'
import type { StoreOutput } from './contracts'
import { lstat } from 'node:fs/promises'
import path from 'node:path'
import { manifestSchema, reportSchema, storeSchema, legacyStoreSchema } from './artifact-schemas'
import { operationalIssues } from './validate-master'
import { checkedFile } from './csv-loader'
import { MASTER_SHA256, LEGACY_MASTER_SHA256, EXPORT_VERSION } from './master-version'
import { ExportError } from './primitives'
export async function validateArtifact(directory: string) {
  if ((await lstat(directory)).isSymbolicLink())
    throw new ExportError('SYMLINK_ARTIFACT')
  const root = path.resolve(directory)
  const parse = async (name: string, visit?: ArrayItemVisitor) => {
    try {
      return await readJsonStream(await checkedFile(root, name), visit)
    } catch (error) {
      if (error instanceof ExportError) throw error
      throw new ExportError('ARTIFACT_READ_FAILED')
    }
  }
  const parsed = manifestSchema.safeParse(await parse('master-manifest.json'))
  if (!parsed.success) throw new ExportError('MANIFEST_SCHEMA_INVALID')
  const manifest = parsed.data
  const legacy = manifest.contractSha256 === LEGACY_MASTER_SHA256 && manifest.exporterVersion === '1.0.0'
  if (!legacy && (manifest.contractSha256 !== MASTER_SHA256 || !['1.1.0', EXPORT_VERSION].includes(manifest.exporterVersion)))
    throw new ExportError('UNSUPPORTED_MAPPING_CONTRACT')
  if (manifest.exporterVersion === EXPORT_VERSION && manifest.classificationVersion !== 'source-classification-v1')
    throw new ExportError('CLASSIFICATION_VERSION_REQUIRED')
  const schema = legacy ? legacyStoreSchema : storeSchema
  if (!legacy && (!manifest.artifacts['customer-reconciliation.json'] || !manifest.artifacts['product-reconciliation.json']))
    throw new ExportError('RECONCILIATION_RECEIPT_REQUIRED')
  if (legacy && (manifest.artifacts['customer-reconciliation.json'] || manifest.artifacts['product-reconciliation.json']))
    throw new ExportError('UNSUPPORTED_MAPPING_CONTRACT')
  for (const [name, digest] of Object.entries(manifest.artifacts))
    if ((await hashFileStream(await checkedFile(root, name))) !== digest)
      throw new ExportError('ARTIFACT_HASH_MISMATCH')
  const masterValue = await parse('master.json', (itemPath, _index, item) => {
    if (itemPath.length === 0 && !schema.safeParse(item).success)
      throw new ExportError('MASTER_SCHEMA_INVALID')
    return false
  })
  if (!Array.isArray(masterValue))
    throw new ExportError('MASTER_SCHEMA_INVALID')
  const master = masterValue as StoreOutput[]
  const reportValue = await parse(
    'mapping-report.json',
    (itemPath, _index, item) => {
      if (itemPath.length === 1 && itemPath[0] === 'rows') {
        if (!reportSchema.shape.rows.element.safeParse(item).success)
          throw new ExportError('REPORT_SCHEMA_INVALID')
        const row = item as import('zod').infer<typeof reportSchema>['rows'][number]
        if (manifest.classificationVersion && (!row.ownership || row.ownership.storeId !== row.storeId ||
          Object.entries(row.fieldRetentionRules ?? {}).some(([field]) => row.fields[field] !== 'retained-source')))
          throw new ExportError('CLASSIFICATION_EVIDENCE_INVALID')
          // Contributions were checked above; coverage validation needs only field dispositions.
        ;(item as { contributions: unknown[] }).contributions = []
      }
      if (
        itemPath.length === 1 &&
        itemPath[0] === 'diagnostics' &&
        !reportSchema.shape.diagnostics.element.safeParse(item).success
      )
        throw new ExportError('REPORT_SCHEMA_INVALID')
      return false
    },
  )
  if (
    !reportValue ||
    typeof reportValue !== 'object' ||
    Array.isArray(reportValue)
  )
    throw new ExportError('REPORT_SCHEMA_INVALID')
  const report = reportValue as import('zod').infer<typeof reportSchema>
  if (
    !Array.isArray(report.rows) ||
    !Array.isArray(report.diagnostics) ||
    !reportSchema.safeParse({ ...report, rows: [], diagnostics: [] }).success
  )
    throw new ExportError('REPORT_SCHEMA_INVALID')
  if (manifest.classificationVersion) validateClassification(report.rows, report.diagnostics, manifest.migrationPolicy)
  if (!legacy) validateReconciliationReceipts(
    await parse('customer-reconciliation.json'), await parse('product-reconciliation.json'),
    manifest.sourceSnapshot, master, report.rows,
  )
  if (manifest.artifacts['store-summary.json']) {
    const summary = await parse('store-summary.json')
    const expected = storeSummaries(master, report.diagnostics, manifest.blockedStores, manifest.policyExcludedStores)
    if (JSON.stringify(summary) !== JSON.stringify(expected))
      throw new ExportError('STORE_SUMMARY_INCONSISTENT')
  }
  const counts = manifest.counts,
    blockers = report.diagnostics.filter((d) => d.severity === 'blocker').length
  const userActors = manifest.artifacts['user-actors.json']
    ? validateUserActors(await parse('user-actors.json'), manifest.sourceSnapshot)
    : undefined
  if (userActors && !manifest.migrationPolicy?.preserveUserCreators)
    throw new ExportError('USER_ACTORS_POLICY_INVALID')
  if (operationalIssues(master, userActors, manifest.migrationPolicy).length)
    throw new ExportError('ARTIFACT_RELATIONSHIPS_INVALID')
  if (
    counts.blockers !== blockers ||
    manifest.mapping.complete !== (blockers === 0) ||
    manifest.status !== (blockers ? 'needs_review' : 'complete')
  )
    throw new ExportError('ARTIFACT_STATUS_INCONSISTENT')
  if (
    counts.sourceStoreCount !==
      counts.selectedStoreCount + counts.policyExcludedStoreCount ||
    counts.selectedStoreCount !==
      counts.emittedStoreCount + counts.blockedStoreCount ||
    counts.emittedStoreCount !== master.length ||
    counts.blockedStoreCount !== manifest.blockedStores.length ||
    counts.policyExcludedStoreCount !== manifest.policyExcludedStores.length
  )
    throw new ExportError('ARTIFACT_COUNTS_INCONSISTENT')
  const ids = [
    ...master.map((s) =>
      String((s.tenants[0].metaData as Record<string, unknown>).pw1StoreId),
    ),
    ...manifest.blockedStores,
    ...manifest.policyExcludedStores,
  ]
  if (new Set(ids).size !== ids.length)
    throw new ExportError('ARTIFACT_STORE_PARTITION_INVALID')
  if (
    new Set(manifest.files.map((f) => f.filename)).size !==
    manifest.files.length
  )
    throw new ExportError('ARTIFACT_SOURCE_INVENTORY_INVALID')
  for (const file of manifest.files)
    if (
      file.selected
        ? !file.table ||
          file.rowCount === null ||
          !file.headers.length ||
          new Set(file.headers).size !== file.headers.length ||
          file.headers.some((h) => !h)
        : file.table !== undefined ||
          file.rowCount !== null ||
          file.headers.length !== 0
    )
      throw new ExportError('ARTIFACT_SOURCE_INVENTORY_INVALID')
  const selected = manifest.files.filter((f) => f.selected)
  if (new Set(selected.map((f) => f.table)).size !== selected.length)
    throw new ExportError('ARTIFACT_SOURCE_INVENTORY_INVALID')
  if (
    report.rows.length !== selected.reduce((n, f) => n + (f.rowCount ?? 0), 0)
  )
    throw new ExportError('ARTIFACT_COVERAGE_INCONSISTENT')
  for (const file of selected) {
    const rows = report.rows.filter((r) => r.table === file.table)
    if (
      rows.length !== file.rowCount ||
      new Set(rows.map((r) => r.record)).size !== rows.length ||
      rows.some(
        (r) =>
          r.record < 1 ||
          r.record > rows.length ||
          Object.keys(r.fields).sort().join('\0') !==
            [...file.headers].sort().join('\0'),
      )
    )
      throw new ExportError('ARTIFACT_COVERAGE_INCONSISTENT')
  }
  if (
    report.rows.some((r) => Object.values(r.fields).includes('unresolved')) &&
    !blockers
  )
    throw new ExportError('ARTIFACT_COVERAGE_INCONSISTENT')
  return {
    integrityStatus: 'valid',
    mappingStatus: manifest.status,
    exitCode: manifest.status === 'complete' ? 0 : 2,
    counts,
  }
}
