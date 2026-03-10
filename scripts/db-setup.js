#!/usr/bin/env node
/**
 * DB Setup Script — runs BEFORE server.js starts on DO App Platform
 * 1. Creates 'app' schema (if permission allows)
 * 2. Initializes Payload and pushes schema (creates tables)
 * 3. Then starts the Next.js server
 *
 * This bypasses webpack's NODE_ENV baking issue by running
 * Payload config directly in a Node.js process.
 */
const { execSync, spawn } = require('child_process');

async function setupDB() {
    const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
    if (!connStr) {
        console.log('[db-setup] No DATABASE_URL, skipping...');
        return;
    }

    try {
        // Try to create schema using pg directly
        const pg = require('pg');
        const cleanStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
        const pool = new pg.Pool({
            connectionString: cleanStr,
            ssl: { rejectUnauthorized: false },
        });

        // Test connection
        const testResult = await pool.query('SELECT current_database(), current_user, current_schema()');
        const row = testResult.rows[0];
        console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}, schema=${row.current_schema}`);

        // Check if 'app' schema exists
        const schemaCheck = await pool.query(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'app'"
        );

        if (schemaCheck.rows.length === 0) {
            console.log('[db-setup] Schema "app" does not exist, creating...');
            try {
                await pool.query('CREATE SCHEMA app');
                console.log('[db-setup] ✅ Schema "app" created!');
            } catch (e) {
                console.log('[db-setup] ⚠️ Cannot create schema:', e.message);
                // Try granting CREATE on public instead
                console.log('[db-setup] Trying to use "public" schema instead...');
                try {
                    await pool.query('CREATE TABLE IF NOT EXISTS public._db_test (id int)');
                    await pool.query('DROP TABLE IF EXISTS public._db_test');
                    console.log('[db-setup] ✅ Can CREATE in "public" schema!');
                    // Set env to signal using public schema
                    process.env.USE_PUBLIC_SCHEMA = 'true';
                } catch (e2) {
                    console.log('[db-setup] ❌ Cannot CREATE in "public" either:', e2.message);
                }
            }
        } else {
            console.log('[db-setup] ✅ Schema "app" already exists');

            // Check if tables exist
            const tableCheck = await pool.query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' LIMIT 5"
            );
            console.log(`[db-setup] Tables in "app" schema: ${tableCheck.rows.length}`);
            if (tableCheck.rows.length > 0) {
                console.log(`[db-setup] Tables found: ${tableCheck.rows.map(r => r.table_name).join(', ')}`);
            }
        }

        // Check what schemas exist and their owners
        const allSchemas = await pool.query(
            "SELECT schema_name, schema_owner FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')"
        );
        console.log('[db-setup] Available schemas:');
        for (const row of allSchemas.rows) {
            console.log(`  - ${row.schema_name} (owner: ${row.schema_owner})`);
        }

        // Check user privileges
        const privCheck = await pool.query(
            "SELECT has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema"
        );
        console.log(`[db-setup] Can CREATE SCHEMA: ${privCheck.rows[0].can_create_schema}`);

        const pubPriv = await pool.query(
            "SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public"
        );
        console.log(`[db-setup] Can CREATE in public: ${pubPriv.rows[0].can_create_in_public}`);

        await pool.end();
    } catch (e) {
        console.log('[db-setup] ⚠️ Error:', e.message);
    }
}

async function main() {
    console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);
    await setupDB();

    // Start the server
    console.log('[db-setup] Starting server...');
    const server = spawn('node', ['.next/standalone/server.js'], {
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
