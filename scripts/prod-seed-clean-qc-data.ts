/**
 * Selective QC/test data cleanup for the `prod-seed` Neon branch.
 *
 * Flow: neon branch `prod-seed` (from staging) -> THIS script -> pg_dump ->
 * pg_restore into empty production. Keeps PW1-provenance data (ledger tables
 * migration_entity_map / pw1_delta_map) and system config, deletes QC data,
 * wipes ephemeral/queue tables. See docs/runbooks/prod-db-restore-from-staging-checklist.md.
 *
 *   DATABASE_URI=<prod-seed branch, direct> tsx scripts/prod-seed-clean-qc-data.ts --target-label prod-seed          # dry run
 *   DATABASE_URI=<prod-seed branch, direct> tsx scripts/prod-seed-clean-qc-data.ts --target-label prod-seed --apply  # commit
 *
 * `--delete-review` also deletes REVIEW tenants/users (staging test data the
 * owner chose to purge); @primeweb.app / @primecommerce.asia staff are kept.
 *
 * Optional STAGING_DATABASE_URI / PRODUCTION_DATABASE_URI are only used to
 * refuse a target that shares an endpoint with them.
 */
import { Client } from 'pg'
import { evaluateTargetGuard } from './prod-seed-clean-qc-data-guard'
import { runCleanup, type CleanupReport, type ReportRow } from './prod-seed-clean-qc-data-run'

function readFlag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function printTable(title: string, rows: readonly ReportRow[]): void {
  console.log(`\n${title}`)
  if (!rows.length) { console.log('  (none)'); return }
  const w = Math.max(...rows.map((r) => r.table.length))
  for (const r of rows) console.log(`  ${r.table.padEnd(w)}  ${String(r.count).padStart(8)}  ${r.note}`)
}

function printReport(report: CleanupReport): void {
  const mode = report.applied ? 'APPLIED (committed)' : 'DRY RUN (rolled back, nothing changed)'
  console.log(`\n=== prod-seed QC cleanup: ${mode} ===`)
  printTable('DELETE (qc data and children)', report.rows.filter((r) => r.phase === 'delete'))
  printTable('TRUNCATE (ephemeral / queues)', report.rows.filter((r) => r.phase === 'truncate'))
  printTable('KEEP (rows remaining)', report.rows.filter((r) => r.phase === 'keep'))
  printTable('REVIEW (kept, needs a human decision)', report.rows.filter((r) => r.phase === 'review'))
  console.log('\nSUPER-ADMINS REMAINING (human must approve this list before dump)')
  if (!report.remainingSuperAdmins.length) console.log('  (none) <- prod would have no super-admin!')
  for (const a of report.remainingSuperAdmins) console.log(`  #${a.id}  ${a.email}`)
  if (report.warnings.length) { console.log('\nWARNINGS'); for (const w of report.warnings) console.log(`  - ${w}`) }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const deleteReview = argv.includes('--delete-review')
  const databaseUri = process.env.DATABASE_URI
  const guard = evaluateTargetGuard({
    databaseUri,
    targetLabel: readFlag(argv, '--target-label'),
    forbiddenUris: [process.env.STAGING_DATABASE_URI, process.env.PRODUCTION_DATABASE_URI],
  })
  if (!guard.ok) {
    console.error('REFUSED: unsafe target for prod-seed cleanup')
    for (const reason of guard.reasons) console.error(`  - ${reason}`)
    console.error(`  host: ${guard.host || '<unparseable>'}`)
    process.exit(1)
  }
  if (guard.pooled) console.warn('WARN: pooled endpoint; prefer the direct (non -pooler) connection string')
  console.log(`Target host: ${guard.host} | mode: ${apply ? 'APPLY' : 'DRY RUN'}${deleteReview ? ' + DELETE REVIEW' : ''}`)

  const client = new Client({ connectionString: databaseUri })
  await client.connect()
  try {
    printReport(await runCleanup(client, apply, { deleteReview }))
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error('FAILED (transaction rolled back):', err instanceof Error ? err.message : err)
  process.exit(1)
})
