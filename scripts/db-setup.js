#!/usr/bin/env node
/**
 * DB Setup Script — runs BEFORE server.js on DO App Platform
 *
 * Problem: Next.js standalone build bakes process.env.NODE_ENV as 'production'
 * via webpack DefinePlugin. Payload's push:true checks this at runtime
 * but finds the hardcoded 'production' string, so it never creates tables.
 *
 * Solution: This script patches the bundled server code to replace the
 * hardcoded NODE_ENV check, then starts the server.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function checkDB() {
  const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
  if (!connStr) {
    console.log('[db-setup] No DATABASE_URL found');
    return { needsPush: false };
  }

  console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);

  try {
    const pg = require('pg');
    const cleanStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
    const pool = new pg.Pool({
      connectionString: cleanStr,
      ssl: { rejectUnauthorized: false },
    });

    const result = await pool.query('SELECT current_database(), current_user, current_schema()');
    const row = result.rows[0];
    console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}`);

    // Check if tables exist
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    console.log(`[db-setup] Tables in public: ${tables.rowCount}`);

    const canCreate = await pool.query(
      "SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create"
    );
    console.log(`[db-setup] Can CREATE: ${canCreate.rows[0].can_create}`);

    await pool.end();

    return {
      needsPush: tables.rowCount === 0 && canCreate.rows[0].can_create,
      tableCount: tables.rowCount,
    };
  } catch (e) {
    console.log('[db-setup] DB check error:', e.message);
    return { needsPush: false };
  }
}

function patchServerForPush() {
  // Find the connect.js chunk in the standalone build that contains the push check
  const chunksDir = path.join(__dirname, '.next', 'server', 'chunks');
  if (!fs.existsSync(chunksDir)) {
    console.log('[db-setup] No chunks dir found, skipping patch');
    return false;
  }

  const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.js'));
  let patched = false;

  for (const file of files) {
    const filePath = path.join(chunksDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Webpack replaces process.env.NODE_ENV with "production" literal
    // The Payload push check becomes: if("production"!=="production" && ...
    // We need to make this evaluate to true
    // Pattern: "production"!=="production" or "production" !== "production"
    if (content.includes('"production"!=="production"') || content.includes("'production'!=='production'")) {
      console.log(`[db-setup] Patching ${file} — enabling push:true`);
      content = content.replace(/"production"!=="production"/g, '"development"!=="production"');
      content = content.replace(/'production'!=='production'/g, "'development'!=='production'");
      fs.writeFileSync(filePath, content);
      patched = true;
    }
  }

  return patched;
}

async function main() {
  const { needsPush, tableCount } = await checkDB();

  if (needsPush) {
    console.log('[db-setup] No tables found — patching server to enable push:true...');
    const patched = patchServerForPush();
    if (patched) {
      console.log('[db-setup] ✅ Patched! push:true will create tables on first request');
    } else {
      console.log('[db-setup] ⚠️ Could not find push check to patch');
    }
  } else if (tableCount > 0) {
    console.log(`[db-setup] ✅ ${tableCount} tables already exist, no push needed`);
  }

  console.log('[db-setup] Starting server...');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((e) => {
  console.error('[db-setup] Fatal:', e);
  process.exit(1);
});
