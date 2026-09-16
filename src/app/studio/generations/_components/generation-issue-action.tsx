'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TicketPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GenerationRecord } from './generation-types'

type Result = { id: string; created: boolean; href: string }

export function GenerationIssueAction({ record, onCreated }: { record: GenerationRecord; onCreated?: () => void }) {
    const [confirming, setConfirming] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState<Result | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const ticketEligible = record.recoveryPolicy.action === 'create_ticket'
    const openedTicket = record.recoveryPolicy.action === 'open_ticket' || record.recoveryStatus === 'ticket_created'
    const href = result?.href ?? `/studio/issues?relatedType=generation&relatedId=${encodeURIComponent(record.id)}`
    if (!ticketEligible && !openedTicket) return null
    if (openedTicket || result) return <div className="f41-issue-action"><Link className="btn btn-sm f41-issue-trigger" href={href}>Mở ticket</Link>{result && <span role="status" className="f41-issue-feedback">{result.created ? 'Đã tạo ticket Dev.' : 'Đã dùng ticket Dev đang mở.'}</span>}</div>
    const open = () => { setMessage(null); setConfirming(true) }
    const submit = async () => {
        setSubmitting(true); setMessage(null)
        try {
            const response = await fetch(`/api/admin/generations/${encodeURIComponent(record.id)}/issue`, { method: 'POST' })
            const body = await response.json().catch(() => null) as { data?: Result; error?: { message?: string } } | null
            if (!response.ok || !body?.data) {
                setMessage(body?.error?.message ?? 'Chưa thể tạo ticket. Ticket chưa được tạo; vui lòng thử lại.')
                return
            }
            setResult(body.data); setConfirming(false); onCreated?.()
        } catch { setMessage('Chưa thể tạo ticket. Ticket chưa được tạo; vui lòng thử lại.') }
        finally { setSubmitting(false) }
    }
    return <><button type="button" className="btn btn-sm f41-issue-trigger" aria-label={`Tạo ticket Dev cho generation #${record.id}`} onClick={open}><TicketPlus size={14} aria-hidden />Tạo ticket Dev</button><Dialog open={confirming} onOpenChange={(value) => { if (!submitting) { setConfirming(value); if (!value) setMessage(null) } }}><DialogContent className="f41-retry-dialog f41-issue-dialog" style={{ maxWidth: 500 }}><DialogHeader><DialogTitle>Tạo ticket cho team Dev?</DialogTitle><DialogDescription>Ticket sẽ kèm mã lỗi, giai đoạn, vị trí ảnh hưởng và mức độ ảnh hưởng đã được chuẩn hóa.</DialogDescription></DialogHeader><p className="f41-retry-note">Không gửi nội dung form, prompt hoặc dữ liệu nhạy cảm.</p>{message && <p role="alert" className="f41-issue-error">{message}</p>}<DialogFooter className="gap-2 sm:gap-2"><button type="button" className="btn btn-sm f41-retry-cancel" onClick={() => setConfirming(false)} disabled={submitting}>Hủy</button><button type="button" className="btn btn-sm f41-issue-trigger" onClick={() => void submit()} disabled={submitting} aria-busy={submitting}>{submitting ? 'Đang tạo ticket…' : 'Tạo ticket Dev'}</button></DialogFooter></DialogContent></Dialog></>
}
