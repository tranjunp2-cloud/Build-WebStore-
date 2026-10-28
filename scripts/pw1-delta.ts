/**
 * `npm run migrate:pw1:delta -- --new <csv-latest> [--old <csv-imported>]`
 * Rebuilds the latest PW1 CSV snapshot through the original read pipeline and compares it with the import
 * ledger checksums (or, with --old, with a rebuild of the imported snapshot after a parity gate).
 * After the guards pass and the operator confirms (y/N or --yes), the changes are written to DATABASE_URI.
 */
import { appendFile, cp, mkdir, lstat, readdir, rm, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { DeltaError, HELP, parseDeltaOptions } from '../src/lib/migration/pw1-delta/delta-options'
import { normalizeSnapshot } from '../src/lib/migration/pw1-delta/csv-normalize'
import { diskIssues, formatIssues, requiredTables, snapshotIssues } from '../src/lib/migration/pw1-delta/input-guards'
import { goneDocumentStores, importedSnapshot, loadClaims, previouslyExcluded, readOnlyPool } from '../src/lib/migration/pw1-delta/ledger-lookup'
import { prepareSide } from '../src/lib/migration/pw1-delta/source-pipeline'
import { collectionConfigs } from '../src/lib/migration/pw1-delta/collection-configs'
import { compareSnapshots, massChange } from '../src/lib/migration/pw1-delta/delta-compare'
import { acquireDeltaLock, releaseDeltaLock } from '../src/lib/migration/pw1-delta/delta-ledger'
import { changedPasswords } from '../src/lib/migration/pw1-delta/password-sync'
import { loadUserCredentials } from '../src/lib/migration/pw1-delta/delta-targets'
import { confirmApply, outcomeTable, runApply } from '../src/lib/migration/pw1-delta/delta-apply-run'
import { changeTable, describeTarget, summaryMarkdown, writeChanges, writeJson } from '../src/lib/migration/pw1-delta/delta-report'

const log = (line: string) => process.stderr.write(line + '\n')

/** Creates the run directory; inside the repo it must live under the private, git-ignored `.migration/`. */
async function createRunDir(out: string): Promise<void> {
  const repo = process.cwd()
  const inside = (dir: string) => { const rel = path.relative(dir, out); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)) }
  if (inside(repo) && !inside(path.join(repo, '.migration'))) throw new DeltaError('OUT_NOT_PRIVATE', `${out} is inside the repository but not under .migration/`)
  const parent = path.dirname(out)
  if (path.basename(parent) === 'delta-runs') {
    await lstat(path.dirname(parent)).catch(() => { throw new DeltaError('OUT_PARENT_MISSING', path.dirname(parent)) })
    await mkdir(parent, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error })
  }
  await mkdir(out, { mode: 0o700 })
}

/**
 * Keeps the small export reports for audits, then deletes what holds source data: the CSV copies
 * (users_*.csv carries PW1 password material) and the rebuilt artifacts (large, also personal data).
 */
async function cleanRunDir(out: string): Promise<void> {
  for (const side of ['old', 'new']) {
    try {
      const reports = path.join(out, side, 'import')
      for (const name of await readdir(reports).catch(() => [] as string[]))
        if (/^(conflict-details|export-review)\.(json|md)$/.test(name))
          await cp(path.join(reports, name), path.join(out, 'export-reports', `${side}-${name}`)).catch(error => log(`Could not keep ${side}/${name}: ${String(error)}`))
    } finally {
      // The copies of PW1 data (incl. credentials) are removed even if keeping the reports failed.
      await rm(path.join(out, side), { recursive: true, force: true })
      await rm(path.join(out, `source-${side}`), { recursive: true, force: true })
    }
  }
}

/** Ctrl+C / kill: remove the PW1 data copies synchronously before exiting. A store being written rolls back with the connection. */
function cleanOnSignal(out: string): void {
  const handler = (signal: NodeJS.Signals) => {
    log(`\n${signal}: stopping. Removing PW1 data copies in ${out}. A run marked APPLYING in pw1_delta_runs was interrupted; committed stores stay.`)
    for (const name of ['old', 'new', 'source-old', 'source-new']) {
      try { rmSync(path.join(out, name), { recursive: true, force: true }) } catch { log(`Delete ${out}/${name} by hand.`) }
    }
    process.exit(130)
  }
  process.once('SIGINT', handler)
  process.once('SIGTERM', handler)
}

/**
 * SIGKILL / out-of-memory skip every cleanup: point out PW1 data copies left by earlier runs in the same
 * delta-runs folder. Warn only, a run against another database may still be using its folder.
 */
