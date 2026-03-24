import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function PATCH(
    request: Request,
    { params }: { params: { siteId: string; pageId: string } }
) {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(params)
        const { siteId, pageId } = resolvedParams
        const body = await request.json()

        const { isVisible, deletedAt } = body

        const updateData: any = {}
        if (isVisible !== undefined) updateData.isVisible = isVisible
        if (deletedAt !== undefined) updateData.deletedAt = deletedAt

        if (Object.keys(updateData).length === 0) {
            return new NextResponse('No fields to update', { status: 400 })
        }

        const page = await payload.findByID({
            collection: 'pages',
            id: pageId,
        })

        if (!page || (typeof page.site === 'object' ? page.site.id : page.site) !== siteId) {
            return new NextResponse('Not found', { status: 404 })
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
                updatedAt: updatedPage.updatedAt,
            }
        })
    } catch (error) {
        console.error('Error updating page:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}
