/**
 * One-shot backfill: register existing tenant.customDomains entries with the
 * configured Vercel project and persist `vercelDomainId` + verification state.
 *
 * Designed for the F19 cutover from DigitalOcean DNS → Vercel Domains API.
 *
 * SAFETY:
 *   - Idempotent: rows with `vercelDomainId` already set are skipped.
 *   - Selective array update: only the matching customDomains element is mutated;
 *     other entries on the same tenant row are preserved verbatim (scenario 9.7).
 *   - Cursor-paginated: tenants are streamed page-by-page, never all at once
 *     (scenario 7.7 — avoids OOM on large workspaces).
 *   - Rate-limited: default 40s sleep between Vercel API calls keeps us under the
 *     100/hr per-team add quota (scenario R6/3.7).
 *   - Resume-safe: SIGINT writes the partial summary report and exits non-fatal.
 *
 * Usage:
 *   pnpm tsx --require ./scripts/seed-preload.cjs scripts/backfill-vercel-domains.ts [flags]
 *
 * Flags:
 *   --dry-run                 Log what would happen, perform no Payload writes and
 *                             no Vercel mutations (still does NOT call addProjectDomain).
 *   --tenant-id <id>          Process a single tenant only (debug mode).
 *   --concurrency <n>         Always 1 — flag exists for forward compat; values >1
 *                             are rejected to keep us under the rate limit.
 *   --delay-ms <ms>           Sleep duration between Vercel API calls. Default 40000.
 *
 * Exit codes:
 *   0  All domains succeeded or were skipped.
 *   1  At least one fatal error (e.g. missing env, payload bootstrap failure).
 *   130 Interrupted by SIGINT (partial report written).
 */

import { getPayload, type Payload, type Where } from 'payload'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import config from '../src/payload.config'
import {
    addProjectDomain,
    assertVercelEnv,
    getProjectDomain,
} from '../src/lib/vercel/domains'
import {
    VercelDomainsError,
    type VercelDomain,
    type VercelDomainVerification,
} from '../src/lib/vercel/domains.types'

// ─── Types ──────────────────────────────────────────────────────────────────

type DomainStatus = 'pending' | 'active'

interface CustomDomainRow {
    id?: string
    domain: string
    status?: DomainStatus | null
    isPrimary?: boolean | null
    vercelDomainId?: string | null
    vercelVerification?: VercelDomainVerification[] | null
}

interface TenantRow {
    id: string | number
    customDomains?: CustomDomainRow[] | null
}

type DomainResult =
    | 'active'
    | 'pending'
    | 'skipped-already-linked'
    | 'skipped-dry-run'
    | 'error'

interface DomainLogEntry {
    tenantId: string | number
    domain: string
    result: DomainResult
    note?: string
}

interface BackfillSummary {
    startedAt: string
    finishedAt: string | null
    flags: ParsedFlags
    counts: Record<DomainResult, number>
    totalDomains: number
    totalTenants: number
    errors: { tenantId: string | number; domain: string; message: string; code?: string }[]
    log: DomainLogEntry[]
}

interface ParsedFlags {
    dryRun: boolean
    tenantId: string | null
    concurrency: number
    delayMs: number
}

// ─── CLI parsing ────────────────────────────────────────────────────────────

function parseFlags(argv: string[]): ParsedFlags {
    const flags: ParsedFlags = {
        dryRun: false,
        tenantId: null,
        concurrency: 1,
        delayMs: 40000,
    }

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        switch (arg) {
            case '--dry-run':
                flags.dryRun = true
                break
            case '--tenant-id': {
                const next = argv[++i]
                if (!next) throw new Error('--tenant-id requires a value')
                flags.tenantId = next
                break
            }
            case '--concurrency': {
                const next = argv[++i]
                if (!next) throw new Error('--concurrency requires a value')
                const n = Number(next)
                if (!Number.isInteger(n) || n < 1) {
                    throw new Error(`--concurrency must be a positive integer, got "${next}"`)
                }
                if (n !== 1) {
                    throw new Error(
                        `--concurrency must be 1 (Vercel rate limit 100/hr per team forbids parallelism)`,
                    )
                }
                flags.concurrency = n
                break
            }
            case '--delay-ms': {
                const next = argv[++i]
                if (!next) throw new Error('--delay-ms requires a value')
                const n = Number(next)
                if (!Number.isFinite(n) || n < 0) {
                    throw new Error(`--delay-ms must be a non-negative number, got "${next}"`)
                }
                flags.delayMs = n
                break
            }
            case '-h':
            case '--help':
                printHelp()
                process.exit(0)
                break
            default:
                throw new Error(`Unknown flag: ${arg}`)
        }
    }

    return flags
}

