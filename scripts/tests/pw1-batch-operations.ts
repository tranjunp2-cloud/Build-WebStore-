/** TC-F35.M32–M34: real local CLI budgets, retry, reports and BE gate. Calls configured AI. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
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
    const cli = async (...args: string[]) => {
        try {
            const result = await exec(process.execPath, ['--require', './scripts/seed-preload.cjs', '--import', 'tsx', 'scripts/migrate-pw1.ts', ...args], { timeout: 240000, maxBuffer: 10 * 1024 * 1024 })
            return { code: 0, output: result.stdout }
        } catch (error) {
            const failure = error as { code?: number; stdout?: string; stderr?: string }
            if (failure.code !== 1) throw error
            return { code: failure.code, output: failure.stdout ?? '', error: failure.stderr }
        }
    }
    try {
        // TC-F35.M36: real failure after importing logo; the next store must still run.
        const failInput = join(dir, 'failure-cleanup.json')
        const failedFixture = fixture(ids[4])
        await writeFile(failInput, JSON.stringify([{ ...failedFixture, website: { ...failedFixture.website,
            settings: { branding: { logo: failedFixture.website.branding.logoUrl, favicon: 'https://example.test/not-approved.png' }, contactInfo: {}, socialLinks: {}, seo: {} },
        } }, fixture(ids[5])]), { mode: 0o600 })
        const failedRun = await cli(failInput)
        assert.equal(failedRun.code, 1, failedRun.output)
        const failureBatch = (await client.query("SELECT * FROM pw1_migration_batches WHERE results @> $1::jsonb ORDER BY started_at DESC LIMIT 1", [JSON.stringify([{ sourceStoreId: ids[4] }])])).rows[0]
        const failedResult = failureBatch.results.find((r: { sourceStoreId: string }) => r.sourceStoreId === ids[4])
        assert.equal(failedResult.status, 'failed')
        assert.equal(failedResult.mediaCleanup.status, 'completed', JSON.stringify(failedResult))
        assert.equal(failedResult.mediaCleanup.results.length, 1)
        assert.equal(failedResult.mediaCleanup.results[0].status, 'deleted')
        assert.equal(failureBatch.results.find((r: { sourceStoreId: string }) => r.sourceStoreId === ids[5]).status, 'completed', JSON.stringify(failureBatch.results) + failedRun.error)
        const failedMapping = (await client.query('SELECT tenant_id FROM pw1_migration_stores WHERE source_store_id=$1', [ids[4]])).rows[0]
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_media WHERE tenant_id=$1', [failedMapping.tenant_id])).rows[0].n, 0)
        console.log('PASS: one batch automatically cleans newly imported image on failure and completes next store')
        const dry = await cli(input, '--dry-run', '--max-generation-attempts', '1')
        assert.equal(dry.code, 0, dry.output)
        const first = await cli(input, '--max-generation-attempts', '1', '--concurrency', '1')
        assert.equal(first.code, 1, first.output)
        const batch = (await client.query("SELECT * FROM pw1_migration_batches WHERE results @> $1::jsonb ORDER BY started_at DESC LIMIT 1", [JSON.stringify([{ sourceStoreId: ids[0] }])])).rows[0]
        assert.deepEqual(batch.results.map((r: { status: string }) => r.status), ['completed', 'deferred', 'deferred'])
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

        const retry = await cli('retry', input)
        assert.equal(retry.code, 0, retry.output)
        const rows = (await client.query('SELECT source_store_id,status FROM pw1_migration_stores WHERE source_store_id=ANY($1) ORDER BY source_store_id', [ids.slice(0,3)])).rows
        assert.equal(rows.length, 3)
        assert.ok(rows.every(row => row.status === 'completed'))
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_attempts WHERE source_store_id=$1', [ids[0]])).rows[0].n, 1)
        console.log('PASS: retry resumes only deferred stores and leaves completed store unchanged')

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
