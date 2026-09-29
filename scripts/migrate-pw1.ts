import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { discoverPreparedInput, runPreparedParts } from '../src/lib/migration/pw1-prepared-input'
import { runMigrationWithAudit } from '../src/lib/migration/pw1-run-audit'
import { parseArgs } from 'node:util'
import { readFile, stat, realpath, mkdir, appendFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateBatchLimits } from '../src/lib/migration/pw1-batch-controls'
import { validateMigrationBatch } from '../src/lib/migration/pw1-batch-validation'

async function main() {
    const { values, positionals } = parseArgs({ options: {
        'audit-base-url': { type: 'string' }, 'audit-output': { type: 'string' },
        concurrency: { type: 'string' }, rerun: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
        store: { type: 'string' }, 'max-attempts': { type: 'string' },
        'max-generation-attempts': { type: 'string' }, 'max-batch-seconds': { type: 'string' },
        'max-store-seconds': { type: 'string' }, 'min-generation-interval-seconds': { type: 'string' },
        'max-design-tokens': { type: 'string' }, 'require-be-data': { type: 'boolean' },
        'runs-root': { type: 'string' },
        apply: { type: 'boolean' }, 'older-than-hours': { type: 'string' }, limit: { type: 'string' }, 'after-id': { type: 'string' },
        batch: { type: 'string' }, format: { type: 'string' },
    }, strict: true, allowPositionals: true })
    if (values.help) {
        console.log(`PW1 migration (bounded preparation; serialized writes; one batch/database)
  npm run migrate:pw1:website [-- --dry-run]
  npm run migrate:pw1:website -- --runs-root /path/to/be-runs [--dry-run]
  npm run migrate:pw1:website -- FILE [--dry-run] [--store ID] [--max-attempts 3] [--concurrency 5]
  npm run migrate:pw1:website -- FILE --rerun
  npm run migrate:pw1:website -- retry FILE [--store ID]
  npm run migrate:pw1:website -- status [--store ID]
  npm run migrate:pw1:website -- logs [--store ID]
  npm run migrate:pw1:website -- audit FILE --audit-base-url http://localhost:3000 --audit-output /tmp/pw1-quality.json (local development only)
  npm run migrate:pw1:website -- FILE --audit-base-url ORIGIN --audit-output REPORT.json
  npm run migrate:pw1:website -- report --batch UUID [--format json|csv]
  npm run migrate:pw1:website -- cleanup-media --store ID [--older-than-hours 168] [--limit 20] [--after-id ID] [--apply]
Without FILE: use the newest completed BE run in .migration/runs (override with --runs-root); process its prepared master parts sequentially.
Each part uses a fresh process; limits apply per part. Finish all parts, then retry failed parts once; failures are logged.
Default: 5 active stores, 3 total attempts/store, automatic cleanup, publication and public audit.
Run FILE again to resume; no separate retry command is required.
Audit defaults to NEXT_PUBLIC_SERVER_URL and FILE.migration-audit.json (+ .md/.jsonl).
Completed matching stores are automatically published through the existing app API.
Publish origin: NEXT_PUBLIC_SERVER_URL (running app with the same destination database).
Publish failures are retried separately without regenerating successful migrations.
Cleanup defaults to dry-run; --apply deletes only unreferenced migration media in a maintenance window.
Run limits: --max-generation-attempts N --max-batch-seconds N --max-store-seconds N
  --min-generation-interval-seconds N --max-design-tokens N --require-be-data
Time limits stop at safe boundaries. Generation spacing is not a provider request rate limit.
Design token limit is observed after responses; excludes other AI calls and may overshoot by one generation.
BE data checks verify availability only, not source ID mapping or complete import.
Default skips unchanged completed stores. Retry selects mapped failed/pending stores.
--rerun explicitly regenerates mapped draft or published sites. Invalid stores are reported without blocking valid stores.
SIGINT/SIGTERM stops at safe boundaries; interrupted writes roll back. Rerun input to recover.
Status/logs are read-only and need only database configuration.`)
        return
    }
    if (values.store && !/^\d+$/.test(values.store)) throw new Error('store must be a numeric PW1 store ID')
    const command = ['status','logs','retry','report','cleanup-media','audit'].includes(positionals[0]) ? positionals.shift() : 'run'
    if (values['runs-root'] && positionals.length > 0) throw new Error('--runs-root is only available when using automatic prepared-input discovery')
    if (['run', 'retry', 'audit'].includes(command) && positionals.length === 0) {
        const selected = await discoverPreparedInput(resolve(values['runs-root'] ?? '.migration/runs'))
        const parts = values.store ? selected.parts.filter(part => part.storeIds.includes(values.store!)) : selected.parts
        if (!parts.length) throw new Error('No matching source store in the completed BE run')
        if (parts.length > 1 && values['audit-output']) throw new Error('Custom --audit-output requires an explicit file or a single --store; automatic mode writes one report per part')
        console.log(`BE input: ${selected.directory}\nMaster parts: ${parts.length}; sequential execution`)
        const logDirectory = resolve(selected.directory, 'website-runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`)
        await mkdir(logDirectory, { recursive: true, mode: 0o700 })
        const attempts: import('../src/lib/migration/pw1-prepared-input').PartAttempt[] = []
        console.log(`Part logs: ${logDirectory}`)
        let interrupted = false
        let child: ReturnType<typeof spawn> | undefined
        const stop = (signal: NodeJS.Signals) => { interrupted = true; child?.kill(signal) }
        const sigint = () => stop('SIGINT'), sigterm = () => stop('SIGTERM')
        process.once('SIGINT', sigint); process.once('SIGTERM', sigterm)
        try {
            process.exitCode = await runPreparedParts(parts, async (part, index, pass) => {
                if (interrupted) return 130
                console.log(`[pass ${pass}, part ${index + 1}/${parts.length}] ${part.path}`)
                await appendFile(resolve(logDirectory, 'parts.jsonl'), JSON.stringify({ event: 'started', path: part.path, index, pass, time: new Date().toISOString() }) + '\n', { mode: 0o600 })
                // Retry uses normal ledger skip semantics, even if the initial pass requested --rerun.
                const forwarded = process.argv.slice(2).filter(arg => pass === 1 || arg !== '--rerun')
                for (let i = 0; i < forwarded.length; i++) {
                    if (forwarded[i] === '--runs-root') { forwarded.splice(i, 2); i-- }
                    else if (forwarded[i].startsWith('--runs-root=')) { forwarded.splice(i, 1); i-- }
                }
                return new Promise<number>((resolve) => {
                    child = spawn(process.execPath, [...process.execArgv, process.argv[1], ...forwarded, part.path], { stdio: 'inherit' })
                    child.once('error', error => { console.error(`Could not start part: ${error.message}`); resolve(1) })
                    child.once('exit', (code, signal) => {
                        child = undefined
                        const result = interrupted || signal ? 130 : code ?? 1
                        if (result !== 0) console.error(`Part ${index + 1}/${parts.length} failed on pass ${pass} (exit ${result})`)
                        resolve(result)
                    })
                })
            }, async attempt => {
                attempts.push(attempt)
                await appendFile(resolve(logDirectory, 'parts.jsonl'), JSON.stringify({ event: 'finished', ...attempt, time: new Date().toISOString() }) + '\n', { mode: 0o600 })
            })
            const latest = new Map(attempts.map(attempt => [attempt.path, attempt]))
            const failedParts = [...latest.values()].filter(attempt => attempt.exitCode !== 0)
            await writeFile(resolve(logDirectory, 'summary.json'), JSON.stringify({ input: selected.directory, exitCode: process.exitCode, attempts, failedParts }, null, 2), { mode: 0o600 })
            console.log(`Finished: ${failedParts.length} failed part(s); summary: ${resolve(logDirectory, 'summary.json')}`)
        } finally { process.removeListener('SIGINT', sigint); process.removeListener('SIGTERM', sigterm) }
        return
    }
    // A normal invocation owns the whole flow; operators only supply the input file.
    if (['run', 'retry'].includes(command) && !values['dry-run']
        && values['audit-base-url'] === undefined && values['audit-output'] === undefined) {
        if (!process.env.NEXT_PUBLIC_SERVER_URL) throw new Error('NEXT_PUBLIC_SERVER_URL is required for automatic publication and audit')
        if (positionals.length !== 1) throw new Error('Expected one input file; use --help')
        values['audit-base-url'] = process.env.NEXT_PUBLIC_SERVER_URL
        values['audit-output'] = resolve(`${positionals[0]}.migration-audit.json`)
    }
    const auditRequested = command === 'audit' || values['audit-base-url'] !== undefined || values['audit-output'] !== undefined
    if (auditRequested && (!['run','retry','audit'].includes(command) || !values['audit-base-url'] || !values['audit-output'] || values['dry-run'])) throw new Error('Audit requires input, --audit-base-url and --audit-output; not compatible with dry-run/status/report/cleanup')
    if (auditRequested) {
        const base = new URL(values['audit-base-url']!)
        if (!['http:','https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Audit base URL must be an HTTP(S) origin')
    }
    const numeric = (key: keyof typeof values) => values[key] === undefined ? undefined : Number(values[key])
    const limits = validateBatchLimits({ maxGenerationAttempts: numeric('max-generation-attempts'), maxBatchSeconds: numeric('max-batch-seconds'),
        maxStoreSeconds: numeric('max-store-seconds'), minGenerationIntervalSeconds: numeric('min-generation-interval-seconds'), maxDesignTokens: numeric('max-design-tokens') })
    const hasRunOptions = values.concurrency || values.rerun || values['dry-run'] || values['max-attempts'] || values['require-be-data'] || Object.values(limits).some(v => v !== undefined)
    if (command === 'cleanup-media') {
        if (positionals.length || hasRunOptions || values.batch || values.format) throw new Error('cleanup-media accepts --store, --older-than-hours, --limit, --after-id and --apply only')
        const { cleanupPw1Media } = await import('../src/lib/migration/pw1-media-cleanup')
        await cleanupPw1Media({ store: values.store ?? '', apply: values.apply, olderThanHours: numeric('older-than-hours'), limit: numeric('limit'), afterId: numeric('after-id') })
        return
    }
    if (values.apply !== undefined || values['older-than-hours'] !== undefined || values.limit !== undefined || values['after-id'] !== undefined) throw new Error('Cleanup options are only available for cleanup-media')
    if (command === 'report') {
        if (positionals.length || hasRunOptions || values.store) throw new Error('report accepts only --batch and --format')
        if (!values.batch || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values.batch)) throw new Error('report requires a valid --batch UUID')
        if (values.format && !['json','csv'].includes(values.format)) throw new Error('format must be json or csv')
        const { exportMigrationReport } = await import('../src/lib/migration/pw1-operations')
        process.stdout.write(await exportMigrationReport(values.batch, values.format === 'csv' ? 'csv' : 'json'))
        return
    }
    if (values.batch || values.format) throw new Error('--batch and --format are only available for report')
    if (command === 'status' || command === 'logs') {
        if (positionals.length || hasRunOptions) throw new Error('status/logs only accept --store')
        const { inspectMigration } = await import('../src/lib/migration/pw1-operations')
        console.log(JSON.stringify(await inspectMigration(command, values.store), null, 2)); return
    }
    if (positionals.length !== 1) throw new Error('Expected one input file; use --help')
    if (values.rerun && (values['dry-run'] || command === 'retry')) throw new Error('--rerun cannot be combined with dry-run or retry')
    const maxAttempts = Number(values['max-attempts'] ?? 3)
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error('max-attempts must be 1–5')
    const path = await realpath(resolve(positionals[0]))
    const file = await stat(path)
    if (!file.isFile()) throw new Error('Input must be a file')
    if (auditRequested) for (const suffix of ['', '.md', '.jsonl']) {
        const outputPath = resolve(values['audit-output']! + suffix)
        if (await realpath(outputPath).catch(() => outputPath) === path) throw new Error('Audit output cannot overwrite input')
    }
    const parsed = validateMigrationBatch(JSON.parse(await readFile(path, 'utf8')))
    const entries = values.store ? parsed.entries.filter(e => e.sourceStoreId === values.store) : parsed.entries
    const errors = values.store ? parsed.errors.filter(e => e.sourceStoreId === values.store) : parsed.errors
    const skipped = values.store ? parsed.skipped.filter(e => e.sourceStoreId === values.store) : parsed.skipped
    if (skipped.length) console.log(JSON.stringify({ status: 'skipped', stores: skipped }, null, 2))
    if (!entries.length && !errors.length) {
        if (skipped.length) return
        throw new Error('No matching source store in input')
    }
    if (command === 'audit' && hasRunOptions) throw new Error('audit does not accept migration run options')
    const runAudit = async () => {
        const { auditPw1Websites } = await import('../src/lib/migration/pw1-quality-audit')
        const summary = await auditPw1Websites(entries, values['audit-base-url']!, resolve(values['audit-output']!))
        console.log(JSON.stringify({qualityAudit:summary,inputErrors:errors,report:resolve(values['audit-output']!)}))
        if (summary.errors || summary.skipped || errors.length) process.exitCode = 2
    }
    if (command === 'audit') { await runAudit(); return }
    const controller = new AbortController()
    const stop = () => { console.error('Stopping at next safe boundary…'); controller.abort() }
    process.once('SIGINT', stop); process.once('SIGTERM', stop)
    try {
        const { runPw1Batch } = await import('../src/lib/migration/pw1-batch')
        await runMigrationWithAudit(() => runPw1Batch(entries, { concurrency: numeric('concurrency'), limits, requireBeData: values['require-be-data'], dryRun: values['dry-run'], rerun: values.rerun, retryOnly: command === 'retry', maxAttempts, signal: controller.signal, inputReports: parsed.reports, invalidStores: errors }), auditRequested ? runAudit : undefined)
    } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop) }
}
main().then(() => process.exit(process.exitCode ?? 0)).catch(error => {
    console.error(error instanceof Error ? error.message : 'Migration failed')
    process.exit(1)
})
