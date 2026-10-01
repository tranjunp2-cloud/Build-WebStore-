import { parseArgs } from 'node:util'
import { chmod, copyFile, mkdir, readFile, realpath, lstat, writeFile } from 'node:fs/promises'
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

function importTarget(values: { 'target-database'?: string; 'target-host'?: string }): { database: string; host?: string } {
  let uri: URL | undefined
  if (process.env.DATABASE_URI) {
    try { uri = new URL(process.env.DATABASE_URI) } catch { throw new ExportError('IMPORT_TARGET_URI_INVALID') }
    if (!['postgres:', 'postgresql:'].includes(uri.protocol)) throw new ExportError('IMPORT_TARGET_URI_INVALID')
  }
  const uriDatabase = uri ? decodeURIComponent(uri.pathname.slice(1)) : undefined
  const database = values['target-database'] ?? uriDatabase ?? 'primeweb'
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new ExportError('INVALID_TARGET_DATABASE')
  if (uriDatabase && database !== uriDatabase) throw new ExportError('IMPORT_TARGET_DATABASE_MISMATCH')
  const uriHost = uri?.hostname
  const local = uriHost && ['localhost', '127.0.0.1', '[::1]'].includes(uriHost)
  if (uriHost && !local && !uriHost.toLowerCase().endsWith('.neon.tech')) throw new ExportError('IMPORT_TARGET_HOST_UNSUPPORTED')
  const host = values['target-host'] ?? (local ? undefined : uriHost)
  if (host !== undefined && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/i.test(host)) throw new ExportError('INVALID_TARGET_HOST')
  if (uriHost && host && host.toLowerCase() !== uriHost.toLowerCase()) throw new ExportError('IMPORT_TARGET_HOST_MISMATCH')
  if (local && host) throw new ExportError('IMPORT_TARGET_HOST_MISMATCH')
  return { database, ...(host ? { host } : {}) }
}

async function main() {
  const { values: v, positionals } = parseArgs({ options: {
    help: { type: 'boolean' }, 'as-of': { type: 'string' }, profile: { type: 'string' },
    'snapshot-id': { type: 'string' }, 'output-dir': { type: 'string' },
    'target-database': { type: 'string' }, 'target-host': { type: 'string' },
  }, strict: true, allowPositionals: true })
  if (v.help) {
    process.stdout.write('PW1 export (offline; no DB writes)\n\nnpm run migrate:pw1 -- /path/to/csv --as-of 2026-09-18T00:00:00Z\n\nDefaults: configs/migration/pw1-prod-profile.json; new private .migration/runs/<run-id>/ with source-config.json and artifact/. Snapshot ID is generated per run unless --snapshot-id is provided.\nImport target is inferred from DATABASE_URI (.env.local via npm script); without it, local primeweb is used. Optional --target-database and --target-host must match DATABASE_URI when set. Other options: --profile <file> --snapshot-id <id> --output-dir <new-run-directory>. Output parent must exist. as-of is required; never inferred from filename dates. Default profile inherits UTC, dev target suffix and approved production policies; review these for a different source.\n')
    return
  }
  if (positionals.length !== 1 || !v['as-of']) throw new ExportError('INVALID_CLI_ARGUMENTS')
  const target = importTarget(v)
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
  const usersFile = (JSON.parse(await readFile(config, 'utf8')) as { tables?: Record<string, string> }).tables?.users
  if (usersFile) {
    const usersDest = path.join(output, 'users.csv')
    await copyFile(path.join(input, usersFile), usersDest)
    await chmod(usersDest, 0o600)
  }
  const importConfigPath = path.join(output, 'import-config.json')
  const importConfig = {
    version: 1,
    exportArtifact: './artifact',
    ...(usersFile ? { credentials: './users.csv' } : {}),
    localDatabase: target.database,
    ...(target.host ? { targetHost: target.host } : {}),
    systemCreator: { sourceRef: '@users:users:51', approvedBy: process.env.USER || 'operator' },
    outputRoot: './import-runs',
  }
  await writeFile(importConfigPath, JSON.stringify(importConfig, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  process.stderr.write(`Import config: ${importConfigPath}\n`)
  process.stderr.write(`Import dry-run: npm run migrate:pw1:import -- --config ${importConfigPath} --all --dry-run\n`)
  process.stderr.write(`Import:         npm run migrate:pw1:import -- --config ${importConfigPath} --all\n`)
  const handoffPath = path.join(output, 'handoff.json')
  if (result.handoff) {
    await writeFile(handoffPath, JSON.stringify(result.handoff, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    process.stderr.write(`Bàn giao: ${JSON.stringify(result.handoff.counts)}. Chưa xác nhận import-ready. Chi tiết: ${handoffPath}\n`)
  }
  process.stdout.write(JSON.stringify({ ...result, handoff: result.handoff ? { counts: result.handoff.counts, report: handoffPath } : undefined, sourceConfig: config }) + '\n')
  process.exitCode = result.exitCode
}
main().catch(error => {
  process.stderr.write(JSON.stringify({ error: error instanceof ExportError ? error.code : 'EXPORT_FAILED' }) + '\n')
  process.exitCode = 1
})
