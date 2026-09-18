import { buildHandoff } from './handoff'
import { exportOutcome, exportReview, reviewMarkdown, externalArchiveKeys } from './export-outcome'
import { EXTERNAL_SOURCE_RULE, externalSourcePath } from './external-source'
import { validateClassification } from './validate-classification'
import {
  customerDiagnosticsSchema, receiptSnapshot, buildCustomerReceiptStore,
  buildProductReceiptEntries, validateReconciliationReceipts, type CustomerDiagnostics,
} from './reconciliation-receipts'
import { collectUserActors } from './user-actors'
import { storeSummaries } from './store-summary'
import type { Progress } from './progress'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  type Diagnostic,
  type Contribution,
  type StoreOutput,
  emptyStore,
  ROOTS,
} from './contracts'
import { parseConfig } from './source-config'
import {
  loadSource,
  verifySource,
  hash,
  readConfigFile,
  checkResources,
} from './csv-loader'
import { SourceIndex } from './source-index'
import { compareIds, ExportError } from './primitives'
import { mapIdentity } from './mappers/identity-site'
import { mapEntitlements } from './mappers/entitlements'
import { mapCatalog } from './mappers/catalog'
import { mapCommerce } from './mappers/commerce'
import { mapContent } from './mappers/content'
import { dispositions } from './source-dispositions'
import { operationalIssues } from './validate-master'
import { quarantineProductCollisions } from './quarantine-records'
import {
  documentSchemas,
  manifestSchema,
  reportSchema,
  validateMaster,
} from './artifact-schemas'
import {
  writeArtifacts,
  csvCell,
  type ArtifactContent,
} from './artifact-writer'
import { MASTER_SHA256, EXPORT_VERSION } from './master-version'

