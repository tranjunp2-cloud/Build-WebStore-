'use client'

import { ConfirmDialog } from '@/app/studio/_components/ai-limits/confirm-dialog'
import { providerName, servingWithout, TIER_META } from '@/lib/admin/ai-providers/status'
import { TIER_IDS, type SettingsView } from '@/lib/admin/ai-providers/types'

interface Props {
    view: SettingsView
    id: string
    busy: boolean
    error: string | null
    onCancel: () => void
    onConfirm: () => void
}

/** Says, tier by tier, which model answers once this provider's key is gone — or that the tier stops working. */
export function RemoveKeyDialog({ view, id, busy, error, onCancel, onConfirm }: Props) {
    const name = providerName(view, id)
    const hit = TIER_IDS.filter((tier) => view.routing.tiers[tier].chain.some((ref) => ref.startsWith(`${id}:`)))
    return (
        <ConfirmDialog title={`Remove the ${name} key?`} confirmLabel="Remove key" busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}>
            <p className="acl-hint">{name} goes back to the key in the environment, if there is one. Chains skip it from the next call when there is none.</p>
            <ul>
                {hit.length === 0 && <li>No chain uses it.</li>}
                {hit.map((tier) => {
                    const next = servingWithout(view, tier, id)
                    return (
                        <li key={tier}>
                            <b>{TIER_META[tier].name}</b>:{' '}
                            {next ? <>{next} answers instead</> : <span className="pm-err">no model left: {TIER_META[tier].name} stops working</span>}
                        </li>
                    )
                })}
            </ul>
        </ConfirmDialog>
    )
}
