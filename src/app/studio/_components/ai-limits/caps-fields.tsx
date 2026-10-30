'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
    addAlertPercent, dailyIsOn, type CapsDraft, type CapsProblems,
} from '@/lib/admin/ai-usage/caps-form'
import { fmtCapUsd } from '@/lib/admin/ai-usage/caps-display'
import type { CapsView } from '@/lib/admin/ai-settings/types'
import { Switch } from './switch'
import './ai-limits.css'

interface Props {
    idPrefix: string
    draft: CapsDraft
    view: CapsView
    problems: CapsProblems
    /** alert thresholds are edited on the Settings page only */
    showAlerts?: boolean
    onChange: (next: CapsDraft) => void
}

interface RowProps {
    id: string
    label: string
    on: boolean
    value: string
    unit: '$' | '%'
    help?: string
    error?: string
    placeholder?: string
    onToggle: (on: boolean) => void
    onValue: (value: string) => void
}

function CapRow({ id, label, on, value, unit, help, error, placeholder, onToggle, onValue }: RowProps) {
    return (
        <div>
            <div className="acl-row">
                <span className="acl-label" id={`${id}-l`}>{label}</span>
                <Switch checked={on} onChange={onToggle} labelledBy={`${id}-l ${id}-s`}><span id={`${id}-s`}>{on ? 'On' : 'Off'}</span></Switch>
                <span className="acl-num" data-disabled={on ? undefined : ''} data-invalid={error ? '' : undefined}>
                    {unit === '$' && <span>$</span>}
                    <input
                        inputMode="decimal" disabled={!on} value={on ? value : ''} placeholder={on ? placeholder : 'No cap'}
                        aria-labelledby={`${id}-l`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined}
                        onChange={(event) => onValue(event.target.value)}
                    />
                    {unit === '%' && <span>%</span>}
                </span>
            </div>
            {error && <p className="acl-err" id={`${id}-e`}>{error}</p>}
            {help && <p className="acl-hint">{help}</p>}
        </div>
    )
}

export function CapsFields({ idPrefix, draft, view, problems, showAlerts = true, onChange }: Props) {
    const [alertInput, setAlertInput] = useState('')
    const [alertError, setAlertError] = useState<string | null>(null)
    const dailyOn = dailyIsOn(draft, view)
    const inherit = draft.daily.mode === 'inherit'
    const envNote = inherit && view.envDailyUsd !== null
        ? `From environment: ${fmtCapUsd(view.envDailyUsd)}. Type an amount to set your own.`
        : inherit ? 'The environment sets no daily cap.' : undefined

    const addAlert = () => {
        const result = addAlertPercent(draft.alerts, alertInput)
        if ('error' in result) { setAlertError(result.error); return }
        setAlertError(null); setAlertInput(''); onChange({ ...draft, alerts: result.list })
    }
    return (
        <div className="acl-form">
            <CapRow
                id={`${idPrefix}-daily`} label="Daily cap (all shops)" on={dailyOn} unit="$" help={envNote}
                value={draft.daily.value} error={problems.daily} placeholder={inherit && view.envDailyUsd !== null ? String(view.envDailyUsd) : ''}
                onToggle={(on) => onChange({ ...draft, daily: on ? { mode: 'on', value: view.effective.dailyUsd === null ? '' : String(view.effective.dailyUsd) } : { mode: 'off', value: '' } })}
                onValue={(value) => onChange({ ...draft, daily: { mode: 'on', value } })}
            />
            <CapRow
                id={`${idPrefix}-monthly`} label="Monthly cap (all shops)" on={draft.monthly.on} unit="$" value={draft.monthly.value} error={problems.monthly}
                help="Calendar month, Malaysia time."
                onToggle={(on) => onChange({ ...draft, monthly: { on, value: on ? draft.monthly.value : '' } })}
                onValue={(value) => onChange({ ...draft, monthly: { on: true, value } })}
            />
            <CapRow
                id={`${idPrefix}-pause`} label="Pause Free first at" on={draft.pause.on} unit="%" value={draft.pause.value} error={problems.pause}
                help="At this share of the daily or monthly cap, Free shops are paused. Everyone is paused at 100 %."
                onToggle={(on) => onChange({ ...draft, pause: { on, value: on ? draft.pause.value || '80' : '' } })}
                onValue={(value) => onChange({ ...draft, pause: { on: true, value } })}
            />
            {showAlerts && (
                <div>
                    <div className="acl-row">
                        <span className="acl-label" id={`${idPrefix}-alerts-l`}>Alert thresholds</span>
                        <div className="acl-chips" role="list" aria-labelledby={`${idPrefix}-alerts-l`}>
                            {draft.alerts.length === 0 && <span className="acl-hint">No alerts</span>}
                            {draft.alerts.map((value) => (
                                <span className="acl-chip" role="listitem" key={value}>{value} %
                                    <button type="button" aria-label={`Remove ${value} %`} onClick={() => onChange({ ...draft, alerts: draft.alerts.filter((item) => item !== value) })}><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <span className="acl-num" data-invalid={alertError ? '' : undefined}>
                            <input
                                inputMode="numeric" placeholder="Add %" aria-label="Add alert threshold in percent" value={alertInput} style={{ width: 64 }}
                                onChange={(event) => { setAlertInput(event.target.value); setAlertError(null) }}
                                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addAlert() } }}
                            />
                        </span>
                        <button type="button" className="btn btn-sm" onClick={addAlert} disabled={alertInput.trim() === ''}>Add</button>
                    </div>
                    {(alertError ?? problems.alerts) && <p className="acl-err" role="alert">{alertError ?? problems.alerts}</p>}
                    <p className="acl-hint">Each threshold writes one alert per day / month (and posts to Lark when it is set up).</p>
                </div>
            )}
        </div>
    )
}
