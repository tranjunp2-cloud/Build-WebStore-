import { parseArgs } from 'node:util'
import { prepareImportArtifact } from '../src/lib/migration/pw1-json/credentials'
import { MigrationError } from '../src/lib/migration/pw1-json/errors'

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'export-artifact': { type: 'string' }, credentials: { type: 'string' }, 'creator-bindings': { type: 'string' }, output: { type: 'string' } }, strict: true, allowPositionals: false })
  if (!values['export-artifact'] || !values.output) throw new MigrationError('PREPARE_ARGUMENTS_REQUIRED')
  const result = await prepareImportArtifact({ exportArtifact: values['export-artifact'], credentials: values.credentials, creatorBindings: values['creator-bindings'], output: values.output })
  process.stdout.write(JSON.stringify({ status: 'PREPARED', manifestPath: result.manifestPath }) + '\n')
}
main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ code: error instanceof MigrationError ? error.code : 'PREPARE_FAILED' }) + '\n')
  process.exitCode = 2
})
