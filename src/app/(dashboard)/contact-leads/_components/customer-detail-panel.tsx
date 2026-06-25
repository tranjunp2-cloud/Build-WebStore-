'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Mail, Loader2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CustomerAvatar } from './customer-avatar'
import { CustomerStatusBadge } from './customer-status-badge'
import { getCustomerDetailAction, updateContactStatusAction } from '../actions'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { CustomerRecord, CustomerStatus } from '../_lib/customer-record'

// Fixed to 'en-US' intentionally — dashboard date format is English regardless of active locale
function formatLatestDate(iso: string): string {
    const d = new Date(iso)
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    return `${time} , ${date}`
}

// Allowed manual transitions per current status (per Figma spec)
const ALLOWED_TRANSITIONS: Record<CustomerStatus, CustomerStatus[]> = {
    new:        ['read', 'contacted'],
    read:       ['new', 'contacted'],
    contacted:  ['ignored'],
    ignored:    [],
    subscribed: [],
}

// GH-1337: tinted rgba per Figma spec — inline style object so Tailwind classes not applicable here.
const STATUS_COLORS: Record<CustomerStatus, { bg: string; border: string; text: string }> = {
    new:        { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24' },
    read:       { bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', text: '#818cf8' },
    contacted:  { bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.3)',  text: '#2dd4bf' },
    ignored:    { bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', text: '#9ca3af' },
    subscribed: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(138,129,245,0.3)', text: '#8a81f5' },
}

function StatusDropdown({ status, disabled, onChange }: {
    status: CustomerStatus
    disabled: boolean
    onChange: (s: CustomerStatus) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const { t } = useI18n()
    const i = t.dashboard.customers
    const statusLabels: Record<CustomerStatus, string> = {
        new: i.statusNew, read: i.statusRead, contacted: i.statusContacted,
        ignored: i.statusIgnored, subscribed: i.statusSubscribed,
    }
    const c = STATUS_COLORS[status]
    const canChange = ALLOWED_TRANSITIONS[status].length > 0

    useEffect(() => {
        if (!open) return
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    return (
        <div ref={ref} className="relative inline-flex">
            <button
                type="button"
                onClick={() => canChange && !disabled && setOpen(v => !v)}
                className="inline-flex items-center gap-1 rounded-[24px] pl-3 text-[14px] font-medium border bg-transparent cursor-pointer"
                style={{ borderColor: c.border, background: c.bg, color: c.text, paddingRight: canChange ? '6px' : '12px', paddingTop: '5px', paddingBottom: '5px' }}
            >
                {statusLabels[status]}
                {canChange && (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
                        <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-10 rounded-[12px] overflow-hidden min-w-[130px]" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}>
                    {([status, ...ALLOWED_TRANSITIONS[status]] as CustomerStatus[]).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => { onChange(s); setOpen(false) }}
                            className={`w-full px-4 py-[10px] text-left text-[14px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border-none bg-transparent cursor-pointer ${s === status ? 'font-semibold text-[var(--dash-text)]' : 'text-[var(--dash-text-muted)]'}`}
                        >
                            {statusLabels[s]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

type Props = {
    record: CustomerRecord | null
    onClose: () => void
    onStatusUpdate: (record: CustomerRecord, newStatus: string) => void
}

export function CustomerDetailPanel({ record, onClose, onStatusUpdate }: Props) {
    const { t } = useI18n()
    const c = t.dashboard.customers
    const [timeline, setTimeline] = useState<CustomerRecord[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [localStatus, setLocalStatus] = useState<CustomerStatus>('new')
    const [updating, setUpdating] = useState(false)
    // Tracks the last status saved to server (after auto-transition or Update)
    const serverStatusRef = useRef<CustomerStatus>('new')

    useEffect(() => {
        if (!record) return
        setLocalStatus(record.status)
        serverStatusRef.current = record.status
        if (record.source !== 'contact-form') { setTimeline([]); return }

        // Auto-transition: New → Read when detail panel is first opened
        if (record.status === 'new') {
            setLocalStatus('read')
            serverStatusRef.current = 'read'
            updateContactStatusAction(record.rawId, 'read')
                .then(() => onStatusUpdate(record, 'read'))
                .catch(() => {/* non-critical */})
        }

        setLoadingDetail(true)
        getCustomerDetailAction(record.rawId, record.source)
            .then(res => setTimeline(res.timeline as CustomerRecord[]))
            .catch(() => toast.error(c.loadDetailsFailed))
            .finally(() => setLoadingDetail(false))
    }, [record?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!record) return null

    // Dropdown only updates local state — no API call until Update is clicked
    function handleStatusChange(newStatus: CustomerStatus) {
        if (newStatus === localStatus) return
        setLocalStatus(newStatus)
    }

    async function handleUpdate() {
        if (!record) return
        if (localStatus === serverStatusRef.current) { onClose(); return }
        setUpdating(true)
        try {
            await updateContactStatusAction(record.rawId, localStatus)
            onStatusUpdate(record, localStatus)
            serverStatusRef.current = localStatus
            toast.success(c.statusUpdated)
            onClose()
        } catch {
            setLocalStatus(serverStatusRef.current)
            toast.error(c.statusFailed)
        } finally {
            setUpdating(false)
        }
    }

    const displayName = record.source === 'newsletter'
        ? (record.name ?? 'Guest') + ' (Newsletter)'
        : (record.name ?? 'Guest')

    if (typeof document === 'undefined') return null

    return createPortal(
        <>
            {/* Backdrop — rendered via portal at document.body to escape ancestor stacking contexts */}
            <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel — bottom sheet on mobile, right sidebar on md+ */}
            <div
                className="fixed bottom-0 left-0 right-0 z-[101] flex flex-col rounded-t-[24px] min-h-[80vh] max-h-[90vh] md:min-h-0 md:max-h-none md:bottom-0 md:top-0 md:left-auto md:w-[500px] md:rounded-none border-t md:border-l border-solid border-[var(--dash-border)]"
                style={{ background: 'var(--dash-surface)' }}
            >
                {/* Drag handle (mobile only) */}
                <div className="md:hidden flex justify-center pt-3 pb-0 shrink-0">
                    <div className="w-12 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                </div>

                {/* Header row: title + close */}
                <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <h2 className="text-[18px] md:text-[20px] font-bold text-[var(--dash-text)]">{c.profileTitle}</h2>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-9 h-9 rounded-[12px] text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col gap-6 p-6 pb-6 overflow-y-auto flex-1">
                    {/* Avatar + Name row */}
                    <div className="flex items-center gap-5">
                        <CustomerAvatar name={record.name} email={record.email} source={record.source} size={60} />
                        <h3
                            className="text-[24px] font-bold text-[var(--dash-text)]"
                            style={{ letterSpacing: '-0.6px' }}
                        >
                            {displayName}
                        </h3>
                    </div>

                    {/* Customer Information card */}
                    <div
                        className="flex flex-col gap-3 rounded-[16px] px-[17px] py-6"
                        style={{ background: 'var(--dash-secondary-bg)', border: '1px solid var(--dash-border)' }}
                    >
                        {/* Section header + status */}
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.3px] text-[var(--dash-text-muted)]">
                                {c.infoTitle}
                            </p>

                            {record.source === 'contact-form' ? (
                                <StatusDropdown
                                    status={localStatus}
                                    disabled={updating}
                                    onChange={handleStatusChange}
                                />
                            ) : (
                                <CustomerStatusBadge status={record.status} />
                            )}
                        </div>

                        {/* Fields */}
                        <div className="flex flex-col gap-3">
                            {/* Name */}
                            <div className="flex items-center gap-3 h-9">
                                <div className="flex items-center justify-center w-8 h-8 rounded-[12px] shrink-0" style={{ background: 'hsl(var(--info)/0.1)' }}>
                                    <User className="w-4 h-4 text-[hsl(var(--info))]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-[var(--dash-text-muted)] leading-4">{c.fieldName}</span>
                                    <span className="text-[14px] text-[var(--dash-text)] leading-5">{displayName}</span>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex items-center gap-3 h-9">
                                <div className="flex items-center justify-center w-8 h-8 rounded-[12px] shrink-0" style={{ background: 'hsl(var(--info)/0.1)' }}>
                                    <Mail className="w-4 h-4 text-[hsl(var(--info))]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-[var(--dash-text-muted)] leading-4">{c.fieldEmail}</span>
                                    <span className="text-[14px] text-[var(--dash-text)] leading-5">{record.email}</span>
                                </div>
                            </div>

                            {/* Latest Date — all sources */}
                            <div className="flex items-center gap-3 h-9">
                                <div className="flex items-center justify-center w-8 h-8 rounded-[12px] shrink-0" style={{ background: 'hsl(var(--info)/0.1)' }}>
                                    <CalendarDays className="w-4 h-4 text-[hsl(var(--info))]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-[var(--dash-text-muted)] leading-4">{c.fieldLatestDate}</span>
                                    <span className="text-[14px] text-[var(--dash-text)] leading-5">
                                        {formatLatestDate(record.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Timeline (contact-form only) */}
                    {record.source === 'contact-form' && (
                        <div className="flex flex-col gap-6">
                            {/* Section title */}
                            <div className="pb-[17px]" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                                <p className="text-[14px] font-bold uppercase tracking-[1.4px] text-[var(--dash-text)]">
                                    {c.timeline}
                                </p>
                            </div>

                            {loadingDetail ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-[var(--dash-text-muted)]" />
                                </div>
                            ) : timeline.length === 0 ? (
                                <p className="text-[13px] text-[var(--dash-text-muted)]">{c.noTimeline}</p>
                            ) : (
                                /* Vertical timeline */
                                <div className="relative flex flex-col gap-10 pl-[26px]">
                                    {/* Vertical line — runs from top of container, stops at top-4 of the last item via overlay */}
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: 'var(--dash-border)' }} />
                                    {timeline.map((t, idx) => (
                                        <div
                                            key={t.id}
                                            className={cn(
                                                'relative',
                                                // Mask the line below the last bullet using panel bg color
                                                idx === timeline.length - 1 && "after:content-[''] after:absolute after:left-[-26px] after:top-4 after:bottom-0 after:w-[2px] after:bg-[var(--dash-surface)]"
                                            )}
                                        >
                                            {/* Half-circle (D-shape) bullet — flat side flush with the vertical line */}
                                            <div className="absolute -left-[26px] top-0 w-2 h-4 rounded-r-full bg-[hsl(var(--primary))]" />
                                            <div className="flex flex-col gap-2">
                                                {/* Title + date */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[12px] font-bold text-[var(--dash-text)]">{c.timelineEntry}</span>
                                                    <span className="text-[10px]" style={{ color: 'var(--dash-text-muted)' }}>
                                                        {formatLatestDate(t.createdAt)}
                                                    </span>
                                                </div>
                                                {/* Message card */}
                                                {t.message && (
                                                    <div
                                                        className="rounded-[12px] p-[17px]"
                                                        style={{ background: 'var(--dash-secondary-bg)', border: '1px solid var(--dash-border)' }}
                                                    >
                                                        <p className="text-[12px] text-[var(--dash-text-muted)] leading-[19.5px]">{t.message}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Update button — contact-form only, pinned at bottom */}
                {record.source === 'contact-form' && (
                    <div className="px-6 pb-6 pt-2 shrink-0">
                        <Button
                            variant="dashPrimary"
                            onClick={handleUpdate}
                            disabled={updating || localStatus === serverStatusRef.current}
                            className="w-full"
                        >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : c.update}
                        </Button>
                    </div>
                )}
            </div>
        </>,
        document.body
    )
}
