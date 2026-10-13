import { MigrationBatchIncompleteError } from './pw1-errors'

/** Audit completed work even when individual stores exhausted their retries. */
export async function runMigrationWithAudit(run: () => Promise<void>, audit?: () => Promise<void>) {
    let incomplete: MigrationBatchIncompleteError | undefined
    try { await run() } catch (error) {
        if (!(error instanceof MigrationBatchIncompleteError) || !error.auditAllowed || !audit) throw error
        incomplete = error
    }
    if (audit) {
        try { await audit() } catch (error) {
            if (incomplete) throw new AggregateError([incomplete, error], `${incomplete.message}; audit failed: ${error instanceof Error ? error.message : String(error)}`)
            throw error
        }
    }
    if (incomplete) throw incomplete
}
