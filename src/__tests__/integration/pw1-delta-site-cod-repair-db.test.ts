// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Pool, type PoolClient } from 'pg'
import { findCodRepairCandidates, findNotSelected, planCodRepair } from '@/lib/migration/pw1-delta/site-cod-repair'
import type { QueryClient } from '@/lib/migration/pw1-json/runtime'

/**
 * Real PostgreSQL run of the candidate SQL. Requires DATABASE_URI. Every table is a TEMP table created inside
 * one transaction that is rolled back (temp tables shadow the real ones), so no real row is read or written.
 */
const connectionString = process.env.DATABASE_URI
const INSTANCE = 'pw1-test-instance'

// Ids far outside real data; one row per scenario.
const S = { patch: '900000001', edited: '900000002', delta: '900000003', suspended: '900000004', running: '900000005', enabled: '900000006', codOff: '900000007' }

async function createFixtureTables(client: PoolClient): Promise<void> {
  for (const ddl of [
    `CREATE TEMP TABLE pw1_migration_stores (source_store_id text, tenant_id integer, site_id integer, status text) ON COMMIT DROP`,
    `CREATE TEMP TABLE tenants (id integer PRIMARY KEY, slug text, status text, payments_payment_cod boolean) ON COMMIT DROP`,
    `CREATE TEMP TABLE sites (id integer PRIMARY KEY, payment_config_enable_cod boolean) ON COMMIT DROP`,
    `CREATE TEMP TABLE pw1_delta_map (source_entity text, source_id text, target_collection text, target_id text, projection jsonb) ON COMMIT DROP`,
    `CREATE TEMP TABLE migration_entity_map (source_system text, source_instance_id text, source_entity text, source_id text,
       claim_active boolean, action text, target_id text, detail jsonb) ON COMMIT DROP`,
  ]) await client.query(ddl)
}

/** A generated store whose tenant/site state and recorded projections are given per scenario. */
async function seedStore(client: PoolClient, store: string, opts: { status?: string; tenant?: string; cod?: boolean; siteCod?: boolean; importCod?: boolean; deltaCod?: boolean }) {
  const id = Number(store)
  await client.query(`INSERT INTO tenants VALUES ($1, $2, $3, $4)`, [id, `t-${store}`, opts.tenant ?? 'active', opts.cod ?? true])
  await client.query(`INSERT INTO sites VALUES ($1, $2)`, [id, opts.siteCod ?? false])
  await client.query(`INSERT INTO pw1_migration_stores VALUES ($1, $2, $2, $3)`, [store, id, opts.status ?? 'completed'])
  if (opts.importCod !== undefined) await client.query(`INSERT INTO migration_entity_map VALUES ('pw1', $1, 'sites', $2, true, 'CREATE', $3, $4)`,
    [INSTANCE, store, String(id), { projection: { paymentConfig: { enableCod: opts.importCod } } }])
  if (opts.deltaCod !== undefined) await client.query(`INSERT INTO pw1_delta_map VALUES ('sites', $1, 'sites', $2, $3)`,
    [store, String(id), { paymentConfig: { enableCod: opts.deltaCod } }])
}

describe.skipIf(!connectionString)('[TC-F42-DELTA-13] site COD repair candidate query on PostgreSQL', () => {
  it('selects only inconsistent generated sites and classifies them by the recorded projection', async () => {
    // Arrange
    const pool = new Pool({ connectionString, max: 1 })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await createFixtureTables(client)
      await seedStore(client, S.patch, { importCod: false })
      // Inactive claims and non-CREATE rows are not evidence: only the CREATE claim above counts.
      await client.query(`INSERT INTO migration_entity_map VALUES ('pw1', $1, 'sites', $2, false, 'CREATE', $2, $3), ('pw1', $1, 'sites', $2, true, 'UPDATE', $2, $3)`,
        [INSTANCE, S.patch, { projection: { paymentConfig: { enableCod: true } } }])
      await seedStore(client, S.edited, { importCod: true })
      await seedStore(client, S.delta, { importCod: true, deltaCod: false })
      await seedStore(client, S.suspended, { tenant: 'suspended', importCod: false })
      await seedStore(client, S.running, { status: 'running', importCod: false })
      await seedStore(client, S.enabled, { siteCod: true, importCod: false })
      await seedStore(client, S.codOff, { cod: false, importCod: false })
      const db = client as unknown as QueryClient
      const requested = [...Object.values(S), '900000999']

      // Act
      const scoped = planCodRepair(await findCodRepairCandidates(db, INSTANCE, { all: false, stores: requested }))
      const onlyPatch = await findCodRepairCandidates(db, INSTANCE, { all: false, stores: [S.patch] })
      const all = await findCodRepairCandidates(db, INSTANCE, { all: true })
      const notSelected = await findNotSelected(db, requested, new Set(scoped.map(row => row.storeId)))
      const otherInstance = await findCodRepairCandidates(db, `${INSTANCE}-other`, { all: false, stores: [S.patch] })

      // Assert
      expect(scoped.map(row => [row.storeId, row.decision])).toEqual([[S.patch, 'PATCH'], [S.edited, 'SKIP_PW2_EDITED'], [S.delta, 'PATCH']])
      expect(onlyPatch).toEqual([expect.objectContaining({ storeId: S.patch, tenantId: Number(S.patch), siteId: Number(S.patch), slug: `t-${S.patch}` })])
      expect(all.map(row => row.storeId)).toEqual([S.patch, S.edited, S.delta])
      expect(notSelected.map(row => [row.storeId, row.reason])).toEqual([
        [S.suspended, 'TENANT_NOT_ACTIVE'], [S.running, 'NOT_COMPLETED'], [S.enabled, 'ALREADY_ENABLED'], [S.codOff, 'TENANT_COD_OFF'], ['900000999', 'NOT_GENERATED'],
      ])
      // The import projection of another source instance is not evidence for this database.
      expect(planCodRepair(otherInstance)[0]?.decision).toBe('SKIP_NO_PROJECTION')
    } finally {
      await client.query('ROLLBACK')
      client.release()
      await pool.end()
    }
  }, 30000)
})
