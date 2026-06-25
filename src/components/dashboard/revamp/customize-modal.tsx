'use client'

/**
 * Customize dashboard — reorder + show/hide blocks (flat list).
 * Ports the design CustomizeModal (native drag + arrows + toggle); persists the
 * ordered VISIBLE block ids to the tenant via updateDashboardPreferences.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GripVertical, ChevronUp, ChevronDown, Check, SlidersHorizontal, X } from 'lucide-react'
import { updateDashboardPreferences } from '@/app/(dashboard)/actions'
import {
    DEFAULT_DASHBOARD_BLOCKS, buildCustomizeRows,
    type CustomizeBlockRow, type DashboardBlockId,
} from '@/lib/dashboard-utils'
import { BlockIcon } from './atoms'

const BLOCK_LABELS: Record<DashboardBlockId, string> = {
    onboarding: 'Onboarding checklist',
    glance: 'At-a-glance stats',
    traffic: 'Traffic & performance',
    seo: 'SEO health',
    tools: 'SEO action tools',
    orders: 'Pending orders',
}

export function CustomizeModal({ defaultVisible, onboardingComplete = false }: { defaultVisible: DashboardBlockId[]; onboardingComplete?: boolean }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    // Onboarding is a temporary guidance block — once 100% done it disappears from the page,
    // so drop it from the modal too (no buggy ON/OFF that does nothing). Its saved pref is
    // preserved on save so the checklist can return if a step later becomes incomplete.
    const onboardingWasVisible = defaultVisible.includes('onboarding')
    const makeRows = (visible: DashboardBlockId[]) => {
        const rows = buildCustomizeRows(visible)
        return onboardingComplete ? rows.filter(r => r.id !== 'onboarding') : rows
    }

    const [draft, setDraft] = useState<CustomizeBlockRow[]>(() => makeRows(defaultVisible))
    const [dragId, setDragId] = useState<DashboardBlockId | null>(null)
    const [overId, setOverId] = useState<DashboardBlockId | null>(null)

    const move = (from: number, to: number) => {
        if (to < 0 || to >= draft.length) return
        setDraft(prev => {
            const next = prev.slice()
            const [item] = next.splice(from, 1)
            next.splice(to, 0, item)
            return next
        })
    }
    const toggle = (id: DashboardBlockId) =>
        setDraft(prev => prev.map(b => (b.id === id ? { ...b, visible: !b.visible } : b)))

    const onDrop = (targetId: DashboardBlockId) => {
        const from = draft.findIndex(b => b.id === dragId)
        const to = draft.findIndex(b => b.id === targetId)
        if (from !== -1 && to !== -1) move(from, to)
        setDragId(null); setOverId(null)
    }

    const reset = () => setDraft(makeRows(DEFAULT_DASHBOARD_BLOCKS))

    const handleSave = async () => {
        setSaving(true)
        const visibleIds = draft.filter(b => b.visible).map(b => b.id)
        // Onboarding was hidden from the modal but keep its pref so the checklist isn't lost
        if (onboardingComplete && onboardingWasVisible && !visibleIds.includes('onboarding')) {
            visibleIds.unshift('onboarding')
        }
        try {
            const res = await updateDashboardPreferences(visibleIds)
            if (res?.success) {
                toast.success('Dashboard layout saved')
                setOpen(false)
                router.refresh()
            } else {
                toast.error('Failed to save layout')
            }
        } catch {
            toast.error('Failed to save layout')
        } finally {
            setSaving(false)
        }
    }

    const openModal = () => {
        setDraft(makeRows(defaultVisible))
        setOpen(true)
    }

    return (
        <>
            <button className="btn btn-secondary" onClick={openModal} data-testid="customize-dashboard-btn">
                <SlidersHorizontal aria-hidden />Customize
            </button>

            {open && (
                <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
                    <div className="modal" role="dialog" aria-modal="true">
                        <div className="modal-head">
                            <div>
                                <h3>Customize dashboard</h3>
                                <p>Drag to reorder, or toggle blocks on and off. Saved for your account.</p>
                            </div>
                            <button className="onb-dismiss" onClick={() => setOpen(false)} aria-label="Close"><X aria-hidden /></button>
                        </div>
                        <div className="modal-body">
                            {draft.map((b, i) => (
                                <div
                                    key={b.id}
                                    data-testid={`customize-item-${b.id}`}
                                    className={`cz-row ${dragId === b.id ? 'dragging' : ''} ${overId === b.id && dragId !== b.id ? 'drop-target' : ''} ${!b.visible ? 'hidden-row' : ''}`}
                                    draggable
                                    onDragStart={() => setDragId(b.id)}
                                    onDragOver={e => { e.preventDefault(); setOverId(b.id) }}
                                    onDragLeave={() => setOverId(o => (o === b.id ? null : o))}
                                    onDrop={e => { e.preventDefault(); onDrop(b.id) }}
                                    onDragEnd={() => { setDragId(null); setOverId(null) }}
                                >
                                    <span className="cz-handle" title="Drag to reorder"><GripVertical aria-hidden /></span>
                                    <div className="cz-arrows">
                                        <button disabled={i === 0} onClick={() => move(i, i - 1)} title="Move up"><ChevronUp aria-hidden /></button>
                                        <button disabled={i === draft.length - 1} onClick={() => move(i, i + 1)} title="Move down"><ChevronDown aria-hidden /></button>
                                    </div>
                                    <span className="cz-ic"><BlockIcon name={b.icon} /></span>
                                    <span className="cz-label">
                                        {BLOCK_LABELS[b.id]}
                                        {b.soon && <span className="cs-badge" style={{ fontSize: 9.5, padding: '1px 7px' }}>Soon</span>}
                                    </span>
                                    <div
                                        className={`cz-check ${b.visible ? 'on' : ''}`}
                                        role="switch"
                                        aria-checked={b.visible}
                                        aria-label={`${BLOCK_LABELS[b.id]} visibility`}
                                        onClick={() => toggle(b.id)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="modal-foot">
                            <button className="reset" onClick={reset}>Reset to default</button>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    <Check aria-hidden />{saving ? 'Saving…' : 'Save layout'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
