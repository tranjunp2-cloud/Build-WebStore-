import Link from 'next/link'
import {
    Globe,
    Eye,
    HardDrive,
    Sparkles,
    Plus,
    ExternalLink,
    Settings,
    Pencil,
} from 'lucide-react'

// ─── Stats Cards ────────────────────────────────────────────────────────
function StatsCard({
    icon: Icon,
    label,
    value,
    sub,
    progress,
}: {
    icon: React.ElementType
    label: string
    value: string
    sub?: string
    progress?: number
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#1E293B] p-5">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{label}</span>
                <Icon className="h-4 w-4 text-gray-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
            {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
            {typeof progress === 'number' && (
                <div className="mt-2 h-1.5 rounded-full bg-gray-800">
                    <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            )}
        </div>
    )
}

// ─── Site Card ──────────────────────────────────────────────────────────
function SiteCard({
    name,
    status,
    lastEdited,
    slug,
}: {
    name: string
    status: 'published' | 'draft'
    lastEdited: string
    slug: string
}) {
    return (
        <div className="group rounded-xl border border-white/10 bg-[#1E293B] overflow-hidden transition-all hover:border-blue-500/30">
            {/* Preview thumbnail */}
            <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <Globe className="h-10 w-10 text-gray-700" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Link
                        href={`/editor/${slug}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                        Open Editor
                    </Link>
                </div>
            </div>
            {/* Info */}
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white truncate">{name}</h3>
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${status === 'published'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                    >
                        {status}
                    </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Last edited: {lastEdited}</p>
                <div className="mt-3 flex gap-2">
                    <Link
                        href={`/editor/${slug}`}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                    >
                        <Pencil className="h-3 w-3" /> Edit
                    </Link>
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors">
                        <ExternalLink className="h-3 w-3" /> Preview
                    </button>
                    <button className="ml-auto rounded-lg bg-white/5 p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors">
                        <Settings className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Empty State ────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 py-16">
            <div className="rounded-full bg-blue-500/10 p-4">
                <Globe className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-white">
                Chưa có website nào
            </h3>
            <p className="mt-1 text-sm text-gray-400">
                Tạo website đầu tiên của bạn trong 5 phút với AI
            </p>
            <Link
                href="/onboarding"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-500 transition-all"
            >
                <Sparkles className="h-4 w-4" />
                Tạo Website Mới
            </Link>
        </div>
    )
}

// ─── Dashboard Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
    // TODO: Replace with real data from Payload CMS via server component
    const greeting = getGreeting()
    const hasSites = true // Toggle false to see empty state

    // Mock data — will be replaced with Payload API calls
    const stats = {
        totalSites: 3,
        totalViews: '12.4K',
        storageUsed: 1.2,
        storageLimit: 10,
        aiCredits: 15,
        aiCreditsLimit: 20,
    }

    const sites = [
        { name: 'Bakery Delights', status: 'published' as const, lastEdited: '2 giờ trước', slug: 'bakery-delights' },
        { name: 'Aurora Wellness', status: 'draft' as const, lastEdited: 'Hôm qua', slug: 'aurora-wellness' },
        { name: 'Portfolio Pro', status: 'draft' as const, lastEdited: '19/10/2026', slug: 'portfolio-pro' },
    ]

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{greeting}, Nhan</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        {new Date().toLocaleDateString('vi-VN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                </div>
                <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all"
                >
                    <Plus className="h-4 w-4" />
                    Create New Website
                    <Sparkles className="h-3.5 w-3.5" />
                </Link>
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    icon={Globe}
                    label="Total Sites"
                    value={String(stats.totalSites)}
                    sub={`Active: ${stats.totalSites}`}
                />
                <StatsCard
                    icon={Eye}
                    label="Total Views"
                    value={stats.totalViews}
                    sub="+8% this month"
                />
                <StatsCard
                    icon={HardDrive}
                    label="Storage Used"
                    value={`${stats.storageUsed}GB`}
                    sub={`/ ${stats.storageLimit}GB`}
                    progress={(stats.storageUsed / stats.storageLimit) * 100}
                />
                <StatsCard
                    icon={Sparkles}
                    label="AI Credits"
                    value={`${stats.aiCredits}`}
                    sub={`/ ${stats.aiCreditsLimit}`}
                    progress={(stats.aiCredits / stats.aiCreditsLimit) * 100}
                />
            </div>

            {/* Sites */}
            <div className="mt-10">
                <h2 className="text-lg font-semibold text-white">My Websites</h2>

                {hasSites ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {sites.map((site) => (
                            <SiteCard key={site.slug} {...site} />
                        ))}
                    </div>
                ) : (
                    <div className="mt-4">
                        <EmptyState />
                    </div>
                )}
            </div>
        </div>
    )
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}
