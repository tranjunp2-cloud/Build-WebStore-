export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import {
    evaluateAuthoritativeLocalSeo,
    type LocalSeoPayload,
} from '@/lib/seo/local-seo-evaluation'
import { localSeoMetadataDetailResponseSchema } from '@/lib/seo/local-seo-score-contract'

type TenantRef = string | number | { id: string | number } | null | undefined

function tenantId(value: TenantRef): string | null {
    if (value == null) return null
    return String(typeof value === 'object' ? value.id : value)
}

function noStoreJson(body: unknown, init?: { status?: number }): NextResponse {
    const response = NextResponse.json(body, init)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
}

function detailPage(req: NextRequest): number | null {
    if (req.nextUrl.searchParams.get('detail') !== 'metadata') return null
    const rawPage = req.nextUrl.searchParams.get('page') || '1'
    if (!/^\d+$/.test(rawPage)) return Number.NaN
    const page = Number(rawPage)
    return Number.isSafeInteger(page) && page >= 1 && page <= 10_000
        ? page
        : Number.NaN
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> },
) {
    try {
        const user = await getCurrentUser(req)
        if (!user)
            return noStoreJson({ error: 'Unauthorized' }, { status: 401 })

        const rateLimit = await checkRateLimit(
            `local-seo-score:${user.id}`,
            30,
            60_000,
        )
        if (!rateLimit.allowed) {
            return noStoreJson(
                { error: 'Too many requests. Try again shortly.' },
                { status: 429 },
            )
        }

        const requestedDetailPage = detailPage(req)
        if (Number.isNaN(requestedDetailPage)) {
            return noStoreJson(
                { error: 'Invalid metadata detail page' },
                { status: 400 },
            )
        }
        const rawDetailField = req.nextUrl.searchParams.get('field')
        if (
            rawDetailField !== null &&
            (requestedDetailPage === null ||
                (rawDetailField !== 'title' &&
                    rawDetailField !== 'description'))
        ) {
            return noStoreJson(
                { error: 'Invalid metadata detail field' },
                { status: 400 },
            )
        }
        const requestedDetailField = rawDetailField as
            | 'title'
            | 'description'
            | null

        const { siteId } = await params
        const payload = await getPayload({ config })
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            disableErrors: true,
            depth: 0,
            select: { id: true, tenant: true },
        })
        if (!site)
            return noStoreJson({ error: 'Site not found' }, { status: 404 })

        const userTenants =
            (user as unknown as {
                tenants?: Array<{ tenant: TenantRef; status?: string }>
            })
                .tenants ?? []
        const siteTenantId = tenantId(site.tenant as TenantRef)
        if (
            !siteTenantId ||
            !userTenants.some(
                (entry) =>
                    entry.status === 'active' &&
                    tenantId(entry.tenant) === siteTenantId,
            )
        ) {
            return noStoreJson({ error: 'Forbidden' }, { status: 403 })
        }

        const evaluation = await evaluateAuthoritativeLocalSeo(
            payload as unknown as LocalSeoPayload,
            String(site.id),
            siteTenantId,
        )

        if (requestedDetailPage !== null) {
            const metadataItems = requestedDetailField
                ? evaluation.metadataItems.filter((item) =>
                      item.missingFields.includes(requestedDetailField),
                  )
                : evaluation.metadataItems
            const start = (requestedDetailPage - 1) * 100
            const detail = localSeoMetadataDetailResponseSchema.parse({
                success: true,
                detail: 'metadata',
                items: metadataItems.slice(start, start + 100),
                page: requestedDetailPage,
                hasNextPage: start + 100 < metadataItems.length,
                revisionToken: evaluation.response.revisionToken,
            })
            return noStoreJson(detail)
        }

        return noStoreJson(evaluation.response)
    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        console.error('[Local SEO Score Error]', errorName)
        return noStoreJson(
            {
                error: 'Failed to calculate score. Please try again in a moment.',
            },
            { status: 500 },
        )
    }
}
