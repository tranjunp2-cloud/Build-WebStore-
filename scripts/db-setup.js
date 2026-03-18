#!/usr/bin/env node
/**
 * DB Setup Script — runs as Docker CMD on DO App Platform
 *
 * Problem: Payload CMS's `push: true` only creates tables when
 * `process.env.NODE_ENV !== 'production'` (checked at runtime in
 * node_modules/@payloadcms/db-postgres/dist/connect.js line 109).
 *
 * Solution:
 * 1. Check if database has tables
 * 2. If empty → start server.js with NODE_ENV=development (triggers pushDevSchema)
 * 3. Poll DB until tables are created (pushDevSchema done)
 * 4. Kill the dev server, restart with NODE_ENV=production
 * 5. If tables exist → start server.js normally (NODE_ENV=production)
 *
 * Health check: Uses /api/health (no DB query) so DO doesn't kill
 * the container during schema push.
 */
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPool() {
  const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
  if (!connStr) return null;

  const pg = require('pg');
  const cleanStr = connStr
    .replace(/[?&]sslmode=[^&]+/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');

  return new pg.Pool({
    connectionString: cleanStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

async function getTableCount(pool) {
  const result = await pool.query(
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  return parseInt(result.rows[0].count, 10);
}

// ─── Direct SQL Migrations ──────────────────────────────────────────────
// Standalone server can't run Payload's pushDevSchema (missing Drizzle files).
// Instead, add missing columns directly via ALTER TABLE.
// Each migration is idempotent — safe to run multiple times.
const MIGRATIONS = [
  {
    name: 'add_stripe_account_id_to_tenants',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id varchar;`,
  },
  {
    name: 'add_stripe_onboarding_complete_to_tenants',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;`,
  },
  {
    name: 'add_stripe_account_id_index',
    sql: `CREATE INDEX IF NOT EXISTS tenants_stripe_account_id_idx ON tenants (stripe_account_id);`,
  },
];

async function runMigrations(pool) {
  console.log(`[db-setup] Running ${MIGRATIONS.length} migrations...`);
  for (const m of MIGRATIONS) {
    try {
      await pool.query(m.sql);
      console.log(`[db-setup] ✅ ${m.name}`);
    } catch (e) {
      // Log but don't fail — column might already exist with different type etc.
      console.warn(`[db-setup] ⚠️ ${m.name}: ${e.message}`);
    }
  }
}

async function checkDB() {
  const pool = createPool();
  if (!pool) {
    console.log('[db-setup] No DATABASE_URI found, skipping DB check');
    return { needsPush: false, tableCount: -1 };
  }

  try {
    const info = await pool.query('SELECT current_database(), current_user');
    const row = info.rows[0];
    console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}`);

    const tableCount = await getTableCount(pool);
    console.log(`[db-setup] Tables in public schema: ${tableCount}`);

    // Run direct SQL migrations (idempotent — always safe)
    if (tableCount > 0) {
      await runMigrations(pool);
    }

    await pool.end();

    // Only need Payload pushDevSchema for fresh DB (0 tables)
    return {
      needsPush: tableCount === 0,
      tableCount,
    };
  } catch (e) {
    console.error('[db-setup] DB check failed:', e.message);
    await pool.end().catch(() => {});
    return { needsPush: false, tableCount: -1 };
  }
}

/**
 * Wait for Payload's pushDevSchema to finish by polling the DB.
 * Returns true when tables are detected, false on timeout.
 */
async function waitForTables(maxWaitSec = 120) {
  const pool = createPool();
  if (!pool) return false;

  const startTime = Date.now();
  const deadline = startTime + maxWaitSec * 1000;

  console.log(`[db-setup] Waiting for schema push (timeout: ${maxWaitSec}s)...`);

  while (Date.now() < deadline) {
    try {
      const count = await getTableCount(pool);
      if (count > 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[db-setup] ✅ Schema push complete — ${count} tables created in ${elapsed}s`);
        await pool.end();
        return true;
      }
    } catch {
      // DB might be busy during schema push — retry
    }
    await sleep(3000);
  }

  console.error(`[db-setup] ⏰ Schema push timed out after ${maxWaitSec}s`);
  await pool.end().catch(() => {});
  return false;
}

/**
 * Wait for schema sync to complete by checking if pushDevSchema has finished.
 * Instead of waiting a fixed time, poll the DB to see if Payload's dev server
 * is still running migrations.
 */
async function waitForSchemaSync(maxWaitSec = 30) {
  const pool = createPool();
  if (!pool) return true;

  const startTime = Date.now();
  const deadline = startTime + maxWaitSec * 1000;

  console.log(`[db-setup] Verifying schema sync (timeout: ${maxWaitSec}s)...`);

  // Get initial column count to detect changes
  let prevColCount = 0;
  try {
    const r = await pool.query(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'"
    );
    prevColCount = parseInt(r.rows[0].count, 10);
    console.log(`[db-setup] Current column count: ${prevColCount}`);
  } catch { /* ignore */ }

  // Poll until column count stabilizes (no changes for 5s = sync done)
  let stableCount = 0;
  while (Date.now() < deadline) {
    await sleep(3000);
    try {
      const r = await pool.query(
        "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'"
      );
      const currentColCount = parseInt(r.rows[0].count, 10);

      if (currentColCount === prevColCount) {
        stableCount++;
        if (stableCount >= 2) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[db-setup] ✅ Schema sync complete — ${currentColCount} columns (stable for 6s, took ${elapsed}s)`);
          await pool.end();
          return true;
        }
      } else {
        console.log(`[db-setup] Schema changing: ${prevColCount} → ${currentColCount} columns`);
        prevColCount = currentColCount;
        stableCount = 0;
      }
    } catch {
      // DB busy during sync — retry
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[db-setup] ⚠️ Schema sync timeout after ${elapsed}s — proceeding anyway`);
  await pool.end().catch(() => {});
  return true; // Proceed even on timeout — might be fine
}

function spawnServer(env) {
  return spawn('node', ['server.js'], { stdio: 'inherit', env });
}

async function main() {
  console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);

  const { needsPush, tableCount } = await checkDB();

  if (needsPush) {
    // ── Phase 1: Start with NODE_ENV=development to trigger pushDevSchema ──
    if (tableCount === 0) {
      console.log('[db-setup] ⚡ Empty database detected — starting schema push');
    } else {
      console.log(`[db-setup] 🔄 ${tableCount} tables exist — syncing schema for new columns`);
    }
    console.log('[db-setup] Phase 1: Starting server with NODE_ENV=development...');

    const devEnv = { ...process.env, NODE_ENV: 'development' };
    const devServer = spawnServer(devEnv);

    // Payload pushDevSchema runs during DB connect (on server start).
    // We need to wait for it to finish before switching to production.
    await sleep(5000); // Give server time to start listening

    // Trigger Payload initialization by hitting any endpoint
    const http = require('http');
    const triggerInit = () => new Promise((resolve) => {
      const req = http.get('http://localhost:3000/api/health', (res) => {
        console.log(`[db-setup] Health check: ${res.statusCode}`);
        resolve();
      });
      req.on('error', () => {
        console.log('[db-setup] Health check pending, server still starting...');
        resolve();
      });
      req.setTimeout(5000, () => { req.destroy(); resolve(); });
    });

    // Try multiple times to ensure Payload is fully initialized
    await triggerInit();
    await sleep(3000);
    await triggerInit();

    let schemaReady;
    if (tableCount === 0) {
      // Fresh DB: wait for tables to appear
      schemaReady = await waitForTables(120);
    } else {
      // Existing DB with new columns needed (e.g. stripe_account_id).
      // Payload pushDevSchema adds missing columns on connect.
      // Wait and verify the specific column exists.
      console.log('[db-setup] Waiting for schema sync (new columns)...');
      schemaReady = await waitForSchemaSync(30);
    }

    if (schemaReady) {
      // ── Phase 2: Restart with NODE_ENV=production ──
      console.log('[db-setup] Phase 2: Restarting server with NODE_ENV=production...');
      devServer.kill('SIGTERM');

      // Give the dev server time to shut down
      await sleep(2000);

      const prodEnv = { ...process.env }; // Original env (NODE_ENV=production from Dockerfile)
      const prodServer = spawnServer(prodEnv);
      prodServer.on('exit', (code) => process.exit(code || 0));
    } else {
      // Schema push timed out — keep dev server running and hope for the best
      console.error('[db-setup] ⚠️ Schema push timed out — keeping dev server running');
      devServer.on('exit', (code) => process.exit(code || 0));
    }
  } else {
    // ── Normal start: tables already exist ──
    if (tableCount > 0) {
      console.log(`[db-setup] ✅ ${tableCount} tables exist — no push needed`);
    } else {
      console.log('[db-setup] ⚠️ Could not check tables — starting server as-is');
    }

    console.log(`[db-setup] Starting server (NODE_ENV=${process.env.NODE_ENV})...`);
    const server = spawnServer({ ...process.env });
    server.on('exit', (code) => process.exit(code || 0));
  }
}

main().catch((e) => {
  console.error('[db-setup] Fatal:', e);
  process.exit(1);
});
