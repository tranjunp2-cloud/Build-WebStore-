'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtWhen } from '@/lib/admin/ai-usage/format'
import { hintsFromLimits } from '@/lib/admin/ai-usage/override-form'
import { limitRows } from '@/lib/admin/ai-usage/shop-limit-rows'
import { planLabelOfCode } from '@/lib/admin/ai-usage/caps-display'
import type { ShopLimitView } from '@/lib/admin/ai-caps/shop-overrides'
import { ConfirmDialog } from '../../_components/ai-limits/confirm-dialog'
import { OverrideBadge } from '../../_components/ai-limits/override-badge'
import { OverrideEditor } from '../../_components/ai-limits/override-editor'
import '../../_components/ai-limits/ai-limits.css'
import { CardHead } from './au-parts'

interface Props {
    tenantId: number
    shopName: string | null
    /** null = the override could not be loaded */
    view: ShopLimitView | null
    retryHref: string
}

/** "AI limit for this shop": what applies now and where each value comes from (plan or override), with Set / Edit / Remove. */
export function ShopLimitCard({ tenantId, shopName, view, retryHref }: Props) {
    const router = useRouter()
    const [refreshing, startRefresh] = useTransition()
    const [editing, setEditing] = useState(false)
    const [removing, setRemoving] = useState(false)
    const [busy, setBusy] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const refresh = () => startRefresh(() => router.refresh())

    if (!view) {
        return (
            <section className="card aiq-card" aria-label="AI limit for this shop">
                <CardHead title="AI limit for this shop" />
                <div className="acl-state" role="alert">
                    <p>Could not load this shop&apos;s AI limits. Nothing was changed.</p>
                    <Link className="btn btn-sm" href={retryHref}>Try again</Link>
                </div>
            </section>
        )
    }

    const { override } = view
    const planName = planLabelOfCode(view.plan)
    const rows = limitRows(view.planLimits, view.effective, override)

    async function remove() {
        setBusy(true); setFailure(null)
        try {
            const res = await fetch(`/api/admin/ai-settings/shops/${tenantId}`, { method: 'DELETE' })
            if (!res.ok && res.status !== 404) {
                const body = (await res.json().catch(() => ({}))) as { error?: string }
                throw new Error(body.error ?? `Remove failed (${res.status})`)
            }
            setRemoving(false); refresh()
        } catch (error) {
            setFailure(error instanceof Error ? error.message : 'Remove failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="card aiq-card" aria-label="AI limit for this shop">
            <CardHead
                title="AI limit for this shop"
                sub={override && !override.expired ? `${planName} plan with this shop's own override on top.` : `${planName} plan limits. Set an override to give this shop its own.`}
                action={
                    <div style={{ display: 'flex', gap: 8 }}>
                        {override
                            ? <><button type="button" className="btn btn-sm" disabled={refreshing} onClick={() => setEditing(true)}>Edit</button>
                                <button type="button" className="btn btn-sm btn-ghost" disabled={refreshing} onClick={() => { setFailure(null); setRemoving(true) }}>Remove</button></>
                            : <button type="button" className="btn btn-sm btn-primary" disabled={refreshing} onClick={() => setEditing(true)}>Set override</button>}
                    </div>
                }
            />
            {override && (
                <div className="acl-meta">
                    <OverrideBadge mode={override.mode} expired={override.expired} />
                    <span><b>Why:</b> {override.reason}</span>
                    <span>{override.setBy?.email ? `Set by ${override.setBy.email}` : 'Set by staff'}</span>
                    <span>{override.expiresAt ? `${override.expired ? 'Ended' : 'Ends'} ${fmtWhen(override.expiresAt)}` : 'Until removed'}</span>
                    {override.expired && <span className="acl-warn">Expired: the plan applies.</span>}
                </div>
            )}
            <div className="acl-table-wrap">
                <table className="tbl">
                    <thead><tr><th>Limit</th><th className="num">{planName} plan</th><th className="num">Override</th><th className="num">Applies now</th><th>From</th></tr></thead>
                    <tbody>{rows.map((row) => (
                        <tr key={row.key}>
                            <td>{row.label}</td>
                            <td className="num">{row.plan}</td>
                            <td className="num">{row.override ?? '—'}</td>
                            <td className="num"><b>{row.applied}</b></td>
                            <td><span className="acl-src" data-from={row.from}>{row.from === 'override' ? 'Override' : 'Plan'}</span></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            {editing && (
                <OverrideEditor
                    tenantId={tenantId} shopName={shopName} existing={override} planLabel={planName} planHints={hintsFromLimits(view.planLimits)}
                    onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh() }}
                />
            )}
            {removing && (
                <ConfirmDialog title="Remove this override?" confirmLabel="Remove override" busy={busy} error={failure} onCancel={() => setRemoving(false)} onConfirm={remove}>
                    <p className="acl-hint">The {planName} plan limits apply again within ~1 min.</p>
                </ConfirmDialog>
            )}
        </section>
    )
}
