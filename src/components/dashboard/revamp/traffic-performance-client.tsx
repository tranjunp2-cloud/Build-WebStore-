'use client'

import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { getTrafficDataAction } from '@/app/(dashboard)/dashboard/actions'
import { getBrowserViewerTimeZone } from '@/lib/viewer-timezone'
import { useI18n } from '@/i18n'
import type { DashboardPeriodKey, TrafficData } from '@/lib/dashboard/dashboard-types'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useQueryScope } from '@/providers/query-provider'
import { SectionHead } from './atoms'
import { TrafficPerformance } from './traffic-performance'

const TRAFFIC_STALE_TIME = 2 * 60 * 1000

export function TrafficPerformanceClient({ period }: { period: DashboardPeriodKey }) {
    const { t } = useI18n()
    const labels = t.dashboard.revamp.traffic
    // Cached per period (and time zone): coming back to the dashboard, or switching back to a period already
    // seen, shows the chart without a request while it is fresh. Analytics move slowly: fresh for 2 min.
    const scope = useQueryScope()
    const timeZone = getBrowserViewerTimeZone()
    const query = useQuery({
        queryKey: queryKeys.dashboard.traffic(scope, period, timeZone),
        queryFn: () => getTrafficDataAction(period, timeZone) as Promise<TrafficData>,
        staleTime: TRAFFIC_STALE_TIME,
        retry: false,
    })
    const data = query.data ?? null
    const failed = query.isError && !data

    if (data) {
        return <TrafficPerformance data={data} period={period} />
    }

    return (
        <div className="section" aria-live="polite">
            <SectionHead icon="bar-chart-3" title={labels.title} sub={labels.subtitle} />
            <div className="card chart-card traffic-load-state" aria-busy={!failed}>
                {failed ? (
                    <>
                        <TriangleAlert aria-hidden />
                        <p>{labels.loadError}</p>
                        <button type="button" onClick={() => void query.refetch()}>
                            <RefreshCw aria-hidden />
                            {labels.retry}
                        </button>
                    </>
                ) : (
                    <>
                        <LoaderCircle className="traffic-loading-icon" aria-hidden />
                        <span className="sr-only">{labels.loading}</span>
                    </>
                )}
            </div>
        </div>
    )
}