function printHelp(): void {
    // eslint-disable-next-line no-console
    console.log(`Usage: pnpm tsx --require ./scripts/seed-preload.cjs scripts/backfill-vercel-domains.ts [flags]

Flags:
  --dry-run              No writes, no Vercel mutations
  --tenant-id <id>       Single tenant only (debug)
  --concurrency <n>      Must be 1 (rate limit). Default 1.
  --delay-ms <ms>        Sleep between Vercel calls. Default 40000.
  -h, --help             Show this message`)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const REPORT_PATH = resolve(process.cwd(), 'tmp', 'backfill-report.json')

function sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms))
}

function emptyCounts(): Record<DomainResult, number> {
    return {
        active: 0,
        pending: 0,
        'skipped-already-linked': 0,
        'skipped-dry-run': 0,
        error: 0,
    }
}

function log(entry: DomainLogEntry): void {
    const note = entry.note ? ` note="${entry.note}"` : ''
    // eslint-disable-next-line no-console
    console.log(
        `[backfill] tenant=${entry.tenantId} domain=${entry.domain} result=${entry.result}${note}`,
    )
}

async function writeReport(summary: BackfillSummary): Promise<void> {
    try {
        await mkdir(dirname(REPORT_PATH), { recursive: true })
        await writeFile(REPORT_PATH, JSON.stringify(summary, null, 2), 'utf8')
        // eslint-disable-next-line no-console
        console.log(`[backfill] report written → ${REPORT_PATH}`)
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
            `[backfill] failed to write report at ${REPORT_PATH}: ${(err as Error).message}`,
        )
    }
}

/**
 * Map a Vercel domain response to (status, verification) — the canonical Payload
 * shape. `verified === true && verification empty` ⇒ active. Anything else ⇒ pending.
 */
function deriveStatus(v: VercelDomain): {
    status: DomainStatus
    verification: VercelDomainVerification[] | null
} {
    const challenges = v.verification ?? []
    if (v.verified === true && challenges.length === 0) {
        return { status: 'active', verification: null }
    }
    return { status: 'pending', verification: challenges.length > 0 ? challenges : null }
}

// ─── Selective array update (scenario 9.7) ──────────────────────────────────

/**
 * Build an updated `customDomains` array where ONLY the entry whose `domain`
 * matches `targetDomain` is mutated. All other rows are returned verbatim,
 * including their existing `id` (Payload preserves array element identity by id).
 */
function applyDomainPatch(
    rows: CustomDomainRow[],
    targetDomain: string,
    patch: Partial<CustomDomainRow>,
): CustomDomainRow[] {
    return rows.map((row) => {
        if (row.domain !== targetDomain) return row
        return { ...row, ...patch }
    })
}

// ─── Process one domain ─────────────────────────────────────────────────────

