import type { ShopCustomerRecord } from '../_lib/shop-customer-record'

const RANK_CONFIG: Record<NonNullable<ShopCustomerRecord['rank']>, { bg: string; color: string; border: string; label: string; icon: string }> = {
    vip:    { bg: 'var(--cus-rank-vip-bg)',    color: 'var(--cus-rank-vip-fg)',    border: 'var(--cus-rank-vip-border)',    label: 'VIP',    icon: '⭐' },
    gold:   { bg: 'var(--cus-rank-gold-bg)',   color: 'var(--cus-rank-gold-fg)',   border: 'var(--cus-rank-gold-border)',   label: 'Gold',   icon: '🥇' },
    silver: { bg: 'var(--cus-rank-silver-bg)', color: 'var(--cus-rank-silver-fg)', border: 'var(--cus-rank-silver-border)', label: 'Silver', icon: '🥈' },
    bronze: { bg: 'var(--cus-rank-bronze-bg)', color: 'var(--cus-rank-bronze-fg)', border: 'var(--cus-rank-bronze-border)', label: 'Bronze', icon: '🥉' },
}

export function RankBadge({ rank }: { rank: ShopCustomerRecord['rank'] }) {
    if (!rank) return null
    const s = RANK_CONFIG[rank]
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold"
            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
        >
            <span>{s.icon}</span>
            {s.label}
        </span>
    )
}

function hashCode(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0
    return Math.abs(h)
}

function getInitials(name: string | null, email: string | null): string {
    if (name?.trim()) {
        const parts = name.trim().split(/\s+/)
        if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
        return parts[0]!.slice(0, 2).toUpperCase()
    }
    const c = email?.[0] ?? '?'
    return (c + c).toUpperCase()
}

export function CustomerAvatar({
    name,
    email,
    size = 36,
    square = false,
}: {
    name: string | null
    email: string | null
    size?: number
    square?: boolean
}) {
    const hue = hashCode(email ?? '') % 360
    return (
        <span
            className="shrink-0 inline-flex items-center justify-center font-bold select-none"
            style={{
                width: size,
                height: size,
                borderRadius: square ? Math.max(8, size * 0.22) : '50%',
                background: `hsl(${hue},55%,28%)`,
                color: `hsl(${hue},80%,78%)`,
                fontSize: Math.round(size * 0.38),
            }}
        >
            {getInitials(name, email)}
        </span>
    )
}
