import Link from 'next/link'
import { effortOf, providerName, skipText, splitRef, TIER_META, tierState } from '@/lib/admin/ai-providers/status'
import { fmtSeconds } from '@/lib/admin/ai-providers/format'
import type { SettingsView, TierId } from '@/lib/admin/ai-providers/types'
import { ToneBadge } from './badges'

/** One tier: the model that answers now, why the others are skipped, effort and timeout. */
export function TierTile({ view, tier }: { view: SettingsView; tier: TierId }) {
    const health = view.health[tier]
    const config = view.routing.tiers[tier]
    const state = tierState(health.state)
    const meta = TIER_META[tier]
    const serving = health.serving ? splitRef(health.serving) : null
    return (
        <article className="pm-tier" data-tone={state.tone} aria-label={`${meta.name} tier`}>
            <div className="pm-tier-top"><span className="pm-tier-name">{meta.name}</span><ToneBadge tone={state.tone}>{state.text}</ToneBadge></div>
            <div className="pm-tier-use">{meta.use}</div>
            {serving
                ? <div className="pm-tier-model">{serving[1]}<small>{providerName(view, serving[0])}</small></div>
                : <div className="pm-tier-none">No model can answer</div>}
            {health.skipped.length > 0 && (
                <ul className="pm-skips">
                    {health.skipped.map((skip) => {
                        const [pid, model] = splitRef(skip.model)
                        return <li key={skip.model}><span className="pm-mono">{model}</span> skipped: {skipText(skip.reason, view.providers.find((p) => p.id === pid))}</li>
                    })}
                </ul>
            )}
            <div className="pm-tier-meta">
                <span className="pm-tier-metal">
                    {tier === 'image'
                        ? <span>Format <b>{'format' in config && config.format ? config.format.toUpperCase() : 'Default'}</b></span>
                        : <span>Effort <b>{effortOf('effort' in config ? config.effort : null).label}</b></span>}
                    <span>Timeout <b>{fmtSeconds(config.timeoutMs)}</b></span>
                </span>
                <Link className="pm-link" href={`/studio/settings/ai/models/routing#tier-${tier}`} aria-label={`Edit ${meta.name} tier`}>Edit</Link>
            </div>
        </article>
    )
}
