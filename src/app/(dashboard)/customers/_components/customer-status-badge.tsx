import type { CustomerStatus } from '../_lib/customer-record'

const STATUS_STYLES: Record<CustomerStatus, { bg: string; border: string; text: string; label: string }> = {
    new:        { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)',   text: '#fbbf24', label: 'New' },
    read:       { bg: 'rgba(129,140,248,0.1)',  border: 'rgba(129,140,248,0.3)',  text: '#818cf8', label: 'Read' },
    contacted:  { bg: 'rgba(45,212,191,0.1)',   border: 'rgba(45,212,191,0.3)',   text: '#2dd4bf', label: 'Contacted' },
    ignored:    { bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.3)',  text: '#9ca3af', label: 'Ignored' },
    subscribed: { bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)',  text: '#a78bfa', label: 'Subscribed' },
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
    const s = STATUS_STYLES[status]
    return (
        <span
            className="inline-flex items-center rounded-[24px] px-3 py-[5px] text-[14px] font-medium border"
            style={{ background: s.bg, borderColor: s.border, color: s.text }}
        >
            {s.label}
        </span>
    )
}
