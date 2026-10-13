import { configureMigrationTransactions } from '../../src/lib/migration/pw1-transactions'
import { MigrationMutex } from '../../src/lib/migration/pw1-concurrency'
import { withPw1MediaTracking } from '../../src/lib/migration/pw1-media-tracking'
/** Local DB integration for TC-F35.M30/M31. Never runs against a remote database. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import { Client } from 'pg'
import { sql } from 'drizzle-orm'
import config from '../../src/payload.config'
import { withAtomicSiteWrite } from '../../src/lib/migration/pw1-atomic-write'
import { recoverInterruptedBatches, inspectMigration } from '../../src/lib/migration/pw1-operations'
import { importPw1BlockMedia } from '../../src/lib/migration/pw1-media'
import { createHash } from 'node:crypto'

async function main() {
    process.env.PAYLOAD_PUSH_SCHEMA = 'false'
    const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
    const url = new URL(connectionString!)
    assert(['localhost','127.0.0.1'].includes(url.hostname), 'Local database only')
    const payload = await getPayload({ config })
    configureMigrationTransactions(payload)
    const snapshot = async (id: number) => {
        const s = await payload.findByID({ collection: 'sites', id, depth: 0 })
        const p = await payload.find({ collection: 'pages', where: { site: { equals: id } }, pagination: false, depth: 0 })
        return { site: { id, updatedAt: String(s.updatedAt) }, pages: p.docs.map(p => ({ id: Number(p.id), updatedAt: String(p.updatedAt) })) }
    }
    if (process.argv[2] === '--child') {
        const id = Number(process.argv[3]), before = await snapshot(id)
        await withAtomicSiteWrite(payload, before.site, before.pages, async (scoped, begin) => {
            await begin()
            await scoped.update({ collection: 'sites', id, data: { name: 'uncommitted worker' } })
            process.stdout.write('READY_TO_KILL\n')
            await new Promise(() => { /* Parent kills this worker to exercise DB rollback. */ })
        })
        return
    }
    const client = new Client({ connectionString }); await client.connect()
    const source = `9${Date.now()}`
    let tenantId: number | undefined, userId: number | undefined, siteId: number | undefined, mediaId: number | undefined
    let batchId: string | undefined
    try {
        assert.equal((await client.query('SELECT pg_try_advisory_lock(351827,0) AS locked')).rows[0].locked, true)
        await client.query(await readFile(new URL('../sql/pw1-migration-batch.sql', import.meta.url), 'utf8'))
        // TC-F35.M38: concurrent pool reads must not move transaction statements between connections.
        const dbForPin = payload.db as unknown as { drizzle: { execute(query: unknown): Promise<unknown>; transaction<T>(fn: (tx: { execute(query: unknown): Promise<{ rows: Array<{ pid: number; xid: string }> }> }) => Promise<T>): Promise<T> } }
        await dbForPin.drizzle.transaction(async tx => {
            const before = (await tx.execute(sql`SELECT pg_backend_pid() AS pid,txid_current()::text AS xid`)).rows[0]
            await Promise.all(Array.from({ length: 5 }, () => dbForPin.drizzle.execute(sql`SELECT 1`)))
            const after = (await tx.execute(sql`SELECT pg_backend_pid() AS pid,txid_current()::text AS xid`)).rows[0]
            assert.deepEqual(after, before)
        })
        console.log('PASS: transaction stays on one connection during concurrent pool reads')
        const tenant = await payload.create({ collection: 'tenants', data: { name: 'Migration reliability fixture', slug: `migration-qa-${source}`, plan: 'free' } })
        tenantId = Number(tenant.id)
        const user = await payload.create({ collection: 'users', data: { firstName: 'Migration QA', email: `${source}@example.test`, password: randomUUID(), roles: ['tenant-owner'], tenants: [{ tenant: tenantId, role: 'owner', status: 'active' }] } })
        userId = Number(user.id)
        const site = await payload.create({ collection: 'sites', data: { name: 'Original site', tenant: tenantId, status: 'draft', generationStatus: 'none' } })
        siteId = Number(site.id)
        const page = await payload.create({ collection: 'pages', data: { title: 'Original page', site: siteId, slug: 'home', isHomepage: true, layout: [{ blockType: 'custom-html', html: '<p>Original</p>' }] } })
        const before = await snapshot(siteId)
        await assert.rejects(withAtomicSiteWrite(payload, before.site, before.pages, async (scoped, begin) => {
            await begin()
            await scoped.update({ collection: 'sites', id: siteId!, data: { name: 'Should roll back' } })
            await scoped.delete({ collection: 'pages', id: page.id })
            throw new Error('intentional write failure')
        }), /intentional write failure/)
        assert.equal((await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })).name, 'Original site')
        assert.equal((await payload.findByID({ collection: 'pages', id: page.id, depth: 0 })).title, 'Original page')
        await assert.rejects(withAtomicSiteWrite(payload, before.site, before.pages, async (scoped, begin) => {
            await begin()
            await assert.rejects(scoped.update({ collection: 'sites', id: siteId!, data: { name: '' } }))
            // Payload removes failed sessions: a subsequent call must never fall back to autocommit.
            await scoped.update({ collection: 'sites', id: siteId!, data: { name: 'Must not escape transaction' } })
        }))
        assert.equal((await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })).name, 'Original site')
        console.log('PASS: transaction failure preserves site/pages and fences aborted sessions')
        // TC-F35.M37: two preparations overlap without holding DB transactions.
        const sessions = () => Object.keys((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).length
        const baselineSessions = sessions(), gate = new MigrationMutex()
        let prepared = 0, activeWriters = 0, maxWriters = 0
        let ready!: () => void
        const bothPrepared = new Promise<void>(resolve => { ready = resolve })
        const concurrent = await Promise.allSettled([0,1].map(index => withAtomicSiteWrite(payload, before.site, before.pages, async (scoped, begin) => {
            assert.equal(sessions(), baselineSessions)
            if (++prepared === 2) ready()
            await bothPrepared
            await begin()
            await scoped.update({ collection: 'sites', id: siteId!, data: { name: `Prepared ${index}` } })
        }, async () => {
            const release = await gate.acquire()
            maxWriters = Math.max(maxWriters, ++activeWriters)
            return () => { activeWriters--; release() }
        })))
        assert.equal(prepared, 2); assert.equal(maxWriters, 1)
        assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1)
        assert.equal(concurrent.filter(r => r.status === 'rejected').length, 1)
        assert.ok(concurrent.some(r => r.status === 'rejected' && String(r.reason).includes('Site changed')))
        await payload.update({ collection: 'sites', id: siteId, data: { name: 'Original site' } })
        console.log('PASS: preparation overlaps without transactions; serialized writes detect stale snapshots')
        const child = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), '--child', String(siteId)], { stdio: ['ignore','pipe','pipe'] })
        await new Promise<void>((resolve, reject) => {
            let output = ''
            const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Child never reached write boundary')) }, 30000)
            child.stdout.on('data', data => { output += data.toString(); if (output.includes('READY_TO_KILL')) child.kill('SIGKILL') })
            child.on('error', reject)
            child.on('exit', (_code, signal) => { clearTimeout(timeout); if (signal === 'SIGKILL' && output.includes('READY_TO_KILL')) resolve(); else reject(new Error('Unexpected child exit')) })
        })
        assert.equal((await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })).name, 'Original site')
        console.log('PASS: killed worker rolls back uncommitted writes')
        await client.query('INSERT INTO pw1_migration_accounts(source_user_id,email,user_id) VALUES($1,$2,$3)', [source, user.email, userId])
        await client.query("INSERT INTO pw1_migration_stores(source_store_id,source_user_id,tenant_id,site_id,status) VALUES($1,$1,$2,$3,'running')", [source, tenantId, siteId])
        batchId = randomUUID()
        await client.query('INSERT INTO pw1_migration_batches(id) VALUES($1)', [batchId])
        const attempt = randomUUID()
        await client.query("INSERT INTO pw1_migration_attempts(id,source_store_id,input_hash,status,batch_id) VALUES($1,$2,'qa','running',$3)", [attempt, source, batchId])
        const next = await snapshot(siteId)
        await withAtomicSiteWrite(payload, next.site, next.pages, async (scoped, begin, tx) => {
            await begin()
            await scoped.update({ collection: 'sites', id: siteId!, data: { name: 'Committed site' } })
            await tx.execute(sql`INSERT INTO pw1_migration_commits(attempt_id,source_store_id,input_hash,summary) VALUES(${attempt},${source},'qa','{}'::jsonb)`)
        })
        await recoverInterruptedBatches(client)
        assert.equal((await client.query('SELECT status FROM pw1_migration_stores WHERE source_store_id=$1', [source])).rows[0].status, 'completed')
        assert.equal((await payload.findByID({ collection: 'sites', id: siteId, depth: 0 })).name, 'Committed site')
        const failedAttempt = randomUUID()
        await client.query("INSERT INTO pw1_migration_attempts(id,source_store_id,input_hash,status,batch_id) VALUES($1,$2,'qa','running',$3)", [failedAttempt, source, batchId])
        await client.query("UPDATE pw1_migration_stores SET status='running' WHERE source_store_id=$1", [source])
        await recoverInterruptedBatches(client)
        assert.equal((await client.query('SELECT status FROM pw1_migration_stores WHERE source_store_id=$1', [source])).rows[0].status, 'failed')
        const status = await inspectMigration('status', source)
        const logs = await inspectMigration('logs', source)
        assert.equal(status.stores?.[0].status, 'failed')
        assert.equal(logs.attempts?.[0].error_code, 'INTERRUPTED')
        console.log('PASS: commit receipt recovery and operator status/logs')
        const url = 'https://tm-prime-web-dev.sgp1.digitaloceanspaces.com/reliability-fixture.png'
        const hash = createHash('sha256').update(url).digest('hex')
        const image = await payload.create({ collection: 'media', data: { tenant: tenantId, alt: 'QA pixel' }, file: { name: `pw1-${tenantId}-${hash.slice(0,20)}.jpg`, mimetype: 'image/png', data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNI0AAAAASUVORK5CYII=', 'base64'), size: 68 } })
        mediaId = Number(image.id)
        // First import finds deterministic filename (crash window); second import uses the cache table.
        const first: Record<string, unknown> = { image: url }, second: Record<string, unknown> = { image: url }
        const tracked = new Set<number>()
        await withPw1MediaTracking(tracked, async () => {
            await importPw1BlockMedia([[first]], tenantId, payload)
            await importPw1BlockMedia([[second]], tenantId, payload)
        })
        assert.equal(tracked.size, 0)
        assert.equal(first.image, mediaId); assert.equal(second.image, mediaId)
        assert.equal((await payload.count({ collection: 'media', where: { filename: { contains: `pw1-${tenantId}-` } } })).totalDocs, 1)
        console.log('PASS: media reuse across retries without duplicate uploads')
    } finally {
        await client.query('DELETE FROM pw1_migration_commits WHERE source_store_id=$1', [source])
        await client.query('DELETE FROM pw1_migration_attempts WHERE source_store_id=$1', [source])
        await client.query('DELETE FROM pw1_migration_stores WHERE source_store_id=$1', [source])
        await client.query('DELETE FROM pw1_migration_accounts WHERE source_user_id=$1', [source])
        if (batchId) await client.query('DELETE FROM pw1_migration_batches WHERE id=$1', [batchId])
        if (siteId) { await payload.delete({ collection: 'pages', where: { site: { equals: siteId } } }); await payload.delete({ collection: 'sites', id: siteId }) }
        if (mediaId) await payload.delete({ collection: 'media', id: mediaId })
        if (userId) await payload.delete({ collection: 'users', id: userId })
        if (tenantId) await payload.delete({ collection: 'tenants', id: tenantId })
        await payload.destroy(); await client.end()
    }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
