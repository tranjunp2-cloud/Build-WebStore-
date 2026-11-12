/** TC-F35.M64: real local DB. Fixtures and updates live in one transaction that is always rolled back. */
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { categoriesMappedOutsideScope, productsNotEmittedByBe } from '../../src/lib/migration/pw1-selection-evidence'

const ids = { run: '00000000-0000-4000-8000-0000000000a1', own: '00000000-0000-4000-8000-0000000000b1', fixture: '00000000-0000-4000-8000-0000000000b2', other: '00000000-0000-4000-8000-0000000000b3' }

async function main() {
    const uri = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!uri || !['localhost', '127.0.0.1'].includes(new URL(uri).hostname)) throw Error('Local DB only')
    const client = new Client({ connectionString: uri }); await client.connect()
    const query = async (text: string, params: unknown[]) => ({ rows: (await client.query(text, params)).rows })
    try {
        await client.query('BEGIN')
        await client.query(`INSERT INTO migration_runs (run_id,source_instance_id,source_store_id,source_snapshot_id,source_snapshot_checksum,mapping_version,target_environment,target_instance_id,state,importer_profile,pw1_app_key_fingerprint,source_schema_fingerprint,source_database)
            VALUES ($1,'QA-X','900001','qa-snap','c','m','local','t','VERIFIED','legacy','f','f','d')`, [ids.run])
        // Own snapshot is the oldest on purpose: a fixture snapshot and another instance's snapshot are newer.
        await client.query(`INSERT INTO migration_source_evidence_snapshots (snapshot_id,source_instance_id,source_snapshot_id,manifest_sha256,sidecar_sha256,pii_comparable,provenance_kind,state,completed_at) VALUES
            ($1,'QA-X','qa-snap','m','s1',false,'exporter_sidecar','COMPLETE','2026-01-01'),
            ($2,'QA-X','qa-snap','m','s2',false,'synthetic_fixture','COMPLETE','2026-02-01'),
            ($3,'QA-OTHER','qa-snap','m','s3',false,'exporter_sidecar','COMPLETE','2026-03-01')`, [ids.own, ids.fixture, ids.other])
        await client.query(`INSERT INTO migration_source_evidence_rows (snapshot_id,source_store_id,source_entity,source_id,record_no,disposition,fields) VALUES
            ($1,'900001','products','1',1,'retained-source','{}'),
            ($1,'900001','products','4',1,'mapped','{}'),
            ($1,'900002','products','5',1,'retained-source','{}'),
            ($2,'900001','products','2',1,'retained-source','{}'),
            ($3,'900001','products','3',1,'retained-source','{}')`, [ids.own, ids.fixture, ids.other])

        const evidence = await productsNotEmittedByBe(query, '900001', ['1', '2', '3', '4', '5'])
        assert.deepEqual([...evidence.ids], ['1'], 'only the own exporter_sidecar snapshot, this store, retained-source rows count')
        assert.equal(evidence.snapshotId, ids.own)
        assert.deepEqual([...(await productsNotEmittedByBe(query, '900002', ['5'])).ids], [], 'a store without a VERIFIED run has no evidence')

        const target = (await client.query(`SELECT m.source_id, d.id, d.tenant_id, d.site_id FROM migration_entity_map m JOIN categories d ON d.id::text=m.target_id
            WHERE m.source_entity='categories' AND m.target_collection='categories' AND m.state='VERIFIED' AND d.deleted_at IS NULL LIMIT 1`)).rows[0]
        assert.ok(target, 'needs a locally migrated category mapping')
        const outside = await categoriesMappedOutsideScope(query, [target.source_id], target.site_id + 1, target.tenant_id + 1)
        assert.equal(outside.get(target.source_id), `tenant ${target.tenant_id} / site ${target.site_id}`)
        assert.equal((await categoriesMappedOutsideScope(query, [target.source_id], target.site_id, target.tenant_id)).size, 0, 'in-scope mapping is not outside')
        await client.query('UPDATE categories SET deleted_at=now() WHERE id=$1', [target.id])
        assert.equal((await categoriesMappedOutsideScope(query, [target.source_id], target.site_id + 1, target.tenant_id + 1)).size, 0, 'soft-deleted destination does not qualify')
        console.log('PASS: evidence pinned to own exporter_sidecar snapshot and store; out-of-scope categories report destination and skip deleted targets')
    } finally {
        await client.query('ROLLBACK').catch(() => undefined)
        await client.end()
    }
}
main().catch(error => { console.error(error); process.exit(1) })
