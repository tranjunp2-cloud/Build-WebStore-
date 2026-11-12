'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { fmtWhen } from '@/lib/admin/ai-usage/format'
import { hintsFromStored } from '@/lib/admin/ai-usage/override-form'
import { planLabelOfCode } from '@/lib/admin/ai-usage/caps-display'
import type { LimitValues } from '@/lib/admin/ai-settings/types'
import type { ShopOverrideListItem } from '@/lib/admin/ai-caps/shop-overrides'
import { ConfirmDialog } from '../../../_components/ai-limits/confirm-dialog'
import { OverrideBadge } from '../../../_components/ai-limits/override-badge'
import { OverrideEditor } from '../../../_components/ai-limits/override-editor'
import { overrideValues } from './override-values'
import styles from '../ai-settings.module.css'

interface Props {
    initial: ShopOverrideListItem[] | null
    failure: string | null
    limits: LimitValues
}

/** "Shop overrides": every shop with its own AI limits (active and expired), with Edit and Remove. */
export function ShopOverridesSection({ initial, failure, limits }: Props) {
    const [rows, setRows] = useState<ShopOverrideListItem[] | null>(initial)
    const [error, setError] = useState<string | null>(failure)
    const [editing, setEditing] = useState<ShopOverrideListItem | null>(null)
    const [removing, setRemoving] = useState<ShopOverrideListItem | null>(null)
    const [busy, setBusy] = useState(false)
    const [removeError, setRemoveError] = useState<string | null>(null)

    const reload = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/ai-settings/shops', { cache: 'no-store' })
            const body = (await res.json().catch(() => ({}))) as { overrides?: ShopOverrideListItem[]; error?: string }
            if (!res.ok || !body.overrides) throw new Error(body.error ?? `Could not load (${res.status})`)
            setRows(body.overrides); setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load shop overrides')
        }
    }, [])

    async function remove(row: ShopOverrideListItem) {
        setBusy(true); setRemoveError(null)
        try {
            const res = await fetch(`/api/admin/ai-settings/shops/${row.tenantId}`, { method: 'DELETE' })
            if (!res.ok && res.status !== 404) {
                const body = (await res.json().catch(() => ({}))) as { error?: string }
                throw new Error(body.error ?? `Remove failed (${res.status})`)
            }
            setRemoving(null); await reload()
        } catch (e) {
            setRemoveError(e instanceof Error ? e.message : 'Remove failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="aiq-card" aria-labelledby="ovr-title">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title" id="ovr-title">Shop overrides</div>
                    <div className="aiq-card-sub">Shops with their own AI limits. Set one from the shop&apos;s page (AI usage → shop). An override replaces the plan values it sets.</div>
                </div>
            </div>
            {error && (
                <div className={styles.notice} role="alert">
                    <b>Could not load shop overrides</b>
                    <p className={styles.small}>{error}</p>
                    <button type="button" className="btn btn-sm" onClick={reload}>Retry</button>
                </div>
            )}
            {!error && rows === null && <p className="acl-state" aria-busy="true">Loading…</p>}
            {!error && rows?.length === 0 && <p className="acl-state">No shop has its own limits. Every shop follows its plan.</p>}
            {!error && rows && rows.length > 0 && (
                <div className="acl-table-wrap">
                    <table className="tbl">
                        <thead><tr><th>Shop</th><th>Plan</th><th>Mode</th><th>Limits</th><th>Reason</th><th>Set by</th><th>Ends</th><th /></tr></thead>
                        <tbody>{rows.map((row) => (
                            <tr key={row.tenantId}>
                                <td><Link href={`/studio/performance/shops/${row.tenantId}`}>{row.shopName ?? `Shop #${row.tenantId}`}</Link></td>
                                <td>{planLabelOfCode(row.plan)}</td>
                                <td><OverrideBadge mode={row.mode} expired={row.expired} /></td>
                                <td>{overrideValues(row)}</td>
                                <td style={{ maxWidth: 220 }}>{row.reason}</td>
                                <td>{row.setBy?.email ?? '—'}</td>
                                <td>{row.expiresAt ? (row.expired ? <span className="badge acl-tone-mute">Expired</span> : fmtWhen(row.expiresAt)) : 'Until removed'}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    <button type="button" className="btn btn-sm btn-ghost" aria-label={`Edit override of ${row.shopName ?? row.tenantId}`} onClick={() => setEditing(row)}>Edit</button>
                                    <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove override of ${row.shopName ?? row.tenantId}`} onClick={() => { setRemoveError(null); setRemoving(row) }}>Remove</button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
            {editing && (
                <OverrideEditor
                    tenantId={editing.tenantId} shopName={editing.shopName} existing={editing} planLabel={planLabelOfCode(editing.plan)}
                    planHints={hintsFromStored(limits, editing.plan)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload() }}
                />
            )}
            {removing && (
                <ConfirmDialog
                    title={`Remove the override of ${removing.shopName ?? `shop #${removing.tenantId}`}?`} confirmLabel="Remove override" busy={busy} error={removeError}
                    onCancel={() => setRemoving(null)} onConfirm={() => remove(removing)}
                >
                    <p className="acl-hint">The {planLabelOfCode(removing.plan)} plan limits apply again within ~1 min.</p>
                </ConfirmDialog>
            )}
        </section>
    )
}
