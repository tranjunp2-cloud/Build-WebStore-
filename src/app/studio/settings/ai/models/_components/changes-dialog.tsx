'use client'

import { ConfirmDialog } from '@/app/studio/_components/ai-limits/confirm-dialog'

interface Props {
    lines: string[]
    busy: boolean
    error?: string | null
    onCancel: () => void
    onConfirm: () => void
}

/** "Save N changes?" — lists what will change before anything is written. */
export function ChangesDialog({ lines, busy, error, onCancel, onConfirm }: Props) {
    return (
        <ConfirmDialog
            title={`Save ${lines.length} ${lines.length === 1 ? 'change' : 'changes'}?`} lines={lines} confirmLabel="Save changes"
            busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
        >
            <p className="acl-hint">Takes effect within 1 min for every shop. Saved as a new version in History, so you can restore the old one.</p>
        </ConfirmDialog>
    )
}
