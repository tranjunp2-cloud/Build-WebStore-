export const maxDuration = 60

import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import {
    evaluateAuthoritativeLocalSeo,
    type LocalSeoPayload,
} from '@/lib/seo/local-seo-evaluation'

const MAX_APPLY_BATCH = 100
const APPLY_CONCURRENCY = 4
const REVISION_TOKEN_PATTERN = /^[a-f0-9]{64}$/
const UNDO_TTL_MS = 5 * 60 * 1_000
const UNDO_TOKEN_PATTERN = /^\d{13}\.[a-f0-9]{64}$/
type SeoField = 'title' | 'description'

type TenantRef = string | number | { id: string | number } | null | undefined
type RelationRef = TenantRef

interface PreparedFix {
    targetId: string
    collection: 'pages' | 'products' | 'blogs'
    expectedUpdatedAt: string
    seoUpdate: Record<string, unknown>
    requestedSeo: { title?: string; description?: string }
    undo: {
        targetId: string
        collection: 'pages' | 'products' | 'blogs'
        seo: { title: string; description: string }
    }
}

interface UndoFix {
    targetId: string
    collection: 'pages' | 'products' | 'blogs'
    seo: { title?: string; description?: string }
}

class FixAuthorizationError extends Error {}
class FixNotFoundError extends Error {}
class FixStaleRevisionError extends Error {}

function relationId(value: RelationRef): string | null {
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
            const id = relationId(membership.tenant)
            return membership.status === 'active' && id ? [id] : []
        }),
    )
}

function textValue(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function canonicalUndoPayload(
    siteId: string,
    revisionToken: string,
    expiresAt: number,
    fixes: readonly UndoFix[],
): string {
    return JSON.stringify({
        siteId,
        revisionToken,
        expiresAt,
        fixes: fixes.map((fix) => ({
            targetId: fix.targetId,
            collection: fix.collection,
            seo: {
                ...(fix.seo.title !== undefined && {
                    title: fix.seo.title,
                }),
                ...(fix.seo.description !== undefined && {
                    description: fix.seo.description,
                }),
            },
        })),
    })
}

function undoSignature(
    siteId: string,
    revisionToken: string,
    expiresAt: number,
    fixes: readonly UndoFix[],
): string {
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) throw new Error('PAYLOAD_SECRET is required for SEO undo')
    return createHmac('sha256', secret)
        .update(canonicalUndoPayload(siteId, revisionToken, expiresAt, fixes))
        .digest('hex')
}

function createUndoToken(
    siteId: string,
    revisionToken: string,
    fixes: readonly UndoFix[],
): string {
    const expiresAt = Date.now() + UNDO_TTL_MS
    return `${expiresAt}.${undoSignature(siteId, revisionToken, expiresAt, fixes)}`
}

function verifyUndoToken(
    token: string,
    siteId: string,
    revisionToken: string,
    fixes: readonly UndoFix[],
): boolean {
    const [expiresAtText, signature] = token.split('.')
    const expiresAt = Number(expiresAtText)
    if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false
    const expected = undoSignature(siteId, revisionToken, expiresAt, fixes)
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
}

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    let nextIndex = 0
    const results = new Array<R>(items.length)
    const run = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex
            nextIndex += 1
            results[index] = await worker(items[index], index)
        }
    }
    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, run),
    )
    return results
}

const applySeoUpdateSchema = z
    .object({
        title: z.string().trim().min(1).max(500).optional(),
        description: z.string().trim().min(1).max(2_000).optional(),
    })
    .strict()
    .refine(
        (seo) => seo.title !== undefined || seo.description !== undefined,
        'At least one SEO metadata field is required',
    )

const undoSeoUpdateSchema = z
    .object({
        title: z.string().max(500).optional(),
        description: z.string().max(2_000).optional(),
    })
    .strict()
    .refine(
        (seo) => seo.title !== undefined || seo.description !== undefined,
        'At least one SEO metadata field is required',
    )

const fixSchema = (
    seo: typeof applySeoUpdateSchema | typeof undoSeoUpdateSchema,
) =>
    z
        .object({
            targetId: z.string().min(1),
            collection: z.enum(['pages', 'products', 'blogs']),
            seo,
        })
        .strict()

const baseOperation = {
    siteId: z.string().min(1),
    revisionToken: z.string().regex(REVISION_TOKEN_PATTERN),
}

const applyFixesSchema = z
    .discriminatedUnion('operation', [
        z
            .object({
                operation: z.literal('apply'),
                ...baseOperation,
                fixes: z
                    .array(fixSchema(applySeoUpdateSchema))
                    .min(1)
                    .max(MAX_APPLY_BATCH),
            })
            .strict(),
        z
            .object({
                operation: z.literal('undo'),
                ...baseOperation,
                undoToken: z.string().regex(UNDO_TOKEN_PATTERN),
                fixes: z
                    .array(fixSchema(undoSeoUpdateSchema))
                    .min(1)
                    .max(MAX_APPLY_BATCH),
            })
            .strict(),
    ])
    .superRefine(({ fixes }, context) => {
        const keys = new Set<string>()
        fixes.forEach((fix, index) => {
            const key = `${fix.collection}:${fix.targetId}`
            if (keys.has(key)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['fixes', index, 'targetId'],
                    message: 'Duplicate SEO fix target',
                })
            }
            keys.add(key)
        })
    })

