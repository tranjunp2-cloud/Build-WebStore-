import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(
    request: Request,
    { params }: { params: { siteId: string } }
) {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(params)
        const siteId = resolvedParams.siteId

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

        const formattedPages = pages.map((p: any) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            status: p._status || 'draft',
            isHomepage: Boolean(p.isHomepage),
            isVisible: p.isVisible ?? true,
            seoTitle: p.seo?.title ?? null,
            seoDescription: p.seo?.description ?? null,
            updatedAt: p.updatedAt,
        }))

        return NextResponse.json({ pages: formattedPages })
    } catch (error) {
        console.error('Error fetching pages:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: { siteId: string } }
) {
    try {
        const payload = await getPayload({ config })
        const resolvedParams = await Promise.resolve(params)
        const siteId = resolvedParams.siteId
        const body = await request.json()

        const { title, slug } = body
        if (!title || !slug) {
            return new NextResponse('Missing title or slug', { status: 400 })
        }

        const newPage = await payload.create({
            collection: 'pages',
            data: {
                title,
                slug,
                site: siteId,
                isVisible: true,
                layout: [],
                _status: 'draft',
            },
        })

        return NextResponse.json({
            page: {
                id: newPage.id,
                title: newPage.title,
                slug: newPage.slug,
                status: newPage._status || 'draft',
                isHomepage: Boolean(newPage.isHomepage),
                isVisible: newPage.isVisible ?? true,
                seoTitle: newPage.seo?.title ?? null,
                seoDescription: newPage.seo?.description ?? null,
                updatedAt: newPage.updatedAt,
            }
        })
    } catch (error) {
        console.error('Error creating page:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}
