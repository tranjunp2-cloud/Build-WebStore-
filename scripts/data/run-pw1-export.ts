import { parseArgs } from 'node:util'
import { mkdir, realpath, lstat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createSnapshotConfig } from '../../src/lib/migration/pw1-export/snapshot-config'
import { exportMaster } from '../../src/lib/migration/pw1-export/export-master'
import { progressLogger } from '../../src/lib/migration/pw1-export/progress'
import { ExportError } from '../../src/lib/migration/pw1-export/primitives'

// Create each default-output ancestor only after rejecting symlink ancestors.
async function ensurePrivateDirectory(directory: string): Promise<void> {
  try {
    const entry = await lstat(directory)
    if (!entry.isDirectory() || entry.isSymbolicLink() || await realpath(directory) !== directory) {
      throw new ExportError('UNSAFE_CONFIG_OUTPUT')
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await ensurePrivateDirectory(path.dirname(directory))
    await mkdir(directory, { mode: 0o700 }).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    })
    await ensurePrivateDirectory(directory)
  }
}

async function main() {
  const { values: v, positionals } = parseArgs({ options: {
    help: { type: 'boolean' }, 'as-of': { type: 'string' }, profile: { type: 'string' },
    'snapshot-id': { type: 'string' }, 'output-dir': { type: 'string' },
  }, strict: true, allowPositionals: true })
  if (v.help) {
    process.stdout.write('PW1 export (offline; no DB writes)\n\nnpm run migrate:pw1 -- /path/to/csv --as-of 2026-09-18T00:00:00Z\n\nDefaults: configs/migration/pw1-prod-profile.json; new private .migration/runs/<run-id>/ with source-config.json and artifact/. Snapshot ID is generated per run unless --snapshot-id is provided.\nOptional: --profile <file> --snapshot-id <id> --output-dir <new-run-directory>. Output parent must exist. as-of is required; never inferred from filename dates. Default profile inherits UTC, dev target suffix and approved production policies; review these for a different source.\n')
    return
  }
  if (positionals.length !== 1 || !v['as-of']) throw new ExportError('INVALID_CLI_ARGUMENTS')
  if ((await lstat(positionals[0])).isSymbolicLink()) throw new ExportError('SYMLINK_SOURCE')
  const input = await realpath(positionals[0])
  const runId = `pw1-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const output = path.resolve(v['output-dir'] ?? path.join('.migration/runs', runId))
  const relative = path.relative(input, output)
  if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new ExportError('CONFIG_OUTPUT_INSIDE_SOURCE')
  if (!v['output-dir']) await ensurePrivateDirectory(path.dirname(output))
  if (await realpath(path.dirname(output)) !== path.dirname(output)) throw new ExportError('UNSAFE_CONFIG_OUTPUT')
  try { await mkdir(output, { mode: 0o700 }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ExportError('OUTPUT_EXISTS')
    throw error
  }
  const config = path.join(output, 'source-config.json')
  await createSnapshotConfig({ inputDir: input, profile: v.profile ?? 'configs/migration/pw1-prod-profile.json',
    snapshotId: v['snapshot-id'] ?? runId, asOf: v['as-of'], output: config })
  const result = await exportMaster(input, config, path.join(output, 'artifact'), false, progressLogger(line => process.stderr.write(line)))
  process.stdout.write(JSON.stringify({ ...result, sourceConfig: config }) + '\n')
  process.exitCode = result.exitCode
}
main().catch(error => {
  process.stderr.write(JSON.stringify({ error: error instanceof ExportError ? error.code : 'EXPORT_FAILED' }) + '\n')
  process.exitCode = 1
})
