import { loadSettingsView } from '@/lib/admin/ai-providers/load-view'
import { computeBadges } from '@/lib/admin/ai-providers/status'
import { ModelsRail } from './models-rail'

/** The rail with its problem counts; the counts stream in, so the page shell never waits for ai-platform. */
export async function RailWithBadges() {
    const result = await loadSettingsView()
    return <ModelsRail badges={computeBadges(result.ok ? result.data : null)} />
}
