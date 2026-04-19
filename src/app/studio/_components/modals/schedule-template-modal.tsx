'use client'
/**
 * Schedule template modal — bundle style date/time picker.
 * Works for single-template and bulk-schedule flows.
 * When template is null → bulk mode (onScheduled receives ISO string).
 */
import { useState } from 'react'
import { X, Clock } from 'lucide-react'
import { patchTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type SingleProps = {
    template: AdminTemplate
    onClose: () => void
    onScheduled: () => void
}
type BulkProps = {
    template: null
    onClose: () => void
    onScheduled: (scheduledFor: string) => void
}
type Props = SingleProps | BulkProps

function isBulk(p: Props): p is BulkProps { return p.template === null }

function defaultDt() {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    return d.toISOString().slice(0, 16)
}

export function ScheduleTemplateModal(props: Props) {
    const { onClose } = props
    const [datetime, setDatetime] = useState(defaultDt)
    const [loading,  setLoading]  = useState(false)
    const [error,    setError]    = useState<string | null>(null)

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!datetime) { setError('Please select a date and time'); return }
        const iso = new Date(datetime).toISOString()
        setLoading(true)
        setError(null)
        try {
            if (isBulk(props)) {
                props.onScheduled(iso)
            } else {
                await patchTemplate(props.template.id, { status: 'scheduled', scheduledFor: iso })
                props.onScheduled()
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Schedule failed')
            setLoading(false)
        }
    }

    const templateName = !isBulk(props) ? props.template.name : null

    return (
        <>
            <div className="modal-scrim" onClick={onClose} />
            <div className="modal">
                <div className="modal-head">
                    <span className="modal-title">Schedule publish</span>
                    <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={e => void handleConfirm(e)}>
                    <div className="modal-body">
                        {templateName && (
                            <div className="field">
                                <label>Template</label>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{templateName}</div>
                            </div>
                        )}
                        {isBulk(props) && (
                            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                                Selected templates will go live at the chosen date and time.
                            </p>
                        )}

                        <div className="field">
                            <label htmlFor="sched-dt">Publish date &amp; time</label>
                            <input
                                id="sched-dt"
                                type="datetime-local"
                                className="input"
                                value={datetime}
                                min={new Date().toISOString().slice(0, 16)}
                                onChange={e => setDatetime(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
                        )}
                    </div>

                    <div className="modal-foot">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading || !datetime}>
                            <Clock size={13} />
                            {loading ? 'Scheduling…' : 'Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    )
}
