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
    const href = result?.href ?? `/studio/issues?relatedType=generation&relatedId=${encodeURIComponent(record.ticketRelatedGenerationId)}`
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
    const incident = record.incidentSummary
    const impact = record.pageSummary.expected === null
        ? 'Chưa có tổng số trang để tính ảnh hưởng.'
        : `${record.pageSummary.failed}/${record.pageSummary.expected} trang chưa tạo, ${record.pageSummary.persisted} trang đã lưu.`
    return <><button type="button" className="btn btn-sm f41-issue-trigger" aria-label={`Tạo ticket Dev cho generation #${record.id}`} onClick={open}><TicketPlus size={14} aria-hidden />Tạo ticket Dev</button><Dialog open={confirming} onOpenChange={(value) => { if (!submitting) { setConfirming(value); if (!value) setMessage(null) } }}><DialogContent className="f41-retry-dialog f41-issue-dialog" style={{ maxWidth: 560 }}><DialogHeader><DialogTitle>Chuyển lỗi này cho team Dev?</DialogTitle><DialogDescription>Ticket sẽ giúp Dev xác định nguyên nhân, sửa pipeline tạo website và cập nhật lại kết quả xử lý cho người trực.</DialogDescription></DialogHeader><section className="f41-ticket-handoff" aria-label="Tóm tắt ticket sẽ tạo"><div><span>Website / generation</span><strong>{record.site.label} · #{record.id}</strong></div><div><span>Sự cố cần điều tra</span><strong>{incident?.label ?? 'Lỗi tạo website, cần xem detail'}</strong><small>{record.affectedError ? `Mã lỗi: ${record.affectedError.code} · Giai đoạn: ${record.affectedError.phase}` : 'Mã lỗi chưa được capture đầy đủ.'}</small></div><div><span>Ảnh hưởng</span><strong>{impact}</strong></div><div><span>Dev cần làm</span><strong>Xác định root cause, sửa hoặc nêu rõ hướng xử lý, rồi cập nhật trạng thái ticket.</strong></div></section><p className="f41-retry-note"><strong>Dữ liệu gửi cho Dev:</strong> mã lỗi, giai đoạn, phạm vi ảnh hưởng và trace ID. <strong>Không gửi:</strong> form, prompt, dữ liệu nhạy cảm hoặc raw error.</p>{message && <p role="alert" className="f41-issue-error">{message}</p>}<DialogFooter className="gap-2 sm:gap-2"><button type="button" className="btn btn-sm f41-retry-cancel" onClick={() => setConfirming(false)} disabled={submitting}>Hủy</button><button type="button" className="btn btn-sm f41-issue-trigger" onClick={() => void submit()} disabled={submitting} aria-busy={submitting}>{submitting ? 'Đang tạo ticket…' : 'Tạo ticket Dev'}</button></DialogFooter></DialogContent></Dialog></>
}
