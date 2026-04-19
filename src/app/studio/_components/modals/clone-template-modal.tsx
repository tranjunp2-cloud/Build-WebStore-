'use client'
/**
 * Clone template modal — bundle CloneModal design.
 * Shows source → copy card, new name field, clone options checkboxes.
 */
import { useState } from 'react'
import { X, Copy } from 'lucide-react'
import { cloneTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
    onCloned: () => void
}

export function CloneTemplateModal({ template, onClose, onCloned }: Props) {
    const [name,    setName]    = useState(`${template.name} (copy)`)
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            await cloneTemplate(template.id, name.trim() || undefined)
            onCloned()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Clone failed')
        } finally {
            setLoading(false)
        }
    }

    const catStr = Array.isArray(template.category)
        ? template.category[0]
        : (template.category ?? '')

    return (
        <>
            <div className="modal-scrim" onClick={onClose} />
            <div className="modal">
                <div className="modal-head">
                    <span className="modal-title">Clone template</span>
                    <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Source → copy preview */}
                        <div
                            className="row"
                            style={{
                                marginBottom: 16,
                                padding: 12,
                                background: 'var(--bg-sunk)',
                                borderRadius: 'var(--radius)',
                                gap: 12,
                            }}
                        >
                            <div
                                className="ph"
                                style={{ aspectRatio: '16/10', width: 64, padding: 0, fontSize: 8, flexShrink: 0 }}
                            >
                                <span style={{ opacity: 0.6 }}>
                                    {template.name.slice(0, 4)}
                                </span>
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{template.name}</div>
                                <div className="muted mono" style={{ fontSize: 11 }}>{catStr}</div>
                            </div>
                            <div style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>→</div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{name || `${template.name} (copy)`}</div>
                                <div className="muted mono" style={{ fontSize: 11 }}>v0.1 · draft</div>
                            </div>
                        </div>

                        {/* New name */}
                        <div className="field">
                            <label>New template name</label>
                            <input
                                className="input"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Template name"
                                autoFocus
                            />
                        </div>

                        {/* Clone options */}
                        <div className="field">
                            <label>Clone options</label>
                            <div className="col" style={{ gap: 6 }}>
                                {[
                                    { label: 'Copy blocks & content',      defaultChecked: true },
                                    { label: 'Copy AI prompt keywords',    defaultChecked: true },
                                    { label: 'Copy analytics history',     defaultChecked: false },
                                    { label: 'Mark as featured immediately', defaultChecked: false },
                                ].map(opt => (
                                    <label
                                        key={opt.label}
                                        className="row"
                                        style={{ fontWeight: 400, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}
                                    >
                                        <input
                                            type="checkbox"
                                            className="cbx"
                                            defaultChecked={opt.defaultChecked}
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
                        )}
                    </div>

                    <div className="modal-foot">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
                            <Copy size={13} />
                            {loading ? 'Cloning…' : 'Clone template'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    )
}
