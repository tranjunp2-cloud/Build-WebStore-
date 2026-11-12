/**
 * TC-PERF-178 — `scripts/data/privatize-payment-proofs.ts` also covers receipts stored by the old code during the
 * deploy build window (private = false, no tenant): it selects receipt rows by the rules of migration
 * `media.private_payment_proofs` (referenced by orders.payment_proof_image_id, or the receipt alt), and with --apply
 * re-runs that migration + `media.payment_proof_tenant_from_order` before the ACL pass. Dry run writes nothing.
 * Real: the script's own functions + scripts/db-setup.js MIGRATIONS; the pg pool is a recorder (DB boundary).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
    RECEIPT_ROW_SQL,
    collectReceiptMedia,
    receiptMigrationSql,
} from '../../../../scripts/data/privatize-payment-proofs'

const { MIGRATIONS } = createRequire(import.meta.url)(path.join(process.cwd(), 'scripts/db-setup.js')) as {
    MIGRATIONS: Array<{ name: string; sql: string }>
}
const migration = (name: string) => MIGRATIONS.find((m) => m.name === name)!.sql

const RECEIPTS = [
    { id: 1, filename: 'old-receipt.jpg', prefix: null, _objectkey: null, private: true },
    { id: 2, filename: 'build-window-receipt.png', prefix: null, _objectkey: null, private: false },
]

function recorder() {
    const calls: Array<{ sql: string; params?: unknown[] }> = []
    const db = {
        query: async (sql: string, params?: unknown[]) => {
            calls.push({ sql, params })
            if (sql.startsWith('UPDATE')) return [{ rowCount: 1 }, { rowCount: 0 }]
            if (sql.includes('information_schema.columns')) return { rows: [{ column_name: 'prefix' }] }
            return { rows: RECEIPTS }
        },
    }
    return { db: db as never, calls }
}

describe('privatize-payment-proofs script [TC-PERF-178]', () => {
    it('selects receipts by the migration rules, not only rows already private', () => {
        // Assert: same rules as media.private_payment_proofs
        const sql = migration('media.private_payment_proofs')
        expect(sql).toContain('o.payment_proof_image_id = m.id')
        expect(sql).toContain("alt LIKE 'Payment proof — order %'")
        expect(RECEIPT_ROW_SQL).toContain('o.payment_proof_image_id = m.id')
        expect(RECEIPT_ROW_SQL).toContain("m.alt LIKE 'Payment proof — order %'")
        expect(RECEIPT_ROW_SQL).toContain('m.private = true')
    })

    it('dry run: writes nothing and still lists build-window receipts for the ACL pass', async () => {
        // Arrange
        const { db, calls } = recorder()
        const lines: string[] = []

        // Act
        const media = await collectReceiptMedia(db, { apply: false, before: null, log: (l) => lines.push(l) })

        // Assert
        expect(calls.some((c) => /^\s*UPDATE/i.test(c.sql))).toBe(false)
        const select = calls.at(-1)!.sql
        expect(select).toContain(RECEIPT_ROW_SQL)
        expect(select).not.toMatch(/WHERE private = true AND/)
        expect(media.map((m) => m.id)).toEqual([1, 2])
        expect(media.every((m) => m.private)).toBe(true)
        expect(lines.join('\n')).toMatch(/1 receipt row\(s\) not marked private yet/)
    })

    it('--apply: re-runs the two db-setup receipt migrations before listing the rows', async () => {
        // Arrange
        const { db, calls } = recorder()
        const before = new Date('2026-11-05T00:00:00Z')

        // Act
        await collectReceiptMedia(db, { apply: true, before })

        // Assert
        expect(receiptMigrationSql()).toEqual([
            migration('media.private_payment_proofs'),
            migration('media.payment_proof_tenant_from_order'),
        ])
        expect(calls[0]!.sql).toBe(migration('media.private_payment_proofs'))
        expect(calls[1]!.sql).toBe(migration('media.payment_proof_tenant_from_order'))
        expect(calls.at(-1)!.params).toEqual([before.toISOString()])
        expect(calls.at(-1)!.sql).toContain('m.created_at < $1')
    })
})
