'use client'

/**
 * Customize dashboard — reorder + show/hide blocks (flat list).
 * Ports the design CustomizeModal (native drag + arrows + toggle); persists the
 * ordered VISIBLE block ids to the tenant via updateDashboardPreferences.
 * All text driven by t.dashboard.revamp.customize.*
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GripVertical, ChevronUp, ChevronDown, Check, SlidersHorizontal, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'
import { updateDashboardPreferences } from '@/app/(dashboard)/actions'
import {
    DEFAULT_DASHBOARD_BLOCKS, buildCustomizeRows,
    type CustomizeBlockRow, type DashboardBlockId,
} from '@/lib/dashboard-utils'
import { BlockIcon } from './atoms'

export function CustomizeModal({ defaultVisible, onboardingComplete = false }: { defaultVisible: DashboardBlockId[]; onboardingComplete?: boolean }) {
    const router = useRouter()
    const { t } = useI18n()
    const czT = t.dashboard.revamp.customize
    const soon = t.dashboard.revamp.soon

    /** Map block id → translated label (built inside the component so useI18n is in scope). */
    const blockLabel = (id: DashboardBlockId): string => {
        const map: Record<DashboardBlockId, string> = {
            onboarding: czT.blockOnboarding,
            glance: czT.blockGlance,
            traffic: czT.blockTraffic,
            seo: czT.blockSeo,
            orders: czT.blockOrders,
        }
        return map[id]
    }

    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    // Portal target is only available on the client — gate so SSR/hydration stays clean
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    // GH-1491 issue 1: background page was still scrollable behind the open modal.
    useLockBodyScroll(open)

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
        if (onboardingComplete && onboardingWasVisible && !visibleIds.includes('onboarding')) {
            visibleIds.unshift('onboarding')
        }
        try {
            const res = await updateDashboardPreferences(visibleIds)
            if (res?.success) {
                toast.success(czT.saved)
                setOpen(false)
                router.refresh()
            } else {
                toast.error(czT.saveError)
            }
        } catch {
            toast.error(czT.saveError)
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
            <Button variant="dashSecondary" size="dash" onClick={openModal} data-testid="customize-dashboard-btn">
                <SlidersHorizontal aria-hidden />{czT.button}
            </Button>

            {open && mounted && createPortal(
                /* Portaled to <body> + wrapped in .dash-revamp so it escapes the dashboard's
                   stacking contexts (toolbar/cards) yet keeps the scoped --dr-* tokens + styles. */
                <div className="dash-revamp">
                <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
                    <div className="modal" role="dialog" aria-modal="true">
                        <div className="modal-head">
                            <div>
                                <h3>{czT.title}</h3>
                                <p>{czT.description}</p>
                            </div>
                            <button className="onb-dismiss" onClick={() => setOpen(false)} aria-label={czT.close}><X aria-hidden /></button>
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
                                    <span className="cz-handle" title={czT.dragToReorder}><GripVertical aria-hidden /></span>
                                    <div className="cz-arrows">
                                        <button disabled={i === 0} onClick={() => move(i, i - 1)} title={czT.moveUp}><ChevronUp aria-hidden /></button>
                                        <button disabled={i === draft.length - 1} onClick={() => move(i, i + 1)} title={czT.moveDown}><ChevronDown aria-hidden /></button>
                                    </div>
                                    <span className="cz-ic"><BlockIcon name={b.icon} /></span>
                                    <span className="cz-label">
                                        {blockLabel(b.id)}
                                        {b.soon && <span className="cs-badge" style={{ fontSize: 9.5, padding: '1px 7px' }}>{soon}</span>}
                                    </span>
                                    <div
                                        className={`cz-check ${b.visible ? 'on' : ''}`}
                                        role="switch"
                                        aria-checked={b.visible}
                                        aria-label={`${blockLabel(b.id)} visibility`}
                                        tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(b.id) } }}
                                        onClick={() => toggle(b.id)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="modal-foot">
                            <button className="reset" onClick={reset}>{czT.reset}</button>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <Button variant="dashSecondary" size="dash" onClick={() => setOpen(false)} disabled={saving}>{czT.cancel}</Button>
                                <Button variant="dashPrimary" size="dash" onClick={handleSave} disabled={saving}>
                                    <Check aria-hidden />{saving ? czT.saving : czT.save}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                </div>,
                document.body,
            )}
        </>
    )
}
