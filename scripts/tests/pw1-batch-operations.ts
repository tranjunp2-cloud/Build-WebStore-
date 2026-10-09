/** TC-F35.M32–M34 / M46: real local CLI budgets, retry, reports and BE gate. Calls configured AI. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { getPayload } from 'payload'
import config from '@payload-config'
const exec = promisify(execFile)

async function main() {
    const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connectionString || !['localhost','127.0.0.1','::1'].includes(new URL(connectionString).hostname)) throw new Error('Local DB only')
    const client = new Client({ connectionString }); await client.connect()
    const dir = await mkdtemp(join(tmpdir(), 'pw1-batch-qa-'))
    const prefix = `98${Date.now()}`
    const ids = [0, 1, 2, 3, 4, 5].map(i => `${prefix}${i}`)
    const fixture = (id: string) => ({ sourceUserId: id, sourceStoreId: id, owner: { email: `qa-${id}@example.test`, firstName: 'Batch QA' },
        source: { websiteUrl: 'https://example.test' }, website: { name: 'Batch QA', locale: 'en', branding: { logoUrl: 'https://tm-prime-web-dev.sgp1.digitaloceanspaces.com/tm-primeweb-dev/img/2022/4IaqkSz-s5KHmG5wIpzYGD5RLrq3zSGJZbA2xoLxOfE.png' }, navigation: [], footer: { copyright: '', columns: [] },
            pages: [{ sourceId: '1', title: 'Home', path: '/', components: [{ sourceId: '2', type: 'rich_text', content: { html: '<p>Keep this source text</p>' } }] }] } })
    const input = join(dir, 'input.json'), strictInput = join(dir, 'strict.json')
    await writeFile(input, JSON.stringify(ids.slice(0, 3).map(fixture)), { mode: 0o600 })
    const strict = fixture(ids[3])
    await writeFile(strictInput, JSON.stringify([{ ...strict, website: { ...strict.website, pages: [{ sourceId: '1', title: 'Home', path: '/', components: [
        { sourceId: '2', type: 'product_listing', content: { heading: 'Products' }, binding: { source: 'pw2.database', collection: 'products', scope: 'site', emptyBehavior: 'native-empty-state' } },
    ] }] } }]), { mode: 0o600 })
    const cliAtOrigin = async (origin: string, ...args: string[]) => {
        try {
            const result = await exec(process.execPath, ['--require', './scripts/seed-preload.cjs', '--import', 'tsx', 'scripts/migrate-pw1.ts', ...args], { env: { ...process.env, NEXT_PUBLIC_SERVER_URL: origin }, timeout: 240000, maxBuffer: 10 * 1024 * 1024 })
            return { code: 0, output: result.stdout }
        } catch (error) {
            const failure = error as { code?: number; stdout?: string; stderr?: string }
            if (failure.code !== 1) throw error
            return { code: failure.code, output: failure.stdout ?? '', error: failure.stderr }
        }
    }
    const cli = (...args: string[]) => cliAtOrigin('http://localhost:3000', ...args)
    try {
        // TC-F35.M36: real failure after importing logo; the next store must still run.
        const failInput = join(dir, 'failure-cleanup.json')
        const failedFixture = fixture(ids[4])
        await writeFile(failInput, JSON.stringify([{ ...failedFixture, website: { ...failedFixture.website,
            settings: { branding: { logo: failedFixture.website.branding.logoUrl, favicon: 'https://example.test/not-approved.png' }, contactInfo: {}, socialLinks: {}, seo: {} },
        } }, fixture(ids[5])]), { mode: 0o600 })
        const auditOutput = join(dir, 'partial-publish-audit.json')
        const failedRun = await cli(failInput, '--concurrency', '1', '--max-attempts', '3', '--audit-base-url', 'http://localhost:3000', '--audit-output', auditOutput)
        assert.equal(failedRun.code, 1, failedRun.output)
        const failureBatch = (await client.query("SELECT * FROM pw1_migration_batches WHERE results @> $1::jsonb ORDER BY started_at DESC LIMIT 1", [JSON.stringify([{ sourceStoreId: ids[4] }])])).rows[0]
        const failedResult = failureBatch.results.find((r: { sourceStoreId: string }) => r.sourceStoreId === ids[4])
        assert.equal(failedResult.status, 'failed')
        const failedAttempts = (await client.query('SELECT attempt_number,status FROM pw1_migration_attempts WHERE batch_id=$1 AND source_store_id=$2 ORDER BY attempt_number', [failureBatch.id,ids[4]])).rows
        assert.deepEqual(failedAttempts.map(a => a.attempt_number), [1,2,3])
        assert.ok(failedAttempts.every(a => a.status === 'failed'))
        assert.ok(failedRun.error?.includes('retrying automatically'))
        assert.equal(failedResult.mediaCleanup.status, 'completed', JSON.stringify(failedResult))
        assert.equal(failedResult.mediaCleanup.results.length, 1)
        assert.equal(failedResult.mediaCleanup.results[0].status, 'deleted')
        assert.ok(['completed','completed_with_warnings'].includes(failureBatch.results.find((r: { sourceStoreId: string }) => r.sourceStoreId === ids[5]).status), JSON.stringify(failureBatch.results) + failedRun.error)
        assert.equal(failureBatch.results.find((r: { sourceStoreId: string }) => r.sourceStoreId === ids[5]).publish.status, 'published')
        assert.equal(failedResult.publish, undefined)
        const audited = JSON.parse(await readFile(auditOutput,'utf8'))
        assert.equal(audited.summary.checked, 1)
        assert.equal(audited.summary.skipped, 1)
        const failedMapping = (await client.query('SELECT tenant_id FROM pw1_migration_stores WHERE source_store_id=$1', [ids[4]])).rows[0]
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_media WHERE tenant_id=$1', [failedMapping.tenant_id])).rows[0].n, 0)
        console.log('PASS: one batch automatically cleans failed media, generates/publishes next store and audits partial completion')
        const dry = await cli(input, '--dry-run', '--max-generation-attempts', '1')
        assert.equal(dry.code, 0, dry.output)
        const first = await cli(input, '--max-generation-attempts', '1', '--concurrency', '1')
        assert.equal(first.code, 1, first.output)
        const batch = (await client.query("SELECT * FROM pw1_migration_batches WHERE results @> $1::jsonb ORDER BY started_at DESC LIMIT 1", [JSON.stringify([{ sourceStoreId: ids[0] }])])).rows[0]
        assert.deepEqual(batch.results.map((r: { status: string }) => r.status === 'completed_with_warnings' ? 'completed' : r.status), ['completed', 'deferred', 'deferred'])
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_stores WHERE source_store_id=ANY($1)', [ids.slice(0,3)])).rows[0].n, 1)
        const report = await cli('report', '--batch', batch.id)
        assert.equal(report.code, 0)
        const parsed = JSON.parse(report.output)
        assert.equal(parsed.totals.attempts, 1)
        assert.equal(parsed.totals.deferred, 2)
        assert.equal(parsed.totals.completed, 1)
        assert.ok(parsed.totals.observedDesignTokens > 0)
        assert.equal(parsed.costUsd, null)
        const csv = await cli('report', '--batch', batch.id, '--format', 'csv')
        assert.equal(csv.code, 0)
        assert.ok(csv.output.startsWith('"sourceStoreId"'))
        console.log('PASS: generation limit defers remaining stores before provisioning; JSON/CSV report includes usage')

        const retry = await cliAtOrigin('http://127.0.0.1:1', 'retry', input, '--max-attempts', '2')
        assert.equal(retry.code, 1, retry.output)
        const rows = (await client.query('SELECT source_store_id,status FROM pw1_migration_stores WHERE source_store_id=ANY($1) ORDER BY source_store_id', [ids.slice(0,3)])).rows
        assert.equal(rows.length, 3)
        assert.ok(rows.every(row => row.status === 'completed'))
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_attempts WHERE source_store_id=$1', [ids[0]])).rows[0].n, 1)
        console.log('PASS: retry resumes only deferred stores and leaves completed store unchanged')

        // TC-F35.M48: publish is automatic and can be retried without new generations.
        const fixtureSites = (await client.query('SELECT site_id FROM pw1_migration_stores WHERE source_store_id=ANY($1)', [ids.slice(0,3)])).rows.map(r=>r.site_id)
        const attemptsBeforePublish = (await client.query('SELECT count(*)::int AS n FROM pw1_migration_attempts WHERE source_store_id=ANY($1)', [ids.slice(0,3)])).rows[0].n
        assert.equal((await client.query("SELECT count(*)::int AS n FROM sites WHERE id=ANY($1) AND status='published'", [fixtureSites])).rows[0].n, 1)
        const unavailable = await cliAtOrigin('http://127.0.0.1:1', input, '--max-attempts', '2')
        assert.equal(unavailable.code,1)
        const publishFailure = (await client.query("SELECT results FROM pw1_migration_batches WHERE results @> $1::jsonb ORDER BY started_at DESC LIMIT 1", [JSON.stringify([{sourceStoreId:ids[0]}])])).rows[0]
        assert.equal(publishFailure.results.filter((r:{publish:{status:string;attempts:number}})=>r.publish.status==='failed'&&r.publish.attempts===2).length, 2)
        const published = await cli('retry', input)
        assert.equal(published.code,0,published.output + published.error)
        assert.ok((await client.query('SELECT status FROM sites WHERE id=ANY($1)', [fixtureSites])).rows.every(r=>r.status==='published'))
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_attempts WHERE source_store_id=ANY($1)', [ids.slice(0,3)])).rows[0].n,attemptsBeforePublish)
        const again = await cli(input)
        assert.equal(again.code,0,again.output)
        const latestPublished = (await client.query("SELECT results FROM pw1_migration_batches WHERE results @> $1::jsonb ORDER BY started_at DESC LIMIT 1", [JSON.stringify([{sourceStoreId:ids[0]}])])).rows[0]
        assert.ok(latestPublished.results.every((r:{publish:{status:string;attempts:number}})=>r.publish.status==='already-published'&&r.publish.attempts===0))
        console.log('PASS: automatic publish; publish failures retry then continue; retry publishes without generation; already-published is untouched')

        const gate = await cli(strictInput, '--require-be-data')
        assert.equal(gate.code, 1, gate.output)
        assert.ok(gate.output.includes('BE_DATA_MISSING'))
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_stores WHERE source_store_id=$1', [ids[3]])).rows[0].n, 0)
        const beforeCount = (await client.query('SELECT count(*)::int AS n FROM pw1_migration_batches')).rows[0].n
        assert.equal((await cli(input, '--dry-run')).code, 0)
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_batches')).rows[0].n, beforeCount)
        console.log('PASS: strict BE gate blocks before provisioning; dry-run creates no batch')
    } finally {
        const payload = await getPayload({ config })
        try {
            const mappings = (await client.query('SELECT s.*,a.user_id FROM pw1_migration_stores s JOIN pw1_migration_accounts a USING(source_user_id) WHERE source_store_id=ANY($1)', [ids])).rows
            const batches = (await client.query("SELECT id,results FROM pw1_migration_batches WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(results) r WHERE r->>'sourceStoreId'=ANY($1))", [ids])).rows
            assert.ok(batches.every(b => b.results.every((r: { sourceStoreId?: string }) => ids.includes(r.sourceStoreId ?? ''))))
            await client.query('DELETE FROM pw1_migration_commits WHERE source_store_id=ANY($1)', [ids])
            await client.query('DELETE FROM pw1_migration_attempts WHERE source_store_id=ANY($1)', [ids])
            await client.query('DELETE FROM pw1_migration_stores WHERE source_store_id=ANY($1)', [ids])
            await client.query('DELETE FROM pw1_migration_accounts WHERE source_user_id=ANY($1)', [ids])
            await client.query('DELETE FROM pw1_migration_batches WHERE id=ANY($1::uuid[])', [batches.map(b => b.id)])
            for (const mapping of mappings) {
                await payload.delete({ collection: 'pages', where: { site: { equals: mapping.site_id } } })
                await payload.delete({ collection: 'sites', id: mapping.site_id })
                await payload.delete({ collection: 'media', where: { filename: { contains: `pw1-${mapping.tenant_id}-` } } })
                await payload.delete({ collection: 'users', id: mapping.user_id })
                await payload.delete({ collection: 'tenants', id: mapping.tenant_id })
            }
        } finally { await payload.destroy(); await client.end(); await rm(dir, { recursive: true, force: true }) }
    }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
