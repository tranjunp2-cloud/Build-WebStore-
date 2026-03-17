import { Skeleton } from '@/components/ui/skeleton'

export function ProductsSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-8 w-32 rounded-lg bg-white/5" />
                    <div className="mt-2 h-4 w-20 rounded bg-white/5" />
                </div>
                <div className="h-10 w-32 rounded-lg bg-white/5" />
            </div>

            {/* Filter bar skeleton */}
            <div className="flex items-center gap-3">
                <div className="h-10 flex-1 max-w-sm rounded-lg bg-white/5" />
                <div className="h-10 w-64 rounded-lg bg-white/5" />
            </div>

            {/* Table skeleton */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                {/* Table header */}
                <div className="hidden sm:flex items-center gap-4 border-b border-white/10 px-6 py-3">
                    <Skeleton className="h-3 w-20" />
                    <div className="flex-1" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-10" />
                </div>
                {/* Table rows */}
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                        <div className="flex-1 min-w-0">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="mt-1 h-3 w-24" />
                        </div>
                        <Skeleton className="hidden sm:block h-4 w-20" />
                        <Skeleton className="hidden sm:block h-5 w-16 rounded-full" />
                        <Skeleton className="hidden sm:block h-4 w-8" />
                    </div>
                ))}
            </div>
        </div>
    )
}
