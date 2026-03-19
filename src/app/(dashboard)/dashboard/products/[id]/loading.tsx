import { Skeleton } from '@/components/ui/skeleton'

export default function ProductDetailLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Back button + title */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-7 w-48" />
            </div>

            {/* Form skeleton */}
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                {/* Main content */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                        <Skeleton className="h-4 w-16" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-10 rounded-lg" />
                            <Skeleton className="h-10 rounded-lg" />
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    )
}
