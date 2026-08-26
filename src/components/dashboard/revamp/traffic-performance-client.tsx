'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { getTrafficDataAction } from '@/app/(dashboard)/dashboard/actions'
import { getBrowserViewerTimeZone } from '@/lib/viewer-timezone'
import { useI18n } from '@/i18n'
import type { DashboardPeriodKey, TrafficData } from '@/lib/dashboard/dashboard-types'
import { SectionHead } from './atoms'
import { TrafficPerformance } from './traffic-performance'

export function TrafficPerformanceClient({ period }: { period: DashboardPeriodKey }) {
    const { t } = useI18n()
    const labels = t.dashboard.revamp.traffic
    const [data, setData] = useState<TrafficData | null>(null)
    const [failed, setFailed] = useState(false)
    const [requestVersion, setRequestVersion] = useState(0)

    useEffect(() => {
        let active = true

        setData(null)
        setFailed(false)

        getTrafficDataAction(period, getBrowserViewerTimeZone())
            .then(result => {
                if (active) setData(result)
            })
            .catch(() => {
                if (active) setFailed(true)
            })

        return () => {
            active = false
        }
    }, [period, requestVersion])

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
                        <button type="button" onClick={() => setRequestVersion(version => version + 1)}>
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
