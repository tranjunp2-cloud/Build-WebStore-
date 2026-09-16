'use client'

/**
 * GenerationDetailDrawer — safe summary for the Operations queue.
 *
 * F41-02 intentionally never hydrates the legacy detail endpoint: that endpoint
 * exposes historical prompt/output/error fields which are not part of the
 * Operations allowlist. F41-04 will introduce a separately reviewed, safe
 * debugging detail contract.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { GenerationRecord } from './generation-types'
import { GenerationRetryAction } from './generation-retry-action'

type Props = {
    record: GenerationRecord | null
    onClose: () => void
    onRetryAccepted: (id: string) => void
}

export function GenerationDetailDrawer({ record, onClose, onRetryAccepted }: Props) {
    return (
        <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent
                style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
                <DialogHeader>
                    <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span>Generation #{record?.id ?? '—'}</span>
                    </DialogTitle>
                </DialogHeader>

                {/* Meta row */}
                {record && <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 20px', padding: '8px 0', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-2)' }}>Submitted</span><b>{new Date(record.submittedAt).toLocaleString()}</b>
                    <span style={{ color: 'var(--text-2)' }}>User</span><b>{record.user.label}</b>
                    <span style={{ color: 'var(--text-2)' }}>Website</span><b>{record.site.label}</b>
                    <span style={{ color: 'var(--text-2)' }}>Outcome</span><b>{record.outcome ?? record.lifecycle}</b>
                    <span style={{ color: 'var(--text-2)' }}>Pages</span><b>{record.pageSummary.persisted}/{record.pageSummary.expected ?? '?'} persisted; {record.pageSummary.failed} failed</b>
                    <span style={{ color: 'var(--text-2)' }}>Recovery</span><b>{record.recoveryPolicy.reasonCode}</b>
                    {record.affectedError && <><span style={{ color: 'var(--text-2)' }}>Affected error</span><span><b>{record.affectedError.code}</b>: {record.affectedError.summary}</span></>}
                </div>}
                {record && <GenerationRetryAction record={record} onAccepted={onRetryAccepted} />}

            </DialogContent>
        </Dialog>
    )
}
