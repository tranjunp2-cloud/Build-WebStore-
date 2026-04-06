import { notFound } from 'next/navigation'
import payloadConfig from '@payload-config'
import { getPayload } from 'payload'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { PreviewScripts } from '@/components/editor/PreviewScripts'
import { AppShell } from '@/components/AppShell'
import type { NavPage } from '@/components/site-renderer/SiteRenderer'

interface PreviewPageProps {
    params: Promise<{ siteId: string }>
    searchParams: Promise<{ pageId?: string; v?: string }>
}

export const dynamic = 'force-dynamic'

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
    const { siteId } = await params
    const { pageId } = await searchParams
    const payload = await getPayload({ config: payloadConfig })

    try {
        // 1. Fetch Site Data
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 2,
        })

        if (!site) return notFound()

        // 2. Fetch Page Data
        let page: any = null
        if (pageId) {
            page = await payload.findByID({
                collection: 'pages',
                id: pageId,
                draft: true,
                depth: 3,
            })
        } else {
            // Find Homepage
            const pagesResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: siteId },
                    isHomepage: { equals: true },
                },
                draft: true,
                limit: 1,
                depth: 3,
            })
            page = pagesResult.docs[0] || null
        }

        if (!page) return <div>No page found for this preview.</div>

        // 3. Fetch all pages for navigation filtering parity
        const navPagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId } },
            limit: 100,
        })

        return (
            <AppShell>
                <div className="overflow-x-hidden min-height-screen">
                    {/* Render with true SiteRenderer in Editor Mode */}
                    <SiteRenderer
                        site={site as any}
                        page={page as any}
                        pages={navPagesResult.docs as unknown as NavPage[]}
                        isEditor={true}
                    />

                    {/* Editor specific listeners */}
                    <PreviewScripts />
                </div>
            </AppShell>
        )

    } catch (error) {
        console.error('[Preview] Error:', error)
        return <div>Error loading preview. Please ensure you are logged in.</div>
    }
}
