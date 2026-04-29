import type { CustomerSource } from '../_lib/customer-record'

const SOURCE_STYLES: Record<CustomerSource, { bg: string; border: string; text: string; label: string }> = {
    'contact-form': { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.1)',  text: '#3b82f6', label: 'Contact Forms' },
    'newsletter':   { bg: 'rgba(138,129,245,0.1)', border: 'rgba(138,129,245,0.1)', text: '#8a81f5', label: 'Newsletter Subscriptions' },
}

export function CustomerSourceBadge({ source }: { source: CustomerSource }) {
    const s = SOURCE_STYLES[source]
    return (
        <span
            className="inline-flex items-center rounded-[12px] px-3 py-[5px] text-[12px] font-medium border"
            style={{ background: s.bg, borderColor: s.border, color: s.text }}
        >
            {s.label}
        </span>
    )
}
