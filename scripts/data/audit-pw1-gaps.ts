import { parseArgs } from 'node:util'
import path from 'node:path'
import { lstat } from 'node:fs/promises'
import { loadSource, readConfigFile, hash, checkedFile, verifySource } from '../../src/lib/migration/pw1-export/csv-loader'
import { parseConfig } from '../../src/lib/migration/pw1-export/source-config'
import { readJsonStream, hashFileStream } from '../../src/lib/migration/pw1-export/stream-json'
import { manifestSchema, reportSchema } from '../../src/lib/migration/pw1-export/artifact-schemas'
import { writeArtifacts, csvCell } from '../../src/lib/migration/pw1-export/artifact-writer'
import { countBy, gapCases, shippingInventory } from '../../src/lib/migration/pw1-export/gap-inventory'
import { ExportError } from '../../src/lib/migration/pw1-export/primitives'
import { progressLogger } from '../../src/lib/migration/pw1-export/progress'
import type { Diagnostic } from '../../src/lib/migration/pw1-export/contracts'

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
async function main() {
  const { values } = parseArgs({ options: {
    'input-dir': { type: 'string' }, 'source-config': { type: 'string' },
    'artifact-dir': { type: 'string' }, 'output-dir': { type: 'string' },
    quiet: { type: 'boolean' }, help: { type: 'boolean' },
  }, strict: true, allowPositionals: false })
  if (values.help) {
    process.stdout.write('Offline PW1 gap inventory (no DB writes; no readiness approval)\nUsage: npm run migrate:pw1:audit -- --input-dir <csv-dir> --source-config <config.json> --artifact-dir <export> --output-dir <new-dir> [--quiet]\nOutput parent must exist; existing output is never overwritten. Case files contain source IDs, not source contact/credential values.\n')
    return
  }
  if (!values['input-dir'] || !values['source-config'] || !values['artifact-dir'] || !values['output-dir'])
    throw new ExportError('INVALID_CLI_ARGUMENTS')
  const progress = values.quiet ? undefined : progressLogger((line) => process.stderr.write(line))
  if ((await lstat(values['artifact-dir'])).isSymbolicLink()) throw new ExportError('SYMLINK_ARTIFACT')
  const root = path.resolve(values['artifact-dir'])
  const manifestFile = await checkedFile(root, 'master-manifest.json')
  const manifestDigest = await hashFileStream(manifestFile)
  const manifest = manifestSchema.parse(await readJsonStream(manifestFile))
  const configBytes = await readConfigFile(values['source-config'])
  if (hash(configBytes) !== manifest.sourceConfigSha256) throw new ExportError('AUDIT_CONFIG_MISMATCH')
  const config = parseConfig(configBytes)
  const source = await loadSource(values['input-dir'], config, progress)
  if (JSON.stringify(source.files) !== JSON.stringify(manifest.files)) throw new ExportError('AUDIT_SOURCE_MISMATCH')
  const reportFile = await checkedFile(root, 'mapping-report.json')
  if (await hashFileStream(reportFile) !== manifest.artifacts['mapping-report.json']) throw new ExportError('ARTIFACT_HASH_MISMATCH')
  const diagnostics: Diagnostic[] = []
  const coverage = new Map<string, { table: string; field: string; dispositions: Record<string, number> }>()
  progress?.({ phase: 'audit-report' })
  const metadata = await readJsonStream(reportFile, (itemPath, _index, item) => {
    if (itemPath.length === 1 && itemPath[0] === 'diagnostics') {
      diagnostics.push(reportSchema.shape.diagnostics.element.parse(item)); return true
    }
    if (itemPath.length === 1 && itemPath[0] === 'rows') {
      const row = reportSchema.shape.rows.element.parse(item)
      for (const [field, disposition] of Object.entries(row.fields)) {
        const key = JSON.stringify([row.table, field])
        const entry = coverage.get(key) ?? { table: row.table, field, dispositions: Object.create(null) as Record<string, number> }
        entry.dispositions[disposition] = (entry.dispositions[disposition] ?? 0) + 1
        coverage.set(key, entry)
      }
      return true
    }
    return false
  })
  reportSchema.parse(metadata)
  const cases = gapCases(source.tables, diagnostics)
  const shipping = shippingInventory(source.tables)
  const summary = {
    version: 1, snapshotId: config.snapshotId, asOf: config.asOf,
    sourceConfigSha256: hash(configBytes), sourceContractSha256: manifest.contractSha256,
    mappingReportSha256: manifest.artifacts['mapping-report.json'],
    integrityScope: 'source/config/report hashes matched; not a full master validation',
    diagnosticCounts: countBy(diagnostics, (row) => row.code),
    severityCounts: countBy(diagnostics, (row) => row.severity),
    reasonCounts: countBy(cases, (row) => row.reason),
    shipping: {
      scope: shipping.scope, missingTable: shipping.missingTable,
      rows: shipping.rows.length, storesWithoutDelivery: shipping.storesWithoutDelivery.length,
      classifications: countBy(shipping.rows, (row) => row.classification),
      configured: countBy(shipping.rows, (row) => String(row.configured)),
      providers: countBy(shipping.rows, (row) => row.provider),
    },
    coverage: [...coverage.values()],
    warning: 'Diagnostic counts overlap; source IDs are for reconciliation. No config was activated and no unresolved policy was accepted.',
  }
  const csv = function* () {
    yield ['code', 'reason', 'storeId', 'table', 'sourceId', 'field', 'evidence'].map(csvCell).join(',') + '\n'
    for (const item of cases)
      yield [item.code, item.reason, item.storeId ?? '', item.table ?? '', item.sourceId ?? '', item.field ?? '', JSON.stringify(item.evidence)].map(csvCell).join(',') + '\n'
  }
  const report = '# PW1 gap audit\n\n' +
    `Snapshot: ${config.snapshotId}. Blocker diagnostics: ${cases.length}.\n\n` +
    'Counts are diagnostics, not distinct lost records. Inventory does not activate shipping or approve import.\n\n' +
    '## Shipping (all live source delivery rows)\n\n| Classification | Rows |\n|---|---:|\n' +
    Object.entries(summary.shipping.classifications).map(([key, count]) => `| ${key} | ${count} |`).join('\n') + '\n\n' +
    '## Files\n\n- summary.json: aggregate diagnostic/reason counts and per-field coverage, no source values.\n- reconciliation-cases.csv: private source IDs and bounded status/relationship evidence; no contact/credential values.\n- shipping-inventory.json: private source IDs and numeric fee configurations in original source order/units; no provider credentials.\n\n' +
    'PW1 tier fees use the LAST matching sub_total_from in source array order; upper bounds are not used at runtime. Source currency/unit and target operational equivalence still require verification.\n'
  await writeArtifacts(values['output-dir'], source.inputRoot, {
    'summary.json': json(summary), 'reconciliation-cases.csv': csv(),
    'shipping-inventory.json': json(shipping), 'report.md': report,
  }, async () => {
    if ((await verifySource(source, progress)).length) throw new ExportError('SOURCE_CHANGED_DURING_AUDIT')
    if (hash(await readConfigFile(values['source-config']!)) !== hash(configBytes)) throw new ExportError('CONFIG_CHANGED_DURING_AUDIT')
    if (await hashFileStream(reportFile) !== manifest.artifacts['mapping-report.json'] || await hashFileStream(manifestFile) !== manifestDigest)
      throw new ExportError('ARTIFACT_CHANGED_DURING_AUDIT')
  }, progress)
  process.stdout.write(json({ status: 'audited', blockers: cases.length, shippingRows: shipping.rows.length, output: values['output-dir'] }))
}
main().catch((error: unknown) => {
  process.stderr.write(json({ error: error instanceof ExportError ? error.code : 'AUDIT_FAILED' }))
  process.exitCode = 1
})
