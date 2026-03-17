import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { formatRelativeTime, formatStorage } from '@/lib/utils'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { DashboardSiteGrid } from '@/components/dashboard/DashboardSiteGrid'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { DashboardBanner } from '@/components/dashboard/DashboardBanner'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

// ─── Dashboard Page (Server Component — Real Data) ─────────────────────
export default async function DashboardPage() {
    const user = await getCurrentUser()
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })

    // Get real user name
    const typedUser = user as PlatformUser | null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'

    // Fetch real sites from DB
    let sites: Array<{ id: string; name: string; slug: string; isPublished: boolean; updatedAt: string }> = []
    let totalSites = 0

    if (tenantId) {
        const sitesResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            sort: '-updatedAt',
            limit: 20,
        })
        totalSites = sitesResult.totalDocs
        sites = sitesResult.docs.map((doc) => {
            const d = doc as unknown as { id: string; name?: string; domain?: string; status?: string; updatedAt?: string }
            return {
                id: d.id,
                name: d.name || 'Untitled Site',
                slug: d.domain || d.id,
                isPublished: d.status === 'published',
                updatedAt: d.updatedAt ? formatRelativeTime(d.updatedAt) : 'Just created',
            }
        })
    }

    // Fetch real tenant data for stats
    let storageUsed = 0
    let storageLimit = 500 // MB default
    if (tenantId) {
        try {
            const tenant = await payload.findByID({ collection: 'tenants', id: tenantId })
            const tenantData = tenant as unknown as { settings?: { storageUsed?: number; storageLimitBytes?: number } }
            storageUsed = tenantData?.settings?.storageUsed || 0
            storageLimit = (tenantData?.settings?.storageLimitBytes || 524288000) / (1024 * 1024) // bytes → MB
        } catch {
            // tenant not found — use defaults
        }
    }

    const publishedCount = sites.filter((s) => s.isPublished).length

    const stats = {
        totalSites,
        storageUsed: Math.round((storageUsed / (1024 * 1024)) * 10) / 10, // bytes → MB
        storageLimit: Math.round(storageLimit),
        publishedCount,
    }

    const hasSites = sites.length > 0
    const unpublishedSite = sites.find((s) => !s.isPublished)

    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <div className="space-y-8">
                {/* Header: Greeting + Create CTA */}
                <div className="flex items-center justify-between">
                    <DashboardGreeting userName={userName} />
                    <Link
                        href="/onboarding"
                        className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105"
                    >
                        <Plus className="h-4 w-4" />
                        Create New Website
                        <Sparkles className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {/* Unpublished Banner */}
                {unpublishedSite && (
                    <DashboardBanner
                        siteId={unpublishedSite.id}
                        siteName={unpublishedSite.name}
                    />
                )}

                {hasSites ? (
                    <>
                        {/* Stats Cards */}
                        <DashboardStats {...stats} />

                        {/* Site Grid */}
                        <DashboardSiteGrid sites={sites} />
                    </>
                ) : (
                    /* Empty State */
                    <DashboardEmptyState />
                )}

                {/* Mobile Create Button */}
                <div className="fixed bottom-6 right-6 sm:hidden">
                    <Link
                        href="/onboarding"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/25 hover:scale-110 transition-all"
                    >
                        <Plus className="h-6 w-6 text-white" />
                    </Link>
                </div>
            </div>
        </Suspense>
    )
}