async function warnLeftoverCopies(out: string): Promise<void> {
  const parent = path.dirname(path.resolve(out))
  if (path.basename(parent) !== 'delta-runs') return
  const left: string[] = []
  for (const run of await readdir(parent).catch(() => [] as string[])) {
    if (path.join(parent, run) === path.resolve(out)) continue
    for (const name of ['old', 'new', 'source-old', 'source-new'])
      if (await lstat(path.join(parent, run, name)).then(() => true, () => false)) left.push(path.join(parent, run, name))
  }
  if (left.length) log(`Warning: PW1 data copies (incl. password hashes) left by an interrupted run. If no other delta is running, delete them:\n  rm -rf ${left.join(' ')}`)
}

/** New PW1 users get their password re-encrypted; check the keys before anything is confirmed. */
function credentialKeyIssue(changes: { kind: string; collection: string }[], passwordChanges: number): string | null {
  if (!passwordChanges && !changes.some(change => change.kind === 'NEW' && change.collection === 'users')) return null
  if (!process.env.PW1_APP_KEY) return 'PW1_APP_KEY is required to migrate the passwords of new users'
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.SSO_ENCRYPTION_KEY ?? '')) return 'SSO_ENCRYPTION_KEY (64 hex chars) is required to migrate new users'
  return null
}

