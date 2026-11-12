/**
 * /studio/settings/ai — AI limits & prices. Server component: loads current values + 7-day usage, the shop overrides
 * and the recent cap alerts; the client component edits and saves through PUT /api/admin/ai-settings.
 * Overrides and alerts load on their own, so a failure there never hides the settings.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import config from '@payload-config'
import { getPayload } from 'payload'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { listShopOverrides } from '@/lib/admin/ai-caps/shop-overrides'
import { loadRecentAlerts } from '@/lib/admin/ai-caps/status'
import { loadAiSettings } from '@/lib/admin/ai-settings/settings-store'
import type { AiSettingsData } from '@/lib/admin/ai-settings/types'
import type { ReportsDb } from '@/lib/reports/report-db'
import { AiSettingsClient } from './_components/ai-settings-client'

export const metadata: Metadata = { title: 'AI limits & prices' }

/** One loader's result: the value, or the sentence to show in its card. */
async function settle<T>(label: string, run: () => Promise<T>): Promise<{ value: T | null; failure: string | null }> {
    try {
        return { value: await run(), failure: null }
    } catch (error) {
        console.error(`[ai-settings] ${label} failed`, error)
        return { value: null, failure: error instanceof Error ? error.message : `${label} did not answer.` }
    }
}

export default async function AiSettingsPage() {
    await requireSuperAdmin()
    const [settings, overrides, alerts] = await Promise.all([
        settle<AiSettingsData>('settings', loadAiSettings),
        settle('shop overrides', listShopOverrides),
        settle('alerts', async () => loadRecentAlerts((await getPayload({ config })) as unknown as ReportsDb, 20)),
    ])
    return (
        <AiSettingsClient
            initial={settings.value} failure={settings.failure ?? (settings.value ? null : 'plan-features did not answer.')}
            overrides={overrides.value} overridesFailure={overrides.failure} alerts={alerts.value} alertsFailure={alerts.failure}
        />
    )
}
