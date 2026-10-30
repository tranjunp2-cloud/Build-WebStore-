import { Plus } from 'lucide-react'
import { effortOf, EFFORTS, IMAGE_FORMATS, TIER_META, tierState } from '@/lib/admin/ai-providers/status'
import { MAX_TIMEOUT_SEC, type TierDraft } from '@/lib/admin/ai-providers/routing-draft'
import type { SettingsView, Source, TierId } from '@/lib/admin/ai-providers/types'
import { SourceBadge, ToneBadge } from './badges'
import { ChainRow } from './chain-row'

interface Props {
    view: SettingsView
    tier: TierId
    draft: TierDraft
    problem?: string
    priced: ReadonlySet<string> | null
    onChange: (next: TierDraft) => void
    onReset: () => void
}

const TIMEOUT_HELP = { image: 'Pictures take 15–40 s. After this the next model tries.', text: 'After this the next model in the chain answers.' }

/** Editor of one tier: ordered chain, effort (or picture format) and timeout. */
export function TierBlock({ view, tier, draft, problem, priced, onChange, onReset }: Props) {
    const meta = TIER_META[tier]
    const saved = view.routing.tiers[tier]
    const state = tierState(view.health[tier].state)
    const sources: Source[] = [saved.chainSource, saved.timeoutSource, 'effortSource' in saved ? saved.effortSource : saved.formatSource]
    const fromStudio = sources.includes('studio')
    const set = (patch: Partial<TierDraft>) => onChange({ ...draft, ...patch })
    const setChain = (chain: string[]) => set({ chain })
    const move = (i: number, delta: -1 | 1) => {
        const next = [...draft.chain]
        ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
        setChain(next)
    }
    return (
        <div className="pm-tierblock" id={`tier-${tier}`}>
            <div className="pm-tierblock-head">
                <div><b>{meta.name}</b> <SourceBadge source={fromStudio ? 'studio' : saved.chainSource} /><div className="pm-tier-use">{meta.use}</div></div>
                <span className="pm-field-row">
                    {fromStudio && <button type="button" className="pm-link" onClick={onReset} aria-label={`Reset ${meta.name} to environment`}>Reset to environment</button>}
                    <ToneBadge tone={state.tone}>{state.text}</ToneBadge>
                </span>
            </div>
            <ol className="pm-chain" aria-label={`${meta.name} chain`}>
                {draft.chain.map((ref, i) => (
                    <ChainRow
                        key={i} view={view} tier={tier} chain={draft.chain} index={i} priced={priced} tierName={meta.name}
                        onPick={(next) => setChain(draft.chain.map((item, j) => (j === i ? next : item)))} onMove={(d) => move(i, d)} onRemove={() => setChain(draft.chain.filter((_, j) => j !== i))}
                    />
                ))}
            </ol>
            <div style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChain([...draft.chain, ''])} disabled={draft.chain.includes('')}>
                    <Plus className="pm-ic" aria-hidden="true" />{draft.chain.length ? 'Add fallback' : 'Add model'}
                </button>
            </div>
            <div className="pm-tier-opts">
                {tier === 'image'
                    ? <div className="pm-field">
                        <span className="pm-label" id={`fmt-${tier}`}>Picture format</span>
                        <div className="pm-seg" role="radiogroup" aria-labelledby={`fmt-${tier}`}>
                            {IMAGE_FORMATS.map((format) => <button key={format} type="button" role="radio" aria-checked={draft.format === format} onClick={() => set({ format })}>{format.toUpperCase()}</button>)}
                        </div>
                        <span className="pm-help">WebP keeps pictures small enough for uploads (under 4.5 MB). PNG is sharper but heavy.</span>
                    </div>
                    : <div className="pm-field">
                        <label htmlFor={`eff-${tier}`}>Effort</label>
                        <select id={`eff-${tier}`} className="pm-select" value={draft.effort} onChange={(e) => set({ effort: e.target.value })}>
                            {EFFORTS.map((effort) => <option key={effort.value} value={effort.value}>{effort.label}</option>)}
                        </select>
                        <span className="pm-help">{effortOf(draft.effort).help}</span>
                    </div>}
                <div className="pm-field">
                    <label htmlFor={`to-${tier}`}>Timeout</label>
                    <div className="pm-field-row">
                        <span className="acl-num" data-invalid={problem ? '' : undefined}>
                            <input id={`to-${tier}`} inputMode="numeric" value={draft.timeoutSec} onChange={(e) => set({ timeoutSec: e.target.value })} aria-invalid={problem ? true : undefined} />
                            <span>s</span>
                        </span>
                        <span className="pm-set-def">Up to {MAX_TIMEOUT_SEC} s</span>
                    </div>
                    <span className="pm-help">{tier === 'image' ? TIMEOUT_HELP.image : TIMEOUT_HELP.text}</span>
                </div>
            </div>
            {problem && <p className="acl-err" role="alert">{problem}</p>}
        </div>
    )
}
