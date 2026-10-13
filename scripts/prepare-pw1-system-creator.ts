import { parseArgs } from 'node:util'
import { prepareSystemCreator } from '../src/lib/migration/pw1-json/prepare-system-creator'
import { MigrationError } from '../src/lib/migration/pw1-json/errors'

async function main() {
  const { values } = parseArgs({ options: { 'export-artifact': { type: 'string' }, 'source-ref': { type: 'string' }, 'approved-by': { type: 'string' }, 'local-database': { type: 'string' }, 'target-host': { type: 'string' }, output: { type: 'string' } }, strict: true, allowPositionals: false })
  const result = await prepareSystemCreator({
    exportArtifact: values['export-artifact'] ?? '',
    sourceRef: values['source-ref'] ?? '',
    approvedBy: values['approved-by'] ?? '',
    output: values.output ?? '',
    localDatabase: values['local-database'],
    targetHost: values['target-host'],
  })
  process.stdout.write(JSON.stringify({ status: 'PREPARED', ...result }) + '\n')
}
main().catch(error => { process.stderr.write(JSON.stringify({ code: error instanceof MigrationError ? error.code : 'SYSTEM_BINDING_PREPARE_FAILED' }) + '\n'); process.exitCode = 2 })
