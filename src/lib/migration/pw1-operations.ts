import { readBatchReport, batchReportCsv } from './pw1-batch-report'
import { Client } from 'pg'
/** Recovery is only called after acquiring the database-wide batch lock. */
export async function recoverInterruptedBatches(client: Client) {
    await client.query(`UPDATE pw1_migration_attempts a SET status=CASE WHEN c.attempt_id IS NULL THEN 'failed' ELSE 'completed' END,
        stage=CASE WHEN c.attempt_id IS NULL THEN 'interrupted' ELSE 'completed' END,
        error=CASE WHEN c.attempt_id IS NULL THEN 'Previous worker stopped before commit; rerun input to retry' ELSE NULL END,
        error_code=CASE WHEN c.attempt_id IS NULL THEN 'INTERRUPTED' ELSE NULL END,
        retryable=(c.attempt_id IS NULL),finished_at=now()
        FROM pw1_migration_attempts old LEFT JOIN pw1_migration_commits c ON c.attempt_id=old.id
        WHERE a.id=old.id AND a.status='running'`)
    await client.query(`UPDATE pw1_migration_stores s SET status=COALESCE(a.status,'failed'),updated_at=now()
        FROM (SELECT DISTINCT ON (source_store_id) source_store_id,status FROM pw1_migration_attempts ORDER BY source_store_id,started_at DESC,id DESC) a
        WHERE s.source_store_id=a.source_store_id AND s.status='running'`)
    await client.query(`UPDATE pw1_migration_batches SET status='failed',finished_at=now(),
        results=results || '[{"error":"Worker interrupted; inspect attempts and retry input","stage":"interrupted"}]'::jsonb WHERE status='running'`)
}
export async function inspectMigration(command: 'status' | 'logs', store?: string) {
    const client = new Client({ connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL })
    await client.connect()
    try {
        const installed = await client.query("SELECT to_regclass('pw1_migration_attempts') AS installed")
        if (!installed.rows[0].installed) return { stores: [], attempts: [], message: 'Migration ledger has not been installed' }
        if (command === 'logs') {
            const result = await client.query(`SELECT a.id,a.source_store_id,a.batch_id,a.status,a.stage,a.error,a.error_code,a.retryable,a.attempt_number,a.started_at,a.finished_at,a.heartbeat_at,c.committed_at,
                a.artifacts->'carousel-scan.json' AS carousel_scan,a.artifacts->'carousel-evidence.json' AS carousel_evidence,
                a.artifacts->'warnings.json' AS warnings,a.artifacts->'service-response.json' AS service_response FROM pw1_migration_attempts a LEFT JOIN pw1_migration_commits c ON c.attempt_id=a.id
                WHERE ($1::text IS NULL OR a.source_store_id=$1) ORDER BY a.started_at DESC LIMIT 100`, [store ?? null])
            const invalid = await client.query(`SELECT id,started_at,results FROM pw1_migration_batches WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(results) r WHERE r ? 'error' AND ($1::text IS NULL OR r->>'sourceStoreId'=$1)) ORDER BY started_at DESC LIMIT 20`, [store ?? null])
            return { attempts: result.rows, failedBatches: invalid.rows }
        }
        const stores = await client.query(`SELECT s.*,a.email,
            CASE WHEN s.status='completed' AND s.warning_count>0 THEN 'completed_with_warnings' ELSE s.status END AS outcome,
            last_attempt.stage,last_attempt.error,last_attempt.error_code,last_attempt.retryable,last_attempt.heartbeat_at
            FROM pw1_migration_stores s JOIN pw1_migration_accounts a USING(source_user_id)
            LEFT JOIN LATERAL (SELECT * FROM pw1_migration_attempts WHERE source_store_id=s.source_store_id ORDER BY started_at DESC LIMIT 1) last_attempt ON true
            WHERE ($1::text IS NULL OR s.source_store_id=$1) ORDER BY s.updated_at DESC`, [store ?? null])
        const batches = await client.query('SELECT * FROM pw1_migration_batches ORDER BY started_at DESC LIMIT 20')
        return { stores: stores.rows, batches: batches.rows }
    } finally { await client.end() }
}

export async function exportMigrationReport(batchId: string, format: 'json' | 'csv') {
    const client = new Client({ connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL })
    await client.connect()
    try {
        const report = await readBatchReport(client, batchId)
        return format === 'csv' ? batchReportCsv(report) : JSON.stringify(report, null, 2) + '\n'
    } finally { await client.end() }
}
