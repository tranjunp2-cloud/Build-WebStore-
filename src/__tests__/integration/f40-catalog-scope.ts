/** TC-F40-MIG-LIVE-16: real PostgreSQL regression; all fixtures are temporary. */
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { sql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Payload } from 'payload';
import { readWebsiteCatalogScope, websiteCatalogSources } from '@/lib/admin/qa/website-migration-catalog';
import { F42CatalogScopeError } from '@/lib/admin/qa/f42-source-contract';

async function main() {
  const connectionString = process.env.DATABASE_URI;
  assert.ok(connectionString, 'Seed preload must provide DATABASE_URI');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname), 'Local PostgreSQL only');
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  const dialect = new PgDialect();
  const execute = async (query: SQL) => {
    const compiled = dialect.sqlToQuery(query);
    return client.query(compiled.sql, compiled.params);
  };
  // Adapt only the database transport; the production helper and SQL run unchanged.
  const payload = { db: { drizzle: { execute } } } as unknown as Payload;
  let passed = 0;
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '5s'");
    // Public objects are never in the fixture search path, even if a temp table is omitted.
    await client.query('SET LOCAL search_path TO pg_temp');
    await client.query(`
      CREATE TEMP TABLE migration_import_batches(batch_id text, profile_version text, binding jsonb, selected_store_ids jsonb, created_at timestamptz DEFAULT now()) ON COMMIT DROP;
      CREATE TEMP TABLE migration_runs(run_id text, batch_id text, source_system text, source_instance_id text, source_store_id text, target_instance_id text) ON COMMIT DROP;
      CREATE TEMP TABLE migration_import_stores(run_id text, batch_id text, source_store_id text) ON COMMIT DROP;
      CREATE TEMP TABLE migration_entity_map(run_id text, source_system text, source_instance_id text, source_entity text, source_id text, target_collection text, target_id text, claim_active boolean, state text) ON COMMIT DROP;
      CREATE TEMP TABLE pw1_migration_stores(source_store_id text, site_id integer, tenant_id integer, status text, updated_at timestamptz DEFAULT now()) ON COMMIT DROP;
      CREATE TEMP TABLE sites(id integer, tenant_id integer) ON COMMIT DROP;
      CREATE TEMP TABLE tenants(id integer) ON COMMIT DROP;
      INSERT INTO pg_temp.migration_import_batches(batch_id,profile_version,binding,selected_store_ids) VALUES
        ('batch-a','pw1-json-v3','{"sourceInstance":"fixture-source","targetHash":"fixture-target"}','["1","2"]'),
        ('batch-b','pw1-json-v3','{"sourceInstance":"fixture-source","targetHash":"fixture-target"}','["2","3"]');
    `);

    async function scenario(name: string, body: () => Promise<void>) {
      await client.query('SAVEPOINT fixture_case');
      try {
        await body();
        passed += 1;
        process.stdout.write(`PASS TC-F40-MIG-LIVE-16 ${name}\n`);
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT fixture_case');
        await client.query('RELEASE SAVEPOINT fixture_case');
      }
    }
    async function legacy(proven: boolean) {
      await client.query(`
        INSERT INTO pg_temp.sites VALUES(101,201);
        INSERT INTO pg_temp.tenants VALUES(201);
        INSERT INTO pg_temp.pw1_migration_stores(source_store_id,site_id,tenant_id,status) VALUES('1',101,201,'completed');
      `);
      if (proven) await client.query(`
        INSERT INTO pg_temp.migration_runs VALUES('run-a','batch-a','pw1','fixture-source','1','fixture-target');
        INSERT INTO pg_temp.migration_import_stores VALUES('run-a','batch-a','1');
        INSERT INTO pg_temp.migration_entity_map VALUES
          ('run-a','pw1','fixture-source','sites','1','sites','101',true,'VERIFIED'),
          ('run-a','pw1','fixture-source','stores','1','tenants','201',true,'VERIFIED');
      `);
    }
    async function rejected(reason: F42CatalogScopeError['reason']) {
      // Act / Assert: inspect the production error, not a replicated classifier.
      await assert.rejects(() => readWebsiteCatalogScope(payload), error => error instanceof F42CatalogScopeError && error.reason === reason);
    }

    await scenario('grouped source-only IDs deduplicate without child runs', async () => {
      // Arrange: two overlapping registered batches, no child runs.
      const scope = await readWebsiteCatalogScope(payload);
      // Act
      const result = await execute(sql`SELECT DISTINCT source_store_id FROM (${websiteCatalogSources(scope)}) sources ORDER BY source_store_id`);
      // Assert
      assert.deepEqual(result.rows.map(row => row.source_store_id), ['1', '2', '3']);
    });
    await scenario('proven legacy maps to the exact scope', async () => {
      await legacy(true); // Arrange
      const scope = await readWebsiteCatalogScope(payload); // Act
      assert.deepEqual(scope, { sourceInstance: 'fixture-source', targetInstance: 'fixture-target' }); // Assert
    });
    await scenario('unproven legacy cannot borrow a matching source ID', async () => {
      await legacy(false); // Arrange
      await rejected('UNPROVEN_LEGACY_IDENTITY');
    });
    await scenario('wrong source namespace cannot establish ownership', async () => {
      await legacy(true); // Arrange
      await client.query("UPDATE pg_temp.migration_entity_map SET source_instance_id='other-source'");
      await rejected('INVALID_CATALOG');
    });
    await scenario('tenant ownership is required in addition to site ownership', async () => {
      await legacy(true); // Arrange
      await client.query("UPDATE pg_temp.migration_entity_map SET target_id='999' WHERE target_collection='tenants'");
      await rejected('UNPROVEN_LEGACY_IDENTITY');
    });
    await scenario('multiple namespaces fail closed', async () => {
      // Arrange
      await client.query(`UPDATE pg_temp.migration_import_batches SET binding='{"sourceInstance":"other-source","targetHash":"fixture-target"}' WHERE batch_id='batch-b'`);
      await rejected('AMBIGUOUS_BINDING');
    });
    await scenario('malformed selected IDs fail closed', async () => {
      await client.query(`UPDATE pg_temp.migration_import_batches SET selected_store_ids='[null,"bad-id"]' WHERE batch_id='batch-b'`); // Arrange
      await rejected('INVALID_CATALOG');
    });
    await scenario('nonarray selection returns scope error rather than SQL failure', async () => {
      await client.query(`UPDATE pg_temp.migration_import_batches SET selected_store_ids='{}' WHERE batch_id='batch-b'`); // Arrange
      await rejected('INVALID_CATALOG');
    });
    await scenario('inactive reuse does not replace the authoritative active owner', async () => {
      await legacy(true); // Arrange
      await client.query(`INSERT INTO pg_temp.migration_entity_map SELECT run_id,source_system,source_instance_id,source_entity,source_id,target_collection,target_id,false,'SKIPPED' FROM pg_temp.migration_entity_map`);
      const scope = await readWebsiteCatalogScope(payload); // Act
      assert.equal(scope?.sourceInstance, 'fixture-source'); // Assert
    });
    await scenario('inactive reuse alone cannot establish ownership', async () => {
      await legacy(true); // Arrange
      await client.query("UPDATE pg_temp.migration_entity_map SET claim_active=false,state='SKIPPED'");
      await rejected('UNPROVEN_LEGACY_IDENTITY');
    });
    await scenario('zero and leading-zero source IDs are rejected', async () => {
      // Arrange / Act: isolate each invalid ID, exercising the actual SQL validator.
      const results: string[] = [];
      for (const id of ['0', '01']) {
        await client.query('UPDATE pg_temp.migration_import_batches SET selected_store_ids=$1::jsonb WHERE batch_id=$2', [JSON.stringify([id]), 'batch-b']);
        try {
          await rejected('INVALID_CATALOG');
          results.push('rejected');
        } catch (error) {
          if (!(error instanceof assert.AssertionError)) throw error;
          results.push('accepted');
        }
      }
      // Assert
      process.stdout.write(`Canonical ID outcomes (zero, leading zero): ${results.join(', ')}\n`);
      assert.deepEqual(results, ['rejected', 'rejected']);
    });
    process.stdout.write(`${passed} PostgreSQL catalog scenarios passed; temporary fixtures rolled back.\n`);
  } finally {
    try { await client.query('ROLLBACK'); } finally { await client.end(); }
  }
}

main().catch(error => {
  // Never print connection strings, parameter values, or PostgreSQL query text.
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN';
  process.stderr.write(`F40 catalog regression failed: ${error instanceof Error ? error.name : 'UnknownError'} (${code})\n`);
  process.exitCode = 1;
});
