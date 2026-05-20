export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { withAuth } from '@/lib/auth'
import { stripArrayItemIds } from '@/lib/payload/strip-block-ids'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { parseRequest } from '@/lib/validations/helpers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'

const updatePageSchema = z.object({
    isVisible: z.boolean().optional(),
    deletedAt: z.string().nullable().optional(),
    slug: z.string().regex(/^[a-z0-9-\/]+$/, 'Slug must be valid path').optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
})


type RouteContext = { params: Promise<{ siteId: string; pageId: string }> }

type PageUpdateData = {
    isVisible?: boolean
    deletedAt?: string | null
    slug?: string
    seo?: { title?: string; description?: string }
}

export const PATCH = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(ctx.params)
        const { siteId, pageId } = resolvedParams

        if (!siteId || !/^\d+$/.test(siteId) || !pageId || !/^\d+$/.test(pageId)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        const numericSiteId = Number(siteId)
        
        // Extract tenant IDs from the current user
        interface TenantRef {
            tenant: string | number | { id: string | number }
        }
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

        const { data, errorResponse } = await parseRequest(request, updatePageSchema)
        if (errorResponse) return errorResponse

        const { isVisible, deletedAt, slug, seoTitle, seoDescription } = data!

        const updateData: PageUpdateData = {}
        if (isVisible !== undefined) updateData.isVisible = isVisible
        if (deletedAt !== undefined) updateData.deletedAt = deletedAt
        if (slug !== undefined) updateData.slug = slug

        if (seoTitle !== undefined || seoDescription !== undefined) {
            updateData.seo = {}
            if (seoTitle !== undefined) updateData.seo.title = seoTitle.trim()
            if (seoDescription !== undefined) updateData.seo.description = seoDescription.trim()
        }

        // depth: 0 keeps `layout` relationship fields (e.g. seo.ogImage, site)
        // as scalar IDs. We re-send this layout back through payload.update in
        // the visibility block below; passing populated relationship objects
        // to update on Payload 3.79 causes silent validation drops on nested
        // media/relationship fields — same gotcha the /publish route
        // documents (see commit df2a03d4).
        const page = await payload.findByID({
            collection: 'pages',
            id: pageId,
            draft: true,
            depth: 0,
        })
        const pageSiteId = typeof page?.site === 'object' ? page.site?.id : page?.site

        if (!page || Number(pageSiteId) !== numericSiteId) {
            return new NextResponse('Page not found on this site', { status: 404 })
        }

        if (slug !== undefined) {
            const currentSlug = String(page.slug || '').replace(/^\//, '')
            const is404Page =
                currentSlug === '404' ||
                String(page.title || '').toLowerCase().includes('404')

            if (is404Page) {
                return NextResponse.json({ error: '404 page slug is read-only.' }, { status: 400 })
            }

            // Lock slug only while site is currently published (allow when unpublished/draft)
            const site = sites[0] as { status?: string; publishedAt?: string }
            if (site.status === 'published') {
                return NextResponse.json({ error: 'Slug cannot be changed while site is published. Unpublish first to edit URLs.' }, { status: 400 })
            }

            let normalizedSlug = String(slug).trim()
            if (!normalizedSlug) {
                return NextResponse.json({ error: 'URL slug is required.' }, { status: 400 })
            }
            normalizedSlug = normalizedSlug.startsWith('/') ? normalizedSlug : `/${normalizedSlug}`
            if (normalizedSlug === '//') normalizedSlug = '/'

            const duplicatePages = await payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: numericSiteId } },
                        { slug: { equals: normalizedSlug } },
                    ],
                },
                limit: 1,
            })

            const duplicate = duplicatePages.docs.find((doc: { id: string | number }) => String(doc.id) !== String(pageId))
            if (duplicate) {
                return NextResponse.json({ error: 'Invalid or duplicate URL slug.' }, { status: 400 })
            }

            updateData.slug = normalizedSlug
        }

        if (Object.keys(updateData).length === 0) {
            return new NextResponse('No fields to update', { status: 400 })
        }

        // Split visibility fields from content fields to avoid publishing
        // draft content when only toggling hide/delete.
        const visibilityFields: Record<string, unknown> = {}
        const contentFields: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(updateData)) {
            if (key === 'deletedAt' || key === 'isVisible') {
                visibilityFields[key] = val
            } else {
                contentFields[key] = val
            }
        }

        // Apply visibility changes. Two failure modes we have to sidestep:
        //
        // 1) `draft: false` → Payload publishes, re-validating every required
        //    block field in `layout`. AI-seeded or partially-edited pages
        //    sometimes fail that (throw 500). Gate on `page._status ===
        //    'published'` so we only take the publish path when the current
        //    version IS the published snapshot (nothing pending to leak).
        //
        // 2) Even `draft: true` passes the current layout back through
        //    Drizzle's `upsertRow` on live `pages_blocks_*` tables. Those
        //    tables have varchar PK `id DEFAULT gen_random_uuid()` and the
        //    `id → _uuid` rename only fires on versioned tables — so AI-
        //    seeded block UUIDs that collide across pages trigger PG 23505
        //    (`ValidationError{ path: 'id', message: 'Value must be unique' }`).
        //    Strip `id` / `_uuid` from the layout so column defaults
        //    regenerate fresh UUIDs. Pattern matches `/publish` route's fix
        //    (commit df2a03d4).
        //
        // Trade-off for (1): toggling visibility on a page with pending
        // content edits defers the live change until republish, which is
        // semantically correct (visibility is part of the pending edit set).
        // Trade-off for (2): block UUIDs regenerate on every toggle so
        // block-level version-diff linkage is lost. Version diff UI isn't
        // wired up, so acceptable.
        if (Object.keys(visibilityFields).length > 0) {
            const isPublishedClean = page._status === 'published'
            const layout = (page as unknown as { layout?: unknown[] }).layout
            const data: Record<string, unknown> = { ...visibilityFields }
            if (Array.isArray(layout)) {
                data.layout = normalizeBlocksForPersistence(
                    stripArrayItemIds(layout) as Record<string, unknown>[]
                )
            }
            await payload.update({
                collection: 'pages',
                id: pageId,
                data,
                draft: !isPublishedClean,
            })
        }

        // Content changes stay as draft until explicit publish
        if (Object.keys(contentFields).length > 0) {
            await payload.update({
                collection: 'pages',
                id: pageId,
                data: contentFields,
                draft: true,
            })
        }

        // Re-read page — use draft:true only when content fields were updated,
        // otherwise read published version to reflect visibility changes accurately
        const hasContentChanges = Object.keys(contentFields).length > 0
        const updatedPage = await payload.findByID({
            collection: 'pages',
            id: pageId,
            draft: hasContentChanges,
        })

        // BUG-F05-11: revalidate site cache when page is deleted/hidden
        // so live site reflects the change immediately
        if (updateData.deletedAt !== undefined || updateData.isVisible !== undefined) {
            try {
                revalidateTag(`site-${siteId}`)
            } catch (err) {
                console.warn(`[Pages] revalidateTag failed for site-${siteId}:`, err instanceof Error ? err.message : err)
            }
        }

        return NextResponse.json({
            page: {
                id: updatedPage.id,
                title: updatedPage.title,
                slug: updatedPage.slug,
                status: updatedPage._status || 'draft',
                isVisible: updatedPage.isVisible ?? true,
                seoTitle: updatedPage.seo?.title ?? null,
                seoDescription: updatedPage.seo?.description ?? null,
                updatedAt: updatedPage.updatedAt,
            }
        })
    } catch (error) {
        console.error('[PATCH /sites/:siteId/pages/:pageId] error:', error)

        // Surface structured detail (errName, errMsg, Payload validationErrors)
        // so the client + future debugging UI can tell the real cause. Until
        // this change the catch returned a bare "Internal Error" string and
        // the toggle-visibility bug was invisible past the 500.
        //
        // Shape intentionally mirrors `/api/sites/[siteId]/publish`'s
        // `error.failures[]` envelope so one client parser handles both
        // endpoints (see `handleRepublish` in editor page.tsx).
        const err = error as {
            name?: string
            message?: string
            data?: { errors?: Array<{ field?: string; path?: string; message?: string }> }
        }
        const rawErrors = err?.data?.errors
        const validationErrors = Array.isArray(rawErrors)
            ? rawErrors.map((e) => ({
                path: e.path ?? e.field ?? '',
                message: e.message ?? '',
            }))
            : undefined

        const resolvedPageId = await ctx.params.then((p) => p.pageId).catch(() => undefined)

        return NextResponse.json(
            {
                error: {
                    message: 'Failed to update page',
                    failures: [{
                        pageId: resolvedPageId,
                        errName: err?.name,
                        errMsg: err?.message?.slice(0, 300),
                        causeMsg: err?.message?.slice(0, 300),
                        validationErrors: validationErrors && validationErrors.length > 0 ? validationErrors : undefined,
                    }],
                },
            },
            { status: 500 },
        )
    }
})
