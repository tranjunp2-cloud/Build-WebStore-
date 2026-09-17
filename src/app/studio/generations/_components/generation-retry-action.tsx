'use client'

import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GenerationRecord } from './generation-types'

export function GenerationRetryAction({ record, onAccepted }: { record: GenerationRecord; onAccepted: (id: string) => void }) {
    const [confirming, setConfirming] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [accepted, setAccepted] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    if (record.recoveryPolicy.action === 'monitor' && record.recoveryStatus === 'retrying') {
        return <button type="button" className="btn btn-sm" disabled aria-label={`Đang gen lại website ${record.id}`}>Đang xử lý</button>
    }
    if (record.recoveryPolicy.action !== 'retry_website') return null
    const openConfirmation = () => { setMessage(null); setConfirming(true) }
    const confirm = async () => {
        setSubmitting(true); setMessage(null)
        try {
            const response = await fetch(`/api/admin/generations/${record.id}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason: 'ops_manual_retry' }) })
            if (response.status === 202) { setAccepted(true); onAccepted(record.id); setConfirming(false); return }
            const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
            // 409 is only an idempotent success when the API has confirmed an
            // existing recovery job. Other conflicts (for example exhausted
            // policy) must stay actionable and show their server-safe reason.
            if (response.status === 409 && body?.error?.code === 'RETRY_IN_PROGRESS') {
                setAccepted(true); onAccepted(record.id); setConfirming(false); return
            }
            setMessage(body?.error?.message ?? 'Chưa thể xếp hàng gen lại. Vui lòng thử lại.')
        } catch { setMessage('Chưa thể kết nối để xếp hàng gen lại. Vui lòng thử lại.') }
        finally { setSubmitting(false) }
    }
    return <>
        <button type="button" className="btn btn-sm f41-retry-trigger" aria-label={`Gen lại website ${record.id}`} onClick={openConfirmation} disabled={accepted}>{accepted ? 'Đang gen lại' : <><RotateCw size={13} aria-hidden />Gen lại</>}</button>
        <Dialog open={confirming} onOpenChange={(open) => { if (!submitting) { setConfirming(open); if (!open) setMessage(null) } }}>
            <DialogContent className="f41-retry-dialog" style={{ maxWidth: 500 }}>
                <DialogHeader>
                    <DialogTitle>Gen lại toàn bộ website?</DialogTitle>
                    <DialogDescription className="f41-retry-description"><strong>{record.site.label}</strong><span>Generation #{record.id}</span></DialogDescription>
                </DialogHeader>
                <div className="f41-retry-incident">
                    <span>Lỗi hiện tại</span>
                    <strong>{record.incidentSummary?.label ?? 'Sự cố cần xử lý'}</strong>
                    {record.incidentSummary?.scope && <small>{record.incidentSummary.scope}</small>}
                </div>
                <div className="f41-retry-impact">
                    <strong>Lần gen lại này sẽ</strong>
                    <ul>
                        <li>Tạo một generation mới từ form ban đầu.</li>
                        <li>Tạo website mới ở trạng thái bản nháp.</li>
                        <li>Gen lại toàn bộ website, không chỉ riêng component lỗi.</li>
                    </ul>
                </div>
                <p className="f41-retry-note"><strong>Không thay đổi:</strong> generation #{record.id}, website hiện tại và thông tin lỗi đã ghi nhận.</p>
                {message && <p role="alert" style={{ color: 'var(--destructive)' }}>{message}</p>}
                <DialogFooter className="gap-2 sm:gap-2">
                    <button type="button" className="btn btn-sm f41-retry-cancel" onClick={() => setConfirming(false)} disabled={submitting}>Hủy</button>
                    <button type="button" className="btn btn-sm f41-retry-confirm" onClick={() => void confirm()} disabled={submitting}>{submitting ? 'Đang xếp hàng…' : 'Tạo lần gen lại'}</button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
}
