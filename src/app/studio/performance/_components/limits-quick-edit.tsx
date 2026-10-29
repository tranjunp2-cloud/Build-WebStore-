'use client'

import { useState } from 'react'
import { capsBody, capsDraftFromView, capsProblems, describeCapsChanges } from '@/lib/admin/ai-usage/caps-form'
import { putSettings } from '@/lib/admin/ai-usage/put-settings'
import type { CapsView } from '@/lib/admin/ai-settings/types'
import { CapsFields } from '../../_components/ai-limits/caps-fields'
import { ConfirmDialog } from '../../_components/ai-limits/confirm-dialog'
import { Dialog } from '../../_components/ai-limits/dialog'

interface Props {
    caps: CapsView
    onClose: () => void
    /** saved: refresh the data behind the page */
    onSaved: () => void
}

/** Quick edit of the platform daily cap, monthly cap and "pause Free first" share. Alert thresholds stay as saved. */
export function LimitsQuickEdit({ caps, onClose, onSaved }: Props) {
    const [draft, setDraft] = useState(() => capsDraftFromView(caps))
    const [confirming, setConfirming] = useState(false)
    const [saving, setSaving] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const problems = capsProblems(draft)
    const lines = describeCapsChanges(draft, caps)
    const invalid = Object.keys(problems).length > 0

    async function save() {
        setSaving(true); setFailure(null)
        const result = await putSettings({ caps: capsBody(draft) })
        setSaving(false)
        if (result.ok) onSaved()
        else setFailure(result.message)
    }

    if (confirming) {
        return (
            <ConfirmDialog
                title={`Save ${lines.length} ${lines.length === 1 ? 'change' : 'changes'}?`} lines={lines} confirmLabel="Save changes" busy={saving} error={failure}
                onCancel={() => { setConfirming(false); setFailure(null) }} onConfirm={save}
            >
                <p className="acl-hint">Takes effect within ~6 min.</p>
            </ConfirmDialog>
        )
    }
    return (
        <Dialog title="Edit platform caps" onClose={onClose}>
            <p className="acl-hint">One ceiling for all shops together, on top of each plan and shop limit. Malaysia time.</p>
            <CapsFields idPrefix="qe" draft={draft} view={caps} problems={problems} showAlerts={false} onChange={setDraft} />
            <div className="acl-actions">
                <button type="button" className="btn btn-sm" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={invalid || lines.length === 0} onClick={() => setConfirming(true)}>Review changes</button>
            </div>
        </Dialog>
    )
}
