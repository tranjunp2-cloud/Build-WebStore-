'use client'

import { useState } from 'react'
import { useStudioCan } from '../../_components/studio-permissions-context'
import type { GenerationRecord } from './generation-types'

type Action = 'start' | 'resolve' | 'reopen'

export function GenerationVerificationAction({ record, onUpdated }: { record: GenerationRecord; onUpdated: () => void }) {
    const canVerify = useStudioCan()('generation.verify')
    const [saving, setSaving] = useState<Action | null>(null)
    const [error, setError] = useState<string | null>(null)
    if (!canVerify) return null
    if (!['ticket_verification_required', 'operator_verifying'].includes(record.recoveryStatus)) return null
    const update = async (action: Action) => {
        setSaving(action); setError(null)
        try {
            const response = await fetch(`/api/admin/generations/${encodeURIComponent(record.id)}/verification`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
            if (!response.ok) throw new Error()
            onUpdated()
        } catch { setError('Chưa thể cập nhật. Vui lòng thử lại.') }
        finally { setSaving(null) }
    }
    if (record.recoveryStatus === 'ticket_verification_required') return <div className="f41-verification-action"><button type="button" className="btn btn-sm f41-issue-trigger" disabled={Boolean(saving)} onClick={() => void update('start')}>{saving === 'start' ? 'Đang bắt đầu…' : 'Kiểm tra bản sửa'}</button>{error && <small role="alert">{error}</small>}</div>
    return <div className="f41-verification-action"><button type="button" className="btn btn-sm f41-issue-trigger" disabled={Boolean(saving)} onClick={() => void update('resolve')}>{saving === 'resolve' ? 'Đang lưu…' : 'Hoàn tất cho user'}</button><button type="button" className="btn btn-sm" disabled={Boolean(saving)} onClick={() => void update('reopen')}>Vẫn còn lỗi</button>{error && <small role="alert">{error}</small>}</div>
}
