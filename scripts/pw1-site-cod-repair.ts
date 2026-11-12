/**
 * `npm run migrate:pw1:site-cod -- (--store <ids> | --all) [--apply] [--out <dir>]`
 * After a delta reactivated tenants (#2179), re-enables `site.paymentConfig.enableCod` on sites whose
 * website was already generated (the delta never writes those sites). Dry-run unless --apply.
 * See docs/migration/pw1-stale-expired-rollout-runbook.md (step 4).
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { DeltaError } from '../src/lib/migration/pw1-delta/delta-options'
import { acquireDeltaLock, releaseDeltaLock } from '../src/lib/migration/pw1-delta/delta-ledger'
import { describeTarget } from '../src/lib/migration/pw1-delta/delta-report'
import { createDeltaRuntime } from '../src/lib/migration/pw1-delta/delta-runtime'
import { importedSnapshot, readOnlyPool } from '../src/lib/migration/pw1-delta/ledger-lookup'
import { createRunDir } from '../src/lib/migration/pw1-delta/run-dir'
import { applyCodRepair, findCodRepairCandidates, findNotSelected, parseCodRepairScope, planCodRepair, type CodRepairOutcome } from '../src/lib/migration/pw1-delta/site-cod-repair'
import type { QueryClient } from '../src/lib/migration/pw1-json/runtime'

const HELP = `Re-enable COD on generated-website sites after a delta reactivated their tenant (#2179)

  npm run migrate:pw1:site-cod -- --store <ids> [--apply] [--out <dir>]
  npm run migrate:pw1:site-cod -- --all [--apply] [--out <dir>]

Required env: DATABASE_URI (direct connection). --apply also loads the Payload config (PAYLOAD_SECRET…).
Selects sites with a generated website (pw1_migration_stores completed), tenant active, payment_cod=true,
site enableCod=false, and patches only paymentConfig.enableCod=true when the recorded migration projection
is also false (PATCH). Recorded true → SKIP_PW2_EDITED; nothing recorded → SKIP_NO_PROJECTION.
With --store, every requested store that is not selected is listed with its reason (NOT_GENERATED,
NOT_COMPLETED, TENANT_NOT_ACTIVE, TENANT_COD_OFF, ALREADY_ENABLED).
  --store <ids>  comma-separated PW1 store ids (rollout scope)
  --all          every site in that state, also outside this rollout (e.g. a merchant turned COD on in
                 Payment Settings while the migrated site kept enableCod=false) — only with a separate decision
  --apply        write; without it nothing is written
  --out <dir>    report directory (default .migration/delta-runs/site-cod-<time>)
`

const log = (line: string) => process.stderr.write(line + '\n')

function table(outcomes: CodRepairOutcome[]): string {
  const lines = ['| store | tenant | site | slug | decision | result |', '|---:|---:|---:|---|---|---|']
  for (const o of outcomes) lines.push(`| ${o.storeId} | ${o.tenantId} | ${o.siteId} | ${o.slug} | ${o.decision} | ${o.result ?? (o.decision === 'PATCH' ? 'dry-run' : '-')}${o.error ? ` (${o.error})` : ''} |`)
  return lines.join('\n')
}

function counts(outcomes: CodRepairOutcome[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const o of outcomes) { const key = o.result ? `${o.decision}:${o.result}` : o.decision; result[key] = (result[key] ?? 0) + 1 }
  return result
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { store: { type: 'string' }, all: { type: 'boolean' }, apply: { type: 'boolean' },
    out: { type: 'string' }, help: { type: 'boolean' } }, strict: true })
  if (values.help) { process.stdout.write(HELP); return 0 }
  const scope = parseCodRepairScope(values.store, Boolean(values.all))
  const apply = Boolean(values.apply)
  const out = path.resolve(values.out ?? path.join('.migration', 'delta-runs', `site-cod-${new Date().toISOString().replace(/[:.]/g, '-')}`))
  const target = describeTarget(process.env.DATABASE_URI)
  const pool = readOnlyPool(process.env.DATABASE_URI)
  pool.on('error', error => log(`Database connection error: ${error.message}`))
  // Same lock as the delta: never run while a delta (or another repair) is writing.
  const lock = await acquireDeltaLock(pool)
  try {
    const snapshot = await importedSnapshot(pool)
    await createRunDir(out)
    log(`Target: ${target}\nMode: ${apply ? 'APPLY' : 'dry-run (nothing written)'}\nScope: ${scope.all ? 'all' : `${scope.stores.length} stores`}`)
    const rows = await findCodRepairCandidates(pool as unknown as QueryClient, snapshot.sourceInstance, scope)
    let outcomes = planCodRepair(rows)
    const notSelected = scope.all ? [] : await findNotSelected(pool as unknown as QueryClient, scope.stores, new Set(rows.map(row => row.storeId)))
    const notSelectedCounts: Record<string, number> = {}
    for (const row of notSelected) notSelectedCounts[row.reason] = (notSelectedCounts[row.reason] ?? 0) + 1
    if (apply && outcomes.some(o => o.decision === 'PATCH')) {
      const runtime = await createDeltaRuntime(process.env.DATABASE_URI)
      try { outcomes = await applyCodRepair(runtime, outcomes) } finally { await runtime.close() }
    }
    const summary = counts(outcomes)
    await writeFile(path.join(out, 'report.json'), JSON.stringify({ target, mode: apply ? 'apply' : 'dry-run', scope,
      sourceInstance: snapshot.sourceInstance, generatedAt: new Date().toISOString(), counts: summary, outcomes, notSelectedCounts, notSelected }, null, 2), { mode: 0o600 })
    const markdown = `# Site COD repair\n\n- Target: ${target}\n- Mode: ${apply ? 'apply' : 'dry-run'}\n- Counts: ${JSON.stringify(summary)}\n- Not selected: ${JSON.stringify(notSelectedCounts)}\n\n${table(outcomes)}\n${notSelected.length ? `\n## Not selected\n\n${notSelected.map(row => `- ${row.storeId}: ${row.reason}`).join('\n')}\n` : ''}`
    await writeFile(path.join(out, 'summary.md'), markdown, { mode: 0o600 })
    log(`\n${outcomes.length ? table(outcomes) : 'No site needs COD re-enabled.'}\n\nCounts: ${JSON.stringify(summary)}${notSelected.length ? `\nNot selected (requested stores, see report): ${JSON.stringify(notSelectedCounts)}` : ''}\nReport: ${out}/report.json`)
    return outcomes.some(o => o.result === 'failed') ? 4 : 0
  } finally {
    await releaseDeltaLock(lock).catch(() => undefined)
    await pool.end()
  }
}

main().then(code => process.exit(code), error => {
  log(`pw1-site-cod-repair failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(error instanceof DeltaError || (error as { code?: string })?.code?.startsWith?.('ERR_PARSE_ARGS') ? 2 : 1)
})
