import { parseArgs } from 'node:util'
import { readFile, stat, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseMigrationInput } from '../src/lib/migration/pw1-collection-input'

async function main() {
    const { values, positionals } = parseArgs({ options: {
        rerun: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
    }, strict: true, allowPositionals: true })
    if (values.help) {
        console.log(`PW1 batch website migration
Usage: npm run migrate:pw1 -- ./pw1-websites.json
       npm run migrate:pw1 -- ./pw1-websites.json --dry-run
       npm run migrate:pw1 -- ./pw1-websites.json --rerun
One input array: compact website entries or BE collection bundles. Default: apply; dry-run has no AI/DB writes.
Environment: existing process variables or project .env.local/.env (loaded by preload).
Maps accounts/stores and saves backups/progress in the destination database; no per-store JSON files.
Completed unchanged stores are skipped. --rerun explicitly regenerates mapped draft sites.
Unmapped stores receive a new tenant/site; existing user credentials are preserved.
One active batch per database; failures are reported and remaining stores continue.`)
        return
    }
    if (positionals.length !== 1) throw new Error('Usage: npm run migrate:pw1 -- FILE [--dry-run | --rerun]')
    if (values['dry-run'] && values.rerun) throw new Error('Choose --dry-run or --rerun')
    const path = await realpath(resolve(positionals[0]))
    const file = await stat(path)
    if (!file.isFile() || file.size > 100 * 1024 * 1024) throw new Error('Input must be a JSON file no larger than 100 MiB')
    const { entries, reports } = parseMigrationInput(JSON.parse(await readFile(path, 'utf8')))
    if (reports.length) console.log(JSON.stringify({ collectionInputReports: reports }, null, 2))
    const { runPw1Batch } = await import('../src/lib/migration/pw1-batch')
    await runPw1Batch(entries, { dryRun: values['dry-run'], rerun: values.rerun, inputReports: reports })
}
main().then(() => process.exit(0)).catch(error => {
    console.error(error instanceof Error ? error.message : 'Migration failed')
    process.exit(1)
})
