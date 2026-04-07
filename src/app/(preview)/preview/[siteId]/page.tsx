import { notFound, redirect } from 'next/navigation'
import payloadConfig from '@payload-config'
import { getPayload } from 'payload'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { PreviewScripts } from '@/components/editor/PreviewScripts'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser } from '@/lib/auth'
import type { NavPage } from '@/components/site-renderer/SiteRenderer'
import type { PlatformUser } from '@/types/user'

interface PreviewPageProps {
    params: Promise<{ siteId: string }>
    searchParams: Promise<{ pageId?: string; v?: string }>
}

export const dynamic = 'force-dynamic'

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
    const { siteId } = await params
    const { pageId } = await searchParams
    
    // 1. Auth Check (P0 Security Rule - Auth Redirect)
    const user = await getCurrentUser() as PlatformUser | null
    if (!user) {
        return redirect('/login?redirect=' + encodeURIComponent(`/preview/${siteId}${pageId ? `?pageId=${pageId}` : ''}`))
    }

    const payload = await getPayload({ config: payloadConfig })

    try {
        // 2. Fetch Site Data
        // Using 'any' cast here as fallback because payload-types.ts is generated in the build step and not consistently available in all dev environments
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 2,
        }) as any

        if (!site) return notFound()

        // 3. Tenant Isolation Check (P0 Security Rule - Tenant Isolation)
        // Ensure user has access to this site's tenant
        const userTenants = user.tenants?.map((t: NonNullable<PlatformUser['tenants']>[number]) => typeof t.tenant === 'object' ? t.tenant.id : t.tenant) || []
        const siteTenantId = typeof site.tenant === 'object' ? site.tenant?.id : site.tenant
        
        if (!userTenants.includes(siteTenantId)) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="p-8 bg-white rounded-lg shadow-xl max-w-md text-center">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                        <p className="text-slate-600 mb-6">You do not have permission to preview this site.</p>
                        <a href="/dashboard" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                            Back to Dashboard
                        </a>
                    </div>
                </div>
            )
        }

        // 4. Fetch Page Data
        // Using 'any' as fallback type for generated Payload Page interface
        let page: any = null
        if (pageId) {
            page = await payload.findByID({
                collection: 'pages',
                id: pageId,
                draft: true,
                depth: 3,
            })
            // Verify page belongs to the current site (P0 Security Rule - prevent cross-site page access)
            const pageSiteId = typeof page.site === 'object' ? page.site?.id : page.site
            if (pageSiteId !== siteId) {
                return notFound()
            }
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

        // 5. Fetch all pages for navigation filtering parity
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
                        site={site}
                        page={page}
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
        return <div>Error loading preview. Please ensure you are logged in and have access to this site.</div>
    }
}
