import { configureMigrationTransactions } from './pw1-transactions'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

export type CleanupOptions = { store: string; apply?: boolean; olderThanHours?: number; limit?: number; afterId?: number }
type Candidate = { id: number; filename: string; source_hash: string; tenant_id: number }
type Table = { schema: string; name: string; rls: boolean; excluded: string[] }
type Tx = { execute(query: unknown): Promise<unknown> }
type Database = { drizzle: { transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }; sessions: Record<string, { db: Tx; reject: () => Promise<void> }> }
export function validateCleanupOptions(options: CleanupOptions) {
    if (!/^\d+$/.test(options.store)) throw new Error('cleanup-media requires a numeric --store')
    const olderThanHours = options.olderThanHours ?? 168, limit = options.limit ?? 20
    if (!Number.isSafeInteger(olderThanHours) || olderThanHours < 1 || olderThanHours > 87600) throw new Error('older-than-hours must be 1–87600')
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be 1–100')
    const afterId = options.afterId ?? 0
    if (!Number.isSafeInteger(afterId) || afterId < 0) throw new Error('after-id must be a nonnegative safe integer')
    return { ...options, olderThanHours, limit, afterId }
}
export function migrationMediaStem(candidate: Candidate): string | null {
    const stem = `pw1-${candidate.tenant_id}-${candidate.source_hash.slice(0, 20)}`
    return /^[a-f0-9]{64}$/.test(candidate.source_hash) && ['jpg','jpeg','png','webp','gif','avif','ico'].some(ext => candidate.filename === `${stem}.${ext}`) ? stem : null
}
const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`
const qualified = (table: Table) => `${quote(table.schema)}.${quote(table.name)}`

/** Conservative database-wide scan: extra matches retain media rather than risk deletion.
 * Includes versions, HTML/JSON URLs, and migration backup artifacts. No source data is returned. */
async function referenceTable(tx: Tx, tables: Table[], candidate: Candidate, stem: string, failedAttempts: string[] = []) {
    const idPattern = `(^|[^a-zA-Z0-9])${candidate.id}([^a-zA-Z0-9]|$)`
    const searchable = tables.filter(table => !(table.schema === 'public' && table.name === 'pw1_migration_media'))
    // Batch independent reference probes to avoid one network round trip per table/media pair.
    // The same transaction/table locks protect every probe and the eventual deletion.
    for (let offset = 0; offset < searchable.length; offset += 40) {
        const probes = searchable.slice(offset, offset + 40).map(table => {
            const excludeSelf = table.schema === 'public' && table.name === 'media' ? sql`AND t.id <> ${candidate.id}` : sql``
            const row = table.schema === 'public' && table.name === 'pw1_migration_attempts' && failedAttempts.length
                ? sql`CASE WHEN t.id=ANY(${'{'+failedAttempts.join(',')+'}'}::uuid[]) AND t.status='failed' THEN jsonb_set(to_jsonb(t), '{artifacts}', jsonb_build_object('site-before.json',t.artifacts->'site-before.json')) ELSE to_jsonb(t) END`
                : sql`to_jsonb(t)`
            const document = sql`(${row} - ${table.excluded}::text[])`
            return sql`SELECT ${`${table.schema}.${table.name}`}::text AS source WHERE EXISTS (
                SELECT 1 FROM ${sql.raw(qualified(table))} t
                WHERE (${document}::text ~ ${idPattern} OR strpos(${document}::text, ${stem}) > 0) ${excludeSelf} LIMIT 1)`
        })
        const result = await tx.execute(sql`SELECT source FROM (${sql.join(probes, sql` UNION ALL `)}) refs LIMIT 1`) as { rows: Array<{ source: string }> }
        if (result.rows.length) return result.rows[0].source
    }
    return null
}

export async function cleanupPw1Media(input: CleanupOptions) {
    const options = validateCleanupOptions(input)
    const client = new Client({ connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL })
    await client.connect()
    let payload: Payload | undefined
    try {
        if (!(await client.query('SELECT pg_try_advisory_lock(351827,0) AS locked')).rows[0].locked) throw new Error('Migration or media cleanup is running; try again later')
        // Never recover/change the migration ledger just to clean media.
        if ((await client.query("SELECT 1 FROM pw1_migration_attempts WHERE status='running' UNION ALL SELECT 1 FROM pw1_migration_batches WHERE status='running' LIMIT 1")).rowCount) throw new Error('Unresolved running migration; recover it before cleanup')
        const mapping = (await client.query('SELECT tenant_id FROM pw1_migration_stores WHERE source_store_id=$1', [options.store])).rows[0]
        if (!mapping) throw new Error('Source store mapping not found')
        const candidates = (await client.query<Candidate>(`SELECT m.id,m.filename,c.source_hash,c.tenant_id FROM pw1_migration_media c JOIN media m ON m.id=c.media_id
            WHERE c.tenant_id=$1 AND m.created_at < now()-($2::int * interval '1 hour') AND c.last_used_at < now()-($2::int * interval '1 hour')
            AND m.id > $4 ORDER BY m.id LIMIT $3`, [mapping.tenant_id, options.olderThanHours, options.limit, options.afterId])).rows
        process.env.PAYLOAD_PUSH_SCHEMA = 'false'
        const { getPayload } = await import('payload'); const { default: config } = await import('@payload-config')
        payload = await getPayload({ config })
        const results = await cleanCandidates(payload, candidates, options)
        const report = { sourceStoreId: options.store, mode: options.apply ? 'apply' : 'dry-run', olderThanHours: options.olderThanHours, limit: options.limit, nextAfterId: candidates.length === options.limit ? candidates.at(-1)?.id : null, results }
        console.log(JSON.stringify(report, null, 2))
        if (results.some(r => r.status === 'error')) throw new Error('Some media could not be cleaned; inspect report and retry during an idle maintenance window')
        return report
    } finally { try { if (payload) await payload.destroy() } finally { await client.end() } }
}

async function cleanCandidates(payload: Payload, candidates: Candidate[], options: { apply?: boolean; olderThanHours: number; signal?: AbortSignal }, failedAttempts: string[] = []) {
    configureMigrationTransactions(payload)
    const activePayload = payload, db = payload.db as unknown as Database
    const results: Array<{ mediaId: number; status: string; reason?: string }> = []
    // A read-only preflight can only retain candidates. Every deletion still runs the
    // authoritative locked check below, so concurrent CMS edits cannot create a stale delete.
    const preflightReferences = new Set<number>()
    if (candidates.length > 1) {
        const refs = await db.drizzle.transaction(async tx => {
            await tx.execute(sql`SET LOCAL statement_timeout = '30s'`)
            const result = await tx.execute(sql`WITH documents AS MATERIALIZED (
                SELECT to_jsonb(p)::text AS document FROM pages p
                UNION ALL SELECT to_jsonb(s)::text FROM sites s
            ) SELECT c.id FROM jsonb_to_recordset(${JSON.stringify(candidates)}::jsonb)
                AS c(id int,filename text,source_hash text,tenant_id int)
                WHERE EXISTS (SELECT 1 FROM documents d WHERE
                    strpos(d.document,'pw1-'||c.tenant_id::text||'-'||left(c.source_hash,20))>0)`) as {rows: Array<{id:number}>}
            return result.rows
        })
        for (const row of refs) preflightReferences.add(row.id)
    }
    for (const candidate of candidates) {
        if (preflightReferences.has(candidate.id)) { results.push({mediaId:candidate.id,status:'retained',reason:'Possible reference in pages/sites preflight'}); continue }
        const stem = migrationMediaStem(candidate)
        if (!stem) { results.push({ mediaId: candidate.id, status: 'retained', reason: 'Migration provenance/filename mismatch' }); continue }
        try {
            options.signal?.throwIfAborted()
            const result = await db.drizzle.transaction(async tx => {
                await tx.execute(sql`SET LOCAL lock_timeout = '2s'`)
                await tx.execute(sql`SET LOCAL statement_timeout = '30s'`)
                const { rows: tables } = await tx.execute(sql`SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,
                    ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0
                        AND (a.attname IN ('_uuid','_order','_parent_id') OR EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND a.attnum=ANY(k.conkey) AND k.contype IN ('p','f')))
                        AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND a.attnum=ANY(k.conkey) AND k.contype='f' AND k.confrelid='public.media'::regclass)) AS excluded
                    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
                    ORDER BY n.nspname,c.relname`) as { rows: Table[] }
                if (tables.some(t => t.rls)) throw new Error('Cannot prove absence of references with row-level security enabled')
                // A maintenance operation: block concurrent writes until reference check + delete finish.
                // Reads continue. NOWAIT prevents stalling an active CMS write transaction.
                if (options.apply) await tx.execute(sql.raw(`LOCK TABLE ${tables.map(qualified).join(',')} IN SHARE ROW EXCLUSIVE MODE NOWAIT`))
                if (failedAttempts.length) {
                    const receipts = await tx.execute(sql`SELECT 1 FROM pw1_migration_commits WHERE attempt_id=ANY(${'{'+failedAttempts.join(',')+'}'}::uuid[]) LIMIT 1`) as { rows: unknown[] }
                    if (receipts.rows.length) return { mediaId: candidate.id, status: 'retained', reason: 'Store has a committed attempt' }
                }
                const ageFilter = options.olderThanHours > 0
                    ? sql`AND m.created_at < now()-(${options.olderThanHours}::int * interval '1 hour') AND c.last_used_at < now()-(${options.olderThanHours}::int * interval '1 hour')`
                    : sql``
                const current = await tx.execute(sql`SELECT 1 FROM media m JOIN pw1_migration_media c ON c.media_id=m.id
                    WHERE m.id=${candidate.id} AND m.filename=${candidate.filename} AND c.tenant_id=${candidate.tenant_id} AND c.source_hash=${candidate.source_hash}
                    ${ageFilter}`) as { rows: unknown[] }
                if (!current.rows.length) return { mediaId: candidate.id, status: 'retained', reason: 'Candidate changed since scan' }
                // A shared cache entry is a reference too, even though the owning cache entry is excluded.
                const shared = await tx.execute(sql`SELECT 1 FROM pw1_migration_media WHERE media_id=${candidate.id} AND tenant_id<>${candidate.tenant_id} LIMIT 1`) as { rows: unknown[] }
                if (shared.rows.length) return { mediaId: candidate.id, status: 'retained', reason: 'Shared migration cache' }
                const reference = await referenceTable(tx, tables, candidate, stem, failedAttempts)
                if (reference) return { mediaId: candidate.id, status: 'retained', reason: `Possible reference in ${reference}` }
                if (!options.apply) return { mediaId: candidate.id, status: 'eligible' }
                options.signal?.throwIfAborted()
                const transactionID = randomUUID()
                let aborted = false
                db.sessions[transactionID] = { db: tx, reject: async () => { aborted = true } }
                try {
                    // Use Payload so configured storage hooks remove the original file and derivatives.
                    await activePayload.delete({ collection: 'media', id: candidate.id, req: { transactionID } })
                    if (aborted || !db.sessions[transactionID]) throw new Error('Payload aborted media deletion')
                } finally { delete db.sessions[transactionID] }
                return { mediaId: candidate.id, status: 'deleted' }
            })
            results.push(result)
        } catch (error) {
            results.push({ mediaId: candidate.id, status: 'error', reason: error instanceof Error ? error.message : 'Cleanup failed' })
        }
    }
    return results
}

/** Called only after all store retries end and rollback has resolved, on the runner's existing lock connection. */
export async function cleanupFailedStoreMedia(payload: Payload, client: Client, createdIds: number[], attemptIds: string[], signal?: AbortSignal) {
    if (!createdIds.length) return { status: 'not-needed', results: [] }
    const held = await client.query(`SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND classid=351827 AND objid=0 AND granted`)
    if (!held.rowCount) throw new Error('Batch lock lost; automatic cleanup refused')
    if (!attemptIds.length) throw new Error('Missing migration attempt provenance')
    const attempts = await client.query(`SELECT a.status,c.attempt_id FROM pw1_migration_attempts a LEFT JOIN pw1_migration_commits c ON c.attempt_id=a.id WHERE a.id=ANY($1::uuid[])`, [attemptIds])
    if (attempts.rows.length !== attemptIds.length || attempts.rows.some(a => a.status !== 'failed' || a.attempt_id)) return { status: 'retained', reason: 'Attempt unresolved or committed', results: [] }
    const candidates = (await client.query<Candidate>(`SELECT m.id,m.filename,c.source_hash,c.tenant_id FROM pw1_migration_media c JOIN media m ON m.id=c.media_id WHERE m.id=ANY($1::int[])`, [createdIds])).rows
    const results = await cleanCandidates(payload, candidates, { apply: true, olderThanHours: 0, signal }, attemptIds)
    // Missing registration is never guessed from a filename; report it for later recovery.
    for (const id of createdIds) if (!candidates.some(c => c.id === id)) results.push({ mediaId: id, status: 'retained', reason: 'Upload registration missing; cannot verify provenance' })
    return { status: results.some(r => r.status === 'error') ? 'partial' : 'completed', results }
}

/** Explicit local test reset only; caller must first remove the scoped sites and migration mappings. */
export async function cleanupResetMigrationMedia(payload: Payload, client: Client, tenantIds: number[], archivedCandidates?: Candidate[]) {
    const destination = new URL(process.env.DATABASE_URI || process.env.DATABASE_URL || '')
    if (!['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname)) throw new Error('Test reset cleanup is local-only')
    if (!tenantIds.length || tenantIds.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('Explicit tenant IDs required')
    const held = await client.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND classid=351827 AND objid=0 AND granted")
    if (!held.rowCount) throw new Error('Reset requires the batch lock')
    const remaining = await client.query('SELECT 1 FROM sites WHERE tenant_id=ANY($1::int[]) UNION ALL SELECT 1 FROM pw1_migration_stores WHERE tenant_id=ANY($1::int[]) LIMIT 1', [tenantIds])
    if (remaining.rowCount) throw new Error('Remove reset scope sites/mappings before cleanup')
    const candidates = archivedCandidates ?? (await client.query<Candidate>('SELECT m.id,m.filename,c.source_hash,c.tenant_id FROM pw1_migration_media c JOIN media m ON m.id=c.media_id WHERE c.tenant_id=ANY($1::int[])', [tenantIds])).rows
    if (candidates.some(c => !tenantIds.includes(c.tenant_id) || !migrationMediaStem(c))) throw new Error('Reset archive provenance mismatch')
    configureMigrationTransactions(payload)
    const db = payload.db as unknown as Database
    return db.drizzle.transaction(async tx => {
        await tx.execute(sql`SET LOCAL statement_timeout = '120s'`)
        const { rows: tables } = await tx.execute(sql`SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,
            ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0
                AND (a.attname IN ('_uuid','_order','_parent_id') OR EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND a.attnum=ANY(k.conkey) AND k.contype IN ('p','f')))
                AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND a.attnum=ANY(k.conkey) AND k.contype='f' AND k.confrelid='public.media'::regclass)) AS excluded
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
            ORDER BY n.nspname,c.relname`) as { rows: Table[] }
        if (tables.some(t => t.rls)) throw new Error('Cannot prove references with row-level security')
        await tx.execute(sql.raw(`LOCK TABLE ${tables.map(qualified).join(',')} IN SHARE ROW EXCLUSIVE MODE NOWAIT`))
        const current = await tx.execute(sql`SELECT id,filename FROM media WHERE id=ANY(${'{'+candidates.map(c => c.id).join(',')+'}'}::int[])`) as { rows: Array<{ id: number; filename: string }> }
        const retained = new Map<number, string>()
        for (const candidate of candidates) {
            if (!current.rows.some(r => r.id === candidate.id && r.filename === candidate.filename)) retained.set(candidate.id, 'Candidate changed since scan')
        }
        // Serialize each existing document once per table, then check all reset candidates.
        // Hold write locks until deletion finishes so the shared snapshot cannot become stale.
        const searchable = tables.filter(table => !(table.schema === 'public' && table.name === 'pw1_migration_media'))
        for (let offset = 0; offset < searchable.length; offset += 20) {
            const pending = candidates.filter(c => !retained.has(c.id))
            if (!pending.length) break
            const probes = searchable.slice(offset, offset + 20).map(table => {
                const own = table.schema === 'public' && table.name === 'media' ? sql`t.id` : sql`NULL::int`
                return sql`(WITH documents AS MATERIALIZED (
                    SELECT (to_jsonb(t) - ${table.excluded}::text[])::text AS document, ${own} AS own_id FROM ${sql.raw(qualified(table))} t
                ) SELECT c.id, ${`${table.schema}.${table.name}`}::text AS source
                FROM jsonb_to_recordset(${JSON.stringify(pending)}::jsonb) AS c(id int,filename text,source_hash text,tenant_id int)
                WHERE EXISTS (SELECT 1 FROM documents d WHERE d.own_id IS DISTINCT FROM c.id AND (
                    d.document ~ ('(^|[^a-zA-Z0-9])'||c.id::text||'([^a-zA-Z0-9]|$)')
                    OR strpos(d.document,'pw1-'||c.tenant_id::text||'-'||left(c.source_hash,20))>0)))`
            })
            const result = await tx.execute(sql`${sql.join(probes, sql` UNION ALL `)}`) as {rows: Array<{id:number;source:string}>}
            for (const row of result.rows) if (!retained.has(row.id)) retained.set(row.id, `Possible reference in ${row.source}`)
        }
        const results: Array<{ mediaId: number; status: string; reason?: string }> = []
        const transactionID = randomUUID()
        let aborted = false
        db.sessions[transactionID] = { db: tx, reject: async () => { aborted = true } }
        try {
            for (const candidate of candidates) {
                const shared = await tx.execute(sql`SELECT 1 FROM pw1_migration_media WHERE media_id=${candidate.id} AND tenant_id<>${candidate.tenant_id} LIMIT 1`) as { rows: unknown[] }
                if (shared.rows.length) retained.set(candidate.id, 'Shared migration cache')
                if (retained.has(candidate.id)) { results.push({ mediaId: candidate.id, status: 'retained', reason: retained.get(candidate.id) }); continue }
                await payload.delete({ collection: 'media', id: candidate.id, req: { transactionID } })
                if (aborted || !db.sessions[transactionID]) throw new Error('Reset media transaction aborted')
                results.push({ mediaId: candidate.id, status: 'deleted' })
            }
        } finally { delete db.sessions[transactionID] }
        return results
    })
}
