import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

const KEBAB_SLUG_REGEX = /^[a-z0-9-]+$/

export async function PATCH(
    request: Request,
    { params }: { params: { siteId: string; pageId: string } }
) {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(params)
        const { siteId, pageId } = resolvedParams
        const numericSiteId = Number(siteId)
        const body = await request.json()

        const { isVisible, deletedAt, slug, seoTitle, seoDescription } = body

        const updateData: Record<string, any> = {}
        if (isVisible !== undefined) updateData.isVisible = isVisible
        if (deletedAt !== undefined) updateData.deletedAt = deletedAt

        if (seoTitle !== undefined || seoDescription !== undefined) {
            updateData.seo = {}
            if (seoTitle !== undefined) updateData.seo.title = String(seoTitle ?? '').trim()
            if (seoDescription !== undefined) updateData.seo.description = String(seoDescription ?? '').trim()
        }

        if (Object.keys(updateData).length === 0) {
            return new NextResponse('No fields to update', { status: 400 })
        }

        const page = await payload.findByID({
            collection: 'pages',
            id: pageId,
        })

        const pageSiteId = typeof page?.site === 'object' ? page.site?.id : page?.site

        if (!page || Number(pageSiteId) !== numericSiteId) {
            return new NextResponse('Not found', { status: 404 })
        }

        const currentSlug = String(page.slug || '').replace(/^\//, '')
        const is404Page =
            currentSlug === '404' ||
            String(page.title || '').toLowerCase().includes('404')

        if (slug !== undefined) {
            if (is404Page) {
                return NextResponse.json({ error: '404 page slug is read-only.' }, { status: 400 })
            }

            const normalizedSlug = String(slug).trim().replace(/^\//, '').replace(/\/+$/, '')

            if (!normalizedSlug) {
                return NextResponse.json({ error: 'URL slug is required.' }, { status: 400 })
            }

            if (!KEBAB_SLUG_REGEX.test(normalizedSlug)) {
                return NextResponse.json({ error: 'Invalid or duplicate URL slug.' }, { status: 400 })
            }

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

            const duplicate = duplicatePages.docs.find((doc: any) => String(doc.id) !== String(pageId))
            if (duplicate) {
                return NextResponse.json({ error: 'Invalid or duplicate URL slug.' }, { status: 400 })
            }

            updateData.slug = normalizedSlug
        }

        const updatedPage = await payload.update({
            collection: 'pages',
            id: pageId,
            data: updateData,
        })

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
        console.error('Error updating page:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}
