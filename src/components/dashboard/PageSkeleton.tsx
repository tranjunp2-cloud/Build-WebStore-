/**
 * Generic dashboard content skeleton — header + filter bar + table rows.
 *
 * Used as the route-group `loading.tsx` fallback so soft-navigation between
 * force-dynamic dashboard pages shows an instant skeleton (instead of a frozen
 * frame) while the server RSC streams in. Theme-aware (light + dark), mirrors
 * the visual language of ProductsSkeleton / DashboardSkeleton.
 */
const fill = 'bg-slate-200 dark:bg-white/5'

export function PageSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header: title + primary action */}
            <div className="flex items-center justify-between">
                <div>
                    <div className={`h-8 w-40 rounded-lg ${fill}`} />
                    <div className={`mt-2 h-4 w-24 rounded ${fill}`} />
                </div>
                <div className={`h-10 w-32 rounded-lg ${fill}`} />
            </div>

            {/* Filter / search bar */}
            <div className="flex items-center gap-3">
                <div className={`h-10 flex-1 max-w-sm rounded-lg ${fill}`} />
                <div className={`h-10 w-40 rounded-lg ${fill}`} />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                <div className="hidden sm:flex items-center gap-4 border-b border-[hsl(var(--border))] px-6 py-3">
                    <div className={`h-3 w-24 rounded ${fill}`} />
                    <div className="flex-1" />
                    <div className={`h-3 w-12 rounded ${fill}`} />
                    <div className={`h-3 w-12 rounded ${fill}`} />
                    <div className={`h-3 w-10 rounded ${fill}`} />
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-[hsl(var(--border))] last:border-0 px-6 py-4">
                        <div className={`h-10 w-10 shrink-0 rounded-lg ${fill}`} />
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className={`h-4 w-1/3 rounded ${fill}`} />
                            <div className={`h-3 w-1/4 rounded ${fill}`} />
                        </div>
                        <div className={`hidden sm:block h-4 w-16 rounded ${fill}`} />
                        <div className={`hidden sm:block h-4 w-12 rounded ${fill}`} />
                    </div>
                ))}
            </div>
        </div>
    )
}
