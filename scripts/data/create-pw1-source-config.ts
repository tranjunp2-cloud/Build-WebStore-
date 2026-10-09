import { parseArgs } from 'node:util'
import { createSnapshotConfig } from '../../src/lib/migration/pw1-export/snapshot-config'
import { ExportError } from '../../src/lib/migration/pw1-export/primitives'
async function main() {
  const { values: v } = parseArgs({ options: {
    help: { type: 'boolean' }, 'input-dir': { type: 'string' }, profile: { type: 'string' },
    'snapshot-id': { type: 'string' }, 'as-of': { type: 'string' }, output: { type: 'string' },
  }, strict: true, allowPositionals: false })
  if (v.help) {
    process.stdout.write('Create PW1 source config from one CSV snapshot (offline; no DB writes).\nUse --input-dir <csv-dir> --profile <profile.json> --snapshot-id <id> --as-of <ISO timestamp> --output <new-config.json>\nRequires one dated CSV per required table; duplicate tables, mixed dates and missing tables fail. No source values are read/verified until export. Output parent must exist; output cannot overwrite a file or reside inside input.\n')
    return
  }
  if (!v['input-dir'] || !v.profile || !v['snapshot-id'] || !v['as-of'] || !v.output) throw new ExportError('INVALID_CLI_ARGUMENTS')
  const result = await createSnapshotConfig({ inputDir: v['input-dir'], profile: v.profile, snapshotId: v['snapshot-id'], asOf: v['as-of'], output: v.output })
  process.stdout.write(JSON.stringify(result) + '\n')
}
main().catch(error => {
  process.stderr.write(JSON.stringify({ error: error instanceof ExportError ? error.code : 'CONFIG_CREATION_FAILED' }) + '\n')
  process.exitCode = 1
})
