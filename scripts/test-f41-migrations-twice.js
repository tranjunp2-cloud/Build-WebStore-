#!/usr/bin/env node
/*
 * CI migration gate for F41. It uses a disposable schema instead of the
 * shared public schema, applies the complete F41 migration slice twice, and
 * fails on any non-idempotent SQL/index/function declaration.
 */
const { Client } = require('pg')
const { randomUUID } = require('crypto')
const { MIGRATIONS } = require('./db-setup')

const first = MIGRATIONS.findIndex((migration) => migration.name === 'ai_generation_records.f41_columns')
const last = MIGRATIONS.findIndex((migration) => migration.name === 'ai_generation_records.f41_snapshot_hash_backfill')
if (first < 0 || last < first) throw new Error('F41 migration slice is not registered in scripts/db-setup.js')

const schema = `f41_migration_${randomUUID().replaceAll('-', '')}`

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required for the isolated F41 migration gate')
  const client = new Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`SET search_path TO "${schema}", public`)
    await client.query('CREATE TABLE tenants (id integer PRIMARY KEY)')
    await client.query('CREATE TABLE users (id integer PRIMARY KEY)')
    await client.query('CREATE TABLE sites (id integer PRIMARY KEY)')
    await client.query('CREATE TABLE ai_generation_records (id serial PRIMARY KEY)')

    const f41Migrations = MIGRATIONS.slice(first, last + 1)
    for (let pass = 1; pass <= 2; pass += 1) {
      for (const migration of f41Migrations) await client.query(migration.sql)
      console.log(`[f41-migration-gate] pass ${pass}/2 complete (${f41Migrations.length} migrations)`)
    }
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined)
    await client.end()
  }
}

main().catch((error) => {
  console.error('[f41-migration-gate] failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
