import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'

import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { DashboardSiteGrid } from '@/components/dashboard/DashboardSiteGrid'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { DashboardBanner } from '@/components/dashboard/DashboardBanner'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

// ─── Mock Data (will be replaced with Payload Local API in Wave 3) ──────
// TODO: Replace with getPayload() → payload.find({ collection: 'sites', where: { tenant, deletedAt: { exists: false } } })
const MOCK_SITES = [
    { id: 'site-1', name: 'Bakery Delights', slug: 'bakery-delights', isPublished: true, updatedAt: '2 giờ trước' },
    { id: 'site-2', name: 'Aurora Wellness', slug: 'aurora-wellness', isPublished: false, updatedAt: 'Hôm qua' },
    { id: 'site-3', name: 'Portfolio Pro', slug: 'portfolio-pro', isPublished: false, updatedAt: '19/10/2026' },
]

const MOCK_STATS = {
    totalSites: 3,
    totalViews: '12.4K',
    storageUsed: 1.2,
    storageLimit: 10,
    aiCredits: 15,
    aiCreditsLimit: 20,
}

// ─── Dashboard Page (Server Component) ─────────────────────────────────
export default function DashboardPage() {
    // TODO: Replace mock with Payload Local API server-side fetch
    const sites = MOCK_SITES
    const stats = MOCK_STATS
    const userName = 'Nhan' // TODO: From Payload auth session

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

                {/* Unpublished Banner (US-006C) */}
                {unpublishedSite && (
                    <DashboardBanner
                        siteId={unpublishedSite.id}
                        siteName={unpublishedSite.name}
                    />
                )}

                {hasSites ? (
                    <>
                        {/* Stats Cards (US-006A) */}
                        <DashboardStats {...stats} />

                        {/* Site Grid (US-006A) */}
                        <DashboardSiteGrid sites={sites} />
                    </>
                ) : (
                    /* Empty State (US-006B) */
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
