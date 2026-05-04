'use client'

import { useState, useEffect, useRef } from 'react'
import { X, User, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CustomerAvatar } from './customer-avatar'
import { CustomerStatusBadge } from './customer-status-badge'
import { getCustomerDetailAction, updateContactStatusAction } from '../actions'
import type { CustomerRecord, CustomerStatus } from '../_lib/customer-record'

const STATUS_LABELS: Record<CustomerStatus, string> = {
    new: 'New', read: 'Read', contacted: 'Contacted', ignored: 'Ignored', subscribed: 'Subscribed',
}

// Allowed manual transitions per current status (per Figma spec)
const ALLOWED_TRANSITIONS: Record<CustomerStatus, CustomerStatus[]> = {
    new:        ['read', 'contacted'],
    read:       ['new', 'contacted'],
    contacted:  ['ignored'],
    ignored:    [],
    subscribed: [],
}

const STATUS_COLORS: Record<CustomerStatus, { bg: string; border: string; text: string }> = {
    new:        { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24' },
    read:       { bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', text: '#818cf8' },
    contacted:  { bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.3)',  text: '#2dd4bf' },
    ignored:    { bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', text: '#9ca3af' },
    subscribed: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', text: '#a78bfa' },
}

function StatusDropdown({ status, disabled, onChange }: {
    status: CustomerStatus
    disabled: boolean
    onChange: (s: CustomerStatus) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
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
                style={{ borderColor: c.border, color: c.text, background: c.bg, paddingRight: canChange ? '6px' : '12px', paddingTop: '5px', paddingBottom: '5px' }}
            >
                {STATUS_LABELS[status]}
                {canChange && (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
                        <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-10 bg-[#1e293b] border border-white/[0.08] rounded-[12px] overflow-hidden min-w-[130px]">
                    {([status, ...ALLOWED_TRANSITIONS[status]] as CustomerStatus[]).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => { onChange(s); setOpen(false) }}
                            className={`w-full px-4 py-[10px] text-left text-[14px] transition-colors hover:bg-white/[0.05] border-none bg-transparent cursor-pointer ${s === status ? 'font-semibold text-white' : 'text-white/60'}`}
                        >
                            {STATUS_LABELS[s]}
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
    const [timeline, setTimeline] = useState<CustomerRecord[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [localStatus, setLocalStatus] = useState<CustomerStatus>('new')
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        if (!record) return
        setLocalStatus(record.status)
        if (record.source !== 'contact-form') { setTimeline([]); return }

        // Auto-transition: New → Read when detail panel is first opened
        if (record.status === 'new') {
            setLocalStatus('read')
            updateContactStatusAction(record.rawId, 'read')
                .then(() => onStatusUpdate(record, 'read'))
                .catch(() => {/* non-critical, don't show error */})
        }

        setLoadingDetail(true)
        getCustomerDetailAction(record.rawId, record.source)
            .then(res => setTimeline(res.timeline as CustomerRecord[]))
            .catch(() => toast.error('Failed to load details'))
            .finally(() => setLoadingDetail(false))
    }, [record?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!record) return null

    async function handleStatusChange(newStatus: CustomerStatus) {
        if (!record || newStatus === localStatus) return
        setLocalStatus(newStatus)
        setUpdating(true)
        try {
            await updateContactStatusAction(record.rawId, newStatus)
            onStatusUpdate(record, newStatus)
            toast.success('Status updated')
        } catch {
            setLocalStatus(record.status)
            toast.error('Failed to update status')
        } finally {
            setUpdating(false)
        }
    }

    const displayName = record.source === 'newsletter'
        ? (record.name ?? 'Guest') + ' (Newsletter)'
        : (record.name ?? 'Guest')

    return (
        <>
            {/* Backdrop — full screen on mobile, offset below header on md+ */}
            <div
                className="fixed inset-0 z-40 md:top-[56px]"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
                onClick={onClose}
            />

            {/* Panel — bottom sheet on mobile, right sidebar on md+ */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[24px] min-h-[80vh] max-h-[90vh] md:min-h-0 md:bottom-auto md:top-0 md:left-auto md:h-full md:w-[500px] md:rounded-none border-t border-white/[0.08] md:border-l"
                style={{ background: '#0b1120', backdropFilter: 'blur(20px)' }}
            >
                {/* Drag handle (mobile only) */}
                <div className="md:hidden flex justify-center pt-3 pb-0 shrink-0">
                    <div className="w-12 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header row: title + close */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] shrink-0">
                    <h2 className="text-[18px] md:text-[20px] font-bold text-[#f8fafc]">Customer Profile</h2>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-9 h-9 rounded-[12px] text-white/50 hover:text-white hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col gap-6 p-6 pb-6 overflow-y-auto flex-1">
                    {/* Avatar + Name row */}
                    <div className="flex items-center gap-5">
                        <CustomerAvatar name={record.name} email={record.email} source={record.source} size={60} />
                        <h3
                            className="text-[24px] font-bold text-[#dde2f8]"
                            style={{ letterSpacing: '-0.6px' }}
                        >
                            {displayName}
                        </h3>
                    </div>

                    {/* Customer Information card */}
                    <div
                        className="flex flex-col gap-3 rounded-[16px] px-[17px] py-6 border"
                        style={{ background: 'rgba(30,41,59,0.6)', borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                        {/* Section header + status */}
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.3px] text-white/60">
                                Customer Information
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
                                <div className="flex items-center justify-center w-8 h-8 rounded-[12px] shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                                    <User className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-white/40 leading-4">Name</span>
                                    <span className="text-[14px] text-[#f8fafc] leading-5">{displayName}</span>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex items-center gap-3 h-9">
                                <div className="flex items-center justify-center w-8 h-8 rounded-[12px] shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                                    <Mail className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-white/40 leading-4">Email</span>
                                    <span className="text-[14px] text-[#f8fafc] leading-5">{record.email}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Timeline (contact-form only) */}
                    {record.source === 'contact-form' && (
                        <div className="flex flex-col gap-6">
                            {/* Section title */}
                            <div className="border-b pb-[17px]" style={{ borderColor: 'rgba(66,71,84,0.1)' }}>
                                <p className="text-[14px] font-bold uppercase tracking-[1.4px] text-[#dde2f8]">
                                    Activity Timeline
                                </p>
                            </div>

                            {loadingDetail ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                                </div>
                            ) : timeline.length === 0 ? (
                                <p className="text-[13px] text-white/30">No previous submissions</p>
                            ) : (
                                /* Vertical timeline */
                                <div className="relative flex flex-col gap-10 pl-[26px] border-l-2" style={{ borderColor: '#2f3445' }}>
                                    {timeline.map(t => (
                                        <div key={t.id} className="relative">
                                            {/* Teal circle bullet */}
                                            <div
                                                className="absolute -left-[33px] top-0 w-4 h-4 rounded-full bg-[#2dd4bf]"
                                                style={{ boxShadow: '0 0 0 4px #0d1322' }}
                                            />
                                            <div className="flex flex-col gap-2">
                                                {/* Title + date */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[12px] font-bold text-[#dde2f8]">Contact Submission</span>
                                                    <span className="text-[10px]" style={{ color: 'rgba(194,198,214,0.5)' }}>
                                                        {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}{', '}
                                                        {new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    </span>
                                                </div>
                                                {/* Message card */}
                                                {t.message && (
                                                    <div
                                                        className="rounded-[12px] p-[17px] border"
                                                        style={{ background: 'rgba(36,42,58,0.5)', borderColor: 'rgba(66,71,84,0.1)' }}
                                                    >
                                                        <p className="text-[12px] text-[#c2c6d6] leading-[19.5px]">{t.message}</p>
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

                {/* Update button — mobile only, contact-form only, pinned at bottom */}
                {record.source === 'contact-form' && <div className="md:hidden px-6 pb-6 pt-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full h-[44px] rounded-[10px] text-[14px] font-medium text-white cursor-pointer border-none"
                        style={{ background: 'linear-gradient(90deg, #3b82f6 0%, #2dd4bf 100%)' }}
                    >
                        Update
                    </button>
                </div>}
            </div>
        </>
    )
}
