#!/usr/bin/env node
/**
 * DB Setup Script — runs as Docker CMD on DO App Platform
 *
 * Problem: Payload CMS's `push: true` only creates tables when
 * `process.env.NODE_ENV !== 'production'` (checked at runtime in
 * node_modules/@payloadcms/db-postgres/dist/connect.js line 109).
 *
 * Solution: When the database is empty (no tables), spawn server.js
 * with NODE_ENV=development so Payload creates tables on first request.
 * On subsequent deploys, tables already exist so NODE_ENV stays production.
 */
const { spawn } = require('child_process');

async function checkDB() {
  const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
  if (!connStr) {
    console.log('[db-setup] No DATABASE_URI found, skipping DB check');
    return { needsPush: false, tableCount: -1 };
  }

  try {
    const pg = require('pg');
    // Strip sslmode from URL to avoid pg driver parse conflicts
    const cleanStr = connStr
      .replace(/[?&]sslmode=[^&]+/g, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');

    const pool = new pg.Pool({
      connectionString: cleanStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    const info = await pool.query('SELECT current_database(), current_user');
    const row = info.rows[0];
    console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}`);

    // Count tables in public schema
    const tables = await pool.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const tableCount = parseInt(tables.rows[0].count, 10);
    console.log(`[db-setup] Tables in public schema: ${tableCount}`);

    // Check if user can create tables
    const perm = await pool.query(
      "SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create"
    );
    const canCreate = perm.rows[0].can_create;
    console.log(`[db-setup] CREATE privilege: ${canCreate}`);

    await pool.end();

    return {
      needsPush: tableCount === 0 && canCreate,
      tableCount,
    };
  } catch (e) {
    console.error('[db-setup] DB check failed:', e.message);
    return { needsPush: false, tableCount: -1 };
  }
}

async function main() {
  console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);

  const { needsPush, tableCount } = await checkDB();

  // Determine the NODE_ENV for the server process
  let serverEnv = { ...process.env };

  if (needsPush) {
    // Database is empty — Payload needs NODE_ENV !== 'production' to run pushDevSchema().
    // This is safe because the Next.js build is already production-optimized.
    // After tables are created, subsequent deploys will skip this (tableCount > 0).
    console.log('[db-setup] ⚡ Empty database detected — enabling schema push');
    console.log('[db-setup] Setting NODE_ENV=development for Payload push:true');
    serverEnv.NODE_ENV = 'development';
  } else if (tableCount > 0) {
    console.log(`[db-setup] ✅ ${tableCount} tables exist — no push needed`);
  } else {
    console.log('[db-setup] ⚠️ Could not check tables — starting server as-is');
  }

  console.log(`[db-setup] Starting server (NODE_ENV=${serverEnv.NODE_ENV})...`);
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: serverEnv,
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((e) => {
  console.error('[db-setup] Fatal:', e);
  process.exit(1);
});
