import { TIER_IDS, type HistoryEntry, type SettingsView } from '@/lib/admin/ai-providers/types'
import { OverviewBanners } from './overview-banners'
import { ProviderStatusCard } from './provider-status-card'
import { TierTile } from './tier-tile'

/** What answers each tier right now, what is wrong, how the providers stand. */
export function OverviewView({ view, history }: { view: SettingsView; history: HistoryEntry[] | null }) {
    return (
        <>
            <OverviewBanners view={view} />
            <div className="pm-tiers">{TIER_IDS.map((tier) => <TierTile key={tier} view={view} tier={tier} />)}</div>
            <ProviderStatusCard view={view} last={history?.[0]} />
        </>
    )
}
