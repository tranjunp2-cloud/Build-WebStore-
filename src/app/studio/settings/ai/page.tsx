/**
 * /studio/settings/ai — AI limits & prices. Server component: loads current values + 7-day usage,
 * the client component edits and saves through PUT /api/admin/ai-settings.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadAiSettings } from '@/lib/admin/ai-settings/settings-store'
import type { AiSettingsData } from '@/lib/admin/ai-settings/types'
import { AiSettingsClient } from './_components/ai-settings-client'

export const metadata: Metadata = { title: 'AI limits & prices' }

export default async function AiSettingsPage() {
    await requireSuperAdmin()
    let data: AiSettingsData | null = null
    let failure: string | null = null
    try {
        data = await loadAiSettings()
    } catch (error) {
        console.error('[ai-settings] page load failed', error)
        failure = error instanceof Error ? error.message : 'plan-features did not answer.'
    }
    return <AiSettingsClient initial={data} failure={failure} />
}
