#!/usr/bin/env node
/**
 * Creates the "app" schema in PostgreSQL if it doesn't exist.
 * Required for DigitalOcean App Platform Dev Database (PostgreSQL 17)
 * where the default "public" schema denies CREATE to non-admin users.
 * 
 * This script runs BEFORE "next start" via the custom run command.
 */
const { Pool } = require('pg')

async function main() {
    const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connStr) {
        console.log('[ensure-schema] No DATABASE_URI/DATABASE_URL found, skipping.')
        process.exit(0)
    }

    // Strip sslmode to avoid pg driver conflicts
    const cleanStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '')
    const isRemote = !connStr.includes('localhost') && !connStr.includes('127.0.0.1')

    const pool = new Pool({
        connectionString: cleanStr,
        ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
    })

    try {
        const client = await pool.connect()
        try {
            await client.query('CREATE SCHEMA IF NOT EXISTS app')
            console.log('[ensure-schema] ✅ Schema "app" ready.')
        } finally {
            client.release()
        }
    } catch (err) {
        console.error('[ensure-schema] ⚠️ Failed to create schema:', err.message)
        console.log('[ensure-schema] Continuing anyway — schema may already exist.')
    } finally {
        await pool.end()
    }
}

main()
