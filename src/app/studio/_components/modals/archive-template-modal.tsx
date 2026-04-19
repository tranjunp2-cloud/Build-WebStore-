'use client'
/**
 * Archive template confirm modal — bundle style confirm dialog.
 * Warn message + confirm button (destructive).
 */
import { useState } from 'react'
import { X, Archive } from 'lucide-react'
import { patchTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
    onArchived: () => void
}

export function ArchiveTemplateModal({ template, onClose, onArchived }: Props) {
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState<string | null>(null)

    const handleConfirm = async () => {
        setLoading(true)
        setError(null)
        try {
            await patchTemplate(template.id, { status: 'archived' })
            onArchived()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Archive failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="modal-scrim" onClick={onClose} />
            <div className="modal">
                <div className="modal-head">
                    <span className="modal-title">Archive template</span>
                    <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
                        <X size={15} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="warn-banner" style={{
                        background: 'rgba(220,38,38,0.06)',
                        border: '1px solid rgba(220,38,38,0.2)',
                        color: 'var(--danger)',
                    }}>
                        ⚠ <strong>{template.name}</strong> will be removed from the Template Gallery
                        and hidden from all users. You can restore it later by changing status back to draft.
                    </div>

                    {error && (
                        <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>{error}</p>
                    )}
                </div>

                <div className="modal-foot">
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="btn"
                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        onClick={() => void handleConfirm()}
                        disabled={loading}
                    >
                        <Archive size={13} />
                        {loading ? 'Archiving…' : 'Archive template'}
                    </button>
                </div>
            </div>
        </>
    )
}
