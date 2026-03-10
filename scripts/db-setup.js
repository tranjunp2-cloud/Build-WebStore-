#!/usr/bin/env node
/**
 * DB Setup Script — runs BEFORE server.js starts on DO App Platform
 * Logs DB connection info for diagnostics, then starts the server.
 */
const { spawn } = require('child_process');

async function checkDB() {
  const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
  if (!connStr) {
    console.log('[db-setup] No DATABASE_URL found, skipping DB check');
    return;
  }

  console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);
  console.log('[db-setup] DB URL:', connStr.replace(/\/\/[^@]+@/, '//***@')); // mask credentials

  try {
    const pg = require('pg');
    const cleanStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
    const pool = new pg.Pool({
      connectionString: cleanStr,
      ssl: { rejectUnauthorized: false },
    });

    // Basic connection test
    const result = await pool.query('SELECT current_database(), current_user, current_schema()');
    const row = result.rows[0];
    console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}, schema=${row.current_schema}`);

    // Check what schemas exist
    const schemas = await pool.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')"
    );
    console.log(`[db-setup] Schemas: ${schemas.rows.map(r => r.schema_name).join(', ')}`);

    // Check tables in public schema
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 20"
    );
    console.log(`[db-setup] Tables in public: ${tables.rowCount}`);
    if (tables.rows.length > 0) {
      console.log(`[db-setup] Table list: ${tables.rows.map(r => r.table_name).join(', ')}`);
    }

    // Check privileges
    const privs = await pool.query(`
      SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public,
             has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema
    `);
    console.log(`[db-setup] Can CREATE in public: ${privs.rows[0].can_create_in_public}`);
    console.log(`[db-setup] Can CREATE SCHEMA: ${privs.rows[0].can_create_schema}`);

    await pool.end();
  } catch (e) {
    console.log('[db-setup] DB check error:', e.message);
  }
}

async function main() {
  await checkDB();

  console.log('[db-setup] Starting server...');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: process.env,
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((e) => {
  console.error('[db-setup] Fatal:', e);
  process.exit(1);
});