async function main(): Promise<number> {
  const options = parseDeltaOptions(process.argv.slice(2))
  if (options.help) { process.stdout.write(HELP); return 0 }
  const pool = readOnlyPool(process.env.DATABASE_URI)
  // An idle connection dropped by the server must surface as a failed run, not crash the process.
  pool.on('error', error => log(`Database connection error: ${error.message}`))
  // One delta at a time for the whole run: changes classified by one run must not be applied after another.
  const lock = await acquireDeltaLock(pool)
  // Without the lock another run could start: stop like Ctrl+C (current store rolls back, CSV copies removed).
  lock.on('error', error => { log(`Lost the delta lock connection: ${error.message}`); process.kill(process.pid, 'SIGTERM') })
  let runDirCreated = false
  try {
    const snapshot = await importedSnapshot(pool)
    await createRunDir(options.out)
    runDirCreated = true
    cleanOnSignal(options.out)
    await warnLeftoverCopies(options.out)
    log(`Run directory: ${options.out}\nTarget: ${describeTarget(process.env.DATABASE_URI)}\nImported snapshot: ${snapshot.sourceInstance}:${snapshot.snapshotId}`)
    const disk = await diskIssues(options.out)
    if (disk.length) { log(formatIssues(disk)); return 2 }

    log('Normalizing CSV copies…')
    const strip = !options.keepQuotes
    const oldCsv = options.oldDir ? await normalizeSnapshot(options.oldDir, path.join(options.out, 'source-old'), strip) : null
    const newCsv = await normalizeSnapshot(options.newDir, path.join(options.out, 'source-new'), strip)
    await writeJson(options.out, 'normalization.json', { stripQuotes: strip, old: oldCsv?.fixes ?? null, new: newCsv.fixes })
    const issues = snapshotIssues(oldCsv, newCsv, await requiredTables(options.profile))
    await writeJson(options.out, 'input-guards.json', { issues, old: oldCsv?.tables ?? null, new: newCsv.tables })
    if (issues.length) { log(`Input check failed:\n${formatIssues(issues)}`); return 2 }

    const common = { profile: options.profile, snapshotId: snapshot.snapshotId, runDir: options.out, log }
    const old = oldCsv ? await prepareSide({ ...common, side: 'old', csvDir: path.join(options.out, 'source-old'), asOf: options.oldAsOf }) : null
    const next = await prepareSide({ ...common, side: 'new', csvDir: path.join(options.out, 'source-new'), asOf: options.asOf })
    for (const side of old ? [old, next] : [next]) if (side.artifact.manifest.sourceInstance !== snapshot.sourceInstance)
      throw new DeltaError('SOURCE_INSTANCE_MISMATCH', `${side.artifact.manifest.sourceInstance} ≠ ${snapshot.sourceInstance}`)

    log('Loading ledger and comparing stores…')
    const [configs, claims, excluded] = await Promise.all([collectionConfigs(), loadClaims(pool, snapshot.sourceInstance), previouslyExcluded(pool)])
    const compare = await compareSnapshots({ old, next, configs, claims, excluded, oldFixes: oldCsv?.fixes ?? [], newFixes: newCsv.fixes, log })
    // The import ledger has no store column: vanished documents get their store from their PW2 tenant.
    const unknownStore = compare.changes.filter(change => change.kind === 'GONE' && !change.storeId && change.target)
    if (unknownStore.length) {
      const stores = await goneDocumentStores(pool, unknownStore.map(change => ({ collection: change.target!.collection, targetId: change.target!.id })), claims)
      for (const change of unknownStore) change.storeId = stores.get(`${change.target!.collection}:${change.target!.id}`) ?? 'unknown'
    }
    const mass = massChange(compare.changes, claims.size)
    if (options.stores.length) compare.changes = compare.changes.filter(change => options.stores.includes(change.storeId))

    if (compare.parity) await writeJson(options.out, 'parity.json', compare.parity)
    await writeChanges(options.out, compare.changes)
    const summary = summaryMarkdown({ runId: options.runId, target: describeTarget(process.env.DATABASE_URI), oldDir: options.oldDir, newDir: options.newDir,
      snapshotId: snapshot.snapshotId, oldAsOf: options.oldAsOf, asOf: options.asOf,
      quoteFixes: strip ? { old: oldCsv?.fixes.length ?? 0, new: newCsv.fixes.length } : null, compare,
      timings: old ? { old: old.timings, new: next.timings } : { new: next.timings } })
    await writeFile(path.join(options.out, 'summary.md'), summary, { mode: 0o600 })
    const parityFailed = compare.parity !== null && !compare.parity.passed
    const blocked = parityFailed || (mass.exceeded && !options.allowMassChange)
    await writeJson(options.out, 'run.json', { runId: options.runId, state: parityFailed ? 'PARITY_FAILED' : blocked ? 'MASS_CHANGE_BLOCKED' : 'COMPARED',
      asOf: options.asOf, snapshotId: snapshot.snapshotId, massChange: mass })

    if (compare.parity) log(`\nParity gate: ${compare.parity.passed ? 'PASSED' : 'FAILED'} (unexplained ${compare.parity.unexplained}, not rebuilt ${compare.parity.missingFromRebuild})`)
    log(changeTable(compare.changes))
    log(`\nReports: ${options.out}/summary.md`)
    if (parityFailed) { log('Nothing will be written: the old snapshot does not reproduce the import.'); return 3 }
    if (mass.exceeded && !options.allowMassChange) {
      log(`Nothing will be written: ${mass.count} changes (limit ${mass.limit}, 5%) / ${mass.gone} removals (limit ${mass.goneLimit}, 1%) of imported documents.\n` +
        'Check the export is complete and run once with --old to re-prove parity; use --allow-mass-change only if the changes are expected.')
      return 3
    }
    // Password changes are invisible to the entity diff (secret fields); they need both users CSVs.
    // Users are not bound to one store, so a --store rehearsal leaves passwords alone.
    const passwordChanges = oldCsv && !options.stores.length
      ? changedPasswords(await loadUserCredentials(path.join(options.out, 'source-old'), oldCsv.tables.map(table => table.file)),
        await loadUserCredentials(path.join(options.out, 'source-new'), newCsv.tables.map(table => table.file)), claims)
      : []
    log(oldCsv ? `PW1 password changes for migrated users: ${passwordChanges.length}` : 'PW1 password changes: not checked (needs --old)')
    await appendFile(path.join(options.out, 'summary.md'), `\n## Passwords\n\n${oldCsv ? `Migrated users whose PW1 password changed: ${passwordChanges.length}` : 'Not checked: run with --old to carry PW1 password changes.'}\n`, { mode: 0o600 })
    if (!compare.changes.length && !passwordChanges.length) { log('Nothing to apply.'); return 0 }
    const keyIssue = credentialKeyIssue(compare.changes, passwordChanges.length)
    if (keyIssue) { log(`Nothing will be written: ${keyIssue}.`); return 2 }
    if (!(await confirmApply(options, compare.changes.length + passwordChanges.length, log))) { log('Not applied. Nothing was written.'); return 0 }
    const applied = await runApply({ options, snapshot, old, next, configs, claims, changes: compare.changes, passwordChanges,
      newCsvFiles: newCsv.tables.map(table => table.file), log })
    log(`\n${outcomeTable(applied.outcomes)}\n\nApply result: ${options.out}/apply-result.json`)
    return applied.failed ? 4 : 0
  } finally {
    if (runDirCreated) await cleanRunDir(options.out).catch(error => log(`Cleanup failed, delete ${options.out}/source-* by hand: ${String(error)}`))
    await releaseDeltaLock(lock).catch(() => undefined)
    await pool.end()
  }
}

main().then(code => process.exit(code), error => {
  log(`pw1-delta failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
