import { describe, it, expect, vi } from 'vitest'
import { MigrationBatchIncompleteError } from '@/lib/migration/pw1-errors'
import { runMigrationWithAudit } from '@/lib/migration/pw1-run-audit'

describe('[TC-F35.M46] Audit after partially failed batch', () => {
    it('audits drained work and preserves the migration failure', async () => {
        const failure = new MigrationBatchIncompleteError('one failed')
        const audit = vi.fn(async () => {})
        await expect(runMigrationWithAudit(async () => { throw failure }, audit)).rejects.toBe(failure)
        expect(audit).toHaveBeenCalledOnce()
    })
    it.each([new Error('DB unavailable'), new MigrationBatchIncompleteError('interrupted', false)])('does not audit fatal or interrupted work', async failure => {
        const audit = vi.fn(async () => {})
        await expect(runMigrationWithAudit(async () => { throw failure }, audit)).rejects.toBe(failure)
        expect(audit).not.toHaveBeenCalled()
    })
    it('reports both migration and audit failures', async () => {
        const failure = new MigrationBatchIncompleteError('one failed')
        await expect(runMigrationWithAudit(async () => { throw failure }, async () => { throw new Error('browser failed') })).rejects.toThrow('one failed; audit failed: browser failed')
    })
    it('audits a successful run', async () => {
        const audit = vi.fn(async () => {})
        await runMigrationWithAudit(async () => {}, audit)
        expect(audit).toHaveBeenCalledOnce()
    })
})
