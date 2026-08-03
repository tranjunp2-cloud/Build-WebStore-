'use server'

import { parsePeriod } from '@/lib/dashboard-utils'
import { getTrafficData } from '@/lib/dashboard/traffic-data'
import type { TrafficData } from '@/lib/dashboard/dashboard-types'
import { normalizeViewerTimeZone } from '@/lib/viewer-timezone'

export async function getTrafficDataAction(
    period: string,
    requestedTimeZone: string,
): Promise<TrafficData> {
    return getTrafficData(
        parsePeriod(period),
        normalizeViewerTimeZone(requestedTimeZone),
    )
}