async function processDomain(
    payload: Payload,
    tenant: TenantRow,
    domainRow: CustomDomainRow,
    flags: ParsedFlags,
    summary: BackfillSummary,
): Promise<void> {
    const tenantId = tenant.id
    const domain = domainRow.domain

    // Idempotent skip — already linked.
    if (domainRow.vercelDomainId) {
        const entry: DomainLogEntry = {
            tenantId,
            domain,
            result: 'skipped-already-linked',
            note: `vercelDomainId=${domainRow.vercelDomainId}`,
        }
        summary.log.push(entry)
        summary.counts['skipped-already-linked']++
        log(entry)
        return
    }

    if (flags.dryRun) {
        const entry: DomainLogEntry = {
            tenantId,
            domain,
            result: 'skipped-dry-run',
            note: 'would call addProjectDomain',
        }
        summary.log.push(entry)
        summary.counts['skipped-dry-run']++
        log(entry)
        return
    }

    // Real run: call Vercel.
    let vercelDomain: VercelDomain | null = null
    try {
        vercelDomain = await addProjectDomain(domain)
    } catch (err) {
        if (err instanceof VercelDomainsError && err.code === 'domain_already_in_use') {
            // 409 — domain already on this project (or another project in team).
            // Try to GET the current state and recover the binding for THIS project.
            try {
                vercelDomain = await getProjectDomain(domain)
            } catch (getErr) {
                const message = (getErr as Error).message ?? 'unknown'
                const code =
                    getErr instanceof VercelDomainsError ? getErr.code : 'get_failed'
                summary.errors.push({ tenantId, domain, message, code })
                summary.counts.error++
                const entry: DomainLogEntry = {
                    tenantId,
                    domain,
                    result: 'error',
                    note: `409 then GET failed: ${code} ${message}`,
                }
                summary.log.push(entry)
                log(entry)
                return
            }
        } else if (err instanceof VercelDomainsError && err.status === 429) {
            // Rate limited — surface and abort this domain. Operator can resume
            // (idempotent) after waiting `retryAfter` seconds.
            const retry = err.retryAfter ?? Math.ceil(flags.delayMs / 1000)
            summary.errors.push({
                tenantId,
                domain,
                message: `rate limited; retry-after=${retry}s — ${err.message}`,
                code: err.code,
            })
            summary.counts.error++
            const entry: DomainLogEntry = {
                tenantId,
                domain,
                result: 'error',
                note: `429 retryAfter=${retry}s`,
            }
            summary.log.push(entry)
            log(entry)
            return
        } else {
            const message = (err as Error).message ?? 'unknown'
            const code = err instanceof VercelDomainsError ? err.code : 'unknown'
            summary.errors.push({ tenantId, domain, message, code })
            summary.counts.error++
            const entry: DomainLogEntry = {
                tenantId,
                domain,
                result: 'error',
                note: `addProjectDomain failed: ${code} ${message}`,
            }
            summary.log.push(entry)
            log(entry)
            return
        }
    }

    if (!vercelDomain) {
        // Defensive — shouldn't happen, but keep the type system honest.
        const entry: DomainLogEntry = {
            tenantId,
            domain,
            result: 'error',
            note: 'no vercelDomain returned',
        }
        summary.errors.push({ tenantId, domain, message: 'no vercelDomain returned' })
        summary.counts.error++
        summary.log.push(entry)
        log(entry)
        return
    }

    const { status, verification } = deriveStatus(vercelDomain)

    // Re-read the tenant before writing so we don't clobber any concurrent
    // user-driven edit to ANOTHER customDomains row (scenario 9.7).
    const fresh = (await payload.findByID({
        collection: 'tenants',
        id: tenantId as string,
        depth: 0,
    })) as unknown as TenantRow
    const currentRows = (fresh.customDomains ?? []) as CustomDomainRow[]
    const updatedRows = applyDomainPatch(currentRows, domain, {
        vercelDomainId: vercelDomain.name,
        status,
        vercelVerification: verification,
    })

    await payload.update({
        collection: 'tenants',
        id: tenantId as string,
        data: { customDomains: updatedRows } as unknown as Record<string, unknown>,
    })

    const result: DomainResult = status === 'active' ? 'active' : 'pending'
    const entry: DomainLogEntry = {
        tenantId,
        domain,
        result,
        note:
            status === 'pending'
                ? `${verification?.length ?? 0} verification challenge(s)`
                : 'verified',
    }
    summary.log.push(entry)
    summary.counts[result]++
    log(entry)
}

// ─── Main loop ──────────────────────────────────────────────────────────────

