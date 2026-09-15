/** TC-F35.M35: real local storage/DB and CLI; synthetic media only. */
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cleanupFailedStoreMedia } from '../../src/lib/migration/pw1-media-cleanup'
const exec = promisify(execFile)
async function main() {
    const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connectionString || !['localhost','127.0.0.1','::1'].includes(new URL(connectionString).hostname)) throw new Error('Local DB only')
    const client = new Client({ connectionString }); await client.connect()
    const payload = await getPayload({ config })
    const source = `97${Date.now()}`
    let tenantId: number | undefined, userId: number | undefined, siteId: number | undefined
    const mediaIds: number[] = []
    const batchId = randomUUID(), attemptId = randomUUID()
    const cli = async (...args: string[]) => exec(process.execPath, ['--require', './scripts/seed-preload.cjs', '--import', 'tsx', 'scripts/migrate-pw1.ts', 'cleanup-media', '--store', source, '--older-than-hours', '1', ...args], { timeout: 180000, maxBuffer: 5 * 1024 * 1024 })
    try {
        assert.equal((await client.query('SELECT pg_try_advisory_lock(351827,0) AS locked')).rows[0].locked, true)
        await client.query(await readFile(new URL('../sql/pw1-migration-batch.sql', import.meta.url), 'utf8'))
        const tenant = await payload.create({ collection: 'tenants', data: { name: 'Cleanup QA', slug: `cleanup-${source}`, plan: 'free' } }); tenantId = Number(tenant.id)
        const user = await payload.create({ collection: 'users', data: { firstName: 'QA', email: `${source}@example.test`, password: randomUUID(), roles: ['tenant-owner'], tenants: [{ tenant: tenantId, role: 'owner', status: 'active' }] } }); userId = Number(user.id)
        const site = await payload.create({ collection: 'sites', data: { tenant: tenantId, name: 'Cleanup QA', status: 'draft', generationStatus: 'none' } }); siteId = Number(site.id)
        await client.query('INSERT INTO pw1_migration_accounts(source_user_id,email,user_id) VALUES($1,$2,$3)', [source,user.email,userId])
        await client.query('INSERT INTO pw1_migration_stores(source_store_id,source_user_id,tenant_id,site_id) VALUES($1,$1,$2,$3)', [source,tenantId,siteId])
        for (const label of ['orphan','relationship','html','recent']) {
            const hash = createHash('sha256').update(`${source}-${label}`).digest('hex')
            const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNI0AAAAASUVORK5CYII=', 'base64')
            const media = await payload.create({ collection: 'media', data: { alt: label }, file: { name: `pw1-${tenantId}-${hash.slice(0,20)}.png`, mimetype: 'image/png', data: pixel, size: pixel.length } })
            mediaIds.push(Number(media.id))
            await client.query('INSERT INTO pw1_migration_media(tenant_id,source_hash,media_id) VALUES($1,$2,$3)', [tenantId,hash,media.id])
            await client.query("UPDATE media SET created_at=now()-interval '2 hours' WHERE id=$1", [media.id])
            if (label !== 'recent') {
                await client.query("UPDATE pw1_migration_media SET last_used_at=now()-interval '2 hours' WHERE media_id=$1", [media.id])
            }
        }
        await payload.update({ collection: 'sites', id: siteId, data: { seo: { ogImage: mediaIds[1] } } })
        const htmlMedia = await payload.findByID({ collection: 'media', id: mediaIds[2], depth: 0 })
        const referencePage = await payload.create({ collection: 'pages', data: { site: siteId, title: 'References', slug: 'references', layout: [{ blockType: 'custom-html', html: `<img src="${htmlMedia.url}" alt="retain" />` }] } })
        // Remove the live HTML reference; the stored version must still protect the file.
        await payload.update({ collection: 'pages', id: referencePage.id, data: { layout: [{ blockType: 'custom-html', html: '<p>Current content</p>' }] } })
        await assert.rejects(cli(), error => String((error as { stderr?: string }).stderr).includes('Migration or media cleanup is running'))
        await client.query('SELECT pg_advisory_unlock(351827,0)')
        const dry = JSON.parse((await cli()).stdout)
        assert.equal(dry.results.find((r: {mediaId:number}) => r.mediaId === mediaIds[0]).status, 'eligible', JSON.stringify(dry))
        assert.equal(dry.results.find((r: {mediaId:number}) => r.mediaId === mediaIds[1]).status, 'retained')
        assert.equal(dry.results.find((r: {mediaId:number}) => r.mediaId === mediaIds[2]).status, 'retained')
        assert.equal(dry.results.some((r: {mediaId:number}) => r.mediaId === mediaIds[3]), false)
        assert.equal((await client.query('SELECT count(*)::int AS n FROM media WHERE id=ANY($1)', [mediaIds])).rows[0].n, 4)
        console.log('PASS: dry-run retains media, references and retention window respected; batch lock enforced')
        const applied = JSON.parse((await cli('--apply')).stdout)
        assert.equal(applied.results.find((r: {mediaId:number}) => r.mediaId === mediaIds[0]).status, 'deleted')
        assert.equal((await client.query('SELECT count(*)::int AS n FROM media WHERE id=ANY($1)', [mediaIds])).rows[0].n, 3)
        assert.equal((await client.query('SELECT count(*)::int AS n FROM pw1_migration_media WHERE media_id=$1', [mediaIds[0]])).rows[0].n, 0)
        console.log('PASS: apply deletes only orphan via Payload; referenced/recent media survive; cache removed')
        assert.equal((await client.query('SELECT pg_try_advisory_lock(351827,0) AS locked')).rows[0].locked, true)
        await client.query('INSERT INTO pw1_migration_batches(id) VALUES($1)', [batchId])
        await client.query("INSERT INTO pw1_migration_attempts(id,source_store_id,input_hash,status,batch_id,artifacts) VALUES($1,$2,'qa','running',$3,$4::jsonb)", [attemptId,source,batchId,JSON.stringify({ 'verified-candidate.json': { image: mediaIds[3] } })])
        const unresolved = await cleanupFailedStoreMedia(payload, client, [mediaIds[3]], [attemptId])
        assert.equal(unresolved.status, 'retained')
        await client.query("UPDATE pw1_migration_attempts SET status='failed' WHERE id=$1", [attemptId])
        await client.query("INSERT INTO pw1_migration_commits(attempt_id,source_store_id,input_hash,summary) VALUES($1,$2,'qa','{}')", [attemptId,source])
        const committed = await cleanupFailedStoreMedia(payload, client, [mediaIds[3]], [attemptId])
        assert.equal(committed.status, 'retained')
        await client.query('DELETE FROM pw1_migration_commits WHERE attempt_id=$1', [attemptId])
        const auto = await cleanupFailedStoreMedia(payload, client, mediaIds.slice(1), [attemptId])
        assert.equal(auto.results.find(r => r.mediaId === mediaIds[3])?.status, 'deleted', JSON.stringify(auto))
        assert.equal(auto.results.find(r => r.mediaId === mediaIds[1])?.status, 'retained')
        assert.equal(auto.results.find(r => r.mediaId === mediaIds[2])?.status, 'retained')
        console.log('PASS: auto cleanup retains committed/unresolved work and references, ignores only failed runtime artifacts, removes fresh orphan')

    } finally {
        await client.query('DELETE FROM pw1_migration_commits WHERE attempt_id=$1', [attemptId])
        await client.query('DELETE FROM pw1_migration_attempts WHERE id=$1', [attemptId])
        await client.query('DELETE FROM pw1_migration_batches WHERE id=$1', [batchId])
        await client.query('DELETE FROM pw1_migration_stores WHERE source_store_id=$1', [source])
        await client.query('DELETE FROM pw1_migration_accounts WHERE source_user_id=$1', [source])
        if (siteId) { await payload.delete({ collection: 'pages', where: { site: { equals: siteId } } }); await payload.delete({ collection: 'sites', id: siteId }) }
        for (const id of mediaIds) if ((await client.query('SELECT 1 FROM media WHERE id=$1', [id])).rowCount) await payload.delete({ collection: 'media', id })
        if (userId) await payload.delete({ collection: 'users', id: userId })
        if (tenantId) await payload.delete({ collection: 'tenants', id: tenantId })
        await payload.destroy(); await client.end()
    }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
