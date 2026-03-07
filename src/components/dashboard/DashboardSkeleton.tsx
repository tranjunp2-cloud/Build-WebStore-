export function DashboardSkeleton() {
    return (
        <div className="animate-pulse">
            {/* Greeting skeleton */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-8 w-64 rounded-lg bg-white/5" />
                    <div className="mt-2 h-4 w-48 rounded bg-white/5" />
                </div>
                <div className="h-10 w-48 rounded-lg bg-white/5" />
            </div>

            {/* Stats skeleton */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-[#1E293B] p-5">
                        <div className="flex items-center justify-between">
                            <div className="h-4 w-20 rounded bg-white/5" />
                            <div className="h-8 w-8 rounded-lg bg-white/5" />
                        </div>
                        <div className="mt-3 h-7 w-24 rounded bg-white/5" />
                        <div className="mt-2 h-3 w-16 rounded bg-white/5" />
                    </div>
                ))}
            </div>

            {/* Sites skeleton */}
            <div className="mt-10">
                <div className="h-6 w-32 rounded bg-white/5" />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-[#1E293B] overflow-hidden">
                            <div className="h-40 bg-white/5" />
                            <div className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-5 w-32 rounded bg-white/5" />
                                    <div className="h-5 w-16 rounded-full bg-white/5" />
                                </div>
                                <div className="mt-2 h-3 w-24 rounded bg-white/5" />
                                <div className="mt-3 flex gap-2">
                                    <div className="h-7 w-16 rounded-lg bg-white/5" />
                                    <div className="h-7 w-20 rounded-lg bg-white/5" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
