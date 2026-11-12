/**
 * Who may read a shop's payout bank account (bank, holder, full number): its active owners / admins and
 * super-admins. Viewers, editors, custom roles and pending members work without it (TC-PERF-151).
 */
export const PAYOUT_ACCOUNT_FIELDS = ['bank_name', 'account_holder_name', 'account_number'] as const

type Member = { roles?: unknown; tenants?: Array<Record<string, unknown> | null> | null } | null

export function canReadPayoutAccount(rawUser: unknown, tenantId: unknown): boolean {
    const user = rawUser && typeof rawUser === 'object' ? (rawUser as Member) : null
    if (Array.isArray(user?.roles) && user.roles.includes('super-admin')) return true
    if (tenantId == null) return false
    return (user?.tenants ?? []).some((m) => {
        if (!m) return false
        const t = m.tenant
        const mid = t && typeof t === 'object' ? (t as { id?: unknown }).id : t
        return String(mid) === String(tenantId)
            && (m.role === 'owner' || m.role === 'admin')
            && (m.status ?? 'active') === 'active'
    })
}

/** The tenant `payments` group without the payout account, for a caller who may not read it. */
export function withoutPayoutAccount<T extends object>(payments: T): T {
    const out: Record<string, unknown> = { ...(payments as Record<string, unknown>) }
    for (const field of PAYOUT_ACCOUNT_FIELDS) delete out[field]
    return out as T
}

/** What a buyer sees of the account number before ordering: `•••• 1234` (the settings promise the last 4). */
export function maskAccountNumber(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const digits = value.replace(/\s+/g, '')
    if (!digits) return null
    return `•••• ${digits.slice(-4)}`
}
