/**
 * One-off: make the storage objects of private media (bank-transfer receipts) private (TC-PERF-171).
 *
 * Why: every media object is uploaded `public-read`. Since #1996 a new receipt is private in the DB and its objects
 * are switched to the `private` ACL right after upload (lib/media/private-media-acl.ts). Receipts stored BEFORE that
 * were only marked private by db-setup (`media.private_payment_proofs`, `media.payment_proof_tenant_from_order`):
 * their objects are still public-read, often under the buyer's own file name, so `<bucket>/<name>` still opens them.
 * This sets the `private` ACL on every object of every receipt row (original + sizes, same key layout as the storage
 * plugin). Rows are not renamed or moved: the app opens receipts only through /api/media/private/{id}, which reads them
 * with the bucket credentials. Safe to re-run.
 *
 * Receipts uploaded by the OLD code during the deploy build window (after db-setup ran its one-off migrations, before
 * the new deployment went live) were stored `private = false` with no tenant, and the cached migrations never run
 * again (TC-PERF-178). So the script selects receipts by the same rules as `media.private_payment_proofs` (referenced
 * by `orders.payment_proof_image_id`, or alt `Payment proof — order …`), not only `private = true` rows. With --apply
 * it first re-runs those two migrations (`media.private_payment_proofs` + `media.payment_proof_tenant_from_order`,
 * SQL taken from scripts/db-setup.js; they cover every matching row, --before only narrows the ACL pass) so the rows
 * are private and owned before their objects are switched. The dry run changes nothing and reports how many rows
 * would be marked.
 *
 * Usage (DRY RUN by default — lists the objects, changes nothing):
 *   npx tsx scripts/data/privatize-payment-proofs.ts                         # dry run, all receipt rows
 *   npx tsx scripts/data/privatize-payment-proofs.ts --before 2026-11-05     # dry run, rows created before a date
 *   npx tsx scripts/data/privatize-payment-proofs.ts --apply [--before ...]  # mark rows private, then set the ACLs
 *
 * Env: DATABASE_URI (or DATABASE_URL), and for --apply S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY of the bucket the app writes media to (`vercel env pull` for the target environment).
 * Run --apply only once the #1996 deployment is live (no old code storing public receipts any more), then open one
 * old receipt's public URL: it must answer 403 / AccessDenied, while the order page still shows it.
 * Exit code 1 when any object could not be changed (listed in the output).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { parseArgs } from 'node:util'
import pg from 'pg'

import { privatizeStoredMedia } from '../../src/lib/media/private-media-acl'
import { buildS3Client } from '../../src/lib/media/s3-client'

type Queryable = Pick<pg.Pool, 'query'>

/** The receipt rules of migration `media.private_payment_proofs`, for a `media m` row. */
export const RECEIPT_ROW_SQL = `(m.private = true
    OR EXISTS (SELECT 1 FROM orders o WHERE o.payment_proof_image_id = m.id)
    OR m.alt LIKE 'Payment proof — order %')`

/** The two one-off receipt migrations of scripts/db-setup.js, run again here for rows stored after they ran. */
export const RECEIPT_MIGRATIONS = ['media.private_payment_proofs', 'media.payment_proof_tenant_from_order'] as const

export function receiptMigrationSql(): string[] {
    const { MIGRATIONS } = createRequire(path.join(process.cwd(), 'package.json'))('./scripts/db-setup.js') as {
        MIGRATIONS: Array<{ name: string; sql: string }>
    }
    return RECEIPT_MIGRATIONS.map((name) => {
        const entry = MIGRATIONS.find((m) => m.name === name)
        if (!entry) throw new Error(`scripts/db-setup.js has no migration ${name}`)
        return entry.sql
    })
}

export type ReceiptRow = { id: number; filename: string; prefix: string | null; _objectkey: string | null; private: boolean }

/**
 * Marks receipt rows private (+ tenant from the order) when `apply`, then lists every receipt row with its storage
 * keys. Dry run: no write; rows not yet private are counted as "would be marked".
 */
export async function collectReceiptMedia(db: Queryable, options: { apply: boolean; before: Date | null; log?: (line: string) => void }) {
    const log = options.log ?? (() => {})
    if (options.apply) {
        for (const [index, sql] of receiptMigrationSql().entries()) {
            const result = await db.query(sql)
            const counts = (Array.isArray(result) ? result : [result]).map((r: { rowCount?: number | null }) => r.rowCount ?? 0)
            log(`${RECEIPT_MIGRATIONS[index]}: ${counts.reduce((a, b) => a + b, 0)} row(s) updated`)
        }
    }
    // `prefix` exists only when the storage plugin is configured with one
    const { rows: columns } = await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'media' AND column_name IN ('prefix', '_objectkey')`,
    )
    const has = (name: string) => columns.some((c: { column_name: string }) => c.column_name === name)
    const { rows } = await db.query(
        `SELECT m.id, m.filename, ${has('prefix') ? 'm.prefix' : 'NULL AS prefix'}, ${has('_objectkey') ? 'm._objectkey' : 'NULL AS _objectkey'},
                m.private
           FROM media m
          WHERE m.filename IS NOT NULL AND ${RECEIPT_ROW_SQL} ${options.before ? 'AND m.created_at < $1' : ''}
          ORDER BY m.id`,
        options.before ? [options.before.toISOString()] : [],
    )
    const receipts = rows as ReceiptRow[]
    const notYetPrivate = receipts.filter((row) => row.private !== true).length
    if (notYetPrivate > 0) {
        log(`${notYetPrivate} receipt row(s) not marked private yet${options.apply ? ' (still public after the update: check them)' : ' — --apply marks them private first'}`)
    }
    return receipts.map((row) => ({
        id: row.id,
        private: true,
        filename: row.filename,
        prefix: row.prefix,
        _objectKey: row._objectkey,
    }))
}

async function main() {
    const { values } = parseArgs({
        options: { apply: { type: 'boolean', default: false }, before: { type: 'string' }, help: { type: 'boolean' } },
        strict: true,
        allowPositionals: false,
    })
    if (values.help) {
        process.stdout.write('Usage: npx tsx scripts/data/privatize-payment-proofs.ts [--apply] [--before <ISO date>]\n')
        return
    }
    const before = values.before ? new Date(values.before) : null
    if (before && Number.isNaN(before.getTime())) throw new Error(`--before is not a date: ${values.before}`)
    const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URI is required')

    const pool = new pg.Pool({ connectionString })
    try {
        const media = await collectReceiptMedia(pool, { apply: Boolean(values.apply), before, log: (line) => console.log(line) })
        console.log(`${media.length} receipt media row(s)${values.apply ? '' : ' — DRY RUN, pass --apply to mark them private and change the ACLs'}`)

        const run = await privatizeStoredMedia(media, {
            apply: Boolean(values.apply),
            s3: values.apply ? buildS3Client() : null,
            log: (line) => console.log(line),
        })
        console.log(`${run.objects} object(s); ${values.apply ? `${run.done} set private, ${run.failed.length} failed` : 'nothing changed'}`)
        if (run.failed.length > 0) process.exitCode = 1
    } finally {
        await pool.end()
    }
}

// Run only as a CLI, not when imported by tests.
if (process.argv[1] && path.basename(process.argv[1]).startsWith('privatize-payment-proofs')) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    })
}
