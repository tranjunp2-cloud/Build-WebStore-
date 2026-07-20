import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'
import { findAllPayloadDocs } from '@/lib/payload/find-all-pages'

export const maxDuration = 60

/**
 * GET /api/storefront/categories — Public endpoint for storefront category tree.
 * Returns flat, site-scoped, non-deleted categories. No auth required.
 * Query params: site (required)
 */
export async function GET(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')?.trim()
            || 'unknown'
        const rateCheck = await checkRateLimit(`storefront-categories:${ip}`, 60, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
            })
        }

        const url = new URL(req.url)
        const siteId = url.searchParams.get('site')

        if (!siteId) {
            return NextResponse.json({ docs: [] })
        }

        const siteIdNum = parseInt(siteId, 10)
        if (!Number.isInteger(siteIdNum) || siteIdNum <= 0 || String(siteIdNum) !== siteId) {
            return NextResponse.json({ docs: [] })
        }

        const payload = await getPayload({ config })

        const where: Where = {
            and: [
                { site: { equals: siteIdNum } },
                { deletedAt: { exists: false } },
            ],
        }

        const allCategories = await findAllPayloadDocs<{
            id: number | string
            name?: string | null
            slug?: string | null
            parent?: number | string | { id: number | string } | null
            breadcrumbs?: string | null
        }>(payload, {
            collection: 'categories',
            where,
            depth: 0,
            overrideAccess: true,
            select: {
                name: true,
                slug: true,
                parent: true,
                breadcrumbs: true,
            },
            sort: 'name',
        }, 500)

        const docs = allCategories.map((d) => {
            const parentRaw = d.parent as number | string | { id: number | string } | null | undefined

            return {
                id: d.id,
                name: d.name,
                slug: d.slug,
                parent: (typeof parentRaw === 'object' && parentRaw !== null ? parentRaw.id : parentRaw) ?? null,
                breadcrumbs: d.breadcrumbs,
            }
        })

        return NextResponse.json({ docs })
    } catch (error) {
        console.error('[Storefront Categories API]', error)
        return NextResponse.json({ docs: [] }, { status: 500 })
    }
}
