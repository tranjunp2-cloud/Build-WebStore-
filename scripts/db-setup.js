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

    const perm = await pool.query(
      "SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create"
    );
    const canCreate = perm.rows[0].can_create;
    console.log(`[db-setup] CREATE privilege: ${canCreate}`);

    await pool.end();

    // Always push schema when we have CREATE privilege.
    // pushDevSchema handles both initial creation AND adding new columns
    // to existing tables (e.g. stripe_account_id added after initial deploy).
    // It's a no-op if schema is already in sync.
    return {
      needsPush: canCreate,
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

    // Wait for tables to appear (pushDevSchema triggered by first request)
    // Also make a request to trigger Payload initialization
    await sleep(5000); // Give server time to start listening
    try {
      // Trigger Payload init by hitting the health endpoint
      const http = require('http');
      http.get('http://localhost:3000/api/health', () => {});
    } catch {
      // Ignore — Payload init might be triggered by other means
    }

    let schemaReady;
    if (tableCount === 0) {
      // Fresh DB: wait for tables to appear
      schemaReady = await waitForTables(120);
    } else {
      // Existing DB: Payload pushDevSchema runs on connect, wait for it to finish
      console.log('[db-setup] Waiting 15s for schema sync to complete...');
      await sleep(15000);
      schemaReady = true;
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
