import Link from 'next/link'
import { Plus, Sparkles, Globe, ExternalLink, Pencil, Eye } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'

// Force dynamic — requires auth context + getPayload() at runtime
export const dynamic = 'force-dynamic'

import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        draft: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        published: 'bg-green-500/15 text-green-400 border-green-500/30',
        archived: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    }
    return (
        <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize', styles[status] || styles.draft)}>
            {status}
        </span>
    )
}

function SiteTypeBadge({ type }: { type: string }) {
    const labels: Record<string, string> = {
        business: 'Business',
        ecommerce: 'E-commerce',
        blog: 'Blog',
        portfolio: 'Portfolio',
        restaurant: 'Restaurant',
    }
    return (
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            {labels[type] || type}
        </span>
    )
}

export default async function MySitesPage() {
    const user = await getCurrentUser()
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })

    type SiteDoc = {
        id: string
        name?: string
        domain?: string
        status?: string
        siteType?: string
        updatedAt?: string
        createdAt?: string
        theme?: { primaryColor?: string }
    }

    let sites: SiteDoc[] = []
    let totalSites = 0

    if (tenantId) {
        const result = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            sort: '-updatedAt',
            limit: 100,
        })
        totalSites = result.totalDocs
        sites = result.docs as unknown as SiteDoc[]
    }

    // Empty state
    if (sites.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">My Sites</h1>
                        <p className="mt-1 text-sm text-gray-400">Manage all your websites</p>
                    </div>
                </div>

                <div className="flex h-[50vh] items-center justify-center">
                    <div className="text-center">
                        <Globe className="mx-auto h-12 w-12 text-gray-600" />
                        <h2 className="mt-4 text-lg font-semibold text-white">No sites yet</h2>
                        <p className="mt-1 text-sm text-gray-500">Create your first website to get started</p>
                        <Link
                            href="/onboarding"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all"
                        >
                            <Sparkles className="h-4 w-4" /> Create Website
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const publishedCount = sites.filter(s => s.status === 'published').length
    const draftCount = sites.filter(s => s.status === 'draft').length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">My Sites</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        {totalSites} site{totalSites !== 1 ? 's' : ''} &middot; {publishedCount} published &middot; {draftCount} draft
                    </p>
                </div>
                <Link
                    href="/onboarding"
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all"
                >
                    <Plus className="h-4 w-4" /> New Site
                </Link>
            </div>

            {/* Site Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sites.map(site => {
                    const primaryColor = site.theme?.primaryColor || '#0ea5e9'
                    return (
                        <div key={site.id} className="group rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden hover:border-white/20 transition-all">
                            {/* Color bar */}
                            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}88)` }} />

                            <div className="p-5">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate text-base font-semibold text-white">{site.name || 'Untitled Site'}</h3>
                                        {site.domain && (
                                            <p className="mt-0.5 truncate text-xs text-gray-500">{site.domain}</p>
                                        )}
                                    </div>
                                    <StatusBadge status={site.status || 'draft'} />
                                </div>

                                {/* Meta */}
                                <div className="mt-3 flex items-center gap-2">
                                    <SiteTypeBadge type={site.siteType || 'business'} />
                                    <span className="text-[10px] text-gray-600">
                                        Updated {site.updatedAt ? formatRelativeTime(site.updatedAt) : 'recently'}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="mt-4 flex items-center gap-2">
                                    <Link
                                        href={`/editor/${site.id}`}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-600/25 transition-colors"
                                    >
                                        <Pencil className="h-3 w-3" /> Edit
                                    </Link>
                                    <Link
                                        href={`/sites/${site.domain || site.id}`}
                                        target="_blank"
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        <Eye className="h-3 w-3" /> Preview
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