async function run(): Promise<void> {
    const flags = parseFlags(process.argv.slice(2))

    const summary: BackfillSummary = {
        startedAt: new Date().toISOString(),
        finishedAt: null,
        flags,
        counts: emptyCounts(),
        totalDomains: 0,
        totalTenants: 0,
        errors: [],
        log: [],
    }

    // Wire SIGINT BEFORE any heavy work so partial state always lands on disk.
    let interrupted = false
    const onSigint = async (): Promise<void> => {
        if (interrupted) return
        interrupted = true
        // eslint-disable-next-line no-console
        console.log('\n[backfill] SIGINT received — writing partial report and exiting…')
        summary.finishedAt = new Date().toISOString()
        await writeReport(summary)
        process.exit(130)
    }
    process.on('SIGINT', () => {
        void onSigint()
    })

    // Fail-fast on missing env BEFORE bootstrapping Payload — a dry run with
    // no credentials should still error clearly (per task verification step 2).
    if (!flags.dryRun) {
        try {
            assertVercelEnv()
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
                `[backfill] FATAL: ${(err as Error).message}\n` +
                    `[backfill] Set VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID in .env.local or run with --dry-run.`,
            )
            process.exit(1)
        }
    } else {
        // In dry-run mode we still validate envs and warn loudly if they're
        // missing — the operator should know the real run will fail until they
        // fix them. We do NOT exit, so the operator can preview the work plan.
        try {
            assertVercelEnv()
            // eslint-disable-next-line no-console
            console.log('[backfill] dry-run: Vercel env vars present')
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(
                `[backfill] dry-run WARNING: ${(err as Error).message}\n` +
                    `[backfill]   The real run will fail until this is fixed.`,
            )
        }
    }

    // eslint-disable-next-line no-console
    console.log(
        `[backfill] starting${flags.dryRun ? ' (DRY RUN)' : ''} ` +
            `tenantId=${flags.tenantId ?? 'all'} delayMs=${flags.delayMs}`,
    )

    let payload: Payload
    try {
        payload = await getPayload({ config })
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[backfill] FATAL: failed to bootstrap Payload — ${(err as Error).message}`)
        process.exit(1)
    }

    // ─── Cursor pagination over tenants ─────────────────────────────────────
    const baseWhere: Where = flags.tenantId
        ? { id: { equals: flags.tenantId } }
        : {
              // Tenants whose customDomains array has at least one entry.
              // Payload supports `<arrayField>.<subfield>` `exists` predicates.
              'customDomains.domain': { exists: true },
          }

    const PAGE_SIZE = 50
    let page = 1
    let hasNextPage = true

    while (hasNextPage && !interrupted) {
        const result = await payload.find({
            collection: 'tenants',
            where: baseWhere,
            limit: PAGE_SIZE,
            page,
            depth: 0,
            // Sort for deterministic resume.
            sort: 'id',
        })

        const docs = result.docs as unknown as TenantRow[]

        // eslint-disable-next-line no-console
        console.log(
            `[backfill] page=${page} tenants=${docs.length} totalPages=${result.totalPages}`,
        )

        for (const tenant of docs) {
            if (interrupted) break

            const rows = (tenant.customDomains ?? []) as CustomDomainRow[]
            if (rows.length === 0) continue

            summary.totalTenants++

            for (const row of rows) {
                if (interrupted) break
                if (!row.domain) continue

                summary.totalDomains++

                const wasMutating = !row.vercelDomainId && !flags.dryRun

                await processDomain(payload, tenant, row, flags, summary)

                // Sleep ONLY when we actually called the Vercel API. Skips
                // (already-linked, dry-run) don't burn quota, so don't wait.
                if (wasMutating && flags.delayMs > 0) {
                    await sleep(flags.delayMs)
                }
            }
        }

        hasNextPage = result.hasNextPage === true
        page++
    }

    summary.finishedAt = new Date().toISOString()

    // eslint-disable-next-line no-console
    console.log(
        `[backfill] done — tenants=${summary.totalTenants} domains=${summary.totalDomains} ` +
            `active=${summary.counts.active} pending=${summary.counts.pending} ` +
            `skipped=${summary.counts['skipped-already-linked'] + summary.counts['skipped-dry-run']} ` +
            `errors=${summary.counts.error}`,
    )

    await writeReport(summary)

    process.exit(summary.counts.error > 0 ? 1 : 0)
}

run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[backfill] FATAL unhandled error:', err)
    process.exit(1)
})
