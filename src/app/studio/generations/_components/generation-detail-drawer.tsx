'use client'

/**
 * GenerationDetailDrawer — shadcn Dialog with 4 tabs.
 * Tabs: Timeline | Blocks | Issues (placeholder) | Raw JSON
 *
 * Fetches full record on open (depth=2 hydration from /api/admin/generations/:id).
 * Falls back to the list-row record for immediate display while loading.
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusDot } from './status-dot'
import { GenerationTimeline } from './generation-timeline'
import { GenerationBlocksTab } from './generation-blocks-tab'
import { GenerationRawJson } from './generation-raw-json'
import type { GenerationRecord } from './generation-types'

type Props = {
    record: GenerationRecord | null
    onClose: () => void
}

function formatDuration(ms: number | null | undefined): string {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

function getUserLabel(user: GenerationRecord['user']): string {
    if (!user) return 'Anonymous'
    if (typeof user === 'number') return `User #${user}`
    return user.email ?? `User #${user.id}`
}

export function GenerationDetailDrawer({ record, onClose }: Props) {
    const [fullRecord, setFullRecord] = useState<GenerationRecord | null>(null)
    const [loading, setLoading] = useState(false)
    const [rerunning, setRerunning] = useState(false)
    const [rerunMsg, setRerunMsg] = useState<string | null>(null)

    // Fetch full depth-2 record when drawer opens
    useEffect(() => {
        if (!record) { setFullRecord(null); return }
        setFullRecord(null)
        setRerunMsg(null)
        setLoading(true)
        fetch(`/api/admin/generations/${record.id}`)
            .then((r) => r.json())
            .then((json) => setFullRecord(json.data ?? null))
            .catch(() => setFullRecord(record)) // fallback to list row
            .finally(() => setLoading(false))
    }, [record?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const displayed = fullRecord ?? record

    async function handleRerun() {
        if (!displayed) return
        setRerunning(true)
        setRerunMsg(null)
        try {
            const res = await fetch(`/api/admin/generations/${displayed.id}/rerun`, { method: 'POST' })
            const json = await res.json() as { data?: { message?: string }; error?: string }
            if (!res.ok) {
                setRerunMsg(`Error: ${json.error ?? 'Rerun failed'}`)
            } else {
                setRerunMsg(`Rerun started — ${json.data?.message ?? 'check live feed'}`)
            }
        } catch {
            setRerunMsg('Network error during rerun')
        } finally {
            setRerunning(false)
        }
    }

    return (
        <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent
                style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
                <DialogHeader>
                    <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {displayed && <StatusDot status={displayed.status} size={10} />}
                        <span>Generation #{displayed?.id ?? '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)', marginLeft: 4 }}>
                            {displayed?.endpoint}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/* Meta row */}
                {displayed && (
                    <div style={{ display: 'flex', gap: 24, padding: '8px 0 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                        <span>User: <b>{getUserLabel(displayed.user)}</b></span>
                        {displayed.category && <span>Category: <b>{displayed.category}</b></span>}
                        <span>Duration: <b>{formatDuration(displayed.durationMs)}</b></span>
                        {displayed.costUsd != null && <span>Cost: <b>${displayed.costUsd.toFixed(6)}</b></span>}
                        <span>Created: <b>{new Date(displayed.createdAt).toLocaleString()}</b></span>
                    </div>
                )}

                {loading && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Loading details…</p>
                )}

                {displayed && (
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Tabs defaultValue="timeline" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <TabsList>
                                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                <TabsTrigger value="blocks">Blocks ({displayed.selectedBlocks?.length ?? 0})</TabsTrigger>
                                <TabsTrigger value="issues">Issues</TabsTrigger>
                                <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                            </TabsList>

                            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12 }}>
                                <TabsContent value="timeline">
                                    <GenerationTimeline record={displayed} />
                                </TabsContent>

                                <TabsContent value="blocks">
                                    <GenerationBlocksTab record={displayed} />
                                </TabsContent>

                                <TabsContent value="issues">
                                    <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '16px 0' }}>
                                        Issue linking will be available in Phase 06.
                                    </p>
                                </TabsContent>

                                <TabsContent value="raw">
                                    <GenerationRawJson record={displayed} />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                )}

                {/* Rerun action */}
                {displayed && displayed.promptMode !== 'hashed' && (
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            onClick={handleRerun}
                            disabled={rerunning || displayed.endpoint !== 'site-generator'}
                            style={{
                                padding: '6px 16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                                background: 'var(--accent)',
                                color: '#fff',
                                fontSize: 13,
                                cursor: rerunning ? 'wait' : 'pointer',
                                opacity: displayed.endpoint !== 'site-generator' ? 0.4 : 1,
                            }}
                        >
                            {rerunning ? 'Running…' : 'Re-run'}
                        </button>
                        {displayed.endpoint !== 'site-generator' && (
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Rerun only supported for site-generator</span>
                        )}
                        {rerunMsg && (
                            <span style={{ fontSize: 12, color: rerunMsg.startsWith('Error') ? 'var(--danger, #ef4444)' : 'var(--success, #22c55e)' }}>
                                {rerunMsg}
                            </span>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
