'use client'

import type { ReactNode } from 'react'
import { Dialog } from './dialog'

interface Props {
    title: string
    /** lines of what will change */
    lines?: string[]
    children?: ReactNode
    confirmLabel: string
    busy?: boolean
    error?: string | null
    onCancel: () => void
    onConfirm: () => void
}

export function ConfirmDialog({ title, lines, children, confirmLabel, busy = false, error, onCancel, onConfirm }: Props) {
    return (
        <Dialog title={title} role="alertdialog" busy={busy} onClose={onCancel}>
            {lines && lines.length > 0 && <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>}
            {children}
            {error && <p className="acl-err" role="alert">{error}</p>}
            <div className="acl-actions">
                <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={onConfirm} disabled={busy}>{busy ? 'Saving…' : confirmLabel}</button>
            </div>
        </Dialog>
    )
}
