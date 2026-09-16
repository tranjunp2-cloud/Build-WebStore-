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
        <button type="button" className="btn btn-sm f41-retry-trigger" aria-label={`Gen lại website ${record.id}`} onClick={() => setConfirming(true)} disabled={accepted}>{accepted ? 'Đang gen lại' : <><RotateCw size={13} aria-hidden />Gen lại</>}</button>
        <Dialog open={confirming} onOpenChange={(open) => { if (!submitting) setConfirming(open) }}>
            <DialogContent className="f41-retry-dialog" style={{ maxWidth: 465 }}>
                <DialogHeader><DialogTitle>Gen lại website cho {record.user.label}?</DialogTitle><DialogDescription>Website {record.site.label} · Generation #{record.id}</DialogDescription></DialogHeader>
                <p>Dùng lại form gốc để tạo generation mới và website recovery dạng bản nháp. Website, page và evidence lỗi hiện tại không bị thay đổi.</p>
                <p className="f41-retry-note">MVP gen lại toàn website, không gen riêng component lỗi. Quota và website mới tuân theo policy backend.</p>
                {message && <p role="alert" style={{ color: 'var(--destructive)' }}>{message}</p>}
                <DialogFooter className="gap-2 sm:gap-2">
                    <button type="button" className="btn btn-sm f41-retry-cancel" onClick={() => setConfirming(false)} disabled={submitting}>Hủy</button>
                    <button type="button" className="btn btn-sm f41-retry-confirm" onClick={() => void confirm()} disabled={submitting}>{submitting ? 'Đang xếp hàng…' : 'Xác nhận gen lại'}</button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
}
