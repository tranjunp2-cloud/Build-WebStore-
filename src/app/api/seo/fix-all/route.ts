export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'
import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { describeAiTaskFailure } from '@/lib/ai-platform/ai-tasks'
import { isAiTasksEnabled } from '@/lib/ai-platform/config'
import { type AgentActor, resolveActorForUser } from '@/lib/ai-platform/context'
import type { PlatformUser } from '@/types/user'
import {
    evaluateAuthoritativeLocalSeo,
    type LocalSeoPayload,
} from '@/lib/seo/local-seo-evaluation'

const MAX_AI_FIX_BATCH = 100
const AI_FIX_CONCURRENCY = 4
const REVISION_TOKEN_PATTERN = /^[a-f0-9]{64}$/

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantId(value: TenantRef): string | null {
    if (value == null) return null
    return String(typeof value === 'object' ? value.id : value)
}

function activeTenantIds(user: unknown): Set<string> {
    const memberships =
        (
            user as {
                tenants?: Array<{ tenant?: TenantRef; status?: string }>
            }
        ).tenants ?? []

    return new Set(
        memberships.flatMap((membership) => {
            const id = tenantId(membership.tenant)
            return membership.status === 'active' && id ? [id] : []
        }),
    )
}

async function mapWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    signal: AbortSignal,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    let nextIndex = 0
    const run = async () => {
        while (nextIndex < items.length && !signal.aborted) {
            const item = items[nextIndex]
            nextIndex += 1
            await worker(item)
        }
    }
    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, run),
    )
}

const fixAllSchema = z
    .object({
        siteId: z.string().min(1),
        revisionToken: z.string().regex(REVISION_TOKEN_PATTERN),
        missingSeo: z
            .array(
                z
                    .object({
                        collection: z.enum(['pages', 'products', 'blogs']),
                        id: z.union([z.string(), z.number()]),
                        title: z.string().min(1).max(300),
                        context: z.string().max(500).optional(),
                        missingFields: z
                            .array(z.enum(['title', 'description']))
                            .min(1)
                            .max(2),
                    })
                    .strict(),
            )
            .max(MAX_AI_FIX_BATCH),
    })
    .strict()
    .superRefine(({ missingSeo }, context) => {
        const keys = new Set<string>()
        missingSeo.forEach((item, index) => {
            const key = item.collection + ':' + String(item.id)
            if (keys.has(key)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['missingSeo', index, 'id'],
                    message: 'Duplicate SEO proposal target',
                })
            }
            keys.add(key)
        })
    })

/**
 * POST /api/seo/fix-all
 * Proposes fixes for a revision-bound batch of missing SEO metadata.
 */
