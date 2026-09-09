import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import {
    normalizeTemplateSearchText,
    searchTemplates,
    templateSearchCategories,
    type TemplateSearchCandidate,
} from '@/lib/templates/natural-language-search'
import { templateSearchRequestSchema } from '@/lib/validations/template-search'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const SEARCH_CANDIDATE_LIMIT = 1_000
const SEARCH_RATE_LIMIT = 100
const SEARCH_RATE_WINDOW_MS = 24 * 60 * 60 * 1_000
const TEMPLATE_SEARCH_ERROR_STATUS = {
    AUTH_REQUIRED: 401,
    VALIDATION_ERROR: 422,
    AI_RATE_LIMIT: 429,
    INTERNAL_ERROR: 500,
} as const

type TemplateSearchErrorCode = keyof typeof TEMPLATE_SEARCH_ERROR_STATUS

function candidateWhere(rawQuery: string): Where {
    const categories = templateSearchCategories(rawQuery)
    if (categories.length > 0) {
        return {
            and: [
                { status: { equals: 'live' } } satisfies Where,
                { category: { in: categories } } satisfies Where,
            ],
        }
    }

    const terms = normalizeTemplateSearchText(rawQuery)
        .split(' ')
        .filter((term) => term.length >= 3)
    const textFilters: Where[] = terms.map((term) => {
        const fields: Where[] = [
            { name: { contains: term } },
            { description: { contains: term } },
            { 'tags.tag': { contains: term } },
        ]
        return { or: fields }
    })
    return {
        and: [
            { status: { equals: 'live' } },
            ...textFilters,
        ],
    }
}

type TemplateSearchRecord = TemplateSearchCandidate & {
    id: string | number
    thumbnail?: string | number | { url?: string | null } | null
    previewUrl?: string | null
    isPremium?: boolean | null
    defaultTheme?: {
        primaryColor?: string | null
        secondaryColor?: string | null
        colorMode?: string | null
    } | null
}

function requestIdFor(request: Request): string {
    const supplied = request.headers.get('x-request-id')?.trim()
    if (supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied
    return crypto.randomUUID()
}

function errorResponse(
    requestId: string,
    code: TemplateSearchErrorCode,
    message: string,
    details: unknown = null,
) {
    return NextResponse.json(
        { success: false, error: { code, message, details, requestId } },
        {
            status: TEMPLATE_SEARCH_ERROR_STATUS[code],
            headers: { 'x-request-id': requestId },
        },
    )
}

function toSearchResult(template: TemplateSearchRecord) {
    const thumbnail = typeof template.thumbnail === 'object' && template.thumbnail?.url
        ? { url: template.thumbnail.url }
        : undefined

    return {
        id: String(template.id),
        name: template.name ?? '',
        description: template.description ?? '',
        category: Array.isArray(template.category)
            ? template.category
            : template.category
                ? [template.category]
                : [],
        ...(thumbnail ? { thumbnail } : {}),
        ...(template.previewUrl ? { previewUrl: template.previewUrl } : {}),
        isPremium: Boolean(template.isPremium),
        isFeatured: Boolean(template.isFeatured),
        tags: (template.tags ?? [])
            .map(({ tag }) => tag?.trim())
            .filter((tag): tag is string => Boolean(tag))
            .map((tag) => ({ tag })),
        defaultTheme: {
            primaryColor: template.defaultTheme?.primaryColor ?? '#3B82F6',
            secondaryColor: template.defaultTheme?.secondaryColor ?? '#8B5CF6',
            colorMode: template.defaultTheme?.colorMode ?? 'light',
        },
    }
}

/**
 * POST /api/templates/search
 *
 * Authenticated template metadata is ranked by a multilingual intent taxonomy.
 * Only published card fields are loaded, keeping the response independent from
 * heavyweight template page/block content.
 */
export const POST = withAuth(async (user, request) => {
    const requestId = requestIdFor(request)
    let body: unknown

    try {
        body = await request.json()
    } catch {
        return errorResponse(requestId, 'VALIDATION_ERROR', 'Invalid JSON body')
    }

    const parsed = templateSearchRequestSchema.safeParse(body)

    if (!parsed.success) {
        return errorResponse(
            requestId,
            'VALIDATION_ERROR',
            'Invalid template search request',
            parsed.error.flatten(),
        )
    }

    try {
        const rateLimit = await checkRateLimit(
            `template-search:${user.id}`,
            SEARCH_RATE_LIMIT,
            SEARCH_RATE_WINDOW_MS,
        )
        if (!rateLimit.allowed) {
            return errorResponse(
                requestId,
                'AI_RATE_LIMIT',
                'Template search limit reached. Please try again later.',
            )
        }

        const payload = await getPayload({ config })
        const select = {
            name: true,
            description: true,
            category: true,
            thumbnail: true,
            previewUrl: true,
            isPremium: true,
            isFeatured: true,
            tags: { tag: true },
            defaultTheme: {
                primaryColor: true,
                secondaryColor: true,
                colorMode: true,
            },
            sortOrder: true,
        } as const
        const populate = {
            media: { url: true },
        } as const
        const templates = await payload.find({
            collection: 'templates',
            user,
            overrideAccess: false,
            where: candidateWhere(parsed.data.query),
            limit: SEARCH_CANDIDATE_LIMIT,
            sort: ['sortOrder', 'id'],
            depth: 1,
            select,
            populate,
        })
        let candidates = templates.docs as unknown as TemplateSearchRecord[]
        const categories = templateSearchCategories(parsed.data.query)

        if (categories.length === 0) {
            const textMatches = searchTemplates(candidates, parsed.data.query, { allowSingle: true })
            if (textMatches.length === 1) {
                const primary = textMatches[0]
                const peerCategories = Array.isArray(primary.category)
                    ? primary.category
                    : primary.category
                        ? [primary.category]
                        : []

                if (peerCategories.length > 0) {
                    const peers = await payload.find({
                        collection: 'templates',
                        user,
                        overrideAccess: false,
                        where: {
                            and: [
                                { status: { equals: 'live' } },
                                { category: { in: peerCategories } },
                                { id: { not_equals: primary.id } },
                            ],
                        },
                        limit: 20,
                        sort: ['sortOrder', 'id'],
                        depth: 1,
                        select,
                        populate,
                    })
                    candidates = [primary, ...(peers.docs as unknown as TemplateSearchRecord[])]
                }
            }
        }

        const ranked = searchTemplates(candidates, parsed.data.query).map(toSearchResult)

        return NextResponse.json(
            {
                success: true,
                data: {
                    query: parsed.data.query,
                    locale: parsed.data.locale,
                    templates: ranked,
                },
                meta: { timestamp: new Date().toISOString() },
            },
            { headers: { 'x-request-id': requestId } },
        )
    } catch (error: unknown) {
        console.error(`[Template search] request ${requestId} failed:`, error)
        return errorResponse(
            requestId,
            'INTERNAL_ERROR',
            'Unable to search templates. Please try again.',
        )
    }
}, {
    unauthorizedResponse: (request) => {
        const requestId = requestIdFor(request)
        return errorResponse(requestId, 'AUTH_REQUIRED', 'Authentication required')
    },
})
