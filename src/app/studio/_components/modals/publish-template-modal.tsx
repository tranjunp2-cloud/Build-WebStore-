'use client'
/**
 * Publish template modal — bundle PublishModal design.
 * Warn banner + publish-now vs schedule radio + release notes + notify checkbox.
 */
import { useState } from 'react'
import { X, Rocket } from 'lucide-react'
import { patchTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
    onPublished: () => void
}

export function PublishTemplateModal({ template, onClose, onPublished }: Props) {
    const [when,    setWhen]    = useState<'now' | 'sched'>('now')
    const [date,    setDate]    = useState('')
    const [time,    setTime]    = useState('09:00')
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState<string | null>(null)

    const handleConfirm = async () => {
        setLoading(true)
        setError(null)
        try {
            if (when === 'now') {
                await patchTemplate(template.id, { status: 'live' })
            } else {
                const iso = new Date(`${date}T${time}`).toISOString()
                await patchTemplate(template.id, { status: 'scheduled', scheduledFor: iso })
            }
            onPublished()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Publish failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="modal-scrim" onClick={onClose} />
            <div className="modal">
                <div className="modal-head">
                    <span className="modal-title">Publish template</span>
                    <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
                        <X size={15} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Warn banner */}
                    <div className="warn-banner">
                        ⚠ After publishing, this template will appear in the Gallery for all users.
                        This action cannot be undone directly.
                    </div>

                    {/* Template name */}
                    <div className="field">
                        <label>Template</label>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {template.name}
                        </div>
                    </div>

                    {/* When */}
                    <div className="field">
                        <label>Publish timing</label>
                        <div className="col" style={{ gap: 6 }}>
                            <label className="row" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="pub-when"
                                    checked={when === 'now'}
                                    onChange={() => setWhen('now')}
                                />
                                Publish immediately
                            </label>
                            <label className="row" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="pub-when"
                                    checked={when === 'sched'}
                                    onChange={() => setWhen('sched')}
                                />
                                Schedule for later
                            </label>
                            {when === 'sched' && (
                                <div className="row" style={{ paddingLeft: 20, gap: 8 }}>
                                    <input
                                        className="input"
                                        type="date"
                                        style={{ width: 160 }}
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        min={new Date().toISOString().slice(0, 10)}
                                    />
                                    <input
                                        className="input"
                                        type="time"
                                        style={{ width: 100 }}
                                        value={time}
                                        onChange={e => setTime(e.target.value)}
                                    />
                                    <span className="muted" style={{ fontSize: 12 }}>GMT+7</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Release notes */}
                    <div className="field">
                        <label>Release notes</label>
                        <textarea
                            className="input"
                            placeholder="What's new in this version?"
                        />
                    </div>

                    {/* Notify */}
                    <div className="field" style={{ marginBottom: 0 }}>
                        <label className="row" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                            <input type="checkbox" className="cbx" defaultChecked />
                            Notify subscribers using this template
                        </label>
                    </div>

                    {error && (
                        <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>
                    )}
                </div>

                <div className="modal-foot">
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => void handleConfirm()}
                        disabled={loading || (when === 'sched' && !date)}
                    >
                        <Rocket size={13} />
                        {loading ? 'Publishing…' : when === 'now' ? 'Publish now' : 'Schedule'}
                    </button>
                </div>
            </div>
        </>
    )
}
