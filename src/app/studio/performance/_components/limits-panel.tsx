'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { PLATFORM_STATE_LABEL, PLATFORM_STATE_TONE, fmtCapUsd, fmtSpendUsd, fmtPct } from '@/lib/admin/ai-usage/caps-display'
import { enabledChanges, planSwitches, type PlanSwitch } from '@/lib/admin/ai-usage/plan-switch'
import { putSettings } from '@/lib/admin/ai-usage/put-settings'
import type { CapsStatus } from '@/lib/admin/ai-caps/status'
import { CapMeter } from '../../_components/ai-limits/cap-meter'
import { ConfirmDialog } from '../../_components/ai-limits/confirm-dialog'
import { Switch } from '../../_components/ai-limits/switch'
import '../../_components/ai-limits/ai-limits.css'
import { CardHead, GoLink } from './au-parts'
import { LimitsLists } from './limits-lists'
import { LimitsQuickEdit } from './limits-quick-edit'

interface Props {
    /** null = the status could not be loaded */
    status: CapsStatus | null
    retryHref: string
}

/** "AI limits" block of the Overview: platform spend against its caps, per-plan AI switches, shops near or at their limits, alerts. */
export function LimitsPanel({ status, retryHref }: Props) {
    const router = useRouter()
    const [refreshing, startRefresh] = useTransition()
    const [editing, setEditing] = useState(false)
    const [toggle, setToggle] = useState<{ plan: PlanSwitch; on: boolean } | null>(null)
    const [saving, setSaving] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)

    if (!status) {
        return (
            <section className="card aiq-card" aria-label="AI limits">
                <CardHead title="AI limits" sub="Live" action={<GoLink href="/studio/settings/ai">All limits</GoLink>} />
                <div className="acl-state" role="alert">
                    <p>Could not load the AI limits. The data source did not answer. Nothing was changed.</p>
                    <Link className="btn btn-sm" href={retryHref}>Try again</Link>
                </div>
            </section>
        )
    }

    const { platform, caps } = status
    const alerts = caps.effective.alertPercents
    const noCaps = caps.effective.dailyUsd === null && caps.effective.monthlyUsd === null
    const refresh = () => startRefresh(() => router.refresh())

    async function confirmToggle() {
        if (!toggle) return
        setSaving(true); setFailure(null)
        const result = await putSettings({ limits: enabledChanges(toggle.plan, toggle.on) })
        setSaving(false)
        if (!result.ok) { setFailure(result.message); return }
        setToggle(null); refresh()
    }

    return (
        <section className="card aiq-card" aria-label="AI limits">
            <CardHead
                title="AI limits"
                sub={`Live, not affected by the period above. Today is ${status.day}, Malaysia time.`}
                action={
                    <div className="au-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${PLATFORM_STATE_TONE[platform.state]}`} aria-label={`Platform state: ${PLATFORM_STATE_LABEL[platform.state]}`}>{PLATFORM_STATE_LABEL[platform.state]}</span>
                        <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}><Pencil size={14} />Edit</button>
                        <GoLink href="/studio/settings/ai">All limits</GoLink>
                    </div>
                }
            />
            <div className="acl-grid2">
                <div>
                    <div className="acl-cap-label">Platform today</div>
                    <p className="acl-big">{fmtSpendUsd(platform.todayUsd)} <span>{caps.effective.dailyUsd === null ? 'no daily cap' : `of ${fmtCapUsd(caps.effective.dailyUsd)}`}</span></p>
                    {caps.effective.dailyUsd !== null && <CapMeter percent={platform.dailyPercent} alertPercents={alerts} label="Spend against the daily cap" />}
                    <p className="acl-hint">{platform.dailyPercent === null ? 'Set a daily cap with Edit.' : `${fmtPct(platform.dailyPercent)} of the daily cap${caps.dailySource === 'env' ? ' (from the environment)' : ''}.`}</p>
                </div>
                <div>
                    <div className="acl-cap-label">This month so far</div>
                    <p className="acl-big">{fmtSpendUsd(platform.monthUsd)} <span>{caps.effective.monthlyUsd === null ? 'no monthly cap' : `of ${fmtCapUsd(caps.effective.monthlyUsd)}`}</span></p>
                    {caps.effective.monthlyUsd !== null && <CapMeter percent={platform.monthlyPercent} alertPercents={alerts} label="Spend against the monthly cap" />}
                    <p className="acl-hint">
                        Forecast {fmtSpendUsd(platform.forecastMonthUsd)} at the current pace
                        {platform.forecastMonthlyPercent !== null && ` (${fmtPct(platform.forecastMonthlyPercent)} of the cap)`}.
                    </p>
                </div>
            </div>
            {noCaps && <p className="acl-state" style={{ paddingTop: 0 }}>No platform cap is on. AI spend is only limited per plan and per shop.</p>}
            <div className="acl-plans" role="group" aria-label="AI on or off per plan">
                <span className="acl-cap-label">AI by plan</span>
                {planSwitches(status.disabledPlans).map((plan) => (
                    <Switch key={plan.id} checked={plan.mixed ? 'mixed' : plan.on} disabled={refreshing} onChange={(on) => { setFailure(null); setToggle({ plan, on }) }}>
                        {plan.label}
                    </Switch>
                ))}
            </div>
            <LimitsLists status={status} />
            {editing && <LimitsQuickEdit caps={caps} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh() }} />}
            {toggle && (
                <ConfirmDialog
                    title={`Turn AI ${toggle.on ? 'on' : 'off'} for the ${toggle.plan.label} plan?`} confirmLabel={toggle.on ? 'Turn on' : 'Turn off'} busy={saving} error={failure}
                    onCancel={() => setToggle(null)} onConfirm={confirmToggle}
                >
                    <p className="acl-hint">
                        {toggle.on ? 'Shops on this plan can use AI again' : 'Shops on this plan get "AI is not included in this shop\'s plan."'}
                        {' '}within ~6 min. Applies to {toggle.plan.codes.length === 1 ? 'plan code' : 'plan codes'} <span className="acl-mono">{toggle.plan.codes.join(', ')}</span>. A shop override still wins.
                    </p>
                </ConfirmDialog>
            )}
        </section>
    )
}

/** Placeholder while the page streams (loading.tsx). */
export function LimitsPanelSkeleton() {
    return (
        <section className="card" aria-busy="true" aria-label="Loading AI limits">
            <div className="card-head"><span className="acl-skel" style={{ width: 120 }} /></div>
            <div className="acl-grid2">{[0, 1].map((i) => <div key={i} style={{ display: 'grid', gap: 10 }}><span className="acl-skel" style={{ width: 90 }} /><span className="acl-skel" style={{ width: 140, height: 22 }} /><span className="acl-skel" style={{ width: '100%', height: 8 }} /></div>)}</div>
        </section>
    )
}
