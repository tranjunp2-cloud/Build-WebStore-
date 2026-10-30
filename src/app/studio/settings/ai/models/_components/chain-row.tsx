'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { chainOptions } from '@/lib/admin/ai-providers/chain-options'
import { skipText, splitRef } from '@/lib/admin/ai-providers/status'
import type { SettingsView, TierId } from '@/lib/admin/ai-providers/types'
import { ToneBadge } from './badges'

interface Props {
    view: SettingsView
    tier: TierId
    chain: string[]
    index: number
    priced: ReadonlySet<string> | null
    tierName: string
    onPick: (ref: string) => void
    onMove: (delta: -1 | 1) => void
    onRemove: () => void
}

/** Where a chain entry stands according to the saved settings (a new, unsaved entry has no status yet). */
function RowStatus({ view, tier, ref }: { view: SettingsView; tier: TierId; ref: string }) {
    const health = view.health[tier]
    if (!ref) return <span className="pm-chain-st">Choose a model</span>
    if (health.serving === ref) return <ToneBadge tone="ok">Answers now</ToneBadge>
    const skipped = health.skipped.find((item) => item.model === ref)
    if (skipped) {
        const quota = view.providers.find((p) => p.id === splitRef(ref)[0])?.lastTest?.code === 'quota'
        return <span className={`pm-chain-st ${quota ? 'pm-warn' : 'pm-err'}`}>Skipped: {skipText(skipped.reason, view.providers.find((p) => p.id === splitRef(ref)[0]))}</span>
    }
    return <span className="pm-chain-st">{view.routing.tiers[tier].chain.includes(ref) ? 'Standby' : 'Not saved yet'}</span>
}

const OTHER = '__other__'

/** A typed "provider:model" is usable when its provider exists here (self-hosted ids are not in any list). */
export function typedRefProblem(view: SettingsView, text: string): string | null {
    const value = text.trim()
    if (!/^[a-z0-9-]+:\S+$/.test(value)) return 'Use provider:model, e.g. compat-vllm:llama-3.1-70b'
    if (!view.providers.some((p) => p.id === splitRef(value)[0])) return `No provider "${splitRef(value)[0]}". Add it under Providers first.`
    return null
}

/** One entry of a chain: a model picker (usable providers only), its status, and move / remove buttons. */
export function ChainRow({ view, tier, chain, index, priced, tierName, onPick, onMove, onRemove }: Props) {
    const ref = chain[index]
    const groups = chainOptions(view, tier, chain, index, priced)
    const unpriced = Boolean(ref) && priced !== null && !priced.has(ref)
    const [typing, setTyping] = useState(false)
    const [typed, setTyped] = useState('')
    const problem = typed ? typedRefProblem(view, typed) : null
    const applyTyped = () => { if (!typedRefProblem(view, typed)) { onPick(typed.trim()); setTyping(false); setTyped('') } }
    return (
        <li data-serving={view.health[tier].serving === ref && ref ? '' : undefined}>
            <span className="pm-pos">{index + 1}</span>
            {typing ? (
                <span className="pm-chain-typed">
                    <input className="input pm-in pm-mono" autoFocus value={typed} placeholder="provider:model" aria-label={`${tierName} model ${index + 1}, type a model id`}
                        aria-invalid={problem ? true : undefined} onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyTyped() } if (e.key === 'Escape') setTyping(false) }} />
                    <button type="button" className="btn btn-sm" disabled={!typed || Boolean(problem)} onClick={applyTyped}>Use</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setTyping(false)}>Cancel</button>
                    {problem && <span className="pm-chain-st pm-err" role="alert">{problem}</span>}
                </span>
            ) : (
            <select className="pm-select pm-mono" value={ref} aria-label={`${tierName} model ${index + 1}`} onChange={(e) => (e.target.value === OTHER ? setTyping(true) : onPick(e.target.value))}>
                {!ref && <option value="">Choose a model</option>}
                {groups.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                        {group.options.map((option) => (
                            <option key={option.ref} value={option.ref} disabled={option.taken}>
                                {option.model}{option.taken ? ' (already in this chain)' : option.notes.length ? ` — ${option.notes.join(' · ')}` : ''}
                            </option>
                        ))}
                    </optgroup>
                ))}
                <option value={OTHER}>Type a model id…</option>
            </select>
            )}
            <span className="pm-chain-meta">
                <RowStatus view={view} tier={tier} ref={ref} />
                {unpriced && <span className="badge acl-tone-warn pm-nodot" title="Usage counts $0 until a price is set in Limits & prices">No price</span>}
            </span>
            <span className="pm-chain-btns">
                <button type="button" className="pm-icbtn" aria-label={`Move ${tierName} model ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="pm-ic" aria-hidden="true" /></button>
                <button type="button" className="pm-icbtn" aria-label={`Move ${tierName} model ${index + 1} down`} disabled={index === chain.length - 1} onClick={() => onMove(1)}><ArrowDown className="pm-ic" aria-hidden="true" /></button>
                <button type="button" className="pm-icbtn" aria-label={`Remove ${tierName} model ${index + 1}`} onClick={onRemove}><X className="pm-ic" aria-hidden="true" /></button>
            </span>
        </li>
    )
}
