/**
 * GET  /api/admin/issues — paginated list with filters
 * POST /api/admin/issues — create new issue
 *
 * Super-admin only. Polymorphic relatedId validated on create.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import {
    LiveErrorProviderError,
    type LiveError,
} from '@/lib/admin/live-errors/contracts'
import { fetchProviderEvidence } from '@/lib/admin/live-errors/fetch-provider-evidence'
import {
    getRuntimeRelatedId,
} from '@/lib/admin/live-errors/provider-key'

const LIMIT = 50

const ManualIssueSchema = z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(10000).optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
    status: z.enum(['backlog', 'reopen', 'in_progress', 'dev_fixed', 'testing', 'done']).default('backlog'),
    assignmentTarget: z.enum(['unassigned', 'dev']).default('unassigned'),
    reportedBy: z.union([z.string(), z.number()]).optional(),
}).strict()

const LinkedIssueSchema = ManualIssueSchema.extend({
    relatedType: z.enum(['template', 'generation', 'block']),
    relatedId: z.string().min(1),
})

const RuntimeIssueSchema = z.object({
    relatedType: z.literal('runtime'),
    // Vercel Runtime Logs is a transient stream and cannot yet re-identify a
    // selected row. Keep promotion fail-closed until the live spike proves a
    // server-authoritative refetch contract.
    source: z.literal('sentry'),
    providerId: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/),
    title: z.string().trim().min(1).max(300).optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
})

// The discriminator must be considered before the manual shape. Zod strips
// unknown object keys by default, so putting ManualIssueSchema first would
// silently turn a linked generation ticket into an unrelated manual ticket.
const CreateIssueSchema = z.union([RuntimeIssueSchema, LinkedIssueSchema, ManualIssueSchema])

function formatRuntimeDescription(error: LiveError, related: LiveError | null): string {
    const evidence = [
        `Source: ${error.source}`,
        `Occurred: ${error.occurredAt}`,
        `Tenant: ${error.tenantMatch?.name ?? error.tenantMatch?.slug ?? 'Unknown'}`,
        `Host: ${error.host ?? 'Unknown'}`,
        `Route: ${[error.method, error.route].filter(Boolean).join(' ') || 'Unknown'}`,
        `Status: ${error.statusCode ?? 'Unknown'}`,
        `Release: ${error.release ?? 'Unknown'}`,
        `Deployment: ${error.deploymentId ?? 'Unknown'}`,
        `Request ID: ${error.requestId ?? 'Unknown'}`,
        `Trace ID: ${error.traceId ?? 'Unknown'}`,
    ]
    const guidance = [
        `Investigation area: ${error.guidance.investigationArea}`,
        ...error.guidance.checks.map((check, index) => `Check ${index + 1}: ${check}`),
        `Escalation condition: ${error.guidance.escalationCondition}`,
    ]
    const relatedEvidence = related
        ? [
            '',
            `Related ${related.source} evidence:`,
            `Message: ${related.message}`,
            `Occurred: ${related.occurredAt}`,
            `Provider: ${related.providerUrl ?? 'Unavailable'}`,
        ]
        : []

    return [
        error.message,
        '',
        'Runtime evidence:',
        ...evidence,
        '',
        error.guidance.label + ':',
        ...guidance,
        ...(error.providerUrl ? ['', `Provider: ${error.providerUrl}`] : []),
        ...relatedEvidence,
    ].join('\n').slice(0, 10000)
}

function isUniqueViolation(error: unknown): boolean {
    let current = error
    for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
        const record = current as Record<string, unknown>
        if (record.code === '23505') return true
        current = record.cause
    }
    return false
}

async function findRuntimeIssue(
    payload: Awaited<ReturnType<typeof getPayload>>,
    relatedId: string,
) {
    const result = await payload.find({
        collection: 'template-issues',
        where: {
            and: [
                { relatedType: { equals: 'runtime' } },
                { relatedId: { equals: relatedId } },
            ],
        },
        limit: 1,
        depth: 1,
    })
    return result.docs[0] ?? null
}

async function validateRelatedId(
    payload: Awaited<ReturnType<typeof getPayload>>,
    relatedType: string,
    relatedId: string,
): Promise<boolean> {
    try {
        if (relatedType === 'template') {
            const res = await payload.find({ collection: 'templates', where: { id: { equals: relatedId } }, limit: 1 })
            return res.totalDocs > 0
        }
        if (relatedType === 'generation') {
            const res = await payload.find({ collection: 'ai-generation-records', where: { id: { equals: relatedId } }, limit: 1 })
            return res.totalDocs > 0
        }
        if (relatedType === 'block') {
            const res = await payload.find({ collection: 'block-catalog-entries', where: { slug: { equals: relatedId } }, limit: 1 })
            return res.totalDocs > 0
        }
        return false
    } catch {
        // Soft-validate: don't block if collection lookup fails
        return true
    }
}

export const GET = withSuperAdmin(async (req) => {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const assignee = searchParams.get('assignee')
    const relatedType = searchParams.get('relatedType')
    const relatedId = searchParams.get('relatedId')
    const search = searchParams.get('search')

    // Build where clause using Payload's Where type
    const where: Where = {}
    if (severity) where.severity = { equals: severity }
    if (status) where.status = { equals: status }
    if (category) where.category = { equals: category }
    if (assignee === 'dev' || assignee === 'unassigned') where.assignmentTarget = { equals: assignee }
    if (relatedType) where.relatedType = { equals: relatedType }
    if (relatedId) where.relatedId = { equals: relatedId }
    if (search) where.title = { contains: search }

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'template-issues',
        where,
        page,
        limit: LIMIT,
        sort: '-createdAt',
        depth: 1,
    })

    return NextResponse.json({ data: result.docs, meta: { total: result.totalDocs, page, limit: LIMIT, pages: result.totalPages } })
})

export const POST = withSuperAdmin(async (req) => {
    const body = await req.json().catch(() => null)
    const parsed = CreateIssueSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })

    if ('relatedType' in parsed.data && parsed.data.relatedType === 'runtime') {
        let primaryResult
        try {
            primaryResult = await fetchProviderEvidence(
                parsed.data.source,
                parsed.data.providerId,
            )
        } catch (error) {
            if (!(error instanceof LiveErrorProviderError)) throw error
            return NextResponse.json(
                {
                    error: 'Provider unavailable',
                    source: error.source,
                    code: error.code,
                },
                { status: error.status },
            )
        }
        const primary = primaryResult.data as LiveError
        const runtimeRelatedId = getRuntimeRelatedId(primary)
        const existing = await findRuntimeIssue(payload, runtimeRelatedId)
        if (existing) {
            return NextResponse.json({ data: existing, created: false })
        }

        try {
            const doc = await payload.create({
                collection: 'template-issues',
                data: {
                    title: parsed.data.title ?? `${primary.source}: ${primary.message}`.slice(0, 300),
                    description: formatRuntimeDescription(primary, null),
                    severity: parsed.data.severity ?? primary.severity,
                    category: 'other',
                    status: 'backlog',
                    relatedType: 'runtime',
                    relatedId: runtimeRelatedId,
                },
            })
            return NextResponse.json({ data: doc, created: true }, { status: 201 })
        } catch (error) {
            if (!isUniqueViolation(error)) throw error
            const concurrent = await findRuntimeIssue(payload, runtimeRelatedId)
            if (!concurrent) throw error
            return NextResponse.json({ data: concurrent, created: false })
        }
    }

    if ('relatedType' in parsed.data) {
        const valid = await validateRelatedId(payload, parsed.data.relatedType, parsed.data.relatedId)
        if (!valid) {
            return NextResponse.json(
                { error: `relatedId "${parsed.data.relatedId}" not found for type "${parsed.data.relatedType}"` },
                { status: 422 },
            )
        }
        const linkedDoc = await payload.create({
            collection: 'template-issues',
            data: {
                title: parsed.data.title,
                description: parsed.data.description,
                severity: parsed.data.severity,
                category: 'other',
                status: parsed.data.status,
                relatedType: parsed.data.relatedType,
                relatedId: parsed.data.relatedId,
                assignmentTarget: parsed.data.assignmentTarget,
                ...(parsed.data.reportedBy ? { reportedBy: parsed.data.reportedBy } : {}),
            },
        })
        return NextResponse.json({ data: linkedDoc }, { status: 201 })
    }

    const manual = parsed.data
    const doc = await payload.create({
        collection: 'template-issues',
        data: {
            title: manual.title,
            description: manual.description,
            severity: manual.severity,
            category: 'other',
            status: manual.status,
            // A manually reported bug may not yet be tied to a specific
            // template/generation. Keep a stable internal relation so the
            // collection's audit and filtering contracts remain intact.
            relatedType: 'manual',
            relatedId: `manual-${crypto.randomUUID()}`,
            assignmentTarget: manual.assignmentTarget,
            ...(manual.reportedBy ? { reportedBy: manual.reportedBy } : {}),
        },
    })

    return NextResponse.json({ data: doc }, { status: 201 })
})