/**
 * POST /api/seo/apply-fixes
 * Applies a revision-bound batch of SEO metadata updates.
 */
export const POST = withFeatureGuard('content_management')(
    withAuth(async (_user, request) => {
        try {
            const { data, errorResponse } = await parseRequest(
                request,
                applyFixesSchema,
            )
            if (errorResponse) return errorResponse

            const { siteId, revisionToken, fixes } = data!
            const operation = data!.operation
            if (
                operation === 'undo' &&
                !verifyUndoToken(
                    data!.undoToken,
                    siteId,
                    revisionToken,
                    fixes,
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: { code: 'INVALID_UNDO', message: 'Undo is invalid or expired' },
                    },
                    { status: 403 },
                )
            }
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

            const userRateLimit = await checkTwoTierRateLimit(
                'seo-apply-fixes:user:' + String(_user.id),
                20,
                100,
            )
            const siteRateLimit = userRateLimit.allowed
                ? await checkTwoTierRateLimit(
                      'seo-apply-fixes:' + String(_user.id) + ':' + siteId,
                      2,
                      10,
                  )
                : userRateLimit
            if (!siteRateLimit.allowed) {
                const retryAfter = Math.max(
                    0,
                    Math.ceil((siteRateLimit.resetAt - Date.now()) / 1_000),
                )
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'RATE_LIMITED',
                            message: 'Too many SEO Apply requests. Try again later.',
                        },
                        retryAfter,
                    },
                    {
                        status: 429,
                        headers: { 'Retry-After': String(retryAfter) },
                    },
                )
            }

            const payload = await getPayload({ config })
            const site = await payload.findByID({
                collection: 'sites',
                id: siteId,
                disableErrors: true,
                depth: 0,
                select: { id: true, tenant: true },
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

            const siteTenantId = relationId(site.tenant as TenantRef)
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

            let prepared: PreparedFix[]
            try {
                prepared = await mapWithConcurrency(
                    fixes,
                    APPLY_CONCURRENCY,
                    async (fix) => {
                        const current = await payload.findByID({
                            collection: fix.collection,
                            id: fix.targetId,
                            disableErrors: true,
                            depth: 1,
                        })
                        if (!current) throw new FixNotFoundError()

                        const recordSiteId = relationId(
                            current.site as RelationRef,
                        )
                        const recordTenantId =
                            fix.collection === 'pages'
                                ? relationId(current.site?.tenant as TenantRef)
                                : relationId(current.tenant as TenantRef)
                        if (
                            recordSiteId !== String(site.id) ||
                            !recordTenantId ||
                            recordTenantId !== siteTenantId ||
                            (!isSuperAdmin &&
                                !userTenantIds.has(recordTenantId))
                        ) {
                            throw new FixAuthorizationError()
                        }

                        const expectedUpdatedAt = textValue(current.updatedAt)
                        if (!expectedUpdatedAt) {
                            throw new FixStaleRevisionError()
                        }

                        const currentSeo =
                            current.seo &&
                            typeof current.seo === 'object' &&
                            !Array.isArray(current.seo)
                                ? current.seo
                                : {}
                        const seoUpdate =
                            fix.collection === 'blogs'
                                ? {
                                      ...currentSeo,
                                      ...(fix.seo.title !== undefined && {
                                          metaTitle: fix.seo.title,
                                      }),
                                      ...(fix.seo.description !== undefined && {
                                          metaDescription: fix.seo.description,
                                      }),
                                  }
                                : {
                                      ...currentSeo,
                                      ...fix.seo,
                                  }

                        return {
                            targetId: fix.targetId,
                            collection: fix.collection,
                            expectedUpdatedAt,
                            seoUpdate,
                            requestedSeo: fix.seo,
                            undo: {
                                targetId: fix.targetId,
                                collection: fix.collection,
                                seo:
                                    fix.collection === 'blogs'
                                        ? {
                                              title: textValue(
                                                  currentSeo.metaTitle,
                                              ),
                                              description: textValue(
                                                  currentSeo.metaDescription,
                                              ),
                                          }
                                        : {
                                              title: textValue(
                                                  currentSeo.title,
                                              ),
                                              description: textValue(
                                                  currentSeo.description,
                                              ),
                                          },
                            },
                        }
                    },
                )
            } catch (error: unknown) {
                if (error instanceof FixAuthorizationError) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'FORBIDDEN',
                                message: 'Forbidden',
                            },
                        },
                        { status: 403 },
                    )
                }
                if (error instanceof FixNotFoundError) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'TARGET_NOT_FOUND',
                                message: 'SEO target not found',
                            },
                        },
                        { status: 404 },
                    )
                }
                if (error instanceof FixStaleRevisionError) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'STALE_REVISION',
                                message:
                                    'SEO data changed. Refresh before applying fixes.',
                            },
                        },
                        { status: 409 },
                    )
                }
                throw error
            }

            // Validate after preflight reads so stale batches perform zero writes.
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
                                'SEO data changed. Refresh before applying fixes.',
                        },
                    },
                    { status: 409 },
                )
            }

            if (operation === 'apply') {
                const authoritativeItems = new Map(
                    evaluation.metadataItems.map((item) => [
                        `${item.collection}:${item.id}`,
                        item,
                    ]),
                )
                const batchIsEligible = prepared.every((fix) => {
                    const authoritative = authoritativeItems.get(
                        `${fix.collection}:${fix.targetId}`,
                    )
                    if (!authoritative) return false
                    const requestedFields = Object.keys(
                        fix.requestedSeo,
                    ) as SeoField[]
                    return requestedFields.every((field) =>
                        authoritative.missingFields.includes(field),
                    )
                })
                if (!batchIsEligible) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'STALE_REVISION',
                                message: 'SEO data changed. Refresh before applying fixes.',
                            },
                        },
                        { status: 409 },
                    )
                }
            }

            const results = await mapWithConcurrency(
                prepared,
                APPLY_CONCURRENCY,
                async (fix) => {
                    try {
                        const scope: Where[] = [
                            { id: { equals: fix.targetId } },
                            {
                                updatedAt: {
                                    equals: fix.expectedUpdatedAt,
                                },
                            },
                            { site: { equals: String(site.id) } },
                        ]
                        if (
                            fix.collection === 'products' ||
                            fix.collection === 'blogs'
                        ) {
                            scope.push({
                                tenant: { equals: siteTenantId },
                            })
                        }

                        const updateResult = await payload.update({
                            collection: fix.collection,
                            where: { and: scope },
                            limit: 1,
                            depth: 0,
                            select: { id: true },
                            data: { seo: fix.seoUpdate },
                        })
                        if (updateResult.docs.length === 0) {
                            if (updateResult.errors.length > 0) {
                                console.error(
                                    '[AI Apply Fix Partial Error]',
                                    'PayloadBulkUpdateError',
                                )
                                return { status: 'rejected' as const }
                            }
                            return { status: 'stale' as const }
                        }
                        return { status: 'fulfilled' as const, undo: fix.undo }
                    } catch (error: unknown) {
                        console.error(
                            '[AI Apply Fix Partial Error]',
                            error instanceof Error
                                ? error.name
                                : 'UnknownError',
                        )
                        return { status: 'rejected' as const }
                    }
                },
            )

            const undoData = results.flatMap((result) =>
                result.status === 'fulfilled' ? [result.undo] : [],
            )
            const remainingUndoData =
                operation === 'undo'
                    ? results.flatMap((result, index) =>
                          result.status === 'fulfilled' ? [] : [fixes[index]],
                      )
                    : []
            const failedCount = results.length - undoData.length
            const staleCount = results.filter(
                (result) => result.status === 'stale',
            ).length

            if (undoData.length === 0) {
                if (staleCount > 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'STALE_REVISION',
                                message:
                                    'SEO data changed. Refresh before applying fixes.',
                            },
                        },
                        { status: 409 },
                    )
                }
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'ALL_FAILED',
                            message: `All ${failedCount} fixes failed`,
                        },
                    },
                    { status: 500 },
                )
            }

            let nextRevisionToken: string | null = null
            try {
                const postApplyEvaluation = await evaluateAuthoritativeLocalSeo(
                    payload as unknown as LocalSeoPayload,
                    String(site.id),
                    siteTenantId,
                )
                nextRevisionToken = postApplyEvaluation.response.revisionToken
            } catch (error: unknown) {
                console.error(
                    '[AI Apply Fix Revision Refresh Error]',
                    error instanceof Error ? error.name : 'UnknownError',
                )
            }
            const undoTokenData =
                operation === 'apply' ? undoData : remainingUndoData
            const undoToken =
                nextRevisionToken && undoTokenData.length > 0
                    ? createUndoToken(
                          String(site.id),
                          nextRevisionToken,
                          undoTokenData,
                      )
                    : null
            return NextResponse.json({
                success: true,
                undoData,
                remainingUndoData,
                undoToken,
                failedCount,
                staleCount,
                revisionToken: nextRevisionToken,
                requiresRefresh: nextRevisionToken === null,
            })
        } catch (error: unknown) {
            console.error(
                '[AI Apply Fixes Error]',
                error instanceof Error ? error.name : 'UnknownError',
            )
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UPDATE_FAILED',
                        message: 'Failed to apply fixes',
                    },
                },
                { status: 500 },
            )
        }
    }),
)
