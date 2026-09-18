import { progressLogger } from '../../src/lib/migration/pw1-export/progress'
import { parseArgs } from 'node:util'
import { ExportError } from '../../src/lib/migration/pw1-export/primitives'
const help = `PW1 CSV → JSON master (offline; no database writes)

Export all selected Stores:
  npm run migrate:pw1:export -- --input-dir <csv-dir> --source-config <config.json> --output-dir <new-dir>
Inventory only:
  npm run migrate:pw1:export -- --inventory-only --input-dir <csv-dir> --source-config <config.json> --output-dir <new-dir>
Validate published artifact:
  npm run migrate:pw1:export -- --validate-only --artifact-dir <artifact-dir>

Progress is written to stderr; --quiet disables progress. Final JSON stays on stdout.
Output parent must exist. Existing output is never overwritten.
Exit: 0 export/validation succeeded (inspect outcome.dataStatus); 1 invalid/failed. Legacy validation may return 2 for needs_review.
See docs/runbooks/pw1-master-json-export.md for config and limitations.
`
async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean' },
      quiet: { type: 'boolean' },
      'input-dir': { type: 'string' },
      'source-config': { type: 'string' },
      'output-dir': { type: 'string' },
      'inventory-only': { type: 'boolean' },
      'validate-only': { type: 'boolean' },
      'artifact-dir': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  })
  if (values.help) {
    process.stdout.write(help)
    return
  }
  const progress = values.quiet
    ? undefined
    : progressLogger((line) => process.stderr.write(line))
  if (values['validate-only']) {
    if (
      !values['artifact-dir'] ||
      values['input-dir'] ||
      values['source-config'] ||
      values['output-dir'] ||
      values['inventory-only']
    )
      throw new ExportError('INVALID_CLI_ARGUMENTS')
    const { validateArtifact } =
      await import('../../src/lib/migration/pw1-export/validate-artifact')
    progress?.({ phase: 'validate-artifact' })
    const result = await validateArtifact(values['artifact-dir'])
    process.stdout.write(JSON.stringify(result) + '\n')
    process.exitCode = result.exitCode
  } else {
    if (
      !values['input-dir'] ||
      !values['source-config'] ||
      !values['output-dir'] ||
      values['artifact-dir']
    )
      throw new ExportError('INVALID_CLI_ARGUMENTS')
    const { exportMaster } =
      await import('../../src/lib/migration/pw1-export/export-master')
    const result = await exportMaster(
      values['input-dir'],
      values['source-config'],
      values['output-dir'],
      values['inventory-only'],
      progress,
    )
    if (result.handoff && !values.quiet) {
      process.stderr.write(`Bàn giao: ${JSON.stringify(result.handoff.counts)}. Chưa xác nhận import-ready; xem handoff trong JSON kết quả.\n`)
    }
    process.stdout.write(JSON.stringify(result) + '\n')
    process.exitCode = result.exitCode
  }
}
main().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      error: error instanceof ExportError ? error.code : 'EXPORT_FAILED',
      integrityStatus: 'invalid',
      mappingStatus: 'unverified',
    }) + '\n',
  )
  process.exitCode = 1
})
