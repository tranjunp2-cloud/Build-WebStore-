/**
 * Next.js Instrumentation
 * 1. Polyfills for Node.js 18 compatibility with undici
 * 2. Creates 'app' schema in PostgreSQL for DO Dev Database (PG17)
 */

export async function register() {
    // Node 18 doesn't have File, Blob, FormData in globalThis
    // undici requires these at module-load time
    if (typeof globalThis.File === 'undefined') {
        const { File, Blob } = await import('node:buffer')
        // @ts-ignore
        globalThis.File = File
        // @ts-ignore
        if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob
    }
    if (typeof globalThis.FormData === 'undefined') {
        // @ts-ignore — minimal FormData polyfill for Node 18
        globalThis.FormData = class FormData { }
    }

    // Create 'app' schema for DO App Platform Dev Database (PG17)
    // PG17 denies CREATE on 'public' schema for non-admin users.
    // This runs before Payload connects, ensuring the schema exists.
    const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (connStr && !connStr.includes('localhost') && !connStr.includes('127.0.0.1')) {
        try {
            // Dynamic require to bypass webpack static analysis (pg uses fs/path)
            // eslint-disable-next-line no-eval
            const pg = eval('require')('pg') as typeof import('pg')
            const cleanStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '')
            const pool = new pg.Pool({
                connectionString: cleanStr,
                ssl: { rejectUnauthorized: false },
            })
            await pool.query('CREATE SCHEMA IF NOT EXISTS app')
            await pool.end()
            console.log('[instrumentation] ✅ Schema "app" ready')
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            console.log('[instrumentation] ⚠️ Schema creation skipped:', msg)
        }
    }
}
