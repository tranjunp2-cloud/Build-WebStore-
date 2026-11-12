/**
 * TC-F19.87 — tenants_custom_domains integrity migrations.
 * Rows of deleted tenants kept their domain under the unique index, so the domain could never be
 * added again. db-setup must drop those orphans and add an FK that cascades tenant deletes.
 * Real: MIGRATIONS from scripts/db-setup.js. No fakes.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../../..')
const require_ = createRequire(import.meta.url)
const { MIGRATIONS } = require_(path.join(root, 'scripts/db-setup.js')) as { MIGRATIONS: Array<{ name: string; sql: string }> }
const indexOf = (name: string) => MIGRATIONS.findIndex((m) => m.name === name)

describe('tenants_custom_domains integrity [TC-F19.87]', () => {
    it('deletes rows whose tenant no longer exists', () => {
        const step = MIGRATIONS[indexOf('tenants_custom_domains.cleanup_orphans')]
        expect(step?.sql).toBe('DELETE FROM tenants_custom_domains WHERE _parent_id NOT IN (SELECT id FROM tenants);')
    })

    it('adds an idempotent FK to tenants with ON DELETE CASCADE', () => {
        const sql = MIGRATIONS[indexOf('tenants_custom_domains.add_fk_parent')]?.sql ?? ''
        expect(sql).toContain("IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_custom_domains_parent_fk')")
        expect(sql).toContain('FOREIGN KEY (_parent_id) REFERENCES tenants(id) ON DELETE CASCADE')
    })

    it('runs after the table exists and cleans orphans before adding the FK', () => {
        const create = indexOf('tenants_custom_domains.create_table')
        const cleanup = indexOf('tenants_custom_domains.cleanup_orphans')
        const fk = indexOf('tenants_custom_domains.add_fk_parent')
        expect(create).toBeGreaterThanOrEqual(0)
        expect(cleanup).toBeGreaterThan(create)
        expect(fk).toBeGreaterThan(cleanup)
    })
})
