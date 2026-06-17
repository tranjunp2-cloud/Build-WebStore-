'use client'

import Link from 'next/link'
import { Plus, Sparkles, Globe, Pencil, Eye, RefreshCw, LayoutTemplate } from 'lucide-react'
import { useI18n } from '@/i18n'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

type SiteDoc = {
    id: string
    name?: string
    domain?: string
    status?: string
    generationStatus?: string
    siteType?: string
    updatedAt?: string
    createdAt?: string
    theme?: { primaryColor?: string }
}

function StatusBadge({ status }: { status: string }) {
    const { t } = useI18n()
    const labels: Record<string, string> = {
        draft: t.dashboard.sites.draft,
        published: t.dashboard.sites.published,
    }
    const variantMap: Record<string, 'success' | 'warning' | 'secondary'> = {
        published: 'success',
        draft: 'warning',
        archived: 'secondary',
    }
    return (
        <Badge variant={variantMap[status] ?? 'warning'}>
            {labels[status] || status}
        </Badge>
    )
}

function SiteTypeBadge({ type }: { type: string }) {
    const { t } = useI18n()
    const labels = t.dashboard.sites.siteTypes
    return (
        <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)' }}
        >
            {labels[type as keyof typeof labels] || type}
        </span>
    )
}

interface SitesPageClientProps {
    usableSites: SiteDoc[]
    failedSites: SiteDoc[]
    totalSites: number
}

export function SitesPageClient({ usableSites, failedSites, totalSites }: SitesPageClientProps) {
    const { t } = useI18n()

    // Empty state
    if (usableSites.length === 0 && failedSites.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>{t.dashboard.sites.title}</h1>
                    </div>
                </div>

                <div className="flex h-[50vh] items-center justify-center">
                    <div className="text-center">
                        <Globe className="mx-auto h-12 w-12" style={{ color: 'var(--dash-text-muted)' }} />
                        <h2 className="mt-4 text-lg font-semibold" style={{ color: 'var(--dash-text)' }}>{t.dashboard.sites.noSites}</h2>
                        <p className="mt-1 text-sm" style={{ color: 'var(--dash-text-muted)' }}>{t.dashboard.sites.noSitesDesc}</p>
                        <Link
                            href="/onboarding"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all"
                        >
                            <Sparkles className="h-4 w-4" /> {t.dashboard.sites.createWebsite}
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const displaySites = [...usableSites, ...failedSites]
    const publishedCount = usableSites.filter(s => s.status === 'published').length
    const draftCount = usableSites.filter(s => s.status === 'draft').length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--dash-text)' }}>{t.dashboard.sites.title}</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--dash-text-muted)' }}>
                        {totalSites} site{totalSites !== 1 ? 's' : ''} &middot; {publishedCount} {t.dashboard.sites.published.toLowerCase()} &middot; {draftCount} {t.dashboard.sites.draft.toLowerCase()}
                    </p>
                </div>
                <Link
                    href="/onboarding"
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all"
                >
                    <Plus className="h-4 w-4" /> {t.dashboard.sites.newSite}
                </Link>
            </div>

            {/* Site Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displaySites.map(site => {
                    const isFailed = site.generationStatus === 'failed'
                    const primaryColor = site.theme?.primaryColor || '#0ea5e9'
                    return (
                        <div
                            key={site.id}
                            className="group rounded-xl overflow-hidden transition-all"
                            style={{
                                background: 'var(--dash-surface)',
                                border: '1px solid var(--dash-border)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--dash-divider)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dash-border)')}
                        >
                            {/* Color bar */}
                            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}88)` }} />

                            <div className="p-5">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate text-base font-semibold" style={{ color: 'var(--dash-text)' }}>{site.name || t.dashboard.sites.untitledSite}</h3>
                                        {site.domain && (
                                            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--dash-text-muted)' }}>{site.domain}</p>
                                        )}
                                    </div>
                                    {isFailed ? (
                                        <Badge variant="secondary">{t.dashboard.sites.incomplete}</Badge>
                                    ) : (
                                        <StatusBadge status={site.status || 'draft'} />
                                    )}
                                </div>

                                {/* Meta */}
                                <div className="mt-3 flex items-center gap-2">
                                    <SiteTypeBadge type={site.siteType || 'business'} />
                                    <span className="text-[10px]" style={{ color: 'var(--dash-text-muted)' }}>
                                        {t.dashboard.sites.updatedLabel} {site.updatedAt ? formatRelativeTime(site.updatedAt) : t.dashboard.sites.updatedRecently}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="mt-4 flex items-center gap-2">
                                    {isFailed ? (
                                        <>
                                            <Link
                                                href="/builder/new"
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-600/25 transition-colors"
                                            >
                                                <RefreshCw className="h-3 w-3" /> {t.dashboard.sites.retryAi}
                                            </Link>
                                            <Link
                                                href="/templates"
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                                                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)' }}
                                            >
                                                <LayoutTemplate className="h-3 w-3" /> {t.dashboard.sites.template}
                                            </Link>
                                        </>
                                    ) : (
                                        <>
                                            <Link
                                                href={`/editor/${site.id}`}
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600/15 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-600/25 transition-colors"
                                            >
                                                <Pencil className="h-3 w-3" /> {t.dashboard.sites.edit}
                                            </Link>
                                            <Link
                                                href={`/sites/${site.domain || site.id}`}
                                                target="_blank"
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                                                style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-muted)' }}
                                            >
                                                <Eye className="h-3 w-3" /> {t.dashboard.sites.preview}
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