export const POST = withFeatureGuard('content_management')(
    withAuth(async (_user, request) => {
        try {
            const { data, errorResponse } = await parseRequest(
                request,
                fixAllSchema,
            )
            if (errorResponse) return errorResponse

            const { siteId, revisionToken, missingSeo } = data!
            const isSuperAdmin = _user.roles?.includes('super-admin') === true
            const userTenantIds = activeTenantIds(_user)

            // Inactive memberships are denied before any protected Local API read.
            if (!isSuperAdmin && userTenantIds.size === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Forbidden' },
                    },
                    { status: 403 },
                )
            }

            const payload = await getPayload({ config })
            const site = await payload.findByID({
                collection: 'sites',
                id: siteId,
                disableErrors: true,
                depth: 0,
            })
            if (!site) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'SITE_NOT_FOUND',
                            message: 'Site not found',
                        },
                    },
                    { status: 404 },
                )
            }

            const siteTenantId = tenantId(site.tenant as TenantRef)
            if (
                !siteTenantId ||
                (!isSuperAdmin && !userTenantIds.has(siteTenantId))
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Forbidden' },
                    },
                    { status: 403 },
                )
            }

            const rateLimit = await checkTwoTierRateLimit(
                `seo-fix-all:${String(_user.id)}:${String(site.id)}`,
                2,
                10,
            )
            if (!rateLimit.allowed) {
                const retryAfter = Math.max(
                    0,
                    Math.ceil((rateLimit.resetAt - Date.now()) / 1_000),
                )
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'RATE_LIMITED',
                            message: 'Too many AI Fix requests. Try again later.',
                        },
                        retryAfter,
                    },
                    {
                        status: 429,
                        headers: { 'Retry-After': String(retryAfter) },
                    },
                )
            }

            const evaluation = await evaluateAuthoritativeLocalSeo(
                payload as unknown as LocalSeoPayload,
                String(site.id),
                siteTenantId,
            )
            if (evaluation.response.revisionToken !== revisionToken) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'STALE_REVISION',
                            message:
                                'SEO data changed. Refresh before generating fixes.',
                        },
                    },
                    { status: 409 },
                )
            }

            const authoritativeItems = new Map(
                evaluation.metadataItems.map((item) => [
                    `${item.collection}:${item.id}`,
                    item,
                ]),
            )
            const requestedItems = missingSeo.map((item) => {
                const authoritative = authoritativeItems.get(
                    `${item.collection}:${String(item.id)}`,
                )
                const fieldsAreCurrent =
                    authoritative &&
                    item.missingFields.every((field) =>
                        authoritative.missingFields.includes(field),
                    )
                if (!authoritative || !fieldsAreCurrent) return null
                return {
                    ...authoritative,
                    missingFields: item.missingFields,
                }
            })
            if (requestedItems.some((item) => item === null)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'STALE_REVISION',
                            message:
                                'SEO data changed. Refresh before generating fixes.',
                        },
                    },
                    { status: 409 },
                )
            }

            // Platform task engine runs as the signed-in member of the active workspace.
            let actor: AgentActor | undefined
            if (isAiTasksEnabled()) {
                try {
                    actor = await resolveActorForUser(_user as unknown as PlatformUser, request, { tenantId: siteTenantId })
                } catch (error) {
                    const failure = describeAiTaskFailure(error)
                    return NextResponse.json(
                        { success: false, error: { code: 'AI_ERROR', message: failure.message } },
                        { status: failure.status },
                    )
                }
            }

            const siteName = site.name || 'Website'
            const trackedKeywords =
                (
                    site.seo as
                        | {
                              trackedKeywords?: Array<{ keyword: string }>
                          }
                        | null
                        | undefined
                )?.trackedKeywords
                    ?.map((keyword) => keyword.keyword)
                    .filter(Boolean) || []

            const encoder = new TextEncoder()
            const FIX_ALL_TIMEOUT_MS = 15_000
            const generationController = new AbortController()
            const requestSignal = request.signal
            let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
            let timeout: ReturnType<typeof setTimeout> | undefined
            let stopped = false

            const cleanup = () => {
                if (stopped) return
                stopped = true
                if (timeout) clearTimeout(timeout)
                requestSignal?.removeEventListener('abort', cleanup)
                generationController.abort()
                try {
                    streamController?.close()
                } catch {
                    // A cancelled reader may have already closed the stream.
                }
            }
            const enqueue = (value: string) => {
                if (stopped) return
                try {
                    streamController?.enqueue(encoder.encode(value))
                } catch {
                    cleanup()
                }
            }
            requestSignal?.addEventListener('abort', cleanup, { once: true })

            const stream = new ReadableStream({
                async start(controller) {
                    streamController = controller
                    if (stopped) {
                        controller.close()
                        return
                    }
                    if (requestSignal?.aborted) {
                        cleanup()
                        return
                    }
                    enqueue('retry: 3000\n\n')

                    timeout = setTimeout(() => {
                        enqueue(
                            `data: ${JSON.stringify({
                                error: 'timeout',
                                message: 'AI Fix timed out after 15s',
                            })}\n\n`,
                        )
                        cleanup()
                    }, FIX_ALL_TIMEOUT_MS)

                    await mapWithConcurrency(
                        requestedItems,
                        AI_FIX_CONCURRENCY,
                        generationController.signal,
                        async (item) => {
                            if (generationController.signal.aborted || !item) return
                            try {
                                const { title, description } =
                                    await generateAutoSEOMeta(
                                        item.collection === 'products'
                                            ? 'product'
                                            : 'page',
                                        item.title,
                                        siteName,
                                        item.context,
                                        trackedKeywords,
                                        generationController.signal,
                                        actor,
                                    )

                                if (generationController.signal.aborted) return

                                const result = {
                                    id: item.id,
                                    targetId: item.id,
                                    collection: item.collection,
                                    name: item.title,
                                    proposedTitle: item.missingFields.includes(
                                        'title',
                                    )
                                        ? title
                                        : undefined,
                                    proposedDescription:
                                        item.missingFields.includes(
                                            'description',
                                        )
                                            ? description
                                            : undefined,
                                    currentTitle: item.currentTitle,
                                    currentDescription: item.currentDescription,
                                }

                                enqueue(
                                    `data: ${JSON.stringify(result)}\n\n`,
                                )
                            } catch (error: unknown) {
                                if (generationController.signal.aborted) return
                                console.error(
                                    '[AI Fix All Partial Error]',
                                    error instanceof Error
                                        ? error.name
                                        : 'UnknownError',
                                )
                            }
                        },
                    )
                    cleanup()
                },
                cancel() {
                    cleanup()
                },
            })

            return new NextResponse(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive',
                },
            })
        } catch (error: unknown) {
            console.error(
                '[AI Fix All Error]',
                error instanceof Error ? error.name : 'UnknownError',
            )
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'AI_ERROR',
                        message: 'Failed to initialize AI stream',
                    },
                },
                { status: 500 },
            )
        }
    }),
)
