/**
 * Confirmation + apply step of `migrate:pw1:delta`: asks y/N (or --yes), writes the
 * changes and records the run. Called only after the guards passed; the CLI holds the delta lock for the whole run.
 */
import { appendFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import type { SanitizedCollectionConfig } from 'payload'
import { applyChanges, type ApplyOutcome } from './delta-apply'
import { ensureDeltaSchema, externalActorTargets, finishRun, generatedWebsiteStores, startRun } from './delta-ledger'
import type { DeltaOptions } from './delta-options'
import { describeTarget, writeJson } from './delta-report'
import { createDeltaRuntime } from './delta-runtime'
import { loadUserCredentials, TargetResolver } from './delta-targets'
import type { EntityChange } from './entity-diff'
import type { LedgerClaim } from './ledger-lookup'
import type { Log, PreparedSide } from './source-pipeline'
import { applyPasswordChanges, type PasswordChange } from './password-sync'
import { buildWebsiteInput } from './website-input'

export async function confirmApply(options: DeltaOptions, count: number, log: Log): Promise<boolean> {
  if (options.yes) return true
  if (!process.stdin.isTTY) { log('No terminal for confirmation and --yes not given: nothing written.'); return false }
  const prompt = createInterface({ input: process.stdin, output: process.stderr })
  // readline swallows Ctrl+C at the prompt; forward it so the CLI cleanup runs.
  prompt.on('SIGINT', () => process.kill(process.pid, 'SIGINT'))
  try {
    const answer = await prompt.question(`\nApply ${count} changes to ${describeTarget(process.env.DATABASE_URI)}? (y/N) `)
    return answer.trim().toLowerCase() === 'y'
  } finally { prompt.close() }
}

export function outcomeTable(outcomes: ApplyOutcome[]): string {
  const counts = new Map<string, number>()
  for (const row of outcomes) counts.set(`${row.collection}|${row.kind}|${row.outcome}`, (counts.get(`${row.collection}|${row.kind}|${row.outcome}`) ?? 0) + 1)
  const lines = ['| collection | change | outcome | count |', '|---|---|---|---:|']
  for (const [key, count] of [...counts].sort()) lines.push(`| ${key.split('|').join(' | ')} | ${count} |`)
  return lines.join('\n')
}

export async function runApply(input: {
  options: DeltaOptions; snapshot: { sourceInstance: string; snapshotId: string }; old: PreparedSide | null; next: PreparedSide
  configs: Record<string, SanitizedCollectionConfig>; claims: ReadonlyMap<string, LedgerClaim>; changes: EntityChange[]; passwordChanges: PasswordChange[]; newCsvFiles: string[]; log: Log
}): Promise<{ failed: number; outcomes: ApplyOutcome[] }> {
  const { options, log } = input
  const runtime = await createDeltaRuntime(process.env.DATABASE_URI)
  try {
    await ensureDeltaSchema(runtime.pool)
    await startRun(runtime.pool, { runId: options.runId, asOf: options.asOf, snapshotId: input.snapshot.snapshotId })
    try {
      const resolver = new TargetResolver(input.claims, await externalActorTargets(runtime.pool, input.snapshot.sourceInstance))
      const websiteStores = await generatedWebsiteStores(runtime.pool)
      const credentials = await loadUserCredentials(path.join(options.out, 'source-new'), input.newCsvFiles)
      const outcomes = await applyChanges({
        runtime, runId: options.runId, sourceInstance: input.snapshot.sourceInstance, next: input.next, configs: input.configs, resolver, log,
        credentials, websiteStores,
      }, input.changes)
      const passwords = await applyPasswordChanges(runtime, { sourceInstance: input.snapshot.sourceInstance, runId: options.runId }, input.passwordChanges, credentials)
      if (passwords.length) log(`Passwords: ${passwords.filter(row => row.outcome === 'written').length} updated, ${passwords.filter(row => row.outcome !== 'written').length} not updated`)
      const createdStores = new Set(outcomes.filter(row => row.collection === 'tenants' && row.kind === 'NEW' && row.outcome === 'written').map(row => row.storeId))
      // Only stores whose writes all succeeded are handed to the website migration.
      const failedStores = new Set(outcomes.filter(row => row.outcome === 'failed' || row.outcome === 'conflict').map(row => row.storeId))
      const siteChanged = new Set(outcomes.filter(row => row.kind === 'CHANGED' && row.outcome === 'written' && (row.collection === 'sites' || row.collection === 'pages')).map(row => row.storeId))
      const onlyStores = options.stores.length ? new Set(options.stores) : null
      const website = await buildWebsiteInput({ old: input.old, next: input.next, resolver, createdStores, siteChanged, generatedStores: websiteStores, failedStores, onlyStores })
      if (website.entries.length) await writeJson(options.out, 'website-input.json', website.entries)
      await writeJson(options.out, 'website-input-report.json', { stores: website.entries.map(entry => (entry.destination as object)), skippedGenerated: website.skippedGenerated, missingDestination: website.missingDestination, skippedFailed: website.skippedFailed })
      log(`Website input: ${website.entries.length} stores${website.entries.length ? ` → ${options.out}/website-input.json` : ''}; generated sites with changed content (not included): ${website.skippedGenerated.length}`)
      const failed = outcomes.filter(row => row.outcome === 'failed').length + passwords.filter(row => row.outcome === 'failed').length
      const summary = { written: outcomes.filter(row => row.outcome === 'written').length, conflicts: outcomes.filter(row => row.outcome === 'conflict').length, failed,
        passwordsUpdated: passwords.filter(row => row.outcome === 'written').length, passwordsNotUpdated: passwords.filter(row => row.outcome !== 'written').length,
        // Per-store conflicts/failures for the tracking screen (studio/qa/migration-diff); capped to keep the row small.
        issues: outcomes.filter(row => row.outcome === 'conflict' || row.outcome === 'failed').slice(0, 2000)
          .map(row => ({ storeId: row.storeId, ref: row.ref, collection: row.collection, code: row.code ?? row.outcome, targetId: row.targetId ?? null })) }
      await finishRun(runtime.pool, options.runId, failed ? 'APPLIED_WITH_FAILURES' : 'APPLIED', summary)
      await writeJson(options.out, 'apply-result.json', { summary, outcomes, passwords })
      await appendFile(path.join(options.out, 'summary.md'), `\n## Apply\n\n${outcomeTable(outcomes)}\n`, { mode: 0o600 })
      return { failed, outcomes }
    } catch (error) {
      // Stores already committed stay committed; the run is marked so it is not mistaken for one in progress.
      await finishRun(runtime.pool, options.runId, 'FAILED', { error: error instanceof Error ? error.message : String(error) }).catch(() => undefined)
      throw error
    }
  } finally { await runtime.close() }
}