const json = (value: unknown) =>
  JSON.stringify(value, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029') + '\n'
export async function exportMaster(
  inputDir: string,
  configPath: string,
  outputDir: string,
  inventoryOnly = false,
  progress?: Progress,
) {
  progress?.({ phase: 'load-config' })
  const configBytes = await readConfigFile(configPath),
    config = parseConfig(configBytes)
  const source = await loadSource(inputDir, config, progress)
  const sourceWarnings: string[] = []
  const unchanged = async () => {
    sourceWarnings.push(...(await verifySource(source, progress)))
    if (hash(await readConfigFile(configPath)) !== hash(configBytes))
      throw new ExportError('CONFIG_CHANGED_DURING_EXPORT')
  }
  if (inventoryOnly) {
    await writeArtifacts(
      outputDir,
      source.inputRoot,
      {
        'inventory.json': json({
          version: 1,
          mappingPerformed: false,
          sourceConfigSha256: hash(configBytes),
          files: source.files,
        }),
      },
      unchanged,
      progress,
    )
    return { status: 'inventory', exitCode: 0, files: source.files.length }
  }
  progress?.({ phase: 'index-source' })
  const index = new SourceIndex(source.tables),
    diagnostics: Diagnostic[] = [],
    contributions: Contribution[] = [],
    stores: StoreOutput[] = [],
    blockedStores: string[] = [],
    policyExcludedStores: string[] = []
  const required = [
    'stores',
    'users',
    'roles',
    'model_has_roles',
    'store_domains',
    'store_payments',
    'payment_methods',
    'plans',
    'plan_subscriptions',
    'plan_subscription_usages',
    'plan_features',
    'categories',
    'products',
    'product_skus',
    'product_attributes',
    'product_variants',
    'attributes',
    'attribute_values',
    'product_images',
    'customers',
    'addresses',
    'orders',
    'order_details',
    'promotion_codes',
    'promotions',
    'pages',
    'page_components',
    'menus',
    'blog_categories',
    'blog_posts',
    'store_email_templates',
  ]
  for (const file of source.files.filter((f) => !f.selected)) {
    const match = /^(.*?)(?:_\d{12,14})?\.csv$/.exec(file.filename)
    const table = match?.[1] === '_attributes_' ? 'attributes' : match?.[1]
    if (!table || !Object.hasOwn(config.tables, table))
      diagnostics.push({
        code: 'UNSELECTED_SOURCE_NOT_CLASSIFIED',
        severity: 'blocker',
        ...(table ? { table } : {}),
      })
  }
  for (const table of required)
    if (!source.tables[table])
      diagnostics.push({
        code: 'SOURCE_TABLE_NOT_SELECTED',
        severity: 'blocker',
        table,
      })
  const customerEvidence = new Map<string, CustomerDiagnostics>()
  let processedStores = 0
  for (const row of source.tables.stores
    .slice()
    .sort((a, b) => compareIds(a.id!, b.id!))) {
    progress?.({
      phase: 'map-stores',
      completed: processedStores++,
      total: source.tables.stores.length,
      storeId: row.id ?? undefined,
    })
    checkResources(config)
    if ((row.deleted_at && config.deletedStores === 'exclude') || config.migrationPolicy?.deferredStoreIds?.includes(row.id!)) {
      policyExcludedStores.push(row.id!)
      continue
    }
    const output = emptyStore(),
      ctx = index.context(config, row.id!, output, diagnostics, contributions)
    if (!mapIdentity(ctx)) {
      blockedStores.push(row.id!)
      continue
    }
    ctx.captureCustomerReconciliation = value => {
      customerEvidence.set(row.id!, customerDiagnosticsSchema.parse(value))
    }
    mapCatalog(ctx)
    mapCommerce(ctx)
    mapContent(ctx)
    mapEntitlements(ctx)
    // Reject invalid documents before reference closure; never publish invalid operational records.
    for (const root of ROOTS) {
      output[root] = output[root].filter((doc) => {
        const parsed = documentSchemas[root].safeParse(doc)
        if (parsed.success) return true
        ctx.issue('DOCUMENT_SCHEMA_INVALID', root, String(doc._ref ?? row.id))
        return false
      })
    }
    if (output.tenants.length !== 1 || output.sites.length !== 1) {
      blockedStores.push(row.id!)
      continue
    }
    for (const collection of ROOTS)
      if (collection !== 'pages')
        output[collection].sort((a, b) =>
          compareIds(String(a._ref), String(b._ref)),
        )
    stores.push(output)
  }
  progress?.({
    phase: 'map-stores',
    completed: processedStores,
    total: source.tables.stores.length,
  })
  progress?.({ phase: 'validate-relationships' })
  quarantineProductCollisions(stores, diagnostics, config.migrationPolicy)
  // Conservative closure: global collisions/dangling relationships block every affected Store.
  // Re-run after removal so references to removed documents cannot survive in another Store.
  const actorContext = index.context(config, '', emptyStore(), diagnostics, contributions)
  const initialActors = collectUserActors(stores, actorContext)
  let valid = stores
  for (;;) {
    const problems = operationalIssues(valid, initialActors, config.migrationPolicy)
    if (!problems.length) break
    diagnostics.push(...problems)
    const ids = new Set(problems.map((d) => d.storeId))
    const next = valid.filter((store) => {
      const id = String(
        (store.tenants[0].metaData as Record<string, unknown>).pw1StoreId,
      )
      if (ids.has(id)) {
        if (!blockedStores.includes(id)) blockedStores.push(id)
        return false
      }
      return true
    })
    if (next.length === valid.length)
      throw new ExportError('REFERENCE_CLOSURE_FAILED')
    valid = next
  }
  const emittedIds = new Set(
    valid.map((s) =>
      String((s.tenants[0].metaData as Record<string, unknown>).pw1StoreId),
    ),
  )
  const emittedRefs = new Set(
    valid.flatMap((s) =>
      ROOTS.flatMap((root) => s[root].map((d) => String(d._ref))),
    ),
  )
  const finalContributions = contributions.filter((c) => {
    if (!c.storeId || !emittedIds.has(c.storeId)) return false
    if (c.rule === EXTERNAL_SOURCE_RULE) return c.targetPath === externalSourcePath(c.table)
    if (c.targetPath.startsWith('@'))
      return emittedRefs.has(c.targetPath.split('.')[0])
    const store = valid.find(
      (s) =>
        String(
          (s.tenants[0].metaData as Record<string, unknown>).pw1StoreId,
        ) === c.storeId,
    )!
    const root = c.targetPath.split(/[.\[ +]/)[0] as (typeof ROOTS)[number]
    return !!store[root]?.length
  })
  const userActors = collectUserActors(valid, actorContext)
  for (const actor of userActors?.actors ?? []) finalContributions.push({
    table: 'users', sourceId: actor.sourceId,
    fields: ['id', 'name', 'email', 'store_id', 'deleted_at', 'is_frontend', 'status', 'created_at', 'updated_at', 'created_by'].filter(field => Object.hasOwn(index.byId.get('users')!.get(actor.sourceId)!, field)),
    targetPath: `user-actors.json.actors.${actor.sourceId}`, rule: 'MASTER-3.4-CREATOR-DEPENDENCY',
  })
  progress?.({ phase: 'build-coverage-report' })
  const rows = dispositions(source, finalContributions, diagnostics)
  // Collections without a verified source contract remain visible review gaps, not verified-empty.
  for (const table of ['subscribers', 'contact-submissions', 'analytics'])
    diagnostics.push({
      code: 'COLLECTION_SOURCE_UNVERIFIED',
      severity: 'blocker',
      table,
    })
  if ((source.tables.notifications ?? []).length)
    diagnostics.push({
      code: 'NOTIFICATIONS_QUARANTINED',
      severity: 'blocker',
      table: 'notifications',
    })
  const accepted = new Set(
    config.acceptedExclusions?.map((e) => e.collection) ?? [],
  )
  for (const d of diagnostics)
    if (
      (d.code === 'COLLECTION_SOURCE_UNVERIFIED' ||
        d.code === 'NOTIFICATIONS_QUARANTINED') &&
      accepted.has(d.table as 'notifications')
    ) {
      d.severity = 'warning'
      d.code = 'ACCEPTED_SCOPE_EXCLUSION'
    }
  const uniqueDiagnostics = [
    ...new Map(diagnostics.map((d) => [JSON.stringify(d), d])).values(),
  ]
  const report = { version: 1 as const, diagnostics: uniqueDiagnostics, rows }
  progress?.({ phase: 'validate-report' })
  if (
    !reportSchema.safeParse({ ...report, rows: [], diagnostics: [] }).success ||
    uniqueDiagnostics.some(d => !reportSchema.shape.diagnostics.element.safeParse(d).success) ||
    rows.some(row => !reportSchema.shape.rows.element.safeParse(row).success)
  )
    throw new ExportError('REPORT_SCHEMA_INVALID')
  progress?.({
    phase: 'validate-master',
    completed: valid.length,
    total: source.tables.stores.length,
  })
  validateMaster(valid)
  validateClassification(rows, uniqueDiagnostics, config.migrationPolicy, valid.flatMap(store => store.products.map(p => ({ storeId: String(store.tenants[0]._ref).split(':').at(-1)!, ref: String(p._ref) }))))
  const blockers = uniqueDiagnostics.filter(
    (d) => d.severity === 'blocker',
  ).length
  const state = 'exported'
  const archive = new Set(rows.flatMap(row => externalArchiveKeys(row)))
  const outcome = exportOutcome(uniqueDiagnostics, blockedStores.length, policyExcludedStores, archive)
  const review = exportReview(uniqueDiagnostics, [...blockedStores].sort(compareIds), [...policyExcludedStores].sort(compareIds), archive)
  function* masterChunks() {
    yield '[\n'
    for (let i = 0; i < valid.length; i++) {
      checkResources(config)
      yield (i ? ',\n' : '') + json(valid[i]).trimEnd()
    }
    yield '\n]\n'
  }
  function* reportChunks() {
    yield '{"version":1,"diagnostics":' +
      JSON.stringify(uniqueDiagnostics) +
      ',"rows":[\n'
    for (let i = 0; i < rows.length; i++) {
      if (i % 1000 === 0) checkResources(config)
      yield (i ? ',\n' : '') + JSON.stringify(rows[i])
    }
    yield '\n]}\n'
  }
  function* csvChunks() {
    yield 'table,sourceId,storeId,record,disposition,field,status\n'
    for (const r of rows)
      for (const [field, status] of Object.entries(r.fields))
        yield [
          r.table,
          r.sourceId,
          r.storeId ?? '',
          String(r.record),
          r.disposition,
          field,
          status,
        ]
          .map(csvCell)
          .join(',') + '\n'
  }
  // Build receipts only after document validation and relationship closure.
  const diagnosticsByStore = new Map<string, Diagnostic[]>()
  for (const diagnostic of uniqueDiagnostics) {
    if (!diagnostic.storeId) continue
    const entries = diagnosticsByStore.get(diagnostic.storeId) ?? []
    entries.push(diagnostic); diagnosticsByStore.set(diagnostic.storeId, entries)
  }
  const contexts = valid.map(output => index.context(config,
    String((output.tenants[0].metaData as Record<string, unknown>).pw1StoreId),
    output, diagnosticsByStore.get(String((output.tenants[0].metaData as Record<string, unknown>).pw1StoreId)) ?? [], []))
  const customerReceipt = {
    version: 1, sourceSnapshot: receiptSnapshot(config), archiveStorage: 'external-source-csv',
    stores: contexts.map(ctx => buildCustomerReceiptStore(ctx, customerEvidence.get(ctx.storeId))),
  }
  const productReceipt = {
    version: 1, sourceSnapshot: receiptSnapshot(config),
    products: contexts.flatMap(buildProductReceiptEntries),
  }
  validateReconciliationReceipts(customerReceipt, productReceipt, receiptSnapshot(config), valid, rows)
  const summaries = storeSummaries(valid, uniqueDiagnostics, blockedStores, policyExcludedStores, true, archive)
  const summaryCsv = [
    'storeId,exportStatus,mappingStatus,blockerDiagnosticCount,warningDiagnosticCount,blockerCodes,mappingReviewCodes,targetConstraintCodes,otherBlockerCodes,importStatus,dataIssueCount,importRequirementCount,delegatedContentCount,outsideScopeCount',
    ...summaries.map(s => [s.storeId, s.exportStatus, s.mappingStatus, String(s.blockerDiagnosticCount), String(s.warningDiagnosticCount), s.blockerCodes.join(';'), s.mappingReviewCodes.join(';'), s.targetConstraintCodes.join(';'), s.otherBlockerCodes.join(';'), s.outcome!.importStatus, String(s.outcome!.dataIssueCount), String(s.outcome!.importRequirementCount), String(s.outcome!.delegatedContentCount), String(s.outcome!.outsideScopeCount)].map(csvCell).join(',')),
  ].join('\n') + '\n'
  const files: Record<string, ArtifactContent> = {
    'export-review.json': json(review),
    'export-review.md': reviewMarkdown(review),
    'customer-reconciliation.json': json(customerReceipt),
    'product-reconciliation.json': json(productReceipt),
    'store-summary.json': json(summaries),
    'store-summary.csv': summaryCsv,
    'master.json': masterChunks(),
    'mapping-report.json': reportChunks(),
    'mapping-report.csv': csvChunks(),
    'README.md': `# PW1 master export\n\nExport: succeeded. Data: ${outcome.dataStatus}. Import: not_verified. Start with export-review.md for actionable groups.\n\nStart with store-summary.csv: emitted means present in master, not complete mapping. Review mappingReviewCodes, targetConstraintCodes and otherBlockerCodes; counts are diagnostics, not lost records. Collection counts are in store-summary.json. Global diagnostics and field dispositions remain in mapping-report.json/csv. Customer and Product reconciliation sidecars carry source-scoped identity evidence validated against emitted targets. Null targets are not importable crosswalks. Customer raw archive remains in the manifest-hashed CSV snapshot outside this artifact; retainedSourceRows lists its IDs, not embedded raw values. Source snapshot is retained externally; sites.pw1_source is not embedded in master. Source-csv contributions describe CSV archive retention, not operational fields imported into PW2. No DB was written. If user-actors.json is present, it is a hashed source-identity dependency registry, not pre-created PW2 Users. Import must bind each actor to a verified target User ID without granting source roles or tenant membership, then resolve Users.createdBy and prevent import hooks from overwriting it.\n\nValidate: npm run migrate:pw1:export -- --validate-only --artifact-dir <this-directory>\n\nExit 0: export succeeded, including partial data; 1: invalid artifact or failed run. Inspect outcome.dataStatus and export-review.md.\n`,
  }
  if (userActors) files['user-actors.json'] = json(userActors)
  checkResources(config)
  const manifest = {
    version: 1,
    exporterVersion: EXPORT_VERSION,
    classificationVersion: 'source-classification-v1',
    contractSha256: MASTER_SHA256,
    sourceConfigSha256: hash(configBytes),
    sourceSnapshot: {
      sourceInstance: config.sourceInstance,
      sourceDatabase: config.sourceDatabase,
      sourceInstanceToken: config.sourceInstanceToken,
      snapshotId: config.snapshotId,
      asOf: config.asOf,
    },
    files: source.files,
    artifacts: {} as Record<string, string>,
    acceptedExclusions: config.acceptedExclusions ?? [],
    ...(config.migrationPolicy ? { migrationPolicy: config.migrationPolicy } : {}),
    status: state,
    outcome,
    importReady: false,
    coverage: { accounted: true },
    mapping: { complete: blockers === 0 },
    counts: {
      sourceStoreCount: source.tables.stores.length,
      selectedStoreCount:
        source.tables.stores.length - policyExcludedStores.length,
      policyExcludedStoreCount: policyExcludedStores.length,
      emittedStoreCount: valid.length,
      blockedStoreCount: blockedStores.length,
      blockers,
    },
    blockedStores: blockedStores.sort(compareIds),
    policyExcludedStores: policyExcludedStores.sort(compareIds),
  }
  files['master-manifest.json'] = (hashes) => {
    manifest.artifacts = { ...hashes }
    if (!manifestSchema.safeParse(manifest).success)
      throw new ExportError('MANIFEST_SCHEMA_INVALID')
    return json(manifest)
  }
  await writeArtifacts(outputDir, source.inputRoot, files, unchanged, progress)
  return {
    status: state,
    outcome,
    handoff: buildHandoff(summaries, uniqueDiagnostics, archive),
    exitCode: 0,
    counts: manifest.counts,
    sourceWarnings: [...new Set(sourceWarnings)],
    outputDir: path.resolve(outputDir),
  }
}
