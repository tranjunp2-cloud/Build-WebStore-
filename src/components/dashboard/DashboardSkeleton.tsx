export function DashboardSkeleton() {
    return <OverviewSkeleton />
}

export function OverviewSkeleton() {
    return (
        <div className="animate-pulse space-y-6 mt-6">
            {/* Stats cards 2x2 grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-[16px] border border-white/10 bg-[#1E293B] p-5 min-h-[260px] flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-[16px] bg-white/5" />
                            <div className="h-[26px] w-16 rounded-[12px] bg-white/5" />
                        </div>
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="h-5 w-32 rounded bg-white/5" />
                            <div className="h-12 w-24 rounded bg-white/5" />
                        </div>
                        <div className="mt-auto h-[40px] rounded bg-white/5" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function AnalyticsSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Chart skeleton */}
            <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6">
                <div className="h-5 w-32 rounded bg-white/5 mb-4" />
                <div className="h-[280px] rounded bg-white/5" />
            </div>
            {/* Top lists skeleton */}
            <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6">
                <div className="flex gap-2 mb-6">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-9 w-24 rounded-full bg-white/5" />
                    ))}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center py-2.5 border-b border-[#1F2937] last:border-0">
                        <div className="w-7 h-7 rounded-full bg-white/5 mr-3" />
                        <div className="flex-1 h-4 rounded bg-white/5 mr-4" />
                        <div className="h-4 w-16 rounded bg-white/5" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function SEOSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SEO Health Overview skeleton */}
                <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6">
                    <div className="h-5 w-40 rounded bg-white/5 mb-6" />
                    <div className="flex items-center gap-6 mb-6">
                        <div className="w-[100px] h-[100px] rounded-full bg-white/5 shrink-0" />
                        <div className="flex flex-col gap-3">
                            <div className="h-5 w-28 rounded bg-white/5" />
                            <div className="h-9 w-36 rounded-[8px] bg-white/5" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-8 rounded bg-white/5" />
                        ))}
                    </div>
                </div>
                {/* Sitemap & Meta skeleton */}
                <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6">
                    <div className="h-5 w-36 rounded bg-white/5 mb-4" />
                    <div className="h-9 w-40 rounded-[8px] bg-white/5 mb-4" />
                    <div className="h-4 w-48 rounded bg-white/5 mb-3" />
                    <div className="h-9 w-full rounded bg-white/5" />
                </div>
            </div>
            {/* Issues list skeleton */}
            <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6">
                <div className="h-5 w-24 rounded bg-white/5 mb-4" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center py-2.5 gap-3 border-b border-[#1F2937] last:border-0">
                        <div className="w-7 h-7 rounded-full bg-white/5" />
                        <div className="flex-1 h-4 rounded bg-white/5" />
                    </div>
                ))}
            </div>
        </div>
    )
}
