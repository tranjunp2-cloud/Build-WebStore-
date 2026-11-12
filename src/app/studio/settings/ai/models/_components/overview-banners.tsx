import Link from 'next/link'
import { providerName, skipText, splitRef, TIER_META } from '@/lib/admin/ai-providers/status'
import { TIER_IDS, type SettingsView, type TierId } from '@/lib/admin/ai-providers/types'
import { Banner } from './banner'

function skipsOf(view: SettingsView, tier: TierId) {
    return view.health[tier].skipped.map((skip) => ({ ...skip, pid: splitRef(skip.model)[0], model: splitRef(skip.model)[1] }))
}

/** Red: a tier with no model that can answer. Amber: tiers answered by a fallback. Grey: nothing saved in Studio yet. */
export function OverviewBanners({ view }: { view: SettingsView }) {
    const down = TIER_IDS.filter((tier) => view.health[tier].state === 'down')
    const fallback = TIER_IDS.filter((tier) => view.health[tier].state === 'fallback')
    const fresh = view.updatedAt === null
    if (!down.length && !fallback.length && !fresh) return null
    return (
        <div className="pm-banners">
            {fresh && (
                <Banner tone="info" title="Everything here comes from the environment">
                    Nothing has been saved in Studio yet, so every value is read from the Vercel environment variables. Save a section to manage it here; the environment stays as the fallback.
                </Banner>
            )}
            {down.map((tier) => (
                <Banner
                    key={tier} tone="danger"
                    title={tier === 'image' ? 'Pictures are failing: no Image model can answer' : `${TIER_META[tier].name} has no model that can answer`}
                    actions={<Link className="btn btn-sm" href={`/studio/settings/ai/models/routing#tier-${tier}`}>Open routing</Link>}
                >
                    {skipsOf(view, tier).length === 0 && 'The chain is empty'}
                    {skipsOf(view, tier).map((skip, i) => (
                        <span key={skip.model}>{i > 0 && '; '}<span className="pm-mono">{skip.model}</span>: {skipText(skip.reason, view.providers.find((p) => p.id === skip.pid))}</span>
                    ))}
                    . Every request on this tier fails.
                </Banner>
            ))}
            {fallback.length > 0 && (
                <Banner
                    tone="warn" title={`${fallback.length} ${fallback.length === 1 ? 'tier is' : 'tiers are'} running on a fallback model`}
                    actions={<Link className="btn btn-sm" href="/studio/settings/ai/models/providers">Open providers</Link>}
                >
                    {fallback.map((tier) => `${TIER_META[tier].name} skips ${skipsOf(view, tier).map((s) => `${providerName(view, s.pid)} (${skipText(s.reason, view.providers.find((p) => p.id === s.pid))})`).join(', ')}`).join('; ')}.
                    {' '}Answers still work; cost and quality may differ.
                </Banner>
            )}
        </div>
    )
}
