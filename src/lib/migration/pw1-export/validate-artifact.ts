import { validateRawSettings } from './raw-settings-proof'
import { legacyModelSettingsValid, legacyRawContentValid } from './legacy-raw-content'
import { PAGE_MENU_TABLES } from './approved-source-scope'
import { readMasterParts } from './master-parts'
import { assertApprovedMigrationPolicy } from './policy-boundary'
import * as legacyOutcome from './export-outcome-v1'
import { exportOutcome, exportReview, reviewMarkdown, externalArchiveKeys } from './export-outcome'
import { EXTERNAL_SOURCE_RULE } from './external-source'
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
import { manifestSchema, reportSchema, storeSchema, conflictStoreSchema, preConflictStoreSchema, legacyStoreSchema, previousStoreSchema, statusStoreSchema } from './artifact-schemas'
import { operationalIssues } from './validate-master'
import { checkedFile } from './csv-loader'
import { RAW_SETTINGS_MASTER_SHA256, APPROVED_SCOPE_MASTER_SHA256, CATALOG_SOCIAL_MEDIA_MASTER_SHA256, MODEL_SETTINGS_MASTER_SHA256, MULTIPART_MASTER_SHA256, NEGATIVE_ORDER_MASTER_SHA256, SOURCE_OMISSION_MASTER_SHA256, PRODUCT_CATALOG_MASTER_SHA256, OWNER_EMAIL_MASTER_SHA256, CONFLICT_MASTER_SHA256, POLICY_BOUNDARY_MASTER_SHA256, BLOG_CATEGORY_MASTER_SHA256, PRODUCT_EXCLUSION_MASTER_SHA256, VARIANT_MASTER_SHA256, BLOG_CONTENT_MASTER_SHA256, BLOG_OWNER_MASTER_SHA256, DESCRIPTION_MASTER_SHA256, CORRECTED_OUTCOME_MASTER_SHA256, MASTER_SHA256, OUTCOME_MASTER_SHA256, ARCHIVE_MASTER_SHA256, STATUS_MASTER_SHA256, PREVIOUS_MASTER_SHA256, LEGACY_MASTER_SHA256, EXPORT_VERSION } from './master-version'
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
  assertApprovedMigrationPolicy(manifest.migrationPolicy, !['1.9.0', '1.9.1', '1.9.2', '1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.9.1', '1.9.2', '1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.9.2', '1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion))
  if (manifest.migrationPolicy?.approvedNegativeTotalOrders?.length && (manifest.sourceSnapshot.sourceInstance !== 'PW1PROD' || manifest.sourceSnapshot.sourceInstanceToken !== 'PW1PROD')) throw new ExportError('NEGATIVE_ORDER_POLICY_SOURCE_SCOPE_INVALID')
  const legacy = manifest.contractSha256 === LEGACY_MASTER_SHA256 && manifest.exporterVersion === '1.0.0'
  const previous = manifest.contractSha256 === PREVIOUS_MASTER_SHA256 && ['1.1.0', '1.2.0'].includes(manifest.exporterVersion)
  const archiveVersion = manifest.contractSha256 === ARCHIVE_MASTER_SHA256 && manifest.exporterVersion === '1.4.0'
  const outcomeVersion = manifest.contractSha256 === OUTCOME_MASTER_SHA256 && manifest.exporterVersion === '1.5.0'
  const current = (manifest.contractSha256 === RAW_SETTINGS_MASTER_SHA256 && manifest.exporterVersion === '1.10.4') || (manifest.contractSha256 === APPROVED_SCOPE_MASTER_SHA256 && manifest.exporterVersion === '1.10.3') || (manifest.contractSha256 === CATALOG_SOCIAL_MEDIA_MASTER_SHA256 && manifest.exporterVersion === '1.10.2') || (manifest.contractSha256 === MODEL_SETTINGS_MASTER_SHA256 && manifest.exporterVersion === '1.10.1') || (manifest.contractSha256 === MULTIPART_MASTER_SHA256 && manifest.exporterVersion === '1.10.0') || (manifest.contractSha256 === NEGATIVE_ORDER_MASTER_SHA256 && manifest.exporterVersion === '1.9.4') || (manifest.contractSha256 === SOURCE_OMISSION_MASTER_SHA256 && manifest.exporterVersion === '1.9.3') || (manifest.contractSha256 === PRODUCT_CATALOG_MASTER_SHA256 && manifest.exporterVersion === '1.9.2') || (manifest.contractSha256 === OWNER_EMAIL_MASTER_SHA256 && manifest.exporterVersion === '1.9.1') || (manifest.contractSha256 === CONFLICT_MASTER_SHA256 && manifest.exporterVersion === '1.9.0') || (manifest.contractSha256 === POLICY_BOUNDARY_MASTER_SHA256 && manifest.exporterVersion === '1.8.2') || (manifest.contractSha256 === BLOG_CATEGORY_MASTER_SHA256 && manifest.exporterVersion === '1.8.1') || (manifest.contractSha256 === PRODUCT_EXCLUSION_MASTER_SHA256 && manifest.exporterVersion === '1.8.0') || (manifest.contractSha256 === VARIANT_MASTER_SHA256 && manifest.exporterVersion === '1.7.0') || (manifest.contractSha256 === BLOG_CONTENT_MASTER_SHA256 && manifest.exporterVersion === '1.6.2') || (manifest.contractSha256 === BLOG_OWNER_MASTER_SHA256 && manifest.exporterVersion === '1.6.1') || (manifest.contractSha256 === DESCRIPTION_MASTER_SHA256 && manifest.exporterVersion === '1.6.0') || (manifest.contractSha256 === MASTER_SHA256 && manifest.exporterVersion === EXPORT_VERSION) || (manifest.contractSha256 === CORRECTED_OUTCOME_MASTER_SHA256 && manifest.exporterVersion === '1.5.1')
  const statusVersion = manifest.contractSha256 === STATUS_MASTER_SHA256 && manifest.exporterVersion === '1.3.0'
  if (!legacy && !previous && !statusVersion && !archiveVersion && !outcomeVersion && !current)
    throw new ExportError('UNSUPPORTED_MAPPING_CONTRACT')
  if (['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.5.1', '1.6.0', '1.6.1', '1.6.2', '1.7.0', '1.8.0', '1.8.1', '1.8.2', '1.9.0', '1.9.1', '1.9.2', '1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion) && manifest.classificationVersion !== 'source-classification-v1')
    throw new ExportError('CLASSIFICATION_VERSION_REQUIRED')
  const schema = legacy ? legacyStoreSchema : previous ? previousStoreSchema : statusVersion ? statusStoreSchema : ['1.9.1', '1.9.2', '1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion) ? (manifest.migrationPolicy?.preserveInvalidUserEmails ? storeSchema : conflictStoreSchema) : manifest.exporterVersion === '1.9.0' ? conflictStoreSchema : preConflictStoreSchema
  if (!legacy && (!manifest.artifacts['customer-reconciliation.json'] || !manifest.artifacts['product-reconciliation.json']))
    throw new ExportError('RECONCILIATION_RECEIPT_REQUIRED')
  if (legacy && (manifest.artifacts['customer-reconciliation.json'] || manifest.artifacts['product-reconciliation.json']))
    throw new ExportError('UNSUPPORTED_MAPPING_CONTRACT')
  const multipart = ['1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion)
  if (multipart ? manifest.masterParts === undefined || manifest.masterSetHash === undefined || manifest.artifacts['master.json'] !== undefined : manifest.masterParts !== undefined || manifest.masterSetHash !== undefined || !manifest.artifacts['master.json'] || Object.keys(manifest.artifacts).some(name => /^master-\d+\.json$/.test(name)))
    throw new ExportError('MASTER_LAYOUT_INVALID')
  const partNames = new Set(manifest.masterParts?.map(part => part.filename) ?? [])
  for (const [name, digest] of Object.entries(manifest.artifacts)) {
    if (multipart && partNames.has(name)) continue // verified with size and Store boundaries below
    if ((await hashFileStream(await checkedFile(root, name))) !== digest)
      throw new ExportError('ARTIFACT_HASH_MISMATCH')
  }
  let master: StoreOutput[]
  if (multipart) {
    master = await readMasterParts(root, manifest.masterParts!, manifest.masterSetHash!, manifest.artifacts,
      (value): value is StoreOutput => schema.safeParse(value).success)
  } else {
    const masterValue = await parse('master.json', (itemPath, _index, item) => {
      if (itemPath.length === 0 && !schema.safeParse(item).success)
        throw new ExportError('MASTER_SCHEMA_INVALID')
      return false
    })
    if (!Array.isArray(masterValue)) throw new ExportError('MASTER_SCHEMA_INVALID')
    master = masterValue as StoreOutput[]
  }
  if (!['1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion) && master.some(store => !legacyRawContentValid(store) || store.sites.some(site => site.raw_frontend_template !== undefined))) throw new ExportError('UNSUPPORTED_MAPPING_CONTRACT')
  if (!['1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion) && master.some(store => !legacyModelSettingsValid(store))) throw new ExportError('UNSUPPORTED_MAPPING_CONTRACT')
  const archive = new Set<string>()
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
        // Keep external CSV evidence for retention validation; discard operational paths.
        for (const key of externalArchiveKeys(row)) archive.add(key)
        if (!row.productExclusion && !row.sourceExclusion && !PAGE_MENU_TABLES.has(row.table) && !['store_domains', 'model_settings', 'medias', 'orders', 'order_details', 'queue_sync', 'model_exports', 'promotions', 'promotion_codes'].includes(row.table)) row.contributions = row.contributions.filter(contribution => contribution.rule === EXTERNAL_SOURCE_RULE)
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
  if (manifest.classificationVersion) validateClassification(report.rows, report.diagnostics, manifest.migrationPolicy, master.flatMap(store => store.products.map(p => ({ storeId: String(store.tenants[0]._ref).split(':').at(-1)!, ref: String(p._ref) }))), ['1.8.0', '1.8.1', '1.8.2', '1.9.0', '1.9.1', '1.9.2', '1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), new Set(master.flatMap(store=>Object.values(store).flatMap(docs=>docs.map(doc=>String(doc._ref))))), ['1.9.3', '1.9.4', '1.10.0', '1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.10.1', '1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.10.2', '1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.10.3', '1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), ['1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion), manifest.exporterVersion === EXPORT_VERSION)
  if (['1.10.4', EXPORT_VERSION].includes(manifest.exporterVersion)) validateRawSettings(master, report.rows)
  if (!legacy) validateReconciliationReceipts(
    await parse('customer-reconciliation.json'), await parse('product-reconciliation.json'),
    manifest.sourceSnapshot, master, report.rows, manifest.migrationPolicy,
  )
  if (manifest.artifacts['store-summary.json']) {
    const summary = await parse('store-summary.json')
    const expected = storeSummaries(master, report.diagnostics, manifest.blockedStores, manifest.policyExcludedStores, current || outcomeVersion, archive, outcomeVersion ? 1 : 2)
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
  if (current || outcomeVersion) {
    const expected = outcomeVersion ? legacyOutcome.exportOutcome(report.diagnostics, manifest.blockedStores.length, manifest.policyExcludedStores.length, archive) : exportOutcome(report.diagnostics, manifest.blockedStores.length, manifest.policyExcludedStores, archive)
    if (JSON.stringify(manifest.outcome) !== JSON.stringify(expected) || !manifest.artifacts['export-review.json'] || !manifest.artifacts['export-review.md']) throw new ExportError('ARTIFACT_OUTCOME_INCONSISTENT')
    const review = (outcomeVersion ? legacyOutcome.exportReview : exportReview)(report.diagnostics, manifest.blockedStores, manifest.policyExcludedStores, archive)
    if (JSON.stringify(await parse('export-review.json')) !== JSON.stringify(review)) throw new ExportError('ARTIFACT_OUTCOME_INCONSISTENT')
    const { readFile } = await import('node:fs/promises')
    if (await readFile(await checkedFile(root, 'export-review.md'), 'utf8') !== (outcomeVersion ? legacyOutcome.reviewMarkdown(review as ReturnType<typeof legacyOutcome.exportReview>) : reviewMarkdown(review as ReturnType<typeof exportReview>))) throw new ExportError('ARTIFACT_OUTCOME_INCONSISTENT')
  } else if (manifest.outcome || manifest.artifacts['export-review.json'] || manifest.artifacts['export-review.md']) throw new ExportError('ARTIFACT_OUTCOME_INCONSISTENT')
  if (
    counts.blockers !== blockers ||
    manifest.mapping.complete !== (blockers === 0) ||
    manifest.status !== (current || outcomeVersion ? 'exported' : blockers ? 'needs_review' : 'complete')
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
    mappingStatus: current || outcomeVersion ? manifest.outcome!.dataStatus : manifest.status,
    ...((current || outcomeVersion) ? { outcome: manifest.outcome } : {}),
    exitCode: current || outcomeVersion || manifest.status === 'complete' ? 0 : 2,
    counts,
  }
}
