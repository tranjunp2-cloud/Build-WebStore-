export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { z } from 'zod'

const MAX_PAGES_PER_SITE = 100

function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}

const newPageSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
    slug: z.string().regex(/^[a-z0-9-\/]+$/, 'Slug must be kebab-case or valid path').min(1, 'Slug is required'),
})
type RouteContext = { params: Promise<{ siteId: string }> }

export interface TenantRef {
    tenant: string | number | { id: string | number }
}

export const GET = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(ctx.params)
        const siteId = resolvedParams.siteId

        // Extract tenant IDs from the current user
        const tenantIds = user.tenants?.map((t: TenantRef) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []

        const { docs: sites } = await payload.find({
            collection: 'sites',
            where: {
                id: {
                    equals: siteId,
                },
                tenant: {
                    in: tenantIds,
                },
            },
        })

        if (!sites || sites.length === 0) {
            return new NextResponse('Unauthorized or Site Not Found', { status: 403 })
        }

        const { docs: pages } = await payload.find({
            collection: 'pages',
            where: {
                site: {
                    equals: siteId,
                },
                deletedAt: {
                    exists: false,
                }
            },
            sort: 'createdAt',
        })

        type PageDoc = {
            id: string | number
            title: string
            slug: string
            _status?: string
            isHomepage?: boolean | null
            isVisible?: boolean | null
            seo?: { title?: string; description?: string }
            updatedAt: string
            layout?: unknown[]
        }

        const formattedPages = (pages as unknown as PageDoc[]).map((p: PageDoc) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            status: p._status || 'draft',
            isHomepage: Boolean(p.isHomepage),
            isVisible: p.isVisible ?? true,
            seoTitle: p.seo?.title ?? null,
            seoDescription: p.seo?.description ?? null,
            updatedAt: p.updatedAt,
            blockCount: Array.isArray(p.layout) ? p.layout.length : 0,
        }))

        return NextResponse.json({ pages: formattedPages })
    } catch (error) {
        console.error('Error fetching pages:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
})

export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(ctx.params)
        const siteId = resolvedParams.siteId
        
        // Extract tenant IDs from the current user
        const tenantIds = user.tenants?.map((t: TenantRef) =>
            typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
        ) ?? []

        const { docs: sites } = await payload.find({
            collection: 'sites',
            where: {
                id: {
                    equals: siteId,
                },
                tenant: {
                    in: tenantIds,
                },
            },
        })

        if (!sites || sites.length === 0) {
            return new NextResponse('Unauthorized or Site Not Found', { status: 403 })
        }

        const { data, errorResponse } = await parseRequest(request, newPageSchema)
        if (errorResponse) return errorResponse

        const { title: rawTitle, slug } = data!
        const title = stripHtml(rawTitle.trim())

        if (!title) {
            return new NextResponse('Title is required', { status: 400 })
        }

        let normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`
        if (normalizedSlug === '//') normalizedSlug = '/'

        // Block reserved slugs — these are auto-managed by the system
        const RESERVED_SLUGS = ['/404']
        if (RESERVED_SLUGS.includes(normalizedSlug)) {
            return new NextResponse('This slug is reserved and cannot be used', { status: 400 })
        }

        // Soft guard: page count limit. Not atomic under concurrent writes, but acceptable —
        // worst case is 101 pages instead of 100 (harmless). Hard enforcement would need a DB trigger.
        const { totalDocs: pageCount } = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId }, deletedAt: { exists: false } },
            limit: 0,
        })
        if (pageCount >= MAX_PAGES_PER_SITE) {
            return new NextResponse(`Maximum ${MAX_PAGES_PER_SITE} pages per site reached`, { status: 400 })
        }

        // Optimistic check: slug uniqueness among non-deleted pages (DB constraint is the real guard)
        const { docs: existing } = await payload.find({
            collection: 'pages',
            where: {
                and: [
                    { site: { equals: siteId } },
                    { slug: { equals: normalizedSlug } },
                    { deletedAt: { exists: false } },
                ],
            },
            limit: 1,
        })
        if (existing.length > 0) {
            return new NextResponse('Page slug already exists in this site', { status: 409 })
        }

        // Build default layout: nav + hero + footer (inherited from homepage)
        type LayoutBlock = Record<string, unknown> & { blockType: string }
        const defaultLayout: LayoutBlock[] = []

        // Recursively strip Payload system fields so Payload creates fresh records
        const STRIP_KEYS = new Set(['id', '_order', '_parent_id', '_path', '_uuid', 'createdAt', 'updatedAt'])
        function stripSystemFields(obj: unknown): unknown {
            if (Array.isArray(obj)) return obj.map(stripSystemFields)
            if (obj && typeof obj === 'object') {
                const result: Record<string, unknown> = {}
                for (const [key, val] of Object.entries(obj)) {
                    if (STRIP_KEYS.has(key)) continue
                    result[key] = stripSystemFields(val)
                }
                return result
            }
            return obj
        }

        try {
            const homepageResult = await payload.find({
                collection: 'pages',
                where: { site: { equals: siteId }, isHomepage: { equals: true } },
                limit: 1,
                depth: 2,
            })
            const homepage = homepageResult.docs[0] as { layout?: LayoutBlock[] } | undefined
            if (homepage?.layout) {
                const navBlock = homepage.layout.find(b => b.blockType === 'navigation')
                const footerBlock = homepage.layout.find(b => b.blockType === 'footer')
                if (navBlock) {
                    defaultLayout.push(stripSystemFields(navBlock) as LayoutBlock)
                }
                defaultLayout.push({
                    blockType: 'hero',
                    variant: 'centered',
                    headline: title,
                    subheadline: '',
                } as LayoutBlock)
                if (footerBlock) {
                    defaultLayout.push(stripSystemFields(footerBlock) as LayoutBlock)
                }
            }
        } catch {
            defaultLayout.push({
                blockType: 'hero',
                variant: 'centered',
                headline: title,
                subheadline: '',
            } as LayoutBlock)
        }

        let newPage: Record<string, unknown>
        try {
            newPage = await payload.create({
                collection: 'pages',
                data: {
                    title,
                    slug: normalizedSlug,
                    site: Number(siteId),
                    isVisible: true,
                    layout: defaultLayout.length > 0 ? defaultLayout : [],
                    _status: 'draft',
                },
            })
        } catch (err: unknown) {
            // Handle DB unique constraint violation (concurrent slug creation)
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes('unique') || message.includes('duplicate')) {
                return new NextResponse('Page slug already exists in this site', { status: 409 })
            }
            throw err
        }

        return NextResponse.json({
            page: {
                id: newPage.id,
                title: newPage.title,
                slug: newPage.slug,
                status: newPage._status || 'draft',
                isHomepage: Boolean(newPage.isHomepage),
                isVisible: newPage.isVisible ?? true,
                seoTitle: (newPage.seo as Record<string, unknown> | undefined)?.title ?? null,
                seoDescription: (newPage.seo as Record<string, unknown> | undefined)?.description ?? null,
                updatedAt: newPage.updatedAt,
            }
        })
    } catch (error) {
        console.error('Error creating page:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
})
