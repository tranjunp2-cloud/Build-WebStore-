/**
 * TC-PERF-152 — One-off cleanup of client JSON stored verbatim (pages.locale_content / published_locale_content):
 * the SQL strips exactly what stripPrivateSnapshots strips on save / read (same private keys, same relation keys),
 * only on rows that match, column-safe.
 * TC-PERF-153 — Media ownership schema: tenant_id (+ index, FK ON DELETE SET NULL — staging's `media.tenant_id` /
 * `media.tenant_idx`, plus an FK added only when none exists), private (default false), existing payment receipts
 * made private; no owner is ever assigned to existing rows (legacy / shared stock stay NULL); idempotent, nothing
 * dropped.
 * TC-PERF-165 — Deploy safety of the migration runner: the scale indexes are built CONCURRENTLY (an INVALID leftover
 * is dropped first), every entry runs under a lock_timeout, and the columns Payload selects on every query fail the
 * build when they cannot be added.
 * Real: scripts/db-setup.js MIGRATIONS, lib/payload/safe-populate.ts.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { PRIVATE_SNAPSHOT_KEYS, RELATION_ROW_KEYS } from '@/lib/payload/safe-populate'

const { MIGRATIONS } = createRequire(import.meta.url)(path.join(process.cwd(), 'scripts/db-setup.js')) as {
    MIGRATIONS: Array<{ name: string; sql: string; required?: boolean; critical?: boolean; concurrentIndex?: string }>
}
const sqlOf = (name: string) => {
    const entries = MIGRATIONS.filter((m) => m.name === name)
    expect(entries).toHaveLength(1)
    return entries[0]!.sql
}
const quotedList = (sql: string, after: string) => {
    const start = sql.indexOf(after)
    const list = sql.slice(start, sql.indexOf(')', start))
    return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('pages JSON cleanup [TC-PERF-152]', () => {
    const sql = sqlOf('pages.strip_private_snapshots')

    it('drops the same private keys as stripPrivateSnapshots', () => {
        expect(new Set(quotedList(sql, "IF k IN ('xenditSecretKey'"))).toEqual(new Set(PRIVATE_SNAPSHOT_KEYS))
    })

    it('turns the same relation rows into their id', () => {
        expect(new Set(quotedList(sql, "IF k IN ('tenant'"))).toEqual(new Set(RELATION_ROW_KEYS))
        expect(sql).toContain("jsonb_build_object(k, c -> 'id')")
    })

    it('rewrites only matching rows of both page JSON columns, skipping a missing column', () => {
        expect(sql).toContain("ARRAY['locale_content', 'published_locale_content']")
        expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM information_schema\.columns/)
        expect(sql).toMatch(/WHERE %1\$I::text ~ %2\$L/)
        for (const key of PRIVATE_SNAPSHOT_KEYS) expect(sql).toContain(key)
    })
})

describe('media ownership schema [TC-PERF-153]', () => {
    it('adds tenant_id with an index and a SET NULL foreign key, idempotently', () => {
        expect(sqlOf('media.tenant_id')).toContain('ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id) ON DELETE SET NULL')
        expect(sqlOf('media.tenant_idx')).toContain('CREATE INDEX IF NOT EXISTS media_tenant_idx ON media (tenant_id);')
    })

    it('adds the foreign key to a pre-existing column only when no foreign key on it exists under any name', () => {
        const sql = sqlOf('media.tenant_id_fk_if_missing')
        expect(sql).toMatch(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint c/)
        expect(sql).toContain("c.contype = 'f' AND a.attname = 'tenant_id'")
        expect(sql).not.toContain('conname =')
        expect(sql).toContain('FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL')
    })

    it('never assigns an owner to existing media (legacy rows and the shared stock library stay NULL)', () => {
        expect(MIGRATIONS.some((m) => m.name === 'media.tenant_backfill')).toBe(false)
        for (const m of MIGRATIONS.filter((x) => x.name !== 'media.payment_proof_tenant_from_order')) {
            expect(m.sql).not.toMatch(/UPDATE media( m)? SET tenant_id = (?!NULL)/)
        }
    })

    it('gives an ownerless payment receipt the shop of its own order, and touches no other row', () => {
        const sql = sqlOf('media.payment_proof_tenant_from_order')
        expect(sql).toContain('SET tenant_id = o.tenant_id FROM orders o')
        expect(sql).toContain('o.payment_proof_image_id = m.id')
        expect(sql).toContain('m.tenant_id IS NULL')
    })

    it('adds private defaulting to false (no NULL rows for the not_equals: true read rule)', () => {
        const sql = sqlOf('media.private')
        expect(sql).toContain('ALTER TABLE media ADD COLUMN IF NOT EXISTS private boolean DEFAULT false;')
        expect(sql).toContain('UPDATE media SET private = false WHERE private IS NULL;')
    })

    it('makes stored payment receipts private', () => {
        const sql = sqlOf('media.private_payment_proofs')
        expect(sql).toContain('o.payment_proof_image_id = m.id')
        expect(sql).toContain("alt LIKE 'Payment proof — order %'")
    })

    it('drops no table', () => {
        for (const name of ['media.tenant_id', 'media.tenant_idx', 'media.tenant_id_fk_if_missing', 'media.private', 'media.private_payment_proofs', 'pages.strip_private_snapshots']) {
            expect(sqlOf(name)).not.toMatch(/DROP\s+TABLE/i)
        }
    })
})

describe('migration deploy safety [TC-PERF-165]', () => {
    const entry = (name: string) => MIGRATIONS.find((m) => m.name === name)!

    it('builds the scale indexes CONCURRENTLY and names them for the invalid-leftover drop', () => {
        for (const [name, index] of [
            ['analytics.tenant_created_idx', 'analytics_tenant_created_idx'],
            ['orders.tenant_created_idx', 'orders_tenant_created_idx'],
            ['_pages_v.site_latest_idx', '_pages_v_site_latest_idx'],
        ] as const) {
            expect(entry(name).sql).toMatch(new RegExp(`^CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index} ON `))
            expect(entry(name).sql).not.toContain(';\n') // one statement: CONCURRENTLY cannot run in a transaction
            expect(entry(name).concurrentIndex).toBe(index)
        }
    })

    it('fails the build (without re-running every deploy) when a column Payload always selects cannot be added', () => {
        // media.tenant_id is staging's entry (already applied there), kept as it shipped
        for (const name of ['users.reset_password_requested_at', 'media._objectkey', 'media.private']) {
            expect(entry(name).required).toBe(true)
            expect(entry(name).critical).toBeUndefined()
        }
    })
})
