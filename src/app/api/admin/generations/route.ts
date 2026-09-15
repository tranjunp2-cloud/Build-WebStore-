/** Safe, keyset-paginated Super Admin generation queue. Never returns raw Payload docs. */
export const dynamic = 'force-dynamic'

import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { resolveGenerationPriority, serializeAdminGeneration, type GenerationListSource, type GenerationPriority } from '@/lib/ai/generation-recovery-policy'

const Query = z.object({
    view: z.enum(['needs_attention', 'all']).default('needs_attention'),
    status: z.enum(['running', 'success', 'failed', 'all']).default('all'),
    recoveryStatus: z.enum(['none', 'eligible', 'retrying', 'exhausted', 'ticket_required', 'ticket_created', 'stale_running', 'all']).default('all'),
    search: z.string().trim().max(120).default(''), userId: z.string().trim().max(100).default(''), siteId: z.string().trim().max(100).default(''),
    dateFrom: z.string().datetime().optional(), dateTo: z.string().datetime().optional(),
    cursor: z.string().max(500).optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
})

type QueryInput = z.infer<typeof Query>
// `ai-generation-records.id` is the Payload/Postgres integer primary key. Keep
// it numeric in the cursor too: lexicographic comparisons make `"9"` sort
// after `"10"`, which can silently skip records sharing a createdAt value.
type Cursor = { v: 1; filter: string; asOf: string; bucket: number; createdAt: string; id: number }
type Bucket = { priority: GenerationPriority; where: Where }

const ATTENTION_BUCKETS: Bucket[] = [
    {
        priority: 'cannot_recover',
        where: {
            or: [
                { recoveryStatus: { equals: 'ticket_required' } },
                { and: [{ recoveryStatus: { equals: 'exhausted' } }, { outcome: { in: ['succeeded', 'cancelled'] } }] },
                { and: [{ recoveryStatus: { equals: 'exhausted' } }, { outcome: { exists: false } }] },
            ],
        },
    },
    { priority: 'retryable', where: { recoveryStatus: { equals: 'eligible' } } },
    { priority: 'retry_failed', where: { and: [{ recoveryStatus: { equals: 'exhausted' } }, { outcome: { in: ['failed', 'partial_failed'] } }] } },
    { priority: 'retrying', where: { recoveryStatus: { equals: 'retrying' } } },
    { priority: 'stale_running', where: { recoveryStatus: { equals: 'stale_running' } } },
]

function combineWhere(...parts: Array<Where | undefined>): Where {
    const present: Where[] = []
    for (const part of parts) if (part && Object.keys(part).length > 0) present.push(part)
    return present.length === 1 ? present[0] : { and: present }
}

function filterFingerprint(q: QueryInput) {
    // A cursor is valid only for the exact normalized filter set that produced it.
    // Hashing avoids reflecting operational search/user/site identifiers in the token.
    return createHash('sha256').update(JSON.stringify({
        view: q.view, status: q.status, recoveryStatus: q.recoveryStatus,
        search: q.search, userId: q.userId, siteId: q.siteId,
        dateFrom: q.dateFrom ?? null, dateTo: q.dateTo ?? null,
    })).digest('base64url')
}

function parseCursor(raw: string | undefined, fingerprint: string): Cursor | undefined {
    if (!raw) return undefined
    try {
        const token = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>
        if (token.v !== 1 || token.filter !== fingerprint || typeof token.bucket !== 'number' || !Number.isInteger(token.bucket) || token.bucket < 0 || token.bucket >= ATTENTION_BUCKETS.length || typeof token.id !== 'number' || !Number.isSafeInteger(token.id) || token.id < 1 || typeof token.createdAt !== 'string' || typeof token.asOf !== 'string' || Number.isNaN(Date.parse(token.createdAt)) || Number.isNaN(Date.parse(token.asOf))) throw new Error('invalid cursor')
        return token as Cursor
    } catch { return undefined }
}

function createCursor(cursor: Omit<Cursor, 'v'>) {
    return Buffer.from(JSON.stringify({ v: 1, ...cursor })).toString('base64url')
}

function baseWhere(q: QueryInput, asOf: string): Where {
    const clauses: Where[] = [{ createdAt: { less_than_equal: asOf } }]
    if (q.status !== 'all') clauses.push({ status: { equals: q.status } })
    if (q.recoveryStatus !== 'all') clauses.push({ recoveryStatus: { equals: q.recoveryStatus } })
    if (q.userId) clauses.push({ user: { equals: q.userId } })
    if (q.siteId) clauses.push({ site: { equals: q.siteId } })
    if (q.dateFrom || q.dateTo) clauses.push({ createdAt: { ...(q.dateFrom ? { greater_than_equal: q.dateFrom } : {}), ...(q.dateTo ? { less_than_equal: q.dateTo } : {}) } })
    if (q.search) {
        const numericId = Number(q.search)
        const searchClauses: Where[] = [{ traceId: { like: q.search } }, { endpoint: { like: q.search } }, { category: { like: q.search } }]
        if (Number.isSafeInteger(numericId) && numericId > 0 && String(numericId) === q.search) searchClauses.unshift({ id: { equals: numericId } })
        clauses.push({ or: searchClauses })
    }
    return combineWhere(...clauses)
}

