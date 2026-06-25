import { PageSkeleton } from '@/components/dashboard/PageSkeleton'

/**
 * Route-group loading fallback for all dashboard pages that don't define their
 * own loading.tsx. Gives soft-nav an instant skeleton while the force-dynamic
 * RSC streams. Segment-specific loading files (products, dashboard, help, …)
 * override this automatically.
 */
export default function DashboardLoading() {
    return <PageSkeleton />
}