function afterCursor(cursor: Cursor): Where {
    return {
        or: [
            { createdAt: { less_than: cursor.createdAt } },
            { and: [{ createdAt: { equals: cursor.createdAt } }, { id: { less_than: cursor.id } }] },
        ],
    }
}

function isAfterCursor(source: Pick<GenerationListSource, 'id' | 'createdAt'>, cursor: Cursor) {
    const createdAt = Date.parse(source.createdAt)
    const anchor = Date.parse(cursor.createdAt)
    const id = typeof source.id === 'number' ? source.id : Number(source.id)
    // A non-numeric id cannot exist for this collection in Postgres. Treat an
    // unexpected adapter/mock value as ineligible rather than weakening the
    // keyset boundary with a string comparison.
    return Number.isSafeInteger(id) && (createdAt < anchor || (createdAt === anchor && id < cursor.id))
}

async function countMatching(payload: Awaited<ReturnType<typeof getPayload>>, where: Where) {
    // `count` is a bounded DB aggregate (not an in-memory document scan). The
    // fallback keeps adapter-mocked unit tests compatible with Payload's local API.
    if (typeof payload.count !== 'function') return undefined
    const result = await payload.count({ collection: 'ai-generation-records', where })
    return result.totalDocs
}

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Bộ lọc không hợp lệ.' } }, { status: 400 })
    const q = parsed.data
    const fingerprint = filterFingerprint(q)
    const cursor = parseCursor(q.cursor, fingerprint)
    if (q.cursor && !cursor) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Cursor không hợp lệ.' } }, { status: 400 })
    const asOf = cursor?.asOf ?? new Date().toISOString()
    const filters = baseWhere(q, asOf)
    const payload = await getPayload({ config })

    if (q.view === 'all') {
        const result = await payload.find({
            collection: 'ai-generation-records', where: combineWhere(filters, cursor ? afterCursor(cursor) : undefined),
            sort: '-createdAt,-id', page: 1, limit: q.limit + 1, depth: 1,
        })
        const sources = (result.docs as unknown as GenerationListSource[])
            .filter((source) => !cursor || isAfterCursor(source, cursor))
        const pageSources = sources.slice(0, q.limit)
        const last = pageSources.at(-1)
        const nextCursor = sources.length > q.limit && last
            ? createCursor({ filter: fingerprint, asOf, bucket: 0, createdAt: last.createdAt, id: Number(last.id) })
            : null
        const totalDocs = await countMatching(payload, filters) ?? result.totalDocs
        return NextResponse.json({ items: pageSources.map(serializeAdminGeneration), nextCursor, meta: { totalDocs, limit: q.limit, hasNextPage: nextCursor !== null, hasPrevPage: Boolean(cursor) } })
    }

    // Priority is an explicit DB state, not a UI inference. Query at most five
    // indexed buckets and stop as soon as the page plus its look-ahead is full.
    const startBucket = cursor?.bucket ?? 0
    const collected: Array<{ source: GenerationListSource; bucket: number }> = []
    for (let bucket = startBucket; bucket < ATTENTION_BUCKETS.length && collected.length < q.limit + 1; bucket += 1) {
        const isCursorBucket = Boolean(cursor && bucket === cursor.bucket)
        const remaining = q.limit + 1 - collected.length
        const result = await payload.find({
            collection: 'ai-generation-records',
            where: combineWhere(filters, ATTENTION_BUCKETS[bucket].where, isCursorBucket && cursor ? afterCursor(cursor) : undefined),
            sort: '-createdAt,-id', page: 1, limit: remaining, depth: 1,
        })
        // The predicate is authoritative. This narrow guard makes a stale/mock
        // adapter response unable to move an item into the wrong priority bucket.
        for (const source of result.docs as unknown as GenerationListSource[]) {
            if (isCursorBucket && cursor && !isAfterCursor(source, cursor)) continue
            if (resolveGenerationPriority(source) === ATTENTION_BUCKETS[bucket].priority) collected.push({ source, bucket })
            if (collected.length === q.limit + 1) break
        }
    }
    const pageSources = collected.slice(0, q.limit)
    const last = pageSources.at(-1)
    const nextCursor = collected.length > q.limit && last
        ? createCursor({ filter: fingerprint, asOf, bucket: last.bucket, createdAt: last.source.createdAt, id: Number(last.source.id) })
        : null
    const totalCounts = await Promise.all(ATTENTION_BUCKETS.map((bucket) => countMatching(payload, combineWhere(filters, bucket.where))))
    const totalDocs = totalCounts.every((count): count is number => typeof count === 'number')
        ? totalCounts.reduce((sum, count) => sum + count, 0)
        : pageSources.length + (nextCursor ? 1 : 0)
    return NextResponse.json({ items: pageSources.map(({ source }) => serializeAdminGeneration(source)), nextCursor, meta: { totalDocs, limit: q.limit, hasNextPage: nextCursor !== null, hasPrevPage: Boolean(cursor) } })
})
